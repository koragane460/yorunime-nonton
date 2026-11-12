import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useConvexAuth } from "convex/react";
import { useNavigate } from "react-router";
import { GoogleGIcon } from "@/components/lstream-ui";
import {
  signInWithGoogleFirebase,
  firebaseReady,
  getFirebaseIdToken,
} from "@/lib/firebase";
import { FileText, LogIn, Mail, User, AlertCircle, Loader2 } from "lucide-react";
import { useAuthActions } from "@convex-dev/auth/react";
import { cn } from "@/lib/utils";

/**
 * Login screen:
 *   - Judul "Login", teks: "Masuk untuk sinkronisasi riwayat akun mu,
 *     akun mu terjaga selalu".
 *   - Kartu login Google: ikon + "Login dengan google".
 *   - Garis tipis (opacity rendah) pemisah "Atau".
 *   - Tombol (tanpa background) "Login untuk tester" + ikon.
 *     Klik → popup: ikon orang di atas, tulisan "Login sebagai tester",
 *     kolom username, kolom password, tombol "Log in".
 *     Password & username benar → auto-login → menu home.
 *   - Kredensial tester TIDAK disimpan di source; isi lewat env server lokal.
 *   - Login Google langsung → menu home.
 *   - Gate: sembunyikan Isi saat loading sesi; yang terlihat hanya splash.
 */
/** Kredensial tester hanya dari environment, bukan hardcoded di source. */
const TESTER_USER = import.meta.env.VITE_TESTER_USER as string | undefined;
const TESTER_PASS = import.meta.env.VITE_TESTER_PASS as string | undefined;

