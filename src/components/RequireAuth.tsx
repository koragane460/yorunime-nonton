import { useAuth } from "@/hooks/use-auth";
import { ArrowRight, Loader2, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import logo from "@/assets/logo.svg";

/**
 * Membungkus route yang butuh user yang sudah masuk.
 *
 * Pengunjung yang belum masuk tidak lagi dilempar diam-diam ke halaman login
 * yang generik. Layar blok sekarang memakai identitas YoruNime (bukan
 * "freebuff"), lalu setelah berhasil masuk they'll dikembalikan ke halaman
 * yang tadi mereka buka lewat `returnTo`.
 */
export function RequireAuth({
  children,
  title = "Kamu belum masuk",
  description = "Halaman ini khusus buat anggota YoruNime yang sudah masuk.",
  redirectImmediately = false,
}: {
  children: ReactNode;
  /** Judul di layar blokir. */
  title?: string;
  /** Penjelasan singkat kenapa halaman ini butuh login. */
  description?: string;
  /** Langsung ke `/auth` tanpa menampilkan layar blokir. */
  redirectImmediately?: boolean;
}) {
  const { isLoading, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (!isAuthenticated) {
    const returnTo = `${location.pathname}${location.search}`;
    const signInHref = `/auth?returnTo=${encodeURIComponent(returnTo)}`;

    if (redirectImmediately) {
      return <Navigate to={signInHref} replace />;
    }

    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-5">
        {/* Cahaya latar: ungu sangat redup di atas, hitam pekat di bawah. */}
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden
          style={{
            background:
              "radial-gradient(760px 420px at 50% -10%, oklch(0.42 0.18 295 / 0.35), transparent 70%), linear-gradient(180deg, oklch(0.16 0.03 285), oklch(0.12 0.02 280) 60%, oklch(0.1 0.015 280))",
          }}
        />
        <section className="pop-enter relative w-full max-w-sm">
          <div className="rounded-3xl border border-white/10 bg-black/45 p-6 shadow-2xl backdrop-blur-xl">
            <div className="flex flex-col items-center text-center">
              <span className="flex size-14 items-center justify-center rounded-2xl border border-white/12 bg-white/5">
                <img src={logo} alt="" className="size-7" />
              </span>

              <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.28em] text-primary/80">
                YoruNime
              </p>
              <h1 className="mt-1.5 text-lg font-bold leading-tight">{title}</h1>
              <p className="mt-1.5 max-w-[17rem] text-[12px] leading-relaxed text-muted-foreground">
                {description}
              </p>

              <p className="mt-4 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Sparkles className="size-3.5 text-amber-300" />
                Setelah masuk, kamu balik lagi ke halaman ini.
              </p>

              <button
                onClick={() => navigate(signInHref)}
                className="mt-5 flex w-full items-center justify-center gap-1.5 rounded-2xl bg-primary py-3 text-sm font-bold text-primary-foreground transition hover:brightness-110"
              >
                Masuk ke YoruNime
                <ArrowRight className="size-4" />
              </button>

              <button
                onClick={() => navigate("/")}
                className="mt-2 w-full rounded-2xl py-2.5 text-xs font-semibold text-muted-foreground transition hover:bg-white/5 hover:text-foreground"
              >
                Balik ke beranda
              </button>
            </div>
          </div>

          <p className="mt-4 text-center text-[10px] text-muted-foreground/70">
            streaming anime, manhwa & manga subtitle Indonesia
          </p>
        </section>
      </main>
    );
  }

  return children;
}
