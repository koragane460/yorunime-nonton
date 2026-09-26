import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { xpForLevel } from "./users";

/** Record an XP event and apply it to the user's xp/level. */
export const recordXp = mutation({
  args: { amount: v.number(), source: v.string() },
  handler: async (ctx, { amount, source }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");
    let xp = (user.xp ?? 0) + amount;
    let level = user.level ?? 1;
    while (level < 10000 && xp >= xpForLevel(level)) {
      xp -= xpForLevel(level);
      level += 1;
    }
    if (xp < 0) xp = 0;
    await ctx.db.patch(userId, { xp, level });
    await ctx.db.insert("xpEvents", { userId, xp: amount, source, createdAt: Date.now() });
    return { xp, level };
  },
});

const PERIOD_MS: Record<string, number> = {
  harian: 24 * 3600 * 1000,
  mingguan: 7 * 24 * 3600 * 1000,
  bulanan: 30 * 24 * 3600 * 1000,
};

/** Sum xpEvents per user within period; falls back to all-time total xp. */
export const leaderboard = query({
  args: { period: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { period, limit }) => {
    const take = Math.min(limit ?? 50, 50);
    const periodMs = PERIOD_MS[period];
    const users = await ctx.db.query("users").collect();
    const byId = new Map(users.map((u) => [u._id, u]));

    let entries: { userId: string; username?: string; image?: string; level?: number; xp: number }[];
    if (periodMs) {
      const since = Date.now() - periodMs;
      const events = await ctx.db
        .query("xpEvents")
        .filter((q) => q.gte(q.field("createdAt"), since))
        .collect();
      const sums = new Map<string, number>();
      for (const e of events) {
        sums.set(e.userId, (sums.get(e.userId) ?? 0) + Math.max(0, e.xp));
      }
      entries = [...sums.entries()].map(([userId, xp]) => {
        const u = byId.get(userId as any);
        return {
          userId,
          username: u?.username,
          image: u?.image,
          level: u?.level,
          xp,
        };
      });
    } else {
      entries = users
        .filter((u) => (u.xp ?? 0) > 0)
        .map((u) => ({
          userId: u._id,
          username: u.username,
          image: u.image,
          level: u.level,
          xp: u.xp ?? 0,
        }));
    }
    entries.sort((a, b) => b.xp - a.xp);
    return entries.slice(0, take);
  },
});
