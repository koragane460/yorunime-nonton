// YoruNime — SISTEM TITLE.
//
// Tiga grup title:
//   nonton    — dari jumlah judul anime yang pernah ditonton
//   menit     — dari total menit menonton
//   collection— dari hasil gacha (dicek di gacha.ts waktu pull)
//
// Title yang belum dimiliki tampil abu-abu di layar Title; yang sudah
// dimiliki bisa dipasang (equip) lewat Pengaturan → tampil di detail akun.
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { GACHA_ROSTER } from "../lib/gachaRoster";

export type TitleGroup = "nonton" | "menit" | "collection";

export const TITLE_DEFS: {
  id: string;
  group: TitleGroup;
  name: string;
  desc: string;
  /** Ambang angka (hanya grup nonton/menit). */
  need?: number;
  metric?: "watched" | "minutes";
}[] = [
  // -------- GRUP NONTON (urut termudah → tersulit) --------
  {
    id: "beginner",
    group: "nonton",
    name: "Beginner",
    desc: "Tonton 20 anime",
    need: 20,
    metric: "watched",
  },
  {
    id: "entry",
    group: "nonton",
    name: "Entry",
    desc: "Tonton 150 anime",
    need: 150,
    metric: "watched",
  },
  {
    id: "master",
    group: "nonton",
    name: "Master",
    desc: "Tonton lebih dari 500 anime",
    need: 500,
    metric: "watched",
  },
  // -------- GRUP MENIT --------
  {
    id: "all_the_time",
    group: "menit",
    name: "All The Time",
    desc: "Tonton 1.000 menit",
    need: 1000,
    metric: "minutes",
  },
  {
    id: "time_timer",
    group: "menit",
    name: "Time Timer",
    desc: "Tonton 4.000 menit",
    need: 4000,
    metric: "minutes",
  },
  {
    id: "heroes_of_time",
    group: "menit",
    name: "The Heroes Of The Time",
    desc: "Tonton 10.000 menit",
    need: 10000,
    metric: "minutes",
  },
  // -------- GRUP COLLECTION (dari gacha) --------
  {
    id: "lucky_trinity",
    group: "collection",
    name: "Lucky Trinity",
    desc: "Dapat SSS 1 kali",
  },
  {
    id: "jackpot_hunter",
    group: "collection",
    name: "Jackpot Hunter",
    desc: "Dapat SSS 2 kali",
  },
  {
    id: "unbreakable_streak",
    group: "collection",
    name: "Unbreakable Streak",
    desc: "Dapat SSS 3x berturut-turut",
  },
  {
    id: "celestial_pull",
    group: "collection",
    name: "Celestial Pull",
    desc: "Lebih dari 2 SSS dalam 1 gacha",
  },
  {
    id: "ss_s_magnet",
    group: "collection",
    name: "SS-S Magnet",
    desc: "Dapat SSS dan SS bersamaan dalam 1 gacha",
  },
  {
    id: "three_of_kind",
    group: "collection",
    name: "Three Of Kind",
    desc: "Lebih dari 3 SSS dalam 1 gacha",
  },
];

/** Cek syarat nonton/menit + koleksi gacha, lalu tambahkan title baru.
 *  Dipanggil saat layar Title dibuka (idempoten). */
export const checkAndAward = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return { earned: [] as string[] };
    const u = await ctx.db.get(userId);
    // Jumlah judul unik yang pernah ditonton + total menit (dari riwayat).
    const hist = await ctx.db
      .query("watchHistory")
      .withIndex("userId_updated", (q) => q.eq("userId", userId))
      .take(5000);
    const watched = new Set(hist.map((h) => h.animeId)).size;
    const minutes = hist.reduce((s, h) => s + (h.minutesWatched ?? 0), 0);
    void u;

    const ownedRows = await ctx.db
      .query("userTitles")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect();
    const have = new Set(ownedRows.map((r) => r.titleId));
    const newlyEarned: string[] = [];

    const award = async (titleId: string) => {
      if (have.has(titleId)) return;
      have.add(titleId);
      newlyEarned.push(titleId);
      await ctx.db.insert("userTitles", {
        userId,
        titleId,
        earnedAt: Date.now(),
      });
    };

    for (const t of TITLE_DEFS) {
      if (t.metric === "watched" && watched >= (t.need ?? 0)) await award(t.id);
      if (t.metric === "minutes" && minutes >= (t.need ?? 0)) await award(t.id);
    }
    // Title collection dicek ulang dari angka gacha (per-pull yang lama
    // sudah di-award di gacha.ts; ini pengaman untuk state lama).
    const st = await ctx.db
      .query("gachaState")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .first();
    if (st) {
      if (st.sssCount >= 1) await award("lucky_trinity");
      if (st.sssCount >= 2) await award("jackpot_hunter");
      if (st.bestStreak >= 3) await award("unbreakable_streak");
    }

    return { earned: newlyEarned, watched, minutes };
  },
});

/** Semua title + status dimiliki + yang sedang dipasang + kartu terpasang. */
export const myTitles = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const u = await ctx.db.get(userId);
    const rows = await ctx.db
      .query("userTitles")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect();
    const earnedAt: Record<string, number> = {};
    for (const r of rows) earnedAt[r.titleId] = r.earnedAt;
    const st = await ctx.db
      .query("gachaState")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .first();
    return {
      defs: TITLE_DEFS,
      earnedAt,
      equippedTitle: u?.equippedTitle ?? null,
      ownedCards: Object.keys(
        (st?.owned ?? {}) as Record<string, number>,
      ),
      equippedCard: u?.equippedCard ?? null,
    };
  },
});

/** Pasang title (harus dimiliki). null = lepas. */
export const equip = mutation({
  args: { titleId: v.union(v.string(), v.null()) },
  handler: async (ctx, { titleId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Masuk akun dulu");
    if (titleId !== null) {
      const hit = await ctx.db
        .query("userTitles")
        .withIndex("userId_title", (q) =>
          q.eq("userId", userId).eq("titleId", titleId),
        )
        .first();
      if (!hit) throw new Error("Title belum dimiliki");
    }
    await ctx.db.patch(userId, { equippedTitle: titleId ?? undefined });
  },
});

/** Title + kartu yang dipasang user LAIN (untuk detail akun orang lain). */
export const publicOf = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const u = await ctx.db.get(userId);
    const titleId = u?.equippedTitle;
    const cardId = u?.equippedCard;
    const title = titleId
      ? (TITLE_DEFS.find((t) => t.id === titleId) ?? null)
      : null;
    const card = cardId
      ? (GACHA_ROSTER.find((c) => c.id === cardId) ?? null)
      : null;
    return {
      title: title ? { id: title.id, name: title.name, group: title.group } : null,
      card: card ? { id: card.id, name: card.name, rank: card.rank } : null,
    };
  },
});
