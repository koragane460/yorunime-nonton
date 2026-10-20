/**
 * ROSTER GACHA — daftar karakter anime yang bisa didapat dari pull.
 *
 * Rank menunjukkan seberapa "populer" karakternya:
 *   SSS = paling populer banget (paling SUSAH didapat)
 *   SS  = populer menengah
 *   S   = kurang populer (paling mudah didapat)
 *
 * Gambar karakter diambil dari AniList (lihat src/convex/gacha.ts,
 * di-cache server) supaya tidak perlu menyimpan URL mentah di kode.
 */

export type GachaRank = "SSS" | "SS" | "S";

export type GachaChar = {
  /** id stabil = slug nama (dipakai sebagai key kepemilikan kartu). */
  id: string;
  name: string;
  /** Judul anime tempat karakter ini berasal. */
  anime: string;
  rank: GachaRank;
};

export const GACHA_ROSTER: GachaChar[] = [
  // ---------------- SSS — paling populer, paling susah didapat ----------------
  { id: "gojo-satoru", name: "Gojo Satoru", anime: "Jujutsu Kaisen", rank: "SSS" },
  { id: "levi-ackerman", name: "Levi Ackerman", anime: "Attack on Titan", rank: "SSS" },
  { id: "monkey-d-luffy", name: "Monkey D. Luffy", anime: "One Piece", rank: "SSS" },
  { id: "son-goku", name: "Son Goku", anime: "Dragon Ball", rank: "SSS" },
  { id: "naruto-uzumaki", name: "Naruto Uzumaki", anime: "Naruto", rank: "SSS" },
  { id: "saitama", name: "Saitama", anime: "One Punch Man", rank: "SSS" },
  // SSS bukan cuma cowok — ikonik perempuan juga masuk rate-up teratas.
  { id: "zero-two", name: "Zero Two", anime: "Darling in the Franxx", rank: "SSS" },
  { id: "rem-rezero", name: "Rem", anime: "Re:Zero", rank: "SSS" },
  { id: "mikasa-ackerman", name: "Mikasa Ackerman", anime: "Attack on Titan", rank: "SSS" },

  // ---------------- SS — populer menengah ----------------
  { id: "tanjiro-kamado", name: "Tanjiro Kamado", anime: "Demon Slayer", rank: "SS" },
  { id: "nezuko-kamado", name: "Nezuko Kamado", anime: "Demon Slayer", rank: "SS" },
  { id: "hinata-hyuga", name: "Hinata Hyuga", anime: "Naruto", rank: "SS" },
  { id: "asuka-langley", name: "Asuka Langley Soryu", anime: "Neon Genesis Evangelion", rank: "SS" },
  { id: "light-yagami", name: "Light Yagami", anime: "Death Note", rank: "SS" },
  { id: "kirito", name: "Kirito", anime: "Sword Art Online", rank: "SS" },
  { id: "rimuru-tempest", name: "Rimuru Tempest", anime: "Tensei Shitara Slime Datta Ken", rank: "SS" },
  { id: "sasuke-uchiha", name: "Sasuke Uchiha", anime: "Naruto", rank: "SS" },
  { id: "kakashi-hatake", name: "Kakashi Hatake", anime: "Naruto", rank: "SS" },

  // ---------------- S — kurang populer, paling mudah didapat ----------------
  { id: "zenitsu-agatsuma", name: "Zenitsu Agatsuma", anime: "Demon Slayer", rank: "S" },
  { id: "inosuke-hashibira", name: "Inosuke Hashibira", anime: "Demon Slayer", rank: "S" },
  { id: "edward-elric", name: "Edward Elric", anime: "Fullmetal Alchemist", rank: "S" },
  { id: "roy-mustang", name: "Roy Mustang", anime: "Fullmetal Alchemist", rank: "S" },
  { id: "sakuta-azusagawa", name: "Sakuta Azusagawa", anime: "Seishun Buta Yarou", rank: "S" },
  { id: "mai-sakurajima", name: "Mai Sakurajima", anime: "Seishun Buta Yarou", rank: "S" },
  { id: "kaguya-shinomiya", name: "Kaguya Shinomiya", anime: "Kaguya-sama", rank: "S" },
  { id: "toji-fushiguro", name: "Toji Fushiguro", anime: "Jujutsu Kaisen", rank: "S" },
  { id: "suguru-geto", name: "Suguru Geto", anime: "Jujutsu Kaisen", rank: "S" },
  { id: "elma", name: "Elma", anime: "Futsutsuka na Akujo", rank: "S" },
];

export const RANK_ORDER: GachaRank[] = ["SSS", "SS", "S"];

/** Nama query AniList — dipakai server untuk mengambil gambar. */
export function charQueryName(c: GachaChar): string {
  // "Monkey D. Luffy" → AniList lebih akurat tanpa titik.
  return c.name.replace(/\./g, "");
}

/** Biaya pull ( mata uang Sacret ). */
export const PULL_COST_1 = 160;
export const PULL_COST_10 = 1600;
/** Pity: pada pull ke-75 tanpa SSS, SSS dijamin. */
export const PITY_MAX = 75;
