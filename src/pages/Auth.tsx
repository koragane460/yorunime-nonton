import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useConvexAuth } from "convex/react";
import { useAuth } from "@/hooks/use-auth";
import logo from "@/assets/logo.svg";
import { ArrowRight, Eye, EyeOff, Loader2, Mail, Lock, UserPlus, ShieldCheck, FlaskConical } from "lucide-react";
import { GoogleGIcon } from "@/components/lstream-ui";
import { cn } from "@/lib/utils";
import { resolveRedirectAfterAuth } from "@/lib/authRedirect";
import {
  firebaseReady,
  getFirebaseIdToken,
  signInWithGoogleFirebase,
} from "@/lib/firebase";

interface AuthProps {
  redirectAfterAuth?: string;
}

const DASHBOARD_REDIRECT = "/dashboard";

type Mode = "main" | "password" | "otp";

export default function AuthPage({ redirectAfterAuth }: AuthProps = {}) {
  // Cukup status sesi dari websocket — tidak perlu ikut menunggu query
  // user, supaya redirect setelah login terasa cepat.
  const { isLoading: authLoading, isAuthenticated } = useConvexAuth();
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = resolveRedirectAfterAuth(
    searchParams.get("returnTo"),
    DASHBOARD_REDIRECT,
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

  // Skip the redirect if the user already has a session (no ping-pong).
  useEffect(() => {
    if (!authLoading && isAuthenticated) navigate(redirect, { replace: true });
  }, [authLoading, isAuthenticated, navigate, redirect]);

  const emailOk = /^\S+@\S+\.\S+$/.test(email.trim());
  const passOk = password.length >= 8;
  const confirmOk = !isRegister || confirm === password;
  const canSubmitPassword =
    emailOk && passOk && confirmOk && (!isRegister || name.trim().length >= 2);

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
        // Convex Auth tidak punya signUp terpisah: daftar = signIn flow "signUp".
        await signIn("password", {
          email: email.trim(),
          password,
          name: name.trim(),
          flow: "signUp",
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

  // ------------------------------------------------ Google & Tester ----
  const doGoogleLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const u = await signInWithGoogleFirebase();
      if (!u) {
        setError(
          firebaseReady
            ? "Popup diblokir browser. Izinkan popup lalu coba lagi."
            : "Login Google belum dikonfigurasi.",
        );
        setIsLoading(false);
        return;
      }
      const idToken = await getFirebaseIdToken(u);
      if (!idToken) throw new Error("Gagal mengambil sesi Google.");
      await signIn("firebase", { idToken });
      navigate(redirect, { replace: true });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal masuk dengan Google.",
      );
      setIsLoading(false);
    }
  };

  const doTesterLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signIn("anonymous");
      navigate(redirect, { replace: true });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal masuk sebagai tester.",
      );
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

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0a0b0d] px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_45%_at_50%_0%,rgba(211,62,48,.1),transparent_64%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/8"
      />

      <section className="pop-enter relative w-full max-w-sm">
        <button
          type="button"
          onClick={() => navigate("/")}
          aria-label="Kembali ke beranda"
          className="flex items-center gap-2"
        >
          <img src={logo} alt="" className="size-8 rounded-lg" />
          <span className="font-display text-[15px] font-bold tracking-[-0.03em]">
            Yoru<span className="text-[var(--primary)]">Nime</span>
          </span>
        </button>

        <div className="mb-6 mt-9">
          <p className="flex items-center gap-1.5 text-[8.5px] font-bold uppercase tracking-[0.16em] text-white/34">
            <span className="font-serif text-[16px] font-normal leading-none tracking-normal text-[var(--primary)]">
              /
            </span>
            Masuk
          </p>
          <h1 className="mt-2 font-serif text-[36px] leading-[0.98] tracking-[-0.03em] text-white">
            Kembali ke
            <br />
            <em className="text-[var(--primary)]">malam.</em>
          </h1>
          <p className="mt-3 text-[10.5px] leading-relaxed text-white/32">
            Lanjutkan tontonan dan bacaanmu dari titik terakhir.
          </p>
        </div>

        <div className="rounded-xl border border-white/8 bg-[#101215] p-4">
          {mode === "main" && (
            <div className="space-y-2">
              <button
                onClick={doGoogleLogin}
                disabled={isLoading}
                className="flex w-full items-center justify-center gap-2.5 rounded-lg bg-[#f5f0e8] py-3 text-[11px] font-bold text-[#15171a] transition hover:brightness-95 disabled:opacity-50"
              >
                <GoogleGIcon className="size-4" />
                Masuk dengan Google
              </button>
              <button
                onClick={doTesterLogin}
                disabled={isLoading}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/8 bg-[#121417] py-3 text-[10.5px] font-bold text-white/52 transition hover:text-white disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <FlaskConical className="size-4" />
                )}
                Login Tester
              </button>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setMode("password")}
                  disabled={isLoading}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-white/8 bg-[#121417] py-2.5 text-[10px] font-semibold text-white/48 transition hover:text-white disabled:opacity-50"
                >
                  <Mail className="size-3.5" /> Email
                </button>
                <button
                  onClick={() => setMode("otp")}
                  disabled={isLoading}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-white/8 bg-[#121417] py-2.5 text-[10px] font-semibold text-white/48 transition hover:text-white disabled:opacity-50"
                >
                  <Lock className="size-3.5" /> OTP
                </button>
              </div>
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
                <label className="mb-1 block text-[8.5px] font-bold uppercase tracking-[0.14em] text-white/30">
                  Password
                </label>
                <div className="relative">
                  <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type={showPass ? "text" : "password"}
                    placeholder="Minimal 8 karakter"
                    autoComplete={isRegister ? "new-password" : "current-password"}
                    className="w-full rounded-lg border border-white/8 bg-[#0a0b0d] px-3 py-2.5 pr-10 text-[11px] text-white outline-none transition placeholder:text-white/22 focus:border-[rgba(211,62,48,.4)]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    aria-label={showPass ? "Sembunyikan password" : "Tampilkan password"}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-white/30"
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
                className="yn-btn-primary flex w-full items-center justify-center gap-2 rounded-lg py-3 text-[11px] font-bold disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="size-4 animate-spin" /> : null}
                {isRegister ? "Daftar" : "Masuk"}
              </button>

              <p className="text-center text-[9.5px] text-white/30">
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
                className="w-full rounded-lg border border-white/8 bg-[#121417] py-2.5 text-[10px] font-bold text-white/52 transition hover:text-white disabled:opacity-50"
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
                className="yn-btn-primary flex w-full items-center justify-center gap-2 rounded-lg py-3 text-[11px] font-bold disabled:opacity-40"
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
              onClick={() => setMode("main")}
              className="mt-3 w-full rounded-lg py-2 text-[10px] font-semibold text-white/28 transition hover:text-white/60"
            >
              Ganti cara masuk
            </button>
          )}
        </div>

        <p className="mt-4 text-center text-[8.5px] font-medium tracking-[0.04em] text-white/20">
          Anime, manhwa &amp; manga · subtitle Indonesia
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
      <label className="mb-1 block text-[8.5px] font-bold uppercase tracking-[0.14em] text-white/30">
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
          "w-full rounded-lg border bg-[#0a0b0d] px-3 py-2.5 text-[11px] text-white outline-none transition placeholder:text-white/22",
          invalid
            ? "border-red-500/60"
            : "border-white/8 focus:border-[rgba(211,62,48,.4)]",
          center && "text-center text-base tracking-[0.3em]",
        )}
      />
    </div>
  );
}
