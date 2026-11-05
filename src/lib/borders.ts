/**
 * SHOP BORDER — daftar bingkai foto profil yang bisa dibeli dengan Sacret
 * dan dipakai lewat Pengaturan → Akun → Shop (grid "Border photo profile").
 *
 * Visual tiap border ada di `src/index.css` (kelas `.yn-frame-<id>`) dan
 * dipakai komponen `FramedAvatar`.
 *
 * HARGA di daftar ini HARUS SAMA dengan `BORDER_PRICES` di
 * `src/convex/account.ts` — server yang memutuskan harga saat pembelian,
 * file ini hanya untuk tampilan.
 */
export type BorderDef = {
  id: string;
  name: string;
  price: number;
  blurb: string;
};

export const BORDERS: BorderDef[] = [
  { id: "none", name: "Polos", price: 0, blurb: "Tanpa bingkai" },
  { id: "aurora", name: "Aurora", price: 500, blurb: "Cincin pelangi berputar" },
  { id: "tide", name: "Tide", price: 700, blurb: "Ombak laut biru" },
  { id: "bloom", name: "Bloom", price: 900, blurb: "Sakura pink lembut" },
  { id: "ember", name: "Ember", price: 1000, blurb: "Bara api + kilau" },
  { id: "volt", name: "Volt", price: 1300, blurb: "Orbit neon putus" },
  { id: "prisma", name: "Prisma", price: 1600, blurb: "Pelangi berputar" },
  { id: "royal", name: "Royal", price: 2000, blurb: "Emas mahkota + bintang" },
  { id: "storm", name: "Storm", price: 2500, blurb: "Sambaran badai" },
  { id: "nova", name: "Nova", price: 3000, blurb: "Galaksi bintang" },
  { id: "magma", name: "Magma", price: 4000, blurb: "Lahar menyala" },
  { id: "holo", name: "Holo", price: 5000, blurb: "Holografik bergerak" },
  {
    id: "wings",
    name: "Sayap Merah",
    price: 6500,
    blurb: "Sayap merah-hitam membuka",
  },
  {
    id: "cloud",
    name: "Awan Salju",
    price: 7500,
    blurb: "Awan berarak + hujan salju",
  },
  {
    id: "sakura",
    name: "Sakura Ring",
    price: 2800,
    blurb: "Cincin kelopak sakura berputar",
  },
  {
    id: "bubble",
    name: "Bubble Sea",
    price: 3200,
    blurb: "Gelembung laut naik berkilau",
  },
  {
    id: "starlight",
    name: "Starlight",
    price: 3800,
    blurb: "Langit malam + bintang berkedip",
  },
  {
    id: "cyber",
    name: "Cyber Grid",
    price: 5200,
    blurb: "Grid neon berjalan di sekeliling foto",
  },
  {
    id: "rosegold",
    name: "Rose Gold",
    price: 3600,
    blurb: "Logam rose gold bertekstur sikat, tenang dan mewah",
  },
  {
    id: "sapphire",
    name: "Sapphire",
    price: 4200,
    blurb: "Biru safir berfaset dengan sorot permata",
  },
  {
    id: "imperial",
    name: "Imperial",
    price: 8500,
    blurb: "Ring emas bermahkota dengan ukiran kerajaan",
  },
  {
    id: "obsidian",
    name: "Obsidian",
    price: 9000,
    blurb: "Batu hitam bertepi perak dengan satu permata",
  },
];
