// LStream — history, komentar anime (like/reply/populer), favorite, notifikasi.
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { addXpInternal } from "./xp";
import { requireActive } from "./moderation";

function dayString() {
  return new Date().toISOString().slice(0, 10);
}

// ------------------------------------------------------------ komentar ----

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
  args: {
    animeId: v.string(),
    sort: v.optional(v.union(v.literal("terbaru"), v.literal("populer"))),
  },
  handler: async (ctx, { animeId, sort = "terbaru" }) => {
    const rows = await ctx.db
      .query("animeComments")
      .withIndex("animeId_created", (q) => q.eq("animeId", animeId))
      .order("desc")
      .take(120);
    const alive = rows.filter((r) => !r.deleted);
    const users = new Map<string, any>();
    const out = [];
    for (const r of alive) {
      let u = users.get(r.userId);
      if (!u) {
        u = await ctx.db.get(r.userId);
        users.set(r.userId, u);
      }
      out.push({
        _id: r._id,
        userId: r.userId,
        username: u?.username ?? "user",
        image: u?.image,
        bannerUrl: u?.bannerUrl,
        premium: (u?.premiumUntil ?? 0) > Date.now(),
        clanTag: u?.clanTag,
        clanTagIcon: u?.clanTagIcon,
        clanNameColor: u?.clanNameColor,
        text: r.text,
        likes: r.likes ?? [],
        likeCount: (r.likes ?? []).length,
        replyToId: r.replyToId,
        createdAt: r.createdAt,
      });
    }
    if (sort === "populer") out.sort((a, b) => b.likeCount - a.likeCount);
    return out;
  },
});

export const postComment = mutation({
  args: { animeId: v.string(), text: v.string(), replyToId: v.optional(v.id("animeComments")) },
  handler: async (ctx, { animeId, text, replyToId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const me = await ctx.db.get(userId);
    if (!me) throw new Error("User not found");
    await requireActive(me);
    if (text.trim().length === 0) throw new Error("Komentar kosong");
    const commentId = await ctx.db.insert("animeComments", {
      animeId,
      userId,
      text: text.trim(),
      replyToId,
      likes: [],
      createdAt: Date.now(),
    });
    // Balasan → notif ke pemilik komentar induk
    if (replyToId) {
      const parent = await ctx.db.get(replyToId);
      if (parent && parent.userId !== userId) {
        await ctx.db.insert("notifications", {
          userId: parent.userId,
          type: "reply",
          title: `${me.username ?? "Seseorang"} membalas komentarmu`,
          body: text.trim().slice(0, 100),
          refUserId: userId,
          createdAt: Date.now(),
        });
      }
    }
    await addXpInternal(ctx, userId, 15, "comment");
    return { commentId };
  },
});

/** Like / unlike komentar anime → notif ke pemilik komentar. */
export const toggleCommentLike = mutation({
  args: { commentId: v.id("animeComments") },
  handler: async (ctx, { commentId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const c = await ctx.db.get(commentId);
    if (!c || c.deleted) throw new Error("Komentar tidak ada");
    const likes = (c.likes ?? []).filter((l) => l !== userId);
    let liked = false;
    if (!likes.some((l) => l === userId) && !(c.likes ?? []).includes(userId)) {
      likes.push(userId);
      liked = true;
    }
    await ctx.db.patch(commentId, { likes });
    if (liked && c.userId !== userId) {
      const me = await ctx.db.get(userId);
      await ctx.db.insert("notifications", {
        userId: c.userId,
        type: "like",
        title: `${me?.username ?? "Seseorang"} menyukai komentarmu`,
        body: c.text.slice(0, 100),
        refUserId: userId,
        createdAt: Date.now(),
      });
    }
    return { liked, likeCount: likes.length };
  },
});

/** Komentar teman-teman di semua anime (untuk panel akun, terbaru dulu). */
export const myFriendsComments = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit = 30 }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const me = await ctx.db.get(userId);
    if (!me) return [];
    // Info page: hanya komentar dari developer/staff
    const rows = await ctx.db
      .query("animeComments")
      .order("desc")
      .take(400);
    const out = [];
    for (const r of rows) {
      if (r.deleted) continue;
      const u = await ctx.db.get(r.userId);
      const isDev =
        u?.role === "admin" ||
        u?.staffRole === "dev" ||
        u?.staffRole === "creator" ||
        u?.staffRole === "mod";
      if (!isDev) continue;
      out.push({
        _id: r._id,
        animeId: r.animeId,
        userId: r.userId,
        username: u?.username ?? "user",
        image: u?.image,
        bannerUrl: u?.bannerUrl,
        premium: (u?.premiumUntil ?? 0) > Date.now(),
        staffRole: u?.staffRole,
        text: r.text,
        likeCount: (r.likes ?? []).length,
        createdAt: r.createdAt,
      });
      if (out.length >= (limit ?? 30)) break;
    }
    return out;
  },
});

/** Lapor pesan chat → masuk notifikasi developer. */
export const reportChatMessage = mutation({
  args: {
    messageId: v.id("chatMessages"),
    reason: v.string(),
    detail: v.optional(v.string()),
  },
  handler: async (ctx, { messageId, reason, detail }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const msg = await ctx.db.get(messageId);
    if (!msg) throw new Error("Pesan tidak ada");
    const reporter = await ctx.db.get(userId);
    await ctx.db.insert("contentReports", {
      reporterId: userId,
      messageId,
      reason,
      detail,
      text: msg.text ?? undefined,
      createdAt: Date.now(),
    });
    // Notifikasi ke semua developer/mod
    const staff = await ctx.db.query("users").collect();
    for (const s of staff) {
      const isDev =
        s.role === "admin" || s.staffRole === "dev" || s.staffRole === "creator";
      const isMod = isDev || s.staffRole === "mod";
      if (!isDev && !isMod) continue;
      await ctx.db.insert("notifications", {
        userId: s._id,
        type: "report",
        title: `Laporan chat: ${reason}`,
        body: `${reporter?.username ?? "Seseorang"} melaporkan: "${(msg.text ?? "[foto]").slice(0, 80)}"`,
        refMessageId: messageId,
        refUserId: msg.userId,
        createdAt: Date.now(),
      });
    }
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
