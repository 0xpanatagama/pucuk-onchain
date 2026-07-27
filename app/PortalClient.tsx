"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

type Role = "Operator" | "Petani" | "Pabrik" | "Auditor";
type Screen = "home" | "intake" | "receipts" | "payments" | "verify" | "disputes";
type ReceiptState = "Draft" | "AwaitingFarmer" | "Registered" | "Approved" | "PartiallyPaid" | "Paid" | "Disputed" | "Superseded";
type ChainSnapshot = {
  connected: boolean;
  exists: boolean;
  receiptId: string;
  contractAddress: string;
  explorerUrl: string;
  state: ReceiptState;
  paidAmountIdr: string;
  totalPayableIdr: string;
  transactions: { hash: string; url: string }[];
};

const profiles: Record<Role, { name: string; email: string; org: string; initials: string; description: string }> = {
  Operator: { name: "Nadia Anwar", email: "nadia@pucuk.demo", org: "Titik Koleksi Cisarua", initials: "NA", description: "Catat penerimaan dan pemeriksaan daun" },
  Petani: { name: "Sari Rahayu", email: "sari@pucuk.demo", org: "Koperasi Pucuk Sejahtera", initials: "SR", description: "Tinjau receipt dan status pembayaran" },
  Pabrik: { name: "Rizky Pratama", email: "rizky@pucuk.demo", org: "Pabrik Teh Nusantara", initials: "RP", description: "Setujui kewajiban dan catat pembayaran" },
  Auditor: { name: "Ayu Kusuma", email: "ayu@pucuk.demo", org: "Tim Audit Pilot", initials: "AK", description: "Verifikasi bukti dan selesaikan sengketa" },
};

const nav: Record<Role, { screen: Screen; label: string; icon: string; badge?: string }[]> = {
  Operator: [
    { screen: "home", label: "Ringkasan penerimaan", icon: "home" },
    { screen: "intake", label: "Penerimaan baru", icon: "plus" },
    { screen: "receipts", label: "Perlu tindakan", icon: "alert", badge: "2" },
  ],
  Petani: [
    { screen: "home", label: "Perlu konfirmasi", icon: "home", badge: "1" },
    { screen: "receipts", label: "Tanda terima saya", icon: "file", badge: "3" },
    { screen: "disputes", label: "Koreksi", icon: "alert" },
  ],
  Pabrik: [
    { screen: "home", label: "Ringkasan pengadaan", icon: "home" },
    { screen: "payments", label: "Persetujuan & pembayaran", icon: "wallet", badge: "3" },
    { screen: "receipts", label: "Bukti penerimaan", icon: "file" },
  ],
  Auditor: [
    { screen: "home", label: "Pusat audit", icon: "home" },
    { screen: "verify", label: "Verifikasi receipt", icon: "shield" },
    { screen: "disputes", label: "Sengketa aktif", icon: "alert", badge: "1" },
  ],
};

const money = (value: number) => `Rp${new Intl.NumberFormat("id-ID").format(value)}`;
const shortHash = (value: string) => value.length > 18 ? `${value.slice(0, 10)}…${value.slice(-6)}` : value;

async function readApiResponse<T extends { error?: string }>(response: Response) {
  const body = await response.text();
  if (!body) {
    throw new Error(`Layanan registry gagal merespons (HTTP ${response.status})`);
  }
  try {
    return JSON.parse(body) as T;
  } catch {
    throw new Error(`Layanan registry mengirim respons yang tidak valid (HTTP ${response.status})`);
  }
}

