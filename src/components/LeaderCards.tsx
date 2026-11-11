import { useState } from "react";
import { useNavigate } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ClanTag, LevelBadge } from "@/components/lstream-ui";
import { FramedAvatar } from "@/components/FramedAvatar";
import { fmtShort } from "@/components/HomeHead";
import { DEFAULT_CLAN_ICON } from "@/lib/clanIcons";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  ChevronLeft,
  Crown,
  Gift,
  Sparkles,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { LeaderboardScreen } from "@/components/leaderboard/LeaderboardScreen";

type XpRow = {
  rank: number;
  userId?: string;
  username?: string;
  image?: string;
  xp?: number;
  level?: number;
  seqId?: number;
  clanTag?: string;
  clanTagIcon?: string;
  avatarBorder?: string;
};
type GiveRow = {
  userId?: string;
  username?: string;
  image?: string;
  days?: number;
  slots?: number;
  seqId?: number;
  level?: number;
  clanTag?: string;
  clanTagIcon?: string;
  xp?: number;
  avatarBorder?: string;
};
type ClanRow = {
  _id: string;
  name: string;
  tag: string;
  tagIcon?: string;
  level: number;
  levelProgress: number;
  levelCost: number;
  totalXp: number;
  diamonds: number;
  memberCount: number;
  avatarUrl?: string;
  leaderUsername: string;
  leaderImage?: string;
  leaderSeqId?: number;
  tagTier?: number;
  tagBg?: string;
};

function cleanTag(t?: string | null): string | null {
  if (!t) return null;
  const s = t.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (s.length < 2 || s.length > 6) return null;
  return s;
}

export type Period = "1" | "7" | "30";

const PERIODS: { key: Period; label: string; short: string; xpKey: string }[] = [
  { key: "1", label: "Setiap hari", short: "Setiap hari", xpKey: "harian" },
  { key: "7", label: "7 hari", short: "7D", xpKey: "mingguan" },
  { key: "30", label: "30 hari", short: "30D", xpKey: "bulanan" },
];

const periodLabel = (p: Period) =>
  PERIODS.find((x) => x.key === p)?.short ?? "Harian";
const xpKeyOf = (p: Period) =>
  PERIODS.find((x) => x.key === p)?.xpKey ?? "harian";

const TONE = {
  xp: {
    frame:
      "border-sky-300/25 bg-[linear-gradient(150deg,#111a2b_0%,#0b1220_55%,#070b13_100%)]",
    glow: "shadow-[0_32px_70px_-46px_rgba(28,167,236,.9)]",
    accent: "text-sky-200",
    pill: "border-sky-300/30 bg-sky-400/12 text-sky-100",
    active: "bg-sky-400/25 text-sky-100",
    orb: "bg-sky-400/18",
  },
  give: {
    frame:
      "border-amber-300/25 bg-[linear-gradient(150deg,#241b10_0%,#1a130b_55%,#0d0a06_100%)]",
    glow: "shadow-[0_32px_70px_-46px_rgba(255,210,63,.8)]",
    accent: "text-amber-200",
    pill: "border-amber-300/30 bg-amber-400/12 text-amber-100",
    active: "bg-amber-400/25 text-amber-100",
    orb: "bg-amber-400/18",
  },
  clan: {
    frame:
      "border-emerald-300/25 bg-[linear-gradient(150deg,#0f1f1b_0%,#0b1714_55%,#060d0b_100%)]",
    glow: "shadow-[0_32px_70px_-46px_rgba(52,211,153,.75)]",
    accent: "text-emerald-200",
    pill: "border-emerald-300/30 bg-emerald-400/12 text-emerald-100",
    active: "bg-emerald-400/25 text-emerald-100",
    orb: "bg-emerald-400/16",
  },
} as const;

const PARTICLES = [
  { x: -46, y: -44, s: 5, c: "#FFD23F", d: 0 },
  { x: 38, y: -52, s: 4, c: "#7FD3F7", d: 0.35 },
  { x: -62, y: -8, s: 4, c: "#FF8FA3", d: 0.7 },
  { x: 58, y: -16, s: 5, c: "#B9A7FF", d: 0.2 },
  { x: -28, y: -68, s: 3, c: "#9AF0C7", d: 1.1 },
  { x: 22, y: -76, s: 4, c: "#FFD23F", d: 0.55 },
  { x: -72, y: -34, s: 3, c: "#7FD3F7", d: 1.4 },
  { x: 70, y: -40, s: 3, c: "#FF8FA3", d: 0.9 },
  { x: -38, y: 30, s: 3, c: "#B9A7FF", d: 0.15 },
  { x: 44, y: 34, s: 4, c: "#9AF0C7", d: 0.8 },
  { x: 4, y: -60, s: 3, c: "#FFFFFF", d: 1.7 },
  { x: -86, y: 6, s: 2.5, c: "#FFD23F", d: 1.25 },
  { x: 84, y: 4, s: 2.5, c: "#7FD3F7", d: 0.45 },
  { x: -12, y: 48, s: 3, c: "#FF8FA3", d: 1.55 },
];

