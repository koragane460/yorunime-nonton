// LStream — chat global / DM / clan + give premium + notifikasi sosial.
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { addXpInternal } from "./xp";
import { requireActive } from "./moderation";

const TEXT_MAX = 2000;

async function blocked(ctx: any) {
  return await ctx.runQuery(internal.moderation.isBlockedInternal, {});
}

function dmKey(a: string, b: string) {
  return [a, b].sort().join("|");
}

// -------------------------------------------------------------- read ----

export const listMessages = query({
  args: {
    kind: v.string(), // global | dm | clan
    clanId: v.optional(v.id("clans")),
    peerId: v.optional(v.id("users")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { kind, clanId, peerId, limit = 80 }) => {
    const block = await blocked(ctx);
    if (block) return [];
    let index: string | undefined = undefined;
    if (kind === "dm" && peerId) {
      const me = await getAuthUserId(ctx);
      if (me === null) return [];
      index = dmKey(me, peerId);
    }
    let rows;
    if (kind === "dm" && index) {
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
    const users = new Map<string, any>();
    const gives = new Map<string, any>();
    const out = [];
    for (const r of rows.reverse()) {
      let u = users.get(r.userId);
      if (!u) {
        u = await ctx.db.get(r.userId);
        users.set(r.userId, u);
      }
      let give = null;
      if (r.premiumGiveId) {
        give = gives.get(r.premiumGiveId) ?? (await ctx.db.get(r.premiumGiveId));
        gives.set(r.premiumGiveId, give);
      }
      let replyTo = null;
      if (r.replyToId) {
        const rm = await ctx.db.get(r.replyToId);
        if (rm && !rm.deleted) {
          const ru = await ctx.db.get(rm.userId);
          replyTo = {
            _id: rm._id,
            username: ru?.username ?? "?",
            text: rm.text ?? undefined,
            premiumGiveId: rm.premiumGiveId ?? undefined,
          };
        }
      }
      out.push({
        _id: r._id,
        kind: r.kind,
        userId: r.userId,
        username: u?.username ?? "user",
        image: u?.image,
        level: u?.level ?? 1,
        clanTag: u?.clanTag,
        clanTagIcon: u?.clanTagIcon,
        clanNameColor: u?.clanNameColor,
        text: r.text,
        imageUrl: r.imageUrl,
        premiumGive: give
          ? {
              _id: give._id,
              days: give.days,
              slots: give.slots,
              message: give.message,
              claimedBy: give.claimedBy,
            }
          : undefined,
        replyTo,
        createdAt: r.createdAt,
      });
    }
    return out;
  },
});

// ------------------------------------------------------------- write ----

export const sendMessage = mutation({
  args: {
    kind: v.string(),
    clanId: v.optional(v.id("clans")),
    peerId: v.optional(v.id("users")),
    text: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    replyToId: v.optional(v.id("chatMessages")),
  },
  handler: async (ctx, { kind, clanId, peerId, text, imageUrl, replyToId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const me = await ctx.db.get(userId);
    if (!me) throw new Error("User not found");
    await requireActive(me);
    if (!text?.trim() && !imageUrl) throw new Error("Pesan kosong");
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

    const messageId = await ctx.db.insert("chatMessages", {
      kind,
      clanId,
      dmKey: index,
      userId,
      text: text?.trim() || undefined,
      imageUrl,
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
const RECEIVER_COST: Record<number, number> = { 5: 1, 15: 1, 20: 3, 30: 4 };
const DAY_XP: Record<number, number> = {
  1: 250, 3: 550, 5: 700, 7: 1000, 15: 2100, 20: 4000, 25: 5500, 30: 6900,
};

export function giveCost(days: number, receivers: number) {
  const base = DAY_COST[days] ?? days + 1;
  const sur = RECEIVER_COST[receivers] ?? Math.max(0, Math.ceil((receivers - 5) / 7));
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
    if (remaining < cost)
      throw new Error(`Premium kamu kurang ${cost - remaining} hari`);
    const myClanTag = me.clanTag;
    await ctx.db.patch(userId, {
      premiumUntil: (me.premiumUntil ?? 0) - cost * 86400000,
    });

    const giveId = await ctx.db.insert("premiumGives", {
      fromUserId: userId,
      days,
      cost,
      slots: receivers,
      message: message && message.trim().length >= 50 ? message.trim() : undefined,
      claimedBy: [],
      claimedAt: 0,
      expired: false,
      createdAt: Date.now(),
    });
    const messageId = await ctx.db.insert("chatMessages", {
      kind,
      clanId,
      dmKey:
        kind === "dm" && peerId ? dmKey(userId, peerId) : undefined,
      userId,
      premiumGiveId: giveId,
      createdAt: Date.now(),
    });
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
    return { claimed: claimedBy.length, slots: give.slots };
  },
});
