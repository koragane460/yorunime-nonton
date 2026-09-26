// LStream — clan: buat/join/roles/donate/level/claim/panel.
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { addXpInternal } from "./xp";

export const CLAN_LEVELS_MAX = 200;
const BASE_LEVEL_COST = 700;
const COST_STEP = 10;
const BASE_CLAIM = 100;
const CLAIM_PER_LEVEL = 5;
const CREATE_COST = 1000;

export function levelCost(level: number) {
  return BASE_LEVEL_COST + (level - 1) * COST_STEP;
}

export function claimAmountForLevel(level: number) {
  return BASE_CLAIM + Math.max(0, level - 1) * CLAIM_PER_LEVEL;
}

export const CLAN_COLORS: Record<number, { name: string; cls: string }> = {
  25: { name: "Merah", cls: "#f87171" },
  100: { name: "Galaxy", cls: "galaxy" },
  150: { name: "Oren", cls: "#fb923c" },
  200: { name: "Golden", cls: "golden" },
};

function dayString(offsetDays = 0) {
  const d = new Date(Date.now() - offsetDays * 86400000);
  return d.toISOString().slice(0, 10);
}

async function myClan(ctx: any, userId: string) {
  const member = await ctx.db
    .query("clanMembers")
    .withIndex("userId", (q: any) => q.eq("userId", userId))
    .first();
  if (!member) return null;
  const clan = await ctx.db.get(member.clanId);
  if (!clan) return null;
  return { member, clan };
}

function clanPublic(clan: any, memberCount: number) {
  const level = clan.level ?? 1;
  let color = "";
  if (level >= 200) color = "golden";
  else if (level >= 150) color = "oren";
  else if (level >= 100) color = "galaxy";
  else if (level >= 25) color = "merah";
  const ageDays = Math.max(
    0,
    Math.floor((Date.now() - (clan.createdAt ?? Date.now())) / 86400000),
  );
  return {
    _id: clan._id,
    name: clan.name,
    tag: clan.tag,
    tagIcon: clan.tagIcon,
    avatarUrl: clan.avatarUrl,
    backgroundUrl: clan.backgroundUrl,
    description: clan.description,
    diamonds: clan.diamonds,
    level,
    levelProgress: clan.levelProgress,
    levelCost: levelCost(level),
    claimAmount: claimAmountForLevel(level),
    color,
    ageDays,
    memberCount,
  };
}

// -------------------------------------------------------------- read ----

export const clanDetail = query({
  args: { clanId: v.id("clans") },
  handler: async (ctx, { clanId }) => {
    const userId = await getAuthUserId(ctx);
    const clan = await ctx.db.get(clanId);
    if (!clan) return null;
    const members = await ctx.db
      .query("clanMembers")
      .withIndex("clanId", (q) => q.eq("clanId", clanId))
      .collect();
    const roleRank: Record<string, number> = {
      leader: 0,
      officer: 1,
      victro: 2,
      hydler: 3,
      member: 4,
    };
    const memberViews = [];
    for (const m of members) {
      const u = await ctx.db.get(m.userId);
      memberViews.push({
        userId: m.userId,
        username: u?.username ?? "user",
        image: u?.image,
        bannerUrl: u?.bannerUrl,
        role: m.role,
        donatedTotal: m.donatedTotal,
        donatedToday: m.lastDonateDay === dayString() ? m.donatedToday : 0,
        joinedAt: m.joinedAt,
      });
    }
    memberViews.sort(
      (a, b) =>
        (roleRank[a.role] ?? 9) - (roleRank[b.role] ?? 9) ||
        b.donatedTotal - a.donatedTotal,
    );
    const today = dayString();
    const todayDonations = memberViews.filter((m) => m.donatedToday > 0);
    const me = userId
      ? members.find((m) => m.userId === userId)
      : undefined;
    const myRequest =
      userId != null
        ? await ctx.db
            .query("clanRequests")
            .withIndex("userId_status", (q) =>
              q.eq("userId", userId).eq("status", "pending"),
            )
            .first()
        : null;
    const requests =
      me && (me.role === "leader" || me.role === "officer")
        ? await ctx.db
            .query("clanRequests")
            .withIndex("clanId_status", (q) =>
              q.eq("clanId", clanId).eq("status", "pending"),
            )
            .collect()
        : [];
    const requestViews = [];
    for (const r of requests) {
      const u = await ctx.db.get(r.userId);
      requestViews.push({
        requestId: r._id,
        userId: r.userId,
        username: u?.username ?? "user",
        image: u?.image,
        level: u?.level,
      });
    }
    return {
      clan: clanPublic(clan, members.length),
      leaderId: clan.leaderId,
      members: memberViews,
      todayDonationsTotal: todayDonations.reduce((s, m) => s + m.donatedToday, 0),
      todayDonators: todayDonations.length,
      topDonateToday: [...todayDonations]
        .sort((a, b) => b.donatedToday - a.donatedToday)
        .slice(0, 50),
      myRole: me?.role,
      myDonatedTotal: me?.donatedTotal,
      myLastClaimDay: me?.lastClaimDay,
      myRequestClanId: myRequest?.clanId,
      myRequestId: myRequest?._id,
      requests: requestViews,
    };
  },
});

