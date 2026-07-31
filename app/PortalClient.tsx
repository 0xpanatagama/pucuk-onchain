"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { localizePortal, type PortalLanguage } from "../lib/portalI18n";

type Role = "Operator" | "Petani" | "Pabrik" | "Auditor";
type Screen = "home" | "intake" | "receipts" | "payments" | "verify" | "disputes";
type ReceiptState = "Draft" | "AwaitingFarmer" | "Registered" | "Approved" | "PartiallyPaid" | "Paid" | "Disputed" | "Superseded";
type DashboardFilters = { scope: string; range: "7d" | "30d" | "12w" | "season" };
type NextAction = { role: Role; screen: Screen; targetSelector: string; title: string; copy: string; cta: string };
type CompletionBanner = { action: NextAction; title: string; copy: string; originRole: Role; originScreen: Screen };
type ChainSnapshot = {
  connected: boolean;
  exists: boolean;
  demoId: string;
  receiptId: string;
  receiptLabel: string;
  contractAddress: string;
  explorerUrl: string;
  state: ReceiptState;
  paidAmountIdr: string;
  totalPayableIdr: string;
  transactions: { hash: string; url: string }[];
};
type TxPhase = "idle" | "review" | "submitting" | "submitted" | "confirmed" | "failed";
type ActionError = { key: string; message: string } | null;

