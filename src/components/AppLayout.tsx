import { useAuth } from "@/hooks/use-auth";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Avatar, BlueCheck, LevelBadge, ClanTag } from "@/components/lstream-ui";
import {
  Home,
  CalendarDays,
  UserRound,
  Heart,
  Bell,
  ChevronRight,
  Crown,
  Gem,
} from "lucide-react";
import { useNavigate, useLocation } from "react-router";
import { cn } from "@/lib/utils";
import { displayId, xpForLevel } from "@/lib/level";
import type { ComponentType, ReactNode } from "react";

export function AppLayout({
  children,
  hideAccountPanel,
}: {
  children: ReactNode;
  hideAccountPanel?: boolean;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const ensure = useMutation(api.account.ensureUser);

  useEffect(() => {
    if (user) void ensure();
  }, [user, ensure]);

  const isAuth = location.pathname.startsWith("/auth");
  if (isAuth) return <>{children}</>;

  // Panel akun hanya muncul di Home — screen lain bebas dari panel.
  const showPanel = !hideAccountPanel && location.pathname === "/";

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-3 pb-32">
      {showPanel && user && (
        <AccountPanel
          onOpen={() => navigate("/akun")}
          name={user.username ?? "user"}
          seqId={user.seqId}
          id={user._id}
          image={user.image}
          level={user.level ?? 1}
          xp={user.xp ?? 0}
          staffRole={user.staffRole}
          bannerUrl={user.bannerUrl}
          clanTag={user.clanTag}
          clanTagIcon={user.clanTagIcon}
          clanColor={user.clanNameColor}
          premium={(user.premiumUntil ?? 0) > Date.now()}
          premiumDays={Math.max(
            0,
            Math.floor(((user.premiumUntil ?? 0) - Date.now()) / 86400000),
          )}
          diamonds={user.diamonds ?? 0}
        />
      )}
      {/* Animasi halus setiap kali layar berpindah */}
      <div key={location.pathname} className="screen-enter flex-1">
        {children}
      </div>
      <BottomNav />
      <MiniPlayerHost />
    </div>
  );
}

// ------------------------------------------------------ panel akun ----