export const listClans = query({
  args: { q: v.optional(v.string()) },
  handler: async (ctx, { q }) => {
    const clans = await ctx.db.query("clans").collect();
    const userId = await getAuthUserId(ctx);
    const myMembership = userId
      ? await ctx.db
          .query("clanMembers")
          .withIndex("userId", (q) => q.eq("userId", userId))
          .first()
      : null;
    const myRequest = userId
      ? await ctx.db
          .query("clanRequests")
          .withIndex("userId_status", (q) =>
            q.eq("userId", userId).eq("status", "pending"),
          )
          .first()
      : null;
    const out = [];
    for (const c of clans) {
      const members = await ctx.db
        .query("clanMembers")
        .withIndex("clanId", (q) => q.eq("clanId", c._id))
        .collect();
      if (q && !c.name.toLowerCase().includes(q.toLowerCase())) continue;
      out.push({
        ...clanPublic(c, members.length),
        isMine: myMembership?.clanId === c._id,
        isRequested: myRequest?.clanId === c._id,
      });
    }
    out.sort((a, b) => b.diamonds - a.diamonds);
    return out;
  },
});

export const myMembership = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const res = await myClan(ctx, userId);
    if (!res) return null;
    return {
      clan: clanPublic(res.clan, 0),
      role: res.member.role,
      clanId: res.clan._id,
    };
  },
});

// ------------------------------------------------------------- write ----

export const createClan = mutation({
  args: {
    name: v.string(),
    tag: v.string(),
    tagIcon: v.string(),
    avatarUrl: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, { name, tag, tagIcon, avatarUrl, description }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const me = await ctx.db.get(userId);
    if (!me) throw new Error("User not found");
    if ((me.diamonds ?? 0) < CREATE_COST)
      throw new Error("Butuh 1000 berlian untuk buat clan");
    const cleanTag = tag.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (cleanTag.length < 3 || cleanTag.length > 4)
      throw new Error("Tag clan 3-4 huruf");
    if (name.trim().length < 3) throw new Error("Nama clan minimal 3 karakter");
    const dup = await ctx.db
      .query("clans")
      .withIndex("tag", (q) => q.eq("tag", cleanTag))
      .first()
      .catch(() => null);
    if (dup) throw new Error("Tag clan sudah dipakai");
    const existing = await ctx.db
      .query("clanMembers")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .first();
    if (existing) throw new Error("Kamu sudah punya clan");
    await ctx.db.patch(userId, { diamonds: (me.diamonds ?? 0) - CREATE_COST });
    const clanId = await ctx.db.insert("clans", {
      name: name.trim(),
      tag: cleanTag,
      tagIcon,
      avatarUrl,
      description,
      leaderId: userId,
      diamonds: 0,
      level: 1,
      levelProgress: 0,
      createdAt: Date.now(),
    });
    await ctx.db.insert("clanMembers", {
      clanId,
      userId,
      role: "leader",
      donatedTotal: 0,
      donatedToday: 0,
      lastDonateDay: dayString(),
      joinedAt: Date.now(),
    });
    await ctx.db.patch(userId, { clanTag: cleanTag, clanTagIcon: tagIcon, clanNameColor: "" });
    return { clanId };
  },
});

