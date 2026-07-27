"use client";

import { useMemo, useState } from "react";

type Role = "Operator" | "Petani" | "Pabrik" | "Auditor";
type View = "home" | "intake" | "receipt" | "payables" | "verify" | "dispute";

const roles: { name: Role; initials: string }[] = [
  { name: "Operator", initials: "NA" },
  { name: "Petani", initials: "SR" },
  { name: "Pabrik", initials: "RP" },
  { name: "Auditor", initials: "AK" },
];

const receipt = {
  id: "PP-2026-000042",
  farmer: "Sari Rahayu",
  weight: 42.5,
  base: 2200,
  premium: 100,
  deduction: 50,
  final: 2250,
  total: 95625,
  hash: "0x8fa2…71c9",
  tx: "0x3d14…9a21",
};

const money = (n: number) => `Rp${new Intl.NumberFormat("id-ID").format(n)}`;

function Icon({ name }: { name: string }) {
  const paths: Record<string, React.ReactNode> = {
    leaf: <><path d="M19 3C10 3 5 7.7 5 14c0 1.7.5 3.2 1.5 4.5"/><path d="M5 21c3.2-6.2 7.2-10 12-12"/><path d="M9 15c1.5.2 3 .8 4 2"/></>,
    home: <><path d="m3 11 9-8 9 8"/><path d="M5 10v11h14V10"/><path d="M9 21v-7h6v7"/></>,
    plus: <><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></>,
    file: <><path d="M6 2h8l4 4v16H6z"/><path d="M14 2v5h5M9 12h6M9 16h6"/></>,
    factory: <><path d="M3 21V9l6 3V9l6 3V5h5v16z"/><path d="M7 17h2M12 17h2M17 17h1"/></>,
    shield: <><path d="M12 3 4 6v6c0 5 3.4 8 8 9 4.6-1 8-4 8-9V6z"/><path d="m8.5 12 2.3 2.3 4.8-5"/></>,
    arrow: <path d="m9 18 6-6-6-6"/>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    camera: <><rect x="3" y="7" width="18" height="13" rx="2"/><path d="m8 7 1.5-3h5L16 7"/><circle cx="12" cy="13" r="3"/></>,
    copy: <><rect x="8" y="8" width="11" height="12" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h3"/></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

export default function Page() {
  const [role, setRole] = useState<Role>("Operator");
  const [view, setView] = useState<View>("home");
  const [step, setStep] = useState(1);
  const [weight, setWeight] = useState("42,50");
  const [toast, setToast] = useState("");
  const [paid, setPaid] = useState(false);
  const [disputed, setDisputed] = useState(false);

  const roleData = useMemo(() => roles.find((r) => r.name === role)!, [role]);
  const flash = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  };
  const switchRole = (next: Role) => {
    setRole(next);
    setView(next === "Pabrik" ? "payables" : next === "Auditor" ? "verify" : "home");
  };

  return (
    <div className="app-shell">
      {toast && <div className="toast"><Icon name="check" />{toast}</div>}
      <aside className="sidebar">
        <button className="brand" onClick={() => setView("home")}>
          <span className="brand-mark"><Icon name="leaf" /></span>
          <span>Pucuk<span>Proof</span></span>
        </button>
        <div className="pilot-tag"><i /> Pilot Demo · Base Sepolia</div>
        <nav>
          <p>RUANG KERJA</p>
          <button className={view === "home" ? "active" : ""} onClick={() => setView("home")}><Icon name="home" />Beranda</button>
          <button className={view === "intake" ? "active" : ""} onClick={() => { setView("intake"); setStep(1); }}><Icon name="plus" />Penerimaan baru</button>
          <button className={view === "receipt" ? "active" : ""} onClick={() => setView("receipt")}><Icon name="file" />Tanda terima <b>12</b></button>
          <button className={view === "payables" ? "active" : ""} onClick={() => setView("payables")}><Icon name="factory" />Pembayaran <b>3</b></button>
          <button className={view === "verify" ? "active" : ""} onClick={() => setView("verify")}><Icon name="shield" />Verifikasi</button>
        </nav>
        <div className="sidebar-bottom">
          <div className="demo-help"><span>DEMO TERPANDU</span><strong>8 menit dari daun ke pembayaran</strong><button onClick={() => { setView("intake"); setStep(1); }}>Mulai cerita <Icon name="arrow" /></button></div>
          <div className="profile"><span>{roleData.initials}</span><div><strong>{roleData.name === "Operator" ? "Nadia Anwar" : roleData.name === "Petani" ? "Sari Rahayu" : roleData.name === "Pabrik" ? "Rizky Pratama" : "Ayu Kusuma"}</strong><small>{role} · Demo</small></div></div>
        </div>
      </aside>

      <main>
        <header>
          <div><small>PucukProof Pilot</small><strong>Pabrik Teh Nusantara · Titik Koleksi Cisarua</strong></div>
          <div className="role-switcher">
            <span>LIHAT SEBAGAI</span>
            <select value={role} onChange={(e) => switchRole(e.target.value as Role)} aria-label="Pilih peran">
              {roles.map((r) => <option key={r.name}>{r.name}</option>)}
            </select>
          </div>
        </header>

        {view === "home" && <Dashboard onNew={() => { setView("intake"); setStep(1); }} onReceipt={() => setView("receipt")} paid={paid} />}
        {view === "intake" && <Intake step={step} setStep={setStep} weight={weight} setWeight={setWeight} finish={() => { setView("receipt"); flash("Tanda terima berhasil dibuat"); }} />}
        {view === "receipt" && <Receipt paid={paid} disputed={disputed} role={role} onPay={() => setView("payables")} onDispute={() => setView("dispute")} flash={flash} />}
        {view === "payables" && <Payables paid={paid} onPay={() => { setPaid(true); flash("Pembayaran IDR berhasil dicatat"); }} onOpen={() => setView("receipt")} />}
        {view === "verify" && <Verify flash={flash} />}
        {view === "dispute" && <Dispute disputed={disputed} onSubmit={() => { setDisputed(true); setView("receipt"); flash("Sengketa dibuka — pembayaran dibekukan"); }} />}
      </main>
    </div>
  );
}

function Dashboard({ onNew, onReceipt, paid }: { onNew: () => void; onReceipt: () => void; paid: boolean }) {
  return <div className="content">
    <section className="hero-row">
      <div><p className="eyebrow">MINGGU, 27 JULI 2026</p><h1>Selamat sore, Nadia.</h1><p>Semua transaksi daun teh hari ini tercatat dan dapat ditelusuri.</p></div>
      <button className="primary" onClick={onNew}><Icon name="plus" />Penerimaan baru</button>
    </section>
    <section className="stats">
      <article><span className="stat-icon green"><Icon name="file" /></span><div><small>DITERIMA HARI INI</small><strong>318,4 <em>kg</em></strong><p><b>↑ 12%</b> dari kemarin</p></div></article>
      <article><span className="stat-icon amber"><Icon name="clock" /></span><div><small>PERLU KONFIRMASI</small><strong>3 <em>tanda terima</em></strong><p>Nilai Rp286.400</p></div></article>
      <article><span className="stat-icon blue"><Icon name="factory" /></span><div><small>MENUNGGU BAYAR</small><strong>{paid ? "2" : "3"} <em>tanda terima</em></strong><p>{money(paid ? 522275 : 617900)} belum dibayar</p></div></article>
      <article><span className="stat-icon violet"><Icon name="shield" /></span><div><small>TERVERIFIKASI</small><strong>100<em>%</em></strong><p><b>12/12</b> cocok dengan chain</p></div></article>
    </section>
    <section className="grid-main">
      <div className="panel activity">
        <div className="panel-title"><div><h2>Aktivitas hari ini</h2><p>Penerimaan terbaru di titik koleksi</p></div><button>Lihat semua <Icon name="arrow" /></button></div>
        {[["PP-2026-000042","Sari Rahayu","42,50 kg","Grade B","Rp95.625","Menunggu konfirmasi","amber"],
          ["PP-2026-000041","Dedi Suhendar","38,20 kg","Grade A","Rp90.725","Terdaftar","green"],
          ["PP-2026-000040","Nani Marlina","51,75 kg","Grade B","Rp116.438", paid ? "Sudah dibayar" : "Menunggu bayar", paid ? "green" : "blue"],
          ["PP-2026-000039","Agus Firmansyah","46,10 kg","Grade C","Rp94.505","Disengketakan","red"]].map((r, i) =>
          <button className="activity-row" onClick={i === 0 ? onReceipt : undefined} key={r[0]}><span className="avatar">{r[1].split(" ").map(x=>x[0]).join("")}</span><span><strong>{r[1]}</strong><small>{r[0]}</small></span><span><strong>{r[2]}</strong><small>{r[3]}</small></span><span><strong>{r[4]}</strong><small>Total</small></span><i className={`status ${r[6]}`}>{r[5]}</i><Icon name="arrow" /></button>
        )}
      </div>
      <aside className="panel progress">
        <div className="panel-title"><div><h2>Target pilot</h2><p>27 Jul — 16 Agu</p></div><span>Hari 1 dari 21</span></div>
        <div className="ring-wrap"><div className="ring"><strong>12</strong><small>dari 50</small></div><div><strong>Tanda terima</strong><p>24% dari target pilot</p></div></div>
        <div className="progress-list"><p><span>Petani aktif</span><b>7 / 10</b></p><i><em style={{width:"70%"}} /></i><p><span>Sesi pengguna</span><b>2 / 5</b></p><i><em style={{width:"40%"}} /></i><p><span>Rata-rata intake</span><b>2m 34d</b></p><i><em className="gold" style={{width:"86%"}} /></i></div>
        <div className="goal"><Icon name="check" /><div><strong>Di bawah target 3 menit</strong><p>Intake tercepat: 1m 48d</p></div></div>
      </aside>
    </section>
    <div className="principle"><Icon name="leaf" /><p><strong>Prinsip pilot:</strong> Blockchain bukan produknya. Produknya adalah tanda terima daun teh yang dipercaya bersama.</p><span>Base Sepolia · Testnet only</span></div>
  </div>;
}

function Intake({ step, setStep, weight, setWeight, finish }: { step: number; setStep:(n:number)=>void; weight:string; setWeight:(v:string)=>void; finish:()=>void }) {
  const labels = ["Penerimaan", "Kualitas", "Harga", "Konfirmasi"];
  return <div className="content narrow">
    <div className="page-heading"><div><p className="eyebrow">PENERIMAAN BARU</p><h1>{labels[step-1]}</h1><p>Selesaikan satu transaksi daun teh dengan catatan yang jelas.</p></div><span className="draft">Draf tersimpan otomatis</span></div>
    <div className="stepper">{labels.map((l,i)=><div className={i+1<=step?"done":""} key={l}><span>{i+1<step?<Icon name="check" />:i+1}</span><b>{l}</b></div>)}</div>
    <section className="form-card">
      {step===1 && <><h2>Catat penerimaan fisik</h2><div className="field-grid"><label>Petani<select><option>Sari Rahayu · F-007</option><option>Dedi Suhendar · F-003</option></select></label><label>Titik koleksi<select><option>Cisarua · CP-01</option></select></label><label>Berat kotor (kg)<input value={weight} onChange={e=>setWeight(e.target.value)} inputMode="decimal" /></label><label>Waktu penerimaan<input value="27/07/2026 · 16:42" readOnly /></label></div><button className="upload"><Icon name="camera" /><strong>Tambah foto penerimaan</strong><small>Wajib · JPG/PNG hingga 8 MB</small></button></>}
      {step===2 && <><h2>Pemeriksaan sampel</h2><p className="hint">Protokol PP-QP-0.1 · Sampel representatif 500 g</p><div className="field-grid four"><label>Grade<select><option>B</option><option>A</option><option>C</option></select></label><label>Pucuk halus (%)<input defaultValue="68" /></label><label>Daun kasar (%)<input defaultValue="25" /></label><label>Batang (%)<input defaultValue="7" /></label></div><div className="validation"><Icon name="check" />Komposisi sampel lengkap: 100% · Benda asing: 0%</div></>}
      {step===3 && <><h2>Rincian harga</h2><div className="price-sheet"><p><span>Harga dasar</span><b>{money(2200)}/kg</b></p><p className="positive"><span>Premi kualitas</span><b>+{money(100)}/kg</b></p><p className="negative"><span>Potongan kualitas</span><b>−{money(50)}/kg</b></p><hr/><p><span>Harga akhir</span><b>{money(2250)}/kg</b></p><div><span>42,50 kg × Rp2.250</span><strong>{money(95625)}</strong><small>Total yang harus dibayar</small></div></div></>}
      {step===4 && <><h2>Konfirmasi yang mudah dipahami</h2><div className="confirm-copy">Anda mengirim <strong>42,50 kg pucuk teh</strong>. Hasil pemeriksaan: <strong>Grade B</strong>, pucuk halus 68%, batang 7%, benda asing 0%. Harga akhir <strong>Rp2.250/kg</strong>. Total yang harus dibayar: <strong>Rp95.625</strong>.</div><label className="consent"><input type="checkbox" defaultChecked /> Saya telah memeriksa berat, kualitas, harga, dan total pembayaran.</label><details><summary>Detail teknis</summary><p>Base Sepolia · Metadata 0x8fa2…71c9 · Tanda tangan aman dan tidak memindahkan dana.</p></details></>}
      <div className="form-actions"><button className="secondary" disabled={step===1} onClick={()=>setStep(step-1)}>Kembali</button><button className="primary" onClick={()=>step<4?setStep(step+1):finish()}>{step<4?"Lanjutkan":"Setuju & buat tanda terima"}<Icon name="arrow" /></button></div>
    </section>
  </div>;
}

function Receipt({ paid, disputed, role, onPay, onDispute, flash }: { paid:boolean; disputed:boolean; role:Role; onPay:()=>void; onDispute:()=>void; flash:(s:string)=>void }) {
  return <div className="content narrow">
    <div className="page-heading receipt-head"><div><p className="eyebrow">TANDA TERIMA</p><h1>{receipt.id}</h1><p>27 Juli 2026 · 16:42 WIB · Titik Koleksi Cisarua</p></div><i className={`status ${disputed?"red":paid?"green":"blue"}`}>{disputed?"Disengketakan":paid?"Sudah dibayar":"Terdaftar · menunggu bayar"}</i></div>
    {disputed && <div className="alert red"><strong>Pembayaran dibekukan</strong><p>Sengketa sedang ditinjau auditor. Catatan asli tetap tersimpan.</p></div>}
    <div className="receipt-grid">
      <section className="form-card receipt-paper"><div className="parties"><div><small>PETANI</small><strong>Sari Rahayu</strong><p>F-007 · Koperasi Pucuk Sejahtera</p></div><span><Icon name="arrow" /></span><div><small>PENERIMA</small><strong>Pabrik Teh Nusantara</strong><p>Operator: Nadia Anwar</p></div></div>
        <div className="big-total"><small>TOTAL YANG HARUS DIBAYAR</small><strong>{money(receipt.total)}</strong><span>42,50 kg × Rp2.250/kg</span></div>
        <div className="detail-list"><p><span>Grade kualitas</span><b>B · Pucuk halus 68%</b></p><p><span>Harga dasar</span><b>Rp2.200/kg</b></p><p><span>Premi / potongan</span><b className="positive">+Rp100</b><b className="negative">−Rp50</b></p><p><span>Status konfirmasi</span><b className="signed"><Icon name="check" />Petani & operator setuju</b></p></div>
      </section>
      <aside className="side-stack">
        <div className="panel chain-card"><div className="chain-title"><span><Icon name="shield" /></span><div><strong>Terverifikasi di Base Sepolia</strong><p>Data aplikasi cocok dengan catatan publik.</p></div></div><p><span>Metadata hash</span><button onClick={()=>flash("Hash disalin")}>{receipt.hash}<Icon name="copy" /></button></p><p><span>Transaksi</span><button onClick={()=>flash("Transaksi demo dibuka")}>{receipt.tx}<Icon name="arrow" /></button></p><button className="verify-btn" onClick={()=>flash("Cocok — integritas data terverifikasi")}><Icon name="shield" />Verifikasi ulang</button></div>
        <div className="panel timeline"><h3>Riwayat status</h3>{[["16:42","Penerimaan dicatat"],["16:44","Petani & operator setuju"],["16:45","Terdaftar di Base Sepolia"],[paid?"17:08":"—",paid?"Pembayaran IDR dicatat":"Menunggu pembayaran"]].map((x,i)=><div className={i===3&&!paid?"muted":""} key={i}><i>{i<3||paid?<Icon name="check" />:<Icon name="clock" />}</i><span><strong>{x[1]}</strong><small>{x[0]} WIB</small></span></div>)}</div>
        {!paid && role==="Pabrik" && <button className="primary full" onClick={onPay}>Catat pembayaran IDR</button>}
        {!disputed && <button className="secondary full danger" onClick={onDispute}>Ada yang tidak sesuai? Buka sengketa</button>}
      </aside>
    </div>
  </div>;
}

function Payables({ paid, onPay, onOpen }: { paid:boolean; onPay:()=>void; onOpen:()=>void }) {
  return <div className="content">
    <div className="page-heading"><div><p className="eyebrow">PABRIK</p><h1>Pembayaran</h1><p>Setujui kewajiban dan catat pembayaran IDR dengan bukti privat.</p></div></div>
    <div className="tabs"><button className="active">Menunggu bayar <b>{paid?2:3}</b></button><button>Sebagian <b>1</b></button><button>Sudah dibayar <b>{paid?9:8}</b></button><button>Disengketakan <b>1</b></button></div>
    <section className="panel table-panel"><div className="table-head"><span>TANDA TERIMA</span><span>PETANI</span><span>BERAT</span><span>TOTAL</span><span>STATUS</span><span /></div>
      {!paid && <div className="table-row"><button onClick={onOpen}><strong>PP-2026-000042</strong><small>27 Jul · 16:42</small></button><span>Sari Rahayu</span><span>42,50 kg</span><strong>Rp95.625</strong><i className="status blue">Menunggu bayar</i><button className="small-primary" onClick={onPay}>Bayar</button></div>}
      {[["PP-2026-000038","Dedi Suhendar","44,20 kg","Rp104.975"],["PP-2026-000036","Nani Marlina","56,30 kg","Rp126.675"]].map(x=><div className="table-row" key={x[0]}><button><strong>{x[0]}</strong><small>27 Jul · 14:18</small></button><span>{x[1]}</span><span>{x[2]}</span><strong>{x[3]}</strong><i className="status blue">Menunggu bayar</i><button className="small-primary" onClick={onPay}>Bayar</button></div>)}
    </section>
    <div className="privacy-note"><Icon name="shield" /><p><strong>Pembayaran tetap dalam rupiah.</strong> Bukti pembayaran disimpan privat; hanya hash referensi dan status yang dicatat publik.</p></div>
  </div>;
}

function Verify({ flash }: { flash:(s:string)=>void }) {
  return <div className="content verify-page"><div className="page-heading"><div><p className="eyebrow">AUDIT & VERIFIKASI</p><h1>Periksa tanda terima</h1><p>Bandingkan catatan aplikasi dengan bukti publik tanpa membuka data pribadi.</p></div></div>
    <section className="verify-hero"><span className="shield-large"><Icon name="shield" /></span><p>HASIL VERIFIKASI</p><h2>COCOK</h2><p>Metadata tanda terima sama dengan hash yang tercatat di Base Sepolia.</p><div className="hash-compare"><div><small>HASH APLIKASI</small><code>0x8fa2c743…71c9</code><i><Icon name="check" /> Cocok</i></div><span>=</span><div><small>HASH ON-CHAIN</small><code>0x8fa2c743…71c9</code><i><Icon name="check" /> Cocok</i></div></div></section>
    <section className="panel verify-details"><h3>Detail jaringan</h3><div><p><span>Jaringan</span><b>Base Sepolia · 84532</b></p><p><span>Receipt ID</span><b>PP-2026-000042</b></p><p><span>Kontrak registry</span><button onClick={()=>flash("Alamat disalin")}>0x71B2…4c08 <Icon name="copy" /></button></p><p><span>Blok</span><b>#24,881,307</b></p></div><button className="secondary" onClick={()=>flash("Explorer testnet dibuka")}>Lihat transaksi di explorer <Icon name="arrow" /></button></section>
  </div>;
}

function Dispute({ disputed, onSubmit }: { disputed:boolean; onSubmit:()=>void }) {
  return <div className="content narrow"><div className="page-heading"><div><p className="eyebrow">KOREKSI TANPA MENGHAPUS RIWAYAT</p><h1>Buka sengketa</h1><p>{receipt.id} · Sari Rahayu · 42,50 kg</p></div></div>
    <section className="form-card"><div className="alert amber"><strong>Catatan asli tidak akan diubah.</strong><p>Jika koreksi disetujui, sistem membuat tanda terima baru yang merujuk catatan ini.</p></div><label>Bagian yang tidak sesuai<select><option>Berat penerimaan</option><option>Hasil pemeriksaan kualitas</option><option>Harga atau potongan</option><option>Lainnya</option></select></label><label>Jelaskan masalah<textarea placeholder="Contoh: angka timbangan yang disepakati adalah 41,50 kg…" /></label><button className="upload"><Icon name="camera" /><strong>Tambah bukti (opsional)</strong><small>Foto timbangan, catatan, atau bukti lain</small></button><div className="form-actions"><button className="secondary">Batal</button><button className="primary danger-bg" disabled={disputed} onClick={onSubmit}>Buka sengketa</button></div></section>
  </div>;
}
