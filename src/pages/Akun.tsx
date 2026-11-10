import { useEffect, useRef, useState, type ChangeEvent, type ComponentType } from "react";
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
import { SocialLinkBoxes } from "@/components/SocialLinks";
import { BlockedList } from "@/components/BlockedList";
import { DEFAULT_CLAN_ICON, resolveClanIcon } from "@/lib/clanIcons";
import {
  Avatar,
  BlueCheck,
  ClanLevelBar,
  ClanTag,
  CrystalIcon,
  LevelBadge,
  RedMark,
  TitleBadge,
} from "@/components/lstream-ui";
import {
  STAFF_BADGE,
  LEVEL_BADGE_TIERS,
  badgeForLevel,
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
  type Picked,
} from "@/components/StoriesUI";
import {
  ProfileStatusBubble,
  StatusBubbleEditor,
  StatusTray,
} from "@/components/ProfileStatus";
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
  BadgeCheck,
  Pencil,
  ShoppingBag,
  Share2,
  Cake,
  Plus,
  ArrowLeftRight,
} from "lucide-react";
import { FeedModeSwitch } from "@/components/FeedModeSwitch";
import { TierIcon } from "@/components/TierIcon";
import { cn } from "@/lib/utils";
import {
  getAntiLag,
  setAntiLag as setAntiLagPref,
} from "@/lib/antilag";
import { toast } from "sonner";
import { SacretIcon } from "@/components/lstream-ui";
import type { Id } from "@/convex/_generated/dataModel";
import {
  activateSavedAccount,
  clearActiveSession,
  readSavedAccounts,
  saveCurrentAccount,
  type SavedAccount,
} from "@/lib/account-sessions";

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
  const [csOpen, setCsOpen] = useState(false);
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

  // Deep link: profil orang lain (dipakai notifikasi & daftar teman).
  if (viewUserId && !openAffinity) {
    return <ProfileSheet userId={viewUserId} onClose={clearDeepLink} />;
  }

  // Deep link: LANGSUNG ke layar Afinitas — targetnya user ?user= kalau
  // ada, kalau tidak Afinitas milik kamu sendiri.
  if (openAffinity) {
    return (
      <AfinitasScreen
        targetUserId={viewUserId ?? user._id}
        onClose={clearDeepLink}
      />
    );
  }

  // Tab Pengaturan dibuka lewat ikon gerigi di profil. Tanpa ?tab=settings,
  // halaman Akun tampil sebagai profil yang hidup — bukan daftar pengaturan.
  if (params.get("tab") === "settings") {
    return (
      <>
        <SettingsScreen
          onClose={() => navigate("/akun")}
          onSignOut={signOut}
          onOpenCs={() => setCsOpen(true)}
        />
        {csOpen && <CsChatScreen onClose={() => setCsOpen(false)} />}
      </>
    );
  }

  return (
    <>
      <AkunProfileScreen
        onClose={() => navigate("/home")}
        onSettings={() => navigate("/akun?tab=settings")}
        onOpenCs={() => setCsOpen(true)}
      />
      {csOpen && <CsChatScreen onClose={() => setCsOpen(false)} />}
    </>
  );
}

/* ====================================================== PROFIL AKUN ====
   Halaman utama /akun: kartu profil terang, tier berpartikel, kotak level,
   statistik, aksi cepat, dan bagian beli Premium. Pengaturan tetap ada,
   tapi lewat ikon gerigi — bukan isi utama halaman. */

const TIER_PARTICLES = [
  { x: -34, y: -18, s: 3, c: "#FFD23F", d: 0 },
  { x: 46, y: -26, s: 2.5, c: "#7FD3F7", d: 0.4 },
  { x: -58, y: 10, s: 2, c: "#FF9AA3", d: 0.8 },
  { x: 64, y: 8, s: 3, c: "#B9A7FF", d: 0.2 },
  { x: -18, y: 26, s: 2, c: "#9AF0C7", d: 1.1 },
  { x: 22, y: 28, s: 2.5, c: "#FFD23F", d: 0.65 },
  { x: -44, y: -4, s: 2, c: "#FFFFFF", d: 1.4 },
  { x: 38, y: -6, s: 2, c: "#7FD3F7", d: 0.95 },
];

const TIER_SKIN: Record<string, string> = {
  Bronze: "from-amber-700/25 via-amber-900/10 to-transparent",
  Silver: "from-slate-300/20 via-slate-500/10 to-transparent",
  Diamond: "from-cyan-300/22 via-sky-500/10 to-transparent",
  Emerald: "from-emerald-400/22 via-emerald-700/10 to-transparent",
  Master: "from-red-500/22 via-red-900/10 to-transparent",
  Grandmaster: "from-fuchsia-400/22 via-red-600/10 to-transparent",
  Central: "from-yellow-300/22 via-amber-500/10 to-transparent",
  Ruby: "from-rose-400/22 via-red-600/10 to-transparent",
  Ascendant: "from-cyan-200/22 via-fuchsia-300/14 to-transparent",
};

function AkunTierCard({ level }: { level: number }) {
  const badge = badgeForLevel(level);
  return (
    <div
      className={cn(
        "relative mt-2.5 overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-br px-3 py-3",
        TIER_SKIN[badge.name] ?? "from-white/10 via-white/[0.03] to-transparent",
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-12 size-28 rounded-full bg-white/10 blur-2xl"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -right-2 top-1/2 size-20 -translate-y-1/2 rounded-full border border-white/10"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -right-5 top-1/2 size-28 -translate-y-1/2 rounded-full border border-white/[0.06]"
      />
      <span aria-hidden className="pointer-events-none absolute inset-0">
        {TIER_PARTICLES.map((p, i) => (
          <span
            key={i}
            className="tier-particle absolute left-1/2 top-1/2 rounded-full"
            style={
              {
                width: p.s,
                height: p.s,
                background: p.c,
                animationDelay: `${p.d}s`,
                "--dx": `${p.x}px`,
                "--dy": `${p.y}px`,
              } as React.CSSProperties
            }
          />
        ))}
      </span>
      <div className="relative flex items-center gap-3">
        <span
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br shadow-[0_6px_18px_-8px_rgba(0,0,0,.8)]",
            badge.cls,
          )}
        >
          <TierIcon tier={badge.name} className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[8.5px] font-black uppercase tracking-[0.2em] text-white/45">
            Tier profil
          </p>
          <p className="mt-0.5 truncate font-display text-lg font-black leading-none text-white">
            {badge.name}
          </p>
        </div>
        <LevelBadge level={level} className="scale-90 origin-right" />
      </div>
    </div>
  );
}

function AkunLevelCard({ level, xp }: { level: number; xp: number }) {
  const cost = xpForLevel(level);
  const inLevel = Math.max(0, Math.min(xp, cost));
  const pct = Math.min(100, (inLevel / Math.max(1, cost)) * 100);
  const left = Math.max(0, cost - inLevel);
  return (
    <div className="mt-2 rounded-2xl border border-white/12 bg-white/[0.055] px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[11px] font-black text-white">
          Level {level}
          <span className="ml-1.5 text-[9px] font-semibold text-white/35">
            sekarang
          </span>
        </p>
        <p className="truncate text-[9.5px] font-bold text-white/45">
          {inLevel.toLocaleString("id-ID")} / {cost.toLocaleString("id-ID")} XP
        </p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/35">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,#FFD23F,#7FD3F7)]"
          style={{ width: `${Math.max(3, pct)}%` }}
        />
      </div>
      <p className="mt-1.5 text-[9px] font-semibold text-white/35">
        {left.toLocaleString("id-ID")} XP lagi ke Level {level + 1}
      </p>
    </div>
  );
}

/** Daftar tier dari Bronze ke Ascendant — ikon material, garis progres,
 * penanda tier sekarang, dan sisa XP menuju level berikutnya. */
