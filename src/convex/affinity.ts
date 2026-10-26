// YoruNime — AFINITAS: relasi dekat antar user (Pasangan, Saudara, Sahabat,
// Orang Terpercaya) dengan level bond + misi naik level, undangan, cooldown
// pasca-putus, dan leaderboard per jenis relasi.
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

export type AffinityKind = "pasangan" | "saudara" | "sahabat" | "terpercaya";

export const KINDS: AffinityKind[] = ["pasangan", "saudara", "sahabat", "terpercaya"];

/** Level bond: tiap 100 XP = 1 level (maks mengikuti progres). */
export function bondLevel(xp: number): { level: number; into: number; need: number } {
  const level = Math.floor(Math.max(0, xp) / 100) + 1;
  const into = Math.max(0, xp) % 100;
  return { level, into, need: 100 };
}

const DAY_MS = 24 * 60 * 60 * 1000;
function dayKey(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

const userBrief = async (ctx: any, id: Id<"users">) => {
  const u = await ctx.db.get(id);
  if (!u) return null;
  return {
    userId: u._id as Id<"users">,
    username: u.username ?? "user",
    image: u.image,
    level: u.level ?? 1,
    premium: (u.premiumUntil ?? 0) > Date.now(),
  };
};

/** Pasangan orang lain yang terhubung ke user ini (untuk lingkaran foto). */
async function linksOf(ctx: any, userId: Id<"users">) {
  const asA = await ctx.db
    .query("affinity")
    .withIndex("userA", (q: any) => q.eq("userA", userId))
    .collect();
  const asB = await ctx.db
    .query("affinity")
    .withIndex("userB", (q: any) => q.eq("userB", userId))
    .collect();
  return [...asA, ...asB];
}

/**
 * State layar Afinitas untuk satu profil target:
 * relasi target (untuk lingkaran), apakah kita terhubung dengannya,
 * undangan masuk dari target, dan misi bond bila sudah terhubung.
 */
export const state = query({
  args: { targetId: v.id("users") },
  handler: async (ctx, { targetId }) => {
    const me = await getAuthUserId(ctx);
    if (me === null) return null;
    const targetLinks = await linksOf(ctx, targetId);
    const circles: Record<AffinityKind, any[]> = {
      pasangan: [],
      saudara: [],
      sahabat: [],
      terpercaya: [],
    };
    const today0 = dayKey();
    for (const l of targetLinks) {
      const other = l.userA === targetId ? l.userB : l.userA;
      const brief = await userBrief(ctx, other);
      if (!brief) continue;
      // Bond per-link — supaya sheet Bond bisa dibuka dari lingkaran
      // jenis mana pun, bukan hanya hubungan kita dengan target.
      const { level, into, need } = bondLevel(l.bondXp ?? 0);
      const chatCount = l.chatDay === today0 ? (l.chatCount ?? 0) : 0;
      circles[l.kind as AffinityKind].push({
        ...brief,
        linkId: l._id,
        mine: l.userA === me || l.userB === me,
        bond: {
          xp: l.bondXp ?? 0,
          level,
          into,
          need,
          missions: {
            chat: {
              done: chatCount >= 5,
              progress: Math.min(chatCount, 5),
              goal: 5,
            },
            give7: {
              done: (l.give7 ?? 0) >= 2,
              progress: Math.min(l.give7 ?? 0, 2),
              goal: 2,
            },
            give30: {
              done: (l.give30 ?? 0) >= 2,
              progress: Math.min(l.give30 ?? 0, 2),
              goal: 2,
            },
          },
        },
      });
    }

    // Link kita ↔ target (untuk misi bond).
    const mine = await linksOf(ctx, me);
    const pair = mine.find(
      (l: any) =>
        (l.userA === me && l.userB === targetId) ||
        (l.userB === me && l.userA === targetId),
    );

    let bond = null;
    if (pair) {
      const today = dayKey();
      const chatCount =
        pair.chatDay === today ? (pair.chatCount ?? 0) : 0;
      const { level, into, need } = bondLevel(pair.bondXp ?? 0);
      bond = {
        linkId: pair._id,
        kind: pair.kind as AffinityKind,
        xp: pair.bondXp ?? 0,
        level,
        into,
        need,
        missions: {
          chat: { done: chatCount >= 5, progress: Math.min(chatCount, 5), goal: 5 },
          give7: { done: (pair.give7 ?? 0) >= 2, progress: Math.min(pair.give7 ?? 0, 2), goal: 2 },
          give30: { done: (pair.give30 ?? 0) >= 2, progress: Math.min(pair.give30 ?? 0, 2), goal: 2 },
        },
      };
    }

    // Undangan pending dari target ke kita.
    const invites = await ctx.db
      .query("affinityInvites")
      .withIndex("to_status", (q: any) =>
        q.eq("toId", me).eq("status", "pending"),
      )
      .collect();
    const fromTarget = invites.find((iv: any) => iv.fromId === targetId) ?? null;

    // Cooldown pasca-putus: target tidak boleh diajak lagi?
    const breaks = await ctx.db
      .query("affinityBreaks")
      .withIndex("pair", (q: any) => q.eq("userA", me).eq("userB", targetId))
      .first();
    const break2 = await ctx.db
      .query("affinityBreaks")
      .withIndex("pair", (q: any) => q.eq("userA", targetId).eq("userB", me))
      .first();
    const now = Date.now();
    const cooldownUntil = Math.max(
      breaks?.blockedUntil ?? 0,
      break2?.blockedUntil ?? 0,
    );

    return {
      isMe: me === targetId,
      connected: !!pair,
      bond,
      circles,
      inviteFromTarget: fromTarget
        ? {
            inviteId: fromTarget._id,
            kind: fromTarget.kind as AffinityKind,
            createdAt: fromTarget.createdAt,
            // Profil pengirim — supaya UI bisa menampilkan request dengan
            // tampilan yang SAMA seperti pasangan yang sudah terhubung.
            fromUser: await userBrief(ctx, fromTarget.fromId as Id<"users">),
          }
        : null,
      cooldownUntil,
      onCooldown: cooldownUntil > now,
      myKindWithTarget: pair ? (pair.kind as AffinityKind) : null,
    };
  },
});

/** Daftar teman untuk layar "Ajak" + status undangan yang sudah terkirim. */
export const inviteableFriends = query({
  args: { targetId: v.id("users") },
  handler: async (ctx, { targetId }) => {
    const me = await getAuthUserId(ctx);
    if (me === null) return [];
    const rowsA = await ctx.db
      .query("friendships")
      .withIndex("userA", (q) => q.eq("userA", me))
      .collect();
    const rowsB = await ctx.db
      .query("friendships")
      .withIndex("userB", (q) => q.eq("userB", me))
      .collect();
    const mine = await linksOf(ctx, me);
    const pending = await ctx.db
      .query("affinityInvites")
      .withIndex("from", (q) => q.eq("fromId", me))
      .collect();
    const out: any[] = [];
    const seen = new Set<string>();
    for (const f of [...rowsA, ...rowsB]) {
      const fid = f.userA === me ? f.userB : f.userA;
      if (seen.has(String(fid)) || fid === targetId) continue;
      seen.add(String(fid));
      const linked = mine.some(
        (l: any) =>
          (l.userA === me && l.userB === fid) ||
          (l.userB === me && l.userA === fid),
      );
      const sent = pending.find(
        (p: any) =>
          p.toId === fid &&
          p.status === "pending" &&
          Date.now() - p.createdAt < 7 * DAY_MS,
      );
      const brief = await userBrief(ctx, fid);
      if (brief)
        out.push({
          ...brief,
          linked,
          invitedKind: sent ? (sent.kind as AffinityKind) : null,
        });
    }
    out.sort((a, b) => a.username.localeCompare(b.username));
    return out;
  },
});

/** Kirim undangan Afinitas (dari sheet pilihan jenis / layar Ajak). */
export const invite = mutation({
  args: { toUserId: v.id("users"), kind: v.string() },
  handler: async (ctx, { toUserId, kind }) => {
    const me = await getAuthUserId(ctx);
    if (me === null) throw new Error("Belum masuk");
    if (me === toUserId) throw new Error("Tidak bisa mengajak diri sendiri");
    if (!KINDS.includes(kind as AffinityKind))
      throw new Error("Jenis relasi tidak dikenal");

    // Cooldown pasca-putus (7 hari) — dua arah.
    const now = Date.now();
    const b1 = await ctx.db
      .query("affinityBreaks")
      .withIndex("pair", (q) => q.eq("userA", me).eq("userB", toUserId))
      .first();
    const b2 = await ctx.db
      .query("affinityBreaks")
      .withIndex("pair", (q) => q.eq("userA", toUserId).eq("userB", me))
      .first();
    const until = Math.max(b1?.blockedUntil ?? 0, b2?.blockedUntil ?? 0);
    if (until > now) {
      const sisa = Math.ceil((until - now) / DAY_MS);
      throw new Error(`Baru putus — tunggu ${sisa} hari lagi untuk mengajak lagi`);
    }

    // Sudah terhubung?
    const mine = await linksOf(ctx, me);
    const linked = mine.some(
      (l: any) =>
        (l.userA === me && l.userB === toUserId) ||
        (l.userB === me && l.userA === toUserId),
    );
    if (linked) throw new Error("Kalian sudah terhubung");

    // Satu undangan aktif per pasangan.
    const existing = await ctx.db
      .query("affinityInvites")
      .withIndex("to_status", (q) => q.eq("toId", toUserId).eq("status", "pending"))
      .collect();
    const dup = existing.find((e) => e.fromId === me);
    if (dup) {
      await ctx.db.patch(dup._id, { kind: kind as AffinityKind, createdAt: now });
      return dup._id;
    }

    const invId = await ctx.db.insert("affinityInvites", {
      fromId: me,
      toId: toUserId,
      kind: kind as AffinityKind,
      createdAt: now,
      status: "pending",
    });
    const fromUser = await ctx.db.get(me);
    const label =
      kind === "pasangan" ? "Pasangan" :
      kind === "saudara" ? "Saudara" :
      kind === "sahabat" ? "Sahabat" : "Orang Terpercaya";
    await ctx.db.insert("notifications", {
      userId: toUserId,
      type: "affinity_invite",
      title: `${fromUser?.username ?? "Seseorang"} Mengajak mu untuk menjadi ${label}`,
      body: "Ketuk untuk membuka Afinitas",
      refUserId: me,
      createdAt: now,
    });
    return invId;
  },
});

/** Terima / tolak undangan Afinitas. */
export const respond = mutation({
  args: { inviteId: v.id("affinityInvites"), accept: v.boolean() },
  handler: async (ctx, { inviteId, accept }) => {
    const me = await getAuthUserId(ctx);
    if (me === null) throw new Error("Belum masuk");
    const inv = await ctx.db.get(inviteId);
    if (!inv || inv.toId !== me) throw new Error("Undangan tidak ditemukan");
    if (inv.status !== "pending") throw new Error("Undangan sudah diproses");
    if (Date.now() - inv.createdAt > 7 * DAY_MS) {
      await ctx.db.patch(inviteId, { status: "rejected" });
      throw new Error("Undangan kedaluwarsa");
    }
    if (!accept) {
      await ctx.db.patch(inviteId, { status: "rejected" });
      return null;
    }
    // Hapus undangan lain antar pasangan ini (duplikat jenis berbeda).
    const others = await ctx.db
      .query("affinityInvites")
      .withIndex("from", (q) => q.eq("fromId", inv.fromId))
      .collect();
    for (const o of others)
      if (o.toId === me && o.status === "pending")
        await ctx.db.patch(o._id, { status: "rejected" });

    const now = Date.now();
    const linkId = await ctx.db.insert("affinity", {
      userA: inv.fromId,
      userB: me,
      kind: inv.kind,
      bondXp: 0,
      createdAt: now,
      chatDay: dayKey(now),
      chatCount: 0,
      give7: 0,
      give30: 0,
    });
    await ctx.db.patch(inviteId, { status: "accepted" });

    const meDoc = await ctx.db.get(me);
    const label =
      inv.kind === "pasangan" ? "Pasangan" :
      inv.kind === "saudara" ? "Saudara" :
      inv.kind === "sahabat" ? "Sahabat" : "Orang Terpercaya";
    await ctx.db.insert("notifications", {
      userId: inv.fromId,
      type: "affinity_accepted",
      title: `${meDoc?.username ?? "Seseorang"} menerima ajakanmu menjadi ${label}`,
      body: "Ketuk untuk membuka Afinitas",
      refUserId: me,
      createdAt: now,
    });
    return linkId;
  },
});

/** Putuskan relasi + cooldown 7 hari sebelum boleh mengajak lagi. */
export const breakLink = mutation({
  args: { linkId: v.id("affinity") },
  handler: async (ctx, { linkId }) => {
    const me = await getAuthUserId(ctx);
    if (me === null) throw new Error("Belum masuk");
    const l = await ctx.db.get(linkId);
    if (!l || (l.userA !== me && l.userB !== me))
      throw new Error("Relasi tidak ditemukan");
    const other = l.userA === me ? l.userB : l.userA;
    const now = Date.now();
    await ctx.db.delete(linkId);
    // Cooldown dua arah: keduanya tidak saling mengajak 7 hari.
    await ctx.db.insert("affinityBreaks", {
      userA: me,
      userB: other,
      blockedUntil: now + 7 * DAY_MS,
    });
    await ctx.db.insert("affinityBreaks", {
      userA: other,
      userB: me,
      blockedUntil: now + 7 * DAY_MS,
    });
    return true;
  },
});

/**
 * Leaderboard Afinitas — tab per jenis. Tiap baris = satu link, ditampilkan
 * dari perspektif owner (foto owner, lalu partner + icon relasi + XP bond).
 * Boleh satu orang muncul berkali-kali (per tiap partner).
 */
export const leaderboard = query({
  args: { kind: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { kind, limit = 50 }) => {
    const me = await getAuthUserId(ctx);
    if (me === null) return [];
    // Ambil semua link jenis ini dari kedua sisi owner.
    const rows = await ctx.db
      .query("affinity")
      .filter((q) => q.eq(q.field("kind"), kind))
      .collect();
    const out: any[] = [];
    for (const l of rows) {
      const owner = await userBrief(ctx, l.userA);
      const partner = await userBrief(ctx, l.userB);
      if (!owner || !partner) continue;
      out.push({
        linkId: l._id,
        owner,
        partner,
        xp: l.bondXp ?? 0,
        isMine: l.userA === me || l.userB === me,
      });
    }
    out.sort((a, b) => b.xp - a.xp);
    return out.slice(0, Math.min(limit, 100));
  },
});

/**
 * Dipanggil ChatPanel tiap kirim pesan DM: progres misi harian chat bond
 * (5 chat/hari) + 20 XP bond sekali selesai per hari.
 * Dipanggil juga saat pesan DITERIMA (dihitung sekali per arah, aman).
 */
export const noteChat = mutation({
  args: { peerId: v.id("users") },
  handler: async (ctx, { peerId }) => {
    return await noteChatFor(ctx, await getAuthUserId(ctx), peerId);
  },
});

/** Helper agar bisa dipanggil dari mutation lain (mis. chat.sendMessage). */
export async function noteChatFor(
  ctx: any,
  me: Id<"users"> | null,
  peerId: Id<"users">,
) {
  if (me === null) return null;
  const mine = await linksOf(ctx, me);
  const pair = mine.find(
    (l: any) =>
      (l.userA === me && l.userB === peerId) ||
      (l.userB === me && l.userA === peerId),
  );
  if (!pair) return null;
  const now = Date.now();
  const today = dayKey(now);
  const chatCount = pair.chatDay === today ? (pair.chatCount ?? 0) + 1 : 1;
  const patch: Record<string, unknown> = {
    chatDay: today,
    chatCount,
  };
  let gained = 0;
  if (chatCount >= 5 && pair.chatDoneDay !== today) {
    patch.chatDoneDay = today;
    patch.bondXp = (pair.bondXp ?? 0) + 20;
    gained = 20;
  } else {
    patch.bondXp = pair.bondXp ?? 0;
  }
  await ctx.db.patch(pair._id, patch);
  return gained;
}

/**
 * Dipanggil saat give premium diterima: misi bond "give 7 hari ×2" dan
 * "give 30 hari ×2" + XP bond tiap progres (7 hari +30, 30 hari +80).
 */
export const noteGivePremium = mutation({
  args: { peerId: v.id("users"), days: v.number() },
  handler: async (ctx, { peerId, days }) => {
    return await noteGivePremiumFor(ctx, await getAuthUserId(ctx), peerId, days);
  },
});

/** Helper agar bisa dipanggil dari chat.givePremium (sekali jalan). */
export async function noteGivePremiumFor(
  ctx: any,
  me: Id<"users"> | null,
  peerId: Id<"users">,
  days: number,
) {
  if (me === null) return null;
  const mine = await linksOf(ctx, me);
  const pair = mine.find(
    (l: any) =>
      (l.userA === me && l.userB === peerId) ||
      (l.userB === me && l.userA === peerId),
  );
  if (!pair) return null;
  const patch: Record<string, unknown> = {};
  let gained = 0;
  if (days >= 7 && (pair.give7 ?? 0) < 2) {
    patch.give7 = (pair.give7 ?? 0) + 1;
    gained += 30;
  }
  if (days >= 30 && (pair.give30 ?? 0) < 2) {
    patch.give30 = (pair.give30 ?? 0) + 1;
    gained += 80;
  }
  if (gained > 0) {
    patch.bondXp = (pair.bondXp ?? 0) + gained;
    await ctx.db.patch(pair._id, patch);
  }
  return gained;
}
