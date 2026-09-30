import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { useAuth } from "@/hooks/use-auth";
import {
  consumeFirebaseRedirect,
  firebaseReady,
  getActiveFirebaseIdToken,
  getFirebaseIdToken,
  signInWithGoogleFirebase,
} from "@/lib/firebase";
import logo from "@/assets/logo.svg";
import { ArrowRight, Loader2, Mail, ShieldCheck } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

interface AuthProps {
  redirectAfterAuth?: string;
}

function resolveRedirectAfterAuth(
  returnTo: string | null,
  fallback = "/dashboard",
) {
  if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) {
    return returnTo;
  }
  return fallback;
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="mr-2 h-4 w-4" aria-hidden>
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

function Auth({ redirectAfterAuth }: AuthProps = {}) {
  const { isLoading: authLoading, isAuthenticated, signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = resolveRedirectAfterAuth(
    searchParams.get("returnTo"),
    redirectAfterAuth,
  );
  const [mode, setMode] = useState<"main" | "email" | "otp" | "tester">("main");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [testerId, setTesterId] = useState("1");
  const [testerPass, setTesterPass] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(redirect);
    }
  }, [authLoading, isAuthenticated, navigate, redirect]);

  // Google OAuth: browser diarahkan ke Google, jadi pemilih akun Google
  // yang ada di device langsung muncul (tanpa input Gmail manual).
  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError(null);
    if (!firebaseReady) {
      setError(
        "Firebase belum dikonfigurasi. Tambahkan VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, dan VITE_FIREBASE_PROJECT_ID di tab Keys.",
      );
      setIsLoading(false);
      return;
    }
    try {
      const fbUser = await signInWithGoogleFirebase();
      // Di mobile signInWithRedirect() memuat halaman Google; setelah balik,
      // ID token diambil di bawah ini.
      if (!fbUser) {
        setIsLoading(false);
        return;
      }
      const idToken = await getFirebaseIdToken(fbUser);
      if (!idToken) throw new Error("Gagal mengambil token Firebase");
      await signIn("firebase", { idToken });
      navigate(redirect);
    } catch (error) {
      console.error("Google sign-in error:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Gagal masuk dengan Google. Coba lagi.",
      );
      setIsLoading(false);
    }
  };

  // Balik dari redirect Google → kirim tokennya ke Convex lalu masuk.
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
        navigate(redirect);
      } catch (error) {
        console.error("Firebase redirect sign-in error:", error);
        setError(
          error instanceof Error ? error.message : "Gagal masuk dengan Google.",
        );
        setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, isAuthenticated]);

  // Mode demo/anonim: akun dibuat otomatis tanpa email.
  const handleSimpleLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signIn("anonymous");
    } catch (error) {
      console.error("Login error:", error);
      setError(
        error instanceof Error ? error.message : "Gagal masuk. Coba lagi.",
      );
      setIsLoading(false);
    }
  };

  const handleEmailSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);
      setEmail(formData.get("email") as string);
      setMode("otp");
      setIsLoading(false);
    } catch (error) {
      console.error("Email sign-in error:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Gagal mengirim kode. Coba lagi.",
      );
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);
      navigate(redirect);
    } catch (error) {
      console.error("OTP verification error:", error);
      setError("Kode yang kamu masukkan salah.");
      setIsLoading(false);
      setOtp("");
    }
  };

  // Login tester (mode test): ID #1 / ytta
  const handleTesterLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const id = testerId.trim().replace(/^#/, "");
    if (id !== "1") {
      setError("ID tester salah. Gunakan #1.");
      return;
    }
    if (testerPass !== "ytta") {
      setError("Password tester salah.");
      return;
    }
    await handleSimpleLogin();
  };

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex flex-1 items-center justify-center">
        <div className="flex h-full flex-col items-center justify-center">
          <Card className="min-w-[350px] border pb-0 shadow-md">
            {mode === "main" && (
              <>
                <CardHeader className="text-center">
                  <div className="flex justify-center">
                    <img
                      src={logo}
                      alt="Logo"
                      width={64}
                      height={64}
                      className="mb-4 mt-4 cursor-pointer rounded-lg"
                      onClick={() => navigate("/")}
                    />
                  </div>
                  <CardTitle className="text-xl">Selamat datang</CardTitle>
                  <CardDescription>
                    Masuk ke YoruNime untuk melanjutkan
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 pb-6">
                  <Button
                    type="button"
                    className="w-full bg-white text-zinc-900 hover:bg-zinc-100"
                    onClick={handleGoogleLogin}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <GoogleIcon />
                    )}
                    Login dengan Google
                  </Button>
                  {!firebaseReady && (
                    <p className="text-center text-[11px] text-amber-300/80">
                      Firebase belum dikonfigurasi — lengkapi dulu di tab Keys.
                    </p>
                  )}
                  <Button
                    type="button"
                    className="w-full bg-violet-600 text-white hover:bg-violet-500"
                    onClick={() => setMode("email")}
                    disabled={isLoading}
                  >
                    <Mail className="mr-2 h-4 w-4" /> Login dengan Email
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full text-muted-foreground"
                    onClick={() => setMode("tester")}
                    disabled={isLoading}
                  >
                    <ShieldCheck className="mr-2 h-4 w-4" /> Masuk Mode Demo
                  </Button>
                  {error && <p className="text-sm text-red-500">{error}</p>}
                </CardContent>
              </>
            )}

            {mode === "email" && (
              <>
                <CardHeader className="text-center">
                  <CardTitle className="mt-4">Login Email</CardTitle>
                  <CardDescription>
                    Masukkan email untuk menerima kode
                  </CardDescription>
                </CardHeader>
                <form onSubmit={handleEmailSubmit}>
                  <CardContent className="pb-4">
                    <Input
                      name="email"
                      placeholder="name@example.com"
                      type="email"
                      disabled={isLoading}
                      required
                    />
                    {error && (
                      <p className="mt-2 text-sm text-red-500">{error}</p>
                    )}
                  </CardContent>
                  <CardFooter className="flex-col gap-2 pb-6">
                    <Button
                      type="submit"
                      className="w-full bg-violet-600 text-white hover:bg-violet-500"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <ArrowRight className="ml-2 h-4 w-4" />
                      )}
                      Kirim kode
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full"
                      onClick={() => setMode("main")}
                      disabled={isLoading}
                    >
                      Kembali
                    </Button>
                  </CardFooter>
                </form>
              </>
            )}

            {mode === "otp" && (
              <>
                <CardHeader className="text-center">
                  <CardTitle className="mt-4">Cek email kamu</CardTitle>
                  <CardDescription>
                    Kode 6 digit dikirim ke {email}
                  </CardDescription>
                </CardHeader>
                <form onSubmit={handleOtpSubmit}>
                  <CardContent className="pb-4">
                    <input type="hidden" name="email" value={email} />
                    <input type="hidden" name="code" value={otp} />
                    <Input
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      maxLength={6}
                      placeholder="______"
                      inputMode="numeric"
                      className="text-center text-lg tracking-[0.4em]"
                      disabled={isLoading}
                      required
                    />
                    {error && (
                      <p className="mt-2 text-center text-sm text-red-500">
                        {error}
                      </p>
                    )}
                  </CardContent>
                  <CardFooter className="flex-col gap-2 pb-6">
                    <Button
                      type="submit"
                      className="w-full bg-violet-600 text-white hover:bg-violet-500"
                      disabled={isLoading || otp.length !== 6}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Verifikasi…
                        </>
                      ) : (
                        <>
                          Verifikasi
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full"
                      onClick={() => setMode("email")}
                      disabled={isLoading}
                    >
                      Ganti email
                    </Button>
                  </CardFooter>
                </form>
              </>
            )}

            {mode === "tester" && (
              <>
                <CardHeader className="text-center">
                  <CardTitle className="mt-4">Masuk Mode Demo</CardTitle>
                  <CardDescription>
                    Masuk tanpa email untuk mencoba YoruNime
                  </CardDescription>
                </CardHeader>
                <form onSubmit={handleTesterLogin}>
                  <CardContent className="flex flex-col gap-3 pb-4">
                    <Input
                      value={testerId}
                      onChange={(e) => setTesterId(e.target.value)}
                      placeholder="ID akun (#1)"
                      disabled={isLoading}
                      required
                    />
                    <Input
                      value={testerPass}
                      onChange={(e) => setTesterPass(e.target.value)}
                      placeholder="Password"
                      type="password"
                      disabled={isLoading}
                      required
                    />
                    {error && (
                      <p className="text-sm text-red-500">{error}</p>
                    )}
                  </CardContent>
                  <CardFooter className="flex-col gap-2 pb-6">
                    <Button
                      type="submit"
                      className="w-full bg-violet-600 text-white hover:bg-violet-500"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <ShieldCheck className="mr-2 h-4 w-4" />
                      )}
                      Masuk sebagai tester
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full"
                      onClick={() => setMode("main")}
                      disabled={isLoading}
                    >
                      Kembali
                    </Button>
                  </CardFooter>
                </form>
              </>
            )}

            <div className="rounded-b-lg border-t bg-muted px-6 py-4 text-center text-xs text-muted-foreground">
              YoruNime — nonton anime, manhwa & manga
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function AuthPage(props: AuthProps) {
  return (
    <Suspense>
      <Auth {...props} />
    </Suspense>
  );
}
