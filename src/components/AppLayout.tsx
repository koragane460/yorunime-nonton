import { useAuth } from "@/hooks/use-auth";
import { useAction, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Avatar, BlueCheck, LevelBadge, ClanTag, TitleBadge } from "@/components/lstream-ui";
import { DEFAULT_CLAN_ICON } from "@/lib/clanIcons";
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
  Settings,
  Pause,
  Play,
  X,
  BookOpen,
  PanelsTopLeft,
  
} from "lucide-react";
import { useNavigate, useLocation } from "react-router";
import { cn } from "@/lib/utils";
import { displayId, usernameColor } from "@/lib/lstream";
import { AnnouncementPopup } from "@/components/AnnouncementPopup";
import { applyAntiLag, getAntiLag } from "@/lib/antilag";
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

  // Mode Anti lag dari Pengaturan: berlaku di seluruh halaman.
  useEffect(() => {
    applyAntiLag(getAntiLag());
  }, []);

  const isAuth = location.pathname.startsWith("/auth");
  if (isAuth) return <>{children}</>;

  // Panel akun hanya muncul di Home (route app = /home; "/" hanya landing publik).
  const isHome =
    location.pathname === "/home" ||
    location.pathname === "/" ||
    location.pathname.startsWith("/dashboard");
  const showPanel = !hideAccountPanel && isHome && location.pathname === "/home";

  return (
    <div className="yn-app-bg flex min-h-dvh w-full flex-col items-center">
      {showPanel && user && (
        <div className="w-full px-4 md:mx-auto md:max-w-2xl md:px-6 lg:max-w-4xl">
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
      {/* Konten full-bleed di HP; di desktop (md+) konten tetap di tengah biar
          enak dibaca. Tidak ada lagi kolom kosong di kanan layar HP. */}
      <div
        key={location.pathname}
        className="screen-enter w-full flex-1 md:mx-auto md:max-w-2xl lg:max-w-4xl"
      >
        <div className="px-4 md:px-6">{children}</div>
      </div>
      <BottomNav />
      <MiniPlayerHost />
      <OverlayScrollLock />
      <AnnouncementPopup />
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
    <div className="yn-banner-box pop-enter relative mt-3 w-full rounded-2xl border border-white/15">
      {/* Dua tombol aksi di pojok kanan: Pengaturan lalu Notifikasi.
          Keduanya di luar area teks supaya tidak saling nimpa. */}
      <div className="absolute right-2.5 top-2.5 z-10 flex items-center gap-1.5">
        <button
          aria-label="Pengaturan"
          onClick={() => goto("/akun?tab=settings")}
          className="flex size-9 items-center justify-center rounded-xl border border-white/15 bg-black/45 text-white backdrop-blur-sm transition hover:border-foreground"
        >
          <Settings className="size-4" />
        </button>
        <button
          aria-label="Notifikasi"
          onClick={() => goto("/akun?tab=notif")}
          className="flex size-9 items-center justify-center rounded-xl border border-white/15 bg-black/45 text-white backdrop-blur-sm transition hover:border-foreground"
        >
          <Bell className="size-4" />
        </button>
      </div>
      <button onClick={onOpen} className="block w-full text-left"
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
        {!bannerUrl && <div className="yn-banner absolute inset-0" />}
        {/* Banner terpasang: lapisan gelap penuh di atas foto, jadi tidak ada
            sisa warna cerah yang menerawang dari kiri. */}
        {bannerUrl && <div className="yn-banner-veil" />}
        <div className="relative p-3">
          <div className="flex items-center gap-3">
            <div className="yn-avatar-ring shrink-0">
              <div className="rounded-full bg-background p-[2px]">
                <Avatar src={image} seed={name} className="size-14" />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p
                  key={name}
                  className={cn("truncate font-bold", usernameColor(name))}
                >
                  {name}
                </p>
                {premium && <BlueCheck />}
                <TitleBadge role={staffRole} compact />
              </div>
              <p className="text-[11px] text-zinc-400">
                ID: {displayId(seqId, id)}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <LevelBadge level={level} />
                {clanTag && (
                  <ClanTag
                    icon={clanTagIcon ?? DEFAULT_CLAN_ICON}
                    tag={clanTag}
                    className="scale-90 px-1.5 py-0 text-[9px]"
                  />
                )}
              </div>
            </div>
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
                className="h-full rounded-full bg-primary"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* Garis pembatas tipis */}
          <div className="my-2.5 h-px bg-white/15" />

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
/**
 * Sambil overlay (layar fullscreen) terbuka: hentikan scroll halaman di
 * belakang tanpa mengubah posisinya, jadi begitu ditutup halaman langsung
 * kembali persis di tempat sebelumnya tanpa lompatan scrollbar.
 */
function OverlayScrollLock() {
  const overlay = useAppOverlayOpen();
  useEffect(() => {
    const prev = document.body.style.overflow;
    if (overlay) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [overlay]);
  return null;
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
  /** Id episode utuh (mis. "21__ep5") supaya layar nonton membuka ep yang sama. */
  episodeId?: string;
  streamUrl: string;
  isEmbed: boolean;
};

let miniListeners: ((s: MiniState | null) => void)[] = [];
let miniCurrent: MiniState | null = null;
/** Posisi terakhir playback, dipakai untuk lanjut dari tempat yang sama. */
let miniTime = 0;
export function setMiniPlayer(s: MiniState | null) {
  if (s?.streamUrl !== miniCurrent?.streamUrl) miniTime = 0;
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
      className="fixed z-[60] touch-none overflow-hidden rounded-xl border border-foreground/40 shadow-2xl"
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
            `/nonton?anime=${encodeURIComponent(state.animeId)}${state.episodeId ?? (state.episodeNumber ? `&ep=${state.episodeNumber}` : "")}&judul=${encodeURIComponent(state.animeTitle ?? "")}`,
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
            onTimeUpdate={(e) => {
              miniTime = e.currentTarget.currentTime;
            }}
            onLoadedMetadata={(e) => {
              // Lanjut dari posisi terakhir, jangan mulai dari nol.
              if (miniTime > 1 && miniTime < (e.currentTarget.duration || 0) - 5) {
                try {
                  e.currentTarget.currentTime = miniTime;
                } catch {
                  /* stream belum siap seek */
                }
              }
            }}
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
                    `/nonton?anime=${encodeURIComponent(state.animeId)}${state.episodeId ?? (state.episodeNumber ? `&ep=${state.episodeNumber}` : "")}&judul=${encodeURIComponent(state.animeTitle ?? "")}`,
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
            className="pointer-events-auto mx-auto flex size-10 items-center justify-center rounded-full bg-black/55 text-white"
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
          <div className="pop-enter fixed inset-x-0 bottom-[68px] z-50 mx-auto w-full max-w-2xl px-6 lg:max-w-4xl">
            <div className="overflow-hidden rounded-2xl border border-foreground/40 bg-background/95 shadow-2xl backdrop-blur">
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
                          ? "border-foreground/40 bg-primary/15"
                          : "border-border hover:border-foreground/40",
                      )}
                    >
                      <span className="flex items-center gap-1.5 text-sm font-bold">
                        <Icon className="size-4 text-primary" /> {label}
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
      {/* Navbar full width. Angka kolom ikut melebar di desktop. */}
      <nav className="nav-bar fixed inset-x-0 bottom-0 z-40">
        <div className="mx-auto grid w-full grid-cols-4 md:max-w-2xl lg:max-w-4xl">
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
                  className={cn("size-[22px]", active ? "text-primary" : "text-zinc-500")}
                />
                <span
                  className={cn(
                    "text-[10px] font-medium",
                    active ? "text-foreground" : "text-zinc-500",
                  )}
                >
                  {it.label}
                </span>
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
