import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";

// ---- Level & badge math (per spec) ----
// 1-49: bronze(12k/lvl) 50-99: silver(27k) 100-499: diamond(45k)
// 500-1000: emerald(70k) 1001-4999: master(120k) 5000-10000: grandmaster(165k)
// 500-1000: emerald(70k) 1001-4999: master(120k) 5000-12999: grandmaster(165k)
// 13000+: central(220k) — tier baru di atas Grandmaster.
const TIERS = [
  { min: 1, max: 49, per: 12000, badge: "Bronze" },
  { min: 50, max: 99, per: 27000, badge: "Silver" },
  { min: 100, max: 499, per: 45000, badge: "Diamond" },
  { min: 500, max: 1000, per: 70000, badge: "Emerald" },
  { min: 1001, max: 4999, per: 120000, badge: "Master" },
  { min: 5000, max: 12999, per: 165000, badge: "Grandmaster" },
  { min: 13000, max: 999999999, per: 220000, badge: "Central" },
];

export function tierForLevel(level: number) {
  for (const t of TIERS) if (level >= t.min && level <= t.max) return t;
  return TIERS[TIERS.length - 1];
}

/** Xp needed to go from `level` to `level + 1` within the current tier band. */
export function xpForLevel(level: number) {
  return tierForLevel(level).per;
}

export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    // Token basi / header auth rusak bikin getAuthUserId melempar error dan
    // seluruh app error ("Server Error"). Anggap saja belum login.
    let userId;
    try {
      userId = await getAuthUserId(ctx);
    } catch {
      return null;
    }
    if (userId === null) return null;
    try {
      return await ctx.db.get(userId);
    } catch {
      // Dokumen user tidak ada / tidak valid terhadap schema.
      return null;
    }
  },
});

export const getUserByUsername = query({
  args: { username: v.string() },
  handler: async (ctx, { username }) => {
    return await ctx.db
      .query("users")
      .withIndex("username", (q) => q.eq("username", username))
      .first();
  },
});

/** Cari user by nomor urut (mis. "1" → user #1) untuk halaman detail akun. */
export const getUserBySeq = query({
  args: { seqId: v.number() },
  handler: async (ctx, { seqId }) => {
    const rows = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("seqId"), seqId))
      .take(2);
    return rows[0] ?? null;
  },
});

export const getUserPublic = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const u = await ctx.db.get(userId);
    if (!u) return null;
    return {
      _id: u._id,
      username: u.username,
      image: u.image,
      xp: u.xp,
      level: u.level,
      staffRole: u.staffRole,
      premiumUntil: u.premiumUntil,
      hideOnline: u.hideOnline,
      bannerUrl: u.bannerUrl,
    };
  },
});

export const searchUsers = query({
  args: { q: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { q, limit }) => {
    const needle = q.trim().toLowerCase();
    if (needle.length < 1) return [];
    const all = await ctx.db.query("users").collect();
    return all
      .filter(
        (u) =>
          u.username &&
          (u.username.toLowerCase().includes(needle) ||
            (u.name ?? "").toLowerCase().includes(needle)),
      )
      .slice(0, limit ?? 20)
      .map((u) => ({
        _id: u._id,
        username: u.username,
        image: u.image,
        level: u.level,
      }));
  },
});

/** Internal bootstrap: default profile for a fresh auth user. */
export const ensureUser = internalMutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const user = await ctx.db.get(userId);
    if (!user) return null;
    const patch: Record<string, unknown> = {};
    if (user.username === undefined) {
      const base =
        (user.name ?? user.email?.split("@")[0] ?? "user")
          .replace(/[^a-zA-Z0-9_]/g, "")
          .slice(0, 16) || "user";
      // ensure unique username
      let candidate = base;
      let n = 1;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const clash = await ctx.db
          .query("users")
          .withIndex("username", (q) => q.eq("username", candidate))
          .first();
        if (!clash || clash._id === userId) break;
        candidate = `${base}${n++}`;
      }
      patch.username = candidate;
    }
    if (user.xp === undefined) patch.xp = 0;
    if (user.level === undefined) patch.level = 1;
    if (user.diamonds === undefined) patch.diamonds = 200000;
    if (user.createdAt === undefined) patch.createdAt = Date.now();
    if (user.nsfwStrikes === undefined) patch.nsfwStrikes = 0;
    if (user.theme === undefined) patch.theme = "dark";
    if (Object.keys(patch).length > 0) await ctx.db.patch(userId, patch);
    return await ctx.db.get(userId);
  },
});

/** START SACRET — pastikan SEMUA user benar-benar punya 200.000 Sacret.
 *  Naikkan hanya yang di bawah 200.000 (tidak pernah mengurangi), jadi
 *  aman dijalankan berulang. */
