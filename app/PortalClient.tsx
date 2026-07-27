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

function OperatorHome({ onIntake, onReceipt }: { onIntake: () => void; onReceipt: () => void }) {
  return <div className="portal-content"><PageHead kicker="OPERASIONAL HARI INI" title="Selamat sore, Nadia." copy="Catat penerimaan dengan cepat dan konsisten." action={<button className="portal-primary" onClick={onIntake}><Icon name="plus"/>Penerimaan baru</button>}/>
    <div className="portal-metrics"><Metric icon="leaf" label="DITERIMA HARI INI" value="318,4 kg" note="7 petani"/><Metric icon="file" label="DRAF AKTIF" value="2" note="Belum dikonfirmasi" tone="amber"/><Metric icon="check" label="SELESAI" value="12" note="Rata-rata 2m 34d" tone="blue"/></div>
    <section className="portal-card"><div className="portal-card-head"><div><h2>Antrian penerimaan</h2><p>Catatan terbaru di Titik Koleksi Cisarua</p></div></div><ReceiptRows onOpen={onReceipt} operator/></section>
  </div>;
}

function FarmerHome({ paid, onReceipt, onDispute }: { paid: boolean; onReceipt: () => void; onDispute: () => void }) {
  return <div className="portal-content"><PageHead kicker="BERANDA PETANI" title="Halo, Ibu Sari." copy="Berikut penerimaan dan pembayaran daun teh Anda."/>
    <div className="farmer-hero"><div><small>PEMBAYARAN TERBARU</small><strong>{money(95625)}</strong><p>42,50 kg · Grade B · 27 Juli 2026</p><i className={`portal-status ${paid ? "green" : "blue"}`}>{paid ? "Sudah dibayar" : "Menunggu pembayaran"}</i></div><button className="portal-primary light" onClick={onReceipt}>Lihat tanda terima<Icon name="arrow"/></button></div>
    <div className="farmer-grid"><section className="portal-card"><div className="portal-card-head"><div><h2>Yang perlu Anda lakukan</h2><p>Hanya tindakan yang membutuhkan keputusan Anda</p></div></div><div className="farmer-action"><i><Icon name="file"/></i><div><strong>Periksa tanda terima PP-2026-000042</strong><p>Pastikan berat, kualitas, dan harga sudah benar.</p></div><button onClick={onReceipt}>Periksa</button></div></section>
    <section className="portal-card farmer-help"><h2>Ada yang tidak sesuai?</h2><p>Pengajuan koreksi tidak menghapus catatan asli.</p><button onClick={onDispute}>Ajukan koreksi</button></section></div>
  </div>;
}

function FactoryHome({ paid, onPayments, onReceipt }: { paid: boolean; onPayments: () => void; onReceipt: () => void }) {
  return <div className="portal-content"><PageHead kicker="KONTROL PABRIK" title="Kewajiban hari ini" copy="Tinjau bukti penerimaan sebelum menyetujui pembayaran IDR." action={<button className="portal-primary" onClick={onPayments}>Buka antrian pembayaran<Icon name="arrow"/></button>}/>
    <div className="portal-metrics"><Metric icon="wallet" label="MENUNGGU BAYAR" value={paid ? "2 receipt" : "3 receipt"} note={paid ? "Rp522.275" : "Rp617.900"} tone="blue"/><Metric icon="alert" label="PERLU DITINJAU" value="1" note="Bukti belum lengkap" tone="amber"/><Metric icon="check" label="DIBAYAR HARI INI" value={paid ? "9" : "8"} note="100% tercatat"/></div>
    <section className="portal-card"><div className="portal-card-head"><div><h2>Kewajiban prioritas</h2><p>Receipt lengkap dan siap dibayar</p></div></div><ReceiptRows onOpen={onReceipt}/></section>
  </div>;
}

function AuditorHome({ disputed, onVerify, onDispute }: { disputed: boolean; onVerify: () => void; onDispute: () => void }) {
  return <div className="portal-content"><PageHead kicker="PUSAT AUDIT" title="Integritas dan pengecualian" copy="Periksa kecocokan chain tanpa membuka data pribadi." action={<button className="portal-primary" onClick={onVerify}><Icon name="shield"/>Verifikasi receipt</button>}/>
    <div className="portal-metrics"><Metric icon="shield" label="COCOK DENGAN CHAIN" value="12 / 12" note="100% terverifikasi"/><Metric icon="alert" label="SENGKETA AKTIF" value={disputed ? "1" : "0"} note={disputed ? "Perlu keputusan" : "Tidak ada"} tone="amber"/><Metric icon="file" label="REKONSILIASI" value="Sehat" note="Diperbarui 2 menit lalu" tone="blue"/></div>
    <section className="portal-card audit-focus"><div><i><Icon name="alert"/></i><span><small>PENGECUALIAN PRIORITAS</small><h2>PP-2026-000039 · Perbedaan berat</h2><p>Catatan timbangan perlu dibandingkan dengan bukti intake.</p></span></div><button onClick={onDispute}>Tinjau kasus<Icon name="arrow"/></button></section>
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
