// YoruNime — PRESENCE ringan.
//
// Client menandai dirinya tiap 30 detik selama aplikasi terbuka; jumlah yang
// "online" dihitung dari record yang masih segar (< 70 detik), jadi angkanya
// benar-benar mencerminkan user yang sedang membuka aplikasi.
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";

const FRESH_MS = 70_000;
/** Tiga server chat; tiap server menampung 300 user online. */
export const SERVER_COUNT = 3;
export const SERVER_CAP = 300;

function pickServer(rows: { server?: number }[]) {
  const counts = Array.from({ length: SERVER_COUNT }, () => 0);
  for (const r of rows) {
    const s = Math.min(SERVER_COUNT, Math.max(1, r.server ?? 1));
    counts[s - 1] += 1;
  }
  let best = 1;
  for (let i = 1; i < SERVER_COUNT; i += 1) {
    if (counts[i] < counts[best - 1]) best = i + 1;
  }
  return { server: best, counts };
}

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
    const fresh = existing.filter((p) => now - p.at <= FRESH_MS);
    const mine = existing.find((p) => p.userId === userId);
    // Server dipilih sekali dan dipertahankan. Kalau record lama tidak punya
    // server, pilih server paling sepi (server 1 → 2 → 3 saat penuh).
    const assigned = mine?.server && mine.server >= 1 && mine.server <= SERVER_COUNT
      ? mine.server
      : pickServer(fresh.filter((p) => p.userId !== userId)).server;
    if (mine) {
      if (now - mine.at > 15_000 || mine.server !== assigned)
        await ctx.db.patch(mine._id, { at: now, server: assigned });
    } else {
      await ctx.db.insert("presences", { userId, at: now, server: assigned });
    }
    // Buang record basi supaya tabel tidak menumpuk.
    for (const p of existing) {
      if (now - p.at > 24 * 3_600_000) await ctx.db.delete(p._id);
    }
  },
});

/** Server user + jumlah online per server (offline tidak dihitung). */
export const myServer = query({
  args: {},
  handler: async (ctx) => {
    let userId;
    try {
      userId = await getAuthUserId(ctx);
    } catch {
      userId = null;
    }
    const cutoff = Date.now() - FRESH_MS;
    const rows = await ctx.db
      .query("presences")
      .withIndex("at", (q) => q.gt("at", cutoff))
      .collect();
    const counts = Array.from({ length: SERVER_COUNT }, () => 0);
    for (const r of rows) {
      const s = Math.min(SERVER_COUNT, Math.max(1, r.server ?? 1));
      counts[s - 1] += 1;
    }
    const mine = userId ? rows.find((r) => r.userId === userId) : undefined;
    return {
      server: mine?.server ?? pickServer(rows).server,
      counts,
      capacity: SERVER_CAP,
      online: rows.length,
    };
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
