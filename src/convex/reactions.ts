// YoruNime — Like / Dislike karakter (pengganti sistem vote token).
//
// Konsep:
//  * Setiap karakter punya `key` stabil ("char:<idAniList>" untuk anime &
//    donghua, "cc:<comicId>:<slug>" untuk manga/manhwa).
//  * Satu user hanya boleh punya SATU reaksi per karakter: like (1),
//    dislike (-1), atau bersih (0 = lepas reaksi).
//  * likeCount / dislikeCount disimpan agregat di `characterStats` supaya
//    layar tidak perlu membaca semua reaksi tiap kali dibuka.
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

type StatsDoc = {
  _id: any;
  key: string;
  likes: number;
  dislikes: number;
  name?: string;
  image?: string;
  label?: string;
};

/** Jumlah like/dislike + reaksi milik user untuk sekumpulan karakter. */
export const stats = query({
  args: { keys: v.array(v.string()) },
  handler: async (ctx, { keys }) => {
    const uniq = [...new Set(keys.filter(Boolean))].slice(0, 80);
    const userId = await getAuthUserId(ctx);
    const out: Record<string, { likes: number; dislikes: number; mine: 0 | 1 | -1 }> = {};
    for (const key of uniq) {
      const s = (await ctx.db
        .query("characterStats")
        .withIndex("by_key", (q) => q.eq("key", key))
        .first()) as StatsDoc | null;
      out[key] = { likes: s?.likes ?? 0, dislikes: s?.dislikes ?? 0, mine: 0 };
    }
    if (userId) {
      const rows = await ctx.db
        .query("characterReactions")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
      for (const r of rows) {
        if (out[r.key]) out[r.key].mine = r.dir as 1 | -1;
      }
    }
    return out;
  },
});

/**
 * Pasang / ganti / lepas reaksi. dir: 1 = like, -1 = dislike, 0 = bersih.
 * Meta (nama, gambar, judul) disimpan saat pertama kali direaksi supaya
 * papan "Top karakter disukai" bisa menampilkan kartu tanpa join tabel lain.
 */
export const set = mutation({
  args: {
    key: v.string(),
    dir: v.union(v.literal(1), v.literal(-1), v.literal(0)),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    label: v.optional(v.string()),
  },
  handler: async (ctx, { key, dir, name, image, label }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Belum masuk akun");
    if (!key || key.length > 200) throw new Error("Karakter tidak valid");

    const prev = await ctx.db
      .query("characterReactions")
      .withIndex("by_user_key", (q) => q.eq("userId", userId).eq("key", key))
      .first();
    const oldDir = prev ? (prev.dir as 1 | -1) : 0;
    if (oldDir === dir) return { ok: true, dir };

    let statsDoc = (await ctx.db
      .query("characterStats")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first()) as StatsDoc | null;
    if (!statsDoc) {
      const id = await ctx.db.insert("characterStats", {
        key,
        likes: 0,
        dislikes: 0,
        name,
        image,
        label,
        updatedAt: Date.now(),
      });
      statsDoc = (await ctx.db.get(id)) as StatsDoc;
    }

    let { likes, dislikes } = statsDoc;
    if (oldDir === 1) likes -= 1;
    if (oldDir === -1) dislikes -= 1;
    if (dir === 1) likes += 1;
    if (dir === -1) dislikes += 1;
    likes = Math.max(0, likes);
    dislikes = Math.max(0, dislikes);

    await ctx.db.patch(statsDoc._id, {
      likes,
      dislikes,
      // Lengkapi meta kalau sebelumnya belum terisi.
      name: statsDoc.name ?? name,
      image: statsDoc.image ?? image,
      label: statsDoc.label ?? label,
      updatedAt: Date.now(),
    });

    if (prev && dir === 0) await ctx.db.delete(prev._id);
    else if (prev) await ctx.db.patch(prev._id, { dir: dir as 1 | -1 });
    else if (dir !== 0)
      await ctx.db.insert("characterReactions", { userId, key, dir: dir as 1 | -1 });

    return { ok: true, dir, likes, dislikes };
  },
});

/** Top 10 karakter paling disukai — pengganti "TOP VOTE CHARACTER" di Koleksi. */
export const topLiked = query({
  args: {},
  handler: async (ctx) => {
    const rows = (await ctx.db.query("characterStats").collect()) as StatsDoc[];
    const items = rows
      .filter((r) => (r.likes ?? 0) > 0)
      .sort((a, b) => (b.likes - b.dislikes) - (a.likes - a.dislikes))
      .slice(0, 10)
      .map((r) => ({
        key: r.key,
        name: r.name ?? "Karakter",
        image: r.image,
        label: r.label,
        likes: r.likes,
        dislikes: r.dislikes,
      }));
    return { ready: items.length > 0, items };
  },
});
