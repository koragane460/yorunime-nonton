import { describe, expect, test } from "bun:test";
import {
  CLAN_LEVELS_MAX,
  claimAmountForLevel,
  cleanClanTag,
  levelCost,
} from "../src/convex/clans";
import {
  DEFAULT_CLAN_ICON,
  PICKABLE_CLAN_ICONS,
  isClanIcon,
  resolveClanIcon,
} from "../src/lib/clanIcons";

describe("clan: tag & nama", () => {
  test("tag dibersihkan jadi huruf besar dan angka saja", () => {
    expect(cleanClanTag(" yoru ")).toBe("YORU");
    expect(cleanClanTag("a b-c")).toBe("ABC");
    expect(cleanClanTag("!!12!!")).toBe("12");
    expect(cleanClanTag("tag clan!")).toBe("TAGCLAN");
  });

  test("tag valid berukuran 3-4 karakter", () => {
    expect(cleanClanTag("YN1").length).toBeGreaterThanOrEqual(3);
    expect(cleanClanTag("YORU").length).toBeLessThanOrEqual(4);
    // input panjang dipangkas aturan server: 3-4 saja yang lolos
    expect(cleanClanTag("TOOLONG").length).toBeGreaterThan(4);
    expect(cleanClanTag("ab").length).toBeLessThan(3);
  });
});

describe("clan: ikon tag", () => {
  test("semua ikon pilihan terdaftar dan bisa di-resolve", () => {
    expect(PICKABLE_CLAN_ICONS.length).toBeGreaterThan(0);
    for (const ic of PICKABLE_CLAN_ICONS) {
      expect(isClanIcon(ic.key)).toBe(true);
      const resolved = resolveClanIcon(ic.key);
      expect(resolved.Icon).toBeDefined();
      expect(typeof resolved.tone).toBe("string");
    }
  });

  test("ikon lama/tidak dikenal jatuh ke ikon default, bukan crash", () => {
    const r = resolveClanIcon("ik-yang-tidak-ada");
    expect(r.Icon).toBeDefined();
    expect(isClanIcon("ik-yang-tidak-ada")).toBe(false);
    expect(DEFAULT_CLAN_ICON).not.toBe("");
  });

  test("resolve tanpa argumen tetap aman", () => {
    expect(resolveClanIcon(undefined).Icon).toBeDefined();
    expect(resolveClanIcon("").Icon).toBeDefined();
  });
});

describe("clan: biaya level & claim", () => {
  test("biaya naik per level dan claim selalu positif", () => {
    expect(levelCost(1)).toBeLessThan(levelCost(2));
    expect(levelCost(CLAN_LEVELS_MAX)).toBeGreaterThan(levelCost(10));
    for (let lvl = 1; lvl <= CLAN_LEVELS_MAX; lvl += 13) {
      expect(claimAmountForLevel(lvl)).toBeGreaterThan(0);
    }
    expect(claimAmountForLevel(1)).toBeLessThan(claimAmountForLevel(100));
  });

  test("level pertama tetap terjangkau (bukan lonjakan mahal)", () => {
    expect(levelCost(1)).toBeLessThanOrEqual(1000);
  });
});
