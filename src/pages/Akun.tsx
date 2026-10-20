import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout, useHideNavOnMount } from "@/components/AppLayout";
import { StaffPanel } from "@/components/StaffPanel";
import { BlurBanner } from "@/components/BlurBanner";
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
import { shrinkAvatar, shrinkBanner } from "@/lib/image";
import { FramedAvatar } from "@/components/FramedAvatar";
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
import {
  GACHA_ROSTER,
  type GachaRank,
} from "@/lib/gachaRoster";
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
  const [params] = useSearchParams();
  // Layar Akun kini HANYA tombol Pengaturan. Banner, profil, title, story,
  // statistik, dan tab history/komen/favorite dihapus permanen.
  const [settingsOpen, setSettingsOpen] = useState(
    params.get("tab") === "settings",
  );
  const [csOpen, setCsOpen] = useState(false);

  if (!user) return null;
  return (
    <div className="relative pb-6">
      {/* Kotak profil full lebar + rounded di PALING ATAS: foto profil
          diperbesar, lalu username, tag clan, level, badge, dan title.
          Tombol pengaturan tidak lagi di dalam kotak — sekarang jadi tombol
          melayang (FAB) di pojok kanan bawah. */}
      <AkunProfileHeader user={user} />

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
    </div>
  );
}

/** Kotak profil di paling atas halaman Akun — kotak rounded dengan CELAH
 *  kecil di kiri-kanan & atas (bukan full-bleed), ukuran isi ringkas. */
