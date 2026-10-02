import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { AlarmClock, ShieldAlert, VolumeX } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type BlockStatus =
  | {
      type: "banned" | "muted";
      permanent: boolean;
      until: number;
      reason: string;
    }
  | null;

type ModState = {
  status: BlockStatus;
  /** true kalau user sedang dimute (bisa lihat, tapi tidak bisa kirim). */
  muted: boolean;
  banned: boolean;
  refresh: () => void;
};

const Ctx = createContext<ModState>({
  status: null,
  muted: false,
  banned: false,
  refresh: () => {},
});

export function useModeration() {
  return useContext(Ctx);
}

const ackKey = (s: NonNullable<BlockStatus>) =>
  `yn_ack_${s.type}_${s.until}`;

const readAck = (s: NonNullable<BlockStatus>) => {
  try {
    return localStorage.getItem(ackKey(s)) === "1";
  } catch {
    return false;
  }
};
const writeAck = (s: NonNullable<BlockStatus>) => {
  try {
    localStorage.setItem(ackKey(s), "1");
  } catch {
    /* storage penuh / diblokir — popup tetap muncul */
  }
};

/** "2 hari 3 jam 12 menit" */
export function remainingText(until: number) {
  let ms = Math.max(0, until - Date.now());
  const d = Math.floor(ms / 86_400_000);
  ms -= d * 86_400_000;
  const h = Math.floor(ms / 3_600_000);
  ms -= h * 3_600_000;
  const m = Math.floor(ms / 60_000);
  const s = Math.floor((ms - m * 60_000) / 1000);
  const parts: string[] = [];
  if (d) parts.push(`${d} hari`);
  if (h) parts.push(`${h} jam`);
  if (m) parts.push(`${m} menit`);
  if (!parts.length) parts.push(`${s} detik`);
  return parts.join(" ");
}

/**
 * Mengambil status ban/mute user dan menampilkan popup fullscreen bila
 * Indeedi kena ban atau mute. Popup ban memaksa user logout setelah menekan
 * "Mengerti"; popup mute hanya mengunci kolom chat sampai waktunya habis.
 */
export function ModerationProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, signOut } = useAuth();
  const status = useQuery(
    api.moderation.blockStatus,
    isAuthenticated ? {} : "skip",
  ) as BlockStatus | undefined;
  // Bikin komponen ikut ber-render tiap detik supaya hitung mundur jalan.
  const [, setTick] = useState(0);
  const [acked, setAcked] = useState(true);

  useEffect(() => {
    if (!status) {
      setAcked(true);
      return;
    }
    setAcked(readAck(status));
  }, [status?.type, status?.until]);

  useEffect(() => {
    if (!status) return;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [status?.type, status?.until]);

  const refresh = useCallback(() => {
    setAcked(status ? readAck(status) : true);
  }, [status]);

  const value = useMemo<ModState>(
    () => ({
      status: status ?? null,
      muted: status?.type === "muted",
      banned: status?.type === "banned",
      refresh,
    }),
    [status, refresh],
  );

  const show = !!status && !acked;

  return (
    <Ctx.Provider value={value}>
      {children}
      {show && status && <BlockPopup status={status} onAck={() => {
        writeAck(status);
        setAcked(true);
        if (status.type === "banned") void signOut();
      }} />}
    </Ctx.Provider>
  );
}

function BlockPopup({
  status,
  onAck,
}: {
  status: NonNullable<BlockStatus>;
  onAck: () => void;
}) {
  const banned = status.type === "banned";
  const Icon = banned
    ? status.permanent
      ? ShieldAlert
      : AlarmClock
    : VolumeX;

  const accent = banned
    ? "from-red-500/25 via-rose-500/10 to-transparent"
    : "from-zinc-400/25 via-zinc-500/10 to-transparent";
  const ring = banned
    ? "border-red-500/40 shadow-[0_0_60px_-10px_rgba(239,68,68,0.6)]"
    : "border-zinc-400/40 shadow-[0_0_60px_-10px_rgba(161,161,170,0.5)]";
  const iconCls = banned ? "text-red-400" : "text-zinc-300";

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center overflow-y-auto bg-black/85 p-5 backdrop-blur-md">
      <div
        className={`fade-enter relative w-full max-w-sm overflow-hidden rounded-3xl border bg-card bg-gradient-to-b ${accent} ${ring}`}
      >
        <div className="relative z-[1] flex flex-col items-center px-6 py-9 text-center">
          <div
            className={`flex size-24 items-center justify-center rounded-full border border-white/10 bg-black/60 ${iconCls}`}
          >
            <Icon className="size-12" strokeWidth={1.6} />
          </div>

          <h2 className="mt-5 text-xl font-black tracking-tight">
            {banned ? "Akun kamu dibanned" : "Kamu sedang dimute"}
          </h2>

          <p className="mt-1.5 text-sm font-semibold text-muted-foreground">
            {status.permanent
              ? "Permanen — selamanya"
              : `Sisa waktu: ${remainingText(status.until)}`}
          </p>

          {status.reason && (
            <p className="mt-4 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm leading-relaxed">
              {status.reason}
            </p>
          )}

          <Button
            onClick={onAck}
            className="mt-6 w-full rounded-full bg-primary py-2.5 font-bold text-white hover:bg-primary"
          >
            Mengerti
          </Button>

          {banned && (
            <p className="mt-3 text-[11px] text-muted-foreground">
              Kamu akan keluar dari akun ini.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
