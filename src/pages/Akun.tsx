import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout, useHideNavOnMount } from "@/components/AppLayout";
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
import { shrinkAvatar } from "@/lib/image";
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
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Crown,
  Gem,
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
      {/* Kotak profil full lebar di PALING ATAS: foto profil di kiri, lalu
          username, tag clan, level, badge, dan title. Tombol pengaturan ada
          di ujung kanan kotak yang sama. */}
      <AkunProfileHeader user={user} onSettings={() => setSettingsOpen(true)} />

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

/** Kotak profil di paling atas halaman Akun (full lebar). */
function AkunProfileHeader({
  user,
  onSettings,
}: {
  user: any;
  onSettings: () => void;
}) {
  const isPremium = (user.premiumUntil ?? 0) > Date.now();
  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-card p-3">
      <div className="flex items-center gap-3">
        <Avatar
          src={user.image}
          seed={user.username}
          className="size-14 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span className="truncate text-sm font-bold">{user.username}</span>
            {isPremium && <BlueCheck className="size-3.5" />}
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
          <div className="mt-1 flex items-center gap-1.5">
            <LevelBadge level={user.level ?? 1} />
            <span className="truncate text-[11px] text-muted-foreground">
              ID: {displayId(user.seqId, user._id)}
            </span>
          </div>
        </div>
        <button
          onClick={onSettings}
          aria-label="Pengaturan"
          className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-black/45 text-white backdrop-blur-sm transition hover:border-foreground"
        >
          <SettingsIcon className="size-[18px]" />
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
        <div key={c._id} className="fade-enter min-w-0">              {/* Banner profil komentator (kalau ada) — tampil di atas kotak chat,
                  menutupi seluruh bingkai. */}
          {c.bannerUrl && (
            <div
              className="mb-2 h-14 w-full overflow-hidden rounded-xl border border-white/10 bg-cover bg-center"
              style={{ backgroundImage: `url(${c.bannerUrl})` }}
              aria-hidden
            />
          )}
          <div className="flex items-start gap-2.5">
            {/* Gambar anime: penuh lebar atas (banner) agar jelas terlihat. */}
            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-2.5">
                <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
                  {/* Judul + episode: satu baris, agak ke kanan. */}
                  <div className="flex items-baseline gap-2">
                    <span className="truncate text-[12px] font-bold text-white">
                      {c.animeTitle ?? c.animeId}
                    </span>
                    {c.episode ? (
                      <span className="shrink-0 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-semibold text-white/80 backdrop-blur-sm">
                        Episode {c.episode}
                      </span>
                    ) : null}
                  </div>
                  {/* Teks komentar — rata kiri, tidak ikut ke kanan. */}
                  <p className="mt-1.5 whitespace-pre-line text-[13px] leading-snug text-zinc-200">
                    {c.text}
                  </p>
                </div>
                {c.animeImage ? (
                  <img
                    src={c.animeImage}
                    alt=""
                    loading="lazy"
                    className="mt-1.5 h-16 w-11 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <div className="mt-1.5 flex h-16 w-11 shrink-0 items-center justify-center rounded-lg bg-secondary/60 text-[10px] text-muted-foreground">
                    Anime
                  </div>
                )}
              </div>
            </div>
            <div className="min-w-0 flex-1">
              {/* Baris identitas + jam di pojok kanan. */}
              <div className="flex items-start gap-2">
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
        <label className="mt-2.5 flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-dashed border-border text-[12px] text-muted-foreground transition hover:border-foreground/40 hover:text-foreground">
          {busyPhoto ? "Memproses gambar…" : "Ganti photo profile"}
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
            className="h-11 shrink-0 rounded-lg bg-primary px-5 text-[13px] font-bold text-primary-foreground disabled:opacity-40"
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
