import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronUp, Loader2, ShieldCheck } from "lucide-react";
import { Suspense, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";

/** Scroll-hint pakai framer-motion: siluet panah + "Gulir ke atas/bawah". */
function ScrollHint({ dir }: { dir: "up" | "down" }) {
  const Icon = dir === "up" ? ChevronUp : ChevronDown;
  const label = dir === "up" ? "Gulir ke atas" : "Gulir ke bawah";
  return (
    <div className="flex flex-col items-center gap-1.5 py-4 text-muted-foreground">
      <motion.div
        animate={{ y: dir === "up" ? [-4, 4, -4] : [4, -4, 4] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
      >
        <Icon className="size-6" />
      </motion.div>
      <span className="text-xs tracking-wide">{label}</span>
    </div>
  );
}

/** Backdrop bintang sederhana — div acak berkelip. */
function Starfield() {
  const stars = useRef(
    Array.from({ length: 40 }, (_, i) => ({
      id: i,
      left: (i * 37 + 13) % 100,
      top: (i * 53 + 29) % 100,
      delay: (i % 10) * 0.4,
      dur: 2.4 + (i % 5) * 0.5,
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
  const [testerId, setTesterId] = useState("#1");
  const [testerPass, setTesterPass] = useState("");
  const [testerError, setTesterError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  // Sudah login → langsung ke home.
  useEffect(() => {
    if (!authLoading && isAuthenticated) navigate("/home", { replace: true });
  }, [authLoading, isAuthenticated, navigate]);

  // Intro animasi "YoruNime" 2.6 detik → screen 1.
  useEffect(() => {
    if (stage !== "intro") return;
    const t = setTimeout(() => setStage("notice"), 2600);
    return () => clearTimeout(t);
  }, [stage]);

  // Screen 1 & 2: progress saat user scroll sampai bawah (atau tekan tombol lompat).
  const noticeRef = useRef<HTMLDivElement>(null);
  const rulesRef = useRef<HTMLDivElement>(null);

  const onScrollProgress = (
    ref: React.RefObject<HTMLDivElement | null>,
    done: () => void,
  ) => {
    const el = ref.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 12) done();
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
          initial={{ opacity: 0, scale: 0.8, filter: "blur(8px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          transition={{ duration: 1.1, ease: "easeOut" }}
        >
          YoruNime
        </motion.h1>
        <motion.p
          className="absolute bottom-16 text-xs text-muted-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.8 }}
        >
          Nonton anime, temukan komunitasmu
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
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -40 }}
            transition={{ duration: 0.35 }}
          >
            <div
              ref={noticeRef}
              onScroll={() =>
                onScrollProgress(noticeRef, () => setStage("rules"))
              }
              className="h-full snap-y snap-mandatory overflow-y-auto overscroll-contain"
            >
              <div className="flex min-h-full snap-start flex-col px-6 py-14">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-violet-400">
                  YoruNime
                </p>
                <h2 className="mt-3 text-3xl font-extrabold leading-tight">
                  Mohon perhatiannya
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Hal-hal penting tentang YoruNime sebelum kamu mulai:
                </p>
                <ol className="mt-6 space-y-3">
                  {[
                    "YoruNime adalah platform streaming anime untuk komunitas.",
                    "Semua progres nonton, XP, dan level tersimpan otomatis di akunmu.",
                    "Kumpulkan diamond & naikkan level lewat aktivitas harian.",
                    "Buat clan atau join clan untuk chat bareng dan donasi berlian.",
                    "Bawakan dirimu dengan sopan — toxic = banned.",
                  ].map((t, i) => (
                    <motion.li
                      key={i}
                      className="flex gap-3 rounded-xl border border-border/70 bg-card/60 p-3.5 text-sm leading-relaxed"
                      initial={{ opacity: 0, x: -16 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.06 }}
                    >
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white">
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
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -40 }}
            transition={{ duration: 0.35 }}
          >
            <div
              ref={rulesRef}
              onScroll={() =>
                onScrollProgress(rulesRef, () => setStage("login"))
              }
              className="h-full snap-y snap-mandatory overflow-y-auto overscroll-contain"
            >
              <div className="flex min-h-full snap-start flex-col px-6 py-14">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-violet-400">
                  Wajib dibaca
                </p>
                <h2 className="mt-3 text-3xl font-extrabold leading-tight">
                  Peraturan YoruNime
                </h2>
                <div className="mt-6 space-y-3">
                  {[
                    ["Dilarang toxic", "Hujat, rasisme, dan ujaran kebencian langsung di-banned permanen."],
                    ["Dilarang spam", "Jangan flood chat global, komentar, atau DM ke user lain."],
                    ["Dilarang share link ilegal", "Link phishing, jualan akun, atau konten 18+ dilarang keras."],
                    ["Hormati sesama", "Beda pendapat boleh, berantam tidak. Clan yang toxic akan dibubarkan."],
                    ["Satu akun per orang", "Akun alt untuk keuntungan event akan dibekukan."],
                    ["Laporkan pelanggaran", "Gunakan tombol lapor pada pesan — moderator siaga 24/7."],
                  ].map(([title, desc], i) => (
                    <motion.div
                      key={i}
                      className="rounded-xl border border-border/70 bg-card/60 p-4"
                      initial={{ opacity: 0, x: -16 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.06 }}
                    >
                      <p className="flex items-center gap-2 text-sm font-semibold">
                        <span className="flex size-5 items-center justify-center rounded bg-violet-600/20 text-[10px] font-bold text-violet-400">
                          {i + 1}
                        </span>
                        {title}
                      </p>
                      <p className="mt-1 pl-7 text-xs leading-relaxed text-muted-foreground">
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
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
          >
            <p className="text-center text-sm font-bold uppercase tracking-wider text-foreground">
              YORUNIME MENGHARUSKAN MU UNTUK LOGIN DENGAN GOOGLE AGAR TER-SAVE
              DATA MU
            </p>
            <Button
              onClick={doLogin}
              disabled={loggingIn}
              className="mt-8 flex h-12 w-full max-w-xs items-center justify-center gap-3 rounded-xl bg-white text-sm font-semibold text-black hover:bg-white/90"
            >
              {loggingIn ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <GoogleIcon />
              )}
              Login dengan Google
            </Button>

            <div className="my-8 flex w-full max-w-xs items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                atau
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <form
              onSubmit={doTesterLogin}
              className="w-full max-w-xs space-y-3"
            >
              <p className="text-center text-xs font-medium text-muted-foreground">
                Login tester
              </p>
              <Input
                value={testerId}
                onChange={(e) => setTesterId(e.target.value)}
                placeholder="ID akun (#1)"
                className="h-10 rounded-lg border-border bg-card text-center"
              />
              <Input
                value={testerPass}
                onChange={(e) => setTesterPass(e.target.value)}
                placeholder="Password"
                type="password"
                className="h-10 rounded-lg border-border bg-card text-center"
              />
              {testerError && (
                <p className="text-center text-xs text-red-400">{testerError}</p>
              )}
              <Button
                type="submit"
                disabled={loggingIn}
                variant="outline"
                className="flex h-10 w-full items-center justify-center gap-2 rounded-lg text-sm"
              >
                {loggingIn ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ShieldCheck className="size-4" />
                )}
                Masuk sebagai tester
              </Button>
            </form>
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
