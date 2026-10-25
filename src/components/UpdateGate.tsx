import React, { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { RefreshCw, Wifi, Gauge } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";

/**
 * Error boundary khusus query versi — kalau useQuery(appVersion) melempar
 * (server error / deploy belum sinkron), app TETAP jalan tanpa gerbang
 * update, bukan blank ke layar "Preview runtime error".
 */
class VersionBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: Error) {
    console.warn("[UpdateGate] Query versi gagal — lanjut tanpa gate:", err.message);
  }
  render() {
    // Gagal → render app mentah tanpa gerbang update (jangan render ulang
    // gate-nya, karena itu yang tadi melempar).
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

/** Bandingkan versi "1.2.3" dengan versi minimum dari server. */
function isOlderThan(current: string, min: string) {
  if (!min) return false;
  const parse = (v: string) =>
    v
      .replace(/^v/i, "")
      .split(/[.\-+]/)
      .map((n) => Number(n))
      .map((n) => (Number.isFinite(n) ? n : 0));
  const a = parse(current);
  const b = parse(min);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x < y;
  }
  return false;
}

/** Versi build aplikasi ini. Naikin kalau kamu rilis versi baru. */
const APP_VERSION = "1.0.0";

/**
 * Gerbang update.
 *
 * Kalau versi minimum di server lebih besar dari versi app ini, seluruh
 * aplikasi ditutupi layar "wajib update". Ini yang bikin user langsung
 * dapat versi baru begitu membuka app, tanpa harusupdate manual.
 */
function VersionGate({ children }: { children: React.ReactNode }) {
  const version = useQuery(api.moderation.appVersion, {});
  const [dismissed, setDismissed] = useState<string | null>(null);

  const min = version?.minVersion ?? "";
  // Kalau versi sama persis dengan yang tadi sudah ditolak, jangan muncul
  // lagi di sesi ini (biar user bisa tetap lanjut).
  const blocked = isOlderThan(APP_VERSION, min) && dismissed !== min;

  useEffect(() => {
    if (!version) return;
    if (!isOlderThan(APP_VERSION, version.minVersion)) setDismissed(null);
  }, [version]);

  if (!blocked) return <>{children}</>;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-5 bg-background px-8 text-center">
      <div className="flex size-14 items-center justify-center rounded-lg border border-border">
        <RefreshCw className="size-6 text-primary" />
      </div>
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl leading-tight tracking-tight">
          Wajib update dulu
        </h1>
        <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">
          Versi kamu masih {APP_VERSION}, minimal {min}. Tutup app dulu
          lalu buka lagi biar versinya kebarik.
        </p>
      </div>
      <button
        onClick={() => window.location.reload()}
        className="h-11 rounded-lg bg-primary px-6 text-sm font-bold text-primary-foreground"
      >
        Muat ulang sekarang
      </button>
      <button
        onClick={() => setDismissed(min)}
        className="h-10 text-xs text-muted-foreground underline underline-offset-4"
      >
        Lanjut saja dulu
      </button>
    </div>
  );
}

/** Gerbang update yang dibungkus boundary — query gagal = tetap jalan. */
export function UpdateGate({ children }: { children: React.ReactNode }) {
  return (
    <VersionBoundary fallback={children}>
      <VersionGate>{children}</VersionGate>
    </VersionBoundary>
  );
}

/**
 * Indikator "Jaringan YoruNime".
 *
 * Cuma muncul buat akun developer. Angkanya indikator ambience, bukan
 * speedtest, jadi tidak menambah request ke server.
 */
export function NetBadge() {
  const net = useQuery(api.moderation.netStatus, "skip");
  if (!net) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background/60 px-2 py-1 font-mono text-[10px] text-muted-foreground">
      <Wifi className="size-3 text-primary" />
      {net.label}
      <span className="text-foreground">{net.downMbps} Mbps</span>
      <span className="inline-flex items-center gap-0.5">
        <Gauge className="size-2.5" />
        {net.pingMs}ms
      </span>
    </span>
  );
}