function AccountPanel({
  onOpen,
  name,
  seqId,
  id,
  image,
  level,
  xp,
  staffRole,
  bannerUrl,
  clanTag,
  clanTagIcon,
  clanColor,
  premium,
  premiumDays,
  diamonds,
}: {
  onOpen: () => void;
  name: string;
  seqId?: number;
  id: string;
  image?: string;
  level: number;
  xp: number;
  staffRole?: string;
  bannerUrl?: string;
  clanTag?: string;
  clanTagIcon?: string;
  clanColor?: string;
  premium: boolean;
  premiumDays: number;
  diamonds: number;
}) {
  const cost = xpForLevel(level);
  const inLevel = Math.max(0, Math.min(xp, cost));
  const pct = Math.min(100, (inLevel / Math.max(1, cost)) * 100);
  return (
    <div className="pop-enter relative mt-3 w-full">
      {/* Tombol notifikasi bulat kanan atas */}
      <NotifButton />
      <button
        onClick={onOpen}
        className="block w-full overflow-hidden rounded-2xl border border-white/10 text-left"
        style={
          bannerUrl
            ? {
                backgroundImage: `url(${bannerUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : undefined
        }
      >
        {!bannerUrl && <div className="bg-hero-gradient absolute inset-0" />}
        <div className="relative bg-black/45 p-3">
          <div className="flex items-center gap-3">
            <Avatar src={image} seed={name} className="size-14" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="truncate font-bold">{name}</p>
                {premium && <BlueCheck />}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                <LevelBadge level={level} />
                {staffRole && (
                  <span className="rounded bg-black/40 px-1.5 py-0.5 text-[10px] font-bold uppercase text-gold">
                    {staffRole}
                  </span>
                )}
                <span className="text-[11px] text-zinc-400">
                  ID: {displayId(seqId, id)}
                </span>
              </div>
              {clanTag && (
                <span className="mt-1 inline-block">
                  <ClanTag icon={clanTagIcon ?? "⚔️"} tag={clanTag} color={clanColor} />
                </span>
              )}
            </div>
            <ChevronRight className="size-5 shrink-0 text-zinc-500" />
          </div>

          {/* Bar level: kiri "Level n", kanan "1/12.000" */}
          <div className="mt-2.5">
            <div className="mb-1 flex items-center justify-between text-[11px]">
              <span className="font-semibold text-foreground">Level {level}</span>
              <span className="text-zinc-400">
                {inLevel.toLocaleString("id-ID")}/{cost.toLocaleString("id-ID")}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-black/50">
              <div
                className="h-full rounded-full bg-gradient-to-r from-red-600 to-red-400"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* Garis pembatas putih transparan */}
          <div className="my-2.5 h-px bg-white/25" />

          {/* Total diamond + sisa hari premium */}
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5 font-semibold text-cyan-300">
              <Gem className="size-3.5" /> {diamonds.toLocaleString("id-ID")}
            </span>
            {premium && (
              <span className="flex items-center gap-1.5 font-semibold text-gold">
                <Crown className="size-3.5" /> {premiumDays} hari
              </span>
            )}
          </div>
        </div>
      </button>
    </div>
  );
}

function NotifButton() {
  const navigate = useNavigate();
  return (
    <button
      aria-label="Notifikasi"
      onClick={() => navigate("/akun?tab=notif")}
      className="absolute -top-1 right-0 z-10 flex size-10 items-center justify-center rounded-full border border-white/15 bg-black/70 text-foreground shadow-lg transition hover:border-red-500/60"
    >
      <Bell className="size-4.5" />
    </button>
  );
}

// ------------------------------------------------------ mini player ----

type MiniState = {
  animeId: string;
  animeTitle: string;
  animeImage?: string;
  episodeNumber?: number;
  streamUrl: string;
  isEmbed: boolean;
};

let miniListeners: ((s: MiniState | null) => void)[] = [];
let miniCurrent: MiniState | null = null;
export function setMiniPlayer(s: MiniState | null) {
  miniCurrent = s;
  miniListeners.forEach((l) => l(s));
}
export function getMiniPlayer() {
  return miniCurrent;
}
function useMiniPlayer() {
  return useSyncExternalStore(
    (cb) => {
      miniListeners.push(cb);
      return () => {
        miniListeners = miniListeners.filter((l) => l !== cb);
      };
    },
    () => miniCurrent,
    () => miniCurrent,
  );
}

export function MiniPlayerHost() {
  const state = useMiniPlayer();
  const navigate = useNavigate();
  const [playing, setPlaying] = useState(true);
  const [size, setSize] = useState({ w: 250, h: 175 });
  const [pos, setPos] = useState({ x: 14, y: 90 });
  const [drag, setDrag] = useState<{ dx: number; dy: number } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  if (!state) return null;

  const toggle = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play();
    else v.pause();
  };

  return (
    <div
      className="fixed z-[60] overflow-hidden rounded-xl border border-red-500/50 shadow-2xl"
      style={{ left: pos.x, top: pos.y, width: size.w, height: size.h }}
      onMouseDown={(e) => setDrag({ dx: e.clientX - pos.x, dy: e.clientY - pos.y })}
      onMouseMove={(e) => {
        if (!drag) return;
        setPos({
          x: Math.max(0, Math.min(window.innerWidth - size.w - 8, e.clientX - drag.dx)),
          y: Math.max(0, Math.min(window.innerHeight - size.h - 8, e.clientY - drag.dy)),
        });
      }}
      onMouseUp={() => setDrag(null)}
      onMouseLeave={() => setDrag(null)}
    >
      <div className="relative size-full bg-black">
        {state.isEmbed ? (
          <iframe
            src={state.streamUrl}
            title="mini"
            className="pointer-events-none size-full"
            allow="autoplay; encrypted-media; fullscreen"
            allowFullScreen
          />
        ) : (
          <video
            ref={videoRef}
            src={state.streamUrl}
            className="pointer-events-none size-full object-contain"
            autoPlay
            muted={false}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
          />
        )}
        {/* Kontrol overlay */}
        <div className="absolute inset-0 flex flex-col justify-between">
          <div className="flex items-start justify-between p-1">
            <button
              className="rounded-full bg-black/60 p-1"
              aria-label="Perbesar"
              onClick={() => {
                setMiniPlayer(null);
                navigate(`/nonton?anime=${state.animeId}${state.episodeNumber ? `&ep=${state.episodeNumber}` : ""}`);
              }}
            >
              <Maximize2 className="size-3.5 text-white" />
            </button>
            <button
              className="rounded-full bg-black/60 p-1"
              aria-label="Tutup mini player"
              onClick={() => setMiniPlayer(null)}
            >
              <X className="size-3.5 text-white" />
            </button>
          </div>
          {/* Pause / play */}
          <button
            className="mx-auto flex size-10 items-center justify-center rounded-full bg-black/55 text-white"
            aria-label={playing ? "Pause" : "Play"}
            onClick={toggle}
          >
            {playing ? <Pause className="size-5" /> : <Play className="size-5" />}
          </button>
          {/* Grip resize kiri bawah */}
          <div className="flex items-end justify-between p-1">
            <div
              className="grip-lines size-5 cursor-nwse-resize rounded"
              onDoubleClick={() => setSize((s) => ({ w: 250, h: 175 }))}
              onMouseDown={(e) => {
                e.stopPropagation();
                const start = { x: e.clientX, y: e.clientY, w: size.w, h: size.h };
                const move = (ev: MouseEvent) => {
                  setSize({
                    w: Math.max(180, Math.min(460, start.w + (ev.clientX - start.x))),
                    h: Math.max(130, Math.min(340, start.h + (ev.clientY - start.y))),
                  });
                };
                const up = () => {
                  window.removeEventListener("mousemove", move);
                  window.removeEventListener("mouseup", up);
                };
                window.addEventListener("mousemove", move);
                window.addEventListener("mouseup", up);
              }}
            />
            <span className="pointer-events-none max-w-[70%] truncate text-[9px] text-white/70">
              {state.animeTitle}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------ bottom nav ----

function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const items: { path: string; label: string; icon: ComponentType<{ className?: string }> }[] = [
    { path: "/", label: "Home", icon: Home },
    { path: "/jadwal", label: "Jadwal", icon: CalendarDays },
    { path: "/akun?tab=favorite", label: "Favorite", icon: Heart },
    { path: "/akun", label: "Akun", icon: UserRound },
  ];
  return (
    <>
      {/* Footer hitam pipih di paling bawah */}
      <footer className="fixed inset-x-0 bottom-0 z-30 bg-black py-1.5 text-center text-[10px] text-zinc-500">
        LStream © {new Date().getFullYear()} — Nonton anime sub Indonesia
      </footer>
      {/* Navbar lurus full-width, solid */}
      <nav className="nav-bar fixed inset-x-0 bottom-6 z-40">
        <div className="mx-auto grid w-full max-w-2xl grid-cols-4">
          {items.map((it) => {
            const base = it.path.split("?")[0];
            const active =
              base === "/"
                ? location.pathname === "/" || location.pathname.startsWith("/dashboard")
                : location.pathname.startsWith(base);
            const Icon = it.icon;
            return (
              <button
                key={it.path}
                onClick={() => navigate(it.path)}
                className="nav-item relative flex flex-col items-center gap-0.5 py-2"
              >
                <Icon
                  className={cn(
                    "size-[22px]",
                    active ? "text-red-400" : "text-zinc-500",
                  )}
                />
                <span
                  className={cn(
                    "text-[10px] font-medium",
                    active ? "text-foreground" : "text-zinc-500",
                  )}
                >
                  {it.label}
                </span>
                {active && (
                  <span className="absolute inset-x-7 top-0 h-0.5 rounded-full bg-red-500" />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}

export function useAccountBannerStyle(bannerUrl?: string) {
  return bannerUrl
    ? {
        backgroundImage: `url(${bannerUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : undefined;
}
