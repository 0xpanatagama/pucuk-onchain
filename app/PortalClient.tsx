"use client";

import { useMemo, useState } from "react";

type Role = "Operator" | "Petani" | "Pabrik" | "Auditor";
type Screen = "home" | "intake" | "receipts" | "payments" | "verify" | "disputes";

const profiles: Record<Role, { name: string; email: string; org: string; initials: string; description: string }> = {
  Operator: { name: "Nadia Anwar", email: "nadia@pucukproof.demo", org: "Titik Koleksi Cisarua", initials: "NA", description: "Catat penerimaan dan pemeriksaan daun" },
  Petani: { name: "Sari Rahayu", email: "sari@pucukproof.demo", org: "Koperasi Pucuk Sejahtera", initials: "SR", description: "Tinjau receipt dan status pembayaran" },
  Pabrik: { name: "Rizky Pratama", email: "rizky@pucukproof.demo", org: "Pabrik Teh Nusantara", initials: "RP", description: "Setujui kewajiban dan catat pembayaran" },
  Auditor: { name: "Ayu Kusuma", email: "ayu@pucukproof.demo", org: "Tim Audit Pilot", initials: "AK", description: "Verifikasi bukti dan selesaikan sengketa" },
};

const nav: Record<Role, { screen: Screen; label: string; icon: string; badge?: string }[]> = {
  Operator: [
    { screen: "home", label: "Ringkasan intake", icon: "home" },
    { screen: "intake", label: "Penerimaan baru", icon: "plus" },
    { screen: "receipts", label: "Tanda terima", icon: "file", badge: "12" },
  ],
  Petani: [
    { screen: "home", label: "Beranda saya", icon: "home" },
    { screen: "receipts", label: "Tanda terima saya", icon: "file", badge: "3" },
    { screen: "disputes", label: "Ajukan koreksi", icon: "alert" },
  ],
  Pabrik: [
    { screen: "home", label: "Ringkasan pabrik", icon: "home" },
    { screen: "payments", label: "Kewajiban bayar", icon: "wallet", badge: "3" },
    { screen: "receipts", label: "Bukti penerimaan", icon: "file" },
  ],
  Auditor: [
    { screen: "home", label: "Pusat audit", icon: "home" },
    { screen: "verify", label: "Verifikasi receipt", icon: "shield" },
    { screen: "disputes", label: "Sengketa aktif", icon: "alert", badge: "1" },
  ],
};

