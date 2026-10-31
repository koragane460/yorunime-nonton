// YoruNime — toko sticker chat.
//
// Kategori: "pack" (Sticker Pack), "anime", "random". Pack bawaan didefinisikan
// di kode supaya toko tidak pernah kosong; pack unggahan developer disimpan di
// tabel `stickerPacks`. Pembelian menyimpan salinan sticker di
// `stickerPurchases`, jadi sheet chat tetap bisa menampilkan sticker yang sudah
// dibeli tanpa bergantung pada pack aslinya.
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

type Category = "pack" | "anime" | "random";

type PackDef = {
  key: string;
  title: string;
  category: Category;
  price: number;
  stickers: string[];
};

/** Pack bawaan — key diawali "seed:" supaya jelas bukan id dokumen. */
const BUILTIN: PackDef[] = [
  {
    key: "seed:yoru-starter",
    title: "Yoru Starter",
    category: "pack",
    price: 900,
    stickers: ["😀", "😎", "🥳", "😴", "🤔", "😭"],
  },
  {
    key: "seed:neko-life",
    title: "Neko Life",
    category: "pack",
    price: 1200,
    stickers: ["🐱", "😺", "😸", "😹", "😻", "🙀"],
  },
  {
    key: "seed:anime-mood",
    title: "Anime Mood",
    category: "anime",
    price: 1500,
    stickers: ["😤", "😳", "🥺", "😏", "🤯", "😇", "😈", "🫠", "😵", "🥹"],
  },
  {
    key: "seed:anime-energy",
    title: "Anime Energy",
    category: "anime",
    price: 1800,
    stickers: ["🔥", "⚡", "💥", "✨", "💫", "🌟", "💢", "❄️", "🌊", "🌀"],
  },
  {
    key: "seed:random-chaos",
    title: "Random Chaos",
    category: "random",
    price: 700,
    stickers: ["🤡", "👻", "💀", "👽", "🤖", "🎃", "🦄", "🐸", "🍕", "🧦"],
  },
  {
    key: "seed:random-love",
    title: "Random Love",
    category: "random",
    price: 800,
    stickers: ["❤️", "💖", "💘", "💝", "💞", "💓", "💕", "💟", "💔", "🫶"],
  },
];

const CATEGORIES: Category[] = ["pack", "anime", "random"];

function asCategory(v: string): Category {
  return (CATEGORIES as string[]).includes(v) ? (v as Category) : "pack";
}

/** Sticker dibatasi 1-30 item, masing-masing <= 16 karakter. */
function cleanStickers(raw: string[]): string[] {
  const out: string[] = [];
  for (const s of raw) {
    const t = String(s ?? "").trim();
    if (!t) continue;
    if (t.length > 16) continue;
    if (out.includes(t)) continue;
    out.push(t);
    if (out.length >= 30) break;
  }
  return out;
}

/** Toko: saldo Sacret + seluruh pack (bawaan + unggahan) + status beli. */
export const shop = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const me = userId ? await ctx.db.get(userId) : null;
    const rows = await ctx.db
      .query("stickerPacks")
      .withIndex("createdAt")
      .order("desc")
      .take(120);
    const purchases = me
      ? await ctx.db
          .query("stickerPurchases")
          .withIndex("userId", (q) => q.eq("userId", me._id))
          .take(200)
      : [];
    const owned = new Set(purchases.map((p) => p.packKey));

    const packs: (PackDef & { owned: boolean; mine: boolean; custom: boolean })[] = [
      ...BUILTIN.map((p) => ({
        ...p,
        owned: owned.has(p.key),
        mine: false,
        custom: false,
      })),
      ...rows.map((r) => ({
        key: String(r._id),
        title: r.title,
        category: asCategory(r.category),
        price: r.price,
        stickers: r.stickers,
        owned: owned.has(String(r._id)),
        mine: String(r.createdBy) === String(me?._id),
        custom: true,
      })),
    ];

    return {
      sacret: me?.diamonds ?? 0,
      unlimited: !!me?.unlimitedSacret,
      canUpload:
        me?.staffRole === "dev" ||
        me?.staffRole === "creator" ||
        me?.role === "admin",
      packs,
    };
  },
});

