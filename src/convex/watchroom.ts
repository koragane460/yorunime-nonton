// YoruNime — Nonton Bareng (watch party).
//
// Satu room = satu anime + satu episode. Host adalah satu-satunya yang boleh
// menggeser bar menit, tombol ±10 detik, play/pause, dan pindah episode.
// Penonton yang join otomatis ikut pada posisi yang sama dengan host.
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireActive } from "./moderation";

const MAX_ROOM_NAME = 40;

/** Kode undangan room 6 karakter (huruf + angka, tanpa huruf mirip). */
function genCode(len = 6): string {
  const ABC = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < len; i++) s += ABC[Math.floor(Math.random() * ABC.length)];
  return s;
}

/**
 * Host yang menutup aplikasi atau koneksinya terputus tidak ada yang
 * menyentuh room lagi. Kalau tidak ada tanda kehidupan dari host selama
 * lease ini, room dianggap bubar: hilang dari daftar dan tidak muncul lagi.
 * Harus membuat room yang baru.
 */
const HOST_LEASE_MS = 3 * 60_000;

/** Room hidup hanya kalau belum diakhiri dan hostnya masih terhubung. */
function isAlive(room: Room, now = Date.now()) {
  if (room.endedAt) return false;
  return now - (room.updatedAt ?? room.startedAt) < HOST_LEASE_MS;
}

type Room = {
  _id: any;
  name: string;
  hostId: any;
  animeId: string;
  animeTitle?: string;
  animeImage?: string;
  episode: number;
  positionSec: number;
  playing: boolean;
  visibility: "all" | "selected";
  allowedUserIds?: any[];
  clanId?: any;
  startedAt: number;
  updatedAt: number;
  endedAt?: number;
  inviteCode?: string;
};

async function loadRoom(ctx: any, roomId: any): Promise<Room | null> {
  const room = (await ctx.db.get(roomId)) as Room | null;
  if (!room) return null;
  if (!isAlive(room)) return null;
  return room;
}

/** Host = pembuat room. */
function isHost(room: Room, userId: any) {
  return room.hostId === userId;
}

/** Room "tertentu" hanya bisa diakses host + user yang dipilih. */
export function canView(room: Room, userId: any) {
  if (isHost(room, userId)) return true;
  if (room.visibility === "all") return true;
  return (room.allowedUserIds ?? []).some((id) => id === userId);
}

/** Room clan: semua member clan otomatis boleh masuk & otomatis masuk room. */
async function inClan(ctx: any, clanId: any, userId: any) {
  const m = await ctx.db
    .query("clanMembers")
    .withIndex("userId", (q: any) => q.eq("userId", userId))
    .first();
  return !!m && m.clanId === clanId;
}

async function requireHost(ctx: any, roomId: any) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error("Not signed in");
  const me = await ctx.db.get(userId);
  if (!me) throw new Error("User not found");
  await requireActive(me);
  const room = await loadRoom(ctx, roomId);
  if (!room) throw new Error("Room tidak ada atau sudah diakhiri");
  if (!isHost(room, userId)) throw new Error("Cuma host yang bisa mengatur");
  return { userId, room };
}

// -------------------------------------------------------------- read ----

/** Daftar room aktif yang boleh dilihat user. */
export const listRooms = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const rooms = (await ctx.db
      .query("watchRooms")
      .filter((q) => q.eq(q.field("endedAt"), undefined))
      .collect()) as Room[];
    const out = [];
    for (const room of rooms) {
      // Room yang hostnya sudah tidak ada tanda kehidupan dianggap bubar dan
      // tidak pernah muncul lagi.
      if (!isAlive(room)) continue;
      if (
        !canView(room, userId) &&
        !(room.clanId && (await inClan(ctx, room.clanId, userId)))
      )
        continue;
      const host = (await ctx.db.get(room.hostId)) as any;
      const members = await ctx.db
        .query("watchRoomMembers")
        .withIndex("roomId", (q) => q.eq("roomId", room._id))
        .collect();
      const iAmIn = members.some((m) => m.userId === userId);
      out.push({
        _id: room._id,
        name: room.name,
        animeId: room.animeId,
        animeTitle: room.animeTitle ?? "",
        animeImage: room.animeImage,
        episode: room.episode,
        positionSec: room.positionSec,
        playing: room.playing,
        visibility: room.visibility,
        /** Ada clanId = room khusus clan (hanya anggota clan yang lihat). */
        clanId: room.clanId ?? null,
        hostId: room.hostId,
        hostName: host?.username ?? "user",
        hostImage: host?.image,
        memberCount: members.length + (iAmIn ? 0 : 0),
        isHost: isHost(room, userId),
        joined: iAmIn,
        updatedAt: room.updatedAt,
        inviteCode: room.inviteCode,
      });
    }
    return out.sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