function AkunProfileHeader({
  user,
}: {
  user: any;
}) {
  const isPremium = (user.premiumUntil ?? 0) > Date.now();
  return (
    /* Ada celah sedikit dari tepi layar (padding wrapper) + sudut rounded,
       sesuai permintaan; foto profile & isi diperkecil supaya tidak
       terlalu besar. BORDER shop ikut dikenakan kalau ada yang dipakai. */
    <div className="mt-3 rounded-2xl border border-white/10 bg-card px-3 py-3">
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
    </div>
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
    <div className="mt-5 space-y-5">
      {rows.map((c: any) => (
        <div
          key={c._id}
          className={cn(
            "fade-enter min-w-0 overflow-hidden rounded-2xl",
            // Kalau komentar punya banner profil, bannernya MENUTUPI SELURUH
            // kotak komentar (bukan kotak kecil di atas username).
            c.bannerUrl && "relative border border-white/10",
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
          <div className={cn("relative flex items-start gap-2.5", c.bannerUrl && "p-2.5")}>
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
                    <span className="shrink-0 rounded bg-white/10 px-1 text-[9px] font-bold text-white/70">
                      Lv.{c.level}
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
  const update = useMutation(api.account.updateSettings);
  const updateProfile = useMutation(api.account.updateProfile);
  // Shop border: beli pakai Sacret + pasang/lepas bingkai foto profile.
  const buyBorder = useMutation(api.account.buyBorder);
  const equipBorder = useMutation(api.account.equipBorder);
  const [busyBorder, setBusyBorder] = useState<string | null>(null);
  // TITLE & KARTU GACHA — pasang dari koleksi yang sudah dimiliki.
  const myCosmetics = useQuery(api.titles.myTitles, {});
  const equipTitle = useMutation(api.titles.equip);
  const equipCard = useMutation(api.gacha.equipCard);
  const [busyCosmetic, setBusyCosmetic] = useState<string | null>(null);
  const [name, setName] = useState(user?.username ?? "");
  const [savingName, setSavingName] = useState(false);
  const [busyPhoto, setBusyPhoto] = useState(false);
  const [banner, setBanner] = useState(user?.bannerUrl ?? "");
  const [theme, setTheme] = useState(user?.theme ?? "dark");
  const [customColor, setCustomColor] = useState(user?.customColor ?? "#e11d48");
  // Anti lag: status lokal (tidak perlu server), langsung diterapkan ke <html>.
  const [antiLag, setAntiLagState] = useState(() => getAntiLag());
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
  /** Pasang / lepas TITLE dari Pengaturan. */
  const pickTitle = async (titleId: string | null) => {
    if (busyCosmetic) return;
    setBusyCosmetic(titleId ?? "none");
    try {
      await equipTitle({ titleId });
      toast.success(titleId ? "Title dipasang ✨" : "Title dilepas");
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

  /** Pasang / lepas KARTU GACHA dari Pengaturan. */
  const pickCard = async (cardId: string) => {
    if (busyCosmetic) return;
    setBusyCosmetic(cardId);
    try {
      await equipCard({ cardId });
      toast.success(cardId === "none" ? "Kartu dilepas" : "Kartu dipasang ✨");
    } catch (e2) {
      setErr(
        e2 instanceof Error
          ? e2.message.replace(/^\[CONVEX[^\]]*\]\s*/, "")
          : "Gagal mengubah kartu",
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
      <div className="rounded-xl border border-border bg-card p-3">
        <div className="flex items-center gap-2.5">
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
            <div className="mt-1">
              <LevelBadge level={user.level ?? 1} />
            </div>
          </div>
        </div>
        {/* Ganti photo profile dari GALERI — tampilan jauh lebih keren:
            foto besar dikelilingi cincin gradasi berputar pelan, plus tombol
            kamera melayang di pojok kanan bawah. Sekali tekan langsung
            membuka galeri; fotonya dikecilkan otomatis sebelum disimpan. */}
        <label className="group mx-auto mt-4 flex w-fit cursor-pointer flex-col items-center">
          {/* Ukuran diperkecil (size-28 → size-20) sesuai permintaan
              "photo profile jangan terlalu gede". Border shop yang sedang
              dipakai menggantikan cincin gradasi berputar. */}
          <span className="relative block size-20">
            {equippedBorder !== "none" ? (
              <FramedAvatar
                border={equippedBorder}
                src={user.image}
                seed={user.username}
                className="size-20"
              />
            ) : (
              <>
                {/* Cincin gradasi berputar di balik foto. */}
                <span
                  aria-hidden
                  className="yn-ring-spin absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,#fbbf24,#f472b6,#818cf8,#34d399,#fbbf24)]"
                />
                {/* Foto profil sekarang — otomatis ter-update setelah galeri
                    dipilih (state user ikut reaktif dari Convex). */}
                <span className="absolute inset-[4px] overflow-hidden rounded-full bg-background">
                  <Avatar src={user.image} seed={user.username} className="size-full" />
                </span>
              </>
            )}
            {/* Tombol kamera melayang — posisinya terlihat jelas di HP. */}
            <span className="absolute -bottom-1 -right-1 z-10 flex size-8 items-center justify-center rounded-full border-[3px] border-background bg-gradient-to-br from-gold to-amber-600 text-black shadow-[0_4px_12px_-2px_rgba(212,175,55,0.8)] transition group-active:scale-90">
              <Camera className="size-3.5" aria-hidden />
            </span>
          </span>
          <span className="mt-3 rounded-full border border-gold/40 bg-gold/10 px-4 py-1.5 text-[12px] font-bold text-gold transition group-hover:bg-gold/20">
            {busyPhoto ? "Memproses gambar…" : "Pilih dari galeri"}
          </span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={busyPhoto}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              setBusyPhoto(true);
              void (async () => {
                try {
                  // Foto HP bisa berukuran 5 MB. Kalau dikirim mentah, dokumen
                  // melebihi batas 1 MiB Convex dan server menolak. Jadi
                  // dikecilkan dulu sebelum dikirim.
                  const small = await shrinkAvatar(f);
                  await updateProfile({ image: small });
                  setErr("");
                  toast.success("Photo profile diganti ✨");
                } catch (err2) {
                  setErr(
                    err2 instanceof Error ? err2.message : "Gagal mengganti photo",
                  );
                } finally {
                  setBusyPhoto(false);
                }
              })();
            }}
          />
        </label>
        <div className="mt-2 flex min-w-0 gap-2">
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

      {/* ===== SLEIX SHOP — BORDER foto profile (permintaan: "di bawahnya
          kotak ganti photo profile … tambahan shop" dengan nama toko
          "Sleix"). Kepala toko gradasi holografik, lalu grid border kreatif
          yang dibeli pakai Sacret dan langsung bisa dipakai/diatur. ===== */}
      <BlockTitle>Sleix Shop</BlockTitle>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {/* Kepala toko: pita holografik CERAH + logo + saldo Sacret. */}
        <div className="relative flex items-center gap-2.5 overflow-hidden px-3 py-2.5">
          <div
            aria-hidden
            className="absolute inset-0 bg-[linear-gradient(115deg,#67e8f9_0%,#a5b4fc_30%,#f0abfc_60%,#fde68a_85%,#67e8f9_100%)] bg-[length:200%_100%]"
          />
          <span className="relative flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/70 ring-1 ring-white/60 shadow-sm">
            <SacretIcon className="size-5 text-amber-500" aria-hidden />
          </span>
          <div className="relative min-w-0 flex-1">
            <p className="text-[13px] font-black tracking-wide text-indigo-950 drop-shadow-sm">
              SLEIX <span className="font-bold opacity-90">Shop</span>
            </p>
            <p className="text-[10px] font-semibold text-indigo-950/75">
              Border kreatif untuk photo profile kamu ✨
            </p>
          </div>
          <span className="relative inline-flex items-center gap-1 rounded-full bg-white/80 px-2.5 py-1 text-[12px] font-black text-sky-700 ring-1 ring-white/60 shadow-sm">
            <SacretIcon className="size-3.5" aria-hidden />
            {Number(user.diamonds ?? 0).toLocaleString("id-ID")}
          </span>
        </div>
        <div className="p-3">
        <p className="text-[11px] text-muted-foreground">
          Beli border dengan Sacret — begitu dipilih langsung terpasang di
          foto profile kamu. Tekan lagi untuk melepas.
        </p>
        <div className="mt-2.5 grid grid-cols-3 gap-2">
          {BORDERS.map((b) => {
            const owned = b.id === "none" || ownedBorders.includes(b.id);
            const active = equippedBorder === b.id;
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => void pickBorder(b)}
                disabled={busyBorder !== null}
                title={b.blurb}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl border p-2 transition active:scale-[0.97] disabled:opacity-60",
                  active
                    ? "border-gold/70 bg-gold/10 shadow-[0_0_14px_-6px_rgba(212,175,55,0.7)]"
                    : "border-white/10 bg-white/[0.02] hover:border-white/30",
                )}
              >
                <FramedAvatar
                  border={b.id === "none" ? undefined : b.id}
                  src={user.image}
                  seed={user.username}
                  className="size-12"
                />
                <span className="text-[10px] font-bold">{b.name}</span>
                <span
                  className={cn(
                    "inline-flex max-w-full items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-black",
                    active
                      ? "bg-emerald-500/20 text-emerald-300"
                      : owned
                        ? "bg-white/10 text-zinc-300"
                        : "bg-primary/20 text-primary",
                  )}
                >
                  {active ? (
                    "Dipakai"
                  ) : b.id === "none" ? (
                    "Lepas"
                  ) : owned ? (
                    "Pakai"
                  ) : (
                    <>
                      <SacretIcon className="size-2.5" aria-hidden />
                      {b.price.toLocaleString("id-ID")}
                    </>
                  )}
                </span>
              </button>
            );
          })}
          </div>
        </div>
      </div>

      {/* -------- TITLE & KARTU GACHA — equip dari koleksi -------- */}
      <BlockTitle>Title & Kartu</BlockTitle>
      <div className="rounded-xl border border-border bg-card p-3">
        <p className="text-[13px] font-medium">Title aktif</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Muncul di bawah nama kamu di layar detail akun. Kelola semua di
          tombol Title (tekan lama tombol Subscribe).
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {(myCosmetics?.defs ?? [])
            .filter((d) => !!myCosmetics?.earnedAt[d.id])
            .map((d) => {
              const active = myCosmetics?.equippedTitle === d.id;
              return (
                <button
                  key={d.id}
                  type="button"
                  disabled={busyCosmetic !== null}
                  onClick={() => void pickTitle(active ? null : d.id)}
                  title={d.desc}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-[11px] font-bold transition active:scale-95 disabled:opacity-60",
                    active
                      ? "border-gold/70 bg-gold/15 text-gold shadow-[0_0_12px_-5px_rgba(212,175,55,.8)]"
                      : "border-white/15 bg-white/[0.04] text-white/85",
                  )}
                >
                  <Award className="mr-1 inline size-3" aria-hidden />
                  {d.name}
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
              Lepas title
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

        <p className="mt-4 text-[13px] font-medium">Kartu anime (Gacha)</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Kartu hasil pull di Gacha — pasang untuk dipamerkan di profil.
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {(myCosmetics?.ownedCards ?? []).map((cardId) => {
            const c = GACHA_ROSTER.find((r) => r.id === cardId);
            if (!c) return null;
            const active = myCosmetics?.equippedCard === c.id;
            const ring: Record<GachaRank, string> = {
              SSS: "border-amber-400/70 bg-amber-400/10 text-amber-300",
              SS: "border-fuchsia-400/60 bg-fuchsia-400/10 text-fuchsia-300",
              S: "border-sky-400/60 bg-sky-400/10 text-sky-300",
            };
            return (
              <button
                key={c.id}
                type="button"
                disabled={busyCosmetic !== null}
                onClick={() => void pickCard(active ? "none" : c.id)}
                title={`${c.name} — ${c.anime} (${c.rank})`}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-[11px] font-bold transition active:scale-95 disabled:opacity-60",
                  active ? ring[c.rank] : "border-white/15 bg-white/[0.04] text-white/85",
                  active && "shadow-[0_0_12px_-5px_rgba(255,255,255,.5)]",
                )}
              >
                {c.name}
                <span className="ml-1 opacity-70">{c.rank}</span>
              </button>
            );
          })}
          {myCosmetics?.equippedCard && (
            <button
              type="button"
              disabled={busyCosmetic !== null}
              onClick={() => void pickCard("none")}
              className="rounded-full border border-white/15 px-3 py-1.5 text-[11px] font-semibold text-muted-foreground transition active:scale-95"
            >
              Lepas kartu
            </button>
          )}
          {(myCosmetics?.ownedCards ?? []).length === 0 && (
            <p className="text-[11px] text-muted-foreground">
              Belum punya kartu — buka tombol Gacha (tekan lama History) lalu
              pull!
            </p>
          )}
        </div>
      </div>

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
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-[13px] font-medium">Tema</p>
          <div className="mt-2 flex min-w-0 gap-2">
            {["dark", "light", "custom"].map((t) => (
              <button
                key={t}
                onClick={() => {
                  setTheme(t);
                  applyTheme(t, t === "custom" ? customColor : undefined);
                  quickSave({ theme: t });
                }}
                className={cn(
                  "min-w-0 flex-1 truncate rounded-lg border py-2 text-xs capitalize",
                  theme === t ? "border-foreground/40 text-primary" : "border-border",
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

        {/* GAMBAR FULLSCREEN AKUN — foto besar di layar detail akun.
            Hanya Premium yang bisa mengaturnya (server juga menolak).
            Foto dari galeri dikompres 1200px (HD, tidak pecah). */}
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13px] font-medium">Gambar fullscreen akun</p>
            {!isPremium && (
              <span className="inline-flex items-center gap-1 rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-[10px] font-bold text-gold">
                <Crown className="size-3" aria-hidden /> Premium
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Muncul besar & tajam di layar detail akun kamu.
          </p>
          {isPremium ? (
            <>
              {banner && (
                <img
                  src={banner}
                  alt=""
                  className="mt-2 h-24 w-full rounded-lg border border-white/10 object-cover"
                />
              )}
              <label className="group mt-2 flex w-fit cursor-pointer items-center gap-2 rounded-lg bg-primary px-4 py-2 text-[13px] font-bold text-primary-foreground transition active:scale-95">
                <Camera className="size-4" aria-hidden />
                Pilih dari galeri
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (!f) return;
                    void (async () => {
                      try {
                        const hd = await shrinkBanner(f);
                        setBanner(hd);
                        await updateProfile({ bannerUrl: hd });
                        toast.success("Gambar fullscreen diubah ✨");
                      } catch (err2) {
                        setErr(
                          err2 instanceof Error
                            ? err2.message
                            : "Gagal mengunggah gambar",
                        );
                      }
                    })();
                  }}
                />
              </label>
              <div className="mt-2 flex min-w-0 gap-2">
                <input
                  value={banner.startsWith("data:") ? "" : banner}
                  onChange={(e) => setBanner(e.target.value)}
                  placeholder="…atau URL gambar/gif"
                  className="min-w-0 flex-1 rounded-lg border border-input bg-background/60 px-3 py-2 text-[13px]"
                />
                <button
                  onClick={async () => {
                    await updateProfile({ bannerUrl: banner });
                    toast.success("Background diubah");
                  }}
                  className="shrink-0 rounded-lg bg-primary px-4 text-[13px] font-bold text-primary-foreground"
                >
                  OK
                </button>
              </div>
            </>
          ) : (
            <button
              onClick={() => navigate("/premium")}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-gold/40 bg-gold/10 py-2.5 text-[13px] font-bold text-gold transition active:scale-[0.98]"
            >
              <Lock className="size-3.5" aria-hidden />
              Ambil Premium untuk mengatur gambar
            </button>
          )}
        </div>

        {panelLevel !== "none" && <StaffPanel level={panelLevel} />}
      </div>

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
        <div className="flex items-center gap-2.5 rounded-xl border border-border bg-card p-3 text-[13px]">
          <Mail className="size-4 shrink-0 text-primary" /> Lstreamsupport@gmail.com
        </div>
        <button
          onClick={async () => {
            await onSignOut();
            navigate("/home");
          }}
          className="flex w-full items-center gap-2.5 rounded-xl border border-destructive/40 bg-card p-3 text-[13px] text-destructive"
        >
          <LogOut className="size-4 shrink-0" /> Log out dari akun
        </button>
      </div>
    </FullScreen>
  );
}

/** Judul bagian di pengaturan: kecil, bukan seperti judul halaman. */
function BlockTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-1.5 mt-4 text-[13px] font-bold text-muted-foreground">
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
          "relative h-6 w-11 rounded-full transition",
          value ? "bg-primary" : "bg-zinc-600",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-5 rounded-full bg-white transition-all",
            value ? "left-[22px]" : "left-0.5",
          )}
        />
      </button>
    </div>
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
        <span className="text-[11px] text-primary">{value}</span>
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
        <span className="text-[11px] text-primary">{value}x</span>
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
          className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5"
        >
          <ChevronLeft className="size-4" />
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
            className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border"
          >
            <ChevronLeft className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