const money = (value: number) => `Rp${new Intl.NumberFormat("id-ID").format(value)}`;

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

  const flash = (text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(""), 2200);
  };

  if (!session) {
    return <Login selected={selected} setSelected={setSelected} onLogin={() => {
      setSession(selected);
      setScreen("home");
    }} />;
  }

  const profile = profiles[session];
  const portalTitle = session === "Operator" ? "Portal Penerimaan" : session === "Petani" ? "Portal Petani" : session === "Pabrik" ? "Portal Pabrik" : "Portal Audit";

  return <div className={`portal-shell role-${session.toLowerCase()}`}>
    {toast && <div className="portal-toast"><Icon name="check" />{toast}</div>}
    <aside className="portal-sidebar">
      <button className="portal-logo" onClick={() => setScreen("home")}><i><Icon name="leaf" /></i><strong>Pucuk<span>Proof</span></strong></button>
      <div className="portal-identity"><span>{profile.initials}</span><div><small>ANDA MASUK KE</small><strong>{portalTitle}</strong><em>{profile.org}</em></div></div>
      <nav><p>KHUSUS {session.toUpperCase()}</p>{nav[session].map((item) => <button key={item.screen} className={screen === item.screen ? "active" : ""} onClick={() => {
        setScreen(item.screen);
        if (item.screen === "intake") setIntakeStep(1);
      }}><Icon name={item.icon}/><span>{item.label}</span>{item.badge && <b>{item.badge}</b>}</button>)}</nav>
      <div className="portal-user"><span>{profile.initials}</span><div><strong>{profile.name}</strong><small>{session} · Demo</small></div></div>
      <button className="portal-logout" onClick={() => setSession(null)}><Icon name="logout" />Keluar & ganti akun</button>
    </aside>
    <main className="portal-main">
      <header className="portal-header"><div><small>{portalTitle}</small><strong>{profile.name}</strong></div><div className="network-pill"><i/>Demo · Base Sepolia</div></header>
      {screen === "home" && session === "Operator" && <OperatorHome onIntake={() => setScreen("intake")} onReceipt={() => setScreen("receipts")} />}
      {screen === "home" && session === "Petani" && <FarmerHome paid={paid} onReceipt={() => setScreen("receipts")} onDispute={() => setScreen("disputes")} />}
      {screen === "home" && session === "Pabrik" && <FactoryHome paid={paid} onPayments={() => setScreen("payments")} onReceipt={() => setScreen("receipts")} />}
      {screen === "home" && session === "Auditor" && <AuditorHome disputed={disputed} onVerify={() => setScreen("verify")} onDispute={() => setScreen("disputes")} />}
      {screen === "intake" && session === "Operator" && <Intake step={intakeStep} setStep={setIntakeStep} finish={() => { setScreen("receipts"); flash("Tanda terima berhasil dibuat"); }} />}
      {screen === "receipts" && <ReceiptView role={session} paid={paid} disputed={disputed} onPay={() => setScreen("payments")} onDispute={() => setScreen("disputes")} />}
      {screen === "payments" && session === "Pabrik" && <Payments paid={paid} onPay={() => { setPaid(true); flash("Pembayaran IDR berhasil dicatat"); }} />}
      {screen === "verify" && session === "Auditor" && <Verification />}
      {screen === "disputes" && <Disputes role={session} disputed={disputed} onSubmit={() => { setDisputed(true); flash(session === "Auditor" ? "Sengketa ditandai untuk penyelesaian" : "Pengajuan koreksi terkirim"); }} />}
    </main>
  </div>;
}

function Login({ selected, setSelected, onLogin }: { selected: Role; setSelected: (role: Role) => void; onLogin: () => void }) {
  const profile = profiles[selected];
  return <main className="auth-page">
    <section className="auth-story">
      <div className="auth-logo"><i><Icon name="leaf" /></i><strong>Pucuk<span>Proof</span></strong></div>
      <div><p className="portal-kicker">PILOT TRANSAKSI DAUN TEH</p><h1>Satu bukti.<br/>Empat portal berbeda.</h1><p>Setiap pengguna hanya melihat informasi dan tindakan yang mereka perlukan.</p></div>
      <div className="auth-proof"><p><Icon name="check"/><span><strong>Jelas bagi petani</strong><small>Berat, kualitas, harga, dan pembayaran.</small></span></p><p><Icon name="shield"/><span><strong>Dapat diaudit</strong><small>Riwayat asli tetap utuh saat dikoreksi.</small></span></p></div>
      <small>Demo testnet · Tidak ada pembayaran kripto</small>
    </section>
    <section className="auth-form-wrap"><div className="auth-card">
      <p className="portal-kicker">DEMO AKSES</p><h2>Masuk ke portal Anda</h2><p>Pilih identitas untuk mencoba pengalaman tiap pengguna.</p>
      <div className="identity-list">{(Object.keys(profiles) as Role[]).map((role) => <button key={role} className={selected === role ? "selected" : ""} onClick={() => setSelected(role)}>
        <span>{profiles[role].initials}</span><div><strong>{role}</strong><small>{profiles[role].description}</small></div>{selected === role && <Icon name="check"/>}
      </button>)}</div>
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
  return <article className="portal-metric"><i className={tone}><Icon name={icon}/></i><div><small>{label}</small><strong>{value}</strong><p>{note}</p></div></article>;
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
  return <section className="portal-card analytics-chart"><div className="chart-head"><div><h2>{title}</h2><p>{subtitle}</p></div><div className="chart-legend">{legend.map((item, index) => <span key={item}><i className={index ? "secondary" : ""}/>{item}</span>)}</div></div><div className="line-wrap"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>{[.2,.4,.6,.8].map((line) => <line key={line} x1={pad} x2={width-pad} y1={height*line} y2={height*line} className="grid-line"/>)}{second && <polyline points={points(second)} className="trend-line secondary"/>}<polyline points={points(data)} className="trend-line"/>{data.map((value,index) => <circle key={index} cx={pad + index*((width-pad*2)/(data.length-1))} cy={height-pad-((value-min)/(max-min))*(height-pad*2)} r="3.5" className="trend-dot"><title>{weeks[index]}: {value}{suffix}</title></circle>)}</svg><div className="chart-axis">{weeks.map((week,index) => <span key={index}>{index % 2 === 0 ? week : ""}</span>)}</div></div></section>;
}

