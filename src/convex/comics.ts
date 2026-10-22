// YoruNime — history & favorite manga/manhwa (terpisah dari anime).
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query, action, internalMutation, internalQuery } from "./_generated/server";
import { api, internal } from "./_generated/api";

const kindArg = v.union(v.literal("manga"), v.literal("manhwa"));

function requireKind(kind: string): "manga" | "manhwa" {
  return kind === "manhwa" ? "manhwa" : "manga";
}

// ------------------------------------------------------------- history ----

/** Dipanggil reader setiap ganti chapter / saat menutup halaman. */
export const recordRead = mutation({
  args: {
    slug: v.string(),
    comicTitle: v.string(),
    comicImage: v.optional(v.string()),
    kind: kindArg,
    chapter: v.number(),
    chapterLabel: v.optional(v.string()),
    page: v.optional(v.number()),
    totalPages: v.optional(v.number()),
  },
  handler: async (
    ctx,
    { slug, comicTitle, comicImage, kind, chapter, chapterLabel, page, totalPages },
  ) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return { ok: false };
    const existing = await ctx.db
      .query("comicHistory")
      .withIndex("userId_slug", (q) => q.eq("userId", userId).eq("slug", slug))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        comicTitle,
        comicImage,
        kind: requireKind(kind),
        chapter,
        chapterLabel,
        page,
        totalPages,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("comicHistory", {
        userId,
        slug,
        comicTitle,
        comicImage,
        kind: requireKind(kind),
        chapter,
        chapterLabel,
        page,
        totalPages,
        updatedAt: Date.now(),
      });
    }
    return { ok: true };
  },
});

export const myHistory = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    return await ctx.db
      .query("comicHistory")
      .withIndex("userId_updated", (q) => q.eq("userId", userId))
      .order("desc")
      .take(40);
  },
});

/** History komik milik user lain (dipakai di panel profil). */
export const historyOf = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("comicHistory")
      .withIndex("userId_updated", (q) => q.eq("userId", userId))
      .order("desc")
      .take(30);
  },
});

/** Riwayat baca yang belum tamat (tombol "Lanjutkan" di halaman Info). */
export const continueReading = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const rows = await ctx.db
      .query("comicHistory")
      .withIndex("userId_updated", (q) => q.eq("userId", userId))
      .order("desc")
      .take(20);
    return rows.filter((r) => (r.page ?? 0) < (r.totalPages ?? 0) - 1);
  },
});

// ------------------------------------------------------------ favorite ----

export const toggleFavorite = mutation({
  args: {
    slug: v.string(),
    comicTitle: v.string(),
    comicImage: v.optional(v.string()),
    kind: kindArg,
    /** Status saat di-subscribe (true = masih jalan) — dipakai pengelompokan
     *  Ongoing/Tamat di layar Subscribe, lalu disegarkan oleh aksi refresh. */
    ongoing: v.optional(v.boolean()),
  },
  handler: async (ctx, { slug, comicTitle, comicImage, kind, ongoing }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const existing = await ctx.db
      .query("comicFavorites")
      .withIndex("userId_slug", (q) => q.eq("userId", userId).eq("slug", slug))
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
      return { favorited: false };
    }
    await ctx.db.insert("comicFavorites", {
      userId,
      slug,
      comicTitle,
      comicImage,
      kind: requireKind(kind),
      ongoing,
      createdAt: Date.now(),
    });
    return { favorited: true };
  },
});

/** Baris favorite komik mentah — untuk aksi refresh status (internal). */
export const favoritesRaw = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) =>
    await ctx.db
      .query("comicFavorites")
      .withIndex("userId_created", (q) => q.eq("userId", userId))
      .collect(),
});

/** Perbarui bendera ongoing 1 favorite komik. */
export const setOngoing = internalMutation({
  args: { id: v.id("comicFavorites"), ongoing: v.boolean() },
  handler: async (ctx, { id, ongoing }) => {
    await ctx.db.patch(id, { ongoing });
  },
});

/**
 * Segarkan status ONGOING/TAMAT favorite manga & manhwa.
 *
 * Sama seperti versi anime: status disimpan saat favorite ditekan, jadi
 * komik yang keluar dari katalog "berjalan" lalu tamat harus dipindah ke
 * kelompok Completed di layar Subscribe. Maksimal 12 judul per panggilan
 * (detail sudah di-cache server), dan dipanggil paling sering tiap 6 jam
 * oleh client.
 */
export const refreshStatuses = action({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return 0;
    const rows = (await ctx.runQuery(internal.comics.favoritesRaw, {
      userId,
    })) as { _id: any; slug: string; ongoing?: boolean }[];
    const targets = rows.slice(0, 12);
    let updated = 0;
    for (const r of targets) {
      try {
        const d = (await ctx.runAction(api.manga.detail, {
          slug: r.slug,
        })) as { ongoing?: boolean } | null;
        if (!d || typeof d.ongoing !== "boolean") continue;
        if (d.ongoing !== r.ongoing) {
          await ctx.runMutation(internal.comics.setOngoing, {
            id: r._id,
            ongoing: d.ongoing,
          });
          updated++;
        }
      } catch {
        /* satu judul gagal tidak menghentikan sisanya */
      }
    }
    return updated;
  },
});

export const myFavorites = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    return await ctx.db
      .query("comicFavorites")
      .withIndex("userId_created", (q) => q.eq("userId", userId))
      .order("desc")
      .take(40);
  },
});

/** Favorite komik milik user lain (dipakai di panel profil). */
export const favoritesOf = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("comicFavorites")
      .withIndex("userId_created", (q) => q.eq("userId", userId))
      .order("desc")
      .take(30);
  },
});

export const isFavorite = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return false;
    const row = await ctx.db
      .query("comicFavorites")
      .withIndex("userId_slug", (q) => q.eq("userId", userId).eq("slug", slug))
      .first();
    return !!row;
  },
});
