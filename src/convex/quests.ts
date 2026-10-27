// YoruNime — DAILY QUEST (progress harian).
//
// Quest-nya sendiri ditentukan di client (diputar per tanggal supaya 3 misi
// berbeda tiap hari), backend di sini hanya menghitung PROGRESS nyata hari ini:
// berapa anime ditonton, menit nonton, chapter dibaca, komentar, favorite.
//
// Reset mengikuti jam 00.00 WIB (UTC+7) — sama dengan aturan reset quest.
import { getAuthUserId } from "@convex-dev/auth/server";
import { query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";

const WIB_OFFSET = 7 * 3_600_000;

/** Awal hari (00.00 WIB) untuk waktu sekarang. */
export function dayStartWib(now = Date.now()): number {
  return Math.floor((now + WIB_OFFSET) / 86_400_000) * 86_400_000 - WIB_OFFSET;
}

async function userIdOr(ctx: QueryCtx) {
  try {
    return await getAuthUserId(ctx);
  } catch {
    return null;
  }
}

export const dailyProgress = query({
  args: {},
  handler: async (ctx) => {
    const userId = await userIdOr(ctx);
    if (userId === null) return null;
    const from = dayStartWib();

    // Nonton: anime UNIK yang episodenya disentuh hari ini + total menit.
    const watchRows = await ctx.db
      .query("watchHistory")
      .withIndex("userId_updated", (q) => q.eq("userId", userId))
      .order("desc")
      .take(200);
    const animeToday = new Set<string>();
    let minutesToday = 0;
    for (const h of watchRows) {
      if ((h.updatedAt ?? 0) >= from) {
        animeToday.add(String(h.animeId));
        minutesToday += h.minutesWatched ?? 0;
      }
    }

    // Baca komik hari ini.
    const comicRows = await ctx.db
      .query("comicHistory")
      .withIndex("userId_updated", (q) => q.eq("userId", userId))
      .order("desc")
      .take(100);
    const comicsToday = comicRows.filter((c) => (c.updatedAt ?? 0) >= from).length;

    // Komentar & favorite hari ini.
    const comments = await ctx.db
      .query("animeComments")
      .filter((q: any) => q.eq(q.field("userId"), userId))
      .take(200);
    const commentsToday = comments.filter((c: any) => (c.createdAt ?? 0) >= from).length;

    const favs = await ctx.db
      .query("animeFavorites")
      .withIndex("userId_created", (q) => q.eq("userId", userId))
      .order("desc")
      .take(200);
    const favoritesToday = favs.filter((f) => (f._creationTime ?? 0) >= from).length;

    // Chat global hari ini.
    const chats = await ctx.db
      .query("chatMessages")
      .filter((q: any) => q.eq(q.field("userId"), userId))
      .take(200);
    const chatsToday = chats.filter((m: any) => (m.createdAt ?? 0) >= from).length;

    return {
      dayStart: from,
      watchCount: animeToday.size,
      minutes: minutesToday,
      comicCount: comicsToday,
      commentCount: commentsToday,
      favoriteCount: favoritesToday,
      chatCount: chatsToday,
    };
  },
});
