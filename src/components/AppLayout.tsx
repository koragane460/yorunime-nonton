import { useAuth } from "@/hooks/use-auth";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Avatar, BlueCheck, LevelBadge, ClanTag } from "@/components/lstream-ui";
import {
  Home,
  CalendarDays,
  UserRound,
  Info,
  Bell,
  ChevronRight,
  Crown,
  Gem,
  Maximize,
  Pause,
  Play,
  X,
  BookOpen,
  PanelsTopLeft,
} from "lucide-react";
import { useNavigate, useLocation } from "react-router";
import { cn } from "@/lib/utils";
import { displayId, usernameColor } from "@/lib/lstream";
import { xpForLevel } from "@/lib/level";
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

  // Panel akun hanya muncul di Home (route app = /home; "/" hanya landing publik).
  const isHome =
    location.pathname === "/home" ||
    location.pathname === "/" ||
    location.pathname.startsWith("/dashboard");
  const showPanel = !hideAccountPanel && isHome && location.pathname === "/home";

  return (
    <div className="flex min-h-dvh w-full flex-col items-center">
      {showPanel && user && (
        <div className="w-full max-w-md bg-background px-4 md:max-w-2xl lg:max-w-4xl">
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
        </div>
      )}
      {/* Animasi halus setiap kali layar berpindah — konten terpusat di PC */}
      <div
        key={location.pathname}
        className="screen-enter flex w-full max-w-md flex-1 flex-col px-4 md:max-w-2xl lg:max-w-4xl"
      >
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
  const goto = useNavigate();
  return (
    <div className="pop-enter relative mt-3 w-full">
      {/* Tombol notifikasi — kecil, di samping kanan panel, sejajar */}
      <button
        aria-label="Notifikasi"
        onClick={() => goto("/akun?tab=notif")}
        className="absolute right-2 top-2 z-10 flex size-8 items-center justify-center rounded-full border border-white/20 bg-black/70 text-white shadow transition hover:border-violet-400"
      >
        <Bell className="size-3.5 text-white" />
      </button>
      <button
        onClick={onOpen}
        className="block w-full overflow-hidden rounded-2xl border border-white/15 text-left"
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
                <p
                  key={name}
                  className={cn("truncate font-bold", usernameColor(name))}
                >
                  {name}
                </p>
                {premium && <BlueCheck />}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                <LevelBadge level={level} />
                <span className="text-[11px] text-zinc-400">
                  ID: {displayId(seqId, id)}
                </span>
              </div>
            </div>
            <ChevronRight className="size-5 shrink-0 text-zinc-400" />
          </div>

          {/* Bar level: kiri "Level n", kanan "1/12.000" */}
          <div className="mt-2.5">
            <div className="mb-1 flex items-center justify-between text-[11px]">
              <span className="font-semibold text-white">Level {level}</span>
              <span className="text-zinc-400">
                {inLevel.toLocaleString("id-ID")}/{cost.toLocaleString("id-ID")}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-black/60">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-600 to-violet-400"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* Garis pembatas putih transparan */}
          <div className="my-2.5 h-px bg-white/25" />

          {/* Total Sacret + sisa hari premium */}
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5 font-semibold text-cyan-300">
              <Gem className="size-3.5" /> {diamonds.toLocaleString("id-ID")} Sacret
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

// ------------------------------------------------- overlay visibility ----

/**
 * State global: overlay screen (Chat, Leaderboard, Detail, Clan chat, dll)
 * sedang terbuka → navbar & mini player disembunyikan TOTAL, bukan cuma
 * ditumpuk z-index. Sehingga tidak ada lagi elemen "nyempil" di bawah screen.
 */
let overlayListeners: ((v: boolean) => void)[] = [];
let overlayOpen = false;
export function setAppOverlayOpen(v: boolean) {
  if (overlayOpen === v) return;
  overlayOpen = v;
  overlayListeners.forEach((l) => l(v));
}
function useAppOverlayOpen() {
  return useSyncExternalStore(
    (cb) => {
      overlayListeners.push(cb);
      return () => {
        overlayListeners = overlayListeners.filter((l) => l !== cb);
      };
    },
    () => overlayOpen,
    () => overlayOpen,
  );
}

/** Hook untuk layar fullscreen: sembunyikan navbar saat mounted. */
export function useHideNavOnMount() {
  useEffect(() => {
    setAppOverlayOpen(true);
    return () => setAppOverlayOpen(false);
  }, []);
}

/** Sembunyikan navbar selama `active` true (untuk screen buka-tutup, bukan mount-once). */
export function useHideNavWhile(active: boolean) {
  useEffect(() => {
    if (!active) return;
    setAppOverlayOpen(true);
    return () => setAppOverlayOpen(false);
  }, [active]);
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
  const location = useLocation();
  const [playing, setPlaying] = useState(true);
  // Ukuran compact: tidak menutupi konten di HP, tetap comfy di tablet/PC.
  const [size] = useState(() =>
    typeof window !== "undefined" && window.innerWidth >= 640
      ? { w: 210, h: 140 }
      : { w: 164, h: 108 },
  );
  const [pos, setPos] = useState({ x: 14, y: 100 });
  // UI mini player: tap layar → UI disembunyikan (video tetap jalan).
  // Muncul lagi kalau video dijeda atau user mengetuk dua kali.
  const [uiOn, setUiOn] = useState(true);
  const lastTapRef = useRef(0);
  // Drag: pakai pointer event (mouse + sentuh), tap tanpa geser = buka episode.
  const drag = useRef<{
    id: number;
    dx: number;
    dy: number;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Mini player tetap hidup di semua layar (tidak ikut hilang saat screen
  // overlay dibuka); hanya disembunyikan di halaman Nonton & reader komik.
  if (
    !state ||
    location.pathname.startsWith("/nonton") ||
    location.pathname.startsWith("/baca")
  )
    return null;

  const toggle = () => {
    const v = videoRef.current;
    if (!v) return;
    setUiOn(true);
    if (v.paused) void v.play();
    else v.pause();
  };

  return (
    <div
      className="fixed z-[60] touch-none overflow-hidden rounded-xl border border-violet-500/50 shadow-2xl"
      style={{ left: pos.x, top: pos.y, width: size.w, height: size.h }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = {
          id: e.pointerId,
          dx: e.clientX - pos.x,
          dy: e.clientY - pos.y,
          startX: e.clientX,
          startY: e.clientY,
          moved: false,
        };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d || d.id !== e.pointerId) return;
        if (Math.abs(e.clientX - d.startX) > 4 || Math.abs(e.clientY - d.startY) > 4)
          d.moved = true;
        if (!d.moved) return;
        setPos({
          x: Math.max(
            0,
            Math.min(window.innerWidth - size.w - 8, e.clientX - d.dx),
          ),
          y: Math.max(
            0,
            Math.min(window.innerHeight - size.h - 8, e.clientY - d.dy),
          ),
        });
      }}
      onPointerUp={(e) => {
        const d = drag.current;
        drag.current = null;
        if (!d || d.moved) return;
        // Ketuk ganda dalam 300ms → buka layar nonton episode ini.
        const now = Date.now();
        if (now - lastTapRef.current < 300) {
          lastTapRef.current = 0;
          setUiOn(true);
          navigate(
            `/nonton?anime=${state.animeId}${state.episodeNumber ? `&ep=${state.episodeNumber}` : ""}`,
          );
          return;
        }
        lastTapRef.current = now;
        // Ketuk tunggal → UI sembunyi / tampil.
        setUiOn((v) => !v);
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
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
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
          />
        )}
        {/* Kontrol overlay: hanya saat UI belum disembunyikan lewat tap */}
        <div
          className={cn(
            "pointer-events-none absolute inset-0 flex flex-col justify-between transition-opacity",
            uiOn ? "opacity-100" : "opacity-0",
          )}
        >
          <div className="flex items-start justify-between p-1">
            <span className="max-w-[75%] truncate rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold text-white/85">
              {state.animeTitle}
              {state.episodeNumber ? ` · Ep ${state.episodeNumber}` : ""}
            </span>
            <div className="flex items-center gap-1">
              <button
                className="pointer-events-auto rounded-full bg-black/60 p-1"
                aria-label="Perbesar"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  setUiOn(true);
                  navigate(
                    `/nonton?anime=${state.animeId}${state.episodeNumber ? `&ep=${state.episodeNumber}` : ""}`,
                  );
                }}
              >
                <Maximize className="size-3.5 text-white" />
              </button>
              <button
                className="pointer-events-auto rounded-full bg-black/60 p-1"
                aria-label="Tutup mini player"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => setMiniPlayer(null)}
              >
                <X className="size-3.5 text-white" />
              </button>
            </div>
          </div>
          <button
            className="pointer-events-auto mx-auto flex size-9 items-center justify-center rounded-full bg-black/55 text-white"
            aria-label={playing ? "Pause" : "Play"}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={toggle}
          >
            {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------ bottom nav ----

function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const overlay = useAppOverlayOpen();
  // Tekan lama tombol Home (~550ms) → muncul 2 pilihan Manga / Manhwa di atasnya.
  const [switcher, setSwitcher] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fired = useRef(false);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  // Tutup switcher saat pindah halaman.
  useEffect(() => {
    setSwitcher(false);
  }, [location.pathname]);

  if (overlay) return null;
  const items: { path: string; label: string; icon: ComponentType<{ className?: string }> }[] = [
    { path: "/home", label: "Home", icon: Home },
    { path: "/jadwal", label: "Jadwal", icon: CalendarDays },
    { path: "/info", label: "Info", icon: Info },
    { path: "/akun", label: "Akun", icon: UserRound },
  ];

  const startHold = (path: string) => {
    fired.current = false;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      fired.current = true;
      setSwitcher(true);
      if (navigator.vibrate) navigator.vibrate(12);
    }, 550);
    // Prevent default supaya browser tidak_NS_treat sebagai klik ganda.
    void path;
  };
  const cancelHold = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const onClickItem = (path: string) => {
    if (fired.current) {
      fired.current = false;
      cancelHold();
      return;
    }
    navigate(path);
  };

  return (
    <>
      {/* Pilihan Manga / Manhwa — muncul di atas tombol Home setelah ditekan lama */}
      {switcher && (
        <>
          <button
            aria-label="Tutup pilihan"
            className="fixed inset-0 z-40"
            onClick={() => setSwitcher(false)}
          />
          <div className="pop-enter fixed inset-x-0 bottom-[68px] z-50 mx-auto w-full max-w-md px-6 md:max-w-2xl lg:max-w-4xl">
            <div className="overflow-hidden rounded-2xl border border-violet-500/40 bg-background/95 shadow-2xl backdrop-blur">
              <p className="px-4 pt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Ganti kategori
              </p>
              <div className="grid grid-cols-2 gap-2 p-3">
                {(
                  [
                    ["/manga", "Manga", BookOpen, "Baca kanan ke kiri"],
                    ["/manhwa", "Manhwa", PanelsTopLeft, "Gaya webtoon"],
                  ] as const
                ).map(([path, label, Icon, sub]) => {
                  const active = location.pathname.startsWith(path);
                  return (
                    <button
                      key={path}
                      onClick={() => {
                        setSwitcher(false);
                        navigate(path);
                      }}
                      className={cn(
                        "flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition",
                        active
                          ? "border-violet-500 bg-violet-500/15"
                          : "border-border hover:border-violet-500/60",
                      )}
                    >
                      <span className="flex items-center gap-1.5 text-sm font-bold">
                        <Icon className="size-4 text-violet-300" /> {label}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{sub}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
      {/* Navbar lurus full-width, solid — tanpa footer teks */}
      <nav className="nav-bar fixed inset-x-0 bottom-0 z-40">
        <div className="mx-auto grid w-full max-w-md grid-cols-4 md:max-w-2xl lg:max-w-4xl">
          {items.map((it) => {
            const base = it.path.split("?")[0];
            const active =
              base === "/home"
                ? location.pathname === "/home" || location.pathname === "/"
                : location.pathname.startsWith(base);
            const isHome = base === "/home";
            const Icon = it.icon;
            return (
              <button
                key={it.path}
                onPointerDown={() => (isHome ? startHold(it.path) : undefined)}
                onPointerUp={cancelHold}
                onPointerLeave={cancelHold}
                onPointerCancel={cancelHold}
                onContextMenu={(e) => isHome && e.preventDefault()}
                onClick={() => onClickItem(it.path)}
                className="nav-item relative flex flex-col items-center gap-0.5 py-2"
              >
                <Icon
                  className={cn("size-[22px]", active ? "text-violet-400" : "text-zinc-500")}
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
                  <span className="absolute inset-x-7 top-0 h-0.5 rounded-full bg-violet-500" />
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
