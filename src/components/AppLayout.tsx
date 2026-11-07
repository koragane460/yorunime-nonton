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
  BookmarkIcon,
  BookmarkIconFill,
  BookIcon,
  GemIcon,
} from "@/components/ios-icons";
import { useNavigate, useLocation } from "react-router";
import { cn } from "@/lib/utils";
import { displayId, usernameColor } from "@/lib/lstream";
import { NotifButton } from "@/components/NotifButton";
import { FavoritesScreen } from "@/components/FavoritesScreen";
import { MOST_MIN_TITLES, type TopPanel } from "@/components/HomeTopButtons";
import { applyAntiLag, getAntiLag } from "@/lib/antilag";
import { MusicMiniBar } from "@/components/MusicMiniBar";
import { YoruVerseScreen } from "@/components/YoruVerse";
import {
  YoruVerseHubScreen,
  type YoruFeature,
} from "@/components/YoruVerseHub";
import { PanelHub, type PanelKey } from "@/components/PanelHub";
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
  // PANEL (tombol tengah nav) — sheet setinggi 55% layar. Isinya profil +
  // kotak Feed · Baca · History · Download · Clan · Music · YoruPet · Title
  // · Shop (Feed & Baca sudah digabung jadi tombol ini, permintaan user).
  const [hubOpen, setHubOpen] = useState(false);
  // Tampilan awal YoruVerse saat dibuka dari sheet Panel (shop/pet/music).
  const [yvView, setYvView] = useState<"shop" | "pet" | "music" | null>(null);
  // Fitur lokal YoruVerse yang langsung dibuka dari Panel.
  const [yvFeature, setYvFeature] = useState<YoruFeature | null>(null);
  // Layar fitur Panel (Quest/Shop Sticker/Nobar/Voice) dan sublayar
  // YoruVerse lama (Shop/Pet/Music) yang masih dipakai.
  const [yvOpen, setYvOpen] = useState(false);
  const openTopPanel = useCallback((p: TopPanel) => setTopPanel(p), []);
  const closeTopPanel = useCallback(() => setTopPanel(null), []);

  /**
   * Kotak dipilih di sheet PANEL → tutup sheet lalu buka tujuannya.
   * History & Download memakai layar panel atas yang sudah ada
   * (Lanjutkan nonton & Unduhan); Music/YoruPet/Shop masuk ke YoruVerse.
   */
  const pickHub = (key: PanelKey) => {
    setHubOpen(false);
    switch (key) {
      case "quest":
      case "sticker":
      case "nobar":
      case "voice":
        setYvView(null);
        setYvFeature(key);
        setYvOpen(true);
        break;
      case "feed":
        navigate("/feed");
        break;
      case "baca":
        navigate("/baca");
        break;
      case "history":
        setTopPanel("continue");
        break;
      case "download":
        setTopPanel("downloads");
        break;
      case "clan":
        navigate("/clan");
        break;
      case "music":
        setYvView("music");
        setYvOpen(true);
        break;
      case "pet":
        setYvView("pet");
        setYvOpen(true);
        break;
      case "title":
        navigate("/title");
        break;
      case "shop":
        setYvView("shop");
        setYvOpen(true);
        break;
    }
  };

  // Pintasan dari halaman Akun/Profil: /home?panel=favorites|history|...
  // Membuka layar yang sama seperti tombol Panel, lalu query dibersihkan
  // supaya layar tidak terbuka ulang saat user menutupnya.
  useEffect(() => {
    const panel = new URLSearchParams(location.search).get("panel");
    if (!panel) return;
    if (panel === "favorites") setNavPanel("favorites");
    else if (panel === "history") setTopPanel("continue");
    else if (panel === "download") setTopPanel("downloads");
    else if (
      panel === "quest" ||
      panel === "sticker" ||
      panel === "nobar" ||
      panel === "voice"
    ) {
      setYvView(null);
      setYvFeature(panel);
      setYvOpen(true);
    }
    const next = new URLSearchParams(location.search);
    next.delete("panel");
    const qs = next.toString();
    navigate(`${location.pathname}${qs ? `?${qs}` : ""}`, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search]);

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
      {!overlayOpen && location.pathname !== "/catalog" && location.pathname !== "/feed" && (
        <BottomNav
          navPanel={navPanel}
          onOpenPanel={setNavPanel}
          onOpenHub={() => setHubOpen(true)}
        />
      )}
      <TopPanelHost topPanel={topPanel} onClose={closeTopPanel} onOpen={openTopPanel} />
      {!overlayOpen && location.pathname !== "/catalog" && location.pathname !== "/feed" && <AppFooter />}
      <MusicMiniBar />
      <MiniPlayerHost />
      <XpPopupHost />

      <OverlayScrollLock />
      {yvOpen &&
        (yvView ? (
          <YoruVerseScreen
            initialView={yvView}
            onClose={() => {
              setYvOpen(false);
              setYvView(null);
              setYvFeature(null);
            }}
          />
        ) : (
          <YoruVerseHubScreen
            initialFeature={yvFeature}
            onClose={() => {
              setYvOpen(false);
              setYvView(null);
              setYvFeature(null);
            }}
            onOpenSub={(v) => {
              setYvFeature(null);
              setYvView(v);
            }}
          />
        ))}
      {/* SHEET PANEL — tombol tengah navigasi bawah (55% layar). */}
      {hubOpen && <PanelHub onClose={() => setHubOpen(false)} onPick={pickHub} />}
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
}) {
  const cost = xpForLevel(level);
  const inLevel = Math.max(0, Math.min(xp, cost));
  const pct = Math.min(100, (inLevel / Math.max(1, cost)) * 100);
  const goto = useNavigate();
  return (
    <div className="pop-enter relative -mx-1 mt-3 w-[calc(100%+0.5rem)] overflow-hidden rounded-2xl bg-black/55 shadow-[0_18px_40px_-30px_rgba(0,0,0,1)] backdrop-blur-xl">
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

      {/* Footer panel: Sacret + premium. TOMBOL YORUVERSE DIHAPUS permanen
          (menu YoruVerse tidak lagi ada — isi Shop/Pet/Music sekarang dibuka
          lewat sheet PANEL). */}
      <div className="relative flex flex-wrap items-center gap-x-4 gap-y-0.5 px-3 pb-3.5 pt-1 text-sm">
        <span className="flex items-center gap-1.5 font-bold text-sky-300">
          <GemIcon className="size-5" /> {diamonds.toLocaleString("id-ID")} Sacret
        </span>
        {premium && (
          <span className="flex items-center gap-1.5 font-bold text-gold">
            <GemIcon className="size-5" /> {premiumDays} hari
          </span>
        )}
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

// --------------------------------------------------------- XP popup ----

type XpPopupState = {
  /** XP yang dikumpulkan selama sesi nonton ini. */
  sessionXp: number;
  /** XP yang baru masuk dari klaim 2 menit (0 kalau bukan klaim). */
  amount: number;
  /** Label kejadian: Nonton, Jeda, Keluar fullscreen, Mini player, dll. */
  event: string;
  at: number;
};

let xpPopupCurrent: XpPopupState | null = null;
let xpPopupListeners: ((s: XpPopupState | null) => void)[] = [];

export function showXpPopup(s: Omit<XpPopupState, "at">) {
  xpPopupCurrent = { ...s, at: Date.now() };
  xpPopupListeners.forEach((l) => l(xpPopupCurrent));
}

export function hideXpPopup() {
  xpPopupCurrent = null;
  xpPopupListeners.forEach((l) => l(null));
}

function useXpPopup() {
  return useSyncExternalStore(
    (cb) => {
      xpPopupListeners.push(cb);
      return () => {
        xpPopupListeners = xpPopupListeners.filter((l) => l !== cb);
      };
    },
    () => xpPopupCurrent,
    () => xpPopupCurrent,
  );
}

export function XpPopupHost() {
  const data = useXpPopup();
  const { user } = useAuth();

  useEffect(() => {
    if (!data) return;
    const t = window.setTimeout(() => hideXpPopup(), 4200);
    return () => window.clearTimeout(t);
  }, [data?.at]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data) return null;
  const level = user?.level ?? 1;
  const xp = user?.xp ?? 0;
  const cost = xpForLevel(level);
  const inLevel = Math.max(0, Math.min(xp, cost));
  const pct = Math.min(100, (inLevel / Math.max(1, cost)) * 100);
  const left = Math.max(0, cost - inLevel);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[125] flex justify-center px-4">
      <div className="pop-enter pointer-events-auto w-full max-w-sm overflow-hidden rounded-3xl border border-gold/30 bg-[#12161f]/97 p-3.5 shadow-[0_30px_70px_-30px_rgba(0,0,0,1)] backdrop-blur-xl">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-gold/35 bg-gold/15 text-gold">
            <AwardIcon className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="min-w-0 flex-1 truncate text-[12px] font-black text-white">
                {data.event}
              </p>
              <button
                onClick={hideXpPopup}
                aria-label="Tutup XP"
                className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-white/45"
              >
                <X className="size-3" />
              </button>
            </div>
            <p className="mt-1 font-display text-[26px] font-black leading-none text-gold">
              +{data.sessionXp.toLocaleString("id-ID")}
              <span className="ml-1 text-[10px] font-bold text-white/45">XP sesi</span>
            </p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/40">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#FFD23F,#7FD3F7)] transition-all duration-700"
                style={{ width: `${Math.max(3, pct)}%` }}
              />
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-2 text-[9.5px] font-semibold text-white/40">
              <span className="truncate">Level {level} sekarang</span>
              <span className="shrink-0 text-white/55">
                {left.toLocaleString("id-ID")} XP ke Lv.{level + 1}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
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
  /** Detik terakhir dari player utama supaya mini lanjut di posisi sama. */
  startAt?: number;
  /** Total XP sesi dari player utama, dipakai popup saat mini dijeda. */
  sessionXp?: number;
};

let miniListeners: ((s: MiniState | null) => void)[] = [];
let miniCurrent: MiniState | null = null;
/** Posisi terakhir playback, dipakai untuk lanjut dari tempat yang sama. */
let miniTime = 0;
/** Teks CC terakhir dari layar Nonton — ditampilkan mini player. */
let miniCueText = "";
export function setMiniCue(t: string) {
  miniCueText = t;
}
function getMiniCue() {
  return miniCueText;
}
export function setMiniPlayer(s: MiniState | null) {
  if (s?.streamUrl !== miniCurrent?.streamUrl)
    miniTime = Math.max(0, s?.startAt ?? 0);
  if (!s) miniCueText = "";
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
      ? { w: 264, h: 168 }
      : { w: 208, h: 132 },
  );
  const [pos, setPos] = useState({ x: 14, y: 100 });
  // UI mini player: tap layar → UI disembunyikan (video tetap jalan).
  // Muncul lagi kalau video dijeda atau user mengetuk dua kali.
  const [uiOn, setUiOn] = useState(true);
  // Teks CC (subtitle) — di-push layar Nonton lewat setMiniCue.
  const [cue, setCue] = useState("");
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
      className="screen-enter fixed z-[60] touch-none overflow-hidden rounded-xl border border-foreground/40 shadow-2xl"
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
            onPlay={() => {
              setPlaying(true);
              showXpPopup({
                sessionXp: state.sessionXp ?? 0,
                amount: 0,
                event: "Nonton",
              });
            }}
            onPause={() => {
              setPlaying(false);
              showXpPopup({
                sessionXp: state.sessionXp ?? 0,
                amount: 0,
                event: "Jeda",
              });
            }}
            onTimeUpdate={(e) => {
              miniTime = e.currentTarget.currentTime;
              const c = getMiniCue();
              setCue((prev) => (prev === c ? prev : c));
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
        {/* CC — teks subtitle yang sama dengan layar Nonton. */}
        {cue && (
          <span className="pointer-events-none absolute inset-x-2 bottom-1.5 rounded bg-black/70 px-1.5 py-0.5 text-center text-[9px] font-semibold leading-tight text-white/95">
            {cue}
          </span>
        )}
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

/** Ikon tab Feed — kartu konten dengan tiga baris (menggantikan History). */
function FeedIcon({ className, strokeWidth = 1.8 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect x="3" y="3.5" width="18" height="17" rx="4.5" />
      <path d="M7 8.5h10M7 12.5h6.5M7 16.5h8" />
    </svg>
  );
}

/** Ikon tab PANEL — empat kotak kisi (pengganti tombol Feed & Baca). */
function PanelIcon({ className, strokeWidth = 1.8 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect x="3.2" y="3.2" width="7.4" height="7.4" rx="2.4" />
      <rect x="13.4" y="3.2" width="7.4" height="7.4" rx="2.4" />
      <rect x="3.2" y="13.4" width="7.4" height="7.4" rx="2.4" />
      <rect x="13.4" y="13.4" width="7.4" height="7.4" rx="2.4" />
    </svg>
  );
}

function BottomNav({
  navPanel,
  onOpenPanel,
  onOpenHub,
}: {
  navPanel: TopPanel;
  /** null = tutup panel yang sedang terbuka (tekan tombolnya dua kali). */
  onOpenPanel: (p: TopPanel) => void;
  /** Buka SHEET Panel (tombol tengah — gabungan Feed + Baca). */
  onOpenHub: () => void;
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
    /** Tombol tengah PANEL — bukan rute, membuka sheet 55% layar. */
    hub?: boolean;
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
    // Tengah: PANEL — pengganti tombol Feed & Baca yang DIGABUNG jadi satu
    // (permintaan). Tombolnya sengaja lebih besar dari yang lain.
    { path: "__hub", label: "Panel", icon: PanelIcon, hub: true },
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
        <div className="w-full">
          <div
            className={cn(
              "relative grid grid-cols-5 rounded-t-2xl border-t-0 border-white/12 p-1.5",
              "bg-[oklch(0.135_0.016_266_/_0.92)] shadow-[0_18px_40px_-28px_rgba(0,0,0,1)]",
              "backdrop-blur-2xl backdrop-saturate-150",
            )}
          >
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
                  // Tombol PANEL tidak punya rute: membuka sheet 55% layar
                  // (Feed · Baca · History · Download · dst).
                  if (it.hub) {
                    onOpenHub();
                    return;
                  }
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
                  "nav-item relative z-10 flex select-none flex-col items-center justify-center pb-2 pt-2.5 transition-colors duration-200",
                  active && "text-gold-strong",
                  // Tombol PANEL: jendol KE ATAS bar (knob emas), permintaan.
                  it.hub &&
                    "z-20 -translate-y-5 rounded-2xl border border-gold-strong/55 bg-[oklch(0.16_0.03_88_/_0.98)] px-3 pb-3 pt-2.5 shadow-[0_12px_24px_-14px_rgba(0,0,0,1),inset_0_1px_0_rgba(255,255,255,.25)]",
                )}
              >
                {/* GARIS penanda aktif di ATAS ikon — menggantikan kotak
                    rounded lama (permintaan). */}
                {active && (
                  <span
                    aria-hidden
                    className="absolute inset-x-3 top-0 h-[3px] rounded-full bg-gold-strong"
                  />
                )}
                {/* Isi tombol (ikon + label). */}
                <span className="flex flex-col items-center">
                <Icon
                  strokeWidth={1.7}
                  className={cn(
                    // 5 kolom: ikon dibuat besar supaya jelas dan mudah
                    // ditekan di HP, tapi garisnya TIPIS (strokeWidth 1.7)
                    // supaya tidak terlihat tebel dan berat.
                    "size-[25px] md:size-[28px] transition-colors duration-200",
                    // Tombol PANEL sengaja lebih besar + punya kotak emas.
                    it.hub &&
                      "size-[30px] text-gold-strong md:size-[32px]",
                    active
                      ? "text-gold-strong"
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
                    it.hub && "font-black tracking-wide text-white",
                    active
                      ? "font-semibold text-gold-strong"
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