function ParticleBurst() {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 overflow-visible">
      <span className="absolute left-1/2 top-1/2 size-36 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,210,63,.22),rgba(127,211,247,.1)_45%,transparent_72%)] blur-[2px]" />
      {PARTICLES.map((p, i) => (
        <span
          key={i}
          className="lb-particle absolute left-1/2 top-1/2 rounded-full"
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
  );
}

function PodiumEntry({
  rank,
  image,
  border,
  username,
  level,
  clanLevel,
  clanTag,
  clanTagIcon,
  value,
  unit,
  center,
  onClick,
}: {
  rank: number;
  image?: string;
  border?: string;
  username?: string;
  level?: number;
  clanLevel?: number;
  clanTag?: string;
  clanTagIcon?: string;
  value: string;
  unit: string;
  center?: boolean;
  onClick?: () => void;
}) {
  const tag = cleanTag(clanTag);
  const stand = center
    ? "h-10 bg-[linear-gradient(180deg,#FFF0B0,#FFD23F_48%,#C98A13)] text-black/65"
    : rank === 2
      ? "h-7 bg-[linear-gradient(180deg,#E5EAF2,#AAB5C5_55%,#697586)] text-white"
      : "h-5 bg-[linear-gradient(180deg,#E8A273,#B9673D_58%,#794025)] text-white";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "group relative flex min-w-0 flex-1 flex-col items-center justify-end text-center transition active:scale-[0.98]",
        center ? "z-10" : "z-0",
      )}
    >
      <span className={cn("relative flex items-center justify-center", center ? "mb-2" : "mb-1.5")}>
        {rank === 1 && <ParticleBurst />}
        {rank === 1 && (
          <Crown
            className="absolute -top-5 left-1/2 z-20 size-6 -translate-x-1/2 text-gold-strong drop-shadow-[0_2px_8px_rgba(255,210,63,.7)]"
            fill="currentColor"
            aria-hidden
          />
        )}
        <FramedAvatar
          border={border}
          src={image}
          seed={username}
          className={cn(
            "relative z-10 shrink-0 rounded-full",
            center
              ? "size-[74px] ring-2 ring-gold-strong/80 shadow-[0_0_30px_-8px_rgba(255,210,63,.75)]"
              : rank === 2
                ? "size-[58px] ring-2 ring-white/35"
                : "size-[54px] ring-2 ring-[#E84855]/45",
          )}
        />
      </span>
      <span
        className={cn(
          "w-full truncate font-black leading-tight text-white",
          center ? "text-[13px]" : "text-[11.5px]",
        )}
      >
        {username?.trim() || "user"}
      </span>
      {level !== undefined && (
        <LevelBadge level={level} className="mt-0.5 origin-top scale-[0.78]" />
      )}
      {tag && (
        <span className={cn("mt-1", center ? "" : "scale-90")}>
          <ClanTag
            icon={clanTagIcon || DEFAULT_CLAN_ICON}
            tag={tag}
            level={clanLevel}
            className="shrink-0"
          />
        </span>
      )}
      <span
        className={cn(
          "mt-1.5 inline-flex min-w-[62px] max-w-full items-center justify-center gap-1 rounded-lg border px-2 py-1 font-display font-black leading-none",
          center
            ? "border-gold-strong/35 bg-gold-strong/12 text-[15px] text-[#FFE9A3]"
            : "border-white/12 bg-white/[0.06] text-[12px] text-white/85",
        )}
      >
        <span className="truncate">{value}</span>
        <span className="text-[8px] font-bold uppercase tracking-wider opacity-60">
          {unit}
        </span>
      </span>
      <span
        className={cn(
          "mt-1.5 flex w-full items-center justify-center rounded-t-[12px] border-t border-white/45 font-display text-[13px] font-black leading-none shadow-[inset_0_1px_0_rgba(255,255,255,.3)]",
          stand,
        )}
      >
        {rank}
      </span>
    </button>
  );
}

function Podium({
  entries,
  onOpen,
}: {
  entries: {
    rank: number;
    image?: string;
    border?: string;
    username?: string;
    level?: number;
    clanLevel?: number;
    clanTag?: string;
    clanTagIcon?: string;
    value: string;
    unit: string;
    userId?: string;
  }[];
  onOpen?: (id?: string) => void;
}) {
  const byRank = new Map(entries.map((e) => [e.rank, e]));
  const one = byRank.get(1);
  const two = byRank.get(2);
  const three = byRank.get(3);
  return (
    <div className="relative flex flex-1 items-end justify-between gap-2 px-1 pb-1">
      {two ? (
        <PodiumEntry
          {...two}
          onClick={onOpen ? () => onOpen(two.userId) : undefined}
        />
      ) : (
        <span className="min-w-0 flex-1" />
      )}
      {one ? (
        <PodiumEntry
          {...one}
          center
          onClick={onOpen ? () => onOpen(one.userId) : undefined}
        />
      ) : (
        <span className="min-w-0 flex-1" />
      )}
      {three ? (
        <PodiumEntry
          {...three}
          onClick={onOpen ? () => onOpen(three.userId) : undefined}
        />
      ) : (
        <span className="min-w-0 flex-1" />
      )}
    </div>
  );
}

