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
  Bell,
  CircleAlert,
  CornerUpRight,
  Flag,
  Lock,
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
          onClick={() => navigate("/clan")}
          aria-label="Buka layar Clan"
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
  // Toast bawah sudah dihapus permanen, jadi galat pengaturan tampil inline.
  const [err, setErr] = useState("");
  // Panel hanya untuk developer (#1 / title dev) & moderator.
  const access = useQuery(api.moderation.myPanelAccess, {});
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

  const applyTheme = (t: string, color?: string) => {
    document.documentElement.classList.toggle("theme-light", t === "light");
    if (color) document.documentElement.style.setProperty("--primary", color);
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
      <BlockTitle>Akun</BlockTitle>
      <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-card p-3.5">
        {/* Hiasan: titik halus + orb warna tema — tanpa blur menyilaukan. */}
        <span aria-hidden className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.05)_1px,transparent_1.3px)] [background-size:20px_20px] opacity-60" />
        <span aria-hidden className="absolute -right-8 -top-10 size-24 rounded-full bg-primary/15 blur-2xl" />
        <span aria-hidden className="absolute left-2.5 top-2.5 size-3 border-l-2 border-t-2 border-primary/50 rounded-tl-md" />
        <div className="relative flex items-center gap-2.5">
          <FramedAvatar
            border={user.avatarBorder}
            src={user.image}
            seed={user.username}
            className="size-12"
          />
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[13px] font-bold">
              {user.username}
              {(user.premiumUntil ?? 0) > Date.now() && <BlueCheck />}
            </p>
            <p className="text-[11px] text-muted-foreground">
              ID: {displayId(user.seqId, user._id)} · Level {user.level}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <LevelBadge level={user.level ?? 1} />
              <button
                onClick={() => {
                  void navigator.clipboard
                    .writeText(String(displayId(user.seqId, user._id)))
                    .then(() => toast.success("ID akun disalin"))
                    .catch(() => toast.error("Gagal menyalin ID"));
                }}
                className="rounded-full border border-white/15 px-2.5 py-0.5 text-[10px] font-bold text-white/70 transition hover:border-white/40 hover:text-white active:scale-95"
              >
                Salin ID
              </button>
            </div>
          </div>
        </div>
        {/* Tombol "Ganti photo profile" di Pengaturan DIHAPUS (permintaan
            user) — ganti photo & refresh photo sekarang lewat tombol kamera
            di pojok kanan bawah foto profil (layar Akun). */}
        <div className="relative mt-2 flex min-w-0 gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-input bg-background/60 px-3 text-[13px]"
            placeholder="Ubah nama"
            maxLength={16}
          />
          <button
            disabled={savingName || !name.trim() || name.trim() === user.username}
            onClick={async () => {
              setSavingName(true);
              setErr("");
              try {
                const clean = name.trim();
                await updateProfile({ username: clean });
                setName(clean);
              } catch (err2) {
                setErr(
                  err2 instanceof Error
                    ? err2.message.replace(/^\[CONVEX[^\]]*\]\s*/, "")
                    : "Gagal mengubah nama",
                );
              } finally {
                setSavingName(false);
              }
            }}
            className="h-10 shrink-0 rounded-lg bg-primary px-5 text-[13px] font-bold text-primary-foreground disabled:opacity-40"
          >
            {savingName ? "..." : "OK"}
          </button>
        </div>
        {err && (
          <p className="mt-2 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-[12px] font-semibold text-red-200">
            {err}
          </p>
        )}
      </div>

      {/* ===== SLEIX SHOP DIHAPUS dari Pengaturan (permintaan user:
          "sleix shop nya hapus — yang dipengaturan, bukan YoruVerse").
          Border foto profile tetap ada di YoruVerse › Shop. ===== */}

      {/* (Judul "Title & Kartu" dipindah ke BAWAH bagian Pengaturan —
          penempatan baru.) */}

      <BlockTitle>Pengaturan</BlockTitle>
      <div className="space-y-2">
        <ToggleRow
          label="Anti lag"
          desc="Matikan animasi, blur, dan efek berat biar lancar"
          value={antiLag}
          onToggle={(v) => {
            setAntiLagState(v);
            setAntiLagPref(v);
            toast.success(v ? "Anti lag aktif" : "Anti lag dimatikan");
          }}
        />
        {/* "Animasi profil" DIHAPUS permanen sesuai permintaan. */}
        {/* AUTO NEXT — fitur baru: disimpan di perangkat, dipakai layar Nonton. */}
        <ToggleRow
          label="Auto next"
          desc="Langsung putar episode berikutnya sehabis episode selesai"
          value={autoNext}
          onToggle={(v) => {
            setAutoNext(v);
            try {
              window.localStorage.setItem("yn:auto-next", v ? "1" : "0");
            } catch {
              /* mode privat */
            }
            toast.success(v ? "Auto next aktif" : "Auto next dimatikan");
          }}
        />
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-[13px] font-medium">Tema tampilan</p>
          <div className="mt-2 flex min-w-0 gap-1 rounded-xl border border-white/10 bg-black/25 p-1">
            {["dark", "light", "custom"].map((t) => (
              <button
                key={t}
                onClick={() => {
                  setTheme(t);
                  applyTheme(t, t === "custom" ? customColor : undefined);
                  quickSave({ theme: t });
                }}
                className={cn(
                  "min-w-0 flex-1 truncate rounded-lg py-1.5 text-xs capitalize transition",
                  theme === t
                    ? "bg-gradient-to-b from-white/95 to-white/80 font-black text-black shadow-md shadow-black/30"
                    : "text-white/55 hover:bg-white/10 hover:text-white",
                )}
              >
                {t === "dark" ? "Gelap" : t === "light" ? "Terang" : "Custom"}
              </button>
            ))}
          </div>
          {theme === "custom" && (
            <div className="mt-2 flex min-w-0 items-center gap-2">
              <input
                type="color"
                value={customColor}
                onChange={(e) => {
                  setCustomColor(e.target.value);
                  applyTheme("custom", e.target.value);
                }}
                className="h-9 w-14 shrink-0 rounded border border-border bg-transparent"
              />
              <button
                onClick={() => {
                  quickSave({ customColor });
                  toast.success("Warna tersimpan");
                }}
                className="shrink-0 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-white"
              >
                Simpan warna
              </button>
            </div>
          )}
        </div>

        <QualityRow
          label="Kualitas default"
          value={user.defaultQuality ?? "720p"}
          onPick={(q) => {
            quickSave({ defaultQuality: q });
          }}
        />
        <SpeedRow
          label="Kecepatan default"
          value={user.defaultSpeed ?? 1}
          onPick={(s) => {
            quickSave({ defaultSpeed: s });
          }}
        />

        {/* BERSIHKAN RIWAYAT CARI — fitur baru: hapus daftar "Baru Saja". */}
        <button
          onClick={() => {
            try {
              window.localStorage.removeItem("yn:recent-search");
            } catch {
              /* mode privat */
            }
            toast.success("Riwayat pencarian dibersihkan");
          }}
          className="flex w-full items-center gap-2.5 rounded-xl border border-border bg-card p-3 text-left transition hover:border-foreground/40"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15">
            <HistoryIcon className="size-[18px] text-primary" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-medium">
              Bersihkan riwayat cari
            </span>
            <span className="block text-[11px] text-muted-foreground">
              Hapus daftar “Baru Saja” di layar pencarian
            </span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </button>

        {/* "Gambar fullscreen akun" DIHAPUS permanen sesuai permintaan. */}

        {/* LATAR HOME — background Home (yang hitam) dari GALERI,
            dipotong 9:16 rata atas supaya lurus ke atas dan tetap kelihatan
            di seluruh layar YoruNime. */}
        <BlockTitle>Tampilan</BlockTitle>
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-[13px] font-medium">Ganti Home Screen (9:16)</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Background Home diganti gambar dari galeri — otomatis dipotong
            9:16 (lurus ke atas).
          </p>
          {homeBg && (
            <div className="mt-2 overflow-hidden rounded-lg border border-white/10">
              <img
                src={homeBg}
                alt="Pratinjau latar Home"
                className="h-40 w-full object-cover object-top"
              />
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label
              className={cn(
                "group flex w-fit cursor-pointer items-center gap-2 rounded-lg bg-primary px-4 py-2 text-[13px] font-bold text-primary-foreground transition active:scale-95",
                busyHomeBg && "pointer-events-none opacity-60",
              )}
            >
              <Camera className="size-4" aria-hidden />
              {homeBg ? "Ganti dari galeri" : "Pilih dari galeri"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  setBusyHomeBg(true);
                  void (async () => {
                    try {
                      const hd = await shrinkHomeBg(f);
                      window.localStorage.setItem(HOME_BG_KEY, hd);
                      window.dispatchEvent(new Event(HOME_BG_EVENT));
                      setHomeBg(hd);
                      toast.success("Background Home diubah ✨");
                    } catch (er2) {
                      setErr(
                        er2 instanceof Error
                          ? er2.message
                          : "Gagal mengunggah gambar",
                      );
                    } finally {
                      setBusyHomeBg(false);
                    }
                  })();
                }}
              />
            </label>
            {homeBg && (
              <button
                onClick={() => {
                  try {
                    window.localStorage.removeItem(HOME_BG_KEY);
                    window.dispatchEvent(new Event(HOME_BG_EVENT));
                  } catch {
                    /* abaikan */
                  }
                  setHomeBg(null);
                  toast.success("Background Home dikembalikan");
                }}
                className="rounded-lg border border-border px-3 py-2 text-[13px] font-bold text-muted-foreground transition hover:text-foreground"
              >
                Kembalikan
              </button>
            )}
          </div>
        </div>

        {panelLevel !== "none" && <StaffPanel level={panelLevel} />}

      {/* -------- TITLE & KARTU — dipindah ke bawah (penempatan baru) -------- */}
      <BlockTitle>Title & Kartu</BlockTitle>
      <div className="rounded-xl border border-border bg-card p-3">
        <p className="text-[13px] font-medium">Title aktif (maks 3)</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Muncul di bawah nama kamu di layar detail akun. Kelola semua di
          tombol Title (tekan lama tombol Subscribe).
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {(myCosmetics?.defs ?? [])
            .filter((d) => !!myCosmetics?.earnedAt[d.id])
            .map((d) => {
              const eq =
                myCosmetics?.equippedTitles ??
                (myCosmetics?.equippedTitle
                  ? [myCosmetics.equippedTitle]
                  : []);
              const active = eq.includes(d.id);
              return (
                <button
                  key={d.id}
                  type="button"
                  disabled={busyCosmetic !== null}
                  onClick={() => void pickTitle(d.id)}
                  title={d.desc}
                  className="transition active:scale-95 disabled:opacity-60"
                >
                  {/* Preview pita title — bentuk medali, bukan teks polos */}
                  <TitleRibbon
                    name={d.name}
                    size="sm"
                    dim={!active}
                    className={active ? "ring-1 ring-gold/70" : ""}
                  />
                </button>
              );
            })}
          {myCosmetics?.equippedTitle && (
            <button
              type="button"
              disabled={busyCosmetic !== null}
              onClick={() => void pickTitle(null)}
              className="rounded-full border border-white/15 px-3 py-1.5 text-[11px] font-semibold text-muted-foreground transition active:scale-95"
            >
              Lepas semua title
            </button>
          )}
          {(myCosmetics?.defs ?? []).every(
            (d) => !myCosmetics?.earnedAt[d.id],
          ) && (
            <p className="text-[11px] text-muted-foreground">
              Belum ada title — tonton anime atau menangkan gacha!
            </p>
          )}
        </div>

        {/* GACHA KARTU ANIME DIHAPUS PERMANEN — tidak ada lagi grid kartu
            di pengaturan; hadiah vending machine langsung masuk akun. */}
      </div>
      </div>

      {/* CS + email + log out */}
      <RewardClaim />
      <NotifPrefs />

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
        <button
          onClick={() => setShowNotif(true)}
          className="flex w-full items-center gap-2.5 rounded-2xl border border-white/10 bg-card p-3 text-left transition hover:border-primary/50"
        >
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary/15">
            <Bell className="size-[18px] text-primary" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-semibold">Notifikasi</span>
            <span className="block text-[11px] text-muted-foreground">
              Update, reply, request teman & clan
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

/* Preferensi notifikasi per perangkat — anime update, reply, request,
   clan, & Afinitas. Disimpan di localStorage supaya langsung aktif. */
const NOTIF_PREFS = [
  {
    key: "anime",
    label: "Anime update",
    desc: "Episode baru dari judul yang kamu Subscribe",
  },
  {
    key: "reply",
    label: "Reply & like",
    desc: "Balasan dan like di komentar kamu",
  },
  {
    key: "friend",
    label: "Request teman",
    desc: "Permintaan pertemanan yang masuk",
  },
  { key: "clan", label: "Clan", desc: "Info dan undangan dari clan kamu" },
  {
    key: "bond",
    label: "Afinitas",
    desc: "Ajakan bond & pemberitahuan relasi",
  },
] as const;

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

function NotifPrefs() {
  const [prefs, setPrefs] = useState<Record<string, boolean>>(() => {
    try {
      const raw = window.localStorage.getItem("yn:notif-prefs");
      if (raw) return JSON.parse(raw) as Record<string, boolean>;
    } catch {
      /* storage diblokir */
    }
    return { anime: true, reply: true, friend: true, clan: true, bond: true };
  });

  const toggle = (k: string) => {
    setPrefs((p) => {
      const next = { ...p, [k]: !p[k] };
      try {
        window.localStorage.setItem("yn:notif-prefs", JSON.stringify(next));
      } catch {
        /* storage diblokir */
      }
      return next;
    });
  };

  return (
    <>
      <BlockTitle>Notifikasi</BlockTitle>
      <div className="space-y-2">
        {NOTIF_PREFS.map((n) => (
          <ToggleRow
            key={n.key}
            label={n.label}
            desc={n.desc}
            value={prefs[n.key] ?? true}
            onToggle={() => toggle(n.key)}
          />
        ))}
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
