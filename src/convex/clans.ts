// YoruNime — clan: buat/join/roles/donate/level/claim/panel.
import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { addXpInternal } from "./xp";

export const CLAN_LEVELS_MAX = 200;
const BASE_LEVEL_COST = 700;
const COST_STEP = 10;
const BASE_CLAIM = 100;
const CLAIM_PER_LEVEL = 2;
const CREATE_COST = 1000;

/* ------------------------------------------------------------------ */
/*  GRADE MEMBER (1-6, romawi di UI)                                   */
/*  Naik grade berdasarkan TOTAL donasi member ke clan-nya:            */
/*    grade 2 = 2.300, lalu tiap grade naik butuh +1.200 lagi           */
/*    (3.500 / 4.700 / 5.900 / 7.100 untuk grade 3-6).                 */
/*  Tiap grade di atas 1 memberi bonus +50 berlian saat claim harian.  */
/* ------------------------------------------------------------------ */
export const GRADES_MAX = 6;
const GRADE_BASE = 2300;
const GRADE_STEP = 1200;
const CLAIM_PER_GRADE = 50;

/** Total donasi minimal untuk mencapai grade tertentu. */
export function gradeThreshold(grade: number) {
  return GRADE_BASE + (grade - 2) * GRADE_STEP;
}

/** Grade (1-6) dari total donasi seorang member. */
export function gradeForDonated(total: number) {
  let grade = 1;
  for (let g = 2; g <= GRADES_MAX; g++) {
    if (total >= gradeThreshold(g)) grade = g;
    else break;
  }
  return grade;
}

export function levelCost(level: number) {
  return BASE_LEVEL_COST + (level - 1) * COST_STEP;
}

/** Tag clan: huruf besar A-Z dan angka saja, panjangnya 3-4 karakter. */
export function cleanClanTag(tag: string) {
  return tag.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function claimAmountForLevel(level: number) {
  return BASE_CLAIM + Math.max(0, level - 1) * CLAIM_PER_LEVEL;
}

/** Jumlah claim harian = dasar level + bonus +50 per grade di atas 1. */
export function claimAmountFor(level: number, grade: number) {
  return claimAmountForLevel(level) + Math.max(0, grade - 1) * CLAIM_PER_GRADE;
}

/** Warna clan berdasarkan level:
 *   1-49    coklat (brown)
 *   50-99   emas (gold)
 *   100-149 merah (red)
 *   150-200 rainbow
 *
 * `cls` ini dipakai di komponen Clan (daftar, detail, members) untuk warna
 * nama clan, bukan tag. Warna nama mengikuti level clan seperti yang
 * diminta.
 */
export const CLAN_COLORS: Record<number, { name: string; cls: string; tier: string }> = {
  49: { name: "Brown", cls: "#8B4513", tier: "clan-tier-brown" },
  99: { name: "Gold", cls: "#D4AF37", tier: "clan-tier-gold" },
  149: { name: "Red", cls: "#DC143C", tier: "clan-tier-red" },
  200: { name: "Rainbow", cls: "#ff69b4", tier: "clan-tier-rainbow" },
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
  // Ambang warna ini harus sama dengan clanTextClass() di lstream-ui.tsx:
  // 1-49 biru, 50-99 hijau, 100-149 ungu, 150+ emas. Kalau beda, nama clan
  // tampil beda warna antara halaman Clan dan panel akun/chat.
  if (level >= 200) color = "golden";
  else if (level >= 150) color = "oren";
  else if (level >= 100) color = "galaxy";
  else if (level >= 50) color = "merah";
  const ageDays = Math.max(
    0,
    Math.floor((Date.now() - (clan.createdAt ?? Date.now())) / 86400000),
  );
  return {
    _id: clan._id,
    name: clan.name,
    tag: clan.tag,
    tagIcon: clan.tagIcon,
    tagBg: clan.tagBg,
    avatarUrl: clan.avatarUrl,
    backgroundUrl: clan.backgroundUrl,
    description: clan.description,
    announcement: clan.announcement,
    announcementBy: clan.announcementBy,
    announcementRole: clan.announcementRole,
    announcementAt: clan.announcementAt,
    diamonds: clan.diamonds,
    level,
    levelProgress: clan.levelProgress,
    levelCost: levelCost(level),
    claimAmount: claimAmountForLevel(level),
    color,
    ageDays,
    memberCount,
    verified: !!clan.verified,
    memberCap: clan.memberCap ?? 20,
    tagTier: clan.tagTier ?? 0,
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
        seqId: u?.seqId,
        username: u?.username ?? "user",
        image: u?.image,
        bannerUrl: u?.bannerUrl,
        level: u?.level,
        premium: (u?.premiumUntil ?? 0) > Date.now(),
        staffRole: u?.staffRole,
        role: m.role,
        grade: gradeForDonated(m.donatedTotal),
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
      topDonateAll: [...memberViews]
        .filter((m) => m.donatedTotal > 0)
        .sort((a, b) => b.donatedTotal - a.donatedTotal)
        .slice(0, 50),
      myRole: me?.role,
      myDonatedTotal: me?.donatedTotal,
      myGrade: gradeForDonated(me?.donatedTotal ?? 0),
      myClaimedToday:
        me?.lastClaimDay === dayString(),
      myLastClaimDay: me?.lastClaimDay,
      myRequestClanId: myRequest?.clanId,
      myRequestId: myRequest?._id,
      requests: requestViews,
    };
  },
});

