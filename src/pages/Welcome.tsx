import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/use-auth";
import { APP_VERSION, UPDATE_BODY, UPDATE_VERSION } from "@/lib/version";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  ChevronUp,
  Info,
  KeyRound,
  Loader2,
  Lock,
  LogIn,
  Mail,
  ShieldCheck,
  Sparkles,
  UserPlus,
  X,
} from "lucide-react";
import { Suspense, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";

/* ------------------------------------------------------------------ *
 * Akun yang pernah dipakai di perangkat ini (disimpan di localStorage)  *
 * ------------------------------------------------------------------ */

type DeviceAcc = {
  type: "google" | "email";
  email: string;
  password?: string;
  at: number;
};

const DEV_KEY = "yorunime_device_accounts";

function loadDevices(): DeviceAcc[] {
  try {
    const raw = localStorage.getItem(DEV_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as DeviceAcc[]) : [];
  } catch {
    return [];
  }
}

function saveDevice(acc: Omit<DeviceAcc, "at">) {
  try {
    const list = loadDevices().filter(
      (x) => !(x.type === acc.type && x.email === acc.email),
    );
    list.unshift({ ...acc, at: Date.now() });
    localStorage.setItem(DEV_KEY, JSON.stringify(list.slice(0, 8)));
  } catch {
    /* localStorage penuh / diblokir — abaikan */
  }
}

/** Scroll-hint: siluet panah beranimasi + teks perintah scroll. */
function ScrollHint({ dir }: { dir: "up" | "down" }) {
  const Icon = dir === "up" ? ChevronUp : ChevronDown;
  const label = dir === "up" ? "Gulir ke atas" : "Gulir ke bawah";
  return (
    <div className="flex flex-col items-center gap-1 pb-3 pt-4 text-muted-foreground">
      <motion.div
        animate={{ y: dir === "up" ? [-5, 5, -5] : [5, -5, 5] }}
        transition={{ duration: 1.3, repeat: Infinity, ease: "easeInOut" }}
      >
        <Icon className="size-5" />
      </motion.div>
      <span className="text-[11px] tracking-wide">{label}</span>
    </div>
  );
}

/** Backdrop bintang. */
function Starfield() {
  const stars = useRef(
    Array.from({ length: 40 }, (_, i) => ({
      id: i,
      left: (i * 37 + 13) % 100,
      top: (i * 53 + 29) % 100,
      delay: (i % 10) * 0.4,
      dur: 2.2 + (i % 5) * 0.5,
    })),
  );
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {stars.current.map((s) => (
        <motion.span
          key={s.id}
          className="absolute size-0.5 rounded-full bg-violet-300/60"
          style={{ left: `${s.left}%`, top: `${s.top}%` }}
          animate={{ opacity: [0.1, 0.8, 0.1] }}
          transition={{ duration: s.dur, repeat: Infinity, delay: s.delay }}
        />
      ))}
    </div>
  );
}