function GrandPlace({
  entry,
  place,
  onOpen,
}: {
  entry?: {
    rank: number;
    image?: string;
    border?: string;
    username?: string;
    level?: number;
    clanLevel?: number;
    clanTag?: string;
    clanTagIcon?: string;
    value: string;
    unit: string;
    userId?: string;
  };
  place: 1 | 2 | 3;
  onOpen?: (id?: string) => void;
}) {
  if (!entry) return <div className="min-w-0 flex-1" />;
  const heights = { 1: 190, 2: 136, 3: 104 } as const;
  const skin =
    place === 1
      ? {
          front: "linear-gradient(180deg,#F7D77D 0%,#D6A331 38%,#8B5E13 100%)",
          top: "linear-gradient(90deg,#FFF1B8,#E9BE54)",
          side: "#7A4E0B",
          text: "text-[#3B2604]",
        }
      : place === 2
        ? {
            front: "linear-gradient(180deg,#DFE7F1 0%,#9EABBC 42%,#5B6677 100%)",
            top: "linear-gradient(90deg,#F2F6FA,#B8C3D1)",
            side: "#47515F",
            text: "text-white",
          }
        : {
            front: "linear-gradient(180deg,#E6A578 0%,#B8683E 44%,#6F3B24 100%)",
            top: "linear-gradient(90deg,#F3C6A6,#C98255)",
            side: "#5A2F1B",
            text: "text-white",
          };
  const tag = cleanTag(entry.clanTag);

  return (
    <button
      type="button"
      onClick={() => onOpen?.(entry.userId)}
      className={cn(
        "relative flex min-w-0 flex-1 flex-col items-center justify-end text-center transition active:scale-[0.99]",
        place === 1 && "z-20",
      )}
    >
      <span className="relative mb-2 flex flex-col items-center">
        {place === 1 && <ParticleBurst />}
        {place === 1 && (
          <Crown
            className="absolute -top-7 left-1/2 z-20 size-7 -translate-x-1/2 text-[#FFE58A] drop-shadow-[0_0_10px_rgba(255,210,63,.8)]"
            fill="currentColor"
            aria-hidden
          />
        )}
        <span className="relative">
          <span
            aria-hidden
            className={cn(
              "absolute inset-0 rounded-full blur-xl",
              place === 1 ? "bg-gold-strong/30" : "bg-white/10",
            )}
          />
          <FramedAvatar
            border={entry.border}
            src={entry.image}
            seed={entry.username}
            className={cn(
              "relative z-10 shrink-0 rounded-full ring-2",
              place === 1
                ? "size-24 ring-[#FFE58A]/80"
                : place === 2
                  ? "size-[78px] ring-white/40"
                  : "size-[72px] ring-[#E8A273]/50",
            )}
          />
        </span>
        <span className="mt-1.5 max-w-full truncate text-[12px] font-black leading-tight text-white">
          {entry.username?.trim() || "user"}
        </span>
        {entry.level !== undefined && (
          <LevelBadge level={entry.level} className="mt-0.5 origin-top scale-[0.76]" />
        )}
        {tag && (
          <ClanTag
            icon={entry.clanTagIcon || DEFAULT_CLAN_ICON}
            tag={tag}
            level={entry.clanLevel}
            className="mt-1 scale-90"
          />
        )}
        <span className="mt-1.5 rounded-md border border-white/18 bg-black/30 px-2 py-0.5 font-display text-[12px] font-black leading-none text-white/90 backdrop-blur-sm">
          {entry.value}
          <span className="ml-1 text-[7px] uppercase opacity-55">{entry.unit}</span>
        </span>
      </span>

      {/* Blok podium: tutup atas penuh + muka depan menyatu. Tidak ada
          sisi belakang, skew, atau celah yang bisa memperlihatkan latar. */}
      <div
        className="relative w-full"
        style={{ height: heights[place], filter: "drop-shadow(0 18px 20px rgba(0,0,0,.5))" }}
      >
        <div
          className="absolute inset-x-0 bottom-0 top-0 overflow-hidden rounded-t-[18px]"
          style={{ background: skin.front }}
        >
          <span className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,.22),transparent_34%,rgba(0,0,0,.24))]" />
          <span
            className={cn(
              "absolute inset-0 flex items-center justify-center font-display text-[86px] font-black leading-none opacity-[0.13]",
              skin.text,
            )}
          >
            {place}
          </span>
          <span className="absolute inset-x-3 top-2.5 h-px bg-white/35" />
        </div>
        {/* Tutup atas menutup penuh lingkar podium, tanpa sudut menggantung. */}
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-[13px] rounded-t-[18px]"
          style={{ background: skin.top }}
        />
        <span
          aria-hidden
          className="absolute inset-x-0 top-[13px] h-px bg-black/20"
        />
        <span
          className={cn(
            "absolute inset-x-0 bottom-2 text-center font-display text-[11px] font-black uppercase tracking-[0.22em] opacity-55",
            skin.text,
          )}
        >
          {place === 1 ? "Juara" : place === 2 ? "Runner up" : "Ketiga"}
        </span>
      </div>
    </button>
  );
}

