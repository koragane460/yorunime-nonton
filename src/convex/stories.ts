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

/** Apakah `a` dan `b` berteman (baris friendships bisa di dua arah). */
async function isFriend(ctx: any, a: any, b: any): Promise<boolean> {
  if (a === b) return true;
  const asA = await ctx.db
    .query("friendships")
    .withIndex("userA", (q: any) => q.eq("userA", a))
    .filter((q: any) => q.eq(q.field("userB"), b))
    .first();
  if (asA) return true;
  const asB = await ctx.db
    .query("friendships")
    .withIndex("userB", (q: any) => q.eq("userB", a))
    .filter((q: any) => q.eq(q.field("userA"), b))
    .first();
  return !!asB;
}

/**
 * Saring story sesuai privasi untuk penonton `me`.
 *  - "diri"  : hanya pemilik.
 *  - "teman" : pemilik + teman.
 *  - "all"   : semua orang (termasuk yang belum masuk).
 */
async function visibleTo(ctx: any, me: any, ownerId: any, privacy?: string) {
  if (me && String(me) === String(ownerId)) return true;
  const p = privacy ?? "all";
  if (p === "all") return true;
  if (!me) return false;
  if (p === "diri") return false;
  return await isFriend(ctx, me, ownerId);
}

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
    const me = await getAuthUserId(ctx);
    const rows = await ctx.db.query("stories").order("desc").take(120);
    const liveRaw = rows.filter((r) => r.expiresAt > now);
    // Privasi dulu: story "diri"/"teman" tidak boleh bocor ke feed publik.
    const live = [];
    for (const r of liveRaw) {
      if (await visibleTo(ctx, me, r.userId, r.privacy)) live.push(r);
    }
    // Semua story yang saya sudah lihat diambil SEKALI (bukan dicek per story
    // di dalam loop). Query sebelumnya melakukan 1-3 pembacaan database
    // tambahan untuk setiap user + setiap story, dan karena query Convex
    // reactive, semuanya jalan ulang setiap ada story baru atau penonton
    // baru. Itu biaya yang terasa saat app dipakai ramai.
    const myViews = new Set<string>();
    if (me) {
      const seenRows = await ctx.db
        .query("storyViews")
        .withIndex("userId", (q) => q.eq("userId", me))
        .take(500);
      for (const v of seenRows) myViews.add(String(v.storyId));
    }
    const grouped = new Map<string, typeof live>();
    for (const r of live) {
      const key = String(r.userId);
      grouped.set(key, [...(grouped.get(key) ?? []), r]);
    }
    const out = [];
    for (const [uid, list] of grouped) {
      const u: any = await ctx.db.get(uid as never);
      if (!u) continue;
      const seen = list.every((r) => myViews.has(String(r._id)));
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
          music: r.music,
          privacy: r.privacy,
          crop: r.crop,
          texts: r.texts,
          stickers: r.stickers,
          mediaVol: r.mediaVol,
          musicVol: r.musicVol,
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
    privacy: v.optional(
      v.union(v.literal("all"), v.literal("teman"), v.literal("diri")),
    ),
    music: v.optional(
      v.object({
        title: v.string(),
        artist: v.string(),
        cover: v.optional(v.string()),
        audioUrl: v.optional(v.string()),
        source: v.optional(v.string()),
      }),
    ),
    mediaVol: v.optional(v.number()),
    musicVol: v.optional(v.number()),
    crop: v.optional(
      v.object({
        aspect: v.string(),
        zoom: v.optional(v.number()),
      }),
    ),
    texts: v.optional(
      v.array(
        v.object({
          text: v.string(),
          color: v.string(),
          outline: v.boolean(),
          bg: v.boolean(),
          font: v.string(),
          x: v.number(),
          y: v.number(),
          scale: v.optional(v.number()),
          rotate: v.optional(v.number()),
        }),
      ),
    ),
    stickers: v.optional(
      v.array(
        v.object({
          emoji: v.string(),
          x: v.number(),
          y: v.number(),
          size: v.number(),
          rotate: v.optional(v.number()),
        }),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Belum masuk");
    const now = Date.now();
    // Batasi jumlah lapisan supaya dokumen tidak membengkak.
    const texts = (args.texts ?? [])
      .filter((t) => t.text.trim().length > 0)
      .slice(0, 12);
    const stickers = (args.stickers ?? []).slice(0, 20);
    const id = await ctx.db.insert("stories", {
      userId,
      storageId: args.storageId,
      mediaType: args.mediaType,
      caption: args.caption?.trim() || undefined,
      musicKey: args.musicKey || undefined,
      privacy: args.privacy ?? "all",
      music: args.music,
      mediaVol: args.mediaVol,
      musicVol: args.musicVol,
      crop: args.crop,
      texts: texts.length > 0 ? texts : undefined,
      stickers: stickers.length > 0 ? stickers : undefined,
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
    const me = await getAuthUserId(ctx);
    const rows = await ctx.db
      .query("stories")
      .withIndex("userId_created", (q) => q.eq("userId", userId))
      .order("desc")
      .take(50);
    const out = [];
    for (const r of rows) {
      if (r.expiresAt <= now) continue;
      if (!(await visibleTo(ctx, me, r.userId, r.privacy))) continue;
      out.push({
        _id: r._id,
        storageId: r.storageId,
        mediaType: r.mediaType,
        caption: r.caption ?? "",
        musicKey: r.musicKey,
        music: r.music,
        privacy: r.privacy,
        crop: r.crop,
        texts: r.texts,
        stickers: r.stickers,
        mediaVol: r.mediaVol,
        musicVol: r.musicVol,
        createdAt: r.createdAt,
      });
    }
    return out;
  },
});
