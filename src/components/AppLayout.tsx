import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  DownloadsPanel,
  MostWatchedPanel,
  ForYouPanel,
  ContinuePanel,
} from "@/components/HomeTopButtons";
import { Avatar, BlueCheck, LevelBadge, ClanTag, TitleBadge, SacretIcon } from "@/components/lstream-ui";
import { StripBack } from "@/components/StripBack";
import { FramedAvatar } from "@/components/FramedAvatar";
import { DEFAULT_CLAN_ICON } from "@/lib/clanIcons";
import {
  Maximize,
  Settings,
  Pause,
  Play,
  X,
  ChevronLeft,
  ChevronRight,
  Star as StarIcon,
  Award as AwardIcon,
} from "lucide-react";
// Ikon chrome memakai gaya SF Symbols supaya nav & panel akun terasa satu
// bahasa bentuk dengan iOS (garis tipis, sudut membulat, varian fill saat aktif).
import {
  HomeIcon,
  HomeIconFill,
  CalendarIcon,
  CalendarIconFill,
  PersonIcon,
  PersonIconFill,
  InfoIcon,
  InfoIconFill,
  CatalogIcon,
  CatalogIconFill,
  BookmarkIcon,
  BookmarkIconFill,
  BookIcon,
  GemIcon,
  CrownIcon,
} from "@/components/ios-icons";
import { useNavigate, useLocation } from "react-router";
import { cn } from "@/lib/utils";
import { displayId, usernameColor } from "@/lib/lstream";
import { AnnouncementPopup } from "@/components/AnnouncementPopup";
import { NotifButton } from "@/components/NotifButton";
import { FavoritesScreen } from "@/components/FavoritesScreen";
import { MOST_MIN_TITLES, type TopPanel } from "@/components/HomeTopButtons";
import { applyAntiLag, getAntiLag } from "@/lib/antilag";
import { MusicMiniBar } from "@/components/MusicMiniBar";
import { YoruVerseScreen } from "@/components/YoruVerse";
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
  // Level clan diambil dari query, bukan dari objek auth user: auth user
  // tidak punya field clanLevel, jadi membacanya dari sana selalu undefined
  // dan warna tag selalu biru walau chat menampilkan emas.
  const myStats = useQuery(
    api.account.profileStats,
    user ? {} : "skip",
  );
  // Layar penuh yang dibuka tombol navigasi (Favorit, Lanjutkan nonton,
  // Paling sering, Untuk kamu).
  //
  // State-nya sengaja ADA DI SINI, bukan di BottomNav: masing-masing panel
  // memanggil useHideNavOnMount() yang menyalakan flag overlay, dan
  // BottomNav memanggil `if (overlay) return null`. Kalau panel dirender di
  // dalam BottomNav, panel yang baru dibuka akan langsung membuat
  // BottomNav (dan dirinya sendiri) unmount.
  const [navPanel, setNavPanel] = useState<TopPanel>(null);
  const [topPanel, setTopPanel] = useState<TopPanel>(null);
  // YORUVERSE — hub virtual (tombol kuning di panel akun). Layar penuh
  // yang dirender di atas segalanya (z-[70]).
  const [yvOpen, setYvOpen] = useState(false);
  const openTopPanel = useCallback((p: TopPanel) => setTopPanel(p), []);
  const closeTopPanel = useCallback(() => setTopPanel(null), []);

  useEffect(() => {
    if (!navPanel) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNavPanel(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navPanel]);

  // Ganti rute (mis. tekan Jadwal / Info saat layar Favorit terbuka) → layar
  // panel ikut tertutup. Dulu panelnya diam saja, jadi tombol navigasi lain
  // terasa tidak berfungsi dan user harus menekan tombol Kembali dulu.
  useEffect(() => {
    setNavPanel(null);
    // `search` ikut masuk supaya panel juga tertutup saat rute yang sama
    // diganti query-nya (mis. kartu "Untuk kamu" yang membuka detail).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (user) void ensure();
  }, [user, ensure]);

  // PRESENCE — penanda "online" tiap 30 detik selama aplikasi terbuka.
  // Dipakai angka N online di kotak Chat Global Home (hitungan beneran).
  const heartbeat = useMutation(api.presence.heartbeat);
  useEffect(() => {
    if (!user) return;
    void heartbeat({}).catch(() => {});
    const t = setInterval(() => void heartbeat({}).catch(() => {}), 30_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id]);

  // Mode Anti lag dari Pengaturan: berlaku di seluruh halaman.
  useEffect(() => {
    applyAntiLag(getAntiLag());
  }, []);

  // Panel akun tidak boleh kelihatan sama sekali selama layar fullscreen
  // terbuka (Detail, Pencarian, Chat, Leaderboard, panel atas, dll).
  const overlayOpen = useAppOverlayOpen();

  const isAuth = location.pathname.startsWith("/auth");
  if (isAuth) return <>{children}</>;

  // Panel akun hanya muncul di Home (route app = /home; "/" hanya landing publik).
  const isHome =
    location.pathname === "/home" ||
    location.pathname === "/" ||
    location.pathname.startsWith("/dashboard");
  const showPanel =
    !hideAccountPanel &&
    isHome &&
    location.pathname === "/home" &&
    !overlayOpen;

  return (
    <div className="yn-app-bg flex min-h-dvh w-full flex-col items-center">
      {/* LATAR HOME KUSTOM — gambar 9:16 dari galeri (Pengaturan › Ganti
          Home Screen). Fixed, di belawah semua konten (z negatif). */}
      <HomeBgLayer />
      {/* Panel akun hanya muncul di Home dan TIDAK saat layar Koleksi (Favorit)
          terbuka. Dulu panel ini tetap tampil di atas layar Koleksi sehingga
          terlihat seperti layar yang salah - tombol Favorit di navigasi
          memang bukan untuk daftar favorit. */}
      {showPanel && user && navPanel !== "favorites" && (
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
            clanTag={user.clanTag}
            clanTagIcon={user.clanTagIcon}
            clanColor={user.clanNameColor}
            clanLevel={myStats?.clanLevel ?? 0}
            avatarBorder={user.avatarBorder}
            premium={(user.premiumUntil ?? 0) > Date.now()}
            premiumDays={Math.max(
              0,
              Math.floor(((user.premiumUntil ?? 0) - Date.now()) / 86400000),
            )}
            diamonds={user.diamonds ?? 0}
            onOpenYoruVerse={() => setYvOpen(true)}
          />
        </div>
      )}
      {/* Konten full-bleed di HP; di desktop (md+) konten tetap di tengah biar
          enak dibaca. Tidak ada lagi kolom kosong di kanan layar HP. */}
      {/* Animasi route memakai FADE (opacity) — bukan `screen-enter`.
          `screen-enter` meninggalkan `transform` permanen (fill-mode both),
          dan transform itu menjadikan div ini containing block untuk SEMUA
          elemen `position: fixed` di dalamnya: layar Detail/Pencarian jadi
          ikut turun di bawah panel akun dan melebar ke luar viewport
          (muncul halaman kosong raksasa di bawah). Fade tidak mengubah
          positioning sama sekali. */}
      <div
        key={location.pathname}
        className="fade-enter w-full flex-1 md:mx-auto md:max-w-2xl lg:max-w-4xl"
      >
        <div className="px-4 md:px-6">
          {/* Layar Favorit dipanggil sebagai halaman biasa, bukan fixed
              fullscreen, supaya baris navigasi bawah tetap terlihat dan
              tombol Favorit bisa ditandai aktif. */}
          {navPanel === "favorites" ? (
            <FavoritesScreen onClose={() => setNavPanel(null)} />
          ) : (
            children
          )}
        </div>
      </div>
      {/* CATALOG = layar fullscreen: navbar bawah & footer TIDAK tampil
          sama sekali selama di halaman ini (permintaan user). */}
      {!overlayOpen && location.pathname !== "/catalog" && (
        <BottomNav navPanel={navPanel} onOpenPanel={setNavPanel} />
      )}
      <TopPanelHost topPanel={topPanel} onClose={closeTopPanel} onOpen={openTopPanel} />
      {!overlayOpen && location.pathname !== "/catalog" && <AppFooter />}
      <MusicMiniBar />
      <MiniPlayerHost />

      <OverlayScrollLock />
      <AnnouncementPopup />
      {yvOpen && <YoruVerseScreen onClose={() => setYvOpen(false)} />}
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
  clanTag,
  clanTagIcon,
  clanColor,
  clanLevel,
  avatarBorder,
  premium,
  premiumDays,
  diamonds,
  onOpenYoruVerse,
}: {
  onOpen: () => void;
  name: string;
  seqId?: number;
  id: string;
  image?: string;
  level: number;
  xp: number;
  staffRole?: string;
  clanTag?: string;
  clanTagIcon?: string;
  clanColor?: string;
  clanLevel?: number;
  /** SHOP BORDER — bingkai foto profile yang sedang dipakai. */
  avatarBorder?: string;
  premium: boolean;
  premiumDays: number;
  diamonds: number;
  /** Tombol masuk YORUVERSE (pojok kanan bawah). */
  onOpenYoruVerse: () => void;
}) {
  const cost = xpForLevel(level);
  const inLevel = Math.max(0, Math.min(xp, cost));
  const pct = Math.min(100, (inLevel / Math.max(1, cost)) * 100);
  const goto = useNavigate();
  return (
    <div className="pop-enter relative -mx-1 mt-3 w-[calc(100%+0.5rem)] overflow-hidden rounded-3xl border border-white/15 bg-background/45 shadow-[0_0_28px_-6px] shadow-primary/25 backdrop-blur-xl">
      {/* Dua tombol aksi di pojok kanan: Pengaturan lalu Notifikasi.
          Keduanya di luar area teks supaya tidak saling nimpa. */}
      <div className="absolute right-2.5 top-2.5 z-10 flex items-center gap-2">
        <button
          aria-label="Pengaturan"
          onClick={() => goto("/akun?tab=settings")}
          className="flex size-11 items-center justify-center rounded-xl border border-white/15 bg-black/45 text-white backdrop-blur-sm transition hover:border-foreground"
        >
          <Settings className="size-5" strokeWidth={1.7} />
        </button>
        <NotifButton />
      </div>

      <button onClick={onOpen} className="block w-full text-left">
        {/* Banner profil TIDAK tampil di panel akun (hanya di profil &
            komentar); latar panel memakai background 45% + blur. */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.07] via-transparent to-gold/[0.05]" aria-hidden />
        {/* pb-2: panel tidak memanjang ke bawah (permintaan user) — baris
            Sacret + tombol YoruVerse pindah ke footer terpisah di luar
            tombol ini, jadi tidak perlu ruang kosong besar di bawah. */}
        <div className="relative p-4 pb-4">
          <div className="flex items-center gap-3">
            {avatarBorder && avatarBorder !== "none" ? (
              /* Border shop terpasang → bingkai kreatif menggantikan ring
                  biasa (lihat FramedAvatar + .yn-frame-* di index.css). */
              <FramedAvatar
                border={avatarBorder}
                src={image}
                seed={name}
                className="size-16 shrink-0"
              />
            ) : (
              <div className="yn-avatar-ring shrink-0">
                <div className="rounded-full bg-background p-[2px]">
                  <Avatar src={image} seed={name} className="size-16" />
                </div>
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p
                  key={name}
                  className={cn("truncate font-bold", usernameColor(name))}
                >
                  {name}
                </p>
                {premium && <BlueCheck />}
                <TitleBadge role={staffRole} seqId={seqId} compact />
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
                    level={clanLevel}
                    className="zoom-[0.9] px-1.5 py-0 text-[9px]"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Bar level: lebih besar & jarak longgar */}
          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between text-[11px]">
              <span className="font-semibold text-white">Level {level}</span>
              <span className="text-zinc-400">
                {inLevel.toLocaleString("id-ID")}/{cost.toLocaleString("id-ID")}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-black/60 ring-1 ring-white/20">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>
      </button>

      {/* Footer panel: Sacret + premium di kiri, tombol YoruVerse di
          kanan — SEBARIS sehingga panel tidak memanjang ke bawah dan
          tombol YoruVerse dibatasi ruangnya sendiri tanpa menimpa baris
          mana pun (permintaan user). */}
      <div className="relative flex items-center justify-between gap-2 px-3 pb-3.5 pt-1">
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-0.5 text-sm">
          <span className="flex items-center gap-1.5 font-bold text-sky-300">
            <GemIcon className="size-5" /> {diamonds.toLocaleString("id-ID")} Sacret
          </span>
          {premium && (
            <span className="flex items-center gap-1.5 font-bold text-gold">
              <CrownIcon className="size-5" /> {premiumDays} hari
            </span>
          )}
        </div>
        <button
          onClick={onOpenYoruVerse}
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-yellow-900/60 px-4 py-1.5 text-xs font-black tracking-wide text-amber-300 backdrop-blur-sm transition hover:bg-yellow-800/70 active:scale-95"
        >
          <GemIcon className="size-4" aria-hidden />
          YoruVerse
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------ latar home ----

/** localStorage key gambar latar Home (9:16, dari galeri). */
export const HOME_BG_KEY = "yn:home-bg";
export const HOME_BG_EVENT = "yn-home-bg-change";

/** LAYER LATAR HOME — gambar pilihan user (Pengaturan › Ganti Home Screen)
 *  dipasang sebagai latar paling belakang seluruh app. Tanpa gambar, tidak
 *  merender apa pun (tampilan lama tetap persis). */
function HomeBgLayer() {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    const load = () => {
      try {
        setSrc(window.localStorage.getItem(HOME_BG_KEY));
      } catch {
        setSrc(null);
      }
    };
    load();
    window.addEventListener(HOME_BG_EVENT, load);
    window.addEventListener("storage", load);
    return () => {
      window.removeEventListener(HOME_BG_EVENT, load);
      window.removeEventListener("storage", load);
    };
  }, []);
  if (!src) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
      <img src={src} alt="" className="size-full object-cover object-top" />
      {/* Supaya teks/kartu tetap terbaca di atas foto. */}
      <div className="absolute inset-0 bg-black/45" />
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

export function useAppOverlayOpen() {
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

/** Hook untuk layar fullscreen: sembunyikan navbar selama mounted.
 *  Memakai penghitung, jadi kalau dua layar fullscreen bertumpuk (mis. halaman
 *  Premium yang di atasnya membuka layar bayar), navbar tetap tersembunyi
 *  sampai yang terakhir ikut tertutup. */
let hideNavCount = 0;
function useHideNav() {
  useEffect(() => {
    hideNavCount += 1;
    setAppOverlayOpen(true);
    return () => {
      hideNavCount = Math.max(0, hideNavCount - 1);
      setAppOverlayOpen(hideNavCount > 0);
    };
  }, []);
}

export function useHideNavOnMount() {
  useHideNav();
}

/** Sembunyikan navbar selama `active` true (untuk screen buka-tutup, bukan mount-once). */
export function useHideNavWhile(active: boolean) {
  useEffect(() => {
    if (!active) return;
    hideNavCount += 1;
    setAppOverlayOpen(true);
    return () => {
      hideNavCount = Math.max(0, hideNavCount - 1);
      setAppOverlayOpen(hideNavCount > 0);
    };
  }, [active]);
}

// ------------------------------------------------------- mini player ----

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

// ------------------------------------------------------- top panel host ----

function TopPanelHost({
  topPanel,
  onClose,
  onOpen,
}: {
  topPanel: TopPanel;
  onClose: () => void;
  onOpen: (p: TopPanel) => void;
}) {
  if (!topPanel) return null;
  return (
    <div key={topPanel} className="screen-enter fixed inset-0 z-[70] bg-background">
      <TopPanelChrome
        title={panelTitle(topPanel)}
        onBack={() => onClose()}
        onReveal={() => onOpen(null)}
      >
        <TopPanelBody panel={topPanel} onClose={onClose} />
      </TopPanelChrome>
    </div>
  );
}

function panelTitle(p: TopPanel): string {
  // TopPanel termasuk null (state tertutup) — jangan pakai null sebagai key.
  if (!p) return "";
  return {
    downloads: "Download",
    most: "Paling sering",
    foryou: "Untuk kamu",
    favorites: "Favorit",
    continue: "Lanjutkan nonton",
  }[p] ?? "";
}

function TopPanelChrome({
  title,
  children,
  onBack,
  onReveal,
}: {
  title: string;
  children: ReactNode;
  onBack: () => void;
  onReveal: () => void;
}) {
  return (
    <>
      <div className="flex items-center gap-2 border-b border-border px-3 py-3">
        <StripBack onClick={onBack} />
        <h1 className="truncate text-base font-bold tracking-tight">{title}</h1>
        <div className="ml-auto flex size-9 items-center justify-end">
          <button
            onClick={onReveal}
            aria-label="Tutup"
            className="flex size-9 items-center justify-center rounded-full border border-border"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
      </div>
      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {children}
      </div>
    </>
  );
}

function TopPanelBody({
  panel,
  onClose,
}: {
  panel: TopPanel;
  onClose: () => void;
}) {
  return (
    <>
      {panel === "downloads" && <DownloadsPanel onClose={onClose} />}
      {panel === "most" && <MostWatchedPanel onClose={onClose} />}
      {panel === "foryou" && <ForYouPanel onClose={onClose} />}
      {panel === "favorites" && <FavoritesScreen onClose={onClose} />}
      {panel === "continue" && <ContinuePanel onClose={onClose} />}
    </>
  );
}

// ------------------------------------------------------ bottom nav ----

/**
 * Footer hitam di paling bawah.
 *
 * Saat aplikasi dibuka lewat "add to home screen" (display: standalone),
 * konten bisa mentok sampai tepi layar dan aplikasi terlihat seperti
 * terpotong di tengah-tengah. Strip hitam full-width di bawah ini memberi
 * batas bawah yang jelas, seperti kebanyakan aplikasi streaming lainnya.
 */
function AppFooter() {
  const overlay = useAppOverlayOpen();
  if (overlay) return null;
  return (
    <footer className="app-footer w-full shrink-0">
      <p className="py-3 text-center text-[10px] font-medium tracking-wide text-zinc-600">
        YoruNime — nonton tanpa batas
      </p>
    </footer>
  );
}

function BottomNav({
  navPanel,
  onOpenPanel,
}: {
  navPanel: TopPanel;
  /** null = tutup panel yang sedang terbuka (tekan tombolnya dua kali). */
  onOpenPanel: (p: TopPanel) => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const overlay = useAppOverlayOpen();

  // GACHA & TITLE tidak lagi ada di navigasi — keduanya pindah ke
  // YORUVERSE (Tombol kuning di panel akun): Shop berisi Gacha, dan
  // kotak Title membuka layar Title yang sama.
  if (overlay) return null;
  const items: {
    path: string;
    label: string;
    icon: ComponentType<{ className?: string; strokeWidth?: number }>;
    /** Varian terisi untuk keadaan aktif — kebiasaan iOS: ikon memadat
     *  saat tab terpilih, bukan cuma berganti warna. */
    iconFill?: ComponentType<{ className?: string; strokeWidth?: number }>;
    panel?: Exclude<TopPanel, null>;
    dim?: boolean;
    /** Tombol ini punya pasangan (tekan-lama berpindah dengan fade). */
    swaps?: "a" | "b";
  }[] = [
    { path: "/home", label: "Home", icon: HomeIcon, iconFill: HomeIconFill },
    {
      path: "/jadwal",
      label: "Jadwal",
      icon: CalendarIcon,
      iconFill: CalendarIconFill,
    },
    { path: "/catalog", label: "Catalog", icon: CatalogIcon, iconFill: CatalogIconFill },
    // Baca: layar ganti kategori Manga / Manhwa (dulu tekan-lama tombol
    // Home). Ikon buku, di kanan History.
    { path: "/baca", label: "Baca", icon: BookIcon },
    {
      path: "",
      label: "Subscribe",
      icon: StarIcon,
      panel: "favorites",
    },
    {
      path: "/akun",
      label: "Akun",
      icon: PersonIcon,
      iconFill: PersonIconFill,
    },
  ];

  const onClickItem = (path: string) => navigate(path);

  // Indeks tombol aktif — dipakai menentukan posisi kotak rounded glossy
  // yang berpindah halus antar tombol. -1 = tidak ada yang aktif.
  const activeIdx = items.findIndex((it) => {
    const base = it.path.split("?")[0];
    if (it.panel) return navPanel === it.panel;
    if (navPanel) return false;
    if (base === "/home")
      return location.pathname === "/home" || location.pathname === "/";
    return base !== "" && location.pathname.startsWith(base);
  });

  return (
    <>
      {/* Navbar 6 tombol: BAR ROUNDED super (glassmorphism) yang tidak
          full-width, dan tiap tombol aktif mendapat kotak rounded KEDUA
          (juga glassmorphism) yang berpindah HALUS antar tombol. */}
      <nav className="nav-bar fixed inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto w-full max-w-2xl px-3 lg:max-w-4xl">
          <div
            className={cn(
              "relative grid grid-cols-6 rounded-[28px] border border-white/15 p-1.5",
              "bg-white/[0.07] shadow-[0_12px_36px_-14px_rgba(0,0,0,.95)]",
              "backdrop-blur-2xl backdrop-saturate-150",
            )}
          >
            {/* Indikator: kotak rounded ke-2 (glassmorphism) — bergerak
                halus (transition left+width) mengikuti tombol aktif. */}
            <span
              aria-hidden
              className={cn(
                "pointer-events-none absolute bottom-1.5 top-1.5 rounded-[22px] border border-white/25",
                "bg-gradient-to-b from-white/25 via-white/12 to-white/6",
                "shadow-[inset_0_1px_0_rgba(255,255,255,.4),0_8px_20px_-8px_rgba(255,255,255,.3)]",
                "backdrop-blur-xl transition-all duration-300 ease-out",
                activeIdx < 0 && "opacity-0",
              )}
              style={{
                width: "calc((100% - 12px) / 6)",
                left:
                  activeIdx < 0
                    ? "6px"
                    : `calc(6px + ${activeIdx} * (100% - 12px) / 6)`,
              }}
            />
            {items.map((it) => {
            const base = it.path.split("?")[0];
            // Panel "favorites" tidak punya rute: aktif selama layarnya
            // terbuka, supaya tombolnya terlihat terpilih.
            const active = it.panel
              ? navPanel === it.panel
              : // Garis penanda aktif: cuma SATU tombol yang boleh
                // menampilkan garis. Selama layar panel terbuka, tombol
                // rute dianggap tidak aktif — kalau tidak, Favorit dan
                // (mis.) Home sama-sama menampilkan garisnya.
                navPanel
                ? false
                : base === "/home"
                  ? location.pathname === "/home" || location.pathname === "/"
                  : base !== "" && location.pathname.startsWith(base);
            // Ikon SELALU pakai varian outline, aktif maupun tidak — bobotnya
            // persis sama, jadi tombol tidak mendadak "tebel" saat dipencet.
            const Icon = it.icon;
            return (
              <button
                key={it.path || `panel-${it.label}`}
                onClick={() => {
                  // Tombol panel tidak punya rute: dia membuka layar penuh
                  // yang dirender AppLayout (bukan di sini — lihat catatan
                  // pada state navPanel).
                  if (it.panel) {
                    // Tekan lagi sambil masih terbuka → tutup (pengganti
                    // tombol Kembali yang sudah dihapus dari layar Favorit).
                    onOpenPanel(navPanel === it.panel ? null : it.panel);
                    return;
                  }
                  onClickItem(it.path);
                }}
                aria-current={active ? "page" : undefined}
                aria-label={it.label}
                title={
                  it.dim
                    ? `${it.label} (butuh ${MOST_MIN_TITLES} judul ditonton)`
                    : it.label
                }
                className={cn(
                  "nav-item relative z-10 flex select-none flex-col items-center justify-center rounded-2xl pb-2 pt-2.5 transition-colors duration-200",
                  active && "text-primary",
                )}
              >
                {/* Isi tombol (ikon + label). */}
                <span className="flex flex-col items-center">
                <Icon
                  strokeWidth={1.7}
                  className={cn(
                    // 6 kolom: ikon dibuat besar supaya jelas dan mudah
                    // ditekan di HP, tapi garisnya TIPIS (strokeWidth 1.7)
                    // supaya tidak terlihat tebel dan berat.
                    "size-[25px] md:size-[28px] transition-colors duration-200",
                    active
                      ? "text-white"
                      : it.dim
                        ? "text-zinc-700"
                        : "text-zinc-500",
                  )}
                />
                {/* Teks label di bawah ikon (Home, Jadwal, Gacha, Subscribe,
                    Akun). Muncul untuk SEMUA tombol; yang aktif lebih terang. */}
                <span
                  className={cn(
                    "mt-1 max-w-full truncate px-0.5 text-[10px] leading-none transition-colors duration-200",
                    active
                      ? "font-semibold text-white"
                      : it.dim
                        ? "font-medium text-zinc-700"
                        : "font-medium text-zinc-500",
                  )}
                >
                  {it.label}
                </span>
                </span>
              </button>
            );
            })}
          </div>
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
