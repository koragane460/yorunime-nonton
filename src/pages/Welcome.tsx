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

/** Latar layar pemuatan — malam berbintang yang tenang, bukan gradient neon. */
function Starfield() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(90%_65%_at_50%_38%,rgba(108,76,180,.28),transparent_62%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,.52)_1px,transparent_1.35px)] opacity-45 [background-size:38px_38px] [mask-image:radial-gradient(75%_65%_at_50%_45%,#000_18%,transparent_78%)]" />
      <motion.span
        className="absolute left-[14%] top-[22%] size-1 rounded-full bg-white/70"
        animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.3, 0.8] }}
        transition={{ duration: 3.8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.span
        className="absolute right-[18%] top-[30%] size-1.5 rounded-full bg-[#b9a7ff]/80"
        animate={{ opacity: [0.35, 1, 0.35], y: [0, -4, 0] }}
        transition={{ duration: 4.6, repeat: Infinity, ease: "easeInOut", delay: 0.7 }}
      />
      <motion.span
        className="absolute left-[24%] bottom-[34%] size-1 rounded-full bg-[#7fd3f7]/90"
        animate={{ opacity: [0.25, 0.9, 0.25] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut", delay: 1.2 }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,5,12,.18),transparent_32%,rgba(5,5,12,.5)_100%)]" />
    </div>
  );
}

/** Tiga teks peraturan di layar Disclaimer (tanpa kotak latar). */
const RULE_CARDS = [
  "Dilarang untuk menyebutkan nama merek lain agar tidak terjadi kegaduhan & perselisihan, dan ingat YoruNime adalah aplikasi tidak resmi atau aplikasi pihak ketiga.",
  "Aplikasi ini tidak mengunggah, menyimpan, dan menyalahgunakan konten media. Semua tautan berasal dari sumber publik di media.",
  "Jika merasa konten di YoruNime mempunyai hak cipta, jangan membuat issue untuk hal yang tidak pasti. Hubungi yorunimesupport@gmail.com.",
];

/** Kredensial akun tester (sama dengan halaman login lama). */
const TESTER_USER = "Tester YoruNime";
const TESTER_PASS = "yttaajadeh";

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
    if (testerUser.trim() !== TESTER_USER || testerPass !== TESTER_PASS) {
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
        className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-[#07060c]"
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
            initial={{ opacity: 0, scale: 0.86, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
          >
            <span aria-hidden className="absolute -inset-10 rounded-full bg-[#8b6cff]/15 blur-3xl" />
            <span aria-hidden className="absolute -inset-4 rounded-full border border-white/10" />
            <motion.span
              aria-hidden
              className="absolute -inset-7 rounded-full border border-dashed border-[#c4b5fd]/25"
              animate={{ rotate: 360 }}
              transition={{ duration: 32, repeat: Infinity, ease: "linear" }}
            />
            <img
              src="/logo-512.png"
              alt="YoruNime"
              className="relative size-40 rounded-[2.6rem] object-cover shadow-[0_30px_70px_-34px_rgba(0,0,0,.95)] ring-1 ring-white/15"
            />
          </motion.div>

          <motion.h1
            className="mt-9 font-[family-name:var(--font-display)] text-[clamp(2.8rem,12vw,4.4rem)] font-black leading-none tracking-[-0.055em] text-white"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.7, ease: "easeOut" }}
          >
            Yoru<span className="text-[#b9a7ff]">Nime</span>
          </motion.h1>
          <motion.p
            className="mt-3 text-center text-[12.5px] font-medium leading-relaxed text-white/45"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.36, duration: 0.6 }}
          >
            Nonton anime sub Indo, tanpa iklan.
          </motion.p>

          <motion.div
            className="mt-10 h-1 w-44 overflow-hidden rounded-full bg-white/[0.08]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.4 }}
          >
            <motion.span
              className="block h-full rounded-full bg-[linear-gradient(90deg,#8b6cff,#c4b5fd,#FFD23F)]"
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
                <section className="relative flex min-h-[100svh] snap-start flex-col pb-6 pt-5 [scroll-snap-stop:always]">
                  <p className="text-center text-[10px] font-bold tracking-[0.2em] text-white/55">
                    {APP_VERSION}.0 (1)
                  </p>
                  <div className="flex flex-1 flex-col items-center justify-center text-center">
                    <h1 className="yn-fredoka flex w-full items-center justify-center whitespace-nowrap text-[clamp(3.2rem,15vw,6.4rem)] uppercase leading-none text-white">
                      {/* W dengan celah slash di batang kiri — sama seperti
                          wordmark di referensi terakhir. */}
                      <span className="relative inline-block">
                        W
                        <span
                          aria-hidden
                          className="absolute left-[17%] top-[-6%] h-[112%] w-[7%] -rotate-[15deg] bg-background"
                        />
                      </span>
                      ELCOME
                    </h1>
                    <p className="mt-4 max-w-[21rem] text-[14.5px] font-semibold leading-snug text-white/40">
                      Aplikasi nonton anime, donghua &amp; film
                      <br />
                      baca manga &amp; manhwa
                    </p>
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
                  <p className="text-center text-[10px] font-bold tracking-[0.2em] text-white/55">
                    {APP_VERSION}.0 (1)
                  </p>
                  <div className="flex flex-1 flex-col justify-center py-8">
                    <h2 className="yn-fredoka text-[2.6rem] leading-none text-white underline decoration-white/35 decoration-[3px] underline-offset-[10px]">
                      Disclaimer
                    </h2>
                    <div className="mt-7 space-y-5">
                      {RULE_CARDS.map((text, i) => (
                        <div key={i}>
                          <p className="text-[15px] font-black tracking-tight text-[#1CA7EC]">
                            | Peraturan #{i + 1}
                          </p>
                          <p className="mt-1.5 text-[12px] leading-relaxed text-white/40">
                            {text}
                          </p>
                        </div>
                      ))}
                    </div>
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
                  <p className="text-center text-[10px] font-bold tracking-[0.2em] text-white/55">
                    {APP_VERSION}.0 (1)
                  </p>
                  <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-end pb-2 pt-10">
                    {/* Hanya judul, subteks, dan 4 kotak ini yang digeser
                        sedikit ke atas — tombol login tetap di tempat. */}
                    <div className="relative -top-20">
                    <h2 className="yn-fredoka text-center text-[clamp(2.7rem,12vw,3.8rem)] leading-none">
                      <span className="text-white">SIAP </span>
                      {/* 4 warna kuning konsisten untuk "MULAI?". */}
                      <span className="bg-[linear-gradient(90deg,#FFF6C7_0%,#FFE066_38%,#FFC93C_68%,#F59E0B_100%)] bg-clip-text text-transparent">
                        MULAI?
                      </span>
                    </h2>
                    <p className="mt-2 text-center text-[11.5px] leading-snug text-white/45">
                      YoruNime mewajibkan mu login dengan google untuk
                      sinkronisasi riwayat nonton, level akun, dan list favorite
                      mu.
                    </p>

                    {/* 4 kotak fitur — selebar tombol login, 2x2. */}
                    <div className="mt-3 grid w-full grid-cols-2 gap-2">
                      {[
                        { icon: MonitorPlay, label: "1080p Kualitas", free: false },
                        { icon: Users, label: "Komunitas", free: false },
                        { icon: TrendingUp, label: "Leveling", free: false },
                        { icon: Gift, label: "FREE", free: true },
                      ].map(({ icon: Icon, label, free }) => (
                        <div
                          key={label}
                          className={cn(
                            "flex min-h-11 items-center gap-2 rounded-xl px-2.5 py-2",
                            free
                              ? "bg-[#FFD23F] text-[#241c02]"
                              : "border border-white/10 bg-white/[0.04] text-white",
                          )}
                        >
                          <Icon
                            className={cn(
                              "size-4 shrink-0",
                              free ? "text-[#241c02]" : "text-[#1CA7EC]",
                            )}
                          />
                          <span className="text-[10.5px] font-black leading-tight">
                            {label}
                          </span>
                        </div>
                      ))}
                    </div>
                    </div>

                    {/* Login Google */}
                    <button
                      onClick={doGoogleLogin}
                      disabled={loggingIn}
                      className="mt-9 flex h-14 w-full items-center gap-3 rounded-2xl bg-white px-3 text-left transition active:scale-[0.99] disabled:opacity-60"
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white">
                        <GoogleGIcon className="size-6" />
                      </span>
                      <span className="flex-1 text-[12px] font-black text-zinc-900">
                        Tekan Disini Untuk Login
                      </span>
                      <ArrowRight className="size-5 text-zinc-900/35" />
                    </button>

                    <div className="my-3 flex items-center gap-3">
                      <span className="h-px flex-1 bg-white/30" />
                      <span className="text-[9.5px] font-black tracking-[0.22em] text-white/30">
                        ATAU
                      </span>
                      <span className="h-px flex-1 bg-white/30" />
                    </div>

                    {/* Tester */}
                    <button
                      onClick={() => {
                        setTesterErr(null);
                        setTesterOpen(true);
                      }}
                      className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-white/12 bg-white/[0.05] px-3.5 py-3 transition active:scale-[0.99]"
                    >
                      <ShieldUser className="size-6 shrink-0 text-[#1CA7EC]" />
                      <span className="text-[12px] font-black text-white">
                        Tester Login Only
                      </span>
                    </button>

                    <div className="mt-3 text-center text-[9.5px] leading-relaxed text-white/40">
                      <p>Dengan melakukan login maka kamu telah setuju dengan</p>
                      {/* Kedua dokumen dalam satu baris. */}
                      <div className="mt-1 flex flex-wrap items-center justify-center gap-x-1">
                        <button
                          onClick={() => setLegalDoc("privacy")}
                          className="font-bold text-[#1CA7EC]"
                        >
                          Privacy Policy
                        </button>
                        <span className="text-white/35">&amp;</span>
                        <button
                          onClick={() => setLegalDoc("terms")}
                          className="font-bold text-[#1CA7EC]"
                        >
                          Terms of Service
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
              <h2 className="mt-5 bg-gradient-to-r from-amber-200 via-white to-amber-300 bg-clip-text text-xl text-transparent yn-title">
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

              <p className="mt-5 text-center text-[10px] text-zinc-500">
                Atau
              </p>

              <div className="mt-2 w-full max-w-[22rem] space-y-2">
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