export default function Login() {
  const navigate = useNavigate();
  const { isLoading: authLoading, isAuthenticated } = useConvexAuth();
  const { signIn } = useAuthActions();
  const [loginState, setLoginState] = useState<"idle" | "loading">("idle");
  const [loginErr, setLoginErr] = useState<string | null>(null);
  const [showTesterLogin, setShowTesterLogin] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [accountStep, setAccountStep] = useState<"create" | "set-password" | "done">("create");
  const [accountEmail, setAccountEmail] = useState("");
  const [accountPass, setAccountPass] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountConfirm, setAccountConfirm] = useState("");
  const [accountEmailDone, setAccountEmailDone] = useState("");
  const [accountNameDone, setAccountNameDone] = useState("");
  const [accountUserDone, setAccountUserDone] = useState("");
  const [accountPassDone, setAccountPassDone] = useState("");
  const [accountConfirmDone, setAccountConfirmDone] = useState("");
  const [testerUser, setTesterUser] = useState("");
  const [testerPass, setTesterPass] = useState("");
  const [testerErr, setTesterErr] = useState<string | null>(null);
  const [accountErr, setAccountErr] = useState<string | null>(null);
  const [accountState, setAccountState] = useState<"idle" | "loading">("idle");
  // Username hasil create — tampil read-only di tahap set-password.
  const [accountUser, setAccountUser] = useState("");

  // --- Login Google (firebase console) ---
  // Konfigurasi Firebase diambil dari env Keys/API keys UI:
  // VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN,
  // VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_MESSAGING_SENDER_ID,
  // VITE_FIREBASE_APP_ID. src/lib/firebase.ts mengembalikannya ke client.
  const doGoogleLogin = async () => {
    setLoginState("loading");
    setLoginErr(null);
    try {
      const u = await signInWithGoogleFirebase();
      if (!u) {
        setLoginErr(
          firebaseReady
            ? "Popup diblokir browser. Izinkan popup lalu coba lagi."
            : "Login Google belum dikonfigurasi.",
        );
        setLoginState("idle");
        return;
      }
      const idToken = await getFirebaseIdToken(u);
      if (!idToken) throw new Error("Gagal mengambil sesi Google.");
      await signIn("firebase", { idToken });
      navigate("/home", { replace: true });
    } catch (e) {
      setLoginErr(e instanceof Error ? e.message : "Gagal masuk dengan Google.");
      setLoginState("idle");
    }
  };

  // --- Tester login (username + password) ---
  // Keduanya harus cocok supaya bisa masuk.
  const doTesterLogin = async () => {
    const u = testerUser.trim();
    const p = testerPass.trim();
    if (!u || !p) {
      setTesterErr("Username & password wajib diisi.");
      return;
    }
    if (
      !TESTER_USER ||
      !TESTER_PASS ||
      u !== TESTER_USER ||
      p !== TESTER_PASS
    ) {
      setTesterErr("Username atau password tester salah.");
      return;
    }
    setLoginState("loading");
    setTesterErr(null);
    try {
      await signIn("anonymous");
      navigate("/home", { replace: true });
    } catch (e) {
      setTesterErr(e instanceof Error ? e.message : "Gagal masuk. Coba lagi.");
      setLoginState("idle");
    }
  };

  // Buat akun baru via Convex Auth password provider (flow signUp).
  const submitCreateAccount = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const email = accountEmail.trim();
    const pass = accountPass.trim();
    if (!email || !pass || !accountName.trim()) {
      setAccountErr("Email, password, dan nama wajib diisi.");
      return;
    }
    if (pass.length < 6) {
      setAccountErr("Password minimal 6 karakter.");
      return;
    }
    setAccountState("loading");
    setAccountErr(null);
    try {
      const res = await signIn("password", {
        email,
        password: pass,
        name: accountName.trim(),
        flow: "signUp",
      });
      setAccountEmailDone(email);
      setAccountNameDone(accountName.trim());
      setAccountEmailDone(email);
      setAccountNameDone(accountName.trim());
      setAccountUserDone((res as any)?.name ?? accountName.trim());
      setAccountPassDone(pass);
      setAccountUser((res as any)?.name ?? accountName.trim());
      setAccountStep("done");
      setAccountState("idle");
      setAccountErr(null);
    } catch (err) {
      setAccountErr(err instanceof Error ? err.message : "Gagal membuat akun.");
      setAccountState("idle");
    }
  };

  const submitSetPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const pass = accountPass.trim();
    const confirm = accountConfirm.trim();
    if (!pass || !confirm) {
      setAccountErr("Password & konfirmasi wajib diisi.");
      return;
    }
    if (pass !== confirm) {
      setAccountErr("Password & konfirmasi tidak sama.");
      return;
    }
    if (pass.length < 6) {
      setAccountErr("Password minimal 6 karakter.");
      return;
    }
    setAccountState("loading");
    setAccountErr(null);
    try {
      // Akun sudah jadi; konfirmasi cuma validasi UI selama tahap set-password.
      setAccountConfirmDone(confirm);
      setAccountStep("done");
      setAccountState("idle");
      setAccountErr(null);
    } catch (err) {
      setAccountErr(err instanceof Error ? err.message : "Gagal menyelesaikan akun.");
      setAccountState("idle");
    }
  };


  // Tunggu authLoading selesai; kalau sudah terautentikasi, sembunyikan layar ini.
  if (!authLoading && isAuthenticated) return null;

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#07060c] px-4">
      {/* Latar gradasi ruang: orb gelap melayang pelan + grid halus dan kuram. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -left-32 top-0 size-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -right-32 bottom-0 size-96 rounded-full bg-gold/10 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
      </div>

      {/* Menu logo app. */}
      <div className="relative z-10 flex flex-col items-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/20 ring-1 ring-white/15">
          <img src="/logo-source.jpg" alt="YoruNime" className="size-10 rounded-xl object-cover" />
        </div>
        <h1          className="mt-6 w-full bg-gradient-to-r from-amber-200 via-white to-amber-300 bg-clip-text px-4 text-center font-[family-name:var(--font-display)] text-[clamp(1.8rem,5.5vw,3.2rem)] font-black leading-[0.92] tracking-[-0.03em] text-transparent">
          YoruNime
        </h1>
        <p className="mt-3 text-center text-[11px] font-bold uppercase tracking-widest text-zinc-400">
          Nonton anime, temukan komunitasmu
        </p>
      </div>

      {/* Kartu login utama. */}
      <div className="relative z-10 mt-10 w-full max-w-[26rem] rounded-3xl border border-white/10 bg-background/70 p-6 shadow-[0_16px_48px_-24px_rgba(0,0,0,0.9)] backdrop-blur-xl">
        <h2 className="text-center text-4xl leading-none tracking-tight text-foreground yn-title">
          Login
        </h2>
        <p className="mt-2 text-center text-xs leading-relaxed text-muted-foreground">
          Masuk untuk sinkronisasi riwayat akun mu, akun mu terjaga selalu
        </p>

        {/* ----- Kartu Google (Firebase console) ----- */}
        <button
          onClick={doGoogleLogin}
          disabled={loginState === "loading"}
          className={cn(
            "flex h-12 w-full items-center justify-center gap-3 rounded-xl bg-white text-sm font-bold text-zinc-900 transition hover:bg-zinc-100 active:scale-[0.98] disabled:opacity-50",
            loginState === "loading" && "cursor-wait",
          )}
        >
          <GoogleGIcon className="size-5" />
          Login dengan google
        </button>

        {/* Garis tipis pemisah (opacity rendah) antara Google dan tombol tester. */}
        <div className="my-3 flex items-center gap-2">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-700/70 to-transparent" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-zinc-600">
            Atau
          </span>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-700/70 to-transparent" />
        </div>

        {/* ----- Tombol TAHAP 2: Login sebagai tester (tanpa background) ----- */}
        <button
          onClick={() => setShowTesterLogin(true)}
          disabled={loginState === "loading"}
          className={cn(
            "flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-primary/50 bg-primary/15 text-sm font-bold text-primary transition hover:bg-primary/25 active:scale-[0.98] disabled:opacity-50",
            loginState === "loading" && "cursor-wait",
          )}
        >
          <LogIn className="size-5" />
          Login untuk tester
        </button>

        {loginErr && (
          <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-red-400">
            <AlertCircle className="size-3.5" />
            {loginErr}
          </p>
        )}
      </div>

      {/* ----- Popup: Login sebagai tester ----- */}
      {showTesterLogin && (
        <Sheet open={true} onOpenChange={setShowTesterLogin}>
          <SheetContent className="bg-[#07060c] border-white/10 shadow-2xl" side="bottom">
            <SheetHeader className="sr-only"></SheetHeader>
            <div className="flex flex-col gap-4 py-3">
              {/* Header popup tester. */}
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/20 ring-1 ring-white/10">
                  <User className="size-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground">Login sebagai tester</p>
                  <p className="text-[11px] text-muted-foreground">
                    Masuk memakai akun tester YoruNime
                  </p>
                </div>
              </div>

              {/* Kolom username. */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">
                  Username
                </Label>
                <Input
                  value={testerUser}
                  onChange={(e) => setTesterUser(e.target.value)}
                  placeholder="Username tester"
                  className="bg-card/50 border-border text-foreground"
                />
              </div>

              {/* Kolom password. */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">
                  Password
                </Label>
                <Input
                  value={testerPass}
                  onChange={(e) => setTesterPass(e.target.value)}
                  placeholder="Password tester"
                  type="password"
                  className="bg-card/50 border-border text-foreground"
                />
              </div>

              {testerErr && (
                <p className="flex items-center justify-center gap-1.5 text-xs text-red-400">
                  <AlertCircle className="size-3.5" />
                  {testerErr}
                </p>
              )}

              <Button
                onClick={doTesterLogin}
                disabled={loginState === "loading"}
                className="w-full bg-primary text-white hover:bg-primary/90"
              >
                {loginState === "loading" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <LogIn className="size-4" />
                )}
                Log in
              </Button>

              <Button
                variant="ghost"
                onClick={() => setShowTesterLogin(false)}
                className="w-full text-xs text-muted-foreground"
              >
                Tutup
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      )}

      {/* ----- Popup: Buat akun baru (tester onboarding) ----- */}
      {showAccountModal && (
        <Sheet open={true} onOpenChange={setShowAccountModal}>
          <SheetContent className="bg-[#07060c] border-white/10 shadow-2xl" side="bottom">
            <SheetHeader className="sr-only"></SheetHeader>
            <div className="flex flex-col gap-4 py-3">
              {accountStep === "create" ? (
                <form onSubmit={submitCreateAccount} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground">
                      Email
                    </Label>
                    <Input
                      value={accountEmail}
                      onChange={(e) => setAccountEmail(e.target.value)}
                      placeholder="mail@example.com"
                      type="email"
                      className="bg-card/50 border-border text-foreground"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground">
                      Nama
                    </Label>
                    <Input
                      value={accountName}
                      onChange={(e) => setAccountName(e.target.value)}
                      placeholder="Nama akun"
                      className="bg-card/50 border-border text-foreground"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground">
                      Password
                    </Label>
                    <Input
                      value={accountPass}
                      onChange={(e) => setAccountPass(e.target.value)}
                      placeholder="Min. 6 karakter"
                      type="password"
                      className="bg-card/50 border-border text-foreground"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground">
                      Konfirmasi password
                    </Label>
                  </div>
                  {accountErr && (
                    <p className="flex items-center justify-center gap-1.5 text-xs text-red-400">
                      <AlertCircle className="size-3.5" />
                      {accountErr}
                    </p>
                  )}
                  <Button
                    type="submit"
                    disabled={accountState === "loading"}
                    className="w-full bg-primary text-white hover:bg-primary/90"
                  >
                    {accountState === "loading" ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <FileText className="size-4" />
                    )}
                    Buat akun
                  </Button>
                </form>                    ) : (
                <form onSubmit={submitSetPassword} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground">
                      Email
                    </Label>
                    <Input
                      value={accountEmail}
                      className="bg-card/50 border-border text-foreground"
                      readOnly
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground">
                      Username
                    </Label>
                    <Input
                      value={accountUser}
                      className="bg-card/50 border-border text-foreground"
                      readOnly
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground">
                      Nama
                    </Label>
                    <Input
                      value={accountName}
                      className="bg-card/50 border-border text-foreground"
                      readOnly
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground">
                      Password baru
                    </Label>
                    <Input
                      value={accountPass}
                      onChange={(e) => setAccountPass(e.target.value)}
                      placeholder="Min. 6 karakter"
                      type="password"
                      className="bg-card/50 border-border text-foreground"
                    />
                  </div>
                  <div className="space-y-1.5">                  <Label className="text-xs font-semibold text-muted-foreground">
                      Konfirmasi password
                    </Label>
                    <Input
                      value={accountConfirm}
                      onChange={(e) => setAccountConfirm(e.target.value)}
                      placeholder="Ulangi password"
                      type="password"
                      className="bg-card/50 border-border text-foreground"
                    />
                  </div>

                  {accountErr && (
                    <p className="flex items-center justify-center gap-1.5 text-xs text-red-400">
                      <AlertCircle className="size-3.5" />
                      {accountErr}
                    </p>
                  )}                  <Button
                    type="submit"
                    disabled={accountState === "loading"}
                    className="w-full bg-primary text-white hover:bg-primary/90"
                  >
                    {accountState === "loading" ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <LogIn className="size-4" />
                    )}
                    Selesai
                  </Button>
                </form>
              )
            }
            </div>              <Button
            variant="ghost"
            onClick={() => setShowAccountModal(false)}
            className="w-full text-xs text-muted-foreground"
          >
            Tutup
          </Button>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
