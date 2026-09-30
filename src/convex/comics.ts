// YoruNime — history & favorite manga/manhwa (terpisah dari anime).
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

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
  },
  handler: async (ctx, { slug, comicTitle, comicImage, kind }) => {
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
