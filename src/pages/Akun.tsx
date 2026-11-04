import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { StripBackIcon } from "@/components/StripBack";
import {
  AppLayout,
  HOME_BG_EVENT,
  HOME_BG_KEY,
  useHideNavOnMount,
} from "@/components/AppLayout";
import { StaffPanel } from "@/components/StaffPanel";
import { ProfileSheet } from "@/components/ProfileSheet";
import { BlurBanner } from "@/components/BlurBanner";
import { TitleRibbon } from "@/components/Cosmetics";
import { DEFAULT_CLAN_ICON, resolveClanIcon } from "@/lib/clanIcons";
import {
  Avatar,
  BlueCheck,
  ClanLevelBar,
  ClanTag,
  LevelBadge,
  RedMark,
  TitleBadge,
} from "@/components/lstream-ui";
import {
  STAFF_BADGE,
  LEVEL_BADGE_TIERS,
  CLAN_ROLE_BADGE,
  clanNameCls,
  timeAgo,
  displayId,
  usernameColor,
} from "@/lib/lstream";
import { xpForLevel } from "@/lib/level";
import { shrinkAvatar, shrinkBanner, shrinkHomeBg } from "@/lib/image";
import { FramedAvatar } from "@/components/FramedAvatar";
import { AfinitasScreen } from "@/components/AfinitasScreen";
import { BORDERS } from "@/lib/borders";
import {
  StoryAddButton,
  StoryComposer,
  StoryEditor,
  StoryRing,
  StoryViewer,
} from "@/components/StoriesUI";
import {
  Ban,
  Bell,
  CircleAlert,
  CornerUpRight,
  Flag,
  Lock,
  Palette,
  Download,
  Shield,
  ShieldAlert,
  User,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Award,
  Crown,
  Heart,
  Bookmark,
  Headset,
  History as HistoryIcon,
  LogOut,
  Mail,
  MessageSquare,
  Play,
  Send,
  Settings as SettingsIcon,
  X,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getAntiLag,
  setAntiLag as setAntiLagPref,
} from "@/lib/antilag";
import { toast } from "sonner";
import { SacretIcon } from "@/components/lstream-ui";
import type { Id } from "@/convex/_generated/dataModel";

export default function Akun() {
  return (
    <AppLayout hideAccountPanel>
      <AkunContent />
    </AppLayout>
  );
}

function AkunContent() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // Layar Akun kini HANYA tombol Pengaturan. Banner, profil, title, story,
  // statistik, dan tab history/komen/favorite dihapus permanen.
  const [settingsOpen, setSettingsOpen] = useState(
    params.get("tab") === "settings",
  );
  const [csOpen, setCsOpen] = useState(false);
  // Detail akun (layar penuh) — dibuka dengan menekan header profil di atas.
  const [detailOpen, setDetailOpen] = useState(false);
  // ?user=<id> — buka profil orang lain dari luar (mis. notifikasi).
  // ?afinitas=1 — langsung buka layar AFINITAS; tanpa ?user = Afinitas
  // MILIK KAMU (notifikasi ajakan Afinitas mengarah ke sini, bukan ke
  // profil pengirim, supaya relasi & Bond sendiri langsung kelihatan).
  const viewUserId = params.get("user") as Id<"users"> | null;
  const openAffinity = params.get("afinitas") === "1";
  const clearDeepLink = () => {
    const next = new URLSearchParams(params);
    next.delete("user");
    next.delete("afinitas");
    const qs = next.toString();
    navigate(`/akun${qs ? `?${qs}` : ""}`, { replace: true });
  };

  if (!user) return null;
  return (
    <div className="relative pb-6">
      {/* Kotak profil full lebar + rounded di PALING ATAS: foto profil
          diperbesar, lalu username, tag clan, level, badge, dan title.
          SELURUH header bisa ditekan → membuka DETAIL AKUN (permintaan
          user); tombol pengaturan tetap jadi FAB di pojok kanan bawah. */}
      <AkunProfileHeader user={user} onOpen={() => setDetailOpen(true)} />

      {/* Detail clan milikmu (avatar, tag, role, level) + pintu ke layar
          Clan. Belum punya clan → kotak berubah jadi ajakan bikin clan. */}
      <AkunClanCard />

      {/* Tombol Pengaturan versi FAB — melayang di pojok kanan bawah,
          di atas bottom nav, selalu terjangkat oleh jempol. */}
      <button
        onClick={() => setSettingsOpen(true)}
        aria-label="Pengaturan"
        className="fixed bottom-24 right-4 z-40 flex size-14 items-center justify-center rounded-full border border-gold/40 bg-gradient-to-br from-gold/80 to-gold/50 text-black shadow-[0_8px_24px_-6px_rgba(212,175,55,0.7)] transition active:scale-90"
      >
        <SettingsIcon className="size-6" />
      </button>

      {/* Feed komentar: diri sendiri, teman, dan developer — grid ke bawah,
          tanpa kotak latar. */}
      <AkunCommentsFeed />

      {settingsOpen && (
        <SettingsScreen
          onClose={() => setSettingsOpen(false)}
          onSignOut={signOut}
          onOpenCs={() => {
            setSettingsOpen(false);
            setCsOpen(true);
          }}
        />
      )}
      {csOpen && <CsChatScreen onClose={() => setCsOpen(false)} />}
      {/* DETAIL AKUN — dibuka dari header profil di atas. */}
      {detailOpen && !viewUserId && (
        <ProfileSheet
          userId={user._id}
          onClose={() => setDetailOpen(false)}
        />
      )}

      {/* Deep link: profil orang lain (dipakai notifikasi & daftar teman). */}
      {viewUserId && !openAffinity && (
        <ProfileSheet userId={viewUserId} onClose={clearDeepLink} />
      )}

      {/* Deep link: LANGSUNG ke layar Afinitas — targetnya user ?user= kalau
          ada, kalau tidak Afinitas milik kamu sendiri. */}
      {openAffinity && (
        <AfinitasScreen
          targetUserId={viewUserId ?? user._id}
          onClose={clearDeepLink}
        />
      )}
    </div>
  );
}

/** Kotak profil di paling atas halaman Akun — kotak rounded dengan CELAH
 *  kecil di kiri-kanan & atas (bukan full-bleed), ukuran isi ringkas. */