// Daftar clan 100% real: hanya clan yang benar-benar dibuat member.
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
    /** Warna latar tag (hex) — opsional, pilihan "Default" tidak mengisi. */
    tagBg: v.optional(v.string()),
    avatarUrl: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, { name, tag, tagIcon, tagBg, avatarUrl, description }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new ConvexError("Not signed in");
    const me = await ctx.db.get(userId);
    if (!me) throw new ConvexError("User not found");
    if (!me.unlimitedSacret && (me.diamonds ?? 0) < CREATE_COST)
      throw new ConvexError(
        `Sacret kamu cuma ${(me.diamonds ?? 0).toLocaleString("id-ID")} — butuh ${CREATE_COST} buat bikin clan (donasi ke clan lain / beli premium untuk nambah)`,
      );
    const cleanTag = cleanClanTag(tag);
    if (cleanTag.length < 3 || cleanTag.length > 4)
      throw new ConvexError("Tag clan 3-4 huruf");
    if (name.trim().length < 3) throw new ConvexError("Nama clan minimal 3 karakter");
    const dup = await ctx.db
      .query("clans")
      .withIndex("tag", (q) => q.eq("tag", cleanTag))
      .first()
      .catch(() => null);
    if (dup) throw new ConvexError("Tag clan sudah dipakai");
    const existing = await ctx.db
      .query("clanMembers")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .first();
    if (existing) throw new ConvexError("Kamu sudah punya clan");
    await ctx.db.patch(userId, {
      diamonds: me.unlimitedSacret
        ? (me.diamonds ?? 0)
        : (me.diamonds ?? 0) - CREATE_COST,
    });
    const clanId = await ctx.db.insert("clans", {
      name: name.trim(),
      tag: cleanTag,
      tagIcon,
      // Validasi ringan: hanya hex 3/6 digit yang boleh tersimpan —
      // argumen datang dari client, jangan biarkan string apa pun jadi CSS.
      tagBg:
        tagBg && /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(tagBg)
          ? tagBg
          : undefined,
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
    await ctx.db.patch(userId, {
      clanTag: cleanTag,
      clanTagIcon: tagIcon,
      clanNameColor: "",
      clanLevel: 1,
    });
    return { clanId };
  },
});

/** ID clan yang sedang kita-request (belum diterima) — buat tombol centang. */
export const myPendingClanId = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const pending = await ctx.db
      .query("clanRequests")
      .withIndex("userId_status", (q) =>
        q.eq("userId", userId).eq("status", "pending"),
      )
      .first();
    return pending?.clanId ?? null;
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
            // Disalin ke user supaya warna nama clan di chat/komentar bisa
            // ditentukan tanpa query tabel clans tiap pesan.
            clanLevel: clan.level ?? 1,
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
    if (amount < 50) throw new Error("Minimal 50 Sacret");
    if (!me.unlimitedSacret && (me.diamonds ?? 0) < amount)
      throw new Error("Sacret tidak cukup");
    const today = dayString();
    const member = res.member;
    const donatedToday = member.lastDonateDay === today ? member.donatedToday : 0;
    await ctx.db.patch(userId, {
      diamonds: me.unlimitedSacret
        ? (me.diamonds ?? 0)
        : (me.diamonds ?? 0) - amount,
    });
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
    const amount = claimAmountFor(
      res.clan.level ?? 1,
      gradeForDonated(res.member.donatedTotal),
    );
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

/**
 * Lepas satu role tertentu (un-officer / un-victro / un-hydler).
 *
 * Bedanya dengan `setRole(... "member")`: aksi ini hanya berhasil kalau
 * member yang dipilih memang sedang memegang role itu, jadi leader tidak
 * bisa mencabut role yang memang tidak ada dan tidak diam-diam menimpa
 * role lain. Member yang hasilnya `member` biasa, bukan dihapus dari clan.
 */
