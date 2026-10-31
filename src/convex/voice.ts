// YoruNime — VOICE CALL ROOM (backend).
//
// Tabel di sini hanya mengurus DAFTAR room, keanggotaan, kode undangan, dan
// sinyal kecil antar browser (offer/answer/ice + status mikrofon). Audio
// sendiri mengalir peer-to-peer lewat WebRTC, jadi tidak butuh layanan luar
// dan tidak butuh API key.
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

const ROOM_TYPES = ["casual", "gaming", "study", "music"] as const;
/** Tanpa 0/O/I supaya kode undangan gampang dibaca & diketik ulang. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const SIGNAL_TTL = 5 * 60_000;
const SIGNAL_MAX = 240;
const ROOM_MAX = 10;

function randCode(len = 7): string {
  let out = "";
  for (let i = 0; i < len; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}
const groupCode = () => `GP-${randCode(7)}`;
const oneTimeCode = () => `OP-${randCode(7)}`;

type Member = {
  userId: Id<"users">;
  username: string;
  image?: string;
  joinedAt: number;
};

async function me(ctx: QueryCtx | MutationCtx): Promise<Id<"users"> | null> {
  try {
    return await getAuthUserId(ctx);
  } catch {
    return null;
  }
}

/** Bentuk ringkas room untuk UI. */
async function view(ctx: QueryCtx | MutationCtx, r: Doc<"voiceRooms">) {
  const owner = await ctx.db.get(r.ownerId);
  const members = (r.members ?? []).map((m) => ({
    userId: m.userId,
    username: m.username,
    image: m.image,
    joinedAt: m.joinedAt,
  }));
  return {
    _id: r._id,
    name: r.name,
    type: r.type,
    privacy: r.privacy,
    maxUsers: r.maxUsers,
    ownerId: r.ownerId,
    ownerName: owner?.username ?? "user",
    linkCode: r.linkCode,
    hasOneTime: !!r.oneTimeCode,
    count: members.length,
    members,
    /** Dua foto pertama untuk daftar room. */
    previews: members.slice(0, 2),
    /** Judul nobar yang sedang diputar host (null = tidak ada). */
    nobar: r.nobar ?? null,
    createdAt: r.createdAt,
  };
}
export type VoiceRoomView = Awaited<ReturnType<typeof view>>;

/* ------------------------------------------------------------------ read -- */

export const listRooms = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("voiceRooms")
      .withIndex("updatedAt", (q) => q.gt("updatedAt", 0))
      .order("desc")
      .take(50);
    const out = [];
    for (const r of rows) out.push(await view(ctx, r));
    return out;
  },
});

export const roomDetail = query({
  args: { roomId: v.id("voiceRooms") },
  handler: async (ctx, { roomId }) => {
    const r = await ctx.db.get(roomId);
    if (!r) return null;
    return await view(ctx, r);
  },
});

/** Cari room lewat kode undangan (GP-xxxxxxx / OP-xxxxxxx). */
export const roomByCode = query({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const clean = code.trim().toUpperCase();
    if (!clean) return null;
    let r =
      (await ctx.db
        .query("voiceRooms")
        .withIndex("linkCode", (q) => q.eq("linkCode", clean))
        .first()) ?? null;
    // Kode yang cocok ikut dikembalikan supaya room private bisa langsung
    // di-join lewat link (link personal sekali pakai ikut terpakai).
    let matched = r ? clean : null;
    if (!r) {
      r = await ctx.db
        .query("voiceRooms")
        .withIndex("oneTimeCode", (q) => q.eq("oneTimeCode", clean))
        .first();
      matched = r ? clean : null;
    }
    return r ? { ...(await view(ctx, r)), matchedCode: matched } : null;
  },
});

/** Sinyal WebRTC milik room — diputar oleh client (yang sudah diproses
 *  dilewati lewat daftar id yang sudah pernah dilihat). */
export const signals = query({
  args: { roomId: v.id("voiceRooms") },
  handler: async (ctx, { roomId }) => {
    const cutoff = Date.now() - SIGNAL_TTL;
    const rows = await ctx.db
      .query("voiceSignals")
      .withIndex("roomId_created", (q) => q.eq("roomId", roomId).gt("createdAt", cutoff))
      .order("asc")
      .take(SIGNAL_MAX);
    return rows.map((s) => ({
      _id: s._id,
      from: s.from,
      kind: s.kind,
      payload: s.payload,
      createdAt: s.createdAt,
    }));
  },
});