export const grantAllStartSacret = mutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    let raised = 0;
    for (const u of users) {
      if ((u.diamonds ?? 0) < 200000) {
        await ctx.db.patch(u._id, { diamonds: 200000 });
        raised++;
      }
    }
    return { total: users.length, raised };
  },
});

const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));

function grantXp(user: { xp?: number; level?: number }, amount: number) {
  let xp = (user.xp ?? 0) + amount;
  let level = user.level ?? 1;
  while (level < 10000 && xp >= xpForLevel(level)) {
    xp -= xpForLevel(level);
    level += 1;
  }
  if (xp < 0) xp = 0;
  return { xp, level };
}

/** Add XP, recording an event for period leaderboards. */
export const addXp = mutation({
  args: {
    amount: v.number(),
    source: v.string(),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, { amount, source, userId }) => {
    let target = userId;
    if (!target) {
      const me = await getAuthUserId(ctx);
      if (me === null) throw new Error("Not signed in");
      target = me;
    }
    const user = await ctx.db.get(target);
    if (!user) return null;
    const next = grantXp(user, amount);
    await ctx.db.patch(target, { xp: next.xp, level: next.level });
    await ctx.db.insert("xpEvents", {
      userId: target,
      xp: amount,
      source,
      createdAt: Date.now(),
    });
    return next;
  },
});

export const updateProfile = mutation({
  args: {
    username: v.optional(v.string()),
    image: v.optional(v.string()),
    bannerUrl: v.optional(v.string()),
  },
  handler: async (ctx, { username, image, bannerUrl }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const patch: Record<string, unknown> = {};
    if (username !== undefined) {
      const clean = username.trim().replace(/[^a-zA-Z0-9_]/g, "");
      if (clean.length < 3) throw new Error("Username minimal 3 karakter");
      const clash = await ctx.db
        .query("users")
        .withIndex("username", (q) => q.eq("username", clean))
        .first();
      if (clash && clash._id !== userId)
        throw new Error("Username sudah dipakai");
      patch.username = clean;
    }
    if (image !== undefined) patch.image = image;
    if (bannerUrl !== undefined) patch.bannerUrl = bannerUrl;
    if (Object.keys(patch).length > 0) await ctx.db.patch(userId, patch);
    return await ctx.db.get(userId);
  },
});

export const updateSettings = mutation({
  args: {
    hideOnline: v.optional(v.boolean()),
    autoRejectFriend: v.optional(v.boolean()),
    autoRejectFriendAction: v.optional(v.string()),
    defaultQuality: v.optional(v.string()),
    defaultSpeed: v.optional(v.number()),
    theme: v.optional(v.string()),
    customColor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const patch: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(args)) {
      if (val !== undefined) patch[k] = val;
    }
    await ctx.db.patch(userId, patch);
    return await ctx.db.get(userId);
  },
});

// ---------- Moderation ----------
function parseDuration(text: string): number | null {
  const m = text.trim().match(/^(\d+)\s*(menit|jam|hari|hari$)?$/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  if (Number.isNaN(n)) return null;
  const unit = (m[2] ?? "hari").toLowerCase();
  if (unit.startsWith("menit")) return n * 60 * 1000;
  if (unit.startsWith("jam")) return n * 3600 * 1000;
  return n * 24 * 3600 * 1000;
}

async function staffGuard(ctx: any, allow: string[]) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error("Not signed in");
  const me = await ctx.db.get(userId);
  if (!me) throw new Error("Not signed in");
  const myRole = String(me.role ?? "user");
  const isDevPanel = myRole === "admin" || me.staffRole === "dev" || me.staffRole === "creator";
  if (allow.includes("dev") && !isDevPanel) throw new Error("Hanya dev");
  if (allow.includes("mod") && !(isDevPanel || myRole === "admin" || me.staffRole === "mod"))
    throw new Error("Hanya moderator");
  return { userId, me };
}