export const requestJoin = mutation({
  args: { clanId: v.id("clans") },
  handler: async (ctx, { clanId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const existing = await ctx.db
      .query("clanMembers")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .first();
    if (existing) throw new Error("Kamu sudah punya clan");
    const pending = await ctx.db
      .query("clanRequests")
      .withIndex("userId_status", (q) =>
        q.eq("userId", userId).eq("status", "pending"),
      )
      .first();
    if (pending) {
      if (pending.clanId === clanId) {
        await ctx.db.delete(pending._id);
        return { requested: false };
      }
      throw new Error(
        "Permintaan di clan sebelumnya masih ada, batalkan untuk request ke clan ini",
      );
    }
    await ctx.db.insert("clanRequests", {
      clanId,
      userId,
      status: "pending",
      createdAt: Date.now(),
    });
    return { requested: true };
  },
});

export const cancelRequest = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const pending = await ctx.db
      .query("clanRequests")
      .withIndex("userId_status", (q) =>
        q.eq("userId", userId).eq("status", "pending"),
      )
      .first();
    if (pending) await ctx.db.delete(pending._id);
    return { ok: true };
  },
});

export const respondRequest = mutation({
  args: { requestId: v.id("clanRequests"), accept: v.boolean() },
  handler: async (ctx, { requestId, accept }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const req = await ctx.db.get(requestId);
    if (!req || req.status !== "pending") throw new Error("Request tidak ada");
    const me = await ctx.db
      .query("clanMembers")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .first();
    if (!me || me.clanId !== req.clanId)
      throw new Error("Bukan clan kamu");
    if (!["leader", "officer"].includes(me.role))
      throw new Error("Hanya leader/officer");
    if (accept) {
      const already = await ctx.db
        .query("clanMembers")
        .withIndex("userId", (q) => q.eq("userId", req.userId))
        .first();
      if (!already) {
        await ctx.db.insert("clanMembers", {
          clanId: req.clanId,
          userId: req.userId,
          role: "member",
          donatedTotal: 0,
          donatedToday: 0,
          lastDonateDay: dayString(),
          joinedAt: Date.now(),
        });
        const clan = await ctx.db.get(req.clanId);
        if (clan)
          await ctx.db.patch(req.userId, {
            clanTag: clan.tag,
            clanTagIcon: clan.tagIcon,
            clanNameColor: "",
          });
      }
    }
    await ctx.db.patch(requestId, {
      status: accept ? "accepted" : "rejected",
    });
    await ctx.db.insert("notifications", {
      userId: req.userId,
      type: "clan",
      title: accept ? "Request clan diterima" : "Request clan ditolak",
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

export const donate = mutation({
  args: { amount: v.number() },
  handler: async (ctx, { amount }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const me = await ctx.db.get(userId);
    if (!me) throw new Error("User not found");
    const res = await myClan(ctx, userId);
    if (!res) throw new Error("Kamu belum join clan");
    if (amount < 50) throw new Error("Minimal 50 berlian");
    if ((me.diamonds ?? 0) < amount) throw new Error("Berlian tidak cukup");
    const today = dayString();
    const member = res.member;
    const donatedToday = member.lastDonateDay === today ? member.donatedToday : 0;
    await ctx.db.patch(userId, { diamonds: (me.diamonds ?? 0) - amount });
    await ctx.db.patch(member._id, {
      donatedTotal: member.donatedTotal + amount,
      donatedToday: donatedToday + amount,
      lastDonateDay: today,
    });
    await ctx.db.patch(res.clan._id, {
      diamonds: (res.clan.diamonds ?? 0) + amount,
    });
    // Level clan: 700 + 10 per level.
    let progress = (res.clan.levelProgress ?? 0) + amount;
    let level = res.clan.level ?? 1;
    while (level < CLAN_LEVELS_MAX && progress >= levelCost(level)) {
      progress -= levelCost(level);
      level += 1;
    }
    if (progress < 0) progress = 0;
    const color =
      level >= 200 ? "golden" : level >= 150 ? "oren" : level >= 100 ? "galaxy" : level >= 25 ? "merah" : "";
    await ctx.db.patch(res.clan._id, { levelProgress: progress, level });
    const members = await ctx.db
      .query("clanMembers")
      .withIndex("clanId", (q) => q.eq("clanId", res.clan._id))
      .collect();
    for (const m of members) {
      await ctx.db.patch(m.userId, {
        clanNameColor: color,
      });
    }
    await addXpInternal(ctx, userId, Math.floor(amount / 10), "donate");
    return { level, progress, levelCost: levelCost(level) };
  },
});

export const claimDaily = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const res = await myClan(ctx, userId);
    if (!res) throw new Error("Kamu belum join clan");
    const today = dayString();
    if (res.member.lastClaimDay === today)
      throw new Error("Sudah claim hari ini (reset 00:00)");
    const amount = claimAmountForLevel(res.clan.level ?? 1);
    const me = await ctx.db.get(userId);
    await ctx.db.patch(userId, { diamonds: (me?.diamonds ?? 0) + amount });
    await ctx.db.patch(res.member._id, { lastClaimDay: today });
    await ctx.db.patch(res.clan._id, {
      diamonds: Math.max(0, (res.clan.diamonds ?? 0) - amount),
    });
    return { amount };
  },
});

// ------------------------------------------------------ leader panel ----

async function leaderGuard(ctx: any, userId: string, roles: string[]) {
  const res = await myClan(ctx, userId);
  if (!res) throw new Error("Bukan member clan");
  if (!roles.includes(res.member.role)) throw new Error("Tidak punya akses");
  return res;
}

export const setRole = mutation({
  args: {
    targetId: v.id("users"),
    role: v.union(
      v.literal("officer"),
      v.literal("victro"),
      v.literal("hydler"),
      v.literal("member"),
    ),
  },
  handler: async (ctx, { targetId, role }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const res = await leaderGuard(ctx, userId, ["leader", "officer"]);
    const target = await ctx.db
      .query("clanMembers")
      .withIndex("userId", (q) => q.eq("userId", targetId))
      .first();
    if (!target || target.clanId !== res.clan._id)
      throw new Error("Bukan member clan ini");
    await ctx.db.patch(target._id, { role });
    await ctx.db.insert("notifications", {
      userId: targetId,
      type: "clan",
      title: `Role clan kamu jadi ${role}`,
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

export const kickMember = mutation({
  args: { targetId: v.id("users") },
  handler: async (ctx, { targetId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const res = await leaderGuard(ctx, userId, ["leader", "officer"]);
    if (targetId === res.clan.leaderId) throw new Error("Tidak bisa kick leader");
    const target = await ctx.db
      .query("clanMembers")
      .withIndex("userId", (q) => q.eq("userId", targetId))
      .first();
    if (!target || target.clanId !== res.clan._id)
      throw new Error("Bukan member clan ini");
    await ctx.db.delete(target._id);
    await ctx.db.patch(targetId, {
      clanTag: undefined,
      clanTagIcon: undefined,
      clanNameColor: undefined,
    });
    return { ok: true };
  },
});

export const transferLeader = mutation({
  args: { targetId: v.id("users") },
  handler: async (ctx, { targetId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const res = await leaderGuard(ctx, userId, ["leader"]);
    if (targetId === userId) throw new Error("Pilih member lain");
    const target = await ctx.db
      .query("clanMembers")
      .withIndex("userId", (q) => q.eq("userId", targetId))
      .first();
    if (!target || target.clanId !== res.clan._id)
      throw new Error("Bukan member clan ini");
    await ctx.db.patch(res.member._id, { role: "officer" });
    await ctx.db.patch(target._id, { role: "leader" });
    await ctx.db.patch(res.clan._id, { leaderId: targetId });
    await ctx.db.insert("notifications", {
      userId: targetId,
      type: "clan",
      title: "Kamu sekarang Leader clan",
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

export const leaveClan = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const res = await myClan(ctx, userId);
    if (!res) throw new Error("Kamu belum join clan");
    if (res.clan.leaderId === userId)
      throw new Error("Transfer leader dulu sebelum keluar");
    await ctx.db.delete(res.member._id);
    await ctx.db.patch(userId, {
      clanTag: undefined,
      clanTagIcon: undefined,
      clanNameColor: undefined,
    });
    return { ok: true };
  },
});

export const setBackground = mutation({
  args: { url: v.string() },
  handler: async (ctx, { url }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const res = await leaderGuard(ctx, userId, ["leader", "officer"]);
    await ctx.db.patch(res.clan._id, { backgroundUrl: url.trim() || undefined });
    return { ok: true };
  },
});
