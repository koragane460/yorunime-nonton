// YoruNime — PRESENCE ringan.
//
// Client menandai dirinya tiap 30 detik selama aplikasi terbuka; jumlah yang
// "online" dihitung dari record yang masih segar (< 70 detik), jadi angkanya
// benar-benar mencerminkan user yang sedang membuka aplikasi.
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";

const FRESH_MS = 70_000;

export const heartbeat = mutation({
  args: {},
  handler: async (ctx) => {
    let userId;
    try {
      userId = await getAuthUserId(ctx);
    } catch {
      return;
    }
    if (userId === null) return;
    const now = Date.now();
    const existing = await ctx.db
      .query("presences")
      .withIndex("at", (q) => q.gt("at", now - 24 * 3_600_000))
      .collect();
    const mine = existing.find((p) => p.userId === userId);
    if (mine) {
      if (now - mine.at > 15_000) await ctx.db.patch(mine._id, { at: now });
    } else {
      await ctx.db.insert("presences", { userId, at: now });
    }
    // Buang record basi supaya tabel tidak menumpuk.
    for (const p of existing) {
      if (now - p.at > 24 * 3_600_000) await ctx.db.delete(p._id);
    }
  },
});

export const onlineCount = query({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - FRESH_MS;
    const rows = await ctx.db
      .query("presences")
      .withIndex("at", (q) => q.gt("at", cutoff))
      .collect();
    return new Set(rows.map((r) => String(r.userId))).size;
  },
});