function GrandPodium({
  entries,
  onOpen,
}: {
  entries: {
    rank: number;
    image?: string;
    border?: string;
    username?: string;
    level?: number;
    clanLevel?: number;
    clanTag?: string;
    clanTagIcon?: string;
    value: string;
    unit: string;
    userId?: string;
  }[];
  onOpen?: (id?: string) => void;
}) {
  const byRank = new Map(entries.map((e) => [e.rank, e]));
  return (
    <div className="relative flex h-full items-end justify-between gap-0 px-0 pb-1">
      <GrandPlace entry={byRank.get(2)} place={2} onOpen={onOpen} />
      <GrandPlace entry={byRank.get(1)} place={1} onOpen={onOpen} />
      <GrandPlace entry={byRank.get(3)} place={3} onOpen={onOpen} />
    </div>
  );
}

function PeriodTabs({
  period,
  onChange,
}: {
  period: Period;
  onChange: (p: Period) => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-full border border-white/10 bg-black/25 p-0.5">
      {PERIODS.map((p) => (
        <button
          key={p.key}
          type="button"
          onClick={() => onChange(p.key)}
          aria-pressed={period === p.key}
          className={cn(
            "rounded-full px-2.5 py-1 text-[9.5px] font-black transition",
            period === p.key
              ? "bg-white text-[#0b0d12] shadow-sm"
              : "text-white/45 hover:text-white/80",
          )}
        >
          {p.short}
        </button>
      ))}
    </div>
  );
}

function SeeAll({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-1 text-[10px] font-black text-white/55 transition hover:text-white active:scale-95"
    >
      Lihat semua
      <ArrowRight className="size-3.5" strokeWidth={2.4} aria-hidden />
    </button>
  );
}

function CardShell({
  tone,
  title,
  icon,
  right,
  children,
}: {
  tone: keyof typeof TONE;
  title: string;
  icon: React.ReactNode;
  right: React.ReactNode;
  children: React.ReactNode;
}) {
  const t = TONE[tone];
  return (
    <section
      className={cn(
        "relative flex h-[352px] w-full shrink-0 snap-center flex-col overflow-hidden rounded-[28px] border p-3.5",
        t.frame,
        t.glow,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute -right-16 -top-20 size-52 rounded-full blur-3xl",
          t.orb,
        )}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40 [background-image:radial-gradient(rgba(255,255,255,.055)_1px,transparent_1.2px)] [background-size:20px_20px]"
      />
      <div className="relative flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.18em]",
              t.accent,
            )}
          >
            {icon}
            {tone === "clan" ? "Clan" : "Leaderboard"}
          </span>
          <h3 className="mt-0.5 font-display text-[21px] font-black leading-none tracking-[-0.03em] text-white">
            {title}
          </h3>
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

function XpGiveCard({
  mode,
  onOpen,
}: {
  mode: "xp" | "give";
  onOpen: (period: Period) => void;
}) {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<Period>("1");
  const xpRows = useQuery(api.xp.leaderboard, {
    period: xpKeyOf(period),
    limit: 3,
  }) as XpRow[] | undefined;
  const giveRows = useQuery(api.account.topGive, {
    limit: 3,
    period,
  }) as GiveRow[] | undefined;

  const openProfile = (id?: string) => {
    if (!id) return;
    navigate(`/akun?user=${id}`);
  };

  const entries =
    mode === "xp"
      ? (xpRows ?? []).map((r) => ({
          rank: r.rank,
          userId: r.userId,
          image: r.image,
          border: r.avatarBorder,
          username: r.username,
          level: r.level,
          clanTag: r.clanTag,
          clanTagIcon: r.clanTagIcon,
          value: fmtShort(r.xp ?? 0),
          unit: "XP",
        }))
      : (giveRows ?? []).map((g, i) => ({
          rank: i + 1,
          userId: g.userId,
          image: g.image,
          border: g.avatarBorder,
          username: g.username,
          level: g.level,
          clanTag: g.clanTag,
          clanTagIcon: g.clanTagIcon,
          value: fmtShort(g.days ?? 0),
          unit: "hari",
        }));

  return (
    <CardShell
      tone={mode}
      title={mode === "xp" ? "Top XP" : "Top Give Premium"}
      icon={
        mode === "xp" ? (
          <Trophy className="size-3" aria-hidden />
        ) : (
          <Sparkles className="size-3" aria-hidden />
        )
      }
      right={<SeeAll onClick={() => onOpen(period)} />}
    >
      <div className="relative mt-2 flex items-center justify-between gap-2">
        <PeriodTabs period={period} onChange={setPeriod} />
        <span className="truncate text-[9px] font-bold uppercase tracking-[0.16em] text-white/30">
          {mode === "xp" ? "XP" : "Give"} · {periodLabel(period)}
        </span>
      </div>
      {entries.length > 0 ? (
        <Podium entries={entries} onOpen={openProfile} />
      ) : (
        <div className="relative flex flex-1 items-center justify-center">
          <p className="text-center text-[11px] font-semibold text-white/40">
            Belum ada data untuk periode ini.
          </p>
        </div>
      )}
    </CardShell>
  );
}

