import { api } from "@/convex/_generated/api";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useMutation } from "convex/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { GoogleGIcon, SacretIcon } from "@/components/lstream-ui";
import { APP_VERSION, UPDATE_BODY, UPDATE_VERSION } from "@/lib/version";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Ban,
  ChevronLeft,
  ChevronUp,
  Clock,
  Crown,
  Film,
  Flag,
  FlaskConical,
  Gift,
  Heart,
  Info,
  KeyRound,
  MonitorPlay,
  ShieldUser,
  TrendingUp,
  User,
  Loader2,
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
  Lock,
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
 * dari redesign logika welcome: alur jadi intro → onboard (sekali saja) → login,
 * dengan tombol eksplisit (bukan auto-advance saat scroll).
 */
const ONBOARD_KEY = "yorunime_onboarded_v1";

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

/** Latar layar pemuatan — ruang gelap dengan satu sumber cahaya hangat. */
function Starfield() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(80%_55%_at_50%_30%,rgba(211,62,48,.13),transparent_68%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#0a0b0d,rgba(10,11,13,.2)_40%,#0a0b0d)]" />
      <div className="absolute inset-x-0 top-0 h-px bg-white/8" />
    </div>
  );
}

/** Tiga teks peraturan di layar Disclaimer (tanpa kotak latar). */
const RULE_CARDS = [
  "Dilarang untuk menyebutkan nama merek lain agar tidak terjadi kegaduhan & perselisihan, dan ingat YoruNime adalah aplikasi tidak resmi atau aplikasi pihak ketiga.",
  "Aplikasi ini tidak mengunggah, menyimpan, dan menyalahgunakan konten media. Semua tautan berasal dari sumber publik di media.",
  "Jika merasa konten di YoruNime mempunyai hak cipta, jangan membuat issue untuk hal yang tidak pasti. Hubungi yorunimesupport@gmail.com.",
];

/** Kredensial tester hanya dari environment; jangan pernah hardcode. */
const TESTER_USER = import.meta.env.VITE_TESTER_USER as string | undefined;
const TESTER_PASS = import.meta.env.VITE_TESTER_PASS as string | undefined;
const TESTER_ENABLED = !!TESTER_USER && !!TESTER_PASS;

/**
 * Isi dokumen legal. GANTI teks di sini saat Privacy Policy / Terms of
 * Service sudah siap — modal otomatis menampilkan isi array ini.
 */
const LEGAL_DOCS: Record<"privacy" | "terms", { title: string; body: string[] }> = {
  privacy: {
    title: "Privacy Policy",
    body: [
      "YoruNime menyimpan data akun seperlunya untuk sinkronisasi riwayat nonton, level, dan daftar favorit.",
      "Kami tidak menjual data pengguna ke pihak ketiga.",
      "Kebijakan ini masih dalam penyusunan dan akan diperbarui.",
    ],
  },
  terms: {
    title: "Terms of Service",
    body: [
      "YoruNime adalah aplikasi tidak resmi/pihak ketiga yang menautkan konten dari sumber publik.",
      "Pengguna wajib mengikuti peraturan komunitas dan menghormati hak cipta pemilik konten.",
      "Ketentuan ini masih dalam penyusunan dan akan diperbarui.",
    ],
  },
};

