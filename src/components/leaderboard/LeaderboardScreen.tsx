import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useHideNavOnMount } from "@/components/AppLayout";
import { Avatar, BlueCheck, ClanTag, TitleBadge } from "@/components/lstream-ui";
import { DEFAULT_CLAN_ICON } from "@/lib/clanIcons";
import { Crown, Users, Gift, MoreHorizontal, Sparkles } from "lucide-react";
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

/* Titik tiga → kotak menu 2 item yang muncul SATU PER SATU (stagger). */
function OverflowMenu({
  onPick,
}: {
  onPick: (v: View) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Menu lainnya"
        className="flex size-9 items-center justify-center rounded-xl text-white/80 transition active:scale-90"
      >
        <MoreHorizontal className="size-5" />
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-30 w-44 overflow-hidden rounded-2xl border border-white/12 bg-neutral-900/95 shadow-2xl backdrop-blur-xl">
          <button
            onClick={() => { onPick("give"); setOpen(false); }}
            style={{ animationDelay: "0ms" }}
            className="lb-menu-item flex w-full items-center gap-2.5 px-3.5 py-3 text-left text-[13px] font-bold text-white/90 transition hover:bg-white/10"
          >
            <Gift className="size-4 text-rose-300" /> Top Give Prem
          </button>
          <button
            onClick={() => { onPick("clan"); setOpen(false); }}
            style={{ animationDelay: "90ms" }}
            className="lb-menu-item flex w-full items-center gap-2.5 px-3.5 py-3 text-left text-[13px] font-bold text-white/90 transition hover:bg-white/10"
          >
            <Users className="size-4 text-emerald-300" /> Leaderboard Clan
          </button>
        </div>
      )}
    </div>
  );
}

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
        "relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black ring-2",
        dashedCls(rank),
      )}
    >
      <svg className="pointer-events-none absolute -inset-[3px]" viewBox="0 0 100 100" aria-hidden>
        <circle
          cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="6"
          strokeLinecap="round" pathLength={100} strokeDasharray="42 58" className="lb-dash-spin"
        />
      </svg>
      {rank}
    </span>
  );
}

/* Podium top 1-3 dengan gradasi warna bagus. */
function Podium({
  rank, username, image, xp,
}: { rank: number; username?: string; image?: string; xp: number }) {
  const grad =
    rank === 1
      ? "from-yellow-300 via-amber-400 to-orange-500"
      : rank === 2
        ? "from-zinc-200 via-zinc-300 to-zinc-500"
        : "from-amber-500 via-amber-600 to-amber-800";
  const h = rank === 1 ? "h-24" : rank === 2 ? "h-20" : "h-16";
  return (
    <div className="lb-rise flex min-w-0 flex-col items-center" style={{ animationDelay: `${rank * 70}ms` }}>
      <div className="relative">
        <span aria-hidden className={cn("absolute -inset-1 rounded-full opacity-70 blur-md bg-gradient-to-br", grad)} />
        <Avatar src={image} seed={username} className="relative size-12 ring-2 ring-white/70" />
        <svg className="pointer-events-none absolute -inset-[4px] overflow-visible text-white/90" viewBox="0 0 100 100" aria-hidden>
          <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="6"
            strokeLinecap="round" pathLength={100} strokeDasharray="55 45" className="lb-dash-spin" />
        </svg>
        {rank === 1 && (
          <Crown className="absolute -top-3.5 left-1/2 size-4 -translate-x-1/2 text-yellow-300 drop-shadow" aria-hidden />
        )}
      </div>
      <p className="mt-1.5 w-full truncate text-center text-[11px] font-semibold leading-tight">{username ?? "user"}</p>
      <p className="text-[10px] leading-tight text-white/70">{xp.toLocaleString("id-ID")} XP</p>
      <div className={cn("mt-1.5 flex w-full items-start justify-center rounded-t-xl pt-1 text-lg font-black text-black bg-gradient-to-t", grad, h)}>
        {rank}
      </div>
    </div>
  );
}

