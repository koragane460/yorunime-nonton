// YoruNime — MESIN VENDING (pengganti gacha kartu anime yang DIHAPUS).
//
// Mata uang: Sacret (field `diamonds` di user).
//   - Pull 1×  GRATIS untuk yang belum pernah pull sama sekali,
//     sesudahnya 169 Sacret.
//   - Pull 10× 1600 Sacret.
// Hadiah keluar dari mesin (bukan kartu karakter):
//   XP 100–10.000 · Telur pet 1–10 · Sacret 500–3.000 · Premium 1–360 hari
// Semua animasi (koin jatuh, produk jatuh, kotak buka, gosok kartu emas)
// ada di frontend — di sini hanya logika, angka, dan koleksi.
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import {
  VENDING_X1,
  VENDING_X10,
  rollReward,
  type VendingReward,
} from "../lib/vending";
import { addXpInternal } from "./xp";

/** Tambah title collection (idempoten — hanya insert kalau belum ada). */
async function awardTitle(ctx: any, userId: any, titleId: string) {
  const hit = await ctx.db
    .query("userTitles")
    .withIndex("userId_title", (q: any) =>
      q.eq("userId", userId).eq("titleId", titleId),
    )
    .first();
  if (!hit)
    await ctx.db.insert("userTitles", {
      userId,
      titleId,
      earnedAt: Date.now(),
    });
}

async function loadState(ctx: any, userId: any) {
  let st = await ctx.db
    .query("gachaState")
    .withIndex("userId", (q: any) => q.eq("userId", userId))
    .first();
  if (!st) {
    const id = await ctx.db.insert("gachaState", {
      userId,
      pity: 0,
      totalPulls: 0,
      sssCount: 0,
      ssCount: 0,
      streak: 0,
      bestStreak: 0,
      owned: {},
    });
    st = (await ctx.db.get(id))!;
  }
  return st;
}

async function loadPetState(ctx: any, userId: any) {
  let s = await ctx.db
    .query("petState")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .first();
  if (!s) {
    const id = await ctx.db.insert("petState", {
      userId,
      eggs: 0,
      owned: [],
      claimAt: 0,
      crystals: 0,
      scenes: [],
      scene: "hutan",
    });
    s = (await ctx.db.get(id))!;
  }
  return s;
}

/** State vending milik saya: Sacret, total pull, apakah 1× masih gratis. */
export const myState = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const u = await ctx.db.get(userId);
    const st = await ctx.db
      .query("gachaState")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .first();
    const totalPulls = st?.totalPulls ?? 0;
    return {
      sacret: u?.diamonds ?? 0,
      totalPulls,
      /** Belum pernah pull sama sekali → 1× pertama gratis. */
      freeAvailable: totalPulls === 0,
      premiumUntil: u?.premiumUntil ?? 0,
      unlimitedSacret: !!u?.unlimitedSacret,
      history: ((st?.pullHistory ?? []) as {
        id: string;
        rank: string;
        at: number;
      }[]).slice(0, 30),
    };
  },
});

/**
 * PULL mesin vending — 1× (gratis pertama lalu 169) atau 10× (1600).
 * Tiap unit menghasilkan SATU hadiah: XP / telur pet / Sacret / premium.
 */
export const pull = mutation({
  args: { count: v.union(v.literal(1), v.literal(10)) },
  handler: async (ctx, { count }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Masuk akun dulu");
    const u = await ctx.db.get(userId);
    if (!u) throw new Error("Akun tidak ditemukan");

    const st = await loadState(ctx, userId);
    const free = count === 1 && st.totalPulls === 0;
    const cost = count === 1 ? (free ? 0 : VENDING_X1) : VENDING_X10;
    const paid = u.unlimitedSacret ? 0 : cost;
    if ((u.diamonds ?? 0) < paid)
      throw new Error(`Sacret tidak cukup — butuh ${cost}`);

    // ---- roll hadiah per unit ----
    const rewards: VendingReward[] = [];
    for (let i = 0; i < count; i++) rewards.push(rollReward());

    let sacretGain = 0;
    let eggGain = 0;
    let premiumDays = 0;
    let xpGain = 0;
    for (const r of rewards) {
      if (r.kind === "sacret") sacretGain += r.amount;
      else if (r.kind === "egg") eggGain += r.amount;
      else if (r.kind === "premium") premiumDays += r.amount;
      else xpGain += r.amount;
    }

    // ---- terapkan ----
    if (xpGain > 0) await addXpInternal(ctx, userId, xpGain, "vending");
    if (eggGain > 0) {
      const ps = await loadPetState(ctx, userId);
      await ctx.db.patch(ps._id, { eggs: (ps.eggs ?? 0) + eggGain });
    }
    const now = Date.now();
    let premiumUntil = u.premiumUntil ?? 0;
    if (premiumDays > 0) {
      premiumUntil = Math.max(now, premiumUntil) + premiumDays * 86400000;
      await ctx.db.patch(userId, { premiumUntil });
    }
    const newSacret = (u.diamonds ?? 0) - paid + sacretGain;
    await ctx.db.patch(userId, { diamonds: newSacret });

    // ---- riwayat (paling baru di depan, maks 100) ----
    const historyEntries = rewards
      .map((r) => ({ id: r.kind, rank: r.tier as string, at: now }))
      .reverse();
    const pullHistory = [
      ...historyEntries,
      ...((st.pullHistory ?? []) as { id: string; rank: string; at: number }[]),
    ].slice(0, 100);

    await ctx.db.patch(st._id, {
      totalPulls: st.totalPulls + count,
      pullHistory,
    });

    // ---- title collection ----
    if (premiumDays > 0) await awardTitle(ctx, userId, "jackpot_hunter");
    if (rewards.some((r) => r.kind === "premium" && r.amount >= 30))
      await awardTitle(ctx, userId, "celestial_pull");
    if (count === 10) await awardTitle(ctx, userId, "ss_s_magnet");

    return {
      rewards: rewards.map((r) => ({
        kind: r.kind,
        amount: r.amount,
        tier: r.tier as string,
      })),
      freeUsed: free,
      cost: paid,
      totalPulls: st.totalPulls + count,
      sacret: newSacret,
      premiumUntil,
    };
  },
});
