import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/AppLayout";
import {
  Avatar,
  BlueCheck,
  ClanTag,
  LevelBadge,
  SectionTitle,
  ShineBadge,
} from "@/components/lstream-ui";
import { STAFF_BADGE, timeAgo, displayId } from "@/lib/lstream";
import { xpForLevel } from "@/lib/level";
import {
  ChevronLeft,
  Crown,
  Gem,
  Heart,
  History as HistoryIcon,
  LogOut,
  Mail,
  MessageSquare,
  Settings as SettingsIcon,
  Users,
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
  const [tab, setTab] = useState<"teman" | "history" | "komen" | "favorite">(
    tabParam === "favorite"
      ? "favorite"
      : tabParam === "history"
        ? "history"
        : tabParam === "komen"
          ? "komen"
          : "teman",
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(tabParam === "notif");

  const stats = useQuery(api.account.profileStats, user ? {} : "skip");
  const history = useQuery(api.activities.myHistory, user ? {} : "skip");
  const favorites = useQuery(api.activities.myFavorites, user ? {} : "skip");
  const friendComments = useQuery(api.activities.myFriendsComments, user ? {} : "skip");

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

  return (
    <div className="relative">
      {/* Banner paling atas full-bleed + tombol Pengaturan kanan atas (jelas terlihat) */}
      <div className="relative">
        <div
          className="h-28 w-full bg-cover bg-center"
          style={
            user.bannerUrl
              ? { backgroundImage: `url(${user.bannerUrl})` }
              : undefined
          }
        >
          {!user.bannerUrl && <div className="bg-hero-gradient h-full w-full" />}
        </div>
        <button
          onClick={() => setSettingsOpen(true)}
          aria-label="Pengaturan"
          className="absolute right-3 top-3 z-10 flex size-10 items-center justify-center rounded-full border border-white/30 bg-black/70 text-white shadow-lg transition hover:border-red-500"
        >
          <SettingsIcon className="size-[18px] text-white" />
        </button>
      </div>

      {/* Avatar overlap setengah banner + identitas */}
      <div className="w-full px-3">
        <div className="relative -mt-12 flex items-end gap-3">
          <Avatar
            src={user.image}
            seed={user.username}
            className="size-24 border-4 border-background"
            online={!user.hideOnline}
          />
          <div className="min-w-0 flex-1 pb-1">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-lg font-black">{user.username}</p>
              {premium && <BlueCheck className="size-5" />}
            </div>
            <p className="text-xs text-muted-foreground">
              ID: {displayId(user.seqId, user._id)}
            </p>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <LevelBadge level={user.level ?? 1} />
          {user.clanTag && (
            <ClanTag
              icon={user.clanTagIcon ?? "⚔️"}
              tag={user.clanTag}
              color={user.clanNameColor}
            />
          )}
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
              className="h-full rounded-full bg-gradient-to-r from-red-600 to-red-400"
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
            ["teman", "Teman", <Users key="u" className="size-3.5" />],
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
              <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-red-500" />
            )}
          </button>
        ))}
      </div>

      <div className="mt-3 space-y-2">
        {tab === "teman" && (
          <>
            <p className="text-[11px] text-muted-foreground">
              Komentar teman, clan, & developer di semua anime — terbaru dulu
            </p>
            {(friendComments ?? []).map((c: any) => (
              <button
                key={c._id}
                onClick={() => navigate(`/?pilih=${c.animeId.split("__")[0]}`)}
                className="block w-full overflow-hidden rounded-lg border border-border/70 bg-secondary/30 text-left transition hover:border-red-500/50"
              >
                {c.bannerUrl && (
                  <div
                    className="h-7 w-full bg-cover bg-center opacity-70"
                    style={{ backgroundImage: `url(${c.bannerUrl})` }}
                  />
                )}
                <div className="flex gap-2.5 p-2.5">
                  <Avatar src={c.image} seed={c.username} className="size-8" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <p className="truncate text-xs font-bold">{c.username}</p>
                      {c.premium && <BlueCheck className="size-3.5" />}
                      {c.staffRole && STAFF_BADGE[c.staffRole] && (
                        <ShineBadge
                          label={STAFF_BADGE[c.staffRole].name}
                          gradient={STAFF_BADGE[c.staffRole].cls}
                        />
                      )}
                      <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                        {timeAgo(c.createdAt)}
                      </span>
                    </div>
                    <p className="line-clamp-2 text-sm text-zinc-300">{c.text}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      ❤️ {c.likeCount ?? 0}
                    </p>
                  </div>
                </div>
              </button>
            ))}
            {friendComments && friendComments.length === 0 && (
              <p className="py-8 text-center text-xs text-muted-foreground">
                Belum ada komentar teman — tambahkan teman lewat chat!
              </p>
            )}
          </>
        )}

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
        {tab === "history" && (history ?? []).length === 0 && (
          <p className="py-8 text-center text-xs text-muted-foreground">Belum ada history</p>
        )}

        {tab === "favorite" &&
          (favorites ?? []).map((f: any) => (
            <button
              key={f._id}
              onClick={() => navigate(`/nonton?anime=${f.animeId}`)}
              className="flex w-full items-center gap-3 rounded-xl border border-border/70 bg-secondary/30 p-2.5 text-left"
            >
              <img src={f.animeImage ?? ""} className="h-14 w-10 rounded object-cover" alt="" />
              <Heart className="size-4 fill-red-500 text-red-500" />
              <p className="min-w-0 flex-1 truncate text-sm font-semibold">{f.animeTitle}</p>
            </button>
          ))}
        {tab === "favorite" && (favorites ?? []).length === 0 && (
          <p className="py-8 text-center text-xs text-muted-foreground">Belum ada favorite</p>
        )}

        {tab === "komen" && (
          <p className="py-8 text-center text-xs text-muted-foreground">
            Lihat tab Teman untuk komentar terbaru, atau buka detail anime untuk berkomentar.
          </p>
        )}
      </div>

      <div className="px-3">
        <div className="mt-4 space-y-2">
          <button
            onClick={() => setNotifOpen(true)}
            className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3.5 text-sm"
          >
            <Mail className="size-5 text-red-400" /> Lstreamsupport@gmail.com
          </button>
          <button
            onClick={async () => {
              await signOut();
              navigate("/home");
            }}
            className="flex w-full items-center gap-3 rounded-2xl border border-red-500/40 bg-card p-3.5 text-sm text-red-400"
          >
            <LogOut className="size-5" /> Log out dari akun
          </button>
        </div>
      </div>

      {settingsOpen && <SettingsScreen onClose={() => setSettingsOpen(false)} />}
      {notifOpen && <NotifScreen onClose={() => setNotifOpen(false)} />}
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

