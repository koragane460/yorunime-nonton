// YoruNime — CLAN ROOM: jadwal & undangan nobar per clan.
// Leader/officer membuat jadwal, semua member bisa menekan "Ikut" (RSVP).
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/** Batas jadwal aktif per clan (yang belum lewat 12 jam). */
export const MAX_UPCOMING = 12;

/** Keanggotaan user di sebuah clan (null kalau bukan member). */
async function memberOf(ctx: any, userId: any, clanId: any) {
  const rows = await ctx.db
    .query("clanMembers")
    .withIndex("userId", (q: any) => q.eq("userId", userId))
    .collect();
  return rows.find((r: any) => r.clanId === clanId) ?? null;
}

/** Daftar jadwal nobar sebuah clan, urut dari yang paling dekat. */
export const listByClan = query({
  args: { clanId: v.id("clans") },
  handler: async (ctx, { clanId }) => {
    const rows = await ctx.db
      .query("clanNobar")
      .withIndex("by_clan", (q) => q.eq("clanId", clanId))
      .collect();
    // Jadwal yang sudah lewat lebih dari 6 jam tidak perlu ditampilkan lagi.
    const cutoff = Date.now() - 6 * 3600_000;
    return rows
      .filter((r) => r.startsAt >= cutoff)
      .sort((a, b) => a.startsAt - b.startsAt);
  },
});

export const create = mutation({
  args: {
    clanId: v.id("clans"),
    title: v.string(),
    startsAt: v.number(),
    kind: v.optional(v.string()),
    animeId: v.optional(v.string()),
    image: v.optional(v.string()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const me = await memberOf(ctx, userId, args.clanId);
    if (!me) throw new Error("Bukan member clan");
    if (!["leader", "officer"].includes(me.role))
      throw new Error("Hanya leader/officer yang bisa membuat jadwal");

    const title = args.title.replace(/\s+/g, " ").trim().slice(0, 80);
    if (title.length < 3) throw new Error("Judul minimal 3 karakter");
    if (!Number.isFinite(args.startsAt)) throw new Error("Jadwal tidak valid");
    if (args.startsAt < Date.now() - 3600_000)
      throw new Error("Jadwal sudah lewat");

    const existing = await ctx.db
      .query("clanNobar")
      .withIndex("by_clan", (q) => q.eq("clanId", args.clanId))
      .collect();
    const upcoming = existing.filter((r) => r.startsAt >= Date.now() - 6 * 3600_000);
    if (upcoming.length >= MAX_UPCOMING)
      throw new Error(`Maksimal ${MAX_UPCOMING} jadwal aktif`);

    const id = await ctx.db.insert("clanNobar", {
      clanId: args.clanId,
      title,
      startsAt: args.startsAt,
      kind: args.kind?.trim() || "anime",
      animeId: args.animeId?.trim() || undefined,
      image: args.image?.trim() || undefined,
      note: args.note?.replace(/\s+/g, " ").trim().slice(0, 200) || undefined,
      createdBy: userId,
      attendees: [userId],
      createdAt: Date.now(),
    });
    return await ctx.db.get(id);
  },
});

/** Ikut / batal ikut. Hanya member clan yang bisa RSVP. */
export const toggleAttend = mutation({
  args: { id: v.id("clanNobar") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const row = await ctx.db.get(id);
    if (!row) throw new Error("Jadwal tidak ditemukan");
    const me = await memberOf(ctx, userId, row.clanId);
    if (!me) throw new Error("Bukan member clan");
    const joined = row.attendees.includes(userId);
    await ctx.db.patch(id, {
      attendees: joined
        ? row.attendees.filter((u) => u !== userId)
        : [...row.attendees, userId],
    });
    return { joined: !joined, count: joined ? row.attendees.length - 1 : row.attendees.length + 1 };
  },
});

/** Hapus jadwal — pembuatnya atau leader/officer clan. */
export const remove = mutation({
  args: { id: v.id("clanNobar") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const row = await ctx.db.get(id);
    if (!row) throw new Error("Jadwal tidak ditemukan");
    const me = await memberOf(ctx, userId, row.clanId);
    if (!me) throw new Error("Bukan member clan");
    const allowed =
      row.createdBy === userId || ["leader", "officer"].includes(me.role);
    if (!allowed) throw new Error("Tidak punya akses");
    await ctx.db.delete(id);
    return { ok: true };
  },
});
