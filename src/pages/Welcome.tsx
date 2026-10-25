import { useConvexAuth, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/use-auth";
import { GoogleGIcon, SacretIcon } from "@/components/lstream-ui";
import { APP_VERSION, UPDATE_BODY, UPDATE_VERSION } from "@/lib/version";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Ban,
  ChevronLeft,
  ChevronUp,
  Crown,
  Film,
  Flag,
  FlaskConical,
  Heart,
  Info,
  KeyRound,
  Loader2,
  Lock,
  LogIn,
  Mail,
  Megaphone,
  Play,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Users,
  UserX,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Suspense, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { cn } from "@/lib/utils";
import {
  consumeFirebaseRedirect,
  firebaseReady,
  getActiveFirebaseIdToken,
  getFirebaseIdToken,
  signInWithGoogleFirebase,
} from "@/lib/firebase";

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

/**
 * Penanda onboard SELESAI — kunjungan berikutnya langsung loncat ke layar
 * login (tidak mengulang splash + 2 slide perhatian/peraturan). Ini bagian
 * dari redesign logika welcome: alur jadi intro → onboard (sekali saja) →
 * login, dengan tombol eksplisit (bukan auto-advance saat scroll).
 */
const ONBOARD_KEY = "yorunime_onboarded_v1";

function readOnboarded(): boolean {
  try {
    return localStorage.getItem(ONBOARD_KEY) === "1";
  } catch {
    return false;
  }
}

function saveOnboarded() {
  try {
    localStorage.setItem(ONBOARD_KEY, "1");
  } catch {
    /* localStorage diblokir — abaikan */
  }
}

/** Isi slide 1 onboarding — poin penting sebelum mulai. */
const NOTICE_ITEMS: { icon: LucideIcon | typeof SacretIcon; text: string }[] = [
  { icon: Play, text: "YoruNime adalah platform streaming anime untuk komunitas." },
  { icon: Users, text: "Progres nonton, XP, dan level tersimpan otomatis di akunmu." },
  { icon: SacretIcon, text: "Kumpulkan Sacret & naikkan level lewat aktivitas harian." },
  { icon: Crown, text: "Buat clan atau join clan untuk chat bareng & donasi Sacret." },
  { icon: Sparkles, text: "Premium membuka kualitas 1080p, banner, dan fitur lainnya." },
  { icon: Film, text: "Semua episode memakai subtitle bahasa Indonesia." },
  { icon: Heart, text: "Bawakan dirimu dengan sopan — toxic = banned." },
];

/** Isi slide 2 onboarding — peraturan wajib dibaca. */
const RULE_ITEMS: { icon: LucideIcon; title: string; desc: string }[] = [
  { icon: Ban, title: "Dilarang toxic", desc: "Rasisme & ujaran kebencian = banned permanen." },
  { icon: Megaphone, title: "Dilarang spam", desc: "Jangan flood chat global, komentar, atau DM." },
  { icon: Lock, title: "Dilarang link ilegal", desc: "Phishing, jualan akun, konten 18+ dilarang keras." },
  { icon: Heart, title: "Hormati sesama", desc: "Clan yang toxic akan dibubarkan." },
  { icon: UserX, title: "Satu akun per orang", desc: "Akun alt untuk keuntungan event dibekukan." },
  { icon: Flag, title: "Laporkan pelanggaran", desc: "Tombol lapor tersedia di setiap pesan." },
];

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

/** Latar layar pemuatan. */
function Starfield() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Sapuan cahaya diagonal, sangat samar. */}
      <div className="absolute -inset-1/4 bg-[linear-gradient(115deg,transparent_38%,color-mix(in_oklch,var(--primary)_9%,transparent)_50%,transparent_62%)]" />
      {/* Vignette halus supaya tepi tidak mencolok. */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_85%_at_50%_0%,transparent_55%,rgb(0_0_0/0.45))]" />
    </div>
  );
}

