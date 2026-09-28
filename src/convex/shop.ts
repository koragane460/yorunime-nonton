// YoruNime — shop premium (beli pakai Sacret) & klik game.
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const shopItems = query({
  args: {},
  handler: async () => [
    { id: "d1", label: "1 Hari Premium", days: 1, cost: 100 },
    { id: "d7", label: "7 Hari Premium", days: 7, cost: 900 },
    { id: "d20", label: "20 Hari Premium", days: 20, cost: 4000 },
    { id: "d35", label: "35 Hari Premium", days: 35, cost: 9000 },
  ],
});

export const buyWithDiamonds = mutation({
  args: { itemId: v.string() },
  handler: async (ctx, { itemId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const items: Record<string, { days: number; cost: number }> = {
      d1: { days: 1, cost: 100 },
      d7: { days: 7, cost: 900 },
      d20: { days: 20, cost: 4000 },
      d35: { days: 35, cost: 9000 },
    };
    const item = items[itemId];
    if (!item) throw new Error("Item tidak ada");
    const me = await ctx.db.get(userId);
    if (!me) throw new Error("User not found");
    if ((me.diamonds ?? 0) < item.cost) throw new Error("Diamond tidak cukup");
    const base = Math.max(Date.now(), me.premiumUntil ?? 0);
    await ctx.db.patch(userId, {
      diamonds: (me.diamonds ?? 0) - item.cost,
      premiumUntil: base + item.days * 86400000,
    });
    return { ok: true };
  },
});

// ------------------------------------------------------------ klik game ----

export const clickStatus = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return { clicks: 0, diamonds: 0 };
    const day = new Date().toISOString().slice(0, 10);
    const row = await ctx.db
      .query("clickGame")
      .withIndex("userId_day", (q) => q.eq("userId", userId).eq("day", day))
      .first();
    return { clicks: row?.clicks ?? 0, diamonds: row?.diamondsEarned ?? 0 };
  },
});

export const clickTap = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const day = new Date().toISOString().slice(0, 10);
    let row = await ctx.db
      .query("clickGame")
      .withIndex("userId_day", (q) => q.eq("userId", userId).eq("day", day))
      .first();
    if (!row) {
      const id = await ctx.db.insert("clickGame", {
        userId,
        day,
        clicks: 0,
        diamondsEarned: 0,
      });
      row = await ctx.db.get(id);
    }
    const clicks = (row?.clicks ?? 0) + 1;
    await ctx.db.patch(row!._id, { clicks });
    const before = Math.floor((clicks - 1) / 5);
    const after = Math.floor(clicks / 5);
    let gained = 0;
    if (after > before) {
      gained = after - before;
      const me = await ctx.db.get(userId);
      await ctx.db.patch(userId, { diamonds: (me?.diamonds ?? 0) + gained });
      await ctx.db.patch(row!._id, { diamondsEarned: (row?.diamondsEarned ?? 0) + gained });
    }
    return { clicks, diamonds: row?.diamondsEarned ?? 0 + gained, gained };
  },
});