/** Petunjuk scroll beranimasi ke ATAS (tanpa teks). */
function ScrollCue({ onClick }: { onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Lanjut"
      className="mx-auto mt-6 flex w-16 flex-col items-center py-2 transition active:scale-95"
    >
      <motion.span
        className="flex flex-col items-center"
        animate={{ y: [0, -7, 0] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden
      >
        <ChevronUp className="size-5 text-white/30" />
        <ChevronUp className="-mt-2.5 size-5 text-white/85" />
      </motion.span>
    </button>
  );
}

function WelcomeFlow() {
  const navigate = useNavigate();
  // Load gate hanya menunggu status sesi (websocket) — tidak perlu ikut
  // menunggu query currentUser, supaya layar tidak lama diam di splash.
  const { isLoading: authLoading, isAuthenticated } = useConvexAuth();
  const { signIn } = useAuthActions();
  const loginAccount = useMutation(api.authAccounts.loginAccount);
  const registerAccount = useMutation(api.authAccounts.registerAccount);

  // Alur baru: intro (splash) → onboard (2 slide: perhatian & peraturan,
  // HANYA untuk kunjungan pertama) → login. Setelah onboard selesai,
  // kunjungan berikutnya langsung ke login (ada tombol eksplisit, tidak
  // lagi auto-advance saat scroll).
  const [stage, setStage] = useState<"intro" | "onboard" | "entering" | "login">(
    "intro",
  );
  const discRef = useRef<HTMLDivElement | null>(null);
  const loginRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  /** true = langsung geser ke bagian login (mis. percobaan auto-login gagal). */
  const [focusLogin, setFocusLogin] = useState(false);
  const [testerOpen, setTesterOpen] = useState(false);
  const [testerUser, setTesterUser] = useState("");
  const [testerPass, setTesterPass] = useState("");
  const [testerErr, setTesterErr] = useState<string | null>(null);
  const [legalDoc, setLegalDoc] = useState<null | "privacy" | "terms">(null);
  const [loggingIn, setLoggingIn] = useState(false);
  // true = aplikasi baru dibuka kembali (balik dari tab/app lain) → tampilkan
  // layar YoruNime sebentar supaya konten lama tidak kelihatan.
  const [reopened, setReopened] = useState(false);
  const wasHidden = useRef(false);

  // Mode form: login biasa / register email-otp.
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

  // Info akun perangkat (email/Google) yang pernah dipakai di perangkat ini.
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
    if (authLoading || registering) return;
    if (isAuthenticated) {
      if (reopened && stage === "intro") {
        setStage("entering");
        return;
      }
      navigate("/home", { replace: true });
    }
  }, [authLoading, isAuthenticated, navigate, registering, reopened, stage]);

  // --- Masuk otomatis setelah onboard / splash selesai ---
  // Langsung coba signIn("anonymous") begitu masuk tahap entering.
  // Kalau websocket masih loading, beri waktu maksimal agak lama, lalu
  // coba lagi; kalau gagal_total, turun ke layar login manual.
  const enterAttemptRef = useRef(false);
  const [anonErr, setAnonErr] = useState<string | null>(null);
  useEffect(() => {
    if (stage !== "entering") {
      enterAttemptRef.current = false;
      setAnonErr(null);
      return;
    }

    // Tunggu authLoading selesai dulu, tapi jangan diam selamanya.
    if (authLoading) return;
    if (enterAttemptRef.current) return;
    enterAttemptRef.current = true;

    if (isAuthenticated) {
      navigate("/home", { replace: true });
      return;
    }

    let attempts = 0;
    void (async () => {
      while (attempts < 5) {
        attempts += 1;
        try {
          await signIn("anonymous");
          navigate("/home", { replace: true });
          return;
        } catch (e) {
          const msg =
            e instanceof Error ? e.message : "Gagal masuk secara otomatis.";
          if (attempts >= 5) {
            setAnonErr(msg);
            setFocusLogin(true);
            setStage("onboard");
            return;
          }
          await new Promise((r) => setTimeout(r, 700));
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  /** Lanjut dari splash — dipanggil otomatis lewat timer ATAU saat user
   *  menekan layar ("Ketuk untuk lanjut"). Kunjungan berikutnya (onboard
   *  sudah pernah selesai) langsung menuju login. */
  const advanceFromIntro = () => {
    // Sudah login & hanya splash balik aplikasi → langsung ke beranda.
    if (reopened && isAuthenticated) {
      navigate("/home", { replace: true });
      return;
    }
    setStage("onboard");
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

  // Bagian login ada di slide ke-3 pada SATU halaman scroll. Jangan pernah
  // auto-scroll hanya karena user sudah pernah onboard — welcome harus selalu
  // mulai dari slide pertama. Scroll ke login hanya saat memang diminta
  // (mis. percobaan auto-login gagal).
  useEffect(() => {
    if (stage !== "onboard" || !focusLogin) return;
    const t = setTimeout(() => {
      loginRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
    }, 120);
    return () => clearTimeout(t);
  }, [stage, focusLogin]);

  // Selalu mulai dari Welcome slide 1 saat layar onboard dibuka. Ini juga
  // menetralkan scroll restoration browser yang dulu bisa langsung
  // menaruh user di bagian login.
  useEffect(() => {
    if (stage !== "onboard" || focusLogin) return;
    const t = window.setTimeout(() => {
      scrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
    }, 0);
    return () => window.clearTimeout(t);
  }, [stage, focusLogin]);

  /** Tandai onboard selesai begitu user sudah masuk area login. */
  const handleOnboardScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollTop > el.clientHeight * 1.4) saveOnboarded();
  };

  // Sudah login sejak awal → jangan tampilkan welcome sama sekali.
  // CATATAN: early return ini harus SETELAH semua hook di atas — kalau
  // tidak, urutan hook berubah antar render → React error #300.
  if (!authLoading && isAuthenticated && !reopened)
    return <div className="fixed inset-0 z-50 bg-[#07060c]" />;

  /** Masuk sesi + ke beranda. */
  const doAnonLogin = async () => {
    setLoggingIn(true);
    setLoginErr(null);
    try {
      await signIn("anonymous");
      navigate("/home", { replace: true });
    } catch (e) {
      setLoginErr(e instanceof Error ? e.message : "Gagal masuk. Coba lagi.");
      setLoggingIn(false);
    }
  };

  /** Tester: cek username/password dulu, baru buat sesi. */
  const doTesterLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (
      !TESTER_ENABLED ||
      testerUser.trim() !== TESTER_USER ||
      testerPass !== TESTER_PASS
    ) {
      setTesterErr("Username atau password tester salah.");
      return;
    }
    setTesterErr(null);
    setTesterOpen(false);
    saveOnboarded();
    await doAnonLogin();
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
        className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-[#0a0b0d]"
        // Ketuk layar kapan saja untuk langsung lanjut (tanpa menunggu
        // timer) — kecuali kotak update sedang tampil.
        onClick={() => {
          if (!updatePending) advanceFromIntro();
        }}
      >
        <Starfield />
        <div className="relative flex w-full flex-col items-center px-6">
          <motion.div
            className="relative"
            initial={{ opacity: 0, scale: 0.94, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <img
              src="/logo-512.png"
              alt="YoruNime"
              className="relative size-28 rounded-[1.8rem] object-cover shadow-[0_24px_54px_-30px_rgba(0,0,0,.95)] ring-1 ring-white/12"
            />
          </motion.div>

          <motion.h1
            className="mt-9 font-[family-name:var(--font-display)] text-[clamp(2.8rem,12vw,4.4rem)] font-black leading-none tracking-[-0.055em] text-white"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.7, ease: "easeOut" }}
          >
            Yoru<span className="text-[var(--primary)]">Nime</span>
          </motion.h1>
          <motion.p
            className="mt-3 text-center text-[12.5px] font-medium leading-relaxed text-white/45"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.36, duration: 0.6 }}
          >
            Anime, donghua, film, dan bacaan. Satu tempat.
          </motion.p>

          <motion.div
            className="mt-10 h-1 w-44 overflow-hidden rounded-full bg-white/[0.08]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.4 }}
          >
            <motion.span
              className="block h-full rounded-full bg-[var(--primary)]"
              initial={{ width: "8%" }}
              animate={{ width: ["8%", "92%", "100%"] }}
              transition={{ duration: 1.45, times: [0, 0.78, 1], ease: "easeInOut" }}
            />
          </motion.div>
          <p className="mt-3 text-[9px] font-semibold uppercase tracking-[0.24em] text-white/25">
            Menyiapkan pengalaman menonton
          </p>
        </div>

        <motion.p
          className="absolute bottom-7 text-[9px] tracking-[0.22em] text-white/20"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9, duration: 0.5 }}
        >
          {APP_VERSION}
        </motion.p>

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
            <div
              ref={scrollRef}
              onScroll={handleOnboardScroll}
              className="thin-scroll h-full snap-y snap-mandatory scroll-smooth overflow-y-auto overscroll-contain px-5"
            >
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
              >
                {/* ================= SLIDE 1 — WELCOME ================= */}
                <section className="relative flex min-h-[100svh] snap-start flex-col pb-8 pt-6 [scroll-snap-stop:always]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <img
                        src="/logo-512.png"
                        alt=""
                        className="size-8 rounded-lg object-cover ring-1 ring-white/10"
                      />
                      <span className="font-display text-[14px] font-bold tracking-[-0.03em]">
                        Yoru<span className="text-[var(--primary)]">Nime</span>
                      </span>
                    </div>
                    <span className="font-mono text-[8px] tracking-[0.1em] text-white/22">
                      {APP_VERSION}
                    </span>
                  </div>

                  <div className="flex flex-1 flex-col justify-center pb-10">
                    <p className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-white/38">
                      <span className="font-serif text-[16px] font-normal leading-none tracking-normal text-[var(--primary)]">
                        /
                      </span>
                      Streaming komunitas
                    </p>
                    <h1 className="mt-4 font-serif text-[clamp(3.4rem,15vw,4.4rem)] leading-[0.92] tracking-[-0.035em] text-white">
                      Malam
                      <br />
                      belum <em className="text-[var(--primary)]">selesai.</em>
                    </h1>
                    <p className="mt-5 max-w-[20rem] text-[12px] font-medium leading-[1.7] text-white/42">
                      Anime, donghua, film, manga, dan manhwa dalam satu
                      aplikasi. Subtitle Indonesia, tanpa biaya.
                    </p>
                    <div className="mt-7 flex flex-wrap gap-1.5">
                      {["Sub Indo", "Gratis", "Unduh offline"].map((t) => (
                        <span
                          key={t}
                          className="rounded-md border border-white/8 bg-white/[0.03] px-2.5 py-1 text-[9px] font-semibold text-white/48"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                    <button
                      onClick={() =>
                        discRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
                      }
                      className="mt-8 flex h-11 w-full max-w-[19rem] items-center justify-center gap-2 rounded-xl bg-[var(--primary)] text-[11.5px] font-bold text-white transition active:scale-[0.985]"
                    >
                      Mulai jelajahi <ArrowRight className="size-4" />
                    </button>
                  </div>

                  <ScrollCue
                    onClick={() =>
                      discRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
                    }
                  />
                </section>

                {/* ================= SLIDE 2 — DISCLAIMER ================= */}
                <section
                  ref={discRef}
                  className="relative flex min-h-[100svh] snap-start flex-col pb-6 pt-5 [scroll-snap-stop:always]"
                >
                  <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-white/22">
                    Sebelum masuk
                  </p>
                  <div className="flex flex-1 flex-col justify-center py-8">
                    <h2 className="font-serif text-[2.7rem] leading-[0.95] tracking-[-0.03em] text-white">
                      Baca ini
                      <br />
                      <em className="text-[var(--primary)]">dulu.</em>
                    </h2>
                    <p className="mt-3 max-w-[20rem] text-[11px] leading-relaxed text-white/35">
                      Tiga hal yang perlu kamu tahu tentang YoruNime dan cara
                      kami menampilkan konten.
                    </p>
                    <div className="mt-6 divide-y divide-white/7 border-y border-white/7">
                      {RULE_CARDS.map((text, i) => (
                        <div key={i} className="flex gap-3 py-4">
                          <span className="w-6 shrink-0 font-mono text-[10px] font-bold text-[rgba(211,62,48,.72)]">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <p className="text-[11px] leading-[1.65] text-white/46">
                            {text}
                          </p>
                        </div>
                      ))}
                    </div>
                    <p className="mt-5 text-[9px] leading-relaxed text-white/24">
                      Dengan lanjut, kamu memahami bahwa YoruNime adalah
                      aplikasi pihak ketiga dan bukan pemilik konten.
                    </p>
                  </div>
                  <ScrollCue
                    onClick={() =>
                      loginRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
                    }
                  />
                </section>

                {/* ================= SLIDE 3 — LOGIN ================= */}
                <section
                  ref={loginRef}
                  className="relative flex min-h-[100svh] snap-start flex-col pb-8 pt-5 [scroll-snap-stop:always]"
                >
                  <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-white/22">
                    Akun YoruNime
                  </p>
                  <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-end pb-2 pt-10">
                    <div className="mb-7">
                      <p className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-white/38">
                        <span className="font-serif text-[16px] font-normal leading-none tracking-normal text-[var(--primary)]">
                          /
                        </span>
                        Satu akun, semua layar
                      </p>
                      <h2 className="mt-3 font-serif text-[clamp(2.5rem,11vw,3.3rem)] leading-[0.95] tracking-[-0.03em] text-white">
                        Lanjutkan dari
                        <br />
                        <em className="text-[var(--primary)]">tempat berhenti.</em>
                      </h2>
                      <p className="mt-3 max-w-[21rem] text-[11px] leading-[1.7] text-white/38">
                        Masuk agar riwayat nonton, level, favorit, dan antrean
                        bacaanmu tersimpan di semua perangkat.
                      </p>

                      <div className="mt-5 grid grid-cols-3 divide-x divide-white/7 border-y border-white/7 py-3">
                        {[
                          [Clock, "Riwayat"],
                          [TrendingUp, "Level"],
                          [Heart, "Favorit"],
                        ].map(([Icon, label]) => {
                          const I = Icon as LucideIcon;
                          return (
                            <div
                              key={label as string}
                              className="flex flex-col items-center gap-1.5 text-[8.5px] font-semibold text-white/32"
                            >
                              <I className="size-4 text-white/50" />
                              {label as string}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Login Google */}
                    <button
                      onClick={doGoogleLogin}
                      disabled={loggingIn}
                      className="flex h-[52px] w-full items-center gap-3 rounded-xl bg-[#f5f0e8] px-3 text-left transition hover:brightness-95 active:scale-[0.99] disabled:opacity-60"
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white">
                        <GoogleGIcon className="size-5" />
                      </span>
                      <span className="flex-1 text-[11.5px] font-bold text-[#15171a]">
                        Masuk dengan Google
                      </span>
                      <ArrowRight className="size-4 text-[#15171a]/35" />
                    </button>

                    <div className="my-3 flex items-center gap-3">
                      <span className="h-px flex-1 bg-white/30" />
                      <span className="text-[9.5px] font-black tracking-[0.22em] text-white/30">
                        ATAU
                      </span>
                      <span className="h-px flex-1 bg-white/30" />
                    </div>

                    {/* Tester — hanya muncul bila kredensial env tersedia. */}
                    {TESTER_ENABLED && (
                      <button
                        onClick={() => {
                          setTesterErr(null);
                          setTesterOpen(true);
                        }}
                        className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-white/8 bg-[#121417] px-3.5 transition active:scale-[0.99]"
                      >
                        <ShieldUser className="size-5 shrink-0 text-[var(--yn-mint)]" />
                        <span className="text-[10.5px] font-bold text-white/62">
                          Tester Login Only
                        </span>
                      </button>
                    )}

                    <div className="mt-4 text-center text-[8.5px] leading-relaxed text-white/24">
                      <p>Dengan masuk, kamu menyetujui</p>
                      <div className="mt-1 flex flex-wrap items-center justify-center gap-x-1">
                        <button
                          onClick={() => setLegalDoc("privacy")}
                          className="font-semibold text-white/45 underline decoration-white/15 underline-offset-2 hover:text-white/70"
                        >
                          Kebijakan Privasi
                        </button>
                        <span className="text-white/16">&amp;</span>
                        <button
                          onClick={() => setLegalDoc("terms")}
                          className="font-semibold text-white/45 underline decoration-white/15 underline-offset-2 hover:text-white/70"
                        >
                          Ketentuan Layanan
                        </button>
                      </div>
                    </div>

                    {(loginErr || anonErr) && (
                      <p className="mt-2 text-center text-[10.5px] font-semibold text-red-400">
                        {loginErr ?? anonErr}
                      </p>
                    )}
                  </div>
                </section>
              </motion.div>
            </div>

            {/* Modal Tester Login */}
            <AnimatePresence>
              {testerOpen && (
                <motion.div
                  key="tester"
                  className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-5 backdrop-blur-sm"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setTesterOpen(false)}
                >
                  <motion.form
                    onSubmit={doTesterLogin}
                    onClick={(e) => e.stopPropagation()}
                    initial={{ opacity: 0, scale: 0.94, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    className="w-full max-w-sm rounded-3xl border border-white/12 bg-[#0c1017] p-5 shadow-2xl"
                  >
                    <div className="flex items-start justify-between">
                      <span className="size-6" />
                      <User className="size-8 text-white" />
                      <button
                        type="button"
                        onClick={() => setTesterOpen(false)}
                        aria-label="Tutup"
                        className="text-white/50 transition hover:text-white"
                      >
                        <X className="size-5" />
                      </button>
                    </div>
                    <h3 className="mt-2 text-center text-lg font-black text-white">
                      Tester Login
                    </h3>
                    <div className="mt-4 space-y-2.5">
                      <Input
                        value={testerUser}
                        onChange={(e) => setTesterUser(e.target.value)}
                        placeholder="Username Tester"
                        autoComplete="username"
                        className="h-11 rounded-xl border-white/10 bg-white/[0.05] text-sm text-white"
                      />
                      <Input
                        value={testerPass}
                        onChange={(e) => setTesterPass(e.target.value)}
                        placeholder="Password Tester"
                        type="password"
                        autoComplete="current-password"
                        className="h-11 rounded-xl border-white/10 bg-white/[0.05] text-sm text-white"
                      />
                    </div>
                    {testerErr && (
                      <p className="mt-2 text-[11px] font-semibold text-red-400">
                        {testerErr}
                      </p>
                    )}
                    <div className="mt-3 flex justify-end">
                      <Button
                        type="submit"
                        disabled={loggingIn}
                        className="h-9 rounded-xl px-4 text-xs font-black"
                      >
                        {loggingIn ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          "Login"
                        )}
                      </Button>
                    </div>
                  </motion.form>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Modal Privacy Policy / Terms of Service */}
            <AnimatePresence>
              {legalDoc && (
                <motion.div
                  key="legal"
                  className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-5 backdrop-blur-sm"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setLegalDoc(null)}
                >
                  <motion.div
                    onClick={(e) => e.stopPropagation()}
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    className="w-full max-w-md rounded-3xl border border-white/12 bg-[#0c1017] p-5 shadow-2xl"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-black text-white">
                        {LEGAL_DOCS[legalDoc].title}
                      </h3>
                      <button
                        onClick={() => setLegalDoc(null)}
                        aria-label="Tutup"
                        className="text-white/50 transition hover:text-white"
                      >
                        <X className="size-5" />
                      </button>
                    </div>
                    <div className="thin-scroll mt-3 max-h-[55vh] space-y-2.5 overflow-y-auto pr-1">
                      {LEGAL_DOCS[legalDoc].body.map((p, i) => (
                        <p
                          key={i}
                          className="text-[11.5px] leading-relaxed text-white/55"
                        >
                          {p}
                        </p>
                      ))}
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
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
            <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
              <div className="absolute inset-0 bg-[radial-gradient(70%_50%_at_50%_0%,rgba(211,62,48,.08),transparent_62%)]" />
            </div>

            <div className="relative flex min-h-full flex-col items-center justify-center px-6 py-12">
              <img
                src="/logo-512.png"
                alt="YoruNime"
                className="size-14 rounded-xl object-cover ring-1 ring-white/10"
              />
              <p className="mt-4 flex items-center gap-1.5 text-[8.5px] font-bold uppercase tracking-[0.16em] text-white/32">
                <span className="font-serif text-[15px] font-normal leading-none tracking-normal text-[var(--primary)]">
                  /
                </span>
                Akun YoruNime
              </p>
              <h2 className="mt-2 font-display text-[24px] font-bold tracking-[-0.04em]">
                Selamat datang kembali
              </h2>
              <p className="mt-1 max-w-xs text-center text-[10px] leading-relaxed text-white/30">
                Masuk untuk melanjutkan riwayat dan progresmu.
              </p>

              <div className="mt-5 w-full max-w-[22rem] rounded-xl border border-white/8 bg-[#101215] p-4">
                <div className="flex w-full rounded-lg border border-white/8 bg-[#0a0b0d] p-1">
                  {(["login", "register"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => {
                        setMode(m);
                        setLoginErr(null);
                        setRegErr(null);
                      }}
                      className={cn(
                        "flex-1 rounded-md py-2 text-[10.5px] font-bold capitalize transition",
                        mode === m
                          ? "bg-[#252a30] text-white"
                          : "text-white/34 hover:text-white/70",
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

              <p className="mt-4 text-center text-[8px] font-semibold uppercase tracking-[0.16em] text-white/20">
                atau
              </p>

              <div className="mt-2 w-full max-w-[22rem] space-y-2">
                <button
                  onClick={doGoogleLogin}
                  disabled={loggingIn}
                  className="flex h-11 w-full items-center justify-center gap-2.5 rounded-lg bg-[#f5f0e8] text-[11px] font-bold text-[#15171a] transition hover:brightness-95 active:scale-[0.98] disabled:opacity-50"
                >
                  <GoogleGIcon className="size-4" />
                  Masuk dengan Google
                </button>
                <button
                  onClick={doAnonLogin}
                  disabled={loggingIn}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-white/8 bg-[#121417] text-[10.5px] font-bold text-white/52 transition hover:text-white active:scale-[0.98] disabled:opacity-50"
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
        <div className="fixed inset-0 flex items-center justify-center bg-[#0a0b0d]">
          <Loader2 className="size-5 animate-spin text-[var(--primary)]" />
        </div>
      }
    >
      <WelcomeFlow />
    </Suspense>
  );
}