function ClanCard({ onOpen }: { onOpen: () => void }) {
  const rows = useQuery(api.clans.topClans, { limit: 3 }) as
    | ClanRow[]
    | undefined;
  const entries = (rows ?? []).map((c, i) => ({
    rank: i + 1,
    image: c.leaderImage ?? c.avatarUrl,
    border: undefined,
    username: c.leaderUsername,
    level: c.level,
    clanLevel: c.level,
    clanTag: c.tag,
    clanTagIcon: c.tagIcon,
    value: `Lv.${c.level}`,
    unit: "clan",
  }));

  return (
    <CardShell
      tone="clan"
      title="Top Leader Clan"
      icon={<Trophy className="size-3" aria-hidden />}
      right={<SeeAll onClick={onOpen} />}
    >
      <div className="relative mt-2 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/25 bg-emerald-400/10 px-2.5 py-1 text-[9.5px] font-black text-emerald-100">
          <Sparkles className="size-3" aria-hidden />
          Sepanjang masa
        </span>
        <span className="truncate text-[9px] font-bold uppercase tracking-[0.16em] text-white/30">
          Level · XP
        </span>
      </div>
      {entries.length > 0 ? (
        <Podium entries={entries} />
      ) : (
        <div className="relative flex flex-1 items-center justify-center">
          <p className="text-center text-[11px] font-semibold text-white/40">
            Belum ada clan. Jadilah yang pertama.
          </p>
        </div>
      )}
    </CardShell>
  );
}

