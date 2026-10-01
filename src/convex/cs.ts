import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { staffGuard } from "./moderation";

/** Balasan bot saat user mengirim pesan pertama. */
const BOT_REPLY =
  "Pesan mu terkirim, tunggu untuk developer memberi tanggapan";

/** Setelah CS selesai, user harus tunggu sebelum bisa buka lagi. */
const COOLDOWN_MS = 24 * 60 * 60 * 1000;

const ACTIVE: ("waiting" | "open")[] = ["waiting", "open"];

/** Bot Customer Service: pesan otomatis, hanya untuk First Response. */
export const BOT_REPLY_TEXT = BOT_REPLY;

// ------------------------------------------------------------- queries ----

/** Thread milik user yang sedang login (jika ada). */
export const myThread = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const me = await ctx.db.get(userId);
    if (!me) return null;
    const now = Date.now();
    const all = await ctx.db
      .query("csThreads")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect();
    const active = all.find((t) => ACTIVE.includes(t.status as "waiting" | "open"));
    if (active) {
      return {
        threadId: active._id,
        status: active.status,
        cooldownUntil: 0,
        canOpen: true,
        startedAt: active.startedAt,
      };
    }
    const last = all.sort((a, b) => b.lastMessageAt - a.lastMessageAt)[0];
    const cooldownUntil = last?.cooldownUntil ?? 0;
    return {
      threadId: null,
      status: (last?.status ?? "ended") as "waiting" | "open" | "ended" | "rejected",
      cooldownUntil,
      canOpen: cooldownUntil <= now,
      startedAt: last?.startedAt ?? 0,
    };
  },
});