export const removeRole = mutation({
  args: {
    targetId: v.id("users"),
    role: v.union(
      v.literal("officer"),
      v.literal("victro"),
      v.literal("hydler"),
    ),
  },
  handler: async (ctx, { targetId, role }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const res = await leaderGuard(ctx, userId, ["leader"]);
    if (targetId === res.clan.leaderId)
      throw new Error("Tidak bisa lepas role leader");
    const target = await ctx.db
      .query("clanMembers")
      .withIndex("userId", (q) => q.eq("userId", targetId))
      .first();
    if (!target || target.clanId !== res.clan._id)
      throw new Error("Bukan member clan ini");
    if (target.role !== role)
      throw new Error(`Member ini bukan ${role}`);
    await ctx.db.patch(target._id, { role: "member" });
    await ctx.db.insert("notifications", {
      userId: targetId,
      type: "clan",
      title: `Role ${role} clan kamu dicabut`,
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
      clanLevel: undefined,
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
      clanLevel: undefined,
    });
    return { ok: true };
  },
});

/**
 * Simpan deskripsi clan. Hanya leader (atau officer) yang boleh mengubah.
 * Teks dibersihkan dari spasi berlebih dan dipotong 300 karakter supaya
 * kartu clan di daftar tidak memanjang berlebihan.
 */
export const setDescription = mutation({
  args: { text: v.string() },
  handler: async (ctx, { text }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const res = await leaderGuard(ctx, userId, ["leader"]);
    const clean = text.replace(/\s+/g, " ").trim().slice(0, 300);
    await ctx.db.patch(res.clan._id, { description: clean || undefined });
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

/**
 * Atur PENGUMUMAN clan (leader/officer). Kosongkan untuk menghapus —
 * lalu tampil "Tidak ada announcement dari leader ataupun officer".
 */
export const setAnnouncement = mutation({
  args: { text: v.string() },
  handler: async (ctx, { text }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const res = await leaderGuard(ctx, userId, ["leader", "officer"]);
    const clean = text.replace(/\s+/g, " ").trim().slice(0, 400);
    await ctx.db.patch(res.clan._id, {
      announcement: clean || undefined,
      announcementBy: clean ? userId : undefined,
      announcementRole: clean ? res.member.role : undefined,
      announcementAt: clean ? Date.now() : undefined,
    });
    return { ok: true, announcement: clean || null };
  },
});

// =================== SHOP CLAN (leader/officer) ===================

/** Biaya centang biru clan — sekali beli, tampil di semua member. */
export const BLUE_CHECK_COST = 5000;
/** Harga upgrade slot member: 200 Sacret per +2 slot (maks 100). */
export const SLOT_COST = 200;
export const SLOT_STEP = 2;
export const SLOT_MAX = 100;
export const SLOT_START = 20;
/** Harga beli tier tag clan (1..6) — tag makin tinggi makin bagus. */
export const TAG_TIER_COST: Record<number, number> = {
  1: 3000,
  2: 6000,
  3: 9000,
  4: 12000,
  5: 16000,
  6: 19500,
};

/** Beli CENTANG BIRU clan (leader & officer) — tampil di profil member. */
export const buyVerified = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const res = await leaderGuard(ctx, userId, ["leader", "officer"]);
    const clan = res.clan;
    if (clan.verified) return { ok: true, already: true };
    // BELI PAKAI SACRET CLAN (bukan saldo pribadi) — sesuai permintaan.
    const bal = clan.diamonds ?? 0;
    if (bal < BLUE_CHECK_COST)
      throw new Error(`Sacret clan tidak cukup (butuh ${BLUE_CHECK_COST})`);
    await ctx.db.patch(clan._id, {
      diamonds: bal - BLUE_CHECK_COST,
      verified: true,
    });
    return { ok: true };
  },
});

/** Upgrade slot member +2 (200 Sacret), maksimal 100. */
export const upgradeSlots = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const res = await leaderGuard(ctx, userId, ["leader"]);
    const clan = res.clan;
    const cap = clan.memberCap ?? SLOT_START;
    if (cap >= SLOT_MAX) throw new Error("Slot member sudah maksimal (100)");
    const bal = clan.diamonds ?? 0;
    if (bal < SLOT_COST)
      throw new Error(`Sacret clan tidak cukup (butuh ${SLOT_COST})`);
    await ctx.db.patch(clan._id, {
      diamonds: bal - SLOT_COST,
      memberCap: Math.min(SLOT_MAX, cap + SLOT_STEP),
    });
    return { ok: true, memberCap: Math.min(SLOT_MAX, cap + SLOT_STEP) };
  },
});

/**
 * Beli TIER tag clan (1..6): tag lvl 50/100/150/200/250/300.
 * Tier dibeli — bukan otomatis ikut level clan.
 */
