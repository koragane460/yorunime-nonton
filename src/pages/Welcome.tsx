import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Lock,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { APP_VERSION } from "@/lib/version";
import { Suspense, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";

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
  const [stage, setStage] = useState<"intro" | "notice" | "rules" | "login">("intro");
  const [testerOpen, setTesterOpen] = useState(false);
  const [testerId, setTesterId] = useState("#1");
  const [testerPass, setTesterPass] = useState("");
  const [testerError, setTesterError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  useEffect(() => {
    if (!authLoading && isAuthenticated) navigate("/home", { replace: true });
  }, [authLoading, isAuthenticated, navigate]);

  useEffect(() => {
    if (stage !== "intro") return;
    const t = setTimeout(() => setStage("notice"), 1800);
    return () => clearTimeout(t);
  }, [stage]);

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

  const doLogin = async () => {
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
    await doLogin();
  };

  if (stage === "intro") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-[#07060c]">
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
          className="absolute bottom-14 text-xs text-muted-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.6 }}
        >
          Nonton anime, temukan komunitasmu
        </motion.p>
        <motion.p
          className="absolute bottom-7 text-[10px] tracking-widest text-zinc-500"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1, duration: 0.5 }}
        >
          {APP_VERSION}
        </motion.p>
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
              className="h-full snap-y snap-mandatory overflow-y-auto overscroll-contain"
            >
              <div className="flex min-h-full snap-start flex-col px-5 py-10">
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
              className="h-full snap-y snap-mandatory overflow-y-auto overscroll-contain"
            >
              <div className="flex min-h-full snap-start flex-col px-5 py-10">
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
                        <span className="flex size-4.5 items-center justify-center rounded bg-violet-600/20 text-[9px] font-bold text-violet-400">
                          {i + 1}
                        </span>
                        {title}
                      </p>
                      <p className="mt-0.5 pl-6.5 text-[11px] leading-snug text-muted-foreground">
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
            className="absolute inset-0 flex flex-col items-center justify-center px-8"
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
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
              Yorunime mengharuskan mu untuk login dengan google agar ter-save
              data mu
            </p>

            <Button
              onClick={doLogin}
              disabled={loggingIn}
              className="mt-7 flex h-12 w-full max-w-xs items-center justify-center gap-3 rounded-2xl bg-white text-sm font-bold text-black shadow-lg transition hover:bg-white/90 active:scale-[0.98]"
            >
              {loggingIn ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <GoogleIcon />
              )}
              Login dengan Google
            </Button>

            <div className="my-7 flex w-full max-w-xs items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                atau
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>

            {/* Tombol tester → klik baru muncul kolom (animasi turun) */}
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
                    <p className="text-center text-xs text-red-400">{testerError}</p>
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
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
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
