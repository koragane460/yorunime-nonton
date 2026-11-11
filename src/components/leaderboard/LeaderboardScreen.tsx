import { useState } from "react";
import { useNavigate } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Avatar, BlueCheck, ClanTag, LevelBadge, TitleBadge } from "@/components/lstream-ui";
import { DEFAULT_CLAN_ICON } from "@/lib/clanIcons";
import { Crown, Users, Gift, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type View = "xp" | "give" | "clan";

/* Tombol kembali: strip panah penuh (garis + kepala panah), TANPA
   background rounded — sesuai permintaan. */
function StripBack({ onClose }: { onClose: () => void }) {
  return (
    <button
      onClick={onClose}
      aria-label="Kembali"
      className="-ml-1 flex items-center py-1 pr-2 text-white/90 transition active:opacity-60"
    >
      <svg width="26" height="18" viewBox="0 0 26 18" fill="none" aria-hidden>
        <path
          d="M25 9H2M8 2 1.5 9 8 16"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

/* Menu PINDAH KE HALAMAN CATALOG (di luar layar, kayak Vote Waifu) —
   komponen ini hanya menyediakan daftar pilihannya. */
export const LB_MENU = [
  { key: "give", label: "Top Give Prem", Icon: Gift, iconCls: "text-rose-300" },
  { key: "clan", label: "Leaderboard Clan", Icon: Users, iconCls: "text-emerald-300" },
] as const;
export type LbMenuKey = (typeof LB_MENU)[number]["key"];

/* Angka peringkat ber-OUTLINE GERAK putus-putus: 1 emas, 2 abu, 3 coklat,
   sisanya abu. */
function dashedCls(rank: number) {
  if (rank === 1) return "text-yellow-400 ring-yellow-400";
  if (rank === 2) return "text-zinc-300 ring-zinc-300";
  if (rank === 3) return "text-amber-700 ring-amber-700";
  return "text-white/70 ring-white/30";
}

function DashedNum({ rank }: { rank: number }) {
  return (
    <span
      className={cn(
        "relative flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-black ring-1",
        dashedCls(rank),
      )}
    >
      <svg className="pointer-events-none absolute -inset-[2px]" viewBox="0 0 100 100" aria-hidden>
        <circle
          cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="8"
          strokeLinecap="round" pathLength={100} strokeDasharray="42 58" className="lb-dash-spin"
        />
      </svg>
      {rank}
    </span>
  );
}

/* Podium top 1-3 — gaya SAMA dengan podium Home yang sudah di-rework:
   kartu gelap keemasan + ornamen sudut, blok medal emas/perak/perunggu
   dengan angka rank besar di dasar blok. */
function Podium({
  rank, username, image, xp, value,
}: { rank: number; username?: string; image?: string; xp?: number; value?: string }) {
  // Blok podium: warna FLAT (emas / warm white / ember), tanpa gradasi.
  const grad =
    rank === 1
      ? "border-gold/60 bg-gold/85"
      : rank === 2
        ? "border-[#FFFAF0]/45 bg-[#FFFAF0]/15"
        : "border-[#E84855]/55 bg-[#E84855]/25";
  const ring =
    rank === 1 ? "ring-amber-300" : rank === 2 ? "ring-zinc-300" : "ring-amber-600";
  const h = rank === 1 ? "h-24" : rank === 2 ? "h-16" : "h-14";
  return (
    <div className="lb-rise flex min-w-0 flex-col items-center" style={{ animationDelay: `${rank * 70}ms` }}>
      <div className="relative">
        <Avatar src={image} seed={username} className={cn("relative size-10 ring-2", ring)} />
        <svg className="pointer-events-none absolute -inset-[4px] overflow-visible text-white/90" viewBox="0 0 100 100" aria-hidden>
          <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="6"
            strokeLinecap="round" pathLength={100} strokeDasharray="55 45" className="lb-dash-spin" />
        </svg>
        {rank === 1 && (
          <Crown className="absolute -top-3.5 left-1/2 size-4 -translate-x-1/2 text-yellow-300 drop-shadow" aria-hidden />
        )}
      </div>
      <p className="mt-1.5 w-full truncate text-center text-[10px] font-black leading-tight">{username ?? "user"}</p>
      <p className="text-[9px] leading-tight text-white/70">
        {value ?? `${(xp ?? 0).toLocaleString("id-ID")} XP`}
      </p>
      <div
        style={{
          // Bentuk PERISAI (lancip di bawah) — bukan kotak biasa.
          clipPath: "polygon(50% 0, 100% 12%, 100% 88%, 50% 100%, 0 88%, 0 12%)",
        }}
        className={cn("relative mt-1.5 flex w-full items-start justify-center overflow-hidden rounded-t-2xl border pb-4 pt-1.5 text-base font-black text-black", grad, h)}
      >
        {/* Angka rank besar semi-transparan di dasar blok — sama dengan Home */}
        <span aria-hidden className="absolute bottom-2.5 left-1/2 -translate-x-1/2 text-4xl font-black text-black/25">
          {rank}
        </span>
        <span className="relative">{rank}</span>
      </div>
    </div>
  );
}

function Row({
  rank, username, image, xp, suffix, staffRole, clanTag, clanTagIcon, clanNameColor, level, premium, seqId, givePremiumCount,
}: any) {
  // Top 4 ke bawah: TANPA kotak — hanya baris polos di atas latar.
  return (
    <div className="lb-rise flex w-full items-center gap-2 px-2.5 py-2 transition hover:bg-white/[0.05]"
      style={{ animationDelay: `${Math.min(rank, 16) * 40}ms` }}>
      <DashedNum rank={rank} />
      <Avatar src={image} seed={username} className="size-8 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-[13px] font-semibold">{username ?? "user"}</p>
          {premium && <BlueCheck className="size-3.5 shrink-0" />}
          <TitleBadge role={staffRole} compact />
          {clanTag && (
            <ClanTag icon={clanTagIcon ?? DEFAULT_CLAN_ICON} tag={clanTag} color={clanNameColor}
              level={level} className="shrink-0 scale-[0.65] px-1 py-0 text-[9px]" />
          )}
        </div>
        <p className="text-[11px] text-white/60">
          {suffix ? suffix : `${xp?.toLocaleString?.("id-ID") ?? xp} XP`}
          {level !== undefined && (
            <span className="ml-1.5 inline-flex">
              <LevelBadge level={level} className="scale-90" />
            </span>
          )}
          {seqId !== undefined && <span className="ml-1.5">#{seqId}</span>}
          {typeof givePremiumCount === "number" && givePremiumCount > 0 && (
            <span className="ml-1.5 text-yellow-300">★ {givePremiumCount} give</span>
          )}
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------ XP view ---- */
function XpView() {
  const [period, setPeriod] = useState("harian");
  const data = useQuery(api.xp.leaderboard, { period, limit: 100 });
  const [t1, t2, t3, ...rest] = data ?? [];
  return (
    <>
      {/* Tab periode: kotak rounded hijau muda agak ketus (LEBIH KECIL). */}
      <div className="mb-3 grid grid-cols-3 gap-1 rounded-2xl border border-white/10 bg-white/[0.04] p-1">
        {([
          ["harian", "Setiap hari"],
          ["mingguan", "7 Hari"],
          ["bulanan", "30 Hari"],
        ] as const).map(([p, label]) => (
          <button key={p} onClick={() => setPeriod(p)}
            className={cn(
              "rounded-xl py-2 text-[11px] font-black transition",
              period === p
                ? "bg-gold text-[#241c02]"
                : "text-white/55 hover:bg-white/10 hover:text-white",
            )}>
            {label}
          </button>
        ))}
      </div>
      {!data && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 items-end gap-2 px-2 pt-4">
            <div className="skeleton h-24 rounded-2xl" />
            <div className="skeleton h-32 rounded-2xl" />
            <div className="skeleton h-20 rounded-2xl" />
          </div>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2.5 px-1 py-1.5">
              <div className="skeleton size-9 rounded-full" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="skeleton h-3 w-2/5 rounded-full" />
                <div className="skeleton h-2 w-1/4 rounded-full" />
              </div>
              <div className="skeleton h-3 w-12 rounded-full" />
            </div>
          ))}
        </div>
      )}
      {data?.length === 0 && <p className="py-8 text-center text-sm text-white/50">Belum ada data XP periode ini</p>}
      {data && data.length > 0 && (
        <div className="relative mb-3 grid grid-cols-3 items-end gap-2 px-2 pb-3 pt-2">
          {t2 && <Podium {...t2} rank={2} />}
          {t1 && <Podium {...t1} rank={1} />}
          {t3 && <Podium {...t3} rank={3} />}
        </div>
      )}
      <div className="space-y-1.5">
        {rest.slice(0, 97).map((e: any) => (
          <Row key={`${e.rank}-${e.userId}`} rank={e.rank} username={e.username} image={e.image} xp={e.xp}
            level={e.level} staffRole={e.staffRole} clanTag={e.clanTag} clanTagIcon={e.clanTagIcon}
            clanNameColor={e.clanNameColor} premium={e.premium} seqId={e.seqId} />
        ))}
      </div>
    </>
  );
}

/* ------------------------------------------------------ Give view ---- */
function GiveView() {
  const data = useQuery(api.account.topGive, { limit: 50 });
  if (!data)
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2.5 rounded-2xl px-1 py-2">
            <div className="skeleton size-9 rounded-full" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="skeleton h-3 w-2/5 rounded-full" />
              <div className="skeleton h-2 w-1/3 rounded-full" />
            </div>
            <div className="skeleton h-3 w-12 rounded-full" />
          </div>
        ))}
      </div>
    );
  if (data.length === 0)
    return <p className="py-8 text-center text-sm text-white/50">Belum ada yang bagi premium — jadilah yang pertama!</p>;
  return (
    <div className="space-y-1.5">
      <p className="flex items-center gap-1.5 rounded-2xl border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-[11px] font-black text-rose-200">
        <Gift className="size-3.5" aria-hidden /> Paling royal bagi-bagi premium 🎁
      </p>
      {data.map((g: any, i) => (
        <Row key={`${i + 1}-${g.userId}`} rank={i + 1} username={g.username} image={g.image} xp={g.days}
          suffix={`${g.days} hari · ${g.slots} orang · ${g.sends}x kirim`} givePremiumCount={g.days} />
      ))}
    </div>
  );
}

