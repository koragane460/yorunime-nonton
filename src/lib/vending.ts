/* YORUVERSE — MESIN VENDING (pengganti gacha kartu anime yang dihapus).
   Dipakai BERSAMA oleh backend (convex/gacha.ts) dan UI (Gacha.tsx),
   jadi file ini hanya berisi data & fungsi murni. */

/** Harga 1× (gratis untuk yang belum pernah pull sama sekali). */
export const VENDING_X1 = 169;
/** Harga 10×. */
export const VENDING_X10 = 1600;

export type RewardKind = "xp" | "egg" | "sacret" | "premium";

export type VendingReward = {
  kind: RewardKind;
  amount: number;
  /** Tier tampilan untuk warna kartu hadiah. */
  tier: "common" | "rare" | "epic" | "legendary";
};

/** Nama + ikon tiap jenis hadiah (dipakai daftar "Hadiah mesin" di UI). */
export const REWARD_META: Record<
  RewardKind,
  { name: string; emoji: string; range: string; desc: string }
> = {
  xp: {
    name: "XP",
    emoji: "⚡",
    range: "100 – 10.000",
    desc: "Pengalaman buat naik level akun.",
  },
  egg: {
    name: "Telur Pet",
    emoji: "🥚",
    range: "1 – 10",
    desc: "Telur Misteri buat ditetasin di YoruPet.",
  },
  sacret: {
    name: "Sacret",
    emoji: "💎",
    range: "500 – 3.000",
    desc: "Mata utama YoruVerse — buat beli scene, border, dll.",
  },
  premium: {
    name: "Premium",
    emoji: "👑",
    range: "1 – 360 hari",
    desc: "Paling langka — langsung aktif di akun kamu.",
  },
};

/** Bobot drop (total 100) — premium sengaja paling kecil. */
const WEIGHTS: { kind: RewardKind; w: number }[] = [
  { kind: "xp", w: 40 },
  { kind: "egg", w: 26 },
  { kind: "sacret", w: 24 },
  { kind: "premium", w: 10 },
];

function rnd(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

/** Tier tampilan berdasarkan jenis hadiah. */
export function rewardTier(kind: RewardKind): VendingReward["tier"] {
  if (kind === "premium") return "legendary";
  if (kind === "sacret") return "epic";
  if (kind === "egg") return "rare";
  return "common";
}

/** Roll SATU hadiah vending. */
export function rollReward(): VendingReward {
  const total = WEIGHTS.reduce((a, b) => a + b.w, 0);
  let r = Math.random() * total;
  let kind: RewardKind = "xp";
  for (const it of WEIGHTS) {
    r -= it.w;
    if (r <= 0) {
      kind = it.kind;
      break;
    }
  }
  return { kind, amount: rollAmount(kind), tier: rewardTier(kind) };
}

/** Nilai hadiah per jenis (rentang sesuai permintaan). */
export function rollAmount(kind: RewardKind): number {
  switch (kind) {
    case "xp":
      // 100 – 10.000, condong ke bawah biar wajar
      return Math.round((100 + Math.pow(Math.random(), 1.6) * 9900) / 10) * 10;
    case "egg":
      return rnd(1, 10);
    case "sacret":
      return 500 + Math.round((Math.random() * 2500) / 50) * 50;
    case "premium": {
      // 1 – 360 hari: mayoritas durasi kecil, sesekali yang besar.
      const days = Math.max(1, Math.round(360 * Math.pow(Math.random(), 2.6)));
      return Math.min(360, days);
    }
  }
}

/** Label angka hadiah untuk UI ("×3", "120 XP", "2 hari", dst). */
export function rewardAmountLabel(r: VendingReward): string {
  switch (r.kind) {
    case "xp":
      return `${r.amount.toLocaleString("id-ID")} XP`;
    case "egg":
      return `×${r.amount}`;
    case "sacret":
      return `${r.amount.toLocaleString("id-ID")}`;
    case "premium":
      return r.amount === 1 ? "1 hari" : `${r.amount} hari`;
  }
}