function Icon({ name }: { name: string }) {
  const paths: Record<string, React.ReactNode> = {
    leaf: <><path d="M19 3C10 3 5 7.7 5 14c0 1.7.5 3.2 1.5 4.5"/><path d="M5 21c3.2-6.2 7.2-10 12-12"/></>,
    home: <><path d="m3 11 9-8 9 8"/><path d="M5 10v11h14V10M9 21v-7h6v7"/></>,
    plus: <><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></>,
    file: <><path d="M6 2h8l4 4v16H6z"/><path d="M14 2v5h5M9 12h6M9 16h6"/></>,
    wallet: <><path d="M3 6h16v14H3z"/><path d="M3 9h18v7h-6a3 3 0 0 1 0-6h6"/></>,
    shield: <><path d="M12 3 4 6v6c0 5 3.4 8 8 9 4.6-1 8-4 8-9V6z"/><path d="m8.5 12 2.3 2.3 4.8-5"/></>,
    alert: <><path d="M12 3 2.5 20h19z"/><path d="M12 9v4M12 17h.01"/></>,
    arrow: <path d="m9 18 6-6-6-6"/>,
    check: <path d="m5 12 4 4L19 6"/>,
    logout: <><path d="M10 4H4v16h6M14 8l4 4-4 4M8 12h10"/></>,
    camera: <><rect x="3" y="7" width="18" height="13" rx="2"/><path d="m8 7 1.5-3h5L16 7"/><circle cx="12" cy="13" r="3"/></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

export default function PortalClient() {
  const [session, setSession] = useState<Role | null>(null);
  const [selected, setSelected] = useState<Role>("Operator");
  const [screen, setScreen] = useState<Screen>("home");
  const [paid, setPaid] = useState(false);
  const [disputed, setDisputed] = useState(false);
  const [toast, setToast] = useState("");
  const [intakeStep, setIntakeStep] = useState(1);
  const [receiptState, setReceiptState] = useState<ReceiptState>("AwaitingFarmer");
  const [chain, setChain] = useState<ChainSnapshot | null>(null);
  const [chainBusy, setChainBusy] = useState(false);
  const [chainError, setChainError] = useState("");
  const reduceMotion = useReducedMotion();

  const flash = (text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(""), 2200);
  };

  const applySnapshot = useCallback((snapshot: ChainSnapshot) => {
    setChain(snapshot);
    setReceiptState(snapshot.state);
    setPaid(snapshot.state === "Paid");
    setDisputed(snapshot.state === "Disputed");
    setChainError("");
  }, []);

  const syncChain = useCallback(async () => {
    try {
      const response = await fetch("/api/registry", { cache: "no-store" });
      const data = await readApiResponse<ChainSnapshot & { error?: string }>(response);
      if (!response.ok) throw new Error(data.error || "Registry tidak dapat dibaca");
      applySnapshot(data);
    } catch (error) {
      setChainError(error instanceof Error ? error.message : "Registry tidak dapat dibaca");
    }
  }, [applySnapshot]);

  useEffect(() => {
    void syncChain();
  }, [syncChain]);

  const runChainAction = async (action: string, success: string) => {
    if (chainBusy) return false;
    setChainBusy(true);
    setChainError("");
    flash("Mengirim transaksi ke Base Sepolia…");
    try {
      const response = await fetch("/api/registry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await readApiResponse<ChainSnapshot & { error?: string }>(response);
      if (!response.ok) throw new Error(data.error || "Transaksi gagal");
      applySnapshot(data);
      flash(success);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Transaksi gagal";
      setChainError(message);
      flash("Transaksi belum berhasil. Coba lagi.");
      return false;
    } finally {
      setChainBusy(false);
    }
  };

  if (!session) {
    return <Login selected={selected} setSelected={setSelected} onLogin={() => {
      setSession(selected);
      setScreen("home");
    }} />;
  }

  const profile = profiles[session];
  const portalTitle = session === "Operator" ? "Portal Penerimaan" : session === "Petani" ? "Portal Petani" : session === "Pabrik" ? "Portal Pabrik" : "Portal Audit";
  const latestProof = chain?.transactions.at(-1);
  const proofUrl = latestProof?.url;
  const proofHash = latestProof?.hash || chain?.receiptId || "";
  let activeView: React.ReactNode;
  if (screen === "home" && session === "Operator") activeView = <OperatorHome onIntake={() => setScreen("intake")} onReceipt={() => setScreen("receipts")} />;
  else if (screen === "home" && session === "Petani") activeView = <FarmerHome paid={paid} state={receiptState} proofUrl={proofUrl} onAgree={() => { void runChainAction("farmerAgree", "Persetujuan petani tercatat di Base Sepolia"); }} onReject={() => { void runChainAction("farmerReject", "Tanda terima dikembalikan kepada operator"); }} onReceipt={() => setScreen("receipts")} onDispute={() => setScreen("disputes")} />;
  else if (screen === "home" && session === "Pabrik") activeView = <FactoryHome paid={paid} state={receiptState} proofUrl={proofUrl} onApprove={() => { void runChainAction("approve", "Kewajiban pabrik tercatat di Base Sepolia"); }} onPayments={() => setScreen("payments")} onReceipt={() => setScreen("receipts")} />;
  else if (screen === "home" && session === "Auditor") activeView = <AuditorHome disputed={disputed} onVerify={() => setScreen("verify")} onDispute={() => setScreen("disputes")} />;
  else if (screen === "intake" && session === "Operator") activeView = <Intake step={intakeStep} setStep={setIntakeStep} finish={() => { void runChainAction("create", "Tanda terima dibuat dan menunggu petani").then((ok) => { if (ok) setScreen("receipts"); }); }} />;
  else if (screen === "receipts") activeView = <ReceiptView role={session} state={receiptState} paid={paid} disputed={disputed} proofUrl={proofUrl} proofHash={proofHash} onPay={() => setScreen("payments")} onDispute={() => setScreen("disputes")} />;
  else if (screen === "payments" && session === "Pabrik") activeView = <Payments paid={paid} proofUrl={proofUrl} onPay={() => { void runChainAction("pay", "Bukti pembayaran IDR tercatat di Base Sepolia"); }} />;
  else if (screen === "verify" && session === "Auditor") activeView = <Verification proofUrl={proofUrl} proofHash={proofHash} />;
  else activeView = <Disputes role={session} disputed={disputed} onSubmit={() => { void runChainAction("dispute", session === "Auditor" ? "Sengketa ditandai untuk penyelesaian" : "Pengajuan koreksi tercatat di Base Sepolia"); }} />;

  return <div className={`portal-shell role-${session.toLowerCase()}`}>
    <AnimatePresence>{toast && <motion.div className="portal-toast" initial={{opacity:0,y:-14,scale:.96}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:-10,scale:.98}}><Icon name="check" />{toast}</motion.div>}</AnimatePresence>
    <aside className="portal-sidebar">
      <button className="portal-logo" onClick={() => setScreen("home")}><i><Icon name="leaf" /></i><strong>Pucuk</strong></button>
      <div className="portal-identity"><span>{profile.initials}</span><div><small>ANDA MASUK KE</small><strong>{portalTitle}</strong><em>{profile.org}</em></div></div>
      <nav><p>KHUSUS {session.toUpperCase()}</p>{nav[session].map((item) => <button key={item.screen} className={screen === item.screen ? "active" : ""} onClick={() => {
        setScreen(item.screen);
        if (item.screen === "intake") setIntakeStep(1);
      }}><Icon name={item.icon}/><span>{item.label}</span>{item.badge && <b>{item.badge}</b>}</button>)}</nav>
      <div className="portal-user"><span>{profile.initials}</span><div><strong>{profile.name}</strong><small>{session} · Demo</small></div></div>
      <button className="portal-logout" onClick={() => setSession(null)}><Icon name="logout" />Keluar & ganti akun</button>
    </aside>
    <main className="portal-main">
      <header className="portal-header"><div><small>{portalTitle}</small><strong>{profile.name}</strong></div><div className="header-actions"><a className={`network-pill ${chainError ? "error" : ""}`} href={chain?.explorerUrl || "https://sepolia.basescan.org/address/0x18708aE53414044F7651D7aA4982494bcb2E21b2"} target="_blank" rel="noreferrer"><i/>{chainBusy ? "Mengirim transaksi…" : chainError ? "Koneksi perlu diperiksa" : "Live · Base Sepolia"}</a><button className="mobile-role-switch" onClick={() => setSession(null)} aria-label="Keluar dan ganti akun"><Icon name="logout"/><span>Ganti akun</span></button></div></header>
      {(chain || chainError) && <div className={`chain-strip ${chainError ? "error" : ""}`}><span><Icon name={chainError ? "alert" : "shield"}/>{chainError ? chainError : `PP-2026-000042 · ${stateLabel(receiptState)}`}</span>{chain?.transactions.at(-1) && <a href={chain.transactions.at(-1)?.url} target="_blank" rel="noreferrer">Lihat transaksi terakhir <Icon name="arrow"/></a>}</div>}
      <AnimatePresence mode="wait"><motion.div key={`${session}-${screen}`} initial={reduceMotion ? false : {opacity:0,y:10}} animate={{opacity:1,y:0}} exit={reduceMotion ? undefined : {opacity:0,y:-6}} transition={{duration:.2,ease:"easeOut"}}>{activeView}</motion.div></AnimatePresence>
    </main>
  </div>;
}

function Login({ selected, setSelected, onLogin }: { selected: Role; setSelected: (role: Role) => void; onLogin: () => void }) {
  const profile = profiles[selected];
  return <main className="auth-page">
    <section className="auth-story">
      <div className="auth-logo"><i><Icon name="leaf" /></i><strong>Pucuk</strong></div>
      <div><p className="portal-kicker">CATAT · SEPAKATI · BAYAR</p><h1>Setiap daun tercatat.<br/>Setiap pembayaran jelas.</h1><p>Pucuk mencatat hasil timbang, kualitas, dan harga—lalu membantu semua pihak memantau pembayaran dan menelusuri buktinya.</p></div>
      <div className="auth-proof"><p><Icon name="check"/><span><strong>Transaksi tanpa tebak-tebakan</strong><small>Lihat berat, kualitas, harga, dan status pembayaran.</small></span></p><p><Icon name="shield"/><span><strong>Bukti siap ditelusuri</strong><small>Setiap perubahan tersimpan tanpa menghapus catatan awal.</small></span></p></div>
      <small>Demo testnet · Tidak ada pembayaran kripto</small>
    </section>
    <section className="auth-form-wrap"><div className="auth-card">
      <p className="portal-kicker">DEMO AKSES</p><h2>Masuk ke portal Anda</h2><p>Pilih identitas untuk mencoba pengalaman tiap pengguna.</p>
      <div className="identity-list">{(Object.keys(profiles) as Role[]).map((role) => <motion.button layout whileHover={{y:-2}} whileTap={{scale:.98}} key={role} className={selected === role ? "selected" : ""} onClick={() => setSelected(role)}>
        <span>{profiles[role].initials}</span><div><strong>{role}</strong><small>{profiles[role].description}</small></div>{selected === role && <Icon name="check"/>}
      </motion.button>)}</div>
      <form onSubmit={(event) => { event.preventDefault(); onLogin(); }}>
        <label>Email<input value={profile.email} readOnly/></label>
        <label>Kata sandi<input type="password" value="pucukproof" readOnly/></label>
        <button className="portal-primary" type="submit">Masuk sebagai {selected}<Icon name="arrow"/></button>
      </form>
      <div className="auth-selected"><span>{profile.initials}</span><div><strong>{profile.name}</strong><small>{profile.org}</small></div></div>
    </div></section>
  </main>;
}

function PageHead({ kicker, title, copy, action }: { kicker: string; title: string; copy: string; action?: React.ReactNode }) {
  return <div className="portal-page-head"><div><p className="portal-kicker">{kicker}</p><h1>{title}</h1><p>{copy}</p></div>{action}</div>;
}

function Metric({ icon, label, value, note, tone = "green" }: { icon: string; label: string; value: string; note: string; tone?: string }) {
  return <motion.article className="portal-metric" whileHover={{y:-3,boxShadow:"0 12px 28px rgba(24,61,45,.08)"}} transition={{duration:.18}}><i className={tone}><Icon name={icon}/></i><div><small>{label}</small><strong>{value}</strong><p>{note}</p></div></motion.article>;
}

const weeks = ["6 Mei","13","20","27","3 Jun","10","17","24","1 Jul","8","15","22"];

function AnalyticsControls({ scope, options }: { scope: string; options: string[] }) {
  const [range, setRange] = useState("12 minggu");
  return <div className="analytics-controls"><label><span>CAKUPAN</span><select aria-label="Cakupan data">{options.map((option) => <option key={option}>{option}</option>)}</select></label><label><span>PERIODE</span><select aria-label="Rentang tanggal" value={range} onChange={(event) => setRange(event.target.value)}><option>7 hari</option><option>30 hari</option><option>12 minggu</option><option>Musim ini</option></select></label><div className="analytics-fresh"><i/><span><b>{scope}</b><small>Diperbarui 27 Jul · 16:48</small></span></div></div>;
}

function TrendChart({ title, subtitle, data, second, legend = ["Aktual"], suffix = "" }: { title: string; subtitle: string; data: number[]; second?: number[]; legend?: string[]; suffix?: string }) {
  const width = 720, height = 210, pad = 18;
  const all = second ? [...data, ...second] : data;
  const min = Math.min(...all) * .88, max = Math.max(...all) * 1.06;
  const points = (values: number[]) => values.map((value, index) => `${pad + index * ((width - pad * 2) / (values.length - 1))},${height - pad - ((value - min) / (max - min)) * (height - pad * 2)}`).join(" ");
  return <section className="portal-card analytics-chart"><div className="chart-head"><div><h2>{title}</h2><p>{subtitle}</p></div><div className="chart-legend">{legend.map((item, index) => <span key={item}><i className={index ? "secondary" : ""}/>{item}</span>)}</div></div><div className="line-wrap"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>{[.2,.4,.6,.8].map((line) => <line key={line} x1={pad} x2={width-pad} y1={height*line} y2={height*line} className="grid-line"/>)}{second && <motion.polyline points={points(second)} className="trend-line secondary" initial={{pathLength:0,opacity:0}} animate={{pathLength:1,opacity:1}} transition={{duration:.8,ease:"easeOut"}}/>}<motion.polyline points={points(data)} className="trend-line" initial={{pathLength:0,opacity:0}} animate={{pathLength:1,opacity:1}} transition={{duration:.75,ease:"easeOut",delay:.08}}/>{data.map((value,index) => <circle key={index} cx={pad + index*((width-pad*2)/(data.length-1))} cy={height-pad-((value-min)/(max-min))*(height-pad*2)} r="3.5" className="trend-dot"><title>{weeks[index]}: {value}{suffix}</title></circle>)}</svg><div className="chart-axis">{weeks.map((week,index) => <span key={index}>{index % 2 === 0 ? week : ""}</span>)}</div></div></section>;
}

function RankedBars({ title, subtitle, rows }: { title: string; subtitle: string; rows: { label: string; value: number; display: string; tone?: string }[] }) {
  const max = Math.max(...rows.map((row) => row.value));
  return <section className="portal-card analytics-bars"><div className="chart-head"><div><h2>{title}</h2><p>{subtitle}</p></div></div><div className="bar-list">{rows.map((row) => <div className="bar-row" key={row.label}><span>{row.label}</span><div><i className={row.tone || ""} style={{width:`${Math.max(8,row.value/max*100)}%`}}/></div><b>{row.display}</b></div>)}</div></section>;
}

function AlertList({ title, subtitle, items }: { title: string; subtitle: string; items: { tone: string; title: string; note: string; status: string }[] }) {
  return <section className="portal-card analytics-alerts"><div className="chart-head"><div><h2>{title}</h2><p>{subtitle}</p></div></div>{items.map((item) => <div className="alert-row" key={item.title}><i className={item.tone}><Icon name={item.tone === "ok" ? "check" : "alert"}/></i><span><b>{item.title}</b><small>{item.note}</small></span><em className={`portal-status ${item.tone === "ok" ? "green" : item.tone === "warn" ? "amber" : "blue"}`}>{item.status}</em></div>)}</section>;
}

const stateLabel = (state: ReceiptState) => ({
  Draft: "Draf",
  AwaitingFarmer: "Menunggu konfirmasi petani",
  Registered: "Terdaftar · menunggu pabrik",
  Approved: "Kewajiban disetujui",
  PartiallyPaid: "Dibayar sebagian",
  Paid: "Sudah dibayar",
  Disputed: "Disengketakan",
  Superseded: "Digantikan",
}[state]);

function OperatorHome({ onIntake, onReceipt }: { onIntake: () => void; onReceipt: () => void }) {
  return <div className="portal-content"><PageHead kicker="PENERIMAAN HARI INI" title="Selesaikan catatan sebelum petani pulang" copy="Pastikan berat, kualitas, harga, dan foto bukti lengkap sebelum meminta persetujuan." action={<button className="portal-primary" onClick={onIntake}><Icon name="plus"/>Penerimaan baru</button>}/><AnalyticsControls scope="Data tanda terima" options={["Semua titik koleksi","Cisarua · CP-01","Pangalengan · CP-02"]}/><div className="portal-metrics analytics-kpis farmer-kpis"><Metric icon="leaf" label="BERAT DITERIMA" value="318,4 kg" note="7 tanda terima"/><Metric icon="file" label="DRAF BELUM SELESAI" value="2" note="Lanjutkan pencatatan" tone="amber"/><Metric icon="shield" label="MENUNGGU PETANI" value="3" note="Sudah dikirim"/><Metric icon="alert" label="BUKTI TIDAK LENGKAP" value="1" note="Foto timbangan" tone="amber"/></div><div className="analytics-grid"><TrendChart title="Median waktu penerimaan" subtitle="Menit dari timbang hingga dikirim ke petani · 12 minggu" data={[8.2,7.8,7.4,7.1,6.8,6.4,6.2,5.9,5.7,5.5,5.2,4.9]} legend={["Waktu proses"]} suffix=" menit"/><RankedBars title="Kelengkapan bukti" subtitle="14 tanda terima hari ini" rows={[{label:"Lengkap",value:12,display:"12"},{label:"Perlu foto",value:1,display:"1",tone:"amber"},{label:"Gagal dicatat",value:1,display:"1",tone:"blue"}]}/></div><section className="portal-card"><div className="portal-card-head"><div><h2>Perlu tindakan</h2><p>Buka tanda terima untuk menyelesaikan tahap berikutnya</p></div></div><ReceiptRows onOpen={onReceipt} operator/></section>
  </div>;
}

function FarmerHome({ paid, state, proofUrl, onAgree, onReject, onReceipt, onDispute }: { paid: boolean; state: ReceiptState; proofUrl?: string; onAgree: () => void; onReject: () => void; onReceipt: () => void; onDispute: () => void }) {
  return <div className="portal-content farmer-mobile"><PageHead kicker="PERLU KONFIRMASI" title="Periksa hasil penerimaan Anda" copy="Setujui hanya jika berat, kualitas, dan harga di bawah ini sudah benar."/><section className="portal-card confirmation-card"><div className="confirmation-top"><div><small>TANDA TERIMA PP-2026-000042</small><h2>Setoran 27 Juli 2026</h2><p>Nadia Anwar · Titik Koleksi Cisarua</p></div><i className={`portal-status ${state === "AwaitingFarmer" ? "amber" : "green"}`}>{state === "AwaitingFarmer" ? "Menunggu persetujuan Anda" : stateLabel(state)}</i></div><div className="confirmation-facts"><p><span>Berat diterima</span><b>42,50 kg</b></p><p><span>Hasil kualitas</span><b>Grade B · Pucuk halus 68%</b></p><p><span>Harga dasar</span><b>Rp2.200/kg</b></p><p><span>Premi kualitas</span><b className="good">+Rp100/kg</b></p><p><span>Potongan</span><b className="bad">−Rp50/kg</b></p><p className="total"><span>Yang akan dibayarkan</span><b>Rp95.625</b></p></div>{state === "AwaitingFarmer" && <div className="confirmation-actions"><button className="portal-secondary" onClick={onReject}>Tidak setuju</button><button className="portal-primary" onClick={onAgree}><Icon name="check"/>Setuju, data sudah benar</button></div>}<button className="technical-link" onClick={onReceipt}>Lihat bukti dan detail teknis <Icon name="arrow"/></button><a className="connection-note" href={proofUrl} target="_blank" rel="noreferrer"><i/><span><b>Terhubung ke Base Sepolia</b><small>Buka catatan publik transaksi ini di Basescan.</small></span><Icon name="arrow"/></a></section><div className="portal-metrics analytics-kpis farmer-kpis"><Metric icon="leaf" label="DAUN TERCATAT" value="428,6 kg" note="Musim ini"/><Metric icon="wallet" label="NILAI TANDA TERIMA" value="Rp964 rb" note="12 tanda terima"/><Metric icon="check" label="SUDAH DIBAYAR" value={paid ? "Rp964 rb" : "Rp773 rb"} note={paid ? "Tidak ada tunggakan" : "Rp191 rb tertunda"}/><Metric icon="file" label="MEDIAN PEMBAYARAN" value="2,4 hari" note="30 hari terakhir" tone="blue"/></div><button className="link-button farmer-correction" onClick={onDispute}>Ada data yang perlu dikoreksi?</button>
  </div>;
}

function FactoryHome({ paid, state, proofUrl, onApprove, onPayments, onReceipt }: { paid: boolean; state: ReceiptState; proofUrl?: string; onApprove: () => void; onPayments: () => void; onReceipt: () => void }) {
  return <div className="portal-content"><PageHead kicker="PENGADAAN & KEWAJIBAN" title="Tanda terima yang perlu diputuskan" copy="Setujui kewajiban komersial terlebih dahulu. Pembayaran IDR dicatat setelah transaksi benar-benar dilakukan." action={<button className="portal-primary" onClick={onPayments}>Buka pembayaran<Icon name="arrow"/></button>}/><AnalyticsControls scope="Data pengadaan Pucuk" options={["Semua titik koleksi","Cisarua · CP-01","Pangalengan · CP-02"]}/><div className="portal-metrics analytics-kpis farmer-kpis"><Metric icon="leaf" label="DAUN DITERIMA" value="1.284,6 kg" note="37 tanda terima"/><Metric icon="wallet" label="HARGA RATA-RATA" value="Rp2.284/kg" note="30 hari"/><Metric icon="shield" label="MENUNGGU PERSETUJUAN" value="3" note="Rp617.900" tone="amber"/><Metric icon="file" label="BELUM LUNAS" value={paid ? "2" : "3"} note={paid ? "Rp522.275" : "Rp617.900"} tone="blue"/></div><section className="portal-card liability-card"><div><small>KEWAJIBAN PP-2026-000042</small><h2>42,50 kg · Grade B · Rp95.625</h2><p>Operator dan petani telah menyetujui data yang sama. Catatan terdaftar di jaringan.</p></div><i className="portal-status blue">{stateLabel(state)}</i><div className="liability-actions"><button onClick={onReceipt}>Periksa bukti</button><a className="proof-action" href={proofUrl} target="_blank" rel="noreferrer">Lihat di Basescan <Icon name="arrow"/></a>{state === "Registered" && <button className="portal-primary" onClick={onApprove}>Setujui kewajiban</button>}{state === "Approved" && <button className="portal-primary" onClick={onPayments}>Catat pembayaran IDR</button>}</div></section><div className="analytics-grid"><TrendChart title="Nilai pengadaan tercatat" subtitle="Juta rupiah per minggu · 12 minggu terakhir" data={[1.8,2.0,1.9,2.2,2.1,2.3,2.25,2.4,2.3,2.5,2.45,2.62]} legend={["Nilai tanda terima"]} suffix=" jt"/><RankedBars title="Konsistensi pemasok" subtitle="Kelengkapan bukti per titik koleksi" rows={[{label:"Cisarua",value:98,display:"98%"},{label:"Pangalengan",value:94,display:"94%",tone:"blue"},{label:"Ciwidey",value:89,display:"89",tone:"amber"}]}/></div>
  </div>;
}

function AuditorHome({ disputed, onVerify, onDispute }: { disputed: boolean; onVerify: () => void; onDispute: () => void }) {
  return <div className="portal-content"><PageHead kicker="PUSAT AUDIT PILOT" title="Bukti, sengketa, dan rekonsiliasi" copy="Setiap akses auditor dicatat. Data pribadi hanya dibuka bila diperlukan untuk pemeriksaan." action={<button className="portal-primary" onClick={onVerify}><Icon name="shield"/>Verifikasi tanda terima</button>}/><AnalyticsControls scope="Setiap akses auditor dicatat" options={["Seluruh pilot · 18 petani","Koperasi Pucuk Sejahtera","Pabrik Teh Nusantara"]}/><div className="portal-metrics analytics-kpis farmer-kpis"><Metric icon="shield" label="TANDA TERIMA TERDAFTAR" value="42" note="Pilot aktif"/><Metric icon="check" label="HASH COCOK" value="41 / 42" note="1 perlu rekonsiliasi"/><Metric icon="file" label="BUKTI LENGKAP" value="39 / 42" note="92,9%"/><Metric icon="alert" label="SENGKETA TERBUKA" value={disputed ? "2" : "1"} note="Urut usia & risiko" tone="amber"/></div><div className="analytics-grid"><TrendChart title="Tanda terima terdaftar" subtitle="Jumlah per minggu · data pilot 18 petani" data={[2,3,2,4,3,4,3,5,4,4,3,5]} legend={["Terdaftar"]}/><RankedBars title="Status assurance" subtitle="42 tanda terima dalam pilot" rows={[{label:"Hash cocok",value:41,display:"41"},{label:"Bukti lengkap",value:39,display:"39",tone:"blue"},{label:"Perlu rekonsiliasi",value:1,display:"1",tone:"amber"}]}/></div><AlertList title="Kasus prioritas" subtitle="Buka kasus untuk membandingkan catatan awal dan usulan koreksi" items={[{tone:"warn",title:"PP-2026-000039 · selisih berat",note:"42,50 kg awal · 41,50 kg diusulkan",status:"Tinjau"},{tone:"info",title:"PP-2026-000036 · bukti belum lengkap",note:"Foto timbangan belum tersedia",status:"Minta bukti"},{tone:"ok",title:"Rekonsiliasi jaringan terakhir",note:"41 hash aplikasi cocok dengan registry",status:"Sehat"}]}/><button className="portal-primary audit-case-cta" onClick={onDispute}>Tinjau sengketa dan bukti<Icon name="arrow"/></button>
  </div>;
}

function ReceiptRows({ onOpen, operator = false }: { onOpen: () => void; operator?: boolean }) {
  const rows = [["PP-2026-000042","Sari Rahayu","42,50 kg","Rp95.625"],["PP-2026-000041","Dedi Suhendar","38,20 kg","Rp90.725"],["PP-2026-000040","Nani Marlina","51,75 kg","Rp116.438"]];
  return <div className="receipt-rows">{rows.map((row, index) => <button key={row[0]} onClick={onOpen}><span className="mini-avatar">{row[1].split(" ").map((word) => word[0]).join("")}</span><span><strong>{row[1]}</strong><small>{row[0]}</small></span><span><strong>{row[2]}</strong><small>{operator ? "Grade B" : "Berat"}</small></span><span><strong>{row[3]}</strong><small>Total</small></span><i className={`portal-status ${index === 0 ? "blue" : "green"}`}>{index === 0 ? "Perlu tindakan" : "Lengkap"}</i><Icon name="arrow"/></button>)}</div>;
}

function Intake({ step, setStep, finish }: { step: number; setStep: (step: number) => void; finish: () => void }) {
  const labels = ["Penerimaan","Kualitas","Harga","Konfirmasi"];
  return <div className="portal-content compact"><PageHead kicker="PENERIMAAN BARU" title={labels[step - 1]} copy="Lengkapi catatan fisik sebelum meminta konfirmasi petani."/>
    <div className="intake-steps">{labels.map((label, index) => <div className={index + 1 <= step ? "active" : ""} key={label}><span>{index + 1 < step ? <Icon name="check"/> : index + 1}</span><strong>{label}</strong></div>)}</div>
    <section className="portal-card intake-card">
      {step === 1 && <><h2>Catat penerimaan fisik</h2><div className="field-grid"><label>Petani<select><option>Sari Rahayu · F-007</option></select></label><label>Titik koleksi<select><option>Cisarua · CP-01</option></select></label><label>Berat kotor (kg)<input defaultValue="42,50"/></label><label>Waktu penerimaan<input defaultValue="27/07/2026 · 16:42" readOnly/></label></div><button className="upload-box"><Icon name="camera"/><span><strong>Tambah foto penerimaan</strong><small>Wajib · JPG/PNG hingga 8 MB</small></span></button></>}
      {step === 2 && <><h2>Pemeriksaan sampel</h2><p className="form-hint">Protokol PP-QP-0.1 · Sampel representatif 500 g</p><div className="field-grid four"><label>Grade<select><option>B</option></select></label><label>Pucuk halus (%)<input defaultValue="68"/></label><label>Daun kasar (%)<input defaultValue="25"/></label><label>Batang (%)<input defaultValue="7"/></label></div><div className="form-success"><Icon name="check"/>Komposisi sampel lengkap: 100%</div></>}
      {step === 3 && <><h2>Rincian harga</h2><div className="price-box"><p><span>Harga dasar</span><b>Rp2.200/kg</b></p><p><span>Premi kualitas</span><b className="good">+Rp100/kg</b></p><p><span>Potongan</span><b className="bad">−Rp50/kg</b></p><hr/><p><span>Harga akhir</span><b>Rp2.250/kg</b></p><div><small>42,50 kg × Rp2.250</small><strong>Rp95.625</strong></div></div></>}
      {step === 4 && <><h2>Siap meminta konfirmasi</h2><div className="plain-confirm">Sari Rahayu mengirim <strong>42,50 kg pucuk teh</strong>. Grade B, harga akhir <strong>Rp2.250/kg</strong>, total pembayaran <strong>Rp95.625</strong>.</div><label className="check-row"><input type="checkbox" defaultChecked/> Saya sudah memeriksa berat, kualitas, harga, dan bukti.</label></>}
      <div className="portal-form-actions"><button disabled={step === 1} onClick={() => setStep(step - 1)}>Kembali</button><button className="portal-primary" onClick={() => step < 4 ? setStep(step + 1) : finish()}>{step < 4 ? "Lanjutkan" : "Buat tanda terima"}<Icon name="arrow"/></button></div>
    </section>
  </div>;
}

function ReceiptView({ role, state, paid, disputed, proofUrl, proofHash, onPay, onDispute }: { role: Role; state: ReceiptState; paid: boolean; disputed: boolean; proofUrl?: string; proofHash: string; onPay: () => void; onDispute: () => void }) {
  return <div className="portal-content compact"><PageHead kicker={role === "Petani" ? "TANDA TERIMA SAYA" : "BUKTI PENERIMAAN"} title="PP-2026-000042" copy="27 Juli 2026 · Titik Koleksi Cisarua"/>
    <div className="receipt-layout"><section className="portal-card receipt-paper"><div className="receipt-parties"><div><small>PETANI</small><strong>Sari Rahayu</strong><p>Koperasi Pucuk Sejahtera</p></div><Icon name="arrow"/><div><small>PENERIMA</small><strong>Pabrik Teh Nusantara</strong><p>Operator: Nadia Anwar</p></div></div><div className="receipt-total"><small>TOTAL YANG HARUS DIBAYAR</small><strong>Rp95.625</strong><p>42,50 kg × Rp2.250/kg</p></div><div className="receipt-facts"><p><span>Status saat ini</span><i className={`portal-status ${state === "Paid" ? "green" : "blue"}`}>{stateLabel(state)}</i></p><p><span>Perhitungan harga</span><b>Rp2.200 + Rp100 − Rp50 /kg</b></p><p><span>Komposisi kualitas</span><b>Halus 68% · Kasar 25% · Batang 7%</b></p><p><span>Protokol bukti</span><b>PP-QP-0.1 · Lengkap</b></p></div></section>
    <aside><a className="portal-card chain-proof" href={proofUrl} target="_blank" rel="noreferrer" aria-label="Buka bukti transaksi PP-2026-000042 di Basescan"><i><Icon name="shield"/></i><div><small>BUKTI KETIDAKBERUBAHAN</small><h3>Catatan cocok dengan Base Sepolia</h3><p>Ini membuktikan catatan tidak berubah setelah didaftarkan, bukan bahwa pengukuran fisik pasti benar.</p><code>{shortHash(proofHash)} <span>Buka di Basescan <Icon name="arrow"/></span></code></div></a>{role === "Pabrik" && state === "Approved" && !paid && <button className="portal-primary full" onClick={onPay}>Catat pembayaran IDR</button>}{role === "Petani" && !disputed && <button className="portal-secondary full" onClick={onDispute}>Ajukan koreksi dari tanda terima ini</button>}</aside></div><ReceiptLifecycle current={state}/>
  </div>;
}

function ReceiptLifecycle({ current }: { current: ReceiptState }) {
  const steps: { key: ReceiptState; label: string; owner: string }[] = [
    {key:"Draft",label:"Draf",owner:"Operator mencatat"},
    {key:"AwaitingFarmer",label:"Menunggu petani",owner:"Petani memeriksa"},
    {key:"Registered",label:"Terdaftar",owner:"Hash dikonfirmasi"},
    {key:"Approved",label:"Kewajiban disetujui",owner:"Pabrik menyetujui"},
    {key:"PartiallyPaid",label:"Dibayar sebagian",owner:"Pembayaran IDR"},
    {key:"Paid",label:"Sudah dibayar",owner:"Lunas"},
  ];
  const currentIndex = steps.findIndex((step) => step.key === current);
  return <section className="portal-card lifecycle-card"><div className="portal-card-head"><div><h2>Perjalanan tanda terima</h2><p>Setiap keputusan tersimpan sebagai peristiwa baru. Catatan lama tidak dihapus.</p></div></div><div className="lifecycle-track">{steps.map((step,index) => <div key={step.key} className={`${index <= currentIndex ? "done" : ""} ${step.key === current ? "current" : ""}`}><i>{index < currentIndex ? <Icon name="check"/> : index + 1}</i><span><b>{step.label}</b><small>{step.owner}</small></span></div>)}</div>{current === "Disputed" && <div className="lifecycle-branch"><Icon name="alert"/><span><b>Disengketakan</b><small>Auditor dapat meminta bukti, mempertahankan catatan awal, atau menerbitkan pengganti.</small></span></div>}</section>;
}

function Payments({ paid, proofUrl, onPay }: { paid: boolean; proofUrl?: string; onPay: () => void }) {
  return <div className="portal-content"><PageHead kicker="PORTAL PABRIK" title="Kewajiban pembayaran" copy="Pembayaran dilakukan dalam IDR; bukti privat tetap terlindungi."/>
    {paid && <a className="payment-proof" href={proofUrl} target="_blank" rel="noreferrer"><Icon name="check"/><span><b>Pembayaran PP-2026-000042 sudah tercatat</b><small>Periksa waktu, pengirim, status, dan event pembayaran di Basescan.</small></span><strong>Lihat bukti transaksi <Icon name="arrow"/></strong></a>}
    <section className="portal-card payment-table"><div className="payment-head"><span>TANDA TERIMA</span><span>PETANI</span><span>BERAT</span><span>TOTAL</span><span>STATUS</span><span/></div>{!paid && <div className="payment-row"><strong>PP-2026-000042</strong><span>Sari Rahayu</span><span>42,50 kg</span><strong>Rp95.625</strong><i className="portal-status blue">Kewajiban disetujui</i><button onClick={onPay}>Catat pembayaran IDR</button></div>}<div className="payment-row"><strong>PP-2026-000038</strong><span>Dedi Suhendar</span><span>44,20 kg</span><strong>Rp104.975</strong><i className="portal-status amber">Dibayar sebagian</i><button onClick={onPay}>Catat sisa pembayaran</button></div></section>
  </div>;
}

function Verification({ proofUrl, proofHash }: { proofUrl?: string; proofHash: string }) {
  return <div className="portal-content compact"><PageHead kicker="PORTAL AUDIT" title="Verifikasi receipt" copy="Bandingkan bukti aplikasi dengan catatan publik."/>
    <section className="verify-result"><i><Icon name="shield"/></i><p>HASIL VERIFIKASI</p><h2>COCOK</h2><span>Metadata receipt sama dengan hash di Base Sepolia.</span><div><article><small>HASH APLIKASI</small><code>{shortHash(proofHash)}</code></article><b>=</b><article><small>HASH ON-CHAIN</small><code>{shortHash(proofHash)}</code></article></div><a className="verify-explorer" href={proofUrl} target="_blank" rel="noreferrer">Periksa bukti publik di Basescan <Icon name="arrow"/></a></section>
  </div>;
}

function Disputes({ role, disputed, onSubmit }: { role: Role; disputed: boolean; onSubmit: () => void }) {
  if (role === "Auditor") return <div className="portal-content compact"><PageHead kicker="PORTAL AUDIT" title="Sengketa aktif" copy="Tinjau bukti dan pertahankan riwayat asli."/><section className="portal-card case-card"><i><Icon name="alert"/></i><div><small>PP-2026-000039</small><h2>Perbedaan berat penerimaan</h2><p>Petani mengajukan bukti timbangan 41,50 kg; receipt mencatat 42,50 kg.</p><span className="portal-status amber">{disputed ? "Siap diselesaikan" : "Menunggu tinjauan"}</span></div><button className="portal-primary" onClick={onSubmit}>Tinjau bukti</button></section></div>;
  return <div className="portal-content compact"><PageHead kicker="PORTAL PETANI" title="Ajukan koreksi" copy="Catatan asli tidak dihapus. Koreksi membuat receipt pengganti yang saling terhubung."/><section className="portal-card dispute-form"><label>Bagian yang tidak sesuai<select><option>Berat penerimaan</option><option>Hasil kualitas</option><option>Harga atau potongan</option></select></label><label>Jelaskan masalah<textarea placeholder="Tuliskan angka atau informasi yang menurut Anda perlu dikoreksi…"/></label><button className="upload-box"><Icon name="camera"/><span><strong>Tambah bukti</strong><small>Foto timbangan atau catatan lain</small></span></button><button className="portal-primary" disabled={disputed} onClick={onSubmit}>{disputed ? "Pengajuan sudah terkirim" : "Kirim pengajuan koreksi"}</button></section></div>;
}
