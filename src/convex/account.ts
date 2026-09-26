// LStream — akun: bootstrap profil, pengaturan, banner, leaderboard total.
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { xpForLevel, tierForLevel } from "./users";

export const ensureUser = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const user = await ctx.db.get(userId);
    if (!user) return null;
    const patch: Record<string, unknown> = {};
    if (user.username === undefined) {
      const base =
        (user.name ?? user.email?.split("@")[0] ?? "user")
          .replace(/[^a-zA-Z0-9_]/g, "")
          .slice(0, 16) || "user";
      let candidate = base;
      let n = 1;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const clash = await ctx.db
          .query("users")
          .withIndex("username", (q) => q.eq("username", candidate))
          .first();
        if (!clash || clash._id === userId) break;
        candidate = `${base}${n++}`;
      }
      patch.username = candidate;
    }
    if (user.xp === undefined) patch.xp = 0;
    if (user.level === undefined) patch.level = 1;
    if (user.diamonds === undefined) patch.diamonds = 45000;
    if (user.createdAt === undefined) patch.createdAt = Date.now();
    if (user.nsfwStrikes === undefined) patch.nsfwStrikes = 0;
    if (user.theme === undefined) patch.theme = "dark";
    if (Object.keys(patch).length > 0) await ctx.db.patch(userId, patch);
    return await ctx.db.get(userId);
  },
});

export const updateProfile = mutation({
  args: {
    username: v.optional(v.string()),
    image: v.optional(v.string()),
    bannerUrl: v.optional(v.string()),
  },
  handler: async (ctx, { username, image, bannerUrl }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const patch: Record<string, unknown> = {};
    if (username !== undefined) {
      const clean = username.trim().replace(/[^a-zA-Z0-9_]/g, "");
      if (clean.length < 3) throw new Error("Username minimal 3 karakter");
      const clash = await ctx.db
        .query("users")
        .withIndex("username", (q) => q.eq("username", clean))
        .first();
      if (clash && clash._id !== userId) throw new Error("Username sudah dipakai");
      patch.username = clean;
    }
    if (image !== undefined) patch.image = image;
    if (bannerUrl !== undefined) patch.bannerUrl = bannerUrl;
    if (Object.keys(patch).length > 0) await ctx.db.patch(userId, patch);
    return await ctx.db.get(userId);
  },
});

export const updateSettings = mutation({
  args: {
    hideOnline: v.optional(v.boolean()),
    autoRejectFriend: v.optional(v.boolean()),
    autoRejectFriendAction: v.optional(v.string()),
    defaultQuality: v.optional(v.string()),
    defaultSpeed: v.optional(v.number()),
    theme: v.optional(v.string()),
    customColor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const patch: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(args)) {
      if (val !== undefined) patch[k] = val;
    }
    await ctx.db.patch(userId, patch);
    return await ctx.db.get(userId);
  },
});

export const totalLeaderboard = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit = 50 }) => {
    const users = await ctx.db.query("users").collect();
    const sorted = users
      .map((u) => ({
        userId: u._id,
        username: u.username,
        image: u.image,
        level: u.level,
        xp: u.xp ?? 0,
      }))
      .sort((a, b) => b.xp - a.xp)
      .slice(0, Math.min(limit, 50))
      .map((e, i) => ({ rank: i + 1, ...e }));
    return sorted;
  },
});

export const topGive = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit = 10 }) => {
    const gives = await ctx.db.query("premiumGives").collect();
    const totals = new Map<string, number>();
    for (const g of gives) {
      totals.set(
        g.fromUserId,
        (totals.get(g.fromUserId) ?? 0) + g.days * g.slots,
      );
    }
    const users = await ctx.db.query("users").collect();
    const byId = new Map(users.map((u) => [u._id, u]));
    return [...totals.entries()]
      .map(([userId, days]) => ({
        userId,
        username: byId.get(userId as any)?.username ?? "user",
        image: byId.get(userId as any)?.image,
        days,
      }))
      .sort((a, b) => b.days - a.days)
      .slice(0, limit);
  },
});

export const profileStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const me = await ctx.db.get(userId);
    if (!me) return null;
    const history = await ctx.db
      .query("watchHistory")
      .withIndex("userId_updated", (q) => q.eq("userId", userId))
      .collect();
    const comments = await ctx.db
      .query("animeComments")
      .filter((q: any) => q.eq(q.field("userId"), userId))
      .collect();
    const minutes = history.reduce((s, h) => s + (h.minutesWatched ?? 0), 0);
    return {
      watchCount: history.length,
      commentCount: comments.length,
      minutesWatched: minutes,
      joinedDays: Math.max(
        0,
        Math.floor((Date.now() - (me.createdAt ?? Date.now())) / 86400000),
      ),
    };
  },
});

export { xpForLevel, tierForLevel };