function LeaderOverlay({
  mode,
  initialPeriod,
  onClose,
}: {
  mode: "xp" | "give";
  initialPeriod: Period;
  onClose: () => void;
}) {
  const [period, setPeriod] = useState<Period>(initialPeriod);
  const navigate = useNavigate();
  const openProfile = (id?: string) => {
    if (!id) return;
    onClose();
    navigate(`/akun?user=${id}`);
  };
  const xpRows = useQuery(api.xp.leaderboard, {
    period: xpKeyOf(period),
    limit: 50,
  }) as XpRow[] | undefined;
  const giveRows = useQuery(api.account.topGive, {
    limit: 50,
    period,
  }) as GiveRow[] | undefined;

  const byId = new Map<string, XpRow>();
  for (const r of xpRows ?? []) if (r.userId) byId.set(r.userId, r);
  const giveById = new Map<string, GiveRow>();
  for (const g of giveRows ?? []) if (g.userId) giveById.set(g.userId, g);

  type Entry = {
    rank: number;
    userId?: string;
    image?: string;
    border?: string;
    username?: string;
    level?: number;
    clanTag?: string;
    clanTagIcon?: string;
    xp?: number;
    days?: number;
  };

  const rows: Entry[] =
    mode === "xp"
      ? (xpRows ?? []).map((r) => ({
          rank: r.rank,
          userId: r.userId,
          image: r.image,
          border: r.avatarBorder,
          username: r.username,
          level: r.level,
          clanTag: r.clanTag,
          clanTagIcon: r.clanTagIcon,
          xp: r.xp ?? 0,
          days: giveById.get(r.userId ?? "")?.days ?? 0,
        }))
      : (giveRows ?? []).map((g, i) => {
          const p = byId.get(g.userId ?? "");
          return {
            rank: i + 1,
            userId: g.userId,
            image: g.image ?? p?.image,
            border: g.avatarBorder ?? p?.avatarBorder,
            username: g.username ?? p?.username,
            level: g.level ?? p?.level,
            clanTag: g.clanTag ?? p?.clanTag,
            clanTagIcon: g.clanTagIcon ?? p?.clanTagIcon,
            xp: g.xp ?? p?.xp ?? 0,
            days: g.days ?? 0,
          };
        });

  const top3 = rows.slice(0, 3);
  const rest = rows.slice(3, 50);
  const tone = TONE[mode];
  const podiumEntries = top3.map((r) => ({
    ...r,
    value: fmtShort(mode === "xp" ? r.xp ?? 0 : r.days ?? 0),
    unit: mode === "xp" ? "XP" : "hari",
  }));

  return (
    <div className="screen-enter fixed inset-0 z-[78] flex flex-col bg-[#07080d]">
      <header className="flex items-center gap-3 px-4 py-3">
        <button
          onClick={onClose}
          aria-label="Kembali"
          className="flex size-9 items-center justify-center text-white/85 transition active:scale-90"
        >
          <ChevronLeft className="size-5" />
        </button>
        <h2 className="yn-title min-w-0 flex-1 truncate text-xl text-white">
          {mode === "xp" ? "Top XP" : "Top Give Premium"}
        </h2>
        <button
          onClick={onClose}
          aria-label="Tutup"
          className="flex size-9 items-center justify-center text-white/70 transition active:scale-90"
        >
          <X className="size-4" />
        </button>
      </header>

      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-4 pb-6">
        <div className="mb-3 grid grid-cols-3 gap-1 rounded-2xl border border-white/12 bg-[#0d1017] p-1.5">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={cn(
                "rounded-xl px-2 py-2.5 text-[11.5px] font-black transition",
                period === p.key
                  ? "bg-gradient-to-b from-[#FFE58A] to-[#FFD23F] text-black shadow-[0_8px_20px_-14px_rgba(255,210,63,.9)]"
                  : "text-white/60 hover:bg-white/10 hover:text-white",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        <section className={cn("relative overflow-hidden rounded-3xl border p-3", tone.frame)}>
          <span className="pointer-events-none absolute inset-0 opacity-45 [background-size:22px_22px] [background-image:radial-gradient(rgba(255,255,255,.07)_1px,transparent_1.2px)]" />
          <div className="relative mb-2 flex items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em]",
                tone.pill,
              )}
            >
              {PERIODS.find((p) => p.key === period)?.label}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">
              {mode === "xp" ? "XP" : "Give"}
            </span>
          </div>
          <div className="relative mt-1 flex min-h-[402px] flex-col px-1 pb-1">
            {podiumEntries.length > 0 ? (
              <GrandPodium entries={podiumEntries} onOpen={openProfile} />
            ) : (
              <p className="flex flex-1 items-center justify-center py-8 text-center text-xs text-white/50">
                Belum ada data untuk periode ini.
              </p>
            )}
          </div>
        </section>

        {rest.length > 0 && (
          <>
            <div className="mt-5 flex items-baseline justify-between gap-2">
              <h3 className="yn-sec text-sm">Peringkat 4 - {rows.length}</h3>
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                {PERIODS.find((p) => p.key === period)?.label}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-1 gap-1.5">
              {rest.map((r) => (
                <GridRow
                  key={`${r.rank}-${r.username ?? r.rank}`}
                  rank={r.rank}
                  image={r.image}
                  border={r.border}
                  username={r.username}
                  level={r.level}
                  clanTag={r.clanTag}
                  clanTagIcon={r.clanTagIcon}
                  xp={r.xp}
                  days={r.days}
                  onOpen={() => openProfile(r.userId)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function GridRow({
  rank,
  image,
  border,
  username,
  level,
  clanTag,
  clanTagIcon,
  xp,
  days,
  onOpen,
}: {
  rank: number;
  image?: string;
  border?: string;
  username?: string;
  level?: number;
  clanTag?: string;
  clanTagIcon?: string;
  xp?: number;
  days?: number;
  onOpen?: () => void;
}) {
  const tag = cleanTag(clanTag);
  return (
    <div
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={onOpen}
      className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-3 transition hover:border-white/25 active:scale-[0.99]"
    >
      <span
        className={cn(
          "w-7 shrink-0 text-center font-display text-[15px] font-black leading-none",
          rank <= 3 ? "text-gold-strong" : "text-white/45",
        )}
      >
        {rank}
      </span>
      <FramedAvatar border={border} src={image} seed={username} className="size-12 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-[14px] font-black leading-tight text-white">
            {username ?? "user"}
          </span>
          {tag && (
            <ClanTag
              icon={clanTagIcon || DEFAULT_CLAN_ICON}
              tag={tag}
              className="shrink-0"
            />
          )}
        </span>
        <span className="mt-1 flex items-center gap-1">
          <LevelBadge level={level ?? 1} className="origin-left scale-90" />
        </span>
      </span>
      <span className="shrink-0 space-y-1 text-right">
        <span className="block rounded-lg bg-sky-400/12 px-2 py-1 text-[12px] font-black leading-none text-sky-200">
          {(xp ?? 0).toLocaleString("id-ID")}
          <span className="ml-0.5 text-[9px] font-bold text-sky-200/70">XP</span>
        </span>
        <span className="block rounded-lg bg-amber-400/12 px-2 py-1 text-[12px] font-black leading-none text-amber-200">
          {(days ?? 0).toLocaleString("id-ID")}
          <span className="ml-0.5 text-[9px] font-bold text-amber-200/70">give</span>
        </span>
      </span>
    </div>
  );
}

function ClanOverlay({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const rows = useQuery(api.clans.topClans, { limit: 5 }) as
    | ClanRow[]
    | undefined;
  return (
    <div className="screen-enter fixed inset-0 z-[78] flex flex-col bg-[#060d0b]">
      <header className="flex items-center gap-3 px-4 py-3">
        <button
          onClick={onClose}
          aria-label="Kembali"
          className="flex size-9 items-center justify-center text-white/85 transition active:scale-90"
        >
          <ChevronLeft className="size-5" />
        </button>
        <h2 className="yn-title min-w-0 flex-1 truncate text-xl text-white">
          Top Leader Clan
        </h2>
        <button
          onClick={onClose}
          aria-label="Tutup"
          className="flex size-9 items-center justify-center text-white/70 transition active:scale-90"
        >
          <X className="size-4" />
        </button>
      </header>
      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-4 pb-8">
        <p className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-200/70">
          Peringkat sepanjang masa · Level lalu XP
        </p>
        <div className="space-y-2">
          {(rows ?? []).map((c, i) => (
            <button
              key={c._id}
              onClick={() => {
                onClose();
                navigate("/clan");
              }}
              className={cn(
                "flex w-full items-center gap-3 rounded-3xl border p-3 text-left transition active:scale-[0.99]",
                i === 0
                  ? "border-gold-strong/35 bg-[linear-gradient(110deg,rgba(255,210,63,.12),rgba(255,255,255,.03))]"
                  : "border-white/10 bg-white/[0.045]",
              )}
            >
              <span
                className={cn(
                  "w-6 shrink-0 text-center font-display text-lg font-black",
                  i === 0 ? "text-gold-strong" : "text-white/45",
                )}
              >
                {i + 1}
              </span>
              <FramedAvatar
                src={c.leaderImage ?? c.avatarUrl}
                seed={c.name}
                className={cn(
                  "shrink-0",
                  i === 0 ? "size-14 ring-2 ring-gold-strong/60" : "size-12",
                )}
              />
              <span className="min-w-0 flex-1">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-[14px] font-black text-white">
                    {c.name}
                  </span>
                  {i === 0 && (
                    <Crown className="size-3.5 shrink-0 text-gold-strong" fill="currentColor" aria-hidden />
                  )}
                </span>
                <span className="mt-0.5 block truncate text-[10.5px] font-semibold text-white/45">
                  {c.leaderUsername}
                </span>
                <span className="mt-1 flex items-center gap-1.5">
                  <ClanTag
                    icon={c.tagIcon || DEFAULT_CLAN_ICON}
                    tag={c.tag}
                    level={c.level}
                    tier={c.tagTier}
                    bg={c.tagBg}
                  />
                  <span className="rounded-md bg-emerald-400/12 px-1.5 py-0.5 text-[9px] font-black text-emerald-200">
                    {c.memberCount} member
                  </span>
                </span>
              </span>
              <span className="shrink-0 space-y-1 text-right">
                <span className="block rounded-lg border border-emerald-300/25 bg-emerald-400/12 px-2 py-1 text-[12px] font-black leading-none text-emerald-100">
                  Lv.{c.level}
                </span>
                <span className="block rounded-lg border border-white/10 bg-white/[0.06] px-2 py-1 text-[11px] font-black leading-none text-white/75">
                  {fmtShort(c.totalXp)}
                  <span className="ml-0.5 text-[8px] font-bold text-white/40">XP</span>
                </span>
              </span>
            </button>
          ))}
          {rows !== undefined && rows.length === 0 && (
            <p className="py-10 text-center text-xs text-white/45">
              Belum ada clan. Buat clan pertama dari halaman Clan.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

type HomeBoard = "xp" | "clan" | "give";

const HOME_BOARDS: { key: HomeBoard; label: string }[] = [
  { key: "xp", label: "TOP LEADERBOARD XP" },
  { key: "clan", label: "TOP CLAN" },
  { key: "give", label: "TOP GIVE PREMIUM" },
];

/** Papan peringkat ringkas di Home: 5 besar kiri, 5 berikutnya kanan. */
export function LeaderCards() {
  const navigate = useNavigate();
  const [board, setBoard] = useState<HomeBoard>("xp");
  const [period, setPeriod] = useState<Period>("1");
  const [openBoard, setOpenBoard] = useState<HomeBoard | null>(null);
  const xpRows = useQuery(api.xp.leaderboard, {
    period: xpKeyOf(period),
    limit: 10,
  }) as XpRow[] | undefined;
  const giveRows = useQuery(api.account.topGive, {
    limit: 10,
    period,
  }) as GiveRow[] | undefined;
  const clanRows = useQuery(api.clans.topClans, { limit: 10 }) as
    | ClanRow[]
    | undefined;

  const rows: HomeBoardRow[] =
    board === "xp"
      ? (xpRows ?? []).map((r) => ({
          key: String(r.userId ?? r.rank),
          rank: r.rank,
          username: r.username,
          image: r.image,
          border: r.avatarBorder,
          level: r.level ?? 1,
          value: `${fmtShort(r.xp ?? 0)} XP`,
          onClick: () => setOpenBoard("xp"),
        }))
      : board === "give"
        ? (giveRows ?? []).map((r, i) => ({
            key: String(r.userId ?? i),
            rank: i + 1,
            username: r.username,
            image: r.image,
            border: r.avatarBorder,
            level: r.level ?? 1,
            value: `${r.days ?? 0} hari`,
            onClick: () => setOpenBoard("give"),
          }))
        : (clanRows ?? []).map((c, i) => ({
            key: c._id,
            rank: i + 1,
            username: c.name,
            image: c.avatarUrl ?? c.leaderImage,
            level: c.level,
            value: `${fmtShort(c.totalXp)} XP`,
            onClick: () => setOpenBoard("clan"),
          }));

  const left = rows.slice(0, 5);
  const right = rows.slice(5, 10);
  const activeIndex = HOME_BOARDS.findIndex((b) => b.key === board);
  const accent =
    board === "xp"
      ? "var(--ui-a, #8B5CF6)"
      : board === "give"
        ? "#FFD23F"
        : "#4ADE80";
  const panelBg =
    board === "xp"
      ? "linear-gradient(150deg, color-mix(in srgb, var(--ui-a) 20%, #15131d), #121019 68%)"
      : board === "give"
        ? "linear-gradient(150deg, rgba(255,210,63,.2), #17130b 68%)"
        : "linear-gradient(150deg, rgba(74,222,128,.2), #0b1510 68%)";

  return (
    <>
    <section
      className="fade-enter relative mt-2.5 overflow-hidden rounded-[22px] border border-white/10 p-3 pr-2.5"
      style={{ background: panelBg, borderColor: `color-mix(in srgb, ${accent} 35%, transparent)` }}
    >
      <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        {[Gift, Trophy, Sparkles, Users, Crown].map((Icon, i) => (
          <Icon
            key={i}
            className="board-rise absolute text-white"
            style={{
              left: `${8 + i * 20}%`,
              bottom: `${-10 + (i % 3) * 12}px`,
              width: 18 + (i % 3) * 9,
              height: 18 + (i % 3) * 9,
              opacity: 0.055,
              animationDelay: `${i * 0.7}s`,
            }}
          />
        ))}
      </span>
      {/* Indikator posisi papan — tiga garis kecil di kanan atas. */}
      <span
        aria-hidden
        className="absolute right-3 top-3 flex items-center gap-1"
      >
        {HOME_BOARDS.map((b, i) => (
          <span
            key={b.key}
            className={cn("h-[3px] rounded-full transition-all", i === activeIndex ? "w-4" : "w-1.5 bg-white/18")}
            style={i === activeIndex ? { background: accent } : undefined}
          />
        ))}
      </span>

      <div className="flex items-center justify-center gap-2 pr-8">
        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-xl text-black"
          style={{ background: accent }}
        >
          <Trophy className="size-[17px]" strokeWidth={2.6} />
        </span>
        <div className="thin-scroll flex min-w-0 flex-1 gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {HOME_BOARDS.map((b) => (
            <button
              key={b.key}
              type="button"
              onClick={() => setBoard(b.key)}
              className={cn(
                "shrink-0 rounded-lg px-1.5 py-1 text-[8px] font-black tracking-[0.02em] transition",
                board === b.key
                  ? "bg-white/[0.1] text-white"
                  : "text-white/38 hover:text-white/70",
              )}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-1.5">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setPeriod(p.key)}
            className={cn(
              "rounded-lg border py-1.5 text-[10px] font-black transition",
              period === p.key
                ? "border-transparent text-black"
                : "border-white/10 bg-white/[0.035] text-white/50",
            )}
            style={
              period === p.key
                ? { background: accent }
                : undefined
            }
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-0">
        <div className="min-w-0 pr-2">
          <HomeBoardColumn rows={left} accent={accent} />
        </div>
        <div className="relative min-w-0 pl-2">
          <span aria-hidden className="absolute inset-y-2 left-0 w-px bg-white/10" />
          <HomeBoardColumn rows={right} accent={accent} />
        </div>
      </div>

      <button
        type="button"
        onClick={() => setOpenBoard(board)}
        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-black/15 py-1.5 text-[9px] font-black uppercase tracking-[0.12em] text-white/45 transition hover:bg-black/25 hover:text-white/80"
      >
        Lihat semua peringkat <ArrowRight className="size-3" />
      </button>
    </section>
      {openBoard === "xp" && (
        <LeaderOverlay mode="xp" initialPeriod={period} onClose={() => setOpenBoard(null)} />
      )}
      {openBoard === "give" && (
        <LeaderOverlay mode="give" initialPeriod={period} onClose={() => setOpenBoard(null)} />
      )}
      {openBoard === "clan" && (
        <div className="fixed inset-0 z-[95] overflow-y-auto bg-[#08070c]">
          <LeaderboardScreen initialView="clan" onClose={() => setOpenBoard(null)} />
        </div>
      )}
    </>
  );
}

type HomeBoardRow = {
  key: string;
  rank: number;
  username?: string;
  image?: string;
  border?: string;
  value: string;
  level: number;
  onClick: () => void;
};

function HomeBoardColumn({ rows, accent }: { rows: HomeBoardRow[]; accent: string }) {
  if (rows.length === 0) return null;
  return (
    <div className="space-y-1">
      {rows.map((r) => (
        <button
          key={r.key}
          type="button"
          onClick={r.onClick}
          className="flex w-full min-w-0 items-center gap-1.5 rounded-xl px-1 py-1.5 text-left transition hover:bg-white/[0.045] active:scale-[0.99]"
        >
          <span className="w-4 shrink-0 text-[11px] font-black tabular-nums text-white/35">
            #{r.rank}
          </span>
          <FramedAvatar
            border={r.border}
            src={r.image}
            seed={r.username}
            className="size-7 shrink-0 rounded-full"
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[10.5px] font-black leading-tight text-white/88">
              {r.username?.trim() || "user"}
            </span>
            <span className="mt-0.5 block origin-left scale-[0.72]">
              <LevelBadge level={r.level} />
            </span>
          </span>
          <span className="shrink-0 text-[9px] font-black tabular-nums" style={{ color: accent }}>
            {r.value}
          </span>
        </button>
      ))}
    </div>
  );
}