/** Isi percakapan. User hanya boleh membaca thread-nya sendiri. */
export const threadMessages = query({
  args: { threadId: v.id("csThreads") },
  handler: async (ctx, { threadId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const thread = await ctx.db.get(threadId);
    if (!thread) return [];
    const isOwner = thread.userId === userId;
    if (!isOwner) {
      try {
        await staffGuard(ctx, "dev");
      } catch {
        return [];
      }
    }
    const msgs = await ctx.db
      .query("csMessages")
      .withIndex("threadId_created", (q) => q.eq("threadId", threadId))
      .collect();
    return msgs.map((m) => ({
      _id: m._id,
      from: m.from,
      text: m.text,
      createdAt: m.createdAt,
    }));
  },
});

/** Antrean percakapan untuk developer: menunggu + yang sudah diterima. */
export const devQueue = query({
  args: {},
  handler: async (ctx) => {
    await staffGuard(ctx, "dev");
    const now = Date.now();
    const waiting = await ctx.db
      .query("csThreads")
      .withIndex("status_lastMessage", (q) => q.eq("status", "waiting"))
      .collect();
    const open = await ctx.db
      .query("csThreads")
      .withIndex("status_lastMessage", (q) => q.eq("status", "open"))
      .collect();
    const byNewest = (
      a: { lastMessageAt: number },
      b: { lastMessageAt: number },
    ) => b.lastMessageAt - a.lastMessageAt;
    const shape = async (t: {
      _id: any;
      userId: any;
      status: string;
      startedAt: number;
      lastMessageAt: number;
      lastUserMessage?: string;
    }) => {
      const u: any = await ctx.db.get(t.userId);
      return {
        threadId: t._id,
        userId: t.userId,
        username: u?.username ?? "user",
        image: u?.image,
        level: u?.level ?? 1,
        lastMessage: t.lastMessageAt,
        preview: t.lastUserMessage ?? "",
        startedAt: t.startedAt,
        ageMin: Math.max(0, Math.round((now - t.lastMessageAt) / 60000)),
      };
    };
    const w = await Promise.all([...waiting].sort(byNewest).map(shape));
    const o = await Promise.all(
      [...open].sort(byNewest).map(async (t) => ({
        ...(await shape(t)),
        acceptedAt: t.acceptedAt ?? t.startedAt,
      })),
    );
    return { waiting: w, open: o };
  },
});

/** Detail satu thread untuk layar chat developer. */
export const devThreadInfo = query({
  args: { threadId: v.id("csThreads") },
  handler: async (ctx, { threadId }) => {
    await staffGuard(ctx, "dev");
    const t = await ctx.db.get(threadId);
    if (!t) return null;
    const u: any = await ctx.db.get(t.userId);
    return {
      threadId: t._id,
      username: u?.username ?? "user",
      image: u?.image,
      level: u?.level ?? 1,
      status: t.status,
      startedAt: t.startedAt,
    };
  },
});

// ----------------------------------------------------------- mutations ----

/**
 * User mengirim pesan. Kalau ini percakapan pertama, thread dibuat dengan
 * status "waiting" dan bot membalas otomatis. Composer terkunci sampai
 * developer menerima.
 */
export const sendMessage = mutation({
  args: { text: v.string() },
  handler: async (ctx, { text }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Belum masuk");
    const body = text.trim();
    if (!body) throw new Error("Pesan kosong");
    if (body.length > 2000) throw new Error("Pesan terlalu panjang");
    const me = await ctx.db.get(userId);
    if (!me) throw new Error("Belum masuk");

    const all = await ctx.db
      .query("csThreads")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect();
    const active = all.find((t) => ACTIVE.includes(t.status as "waiting" | "open"));

    if (!active) {
      const last = all.sort((a, b) => b.lastMessageAt - a.lastMessageAt)[0];
      if (last && (last.cooldownUntil ?? 0) > Date.now())
        throw new Error("CS untuk akun ini sudah selesai. Coba lagi besok.");
      const now = Date.now();
      const threadId = await ctx.db.insert("csThreads", {
        userId,
        status: "waiting",
        startedAt: now,
        lastMessageAt: now,
        lastUserMessage: body.slice(0, 140),
      });
      await ctx.db.insert("csMessages", {
        threadId,
        from: "user",
        text: body,
        createdAt: now,
      });
      await ctx.db.insert("csMessages", {
        threadId,
        from: "bot",
        text: BOT_REPLY,
        createdAt: now + 1,
      });
      return { threadId };
    }

    if (active.status !== "open")
      throw new Error("Menunggu developer menerima pesan kamu");
    const now = Date.now();
    await ctx.db.insert("csMessages", {
      threadId: active._id,
      from: "user",
      text: body,
      createdAt: now,
    });
    await ctx.db.patch(active._id, {
      lastMessageAt: now,
      lastUserMessage: body.slice(0, 140),
    });
    return { threadId: active._id };
  },
});

/** Developer membalas pesan user. */
export const devReply = mutation({
  args: { threadId: v.id("csThreads"), text: v.string() },
  handler: async (ctx, { threadId, text }) => {
    await staffGuard(ctx, "dev");
    const body = text.trim();
    if (!body) throw new Error("Pesan kosong");
    const thread = await ctx.db.get(threadId);
    if (!thread) throw new Error("Percakapan tidak ada");
    if (thread.status !== "open") throw new Error("Percakapan sudah ditutup");
    const now = Date.now();
    await ctx.db.insert("csMessages", {
      threadId,
      from: "dev",
      text: body,
      createdAt: now,
    });
    await ctx.db.patch(threadId, { lastMessageAt: now });
    return null;
  },
});

/** Developer menerima permintaan CS -> kolom chat user terbuka. */
export const accept = mutation({
  args: { threadId: v.id("csThreads") },
  handler: async (ctx, { threadId }) => {
    await staffGuard(ctx, "dev");
    const thread = await ctx.db.get(threadId);
    if (!thread) throw new Error("Percakapan tidak ada");
    if (thread.status !== "waiting") return null;
    const now = Date.now();
    await ctx.db.patch(threadId, { status: "open", acceptedAt: now });
    await ctx.db.insert("notifications", {
      userId: thread.userId,
      type: "moderation",
      title: "Permintaan CS diterima",
      body: "Developer sudah menerima permintaan kamu. Silakan lanjut chat.",
      createdAt: now,
      read: false,
    });
    return null;
  },
});

/** Developer menolak -> thread hilang dari daftar, user diberi tahu. */
export const reject = mutation({
  args: { threadId: v.id("csThreads") },
  handler: async (ctx, { threadId }) => {
    await staffGuard(ctx, "dev");
    const thread = await ctx.db.get(threadId);
    if (!thread) throw new Error("Percakapan tidak ada");
    const now = Date.now();
    await ctx.db.patch(threadId, {
      status: "rejected",
      closedAt: now,
      lastMessageAt: now,
      cooldownUntil: now + COOLDOWN_MS,
    });
    await ctx.db.insert("notifications", {
      userId: thread.userId,
      type: "moderation",
      title: "Permintaan CS ditolak",
      body: "Permintaan customer service kamu ditolak. Coba lagi nanti.",
      createdAt: now,
      read: false,
    });
    return null;
  },
});

/** Developer mengakhiri CS. User harus tunggu 1 hari sebelum buka lagi. */
export const endThread = mutation({
  args: { threadId: v.id("csThreads") },
  handler: async (ctx, { threadId }) => {
    await staffGuard(ctx, "dev");
    const thread = await ctx.db.get(threadId);
    if (!thread) throw new Error("Percakapan tidak ada");
    const now = Date.now();
    await ctx.db.patch(threadId, {
      status: "ended",
      closedAt: now,
      lastMessageAt: now,
      cooldownUntil: now + COOLDOWN_MS,
    });
    await ctx.db.insert("notifications", {
      userId: thread.userId,
      type: "moderation",
      title: "Customer service selesai",
      body: "Percakapan ditutup developer. Kamu bisa buka CS lagi setelah 1 hari.",
      createdAt: now,
      read: false,
    });
    return null;
  },
});