function WelcomeFlow() {
  const navigate = useNavigate();
  const { isLoading: authLoading, isAuthenticated, signIn } = useAuth();
  const loginAccount = useMutation(api.authAccounts.loginAccount);
  const registerAccount = useMutation(api.authAccounts.registerAccount);

  const [stage, setStage] = useState<"intro" | "notice" | "rules" | "login">("intro");
  const [testerOpen, setTesterOpen] = useState(false);
  const [testerId, setTesterId] = useState("#1");
  const [testerPass, setTesterPass] = useState("");
  const [testerError, setTesterError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);
  // true = aplikasi baru dibuka kembali (balik dari tab/app lain) → tampilkan
  // layar YoruNime sebentar supaya konten lama tidak kelihatan.
  const [reopened, setReopened] = useState(false);
  const wasHidden = useRef(false);

  // --- Mode utama: Login / Register ---
  const [mode, setMode] = useState<"login" | "register">("login");

  // --- Form Login ---
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginErr, setLoginErr] = useState<string | null>(null);

  // --- Form Register (email → OTP → password) ---
  const [regStep, setRegStep] = useState<1 | 2 | 3>(1);
  const [regEmail, setRegEmail] = useState("");
  const [regCode, setRegCode] = useState("");
  const [regPass, setRegPass] = useState("");
  const [regErr, setRegErr] = useState<string | null>(null);
  const [regBusy, setRegBusy] = useState(false);
  const [registering, setRegistering] = useState(false);

  // --- Info akun perangkat ---
  const [devices, setDevices] = useState<DeviceAcc[]>([]);
  const [devicesOpen, setDevicesOpen] = useState(false);

  // --- Google: pilih akun + izin akses ---
  const [googleStep, setGoogleStep] = useState<"closed" | "picker" | "consent">("closed");
  const [googleEmail, setGoogleEmail] = useState("");
  const [googleOther, setGoogleOther] = useState("");

  // Sistem update: tombol muncul hanya saat ada update (UPDATE_VERSION diisi).
  const [dlState, setDlState] = useState<"idle" | "downloading" | "done">("idle");
  const [dlPct, setDlPct] = useState(0);
  const [changelogOpen, setChangelogOpen] = useState(false);
  const dlTimer = useRef<number | null>(null);
  const updateAvailable = UPDATE_VERSION !== "";
  const updatePending = updateAvailable && dlState !== "done";

  const startDownload = () => {
    setDlState("downloading");
    dlTimer.current = window.setInterval(() => {
      setDlPct((p) => {
        if (p >= 100) {
          if (dlTimer.current) clearInterval(dlTimer.current);
          setDlState("done");
          return 100;
        }
        return p + 4;
      });
    }, 60);
  };

  useEffect(
    () => () => {
      if (dlTimer.current) clearInterval(dlTimer.current);
    },
    [],
  );

  useEffect(() => {
    setDevices(loadDevices());
  }, []);

  // Balik dari tab lain / buka ulang aplikasi → layar YoruNime muncul dulu.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "hidden") {
        wasHidden.current = true;
        return;
      }
      if (wasHidden.current) {
        wasHidden.current = false;
        setReopened(true);
        setStage("intro");
      }
    };
    const onShow = () => {
      if (wasHidden.current) {
        wasHidden.current = false;
        setReopened(true);
        setStage("intro");
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onShow);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onShow);
    };
  }, []);

  // Auto-redirect kalau sudah punya sesi (kecuali saat splash atau register)
  useEffect(() => {
    if (!authLoading && isAuthenticated && !registering && !(reopened && stage === "intro"))
      navigate("/home", { replace: true });
  }, [authLoading, isAuthenticated, navigate, registering, reopened, stage]);

  useEffect(() => {
    if (stage !== "intro") return;
    // Kalau ada update yang belum di-download, tahan di intro dulu.
    if (updatePending) return;
    const t = setTimeout(() => {
      // Sudah login & hanya splash balik aplikasi → langsung ke beranda.
      if (reopened && isAuthenticated) {
        navigate("/home", { replace: true });
        return;
      }
      setStage("notice");
    }, 1800);
    return () => clearTimeout(t);
  }, [stage, updatePending, reopened, isAuthenticated, navigate]);

  // Sudah login sejak awal → jangan tampilkan welcome sama sekali.
  if (!authLoading && isAuthenticated && !reopened)
    return <div className="fixed inset-0 z-50 bg-[#07060c]" />;

  const noticeRef = useRef<HTMLDivElement>(null);
  const rulesRef = useRef<HTMLDivElement>(null);

  const onScrollProgress = (
    ref: React.RefObject<HTMLDivElement | null>,
    done: () => void,
  ) => {
    const el = ref.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 16) done();
  };

  /** Masuk sesi + ke beranda. */
  const doAnonLogin = async () => {
    setLoggingIn(true);
    try {
      await signIn("anonymous");
      navigate("/home", { replace: true });
    } catch (e) {
      setLoginErr(e instanceof Error ? e.message : "Gagal masuk. Coba lagi.");
      setLoggingIn(false);
    }
  };

  /* ---------------- LOGIN: email + password ---------------- */

  const submitLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const email = loginEmail.trim();
    if (!email) return setLoginErr("Masukkan email dulu.");
    if (!loginPass) return setLoginErr("Masukkan password dulu.");

    setLoggingIn(true);
    setLoginErr(null);
    try {
      const r = await loginAccount({ email, password: loginPass });
      if (!r.ok) {
        setLoginErr(
          r.reason === "not_registered"
            ? "Akun belum pernah terdaftar"
            : "Password salah",
        );
        setLoggingIn(false);
        return;
      }
      saveDevice({ type: "email", email, password: loginPass });
      setDevices(loadDevices());
      await signIn("anonymous");
      navigate("/home", { replace: true });
    } catch (err) {
      setLoginErr(err instanceof Error ? err.message : "Gagal masuk. Coba lagi.");
      setLoggingIn(false);
    }
  };

  /* ---------------- REGISTER: email → OTP → password ---------------- */

  const sendOtp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const email = regEmail.trim();
    if (!email || !email.includes("@")) return setRegErr("Masukkan email valid.");

    setRegBusy(true);
    setRegErr(null);
    try {
      await signIn("email-otp", { email });
      setRegStep(2);
    } catch (err) {
      setRegErr(
        err instanceof Error ? err.message : "Gagal kirim OTP. Coba lagi.",
      );
    }
    setRegBusy(false);
  };

  const verifyOtp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const code = regCode.trim();
    if (code.length < 4) return setRegErr("Masukkan kode OTP dari email.");

    setRegBusy(true);
    setRegErr(null);
    // Tahan auto-redirect: sesi baru sah setelah password dibuat.
    setRegistering(true);
    try {
      await signIn("email-otp", { email: regEmail.trim(), code });
      setRegStep(3);
    } catch (err) {
      setRegistering(false);
      setRegErr(
        err instanceof Error ? err.message : "Kode OTP salah atau kedaluwarsa.",
      );
    }
    setRegBusy(false);
  };

  const finishRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (regPass.length < 6) return setRegErr("Password minimal 6 karakter.");

    setRegBusy(true);
    setRegErr(null);
    try {
      await registerAccount({ email: regEmail.trim(), password: regPass });
      saveDevice({ type: "email", email: regEmail.trim(), password: regPass });
      setDevices(loadDevices());
      setRegistering(false);
      navigate("/home", { replace: true });
    } catch (err) {
      setRegErr(
        err instanceof Error ? err.message : "Gagal membuat akun. Coba lagi.",
      );
      setRegBusy(false);
    }
  };

  /* ---------------- Google: pilih akun + izin akses ---------------- */

  const pickGoogle = (email: string) => {
    setGoogleEmail(email);
    setGoogleStep("consent");
  };

  const allowGoogle = async () => {
    saveDevice({ type: "google", email: googleEmail });
    setDevices(loadDevices());
    setGoogleStep("closed");
    await doAnonLogin();
  };

  const doTesterLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const id = testerId.trim().replace(/^#/, "");
    if (id !== "1") {
      setTesterError("ID tester salah. Gunakan #1.");
      return;
    }
    if (testerPass !== "ytta") {
      setTesterError("Password tester salah.");
      return;
    }
    setLoggingIn(true);
    setTesterError(null);
    try {
      await signIn("anonymous");
      navigate("/home", { replace: true });
    } catch (e) {
      setTesterError(e instanceof Error ? e.message : "Gagal masuk. Coba lagi.");
      setLoggingIn(false);
    }
  };

  if (stage === "intro") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-[#07060c]">
        <Starfield />
        <motion.h1
          className="bg-gradient-to-r from-violet-300 via-white to-violet-400 bg-clip-text px-6 text-center text-4xl font-black tracking-[0.2em] text-transparent"
          initial={{ opacity: 0, scale: 0.82, filter: "blur(10px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          transition={{ duration: 0.85, ease: "easeOut" }}
        >
          YoruNime
        </motion.h1>
        <motion.p
          className="mt-2 text-xs text-muted-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.6 }}
        >
          Nonton anime, temukan komunitasmu
        </motion.p>
        <motion.p
          className="mt-1 text-[10px] tracking-widest text-zinc-500"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1, duration: 0.5 }}
        >
          {APP_VERSION}
        </motion.p>

        {/* Update tersedia → tombol download + changelog dalam kotak scrollable */}
        {updateAvailable && (
          <motion.div
            className="absolute inset-x-6 bottom-10"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
          >
            {dlState !== "done" ? (
              <div className="rounded-2xl border border-violet-500/40 bg-card/90 p-4">
                <p className="text-center text-xs font-semibold text-violet-300">
                  Update {UPDATE_VERSION} tersedia
                </p>
                {dlState === "downloading" && (
                  <Progress value={dlPct} className="mt-2 h-1.5" />
                )}
                <button
                  onClick={startDownload}
                  disabled={dlState === "downloading"}
                  className="mt-3 w-full rounded-full bg-violet-600 py-2.5 text-sm font-bold text-white transition hover:bg-violet-500 disabled:opacity-60"
                >
                  {dlState === "downloading"
                    ? `Mengunduh… ${dlPct}%`
                    : "Mulai download update"}
                </button>
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-card/90 p-4">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-green-400">
                  <Sparkles className="size-3.5" /> Update selesai — versi terbaru
                </p>
                <button
                  onClick={() => setChangelogOpen((v) => !v)}
                  className="mt-2 flex w-full items-center justify-between text-xs font-semibold text-zinc-300"
                >
                  Apa yang diperbarui?
                  {changelogOpen ? (
                    <ChevronUp className="size-3.5" />
                  ) : (
                    <ChevronDown className="size-3.5" />
                  )}
                </button>
                {changelogOpen && (
                  <div className="thin-scroll mt-2 max-h-40 overflow-y-auto rounded-lg border border-border/60 bg-black/30 p-2.5">
                    <ul className="list-inside list-disc space-y-1 text-[11px] leading-relaxed text-muted-foreground">
                      {UPDATE_BODY.map((line, i) => (
                        <li key={i}>{line}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-background">
      <AnimatePresence mode="wait">
        {stage === "notice" && (
          <motion.section
            key="notice"
            className="absolute inset-0 flex flex-col"
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -32 }}
            transition={{ duration: 0.28 }}
          >
            <div
              ref={noticeRef}
              onScroll={() => onScrollProgress(noticeRef, () => setStage("rules"))}
              className="h-full overflow-y-auto overscroll-contain"
            >
              <div className="flex min-h-full flex-col px-5 py-10">
                <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-violet-400">
                  YoruNime
                </p>
                <h2 className="mt-2 text-2xl font-extrabold leading-tight">
                  Mohon perhatiannya
                </h2>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Hal penting sebelum kamu mulai:
                </p>
                <ol className="mt-5 space-y-2.5">
                  {[
                    "YoruNime adalah platform streaming anime untuk komunitas.",
                    "Progres nonton, XP, dan level tersimpan otomatis di akunmu.",
                    "Kumpulkan Sacret & naikkan level lewat aktivitas harian.",
                    "Buat clan atau join clan untuk chat bareng & donasi Sacret.",
                    "Bawakan dirimu dengan sopan — toxic = banned.",
                  ].map((t, i) => (
                    <motion.li
                      key={i}
                      className="flex items-start gap-2.5 rounded-xl border border-border/70 bg-card/60 p-3 text-[13px] leading-snug"
                      initial={{ opacity: 0, x: -14 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-violet-600 text-[10px] font-bold text-white">
                        {i + 1}
                      </span>
                      <span>{t}</span>
                    </motion.li>
                  ))}
                </ol>
                <div className="mt-auto">
                  <ScrollHint dir="up" />
                </div>
              </div>
            </div>
            <button
              onClick={() => setStage("rules")}
              className="absolute right-4 top-4 rounded-full border border-border bg-card/80 px-3 py-1.5 text-xs text-muted-foreground"
            >
              Lewati
            </button>
          </motion.section>
        )}

        {stage === "rules" && (
          <motion.section
            key="rules"
            className="absolute inset-0 flex flex-col"
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -32 }}
            transition={{ duration: 0.28 }}
          >
            <div
              ref={rulesRef}
              onScroll={() => onScrollProgress(rulesRef, () => setStage("login"))}
              className="h-full overflow-y-auto overscroll-contain"
            >
              <div className="flex min-h-full flex-col px-5 py-10">
                <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-violet-400">
                  Wajib dibaca
                </p>
                <h2 className="mt-2 text-2xl font-extrabold leading-tight">
                  Peraturan YoruNime
                </h2>
                <div className="mt-5 space-y-2.5">
                  {[
                    ["Dilarang toxic", "Rasisme & ujaran kebencian = banned permanen."],
                    ["Dilarang spam", "Jangan flood chat global, komentar, atau DM."],
                    ["Dilarang link ilegal", "Phishing, jualan akun, konten 18+ dilarang keras."],
                    ["Hormati sesama", "Clan yang toxic akan dibubarkan."],
                    ["Satu akun per orang", "Akun alt untuk keuntungan event dibekukan."],
                    ["Laporkan pelanggaran", "Tombol lapor tersedia di setiap pesan."],
                  ].map(([title, desc], i) => (
                    <motion.div
                      key={i}
                      className="rounded-xl border border-border/70 bg-card/60 p-3"
                      initial={{ opacity: 0, x: -14 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <p className="flex items-center gap-2 text-[13px] font-semibold">
                        <span className="flex size-4 items-center justify-center rounded bg-violet-600/20 text-[9px] font-bold text-violet-400">
                          {i + 1}
                        </span>
                        {title}
                      </p>
                      <p className="mt-0.5 pl-6 text-[11px] leading-snug text-muted-foreground">
                        {desc}
                      </p>
                    </motion.div>
                  ))}
                </div>
                <div className="mt-auto">
                  <ScrollHint dir="up" />
                </div>
              </div>
            </div>
            <button
              onClick={() => setStage("login")}
              className="absolute right-4 top-4 rounded-full border border-border bg-card/80 px-3 py-1.5 text-xs text-muted-foreground"
            >
              Lewati
            </button>
          </motion.section>
        )}

        {stage === "login" && (
          <motion.section
            key="login"
            className="absolute inset-0 overflow-y-auto overscroll-contain"
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Tombol Info akun perangkat — kanan atas */}
            <button
              aria-label="Akun yang pernah dipakai di perangkat ini"
              onClick={() => setDevicesOpen((v) => !v)}
              className="absolute right-4 top-4 z-20 flex size-9 items-center justify-center rounded-full border border-border bg-card/80 text-muted-foreground transition hover:border-violet-500/60 hover:text-violet-300"
            >
              <Info className="size-4" />
            </button>

            {/* Panel info akun perangkat */}
            <AnimatePresence>
              {devicesOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.97 }}
                  transition={{ duration: 0.18 }}
                  className="absolute right-4 top-14 z-20 w-64 overflow-hidden rounded-2xl border border-border bg-card/95 p-3 shadow-xl backdrop-blur"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold">Akun di perangkat ini</p>
                    <button
                      onClick={() => setDevicesOpen(false)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                  {devices.length === 0 ? (
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      Belum ada akun yang pernah dipakai di perangkat ini.
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-1.5">
                      {devices.map((d) => (
                        <li
                          key={`${d.type}-${d.email}`}
                          className="rounded-xl border border-border/70 bg-background/60 p-2.5"
                        >
                          <p className="flex items-center gap-1.5 text-[11px] font-semibold">
                            {d.type === "google" ? (
                              <GoogleIcon />
                            ) : (
                              <Mail className="size-3.5 text-violet-300" />
                            )}
                            {d.type === "google" ? "Google" : "Email"}
                          </p>
                          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                            {d.email}
                          </p>
                          {d.type === "email" && d.password && (
                            <p className="truncate text-[11px] text-zinc-500">
                              sandi: {d.password}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex min-h-full flex-col items-center justify-center px-7 py-12">
              <motion.div
                className="flex size-16 items-center justify-center rounded-3xl bg-gradient-to-br from-violet-500 to-violet-700 shadow-[0_0_40px_-6px] shadow-violet-500/60"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
              >
                <Sparkles className="size-7 text-white" />
              </motion.div>
              <h2 className="mt-5 text-xl font-black tracking-wide">YoruNime</h2>
              <p className="mt-2 max-w-xs text-center text-[11px] font-bold uppercase leading-relaxed tracking-wider text-zinc-300">
                Masuk untuk menyimpan data nonton kamu
              </p>

              {/* ---- Tab Login / Register ---- */}
              <div className="mt-7 flex w-full max-w-xs rounded-2xl border border-border bg-card/70 p-1">
                {(["login", "register"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => {
                      setMode(m);
                      setLoginErr(null);
                      setRegErr(null);
                    }}
                    className={
                      "flex-1 rounded-xl py-2 text-xs font-bold capitalize transition " +
                      (mode === m
                        ? "bg-violet-600 text-white shadow"
                        : "text-muted-foreground hover:text-foreground")
                    }
                  >
                    {m === "login" ? "Login" : "Register"}
                  </button>
                ))}
              </div>

              {/* ---- Isi form sesuai mode ---- */}
              <div className="mt-4 w-full max-w-xs">
                <AnimatePresence mode="wait">
                  {mode === "login" ? (
                    <motion.form
                      key="login"
                      onSubmit={submitLogin}
                      initial={{ opacity: 0, x: -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 16 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-2.5"
                    >
                      <div className="relative">
                        <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={loginEmail}
                          onChange={(e) => setLoginEmail(e.target.value)}
                          placeholder="Email"
                          type="email"
                          autoComplete="email"
                          className="h-11 rounded-xl border-border bg-card pl-9 text-sm"
                        />
                      </div>
                      <div className="relative">
                        <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={loginPass}
                          onChange={(e) => setLoginPass(e.target.value)}
                          placeholder="Password"
                          type="password"
                          autoComplete="current-password"
                          className="h-11 rounded-xl border-border bg-card pl-9 text-sm"
                        />
                      </div>
                      {loginErr && (
                        <p className="text-center text-xs text-red-400">
                          {loginErr}
                        </p>
                      )}
                      <Button
                        type="submit"
                        disabled={loggingIn}
                        className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-violet-600 text-sm font-bold text-white hover:bg-violet-500"
                      >
                        {loggingIn ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <LogIn className="size-4" />
                        )}
                        Masuk
                      </Button>
                    </motion.form>
                  ) : (
                    <motion.div
                      key="register"
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -16 }}
                      transition={{ duration: 0.2 }}
                    >
                      {regStep === 1 && (
                        <form onSubmit={sendOtp} className="space-y-2.5">
                          <div className="relative">
                            <UserPlus className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              value={regEmail}
                              onChange={(e) => setRegEmail(e.target.value)}
                              placeholder="Email untuk daftar"
                              type="email"
                              autoComplete="email"
                              className="h-11 rounded-xl border-border bg-card pl-9 text-sm"
                            />
                          </div>
                          {regErr && (
                            <p className="text-center text-xs text-red-400">
                              {regErr}
                            </p>
                          )}
                          <Button
                            type="submit"
                            disabled={regBusy}
                            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-violet-600 text-sm font-bold text-white hover:bg-violet-500"
                          >
                            {regBusy ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Mail className="size-4" />
                            )}
                            Kirim kode OTP
                          </Button>
                        </form>
                      )}

                      {regStep === 2 && (
                        <form onSubmit={verifyOtp} className="space-y-2.5">
                          <p className="text-center text-[11px] text-muted-foreground">
                            Kode OTP dikirim ke{" "}
                            <span className="font-semibold text-foreground">
                              {regEmail}
                            </span>
                          </p>
                          <div className="relative">
                            <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              value={regCode}
                              onChange={(e) => setRegCode(e.target.value)}
                              placeholder="Kode OTP"
                              inputMode="numeric"
                              autoComplete="one-time-code"
                              className="h-11 rounded-xl border-border bg-card pl-9 text-center text-sm tracking-[0.3em]"
                            />
                          </div>
                          {regErr && (
                            <p className="text-center text-xs text-red-400">
                              {regErr}
                            </p>
                          )}
                          <Button
                            type="submit"
                            disabled={regBusy}
                            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-violet-600 text-sm font-bold text-white hover:bg-violet-500"
                          >
                            {regBusy ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <ShieldCheck className="size-4" />
                            )}
                            Verifikasi OTP
                          </Button>
                          <button
                            type="button"
                            onClick={() => {
                              setRegStep(1);
                              setRegErr(null);
                            }}
                            className="w-full text-center text-[11px] text-muted-foreground hover:text-foreground"
                          >
                            Ganti email
                          </button>
                        </form>
                      )}

                      {regStep === 3 && (
                        <form onSubmit={finishRegister} className="space-y-2.5">
                          <p className="text-center text-[11px] text-muted-foreground">
                            Email terverifikasi. Buat password untuk akunmu.
                          </p>
                          <div className="relative">
                            <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              value={regPass}
                              onChange={(e) => setRegPass(e.target.value)}
                              placeholder="Password baru"
                              type="password"
                              autoComplete="new-password"
                              className="h-11 rounded-xl border-border bg-card pl-9 text-sm"
                            />
                          </div>
                          {regErr && (
                            <p className="text-center text-xs text-red-400">
                              {regErr}
                            </p>
                          )}
                          <Button
                            type="submit"
                            disabled={regBusy}
                            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-violet-600 text-sm font-bold text-white hover:bg-violet-500"
                          >
                            {regBusy ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <UserPlus className="size-4" />
                            )}
                            Register
                          </Button>
                        </form>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* ---- Login dengan Google (beneran, ada UI pilih akun sendiri) ---- */}
              <Button
                onClick={() => setGoogleStep("picker")}
                disabled={loggingIn}
                className="mt-6 flex h-12 w-full max-w-xs items-center justify-center gap-3 rounded-2xl bg-white text-sm font-bold text-black shadow-lg transition hover:bg-white/90 active:scale-[0.98]"
              >
                {loggingIn ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <GoogleIcon />
                )}
                Login dengan Google
              </Button>

              {/* ---- Garis pemisah ---- */}
              <div className="my-6 flex w-full max-w-xs items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  atau
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>

              {/* ---- Opsi login tester ---- */}
              <button
                onClick={() => setTesterOpen((v) => !v)}
                className="flex items-center gap-2 text-xs font-semibold text-zinc-400 transition hover:text-violet-300"
              >
                <Lock className="size-3.5" /> Tester login only
              </button>
              <AnimatePresence>
                {testerOpen && (
                  <motion.form
                    onSubmit={doTesterLogin}
                    className="mt-3 w-full max-w-xs space-y-2.5 overflow-hidden"
                    initial={{ opacity: 0, height: 0, y: -8 }}
                    animate={{ opacity: 1, height: "auto", y: 0 }}
                    exit={{ opacity: 0, height: 0, y: -8 }}
                    transition={{ duration: 0.28, ease: "easeOut" }}
                  >
                    <Input
                      value={testerId}
                      onChange={(e) => setTesterId(e.target.value)}
                      placeholder="ID akun (#1)"
                      className="h-10 rounded-xl border-border bg-card text-center text-sm"
                    />
                    <Input
                      value={testerPass}
                      onChange={(e) => setTesterPass(e.target.value)}
                      placeholder="Password"
                      type="password"
                      className="h-10 rounded-xl border-border bg-card text-center text-sm"
                    />
                    {testerError && (
                      <p className="text-center text-xs text-red-400">
                        {testerError}
                      </p>
                    )}
                    <Button
                      type="submit"
                      disabled={loggingIn}
                      className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-violet-600 text-sm font-bold text-white hover:bg-violet-500"
                    >
                      {loggingIn ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <ShieldCheck className="size-4" />
                      )}
                      Masuk sebagai tester
                    </Button>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>

            {/* ---- Modal: pilih akun Google ---- */}
            <AnimatePresence>
              {googleStep === "picker" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm"
                  onClick={() => setGoogleStep("closed")}
                >
                  <motion.div
                    initial={{ scale: 0.92, y: 16 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.92, y: 16 }}
                    transition={{ type: "spring", stiffness: 260, damping: 22 }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full max-w-sm overflow-hidden rounded-3xl border border-border bg-card shadow-2xl"
                  >
                    <div className="border-b border-border px-5 py-4">
                      <p className="flex items-center gap-2 text-sm font-bold">
                        <GoogleIcon /> Pilih akun
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        untuk melanjutkan ke YoruNime
                      </p>
                    </div>
                    <ul className="max-h-64 overflow-y-auto p-2">
                      {devices
                        .filter((d) => d.type === "google")
                        .map((d) => (
                          <li key={d.email}>
                            <button
                              onClick={() => pickGoogle(d.email)}
                              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-accent"
                            >
                              <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary text-xs font-bold text-muted-foreground">
                                {d.email.charAt(0).toUpperCase()}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[13px] font-semibold">
                                  {d.email.split("@")[0]}
                                </span>
                                <span className="block truncate text-[11px] text-muted-foreground">
                                  {d.email}
                                </span>
                              </span>
                            </button>
                          </li>
                        ))}
                      <li>
                        <div className="flex items-center gap-2 px-3 pt-2">
                          <div className="h-px flex-1 bg-border" />
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            atau pakai akun lain
                          </span>
                          <div className="h-px flex-1 bg-border" />
                        </div>
                      </li>
                      <li className="p-2">
                        <Input
                          value={googleOther}
                          onChange={(e) => setGoogleOther(e.target.value)}
                          placeholder="email@gmail.com"
                          type="email"
                          className="h-10 rounded-xl border-border bg-background text-sm"
                        />
                        <Button
                          onClick={() => {
                            const v = googleOther.trim();
                            if (!v) return;
                            pickGoogle(v);
                            setGoogleOther("");
                          }}
                          className="mt-2 h-10 w-full rounded-xl bg-violet-600 text-sm font-bold text-white hover:bg-violet-500"
                        >
                          Lanjutkan
                        </Button>
                      </li>
                    </ul>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ---- Modal: izin akses (outlined) ---- */}
            <AnimatePresence>
              {googleStep === "consent" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm"
                >
                  <motion.div
                    initial={{ scale: 0.92, y: 16 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.92, y: 16 }}
                    transition={{ type: "spring", stiffness: 260, damping: 22 }}
                    className="w-full max-w-sm overflow-hidden rounded-3xl border border-border bg-card shadow-2xl"
                  >
                    <div className="border-b border-border px-5 py-4">
                      <p className="text-sm font-bold">Izin akses</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        YoruNime ingin mengakses akun Google kamu
                      </p>
                    </div>
                    <div className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-secondary text-sm font-bold text-muted-foreground">
                          {googleEmail.charAt(0).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-semibold">
                            {googleEmail.split("@")[0]}
                          </p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {googleEmail}
                          </p>
                        </div>
                      </div>
                      <ul className="mt-4 space-y-1.5 text-[12px] text-muted-foreground">
                        <li>• Melihat nama & foto profil akun Google kamu</li>
                        <li>• Melihat alamat email utama akun kamu</li>
                        <li>• Menyimpan data login di perangkat ini</li>
                      </ul>
                    </div>
                    <div className="flex gap-2 border-t border-border px-5 py-4">
                      <Button
                        onClick={() => setGoogleStep("picker")}
                        className="h-10 flex-1 rounded-xl border border-border bg-transparent text-sm font-semibold text-foreground hover:bg-accent"
                      >
                        Batal
                      </Button>
                      <Button
                        onClick={allowGoogle}
                        disabled={loggingIn}
                        className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-violet-600 text-sm font-bold text-white hover:bg-violet-500"
                      >
                        {loggingIn ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <ShieldCheck className="size-4" />
                        )}
                        Izinkan
                      </Button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 shrink-0" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 2.18 7.06L5.84 9.9C6.71 7.31 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}

export default function Welcome() {
  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 flex items-center justify-center bg-[#07060c]">
          <Loader2 className="size-6 animate-spin text-violet-400" />
        </div>
      }
    >
      <WelcomeFlow />
    </Suspense>
  );
}
