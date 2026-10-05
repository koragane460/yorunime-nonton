/**
 * YoruNime: Story (foto/video yang hilang sendiri dalam 24 jam).
 *
 * Desain:
 *  - Media disimpan di file storage Convex, bukan base64 di dokumen.
 *  - `expiresAt` dihitung saat posting. Semua query memfilter
 *    `expiresAt > sekarang`, jadi story yang sudah lewat tidak pernah tampil,
 *    walau dokumennya belum dihapus. Penghapusan fisik dilakukan
 *    `purgeExpired`.
 *  - Penonton dicatat sekali per story per user, dan tidak bisa dihapus oleh
 *    penontonnya sendiri.
 */
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/** Umur story: 24 jam. */
const STORY_TTL_MS = 24 * 3600 * 1000;
/** Batas ukuran media yang diterima (25 MB, cukup untuk video pendek). */
export const MAX_STORY_BYTES = 25 * 1024 * 1024;

export const myStories = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const now = Date.now();
    const rows = await ctx.db
      .query("stories")
      .withIndex("userId_created", (q) => q.eq("userId", userId))
      .order("desc")
      .take(50);
    const live = rows.filter((r) => r.expiresAt > now);
    const out = [];
    for (const r of live) {
      const views = await ctx.db
        .query("storyViews")
        .withIndex("storyId_created", (q) => q.eq("storyId", r._id))
        .take(500);
      out.push({
        _id: r._id,
        storageId: r.storageId,
        mediaType: r.mediaType,
        caption: r.caption ?? "",
        musicKey: r.musicKey,
        createdAt: r.createdAt,
        expiresAt: r.expiresAt,
        viewCount: views.length,
      });
    }
    return out;
  },
});

/**
 * Daftar story dari semua user yang masih hidup, terbaru dulu.
 *
 * Sengaja tidak memfilter "hanya teman": ini app komunitas kecil, story di
 * halaman Akun dipakai juga untuk menonton story orang lain dari detail akun.
 */
export const allStories = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const rows = await ctx.db.query("stories").order("desc").take(120);
    const live = rows.filter((r) => r.expiresAt > now);
    const grouped = new Map<string, typeof live>();
    for (const r of live) {
      const key = String(r.userId);
      grouped.set(key, [...(grouped.get(key) ?? []), r]);
    }
    const out = [];
    for (const [uid, list] of grouped) {
      const u: any = await ctx.db.get(uid as never);
      if (!u) continue;
      // Dilihat oleh saya?
      const me = await getAuthUserId(ctx);
      let seen = false;
      if (me) {
        for (const r of list) {
          const v = await ctx.db
            .query("storyViews")
            .withIndex("storyId_user", (q) =>
              q.eq("storyId", r._id).eq("userId", me),
            )
            .first();
          if (v) {
            seen = true;
            break;
          }
        }
      }
      out.push({
        userId: uid,
        username: u.username ?? "user",
        userImage: u.image,
        hasUnseen: !seen,
        stories: list.map((r) => ({
          _id: r._id,
          storageId: r.storageId,
          mediaType: r.mediaType,
          caption: r.caption ?? "",
          musicKey: r.musicKey,
          createdAt: r.createdAt,
        })),
      });
    }
    return out;
  },
});

/**
 * Posting story.
 *
 * `storageId` didapat dari `storage.getUploadUrl` (dipakai panel komposisi).
 * `caption` opsional, `musicKey` opsional (kunci lagu bebas-royalti).
 */
export const addStory = mutation({
  args: {
    storageId: v.string(),
    mediaType: v.union(v.literal("image"), v.literal("video")),
    caption: v.optional(v.string()),
    musicKey: v.optional(v.string()),
  },
  handler: async (ctx, { storageId, mediaType, caption, musicKey }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Belum masuk");
    const now = Date.now();
    const id = await ctx.db.insert("stories", {
      userId,
      storageId,
      mediaType,
      caption: caption?.trim() || undefined,
      musicKey: musicKey || undefined,
      createdAt: now,
      expiresAt: now + STORY_TTL_MS,
    });
    return { id, expiresAt: now + STORY_TTL_MS };
  },
});

/** Catat bahwa user ini melihat sebuah story (sekali saja). */
export const markViewed = mutation({
  args: { storyId: v.id("stories") },
  handler: async (ctx, { storyId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return { ok: false as const };
    const existing = await ctx.db
      .query("storyViews")
      .withIndex("storyId_user", (q) =>
        q.eq("storyId", storyId).eq("userId", userId),
      )
      .first();
    if (existing) return { ok: true as const, already: true };
    await ctx.db.insert("storyViews", {
      storyId,
      userId,
      createdAt: Date.now(),
    });
    return { ok: true as const, already: false };
  },
});

/** Daftar penonton story milik sendiri (foto profil + username). */
export const viewers = query({
  args: { storyId: v.id("stories") },
  handler: async (ctx, { storyId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const story = await ctx.db.get(storyId);
    if (!story || story.userId !== userId) return [];
    const views = await ctx.db
      .query("storyViews")
      .withIndex("storyId_created", (q) => q.eq("storyId", storyId))
      .order("desc")
      .take(500);
    const out = [];
    for (const v of views) {
      const u: any = await ctx.db.get(v.userId);
      if (!u) continue;
      out.push({
        userId: v.userId,
        username: u.username ?? "user",
        userImage: u.image,
        at: v.createdAt,
      });
    }
    return out;
  },
});

/** Hapus story milik sendiri. */
export const removeStory = mutation({
  args: { storyId: v.id("stories") },
  handler: async (ctx, { storyId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Belum masuk");
    const story = await ctx.db.get(storyId);
    if (!story) return { ok: true as const };
    if (story.userId !== userId) throw new Error("Bukan story kamu");
    // Bersihkan penonton dulu supaya tidak ada baris yatim.
    const views = await ctx.db
      .query("storyViews")
      .withIndex("storyId_created", (q) => q.eq("storyId", storyId))
      .take(500);
    for (const v of views) await ctx.db.delete(v._id);
    await ctx.db.delete(storyId);
    return { ok: true as const };
  },
});

/**
 * Hapus fisik story yang sudah lewat 24 jam.
 *
 * Dipanggil berkala dari UI. Tanpa ini dokumen story menumpuk, meskipun UI
 * sudah memfilternya dan tidak pernah menampilkannya.
 */
export const purgeExpired = mutation({
  args: {},
  handler: async (ctx): Promise<{ removed: number }> => {
    const now = Date.now();
    let removed = 0;
    const rows = await ctx.db.query("stories").order("desc").take(300);
    for (const r of rows) {
      if (r.expiresAt > now) continue;
      const views = await ctx.db
        .query("storyViews")
        .withIndex("storyId_created", (q) => q.eq("storyId", r._id))
        .take(500);
      for (const v of views) await ctx.db.delete(v._id);
      await ctx.db.delete(r._id);
      removed += 1;
    }
    return { removed };
  },
});

/** Semua story milik satu user (dipakai layar detail akun). */
export const storiesOf = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const now = Date.now();
    const rows = await ctx.db
      .query("stories")
      .withIndex("userId_created", (q) => q.eq("userId", userId))
      .order("desc")
      .take(50);
    const live = rows.filter((r) => r.expiresAt > now);
    return live.map((r) => ({
      _id: r._id,
      storageId: r.storageId,
      mediaType: r.mediaType,
      caption: r.caption ?? "",
      musicKey: r.musicKey,
      createdAt: r.createdAt,
    }));
  },
});