function TierLadder({ level, xp }: { level: number; xp: number }) {
  const current = badgeForLevel(level);
  const cost = Math.max(1, xpForLevel(level));
  const inLevel = Math.max(0, Math.min(xp, cost));
  const left = Math.max(0, cost - inLevel);
  const pct = Math.min(100, Math.round((inLevel / cost) * 100));

  return (
    <section className="mt-2.5 rounded-3xl border border-white/10 bg-white/[0.04] p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-black text-white">Perjalanan Tier</p>
          <p className="mt-0.5 text-[9px] text-white/35">
            Dari Bronze sampai Ascendant
          </p>
        </div>
        <LevelBadge level={level} className="scale-90 origin-right" />
      </div>

      <div className="relative mt-3">
        <span
          aria-hidden
          className="absolute bottom-5 left-[26px] top-5 w-px bg-gradient-to-b from-fuchsia-300/25 via-sky-400/35 to-amber-500/45"
        />
        <div className="space-y-1.5">
          {/* Tier tertinggi di atas, Bronze di bawah: perjalanan dibaca naik. */}
          {[...LEVEL_BADGE_TIERS].reverse().map((t) => {
            const active = t.name === current.name;
            const passed = level >= t.minLevel;
            return (
              <div
                key={t.name}
                className={cn(
                  "relative flex items-center gap-3 rounded-2xl px-1.5 py-1.5",
                  active
                    ? "border border-white/15 bg-white/[0.065]"
                    : "border border-transparent",
                  !passed && !active && "opacity-55",
                )}
              >
                <span
                  className={cn(
                    "relative z-10 flex size-10 shrink-0 items-center justify-center rounded-[14px] bg-gradient-to-br shadow-[0_8px_20px_-14px_rgba(0,0,0,.9)]",
                    t.cls,
                    !passed && "grayscale",
                    active && "ring-2 ring-white/60",
                  )}
                >
                  <TierIcon tier={t.name} className="size-5 drop-shadow" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <p className="truncate text-[11.5px] font-black text-white">
                      {t.name}
                    </p>
                    <span className="shrink-0 rounded-full bg-black/25 px-1.5 py-0.5 text-[8px] font-black text-white/55">
                      Lv.{t.minLevel.toLocaleString("id-ID")}+
                    </span>
                    {active && (
                      <span className="shrink-0 rounded-full bg-gold px-1.5 py-0.5 text-[8px] font-black text-black">
                        Kamu
                      </span>
                    )}
                  </div>
                  {active ? (
                    <>
                      <p className="mt-0.5 text-[8.5px] font-semibold text-white/45">
                        {left.toLocaleString("id-ID")} XP lagi ke Lv.{level + 1}
                      </p>
                      <div className="mt-1 h-1 overflow-hidden rounded-full bg-black/30">
                        <div
                          className="h-full rounded-full bg-[linear-gradient(90deg,#FFD23F,#7FD3F7)]"
                          style={{ width: `${Math.max(3, pct)}%` }}
                        />
                      </div>
                    </>
                  ) : (
                    <p className="mt-0.5 text-[8.5px] font-semibold text-white/35">
                      {passed ? "Sudah dilewati" : `Butuh Lv.${t.minLevel.toLocaleString("id-ID")}`}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/** Kartu premium akun: hitung mundur hari/jam/menit/detik + partikel. */
function AkunPremiumCard({
  premium,
  until,
  unlimited,
  onOpen,
}: {
  premium: boolean;
  until: number;
  unlimited: boolean;
  onOpen: () => void;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const ms = unlimited ? Number.POSITIVE_INFINITY : Math.max(0, until - now);
  const days = unlimited ? "∞" : String(Math.floor(ms / 86_400_000)).padStart(2, "0");
  const hours = unlimited
    ? "∞"
    : String(Math.floor((ms % 86_400_000) / 3_600_000)).padStart(2, "0");
  const minutes = unlimited
    ? "∞"
    : String(Math.floor((ms % 3_600_000) / 60_000)).padStart(2, "0");
  const seconds = unlimited
    ? "∞"
    : String(Math.floor((ms % 60_000) / 1000)).padStart(2, "0");
  const units = [
    [days, "Hari"],
    [hours, "Jam"],
    [minutes, "Menit"],
    [seconds, "Detik"],
  ];

  return (
    <button
      onClick={onOpen}
      className="premium-account-card relative mt-2.5 flex w-full flex-col overflow-hidden rounded-[24px] border border-[#ffd86a]/35 p-3.5 text-left transition active:scale-[0.99]"
    >
      <span aria-hidden className="premium-card-pattern absolute inset-0" />
      <span aria-hidden className="premium-card-glare absolute -inset-y-16 -left-1/3 w-1/2 rotate-[18deg]" />
      {[
        [12, 18, 3, "0s"],
        [78, 8, 2, "0.8s"],
        [26, 70, 2.5, "1.4s"],
        [90, 58, 2, "0.4s"],
        [54, 22, 1.8, "1.9s"],
        [40, 86, 2.2, "1.1s"],
        [68, 76, 3, "0.2s"],
        [8, 54, 2, "2.3s"],
      ].map(([x, y, s, d], i) => (
        <span
          key={i}
          aria-hidden
          className="premium-card-spark absolute rounded-full bg-[#ffe7a1]"
          style={{
            left: `${x}%`,
            top: `${y}%`,
            width: s,
            height: s,
            animationDelay: String(d),
          }}
        />
      ))}

      <span className="relative flex items-start justify-between gap-2">
        <span className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-xl border border-[#ffdf8b]/35 bg-[#ffd23f]/12 text-[#ffdf8b]">
            <CrystalIcon className="size-[18px]" strokeWidth={2.4} />
          </span>
          <span>
            <span className="block text-[13px] font-black tracking-tight text-white">
              {premium ? "Yoru Premium aktif" : "Beli Yoru Premium"}
            </span>
            <span className="mt-0.5 block text-[9px] font-medium text-white/48">
              XP 2× · 1080p · tanpa iklan
            </span>
          </span>
        </span>
        <span className="rounded-full bg-[#ffd23f] px-2.5 py-1 text-[9px] font-black text-black">
          {premium ? "Perpanjang" : "Pilih paket"}
        </span>
      </span>

      <span className="relative mt-3 grid grid-cols-4 gap-1.5">
        {units.map(([value, label]) => (
          <span
            key={label}
            className="rounded-xl border border-white/12 bg-black/30 py-2 text-center backdrop-blur-md"
          >
            <span className="block font-mono text-[16px] font-black leading-none text-[#fff1bd]">
              {value}
            </span>
            <span className="mt-1 block text-[7px] font-black uppercase tracking-[0.1em] text-white/38">
              {label}
            </span>
          </span>
        ))}
      </span>
    </button>
  );
}

function AkunProfileScreen({
  onClose,
  onSettings,
  onOpenCs,
}: {
  onClose: () => void;
  onSettings: () => void;
  onOpenCs: () => void;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const stats = useQuery(api.account.profileStats, user ? {} : "skip");
  const [editOpen, setEditOpen] = useState(false);
  const [bubbleOpen, setBubbleOpen] = useState(false);
  const [storyComposer, setStoryComposer] = useState(false);
  const [storyItems, setStoryItems] = useState<Picked[] | null>(null);
  const [storyView, setStoryView] = useState<string | null>(null);
  const [switchOpen, setSwitchOpen] = useState(false);
  if (!user) return null;

  const level = user.level ?? 1;
  const xp = user.xp ?? 0;
  const premium = (user.premiumUntil ?? 0) > Date.now() || !!user.unlimitedPremium;
  const clanTag = user.clanTag;

  const shareAccount = async () => {
    const url = `${window.location.origin}/akun?user=${user._id}`;
    const nav = navigator as Navigator & {
      share?: (d: ShareData) => Promise<void>;
    };
    if (nav.share) {
      try {
        await nav.share({
          title: `${user.username ?? "user"} di YoruNime`,
          text: "Lihat profil YoruNime-ku",
          url,
        });
        return;
      } catch {
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Tautan akun disalin");
    } catch {
      toast.error("Gagal membagikan akun");
    }
  };

  const ACTIONS: {
    label: string;
    Icon: ComponentType<{ className?: string; strokeWidth?: number }>;
    onClick: () => void;
  }[] = [
    { label: "Favorite", Icon: Heart, onClick: () => navigate("/home?panel=favorites") },
    { label: "History", Icon: HistoryIcon, onClick: () => navigate("/home?panel=history") },
    { label: "Clan", Icon: Shield, onClick: () => navigate("/clan") },
    { label: "Shop", Icon: ShoppingBag, onClick: () => navigate("/home?panel=shop") },
    { label: "Premium", Icon: CrystalIcon, onClick: () => navigate("/premium") },
    { label: "Pengaturan", Icon: SettingsIcon, onClick: onSettings },
  ];

  return (
    <div className="pb-28 pt-3">
      <header className="flex items-center gap-2.5">
        <button
          onClick={onClose}
          aria-label="Kembali"
          className="flex shrink-0 items-center text-foreground/90 transition active:opacity-60"
        >
          <StripBackIcon />
        </button>
        <span className="min-w-0 flex-1" />
        <button
          onClick={onOpenCs}
          aria-label="Customer service"
          className="flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white/65 transition hover:text-white active:scale-95"
        >
          <Headset className="size-4" />
        </button>
        <button
          onClick={onSettings}
          aria-label="Pengaturan"
          className="flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white/65 transition hover:text-white active:scale-95"
        >
          <SettingsIcon className="size-4" />
        </button>
      </header>

      <StatusTray
        onView={(uid) => setStoryView(uid)}
        onCompose={() => setStoryComposer(true)}
      />

      <section className="relative mt-2 overflow-hidden rounded-[30px] border border-white/12 bg-[linear-gradient(155deg,#202737_0%,#171c27_46%,#11151d_100%)] p-4 shadow-[0_28px_60px_-42px_rgba(0,0,0,.95)]">
        <span
          aria-hidden
          className="pointer-events-none absolute -left-16 -top-20 size-52 rounded-full bg-[#FFD23F]/10 blur-3xl"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -right-20 size-56 rounded-full bg-[#7FD3F7]/10 blur-3xl"
        />

        <div className="relative flex items-start justify-between gap-2">
          <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 font-mono text-[9px] font-bold text-white/45">
            {displayId(user.seqId, user._id)}
          </span>
          <button
            onClick={() => void shareAccount()}
            aria-label="Bagikan akun"
            title="Bagikan akun"
            className="flex size-9 items-center justify-center rounded-full border border-white/15 bg-white/[0.07] text-white/75 transition hover:text-white active:scale-95"
          >
            <Share2 className="size-4" />
          </button>
        </div>

        <div className="relative mt-1 flex flex-col items-center text-center">
          <span className="relative">
            <span className="absolute -inset-1.5 rounded-full bg-[conic-gradient(from_120deg,rgba(255,210,63,.7),rgba(127,211,247,.55),rgba(232,72,85,.45),rgba(255,210,63,.7))] blur-[1px]" />
            <span className="absolute -inset-1.5 rounded-full bg-[conic-gradient(from_120deg,rgba(255,210,63,.65),rgba(127,211,247,.5),rgba(232,72,85,.4),rgba(255,210,63,.65))] opacity-60 blur-md" />
            <FramedAvatar
              border={user.avatarBorder}
              src={user.image}
              seed={user.username}
              className="relative size-[96px] rounded-full ring-2 ring-[#202737]"
            />
            <ProfileStatusBubble
              text={user.statusText}
              bg={user.statusBg}
              seed={user._id}
              onClick={() => setBubbleOpen(true)}
              className="absolute left-[40px] -top-7 w-[118px] max-w-[118px]"
            />
            <button
              onClick={() => setEditOpen(true)}
              aria-label="Ganti foto"
              className="absolute -bottom-1 -right-1 flex size-8 items-center justify-center rounded-full border-2 border-[#1b2130] bg-gold text-black transition active:scale-90"
            >
              <Pencil className="size-3.5" strokeWidth={2.4} />
            </button>
          </span>

          <div className="mt-2.5 flex min-w-0 max-w-full items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSwitchOpen(true)}
              className="flex min-w-0 max-w-full items-center gap-1.5 rounded-full py-0.5 pl-1 pr-2 transition active:scale-[0.98]"
              aria-label="Ganti akun"
            >
              <h2 className="truncate font-display text-[22px] font-black leading-tight text-white">
                {user.username ?? "user"}
              </h2>
              <ChevronRight className="size-4 shrink-0 text-white/45" strokeWidth={2.6} />
            </button>
            {premium && <BlueCheck className="size-4 shrink-0" />}
          </div>
          <p className="mt-0.5 max-w-full truncate text-[11px] font-medium text-white/40">
            {user.email ?? user.name ?? "Akun YoruNime"}
          </p>

          <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1.5">
            <LevelBadge level={level} />
            {clanTag && (
              <ClanTag
                icon={user.clanTagIcon ?? DEFAULT_CLAN_ICON}
                tag={clanTag}
                level={user.clanLevel}
              />
            )}
            {premium && (
              <span className="rounded-full border border-gold/40 bg-gold/12 px-2 py-0.5 text-[9px] font-black text-gold">
                PREMIUM
              </span>
            )}
          </div>

          <div className="mt-3 w-full text-left">
            {/* Kotak bio di ATAS kartu tier/tag. Kotak level lama dihapus. */}
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="flex min-h-[58px] w-full flex-col justify-center rounded-2xl border border-white/12 bg-white/[0.055] px-3 py-2.5 text-left transition hover:border-white/22 hover:bg-white/[0.075] active:scale-[0.995]"
            >
              <span className="text-[8.5px] font-black uppercase tracking-[0.18em] text-white/32">
                Bio
              </span>
              <span
                className={cn(
                  "mt-0.5 line-clamp-2 text-[10.5px] leading-snug",
                  user.bio?.trim() ? "font-medium text-white/72" : "text-white/30",
                )}
              >
                {user.bio?.trim() || "Tulis bio mu..."}
              </span>
            </button>
            <AkunTierCard level={level} />
          </div>

          <button
            onClick={() => setEditOpen(true)}
            className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/12 bg-white/[0.055] py-2 text-[11px] font-black text-white/75 transition hover:bg-white/[0.09] active:scale-[0.99]"
          >
            <Pencil className="size-3.5 text-gold" />
            Ubah foto &amp; username
          </button>
        </div>
      </section>

      <TierLadder level={level} xp={xp} />

      {/* Statistik ringkas */}
      <div className="mt-2.5 grid grid-cols-3 gap-2">
        {[
          ["Nonton", stats?.watchCount ?? 0],
          ["Menit", stats?.minutesWatched ?? 0],
          ["Komentar", stats?.commentCount ?? 0],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            className="rounded-2xl border border-white/10 bg-white/[0.045] px-2 py-2.5 text-center"
          >
            <p className="truncate font-display text-lg font-black leading-none text-white">
              {Number(value).toLocaleString("id-ID")}
            </p>
            <p className="mt-1 truncate text-[9px] font-bold uppercase tracking-wider text-white/35">
              {label}
            </p>
          </div>
        ))}
      </div>

      <AkunPremiumCard
        premium={premium}
        until={user.premiumUntil ?? 0}
        unlimited={!!user.unlimitedPremium}
        onOpen={() => navigate("/premium")}
      />

      {/* Aksi cepat — 3 per baris, kotak kecil. */}
      <div className="mt-2.5 grid grid-cols-3 gap-2">
        {ACTIONS.map(({ label, Icon, onClick }) => (
          <button
            key={label}
            onClick={onClick}
            className="flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.045] px-1 text-center transition hover:border-white/25 hover:bg-white/[0.075] active:scale-[0.97]"
          >
            <Icon className="size-4 text-gold/90" />
            <span className="truncate text-[10px] font-black text-white/75">
              {label}
            </span>
          </button>
        ))}
      </div>

      {editOpen && <EditIdentitySheet onClose={() => setEditOpen(false)} />}
      {switchOpen && (
        <AccountSwitcherSheet onClose={() => setSwitchOpen(false)} />
      )}
      {bubbleOpen && (
        <StatusBubbleEditor
          initialText={user.statusText}
          initialBg={user.statusBg}
          onClose={() => setBubbleOpen(false)}
        />
      )}
      {storyComposer && (
        <StoryComposer
          onClose={() => setStoryComposer(false)}
          onPicked={(items) => {
            setStoryComposer(false);
            setStoryItems(items);
          }}
        />
      )}
      {storyItems && (
        <StoryEditor
          items={storyItems}
          onClose={() => setStoryItems(null)}
          onPosted={() => setStoryItems(null)}
        />
      )}
      {storyView && (
        <StoryViewer
          userId={storyView === String(user._id) ? user._id : undefined}
          initialUserId={storyView}
          onClose={() => setStoryView(null)}
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsPage, setSettingsPage] = useState<
    "menu" | "akun" | "nonton" | "notifikasi" | "tampilan" | "chat" | "privasi" | "unduhan" | "lainnya"
  >("menu");
  const [feedSwitch, setFeedSwitch] = useState(false);
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
  // Sheet baru untuk foto + username (tombol di kartu identitas).
  const [editOpen, setEditOpen] = useState(false);
  // GACHA KARTU ANIME DIHAPUS PERMANEN — hadiah gacha sekarang keluar dari
  // mesin vending (XP, telur pet, Sacret, premium), bukan kartu karakter.
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
  const [showBlocked, setShowBlocked] = useState(false);
  const panelLevel: "dev" | "mod" | "none" =
    access?.level === "dev" ? "dev" : access?.level === "mod" ? "mod" : "none";
  if (!user) return null;

  if (!settingsOpen) {
    return (
      <div className="pb-28 pt-4">
        <div className="flex items-center justify-between">
          <button
            onClick={onClose}
            aria-label="Kembali"
            className="flex shrink-0 items-center text-foreground/90 transition active:opacity-60"
          >
            <StripBackIcon />
          </button>
          <button
            onClick={onOpenCs}
            aria-label="Customer service"
            className="flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.045] text-white/55"
          >
            <Headset className="size-4" />
          </button>
        </div>
        <h1 className="mt-7 px-1 text-[34px] font-black tracking-tight text-white/35">
          Akun
        </h1>
        <button
          type="button"
          onClick={() => {
            setSettingsPage("menu");
            setSettingsOpen(true);
          }}
          className="mt-4 flex w-full items-center gap-3 rounded-[24px] border border-white/10 bg-[#16151b] p-4 text-left transition active:scale-[0.995]"
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white/[0.055] text-white/65">
            <SettingsIcon className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-black text-white">Pengaturan akun</span>
            <span className="mt-0.5 block text-[10.5px] text-white/35">
              Tampilan, notifikasi, privasi & lainnya
            </span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-white/25" />
        </button>
      </div>
    );
  }

  const ownedBorders = user.ownedBorders ?? [];
  const equippedBorder = user.avatarBorder ?? "none";
  const isPremium =
    !!user.unlimitedPremium || (user.premiumUntil ?? 0) > Date.now();

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

  const pageMeta: Record<
    typeof settingsPage,
    { title: string; desc: string }
  > = {
    menu: { title: "Pengaturan", desc: "Pilih kategori pengaturan" },
    akun: { title: "Akun", desc: "Profil, Feed Mode, dan sesi akun" },
    nonton: { title: "Nonton", desc: "Player dan episode" },
    notifikasi: { title: "Notifikasi", desc: "Jenis pemberitahuan yang masuk" },
    tampilan: { title: "Tampilan", desc: "Tema, warna, dan banner profil" },
    chat: { title: "Chat", desc: "Pesan, sticker, dan tanda dibaca" },
    privasi: { title: "Privasi", desc: "Visibilitas dan daftar blokir" },
    unduhan: { title: "Unduhan & Kuota", desc: "Penyimpanan dan penghemat data" },
    lainnya: { title: "Lainnya", desc: "Bantuan, sosial media, dan akun" },
  };
  const meta = pageMeta[settingsPage];
  const goBack = () => {
    if (settingsPage !== "menu") {
      setSettingsPage("menu");
      return;
    }
    setSettingsOpen(false);
  };
  const menuCards: {
    key: Exclude<typeof settingsPage, "menu">;
    title: string;
    desc: string;
    icon: React.ReactNode;
    tone: string;
  }[] = [
    {
      key: "akun",
      title: "Akun",
      desc: "Profil, Feed Mode, dan sesi akun",
      icon: <SettingsIcon className="size-[18px]" />,
      tone: "border-sky-300/20 bg-[linear-gradient(135deg,rgba(56,189,248,.12),rgba(255,255,255,.025))] text-sky-200",
    },
    {
      key: "nonton",
      title: "Nonton",
      desc: "Player dan episode",
      icon: <Play className="size-[18px]" />,
      tone: "border-amber-300/20 bg-[linear-gradient(135deg,rgba(251,191,36,.12),rgba(255,255,255,.025))] text-amber-200",
    },
    {
      key: "notifikasi",
      title: "Notifikasi",
      desc: "Jenis pemberitahuan yang masuk",
      icon: <Bell className="size-[18px]" />,
      tone: "border-rose-300/20 bg-[linear-gradient(135deg,rgba(251,113,133,.12),rgba(255,255,255,.025))] text-rose-200",
    },
    {
      key: "tampilan",
      title: "Tampilan",
      desc: "Tema, warna, dan banner profil",
      icon: <Palette className="size-[18px]" />,
      tone: "border-violet-300/20 bg-[linear-gradient(135deg,rgba(167,139,250,.12),rgba(255,255,255,.025))] text-violet-200",
    },
    {
      key: "chat",
      title: "Chat",
      desc: "Pesan, sticker, dan tanda dibaca",
      icon: <MessageSquare className="size-[18px]" />,
      tone: "border-cyan-300/20 bg-[linear-gradient(135deg,rgba(34,211,238,.12),rgba(255,255,255,.025))] text-cyan-200",
    },
    {
      key: "privasi",
      title: "Privasi",
      desc: "Visibilitas dan daftar blokir",
      icon: <Shield className="size-[18px]" />,
      tone: "border-emerald-300/20 bg-[linear-gradient(135deg,rgba(52,211,153,.12),rgba(255,255,255,.025))] text-emerald-200",
    },
    {
      key: "unduhan",
      title: "Unduhan & Kuota",
      desc: "Penyimpanan dan penghemat data",
      icon: <Download className="size-[18px]" />,
      tone: "border-indigo-300/20 bg-[linear-gradient(135deg,rgba(129,140,248,.12),rgba(255,255,255,.025))] text-indigo-200",
    },
    {
      key: "lainnya",
      title: "Lainnya",
      desc: "Bantuan, sosial media, dan akun",
      icon: <Headset className="size-[18px]" />,
      tone: "border-white/12 bg-[linear-gradient(135deg,rgba(255,255,255,.065),rgba(255,255,255,.02))] text-white/65",
    },
  ];

  return (
    <div className="fixed inset-0 z-[90] bg-background">
      <div className="thin-scroll h-full overflow-y-auto px-4 pb-28 pt-3">
        <div className="sticky top-0 z-20 -mx-4 border-b border-white/10 bg-background/95 px-4 py-2.5 backdrop-blur-xl">
          <div className="flex items-center gap-2.5">
            <button
              onClick={goBack}
              aria-label={settingsPage === "menu" ? "Tutup pengaturan" : "Kembali ke menu pengaturan"}
              className="flex size-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.045] text-foreground/80 transition active:scale-95"
            >
              <StripBackIcon />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-[16px] font-black tracking-tight text-white">
                {meta.title}
              </h1>
              <p className="truncate text-[9.5px] font-medium text-white/35">
                {meta.desc}
              </p>
            </div>
            {settingsPage !== "menu" && (
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.14em] text-white/35">
                {settingsPage}
              </span>
            )}
          </div>
        </div>

        {settingsPage === "menu" && (
          <div className="mt-3 space-y-2">
            {menuCards.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setSettingsPage(item.key)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-[22px] border p-3 text-left transition hover:brightness-110 active:scale-[0.995]",
                  item.tone,
                )}
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-2xl border border-white/10 bg-black/15">
                  {item.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-black text-white">
                    {item.title}
                  </span>
                  <span className="mt-0.5 block text-[10px] leading-snug text-white/40">
                    {item.desc}
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-white/30" />
              </button>
            ))}
          </div>
        )}

        {settingsPage === "akun" && (
          <div className="mt-3 space-y-2">
            <div className="rounded-[26px] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,.065),rgba(255,255,255,.025))] p-3.5">
              <div className="flex items-center gap-3">
                <FramedAvatar
                  border={user.avatarBorder}
                  src={user.image}
                  seed={user.username}
                  className="size-12 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-black text-white">
                    {user.username ?? "user"}
                  </p>
                  <p className="truncate text-[10px] text-white/40">
                    {user.email ?? user.name ?? "Akun YoruNime"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditOpen(true)}
                  className="shrink-0 rounded-full border border-white/15 bg-white/[0.07] px-3 py-1.5 text-[10px] font-black text-white/75 transition active:scale-95"
                >
                  Edit profil
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setFeedSwitch(true)}
              className="flex w-full items-center gap-3 rounded-[22px] border border-[var(--ui-c)]/25 bg-[var(--ui-c)]/[0.07] p-3 text-left transition active:scale-[0.995]"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[var(--ui-c)]/15 text-[var(--ui-c)]">
                <ArrowLeftRight className="size-[18px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] font-black text-white">Feed Mode</span>
                <span className="mt-0.5 block text-[10px] text-white/40">
                  Beralih ke beranda Feed
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-white/30" />
            </button>
            <button
              type="button"
              onClick={async () => {
                await onSignOut();
                navigate("/home");
              }}
              className="flex w-full items-center gap-2.5 rounded-[22px] border border-red-500/35 bg-red-500/[0.08] p-3 text-[12px] font-semibold text-red-300 transition hover:bg-red-500/15 active:scale-[0.99]"
            >
              <LogOut className="size-4 shrink-0" /> Keluar dari akun
            </button>
          </div>
        )}

        {settingsPage === "nonton" && (
          <div className="mt-3">
            <SettingsBox
              icon={<Play className="size-[18px]" />}
              title="Nonton"
              desc="Perilaku player & pemutaran otomatis"
              items={PREF_NONTON}
              value={watchPrefs}
              onToggle={toggleWatch}
              openAll
            />
          </div>
        )}

        {settingsPage === "notifikasi" && (
          <div className="mt-3 space-y-2">
            <button
              type="button"
              onClick={() => setShowNotif(true)}
              className="flex w-full items-center gap-3 rounded-[22px] border border-amber-300/20 bg-[linear-gradient(135deg,rgba(251,191,36,.1),rgba(255,255,255,.025))] p-3 text-left transition active:scale-[0.995]"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-amber-400/15 text-amber-200">
                <Bell className="size-[18px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] font-black text-white">Buka pusat notifikasi</span>
                <span className="mt-0.5 block text-[10px] text-white/40">
                  Lihat pengumuman dan pemberitahuan terbaru
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-white/30" />
            </button>
            <SettingsBox
              icon={<Bell className="size-[18px]" />}
              title="Notifikasi"
              desc="Feed, episode anime, chat teman & clan"
              items={PREF_NOTIF}
              value={notifPrefs}
              onToggle={toggleNotif}
              openAll
            />
          </div>
        )}

        {settingsPage === "tampilan" && (
          <div className="mt-3 space-y-2">
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event("yn-open-theme"))}
              className="flex w-full items-center gap-3 rounded-[22px] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,.06),rgba(255,210,63,.035))] p-3 text-left transition hover:border-white/25 active:scale-[0.995]"
            >
              <span
                className="flex size-10 shrink-0 items-center justify-center rounded-2xl text-gold"
                style={{ background: "color-mix(in srgb, var(--ui-a, #FFD23F) 16%, transparent)" }}
              >
                <Palette className="size-[18px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] font-black text-white">Tema &amp; warna</span>
                <span className="mt-0.5 block text-[10px] text-white/40">
                  Glassmorphism, Default, dan palet aplikasi
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-white/30" />
            </button>
            <SettingsBox
              icon={<Palette className="size-[18px]" />}
              title="Tampilan"
              desc="Tema, animasi & kenyamanan layar"
              items={PREF_TAMPILAN}
              value={tampilanPrefs}
              onToggle={toggleTampilan}
              openAll
            />
            <div className="rounded-3xl border border-violet-400/15 bg-gradient-to-br from-violet-400/[0.08] via-card to-card p-3">
              <div className="mb-2.5 flex items-center gap-2.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-violet-400/15">
                  <Palette className="size-[18px] text-violet-300" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-black leading-tight">Banner Profil</p>
                  <p className="mt-0.5 text-[10.5px] leading-tight text-muted-foreground">
                    Tampil di detail akun fullscreen · khusus Premium
                  </p>
                </div>
                {isPremium && (
                  <span className="shrink-0 rounded-full bg-gold/15 px-2 py-0.5 text-[9px] font-black text-gold">
                    PREMIUM
                  </span>
                )}
              </div>
              <div className="relative mb-2 h-20 overflow-hidden rounded-xl bg-white/[0.04]">
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
          </div>
        )}

        {settingsPage === "chat" && (
          <div className="mt-3">
            <SettingsBox
              icon={<MessageSquare className="size-[18px]" />}
              title="Chat"
              desc="Pesan, sticker & cara mengetik"
              items={PREF_CHAT}
              value={chatPrefs}
              onToggle={toggleChat}
              openAll
            />
          </div>
        )}

        {settingsPage === "privasi" && (
          <div className="mt-3 space-y-2">
            <SettingsBox
              icon={<Shield className="size-[18px]" />}
              title="Privasi"
              desc="Siapa yang bisa melihat & menghubungimu"
              items={PREF_PRIVASI}
              value={privasiPrefs}
              onToggle={togglePrivasi}
              openAll
            />
            <button
              onClick={() => setShowBlocked(true)}
              className="w-full rounded-[22px] border border-border bg-card p-3 text-left transition hover:border-foreground/40"
            >
              <span className="flex items-center gap-2.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#E84855]/15">
                  <Ban className="size-[18px] text-[#E84855]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-bold">Daftar Blokir</span>
                  <span className="block text-[11px] text-muted-foreground">
                    {blockedUsers?.length
                      ? `${blockedUsers.length} pengguna diblokir · ketuk untuk kelola`
                      : "Belum ada pengguna yang diblokir"}
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </span>
            </button>
          </div>
        )}

        {settingsPage === "unduhan" && (
          <div className="mt-3">
            <SettingsBox
              icon={<Download className="size-[18px]" />}
              title="Unduhan & Kuota"
              desc="Mengelola unduhan & penghemat data"
              items={PREF_UNDUHAN}
              value={unduhanPrefs}
              onToggle={toggleUnduhan}
              openAll
            />
          </div>
        )}

        {settingsPage === "lainnya" && (
          <div className="mt-3 space-y-2">
            {panelLevel !== "none" && <StaffPanel level={panelLevel} />}
            <BlockTitle>Tautan Media Sosial</BlockTitle>
            <SocialLinkBoxes />
            <BlockTitle>Bantuan</BlockTitle>
            <button
              onClick={onOpenCs}
              className="flex w-full items-center gap-2.5 rounded-[22px] border border-border bg-card p-3 text-left transition hover:border-foreground/40"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15">
                <Headset className="size-[18px] text-primary" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold">Customer Service</span>
                <span className="block text-[11px] text-muted-foreground">
                  Hubungi tim YoruNime
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </button>
            <div className="flex items-center gap-2.5 rounded-[22px] border border-white/10 bg-card p-3 text-[12px]">
              <Mail className="size-4 shrink-0 text-primary" /> Lstreamsupport@gmail.com
            </div>
          </div>
        )}

        {showBlocked && <BlockedList onClose={() => setShowBlocked(false)} />}
        {showNotif && <NotifScreen onClose={() => setShowNotif(false)} />}
        {feedSwitch && <FeedModeSwitch onClose={() => setFeedSwitch(false)} />}
        {editOpen && <EditIdentitySheet onClose={() => setEditOpen(false)} />}
      </div>
    </div>
  );
}

/* ==================================================== kartu identitas ====
   Kartu profil baru di paling atas Pengaturan Akun: foto di kiri, username
   + nama Google + ID di kanan, badge tier hanya untuk akun premium, satu
   tombol edit, lalu dua kotak Sisa Premium & Saldo Sacret.
   ========================================================================= */
const TIER_STYLE: Record<
  "basic" | "plus" | "vip",
  { label: string; pill: string; icon: string }
> = {
  basic: {
    label: "Basic",
    pill: "border-[#1CA7EC]/45 bg-[#1CA7EC]/12 text-[#8FD8F7]",
    icon: "text-[#1CA7EC]",
  },
  plus: {
    label: "Plus",
    pill: "border-[#E84855]/50 bg-[#E84855]/12 text-[#FF9AA3]",
    icon: "text-[#E84855]",
  },
  vip: {
    label: "VIP",
    pill: "border-gold/50 bg-gold/12 text-gold",
    icon: "text-gold",
  },
};

function ProfileOverviewCard({
  user,
  onEdit,
  onOpen,
}: {
  user: any;
  onEdit: () => void;
  /** Ketuk kartu → detail akun. Tombol edit tetap berhenti di sini. */
  onOpen?: () => void;
}) {
  const unlimited = !!user.unlimitedPremium;
  const until = user.premiumUntil ?? 0;
  const premium = unlimited || until > Date.now();
  const tier = premium
    ? TIER_STYLE[(user.premiumTier ?? "basic") as "basic" | "plus" | "vip"]
    : null;
  const days = premium
    ? unlimited
      ? null
      : Math.max(1, Math.ceil((until - Date.now()) / 86_400_000))
    : 0;
  const endDate =
    premium && !unlimited
      ? new Date(until).toLocaleDateString("id-ID", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : null;

  return (
    <div
      onClick={() => onOpen?.()}
      onKeyDown={(e) => {
        if (onOpen && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onOpen();
        }
      }}
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      className={cn(
        "relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.055] via-card to-card p-3.5 shadow-[0_18px_40px_-30px_rgba(0,0,0,0.9)]",
        onOpen && "cursor-pointer transition hover:border-white/20 active:scale-[0.995]",
      )}
    >
      {/* Aksen tipis, bukan glow ramai. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-12 -top-12 size-32 rounded-full bg-[#1CA7EC]/10 blur-2xl"
      />

      <div className="relative flex items-start gap-3">
        <FramedAvatar
          border={user.avatarBorder}
          src={user.image}
          seed={user.username}
          className="size-[76px] shrink-0 rounded-full ring-1 ring-[#1CA7EC]/35"
        />

        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex min-w-0 items-center gap-1.5">
            <span
              className={cn(
                "min-w-0 flex-1 truncate text-[17px] font-black leading-tight",
                usernameColor(user.username ?? "user"),
              )}
            >
              {user.username ?? "user"}
            </span>
            {tier && (
              <span
                className={cn(
                  "inline-flex shrink-0 items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[8px] font-black uppercase leading-none tracking-[0.08em]",
                  tier.pill,
                )}
              >
                <BadgeCheck className={cn("size-3", tier.icon)} strokeWidth={2.6} />
                {tier.label}
              </span>
            )}
          </div>

          <p className="mt-1 truncate text-[11.5px] font-medium leading-tight text-white/50">
            {user.name || user.email || "Akun Google"}
          </p>
          <p className="mt-1.5 truncate text-[10px] font-semibold leading-tight tracking-wide text-white/32">
            ID: {displayId(user.seqId, user._id)}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onEdit();
        }}
        className="relative mt-3 flex w-full items-center gap-2 rounded-xl border border-white/12 bg-white/[0.05] px-3 py-2.5 text-left transition hover:border-[#1CA7EC]/50 hover:bg-white/[0.08] active:scale-[0.99]"
      >
        <Camera className="size-4 shrink-0 text-[#1CA7EC]" strokeWidth={2} />
        <span className="min-w-0 flex-1 truncate text-[12px] font-bold text-white">
          Ubah foto &amp; username
        </span>
        <Pencil className="size-3.5 shrink-0 text-white/35" />
      </button>

      <div className="relative mt-2 grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-gold/20 bg-gold/[0.06] px-3 py-2.5">
          <div className="flex items-center gap-1.5">
            <CrystalIcon className="size-3.5 text-gold" strokeWidth={2.2} />
            <p className="text-[8.5px] font-black uppercase tracking-[0.13em] text-gold/80">
              Sisa Premium
            </p>
          </div>
          <p className="mt-1.5 truncate text-[21px] font-black leading-none text-white">
            {unlimited ? "∞" : days}
            <span className="ml-1 text-[10px] font-semibold text-white/45">
              {unlimited ? "tanpa batas" : "hari"}
            </span>
          </p>
          <p className="mt-1 truncate text-[9px] font-medium text-white/38">
            {unlimited
              ? "Aktif selamanya"
              : endDate
                ? `s/d ${endDate}`
                : "Belum aktif"}
          </p>
        </div>

        <div className="rounded-2xl border border-[#1CA7EC]/20 bg-[#1CA7EC]/[0.06] px-3 py-2.5">
          <div className="flex items-center gap-1.5">
            <SacretIcon className="size-3.5 text-[#1CA7EC]" />
            <p className="text-[8.5px] font-black uppercase tracking-[0.13em] text-[#8FD8F7]/80">
              Saldo Sacret
            </p>
          </div>
          <p className="mt-1.5 truncate text-[21px] font-black leading-none text-white">
            {(user.diamonds ?? 0).toLocaleString("id-ID")}
          </p>
          <p className="mt-1 truncate text-[9px] font-medium text-white/38">
            Sacret siap dipakai
          </p>
        </div>
      </div>
    </div>
  );
}

/* ==================================================== ganti akun ======= */

/** Sheet GANTI AKUN — akun yang tersimpan di perangkat bisa benar-benar
 *  ditukar (JWT + refresh token disimpan per akun), lalu reload ke /home. */
function AccountSwitcherSheet({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const unreadQuery = useQuery(
    api.moderation.myUnreadCount,
    user ? {} : "skip",
  );
  const unread = unreadQuery ?? 0;
  const [accounts, setAccounts] = useState<SavedAccount[]>(() =>
    readSavedAccounts(),
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!user || unreadQuery === undefined) return;
    const list = saveCurrentAccount(
      {
        _id: String(user._id),
        username: user.username,
        image: user.image,
        bannerUrl: user.bannerUrl,
      },
      unread,
    );
    setAccounts(list);
  }, [user?._id, user?.username, user?.image, user?.bannerUrl, unread, unreadQuery]);

  if (!user) return null;

  const others = accounts.filter((a) => a.id !== String(user._id));
  const rows = [
    {
      id: String(user._id),
      username: user.username ?? "user",
      image: user.image,
      unread,
      current: true,
    },
    ...others.map((a) => ({ ...a, current: false })),
  ];

  const switchTo = (id: string) => {
    if (busy || id === String(user._id)) return;
    setErr("");
    setBusy(id);
    saveCurrentAccount(
      {
        _id: String(user._id),
        username: user.username,
        image: user.image,
        bannerUrl: user.bannerUrl,
      },
      unread,
    );
    if (!activateSavedAccount(id)) {
      setBusy(null);
      setErr("Sesi akun itu sudah kedaluwarsa. Masuk ulang lewat Tambahkan Akun.");
    }
  };

  const addAccount = () => {
    if (busy) return;
    setBusy("add");
    setErr("");
    const saved = saveCurrentAccount(
      {
        _id: String(user._id),
        username: user.username,
        image: user.image,
        bannerUrl: user.bannerUrl,
      },
      unread,
    );
    if (!saved.some((a) => a.id === String(user._id))) {
      setBusy(null);
      setErr("Sesi akun ini belum siap. Muat ulang lalu coba lagi.");
      return;
    }
    // Jangan signOut: itu mencabut sesi server akun yang baru disimpan.
    // Cukup kosongkan sesi lokal, lalu buka login dengan reload penuh.
    clearActiveSession();
    window.location.replace("/auth?returnTo=/home&add=1");
  };

  return (
    <div
      className="fixed inset-0 z-[96] flex items-end justify-center bg-black/55 p-3 pb-5"
      onClick={() => !busy && onClose()}
      role="dialog"
      aria-modal
    >
      <div
        className="pop-enter w-full max-w-sm overflow-hidden rounded-[28px] border border-white/12 bg-[#111018] shadow-[0_-24px_60px_-28px_rgba(0,0,0,1)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-px w-full bg-[linear-gradient(90deg,transparent,rgba(255,255,255,.32),transparent)]" />
        <div className="flex items-center gap-2.5 px-4 pb-2.5 pt-4">
          <h2 className="min-w-0 flex-1 text-[13px] font-black uppercase tracking-[0.18em] text-white/80">
            Ganti Akun
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="flex size-7 items-center justify-center rounded-full bg-white/[0.07] text-white/50"
          >
            <X className="size-3.5" />
          </button>
        </div>
        <div className="mx-4 h-px bg-white/10" />

        <div className="thin-scroll max-h-[52dvh] space-y-1.5 overflow-y-auto px-3 py-3">
          {rows.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => switchTo(a.id)}
              disabled={!!busy || a.current}
              className={cn(
                "flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition active:scale-[0.99]",
                a.current
                  ? "border-white/16 bg-white/[0.07]"
                  : "border-transparent hover:border-white/12 hover:bg-white/[0.045]",
              )}
            >
              <FramedAvatar
                src={a.image}
                seed={a.username}
                className="size-11 shrink-0 rounded-full"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[16px] font-black leading-tight text-white">
                  {a.username}
                </span>
                <span className="mt-0.5 block text-[9.5px] font-semibold text-white/35">
                  {a.current ? "Akun aktif" : "Ketuk untuk berpindah"}
                </span>
              </span>
              {a.unread > 0 && (
                <span className="flex min-w-5 shrink-0 items-center justify-center rounded-full bg-[#E84855] px-1.5 py-0.5 text-[9px] font-black leading-none text-white">
                  {Math.min(a.unread, 99)}+
                </span>
              )}
              {a.current && (
                <Check className="size-4 shrink-0" style={{ color: "var(--ui-c)" }} strokeWidth={3} />
              )}
              {busy === a.id && (
                <span className="size-4 shrink-0 animate-spin rounded-full border-2 border-white/25 border-t-white" />
              )}
            </button>
          ))}
        </div>

        {err && (
          <p className="mx-4 mb-2 rounded-xl border border-rose-400/25 bg-rose-500/10 px-2.5 py-2 text-[10px] font-semibold leading-snug text-rose-200">
            {err}
          </p>
        )}

        <div className="px-3 pb-4">
          <button
            type="button"
            onClick={() => void addAccount()}
            disabled={!!busy}
            className="flex w-full items-center gap-3 rounded-2xl border border-white/12 bg-white/[0.035] px-3 py-2.5 text-left transition hover:bg-white/[0.07] active:scale-[0.99] disabled:opacity-50"
          >
            <span
              className="grid size-11 shrink-0 place-items-center rounded-full text-black"
              style={{ background: "var(--ui-c, #FFD23F)" }}
            >
              <Plus className="size-5" strokeWidth={3} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-black text-white">
                Tambahkan Akun
              </span>
              <span className="mt-0.5 block text-[9.5px] font-semibold text-white/35">
                Masuk dengan akun YoruNime lain
              </span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ======================================================= sheet edit ==== */
function EditIdentitySheet({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const updateProfile = useMutation(api.account.updateProfile);
  const [name, setName] = useState(user?.username ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [birthDay, setBirthDay] = useState(user?.birthDate?.split("-")[2] ?? "");
  const [birthMonth, setBirthMonth] = useState(user?.birthDate?.split("-")[1] ?? "");
  const [birthYear, setBirthYear] = useState(user?.birthDate?.split("-")[0] ?? "");
  const [busyPhoto, setBusyPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  if (!user) return null;

  const clean = name.trim();
  const birthLocked = !!user.birthDate;
  const birthComplete = !!(birthDay && birthMonth && birthYear);
  const birthTouched = !!(birthDay || birthMonth || birthYear);
  const birthChanged =
    !birthLocked &&
    birthComplete &&
    `${birthYear}-${birthMonth}-${birthDay}` !== (user.birthDate ?? "");
  const bioChanged = bio.trim() !== (user.bio ?? "");
  const changed =
    clean !== (user.username ?? "") || bioChanged || birthChanged;
  const yearNow = new Date().getFullYear();
  const daysInMonth = (() => {
    if (!birthMonth || !birthYear) return 31;
    return new Date(Number(birthYear), Number(birthMonth), 0).getDate();
  })();

  const pickPhoto = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f || busyPhoto) return;
    setBusyPhoto(true);
    setErr("");
    void (async () => {
      try {
        const small = await shrinkAvatar(f);
        await updateProfile({ image: small });
        toast.success("Foto profil diperbarui ✨");
      } catch (e2) {
        setErr(e2 instanceof Error ? e2.message : "Gagal mengganti foto");
      } finally {
        setBusyPhoto(false);
      }
    })();
  };

  const save = async () => {
    if (saving) return;
    if (clean.length < 3) {
      setErr("Username minimal 3 karakter");
      return;
    }
    if (birthTouched && !birthComplete) {
      setErr("Lengkapi tanggal, bulan, dan tahun lahir");
      return;
    }
    if (!changed) {
      onClose();
      return;
    }
    setSaving(true);
    setErr("");
    try {
      await updateProfile({
        username: clean !== (user.username ?? "") ? clean : undefined,
        bio: bioChanged ? bio.trim() : undefined,
        birthDate: birthChanged
          ? `${birthYear}-${birthMonth}-${birthDay}`
          : undefined,
      });
      toast.success("Profil diperbarui ✨");
      onClose();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Gagal menyimpan profil");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="screen-enter fixed inset-0 z-[95] flex flex-col bg-[#0b0e15]">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-end px-4 pt-[max(env(safe-area-inset-top),0.9rem)]">
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup"
          className="pointer-events-auto flex size-9 items-center justify-center rounded-full bg-white/[0.07] text-white/60 backdrop-blur transition hover:text-white"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-5 pb-10 pt-16">
          {/* Foto di atas, tombol ganti foto bulat kecil. */}
        <div className="mt-2 flex flex-col items-center">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busyPhoto}
            className="relative rounded-full transition active:scale-95 disabled:opacity-60"
            aria-label="Ganti foto profil"
          >
            <FramedAvatar
              border={user.avatarBorder}
              src={user.image}
              seed={user.username}
              className="size-[92px] rounded-full ring-2 ring-gold/35"
            />
            <span className="absolute bottom-0 right-0 flex size-8 items-center justify-center rounded-full border-2 border-[#121722] bg-gold text-black shadow-lg">
              <Pencil className="size-3.5" strokeWidth={2.4} />
            </span>
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busyPhoto}
            className="mt-2 rounded-full border border-white/15 bg-white/[0.05] px-3 py-1 text-[10px] font-black text-white/65 transition hover:text-white disabled:opacity-50"
          >
            {busyPhoto ? "Mengunggah…" : "Ganti foto"}
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={pickPhoto}
        />

        <label className="mt-4 block text-[9.5px] font-black uppercase tracking-[0.16em] text-white/40">
          Username
        </label>
        <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-white/15 bg-black/30 px-3 focus-within:border-gold/50">
          <User className="size-4 shrink-0 text-white/35" />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="username"
            maxLength={20}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent py-2.5 text-[13px] font-bold text-white outline-none placeholder:text-white/25"
          />
          <span className="shrink-0 text-[9px] font-semibold text-white/25">
            {clean.length}/20
          </span>
        </div>
        <p className="mt-1.5 text-[10px] leading-snug text-white/35">
          3–20 karakter, hanya huruf, angka, dan garis bawah (_).
        </p>

        <label className="mt-4 block text-[9.5px] font-black uppercase tracking-[0.16em] text-white/40">
          Bio
        </label>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value.slice(0, 160))}
          rows={3}
          placeholder="Edit bio mu..."
          className="mt-1.5 w-full resize-none rounded-xl border border-white/15 bg-black/30 px-3 py-2.5 text-[12px] leading-relaxed text-white outline-none placeholder:text-white/25 focus:border-gold/50"
        />
        <div className="mt-1 flex justify-end text-[9px] font-semibold text-white/25">
          {bio.length}/160
        </div>

        <label className="mt-4 flex items-center gap-1.5 text-[9.5px] font-black uppercase tracking-[0.16em] text-white/40">
          <Cake className="size-3.5 text-gold/80" />
          Tanggal lahir
        </label>
        {birthLocked ? (
          <div className="mt-1.5 flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
            <span className="text-[12px] font-bold text-white/75">
              {new Date(`${user.birthDate}T00:00:00`).toLocaleDateString("id-ID", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[8px] font-bold text-white/35">
              Terkunci
            </span>
          </div>
        ) : (
          <>
            <div className="mt-1.5 grid grid-cols-[1fr_1.4fr_1.15fr] gap-1.5">
              <label className="relative">
                <span className="sr-only">Hari</span>
                <select
                  value={birthDay}
                  onChange={(e) => setBirthDay(e.target.value)}
                  className="h-10 w-full appearance-none rounded-xl border border-white/15 bg-black/30 px-2 text-center text-[11px] font-bold text-white outline-none focus:border-gold/50"
                >
                  <option value="">Tgl</option>
                  {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={String(d).padStart(2, "0")}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
              <label className="relative">
                <span className="sr-only">Bulan</span>
                <select
                  value={birthMonth}
                  onChange={(e) => {
                    const next = e.target.value;
                    setBirthMonth(next);
                    const max = next
                      ? new Date(Number(birthYear || yearNow), Number(next), 0).getDate()
                      : 31;
                    if (Number(birthDay) > max) setBirthDay("");
                  }}
                  className="h-10 w-full appearance-none rounded-xl border border-white/15 bg-black/30 px-2 text-center text-[11px] font-bold text-white outline-none focus:border-gold/50"
                >
                  <option value="">Bulan</option>
                  {[
                    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
                    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
                  ].map((m, i) => (
                    <option key={m} value={String(i + 1).padStart(2, "0")}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
              <label className="relative">
                <span className="sr-only">Tahun</span>
                <select
                  value={birthYear}
                  onChange={(e) => {
                    const next = e.target.value;
                    setBirthYear(next);
                    const max = birthMonth
                      ? new Date(Number(next), Number(birthMonth), 0).getDate()
                      : 31;
                    if (Number(birthDay) > max) setBirthDay("");
                  }}
                  className="h-10 w-full appearance-none rounded-xl border border-white/15 bg-black/30 px-2 text-center text-[11px] font-bold text-white outline-none focus:border-gold/50"
                >
                  <option value="">Tahun</option>
                  {Array.from({ length: yearNow - 1899 }, (_, i) => yearNow - i).map((y) => (
                    <option key={y} value={String(y)}>
                      {y}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="mt-1.5 flex items-center gap-1 text-[9px] leading-snug text-amber-200/50">
              Tanggal lahir hanya bisa disimpan satu kali dan tidak bisa diubah.
            </p>
          </>
        )}

        {err && (
          <p className="mt-2.5 rounded-xl border border-red-500/30 bg-red-500/10 px-2.5 py-2 text-[10.5px] font-semibold text-red-300">
            {err}
          </p>
        )}

        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || busyPhoto || !changed || clean.length < 3}
          className="mt-4 w-full rounded-xl bg-gold py-2.5 text-[12px] font-black text-black transition active:scale-[0.99] disabled:opacity-40"
        >
          {saving ? "Menyimpan…" : "Simpan perubahan"}
        </button>
        </div>
      </div>
    </div>
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
    <div className="flex items-center gap-2.5 rounded-xl bg-white/[0.035] px-2.5 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-medium leading-tight">{label}</p>
        {desc && (
          <p className="mt-0.5 line-clamp-1 text-[10.5px] leading-tight text-muted-foreground">
            {desc}
          </p>
        )}
      </div>
      <button
        onClick={() => onToggle(!value)}
        aria-pressed={value}
        aria-label={label}
        className={cn(
          "relative h-5.5 w-10 shrink-0 rounded-full transition",
          value ? "bg-primary" : "bg-white/20",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-4.5 rounded-full bg-white shadow-sm transition-all",
            value ? "left-[19px]" : "left-0.5",
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
  { key: "hideBirthday", label: "Sembunyikan ulang tahun", desc: "Tanggal lahir tidak tampil di profil" },
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
const SETTINGS_TONES: Record<
  string,
  { card: string; chip: string; line: string }
> = {
  Nonton: {
    card: "border-sky-400/15 bg-gradient-to-br from-sky-400/[0.09] via-card to-card",
    chip: "bg-sky-400/15 text-sky-300",
    line: "bg-sky-400/60",
  },
  Notifikasi: {
    card: "border-amber-400/15 bg-gradient-to-br from-amber-400/[0.08] via-card to-card",
    chip: "bg-amber-400/15 text-amber-300",
    line: "bg-amber-400/60",
  },
  Tampilan: {
    card: "border-violet-400/15 bg-gradient-to-br from-violet-400/[0.08] via-card to-card",
    chip: "bg-violet-400/15 text-violet-300",
    line: "bg-violet-400/60",
  },
  Chat: {
    card: "border-rose-400/15 bg-gradient-to-br from-rose-400/[0.08] via-card to-card",
    chip: "bg-rose-400/15 text-rose-300",
    line: "bg-rose-400/60",
  },
  Privasi: {
    card: "border-emerald-400/15 bg-gradient-to-br from-emerald-400/[0.08] via-card to-card",
    chip: "bg-emerald-400/15 text-emerald-300",
    line: "bg-emerald-400/60",
  },
  "Unduhan & Kuota": {
    card: "border-cyan-400/15 bg-gradient-to-br from-cyan-400/[0.08] via-card to-card",
    chip: "bg-cyan-400/15 text-cyan-300",
    line: "bg-cyan-400/60",
  },
};

function SettingsBox({
  icon,
  title,
  desc,
  items,
  value,
  onToggle,
  compact = false,
  openAll = false,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  items: readonly PrefItem[];
  value: Record<string, boolean>;
  onToggle: (key: string) => void;
  /** Tampilan minimalis: hanya 3 toggle, tanpa tombol "lihat lainnya". */
  compact?: boolean;
  /** Sub-layar kategori menampilkan seluruh toggle sekaligus. */
  openAll?: boolean;
}) {
  const [open, setOpen] = useState(openAll);
  const tone = SETTINGS_TONES[title] ?? {
    card: "border-border bg-card",
    chip: "bg-primary/15 text-primary",
    line: "bg-primary/60",
  };
  const shown = compact ? items.slice(0, 3) : open ? items : items.slice(0, 3);
  const rest = compact ? 0 : items.length - shown.length;

  return (
    <div className={cn("overflow-hidden rounded-3xl border p-3", tone.card)}>
      <div className="flex items-center gap-2.5">
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", tone.chip)}>
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-black leading-tight">{title}</p>
          <p className="mt-0.5 text-[10.5px] leading-tight text-muted-foreground">{desc}</p>
        </div>
        <span aria-hidden className={cn("h-5 w-0.5 shrink-0 rounded-full opacity-70", tone.line)} />
      </div>
      <div className="mt-2.5 space-y-1.5">
        {shown.map((it) => (
          <ToggleRow
            key={it.key}
            label={it.label}
            desc={it.desc}
            value={!!value[it.key]}
            onToggle={() => onToggle(it.key)}
          />
        ))}
      </div>
      {(rest > 0 || open) && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-2 w-full rounded-lg py-1.5 text-[10.5px] font-bold text-white/45 transition hover:bg-white/[0.04] hover:text-white/75"
        >
          {open ? "Sembunyikan" : `Lihat ${rest} pengaturan lainnya`}
        </button>
      )}
    </div>
  );
}

/* ================================================== PENGATURAN MINIMAL ====
   3 bagian ringkas: Profil, Nonton, Notifikasi. Pengaturan lain tetap
   tersimpan, tapi tidak lagi memenuhi halaman. */

/** Kartu akun ringkas di Pengaturan: foto, username, level. Ketuk kartu →
 * detail akun; ikon pensil → layar penuh ubah profil. */
function SettingsAccountCard({
  user,
  onOpen,
  onEdit,
}: {
  user: any;
  onOpen: () => void;
  onEdit: () => void;
}) {
  const premium = !!user.unlimitedPremium || (user.premiumUntil ?? 0) > Date.now();
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="flex cursor-pointer items-center gap-3 rounded-3xl border border-white/10 bg-[linear-gradient(125deg,rgba(255,255,255,.065),rgba(28,167,236,.05)_58%,rgba(255,210,63,.04))] p-3 transition hover:border-white/20 active:scale-[0.995]"
    >
      <FramedAvatar
        border={user.avatarBorder}
        src={user.image}
        seed={user.username}
        className="size-14 shrink-0 rounded-full ring-1 ring-gold/30"
      />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <span
            className={cn(
              "truncate text-[15px] font-black leading-tight",
              usernameColor(user.username ?? "user"),
            )}
          >
            {user.username ?? "user"}
          </span>
          {premium && <BlueCheck className="size-3.5 shrink-0" />}
        </div>
        <div className="mt-1.5 flex items-center gap-1.5">
          <LevelBadge level={user.level ?? 1} className="origin-left scale-90" />
        </div>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onEdit();
        }}
        aria-label="Ubah foto dan username"
        className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/12 bg-white/[0.055] text-white/55 transition hover:border-gold/40 hover:text-gold active:scale-95"
      >
        <Pencil className="size-3.5" />
      </button>
    </div>
  );
}

function SettingsMinimal({
  onClose,
  onSignOut,
  onOpenCs,
  onOpenProfile,
}: {
  onClose: () => void;
  onSignOut: () => Promise<void>;
  onOpenCs: () => void;
  onOpenProfile: () => void;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);
  const [watchPrefs, setWatchPrefs] = useLocalPrefs("yn:prefs-watch", PREF_NONTON);
  const [notifPrefs, setNotifPrefs] = useLocalPrefs("yn:prefs-notif", PREF_NOTIF);

  if (!user) return null;

  const toggleWatch = (k: string) => {
    setWatchPrefs((p) => {
      const next = { ...p, [k]: !p[k] };
      if (k === "autoNext") {
        try {
          window.localStorage.setItem("yn:auto-next", next.autoNext ? "1" : "0");
        } catch {
          /* mode privat */
        }
      }
      return next;
    });
  };
  const toggleNotif = (k: string) =>
    setNotifPrefs((p) => ({ ...p, [k]: !p[k] }));

  return (
    <div className="space-y-2.5 pb-28 pt-3">
      <div className="flex items-center gap-2.5">
        <button
          onClick={onClose}
          aria-label="Kembali"
          className="flex shrink-0 items-center text-foreground/90 transition active:opacity-60"
        >
          <StripBackIcon />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-[19px] font-black tracking-tight">
          Pengaturan
        </h1>
      </div>

      <SettingsAccountCard
        user={user}
        onOpen={onOpenProfile}
        onEdit={() => setEditOpen(true)}
      />

      <SettingsBox
        compact
        icon={<Play className="size-[18px]" />}
        title="Nonton"
        desc="Player & pemutaran otomatis"
        items={PREF_NONTON}
        value={watchPrefs}
        onToggle={toggleWatch}
      />
      <SettingsBox
        compact
        icon={<Bell className="size-[18px]" />}
        title="Notifikasi"
        desc="Feed, episode, chat & clan"
        items={PREF_NOTIF}
        value={notifPrefs}
        onToggle={toggleNotif}
      />

      <div className="flex gap-2 pt-1">
        <button
          onClick={onOpenCs}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.045] py-2.5 text-[11px] font-black text-white/65"
        >
          <Headset className="size-4" /> CS
        </button>
        <button
          onClick={async () => {
            await onSignOut();
            navigate("/home");
          }}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 py-2.5 text-[11px] font-black text-red-300"
        >
          <LogOut className="size-4" /> Keluar
        </button>
      </div>

      {editOpen && <EditIdentitySheet onClose={() => setEditOpen(false)} />}
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
        <div className="sticky top-0 z-10 -mx-3 mb-3 flex items-center gap-1.5 border-b border-white/10 bg-background/95 px-3 py-3 backdrop-blur">
          <button
            onClick={onClose}
            aria-label="Kembali"
            className="flex shrink-0 items-center py-1 pr-1 text-foreground/90 transition active:opacity-60"
          >
            <StripBackIcon />
          </button>
          <h1 className="min-w-0 flex-1 truncate text-[16px] font-black text-white">
            {title}
          </h1>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="flex size-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white/55"
          >
            <X className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}