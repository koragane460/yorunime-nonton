// LStream — absen harian, history, komentar anime, favorite, notifikasi.
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { addXpInternal } from "./xp";
import { requireActive } from "./moderation";

function dayString() {
  return new Date().toISOString().slice(0, 10);
}

// -------------------------------------------------------------- absen ----

export const ABSEN_REWARDS = [
  { day: 1, label: "5 💎 + 1 hari premium" },
  { day: 2, label: "100 XP" },
  { day: 3, label: "180 XP" },
  { day: 4, label: "30 💎 + 1 hari premium" },
  { day: 5, label: "200 XP" },
  { day: 6, label: "30 💎 + 300 XP" },
  { day: 7, label: "7 hari premium + 400 XP" },
];

export const absenStatus = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return { streak: 0, lastDay: null, claimedToday: false };
    const rows = await ctx.db
      .query("absenLogs")
      .withIndex("userId_day", (q) => q.eq("userId", userId))
      .collect();
    rows.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
    const today = dayString();
    const claimedToday = rows.some((r: any) => r.day === today);
    return { streak: rows.length % 7, lastDay: rows[rows.length - 1]?.day ?? null, claimedToday };
  },
});

export const absen = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const me = await ctx.db.get(userId);
    if (!me) throw new Error("User not found");
    const today = dayString();
    const already = await ctx.db
      .query("absenLogs")
      .withIndex("userId_day", (q) => q.eq("userId", userId).eq("day2", today))
      .first();
    if (already) throw new Error("Sudah absen hari ini");
    const rows = await ctx.db
      .query("absenLogs")
      .withIndex("userId_day", (q) => q.eq("userId", userId))
      .collect();
    const streak = rows.length % 7; // index reward hari ini (0-based)
    const day = streak + 1;
    await ctx.db.insert("absenLogs", { userId, day, day2: today, createdAt: Date.now() });
    let diamonds = 0;
    let premiumDays = 0;
    let xp = 0;
    if (day === 1) { diamonds = 5; premiumDays = 1; }
    else if (day === 2) xp = 100;
    else if (day === 3) xp = 180;
    else if (day === 4) { diamonds = 30; premiumDays = 1; }
    else if (day === 5) xp = 200;
    else if (day === 6) { diamonds = 30; xp = 300; }
    else if (day === 7) { premiumDays = 7; xp = 400; }
    const patch: Record<string, unknown> = {};
    if (diamonds) patch.diamonds = (me.diamonds ?? 0) + diamonds;
    if (premiumDays)
      patch.premiumUntil =
        Math.max(Date.now(), me.premiumUntil ?? 0) + premiumDays * 86400000;
    if (Object.keys(patch).length) await ctx.db.patch(userId, patch);
    if (xp) await addXpInternal(ctx, userId, xp, "absen");
    return { day, diamonds, premiumDays, xp };
  },
});

// ------------------------------------------------- history & favorite ----

export const recordWatch = mutation({
  args: {
    animeId: v.string(),
    animeTitle: v.string(),
    animeImage: v.optional(v.string()),
    episode: v.number(),
    minutes: v.number(),
  },
  handler: async (ctx, { animeId, animeTitle, animeImage, episode, minutes }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const me = await ctx.db.get(userId);
    if (!me) throw new Error("User not found");
    const existing = await ctx.db
      .query("watchHistory")
      .withIndex("userId_anime", (q) =>
        q.eq("userId", userId).eq("animeId", animeId),
      )
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        episode,
        minutesWatched: existing.minutesWatched + minutes,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("watchHistory", {
        userId,
        animeId,
        animeTitle,
        animeImage,
        episode,
        minutesWatched: minutes,
        updatedAt: Date.now(),
      });
    }
    await addXpInternal(ctx, userId, 10, "watch");
    return { ok: true };
  },
});

export const myHistory = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    return await ctx.db
      .query("watchHistory")
      .withIndex("userId_updated", (q) => q.eq("userId", userId))
      .order("desc")
      .take(30);
  },
});

