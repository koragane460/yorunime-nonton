import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/AppLayout";
import { Avatar, SectionTitle, ShineBadge, UserBadges } from "@/components/lstream-ui";
import { CLAN_ROLE_BADGE, STAFF_BADGE, badgeForLevel, timeAgo } from "@/lib/lstream";
import {
  Bell,
  ChevronLeft,
  Gamepad2,
  Gem,
  Heart,
  LogOut,
  Mail,
  MessageSquare,
  Settings as SettingsIcon,
  X,
  Crown,
  History as HistoryIcon,
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
  const [params] = useSearchParams();
  const [tab, setTab] = useState<"history" | "komen" | "favorite">(
    (params.get("tab") as any) ?? "history",
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [gameOpen, setGameOpen] = useState(false);

  const stats = useQuery(api.account.profileStats, user ? {} : "skip");
  const history = useQuery(api.activities.myHistory, user ? {} : "skip");
  const favorites = useQuery(api.activities.myFavorites, user ? {} : "skip");

  if (!user) return null;
  const xpInLevel = user.xp ?? 0;
  const badge = badgeForLevel(user.level ?? 1);

  return (
    <div className="py-3">
      {/* Panel akun besar */}
      <div className="relative overflow-hidden rounded-2xl border border-yellow-500/30">
        <div
          className="h-24 bg-cover bg-center"
          style={
            user.bannerUrl
              ? { backgroundImage: `url(${user.bannerUrl})` }
              : { background: "linear-gradient(120deg,#3a2f0a,#17130a)" }
          }
        />
        <div className="bg-card p-4">
          <div className="flex items-end gap-3">
            <Avatar
              src={user.image}
              seed={user.username}
              className="-mt-12 size-20"
              online={!user.hideOnline}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-lg font-black">{user.username}</p>
                {(user.premiumUntil ?? 0) > Date.now() && (
                  <span className="rounded bg-sky-500 px-1.5 text-[10px] font-bold text-white">✓</span>
                )}
                <span className="ml-auto text-xs text-muted-foreground">
                  ID: {user._id.slice(-6).toUpperCase()}
                </span>
              </div>
              <UserBadges level={user.level ?? 1} staffRole={user.staffRole} />
              {user.clanTag && (
                <p className="mt-1 text-xs font-bold text-yellow-200">
                  {user.clanTagIcon} [{user.clanTag}]
                </p>
              )}
            </div>
          </div>

          {/* Bar level */}
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-xs text-muted-foreground">
              <span>
                Level <b className="text-foreground">{user.level}</b>
              </span>
              <span>
                {xpInLevel} / {nextLevelCost(user.level ?? 1)} XP · 1/{badge.name}
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-gradient-to-r from-yellow-500 to-amber-300"
                style={{
                  width: `${Math.min(100, (xpInLevel / Math.max(1, nextLevelCost(user.level ?? 1))) * 100)}%`,
                }}
              />
            </div>
          </div>

          {/* Statistik */}
          <div className="mt-3 grid grid-cols-4 gap-2 text-center">
            <Stat label="History" value={stats?.watchCount ?? 0} />
            <Stat label="Komen" value={stats?.commentCount ?? 0} />
            <Stat label="Bergabung" value={`${stats?.joinedDays ?? 0}h`} />
            <Stat label="Menit" value={stats?.minutesWatched ?? 0} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-3 flex gap-2">
        {(
          [
            ["history", "History", <HistoryIcon key="h" className="size-3.5" />],
            ["komen", "Komen", <MessageSquare key="k" className="size-3.5" />],
            ["favorite", "Favorite", <Heart key="f" className="size-3.5" />],
          ] as const
        ).map(([k, label, icon]) => (
          <button
            key={k}
            onClick={() => setTab(k as typeof tab)}
            className={cn(
              "relative flex-1 rounded-xl border py-2 text-xs font-medium",
              tab === k
                ? "border-yellow-400 bg-yellow-400/10 text-yellow-300"
                : "border-border text-muted-foreground",
            )}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      <div className="mt-2 space-y-2">
        {tab === "history" &&
          (history ?? []).map((h) => (
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
              <span className="text-[10px] text-muted-foreground">
                {timeAgo(h.updatedAt)}
              </span>
            </button>
          ))}
        {tab === "history" && (history ?? []).length === 0 && (
          <p className="py-8 text-center text-xs text-muted-foreground">Belum ada history</p>
        )}

        {tab === "favorite" &&
          (favorites ?? []).map((f) => (
            <div
              key={f._id}
              className="flex items-center gap-3 rounded-xl border border-border/70 bg-secondary/30 p-2.5"
            >
              <Heart className="size-4 fill-red-500 text-red-500" />
              <p className="flex-1 truncate text-sm font-semibold">{f.animeTitle}</p>
            </div>
          ))}
        {tab === "favorite" && (favorites ?? []).length === 0 && (
          <p className="py-8 text-center text-xs text-muted-foreground">Belum ada favorite</p>
        )}

        {tab === "komen" && (
          <p className="py-8 text-center text-xs text-muted-foreground">
            Komentarmu di anime muncul di sini
          </p>
        )}
      </div>

      {/* Tombol bawah */}
      <div className="mt-4 space-y-2">
        <button
          onClick={() => setNotifOpen(true)}
          className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3.5 text-sm"
        >
          <Bell className="size-5 text-yellow-400" /> Notifikasi
        </button>
        <button
          onClick={() => setGameOpen(true)}
          className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3.5 text-sm"
        >
          <Gamepad2 className="size-5 text-green-400" /> Game & Shop Diamond
        </button>
        <button
          onClick={() => setSettingsOpen(true)}
          className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3.5 text-sm"
        >
          <SettingsIcon className="size-5 text-muted-foreground" /> Pengaturan
        </button>
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 text-sm">
          <Mail className="size-5 text-yellow-400" /> Lstreamsupport@gmail.com
        </div>
        <AbsenPanel />
        <button
          onClick={async () => {
            await signOut();
            navigate("/");
          }}
          className="flex w-full items-center gap-3 rounded-2xl border border-red-500/40 bg-card p-3.5 text-sm text-red-400"
        >
          <LogOut className="size-5" /> Log out dari akun
        </button>
      </div>

      {settingsOpen && <SettingsScreen onClose={() => setSettingsOpen(false)} />}
      {notifOpen && <NotifScreen onClose={() => setNotifOpen(false)} />}
      {gameOpen && <GameScreen onClose={() => setGameOpen(false)} />}
    </div>
  );
}

// ------------------------------------------------------------------ absen ----

function AbsenPanel() {
  const status = useQuery(api.activities.absenStatus, {});
  const doAbsen = useMutation(api.activities.absen);
  const rewards = [
    { day: 1, label: "5💎 + 1hr prem" },
    { day: 2, label: "100 XP" },
    { day: 3, label: "180 XP" },
    { day: 4, label: "30💎 + 1hr prem" },
    { day: 5, label: "200 XP" },
    { day: 6, label: "30💎 + 300 XP" },
    { day: 7, label: "7hr prem + 400 XP" },
  ];
  const streak = status?.streak ?? 0;
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="mb-2 text-sm font-bold">Absen Harian</p>
      <div className="grid grid-cols-7 gap-1.5">
        {rewards.map((r, i) => (
          <div
            key={r.day}
            className={cn(
              "rounded-lg border p-1.5 text-center text-[9px] leading-tight",
              i < streak
                ? "border-green-500/50 bg-green-500/10 text-green-400"
                : i === streak
                  ? "border-yellow-400 bg-yellow-400/10 text-yellow-300"
                  : "border-border text-muted-foreground",
            )}
          >
            <p className="font-black">D{r.day}</p>
            <p>{r.label}</p>
          </div>
        ))}
      </div>
      <button
        disabled={status?.claimedToday}
        onClick={async () => {
          try {
            const r = await doAbsen({});
            toast.success(
              `Absen day ${r.day}! +${r.diamonds}💎 +${r.xp} XP${r.premiumDays ? ` +${r.premiumDays} hari premium` : ""}`,
            );
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Gagal absen");
          }
        }}
        className="mt-3 w-full rounded-xl bg-yellow-500 py-2.5 text-sm font-bold text-black disabled:opacity-40"
      >
        {status?.claimedToday ? "Sudah absen hari ini (reset 00:00)" : "Absen Sekarang"}
      </button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-secondary/30 py-2">
      <p className="text-lg font-bold text-yellow-300">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

function nextLevelCost(level: number) {
  const tiers = [
    [1, 49, 12000],
    [50, 99, 27000],
    [100, 499, 45000],
    [500, 1000, 70000],
    [1001, 4999, 120000],
    [5000, 10000, 165000],
  ] as const;
  for (const [a, b, cost] of tiers) if (level >= a && level <= b) return cost;
  return 165000;
}

// ------------------------------------------------------------- settings ----

function SettingsScreen({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const update = useMutation(api.account.updateSettings);
  const updateProfile = useMutation(api.account.updateProfile);
  const [name, setName] = useState(user?.username ?? "");
  const [banner, setBanner] = useState(user?.bannerUrl ?? "");
  const [theme, setTheme] = useState(user?.theme ?? "dark");
  const [customColor, setCustomColor] = useState(user?.customColor ?? "#f5c518");

  if (!user) return null;

  const applyTheme = (t: string, color?: string) => {
    document.documentElement.classList.toggle("theme-light", t === "light");
    if (color) document.documentElement.style.setProperty("--primary", color);
  };

  return (
    <FullScreen title="Pengaturan" onClose={onClose}>
      {/* Akun */}
      <SectionTitle>Akun</SectionTitle>
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <Avatar src={user.image} seed={user.username} className="size-16" />
          <div>
            <p className="font-bold">{user.username}</p>
            <p className="text-xs text-muted-foreground">
              ID: {user._id.slice(-6).toUpperCase()} · Level {user.level}
            </p>
            <UserBadges level={user.level ?? 1} staffRole={user.staffRole} />
          </div>
        </div>
        <label className="mt-3 flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-border py-2 text-xs text-muted-foreground">
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
        <div className="mt-2 flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 rounded-lg border border-input bg-background/60 px-3 py-2 text-sm"
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
            className="rounded-lg bg-yellow-500 px-4 text-sm font-bold text-black"
          >
            OK
          </button>
        </div>
      </div>

      {/* Pengaturan */}
      <SectionTitle>Pengaturan</SectionTitle>
      <div className="space-y-2">
        <ToggleRow
          label="Auto tolak request pertemanan"
          desc="Pilih auto tolak atau auto terima"
          value={user.autoRejectFriend ?? false}
          onToggle={async (v) => {
            await update({ autoRejectFriend: v, autoRejectFriendAction: "reject" });
            toast.success("Tersimpan");
          }}
        />
        <div className="rounded-2xl border border-border bg-card p-3.5">
          <p className="text-sm font-medium">Tema</p>
          <div className="mt-2 flex gap-2">
            {["dark", "light", "custom"].map((t) => (
              <button
                key={t}
                onClick={async () => {
                  setTheme(t);
                  applyTheme(t, t === "custom" ? customColor : undefined);
                  await update({ theme: t });
                }}
                className={cn(
                  "flex-1 rounded-lg border py-2 text-xs capitalize",
                  theme === t ? "border-yellow-400 text-yellow-300" : "border-border",
                )}
              >
                {t === "dark" ? "Gelap" : t === "light" ? "Terang" : "Custom"}
              </button>
            ))}
          </div>
          {theme === "custom" && (
            <div className="mt-2 flex items-center gap-2">
              <input
                type="color"
                value={customColor}
                onChange={(e) => {
                  setCustomColor(e.target.value);
                  applyTheme("custom", e.target.value);
                }}
                className="h-9 w-14 rounded border border-border bg-transparent"
              />
              <button
                onClick={async () => {
                  await update({ customColor });
                  toast.success("Warna tersimpan");
                }}
                className="rounded-lg bg-yellow-500 px-4 py-2 text-xs font-bold text-black"
              >
                Simpan warna
              </button>
            </div>
          )}
        </div>

        <QualityRow
          label="Kualitas default"
          value={user.defaultQuality ?? "720p"}
          onPick={async (q) => {
            await update({ defaultQuality: q });
            toast.success(`Kualitas default: ${q}`);
          }}
        />
        <SpeedRow
          label="Kecepatan default"
          value={user.defaultSpeed ?? 1}
          onPick={async (s) => {
            await update({ defaultSpeed: s });
            toast.success(`Kecepatan default: ${s}x`);
          }}
        />

        <ToggleRow
          label="Matikan online status"
          desc="Status kamu akan offline selamanya"
          value={user.hideOnline ?? false}
          onToggle={async (v) => {
            await update({ hideOnline: v });
          }}
        />

        <div className="rounded-2xl border border-border bg-card p-3.5">
          <p className="text-sm font-medium">Background gif akun</p>
          <div className="mt-2 flex gap-2">
            <input
              value={banner}
              onChange={(e) => setBanner(e.target.value)}
              placeholder="URL gambar/gif background"
              className="flex-1 rounded-lg border border-input bg-background/60 px-3 py-2 text-sm"
            />
            <button
              onClick={async () => {
                await updateProfile({ bannerUrl: banner });
                toast.success("Background diubah");
              }}
              className="rounded-lg bg-yellow-500 px-4 text-sm font-bold text-black"
            >
              OK
            </button>
          </div>
        </div>

        {/* Dev/mod panel */}
        <DevModPanel />
      </div>
    </FullScreen>
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
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
      </div>
      <button
        onClick={() => onToggle(!value)}
        className={cn(
          "relative h-6 w-11 rounded-full transition",
          value ? "bg-yellow-500" : "bg-zinc-600",
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
    <div className="rounded-2xl border border-border bg-card p-3.5">
      <button className="flex w-full items-center justify-between" onClick={() => setOpen((v) => !v)}>
        <p className="text-sm font-medium">{label}</p>
        <span className="text-xs text-yellow-300">{value}</span>
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
                value === q ? "border-yellow-400 text-yellow-300" : "border-border",
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
    <div className="rounded-2xl border border-border bg-card p-3.5">
      <button className="flex w-full items-center justify-between" onClick={() => setOpen((v) => !v)}>
        <p className="text-sm font-medium">{label}</p>
        <span className="text-xs text-yellow-300">{value}x</span>
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
                value === s ? "border-yellow-400 text-yellow-300" : "border-border",
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
  const icons: Record<string, string> = {
    update: "🔔",
    reply: "↗",
    friend_chat: "💬",
    friend_request: "👤",
    request_rejected: "❗",
    clan: "🛡",
    moderation: "⚠",
  };
  return (
    <FullScreen title="Notifikasi" onClose={onClose}>
      <div className="space-y-2">
        {(notifs ?? []).map((n) => (
          <div key={n._id} className="flex items-start gap-3 rounded-xl border border-border/70 bg-secondary/30 p-3">
            <span className="text-xl">
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
          </div>
        ))}
        {notifs && notifs.length === 0 && (
          <p className="py-10 text-center text-xs text-muted-foreground">Belum ada notifikasi</p>
        )}
      </div>
    </FullScreen>
  );
}

// ----------------------------------------------------------------- game ----

function GameScreen({ onClose }: { onClose: () => void }) {
  const [screen, setScreen] = useState<"menu" | "click" | "shop">("menu");
  const clickStatus = useQuery(api.shop.clickStatus, {});
  const clickTap = useMutation(api.shop.clickTap);
  const items = useQuery(api.shop.shopItems, {});
  const buy = useMutation(api.shop.buyWithDiamonds);
  const { user } = useAuth();

  return (
    <FullScreen title="Game" onClose={onClose}>
      {screen === "menu" && (
        <div className="space-y-2">
          <button
            onClick={() => setScreen("click")}
            className="w-full rounded-2xl border border-border bg-card p-4 text-left text-sm font-semibold"
          >
            🖱️ Game Click — 5 Click = 1 Diamond
          </button>
          <button
            onClick={() => setScreen("shop")}
            className="w-full rounded-2xl border border-border bg-card p-4 text-left text-sm font-semibold"
          >
            🛒 Shop Premium (Diamond)
          </button>
        </div>
      )}

      {screen === "click" && (
        <div className="py-10 text-center">
          <button
            onClick={() => void clickTap({})}
            className="mx-auto flex size-40 items-center justify-center rounded-full bg-gradient-to-br from-yellow-400 to-amber-600 text-4xl font-black text-black shadow-[0_0_40px_-8px] shadow-yellow-500/60 transition active:scale-95"
          >
            CLICK
          </button>
          <p className="mt-4 text-2xl font-black text-yellow-300">
            {clickStatus?.clicks ?? 0}
          </p>
          <p className="text-xs text-muted-foreground">
            {clickStatus?.diamonds ?? 0} diamond didapat · 5 Click = 1 Diamond
          </p>
        </div>
      )}

      {screen === "shop" && (
        <div className="space-y-2">
          <p className="mb-1 text-center text-sm">
            Diamond kamu: <b className="text-cyan-300">💎 {user?.diamonds ?? 0}</b>
          </p>
          {(items ?? []).map((it) => (
            <div key={it.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5">
              <Gem className="size-6 text-cyan-300" />
              <div className="flex-1">
                <p className="text-sm font-semibold">{it.label}</p>
                <p className="text-xs text-muted-foreground">💎 {it.cost}</p>
              </div>
              <button
                onClick={async () => {
                  try {
                    await buy({ itemId: it.id });
                    toast.success("Berhasil dibeli!");
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Gagal");
                  }
                }}
                className="rounded-full bg-yellow-500 px-4 py-1.5 text-xs font-bold text-black"
              >
                Beli
              </button>
            </div>
          ))}
        </div>
      )}
    </FullScreen>
  );
}

// ---------------------------------------------------------- dev/mod panel ----

function DevModPanel() {
  const { user } = useAuth();
  const isDev =
    user?.role === "admin" || user?.staffRole === "dev" || user?.staffRole === "creator";
  const isMod = isDev || user?.staffRole === "mod";
  const [q, setQ] = useState("");
  const [searchUsers, setSearchUsers] = useState<any[]>([]);
  const search = useQuery(api.moderation.searchUsersPanel, q.length > 1 ? { q } : "skip");
  const moderate = useMutation(api.moderation.moderate);
  const setStaffRole = useMutation(api.moderation.setStaffRole);
  const giveClan = useMutation(api.moderation.devGiveClanPremium);
  const [picked, setPicked] = useState<any>(null);
  const [permanent, setPermanent] = useState(false);
  const [duration, setDuration] = useState("1 hari");
  const [reason, setReason] = useState("");
  const [clanId, setClanId] = useState("");
  const [days, setDays] = useState(30);

  if (!isDev && !isMod) return null;

  return (
    <div className="rounded-2xl border border-red-500/40 bg-card p-3.5">
      <p className="text-sm font-bold text-red-400">
        {isDev ? "Dev Panel" : "Moderator Panel"}
      </p>
      <div className="mt-2 flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari username…"
          className="flex-1 rounded-lg border border-input bg-background/60 px-3 py-2 text-sm"
        />
      </div>
      {search && search.length > 0 && (
        <div className="mt-2 space-y-1">
          {search.map((u: any) => (
            <button
              key={u._id}
              onClick={() => setPicked(u)}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg border p-2 text-left text-sm",
                picked?._id === u._id ? "border-yellow-400" : "border-border/70",
              )}
            >
              <span className="flex-1 truncate">{u.username}</span>
              {u.staffRole && <ShineBadge label={u.staffRole} gradient={STAFF_BADGE[u.staffRole]?.cls ?? ""} />}
              {(u.bannedUntil ?? 0) > Date.now() && <span className="text-[10px] text-red-400">BANNED</span>}
              {(u.mutedUntil ?? 0) > Date.now() && <span className="text-[10px] text-yellow-400">MUTED</span>}
            </button>
          ))}
        </div>
      )}
      {picked && (
        <div className="mt-3 space-y-2 rounded-xl border border-border p-3">
          <p className="text-sm font-semibold">{picked.username}</p>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Alasan (wajib)"
            className="w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm"
          />
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={permanent}
              onChange={(e) => setPermanent(e.target.checked)}
            />
            Selamanya
          </label>
          {!permanent && (
            <input
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="contoh: 3 hari / 12 jam / 30 menit"
              className="w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm"
            />
          )}
          <div className="flex flex-wrap gap-1.5">
            <PanelBtn
              label="Mute"
              onClick={async () => {
                await moderate({
                  targetId: picked._id,
                  action: "mute",
                  permanent,
                  durationText: duration,
                  reason,
                });
                toast.success("User dimute");
              }}
            />
            <PanelBtn
              label="Banned"
              onClick={async () => {
                await moderate({
                  targetId: picked._id,
                  action: "ban",
                  permanent,
                  durationText: duration,
                  reason,
                });
                toast.success("User dibanned");
              }}
            />
            <PanelBtn
              label="Unmute"
              onClick={async () => {
                await moderate({ targetId: picked._id, action: "unmute", permanent: false, reason: reason || "-" });
                toast.success("Unmute");
              }}
            />
            <PanelBtn
              label="Unbanned"
              onClick={async () => {
                await moderate({ targetId: picked._id, action: "unban", permanent: false, reason: reason || "-" });
                toast.success("Unbanned");
              }}
            />
            {isDev &&
              (
                [
                  ["dev", "+Dev"],
                  ["mod", "+Mod"],
                  ["tester", "+Tester"],
                  ["sepuh", "+Sepuh"],
                  ["creator", "+Creator"],
                  ["none", "-Role"],
                ] as const
              ).map(([r, label]) => (
                <PanelBtn
                  key={r}
                  label={label}
                  onClick={async () => {
                    await setStaffRole({ targetId: picked._id, staffRole: r });
                    toast.success(label);
                  }}
                />
              ))}
          </div>
        </div>
      )}

      {isDev && (
        <div className="mt-3 rounded-xl border border-border p-3">
          <p className="text-xs font-semibold text-yellow-300">
            Give premium ke semua member clan
          </p>
          <div className="mt-2 flex gap-2">
            <input
              value={clanId}
              onChange={(e) => setClanId(e.target.value)}
              placeholder="Clan ID (dari URL detail clan)"
              className="flex-1 rounded-lg border border-input bg-background/60 px-3 py-2 text-xs"
            />
            <input
              type="number"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="w-24 rounded-lg border border-input bg-background/60 px-3 py-2 text-xs"
            />
            <button
              disabled={!clanId || days <= 0}
              onClick={async () => {
                try {
                  const r = await giveClan({ clanId: clanId as Id<"clans">, days });
                  toast.success(`Premium ${days} hari diberikan ke ${r.count} member`);
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Gagal");
                }
              }}
              className="rounded-lg bg-yellow-500 px-3 text-xs font-bold text-black disabled:opacity-40"
            >
              Give Premium
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PanelBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-full border border-red-500/40 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/10"
    >
      {label}
    </button>
  );
}

// ------------------------------------------------------------- fullscr ----

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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background">
      <div className="mx-auto max-w-2xl p-3">
        <div className="mb-3 mt-3 flex items-center gap-3">
          <button onClick={onClose} className="rounded-full border border-border p-2">
            <ChevronLeft className="size-4" />
          </button>
          <h1 className="text-lg font-bold">{title}</h1>
        </div>
        {children}
      </div>
    </div>
  );
}

void Crown;
void X;
