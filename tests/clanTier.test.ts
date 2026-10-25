import { describe, expect, test } from "bun:test";
import {
  CLAN_TIER_BROWN_MIN,
  CLAN_TIER_GOLD_MIN,
  CLAN_TIER_RAINBOW_MIN,
  CLAN_TIER_RED_MIN,
  clanTextClass,
  clanTierClass,
} from "../src/components/lstream-ui";

/**
 * Ambang warna nama clan. Nilai ini ditetapkan pemilik aplikasi dan harus
 * SAMA di semua layar (detail akun, akun, chat clan, halaman Clan):
 *   1-49    coklat
 *   50-99   emas
 *   100-149 merah
 *   150-200 rainbow
 */
const EXPECTED_TIERS = [
  { level: 1, want: "clan-tier-brown" },
  { level: 49, want: "clan-tier-brown" },
  { level: 50, want: "clan-tier-gold" },
  { level: 99, want: "clan-tier-gold" },
  { level: 100, want: "clan-tier-red" },
  { level: 149, want: "clan-tier-red" },
  { level: 150, want: "clan-tier-rainbow" },
  { level: 200, want: "clan-tier-rainbow" },
];

describe("clan: warna nama per level", () => {
  test("ambang tier sesuai spesifikasi 1-49/50-99/100-149/150-200", () => {
    for (const { level, want } of EXPECTED_TIERS) {
      expect(clanTextClass(level)).toBe(want);
    }
  });

  test("clanTierClass mengembalikan hal yang sama dengan clanTextClass", () => {
    // Dua nama fungsi ini dipakai bergantian di layar lain; keduanya HARUS
    // tetap satu sumber kebenaran supaya warnanya tidak berbeda antar layar.
    for (const { level, want } of EXPECTED_TIERS) {
      expect(clanTierClass(level)).toBe(want);
    }
  });

  test("level kosong/0 tidak meledak dan jatuh ke tier terendah", () => {
    expect(clanTextClass(undefined)).toBe("clan-tier-brown");
    expect(clanTextClass(0)).toBe("clan-tier-brown");
    expect(clanTextClass(null as unknown as number)).toBe("clan-tier-brown");
  });

  test("konstanta ambang tidak berubah diam-diam", () => {
    expect(CLAN_TIER_BROWN_MIN).toBe(1);
    expect(CLAN_TIER_GOLD_MIN).toBe(50);
    expect(CLAN_TIER_RED_MIN).toBe(100);
    expect(CLAN_TIER_RAINBOW_MIN).toBe(150);
  });
});