function RankedBars({ title, subtitle, rows }: { title: string; subtitle: string; rows: { label: string; value: number; display: string; tone?: string }[] }) {
  const max = Math.max(...rows.map((row) => row.value));
  return <section className="portal-card analytics-bars"><div className="chart-head"><div><h2>{title}</h2><p>{subtitle}</p></div></div><div className="bar-list">{rows.map((row) => <div className="bar-row" key={row.label}><span>{row.label}</span><div><i className={row.tone || ""} style={{width:`${Math.max(8,row.value/max*100)}%`}}/></div><b>{row.display}</b></div>)}</div></section>;
}

function AlertList({ title, subtitle, items }: { title: string; subtitle: string; items: { tone: string; title: string; note: string; status: string }[] }) {
  return <section className="portal-card analytics-alerts"><div className="chart-head"><div><h2>{title}</h2><p>{subtitle}</p></div></div>{items.map((item) => <div className="alert-row" key={item.title}><i className={item.tone}><Icon name={item.tone === "ok" ? "check" : "alert"}/></i><span><b>{item.title}</b><small>{item.note}</small></span><em className={`portal-status ${item.tone === "ok" ? "green" : item.tone === "warn" ? "amber" : "blue"}`}>{item.status}</em></div>)}</section>;
}

function OperatorHome({ onIntake, onReceipt }: { onIntake: () => void; onReceipt: () => void }) {
  return <div className="portal-content"><PageHead kicker="KENDALI OPERASIONAL" title="Aktivitas titik koleksi" copy="Pantau intake, verifikasi, dan pergerakan batch hari ini." action={<button className="portal-primary" onClick={onIntake}><Icon name="plus"/>Penerimaan baru</button>}/><AnalyticsControls scope="Operasional langsung" options={["Semua titik koleksi","Cisarua · CP-01","Pangalengan · CP-02"]}/><div className="portal-metrics analytics-kpis"><Metric icon="leaf" label="BATCH AKTIF" value="8" note="+2 sejak pagi"/><Metric icon="file" label="SUBMISI PETANI" value="37" note="1.284,6 kg" tone="blue"/><Metric icon="shield" label="MENUNGGU VERIFIKASI" value="5" note="2 lewat SLA" tone="amber"/><Metric icon="wallet" label="LOGISTIK SELESAI" value="76%" note="19 dari 25 batch"/><Metric icon="alert" label="PENGECUALIAN" value="3" note="Perlu tindakan" tone="amber"/></div><div className="analytics-grid"><TrendChart title="Volume penerimaan" subtitle="Kilogram per minggu · seluruh titik koleksi" data={[840,930,890,1080,1020,1180,1110,1270,1200,1380,1310,1485]} second={[800,860,900,940,980,1020,1060,1100,1140,1180,1220,1260]} legend={["Aktual","Rencana"]} suffix=" kg"/><RankedBars title="Progres logistik batch" subtitle="Status 25 batch aktif hari ini" rows={[{label:"Tiba di pabrik",value:19,display:"19"},{label:"Dalam perjalanan",value:4,display:"4",tone:"blue"},{label:"Menunggu angkut",value:2,display:"2",tone:"amber"}]}/></div><div className="analytics-grid bottom"><AlertList title="Pengecualian operasional" subtitle="Diurutkan berdasarkan urgensi" items={[{tone:"warn",title:"Batch BT-0727-08 melewati SLA",note:"Menunggu kendaraan · 48 menit",status:"Tinggi"},{tone:"info",title:"2 receipt belum lengkap",note:"Foto timbangan belum terunggah",status:"Tinjau"},{tone:"ok",title:"Sinkronisasi perangkat sehat",note:"8 perangkat aktif",status:"Normal"}]}/><section className="portal-card"><div className="portal-card-head"><div><h2>Submisi petani terbaru</h2><p>Antrian verifikasi di Titik Koleksi Cisarua</p></div></div><ReceiptRows onOpen={onReceipt} operator/></section></div>
  </div>;
}

