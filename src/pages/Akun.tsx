import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout, useHideNavOnMount } from "@/components/AppLayout";
import { RequestButtons } from "@/components/RequestButtons";
import { StaffPanel } from "@/components/StaffPanel";
import { BlurBanner } from "@/components/BlurBanner";
import { DEFAULT_CLAN_ICON } from "@/lib/clanIcons";
import {
  Avatar,
  BlueCheck,
  ClanTag,
  LevelBadge,
  RedMark,
  TitleBadge,
} from "@/components/lstream-ui";
import { STAFF_BADGE, LEVEL_BADGE_TIERS, timeAgo, displayId, usernameColor } from "@/lib/lstream";
import { xpForLevel } from "@/lib/level";
import { Lock } from "lucide-react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Crown,
  Gem,
  Heart,
  Headset,
  History as HistoryIcon,
  LogOut,
  Mail,
  MessageSquare,
  Send,
  Settings as SettingsIcon,
  X,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
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
  const [params, setParams] = useSearchParams();
  const tabParam = params.get("tab");
  const [tab, setTab] = useState<"history" | "komen" | "favorite">(
    tabParam === "favorite"
      ? "favorite"
      : tabParam === "history"
        ? "history"
        : "komen",
  );
  const [settingsOpen, setSettingsOpen] = useState(tabParam === "settings");
  const [notifOpen, setNotifOpen] = useState(tabParam === "notif");
  const [badgesOpen, setBadgesOpen] = useState(false);
  const [titlesOpen, setTitlesOpen] = useState(false);
  const [csOpen, setCsOpen] = useState(false);

  const stats = useQuery(api.account.profileStats, user ? {} : "skip");
  const history = useQuery(api.activities.myHistory, user ? {} : "skip");
  const favorites = useQuery(api.activities.myFavorites, user ? {} : "skip");
  const comicHistory = useQuery(api.comics.myHistory, user ? {} : "skip");
  const comicFavorites = useQuery(api.comics.myFavorites, user ? {} : "skip");
  const profile = useQuery(api.account.getPublicProfile, user ? { userId: user._id } : "skip");
  // Data title: clan, peringkat XP, dan peringkat give premium.
  const xpBoard = useQuery(api.account.totalLeaderboard, { limit: 50 });
  const giveBoard = useQuery(api.account.topGive, { limit: 10 });

  if (!user) return null;
  const xpInLevel = user.xp ?? 0;
  const cost = xpForLevel(user.level ?? 1);
  const pct = Math.min(100, (xpInLevel / Math.max(1, cost)) * 100);
  const premium = (user.premiumUntil ?? 0) > Date.now();
  const premiumDays = Math.max(
    0,
    Math.floor(((user.premiumUntil ?? 0) - Date.now()) / 86400000),
  );

  const setTabAndUrl = (t: typeof tab) => {
    setTab(t);
    setParams({});
  };

  // Title hanya muncul kalau datanya memang ada, tidak ada title karangan.
  const xpRank = (xpBoard ?? []).findIndex((r) => r.userId === user._id);
  const giveRank = (giveBoard ?? []).findIndex((r) => r.userId === user._id);
  const titles: { name: string; note: string }[] = [];
  if (user.clanTag)
    titles.push({ name: `Anggota ${user.clanTag}`, note: "Title clan" });
  if (xpRank >= 0)
    titles.push({ name: "Puncak XP", note: `Peringkat #${xpRank + 1}` });
  if (giveRank >= 0)
    titles.push({
      name: "Raja Premium",
      note: `Peringkat #${giveRank + 1} · ${giveBoard![giveRank].days} hari diberikan`,
    });

  return (
    <div className="relative">
      {/* Banner full-bleed. Wrapper-nya memotong overflow supaya tidak ada
          elemen yang keluar dari lebar layar (ruang hitam di kanan). */}
      <div className="yn-banner-box -mx-4 md:-mx-6">
        <BlurBanner src={user.bannerUrl ?? user.image} className="h-52 w-full" />
        {/* Bilah sambung warna tipis di bawah banner, tanpa blur */}
        <div aria-hidden className="yn-banner-fade" />
        <button
          onClick={() => setSettingsOpen(true)}
          aria-label="Pengaturan"
          className="absolute right-3 top-3 z-10 flex size-10 items-center justify-center rounded-xl border border-white/15 bg-black/45 text-white backdrop-blur-sm transition hover:border-violet-400"
        >
          <SettingsIcon className="size-[18px]" />
        </button>
      </div>

      {/* Foto profil menutupi banner, tepat di tengah layar */}
      <div className="w-full px-3">
        <div className="relative -mt-12 flex flex-col items-center">
          {/* Tombol title: tepat di tengah atas foto profil, bentuk chip
              kecil tanpa latar hitam bulat. */}
          <button
            onClick={() => setTitlesOpen((v) => !v)}
            aria-label="Buka title"
            aria-expanded={titlesOpen}
            className={cn(
              "z-20 -mb-2 flex h-7 items-center gap-1 rounded-full border px-2.5 text-[10px] font-bold transition",
              titlesOpen
                ? "border-violet-400 bg-violet-500/25 text-violet-100"
                : "border-white/20 bg-black/55 text-zinc-100 backdrop-blur-sm hover:border-violet-400",
            )}
          >
            <Crown className="size-3 text-[oklch(0.86_0.16_90)]" />
            Title
            {titles.length > 0 && (
              <span className="rounded-full bg-white/15 px-1 font-mono text-[9px]">
                {titles.length}
              </span>
            )}
            <ChevronDown
              className={cn(
                "size-3 transition",
                titlesOpen && "rotate-180",
              )}
            />
          </button>

          {titlesOpen && (
            <div className="pop-enter absolute left-1/2 top-full z-30 mt-1 w-[min(20rem,calc(100%-2rem))] -translate-x-1/2 overflow-hidden rounded-2xl border border-violet-500/30 bg-neutral-950/95 shadow-2xl">
              <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
                <span className="flex size-6 items-center justify-center rounded-md bg-[oklch(0.86_0.16_90)]/15">
                  <Crown className="size-3.5 text-[oklch(0.86_0.16_90)]" />
                </span>
                <p className="text-[12px] font-bold">Title kamu</p>
                <button
                  onClick={() => setTitlesOpen(false)}
                  aria-label="Tutup title"
                  className="ml-auto flex size-7 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-white/10 hover:text-white"
                >
                  <X className="size-4" />
                </button>
              </div>
              {titles.length === 0 ? (
                <p className="px-3 py-4 text-[12px] leading-5 text-zinc-400">
                  Belum ada title. Gabung clan atau kumpulkan XP dulu.
                </p>
              ) : (
                <ul className="divide-y divide-white/8">
                  {titles.map((t, i) => (
                    <li key={t.name} className="flex items-center gap-2.5 px-3 py-2.5">
                      <span
                        className={cn(
                          "title-shine shrink-0 rounded-md px-2 py-0.5 text-[12px] font-bold text-white",
                          i % 2 === 0
                            ? "bg-gradient-to-r from-amber-500 to-yellow-400 text-black"
                            : "bg-gradient-to-r from-violet-600 to-fuchsia-500",
                        )}
                      >
                        {t.name}
                      </span>
                      <span className="ml-auto text-right font-mono text-[10px] text-zinc-400">
                        {t.note}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Cincin gradient berdenyut di sekeliling avatar */}
          <div className="yn-avatar-ring">
            <div className="rounded-full bg-background p-[2px]">
              <Avatar
                src={user.image}
                seed={user.username}
                className="size-24"
                online={!user.hideOnline}
              />
            </div>
          </div>
          {/* Urutan: username -> ID -> level badge + tag clan */}
          <div
            key={user.username}
            className="mt-2.5 flex min-w-0 max-w-full items-center justify-center gap-1.5"
          >
            <p
              className={cn(
                "truncate text-lg font-black",
                usernameColor(user.username),
              )}
            >
              {user.username}
            </p>
            {premium && <BlueCheck className="size-5 shrink-0" />}
            {(user.devTagUntil ?? 0) > Date.now() && <RedMark className="size-5" />}
            <TitleBadge role={user.staffRole} />
            <span className="shrink-0 font-mono text-[11px] text-zinc-500">
              {displayId(user.seqId, user._id)}
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center justify-center gap-2">
            <button onClick={() => setBadgesOpen(true)} aria-label="Info badge level">
              <LevelBadge level={user.level ?? 1} />
            </button>
            {user.clanTag && (
              <ClanTag
                icon={user.clanTagIcon ?? DEFAULT_CLAN_ICON}
                tag={user.clanTag}
                color={user.clanNameColor}
              />
            )}
          </div>
        </div>

        {/* Bar level */}
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-[11px]">
            <span className="font-semibold text-foreground">Level {user.level}</span>
            <span className="text-zinc-400">
              {xpInLevel.toLocaleString("id-ID")}/{cost.toLocaleString("id-ID")}
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-black/60">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-600 to-violet-400"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <div className="my-3 h-px bg-white/25" />

        {/* 💎 + hari premium */}
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5 font-semibold text-cyan-300">
            <Gem className="size-3.5" /> {(user.diamonds ?? 0).toLocaleString("id-ID")}
          </span>
          {premium && (
            <span className="flex items-center gap-1.5 font-semibold text-gold">
              <Crown className="size-3.5" /> {premiumDays} hari
            </span>
          )}
        </div>

        {/* Stats horizontal tanpa background: History · Komen · Bergabung · Menit */}
        <div className="mt-3 grid grid-cols-4 divide-x divide-white/15 text-center">
          <Stat label="History" value={stats?.watchCount ?? 0} />
          <Stat label="Komen" value={stats?.commentCount ?? 0} />
          <Stat label="Bergabung" value={`${stats?.joinedDays ?? 0}h`} />
          <Stat label="Menit" value={stats?.minutesWatched ?? 0} />
        </div>
      </div>

      {/* Tabs tanpa background blok */}
      <div className="mt-4 flex gap-1 border-b border-white/10">
        {(
          [
            ["history", "History", <HistoryIcon key="h" className="size-3.5" />],
            ["komen", "Komen", <MessageSquare key="k" className="size-3.5" />],
            ["favorite", "Favorite", <Heart key="f" className="size-3.5" />],
          ] as const
        ).map(([k, label, icon]) => (
          <button
            key={k}
            onClick={() => setTabAndUrl(k as typeof tab)}
            className={cn(
              "relative flex-1 pb-2 pt-1 text-xs font-medium",
              tab === k ? "text-foreground" : "text-muted-foreground",
            )}
          >
            <span className="flex items-center justify-center gap-1">
              {icon} {label}
            </span>
            {tab === k && (
              <span className="absolute inset-x-3 bottom-0 h-px bg-foreground/70" />
            )}
          </button>
        ))}
      </div>

      <div className="mt-3 space-y-2">
        {tab === "history" &&
          (history ?? []).map((h: any) => (
            <button
              key={h._id}
              onClick={() => navigate(`/nonton?anime=${h.animeId}&ep=`)}
              className="flex w-full items-center gap-3 rounded-xl border border-border/70 bg-secondary/30 p-2.5 text-left"
            >
              <img src={h.animeImage ?? ""} className="h-14 w-10 rounded object-cover" alt="" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{h.animeTitle}</p>
                <p className="text-xs text-muted-foreground">Episode {h.episode}</p>
              </div>
              <span className="text-[10px] text-muted-foreground">{timeAgo(h.updatedAt)}</span>
            </button>
          ))}
        {tab === "history" && (comicHistory ?? []).length > 0 && (
          <>
            <p className="px-1 pt-2 text-[11px] font-semibold text-muted-foreground">
              Manga &amp; Manhwa
            </p>
            {(comicHistory ?? []).map((c: any) => (
              <button
                key={c._id}
                onClick={() =>
                  navigate(
                    `/baca/${encodeURIComponent(c.slug)}/${c.chapter}?jenis=${c.kind}`,
                  )
                }
                className="flex w-full items-center gap-3 rounded-xl border border-border/70 bg-secondary/30 p-2.5 text-left"
              >
                <img
                  src={c.comicImage ?? ""}
                  className="h-14 w-10 rounded object-cover"
                  alt=""
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{c.comicTitle}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.chapterLabel ?? `Chapter ${c.chapter}`}
                    {c.totalPages
                      ? ` · hal ${Math.min((c.page ?? 0) + 1, c.totalPages)}/${c.totalPages}`
                      : ""}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded px-1.5 py-0.5 text-[9px] font-black uppercase",
                    c.kind === "manhwa"
                      ? "bg-fuchsia-600 text-white"
                      : "bg-sky-600 text-white",
                  )}
                >
                  {c.kind}
                </span>
              </button>
            ))}
          </>
        )}
        {tab === "history" &&
          (history ?? []).length === 0 &&
          (comicHistory ?? []).length === 0 && (
            <p className="py-8 text-center text-xs text-muted-foreground">
              Belum ada history
            </p>
          )}

        {tab === "favorite" &&
          (favorites ?? []).map((f: any) => (
            <button
              key={f._id}
              onClick={() => navigate(`/nonton?anime=${f.animeId}`)}
              className="flex w-full items-center gap-3 rounded-xl border border-border/70 bg-secondary/30 p-2.5 text-left"
            >
              <img src={f.animeImage ?? ""} className="h-14 w-10 rounded object-cover" alt="" />                <Heart className="size-4 fill-violet-400 text-violet-400" />
              <p className="min-w-0 flex-1 truncate text-sm font-semibold">{f.animeTitle}</p>
            </button>
          ))}
        {tab === "favorite" && (comicFavorites ?? []).length > 0 && (
          <>
            <p className="px-1 pt-2 text-[11px] font-semibold text-muted-foreground">
              Manga &amp; Manhwa
            </p>
            {(comicFavorites ?? []).map((f: any) => (
              <button
                key={f._id}
                onClick={() =>
                  navigate(
                    `/${f.kind === "manhwa" ? "manhwa" : "manga"}?komik=${encodeURIComponent(f.slug)}`,
                  )
                }
                className="flex w-full items-center gap-3 rounded-xl border border-border/70 bg-secondary/30 p-2.5 text-left"
              >
                <img
                  src={f.comicImage ?? ""}
                  className="h-14 w-10 rounded object-cover"
                  alt=""
                />
                <Heart className="size-4 fill-violet-400 text-violet-400" />
                <p className="min-w-0 flex-1 truncate text-sm font-semibold">
                  {f.comicTitle}
                </p>
                <span
                  className={cn(
                    "shrink-0 rounded px-1.5 py-0.5 text-[9px] font-black uppercase",
                    f.kind === "manhwa"
                      ? "bg-fuchsia-600 text-white"
                      : "bg-sky-600 text-white",
                  )}
                >
                  {f.kind}
                </span>
              </button>
            ))}
          </>
        )}
        {tab === "favorite" &&
          (favorites ?? []).length === 0 &&
          (comicFavorites ?? []).length === 0 && (
            <p className="py-8 text-center text-xs text-muted-foreground">
              Belum ada favorite
            </p>
          )}

        {tab === "komen" && (
          <div className="thin-scroll max-h-[50vh] overflow-y-auto">
            {(profile?.myComments ?? []).map((c) => (
              <button
                key={c._id}
                onClick={() => navigate(`/nonton?anime=${c.animeId}`)}
                className="block w-full rounded-xl border border-border/70 bg-secondary/30 p-3 text-left"
              >
                <p className="text-sm">{c.text}</p>
                <p className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span>{timeAgo(c.createdAt)}</span>
                  <span className="flex items-center gap-0.5">
                    <Heart className="size-3 text-violet-400" /> {c.likeCount}
                  </span>
                </p>
              </button>
            ))}
            {profile && (profile.myComments ?? []).length === 0 && (
              <p className="py-8 text-center text-xs text-muted-foreground">
                Belum ada komentar — buka detail anime untuk berkomentar.
              </p>
            )}
          </div>
        )}
      </div>

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
      {notifOpen && <NotifScreen onClose={() => setNotifOpen(false)} />}
      {badgesOpen && <BadgesPopup currentLevel={user.level ?? 1} onClose={() => setBadgesOpen(false)} />}
      {csOpen && <CsChatScreen onClose={() => setCsOpen(false)} />}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="py-1">
      <p className="text-base font-bold text-foreground">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
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
                  unlocked ? "border-violet-500/50 bg-secondary/40" : "border-border/60 opacity-60",
                )}
              >
                <span
                  className={cn(
                    "flex size-10 items-center justify-center rounded-xl bg-gradient-to-br text-lg",
                    t.cls,
                    unlocked ? t.fx : "grayscale",
                  )}
                >
                  {unlocked ? t.icon : <Lock className="size-4 text-white/80" />}
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
                  {unlocked ? "✓ Didapat" : "🔒 Terkunci"}
                </span>
              </div>
            );
          })}
        </div>
        <button
          onClick={onClose}
          className="mt-3 w-full rounded-xl bg-violet-600 py-2 text-sm font-bold text-white"
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
  const [name, setName] = useState(user?.username ?? "");
  const [banner, setBanner] = useState(user?.bannerUrl ?? "");
  const [theme, setTheme] = useState(user?.theme ?? "dark");
  const [customColor, setCustomColor] = useState(user?.customColor ?? "#e11d48");
  // Panel hanya untuk developer (#1 / title dev) & moderator.
  const access = useQuery(api.moderation.myPanelAccess, {});
  const panelLevel: "dev" | "mod" | "none" =
    access?.level === "dev" ? "dev" : access?.level === "mod" ? "mod" : "none";
  useHideNavOnMount(); // fullscreen: navbar & mini player hilang total

  if (!user) return null;

  // Simpan tanpa nunggu server (fire & forget) → UI terasa instan
  const quickSave = (args: Record<string, unknown>) => {
    void update(args).catch((e) =>
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan"),
    );
  };

  const applyTheme = (t: string, color?: string) => {
    document.documentElement.classList.toggle("theme-light", t === "light");
    if (color) document.documentElement.style.setProperty("--primary", color);
  };

  return (
    <FullScreen title="Pengaturan" onClose={onClose}>
      <BlockTitle>Akun</BlockTitle>
      <div className="rounded-xl border border-border bg-card p-3">
        <div className="flex items-center gap-2.5">
          <Avatar src={user.image} seed={user.username} className="size-14" />
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
        <label className="mt-2.5 flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-border py-2 text-[11px] text-muted-foreground">
          Ganti photo profile
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const reader = new FileReader();
              reader.onload = async () => {
                await updateProfile({ image: String(reader.result) });
                toast.success("Photo profile diubah");
              };
              reader.readAsDataURL(f);
            }}
          />
        </label>
        <div className="mt-2 flex min-w-0 gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-input bg-background/60 px-3 py-2 text-[13px]"
            placeholder="Ubah nama"
          />
          <button
            onClick={async () => {
              try {
                await updateProfile({ username: name });
                toast.success("Nama diubah");
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Gagal");
              }
            }}
            className="shrink-0 rounded-lg bg-primary px-4 text-[13px] font-bold text-primary-foreground"
          >
            OK
          </button>
        </div>
      </div>

      <BlockTitle>Pengaturan</BlockTitle>
      <div className="space-y-2">
        <ToggleRow
          label="Auto tolak request pertemanan"
          desc="Pilih auto tolak atau auto terima"
          value={user.autoRejectFriend ?? false}
          onToggle={(v) => {
            quickSave({ autoRejectFriend: v, autoRejectFriendAction: "reject" });
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
                  theme === t ? "border-violet-500 text-violet-300" : "border-border",
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
                className="shrink-0 rounded-lg bg-violet-600 px-4 py-2 text-xs font-bold text-white"
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

        <ToggleRow
          label="Matikan online status"
          desc="Status kamu akan offline selamanya"
          value={user.hideOnline ?? false}
          onToggle={(v) => {
            quickSave({ hideOnline: v });
          }}
        />

        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-[13px] font-medium">Background gif akun</p>
          <div className="mt-2 flex min-w-0 gap-2">
            <input
              value={banner}
              onChange={(e) => setBanner(e.target.value)}
              placeholder="URL gambar/gif background"
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
        </div>

        {panelLevel !== "none" && <StaffPanel level={panelLevel} />}
      </div>

      {/* CS + email + log out */}
      <BlockTitle>Lainnya</BlockTitle>
      <div className="space-y-2">
        <button
          onClick={onOpenCs}
          className="flex w-full items-center gap-2.5 rounded-xl border border-border bg-card p-3 text-left transition hover:border-violet-500/60"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/15">
            <Headset className="size-[18px] text-violet-300" />
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
          value ? "bg-violet-600" : "bg-zinc-600",
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
                value === q ? "border-violet-500 text-violet-300" : "border-border",
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
                value === s ? "border-violet-500 text-violet-300" : "border-border",
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
  const icons: Record<string, string> = {
    update: "🔔",
    reply: "↗",
    like: "❤️",
    friend_chat: "💬",
    friend_request: "👤",
    request_rejected: "❗",
    clan: "🛡",
    moderation: "⚠",
    report: "🚩",
  };
  return (
    <FullScreen title="Notifikasi" onClose={onClose}>
      <div className="space-y-2">
        {(notifs ?? []).map((n: any) => (
          <div
            key={n._id}
            className="flex items-center gap-3 rounded-xl border border-border/70 bg-secondary/30 p-3"
          >
            <span className="flex size-8 shrink-0 items-center justify-center text-xl">
              {n.type === "friend_chat" && n.refImage ? (
                <Avatar src={n.refImage} className="size-8" />
              ) : (
                icons[n.type] ?? "🔔"
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{n.title}</p>
              {n.body && <p className="text-xs text-zinc-400">{n.body}</p>}
              <p className="mt-0.5 text-[10px] text-muted-foreground">{timeAgo(n.createdAt)}</p>
            </div>
            {n.type === "friend_request" && n.refUserId && (
              <RequestButtons
                userId={n.refUserId as never}
                onDone={(ok) =>
                  ok ? toast.success("Request diterima") : toast.success("Request ditolak")
                }
                onError={(e) => toast.error(e)}
              />
            )}
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
      className="relative flex shrink-0 items-center justify-center rounded-full border border-violet-400/40 bg-violet-500/15"
      style={{ width: size, height: size }}
    >
      <Headset className="text-violet-300" style={{ width: size * 0.5, height: size * 0.5 }} />
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
              : "border-border bg-card focus-within:border-violet-500/60",
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
          <h1 className="text-base font-bold">{title}</h1>
        </div>
        {children}
      </div>
    </div>
  );
}