const DEFAULT_DEMO_ID = "PP-2026-000042-v1";
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
const periodOptions: { value: DashboardFilters["range"]; label: string }[] = [
  { value: "7d", label: "7 hari" },
  { value: "30d", label: "30 hari" },
  { value: "12w", label: "12 minggu" },
  { value: "season", label: "Musim ini" },
];
const periodFactor: Record<DashboardFilters["range"], number> = { "7d": .22, "30d": .58, "12w": 1, season: 1.85 };
const periodLabel: Record<DashboardFilters["range"], string> = { "7d": "7 hari", "30d": "30 hari", "12w": "12 minggu", season: "Musim ini" };
const scopeFactor = (scope: string, options: string[]) => [1, .46, .32, .22][Math.max(0, options.indexOf(scope))] ?? 1;
const demoFactor = (filters: DashboardFilters, options: string[]) => periodFactor[filters.range] * scopeFactor(filters.scope, options);
const scaled = (value: number, factor: number) => Math.max(0, Math.round(value * factor));
const scaledSeries = (values: number[], factor: number, offset = 0) => values.map((value, index) => {
  const scopeShape = 1 + (factor - 1) * .14 * Math.sin((index + 1) * 1.23);
  return Number(Math.max(0, value * factor * scopeShape + offset * Math.sin(index * 1.7)).toFixed(2));
});
const nextActionFor = (state: ReceiptState): NextAction => ({
  Draft: {
    role: "Operator",
    screen: "intake",
    targetSelector: ".intake-card",
    title: "Tindakan Operator diperlukan",
    copy: "Tanda terima ini masih berupa draf. Lanjut sebagai Operator untuk mencatat detail pengiriman dan mengirimkannya kepada Petani.",
    cta: "Lanjut sebagai Operator",
  },
  AwaitingFarmer: {
    role: "Petani",
    screen: "home",
    targetSelector: ".confirmation-card",
    title: "Konfirmasi Petani diperlukan",
    copy: "Operator telah membuat tanda terima ini. Lanjut sebagai Petani untuk meninjau dan mengonfirmasi pengiriman yang tercatat.",
    cta: "Lanjut sebagai Petani",
  },
  Registered: {
    role: "Pabrik",
    screen: "home",
    targetSelector: ".liability-card",
    title: "Persetujuan Pabrik diperlukan",
    copy: "Petani telah mengonfirmasi tanda terima. Lanjut sebagai Pabrik untuk meninjau dan menyetujui kewajiban pembayaran.",
    cta: "Lanjut sebagai Pabrik",
  },
  Approved: {
    role: "Pabrik",
    screen: "payments",
    targetSelector: ".payment-table",
    title: "Pencatatan pembayaran diperlukan",
    copy: "Pabrik telah menyetujui kewajiban. Lanjut ke Pembayaran untuk mencatat pembayaran IDR yang telah dilakukan.",
    cta: "Lanjut sebagai Pabrik",
  },
  PartiallyPaid: {
    role: "Pabrik",
    screen: "payments",
    targetSelector: ".payment-table",
    title: "Sisa pembayaran diperlukan",
    copy: "Pembayaran sebagian telah dicatat. Lanjut sebagai Pabrik untuk mencatat sisa pembayaran IDR.",
    cta: "Lanjut sebagai Pabrik",
  },
  Paid: {
    role: "Auditor",
    screen: "verify",
    targetSelector: ".verify-result",
    title: "Verifikasi audit tersedia",
    copy: "Pembayaran telah selesai. Lanjut sebagai Auditor untuk memverifikasi bukti transaksi dan catatan ketertelusuran.",
    cta: "Lanjut sebagai Auditor",
  },
  Disputed: {
    role: "Auditor",
    screen: "disputes",
    targetSelector: ".case-card",
    title: "Tinjauan sengketa diperlukan",
    copy: "Pengajuan koreksi sedang terbuka. Lanjut sebagai Auditor untuk membandingkan bukti dan menyelesaikan sengketa.",
    cta: "Lanjut sebagai Auditor",
  },
  Superseded: {
    role: "Auditor",
    screen: "verify",
    targetSelector: ".verify-result",
    title: "Tanda terima pengganti siap",
    copy: "Tanda terima pengganti telah diterbitkan. Lanjut sebagai Auditor untuk memverifikasi riwayat transaksi yang terhubung.",
    cta: "Lanjut sebagai Auditor",
  },
} satisfies Record<ReceiptState, NextAction>)[state];

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
  const [language, setLanguage] = useState<PortalLanguage>("en");
  const [entryStep, setEntryStep] = useState<"landing" | "login">("landing");
  const [session, setSession] = useState<Role | null>(null);
  const [selected, setSelected] = useState<Role>("Operator");
  const [screen, setScreen] = useState<Screen>("home");
  const [paid, setPaid] = useState(false);
  const [disputed, setDisputed] = useState(false);
  const [toast, setToast] = useState("");
  const [workflowFocus, setWorkflowFocus] = useState<{ targetSelector: string; nonce: number } | null>(null);
  const [hiddenWorkflowEntry, setHiddenWorkflowEntry] = useState("");
  const [completionBanner, setCompletionBanner] = useState<CompletionBanner | null>(null);
  const [intakeStep, setIntakeStep] = useState(1);
  const [receiptState, setReceiptState] = useState<ReceiptState>("AwaitingFarmer");
  const [chain, setChain] = useState<ChainSnapshot | null>(null);
  const [chainBusy, setChainBusy] = useState(false);
  const [chainError, setChainError] = useState("");
  const [actionError, setActionError] = useState<ActionError>(null);
  const [txPhase, setTxPhase] = useState<TxPhase>("idle");
  const [demoId, setDemoId] = useState(DEFAULT_DEMO_ID);
  const [headerScrolled, setHeaderScrolled] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const saved = window.localStorage.getItem("pucuk-language-v2");
    if (saved === "en" || saved === "id") setLanguage(saved);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("pucuk-language-v2", language);
    let frame = 0;
    const applyLanguage = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => localizePortal(document.documentElement, language));
    };
    applyLanguage();
    const observer = new MutationObserver(applyLanguage);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, [language]);

  const flash = (text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(""), 2200);
  };

  const applySnapshot = useCallback((snapshot: ChainSnapshot) => {
    let savedTransactions: ChainSnapshot["transactions"] = [];
    try {
      const saved = window.localStorage.getItem(`pucuk-demo-transactions-${snapshot.demoId}`);
      savedTransactions = saved ? JSON.parse(saved) as ChainSnapshot["transactions"] : [];
    } catch {
      savedTransactions = [];
    }
    const mergedTransactions = [
      ...new Map(
        [...savedTransactions, ...snapshot.transactions].map((transaction) => [
          transaction.hash,
          transaction,
        ]),
      ).values(),
    ];
    const mergedSnapshot = { ...snapshot, transactions: mergedTransactions };
    setChain(mergedSnapshot);
    window.localStorage.setItem(
      `pucuk-demo-transactions-${snapshot.demoId}`,
      JSON.stringify(mergedTransactions),
    );
    setReceiptState(snapshot.state);
    setPaid(snapshot.state === "Paid");
    setDisputed(snapshot.state === "Disputed");
    setChainError("");
  }, []);

  const syncChain = useCallback(async (targetDemoId: string) => {
    try {
      const response = await fetch(`/api/registry?demo=${encodeURIComponent(targetDemoId)}`, { cache: "no-store" });
      const data = await readApiResponse<ChainSnapshot & { error?: string }>(response);
      if (!response.ok) throw new Error(data.error || "Registry tidak dapat dibaca");
      applySnapshot(data);
    } catch (error) {
      console.warn("Registry connection unavailable", error);
      setChainError("Transaction service is temporarily unavailable. Demo screens remain available; try syncing again shortly.");
    }
  }, [applySnapshot]);

  useEffect(() => {
    const savedDemoId = window.localStorage.getItem("pucuk-active-demo") || DEFAULT_DEMO_ID;
    setDemoId(savedDemoId);
    void syncChain(savedDemoId);
  }, [syncChain]);

  const runChainAction = async (action: string, success: string, targetReceiptId?: string) => {
    if (chainBusy) return false;
    const canonicalReceiptId = chain?.receiptLabel || (demoId.startsWith("PP-") ? demoId.replace(/-v\d+$/, "") : `PP-DEMO-${demoId.slice(-8).toUpperCase()}`);
    if (targetReceiptId && targetReceiptId !== canonicalReceiptId) {
      setActionError({ key: `${session}:${targetReceiptId}:${action}`, message: `Receipt mismatch: this action opened ${targetReceiptId}, but the active transaction is ${canonicalReceiptId}. No transaction was submitted.` });
      setTxPhase("failed");
      return false;
    }
    setChainBusy(true);
    setActionError(null);
    setTxPhase("submitting");
    flash("Mengirim transaksi…");
    try {
      const response = await fetch("/api/registry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, demoId, receiptId: canonicalReceiptId }),
      });
      setTxPhase("submitted");
      const data = await readApiResponse<ChainSnapshot & { error?: string }>(response);
      if (!response.ok) throw new Error(data.error || "Transaksi gagal");
      applySnapshot(data);
      setTxPhase("confirmed");
      flash(success);
      const completionTitles: Record<string, string> = {
        create: "Pengajuan Operator selesai",
        farmerAgree: "Konfirmasi Petani selesai",
        farmerReject: "Tanda terima dikembalikan",
        approve: "Persetujuan Pabrik selesai",
        pay: "Pencatatan pembayaran selesai",
        dispute: "Pengajuan sengketa selesai",
      };
      if (session) {
        setCompletionBanner({
          action: nextActionFor(data.state),
          title: completionTitles[action] || "Tindakan selesai",
          copy: success,
          originRole: session,
          originScreen: action === "create" ? "receipts" : screen,
        });
      }
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Transaksi gagal";
      setActionError({ key: `${session}:${canonicalReceiptId}:${action}`, message });
      setTxPhase("failed");
      flash("Transaksi belum berhasil. Coba lagi.");
      return false;
    } finally {
      setChainBusy(false);
    }
  };

  const startNewDemo = () => {
    if (chainBusy) return;
    const confirmed = window.confirm(
      language === "en"
        ? "Start a new demo transaction? Previous records will remain in the transaction history."
        : "Mulai transaksi demo baru? Catatan lama tetap tersimpan sebagai riwayat transaksi.",
    );
    if (!confirmed) return;
    const nextDemoId = `demo-${Date.now()}-${window.crypto.randomUUID().slice(0, 8)}`;
    window.localStorage.setItem("pucuk-active-demo", nextDemoId);
    setDemoId(nextDemoId);
    setChain(null);
    setChainError("");
    setActionError(null);
    setTxPhase("idle");
    setReceiptState("Draft");
    setPaid(false);
    setDisputed(false);
    setCompletionBanner(null);
    setHiddenWorkflowEntry("");
    setIntakeStep(1);
    setScreen(session === "Operator" ? "intake" : "home");
    void syncChain(nextDemoId);
    flash(
      language === "en"
        ? session === "Operator"
          ? "New demo ready. Complete the intake to create a transaction."
          : "New demo ready. Sign in as Operator to create the intake transaction."
        : session === "Operator"
          ? "Demo baru siap. Lengkapi penerimaan untuk membuat transaksi."
          : "Demo baru siap. Masuk sebagai Operator untuk membuat transaksi penerimaan.",
    );
  };

  useEffect(() => {
    if (!workflowFocus) return;
    const timer = window.setTimeout(() => {
      const target = document.querySelector<HTMLElement>(workflowFocus.targetSelector);
      if (!target) return;
      target.classList.remove("workflow-action-focus");
      void target.getBoundingClientRect();
      target.classList.add("workflow-action-focus");
      target.querySelector<HTMLElement>("button.portal-primary, button:not([disabled])")?.focus({ preventScroll: true });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [workflowFocus]);

  useEffect(() => {
    setActionError(null);
    setTxPhase((phase) => phase === "failed" ? "idle" : phase);
  }, [session, screen]);

  useEffect(() => {
    window.history.scrollRestoration = "manual";
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    const frame = window.requestAnimationFrame(() => window.scrollTo(0, 0));
    return () => window.cancelAnimationFrame(frame);
  }, [session]);

  useEffect(() => {
    const updateHeader = () => setHeaderScrolled(window.scrollY > 10);
    updateHeader();
    window.addEventListener("scroll", updateHeader, { passive: true });
    return () => window.removeEventListener("scroll", updateHeader);
  }, []);

  if (!session) {
    if (entryStep === "landing") return <Landing language={language} setLanguage={setLanguage} onEnter={() => setEntryStep("login")} />;
    return <Login selected={selected} setSelected={setSelected} language={language} setLanguage={setLanguage} onBack={() => setEntryStep("landing")} onLogin={() => {
      setSession(selected);
      setScreen("home");
    }} />;
  }

  const profile = profiles[session];
  const portalTitle = session === "Operator" ? "Portal Penerimaan" : session === "Petani" ? "Portal Petani" : session === "Pabrik" ? "Portal Pabrik" : "Portal Audit";
  const nextAction = nextActionFor(receiptState);
  const activeReceiptLabel = chain?.receiptLabel || (demoId.startsWith("PP-") ? demoId.replace(/-v\d+$/, "") : `PP-DEMO-${demoId.slice(-8).toUpperCase()}`);
  const workflowEntryKey = `${session}:${activeReceiptLabel}:${receiptState}`;
  const entryBannerVisible = session === nextAction.role && screen === nextAction.screen && hiddenWorkflowEntry !== workflowEntryKey;
  const visibleCompletion = completionBanner?.originRole === session && completionBanner.originScreen === screen ? completionBanner : null;
  const visibleBanner = visibleCompletion || (entryBannerVisible ? { action: nextAction, title: nextAction.title, copy: nextAction.copy } : null);
  const beginWorkflow = () => {
    setHiddenWorkflowEntry(workflowEntryKey);
    setCompletionBanner(null);
  };
  const continueWorkflow = (action: NextAction) => {
    beginWorkflow();
    setSession(action.role);
    setScreen(action.screen);
    if (action.screen === "intake") setIntakeStep(1);
    setWorkflowFocus({ targetSelector: action.targetSelector, nonce: Date.now() });
  };
  const latestProof = chain?.transactions.at(-1);
  const proofUrl = latestProof?.url;
  const proofHash = latestProof?.hash || chain?.receiptId || "";
  let activeView: React.ReactNode;
  if (screen === "home" && session === "Operator") activeView = <OperatorHome onIntake={() => setScreen("intake")} onReceipt={() => setScreen("receipts")} />;
  else if (screen === "home" && session === "Petani") activeView = <FarmerHome paid={paid} state={receiptState} proofUrl={proofUrl} onAgree={() => { beginWorkflow(); void runChainAction("farmerAgree", "Tanda terima dikonfirmasi. Lanjut sebagai Pabrik untuk meninjau dan menyetujui kewajiban."); }} onReject={() => { beginWorkflow(); void runChainAction("farmerReject", "Tanda terima dikembalikan kepada Operator. Lanjut sebagai Operator untuk memperbaiki catatan."); }} onReceipt={() => setScreen("receipts")} onDispute={() => setScreen("disputes")} />;
  else if (screen === "home" && session === "Pabrik") activeView = <FactoryHome paid={paid} state={receiptState} proofUrl={proofUrl} onApprove={() => { beginWorkflow(); void runChainAction("approve", "Kewajiban disetujui. Lanjut ke Pembayaran untuk mencatat pembayaran IDR."); }} onPayments={() => setScreen("payments")} onReceipt={() => setScreen("receipts")} />;
  else if (screen === "home" && session === "Auditor") activeView = <AuditorHome disputed={disputed} onVerify={() => setScreen("verify")} onDispute={() => setScreen("disputes")} />;
  else if (screen === "intake" && session === "Operator") activeView = <Intake step={intakeStep} setStep={setIntakeStep} onBegin={beginWorkflow} finish={() => { beginWorkflow(); void runChainAction("create", "Tanda terima dibuat. Lanjut sebagai Petani untuk meninjau dan mengonfirmasi pengiriman.").then((ok) => { if (ok) setScreen("receipts"); }); }} />;
  else if (screen === "receipts") activeView = <ReceiptView role={session} state={receiptState} paid={paid} disputed={disputed} proofUrl={proofUrl} proofHash={proofHash} onPay={() => setScreen("payments")} onDispute={() => setScreen("disputes")} />;
  else if (screen === "payments" && session === "Pabrik") activeView = <Payments receiptId={activeReceiptLabel} paid={paid} proofUrl={proofUrl} txPhase={txPhase} actionError={actionError?.key === `Pabrik:${activeReceiptLabel}:pay` ? actionError.message : ""} onBegin={() => { beginWorkflow(); setTxPhase("review"); setActionError(null); }} onCancel={() => { setTxPhase("idle"); setActionError(null); }} onPay={() => { void runChainAction("pay", "Pembayaran dicatat. Lanjut sebagai Auditor untuk memverifikasi bukti transaksi.", activeReceiptLabel); }} />;
  else if (screen === "verify" && session === "Auditor") activeView = <Verification proofUrl={proofUrl} proofHash={proofHash} />;
  else activeView = <Disputes role={session} disputed={disputed} onSubmit={() => { beginWorkflow(); void runChainAction("dispute", session === "Auditor" ? "Sengketa ditandai untuk penyelesaian." : "Pengajuan koreksi dicatat. Lanjut sebagai Auditor untuk meninjau sengketa."); }} />;

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
      <header className={`portal-header ${headerScrolled ? "scrolled" : ""}`}><div><small>{portalTitle}</small><strong>{profile.name}</strong></div><div className="header-actions"><LanguageSwitch language={language} setLanguage={setLanguage}/><a className={`network-pill ${chainError ? "error" : ""}`} href={chain?.explorerUrl || "https://sepolia.basescan.org/address/0x18708aE53414044F7651D7aA4982494bcb2E21b2"} target="_blank" rel="noreferrer"><i/>{chainBusy ? "Mengirim transaksi…" : chainError ? "Koneksi perlu diperiksa" : "Transaksi aktif"}</a><button className="demo-reset" onClick={startNewDemo} disabled={chainBusy}><Icon name="plus"/><span>Mulai demo baru</span></button><button className="mobile-role-switch" onClick={() => setSession(null)} aria-label="Keluar dan ganti akun"><Icon name="logout"/><span>Ganti akun</span></button></div></header>
      {(chain || chainError) && <div className={`chain-strip ${chainError ? "error" : ""}`}><span><Icon name={chainError ? "alert" : "shield"}/>{chainError ? chainError : `Demo ${demoId.slice(-12)} · ${stateLabel(receiptState)}`}</span>{chain?.transactions.at(-1) && <a href={chain.transactions.at(-1)?.url} target="_blank" rel="noreferrer">Lihat transaksi terakhir <Icon name="arrow"/></a>}</div>}
      {visibleBanner && <NextActionGuide action={visibleBanner.action} title={visibleBanner.title} copy={visibleBanner.copy} complete={Boolean(visibleCompletion)} showContinue={Boolean(visibleCompletion && visibleBanner.action.role !== session)} onContinue={() => continueWorkflow(visibleBanner.action)}/>}
      {actionError && screen !== "payments" && <div className="action-error role-scoped"><Icon name="alert"/><span><b>Action failed for {activeReceiptLabel}</b>{actionError.message}</span></div>}
      <AnimatePresence mode="wait"><motion.div key={`${session}-${screen}`} initial={reduceMotion ? false : {opacity:0,y:10}} animate={{opacity:1,y:0}} exit={reduceMotion ? undefined : {opacity:0,y:-6}} transition={{duration:.2,ease:"easeOut"}}>{activeView}</motion.div></AnimatePresence>
    </main>
  </div>;
}

function LanguageSwitch({ language, setLanguage }: { language: PortalLanguage; setLanguage: (language: PortalLanguage) => void }) {
  return <div className="language-switch" role="group" aria-label="Pilih bahasa">
    <button className={language === "en" ? "active" : ""} onClick={() => setLanguage("en")} aria-pressed={language === "en"}>EN</button>
    <button className={language === "id" ? "active" : ""} onClick={() => setLanguage("id")} aria-pressed={language === "id"}>ID</button>
  </div>;
}

function Landing({ language, setLanguage, onEnter }: { language: PortalLanguage; setLanguage: (language: PortalLanguage) => void; onEnter: () => void }) {
  return <main className="pucuk-landing">
    <div className="landing-landscape" aria-hidden="true"/>
    <header className="landing-header">
      <div className="landing-logo"><i><Icon name="leaf"/></i><strong>Pucuk</strong></div>
      <LanguageSwitch language={language} setLanguage={setLanguage}/>
    </header>
    <motion.section className="landing-copy" initial={{opacity:0}} animate={{opacity:1}} transition={{duration:.55,ease:"easeOut"}}>
      <p className="landing-kicker">CATAT · SEPAKATI · BAYAR</p>
      <h1><span>Setiap daun tercatat.</span><span>Setiap pembayaran jelas.</span></h1>
      <p>Pucuk menyatukan catatan berat, kualitas, harga, pembayaran, dan bukti transaksi dalam satu alur yang dapat dipercaya semua pihak.</p>
      <button onClick={onEnter}>Masuk ke portal <Icon name="arrow"/></button>
    </motion.section>
    <footer className="landing-footer"><span>Demo transaksi daun teh</span><span>Pembayaran dalam IDR</span></footer>
  </main>;
}

function NextActionGuide({ action, title, copy, complete, showContinue, onContinue }: { action: NextAction; title: string; copy: string; complete: boolean; showContinue: boolean; onContinue: () => void }) {
  return <section className={`next-action-guide ${complete ? "complete" : ""}`} aria-label={complete ? "Tindakan selesai" : "Tindakan berikutnya"}>
    <i><Icon name={complete ? "check" : "arrow"}/></i>
    <div><small>{complete ? "SELESAI" : "TANGGUNG JAWAB ANDA"} · {action.role}</small><strong>{title}</strong><p>{copy}</p></div>
    {showContinue && <button onClick={onContinue}>{action.cta}<Icon name="arrow"/></button>}
  </section>;
}

function Login({ selected, setSelected, language, setLanguage, onBack, onLogin }: { selected: Role; setSelected: (role: Role) => void; language: PortalLanguage; setLanguage: (language: PortalLanguage) => void; onBack: () => void; onLogin: () => void }) {
  const profile = profiles[selected];
  return <main className="role-entry-page">
    <header className="role-entry-header"><button className="role-entry-back" onClick={onBack}><Icon name="arrow"/>Kembali</button><div className="landing-logo"><i><Icon name="leaf"/></i><strong>Pucuk</strong></div><LanguageSwitch language={language} setLanguage={setLanguage}/></header>
    <motion.section className="auth-card role-entry-card" initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} transition={{duration:.35,ease:"easeOut"}}>
      <p className="portal-kicker">PILIH PORTAL ANDA</p><h2>Satu alur transaksi, pengalaman yang tepat untuk setiap peran.</h2><p>Setiap akun hanya melihat data dan tindakan yang sesuai dengan perannya.</p>
      <div className="identity-list">{(Object.keys(profiles) as Role[]).map((role) => <motion.button layout whileHover={{y:-2}} whileTap={{scale:.98}} key={role} className={selected === role ? "selected" : ""} onClick={() => setSelected(role)}>
        <span>{profiles[role].initials}</span><div><strong>{role}</strong><small>{profiles[role].description}</small></div>{selected === role && <Icon name="check"/>}
      </motion.button>)}</div>
      <form onSubmit={(event) => { event.preventDefault(); onLogin(); }}>
        <label>Email<input value={profile.email} readOnly/></label>
        <label>Kata sandi<input type="password" value="pucukproof" readOnly/></label>
        <button className="portal-primary" type="submit">Masuk sebagai {selected}<Icon name="arrow"/></button>
      </form>
      <div className="auth-selected"><span>{profile.initials}</span><div><strong>{profile.name}</strong><small>{profile.org}</small></div></div>
    </motion.section>
  </main>;
}

function PageHead({ kicker, title, copy, action }: { kicker: string; title: string; copy: string; action?: React.ReactNode }) {
  return <div className="portal-page-head"><div><p className="portal-kicker">{kicker}</p><h1>{title}</h1><p>{copy}</p></div>{action}</div>;
}

function Metric({ icon, label, value, note, tone = "green" }: { icon: string; label: string; value: string; note: string; tone?: string }) {
  return <motion.article className="portal-metric" whileHover={{y:-3,boxShadow:"0 12px 28px rgba(24,61,45,.08)"}} transition={{duration:.18}}><i className={tone}><Icon name={icon}/></i><div><small>{label}</small><strong>{value}</strong><p>{note}</p></div></motion.article>;
}

function AnalyticsControls({ scope, options, filters, onChange }: { scope: string; options: string[]; filters: DashboardFilters; onChange: (filters: DashboardFilters) => void }) {
  return <div className="analytics-controls"><label><span>CAKUPAN</span><select aria-label="Cakupan data" value={filters.scope} onChange={(event) => onChange({...filters, scope:event.target.value})}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label><label><span>PERIODE</span><select aria-label="Rentang tanggal" value={filters.range} onChange={(event) => onChange({...filters, range:event.target.value as DashboardFilters["range"]})}>{periodOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><div className="analytics-fresh"><i/><span><b>{scope}</b><small>{periodLabel[filters.range]} · Diperbarui 27 Jul · 16:48</small></span></div></div>;
}

function TrendChart({ title, subtitle, data, second, legend = ["Aktual"], suffix = "" }: { title: string; subtitle: string; data: number[]; second?: number[]; legend?: string[]; suffix?: string }) {
  const width = 720, height = 238;
  const plot = { left: 78, right: 22, top: 24, bottom: 198 };
  const reduceMotion = useReducedMotion();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const periodVariant = [...subtitle].reduce((total, character) => total + character.charCodeAt(0), 0) % 9;
  const adaptPeriod = (values: number[]) => values.map((value, index) =>
    Number((value * (1 + .045 * Math.sin((index + 1) * (.48 + periodVariant * .09)))).toFixed(2)),
  );
  const rangeMode: DashboardFilters["range"] = subtitle.includes("7 hari") ? "7d" : subtitle.includes("30 hari") ? "30d" : subtitle.includes("Musim ini") ? "season" : "12w";
  const rangeConfig = {
    "7d": { count: 7, intervalDays: 1 },
    "30d": { count: 5, intervalDays: 7 },
    "12w": { count: 12, intervalDays: 7 },
    season: { count: 12, intervalDays: 30 },
  }[rangeMode];
  const resample = (values: number[]) => Array.from({length:rangeConfig.count}, (_, index) =>
    values[Math.round(index * (values.length - 1) / Math.max(1, rangeConfig.count - 1))],
  );
  const plottedData = resample(adaptPeriod(data));
  const plottedSecond = second ? resample(adaptPeriod(second)) : undefined;
  const all = plottedSecond ? [...plottedData, ...plottedSecond] : plottedData;
  const dataMin = Math.min(...all), dataMax = Math.max(...all);
  const niceStep = (value: number) => {
    const magnitude = 10 ** Math.floor(Math.log10(Math.max(value, .0001)));
    const normalized = value / magnitude;
    return (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * magnitude;
  };
  const tickStep = niceStep((dataMax - dataMin) / 3);
  const min = Math.floor(dataMin / tickStep) * tickStep;
  const max = Math.ceil(dataMax / tickStep) * tickStep;
  const spread = Math.max(max - min, tickStep);
  const xFor = (index: number) => plot.left + index * ((width - plot.left - plot.right) / (plottedData.length - 1));
  const yFor = (value: number) => plot.bottom - ((value - min) / spread) * (plot.bottom - plot.top);
  const points = (values: number[]) => values.map((value, index) => `${xFor(index)},${yFor(value)}`).join(" ");
  const endDate = Date.UTC(2026, 6, 22);
  const dates = Array.from({length:plottedData.length}, (_, index) =>
    new Date(endDate - (plottedData.length - 1 - index) * rangeConfig.intervalDays * 86400000),
  );
  const monthNames = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
  const dateLabel = (date: Date, includeYear = false) => `${date.getUTCDate()} ${monthNames[date.getUTCMonth()]}${includeYear ? ` ${date.getUTCFullYear()}` : ""}`;
  const formatValue = (value: number) => `${Number.isInteger(value) ? value : value.toFixed(1)}${suffix}`;
  const selectNearest = (event: React.PointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const position = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
    setActiveIndex(Math.round(position * (plottedData.length - 1)));
  };
  const activeValue = activeIndex === null ? null : plottedData[activeIndex];
  const activeX = activeIndex === null ? 0 : xFor(activeIndex);
  const activeY = activeValue === null ? 0 : yFor(activeValue);
  const tooltipLeft = `clamp(var(--tooltip-half), ${activeX / width * 100}%, calc(100% - var(--tooltip-half)))`;
  const tooltipBelow = activeY < 64;
  const yTicks = Array.from({length:Math.round(spread / tickStep) + 1}, (_, index) => Number((max - index * tickStep).toFixed(8)));
  const unitLabel = suffix.trim() === "menit" ? "Menit" : suffix.trim() === "kg" ? "kg" : suffix.trim() === "jt" ? "Juta Rp" : "Jumlah";
  const formatAxisValue = (value: number) => Number.isInteger(value) ? String(value) : value.toFixed(1);
  const visibleXTicks = new Set(plottedData.length <= 7 ? plottedData.map((_, index) => index) : plottedData.map((_, index) => index).filter((index) => index % 2 === 0 || index === plottedData.length - 1));
  const primaryXTicks = new Set([0, Math.round((plottedData.length - 1) / 3), Math.round((plottedData.length - 1) * 2 / 3), plottedData.length - 1]);
  return <section className="portal-card analytics-chart"><div className="chart-head"><div><h2>{title}</h2><p>{subtitle}</p></div><div className="chart-legend">{legend.map((item, index) => <span key={item}><i className={index ? "secondary" : ""}/>{item}</span>)}</div></div><div className="line-wrap interactive-chart">
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${title}. Geser atau ketuk grafik untuk melihat nilai.`} tabIndex={0} onPointerMove={selectNearest} onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); selectNearest(event); }} onPointerUp={(event) => event.currentTarget.releasePointerCapture(event.pointerId)} onPointerLeave={(event) => { if (event.pointerType === "mouse") setActiveIndex(null); }} onKeyDown={(event) => { if (event.key === "ArrowRight") setActiveIndex(Math.min(plottedData.length - 1, (activeIndex ?? -1) + 1)); if (event.key === "ArrowLeft") setActiveIndex(Math.max(0, (activeIndex ?? 1) - 1)); }}>
      <text x={plot.left - 12} y={plot.top - 10} textAnchor="end" className="axis-unit">{unitLabel}</text>
      {yTicks.map((tick) => <g key={tick}><line x1={plot.left} x2={width-plot.right} y1={yFor(tick)} y2={yFor(tick)} className="grid-line"/><text x={plot.left-12} y={yFor(tick)+4} textAnchor="end" className="axis-tick">{formatAxisValue(tick)}</text></g>)}
      {plottedSecond && <motion.polyline key={`second-${subtitle}`} points={points(plottedSecond)} className="trend-line secondary" initial={reduceMotion ? {opacity:0} : {pathLength:0,opacity:.35}} animate={reduceMotion ? {opacity:1} : {pathLength:1,opacity:1}} transition={{duration:reduceMotion ? .2 : .8,ease:"easeOut"}}/>}
      <motion.polyline key={`primary-${subtitle}-${data.join(",")}`} points={points(plottedData)} className="trend-line" initial={reduceMotion ? {opacity:0} : {pathLength:0,opacity:.35}} animate={reduceMotion ? {opacity:1} : {pathLength:1,opacity:1}} transition={{duration:reduceMotion ? .2 : .8,ease:"easeOut",delay:reduceMotion ? 0 : .08}}/>
      {plottedData.map((value,index) => <motion.circle key={`${subtitle}-${index}`} cx={xFor(index)} cy={yFor(value)} r="3.5" className="trend-dot" initial={{opacity:.2,scale:reduceMotion ? 1 : .7}} animate={{opacity:1,scale:1}} transition={{duration:reduceMotion ? .15 : .25,delay:reduceMotion ? 0 : .35+index*.035}}><title>{dateLabel(dates[index], true)}: {formatValue(value)}</title></motion.circle>)}
      <AnimatePresence>{activeIndex !== null && <motion.g initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:.16}}><motion.line className="active-guide" x1={activeX} x2={activeX} y1={plot.top} y2={plot.bottom}/><motion.circle className="active-pulse" cx={activeX} cy={activeY} r="9" animate={reduceMotion ? {opacity:.2} : {r:[7,11,7],opacity:[.28,.08,.28]}} transition={reduceMotion ? {duration:.1} : {duration:1.8,repeat:Infinity,ease:"easeInOut"}}/><motion.circle className="active-dot" r="5" animate={{cx:activeX,cy:activeY}} transition={reduceMotion ? {duration:0} : {type:"spring",stiffness:420,damping:32}}/></motion.g>}</AnimatePresence>
      {dates.map((date,index) => visibleXTicks.has(index) && <text key={index} x={xFor(index)} y={225} textAnchor={index === 0 ? "start" : index === dates.length - 1 ? "end" : "middle"} className={`axis-tick x-tick ${primaryXTicks.has(index) ? "x-primary" : "x-secondary"} ${[0,dates.length-1].includes(index) ? "x-edge" : ""} ${index === Math.round((dates.length-1)/2) ? "x-center" : ""}`}>{dateLabel(date)}</text>)}
    </svg>
    <AnimatePresence>{activeIndex !== null && activeValue !== null && <motion.div className={`chart-tooltip-anchor ${tooltipBelow ? "below" : ""}`} style={{left:tooltipLeft,top:`${activeY/height*100}%`}} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:reduceMotion ? .1 : .16}}><motion.div className="chart-tooltip" initial={{y:reduceMotion ? 0 : tooltipBelow ? -4 : 4}} animate={{y:0}} transition={{duration:reduceMotion ? 0 : .16}}><small>{dateLabel(dates[activeIndex], true)}</small><strong>{Number.isInteger(activeValue) ? activeValue : activeValue.toFixed(1)} <em>{suffix.trim()}</em></strong></motion.div></motion.div>}</AnimatePresence>
  </div></section>;
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
  const options = ["Semua titik koleksi","Cisarua · CP-01","Pangalengan · CP-02","Ciwidey · CP-03"];
  const [filters, setFilters] = useState<DashboardFilters>({scope:options[0],range:"12w"});
  const factor = demoFactor(filters, options);
  const receipts = scaled(14, factor);
  const complete = Math.max(0, receipts - scaled(2, factor));
  return <div className="portal-content"><PageHead kicker="PENERIMAAN HARI INI" title="Selesaikan catatan sebelum petani pulang" copy="Pastikan berat, kualitas, harga, dan foto bukti lengkap sebelum meminta persetujuan." action={<button className="portal-primary" onClick={onIntake}><Icon name="plus"/>Penerimaan baru</button>}/><AnalyticsControls scope={`${filters.scope} · Data tanda terima`} options={options} filters={filters} onChange={setFilters}/><div className="portal-metrics analytics-kpis farmer-kpis"><Metric icon="leaf" label="BERAT DITERIMA" value={`${(318.4*factor).toLocaleString("id-ID",{maximumFractionDigits:1})} kg`} note={`${scaled(7,factor)} tanda terima`}/><Metric icon="file" label="DRAF BELUM SELESAI" value={String(scaled(2,factor))} note="Lanjutkan pencatatan" tone="amber"/><Metric icon="shield" label="MENUNGGU PETANI" value={String(scaled(3,factor))} note="Sudah dikirim"/><Metric icon="alert" label="BUKTI TIDAK LENGKAP" value={String(scaled(1,factor))} note="Foto timbangan" tone="amber"/></div><div className="analytics-grid"><TrendChart title="Median waktu penerimaan" subtitle={`Menit dari timbang hingga dikirim ke petani · ${periodLabel[filters.range]}`} data={scaledSeries([8.2,7.8,7.4,7.1,6.8,6.4,6.2,5.9,5.7,5.5,5.2,4.9],.82+scopeFactor(filters.scope,options)*.18,.18)} legend={["Waktu proses"]} suffix=" menit"/><RankedBars title="Kelengkapan bukti" subtitle={`${receipts} tanda terima dalam periode terpilih`} rows={[{label:"Lengkap",value:complete,display:String(complete)},{label:"Perlu foto",value:scaled(1,factor),display:String(scaled(1,factor)),tone:"amber"},{label:"Gagal dicatat",value:scaled(1,factor),display:String(scaled(1,factor)),tone:"blue"}]}/></div><section className="portal-card"><div className="portal-card-head"><div><h2>Perlu tindakan</h2><p>Buka tanda terima untuk menyelesaikan tahap berikutnya</p></div></div><ReceiptRows onOpen={onReceipt} operator/></section>
  </div>;
}

function FarmerHome({ paid, state, proofUrl, onAgree, onReject, onReceipt, onDispute }: { paid: boolean; state: ReceiptState; proofUrl?: string; onAgree: () => void; onReject: () => void; onReceipt: () => void; onDispute: () => void }) {
  const options = ["Semua kebun","Blok Utara · KB-01","Blok Sungai · KB-02","Blok Lereng · KB-03"];
  const [filters, setFilters] = useState<DashboardFilters>({scope:options[0],range:"season"});
  const factor = demoFactor(filters, options);
  const receiptValue = scaled(964000, factor);
  const paidValue = paid ? receiptValue : scaled(receiptValue,.8);
  return <div className="portal-content farmer-mobile"><PageHead kicker="PERLU KONFIRMASI" title="Periksa hasil penerimaan Anda" copy="Setujui hanya jika berat, kualitas, dan harga di bawah ini sudah benar."/><section className="portal-card confirmation-card"><div className="confirmation-top"><div><small>TANDA TERIMA PP-2026-000042</small><h2>Setoran 27 Juli 2026</h2><p>Nadia Anwar · Titik Koleksi Cisarua</p></div><i className={`portal-status ${state === "AwaitingFarmer" ? "amber" : "green"}`}>{state === "AwaitingFarmer" ? "Menunggu persetujuan Anda" : stateLabel(state)}</i></div><div className="confirmation-facts"><p><span>Berat diterima</span><b>42,50 kg</b></p><p><span>Hasil kualitas</span><b>Grade B · Pucuk halus 68%</b></p><p><span>Harga dasar</span><b>Rp2.200/kg</b></p><p><span>Premi kualitas</span><b className="good">+Rp100/kg</b></p><p><span>Potongan</span><b className="bad">−Rp50/kg</b></p><p className="total"><span>Yang akan dibayarkan</span><b>Rp95.625</b></p></div>{state === "AwaitingFarmer" && <div className="confirmation-actions"><button className="portal-secondary" onClick={onReject}>Tidak setuju</button><button className="portal-primary" onClick={onAgree}><Icon name="check"/>Setuju, data sudah benar</button></div>}<button className="technical-link" onClick={onReceipt}>Lihat bukti dan detail transaksi <Icon name="arrow"/></button><a className="connection-note" href={proofUrl} target="_blank" rel="noreferrer"><i/><span><b>Transaksi sudah tercatat</b><small>Buka dan periksa catatan publik transaksi ini.</small></span><Icon name="arrow"/></a></section><AnalyticsControls scope={`${filters.scope} · Riwayat petani`} options={options} filters={filters} onChange={setFilters}/><div className="portal-metrics analytics-kpis farmer-kpis"><Metric icon="leaf" label="DAUN TERCATAT" value={`${(428.6*factor).toLocaleString("id-ID",{maximumFractionDigits:1})} kg`} note={periodLabel[filters.range]}/><Metric icon="wallet" label="NILAI TANDA TERIMA" value={money(receiptValue)} note={`${scaled(12,factor)} tanda terima`}/><Metric icon="check" label="SUDAH DIBAYAR" value={money(paidValue)} note={paid ? "Tidak ada tunggakan" : `${money(receiptValue-paidValue)} tertunda`}/><Metric icon="file" label="MEDIAN PEMBAYARAN" value={`${(2.4+(1-scopeFactor(filters.scope,options))*.8).toFixed(1)} hari`} note={periodLabel[filters.range]} tone="blue"/></div><div className="analytics-grid"><TrendChart title="Volume panen tercatat" subtitle={`Kilogram per minggu · ${periodLabel[filters.range]}`} data={scaledSeries([28,31,30,36,34,39,41,38,44,46,43,49],factor,.8)} legend={["Volume panen"]} suffix=" kg"/><RankedBars title="Kualitas hasil panen" subtitle={`${filters.scope} · ${periodLabel[filters.range]}`} rows={[{label:"Grade A",value:scaled(38,factor),display:`${scaled(38,factor)} kg`},{label:"Grade B",value:scaled(54,factor),display:`${scaled(54,factor)} kg`,tone:"blue"},{label:"Perlu tinjau",value:scaled(8,factor),display:`${scaled(8,factor)} kg`,tone:"amber"}]}/></div><button className="link-button farmer-correction" onClick={onDispute}>Ada data yang perlu dikoreksi?</button>
  </div>;
}

function FactoryHome({ paid, state, proofUrl, onApprove, onPayments, onReceipt }: { paid: boolean; state: ReceiptState; proofUrl?: string; onApprove: () => void; onPayments: () => void; onReceipt: () => void }) {
  const options = ["Semua titik koleksi","Cisarua · CP-01","Pangalengan · CP-02","Ciwidey · CP-03"];
  const [filters, setFilters] = useState<DashboardFilters>({scope:options[0],range:"30d"});
  const factor = demoFactor(filters, options);
  const pendingValue = scaled(617900,factor);
  return <div className="portal-content"><PageHead kicker="PENGADAAN & KEWAJIBAN" title="Tanda terima yang perlu diputuskan" copy="Setujui kewajiban komersial terlebih dahulu. Pembayaran IDR dicatat setelah transaksi benar-benar dilakukan." action={<button className="portal-primary" onClick={onPayments}>Buka pembayaran<Icon name="arrow"/></button>}/><AnalyticsControls scope={`${filters.scope} · Data pengadaan Pucuk`} options={options} filters={filters} onChange={setFilters}/><div className="portal-metrics analytics-kpis farmer-kpis"><Metric icon="leaf" label="DAUN DITERIMA" value={`${(1284.6*factor).toLocaleString("id-ID",{maximumFractionDigits:1})} kg`} note={`${scaled(37,factor)} tanda terima`}/><Metric icon="wallet" label="HARGA RATA-RATA" value={`${money(Math.round(2284*(.96+scopeFactor(filters.scope,options)*.04)))}/kg`} note={periodLabel[filters.range]}/><Metric icon="shield" label="MENUNGGU PERSETUJUAN" value={String(scaled(3,factor))} note={money(pendingValue)} tone="amber"/><Metric icon="file" label="BELUM LUNAS" value={String(scaled(paid?2:3,factor))} note={money(paid?scaled(522275,factor):pendingValue)} tone="blue"/></div><section className="portal-card liability-card"><div><small>KEWAJIBAN PP-2026-000042</small><h2>42,50 kg · Grade B · Rp95.625</h2><p>Operator dan petani telah menyetujui data yang sama. Catatan transaksi sudah tersimpan.</p></div><i className="portal-status blue">{stateLabel(state)}</i><div className="liability-actions"><button onClick={onReceipt}>Periksa bukti</button><a className="proof-action" href={proofUrl} target="_blank" rel="noreferrer">Lihat transaksi <Icon name="arrow"/></a>{state === "Registered" && <button className="portal-primary" onClick={onApprove}>Setujui kewajiban</button>}{state === "Approved" && <button className="portal-primary" onClick={onPayments}>Catat pembayaran IDR</button>}</div></section><div className="analytics-grid"><TrendChart title="Nilai pengadaan tercatat" subtitle={`Juta rupiah per minggu · ${periodLabel[filters.range]}`} data={scaledSeries([1.8,2.0,1.9,2.2,2.1,2.3,2.25,2.4,2.3,2.5,2.45,2.62],factor,.06)} legend={["Nilai tanda terima"]} suffix=" jt"/><RankedBars title="Konsistensi pemasok" subtitle={`${filters.scope} · Kelengkapan bukti`} rows={[{label:"Cisarua",value:Math.round(98*scopeFactor(filters.scope,options)),display:`${Math.round(98*scopeFactor(filters.scope,options))}%`},{label:"Pangalengan",value:Math.round(94*scopeFactor(filters.scope,options)),display:`${Math.round(94*scopeFactor(filters.scope,options))}%`,tone:"blue"},{label:"Ciwidey",value:Math.round(89*scopeFactor(filters.scope,options)),display:`${Math.round(89*scopeFactor(filters.scope,options))}%`,tone:"amber"}]}/></div>
  </div>;
}

function AuditorHome({ disputed, onVerify, onDispute }: { disputed: boolean; onVerify: () => void; onDispute: () => void }) {
  const options = ["Seluruh pilot · 18 petani","Koperasi Pucuk Sejahtera","Pabrik Teh Nusantara","Titik Koleksi Cisarua"];
  const [filters, setFilters] = useState<DashboardFilters>({scope:options[0],range:"12w"});
  const factor = demoFactor(filters, options);
  const registered = scaled(42,factor);
  const mismatches = Math.min(registered,Math.max(registered?1:0,scaled(1,factor)));
  const matched = Math.max(0,registered-mismatches);
  const complete = Math.max(0,registered-scaled(3,factor));
  const alerts = [
    {tone:"warn",title:"PP-2026-000039 · selisih berat",note:"42,50 kg awal · 41,50 kg diusulkan",status:"Tinjau"},
    {tone:"info",title:"PP-2026-000036 · bukti belum lengkap",note:"Foto timbangan belum tersedia",status:"Minta bukti"},
    {tone:"ok",title:"Rekonsiliasi jaringan terakhir",note:`${matched} hash aplikasi cocok dengan registry`,status:"Sehat"},
  ].slice(0,filters.range==="7d"?2:3);
  return <div className="portal-content"><PageHead kicker="PUSAT AUDIT PILOT" title="Bukti, sengketa, dan rekonsiliasi" copy="Setiap akses auditor dicatat. Data pribadi hanya dibuka bila diperlukan untuk pemeriksaan." action={<button className="portal-primary" onClick={onVerify}><Icon name="shield"/>Verifikasi tanda terima</button>}/><AnalyticsControls scope={`${filters.scope} · Setiap akses auditor dicatat`} options={options} filters={filters} onChange={setFilters}/><div className="portal-metrics analytics-kpis farmer-kpis"><Metric icon="shield" label="TANDA TERIMA TERDAFTAR" value={String(registered)} note={periodLabel[filters.range]}/><Metric icon="check" label="HASH COCOK" value={`${matched} / ${registered}`} note={`${mismatches} perlu rekonsiliasi`}/><Metric icon="file" label="BUKTI LENGKAP" value={`${complete} / ${registered}`} note={`${registered?((complete/registered)*100).toFixed(1):"0"}%`}/><Metric icon="alert" label="SENGKETA TERBUKA" value={String(scaled(disputed?2:1,factor))} note="Urut usia & risiko" tone="amber"/></div><div className="analytics-grid"><TrendChart title="Tanda terima terdaftar" subtitle={`Jumlah per minggu · ${periodLabel[filters.range]}`} data={scaledSeries([2,3,2,4,3,4,3,5,4,4,3,5],factor,.25)} legend={["Terdaftar"]}/><RankedBars title="Status assurance" subtitle={`${registered} tanda terima dalam cakupan`} rows={[{label:"Hash cocok",value:matched,display:String(matched)},{label:"Bukti lengkap",value:complete,display:String(complete),tone:"blue"},{label:"Perlu rekonsiliasi",value:mismatches,display:String(mismatches),tone:"amber"}]}/></div><AlertList title="Kasus prioritas" subtitle="Buka kasus untuk membandingkan catatan awal dan usulan koreksi" items={alerts}/><button className="portal-primary audit-case-cta" onClick={onDispute}>Tinjau sengketa dan bukti<Icon name="arrow"/></button>
  </div>;
}

function ReceiptRows({ onOpen, operator = false }: { onOpen: () => void; operator?: boolean }) {
  const row = ["PP-2026-000042","Sari Rahayu","42,50 kg","Rp95.625"];
  return <div className="receipt-rows"><button onClick={onOpen}><span className="mini-avatar">SR</span><span><strong>{row[1]}</strong><small>{row[0]}</small></span><span><strong>{row[2]}</strong><small>{operator ? "Grade B" : "Berat"}</small></span><span><strong>{row[3]}</strong><small>Total</small></span><i className="portal-status blue">Perlu tindakan</i><Icon name="arrow"/></button></div>;
}

function Intake({ step, setStep, onBegin, finish }: { step: number; setStep: (step: number) => void; onBegin: () => void; finish: () => void }) {
  const labels = ["Penerimaan","Kualitas","Harga","Konfirmasi"];
  return <div className="portal-content compact"><PageHead kicker="PENERIMAAN BARU" title={labels[step - 1]} copy="Lengkapi catatan fisik sebelum meminta konfirmasi petani."/>
    <div className="intake-steps">{labels.map((label, index) => <div className={index + 1 <= step ? "active" : ""} key={label}><span>{index + 1 < step ? <Icon name="check"/> : index + 1}</span><strong>{label}</strong></div>)}</div>
    <section className="portal-card intake-card">
      {step === 1 && <><h2>Catat penerimaan fisik</h2><div className="field-grid"><label>Petani<select><option>Sari Rahayu · F-007</option></select></label><label>Titik koleksi<select><option>Cisarua · CP-01</option></select></label><label>Berat kotor (kg)<input defaultValue="42,50"/></label><label>Waktu penerimaan<input defaultValue="27/07/2026 · 16:42" readOnly/></label></div><button className="upload-box"><Icon name="camera"/><span><strong>Tambah foto penerimaan</strong><small>Wajib · JPG/PNG hingga 8 MB</small></span></button></>}
      {step === 2 && <><h2>Pemeriksaan sampel</h2><p className="form-hint">Protokol PP-QP-0.1 · Sampel representatif 500 g</p><div className="field-grid four"><label>Grade<select><option>B</option></select></label><label>Pucuk halus (%)<input defaultValue="68"/></label><label>Daun kasar (%)<input defaultValue="25"/></label><label>Batang (%)<input defaultValue="7"/></label></div><div className="form-success"><Icon name="check"/>Komposisi sampel lengkap: 100%</div></>}
      {step === 3 && <><h2>Rincian harga</h2><div className="price-box"><p><span>Harga dasar</span><b>Rp2.200/kg</b></p><p><span>Premi kualitas</span><b className="good">+Rp100/kg</b></p><p><span>Potongan</span><b className="bad">−Rp50/kg</b></p><hr/><p><span>Harga akhir</span><b>Rp2.250/kg</b></p><div><small>42,50 kg × Rp2.250</small><strong>Rp95.625</strong></div></div></>}
      {step === 4 && <><h2>Siap meminta konfirmasi</h2><div className="plain-confirm">Sari Rahayu mengirim <strong>42,50 kg pucuk teh</strong>. Grade B, harga akhir <strong>Rp2.250/kg</strong>, total pembayaran <strong>Rp95.625</strong>.</div><label className="check-row"><input type="checkbox" defaultChecked/> Saya sudah memeriksa berat, kualitas, harga, dan bukti.</label></>}
      <div className="portal-form-actions"><button disabled={step === 1} onClick={() => setStep(step - 1)}>Kembali</button><button className="portal-primary" onClick={() => { onBegin(); if (step < 4) setStep(step + 1); else finish(); }}>{step < 4 ? "Lanjutkan" : "Buat tanda terima"}<Icon name="arrow"/></button></div>
    </section>
  </div>;
}

function ReceiptView({ role, state, paid, disputed, proofUrl, proofHash, onPay, onDispute }: { role: Role; state: ReceiptState; paid: boolean; disputed: boolean; proofUrl?: string; proofHash: string; onPay: () => void; onDispute: () => void }) {
  return <div className="portal-content compact"><PageHead kicker={role === "Petani" ? "TANDA TERIMA SAYA" : "BUKTI PENERIMAAN"} title="PP-2026-000042" copy="27 Juli 2026 · Titik Koleksi Cisarua"/>
    <div className="receipt-layout"><section className="portal-card receipt-paper"><div className="receipt-parties"><div><small>PETANI</small><strong>Sari Rahayu</strong><p>Koperasi Pucuk Sejahtera</p></div><Icon name="arrow"/><div><small>PENERIMA</small><strong>Pabrik Teh Nusantara</strong><p>Operator: Nadia Anwar</p></div></div><div className="receipt-total"><small>TOTAL YANG HARUS DIBAYAR</small><strong>Rp95.625</strong><p>42,50 kg × Rp2.250/kg</p></div><div className="receipt-facts"><p><span>Status saat ini</span><i className={`portal-status ${state === "Paid" ? "green" : "blue"}`}>{stateLabel(state)}</i></p><p><span>Perhitungan harga</span><b>Rp2.200 + Rp100 − Rp50 /kg</b></p><p><span>Komposisi kualitas</span><b>Halus 68% · Kasar 25% · Batang 7%</b></p><p><span>Protokol bukti</span><b>PP-QP-0.1 · Lengkap</b></p></div></section>
    <aside><a className="portal-card chain-proof" href={proofUrl} target="_blank" rel="noreferrer" aria-label="Buka bukti transaksi PP-2026-000042"><i><Icon name="shield"/></i><div><small>BUKTI KETIDAKBERUBAHAN</small><h3>Catatan transaksi telah terverifikasi</h3><p>Ini membuktikan catatan tidak berubah setelah didaftarkan, bukan bahwa pengukuran fisik pasti benar.</p><code>{shortHash(proofHash)} <span>Buka transaksi <Icon name="arrow"/></span></code></div></a>{role === "Pabrik" && state === "Approved" && !paid && <button className="portal-primary full" onClick={onPay}>Catat pembayaran IDR</button>}{role === "Petani" && !disputed && <button className="portal-secondary full" onClick={onDispute}>Ajukan koreksi dari tanda terima ini</button>}</aside></div><ReceiptLifecycle current={state}/>
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

function Payments({ receiptId, paid, proofUrl, txPhase, actionError, onBegin, onCancel, onPay }: { receiptId: string; paid: boolean; proofUrl?: string; txPhase: TxPhase; actionError: string; onBegin: () => void; onCancel: () => void; onPay: () => void }) {
  const reviewing = txPhase === "review" || txPhase === "submitting" || txPhase === "submitted" || txPhase === "failed";
  const busy = txPhase === "submitting" || txPhase === "submitted";
  return <div className="portal-content"><PageHead kicker="PORTAL PABRIK" title="Kewajiban pembayaran" copy="Pembayaran dilakukan dalam IDR; bukti privat tetap terlindungi."/>
    <div className="demo-disclaimer"><Icon name="alert"/><span><b>Demo testnet</b> — roles and approvals are simulated, no real funds move, and the public transaction record does not independently prove identity.</span></div>
    {paid && proofUrl && <a className="payment-proof" href={proofUrl} target="_blank" rel="noreferrer"><Icon name="check"/><span><b>Pembayaran {receiptId} sudah dikonfirmasi</b><small>Hash transaksi tersedia sebagai bukti publik.</small></span><strong>Lihat transaksi <Icon name="arrow"/></strong></a>}
    {!reviewing && <section className="portal-card payment-table"><div className="payment-head"><span>TANDA TERIMA</span><span>PETANI</span><span>BERAT</span><span>TOTAL</span><span>STATUS</span><span/></div>{!paid && <div className="payment-row"><strong>{receiptId}</strong><span>Sari Rahayu</span><span>42,50 kg</span><strong>Rp95.625</strong><i className="portal-status blue">Kewajiban disetujui</i><button onClick={onBegin}>Tinjau pembayaran</button></div>}{paid && <div className="empty-queue"><Icon name="check"/><span><b>Tidak ada pembayaran aktif</b><small>Receipt yang sudah selesai dipindahkan ke riwayat.</small></span></div>}</section>}
    {reviewing && <section className="portal-card payment-confirmation" aria-live="polite"><div className="portal-card-head"><div><small>REVIEW</small><h2>Konfirmasi pembayaran</h2><p>Pastikan receipt dan nominal benar sebelum transaksi dikirim.</p></div><i className={`portal-status ${busy ? "amber" : "blue"}`}>{txPhase === "review" ? "Review" : txPhase === "submitting" ? "Mengirim" : txPhase === "submitted" ? "Terkirim · menunggu konfirmasi" : "Perlu dicoba lagi"}</i></div><dl><div><dt>Receipt ID</dt><dd><code>{receiptId}</code></dd></div><div><dt>Petani</dt><dd>Sari Rahayu</dd></div><div><dt>Pabrik</dt><dd>Pabrik Teh Nusantara</dd></div><div><dt>Jumlah pembayaran</dt><dd>Rp95.625</dd></div><div><dt>Sebelum pembayaran</dt><dd>Rp95.625</dd></div><div><dt>Setelah pembayaran</dt><dd>Rp0</dd></div><div><dt>Bukti pembayaran</dt><dd>Optional for demo</dd></div><div><dt>Jaringan</dt><dd>Testnet</dd></div></dl>{actionError && <div className="action-error"><Icon name="alert"/><span><b>Transaksi belum berhasil</b>{actionError}</span></div>}<div className="confirmation-actions"><button onClick={onCancel} disabled={busy}>Batal</button><button className="portal-primary" onClick={onPay} disabled={busy}>{busy ? "Menunggu konfirmasi…" : actionError ? "Coba lagi" : "Catat pembayaran"}</button></div></section>}
    <section className="portal-card payment-history"><div className="portal-card-head"><div><h2>Riwayat pembayaran</h2><p>Catatan selesai hanya-baca; tidak dapat dikirim ulang.</p></div></div><div className="payment-row history"><strong>PP-2026-000038</strong><span>Dedi Suhendar</span><span>44,20 kg</span><strong>Rp104.975</strong><i className="portal-status green">Sudah dibayar</i><span>24 Jul 2026</span></div></section>
  </div>;
}

function Verification({ proofUrl, proofHash }: { proofUrl?: string; proofHash: string }) {
  return <div className="portal-content compact"><PageHead kicker="PORTAL AUDIT" title="Verifikasi receipt" copy="Bandingkan bukti aplikasi dengan catatan publik."/>
    <section className="verify-result"><i><Icon name="shield"/></i><p>HASIL VERIFIKASI</p><h2>COCOK</h2><span>Data tanda terima cocok dengan catatan transaksi.</span><div><article><small>DATA APLIKASI</small><code>{shortHash(proofHash)}</code></article><b>=</b><article><small>DATA TRANSAKSI</small><code>{shortHash(proofHash)}</code></article></div><a className="verify-explorer" href={proofUrl} target="_blank" rel="noreferrer">Periksa bukti transaksi <Icon name="arrow"/></a></section>
  </div>;
}

function Disputes({ role, disputed, onSubmit }: { role: Role; disputed: boolean; onSubmit: () => void }) {
  if (role === "Auditor") return <div className="portal-content compact"><PageHead kicker="PORTAL AUDIT" title="Sengketa aktif" copy="Tinjau bukti dan pertahankan riwayat asli."/><section className="portal-card case-card"><i><Icon name="alert"/></i><div><small>PP-2026-000039</small><h2>Perbedaan berat penerimaan</h2><p>Petani mengajukan bukti timbangan 41,50 kg; receipt mencatat 42,50 kg.</p><span className="portal-status amber">{disputed ? "Siap diselesaikan" : "Menunggu tinjauan"}</span></div><button className="portal-primary" onClick={onSubmit}>Tinjau bukti</button></section></div>;
  return <div className="portal-content compact"><PageHead kicker="PORTAL PETANI" title="Ajukan koreksi" copy="Catatan asli tidak dihapus. Koreksi membuat receipt pengganti yang saling terhubung."/><section className="portal-card dispute-form"><label>Bagian yang tidak sesuai<select><option>Berat penerimaan</option><option>Hasil kualitas</option><option>Harga atau potongan</option></select></label><label>Jelaskan masalah<textarea placeholder="Tuliskan angka atau informasi yang menurut Anda perlu dikoreksi…"/></label><button className="upload-box"><Icon name="camera"/><span><strong>Tambah bukti</strong><small>Foto timbangan atau catatan lain</small></span></button><button className="portal-primary" disabled={disputed} onClick={onSubmit}>{disputed ? "Pengajuan sudah terkirim" : "Kirim pengajuan koreksi"}</button></section></div>;
}