function FarmerHome({ paid, onReceipt, onDispute }: { paid: boolean; onReceipt: () => void; onDispute: () => void }) {
  return <div className="portal-content"><PageHead kicker="RINGKASAN KEBUN SAYA" title="Halo, Ibu Sari." copy="Hasil panen, kualitas, pengiriman, dan pendapatan Anda."/><AnalyticsControls scope="Data pribadi terlindungi" options={["Semua kebun saya","Blok Utara","Blok Lembah"]}/><div className="portal-metrics analytics-kpis farmer-kpis"><Metric icon="leaf" label="PANEN MUSIM INI" value="1.284 kg" note="+8,4% dari musim lalu"/><Metric icon="shield" label="GRADE A + B" value="91%" note="+4 poin kualitas" tone="blue"/><Metric icon="wallet" label="ESTIMASI PENDAPATAN" value="Rp2,89 jt" note="Rp191 rb belum dibayar"/><Metric icon="file" label="PENGIRIMAN" value="12 / 13" note="1 sedang diverifikasi" tone="amber"/></div><div className="analytics-grid"><TrendChart title="Volume panen mingguan" subtitle="Kilogram diterima · 12 minggu terakhir" data={[72,84,78,95,102,110,98,124,116,132,125,148]} second={[68,74,76,82,88,92,96,100,104,108,112,116]} legend={["Panen saya","Rata-rata koperasi"]} suffix=" kg"/><RankedBars title="Komposisi kualitas" subtitle="Berdasarkan 1.284 kg yang diterima" rows={[{label:"Grade A",value:38,display:"38%"},{label:"Grade B",value:53,display:"53%",tone:"blue"},{label:"Grade C",value:9,display:"9%",tone:"amber"}]}/></div><div className="analytics-grid bottom"><AlertList title="Status pengiriman & pembayaran" subtitle="Tindakan yang relevan untuk Anda" items={[{tone:paid ? "ok" : "info",title:"PP-2026-000042 · Rp95.625",note:"42,50 kg · 27 Jul 2026",status:paid ? "Dibayar" : "Menunggu"},{tone:"ok",title:"PP-2026-000038 · Rp112.500",note:"50,00 kg · dibayar 24 Jul",status:"Dibayar"},{tone:"warn",title:"Konfirmasi kualitas diperlukan",note:"Receipt PP-2026-000042",status:"Periksa"}]}/><section className="portal-card farmer-help analytics-help"><h2>Catatan Anda tetap dalam kendali</h2><p>Hanya Anda dan pihak yang diberi izin yang dapat melihat data kebun serta pembayaran ini.</p><button onClick={onReceipt}>Periksa receipt</button><button className="link-button" onClick={onDispute}>Ajukan koreksi</button></section></div>
  </div>;
}

