/**
 * Logo tag clan versi ikon lucide.
 *
 * Dulu memakai gambar pixel (DiceBear); sekarang semua logo berupa ikon vektor
 * lucide supaya tajam di layar mana pun dan ukurannya konsisten.
 *
 * Nilai yang disimpan di database adalah key (mis. "ic-rose" atau key pixel lama
 * seperti "pix-angel"), bukan URL, supaya aman kalau registry berubah.
 */
import {
  Anchor,
  Cherry,
  Droplet,
  Feather,
  Flame,
  Leaf,
  Medal,
  Rose,
  Shield,
  Skull,
  Snowflake,
  Star,
  Sun,
  Swords,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type ClanIconDef = {
  key: string;
  name: string;
  Icon: LucideIcon;
  /** warna ikon, hex */
  tone: string;
  /** true = tampil di picker saat bikin clan */
  pick?: boolean;
};

export const CLAN_ICONS: ClanIconDef[] = [
  { key: "ic-rose", name: "Mawar", Icon: Rose, tone: "#fb7185", pick: true },
  { key: "ic-snow", name: "Salju", Icon: Snowflake, tone: "#7dd3fc", pick: true },
  { key: "ic-clover", name: "Clover", Icon: Leaf, tone: "#4ade80", pick: true },
  { key: "ic-wing", name: "Sayap", Icon: Feather, tone: "#e2e8f0", pick: true },
  { key: "ic-tomato", name: "Tomat", Icon: Cherry, tone: "#f87171", pick: true },
  { key: "ic-swords", name: "Pedang", Icon: Swords, tone: "#cbd5e1", pick: true },
  { key: "ic-shield", name: "Perisai", Icon: Shield, tone: "#93c5fd", pick: true },
  { key: "ic-anchor", name: "Jangkar", Icon: Anchor, tone: "#67e8f9", pick: true },
  { key: "ic-gold", name: "Medali Emas", Icon: Medal, tone: "#facc15", pick: true },
  { key: "ic-silver", name: "Medali Perak", Icon: Medal, tone: "#e2e8f0", pick: true },
  { key: "ic-bronze", name: "Medali Perunggu", Icon: Medal, tone: "#f59e0b", pick: true },
  { key: "ic-flame", name: "Api", Icon: Flame, tone: "#fb923c", pick: true },
  { key: "ic-zap", name: "Petir", Icon: Zap, tone: "#fde047", pick: true },
  // key lama (era pixel) — tetap bisa dirender, tidak muncul di picker
  { key: "ic-star", name: "Bintang", Icon: Star, tone: "#fde047" },
  { key: "ic-skull", name: "Tengkorak", Icon: Skull, tone: "#cbd5e1" },
  { key: "ic-drop", name: "Tetesan", Icon: Droplet, tone: "#38bdf8" },
  { key: "ic-sun", name: "Matahari", Icon: Sun, tone: "#fbbf24" },
];

const byKey = new Map(CLAN_ICONS.map((i) => [i.key, i]));

/** Key pixel lama dipetakan ke ikon lucide terdekat supaya data lama tetap tampil. */
const LEGACY_KEY: Record<string, string> = {
  "pix-angel": "ic-wing",
  "pix-fire": "ic-flame",
  "pix-bolt": "ic-zap",
  "pix-clover": "ic-clover",
  "pix-star": "ic-star",
  "pix-bow": "ic-swords",
  "pix-skull": "ic-skull",
  "pix-drop": "ic-drop",
  "pix-snow": "ic-snow",
  "pix-sun": "ic-sun",
};

/** Opsi logo yang ditampilkan di form bikin clan. */
export const PICKABLE_CLAN_ICONS = CLAN_ICONS.filter((i) => i.pick);

/**
 * Resolve key logo clan → ikon lucide + warnanya.
 * Key lama (pix-*) dan key tak dikenal tetap aman (fallback ke ikon default).
 */
export function resolveClanIcon(icon?: string): {
  Icon: LucideIcon;
  tone: string;
  name: string;
} {
  const hit =
    (icon && byKey.get(icon)) ||
    (icon && LEGACY_KEY[icon] && byKey.get(LEGACY_KEY[icon])) ||
    byKey.get(DEFAULT_CLAN_ICON)!;
  return { Icon: hit.Icon, tone: hit.tone, name: hit.name };
}

/** True kalau `icon` dikenal registry logo clan. */
export const isClanIcon = (icon?: string) =>
  !!icon && (byKey.has(icon) || !!LEGACY_KEY[icon]);

/** Ikon default kalau clan belum punya logo. */
export const DEFAULT_CLAN_ICON = "ic-wing";
