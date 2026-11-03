import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ClanTag } from "@/components/lstream-ui";
import { FramedAvatar } from "@/components/FramedAvatar";
import { fmtShort } from "@/components/HomeHead";
import { DEFAULT_CLAN_ICON } from "@/lib/clanIcons";
import { cn } from "@/lib/utils";
import { ChevronLeft, Crown, Trophy, X } from "lucide-react";

/* ====================================================================== *
 *  PAPAN PERINGKAT HOME
 *  Dua kartu LEBAR & MENYAMPING (Top XP · Top Give) — ketuk untuk buka
 *  layar lengkap: periode 7/30/sepanjang masa, Top 1-3 (foto besar +
 *  hiasan per peringkat), lalu grid 4-50 lengkap.
 * ====================================================================== */

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

/**
 * Tag clan SAH — harus benar-benar tag asli dari clan (bukan teks kosong,
 * bukan "[]", bukan "-"), di-normalize: hanya huruf/angka, panjang 2-6.
 * Kalau tag tidak valid, TIDAK ditampilkan (lebih baik kosong daripada
 * menampilkan "[]" yang jelek).
 */
function cleanTag(t?: string | null): string | null {
  if (!t) return null;
  const s = t.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (s.length < 2 || s.length > 6) return null;
  return s;
}

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
    box: "border-[#1CA7EC]/35 bg-card",
    chip: "border-sky-300/40 bg-sky-400/15 text-sky-100",
    icon: "text-sky-200",
  },
  give: {
    box: "border-[#FFD23F]/40 bg-card",
    chip: "border-amber-300/45 bg-amber-400/15 text-amber-100",
    icon: "text-amber-200",
  },
} as const;

/** Hiasan/EFEK per peringkat — warnanya menempel DI KOTAK orangnya. */
const RANK = {
  1: {
    card: "border-gold-strong/70 bg-card",
    ring: "ring-2 ring-gold-strong/80",
    text: "text-[#FFFAF0]",
    badge: "bg-gold-strong text-[#241c02]",
    glow: "",
  },
  2: {
    card: "border-[#FFFAF0]/40 bg-card",
    ring: "ring-2 ring-[#FFFAF0]/70",
    text: "text-[#FFFAF0]",
    badge: "bg-[#FFFAF0] text-[#241c02]",
    glow: "",
  },
  3: {
    card: "border-[#E84855]/55 bg-card",
    ring: "ring-2 ring-[#E84855]/70",
    text: "text-[#FFFAF0]",
    badge: "bg-[#E84855] text-[#FFFAF0]",
    glow: "",
  },
} as const;

/** Satu kolom Top 1-3 di kartu Home: foto → username → total. */
function TopCell({
  rank,
  image,
  border,
  username,
  value,
  label,
}: {
  rank: number;
  image?: string;
  border?: string;
  username?: string;
  value: string;
  label: string;
}) {
  const r = RANK[rank as 1 | 2 | 3] ?? RANK[3];
  return (
    <span
      className={cn(
        "relative flex min-w-0 flex-col items-center gap-1 rounded-2xl border px-1 py-2",
        r.card,
        r.glow,
      )}
    >
      <span
        className={cn(
          "absolute -top-1.5 left-1/2 flex h-4 min-w-4 -translate-x-1/2 items-center justify-center rounded-full px-1 text-[9px] font-black leading-none",
          r.badge,
        )}
      >
        {rank}
      </span>
      <FramedAvatar
        border={border}
        src={image}
        seed={username}
        className={cn("size-11 shrink-0", r.ring)}
      />
      <span className="w-full truncate px-0.5 text-center text-[10px] font-black leading-tight text-white">
        {username ?? "-"}
      </span>
      {/* Angka total diposisikan RAPI di bawah nama (permintaan: posisi
          angkanya dibenerin) — angka besar + label kecil di bawahnya. */}
      <span className="mt-0.5 w-full rounded-lg bg-black/35 px-1 py-1 text-center leading-none">
        <span className="block truncate font-display text-[13px] font-black tracking-tight text-white">
          {value}
        </span>
        <span className="mt-0.5 block text-[8px] font-bold uppercase tracking-wider text-white/55">
          {label}
        </span>
      </span>
    </span>
  );
}