export const moderateUser = mutation({
  args: {
    targetId: v.id("users"),
    action: v.union(
      v.literal("mute"),
      v.literal("unmute"),
      v.literal("ban"),
      v.literal("unban"),
    ),
    permanent: v.boolean(),
    durationText: v.optional(v.string()),
    reason: v.string(),
  },
  handler: async (ctx, { targetId, action, permanent, durationText, reason }) => {
    await staffGuard(ctx, ["mod"]);
    if (reason.trim().length === 0)
      throw new Error("Alasan wajib diisi");
    const now = Date.now();
    if (action === "mute") {
      const until = permanent ? Number.MAX_SAFE_INTEGER : now + (parseDuration(durationText ?? "") ?? 24 * 3600 * 1000);
      await ctx.db.patch(targetId, { mutedUntil: until, mutedReason: reason });
    } else if (action === "unmute") {
      await ctx.db.patch(targetId, { mutedUntil: 0, mutedReason: undefined });
    } else if (action === "ban") {
      const until = permanent ? Number.MAX_SAFE_INTEGER : now + (parseDuration(durationText ?? "") ?? 24 * 3600 * 1000);
      await ctx.db.patch(targetId, { bannedUntil: until, bannedReason: reason });
    } else {
      await ctx.db.patch(targetId, { bannedUntil: 0, bannedReason: undefined });
    }
    await ctx.db.insert("notifications", {
      userId: targetId,
      type: "moderation",
      title:
        action === "mute"
          ? `Kamu dimute${permanent ? " selamanya" : ""}`
          : action === "ban"
            ? `Kamu dibanned${permanent ? " selamanya" : ""}`
            : action === "unmute"
              ? "Mute kamu dicabut"
              : "Ban kamu dicabut",
      body: reason,
      createdAt: now,
    });
    return { ok: true };
  },
});

export const setStaffRole = mutation({
  args: {
    targetId: v.id("users"),
    staffRole: v.union(
      v.literal("dev"),
      v.literal("mod"),
      v.literal("tester"),
      v.literal("sepuh"),
      v.literal("creator"),
      v.literal("none"),
    ),
  },
  handler: async (ctx, { targetId, staffRole }) => {
    await staffGuard(ctx, ["dev"]);
    await ctx.db.patch(targetId, {
      staffRole: staffRole === "none" ? undefined : staffRole,
    });
    return { ok: true };
  },
});

/** Dev-only: grant premium days to every member of a clan. */
export const devGiveClanPremium = mutation({
  args: { clanId: v.id("clans"), days: v.number() },
  handler: async (ctx, { clanId, days }) => {
    await staffGuard(ctx, ["dev"]);
    if (days <= 0 || days > 3650) throw new Error("Jumlah hari tidak valid");
    const members = await ctx.db
      .query("clanMembers")
      .withIndex("clanId", (q) => q.eq("clanId", clanId))
      .collect();
    const now = Date.now();
    for (const m of members) {
      const u = await ctx.db.get(m.userId);
      const current = Math.max(now, u?.premiumUntil ?? 0);
      await ctx.db.patch(m.userId, {
        premiumUntil: current + days * 24 * 3600 * 1000,
      });
    }
    return { count: members.length };
  },
});

/** Alfabet UID: tanpa huruf/angka yang mudah tertukar (O/0, I/1, S/5). */
const UID_ALPHABET = "ABCDEFGHJKLMNPQRTUVWXYZ2346789";

function randomUid(len = 7): string {
  let out = "";
  for (let i = 0; i < len; i++) {
    out += UID_ALPHABET[Math.floor(Math.random() * UID_ALPHABET.length)];
  }
  return out;
}

/** Pastikan akun punya UID 7 karakter (dipanggil sekali saat akun dibuka). */
export const ensureUid = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");
    if (user.uidCode) return { uidCode: user.uidCode };
    for (let i = 0; i < 6; i++) {
      const code = randomUid();
      const clash = await ctx.db
        .query("users")
        .withIndex("uidCode", (q) => q.eq("uidCode", code))
        .first();
      if (!clash) {
        await ctx.db.patch(userId, { uidCode: code });
        return { uidCode: code };
      }
    }
    throw new Error("Gagal membuat UID, coba lagi");
  },
});

/** Cari akun berdasarkan UID (dipakai form verifikasi pembelian). */
export const findByUid = query({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const clean = code.trim().toUpperCase();
    if (!/^[A-Z0-9]{7}$/.test(clean)) return null;
    const user = await ctx.db
      .query("users")
      .withIndex("uidCode", (q) => q.eq("uidCode", clean))
      .first();
    if (!user) return null;
    return {
      uidCode: clean,
      username: user.username ?? "user",
      premium: (user.premiumUntil ?? 0) > Date.now(),
    };
  },
});

export const internalEnsureUser = internalMutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const user = await ctx.db.get(userId);
    if (!user) return null;
    const patch: Record<string, unknown> = {};
    if (user.username === undefined) patch.username = `user${userId.slice(0, 6)}`;
    if (user.xp === undefined) patch.xp = 0;
    if (user.level === undefined) patch.level = 1;
    if (user.diamonds === undefined) patch.diamonds = 200000;
    if (user.createdAt === undefined) patch.createdAt = Date.now();
    if (user.nsfwStrikes === undefined) patch.nsfwStrikes = 0;
    if (user.uidCode === undefined) patch.uidCode = randomUid();
    if (Object.keys(patch).length > 0) await ctx.db.patch(userId, patch);
    return await ctx.db.get(userId);
  },
});