function FactoryHome({ paid, onPayments, onReceipt }: { paid: boolean; onPayments: () => void; onReceipt: () => void }) {
  return <div className="portal-content"><PageHead kicker="INTELIJEN PRODUKSI" title="Kinerja pabrik hari ini" copy="Pantau pasokan, hasil proses, kapasitas, dan mutu produksi." action={<button className="portal-primary" onClick={onPayments}>Kewajiban pembayaran<Icon name="arrow"/></button>}/><AnalyticsControls scope="Pabrik Teh Nusantara" options={["Semua lini","Lini Orthodox","Lini CTC"]}/><div className="portal-metrics analytics-kpis"><Metric icon="leaf" label="PASOKAN MASUK" value="4,82 ton" note="+6,2% vs rencana"/><Metric icon="check" label="YIELD PROSES" value="22,8%" note="Target 22,0%"/><Metric icon="shield" label="UTILISASI KAPASITAS" value="84%" note="5 dari 6 lini aktif" tone="blue"/><Metric icon="file" label="OUTPUT PRODUKSI" value="1,10 ton" note="+7,5% minggu ini"/><Metric icon="wallet" label="INVENTORI JADI" value="6,4 ton" note="Cukup 5,2 hari" tone="amber"/></div><div className="analytics-grid"><TrendChart title="Pasokan masuk dan output" subtitle="Ton per minggu · 12 minggu terakhir" data={[3.8,4.1,3.9,4.4,4.2,4.6,4.5,4.8,4.6,5.0,4.7,4.82]} second={[.82,.91,.86,.98,.94,1.02,1.01,1.08,1.04,1.12,1.06,1.10]} legend={["Pasokan","Output"]} suffix=" ton"/><RankedBars title="Kinerja kualitas" subtitle="Proporsi output sesuai grade" rows={[{label:"Premium",value:31,display:"31%"},{label:"Standard",value:61,display:"61%",tone:"blue"},{label:"Rework",value:8,display:"8%",tone:"amber"}]}/></div><div className="analytics-grid bottom"><RankedBars title="Utilisasi lini produksi" subtitle="Kapasitas terpakai hari ini" rows={[{label:"Orthodox 1",value:94,display:"94%"},{label:"CTC 1",value:88,display:"88%",tone:"blue"},{label:"Orthodox 2",value:71,display:"71%",tone:"amber"}]}/><AlertList title="Risiko produksi" subtitle="Sinyal operasional yang perlu ditindak" items={[{tone:"warn",title:"Inventori kemasan di bawah batas",note:"Sisa 1,8 hari · PO belum diterima",status:"Tinggi"},{tone:"info",title:"Kadar air lot LT-0727-12",note:"0,4 poin di atas target",status:"Pantau"},{tone:"ok",title:"Cold storage stabil",note:"Rata-rata 18,2°C",status:"Normal"}]}/></div>
  </div>;
}

