/**
 * Logo tag clan versi pixel.
 *
 * Emoji terlalu "modern" dan ukurannya tidak konsisten antar perangkat, jadi
 * diganti gambar pixel asli (DiceBear Pixel Art) supaya semua logo clan punya
 * bentuk & ukuran yang sama persis di HP mana pun.
 *
 * Nilai yang disimpan di database adalah key (mis. "pix-angel"), bukan URL,
 * supaya warnanya bisa menyesuaikan tema dan tidak hardcode warna.
 */

export type ClanPixelIcon = {
  key: string;
  seed: string;
  /** warna latar, hex tanpa '#' */
  bg: string;
  name: string;
};

export const CLAN_PIXEL_ICONS: ClanPixelIcon[] = [
  { key: "pix-angel", seed: "angel", bg: "1b2a4a", name: "Malaikat" },
  { key: "pix-fire", seed: "fire", bg: "3b1a12", name: "Api" },
  { key: "pix-bolt", seed: "bolt", bg: "2f2a12", name: "Petir" },
  { key: "pix-clover", seed: "clover", bg: "12301c", name: "Clover" },
  { key: "pix-star", seed: "star", bg: "241a35", name: "Bintang" },
  { key: "pix-bow", seed: "bow", bg: "33241a", name: "Busur" },
  { key: "pix-skull", seed: "skull", bg: "2a2a2e", name: "Tengkorak" },
  { key: "pix-drop", seed: "drop", bg: "122733", name: "Tetesan" },
  { key: "pix-snow", seed: "snow", bg: "1b2f3a", name: "Salju" },
  { key: "pix-sun", seed: "sun", bg: "3a2a10", name: "Matahari" },
];

const byKey = new Map(CLAN_PIXEL_ICONS.map((i) => [i.key, i]));

/** True kalau `icon` adalah key logo pixel (bukan emoji lama). */
export const isPixelIcon = (icon?: string) => !!icon && byKey.has(icon);

/** URL gambar logo pixel; kalau bukan key pixel, null (dipakai sebagai emoji). */
export function clanPixelIconUrl(icon?: string): string | null {
  if (!icon) return null;
  const it = byKey.get(icon);
  if (!it) return null;
  return `https://api.dicebear.com/9.x/pixel-art/svg?seed=${it.seed}&backgroundColor=${it.bg}&pixelSize=4`;
}

/** Ikon default kalau clan belum punya logo pixel. */
export const DEFAULT_CLAN_ICON = CLAN_PIXEL_ICONS[0].key;