/**
 * Baris grid 4-50 (permintaan: AGAK GEDE). Isi: peringkat · foto ·
 * username + tag clan (tag SAH) + level · total XP · total give.
 * "ID" sudah diganti LEVEL, dan "Total XP" / "Total Give" dibungkus
 * kotak rounded biar kelihatan rapi.
 */
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
}) {
  const tag = cleanTag(clanTag);
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-3 transition hover:border-white/25">
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
          <span className="inline-flex items-center gap-1 rounded-md bg-sky-400/15 px-1.5 py-0.5 text-[10px] font-black leading-none text-sky-200">
            <Crown className="size-2.5" aria-hidden />
            Lv.{level ?? 1}
          </span>
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

/**
 * Layar penuh papan peringkat.
 * - Tidak ada podium, tidak ada tulisan "N papan · periode …" di luar kotak:
 *   periode ditulis DI KOTAK kiri atas ("PERIODE 7 HARI").
 * - Top 1-3: foto agak besar + hiasan per peringkat, username, total XP
 *   dan total give premium.
 * - Grid 4-50: foto, username, ID, tag clan, total XP, total give.
 */
function LeaderOverlay({ mode, onClose }: { mode: "xp" | "give"; onClose: () => void }) {
  const [period, setPeriod] = useState<Period>("7");
  const xpRows = useQuery(api.xp.leaderboard, {
    period: xpKeyOf(period),
    limit: 50,
  }) as XpRow[] | undefined;
  const giveRows = useQuery(api.account.topGive, {
    limit: 50,
    period,
  }) as GiveRow[] | undefined;

  // Peta bantu: semua data profil dipakai kedua papan (XP & give saling
  // melengkapi — tiap baris selalu punya XP, give, ID, dan tag clan).
  const byId = new Map<string, XpRow>();
  for (const r of xpRows ?? []) if (r.userId) byId.set(r.userId, r);
  const giveById = new Map<string, GiveRow>();
  for (const g of giveRows ?? []) if (g.userId) giveById.set(g.userId, g);

  type Entry = {
    rank: number;
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
        {/* SATU KOTAK besar berisi semuanya. */}
        <section className={cn("relative overflow-hidden rounded-3xl border p-3", tone.box)}>
          <span
            aria-hidden
            className="absolute inset-0 opacity-45 [background-size:22px_22px] [background-image:radial-gradient(rgba(255,255,255,.07)_1px,transparent_1.2px)]"
          />

          {/* KIRI ATAS DALAM KOTAK — label periode (mengganti "N papan"). */}
          <div className="relative mb-3 flex items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em]",
                tone.chip,
              )}
            >
              Periode {periodLabel(period)}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/45">
              {mode === "xp" ? "XP" : "Give"}
            </span>
          </div>

          {/* Tombol periode */}
          <div className="relative grid grid-cols-3 gap-1.5 rounded-2xl border border-white/12 bg-black/35 p-1.5">
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

          {/* TOP 1-3 — foto agak besar + hiasan masing-masing, DI DALAM kotak
              berwarna (bukan pinggiran). */}
          <div className="relative mt-3 grid grid-cols-3 gap-2">
            {top3.length > 0 ? (
              top3.map((r) => {
                const rk = RANK[r.rank as 1 | 2 | 3] ?? RANK[3];
                return (
                  <div
                    key={`${r.rank}-${r.username ?? r.rank}`}
                    className={cn(
                      "relative flex min-w-0 flex-col items-center gap-1 rounded-2xl border px-1.5 py-3",
                      rk.card,
                      rk.glow,
                    )}
                  >
                    <span
                      className={cn(
                        "absolute -top-2 left-1/2 flex h-5 min-w-5 -translate-x-1/2 items-center justify-center rounded-full px-1.5 text-[10px] font-black leading-none",
                        rk.badge,
                      )}
                    >
                      {r.rank}
                    </span>
                    <FramedAvatar
                      border={r.border}
                      src={r.image}
                      seed={r.username}
                      className={cn("size-16 shrink-0", rk.ring)}
                    />
                    <span className="mt-1 w-full truncate text-center text-[12px] font-black leading-tight text-white">
                      {r.username?.trim() || "user"}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-black/40 px-1.5 py-0.5 text-[9px] font-black leading-none text-white/70">
                      <Crown className="size-2.5" aria-hidden />
                      Lv.{r.level ?? 1}
                    </span>
                    <span className="mt-1 w-full space-y-1 text-center">
                      <span className="block rounded-lg border border-sky-300/25 bg-sky-400/12 px-1.5 py-1 text-[11px] font-black leading-none text-sky-100">
                        {(r.xp ?? 0).toLocaleString("id-ID")}
                        <span className="ml-0.5 text-[8px] font-bold text-sky-200/70">XP</span>
                      </span>
                      <span className="block rounded-lg border border-amber-300/25 bg-amber-400/12 px-1.5 py-1 text-[11px] font-black leading-none text-amber-100">
                        {(r.days ?? 0).toLocaleString("id-ID")}
                        <span className="ml-0.5 text-[8px] font-bold text-amber-200/70">give</span>
                      </span>
                    </span>
                    {cleanTag(r.clanTag) && (
                      <ClanTag
                        icon={r.clanTagIcon || DEFAULT_CLAN_ICON}
                        tag={cleanTag(r.clanTag) as string}
                        className="shrink-0"
                      />
                    )}
                  </div>
                );
              })
            ) : (
              <p className="col-span-3 py-8 text-center text-xs text-white/50">
                Belum ada data untuk periode ini.
              </p>
            )}
          </div>
        </section>

        {/* GRID 4-50 — ke bawah. */}
        {rest.length > 0 && (
          <>
            <div className="mt-5 flex items-baseline justify-between gap-2">
              <h3 className="yn-sec text-sm">Peringkat 4 - {rows.length}</h3>
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                {periodLabel(period)}
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
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * DUA KARTU PAPAN PERINGKAT — MELEBAR ke samping & TIDAK tinggi (bukan
 * kotak persegi besar). Kiri = teks ringkas (label + judul + periode),
 * kanan = Top 1/2/3 disusun BERDAMPINGAN: foto, lalu username, lalu
 * total XP / total give di bawahnya. Latar tiap kartu berwarna.
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

  const xpTop = (xpRows ?? []).slice(0, 3).map((r) => ({
    rank: r.rank,
    image: r.image,
    border: r.avatarBorder,
    // TANPA fallback "user#<id>" — permintaan: kotak Top 1/2/3 di Home
    // tidak menampilkan ID. Nama kosong tampil netral sebagai "user".
    username: r.username?.trim() || "user",
    value: fmtShort(r.xp ?? 0),
    label: "XP",
  }));
  const giveTop = (giveRows ?? []).slice(0, 3).map((g, i) => ({
    rank: i + 1,
    image: g.image,
    border: g.avatarBorder,
    username: g.username?.trim() || "user",
    value: `${fmtShort(g.days ?? 0)} hr`,
    label: "Give",
  }));

  const card = (mode: "xp" | "give") => {
    const tone = TONE[mode];
    const list = mode === "xp" ? xpTop : giveTop;
    const cells = list.length ? list : [1, 2, 3].map((rank) => ({
      rank,
      image: undefined,
      border: undefined,
      username: "-",
      value: "-",
      label: mode === "xp" ? "XP" : "Give",
    }));
    return (
      <button
        key={mode}
        onClick={() => setOpen(mode)}
        className={cn(
          "relative flex w-[95%] shrink-0 snap-center items-stretch gap-2.5 overflow-hidden rounded-[24px] border px-3 py-3 text-left shadow-[0_28px_56px_-40px_rgba(0,0,0,1)] transition hover:brightness-110 active:scale-[0.99] sm:w-[62%] lg:w-[46%]",
          tone.box,
        )}
      >
        <span
          aria-hidden
          className="absolute inset-0 opacity-45 [background-size:22px_22px] [background-image:radial-gradient(rgba(255,255,255,.07)_1px,transparent_1.2px)]"
        />

        {/* KIRI — teks diringkas supaya pas melebar ke samping. */}
        <span className="relative flex w-[30%] min-w-0 shrink-0 flex-col justify-center gap-1.5">
          <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-[0.14em] text-white/60">
            <Trophy className={cn("size-3", tone.icon)} />
            Papan
          </span>
          <span className="font-display text-[19px] font-black leading-[0.95] tracking-[-0.03em] text-white">
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
          <span
            className={cn(
              "w-fit rounded-full border px-2 py-0.5 text-[9px] font-black",
              tone.chip,
            )}
          >
            7 hari
          </span>
          <span className="flex items-center gap-1 text-[10px] font-black text-white/80">
            Ketuk buka <ChevronLeft className="size-3 rotate-180" />
          </span>
        </span>

        {/* KANAN — Top 1/2/3 berdampingan, isinya ke bawah: foto → nama → total */}
        <span className="relative grid min-w-0 flex-1 grid-cols-3 gap-1.5">
          {cells.map((r) => (
            <TopCell key={`${mode}-${r.rank}`} {...r} />
          ))}
        </span>
      </button>
    );
  };

  return (
    <>
      <section className="fade-enter mt-5">
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <h2 className="yn-sec text-lg">Papan Peringkat</h2>
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-gold-strong">
            Top XP &amp; Top Give
          </span>
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