function AuditorHome({ disputed, onVerify, onDispute }: { disputed: boolean; onVerify: () => void; onDispute: () => void }) {
  return <div className="portal-content"><PageHead kicker="ASSURANCE & COMPLIANCE" title="Cakupan dan integritas data" copy="Pantau jejak audit, verifikasi, anomali, dan isu kepatuhan." action={<button className="portal-primary" onClick={onVerify}><Icon name="shield"/>Verifikasi receipt</button>}/><AnalyticsControls scope="Akses audit · tersamarkan" options={["Seluruh pilot","Koperasi Pucuk Sejahtera","Pabrik Teh Nusantara"]}/><div className="portal-metrics analytics-kpis"><Metric icon="shield" label="CAKUPAN TRACEABILITY" value="98,7%" note="1.482 dari 1.501 receipt"/><Metric icon="check" label="TERVERIFIKASI" value="1.463" note="97,5% lolos otomatis"/><Metric icon="alert" label="ISU KEPATUHAN" value={disputed ? "4" : "3"} note="1 prioritas tinggi" tone="amber"/><Metric icon="file" label="ANOMALI DATA" value="7" note="-22% dari bulan lalu" tone="blue"/><Metric icon="wallet" label="AUDIT SELESAI" value="24" note="100% sesuai SLA"/></div><div className="analytics-grid"><TrendChart title="Cakupan verifikasi receipt" subtitle="Persentase receipt terverifikasi · 12 minggu" data={[93.8,94.2,94.9,95.1,95.8,96.0,96.4,96.8,97.1,97.6,98.1,98.7]} second={[95,95,95,95,96,96,96,97,97,97,98,98]} legend={["Aktual","Ambang kontrol"]} suffix="%"/><RankedBars title="Anomali berdasarkan jenis" subtitle="7 temuan terbuka · tanpa data pribadi" rows={[{label:"Selisih berat",value:3,display:"3",tone:"amber"},{label:"Timestamp ganda",value:2,display:"2",tone:"blue"},{label:"Bukti tidak lengkap",value:1,display:"1"},{label:"Harga di luar rentang",value:1,display:"1"}]}/></div><div className="analytics-grid bottom"><AlertList title="Isu kepatuhan prioritas" subtitle="Diurutkan menurut risiko dan usia" items={[{tone:"warn",title:"PP-2026-000039 · selisih berat",note:"Terbuka 18 jam · bukti operator tersedia",status:"Tinggi"},{tone:"info",title:"3 receipt tanpa foto timbang",note:"CP-02 · batch BT-0726-04",status:"Sedang"},{tone:"ok",title:"Hash publik direkonsiliasi",note:"1.501 receipt cocok",status:"Sehat"}]}/><section className="portal-card audit-history"><div className="chart-head"><div><h2>Riwayat audit terbaru</h2><p>Aktivitas assurance yang dapat ditelusuri</p></div></div>{[["AU-2026-024","Rekonsiliasi mingguan","Selesai"],["AU-2026-023","Sampel kualitas CP-01","Selesai"],["AU-2026-022","Review akses Pabrik","Tindak lanjut"]].map((row) => <button key={row[0]} onClick={row[2] === "Tindak lanjut" ? onDispute : onVerify}><span><b>{row[1]}</b><small>{row[0]} · 27 Jul 2026</small></span><em className={`portal-status ${row[2] === "Selesai" ? "green" : "amber"}`}>{row[2]}</em><Icon name="arrow"/></button>)}</section></div>
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

function ReceiptView({ role, paid, disputed, onPay, onDispute }: { role: Role; paid: boolean; disputed: boolean; onPay: () => void; onDispute: () => void }) {
  return <div className="portal-content compact"><PageHead kicker={role === "Petani" ? "TANDA TERIMA SAYA" : "BUKTI PENERIMAAN"} title="PP-2026-000042" copy="27 Juli 2026 · Titik Koleksi Cisarua"/>
    <div className="receipt-layout"><section className="portal-card receipt-paper"><div className="receipt-parties"><div><small>PETANI</small><strong>Sari Rahayu</strong><p>Koperasi Pucuk Sejahtera</p></div><Icon name="arrow"/><div><small>PENERIMA</small><strong>Pabrik Teh Nusantara</strong><p>Operator: Nadia Anwar</p></div></div><div className="receipt-total"><small>TOTAL YANG HARUS DIBAYAR</small><strong>Rp95.625</strong><p>42,50 kg × Rp2.250/kg</p></div><div className="receipt-facts"><p><span>Grade kualitas</span><b>B · Pucuk halus 68%</b></p><p><span>Status konfirmasi</span><b className="good">Petani & operator setuju</b></p><p><span>Status pembayaran</span><i className={`portal-status ${paid ? "green" : "blue"}`}>{paid ? "Sudah dibayar" : "Menunggu bayar"}</i></p></div></section>
    <aside><section className="portal-card chain-proof"><i><Icon name="shield"/></i><div><small>BUKTI PUBLIK</small><h3>Cocok dengan Base Sepolia</h3><p>Hash aplikasi dan catatan publik identik.</p><code>0x8fa2c743…71c9</code></div></section>{role === "Pabrik" && !paid && <button className="portal-primary full" onClick={onPay}>Catat pembayaran IDR</button>}{role === "Petani" && !disputed && <button className="portal-secondary full" onClick={onDispute}>Ajukan koreksi</button>}</aside></div>
  </div>;
}

function Payments({ paid, onPay }: { paid: boolean; onPay: () => void }) {
  return <div className="portal-content"><PageHead kicker="PORTAL PABRIK" title="Kewajiban pembayaran" copy="Pembayaran dilakukan dalam IDR; bukti privat tetap terlindungi."/>
    <section className="portal-card payment-table"><div className="payment-head"><span>RECEIPT</span><span>PETANI</span><span>BERAT</span><span>TOTAL</span><span>STATUS</span><span/></div>{!paid && <div className="payment-row"><strong>PP-2026-000042</strong><span>Sari Rahayu</span><span>42,50 kg</span><strong>Rp95.625</strong><i className="portal-status blue">Siap dibayar</i><button onClick={onPay}>Bayar</button></div>}<div className="payment-row"><strong>PP-2026-000038</strong><span>Dedi Suhendar</span><span>44,20 kg</span><strong>Rp104.975</strong><i className="portal-status blue">Siap dibayar</i><button onClick={onPay}>Bayar</button></div></section>
  </div>;
}

function Verification() {
  return <div className="portal-content compact"><PageHead kicker="PORTAL AUDIT" title="Verifikasi receipt" copy="Bandingkan bukti aplikasi dengan catatan publik."/>
    <section className="verify-result"><i><Icon name="shield"/></i><p>HASIL VERIFIKASI</p><h2>COCOK</h2><span>Metadata receipt sama dengan hash di Base Sepolia.</span><div><article><small>HASH APLIKASI</small><code>0x8fa2c743…71c9</code></article><b>=</b><article><small>HASH ON-CHAIN</small><code>0x8fa2c743…71c9</code></article></div></section>
  </div>;
}

function Disputes({ role, disputed, onSubmit }: { role: Role; disputed: boolean; onSubmit: () => void }) {
  if (role === "Auditor") return <div className="portal-content compact"><PageHead kicker="PORTAL AUDIT" title="Sengketa aktif" copy="Tinjau bukti dan pertahankan riwayat asli."/><section className="portal-card case-card"><i><Icon name="alert"/></i><div><small>PP-2026-000039</small><h2>Perbedaan berat penerimaan</h2><p>Petani mengajukan bukti timbangan 41,50 kg; receipt mencatat 42,50 kg.</p><span className="portal-status amber">{disputed ? "Siap diselesaikan" : "Menunggu tinjauan"}</span></div><button className="portal-primary" onClick={onSubmit}>Tinjau bukti</button></section></div>;
  return <div className="portal-content compact"><PageHead kicker="PORTAL PETANI" title="Ajukan koreksi" copy="Catatan asli tidak dihapus. Koreksi membuat receipt pengganti yang saling terhubung."/><section className="portal-card dispute-form"><label>Bagian yang tidak sesuai<select><option>Berat penerimaan</option><option>Hasil kualitas</option><option>Harga atau potongan</option></select></label><label>Jelaskan masalah<textarea placeholder="Tuliskan angka atau informasi yang menurut Anda perlu dikoreksi…"/></label><button className="upload-box"><Icon name="camera"/><span><strong>Tambah bukti</strong><small>Foto timbangan atau catatan lain</small></span></button><button className="portal-primary" disabled={disputed} onClick={onSubmit}>{disputed ? "Pengajuan sudah terkirim" : "Kirim pengajuan koreksi"}</button></section></div>;
}