export const toggleFavorite = mutation({
  args: {
    animeId: v.string(),
    animeTitle: v.string(),
    animeImage: v.optional(v.string()),
  },
  handler: async (ctx, { animeId, animeTitle, animeImage }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const existing = await ctx.db
      .query("animeFavorites")
      .withIndex("userId_anime", (q) =>
        q.eq("userId", userId).eq("animeId", animeId),
      )
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
      return { favorited: false };
    }
    await ctx.db.insert("animeFavorites", {
      userId,
      animeId,
      animeTitle,
      animeImage,
      createdAt: Date.now(),
    });
    return { favorited: true };
  },
});

export const myFavorites = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    return await ctx.db
      .query("animeFavorites")
      .withIndex("userId_anime", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const isFavorite = query({
  args: { animeId: v.string() },
  handler: async (ctx, { animeId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return false;
    const row = await ctx.db
      .query("animeFavorites")
      .withIndex("userId_anime", (q) =>
        q.eq("userId", userId).eq("animeId", animeId),
      )
      .first();
    return !!row;
  },
});

// ------------------------------------------------------------ komentar ----

export const listComments = query({
  args: { animeId: v.string() },
  handler: async (ctx, { animeId }) => {
    const rows = await ctx.db
      .query("animeComments")
      .withIndex("animeId_created", (q) => q.eq("animeId", animeId))
      .order("desc")
      .take(50);
    const out = [];
    for (const r of rows) {
      if (r.deleted) continue;
      const u = await ctx.db.get(r.userId);
      out.push({
        _id: r._id,
        userId: r.userId,
        username: u?.username ?? "user",
        image: u?.image,
        text: r.text,
        createdAt: r.createdAt,
      });
    }
    return out;
  },
});

export const postComment = mutation({
  args: { animeId: v.string(), text: v.string() },
  handler: async (ctx, { animeId, text }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const me = await ctx.db.get(userId);
    if (!me) throw new Error("User not found");
    await requireActive(me);
    if (text.trim().length === 0) throw new Error("Komentar kosong");
    await ctx.db.insert("animeComments", {
      animeId,
      userId,
      text: text.trim(),
      createdAt: Date.now(),
    });
    await addXpInternal(ctx, userId, 15, "comment");
    return { ok: true };
  },
});

export const deleteComment = mutation({
  args: { commentId: v.id("animeComments") },
  handler: async (ctx, { commentId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const c = await ctx.db.get(commentId);
    if (!c || c.userId !== userId) throw new Error("Bukan komentar kamu");
    await ctx.db.patch(commentId, { deleted: true });
    return { ok: true };
  },
});

// ------------------------------------------------------- notifikasi ----

export const listNotifications = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit = 30 }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const rows = await ctx.db
      .query("notifications")
      .withIndex("userId_created", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);
    const out = [];
    for (const n of rows) {
      let refImage;
      if (n.refUserId) {
        const u = await ctx.db.get(n.refUserId);
        refImage = u?.image;
      }
      out.push({ ...n, refImage });
    }
    return out;
  },
});

export const markNotificationsRead = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return { ok: false };
    const rows = await ctx.db
      .query("notifications")
      .withIndex("userId_created", (q) => q.eq("userId", userId))
      .order("desc")
      .take(50);
    for (const n of rows) {
      if (!n.read) await ctx.db.patch(n._id, { read: true });
    }
    return { ok: true };
  },
});

/** Simulasi notifikasi update aplikasi (untuk feed notifikasi). */
export const pushUpdateNotice = mutation({
  args: { version: v.string(), description: v.string() },
  handler: async (ctx, { version, description }) => {
    const users = await ctx.db.query("users").collect();
    for (const u of users.slice(0, 200)) {
      await ctx.db.insert("notifications", {
        userId: u._id,
        type: "update",
        title: `Update versi ${version}`,
        body: description,
        createdAt: Date.now(),
      });
    }
    return { ok: true };
  },
});