/** Semua sticker milik user (dari pack yang sudah dibeli), buat sheet chat. */
export const mine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const rows = await ctx.db
      .query("stickerPurchases")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .take(200);
    const out: { key: string; sticker: string; title: string }[] = [];
    const seen = new Set<string>();
    for (const r of rows) {
      for (const s of r.stickers) {
        if (seen.has(s)) continue;
        seen.add(s);
        out.push({ key: `${r.packKey}:${s}`, sticker: s, title: r.title });
      }
    }
    return out;
  },
});

/** Beli pack pakai Sacret. Sekali beli, selamanya milik user. */
export const buy = mutation({
  args: { packKey: v.string() },
  handler: async (ctx, { packKey }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Login dulu untuk membeli sticker");
    const me = await ctx.db.get(userId);
    if (!me) throw new Error("User tidak ditemukan");

    const already = await ctx.db
      .query("stickerPurchases")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .take(200);
    if (already.some((p) => p.packKey === packKey))
      throw new Error("Pack ini sudah kamu beli");

    let pack: PackDef | null = BUILTIN.find((p) => p.key === packKey) ?? null;
    if (!pack) {
      const doc = await ctx.db.get(packKey as Id<"stickerPacks">);
      if (!doc) throw new Error("Sticker tidak ditemukan");
      pack = {
        key: String(doc._id),
        title: doc.title,
        category: asCategory(doc.category),
        price: doc.price,
        stickers: doc.stickers,
      };
    }

    const price = Math.max(0, Math.floor(pack.price));
    if (!me.unlimitedSacret && (me.diamonds ?? 0) < price)
      throw new Error(
        `Sacret kamu cuma ${(me.diamonds ?? 0).toLocaleString("id-ID")} — butuh ${price.toLocaleString("id-ID")}`,
      );

    const nextSacret = me.unlimitedSacret
      ? (me.diamonds ?? 0)
      : (me.diamonds ?? 0) - price;
    await ctx.db.patch(userId, {
      diamonds: nextSacret,
      unlimitedSacret: !!me.unlimitedSacret,
    });
    await ctx.db.insert("stickerPurchases", {
      userId,
      packKey: pack.key,
      title: pack.title,
      price,
      stickers: pack.stickers,
      createdAt: Date.now(),
    });
    return { ok: true, sacret: nextSacret, count: pack.stickers.length };
  },
});

/** Unggah pack baru — hanya developer/creator/admin. Tanpa glow. */
export const createPack = mutation({
  args: {
    title: v.string(),
    category: v.string(),
    price: v.number(),
    stickers: v.array(v.string()),
  },
  handler: async (ctx, { title, category, price, stickers }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Login dulu");
    const me = await ctx.db.get(userId);
    const allowed =
      me?.staffRole === "dev" ||
      me?.staffRole === "creator" ||
      me?.role === "admin";
    if (!me || !allowed) throw new Error("Hanya developer yang bisa upload sticker");

    const t = title.trim();
    if (t.length < 2) throw new Error("Judul minimal 2 karakter");
    if (t.length > 40) throw new Error("Judul maksimal 40 karakter");
    const stickersClean = cleanStickers(stickers);
    if (stickersClean.length === 0)
      throw new Error("Isi minimal satu sticker (emoji)");
    const harga = Math.max(0, Math.min(100000, Math.floor(price || 0)));

    await ctx.db.insert("stickerPacks", {
      title: t,
      category: asCategory(category),
      price: harga,
      stickers: stickersClean,
      createdBy: userId,
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

/** Hapus pack unggahan (bukan bawaan). Pembeli tetap punya salinannya. */
export const removePack = mutation({
  args: { packKey: v.string() },
  handler: async (ctx, { packKey }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Login dulu");
    const me = await ctx.db.get(userId);
    const allowed =
      me?.staffRole === "dev" ||
      me?.staffRole === "creator" ||
      me?.role === "admin";
    if (!me || !allowed) throw new Error("Hanya developer yang bisa menghapus");
    const doc = await ctx.db.get(packKey as Id<"stickerPacks">);
    if (!doc) throw new Error("Pack tidak ditemukan");
    await ctx.db.delete(doc._id);
    return { ok: true };
  },
});