function AkunProfileHeader({
  user,
  onOpen,
}: {
  user: any;
  onOpen: () => void;
}) {
  const isPremium = (user.premiumUntil ?? 0) > Date.now();
  return (
    /* Ada celah sedikit dari tepi layar (padding wrapper) + sudut rounded,
       sesuai permintaan; foto profile & isi diperkecil supaya tidak
       terlalu besar. BORDER shop ikut dikenakan kalau ada yang dipakai.
       SELURUH header bisa ditekan → membuka detail akun. */
    <button
      type="button"
      onClick={onOpen}
      aria-label="Buka detail akun"
      className="mt-3 block w-full rounded-2xl border border-white/10 bg-card/45 px-3 py-3 text-left backdrop-blur-md transition hover:border-foreground/30 active:scale-[0.995]"
    >
      <div className="flex items-center gap-3">
        <FramedAvatar
          border={user.avatarBorder}
          src={user.image}
          seed={user.username}
          className="size-14 shrink-0 rounded-full ring-1 ring-gold/30"
        />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span className="truncate text-base font-bold">{user.username}</span>
            {isPremium && <BlueCheck className="size-4" />}
            <TitleBadge role={user.staffRole} compact />
            {user.clanTag && (
              <ClanTag
                icon={user.clanTagIcon ?? DEFAULT_CLAN_ICON}
                tag={user.clanTag}
                color={user.clanNameColor}
                level={user.clanLevel}
              />
            )}
          </div>
          <div className="mt-1.5 flex items-center gap-1.5">
            <LevelBadge level={user.level ?? 1} />
            <span className="truncate text-[11px] text-muted-foreground">
              ID: {displayId(user.seqId, user._id)}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

/**
 * DETAIL CLAN di halaman Akun — kotak ringkas berisi avatar clan + tag,
 * badge role kamu (Leader/Officer/…), dan bar level clan, plus tombol
 * untuk membuka layar Clan. Kalau user belum punya clan, kotak ini berubah
 * jadi ajakan membuat/masuk clan.
 */
function AkunClanCard() {
  const navigate = useNavigate();
  const me = useQuery(api.clans.myMembership);

  // Masih memuat — jangan render apa-apa supaya layout tidak kedip.
  if (me === undefined) return null;

  // Belum punya clan → TIDAK tampil kotak apa pun (diminta dihapus).
  if (me === null) return null;

  const c = me.clan;
  const role = CLAN_ROLE_BADGE[me.role] ?? CLAN_ROLE_BADGE.member;
  const { Icon, tone } = resolveClanIcon(c.tagIcon);
  return (
    <div className="mt-3 rounded-2xl border border-white/10 bg-card px-3 py-3">
      <div className="flex items-center gap-3">
        {/* Avatar clan: foto kalau ada, kalau tidak pakai ikon tag. */}
        <span className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-secondary/60">
          {c.avatarUrl ? (
            <img
              src={c.avatarUrl}
              alt=""
              className="size-full object-cover"
            />
          ) : (
            <span style={{ color: tone }}>
              <Icon className="size-6" aria-hidden />
            </span>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span
              className={cn("truncate text-[13px] font-bold", clanNameCls(c.color))}
            >
              {c.name}
            </span>
            <ClanTag
              icon={c.tagIcon ?? DEFAULT_CLAN_ICON}
              tag={c.tag}
              bg={c.tagBg}
              level={c.level}
            />
            <span
              className={cn(
                "rounded-full bg-gradient-to-r px-1.5 py-0.5 text-[9px] font-black text-white shadow-sm",
                role.cls,
              )}
            >
              {role.name}
            </span>
          </div>
          <div className="mt-1.5">
            <ClanLevelBar
              level={c.level}
              progress={c.levelProgress ?? 0}
              cost={c.levelCost}
            />
          </div>
        </div>
        <button
          onClick={() => navigate(`/clan?clan=${c._id}`)}
          aria-label="Buka detail Clan"
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-gold/40 bg-gold/10 text-gold transition active:scale-90"
        >
          <ChevronRight className="size-5" aria-hidden />
        </button>
      </div>
    </div>
  );
}

/**
 * Feed komentar di halaman Akun.
 *
 * Satu item: foto profil di kiri, di kanannya identitas (username, badge,
 * title, centang biru, tag clan, level) dengan JAM di pojok kanan, lalu di
 * bawahnya sedikit ke kanan ada gambar anime + judulnya (kanan atas) dan
 * nomor episodenya, baru teks komentarnya. Semuanya mengalir ke BAWAH dan
 * tanpa kotak latar.
 */
function AkunCommentsFeed() {
  const rows = useQuery(api.activities.myFriendsComments, { limit: 30 });

  if (rows === undefined) {
    return (
      <div className="mt-5 space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton h-24 w-full rounded-xl" />
        ))}
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <p className="py-12 text-center text-xs text-muted-foreground">
        Belum ada komentar dari kamu, teman, atau developer.
      </p>
    );
  }

  return (
    // -mx-4 / md:-mx-6: kotak komentar MELEBAR mentok ke tepi kiri-kanan
    // (membatalkan padding px-4 / px-6 halaman) tanpa keluar dari jalur.
    <div className="mt-5 -mx-4 space-y-2 md:-mx-6">
      {rows.map((c: any) => (
        <div
          key={c._id}
          className={cn(
            // KOTAK LURUS (tanpa rounded) sesuai permintaan.
            "fade-enter relative min-w-0 overflow-hidden border-y border-white/10 bg-black/45 backdrop-blur-sm",
            // Kalau komentar punya banner profil, bannernya MENUTUPI SELURUH
            // kotak komentar (bukan kotak kecil di atas username).
            c.bannerUrl && "relative",
          )}
        >
          {c.bannerUrl && (
            <>
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: `url(${c.bannerUrl})` }}
                aria-hidden
              />
              {/* Scrim gelap supaya teks tetap terbaca di atas banner. */}
              <div className="absolute inset-0 bg-black/55" aria-hidden />
            </>
          )}
          <div className="relative flex items-start gap-2.5 p-2.5">
            {/* Foto profil komentator — kiri. */}
            <Avatar
              src={c.image}
              seed={c.username}
              className="size-10 shrink-0"
            />
            <div className="min-w-0 flex-1">
              {/* Baris identitas + jam di pojok kanan. */}
              <div className="flex min-w-0 items-start gap-2">
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                  <span
                    className={cn(
                      "truncate text-[13px] font-semibold",
                      usernameColor(c.username),
                    )}
                  >
                    {c.username}
                  </span>
                  {c.premium && <BlueCheck className="size-3.5 shrink-0" />}
                  <TitleBadge role={c.staffRole} compact />
                  {c.clanTag && (
                    <ClanTag
                      icon={c.clanTagIcon ?? DEFAULT_CLAN_ICON}
                      tag={c.clanTag}
                      color={c.clanNameColor}
                      level={c.clanLevel}
                      className="shrink-0 scale-90 px-1.5 py-0 text-[9px]"
                    />
                  )}
                  {typeof c.level === "number" && (
                    <span className="shrink-0 inline-flex">
                      <LevelBadge level={c.level} className="scale-90" />
                    </span>
                  )}
                  {c.source === "dev" && (
                    <span className="shrink-0 rounded bg-primary/20 px-1 text-[9px] font-bold text-primary">
                      Dev
                    </span>
                  )}
                </div>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {timeAgo(c.createdAt)}
                </span>
              </div>

              {/* Tidak ada garis pembatas — gambar, judul, dan komentar
                  mengalir langsung tanpa pemisah (permintaan user). */}

              {/* Gambar anime + judul + episode. */}
              <div className="ml-3 mt-2.5 flex items-center gap-2.5">
                {c.animeImage ? (
                  <img
                    src={c.animeImage}
                    alt=""
                    loading="lazy"
                    className="h-20 w-14 shrink-0 rounded-lg border border-white/10 object-cover"
                  />
                ) : (
                  <div className="flex h-20 w-14 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-secondary/60 text-[10px] text-muted-foreground">
                    Anime
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-bold text-white">
                    {c.animeTitle ?? c.animeId}
                  </p>
                  {c.episode ? (
                    <span className="mt-1 inline-flex rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-semibold text-white/80 backdrop-blur-sm">
                      Episode {c.episode}
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Teks komentar — rata kiri, tanpa garis pembatas. */}
              <p className="ml-3 mt-2.5 whitespace-pre-line text-[13px] leading-snug text-zinc-200">
                {c.text}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-card px-1 py-2.5 text-center">
      <p className="truncate text-base font-bold text-foreground">{value}</p>
      <p className="truncate text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

// ------------------------------------------------- popup badge level ----

function BadgesPopup({
  currentLevel,
  onClose,
}: {
  currentLevel: number;
  onClose: () => void;
}) {
  useHideNavOnMount(); // popup fullscreen: navbar hilang total
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-3 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="pop-enter w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-background"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-white/10 px-4 py-3">
          <p className="text-sm font-bold">Badge Level</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Naikkan level untuk membuka badge di bawah ini
          </p>
        </div>
        <div className="p-4">
          {LEVEL_BADGE_TIERS.map((t) => {
            const unlocked = currentLevel >= t.minLevel;
            return (
              <div
                key={t.name}
                className={cn(
                  "flex items-center gap-3 rounded-xl border p-2.5",
                  unlocked ? "border-foreground/40 bg-secondary/40" : "border-border/60 opacity-60",
                )}
              >
                <span
                  className={cn(
                    "flex size-10 items-center justify-center rounded-xl bg-gradient-to-br text-lg",
                    t.cls,
                    unlocked ? t.fx : "grayscale",
                  )}
                >
                  {unlocked ? (
                    <t.icon className="size-5" />
                  ) : (
                    <Lock className="size-4 text-white/80" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{t.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Level {t.minLevel}+
                  </p>
                </div>
                <span
                  className={cn(
                    "text-[10px] font-bold",
                    unlocked ? "text-emerald-400" : "text-zinc-500",
                  )}
                >
                  <span className="inline-flex items-center gap-1">
                    {unlocked ? (
                      <>
                        <Check className="size-3" aria-hidden /> Didapat
                      </>
                    ) : (
                      <>
                        <Lock className="size-3" aria-hidden /> Terkunci
                      </>
                    )}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
        <button
          onClick={onClose}
          className="mt-3 w-full rounded-xl bg-primary py-2 text-sm font-bold text-white"
        >
          Tutup
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------- settings ----

function SettingsScreen({
  onClose,
  onSignOut,
  onOpenCs,
}: {
  onClose: () => void;
  onSignOut: () => Promise<void>;
  onOpenCs: () => void;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  // Pintasan layar Notifikasi dari Pengaturan (fitur baru).
  const [showNotif, setShowNotif] = useState(false);
  const update = useMutation(api.account.updateSettings);
  const updateProfile = useMutation(api.account.updateProfile);
  // Shop border: beli pakai Sacret + pasang/lepas bingkai foto profile.
  const buyBorder = useMutation(api.account.buyBorder);
  const equipBorder = useMutation(api.account.equipBorder);
  const [busyBorder, setBusyBorder] = useState<string | null>(null);
  // TITLE & KARTU GACHA — pasang dari koleksi yang sudah dimiliki.
  const myCosmetics = useQuery(api.titles.myTitles, {});
  const equipTitle = useMutation(api.titles.equip);
  // MULTI-EQUIP — maksimal 3 title tampil di detail akun.
  const toggleTitleM = useMutation(api.titles.toggleTitle);
  const [busyCosmetic, setBusyCosmetic] = useState<string | null>(null);
  // GACHA KARTU ANIME DIHAPUS PERMANEN — hadiah gacha sekarang keluar dari
  // mesin vending (XP, telur pet, Sacret, premium), bukan kartu karakter.
  const [name, setName] = useState(user?.username ?? "");
  const [savingName, setSavingName] = useState(false);
  const [busyPhoto, setBusyPhoto] = useState(false);
  const [banner, setBanner] = useState(user?.bannerUrl ?? "");
  const [busyBanner, setBusyBanner] = useState(false);
  const bannerInputRef = useRef<HTMLInputElement | null>(null);
  // LATAR HOME — gambar 9:16 dari galeri, disimpan di perangkat ini.
  const [homeBg, setHomeBg] = useState<string | null>(() => {
    try {
      return window.localStorage.getItem(HOME_BG_KEY);
    } catch {
      return null;
    }
  });
  const [busyHomeBg, setBusyHomeBg] = useState(false);
  const [theme, setTheme] = useState(user?.theme ?? "dark");
  const [customColor, setCustomColor] = useState(user?.customColor ?? "#e11d48");
  // "Animasi profil" DIHAPUS permanen — state-nya ikut dihapus.
  // Anti lag: status lokal (tidak perlu server), langsung diterapkan ke <html>.
  const [antiLag, setAntiLagState] = useState(() => getAntiLag());
  // AUTO NEXT default — disimpan di perangkat; layar Nonton ikut membaca
  // kunci yang sama (fitur baru di Pengaturan).
  const [autoNext, setAutoNext] = useState(() => {
    try {
      return window.localStorage.getItem("yn:auto-next") === "1";
    } catch {
      return false;
    }
  });
  // ===== PREFERENSI PER KATEGORI (kotak toggle) — disimpan di perangkat. =====
  const [watchPrefs, setWatchPrefs] = useLocalPrefs("yn:prefs-watch", PREF_NONTON);
  const [notifPrefs, setNotifPrefs] = useLocalPrefs("yn:prefs-notif", PREF_NOTIF);
  const [tampilanPrefs, setTampilanPrefs] = useLocalPrefs("yn:prefs-tampilan", PREF_TAMPILAN);
  const [chatPrefs, setChatPrefs] = useLocalPrefs("yn:prefs-chat", PREF_CHAT);
  const [privasiPrefs, setPrivasiPrefs] = useLocalPrefs("yn:prefs-privasi", PREF_PRIVASI);
  const [unduhanPrefs, setUnduhanPrefs] = useLocalPrefs("yn:prefs-unduhan", PREF_UNDUHAN);
  // Toast bawah sudah dihapus permanen, jadi galat pengaturan tampil inline.
  const [err, setErr] = useState("");
  // Panel hanya untuk developer (#1 / title dev) & moderator.
  const access = useQuery(api.moderation.myPanelAccess, {});
  // Daftar hitam pribadi: siapa saja yang sudah diblokir dari komentar/chat.
  const blockedUsers = useQuery(api.activities.listBlocked);
  const unblockUser = useMutation(api.activities.unblockUser);
  const [showBlocked, setShowBlocked] = useState(false);
  const [busyUnblock, setBusyUnblock] = useState<string | null>(null);
  const panelLevel: "dev" | "mod" | "none" =
    access?.level === "dev" ? "dev" : access?.level === "mod" ? "mod" : "none";
  useHideNavOnMount(); // fullscreen: navbar & mini player hilang total

  if (!user) return null;

  const ownedBorders = user.ownedBorders ?? [];
  const equippedBorder = user.avatarBorder ?? "none";
  const isPremium = (user.premiumUntil ?? 0) > Date.now();

  // Simpan tanpa nunggu server (fire & forget) → UI terasa instan
  const quickSave = (args: Record<string, unknown>) => {
    setErr("");
    void update(args).catch((e) =>
      setErr(e instanceof Error ? e.message : "Gagal menyimpan"),
    );
  };

  /** Simpan username baru dari kartu Setting Profil. Server yang mengurus
   *  validasi (minimal 3 karakter, hanya A-Z/a-z/0-9/_ , tidak bentrok). */
  const saveName = async () => {
    if (savingName) return;
    const clean = name.trim();
    if (clean === (user?.username ?? "")) return;
    setErr("");
    setSavingName(true);
    try {
      await updateProfile({ username: clean });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal menyimpan username");
    } finally {
      setSavingName(false);
    }
  };

  const applyTheme = (t: string, color?: string) => {
    document.documentElement.classList.toggle("theme-light", t === "light");
    if (color) document.documentElement.style.setProperty("--primary", color);
  };

  // Toggle per kategori — beberapa juga menulis kunci lawas supaya layar
  // Nonton/tema tetap mengikuti (mis. auto next → yn:auto-next).
  const toggleWatch = (k: string) => {
    setWatchPrefs((p) => {
      const next = { ...p, [k]: !p[k] };
      if (k === "autoNext") {
        try {
          window.localStorage.setItem("yn:auto-next", next.autoNext ? "1" : "0");
        } catch { /* mode privat */ }
        setAutoNext(next.autoNext);
      }
      return next;
    });
  };
  const toggleNotif = (k: string) => setNotifPrefs((p) => ({ ...p, [k]: !p[k] }));
  const toggleChat = (k: string) => setChatPrefs((p) => ({ ...p, [k]: !p[k] }));
  const togglePrivasi = (k: string) => setPrivasiPrefs((p) => ({ ...p, [k]: !p[k] }));
  const toggleUnduhan = (k: string) => setUnduhanPrefs((p) => ({ ...p, [k]: !p[k] }));
  const toggleTampilan = (k: string) => {
    setTampilanPrefs((p) => {
      const next = { ...p, [k]: !p[k] };
      // Anti lag langsung diterapkan ke <html> biar efeknya ketahuan.
      if (k === "antiLag") {
        setAntiLagState(next.antiLag);
        setAntiLagPref(next.antiLag);
      }
      return next;
    });
  };

  /** Tekan kartu border di Shop: belum punya → BELI (langsung dipakai),
   *  sudah punya → PAKAI, sedang dipakai → bisa LEPAS ("none"). */
  /** Pasang / lepas TITLE dari Pengaturan.
      - `null` = LEPAS SEMUA title (mengosongkan daftar multi-equip).
      - id title = toggle (maksimal 3 title terpasang). */
  const pickTitle = async (titleId: string | null) => {
    if (busyCosmetic) return;
    setBusyCosmetic(titleId ?? "none");
    try {
      if (titleId === null) {
        await equipTitle({ titleId: null });
        toast.success("Title dilepas");
      } else {
        const eq =
          myCosmetics?.equippedTitles ??
          (myCosmetics?.equippedTitle ? [myCosmetics.equippedTitle] : []);
        await toggleTitleM({ titleId });
        toast.success(
          eq.includes(titleId) ? "Title dilepas" : "Title dipasang ✨",
        );
      }
    } catch (e2) {
      setErr(
        e2 instanceof Error
          ? e2.message.replace(/^\[CONVEX[^\]]*\]\s*/, "")
          : "Gagal mengubah title",
      );
    } finally {
      setBusyCosmetic(null);
    }
  };

  const pickBorder = async (b: { id: string; name: string }) => {
    if (busyBorder) return;
    setBusyBorder(b.id);
    try {
      if (b.id === "none") {
        await equipBorder({ borderId: "none" });
        toast.success("Border dilepas");
      } else if (ownedBorders.includes(b.id)) {
        await equipBorder({ borderId: b.id });
        toast.success(`Border "${b.name}" dipakai ✨`);
      } else {
        await buyBorder({ borderId: b.id });
        toast.success(`Border "${b.name}" dibeli & langsung dipakai ✨`);
      }
      setErr("");
    } catch (e2) {
      setErr(
        e2 instanceof Error
          ? e2.message.replace(/^\[CONVEX[^\]]*\]\s*/, "")
          : "Gagal mengubah border",
      );
    } finally {
      setBusyBorder(null);
    }
  };

  return (
    <FullScreen title="Pengaturan" onClose={onClose}>
      {/* ===== SETTING PROFIL — ganti username (dipakai di komentar, chat,
          clan, dan leaderboard). Validasi ada di server: 3-20 karakter,
          hanya A-Z a-z 0-9 _, dan tidak boleh bentrok. ===== */}
      <div className="rounded-2xl border border-border bg-card p-3">
        <div className="mb-2.5 flex items-center gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15">
            <User className="size-[18px] text-primary" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold">Setting Profil</p>
            <p className="text-[11px] text-muted-foreground">
              Username tampil di komentar, chat &amp; clan
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="username"
            maxLength={20}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="min-w-0 flex-1 rounded-xl bg-black/35 px-3 py-2.5 text-[13px] font-bold outline-none placeholder:text-white/30"
          />
          <button
            onClick={() => void saveName()}
            disabled={
              savingName ||
              name.trim() === (user?.username ?? "") ||
              name.trim().length < 3
            }
            className="shrink-0 rounded-full bg-primary px-4 py-2.5 text-[12px] font-black text-primary-foreground transition active:scale-[0.97] disabled:opacity-45"
          >
            {savingName ? "Menyimpan…" : "Simpan"}
          </button>
        </div>
        <p className="mt-1.5 text-[10px] leading-snug text-muted-foreground">
          3–20 karakter, hanya huruf, angka, dan garis bawah (_).
        </p>
      </div>

      {/* ===== KOTAK KATEGORI — permintaan: pengaturan jadi kumpulan kotak
          per kategori, tiap kotak berisi deretan tombol toggle on/off. ===== */}
      <SettingsBox
        icon={<Play className="size-[18px] text-primary" />}
        title="Nonton"
        desc="Perilaku player & pemutaran otomatis"
        items={PREF_NONTON}
        value={watchPrefs}
        onToggle={toggleWatch}
      />
      <SettingsBox
        icon={<Bell className="size-[18px] text-primary" />}
        title="Notifikasi"
        desc="Feed, episode anime, chat teman & clan"
        items={PREF_NOTIF}
        value={notifPrefs}
        onToggle={toggleNotif}
      />
      <SettingsBox
        icon={<Palette className="size-[18px] text-primary" />}
        title="Tampilan"
        desc="Tema, animasi & kenyamanan layar"
        items={PREF_TAMPILAN}
        value={tampilanPrefs}
        onToggle={toggleTampilan}
      />
      {/* BANNER PROFIL — dikembalikan ke Pengaturan, menyatu di kotak
          kategori Tampilan (bukan lagi terpisah dari ganti photo profil). */}
      <div className="rounded-2xl border border-border bg-card p-3">
        <div className="mb-2.5 flex items-center gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15">
            <Palette className="size-[18px] text-primary" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold">Banner Profil</p>
            <p className="text-[11px] text-muted-foreground">
              Tampil di detail akun fullscreen · khusus Premium
            </p>
          </div>
          {isPremium && (
            <span className="shrink-0 rounded-full bg-gold/15 px-2 py-0.5 text-[9px] font-black text-gold">
              PREMIUM
            </span>
          )}
        </div>
        <div className="relative mb-2 h-24 overflow-hidden rounded-xl bg-black/30">
          {banner ? (
            <img src={banner} alt="" className="size-full object-cover" />
          ) : (
            <span className="flex size-full items-center justify-center text-[10px] text-white/35">
              Belum ada banner
            </span>
          )}
          <span className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/60 to-transparent" />
        </div>
        <input
          ref={bannerInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            if (!isPremium) {
              setErr("Banner profil khusus akun Premium");
              return;
            }
            setBusyBanner(true);
            void (async () => {
              try {
                const small = await shrinkBanner(f);
                await updateProfile({ bannerUrl: small });
                setBanner(small);
                setErr("");
              } catch (e2) {
                setErr(e2 instanceof Error ? e2.message : "Gagal mengganti banner");
              } finally {
                setBusyBanner(false);
              }
            })();
          }}
        />
        <div className="flex gap-2">
          <button
            onClick={() => bannerInputRef.current?.click()}
            disabled={busyBanner}
            className="flex-1 rounded-xl bg-sky-300 py-2 text-[11px] font-black text-sky-950 transition active:scale-[0.98] disabled:opacity-50"
          >
            {busyBanner ? "Memproses…" : "Ganti banner"}
          </button>
          {banner && (
            <button
              onClick={() => {
                setBanner("");
                setErr("");
                void updateProfile({ bannerUrl: "" }).catch((e2) =>
                  setErr(e2 instanceof Error ? e2.message : "Gagal melepas banner"),
                );
              }}
              className="rounded-xl border border-white/15 px-3 py-2 text-[11px] font-bold text-white/60"
            >
              Lepas
            </button>
          )}
        </div>
      </div>

      <SettingsBox
        icon={<MessageSquare className="size-[18px] text-primary" />}
        title="Chat"
        desc="Pesan, sticker & cara mengetik"
        items={PREF_CHAT}
        value={chatPrefs}
        onToggle={toggleChat}
      />
      <SettingsBox
        icon={<Shield className="size-[18px] text-primary" />}
        title="Privasi"
        desc="Siapa yang bisa melihat & menghubungimu"
        items={PREF_PRIVASI}
        value={privasiPrefs}
        onToggle={togglePrivasi}
      />
      {/* DAFTAR HITAM — kelola user yang diblokir dari komentar & chat. */}
      <button
        onClick={() => setShowBlocked(true)}
        className="w-full rounded-2xl border border-border bg-card p-3 text-left transition hover:border-foreground/40"
      >
        <span className="flex items-center gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#E84855]/15">
            <Ban className="size-[18px] text-[#E84855]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-bold">Daftar Hitam</span>
            <span className="block text-[11px] text-muted-foreground">
              {blockedUsers?.length
                ? `${blockedUsers.length} pengguna diblokir · ketuk untuk kelola`
                : "Belum ada pengguna yang diblokir"}
            </span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </span>
      </button>
      <SettingsBox
        icon={<Download className="size-[18px] text-primary" />}
        title="Unduhan & Kuota"
        desc="Mengelola unduhan & penghemat data"
        items={PREF_UNDUHAN}
        value={unduhanPrefs}
        onToggle={toggleUnduhan}
      />
        {panelLevel !== "none" && <StaffPanel level={panelLevel} />}

      {/* CS + email + log out */}
      <BlockTitle>Lainnya</BlockTitle>
      <div className="space-y-2">
        <button
          onClick={onOpenCs}
          className="flex w-full items-center gap-2.5 rounded-xl border border-border bg-card p-3 text-left transition hover:border-foreground/40"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15">
            <Headset className="size-[18px] text-primary" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-semibold">CS</span>
            <span className="block text-[11px] text-muted-foreground">
              Customer service YoruNime
            </span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </button>
        <div className="flex items-center gap-2.5 rounded-2xl border border-white/10 bg-card p-3 text-[13px]">
          <Mail className="size-4 shrink-0 text-primary" /> Lstreamsupport@gmail.com
        </div>
        <button
          onClick={async () => {
            await onSignOut();
            navigate("/home");
          }}
          className="flex w-full items-center gap-2.5 rounded-2xl border border-red-500/40 bg-red-500/10 p-3 text-[13px] font-semibold text-red-300 transition hover:border-red-400 hover:bg-red-500/20 active:scale-[0.99]"
        >
          <LogOut className="size-4 shrink-0" /> Log out dari akun
        </button>
      </div>

      {/* DAFTAR HITAM (overlay dari Pengaturan). */}
      {showBlocked && (
        <div className="fixed inset-0 z-[140] flex flex-col bg-background">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
            <button
              onClick={() => setShowBlocked(false)}
              aria-label="Tutup"
              className="flex size-8 items-center justify-center rounded-full bg-white/[0.08] text-white/70"
            >
              <ChevronLeft className="size-4" />
            </button>
            <p className="text-sm font-black">Daftar Hitam</p>
            <span className="ml-auto rounded-full bg-white/[0.08] px-2 py-0.5 text-[10px] font-bold text-white/60">
              {blockedUsers?.length ?? 0}
            </span>
          </div>
          <div className="thin-scroll min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3">
            <p className="rounded-xl border border-border bg-card p-2.5 text-[11px] leading-relaxed text-muted-foreground">
              Komentar dan aktivitas pengguna di daftar ini disembunyikan
              untukmu. Kamu bisa membuka blokir kapan saja.
            </p>
            {blockedUsers === undefined && (
              <p className="py-6 text-center text-xs text-muted-foreground">
                Memuat…
              </p>
            )}
            {blockedUsers?.length === 0 && (
              <p className="py-10 text-center text-[12px] text-muted-foreground">
                Belum ada pengguna yang diblokir.
              </p>
            )}
            {blockedUsers?.map((b) => (
              <div
                key={b.userId}
                className="flex items-center gap-2.5 rounded-xl border border-border bg-card p-2.5"
              >
                <Avatar src={b.image} seed={b.username} className="size-9 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold">{b.username}</p>
                  <p className="text-[10.5px] text-muted-foreground">
                    Diblokir {timeAgo(b.createdAt)}
                  </p>
                </div>
                <button
                  disabled={busyUnblock === b.userId}
                  onClick={async () => {
                    setBusyUnblock(b.userId);
                    try {
                      await unblockUser({ userId: b.userId as never });
                    } catch (e2) {
                      setErr(
                        e2 instanceof Error
                          ? e2.message
                          : "Gagal membuka blokir",
                      );
                    } finally {
                      setBusyUnblock(null);
                    }
                  }}
                  className="shrink-0 rounded-full border border-[#1CA7EC]/45 bg-[#1CA7EC]/10 px-3 py-1.5 text-[11px] font-black text-[#7fd3f7] transition active:scale-95 disabled:opacity-50"
                >
                  {busyUnblock === b.userId ? "…" : "Buka blokir"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pintasan layar Notifikasi (overlay dari Pengaturan). */}
      {showNotif && <NotifScreen onClose={() => setShowNotif(false)} />}
    </FullScreen>
  );
}

/** Judul bagian di pengaturan: kapital kecil + garis emas pendek. */
function BlockTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-2 mt-5 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-gold/90">
      <span aria-hidden className="h-px w-5 bg-gold/60" />
      {children}
    </h2>
  );
}

function ToggleRow({
  label,
  desc,
  value,
  onToggle,
}: {
  label: string;
  desc?: string;
  value: boolean;
  onToggle: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-border bg-card p-3">
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium">{label}</p>
        {desc && <p className="text-[11px] text-muted-foreground">{desc}</p>}
      </div>
      <button
        onClick={() => onToggle(!value)}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition",
          value ? "bg-gradient-to-r from-emerald-400 to-primary shadow-[0_0_12px_-4px_rgba(var(--primary),0.9)]" : "bg-zinc-600",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-5 rounded-full bg-white shadow-md transition-all",
            value ? "left-[22px]" : "left-0.5",
          )}
        />
      </button>
    </div>
  );
}

/* ===== PREFERENSI PER KATEGORI — daftar item toggle di tiap kotak =====
   Setiap item punya key (kunci localStorage), label, desc, dan default. */
type PrefItem = { key: string; label: string; desc: string; def?: boolean };

const PREF_NONTON: readonly PrefItem[] = [
  { key: "autoNext", label: "Auto next episode", desc: "Langsung putar episode berikutnya sehabis selesai", def: true },
  { key: "autoSkipOp", label: "Auto skip opening", desc: "Lewati OP otomatis saat mulai nonton", def: true },
  { key: "autoSkipEd", label: "Auto skip ending", desc: "Lewati ED otomatis di akhir episode", def: true },
  { key: "autoSkipRecap", label: "Auto skip rekap", desc: "Lewati rekap singkat sebelum episode baru" },
  { key: "autoplay", label: "Putar otomatis", desc: "Video langsung diputar begitu siap", def: true },
  { key: "resume", label: "Ingat posisi nonton", desc: "Lanjut dari detik terakhir kamu berhenti", def: true },
  { key: "skipFiller", label: "Lewati filler", desc: "Tandai & lewati episode filler" },
  { key: "nextNight", label: "Auto next malam hari", desc: "Auto next hanya aktif di atas jam 22.00" },
  { key: "bigControls", label: "Kontrol besar", desc: "Tombol & bar player lebih besar" },
  { key: "dataSaver", label: "Hemat kuota", desc: "Pakai kualitas lebih rendah untuk hemat data" },
];

const PREF_NOTIF: readonly PrefItem[] = [
  { key: "feed", label: "Notifikasi feed", desc: "Post & aktivitas terbaru dari teman", def: true },
  { key: "anime", label: "Episode anime", desc: "Episode baru dari judul yang kamu Subscribe", def: true },
  { key: "friendChat", label: "Chat teman", desc: "Pesan masuk dari teman", def: true },
  { key: "reply", label: "Reply & like", desc: "Balasan dan like di komentar kamu", def: true },
  { key: "friend", label: "Request teman", desc: "Permintaan pertemanan yang masuk", def: true },
  { key: "clan", label: "Clan", desc: "Info, undangan & pengumuman dari clan", def: true },
  { key: "bond", label: "Afinitas", desc: "Ajakan bond & pemberitahuan relasi", def: true },
  { key: "sound", label: "Suara notifikasi", desc: "Bunyi saat notifikasi masuk", def: true },
  { key: "vibrate", label: "Getar", desc: "Getarkan perangkat saat notifikasi masuk", def: true },
];

const PREF_TAMPILAN: readonly PrefItem[] = [
  { key: "antiLag", label: "Anti lag", desc: "Matikan animasi, blur & efek berat biar lancar" },
  { key: "animations", label: "Animasi transisi", desc: "Efek halus saat pindah layar", def: true },
  { key: "blur", label: "Efek blur & kaca", desc: "Latar buram dan tampilan kaca", def: true },
  { key: "autoTheme", label: "Ikuti tema sistem", desc: "Gelap/terang otomatis mengikuti HP" },
  { key: "bigText", label: "Teks lebih besar", desc: "Perbesar ukuran huruf di seluruh aplikasi" },
  { key: "showBanner", label: "Tampilkan banner profil", desc: "Banner tampil di halaman profil", def: true },
];

const PREF_CHAT: readonly PrefItem[] = [
  { key: "enterSend", label: "Enter untuk kirim", desc: "Tekan Enter langsung mengirim pesan", def: true },
  { key: "autoTranslate", label: "Terjemah otomatis", desc: "Terjemahkan pesan berbahasa asing" },
  { key: "showSticker", label: "Pratinjau sticker", desc: "Tampilkan sticker langsung di kolom chat", def: true },
  { key: "sound", label: "Suara pesan masuk", desc: "Bunyi saat ada pesan baru", def: true },
  { key: "readReceipt", label: "Tanda dibaca", desc: "Centang biru saat pesan sudah dibaca", def: true },
  { key: "typing", label: "Indikator mengetik", desc: "Tampilkan \"sedang mengetik\" dari teman", def: true },
  { key: "autoMedia", label: "Unduh media otomatis", desc: "Simpan foto/sticker yang masuk otomatis" },
];

const PREF_PRIVASI: readonly PrefItem[] = [
  { key: "online", label: "Status online", desc: "Tampilkan saat kamu sedang aktif", def: true },
  { key: "activity", label: "Aktivitas nonton", desc: "Tampilkan apa yang sedang kamu tonton", def: true },
  { key: "showClan", label: "Tampilkan clan", desc: "Tampilkan clan kamu di profil", def: true },
  { key: "dmStranger", label: "Pesan orang asing", desc: "Izinkan pesan dari yang bukan teman" },
  { key: "showEmail", label: "Email publik", desc: "Tampilkan email di halaman profil" },
  { key: "searchable", label: "Bisa dicari", desc: "Izinkan orang lain menemukan profilmu", def: true },
];

const PREF_UNDUHAN: readonly PrefItem[] = [
  { key: "wifiOnly", label: "Hanya via WiFi", desc: "Unduh hanya saat tersambung WiFi" },
  { key: "autoDelete", label: "Hapus setelah ditonton", desc: "Bersihkan unduhan yang sudah selesai" },
  { key: "notifDone", label: "Notifikasi selesai", desc: "Beri tahu saat unduhan rampung", def: true },
  { key: "smartQuality", label: "Kualitas cerdas", desc: "Sesuaikan kualitas unduhan dengan ruang simpan", def: true },
  { key: "meteredPause", label: "Jeda saat kuota menipis", desc: "Hentikan unduhan otomatis saat data hampir habis" },
];

/** Baca preferensi boolean dari localStorage (untuk nilai awal toggle). */
function readFlag(key: string, def = false): boolean {
  try {
    const v = window.localStorage.getItem(key);
    return v === null ? def : v === "1";
  } catch {
    return def;
  }
}

/** Hook preferensi per kotak: simpan & baca JSON di localStorage. */
function useLocalPrefs(
  storageKey: string,
  items: readonly PrefItem[],
): [Record<string, boolean>, React.Dispatch<React.SetStateAction<Record<string, boolean>>>] {
  const [prefs, setPrefs] = useState<Record<string, boolean>>(() => {
    const base: Record<string, boolean> = {};
    for (const it of items) base[it.key] = it.def ?? false;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) Object.assign(base, JSON.parse(raw) as Record<string, boolean>);
    } catch {
      /* storage diblokir */
    }
    return base;
  });

  // Tulis ke storage tiap kali nilai berubah.
  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(prefs));
    } catch {
      /* storage diblokir */
    }
  }, [storageKey, prefs]);

  return [prefs, setPrefs];
}

/** Satu kotak kategori berisi judul + deretan toggle on/off. */
function SettingsBox({
  icon,
  title,
  desc,
  items,
  value,
  onToggle,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  items: readonly PrefItem[];
  value: Record<string, boolean>;
  onToggle: (key: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className="mb-2.5 flex items-center gap-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold">{title}</p>
          <p className="text-[11px] text-muted-foreground">{desc}</p>
        </div>
      </div>
      <div className="space-y-2">
        {items.map((it) => (
          <ToggleRow
            key={it.key}
            label={it.label}
            desc={it.desc}
            value={!!value[it.key]}
            onToggle={() => onToggle(it.key)}
          />
        ))}
      </div>
    </div>
  );
}

/* REWARDS pengaturan — klaim sekali, dapat 5000 Sacret. */
function RewardClaim() {
  const claimM = useMutation(api.account.claimSettingReward);
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [msg, setMsg] = useState("");

  const claim = async () => {
    if (state !== "idle") return;
    setState("busy");
    setMsg("");
    try {
      await claimM({});
      setState("done");
    } catch (e) {
      setState("idle");
      setMsg(e instanceof Error ? e.message : "Gagal klaim rewards");
    }
  };

  return (
    <>
      <BlockTitle>Rewards</BlockTitle>
      <div className="rounded-xl border border-border bg-card p-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/15">
            <SacretIcon className="size-5 text-sky-300" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-semibold">
              Hadiah pengaturan
            </span>
            <span className="block text-[11px] text-muted-foreground">
              {state === "done"
                ? "5000 Sacret sudah masuk ke akunmu"
                : "Klaim 5000 Sacret (sekali per akun)"}
            </span>
          </span>
          <button
            onClick={() => void claim()}
            disabled={state !== "idle"}
            className="shrink-0 rounded-lg bg-primary px-3 py-2 text-[12px] font-black text-primary-foreground transition active:scale-95 disabled:opacity-60"
          >
            {state === "done" ? "Diklaim" : state === "busy" ? "…" : "Klaim"}
          </button>
        </div>
        {msg && <p className="mt-2 text-[11px] text-rose-300">{msg}</p>}
      </div>
    </>
  );
}

function QualityRow({
  label,
  value,
  onPick,
}: {
  label: string;
  value: string;
  onPick: (q: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const Q = ["144p", "240p", "360p", "480p", "720p", "1080p"];
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <button className="flex w-full items-center justify-between" onClick={() => setOpen((v) => !v)}>
        <p className="text-[13px] font-medium">{label}</p>
        <span className="rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold text-primary">
          {value}
        </span>
      </button>
      {open && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {Q.map((q) => (
            <button
              key={q}
              onClick={() => {
                onPick(q);
                setOpen(false);
              }}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-xs",
                value === q ? "border-foreground/40 text-primary" : "border-border",
              )}
            >
              {q}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SpeedRow({
  label,
  value,
  onPick,
}: {
  label: string;
  value: number;
  onPick: (s: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const S = [0.5, 0.75, 1, 1.25, 1.5, 2];
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <button className="flex w-full items-center justify-between" onClick={() => setOpen((v) => !v)}>
        <p className="text-[13px] font-medium">{label}</p>
        <span className="rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold text-primary">
          {value}x
        </span>
      </button>
      {open && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {S.map((s) => (
            <button
              key={s}
              onClick={() => {
                onPick(s);
                setOpen(false);
              }}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-xs",
                value === s ? "border-foreground/40 text-primary" : "border-border",
              )}
            >
              {s}x
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------- notifikasi ----

function NotifScreen({ onClose }: { onClose: () => void }) {
  const notifs = useQuery(api.activities.listNotifications, {});
  const markRead = useMutation(api.activities.markNotificationsRead);
  useEffect(() => {
    void markRead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useHideNavOnMount(); // fullscreen: navbar & mini player hilang total
  const icons: Record<string, LucideIcon> = {
    update: Bell,
    reply: CornerUpRight,
    like: Heart,
    friend_chat: MessageSquare,
    friend_request: User,
    request_rejected: CircleAlert,
    clan: Shield,
    moderation: ShieldAlert,
    report: Flag,
  };
  return (
    <FullScreen title="Notifikasi" onClose={onClose}>
      <div className="space-y-2">
        {(notifs ?? []).map((n: any) => (
          <div
            key={n._id}
            className="flex items-center gap-3 rounded-xl border border-border/70 bg-secondary/30 p-3"
          >
            <span className="flex size-8 shrink-0 items-center justify-center">
              {n.type === "friend_chat" && n.refImage ? (
                <Avatar src={n.refImage} className="size-8" />
              ) : (
                (() => {
                  const NotifIcon = icons[n.type] ?? Bell;
                  return <NotifIcon className="size-4 text-muted-foreground" />;
                })()
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{n.title}</p>
              {n.body && <p className="text-xs text-zinc-400">{n.body}</p>}
              <p className="mt-0.5 text-[10px] text-muted-foreground">{timeAgo(n.createdAt)}</p>
            </div>
          </div>
        ))}
        {notifs && notifs.length === 0 && (
          <p className="py-10 text-center text-xs text-muted-foreground">Belum ada notifikasi</p>
        )}
      </div>
    </FullScreen>
  );
}

// ---------------------------------------------------------- dev/mod panel ----

// ------------------------------------------------------------- fullscr ----

// -------------------------------------------------------------- CS chat ----

/** Avatar bot CS: kepala headset di atas lingkaran brand. Bukan emoji. */
function CsBotAvatar({ size = 36 }: { size?: number }) {
  return (
    <span
      className="relative flex shrink-0 items-center justify-center rounded-full border border-foreground/40 bg-primary/15"
      style={{ width: size, height: size }}
    >
      <Headset className="text-primary" style={{ width: size * 0.5, height: size * 0.5 }} />
    </span>
  );
}

function CsChatScreen({ onClose }: { onClose: () => void }) {
  useHideNavOnMount();
  const { user } = useAuth();
  const thread = useQuery(api.cs.myThread, {});
  const messages = useQuery(
    api.cs.threadMessages,
    thread?.threadId ? { threadId: thread.threadId } : "skip",
  );
  const send = useMutation(api.cs.sendMessage);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages?.length, thread?.threadId]);

  const waiting = thread?.status === "waiting";
  const ended = thread && !thread.canOpen;
  const locked = !!waiting || !!ended;

  const submit = async () => {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    try {
      await send({ text: body });
      setText("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengirim");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-background">
      <div className="flex items-center gap-2.5 border-b border-white/10 px-3 py-2.5">
        <button
          onClick={onClose}
          aria-label="Kembali"
          className="flex shrink-0 items-center py-1 pr-1 text-foreground/90 transition active:opacity-60"
        >
          <StripBackIcon />
        </button>
        <CsBotAvatar size={38} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold leading-tight">Customer Service</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {waiting ? "Menunggu developer" : "Developer YoruNime"}
          </p>
        </div>
      </div>

      <div className="thin-scroll flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {(messages ?? []).map((m: any) => {
          const mine = m.from === "user";
          return (
            <div
              key={m._id}
              className={cn("flex items-end gap-2", mine && "flex-row-reverse")}
            >
              {!mine && <CsBotAvatar size={26} />}
              <div
                className={cn(
                  "max-w-[78%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed",
                  mine
                    ? "rounded-br-md bg-primary text-primary-foreground"
                    : "rounded-bl-md border border-white/10 bg-card",
                )}
              >
                {m.text}
              </div>
            </div>
          );
        })}
        {!thread?.threadId && (
          <p className="py-10 text-center text-xs text-muted-foreground">
            Tulis keluhan atau pertanyaan kamu. Developer akan membalas di sini.
          </p>
        )}
        <div ref={endRef} />
      </div>

      {/* Kolom pesan terkunci Grey selama menunggu / selesai. */}
      <div className="border-t border-white/10 p-3 pb-6">
        {ended && (
          <p className="mb-2 text-center text-[11px] text-muted-foreground">
            CS sudah selesai. Bisa buka lagi dalam 24 jam.
          </p>
        )}
        <div
          className={cn(
            "flex items-end gap-2 rounded-2xl border px-3 py-2 transition",
            locked
              ? "border-white/10 bg-white/[0.04]"
              : "border-border bg-card focus-within:border-foreground/40",
          )}
        >
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (!locked) void submit();
              }
            }}
            disabled={locked}
            rows={1}
            placeholder={
              waiting
                ? "Menunggu developer menerima..."
                : ended
                  ? "CS sudah selesai"
                  : "Tulis pesan..."
            }
            className={cn(
              "max-h-28 min-h-[36px] flex-1 resize-none bg-transparent py-2 text-[13px] outline-none",
              locked ? "cursor-not-allowed text-zinc-600" : "",
            )}
          />
          <button
            onClick={() => void submit()}
            disabled={locked || !text.trim() || busy}
            aria-label="Kirim"
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-xl",
              locked || !text.trim()
                ? "bg-white/[0.06] text-zinc-600"
                : "bg-primary text-primary-foreground",
            )}
          >
            <Send className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function FullScreen({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto overflow-x-hidden bg-background">
      <div className="w-full min-w-0 px-3 pb-8">
        <div className="mb-2 mt-1 flex items-center gap-2">
          <button
            onClick={onClose}
            aria-label="Kembali"
            className="flex shrink-0 items-center py-1 pr-1 text-foreground/90 transition active:opacity-60"
          >
            <StripBackIcon />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