/** Detail satu room + daftar member + apakah user boleh masuk. */
export const roomDetail = query({
  args: { roomId: v.id("watchRooms") },
  handler: async (ctx, { roomId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const room = (await ctx.db.get(roomId)) as Room | null;
    if (!room) return null;
    const allowed =
      canView(room, userId) ||
      (!!room.clanId && (await inClan(ctx, room.clanId, userId)));
    if (!allowed && room.visibility === "selected")
      return { allowed: false as const, ended: !!room.endedAt, room: null };
    const host = (await ctx.db.get(room.hostId)) as any;
    const memberRows = await ctx.db
      .query("watchRoomMembers")
      .withIndex("roomId", (q) => q.eq("roomId", roomId))
      .collect();
    const members = [];
    for (const m of memberRows) {
      const u = (await ctx.db.get(m.userId)) as any;
      members.push({
        userId: m.userId,
        username: u?.username ?? "user",
        image: u?.image,
        clanTag: u?.clanTag,
        clanTagIcon: u?.clanTagIcon,
        staffRole: u?.staffRole,
        joinedAt: m.joinedAt,
      });
    }
    return {
      allowed: true as const,
      ended: !!room.endedAt,
      isHost: isHost(room, userId),
      room: {
        _id: room._id,
        name: room.name,
        animeId: room.animeId,
        animeTitle: room.animeTitle ?? "",
        animeImage: room.animeImage,
        episode: room.episode,
        positionSec: room.positionSec,
        playing: room.playing,
        visibility: room.visibility,
        /** Ada clanId = room khusus clan (hanya anggota clan yang lihat). */
        clanId: room.clanId ?? null,
        hostId: room.hostId,
        hostName: host?.username ?? "user",
        hostImage: host?.image,
      },
      members,
    };
  },
});

/** Cari user untuk memilih "hanya untuk orang tertentu" (username atau ID). */
export const searchUsers = query({
  args: { q: v.string() },
  handler: async (ctx, { q }) => {
    const needle = q.trim().replace(/^#/, "").toLowerCase();
    if (needle.length === 0) return [];
    const all = await ctx.db.query("users").collect();
    return all
      .filter((u) => {
        const name = (u.username ?? "").toLowerCase();
        if (name.includes(needle)) return true;
        if (String(u.seqId ?? "") === needle) return true;
        return false;
      })
      .sort((a, b) => (a.seqId ?? 0) - (b.seqId ?? 0))
      .slice(0, 12)
      .map((u) => ({
        _id: u._id,
        username: u.username ?? "user",
        image: u.image,
        seqId: u.seqId,
        staffRole: u.staffRole,
      }));
  },
});

/** Cari room lewat KODE UNDANGAN atau nama host — untuk tombol Join room. */
export const findByCode = query({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const needle = code.trim();
    if (!needle) return null;
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    // Coba cocokkan sebagai kode undangan dulu (case-insensitive).
    const rooms = (await ctx.db
      .query("watchRooms")
      .filter((q) => q.eq(q.field("endedAt"), undefined))
      .collect()) as Room[];
    const up = needle.toUpperCase();
    let hit =
      rooms.find((r) => (r.inviteCode ?? "").toUpperCase() === up) ?? null;
    // Kalau bukan kode — cocokkan sebagai nama host (exact, lalu prefix).
    if (!hit) {
      const byName = rooms.filter((r) => {
        if (!isAlive(r)) return false;
        return r.name.toLowerCase() === needle.toLowerCase();
      });
      hit = byName[0] ?? null;
    }
    if (!hit || !isAlive(hit) || !canView(hit, userId)) return null;
    const host = (await ctx.db.get(hit.hostId)) as any;
    return {
      _id: hit._id,
      name: hit.name,
      animeTitle: hit.animeTitle ?? "",
      animeImage: hit.animeImage,
      episode: hit.episode,
      hostName: host?.username ?? "user",
      inviteCode: hit.inviteCode,
    };
  },
});

// ------------------------------------------------------------- write ----

export const createRoom = mutation({
  args: {
    name: v.string(),
    animeId: v.string(),
    animeTitle: v.optional(v.string()),
    animeImage: v.optional(v.string()),
    episode: v.number(),
    visibility: v.union(v.literal("all"), v.literal("selected")),
    allowedUserIds: v.optional(v.array(v.id("users"))),
    clanId: v.optional(v.id("clans")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const me = await ctx.db.get(userId);
    if (!me) throw new Error("User not found");
    await requireActive(me);
    const name = args.name.trim();
    if (name.length < 2) throw new Error("Nama room minimal 2 karakter");
    if (name.length > MAX_ROOM_NAME) throw new Error("Nama room terlalu panjang");
    if (!args.animeId) throw new Error("Pilih anime dulu");
    if (args.episode < 1) throw new Error("Episode tidak valid");
    if (
      args.visibility === "selected" &&
      (args.allowedUserIds ?? []).length === 0
    )
      throw new Error("Pilih minimal 1 orang untuk room tertentu");

    const now = Date.now();
    const clanId = args.clanId;
    // Room clan: semua member clan langsung became anggota room (auto masuk).
    let autoMembers: any[] = [];
    if (clanId) {
      if (args.visibility === "selected" && (args.allowedUserIds ?? []).length === 0)
        throw new Error("Pilih minimal 1 orang untuk room tertentu");
      const rows = await ctx.db
        .query("clanMembers")
        .withIndex("clanId", (q) => q.eq("clanId", clanId))
        .collect();      autoMembers = rows.map((r: any) => r.userId);
    }
    // Kode undangan 6 karakter (huruf + angka) — unik, dipakai join room
    // lewat layar Nobar di Catalog.
    const inviteCode = genCode();
    const roomId = await ctx.db.insert("watchRooms", {
      name,
      hostId: userId,
      animeId: args.animeId,
      animeTitle: args.animeTitle,
      animeImage: args.animeImage,
      episode: args.episode,
      positionSec: 0,
      playing: true,
      visibility: args.visibility,
      allowedUserIds:
        args.visibility === "selected" ? (args.allowedUserIds ?? []) : undefined,
      clanId,
      startedAt: now,
      updatedAt: now,
      inviteCode,
    });
    const seen = new Set<string>([userId]);
    await ctx.db.insert("watchRoomMembers", {
      roomId,
      userId,
      joinedAt: now,
    });
    for (const uid of autoMembers) {
      if (seen.has(uid)) continue;
      seen.add(uid);
      await ctx.db.insert("watchRoomMembers", {
        roomId,
        userId: uid,
        joinedAt: now,
      });
    }
    return { roomId, inviteCode };
  },
});

export const joinRoom = mutation({
  args: { roomId: v.id("watchRooms") },
  handler: async (ctx, { roomId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const me = await ctx.db.get(userId);
    if (!me) throw new Error("User not found");
    await requireActive(me);
    const room = await loadRoom(ctx, roomId);
    if (!room) throw new Error("Room tidak ada atau sudah diakhiri");
    // Room clan: member clan otomatis boleh masuk.
    if (room.clanId && (await inClan(ctx, room.clanId, userId))) {
      // lanjut: otomatis dianggap anggota room
    } else if (!canView(room, userId)) {
      throw new Error("Room ini hanya untuk orang tertentu");
    }
    const existing = await ctx.db
      .query("watchRoomMembers")
      .withIndex("roomId", (q) => q.eq("roomId", roomId))
      .filter((q) => q.eq(q.field("userId"), userId))
      .first();
    if (!existing)
      await ctx.db.insert("watchRoomMembers", {
        roomId,
        userId,
        joinedAt: Date.now(),
      });
    return { ok: true, positionSec: room.positionSec, playing: room.playing };
  },
});

export const leaveRoom = mutation({
  args: { roomId: v.id("watchRooms") },
  handler: async (ctx, { roomId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const room = (await ctx.db.get(roomId)) as Room | null;
    const existing = await ctx.db
      .query("watchRoomMembers")
      .withIndex("roomId", (q) => q.eq("roomId", roomId))
      .filter((q) => q.eq(q.field("userId"), userId))
      .first();
    if (existing) await ctx.db.delete(existing._id);
    // Host yang keluar = room bubar. Ditandai endedAt supaya hilang dari
    // daftar dan tidak muncul lagi; harus buat room baru.
    if (room && isHost(room, userId) && !room.endedAt) {
      const now = Date.now();
      await ctx.db.patch(roomId, {
        endedAt: now,
        playing: false,
        updatedAt: now,
      });
      const members = await ctx.db
        .query("watchRoomMembers")
        .withIndex("roomId", (q) => q.eq("roomId", roomId))
        .collect();
      for (const m of members) {
        await ctx.db.insert("notifications", {
          userId: m.userId,
          type: "watchroom",
          title: "Nobar bubar",
          body: "Host sudah keluar, room ini diakhiri.",
          createdAt: now,
        });
      }
      return { ok: true, ended: true };
    }
    return { ok: true, ended: false };
  },
});

/**
 * Host mengirim tanda hidup secara berkala. Kalau ini berhenti (host
 * menutup app atau koneksinya putus), lease akan habis dan room otomatis
 * dianggap bubar.
 */
export const heartbeat = mutation({
  args: { roomId: v.id("watchRooms") },
  handler: async (ctx, { roomId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return { ok: false };
    const room = (await ctx.db.get(roomId)) as Room | null;
    if (!room || room.endedAt || !isHost(room, userId)) return { ok: false };
    await ctx.db.patch(roomId, { updatedAt: Date.now() });
    return { ok: true };
  },
});

/** Host: host geser bar menit / tombol ±10 detik. */
export const setPosition = mutation({
  args: { roomId: v.id("watchRooms"), positionSec: v.number() },
  handler: async (ctx, { roomId, positionSec }) => {
    const { room } = await requireHost(ctx, roomId);
    await ctx.db.patch(roomId, {
      positionSec: Math.max(0, Math.floor(positionSec)),
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});

/** Host: play / pause untuk semua orang di room. */
export const setPlaying = mutation({
  args: { roomId: v.id("watchRooms"), playing: v.boolean() },
  handler: async (ctx, { roomId, playing }) => {
    await requireHost(ctx, roomId);
    await ctx.db.patch(roomId, { playing, updatedAt: Date.now() });
    return { ok: true };
  },
});

/** Host: pindah episode untuk semua orang di room. */
export const setEpisode = mutation({
  args: { roomId: v.id("watchRooms"), episode: v.number() },
  handler: async (ctx, { roomId, episode }) => {
    await requireHost(ctx, roomId);
    if (episode < 1) throw new Error("Episode tidak valid");
    await ctx.db.patch(roomId, {
      episode,
      positionSec: 0,
      playing: true,
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});

/** Host: ubah siapa saja yang boleh masuk + aturan all/selected. */
export const setAccess = mutation({
  args: {
    roomId: v.id("watchRooms"),
    visibility: v.union(v.literal("all"), v.literal("selected")),
    allowedUserIds: v.optional(v.array(v.id("users"))),
  },
  handler: async (ctx, { roomId, visibility, allowedUserIds }) => {
    await requireHost(ctx, roomId);
    await ctx.db.patch(roomId, {
      visibility,
      allowedUserIds: visibility === "selected" ? (allowedUserIds ?? []) : undefined,
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});

/** Host: akhiri room — semua orang langsung dikeluarkan. */
export const endRoom = mutation({
  args: { roomId: v.id("watchRooms") },
  handler: async (ctx, { roomId }) => {
    await requireHost(ctx, roomId);
    const now = Date.now();
    await ctx.db.patch(roomId, { endedAt: now, playing: false, updatedAt: now });
    const members = await ctx.db
      .query("watchRoomMembers")
      .withIndex("roomId", (q) => q.eq("roomId", roomId))
      .collect();
    for (const m of members) {
      await ctx.db.insert("notifications", {
        userId: m.userId,
        type: "watchroom",
        title: "Nobar diakhiri",
        body: "Host mengakhiri sesi nonton bareng.",
        createdAt: now,
      });
    }
    return { ok: true, kicked: members.length };
  },
});
