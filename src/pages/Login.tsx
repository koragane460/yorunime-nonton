import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription } from "@/components/ui/sheet";

const Modal = Sheet;
const ModalContent = SheetContent;
const ModalHeader = SheetHeader;
const ModalBody = SheetDescription;
const ModalFooter = SheetFooter;
const ModalTitle = SheetTitle;
import { useAuth } from "@/hooks/use-auth";
import { useConvexAuth } from "convex/react";
import { useNavigate } from "react-router";
import { GoogleGIcon, SacretIcon } from "@/components/lstream-ui";
import { FileText, LogIn, Mail, User, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Login screen — tampilan sesuai spesifikasi:
 *   - Judul besar "Login" di tengah, teks kecil di bawahnya:
 *     "Masuk untuk sinkronisasi riwayat akun mu, akun mu terjaga selalu"
 *   - Kartu login Google: ikon + "Login dengan google" (firebase console).
 *   - Garis tipis (opacity rendah) pemisah "Atau".
 *   - Tombol TAHAP 2 (tanpa background) "Login untuk tester" + ikon.
 *     Klik → popup: ikon orang di atas, ",button"Login sebagai tester",
 *     kolom username, kolom password, tombol "Log in". Bukan teks. " ketika
 *     massal. Klik tombol "Log in" dengan username/password yang benar →
 *     auto-login → menu home.
 *   - Dummy tester: username "Tester YoruNime", password "yttaajadeh".
 *   - Login Google langsung → menu home. Id akun dimulai dari 1 lagi
 *     (eksaustif resep). Login Google → user baru dibuat otomatis.
 *   - Gate: "Masuk untuk sinkronisasi riwayat akun mu, akun mu terjaga selalu"
 *     disembunyikan sambil loading sesi anonymous; yang terlihat hanya
 *     splash keluar sambil konfigurasi (Onboard/Register) menunggu.
 */
export default function Login() {
  const navigate = useNavigate();
  const { isLoading: authLoading, isAuthenticated } = useConvexAuth();
  const { signIn } = useAuth();
  const [loginState, setLoginState] = useState<"idle" | "loading">("idle");
  const [loginErr, setLoginErr] = useState<string | null>(null);
  const [showTesterLogin, setShowTesterLogin] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [accountStep, setAccountStep] = useState<"create" | "set-password">("create");
  const [accountEmail, setAccountEmail] = useState("");
  const [accountPass, setAccountPass] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountConfirm, setAccountConfirm] = useState("");
  const [testerUser, setTesterUser] = useState("");
  const [testerPass, setTesterPass] = useState("");
  const [testerErr, setTesterErr] = useState<string | null>(null);
  const [accountUser, setAccountUser] = useState("");
  const [accountErr, setAccountErr] = useState<string | null>(null);
  const [accountState, setAccountState] = useState<"idle" | "loading">("idle");

  // --- Login Google (firebase console) ---
  const doGoogleLogin = async () => {
    setLoginState("loading");
    setLoginErr(null);
    try {
      const u = await (window as any).__googleSignIn();
      if (!u) {
        setLoginErr(
          (window as any).__firebaseReady
            ? "Popup diblokir browser. Izinkan popup lalu coba lagi."
            : "Login Google belum dikonfigurasi.",
        );
        setLoginState("idle");
        return;
      }
      const idToken = await (window as any).__getFirebaseIdToken(u);
      if (!idToken) throw new Error("Gagal mengambil sesi Google.");
      await signIn("firebase", { idToken });
      navigate("/home", { replace: true });
    } catch (e) {
      setLoginErr(e instanceof Error ? e.message : "Gagal masuk dengan Google.");
      setLoginState("idle");
    }
  };

  // --- Tester login (username + password) ---
  const doTesterLogin = async () => {
    if (!testerUser.trim() || !testerPass.trim()) {
      setTesterErr("Username & password wajib diisi.");
      return;
    }
    setLoginState("loading");
    setTesterErr(null);
    try {
      // Dummy credentials. Login Google → user baru dibuat otomatis.
      if (testerUser.trim() === "Tester YoruNime" && testerPass.trim() === "yttaajadeh") {
        await signIn("anonymous");
        // Dipimpin ke menu home. Id akun dimulai dari 1 lagi.
        navigate("/home", { replace: true });
        return;
      }
      setTesterErr("Username atau password salah.");
      setLoginState("idle");
    } catch (e) {
      setTesterErr(e instanceof Error ? e.message : "Gagal masuk. Coba lagi.");
      setLoginState("idle");
    }
  };

  // --- Akun baru (tester onboarding) ---
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
      // Dummy: user baru dibuat langsung (id dimulai dari 1). Login Google
      // → user dibuat otomatis di backend.
      await (window as any).__createAccount({
        email,
        password: pass,
        name,
      });
      setAccountStep("set-password");
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
      await (window as any).__setPassword({
        email: accountEmail.trim(),
        password: pass,
      });
      // Login langsung dengan akun baru
      await signIn("firebase", { email: accountEmail.trim(), password: pass });
      navigate("/home", { replace: true });
    } catch (err) {
      setAccountErr(err instanceof Error ? err.message : "Gagal menyelesaikan akun.");
      setAccountState("idle");
    }
  };

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
        <h1 className="mt-6 w-full bg-gradient-to-r from-amber-200 via-white to-amber-300 bg-clip-text px-4 text-center font-[family-name:var(--font-display)] text-[clamp(2.25rem,10vw,4rem)] font-black leading-[0.9] tracking-[-0.03em] text-transparent">
          YoruNime
        </h1>
        <p className="mt-3 text-center text-[11px] font-bold uppercase tracking-widest text-zinc-400">
          Nonton anime, temukan komunitasmu
        </p>
      </div>

      {/* Kartu login utama. */}
      <div className="relative z-10 mt-10 w-full max-w-[26rem] rounded-3xl border border-white/10 bg-background/70 p-6 shadow-[0_16px_48px_-24px_rgba(0,0,0,0.9)] backdrop-blur-xl">
        <h2 className="text-2xl font-black text-foreground">Login</h2>
        <p className="mt-1 text-center text-xs text-muted-foreground">
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
        <div className="my-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-600 to-transparent" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-zinc-600">
            Atau
          </span>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-600 to-transparent" />
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
              <p className="text-xs text-muted-foreground">
                Username & password tester. Buka akun ini di{" "}
                <a
                  href="https://console.firebase.google.com"
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline underline-offset-2"
                >
                  Firebase console
                </a>{" "}
                untuk detail.
              </p>

              {/* Kolom username. */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">
                  Username
                </Label>
                <Input
                  value={testerUser}
                  onChange={(e) => setTesterUser(e.target.value)}
                  placeholder="Tester YoruNime"
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
                  placeholder="yttaajadeh"
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
                Batal
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      )}

      {/* ----- Popup: Akun baru (tester onboarding) ----- */}
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
                      onChange={(e) => setAccountEmail(e.target.value)}
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
                      onChange={(e) => setAccountUser(e.target.value)}
                      placeholder="Username akun"
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
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground">
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
                  )}
                  <Button
                    type="submit"
                    disabled={accountState === "loading"}
                    className="w-full bg-primary text-white hover:bg-primary/90"
                  >
                    {accountState === "loading" ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <LogIn className="size-4" />
                    )}
                    Selesaikan akun
                  </Button>
                </form>
              )}
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
