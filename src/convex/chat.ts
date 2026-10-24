// YoruNime — chat global / DM / clan + give premium + notifikasi sosial.
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { addXpInternal } from "./xp";
import { requireActive } from "./moderation";

const TEXT_MAX = 2000;

/**
 * Cek banned/muted.
 *
 * formerly `ctx.runQuery(internal.moderation.isBlockedInternal, {})` — nested
 * query itu memanggil satu fungsi Convex penuh (plus parse JWT kedua) di setiap
 * pembacaan chat, padahal datanya cuma satu `ctx.db.get`. Di inlinekan supaya
 * opening chat global tidak menambah satu round-trip yang tidak perlu.
 */
async function blocked(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) return false;
  const me = await ctx.db.get(userId);
  if (!me) return false;
  const now = Date.now();
  return (me.bannedUntil ?? 0) > now || (me.mutedUntil ?? 0) > now;
}

function dmKey(a: string, b: string) {
  return [a, b].sort().join("|");
}

// -------------------------------------------------------------- read ----

export const listMessages = query({
  args: {
    kind: v.string(), // global | dm | clan | room
    clanId: v.optional(v.id("clans")),
    roomId: v.optional(v.id("watchRooms")),
    peerId: v.optional(v.id("users")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { kind, clanId, roomId, peerId, limit = 80 }) => {
    const block = await blocked(ctx);
    if (block) return [];
    let index: string | undefined = undefined;
    if (kind === "dm" && peerId) {
      const me = await getAuthUserId(ctx);
      if (me === null) return [];
      index = dmKey(me, peerId);
    }
    let rows;
    if (kind === "room" && roomId) {
      const me = await getAuthUserId(ctx);
      if (me === null) return [];
      const room = await ctx.db.get(roomId);
      if (!room) return [];
      const isHost = room.hostId === me;
      if (!isHost && room.visibility === "selected") {
        const allowed = (room.allowedUserIds ?? []).some((id) => id === me);
        if (!allowed) return [];
      }
      rows = await ctx.db
        .query("chatMessages")
        .withIndex("roomId_created", (q) => q.eq("roomId", roomId))
        .order("desc")
        .take(limit);
    } else if (kind === "dm" && index) {
      rows = await ctx.db
        .query("chatMessages")
        .withIndex("dmKey_created", (q) => q.eq("dmKey", index!))
        .order("desc")
        .take(limit);
    } else if (kind === "clan" && clanId) {
      rows = await ctx.db
        .query("chatMessages")
        .withIndex("kind_clan_created", (q) =>
          q.eq("kind", "clan").eq("clanId", clanId),
        )
        .order("desc")
        .take(limit);
    } else {
      rows = await ctx.db
        .query("chatMessages")
        .withIndex("kind_clan_created", (q) => q.eq("kind", "global").eq("clanId", undefined))
        .order("desc")
        .take(limit);
    }
    rows = rows.filter((r: any) => !r.deleted);
    // Semua data pendukung (user, give, reply) diambil SEKALIGUS di depan,
    // bukan satu per satu di dalam loop. Versi lama melakukan `await ctx.db.get`
    // tiap baris sehingga 80 pesan bisa memicu ratusan round-trip berurutan —
    // itulah penyebab chat lama loading lama.
    const ordered: any[] = rows.slice().reverse();
    const uniq = <T,>(xs: T[]) => [...new Set(xs)];
    const userIds = uniq(ordered.map((r) => r.userId));
    const giveIds = uniq(
      ordered.map((r) => r.premiumGiveId).filter((x): x is string => !!x),
    );
    const replyIds = uniq(
      ordered.map((r) => r.replyToId).filter((x): x is string => !!x),
    );
    const [userDocs, giveDocs, replyDocs] = await Promise.all([
      Promise.all(userIds.map((id) => ctx.db.get(id as never))),
      Promise.all(giveIds.map((id) => ctx.db.get(id as never))),
      Promise.all(replyIds.map((id) => ctx.db.get(id as never))),
    ]);
    const users = new Map<string, any>(userIds.map((id, i) => [id, userDocs[i]]));
    const gives = new Map<string, any>(giveIds.map((id, i) => [id, giveDocs[i]]));

    // Balasan butuh data user si pembalas — sekali lagi, batch per id unik.
    const replyRows = replyDocs.filter((m: any) => m && !m.deleted) as any[];
    const replyUserIds = uniq(replyRows.map((m) => m.userId));
    const replyUserDocs = await Promise.all(
      replyUserIds.map((id) => ctx.db.get(id as never)),
    );
    const replyUsers = new Map<string, any>(
      replyUserIds.map((id, i) => [id, replyUserDocs[i]]),
    );
    const replyById = new Map<string, any>();
    for (const rm of replyRows) {
      const ru = replyUsers.get(rm.userId);
      replyById.set(rm._id, {
        _id: rm._id,
        username: ru?.username ?? "?",
        text: rm.text ?? undefined,
        premiumGiveId: rm.premiumGiveId ?? undefined,
      });
    }

    // URL foto dari storage juga diambil paralel.
    const withPhoto = ordered.filter((r) => r.imageStorageId);
    const photoUrls = await Promise.all(
      withPhoto.map((r) => ctx.storage.getUrl(r.imageStorageId)),
    );
    const photoByUrl = new Map<string, string | null>(
      withPhoto.map((r, i) => [r._id as string, photoUrls[i]]),
    );

    const out = ordered.map((r) => {
      const u = users.get(r.userId);
      const give = r.premiumGiveId ? gives.get(r.premiumGiveId) : null;
      return {
        _id: r._id,
        kind: r.kind,
        userId: r.userId,
        username: u?.username ?? "user",
        image: u?.image,
        level: u?.level ?? 1,
        premium: (u?.premiumUntil ?? 0) > Date.now(),
        avatarBorder: u?.avatarBorder,
        clanTag: u?.clanTag,
        clanTagIcon: u?.clanTagIcon,
        clanNameColor: u?.clanNameColor,
        clanLevel: u?.clanLevel,
        staffRole: u?.staffRole,
        text: r.text,
        imageUrl: r.imageStorageId
          ? (photoByUrl.get(r._id) ?? r.imageUrl)
          : r.imageUrl,
        premiumGive: give
          ? {
              _id: give._id,
              days: give.days,
              slots: give.slots,
              message: give.message,
              claimedBy: give.claimedBy,
            }
          : undefined,
        replyTo: r.replyToId ? (replyById.get(r.replyToId) ?? null) : null,
        createdAt: r.createdAt,
      };
    });
    return out;
  },
});

// ------------------------------------------------------------- write ----

export const sendMessage = mutation({
  args: {
    kind: v.string(),
    clanId: v.optional(v.id("clans")),
    roomId: v.optional(v.id("watchRooms")),
    peerId: v.optional(v.id("users")),
    text: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    imageStorageId: v.optional(v.string()),
    replyToId: v.optional(v.id("chatMessages")),
  },
  handler: async (ctx, { kind, clanId, roomId, peerId, text, imageUrl, imageStorageId, replyToId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const me = await ctx.db.get(userId);
    if (!me) throw new Error("User not found");
    await requireActive(me);
    if (!text?.trim() && !imageUrl && !imageStorageId) throw new Error("Pesan kosong");
    // Data-URL/base64 ditolak: batas dokumen Convex cuma 1MB. Foto harus lewat storage.
    if (imageUrl && imageUrl.startsWith("data:")) {
      throw new Error("Kirim foto lewat tombol foto (bukan teks gambar)");
    }
    // Kirim foto dikunci Premium — dicek di server juga, bukan cuma tombol
    // yang disembunyikan di UI. User non-premium tidak bisa mengirim foto
    // dengan cara apa pun.
    if ((imageStorageId || imageUrl) && (me.premiumUntil ?? 0) < Date.now()) {
      throw new Error("Kirim foto hanya untuk akun Premium");
    }
    if (text && text.length > TEXT_MAX) throw new Error("Pesan terlalu panjang");

    let index: string | undefined = undefined;
    if (kind === "dm") {
      if (!peerId) throw new Error("Penerima tidak ada");
      index = dmKey(userId, peerId);
    }
    if (kind === "clan") {
      if (!clanId) throw new Error("Clan tidak ada");
      const member = await ctx.db
        .query("clanMembers")
        .withIndex("userId", (q) => q.eq("userId", userId))
        .first();
      if (!member || member.clanId !== clanId)
        throw new Error("Kamu bukan member clan ini");
    }
    if (kind === "room") {
      if (!roomId) throw new Error("Room tidak ada");
      const room = await ctx.db.get(roomId);
      if (!room || room.endedAt) throw new Error("Room sudah diakhiri");
      const isHost = room.hostId === userId;
      if (
        !isHost &&
        room.visibility === "selected" &&
        !(room.allowedUserIds ?? []).some((id) => id === userId)
      )
        throw new Error("Kamu tidak diundang ke room ini");
    }

    const messageId = await ctx.db.insert("chatMessages", {
      kind,
      clanId,
      roomId,
      dmKey: index,
      userId,
      text: text?.trim() || undefined,
      imageUrl,
      imageStorageId,
      replyToId,
      createdAt: Date.now(),
    });

    // XP kecil tiap chat aktif + trigger notifikasi teman.
    await addXpInternal(ctx, userId, 5, "chat");

    if (kind === "dm" && peerId) {
      await ctx.db.insert("notifications", {
        userId: peerId,
        type: "friend_chat",
        title: "Chat teman",
        body: `${me.username ?? "Seseorang"}: ${(text ?? "[foto]").slice(0, 80)}`,
        refUserId: userId,
        refMessageId: messageId,
        createdAt: Date.now(),
      });
    }
    return { messageId };
  },
});

export const deleteMessage = mutation({
  args: { messageId: v.id("chatMessages") },
  handler: async (ctx, { messageId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const msg = await ctx.db.get(messageId);
    if (!msg) throw new Error("Pesan tidak ada");
    if (msg.userId !== userId) throw new Error("Bukan pesan kamu");
    await ctx.db.patch(messageId, { deleted: true });
    return { ok: true };
  },
});

// ------------------------------------------------------ image posting ----

export const nsfwReport = mutation({
  args: { passed: v.boolean() },
  handler: async (ctx, { passed }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    if (passed) return { strikes: 0 };
    const me = await ctx.db.get(userId);
    if (!me) throw new Error("User not found");
    const strikes = (me.nsfwStrikes ?? 0) + 1;
    await ctx.db.patch(userId, { nsfwStrikes: strikes });
    return { strikes };
  },
});

// ------------------------------------------------------ give premium ----

const DAY_COST: Record<number, number> = {
  1: 2, 3: 4, 5: 6, 7: 9, 15: 17, 20: 23, 25: 30, 30: 32,
};
// Semakin banyak penerima (slot claim), semakin mahal biaya harinya —
// permintaan: "semakin banyak user claim semakin banyak hari yang dibutuhin
// buat give premium".
const RECEIVER_COST: Record<number, number> = { 5: 0, 15: 3, 20: 6, 30: 10 };
const DAY_XP: Record<number, number> = {
  1: 250, 3: 550, 5: 700, 7: 1000, 15: 2100, 20: 4000, 25: 5500, 30: 6900,
};

export function giveCost(days: number, receivers: number) {
  const base = DAY_COST[days] ?? days + 1;
  const sur =
    RECEIVER_COST[receivers] ?? Math.max(0, Math.ceil((receivers - 5) * 0.35));
  return base + sur;
}

export function giveXp(days: number, receivers: number) {
  const base = DAY_XP[days] ?? days * 200;
  return base + Math.max(0, receivers - 5) * 100;
}

export const givePremium = mutation({
  args: {
    kind: v.string(),
    clanId: v.optional(v.id("clans")),
    peerId: v.optional(v.id("users")),
    days: v.number(),
    receivers: v.number(),
    message: v.optional(v.string()),
  },
  handler: async (ctx, { kind, clanId, peerId, days, receivers, message }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const me = await ctx.db.get(userId);
    if (!me) throw new Error("User not found");
    await requireActive(me);
    if (!DAY_COST[days]) throw new Error("Pilih hari yang valid");
    if (receivers < 5 || receivers > 30)
      throw new Error("Penerima harus 5-30 orang");
    if (message && message.trim().length > 0 && message.trim().length < 50)
      throw new Error("Pesan minimal 50 karakter (atau kosongkan)");
    const remaining = Math.max(
      0,
      Math.floor(((me.premiumUntil ?? 0) - Date.now()) / 86400000),
    );
    const cost = giveCost(days, receivers);
    // Premium unlimited (diberikan developer): premium tidak berkurang.
    if (!me.unlimitedPremium && remaining < cost)
      throw new Error(`Premium kamu kurang ${cost - remaining} hari`);
    const myClanTag = me.clanTag;
    if (!me.unlimitedPremium) {
      await ctx.db.patch(userId, {
        premiumUntil: Math.max(
          0,
          (me.premiumUntil ?? 0) - cost * 86400000,
        ),
      });
    }

    // Dokumen disusun tanpa key bernilai undefined supaya Convex tidak
    // menolak dengan "Server Error" (undefined tidak boleh ada di doc).
    const msgText = message?.trim();
    const giveDoc: Record<string, unknown> = {
      fromUserId: userId,
      days,
      cost,
      slots: receivers,
      claimedBy: [],
      claimedAt: 0,
      expired: false,
      createdAt: Date.now(),
    };
    if (msgText && msgText.length >= 50) giveDoc.message = msgText;

    const giveId = await ctx.db.insert("premiumGives", giveDoc as never);
    const chatDoc: Record<string, unknown> = {
      kind,
      userId,
      premiumGiveId: giveId,
      createdAt: Date.now(),
    };
    if (clanId) chatDoc.clanId = clanId;
    if (kind === "dm" && peerId) chatDoc.dmKey = dmKey(userId, peerId);
    const messageId = await ctx.db.insert("chatMessages", chatDoc as never);
    await ctx.db.patch(giveId, { chatMessageId: messageId });

    await addXpInternal(ctx, userId, giveXp(days, receivers), "give_premium");
    void myClanTag;
    return { messageId, giveId };
  },
});

export const claimGive = mutation({
  args: { giveId: v.id("premiumGives") },
  handler: async (ctx, { giveId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const give = await ctx.db.get(giveId);
    if (!give) throw new Error("Give tidak ada");
    if (give.expired || give.claimedBy.length >= give.slots)
      throw new Error("Slot sudah habis");
    if (give.claimedBy.some((c) => c === userId))
      throw new Error("Sudah pernah claim");
    // Orang yang memberi give tidak bisa claim give-nya sendiri.
    if (give.fromUserId === userId)
      throw new Error("Tidak bisa claim give milik sendiri");
    const me = await ctx.db.get(userId);
    if (!me) throw new Error("User not found");
    const base = Math.max(Date.now(), me.premiumUntil ?? 0);
    await ctx.db.patch(userId, {
      premiumUntil: base + give.days * 86400000,
    });
    const claimedBy = [...give.claimedBy, userId];
    await ctx.db.patch(giveId, {
      claimedBy,
      claimedAt: Date.now(),
      expired: claimedBy.length >= give.slots,
    });
    // Kabari pemberi give: siapa yang claim dan berapa hari yang diambil.
    await ctx.db.insert("notifications", {
      userId: give.fromUserId,
      type: "premiumClaim",
      title: "Claim Premium Dari Kamu",
      body: `${me.username ?? "Seseorang"} telah claim ${give.days} hari premium darimu`,
      refUserId: userId,
      createdAt: Date.now(),
    });
    return { claimed: claimedBy.length, slots: give.slots };
  },
});
