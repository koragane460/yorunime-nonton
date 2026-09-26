// LStream — moderation helpers + dev/mod panel backend.
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";

/** Dipakai mutasi lain untuk menolak user yang dimute/banned. */
export async function requireActive(me: {
  bannedUntil?: number;
  mutedUntil?: number;
}) {
  const now = Date.now();
  if ((me.bannedUntil ?? 0) > now)
    throw new Error("Akun kamu sedang dibanned");
  if ((me.mutedUntil ?? 0) > now)
    throw new Error("Kamu sedang dimute");
}

export const isBlockedInternal = internalMutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return false;
    const me = await ctx.db.get(userId);
    if (!me) return false;
    return (
      (me.bannedUntil ?? 0) > Date.now() || (me.mutedUntil ?? 0) > Date.now()
    );
  },
});

export const blockStatus = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const me = await ctx.db.get(userId);
    if (!me) return null;
    const now = Date.now();
    if ((me.bannedUntil ?? 0) > now)
      return {
        type: "banned" as const,
        permanent: me.bannedUntil === Number.MAX_SAFE_INTEGER,
        until: me.bannedUntil,
        reason: me.bannedReason ?? "",
      };
    if ((me.mutedUntil ?? 0) > now)
      return {
        type: "muted" as const,
        permanent: me.mutedUntil === Number.MAX_SAFE_INTEGER,
        until: me.mutedUntil,
        reason: me.mutedReason ?? "",
      };
    return null;
  },
});

function parseDuration(text: string): number | null {
  const m = text.trim().match(/^(\d+)\s*(menit|jam|hari)?$/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  if (Number.isNaN(n)) return null;
  const unit = (m[2] ?? "hari").toLowerCase();
  if (unit === "menit") return n * 60 * 1000;
  if (unit === "jam") return n * 3600 * 1000;
  return n * 24 * 3600 * 1000;
}

async function staffGuard(ctx: any, need: "dev" | "mod") {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error("Not signed in");
  const me = await ctx.db.get(userId);
  if (!me) throw new Error("Not signed in");
  const isDev =
    me.role === "admin" || me.staffRole === "dev" || me.staffRole === "creator";
  const isMod = isDev || me.staffRole === "mod";
  if (need === "dev" && !isDev) throw new Error("Hanya dev");
  if (need === "mod" && !isMod) throw new Error("Hanya moderator/dev");
  return { userId, me };
}

export const moderate = mutation({
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
    await staffGuard(ctx, "mod");
    if (reason.trim().length === 0) throw new Error("Alasan wajib diisi");
    const now = Date.now();
    if (action === "mute") {
      const until = permanent
        ? Number.MAX_SAFE_INTEGER
        : now + (parseDuration(durationText ?? "") ?? 24 * 3600 * 1000);
      await ctx.db.patch(targetId, { mutedUntil: until, mutedReason: reason });
    } else if (action === "unmute") {
      await ctx.db.patch(targetId, { mutedUntil: 0, mutedReason: undefined });
    } else if (action === "ban") {
      const until = permanent
        ? Number.MAX_SAFE_INTEGER
        : now + (parseDuration(durationText ?? "") ?? 24 * 3600 * 1000);
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
              ? "Mute dicabut"
              : "Ban dicabut",
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
    await staffGuard(ctx, "dev");
    await ctx.db.patch(targetId, {
      staffRole: staffRole === "none" ? undefined : staffRole,
    });
    return { ok: true };
  },
});

/** Dev-only: beri premium ke semua member clan. */
export const devGiveClanPremium = mutation({
  args: { clanId: v.id("clans"), days: v.number() },
  handler: async (ctx, { clanId, days }) => {
    await staffGuard(ctx, "dev");
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
        premiumUntil: current + days * 86400000,
      });
    }
    return { count: members.length };
  },
});

/** Mod/dev: cari user untuk panel. */
export const searchUsersPanel = query({
  args: { q: v.string() },
  handler: async (ctx, { q }) => {
    await staffGuard(ctx, "mod");
    const needle = q.trim().toLowerCase();
    if (needle.length === 0) return [];
    const all = await ctx.db.query("users").collect();
    return all
      .filter((u) => (u.username ?? "").toLowerCase().includes(needle))
      .slice(0, 10)
      .map((u) => ({
        _id: u._id,
        username: u.username,
        staffRole: u.staffRole,
        mutedUntil: u.mutedUntil,
        bannedUntil: u.bannedUntil,
      }));
  },
});
