import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query, MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import {
  CLAIM_MS,
  GACHA_X1,
  GACHA_X10,
  petById,
  rollPet,
  SCENES,
} from "../lib/pets";

async function loadOrCreate(ctx: MutationCtx, userId: Id<"users">) {
  const existing = await ctx.db
    .query("petState")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
  if (existing) return existing;
  const inserted = await ctx.db.insert("petState", {
    userId,
    eggs: 0,
    owned: [],
    claimAt: Date.now(),
    crystals: 0,
    scenes: ["hutan"],
    scene: "hutan",
  });
  return (await ctx.db.get(inserted))!;
}

/** Gabungan state lengkap untuk layar YoruPet. */
export const state = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const u = await ctx.db.get(userId);
    const s = await ctx.db
      .query("petState")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    const now = Date.now();
    const owned = (s?.owned ?? []).map((o) => {
      const def = petById(o.petId);
      return {
        uid: o.uid,
        at: o.at,
        petId: o.petId,
        name: def?.name ?? o.petId,
        emoji: def?.emoji ?? "❔",
        rarity: def?.rarity ?? ("Common" as const),
        crystal: def?.crystal ?? 0,
        claim: def?.claim ?? 0,
        rate: def?.rate ?? 0,
      };
    });
    const equipped = owned.find((o) => o.uid === s?.equippedUid) ?? null;
    const claimAt = s?.claimAt ?? now;
    return {
      username: u?.username ?? "Pet",
      sacret: u?.diamonds ?? 0,
      eggs: s?.eggs ?? 0,
      owned,
      equipped,
      crystals: s?.crystals ?? 0,
      scenes: s?.scenes ?? ["hutan"],
      scene: s?.scene ?? "hutan",
      freeEggUsed: s?.freeEggUsed ?? false,
      claimAt,
      claimReady: now - claimAt >= CLAIM_MS,
      claimIn: Math.max(0, CLAIM_MS - (now - claimAt)),
    };
  },
});

/**
 * VIEW-ONLY kebun binatang user lain (dibuka dari detail akun → YoruPet).
 * Balasannya sama dengan `state` tapi tanpa klaim/gacha — hanya tampilan.
 */
export const view = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const u = await ctx.db.get(userId);
    if (!u) return null;
    const s = await ctx.db
      .query("petState")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    const owned = (s?.owned ?? []).map((o) => {
      const def = petById(o.petId);
      return {
        uid: o.uid,
        at: o.at,
        petId: o.petId,
        name: def?.name ?? o.petId,
        emoji: def?.emoji ?? "❔",
        rarity: def?.rarity ?? ("Common" as const),
        crystal: def?.crystal ?? 0,
        claim: def?.claim ?? 0,
        rate: def?.rate ?? 0,
      };
    });
    const equipped = owned.find((o) => o.uid === s?.equippedUid) ?? null;
    return {
      username: u.username ?? "Pet",
      image: u.image,
      owned,
      equipped,
      crystals: s?.crystals ?? 0,
      scenes: s?.scenes ?? ["hutan"],
      scene: s?.scene ?? "hutan",
      viewing: true as const,
    };
  },
});

/** Gacha — membeli telur Misteri (1x 1.000 / 10x 10.000 Sacret).
    PERTAMA KALI GRATIS — user yang belum pernah Gacha dapat 1 telur
    gratis (1×), tanpa memotong Sacret sama sekali. */
export const pull = mutation({
  args: { count: v.union(v.literal(1), v.literal(10)) },
  handler: async (ctx, { count }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Belum masuk");
    const u = await ctx.db.get(userId);
    if (!u) throw new Error("Akun tidak ada");
    const s = await loadOrCreate(ctx, userId);
    // Gacha gratis pertama (baru bisa dipakai untuk 1×, bukan 10×).
    const free = count === 1 && !s.freeEggUsed;
    const cost = free ? 0 : count === 1 ? GACHA_X1 : GACHA_X10;
    if ((u.diamonds ?? 0) < cost) throw new Error("Sacret tidak cukup");
    if (cost > 0) {
      await ctx.db.patch(userId, { diamonds: (u.diamonds ?? 0) - cost });
    }
    if (free) await ctx.db.patch(s._id, { freeEggUsed: true });
    await ctx.db.patch(s._id, { eggs: s.eggs + count });
    return { eggs: s.eggs + count, free };
  },
});

