// YoruNime — pertemanan: request, accept, reject, list teman.
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const listFriends = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const rows = await ctx.db
      .query("friendships")
      .withIndex("userA", (q) => q.eq("userA", userId))
      .collect();
    const rowsB = await ctx.db
      .query("friendships")
      .withIndex("userB", (q) => q.eq("userB", userId))
      .collect();
    const friends = [];
    for (const f of [...rows, ...rowsB]) {
      const friendId = f.userA === userId ? f.userB : f.userA;
      const u = await ctx.db.get(friendId);
      friends.push({
        friendshipId: f._id,
        userId: friendId,
        username: u?.username ?? "user",
        image: u?.image,
        level: u?.level,
        premium: (u?.premiumUntil ?? 0) > Date.now(),
      });
    }
    friends.sort((a, b) => a.username.localeCompare(b.username));
    return friends;
  },
});

export const listRequests = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const rows = await ctx.db
      .query("friendRequests")
      .withIndex("toUserId_status", (q) =>
        q.eq("toUserId", userId).eq("status", "pending"),
      )
      .collect();
    const out = [];
    for (const r of rows) {
      const u = await ctx.db.get(r.fromUserId);
      out.push({
        requestId: r._id,
        fromUserId: r.fromUserId,
        username: u?.username ?? "user",
        image: u?.image,
        level: u?.level,
      });
    }
    return out;
  },
});

export const sendFriendRequest = mutation({
  args: { toUserId: v.id("users") },
  handler: async (ctx, { toUserId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    if (userId === toUserId) throw new Error("Tidak bisa request diri sendiri");
    const target = await ctx.db.get(toUserId);
    if (!target) throw new Error("User tidak ada");
    if (target.autoRejectFriend) {
      const reject = target.autoRejectFriendAction ?? "reject";
      await ctx.db.insert("notifications", {
        userId,
        type: "request_rejected",
        title: `Request pertemanan mu ditolak oleh ${target.username ?? "user"}`,
        body: "Request pertemanan ke yang lain!",
        createdAt: Date.now(),
      });
      if (reject === "reject") return { autoRejected: true };
    }
    const dup = await ctx.db
      .query("friendRequests")
      .withIndex("fromUserId_status", (q) =>
        q.eq("fromUserId", userId).eq("status", "pending"),
      )
      .first();
    if (dup) throw new Error("Request sudah pernah dikirim");
    await ctx.db.insert("friendRequests", {
      fromUserId: userId,
      toUserId,
      status: "pending",
      createdAt: Date.now(),
    });
    await ctx.db.insert("notifications", {
      userId: toUserId,
      type: "friend_request",
      title: "Request pertemanan",
      body: "Terima atau tolak di request an",
      refUserId: userId,
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

export const respondRequest = mutation({
  args: { requestId: v.id("friendRequests"), accept: v.boolean() },
  handler: async (ctx, { requestId, accept }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const req = await ctx.db.get(requestId);
    if (!req || req.toUserId !== userId || req.status !== "pending")
      throw new Error("Request tidak ada");
    if (accept) {
      const existsA = await ctx.db
        .query("friendships")
        .withIndex("userA", (q) => q.eq("userA", req.fromUserId))
        .filter((q) => q.eq(q.field("userB"), userId))
        .first();
      if (!existsA) {
        await ctx.db.insert("friendships", {
          userA: req.fromUserId,
          userB: userId,
          createdAt: Date.now(),
        });
      }
    }
    await ctx.db.patch(requestId, { status: accept ? "accepted" : "rejected" });
    if (!accept) {
      const meUser = await ctx.db.get(userId);
      await ctx.db.insert("notifications", {
        userId: req.fromUserId,
        type: "request_rejected",
        title: `Request pertemanan mu ditolak oleh ${meUser?.username ?? "user"}`,
        body: "Request pertemanan ke yang lain!",
        createdAt: Date.now(),
      });
    }
    return { ok: true };
  },
});

/**
 * Balas request berdasarkan user pengirim (dipakai dari panel Notifikasi, yang
 * hanya menyimpan refUserId — bukan id request-nya).
 */
export const respondByUser = mutation({
  args: { fromUserId: v.id("users"), accept: v.boolean() },
  handler: async (ctx, { fromUserId, accept }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const req = await ctx.db
      .query("friendRequests")
      .withIndex("toUserId_status", (q) =>
        q.eq("toUserId", userId).eq("status", "pending"),
      )
      .filter((q) => q.eq(q.field("fromUserId"), fromUserId))
      .first();
    if (!req) throw new Error("Request tidak ada atau sudah dibalas");
    if (accept) {
      const existsA = await ctx.db
        .query("friendships")
        .withIndex("userA", (q) => q.eq("userA", req.fromUserId))
        .filter((q) => q.eq(q.field("userB"), userId))
        .first();
      if (!existsA) {
        await ctx.db.insert("friendships", {
          userA: req.fromUserId,
          userB: userId,
          createdAt: Date.now(),
        });
      }
    }
    await ctx.db.patch(req._id, { status: accept ? "accepted" : "rejected" });
    // Notifikasi request-nya sendiri dibersihkan supaya tidak muncul lagi.
    const notifs = await ctx.db
      .query("notifications")
      .withIndex("userId_created", (q) => q.eq("userId", userId))
      .collect();
    for (const n of notifs) {
      if (n.type === "friend_request" && n.refUserId === req.fromUserId) {
        await ctx.db.delete(n._id);
      }
    }
    if (!accept) {
      const meUser = await ctx.db.get(userId);
      await ctx.db.insert("notifications", {
        userId: req.fromUserId,
        type: "request_rejected",
        title: `Request pertemanan mu ditolak oleh ${meUser?.username ?? "user"}`,
        body: "Request pertemanan ke yang lain!",
        createdAt: Date.now(),
      });
    }
    return { ok: true };
  },
});

export const removeFriend = mutation({
  args: { friendshipId: v.id("friendships") },
  handler: async (ctx, { friendshipId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const f = await ctx.db.get(friendshipId);
    if (!f || (f.userA !== userId && f.userB !== userId))
      throw new Error("Tidak ada akses");
    await ctx.db.delete(friendshipId);
    return { ok: true };
  },
});
