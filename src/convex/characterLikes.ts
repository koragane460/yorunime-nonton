// YoruNime — Like / Dislike karakter anime (pengganti sistem Vote).
//
// Alur:
//  * Layar Like di detail anime menampilkan karakter anime itu.
//  * Tiap user bisa memberi LIKE (1) atau DISLIKE (-1) per karakter.
//  * Menekan tombol yang sama lagi = batal (hapus pilihan).
//  * Menekan tombol lain = pindah pilihan.
//  * Papan per anime dihitung agregat dari baris Like/Dislike, jadi angka
//    like/dislike selalu konsisten tanpa tabel agregat terpisah.
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

/** Papan Like/Dislike satu anime + pilihan milik user (kalau login). */
export const board = query({
  args: { animeId: v.string() },
  handler: async (ctx, { animeId }) => {
    const rows = (await ctx.db
      .query("characterLikes")
      .withIndex("by_anime", (q) => q.eq("animeId", animeId))
      .collect()) as Doc<"characterLikes">[];

    // Agregat per karakter.
    const byChar = new Map<
      string,
      { characterId: string; name: string; image?: string; likes: number; dislikes: number }
    >();
    for (const r of rows) {
      let c = byChar.get(r.characterId);
      if (!c) {
        c = {
          characterId: r.characterId,
          name: r.name,
          image: r.image,
          likes: 0,
          dislikes: 0,
        };
        byChar.set(r.characterId, c);
      }
      if (r.value === 1) c.likes += 1;
      else if (r.value === -1) c.dislikes += 1;
    }

    // Pilihan saya (per karakter) — hanya kalau sudah login.
    const userId = await getAuthUserId(ctx);
    const mine = new Map<string, number>();
    if (userId) {
      for (const r of rows) {
        if (r.userId === userId) mine.set(r.characterId, r.value);
      }
    }

    const items = [...byChar.values()]
      .map((c) => ({
        characterId: c.characterId,
        name: c.name,
        image: c.image,
        likes: c.likes,
        dislikes: c.dislikes,
        score: c.likes - c.dislikes,
        mine: mine.get(c.characterId) ?? 0,
      }))
      .sort((a, b) => b.likes - a.likes);

    const totals = {
      likes: items.reduce((s, c) => s + c.likes, 0),
      dislikes: items.reduce((s, c) => s + c.dislikes, 0),
    };

    return { items, totals, loggedIn: userId !== null };
  },
});

/**
 * Daftarkan karakter anime ini sebagai kandidat Like/Dislike — dipanggil
 * layar Like sekali per anime. Karakter yang belum punya baris sama sekali
 * tidak perlu disisipkan (angka 0 sudah ditampilkan dari sisi klien), jadi
 * fungsi ini hanya dipakai untuk pramingkap bila diperlukan.
 */
export const ensureCharacters = mutation({
  args: {
    animeId: v.string(),
    characters: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        image: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, { animeId, characters }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return { ok: false, reason: "login" };
    void animeId;
    void characters;
    return { ok: true, added: 0 };
  },
});

/** Beri Like / Dislike / batal untuk satu karakter. */
export const react = mutation({
  args: {
    animeId: v.string(),
    characterId: v.string(),
    name: v.string(),
    image: v.optional(v.string()),
    /** 1 = Like, -1 = Dislike, 0 = batal. */
    value: v.number(),
  },
  handler: async (ctx, { animeId, characterId, name, image, value }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Belum masuk akun");
    if (value !== -1 && value !== 0 && value !== 1)
      throw new Error("Nilai tidak valid");

    const existing = (await ctx.db
      .query("characterLikes")
      .withIndex("by_user_character", (q: any) =>
        q.eq("userId", userId).eq("characterId", characterId),
      )
      .first()) as Doc<"characterLikes"> | null;

    if (value === 0) {
      if (existing) await ctx.db.delete(existing._id);
      return { ok: true, value: 0 };
    }

    const now = Date.now();
    if (existing) {
      if (existing.value === value) {
        // Tekan tombol yang sama → batal.
        await ctx.db.delete(existing._id);
        return { ok: true, value: 0 };
      }
      await ctx.db.patch(existing._id, { value, updatedAt: now });
      return { ok: true, value };
    }

    await ctx.db.insert("characterLikes", {
      userId,
      animeId,
      characterId,
      name,
      image,
      value,
      createdAt: now,
      updatedAt: now,
    });
    return { ok: true, value };
  },
});
