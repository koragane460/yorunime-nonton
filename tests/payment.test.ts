import { describe, expect, test } from "bun:test";
import { PLANS } from "../src/convex/payments";
import { giveCost, giveXp } from "../src/convex/chat";

describe("bayar: paket premium QRIS", () => {
  const plans = Object.entries(PLANS);

  test("semua paket punya hari, harga, dan Sacret yang masuk akal", () => {
    expect(plans.length).toBeGreaterThanOrEqual(5);
    for (const [id, p] of plans) {
      expect(id).toMatch(/^p\d+$/);
      expect(p.days).toBeGreaterThan(0);
      expect(p.price).toBeGreaterThan(0);
      expect(p.sacret).toBeGreaterThan(0);
      expect(p.price % 1000).toBe(0); // harga selalu kelipatan 1000 rupiah
      expect(p.label.length).toBeGreaterThan(0);
    }
  });

  test("lama berlangganan, harga, dan hadiah Sacret selalu naik per paket", () => {
    const ordered = plans.map(([, p]) => p);
    for (let i = 1; i < ordered.length; i++) {
      expect(ordered[i].days).toBeGreaterThan(ordered[i - 1].days);
      expect(ordered[i].price).toBeGreaterThan(ordered[i - 1].price);
      expect(ordered[i].sacret).toBeGreaterThan(ordered[i - 1].sacret);
    }
  });

  test("harga paket termurah masih masuk akal untuk produk berbayar", () => {
    const cheapest = Math.min(...plans.map(([, p]) => p.price));
    expect(cheapest).toBeGreaterThanOrEqual(1000);
  });
});

describe("bayar: biaya berbagi premium di chat", () => {
  const days = [1, 3, 5, 7, 15, 20, 25, 30];

  test("biaya hari naik seiring jumlah hari yang dibagikan", () => {
    let prev = 0;
    for (const d of days) {
      const cost = giveCost(d, 5);
      expect(cost).toBeGreaterThan(prev);
      prev = cost;
    }
  });

  test("biaya hari selalu >= hari yang diberikan (ada biaya operasional)", () => {
    for (const d of days) {
      expect(giveCost(d, 5)).toBeGreaterThanOrEqual(d);
    }
  });

  test("biaya penerima tidak pernah negatif untuk input di luar rentang", () => {
    for (const r of [0, 1, 4, 5, 30, 99]) {
      expect(giveCost(7, r)).toBeGreaterThan(0);
    }
  });

  test("tabel penerima resmi dipakai: 5 orang tanpa biaya tambahan, 30 orang paling mahal", () => {
    expect(giveCost(7, 5)).toBe(giveCost(7, 4));
    expect(giveCost(7, 30)).toBeGreaterThan(giveCost(7, 5));
  });

  test("XP berbagi premium selalu positif dan naik dengan hari", () => {
    let prev = 0;
    for (const d of days) {
      const xp = giveXp(d, 5);
      expect(xp).toBeGreaterThan(0);
      expect(xp).toBeGreaterThanOrEqual(prev);
      prev = xp;
    }
  });

  test("XP memakai angka hari yang sama dengan biaya (tidak ada paket tanpa XP)", () => {
    for (const d of days) {
      expect(giveXp(d, 5)).toBeGreaterThan(0);
      expect(Number.isFinite(giveCost(d, 5))).toBe(true);
    }
  });
});
