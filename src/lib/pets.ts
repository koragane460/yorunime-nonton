/* YORUPET — definisi pet, rarity, dan scene.
   Dipakai BERSAMA oleh backend (convex/pets.ts) dan UI (YoruPet/YoruVerse),
   jadi file ini tidak boleh berisi apa pun selain data & tipe murni. */

export type PetRarity = "Common" | "Uncommon" | "Rare" | "Divine" | "Tetrix";

export type PetDef = {
  id: string;
  name: string;
  emoji: string;
  /**
   * FOTO/GAMBAR hewan (permintaan: "hewan tolong pake foto aja").
   * File asli disimpan di `public/pets/<id>.png` (PNG transparan, latar sudah
   * di-cut) supaya tampil instan dan tidak bergantung pada layanan luar.
   * Kalau gagal dimuat, UI otomatis jatuh kembali ke ilustrasi SVG (PetArt).
   */
  image?: string;
  rarity: PetRarity;
  /** Peluang drop dalam persen — total tepat 100. */
  rate: number;
  /** Harga pet (crystal). Saat dijual, crystal yang kembali = harga ini. */
  crystal: number;
  /** Sacret yang didapat saat klaim 24 jam (sesuai rarity). */
  claim: number;
};

/**
 * Delapan belas pet — makin tinggi rarity, makin kecil peluang dapetnya
 * dan makin besar claim 24 jam-nya. `image` menunjuk ke foto asli di
 * `public/pets/` (PNG transparan hasil potong latar otomatis):
 *   - 9 hewan nyata → foto realistis (Harimau Putih, Macan Tutul Salju, dll)
 *   - Unikorn & Naga → seni fantasi AI
 *   - 6 pet baru Divine/Tetrix (Fenrir, Cerberus, Kirin, Leviathan,
 *     Behemoth, Basilisk) → seni fantasi AI, latar sudah dipotong
 *   - Tetrix Spirit → "lebih wow": burung phoenix cair dari emas + starlight
 * Total `rate` tepat 100%.
 */
export const PETS: PetDef[] = [
  { id: "kunai", name: "Kunai", emoji: "🐣", image: "/pets/kunai.png", rarity: "Common", rate: 18, crystal: 40, claim: 50 },
  { id: "penyu", name: "Kura-Kura", emoji: "🐢", image: "/pets/penyu.png", rarity: "Common", rate: 16, crystal: 35, claim: 40 },
  { id: "kenari", name: "Kenari", emoji: "🐦", image: "/pets/kenari.png", rarity: "Uncommon", rate: 12, crystal: 120, claim: 120 },
  { id: "rubah", name: "Rubah Api", emoji: "🦊", image: "/pets/rubah.png", rarity: "Uncommon", rate: 11, crystal: 140, claim: 140 },
  { id: "serigala", name: "Serigala", emoji: "🐺", image: "/pets/serigala.png", rarity: "Rare", rate: 8, crystal: 300, claim: 300 },
  { id: "harimau-putih", name: "Harimau Putih", emoji: "🐅", image: "/pets/harimau-putih.png", rarity: "Rare", rate: 7, crystal: 450, claim: 400 },
  { id: "rusa", name: "Rusa Suci", emoji: "🦌", image: "/pets/rusa.png", rarity: "Rare", rate: 6, crystal: 350, claim: 350 },
  { id: "merak", name: "Merak", emoji: "🦜", image: "/pets/merak.png", rarity: "Rare", rate: 5, crystal: 320, claim: 320 },
  { id: "unikorn", name: "Unikorn", emoji: "🦄", image: "/pets/unikorn.png", rarity: "Divine", rate: 3, crystal: 800, claim: 750 },
  { id: "naga", name: "Naga", emoji: "🐉", image: "/pets/naga.png", rarity: "Divine", rate: 2.5, crystal: 900, claim: 800 },
  { id: "macan-tutul-salju", name: "Macan Tutul Salju", emoji: "🐆", image: "/pets/macan-tutul-salju.png", rarity: "Divine", rate: 2.5, crystal: 950, claim: 900 },
  { id: "fenrir", name: "Fenrir", emoji: "🐺", image: "/pets/fenrir.png", rarity: "Divine", rate: 2, crystal: 1200, claim: 950 },
  { id: "cerberus", name: "Cerberus", emoji: "🐕", image: "/pets/cerberus.png", rarity: "Divine", rate: 2, crystal: 1250, claim: 1000 },
  { id: "kirin", name: "Kirin", emoji: "🐲", image: "/pets/kirin.png", rarity: "Divine", rate: 1.5, crystal: 1400, claim: 1050 },
  { id: "leviathan", name: "Leviathan", emoji: "🐋", image: "/pets/leviathan.png", rarity: "Divine", rate: 1.5, crystal: 1500, claim: 1100 },
  { id: "tetrix", name: "Tetrix Spirit", emoji: "🌟", image: "/pets/tetrix.png", rarity: "Tetrix", rate: 0.7, crystal: 3000, claim: 2000 },
  { id: "behemoth", name: "Behemoth", emoji: "🦬", image: "/pets/behemoth.png", rarity: "Tetrix", rate: 0.75, crystal: 3400, claim: 2300 },
  { id: "basilisk", name: "Basilisk", emoji: "🐍", image: "/pets/basilisk.png", rarity: "Tetrix", rate: 0.55, crystal: 3800, claim: 2600 },
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
  /**
   * BOOST Sacret per pet — tiap scene yang dibeli menambah jumlah ini ke
   * hasil klaim SETIAP pet yang sedang dipasang. Makin mahal scene-nya,
   * makin besar boost-nya (cost / 200, dibulatkan; sakura 30.000 → 150).
   */
  boost: number;
  /** Kelas gradien latar langit. */
  sky: string;
  /** GAMBAR latar asli (raster) — dipakai kalau ada, menggantikan gradien. */
  image?: string;
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
    boost: 0,
    sky: "from-emerald-950 via-emerald-800/50 to-lime-950",
    image: "/scenes/hutan.jpg",
    floor: "from-emerald-900 to-green-950",
    particle: "🍃",
  },
  {
    id: "galaxy",
    name: "Galaxy",
    emoji: "🌌",
    cost: 25000,
    boost: 125,
    sky: "from-indigo-950 via-purple-900/60 to-black",
    floor: "from-indigo-950 to-black",
    particle: "⭐",
  },
  {
    id: "laut",
    name: "Bawah Laut",
    emoji: "🌊",
    cost: 20000,
    boost: 100,
    sky: "from-cyan-900 via-blue-900/50 to-blue-950",
    floor: "from-cyan-950 to-blue-950",
    particle: "🫧",
  },
  {
    id: "sakura",
    name: "Kebun Sakura",
    emoji: "🌸",
    cost: 30000,
    boost: 150,
    sky: "from-rose-300/90 via-pink-200/60 to-fuchsia-300",
    floor: "from-rose-400/60 to-pink-500/40",
    particle: "🌸",
  },
  {
    id: "senja",
    name: "Senja",
    emoji: "🌇",
    cost: 15000,
    boost: 75,
    sky: "from-orange-500/70 via-rose-500/40 to-indigo-950",
    floor: "from-orange-900 to-indigo-950",
    particle: "☁️",
  },
  {
    id: "abyss",
    name: "Abyss",
    emoji: "🕳️",
    cost: 35000,
    boost: 175,
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

/** Boost Sacret per pet dari scene aktif (0 kalau scene tidak dikenal). */
export function sceneBoost(id: string): number {
  return SCENES.find((s) => s.id === id)?.boost ?? 0;
}