/* ------------------------------------------------------ Clan view ---- */
function ClanView() {
  const navigate = useNavigate();
  const clans = useQuery(api.clans.listClans, {});
  const [period, setPeriod] = useState<"harian" | "mingguan" | "bulanan">("harian");
  const sorted = [...(clans ?? [])].sort((a: any, b: any) =>
    period === "harian"
      ? (b.diamonds ?? 0) - (a.diamonds ?? 0)
      : (b.totalXp ?? 0) - (a.totalXp ?? 0),
  );
  const shown = sorted.slice(0, 100);
  const [t1, t2, t3, ...rest] = shown;
  if (!clans)
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-3 items-end gap-2 px-2 pt-4">
          <div className="skeleton h-24 rounded-2xl" />
          <div className="skeleton h-32 rounded-2xl" />
          <div className="skeleton h-20 rounded-2xl" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2.5 px-1 py-1.5">
            <div className="skeleton size-8 rounded-full" />
            <div className="skeleton size-9 rounded-full" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="skeleton h-3 w-2/5 rounded-full" />
              <div className="skeleton h-2 w-1/4 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    );
  const meta = (c: any) =>
    `Lv.${c.level ?? 1} · ${c.memberCount ?? 0} member`;
  const score = (c: any) =>
    period === "harian"
      ? `${(c.diamonds ?? 0).toLocaleString("id-ID")} Sacret`
      : `${(c.totalXp ?? 0).toLocaleString("id-ID")} XP`;
  return (
    <>
      <div className="mb-3 grid grid-cols-3 gap-1 rounded-2xl border border-white/10 bg-white/[0.04] p-1">
        {([
          ["harian", "Setiap hari"],
          ["mingguan", "7 Hari"],
          ["bulanan", "30 Hari"],
        ] as const).map(([p, label]) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={cn(
              "rounded-xl py-2 text-[11px] font-black transition",
              period === p ? "bg-[#4ADE80] text-[#07210f]" : "text-white/55 hover:bg-white/10 hover:text-white",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {shown.length === 0 && <p className="py-8 text-center text-sm text-white/50">Belum ada clan</p>}
      {shown.length > 0 && (
        <div className="relative mb-3 grid grid-cols-3 items-end gap-2 px-2 pb-3 pt-2">
          {t2 && <Podium username={t2.name} image={t2.avatarUrl} value={`${meta(t2)} · ${score(t2)}`} rank={2} />}
          {t1 && <Podium username={t1.name} image={t1.avatarUrl} value={`${meta(t1)} · ${score(t1)}`} rank={1} />}
          {t3 && <Podium username={t3.name} image={t3.avatarUrl} value={`${meta(t3)} · ${score(t3)}`} rank={3} />}
        </div>
      )}
      <div className="space-y-1.5">
        {rest.map((c: any, i) => (
          <button key={c._id} type="button" onClick={() => navigate(`/clan?clan=${c._id}`)} className="block w-full text-left">
            <Row
              rank={i + 4}
              username={c.name}
              image={c.avatarUrl}
              xp={c.diamonds}
              suffix={`${meta(c)} · ${score(c)}`}
              clanTag={c.tag}
              clanTagIcon={c.tagIcon ?? DEFAULT_CLAN_ICON}
              clanNameColor={c.color}
            />
          </button>
        ))}
      </div>
    </>
  );
}

export function LeaderboardScreen({
  onClose,
  initialView,
}: {
  onClose: () => void;
  /** Tampilan awal — dipilih lewat titik tiga di halaman Catalog. */
  initialView?: View;
}) {
  const [view, setView] = useState<View>(initialView ?? "xp");
  const TABS = [
    { key: "xp" as const, label: "Top XP", Icon: Sparkles },
    { key: "give" as const, label: "Give Prem", Icon: Gift },
    { key: "clan" as const, label: "Clan", Icon: Users },
  ];
  return (
    <div className="screen-enter w-full pb-10 pt-2">
      <div className="w-full p-3">
        <div className="mb-3 mt-3 flex items-center gap-2">
          <StripBack onClose={onClose} />
          <h1 className="min-w-0 flex-1 truncate text-lg yn-title">
            Leaderboard
          </h1>
          <Crown className="size-5 shrink-0 text-yellow-300" aria-hidden />
        </div>

        {/* Tab tampilan: Top XP · Give Prem · Clan — ganti view langsung,
            tanpa harus balik ke halaman Catalog. */}
        <div className="mb-4 grid grid-cols-3 gap-1.5 rounded-2xl border border-white/10 bg-white/[0.04] p-1.5">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setView(t.key)}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-xl py-2 text-[11px] font-black transition",
                view === t.key
                  ? "bg-[#FFFAF0] text-[#241c02]"
                  : "text-white/55 hover:bg-white/10 hover:text-white/90",
              )}
            >
              <t.Icon className="size-3.5" aria-hidden />
              {t.label}
            </button>
          ))}
        </div>

        {view === "xp" && <XpView />}
        {view === "give" && <GiveView />}
        {view === "clan" && <ClanView />}
      </div>
    </div>
  );
}
