import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useAuth } from "@/hooks/use-auth";
import {
  consumeFirebaseRedirect,
  firebaseReady,
  getActiveFirebaseIdToken,
  getFirebaseIdToken,
  signInWithGoogleFirebase,
} from "@/lib/firebase";
import logo from "@/assets/logo.svg";
import { ArrowRight, Eye, EyeOff, Loader2, Mail } from "lucide-react";
import { cn } from "@/lib/utils";

interface AuthProps {
  redirectAfterAuth?: string;
}

function resolveRedirectAfterAuth(returnTo: string | null, fallback = "/home") {
  if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) return returnTo;
  return fallback;
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 shrink-0" aria-hidden>
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

type Mode = "main" | "password" | "otp";

export default function AuthPage({ redirectAfterAuth }: AuthProps = {}) {
  const { isLoading: authLoading, isAuthenticated, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = resolveRedirectAfterAuth(
    searchParams.get("returnTo"),
    redirectAfterAuth,
  );

  const [mode, setMode] = useState<Mode>("main");
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && isAuthenticated) navigate(redirect, { replace: true });
  }, [authLoading, isAuthenticated, navigate, redirect]);

  // Balik dari redirect Google (cadangan kalau popup diblokir).
  useEffect(() => {
    if (isLoading || isAuthenticated || !firebaseReady) return;
    let cancelled = false;
    void (async () => {
      const cameBack = await consumeFirebaseRedirect();
      if (!cameBack || cancelled) return;
      const idToken = await getActiveFirebaseIdToken();
      if (!idToken || cancelled) return;
      setIsLoading(true);
      try {
        await signIn("firebase", { idToken });
        navigate(redirect, { replace: true });
      } catch {
        setError("Gagal masuk dengan Google. Coba lagi.");
        setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, isAuthenticated]);

  // ------------------------------------------------------------- Google ----
  const handleGoogle = async () => {
    setError(null);
    if (!firebaseReady) {
      setError(
        "Firebase belum dikonfigurasi. Isi dulu VITE_FIREBASE_API_KEY, AUTH_DOMAIN, dan PROJECT_ID di tab Keys.",
      );
      return;
    }
    setIsLoading(true);
    try {
      const fbUser = await signInWithGoogleFirebase();
      // Popup Firebase yang menangani pilih akun & izinnya — tidak ada layar
      // tambahan dari kita, dan user tetap di halaman YoruNime.
      if (!fbUser) {
        // Popup gagal dibuka: browser sudah diarahkan ke halaman Google.
        setIsLoading(false);
        return;
      }
      const idToken = await getFirebaseIdToken(fbUser);
      if (!idToken) throw new Error("Gagal mengambil token Firebase");
      await signIn("firebase", { idToken });
      navigate(redirect, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal masuk dengan Google.");
      setIsLoading(false);
    }
  };

  // ------------------------------------------------- Email + password ----
  const emailOk = /^\S+@\S+\.\S+$/.test(email.trim());
  const passOk = password.length >= 8;
  const confirmOk = !isRegister || confirm === password;
  const canSubmitPassword = emailOk && passOk && confirmOk && (!isRegister || name.trim().length >= 2);

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmitPassword) {
      setError(
        isRegister
          ? "Lengkapi nama, email, dan password (minimal 8 karakter). Ulangi password harus sama."
          : "Isi email dan password (minimal 8 karakter).",
      );
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      if (isRegister) {
        // Akun baru hanya dibuat di sini — setelah semua kolom terisi.
        await signUp({
          email: email.trim(),
          password,
          name: name.trim(),
        });
      } else {
        await signIn("password", {
          email: email.trim(),
          password,
          flow: "signIn",
        });
      }
      navigate(redirect, { replace: true });
    } catch (err) {
      const raw = err instanceof Error ? err.message : "";
      if (/already exists|already registered|user already/i.test(raw))
        setError("Email ini sudah terdaftar. Coba masuk, atau pakai email lain.");
      else if (/invalid|password|credential/i.test(raw))
        setError("Email atau password salah.");
      else setError(raw || "Gagal menyimpan akun. Coba lagi.");
      setIsLoading(false);
    }
  };

  // ------------------------------------------------------ Kode email ----
  const sendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailOk) {
      setError("Isi email yang valid dulu.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await signIn("email-otp", { email: email.trim() }) as
        | { signInToken?: string }
        | undefined;
      if (res?.signInToken) {
        // Nomor yang sama sudah pernah dikirim: langsung ke layar kode.
        setMode("otp");
      } else {
        setMode("otp");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengirim kode.");
    }
    setIsLoading(false);
  };

  const submitOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      await signIn("email-otp", { email: email.trim(), code: otp.trim() });
      navigate(redirect, { replace: true });
    } catch {
      setError("Kode yang kamu masukkan salah.");
      setOtp("");
      setIsLoading(false);
    }
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setIsLoading(false);
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#06060d] px-4 py-10">
      {/* Latar: satu cahaya ungu tipis di atas + garis film tipis. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(680px 380px at 50% -8%, rgba(124,58,237,0.28), transparent 70%), linear-gradient(180deg, #0a0a16 0%, #06060d 55%, #040408 100%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, #fff 0 1px, transparent 1px 3px)",
        }}
      />

      <section className="pop-enter relative w-full max-w-sm">
        {/* Wordmark */}
        <div className="mb-6 flex flex-col items-center text-center">
          <img
            src={logo}
            alt=""
            onClick={() => navigate("/")}
            className="size-9 cursor-pointer rounded-lg"
          />
          <p className="mt-3 text-lg font-extrabold tracking-[0.34em] text-white/95">
            YORUNIME
          </p>
          <p className="mt-1 text-[11px] text-zinc-500">
            {mode === "main"
              ? "Masuk untuk lanjut nonton"
              : mode === "otp"
                ? "Masukkan kode yang kami kirim"
                : isRegister
                  ? "Buat akun baru"
                  : "Masuk dengan akunmu"}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 backdrop-blur-sm">
          {mode === "main" && (
            <div className="space-y-2.5">
              <button
                onClick={handleGoogle}
                disabled={isLoading}
                className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-white/15 bg-white px-4 py-3 text-sm font-bold text-zinc-900 transition hover:bg-zinc-100 disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <GoogleIcon />
                )}
                Lanjutkan dengan Google
              </button>

              <div className="flex items-center gap-3 py-0.5">
                <span className="h-px flex-1 bg-white/10" />
                <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-600">
                  atau
                </span>
                <span className="h-px flex-1 bg-white/10" />
              </div>

              <button
                onClick={() => {
                  switchMode("password");
                  setIsRegister(false);
                }}
                disabled={isLoading}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-foreground/40 bg-primary/15 px-4 py-3 text-sm font-bold text-primary transition hover:bg-primary/25"
              >
                <Mail className="size-4" /> Email &amp; Password
              </button>

              <button
                onClick={() => switchMode("otp")}
                disabled={isLoading}
                className="w-full rounded-xl px-4 py-2 text-xs font-semibold text-zinc-500 transition hover:text-zinc-300"
              >
                Kirim kode ke email
              </button>

              {!firebaseReady && (
                <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[10px] leading-relaxed text-amber-300/90">
                  Login Google belum aktif. Lengkapi credential Firebase di tab
                  Keys dulu.
                </p>
              )}
            </div>
          )}

          {mode === "password" && (
            <form onSubmit={submitPassword} className="space-y-2.5">
              {isRegister && (
                <Field
                  label="Nama tampilan"
                  value={name}
                  onChange={setName}
                  placeholder="Nama yang dipakai di chat"
                  autoComplete="nickname"
                />
              )}
              <Field
                label="Email"
                value={email}
                onChange={setEmail}
                placeholder="nama@email.com"
                type="email"
                autoComplete="email"
              />
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                  Password
                </label>
                <div className="relative">
                  <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type={showPass ? "text" : "password"}
                    placeholder="Minimal 8 karakter"
                    autoComplete={isRegister ? "new-password" : "current-password"}
                    className="w-full rounded-xl border border-white/12 bg-black/30 px-3 py-2.5 pr-10 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-foreground/40"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    aria-label={showPass ? "Sembunyikan password" : "Tampilkan password"}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-500"
                  >
                    {showPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
              {isRegister && (
                <Field
                  label="Ulangi password"
                  value={confirm}
                  onChange={setConfirm}
                  placeholder="Ketik password sekali lagi"
                  type={showPass ? "text" : "password"}
                  autoComplete="new-password"
                  invalid={confirm.length > 0 && confirm !== password}
                />
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-white transition hover:bg-primary disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ArrowRight className="size-4" />
                )}
                {isRegister ? "Daftar" : "Masuk"}
              </button>

              <p className="text-center text-[11px] text-zinc-500">
                {isRegister ? "Sudah punya akun?" : "Belum punya akun?"}{" "}
                <button
                  type="button"
                  onClick={() => {
                    setIsRegister((v) => !v);
                    setError(null);
                  }}
                  className="font-bold text-primary underline-offset-2 hover:underline"
                >
                  {isRegister ? "Masuk" : "Daftar"}
                </button>
              </p>
            </form>
          )}

          {mode === "otp" && (
            <form onSubmit={submitOtp} className="space-y-2.5">
              <Field
                label="Email"
                value={email}
                onChange={setEmail}
                placeholder="nama@email.com"
                type="email"
                autoComplete="email"
              />
              <button
                type="button"
                onClick={sendOtp}
                disabled={isLoading}
                className="w-full rounded-xl border border-white/12 bg-black/30 py-2.5 text-xs font-bold text-zinc-200 transition hover:border-foreground/40 disabled:opacity-50"
              >
                Kirim kode 6 digit
              </button>
              <Field
                label="Kode"
                value={otp}
                onChange={setOtp}
                placeholder="000000"
                inputMode="numeric"
                maxLength={6}
                center
              />
              <button
                type="submit"
                disabled={isLoading || otp.trim().length !== 6}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-white transition hover:bg-primary disabled:opacity-40"
              >
                {isLoading ? <Loader2 className="size-4 animate-spin" /> : null}
                Verifikasi
              </button>
            </form>
          )}

          {error && (
            <p className="mt-2.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] leading-relaxed text-red-300">
              {error}
            </p>
          )}

          {mode !== "main" && (
            <button
              onClick={() => switchMode("main")}
              className="mt-3 w-full rounded-xl py-2 text-xs font-semibold text-zinc-500 transition hover:text-zinc-300"
            >
              Ganti cara masuk
            </button>
          )}
        </div>

        <p className="mt-4 text-center text-[10px] text-zinc-600">
          nonton anime, manhwa &amp; manga subtitle Indonesia
        </p>
      </section>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  autoComplete,
  inputMode,
  maxLength,
  center,
  invalid,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  autoComplete?: string;
  inputMode?: "numeric";
  maxLength?: number;
  center?: boolean;
  invalid?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        maxLength={maxLength}
        className={cn(
          "w-full rounded-xl border bg-black/30 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-zinc-600",
          invalid
            ? "border-red-500/60"
            : "border-white/12 focus:border-foreground/40",
          center && "text-center text-lg tracking-[0.35em]",
        )}
      />
    </div>
  );
}
