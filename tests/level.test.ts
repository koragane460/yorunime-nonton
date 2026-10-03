import { describe, expect, test } from "bun:test";
import { tierForLevel, xpForLevel } from "../src/lib/level";
import { xpForLevel as serverXpForLevel } from "../src/convex/users";

describe("level & XP (data user)", () => {
  test("tier naik sesuai batas level", () => {
    expect(tierForLevel(1).badge).toBe("Bronze");
    expect(tierForLevel(49).badge).toBe("Bronze");
    expect(tierForLevel(50).badge).toBe("Silver");
    expect(tierForLevel(99).badge).toBe("Silver");
    expect(tierForLevel(100).badge).toBe("Diamond");
    expect(tierForLevel(500).badge).toBe("Emerald");
    expect(tierForLevel(1001).badge).toBe("Master");
    expect(tierForLevel(5000).badge).toBe("Grandmaster");
  });

  test("XP per level selalu positif dan tidak pernah turun", () => {
    let prev = 0;
    for (let lvl = 1; lvl <= 10000; lvl++) {
      const need = xpForLevel(lvl);
      expect(need).toBeGreaterThan(0);
      expect(need).toBeGreaterThanOrEqual(prev);
      prev = need;
    }
  });

  test("client dan server memakai rumus XP yang sama", () => {
    for (let lvl = 1; lvl <= 9999; lvl += 7) {
      expect(xpForLevel(lvl)).toBe(serverXpForLevel(lvl));
    }
    expect(xpForLevel(1)).toBe(serverXpForLevel(1));
    expect(xpForLevel(9999)).toBe(serverXpForLevel(9999));
  });
});
