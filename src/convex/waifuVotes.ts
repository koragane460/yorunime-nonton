// YoruNime — Vote Waifu / Vote Husbu (kotak di Catalog).
//
// Daftar karakter DIATUR DEV (Panel Developer) dengan foto pakai link,
// terpisah antara waifu & husbu. User bisa vote 1× per hari per jenis.
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

const DAY_MS = 24 * 60 * 60 * 1000;

function dayKey(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

async function devOnly(ctx: any): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error("Belum masuk akun");
  const u = await ctx.db.get(userId);
  if (!u) throw new Error("User tidak ditemukan");
  const role = u.staffRole;
  if (role !== "dev" && role !== "admin" && role !== "owner")
    throw new Error("Khusus developer");
  return userId;
}

/** Papan vote untuk satu jenis (waifu/husbu) — sudah diurutkan vote. */
export const board = query({
  args: { kind: v.string() },
  handler: async (ctx, { kind }) => {
    const userId = await getAuthUserId(ctx);
    const cands = await ctx.db
      .query("waifuVoteCandidates")
      .withIndex("by_kind", (q) => q.eq("kind", kind))
      .collect();
    cands.sort((a, b) => b.votes - a.votes);

    let votedToday = false;
    let votedCandidateId: string | null = null;
    if (userId) {
      const key = dayKey(Date.now());
      const mine = await ctx.db
        .query("waifuVotes")
        .withIndex("by_user_day", (q) =>
          q.eq("userId", userId).eq("dayKey", key),
        )
        .first();
      const mineKind = await ctx.db
        .query("waifuVotes")
        .withIndex("by_user_kind", (q) => q.eq("userId", userId).eq("kind", kind))
        .first();
      // Vote boleh 1× per hari per jenis: pakai dayKey, dan hanya jika
      // record hari ini untuk jenis ini ada.
      if (mine && mineKind && mine.candidateId === mineKind.candidateId) {
        votedToday = true;
        votedCandidateId = String(mine.candidateId);
      }
      if (mineKind && mineKind.dayKey === key) {
        votedToday = true;
        votedCandidateId = String(mineKind.candidateId);
      }
    }

    return {
      loggedIn: userId !== null,
      votedToday,
      votedCandidateId,
      items: cands.map((c) => ({
        id: c._id,
        name: c.name,
        image: c.image,
        votes: c.votes,
      })),
    };
  },
});

/** Vote 1× per hari per jenis. */
export const vote = mutation({
  args: { kind: v.string(), candidateId: v.id("waifuVoteCandidates") },
  handler: async (ctx, { kind, candidateId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Masuk akun dulu untuk vote");
    const now = Date.now();
    const key = dayKey(now);

    const existing = await ctx.db
      .query("waifuVotes")
      .withIndex("by_user_kind", (q) => q.eq("userId", userId).eq("kind", kind))
      .first();
    if (existing && existing.dayKey === key)
      throw new Error("Kamu sudah vote hari ini — vote lagi besok.");

    const cand = await ctx.db.get(candidateId);
    if (!cand) throw new Error("Karakter tidak ditemukan");

    if (existing) {
      // Kalau sebelumnya vote kandidat lain di hari lain, kurangi vote lama.
      if (String(existing.candidateId) !== String(candidateId)) {
        const old = await ctx.db.get(existing.candidateId);
        if (old) await ctx.db.patch(old._id, { votes: Math.max(0, old.votes - 1) });
      }
      await ctx.db.patch(existing._id, {
        candidateId,
        createdAt: now,
        dayKey: key,
      });
    } else {
      await ctx.db.insert("waifuVotes", {
        userId,
        candidateId,
        kind,
        createdAt: now,
        dayKey: key,
      });
    }
    await ctx.db.patch(candidateId, { votes: cand.votes + 1 });
    return { ok: true as const };
  },
});

/** DEV: tambah karakter vote (foto pakai link). */
export const addCandidate = mutation({
  args: {
    kind: v.string(),
    name: v.string(),
    image: v.optional(v.string()),
  },
  handler: async (ctx, { kind, name, image }) => {
    await devOnly(ctx);
    await ctx.db.insert("waifuVoteCandidates", {
      kind,
      name,
      image,
      votes: 0,
      createdAt: Date.now(),
    });
    return { ok: true as const };
  },
});

/** DEV: hapus karakter vote. */
export const removeCandidate = mutation({
  args: { id: v.id("waifuVoteCandidates") },
  handler: async (ctx, { id }) => {
    await devOnly(ctx);
    await ctx.db.delete(id);
    return { ok: true as const };
  },
});

/** DEV: daftar kandidat per jenis untuk panel. */
export const devList = query({
  args: { kind: v.string() },
  handler: async (ctx, { kind }) => {
    const cands = await ctx.db
      .query("waifuVoteCandidates")
      .withIndex("by_kind", (q) => q.eq("kind", kind))
      .collect();
    return cands.map((c) => ({
      id: c._id,
      name: c.name,
      image: c.image,
      votes: c.votes,
    }));
  },
});