/** Tetas satu telur -> dapat pet random sesuai persentase drop. */
export const hatch = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Belum masuk");
    const s = await loadOrCreate(ctx, userId);
    if (s.eggs <= 0) throw new Error("Tidak ada telur - gacha dulu");
    const pet = rollPet();
    const entry = {
      uid: Math.random().toString(36).slice(2) + Date.now().toString(36),
      petId: pet.id,
      at: Date.now(),
    };
    await ctx.db.patch(s._id, { eggs: s.eggs - 1, owned: [...s.owned, entry] });
    return {
      petId: pet.id,
      name: pet.name,
      emoji: pet.emoji,
      rarity: pet.rarity,
    };
  },
});

/** Tetas SEMUA telur sekaligus - hasil digabung. */
export const hatchAll = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Belum masuk");
    const s = await loadOrCreate(ctx, userId);
    if (s.eggs <= 0) throw new Error("Tidak ada telur - gacha dulu");
    const n = s.eggs;
    const fresh = [...s.owned];
    for (let i = 0; i < n; i++) {
      const pet = rollPet();
      fresh.push({
        uid:
          Math.random().toString(36).slice(2) + Date.now().toString(36) + i,
        petId: pet.id,
        at: Date.now(),
      });
    }
    await ctx.db.patch(s._id, { eggs: 0, owned: fresh });
    return { count: n };
  },
});

/** Pasang pet -> berjalan di panggung kebun. */
export const equip = mutation({
  args: { uid: v.string() },
  handler: async (ctx, { uid }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Belum masuk");
    const s = await loadOrCreate(ctx, userId);
    if (!s.owned.some((o) => o.uid === uid)) throw new Error("Pet tidak ada");
    await ctx.db.patch(s._id, { equippedUid: uid });
  },
});

/** Lepas pet dari panggung. */
export const unequip = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Belum masuk");
    const s = await loadOrCreate(ctx, userId);
    await ctx.db.patch(s._id, { equippedUid: undefined });
  },
});

/** Jual pet -> crystal kembali sesuai harga pet. */
export const sell = mutation({
  args: { uid: v.string() },
  handler: async (ctx, { uid }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Belum masuk");
    const s = await loadOrCreate(ctx, userId);
    const pet = s.owned.find((o) => o.uid === uid);
    if (!pet) throw new Error("Pet tidak ada");
    if (s.equippedUid === uid) throw new Error("Lepas dulu pet yang dipakai");
    const def = petById(pet.petId);
    await ctx.db.patch(s._id, {
      owned: s.owned.filter((o) => o.uid !== uid),
      crystals: s.crystals + (def?.crystal ?? 0),
    });
    return { crystals: s.crystals + (def?.crystal ?? 0) };
  },
});

/** Klaim hadiah 24 jam - reset hitungan mundur dari waktu klaim. */
export const claim = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Belum masuk");
    const s = await loadOrCreate(ctx, userId);
    const now = Date.now();
    if (now - s.claimAt < CLAIM_MS)
      throw new Error("Belum 24 jam - tunggu dulu");
    const equipped = s.owned.find((o) => o.uid === s.equippedUid);
    if (!equipped) throw new Error("Pasang pet dulu (equip)");
    const def = petById(equipped.petId);
    const amount = def?.claim ?? 0;
    const u = await ctx.db.get(userId);
    await ctx.db.patch(userId, { diamonds: (u?.diamonds ?? 0) + amount });
    await ctx.db.patch(s._id, { claimAt: now });
    return { amount };
  },
});

/** Beli scene/background baru (sekali beli, selamanya). */
export const buyScene = mutation({
  args: { sceneId: v.string() },
  handler: async (ctx, { sceneId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Belum masuk");
    const scene = SCENES.find((sc) => sc.id === sceneId);
    if (!scene) throw new Error("Scene tidak ada");
    const u = await ctx.db.get(userId);
    const s = await loadOrCreate(ctx, userId);
    if (s.scenes.includes(sceneId)) throw new Error("Sudah dimiliki");
    if ((u?.diamonds ?? 0) < scene.cost) throw new Error("Sacret tidak cukup");
    await ctx.db.patch(userId, {
      diamonds: (u?.diamonds ?? 0) - scene.cost,
    });
    await ctx.db.patch(s._id, {
      scenes: [...s.scenes, sceneId],
      scene: sceneId,
    });
    return { scenes: [...s.scenes, sceneId], scene: sceneId };
  },
});

/** Ganti scene aktif (harus sudah dimiliki). */
export const setScene = mutation({
  args: { sceneId: v.string() },
  handler: async (ctx, { sceneId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Belum masuk");
    const s = await loadOrCreate(ctx, userId);
    if (!s.scenes.includes(sceneId))
      throw new Error("Belum dimiliki - beli dulu");
    await ctx.db.patch(s._id, { scene: sceneId });
  },
});