function WelcomeFlow() {
  const navigate = useNavigate();
  // Load gate hanya menunggu status sesi (websocket) — tidak perlu ikut
  // menunggu query currentUser, supaya layar tidak lama diam di splash.
  const { isLoading: authLoading, isAuthenticated } = useConvexAuth();
  const { signIn } = useAuth();
  const loginAccount = useMutation(api.authAccounts.loginAccount);
  const registerAccount = useMutation(api.authAccounts.registerAccount);

  // Alur baru: intro (splash) → onboard (2 slide: perhatian & peraturan,
  // HANYA untuk kunjungan pertama) → login. Setelah onboard selesai,
  // kunjungan berikutnya langsung ke login (ada tombol eksplisit, tidak
  // lagi auto-advance saat scroll).
  const [stage, setStage] = useState<"intro" | "onboard" | "entering" | "login">(
    "intro",
  );
  const [onbIdx, setOnbIdx] = useState<0 | 1>(0);
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

  // --- Alur MASUK OTOMATIS (layar login disembunyikan untuk sekarang) ---
  // Setelah onboard / splash, user langsung masuk pakai sesi anonim.
  // Kalau anonymous gagal (koneksi), baruluh jatuh ke layar login manual.
  const enterRanRef = useRef(false);
  // True = status sesi tidak pernah selesai dalam 8 detik (socket macet).
  const [authStalled, setAuthStalled] = useState(false);
  useEffect(() => {
    if (stage !== "entering") {
      setAuthStalled(false);
      enterRanRef.current = false;
      return;
    }
    // Masih loading sesi → beri waktu 8 detik, jangan diam selamanya di
    // layar "Masuk…" kalau socket tidak pernah selesai.
    if (authLoading && !authStalled) {
      const t = window.setTimeout(() => setAuthStalled(true), 8000);
      return () => window.clearTimeout(t);
    }
    if (enterRanRef.current) return;
    if (isAuthenticated) {
      navigate("/home", { replace: true });
      return;
    }
    enterRanRef.current = true;
    void (async () => {
      // Retry singkat: "connection lost" biasanya terjadi saat websocket
      // baru reconnect — coba lagi beberapa kali sebelum menyerah.
      for (let i = 0; i < 3; i++) {
        try {
          await signIn("anonymous");
          navigate("/home", { replace: true });
          return;
        } catch {
          await new Promise((r) => setTimeout(r, 600));
        }
      }
      enterRanRef.current = false;
      setLoginErr("Koneksi bermasalah. Coba masuk manual dulu.");
      setStage("login");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, authLoading, isAuthenticated, authStalled, signIn, navigate]);

  /** Lanjut dari splash — dipanggil otomatis lewat timer ATAU saat user
   *  menekan layar ("Ketuk untuk lanjut"). Kunjungan berikutnya (onboard
   *  sudah pernah selesai) langsung menuju login. */
  const advanceFromIntro = () => {
    // Sudah login & hanya splash balik aplikasi → langsung ke beranda.
    if (reopened && isAuthenticated) {
      navigate("/home", { replace: true });
      return;
    }
    setStage(readOnboarded() ? "entering" : "onboard");
  };

  useEffect(() => {
    if (stage !== "intro") return;
    // Kalau ada update yang belum di-download, tahan di intro dulu.
    if (updatePending) return;
    // Splash singkat: 1,5 detik saat buka pertama, 0,7 detik saat balik dari
    // tab lain. User juga bisa mempercepat dengan menekan layar.
    const t = setTimeout(() => advanceFromIntro(), reopened ? 700 : 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, updatePending, reopened, isAuthenticated]);

  // Sudah login sejak awal → jangan tampilkan welcome sama sekali.
  // CATATAN: early return ini harus SETELAH semua hook di atas — kalau
  // tidak, urutan hook berubah antar render → React error #300.
  if (!authLoading && isAuthenticated && !reopened)
    return <div className="fixed inset-0 z-50 bg-[#07060c]" />;

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

  /** Masuk pakai akun Google (Firebase) → sesi dikirim ke Convex. */
  const doGoogleLogin = async () => {
    setLoggingIn(true);
    setLoginErr(null);
    try {
      const u = await signInWithGoogleFirebase();
      if (!u) {
        setLoginErr(
          firebaseReady
            ? "Popup diblokir browser. Izinkan popup lalu coba lagi."
            : "Login Google belum dikonfigurasi.",
        );
        setLoggingIn(false);
        return;
      }
      const idToken = await getFirebaseIdToken(u);
      if (!idToken) throw new Error("Gagal mengambil sesi Google.");
      await signIn("firebase", { idToken });
      navigate("/home", { replace: true });
    } catch (e) {
      setLoginErr(
        e instanceof Error ? e.message : "Gagal masuk dengan Google.",
      );
      setLoggingIn(false);
    }
  };

  // Balikan dari redirect Google (fallback saat popup diblokir): sesi
  // Firebase sudah aktif — tinggal dicocokkan ke Convex, lalu masuk.
  useEffect(() => {
    let dead = false;
    void (async () => {
      try {
        const hadRedirect = await consumeFirebaseRedirect();
        if (!hadRedirect || dead) return;
        const token = await getActiveFirebaseIdToken();
        if (!token || dead) return;
        await signIn("firebase", { idToken: token });
        if (!dead) navigate("/home", { replace: true });
      } catch {
        /* biarkan — user bisa login manual */
      }
    })();
    return () => {
      dead = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  if (stage === "intro") {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-[#07060c]"
        // Ketuk layar kapan saja untuk langsung lanjut (tanpa menunggu
        // timer) — kecuali kotak update sedang tampil.
        onClick={() => {
          if (!updatePending) advanceFromIntro();
        }}
      >
        <Starfield />
        {/* Dua noda cahaya aurora yang melayang pelan di belakang logo. */}
        <motion.span
          aria-hidden
          className="absolute -left-20 top-10 size-56 rounded-full bg-primary/25 blur-3xl"
          animate={{ y: [0, 26, 0], x: [0, 14, 0] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.span
          aria-hidden
          className="absolute -right-20 bottom-16 size-64 rounded-full bg-sky-500/15 blur-3xl"
          animate={{ y: [0, -22, 0], x: [0, -16, 0] }}
          transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
        />
        {/* Logo dengan cincin glow lembut di belakangnya. */}
        <motion.div
          className="relative mb-7"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <span
            aria-hidden
            className="absolute -inset-4 rounded-[2.8rem] bg-primary/30 blur-2xl"
          />
          <img
            src="/logo-source.jpg"
            alt="YoruNime"
            className="relative size-24 rounded-[2rem] object-cover ring-1 ring-white/15"
          />
        </motion.div>
        <motion.h1
          // Wordmark gradasi emas→putih: elemen dominan layar.
          className="w-full bg-gradient-to-r from-amber-200 via-white to-amber-300 bg-clip-text px-4 text-center font-[family-name:var(--font-display)] text-[clamp(2.25rem,10vw,4.5rem)] font-black leading-[0.9] tracking-[-0.03em] text-transparent"
          initial={{ opacity: 0, y: 10, filter: "blur(14px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        >
          YoruNime
        </motion.h1>
        <motion.div
          aria-hidden
          className="mt-5 h-px w-40 bg-gradient-to-r from-transparent via-primary to-transparent"
          initial={{ opacity: 0, scaleX: 0.2 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ delay: 0.5, duration: 0.7 }}
        />
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

        {/* Petunjuk tap-to-skip — muncul setelah animasi utama selesai. */}
        {!updateAvailable && (
          <motion.button
            type="button"
            onClick={() => advanceFromIntro()}
            className="mt-8 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] font-semibold tracking-wide text-zinc-300 transition hover:border-white/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5, duration: 0.5 }}
          >
            Ketuk untuk lanjut
          </motion.button>
        )}

        {/* Update tersedia → tombol download + changelog dalam kotak scrollable */}
        {updateAvailable && (
          <motion.div
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-x-6 bottom-10"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
          >
            {dlState !== "done" ? (
              <div className="rounded-2xl border border-foreground/40 bg-card/90 p-4">
                <p className="text-center text-xs font-semibold text-primary">
                  Update {UPDATE_VERSION} tersedia
                </p>
                {dlState === "downloading" && (
                  <Progress value={dlPct} className="mt-2 h-1.5" />
                )}
                <button
                  onClick={startDownload}
                  disabled={dlState === "downloading"}
                  className="mt-3 w-full rounded-full bg-primary py-2.5 text-sm font-bold text-white transition hover:bg-primary disabled:opacity-60"
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
                    <ChevronUp className="size-3.5" />
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
        {/* ONBOARD — gabungan layar "Mohon perhatiannya" + "Peraturan" jadi
            satu layar 2 slide dengan indikator titik dan tombol EKSPLISIT
            (Lanjut / Mulai & Masuk / Lewati). Tidak ada lagi auto-advance
            saat scroll; setelah selesai (atau Lewati) tandai onboard selesai
            di localStorage supaya kunjungan berikutnya langsung ke login. */}
        {stage === "onboard" && (
          <motion.section
            key="onboard"
            className="absolute inset-0 flex flex-col"
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -32 }}
            transition={{ duration: 0.28 }}
          >
            {/* Header: indikator slide + tombol Lewati */}
            <div className="flex items-center gap-3 px-5 pb-1 pt-6">
              <div className="flex flex-1 items-center gap-1.5" aria-hidden>
                {[0, 1].map((i) => (
                  <span
                    key={i}
                    className={cn(
                      "h-1.5 rounded-full transition-all duration-300",
                      onbIdx === i ? "w-7 bg-primary" : "w-3 bg-white/15",
                    )}
                  />
                ))}
              </div>
              <button
                onClick={() => {
                  saveOnboarded();
                  setStage("entering");
                }}
                className="rounded-full border border-border bg-card/80 px-3 py-1.5 text-xs text-muted-foreground transition hover:text-foreground"
              >
                Lewati
              </button>
            </div>

            {/* Isi slide — bisa di-scroll, tapi navigasi memakai tombol */}
            <div className="thin-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
              <AnimatePresence mode="wait">
                {onbIdx === 0 ? (
                  <motion.div
                    key="onb-perhatian"
                    initial={{ opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -24 }}
                    transition={{ duration: 0.22 }}
                  >
                    <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-primary">
                      YoruNime
                    </p>
                    <h2 className="mt-2 text-2xl font-extrabold leading-tight">
                      Mohon perhatiannya
                    </h2>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      Hal penting sebelum kamu mulai:
                    </p>
                    {/* Teks panjang kreatif — TANPA kotak background: tiap poin
                        mengalir dengan nomor besar + garis aksen tipis di kiri. */}
                    <ol className="mt-5 space-y-4">
                      {NOTICE_ITEMS.map((t, i) => (
                        <motion.li
                          key={i}
                          className="relative flex items-start gap-3 pl-4"
                          initial={{ opacity: 0, x: -14 }}
                          whileInView={{ opacity: 1, x: 0 }}
                          viewport={{ once: true }}
                          transition={{ delay: i * 0.05 }}
                        >
                          <span
                            className="absolute left-0 top-1 h-[calc(100%-8px)] w-[2px] rounded-full bg-gradient-to-b from-primary via-primary/40 to-transparent"
                            aria-hidden
                          />
                          <span className="mt-0.5 w-5 shrink-0 text-right font-mono text-[11px] font-black text-primary/70">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <span className="min-w-0 flex-1 text-[13px] leading-relaxed text-foreground/85">
                            {t.text}
                          </span>
                        </motion.li>
                      ))}
                    </ol>
                    <div className="h-4 shrink-0" aria-hidden />
                  </motion.div>
                ) : (
                  <motion.div
                    key="onb-peraturan"
                    initial={{ opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -24 }}
                    transition={{ duration: 0.22 }}
                  >
                    <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-primary">
                      Wajib dibaca
                    </p>
                    <h2 className="mt-2 text-2xl font-extrabold leading-tight">
                      Peraturan YoruNime
                    </h2>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      Patuhi aturan ini supaya komunitas tetap nyaman:
                    </p>
                    {/* Peraturan sebagai teks panjang kreatif — judul + deskripsi
                        mengalir, TANPA kotak background, dengan nomor besar. */}
                    <div className="mt-5 space-y-4">
                      {RULE_ITEMS.map((r, i) => (
                        <motion.div
                          key={i}
                          className="relative pl-9"
                          initial={{ opacity: 0, x: -14 }}
                          whileInView={{ opacity: 1, x: 0 }}
                          viewport={{ once: true }}
                          transition={{ delay: i * 0.05 }}
                        >
                          <span
                            className="absolute left-0 top-0 flex size-6 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-[11px] font-black text-primary"
                            aria-hidden
                          >
                            {i + 1}
                          </span>
                          <p className="flex items-center gap-2 text-[14px] font-bold">
                            <r.icon className="size-3.5 shrink-0 text-primary" aria-hidden />
                            {r.title}
                          </p>
                          <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
                            {r.desc}
                          </p>
                        </motion.div>
                      ))}
                    </div>
                    <div className="h-4 shrink-0" aria-hidden />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Tombol bawah: Kembali (slide 2) + Lanjut / Mulai & Masuk */}
            <div className="flex items-center gap-2 border-t border-white/10 bg-background/85 px-5 py-3 backdrop-blur">
              {onbIdx === 1 && (
                <button
                  onClick={() => setOnbIdx(0)}
                  aria-label="Kembali ke slide sebelumnya"
                  className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border text-muted-foreground transition hover:text-foreground"
                >
                  <ChevronLeft className="size-4" />
                </button>
              )}
              <button
                onClick={() => {
                  if (onbIdx === 0) setOnbIdx(1);
                  else {
                    saveOnboarded();
                    setStage("entering");
                  }
                }}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-white transition hover:bg-primary/90 active:scale-[0.98]"
              >
                {onbIdx === 0 ? "Lanjut" : "Mulai & Masuk"}
                <ArrowRight className="size-4" aria-hidden />
              </button>
            </div>
          </motion.section>
        )}

        {stage === "entering" && (
          <motion.section
            key="entering"
            className="absolute inset-0 flex flex-col items-center justify-center gap-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <Loader2 className="size-7 animate-spin text-primary" aria-hidden />
            <p className="text-sm font-semibold text-foreground">Masuk…</p>
            <p className="max-w-[15rem] text-center text-[11px] leading-relaxed text-muted-foreground">
              Menyiapkan akun kamu — bentar ya.
            </p>
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
            {/* Latar imersif khusus layar login: orb gradasi bergerak pelan + bintik berkilau — bukan cuma logo + animasi. */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
              <motion.span
                className="absolute -left-24 top-4 size-72 rounded-full bg-primary/25 blur-3xl"
                animate={{ x: [0, 30, 0], y: [0, 24, 0] }}
                transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
              />
              <motion.span
                className="absolute -right-24 bottom-10 size-72 rounded-full bg-gold/20 blur-3xl"
                animate={{ x: [0, -28, 0], y: [0, -20, 0] }}
                transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
              />
              <span className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.08)_1px,transparent_1.2px)] [background-size:22px_22px] opacity-30" />
            </div>

            <div className="flex min-h-full flex-col items-center justify-center px-7 py-12">
              {/* Logo app dengan glow lembut di belakangnya. */}
              <motion.div
                className="relative"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
              >
                <span
                  aria-hidden
                  className="absolute -inset-3 rounded-3xl bg-primary/30 blur-xl"
                />
                <img
                  src="/logo-source.jpg"
                  alt="YoruNime"
                  className="relative size-16 rounded-2xl object-cover ring-1 ring-white/15"
                />
              </motion.div>
              <h2 className="mt-5 bg-gradient-to-r from-amber-200 via-white to-amber-300 bg-clip-text text-xl font-black tracking-wide text-transparent">
                YoruNime
              </h2>
              <p className="mt-2 max-w-xs text-center text-[11px] font-bold uppercase leading-relaxed tracking-wider text-zinc-300">
                Masuk untuk menyimpan data nonton kamu
              </p>

              {/* Kartu kaca berisi semua pilihan masuk — tab, form — biar rapi dalam satu wadah. */}
              <div className="mt-6 w-full max-w-[22rem] rounded-3xl border border-white/10 bg-card/60 p-5 shadow-[0_16px_48px_-24px_rgba(0,0,0,0.9)] backdrop-blur">
                {/* ---- Tab Login / Register ---- */}
                <div className="flex w-full rounded-2xl border border-border bg-background/50 p-1">
                  {(["login", "register"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => {
                        setMode(m);
                        setLoginErr(null);
                        setRegErr(null);
                      }}
                      className={cn(
                        "flex-1 rounded-xl py-2 text-xs font-bold capitalize transition",
                        mode === m
                          ? "bg-primary text-white shadow"
                          : "text-muted-foreground hover:text-foreground",
                      )}
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
                          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-white hover:bg-primary"
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
                              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-white hover:bg-primary"
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
                              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-white hover:bg-primary"
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
                              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-white hover:bg-primary"
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
              </div>

              <p className="mt-6 text-center text-[10px] text-zinc-500">
                Atau
              </p>

              <div className="mt-3 w-full max-w-[22rem] space-y-2">
                <button
                  onClick={doGoogleLogin}
                  disabled={loggingIn}
                  className="flex h-11 w-full items-center justify-center gap-2.5 rounded-xl bg-white text-sm font-bold text-zinc-900 transition hover:bg-zinc-100 active:scale-[0.98] disabled:opacity-50"
                >
                  <GoogleGIcon className="size-4" />
                  Masuk dengan Google
                </button>
                <button
                  onClick={doAnonLogin}
                  disabled={loggingIn}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-primary/50 bg-primary/15 text-sm font-bold text-primary transition hover:bg-primary/25 active:scale-[0.98] disabled:opacity-50"
                >
                  {loggingIn ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <FlaskConical className="size-4" />
                  )}
                  Login Tester
                </button>
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Welcome() {
  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 flex items-center justify-center bg-[#07060c]">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      }
    >
      <WelcomeFlow />
    </Suspense>
  );
}