// ------------------------------------------------------------- settings ----

function SettingsScreen({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const update = useMutation(api.account.updateSettings);
  const updateProfile = useMutation(api.account.updateProfile);
  const [name, setName] = useState(user?.username ?? "");
  const [banner, setBanner] = useState(user?.bannerUrl ?? "");
  const [theme, setTheme] = useState(user?.theme ?? "dark");
  const [customColor, setCustomColor] = useState(user?.customColor ?? "#e11d48");

  if (!user) return null;

  const applyTheme = (t: string, color?: string) => {
    document.documentElement.classList.toggle("theme-light", t === "light");
    if (color) document.documentElement.style.setProperty("--primary", color);
  };

  return (
    <FullScreen title="Pengaturan" onClose={onClose}>
      <SectionTitle>Akun</SectionTitle>
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <Avatar src={user.image} seed={user.username} className="size-16" />
          <div>
            <p className="flex items-center gap-1.5 font-bold">
              {user.username}
              {(user.premiumUntil ?? 0) > Date.now() && <BlueCheck />}
            </p>
            <p className="text-xs text-muted-foreground">
              ID: {displayId(user.seqId, user._id)} · Level {user.level}
            </p>
            <div className="mt-1">
              <LevelBadge level={user.level ?? 1} />
            </div>
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
            className="rounded-lg bg-red-600 px-4 text-sm font-bold text-white"
          >
            OK
          </button>
        </div>
      </div>

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
                  theme === t ? "border-red-500 text-red-300" : "border-border",
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
                className="rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white"
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
              className="rounded-lg bg-red-600 px-4 text-sm font-bold text-white"
            >
              OK
            </button>
          </div>
        </div>

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
          value ? "bg-red-600" : "bg-zinc-600",
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
        <span className="text-xs text-red-300">{value}</span>
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
                value === q ? "border-red-500 text-red-300" : "border-border",
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
        <span className="text-xs text-red-300">{value}x</span>
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
                value === s ? "border-red-500 text-red-300" : "border-border",
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
            className="flex items-start gap-3 rounded-xl border border-border/70 bg-secondary/30 p-3"
          >
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

// ---------------------------------------------------------- dev/mod panel ----

function DevModPanel() {
  const { user } = useAuth();
  const isDev =
    user?.role === "admin" || user?.staffRole === "dev" || user?.staffRole === "creator";
  const isMod = isDev || user?.staffRole === "mod";
  const [q, setQ] = useState("");
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
                picked?._id === u._id ? "border-red-500" : "border-border/70",
              )}
            >
              <span className="flex-1 truncate">{u.username}</span>
              {u.staffRole && (
                <ShineBadge label={u.staffRole} gradient={STAFF_BADGE[u.staffRole]?.cls ?? ""} />
              )}
              {(u.bannedUntil ?? 0) > Date.now() && (
                <span className="text-[10px] text-red-400">BANNED</span>
              )}
              {(u.mutedUntil ?? 0) > Date.now() && (
                <span className="text-[10px] text-red-300">MUTED</span>
              )}
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
                await moderate({
                  targetId: picked._id,
                  action: "unmute",
                  permanent: false,
                  reason: reason || "-",
                });
                toast.success("Unmute");
              }}
            />
            <PanelBtn
              label="Unbanned"
              onClick={async () => {
                await moderate({
                  targetId: picked._id,
                  action: "unban",
                  permanent: false,
                  reason: reason || "-",
                });
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
          <p className="text-xs font-semibold text-red-300">
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
              className="rounded-lg bg-red-600 px-3 text-xs font-bold text-white disabled:opacity-40"
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
      <div className="w-full p-3">
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