export const buyTagTier = mutation({
  args: { tier: v.number() },
  handler: async (ctx, { tier }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    if (!(tier >= 1 && tier <= 6)) throw new Error("Tier tidak valid");
    const res = await leaderGuard(ctx, userId, ["leader"]);
    const clan = res.clan;
    const owned = clan.tagTier ?? 0;
    // Tier harus dibeli berurutan (wajib punya tier sebelumnya).
    if (tier > owned + 1)
      throw new Error(`Beli tag tier ${owned + 1} dulu sebelum tier ${tier}`);
    if (tier <= owned) return { ok: true, already: true };
    const cost = TAG_TIER_COST[tier];
    const bal = clan.diamonds ?? 0;
    if (bal < cost)
      throw new Error(`Sacret clan tidak cukup (butuh ${cost})`);
    await ctx.db.patch(clan._id, { diamonds: bal - cost, tagTier: tier });
    return { ok: true, tagTier: tier };
  },
});

/**
 * Isi clan contoh (dummy) supaya daftar clan tidak kosong saat dipakai
 * mencoba tampilan: podium top 1-3, daftar peringkat, dan deskripsi clan.
 *
 * Hanya untuk developer/moderator (dijaga di bawah) supaya tidak bisa
 * dipakai user biasa. Aman dipanggil berulang: nama clan contoh yang sudah
 * ada dilewati, bukan dibuat dobel.
 */
const DUMMY_CLANS = [
  { name: "YoruNime", tag: "YRNM", icon: "⚡", level: 200, diamonds: 490502, desc: "Clan pencinta anime nocturnal. Aktif tiap malam, rank naik tiap donate." },
  { name: "Kagayaki Order", tag: "KAGY", icon: "🌙", level: 163, diamonds: 328400, desc: "Kebanggaran fans shounen isekai. Saling bagi source episode." },
  { name: "Strawberry Panic", tag: "STRA", icon: "🍓", level: 121, diamonds: 187250, desc: "Clan yang suka slice of life dan musik pop. Ramai di sore hari." },
  { name: "Blade Legion", tag: "BLDE", icon: "🗡️", level: 96, diamonds: 142900, desc: "Pencinta action & isekai combat. Latihan daily bareng." },
  { name: "Moonlit Archive", tag: "MOON", icon: "📚", level: 74, diamonds: 98400, desc: "Simpanan info anime, OST, dan meme lama di sini." },
  { name: "Crimson Fang", tag: "CRIM", icon: "🔥", level: 58, diamonds: 76100, desc: "Weekly raid bareng, join kapan aja." },
  { name: "Silent Echo", tag: "SILO", icon: "🫧", level: 41, diamonds: 52900, desc: "Tempat santai buat spoiler episode yang baru tayang." },
  { name: "Neon Sakura", tag: "NEON", icon: "🌸", level: 33, diamonds: 41800, desc: "Anime slice of life & studio Ghibli." },
  { name: "Zero Void", tag: "ZERO", icon: "🕳️", level: 27, diamonds: 33600, desc: "Experimental watch bareng, spoiler on." },
  { name: "Paper Crane", tag: "CRNE", icon: "🕊️", level: 19, diamonds: 26400, desc: "Baru naik level, mohon bantu vote." },
  { name: "Amber Fox", tag: "AMBR", icon: "🦊", level: 12, diamonds: 18900, desc: "KoleksiOST Lawas dan Opening pendek." },
  { name: "Drift Wave", tag: "DRFT", icon: "🌊", level: 8, diamonds: 12300, desc: "Baru dibuat, mohon dibimbing senior." },
];

export const seedDummyClans = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new ConvexError("Belum masuk");
    const me = await ctx.db.get(userId);
    if (!me) throw new ConvexError("User tidak ada");
    const isDev =
      me.role === "admin" ||
      me.staffRole === "dev" ||
      me.staffRole === "creator" ||
      me.staffRole === "mod";
    if (!isDev) throw new ConvexError("Hanya developer");

    const existing = await ctx.db.query("clans").collect();
    const haveTag = new Set(existing.map((c) => c.tag));
    let made = 0;
    for (const d of DUMMY_CLANS) {
      if (haveTag.has(d.tag)) continue;
      const clanId = await ctx.db.insert("clans", {
        name: d.name,
        tag: d.tag,
        tagIcon: d.icon,
        avatarUrl: "",
        description: d.desc,
        leaderId: userId,
        diamonds: d.diamonds,
        level: d.level,
        levelProgress: 0,
        createdAt: Date.now() - Math.floor(Math.random() * 120) * 86400000,
      });
      await ctx.db.insert("clanMembers", {
        clanId,
        userId,
        role: "leader",
        donatedTotal: 0,
        donatedToday: 0,
        lastDonateDay: "",
        joinedAt: Date.now(),
      });
      made += 1;
    }
    return { made };
  },
});
