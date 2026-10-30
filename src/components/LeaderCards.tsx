import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { FramedAvatar } from "@/components/FramedAvatar";
import { fmtShort } from "@/components/HomeHead";
import { displayId } from "@/lib/lstream";
import { cn } from "@/lib/utils";
import { ChevronLeft, Crown, Sparkles, Trophy, X } from "lucide-react";

/* ====================================================================== *
 *  PAPAN PERINGKAT HOME
 *  Dua kartu LEBAR berdampingan (Top XP · Top Give) — ketuk untuk buka
 *  layar lengkap: tombol 7 hari / 30 hari / sepanjang masa + podium +
 *  grid peringkat 4-50.
 * ====================================================================== */

type XpRow = {
  rank: number;
  userId?: string;
  username?: string;
  image?: string;
  xp?: number;
  level?: number;
  seqId?: number;
  avatarBorder?: string;
};
type GiveRow = {
  userId?: string;
  username?: string;
  image?: string;
  days?: number;
  slots?: number;
  avatarBorder?: string;
};

export type Period = "7" | "30" | "all";

const PERIODS: { key: Period; label: string; xpKey: string }[] = [
  { key: "7", label: "7 hari", xpKey: "mingguan" },
  { key: "30", label: "30 hari", xpKey: "bulanan" },
  // Kunci yang tidak dikenal backend = total XP sepanjang masa.
  { key: "all", label: "Sepanjang masa", xpKey: "sepanjangmasa" },
];

const periodLabel = (p: Period) =>
  PERIODS.find((x) => x.key === p)?.label ?? "7 hari";
const xpKeyOf = (p: Period) =>
  PERIODS.find((x) => x.key === p)?.xpKey ?? "mingguan";

/** Latar berwarna per jenis papan (permintaan: background-nya dikasih warna). */
const TONE = {
  xp: {
    box: "border-sky-400/35 bg-[linear-gradient(155deg,rgba(56,189,248,.20),rgba(14,16,26,.92)_58%,rgba(10,11,18,.96)_100%)]",
    chip: "border-sky-300/40 bg-sky-400/15 text-sky-100",
    icon: "text-sky-200",
    bar: "from-sky-300 to-sky-500",
  },
  give: {
    box: "border-amber-300/40 bg-[linear-gradient(155deg,rgba(251,191,36,.22),rgba(26,19,8,.92)_58%,rgba(16,13,9,.96)_100%)]",
    chip: "border-amber-300/45 bg-amber-400/15 text-amber-100",
    icon: "text-amber-200",
    bar: "from-amber-300 to-orange-500",
  },
} as const;

/** Satu baris daftar (avatar · nama · nilai). */
function Row({
  rank,
  image,
  border,
  username,
  value,
  id,
}: {
  rank: number;
  image?: string;
  border?: string;
  username?: string;
  value: string;
  id?: number;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 py-1.5">
      <span
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-md text-[10px] font-black",
          rank <= 3
            ? "bg-gold-strong text-black"
            : "border border-white/15 bg-white/[0.07] text-white/70",
        )}
      >
        {rank}
      </span>
      <FramedAvatar
        border={border}
        src={image}
        seed={username}
        className="size-8 shrink-0"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] font-black leading-tight text-white">
          {username ?? "user"}
        </span>
        <span className="block truncate text-[10px] leading-tight text-white/50">
          {id ? `ID ${displayId(id)}` : "\u00a0"}
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block text-[12px] font-black leading-tight text-white">
          {value}
        </span>
      </span>
    </div>
  );
}