function Row({
  rank, username, image, xp, suffix, staffRole, clanTag, clanTagIcon, clanNameColor, level, premium, seqId, givePremiumCount,
}: any) {
  return (
    <div className="lb-rise flex w-full items-center gap-3 rounded-xl px-2 py-1.5"
      style={{ animationDelay: `${Math.min(rank, 16) * 40}ms` }}>
      <DashedNum rank={rank} />
      <Avatar src={image} seed={username} className="size-9 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-semibold">{username ?? "user"}</p>
          {premium && <BlueCheck className="size-3.5 shrink-0" />}
          <TitleBadge role={staffRole} compact />
          {clanTag && (
            <ClanTag icon={clanTagIcon ?? DEFAULT_CLAN_ICON} tag={clanTag} color={clanNameColor}
              level={level} className="shrink-0 scale-[0.72] px-1 py-0 text-[9px]" />
          )}
        </div>
        <p className="text-xs text-white/60">
          {suffix ? suffix : `${xp?.toLocaleString?.("id-ID") ?? xp} XP`}
          {level !== undefined && <span className="ml-1.5">Lv.{level}</span>}
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
      {/* Tab periode: kotak rounded hijau muda agak ketus. */}
      <div className="mb-3 grid grid-cols-3 gap-1.5 rounded-2xl bg-emerald-500/15 p-1.5 ring-1 ring-emerald-400/20">
        {["harian", "mingguan", "bulanan"].map((p) => (
          <button key={p} onClick={() => setPeriod(p)}
            className={cn(
              "rounded-xl py-2 text-xs font-black capitalize transition",
              period === p ? "bg-emerald-400 text-emerald-950 shadow" : "text-emerald-100/80 hover:text-emerald-50",
            )}>
            {p}
          </button>
        ))}
      </div>
      {!data && <p className="py-8 text-center text-sm text-white/50">Memuat…</p>}
      {data?.length === 0 && <p className="py-8 text-center text-sm text-white/50">Belum ada data XP periode ini</p>}
      {data && data.length > 0 && (
        <div className="mb-3 rounded-2xl border border-white/12 bg-white/[0.05] p-3">
          <div className="grid grid-cols-3 items-end gap-2">
            {t2 && <Podium {...t2} rank={2} />}
            {t1 && <Podium {...t1} rank={1} />}
            {t3 && <Podium {...t3} rank={3} />}
          </div>
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
  if (!data) return <p className="py-8 text-center text-sm text-white/50">Memuat…</p>;
  if (data.length === 0)
    return <p className="py-8 text-center text-sm text-white/50">Belum ada yang bagi premium — jadilah yang pertama!</p>;
  return (
    <div className="space-y-1.5">
      {data.map((g: any, i) => (
        <Row key={`${i + 1}-${g.userId}`} rank={i + 1} username={g.username} image={g.image} xp={g.days}
          suffix={`${g.days} hari · ${g.slots} orang · ${g.sends}x kirim`} givePremiumCount={g.days} />
      ))}
    </div>
  );
}

/* ------------------------------------------------------ Clan view ---- */
function rankChipCls(i: number) {
  if (i < 3) return "bg-gradient-to-b from-amber-300 to-amber-500 text-black";
  if (i < 10) return "bg-gradient-to-b from-zinc-200 to-zinc-400 text-black";
  return "bg-white/10 text-zinc-300";
}

function ClanView() {
  const navigate = useNavigate();
  const clans = useQuery(api.clans.listClans, {});
  const shown = (clans ?? []).slice(0, 100);
  if (!clans) return <p className="py-8 text-center text-sm text-white/50">Memuat…</p>;
  return (
    <div className="space-y-2">
      {shown.length === 0 && <p className="py-8 text-center text-sm text-white/50">Belum ada clan</p>}
      {shown.map((c: any, i) => (
        <button key={c._id} onClick={() => navigate(`/clan?clan=${c._id}`)}
          className="lb-rise relative flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-left transition hover:bg-white/10"
          style={{ animationDelay: `${Math.min(i, 20) * 35}ms` }}>
          <span className={cn("flex h-8 min-w-8 items-center justify-center rounded-xl px-1.5 text-sm font-black ring-1 ring-white/40", rankChipCls(i))}>
            {i === 0 && <Crown className="mr-0.5 size-3.5" aria-hidden />}
            {i + 1}
          </span>
          <Avatar src={c.avatarUrl} seed={c.name} className="size-9 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-sm font-semibold">{c.name}</p>
              <ClanTag icon={c.tagIcon ?? DEFAULT_CLAN_ICON} tag={c.tag} color={c.color} level={c.level}
                className="shrink-0 scale-[0.72] px-1 py-0 text-[9px]" />
            </div>
            <p className="text-xs text-white/60">Lv.{c.level} · {c.memberCount} member</p>
          </div>
          <span className="flex shrink-0 items-center gap-1 text-xs font-black text-cyan-300">
            <Sparkles className="size-3.5" /> {(c.diamonds ?? 0).toLocaleString("id-ID")}
          </span>
        </button>
      ))}
    </div>
  );
}

export function LeaderboardScreen({ onClose }: { onClose: () => void }) {
  useHideNavOnMount();
  const [view, setView] = useState<View>("xp");
  const title = view === "xp" ? "" : view === "give" ? "" : "";
  return (
    <div className="screen-enter fixed inset-0 z-50 overflow-y-auto bg-background">
      <div className="w-full p-3">
        <div className="mb-3 mt-3 flex items-center gap-2">
          <StripBack onClose={onClose} />
          <div className="min-w-0 flex-1" />
          <OverflowMenu onPick={setView} />
        </div>
        <div className="mb-3 flex items-center gap-2">
          {view !== "xp" && (
            <button onClick={() => setView("xp")}
              className="rounded-full border border-white/15 px-3 py-1 text-xs font-bold text-white/70 transition hover:bg-white/10">
              ← XP
            </button>
          )}
          {title && <h1 className="text-base font-extrabold">{title}</h1>}
        </div>

        {view === "xp" && <XpView />}
        {view === "give" && <GiveView />}
        {view === "clan" && <ClanView />}
      </div>
    </div>
  );
}
