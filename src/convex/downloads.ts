// YoruNime — antrean unduhan episode.
//
// File video TIDAK disimpan di server. Yang disimpan di sini hanya daftar
// unduhan user (anime, episode, kualitas, URL, status, ukuran). Blob-nya
// sendiri disimpan di IndexedDB browser lewat `localKey`, jadi:
//
//  - "Tonton offline" = memutar blob dari IndexedDB.
//  - "Simpan ke perangkat" = browser mengunduh ulang / menyimpan blob ke
//    penyimpanan HP user (juga tetap di perangkat, bukan ke server kita).
//
// Server tetap memegang status supaya daftar unduhan konsisten di semua tab
// dan tetap ada meski cache browser dibersihkan.
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/** Daftar unduhan user, terbaru dulu. */
/** Kuota unduhan per hari per user — berlaku di seluruh aplikasi. */
export const DAILY_DOWNLOAD_LIMIT = 5;

export const myDownloads = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    return await ctx.db
      .query("downloads")
      .withIndex("userId_created", (q) => q.eq("userId", userId))
      .order("desc")
      .take(200);
  },
});

/** Ringkasan untuk header layar Download (total file, ukuran, status). */
export const downloadStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null)
      return { total: 0, done: 0, downloading: 0, failed: 0, bytes: 0 };
    const rows = await ctx.db
      .query("downloads")
      .withIndex("userId_created", (q) => q.eq("userId", userId))
      .order("desc")
      .take(200);
    let done = 0;
    let downloading = 0;
    let failed = 0;
    let bytes = 0;
    for (const r of rows) {
      if (r.status === "done") {
        done += 1;
        bytes += r.bytes ?? 0;
      } else if (r.status === "downloading") downloading += 1;
      else if (r.status === "failed") failed += 1;
    }
    // Unduhan yang dimulai hari ini (batas 5/hari).
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const today = rows.filter((r) => r.createdAt >= dayStart.getTime()).length;
    return { total: rows.length, done, downloading, failed, bytes, today };
  },
});

/**
 * Daftarkan unduhan baru. Idempoten per (anime, episode, kualitas): menekan
 * Download dua kali tidak membuat dua baris.
 */
export const enqueue = mutation({
  args: {
    animeId: v.string(),
    animeTitle: v.string(),
    animeImage: v.optional(v.string()),
    episode: v.number(),
    episodeId: v.optional(v.string()),
    quality: v.string(),
    url: v.string(),
  },
  handler: async (
    ctx,
    { animeId, animeTitle, animeImage, episode, episodeId, quality, url },
  ) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const existing = await ctx.db
      .query("downloads")
      .withIndex("userId_created", (q) => q.eq("userId", userId))
      .order("desc")
      .take(200);
    const dup = existing.find(
      (r) =>
        r.animeId === animeId &&
        r.episode === episode &&
        r.quality === quality,
    );
    if (dup) return { ok: true as const, id: dup._id, existed: true };
    // Batas unduhan: maksimal 5 per hari kalender per user.
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const todayCount = existing.filter((r) => r.createdAt >= dayStart.getTime()).length;
    if (todayCount >= DAILY_DOWNLOAD_LIMIT) {
      throw new Error("Batas 5 unduhan per hari tercapai. Coba lagi besok.");
    }
    const id = await ctx.db.insert("downloads", {
      userId,
      animeId,
      animeTitle,
      animeImage,
      episode,
      episodeId,
      quality,
      url,
      status: "queued",
      progress: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return { ok: true as const, id, existed: false };
  },
});

/** Perbarui progres / status unduhan (dipanggil worker unduhan di client). */
export const updateProgress = mutation({
  args: {
    id: v.id("downloads"),
    status: v.optional(
      v.union(
        v.literal("queued"),
        v.literal("downloading"),
        v.literal("done"),
        v.literal("failed"),
      ),
    ),
    progress: v.optional(v.number()),
    bytes: v.optional(v.number()),
    localKey: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, { id, status, progress, bytes, localKey, error }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const row = await ctx.db.get(id);
    // Hanya pemiliknya yang boleh mengubah baris unduhannya.
    if (!row || row.userId !== userId) throw new Error("Not found");
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (status !== undefined) patch.status = status;
    if (progress !== undefined) patch.progress = progress;
    if (bytes !== undefined) patch.bytes = bytes;
    if (localKey !== undefined) patch.localKey = localKey;
    if (error !== undefined) patch.error = error;
    await ctx.db.patch(id, patch);
    return { ok: true as const };
  },
});

/** Hapus satu unduhan dari daftar (file di IndexedDB dihapus dari client). */
export const remove = mutation({
  args: { id: v.id("downloads") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const row = await ctx.db.get(id);
    if (!row || row.userId !== userId) throw new Error("Not found");
    await ctx.db.delete(id);
    return { ok: true as const };
  },
});

/** Kosongkan daftar unduhan (tombol "Hapus semua" di layar Download). */
export const clearAll = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const rows = await ctx.db
      .query("downloads")
      .withIndex("userId_created", (q) => q.eq("userId", userId))
      .take(200);
    for (const r of rows) await ctx.db.delete(r._id);
    return { ok: true as const, removed: rows.length };
  },
});