/* ----------------------------------------------------------------- write -- */

async function cleanupSignals(ctx: MutationCtx, roomId: Id<"voiceRooms">) {
  const cutoff = Date.now() - SIGNAL_TTL;
  const old = await ctx.db
    .query("voiceSignals")
    .withIndex("roomId", (q) => q.eq("roomId", roomId))
    .take(SIGNAL_MAX + 80);
  const drop = old.filter((s) => s.createdAt < cutoff);
  const overflow = old.length - drop.length > SIGNAL_MAX ? old.slice(0, old.length - SIGNAL_MAX - drop.length) : [];
  for (const s of [...drop, ...overflow]) await ctx.db.delete(s._id);
}

export const createRoom = mutation({
  args: {
    name: v.string(),
    type: v.string(),
    maxUsers: v.number(),
    privacy: v.union(v.literal("public"), v.literal("private")),
  },
  handler: async (ctx, { name, type, maxUsers, privacy }) => {
    const userId = await me(ctx);
    if (userId === null) throw new Error("Belum login");
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("Akun tidak ditemukan");
    const cleanName = name.trim().slice(0, 40) || `Room ${user.username ?? "user"}`;
    const cleanType = (ROOM_TYPES as readonly string[]).includes(type) ? type : "casual";
    const max = Math.max(1, Math.min(ROOM_MAX, Math.round(maxUsers) || 10));
    const now = Date.now();
    const member: Member = {
      userId,
      username: user.username ?? "user",
      image: user.image,
      joinedAt: now,
    };
    return await ctx.db.insert("voiceRooms", {
      name: cleanName,
      type: cleanType,
      ownerId: userId,
      maxUsers: max,
      privacy,
      linkCode: groupCode(),
      oneTimeCode: privacy === "private" ? oneTimeCode() : undefined,
      members: [member],
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const joinRoom = mutation({
  args: { roomId: v.id("voiceRooms"), linkCode: v.optional(v.string()) },
  handler: async (ctx, { roomId, linkCode }) => {
    const userId = await me(ctx);
    if (userId === null) throw new Error("Belum login");
    const r = await ctx.db.get(roomId);
    if (!r) throw new Error("Room tidak ditemukan");
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("Akun tidak ditemukan");
    const members = r.members ?? [];
    const already = members.some((m) => m.userId === userId);
    if (!already && members.length >= r.maxUsers) throw new Error("Room penuh");
    const enteredViaLink = (linkCode ?? "").trim().toUpperCase();
    if (r.privacy === "private" && !already) {
      const okLink = enteredViaLink && enteredViaLink === r.linkCode;
      const okOne = enteredViaLink && enteredViaLink === r.oneTimeCode;
      if (!okLink && !okOne) throw new Error("Room private — butuh link undangan");
      // Link ONE TIME hangus begitu dipakai masuk.
      if (okOne) await ctx.db.patch(roomId, { oneTimeCode: undefined });
    }
    if (!already) {
      members.push({
        userId,
        username: user.username ?? "user",
        image: user.image,
        joinedAt: Date.now(),
      });
      await ctx.db.patch(roomId, { members, updatedAt: Date.now() });
    }
    return roomId;
  },
});

export const leaveRoom = mutation({
  args: { roomId: v.id("voiceRooms") },
  handler: async (ctx, { roomId }) => {
    const userId = await me(ctx);
    if (userId === null) return;
    const r = await ctx.db.get(roomId);
    if (!r) return;
    const members = (r.members ?? []).filter((m) => m.userId !== userId);
    if (members.length === 0) {
      await ctx.db.delete(roomId);
      await cleanupSignals(ctx, roomId);
      return;
    }
    const patch: Partial<Doc<"voiceRooms">> = { members, updatedAt: Date.now() };
    // Pemilik keluar → jabatan pindah ke member pertama supaya room tetap
    // bisa dikelola (invite / generate link).
    if (r.ownerId === userId) patch.ownerId = members[0].userId;
    await ctx.db.patch(roomId, patch);
  },
});

export const endRoom = mutation({
  args: { roomId: v.id("voiceRooms") },
  handler: async (ctx, { roomId }) => {
    const userId = await me(ctx);
    const r = await ctx.db.get(roomId);
    if (!r || r.ownerId !== userId) throw new Error("Hanya host yang bisa menutup room");
    await ctx.db.delete(roomId);
    await cleanupSignals(ctx, roomId);
  },
});

/** Generate ulang kode undangan — "group" (reusable) atau "one" (sekali pakai). */
export const genLink = mutation({
  args: {
    roomId: v.id("voiceRooms"),
    mode: v.union(v.literal("group"), v.literal("one")),
  },
  handler: async (ctx, { roomId, mode }) => {
    const userId = await me(ctx);
    const r = await ctx.db.get(roomId);
    if (!r || r.ownerId !== userId) throw new Error("Hanya host");
    if (mode === "group") {
      const next = groupCode();
      await ctx.db.patch(roomId, { linkCode: next, updatedAt: Date.now() });
      return next;
    }
    const next = oneTimeCode();
    await ctx.db.patch(roomId, { oneTimeCode: next, updatedAt: Date.now() });
    return next;
  },
});

/** Ubah max user room (host) — dipakai kotak stepper di layar Invite. */
export const setMaxUsers = mutation({
  args: { roomId: v.id("voiceRooms"), maxUsers: v.number() },
  handler: async (ctx, { roomId, maxUsers }) => {
    const userId = await me(ctx);
    const r = await ctx.db.get(roomId);
    if (!r || r.ownerId !== userId) throw new Error("Hanya host yang bisa mengubah");
    const next = Math.max(1, Math.min(ROOM_MAX, Math.round(maxUsers) || 1));
    // Tidak boleh mengecil di bawah jumlah member yang sedang berada di dalam.
    const floor = (r.members ?? []).length || 1;
    await ctx.db.patch(roomId, {
      maxUsers: Math.max(next, floor),
      updatedAt: Date.now(),
    });
  },
});

/** HOST saja: pasang judul nobar (anime / film / donghua) di room. */
export const setNobar = mutation({
  args: {
    roomId: v.id("voiceRooms"),
    kind: v.string(),
    id: v.string(),
    slug: v.optional(v.string()),
    title: v.string(),
    image: v.optional(v.string()),
    episode: v.optional(v.number()),
  },
  handler: async (ctx, { roomId, kind, id, slug, title, image, episode }) => {
    const userId = await me(ctx);
    if (userId === null) throw new Error("Belum login");
    const r = await ctx.db.get(roomId);
    if (!r) throw new Error("Room tidak ditemukan");
    if (r.ownerId !== userId)
      throw new Error("Hanya host yang bisa mengatur nobar");
    const k = ["anime", "film", "donghua"].includes(kind) ? kind : "anime";
    await ctx.db.patch(roomId, {
      nobar: {
        kind: k,
        id: id.slice(0, 200),
        slug: slug ? slug.slice(0, 200) : undefined,
        title: title.slice(0, 200),
        image: image ? image.slice(0, 900) : undefined,
        episode:
          episode && Number.isFinite(episode)
            ? Math.max(1, Math.floor(episode))
            : undefined,
        startedBy: userId,
        startedAt: Date.now(),
      },
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});

/** HOST saja: matikan nobar, room kembali seperti biasa. */
export const clearNobar = mutation({
  args: { roomId: v.id("voiceRooms") },
  handler: async (ctx, { roomId }) => {
    const userId = await me(ctx);
    if (userId === null) throw new Error("Belum login");
    const r = await ctx.db.get(roomId);
    if (!r) throw new Error("Room tidak ditemukan");
    if (r.ownerId !== userId)
      throw new Error("Hanya host yang bisa mengatur nobar");
    await ctx.db.patch(roomId, { nobar: undefined, updatedAt: Date.now() });
    return { ok: true };
  },
});

export const sendSignal = mutation({
  args: {
    roomId: v.id("voiceRooms"),
    kind: v.string(),
    payload: v.optional(v.string()),
  },
  handler: async (ctx, { roomId, kind, payload }) => {
    const userId = await me(ctx);
    if (userId === null) return;
    const r = await ctx.db.get(roomId);
    if (!r) return;
    if (!(r.members ?? []).some((m) => m.userId === userId)) return;
    await ctx.db.insert("voiceSignals", {
      roomId,
      from: userId,
      kind: kind.slice(0, 24),
      payload: (payload ?? "").slice(0, 6000),
      createdAt: Date.now(),
    });
    await cleanupSignals(ctx, roomId);
  },
});
