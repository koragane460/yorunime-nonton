// YoruNime — XP: tambah xp user + catat event untuk leaderboard harian/mingguan/bulanan.
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { xpForLevel } from "./users";

export async function addXpInternal(
  ctx: any,
  userId: string,
  amount: number,
  source: string,
) {
  const user = await ctx.db.get(userId);
  if (!user) return;
  let xp = (user.xp ?? 0) + amount;
  let level = user.level ?? 1;
  while (level < 10000 && amount > 0 && xp >= xpForLevel(level)) {
    xp -= xpForLevel(level);
    level += 1;
  }
  if (xp < 0) xp = 0;
  await ctx.db.patch(userId, { xp, level });
  await ctx.db.insert("xpEvents", { userId, xp: amount, source, createdAt: Date.now() });
}

export const recordXp = mutation({
  args: { amount: v.number(), source: v.string() },
  handler: async (ctx, { amount, source }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    await addXpInternal(ctx, userId, amount, source);
    return { ok: true };
  },
});

const PERIOD_MS: Record<string, number> = {
  harian: 24 * 3600 * 1000,
  mingguan: 7 * 24 * 3600 * 1000,
  bulanan: 30 * 24 * 3600 * 1000,
};

/**
 * Leaderboard mingguan/bulanan hanya menghitung user yang umur akunnya sudah
 * melewati periode tersebut. Jadi akun yang baru bergabung kemarin tidak
 * langsung muncul di leaderboard mingguan/bulanan.
 */
const PERIOD_MIN_AGE: Record<string, number> = {
  harian: 0,
  mingguan: 7 * 24 * 3600 * 1000,
  bulanan: 30 * 24 * 3600 * 1000,
};

/** Tanggal gabung user (fallback ke _creationTime). */
function joinedAt(u: { createdAt?: number; _creationTime: number }): number {
  return u.createdAt ?? u._creationTime;
}

export const leaderboard = query({
  args: { period: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { period, limit = 50 }) => {
    const take = Math.min(limit, 50);
    const users = await ctx.db.query("users").collect();
    const byId = new Map(users.map((u) => [u._id, u]));
    const minAge = PERIOD_MIN_AGE[period] ?? 0;
    const eligible = (u: (typeof users)[number]) =>
      minAge === 0 || Date.now() - joinedAt(u) >= minAge;
    let entries: {
      userId: string;
      username?: string;
      image?: string;
      level?: number;
      xp: number;
    }[];
    const periodMs = PERIOD_MS[period];
    if (periodMs) {
      const since = Date.now() - periodMs;
      const events = await ctx.db
        .query("xpEvents")
        .withIndex("createdAt", (q) => q.gte("createdAt", since))
        .collect();
      const sums = new Map<string, number>();
      for (const e of events)
        sums.set(e.userId, (sums.get(e.userId) ?? 0) + Math.max(0, e.xp));
      entries = [...sums.entries()].map(([userId, xp]) => {
        const u = byId.get(userId as any);
        return { userId, username: u?.username, image: u?.image, level: u?.level, xp };
      });
    } else {
      entries = users.map((u) => ({
        userId: u._id,
        username: u.username,
        image: u.image,
        level: u.level,
        xp: u.xp ?? 0,
      }));
    }
    // Buang user yang belum cukup lama berada di YoruNime untuk periode ini
    // (mis. akun 2 hari lalu tidak boleh masuk leaderboard mingguan/bulanan).
    entries = entries.filter((e) => {
      const u = byId.get(e.userId as any);
      return u ? eligible(u) : false;
    });
    entries.sort((a, b) => b.xp - a.xp);
    return entries.slice(0, take).map((e, i) => ({ rank: i + 1, ...e }));
  },
});