/** PODIUM 1 · 2 · 3 — dipakai di layar penuh. */
function Podium({
  rows,
  mode,
}: {
  rows: { rank: number; image?: string; avatarBorder?: string; username?: string; value: string }[];
  mode: "xp" | "give";
}) {
  const byRank = [rows[1], rows[0], rows[2]];
  const height = ["h-24", "h-32", "h-20"];
  return (
    <div className="relative grid grid-cols-3 items-end gap-2">
      {byRank.map((r, i) => {
        const rank = i === 1 ? 1 : i === 0 ? 2 : 3;
        return (
          <div key={rank} className="flex min-w-0 flex-col items-center">
            <div className="mb-2 flex h-16 items-end justify-center">
              <FramedAvatar
                border={r?.avatarBorder}
                src={r?.image}
                seed={r?.username}
                className={cn(
                  rank === 1 ? "size-14" : "size-11",
                  rank === 1 && "ring-2 ring-gold-strong/70",
                )}
              />
            </div>
            <div
              className={cn(
                "relative flex w-full min-w-0 flex-col items-center justify-start gap-0.5 overflow-hidden rounded-t-2xl border px-1.5 pb-5 pt-2.5 backdrop-blur-[2px]",
                height[i],
                rank === 1
                  ? "border-gold-strong/60 bg-[linear-gradient(to_top,#f59e0b_0%,rgba(245,158,11,.42)_45%,rgba(251,191,36,.10)_100%)]"
                  : rank === 2
                    ? "border-white/45 bg-[linear-gradient(to_top,#cbd5e1_0%,rgba(203,213,225,.30)_50%,rgba(255,255,255,.06)_100%)]"
                    : "border-orange-500/55 bg-[linear-gradient(to_top,#b45309_0%,rgba(180,83,9,.38)_50%,rgba(251,146,60,.08)_100%)]",
                )}
            >
              <span
                aria-hidden
                className="absolute bottom-1.5 left-1/2 -translate-x-1/2 text-4xl font-black text-black/25"
              >
                {rank}
              </span>
              <span className="relative w-full truncate px-0.5 text-center text-[10px] font-black leading-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,.7)]">
                {r?.username ?? "-"}
              </span>
              <span
                className={cn(
                  "relative w-full truncate px-0.5 text-center text-[10px] font-black leading-tight drop-shadow-[0_1px_2px_rgba(0,0,0,.6)]",
                  rank === 2 ? "text-zinc-900" : "text-amber-50",
                )}
              >
                {r?.value ?? "-"}
              </span>
            </div>
            <span className="mt-1 text-[10px] font-black uppercase tracking-widest text-white/45">
              {mode === "xp" ? "XP" : "Give"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Layar penuh: periode + podium + grid 4-50. */
function LeaderOverlay({
  mode,
  onClose,
}: {
  mode: "xp" | "give";
  onClose: () => void;
}) {
  const [period, setPeriod] = useState<Period>("7");
  const xpRows = useQuery(api.xp.leaderboard, {
    period: xpKeyOf(period),
    limit: 50,
  }) as XpRow[] | undefined;
  const giveRows = useQuery(api.account.topGive, {
    limit: 50,
    period,
  }) as GiveRow[] | undefined;

  const rows =
    mode === "xp"
      ? (xpRows ?? []).map((r) => ({
          rank: r.rank,
          image: r.image,
          avatarBorder: r.avatarBorder,
          username: r.username,
          id: r.seqId,
          value: `${(r.xp ?? 0).toLocaleString("id-ID")} XP`,
        }))
      : (giveRows ?? []).map((g, i) => ({
          rank: i + 1,
          image: g.image,
          avatarBorder: g.avatarBorder,
          username: g.username,
          id: undefined,
          value: `${(g.days ?? 0).toLocaleString("id-ID")} hari`,
        }));

  const top3 = rows.slice(0, 3);
  const rest = rows.slice(3, 50);
  const tone = TONE[mode];

  return (
    <div className="screen-enter fixed inset-0 z-[78] flex flex-col bg-[#07080d]">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
        <button
          onClick={onClose}
          aria-label="Kembali"
          className="flex size-9 items-center justify-center rounded-full border border-white/12 bg-white/[0.06] text-white/80 transition active:scale-95"
        >
          <ChevronLeft className="size-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="yn-eyebrow text-[9px]">Papan peringkat</p>
          <h2 className="yn-title truncate text-xl text-white">
            {mode === "xp" ? "Top XP" : "Top Give Premium"}
          </h2>
        </div>
        <button
          onClick={onClose}
          aria-label="Tutup"
          className="flex size-9 items-center justify-center rounded-full border border-white/12 bg-white/[0.06] text-white/70 transition active:scale-95"
        >
          <X className="size-4" />
        </button>
      </header>

      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {/* Tombol periode */}
        <div className={cn("grid grid-cols-3 gap-1.5 rounded-2xl border p-1.5", tone.chip)}>
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={cn(
                "rounded-xl px-2 py-2 text-[11px] font-black transition",
                period === p.key
                  ? "bg-white text-black shadow-[0_8px_20px_-14px_rgba(0,0,0,.9)]"
                  : "text-white/75 hover:bg-white/10",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        <p className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-white/55">
          {mode === "xp" ? (
            <Sparkles className={cn("size-3.5", tone.icon)} />
          ) : (
            <Crown className={cn("size-3.5", tone.icon)} />
          )}
          {rows.length > 0
            ? `${rows.length} papan · periode ${periodLabel(period)}`
            : `Memuat periode ${periodLabel(period)}…`}
        </p>

        {/* Podium */}
        <div className="relative mt-3 overflow-hidden rounded-3xl border border-white/12 bg-white/[0.04] p-3.5">
          <span
            aria-hidden
            className={cn(
              "absolute inset-x-0 top-0 h-1 bg-gradient-to-r to-transparent",
              tone.bar,
            )}
          />
          <span
            aria-hidden
            className="absolute inset-0 opacity-50 [background-size:24px_24px] [background-image:radial-gradient(rgba(255,255,255,.06)_1px,transparent_1.2px)]"
          />
          <div className="relative">
            {top3.length > 0 ? (
              <Podium rows={top3} mode={mode} />
            ) : (
              <p className="py-8 text-center text-xs text-white/50">
                Belum ada data untuk periode ini.
              </p>
            )}
          </div>
        </div>

        {/* Grid peringkat 4-50 */}
        {rest.length > 0 && (
          <>
            <div className="mt-5 flex items-center gap-2">
              <h3 className="yn-sec text-sm">Peringkat 4 - {rows.length}</h3>
              <span className="ml-auto text-[10px] font-bold uppercase tracking-widest text-white/40">
                {periodLabel(period)}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {rest.map((r) => (
                <div
                  key={`${r.rank}-${r.username ?? r.rank}`}
                  className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 transition hover:border-white/25"
                >
                  <span className="w-6 shrink-0 text-center text-[12px] font-black text-white/55">
                    {r.rank}
                  </span>
                  <FramedAvatar
                    border={r.avatarBorder}
                    src={r.image}
                    seed={r.username}
                    className="size-8 shrink-0"
                  />
                  <span className="min-w-0 flex-1 py-1.5">
                    <span className="block truncate text-[12px] font-black leading-tight text-white">
                      {r.username ?? "user"}
                    </span>
                    <span className="block truncate text-[10px] leading-tight text-white/45">
                      {r.id ? `ID ${displayId(r.id)}` : mode === "xp" ? "XP" : "Give"}
                    </span>
                  </span>
                  <span className="shrink-0 text-[12px] font-black text-gold-strong">
                    {r.value}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * DUA KARTU PAPAN PERINGKAT — persegi memanjang ke samping, berdampingan.
 * Kiri kartu = teks (judul + keterangan), kanan kartu = Top 1-3 (foto,
 * username, XP/hari). Latar tiap kartu berwarna. Ketuk → layar penuh.
 */
export function LeaderCards() {
  const [open, setOpen] = useState<null | "xp" | "give">(null);

  const xpRows = useQuery(api.xp.leaderboard, {
    period: "mingguan",
    limit: 3,
  }) as XpRow[] | undefined;
  const giveRows = useQuery(api.account.topGive, {
    limit: 3,
    period: "7",
  }) as GiveRow[] | undefined;

  const xpTop = (xpRows ?? []).slice(0, 3).map((r, i) => ({
    rank: i + 1,
    image: r.image,
    avatarBorder: r.avatarBorder,
    username: r.username,
    id: r.seqId,
    value: fmtShort(r.xp ?? 0),
  }));
  const giveTop = (giveRows ?? []).slice(0, 3).map((g, i) => ({
    rank: i + 1,
    image: g.image,
    avatarBorder: g.avatarBorder,
    username: g.username,
    id: undefined,
    value: `${fmtShort(g.days ?? 0)} hr`,
  }));

  const card = (mode: "xp" | "give") => {
    const tone = TONE[mode];
    const list = mode === "xp" ? xpTop : giveTop;
    return (
      <button
        key={mode}
        onClick={() => setOpen(mode)}
        className={cn(
          "relative w-[86%] shrink-0 snap-center overflow-hidden rounded-[26px] border p-4 text-left shadow-[0_28px_56px_-40px_rgba(0,0,0,1)] transition hover:brightness-110 active:scale-[0.99] sm:w-[58%] lg:w-[42%]",
          tone.box,
        )}
      >
        <span
          aria-hidden
          className="absolute inset-0 opacity-45 [background-size:22px_22px] [background-image:radial-gradient(rgba(255,255,255,.07)_1px,transparent_1.2px)]"
        />
        <span className="relative grid grid-cols-[1fr_auto] items-start gap-3">
          {/* KIRI: teks */}
          <span className="min-w-0">
            <span className="yn-eyebrow flex items-center gap-1.5">
              <Trophy className={cn("size-3", tone.icon)} />
              Papan peringkat
            </span>
            <span className="mt-1.5 block font-display text-[26px] font-black leading-[0.95] tracking-[-0.03em] text-white">
              {mode === "xp" ? (
                <>
                  Top <span className="text-sky-200">XP</span>
                </>
              ) : (
                <>
                  Top Give <span className="text-amber-200">Prem</span>
                </>
              )}
            </span>
            <span className="mt-1.5 block max-w-[15ch] text-[11px] leading-snug text-white/70">
              {mode === "xp"
                ? "Siapa paling rajin menonton & naik level minggu ini"
                : "Donatur hari premium terbanyak untuk teman-teman"}
            </span>
            <span
              className={cn(
                "mt-2.5 inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black",
                tone.chip,
              )}
            >
              7 hari terakhir
            </span>
            <span className="mt-3 flex items-center gap-1 text-[11px] font-black text-white/85">
              Ketuk untuk buka <ChevronLeft className="size-3.5 rotate-180" />
            </span>
          </span>

          {/* KANAN: Top 1-3 */}
          <span className="w-[148px] shrink-0 rounded-2xl border border-white/12 bg-black/35 px-2.5 py-1.5 backdrop-blur-sm">
            <span className="block border-b border-white/10 pb-1 text-[9px] font-black uppercase tracking-widest text-white/50">
              Top 3
            </span>
            {(list.length
              ? list
              : [{ rank: 1, image: undefined, avatarBorder: undefined, username: "-", id: undefined, value: "-" }]
            ).map((r) => (
              <Row
                key={`${mode}-${r.rank}`}
                rank={r.rank}
                image={r.image}
                border={r.avatarBorder}
                username={r.username}
                value={r.value}
                id={r.id}
              />
            ))}
          </span>
        </span>
      </button>
    );
  };

  return (
    <>
      <section className="fade-enter mt-5">
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <h2 className="yn-sec text-lg">Papan Peringkat</h2>
          <span className="yn-eyebrow text-[9px]">Top XP &amp; Top Give</span>
        </div>
        <div className="thin-scroll -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1">
          {card("xp")}
          {card("give")}
        </div>
      </section>
      {open && <LeaderOverlay mode={open} onClose={() => setOpen(null)} />}
    </>
  );
}
