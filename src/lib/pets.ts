/* YORUPET — definisi pet, rarity, dan scene.
   Dipakai BERSAMA oleh backend (convex/pets.ts) dan UI (YoruPet/YoruVerse),
   jadi file ini tidak boleh berisi apa pun selain data & tipe murni. */

export type PetRarity = "Common" | "Uncommon" | "Rare" | "Divine" | "Tetrix";

export type PetDef = {
  id: string;
  name: string;
  emoji: string;
  rarity: PetRarity;
  /** Peluang drop dalam persen — total tepat 100. */
  rate: number;
  /** Harga pet (crystal). Saat dijual, crystal yang kembali = harga ini. */
  crystal: number;
  /** Sacret yang didapat saat klaim 24 jam (sesuai rarity). */
  claim: number;
};

/** Sepuluh pet — makin tinggi rarity, makin bagus tampilannya. */
export const PETS: PetDef[] = [
  { id: "kunai", name: "Kunai", emoji: "🐣", rarity: "Common", rate: 22, crystal: 40, claim: 50 },
  { id: "penyu", name: "Kura-Kura", emoji: "🐢", rarity: "Common", rate: 20, crystal: 35, claim: 40 },
  { id: "kenari", name: "Kenari", emoji: "🐦", rarity: "Uncommon", rate: 16, crystal: 120, claim: 120 },
  { id: "rubah", name: "Rubah Api", emoji: "🦊", rarity: "Uncommon", rate: 14, crystal: 140, claim: 140 },
  { id: "serigala", name: "Serigala", emoji: "🐺", rarity: "Rare", rate: 10, crystal: 300, claim: 300 },
  { id: "rusa", name: "Rusa Suci", emoji: "🦌", rarity: "Rare", rate: 8, crystal: 350, claim: 350 },
  { id: "merak", name: "Merak", emoji: "🦜", rarity: "Rare", rate: 5, crystal: 320, claim: 320 },
  { id: "unikorn", name: "Unikorn", emoji: "🦄", rarity: "Divine", rate: 3, crystal: 800, claim: 750 },
  { id: "naga", name: "Naga", emoji: "🐉", rarity: "Divine", rate: 1.6, crystal: 900, claim: 800 },
  { id: "tetrix", name: "Tetrix Spirit", emoji: "🌟", rarity: "Tetrix", rate: 0.4, crystal: 3000, claim: 2000 },
];

/** Gaya visual per rarity — makin tinggi, makin mewah. */
export const RARITY_STYLE: Record<
  PetRarity,
  { text: string; chip: string; glow: string; ring: string }
> = {
  Common: {
    text: "text-zinc-300",
    chip: "bg-zinc-500/20 text-zinc-200",
    glow: "",
    ring: "ring-white/15",
  },
  Uncommon: {
    text: "text-emerald-300",
    chip: "bg-emerald-500/20 text-emerald-200",
    glow: "shadow-[0_0_18px_-8px_rgba(52,211,153,.8)]",
    ring: "ring-emerald-400/40",
  },
  Rare: {
    text: "text-sky-300",
    chip: "bg-sky-500/20 text-sky-200",
    glow: "shadow-[0_0_22px_-8px_rgba(56,189,248,.9)]",
    ring: "ring-sky-400/50",
  },
  Divine: {
    text: "text-fuchsia-300",
    chip: "bg-fuchsia-500/20 text-fuchsia-200",
    glow: "shadow-[0_0_28px_-8px_rgba(232,121,249,.95)]",
    ring: "ring-fuchsia-400/60",
  },
  Tetrix: {
    text: "text-gold",
    chip: "bg-gold/20 text-gold",
    glow: "shadow-[0_0_34px_-8px_rgba(255,207,64,1)]",
    ring: "ring-gold/70",
  },
};

export type SceneDef = {
  id: string;
  name: string;
  emoji: string;
  /** Harga beli (Sacret). Scene pertama gratis. */
  cost: number;
  /** Kelas gradien latar langit. */
  sky: string;
  /** Kelas gradien lantai tanah. */
  floor: string;
  /** Partikel melayang khas scene ini. */
  particle: string;
};

/** Enam scene — mempercantik panggung pet SEKALIGUS latar layar YoruPet. */
export const SCENES: SceneDef[] = [
  {
    id: "hutan",
    name: "Hutan",
    emoji: "🌲",
    cost: 0,
    sky: "from-emerald-950 via-emerald-800/50 to-lime-950",
    floor: "from-emerald-900 to-green-950",
    particle: "🍃",
  },
  {
    id: "galaxy",
    name: "Galaxy",
    emoji: "🌌",
    cost: 25000,
    sky: "from-indigo-950 via-purple-900/60 to-black",
    floor: "from-indigo-950 to-black",
    particle: "⭐",
  },
  {
    id: "laut",
    name: "Bawah Laut",
    emoji: "🌊",
    cost: 20000,
    sky: "from-cyan-900 via-blue-900/50 to-blue-950",
    floor: "from-cyan-950 to-blue-950",
    particle: "🫧",
  },
  {
    id: "sakura",
    name: "Kebun Sakura",
    emoji: "🌸",
    cost: 30000,
    sky: "from-rose-300/90 via-pink-200/60 to-fuchsia-300",
    floor: "from-rose-400/60 to-pink-500/40",
    particle: "🌸",
  },
  {
    id: "senja",
    name: "Senja",
    emoji: "🌇",
    cost: 15000,
    sky: "from-orange-500/70 via-rose-500/40 to-indigo-950",
    floor: "from-orange-900 to-indigo-950",
    particle: "☁️",
  },
  {
    id: "abyss",
    name: "Abyss",
    emoji: "🕳️",
    cost: 35000,
    sky: "from-black via-violet-950/80 to-black",
    floor: "from-violet-950 to-black",
    particle: "✦",
  },
];

/** Klaim 24 jam. */
export const CLAIM_MS = 24 * 60 * 60 * 1000;
/** Harga gacha (Sacret). */
export const GACHA_X1 = 1000;
export const GACHA_X10 = 10000;

/** Roll satu pet sesuai persentase drop. */
export function rollPet(): PetDef {
  let r = Math.random() * 100;
  for (const p of PETS) {
    r -= p.rate;
    if (r <= 0) return p;
  }
  return PETS[PETS.length - 1];
}

export function petById(id: string): PetDef | undefined {
  return PETS.find((p) => p.id === id);
}

export function sceneById(id: string): SceneDef {
  return SCENES.find((s) => s.id === id) ?? SCENES[0];
}
