// YoruNime — SISTEM GACHA karakter anime.
//
// Mata uang: Sacret (field `diamonds` di user). 1 pull = 160, 10 pull =
// 1600. Rank SSS paling susah didapat; PITY 75 menjamin SSS. Kartu yang
// didapat bisa dipasang di pengaturan (equip kartu anime) dan tampil di
// detail akun. Semua efek/animasi kartu ada di frontend — di sini hanya
// logika, angka, dan koleksi.
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { action, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  GACHA_ROSTER,
  PITY_MAX,
  PULL_COST_1,
  PULL_COST_10,
  charQueryName,
  type GachaChar,
  type GachaRank,
} from "../lib/gachaRoster";

const ANILIST_URL = "https://graphql.anilist.co";

async function aniGraphql(
  query: string,
  variables: Record<string, unknown> = {},
): Promise<any> {
  const res = await fetch(ANILIST_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "YoruNime/1.0",
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`AniList ${res.status}`);
  const j = await res.json();
  if (j?.errors?.length) throw new Error(`AniList: ${j.errors[0].message}`);
  return j?.data;
}

/** Cache sederhana lewat tabel animeCache (dipinjam dari anime.ts). */
async function cached(
  runCtx: any,
  endpoint: string,
  ttlMs: number,
  fetcher: () => Promise<unknown>,
): Promise<unknown> {
  const row = await runCtx.runQuery(internal.anime.cacheGet, { endpoint });
  if (row && Date.now() - row.updatedAt < ttlMs) return row.payload;
  const payload = await fetcher();
  await runCtx.runMutation(internal.anime.cacheSet, { endpoint, payload });
  return payload;
}

/** Gambar semua karakter roster — SATU query AniList (alias per karakter),
 *  di-cache 30 hari. Dipanggil frontend saat membuka layar Gacha. */
export const rosterImages = action({
  args: {},
  handler: async (ctx) => {
    return (await cached(
      ctx,
      "gacha:roster:v1",
      30 * 86400 * 1000,
      async () => {
        const parts = GACHA_ROSTER.map(
          (c, i) =>
            `c${i}: Character(search: ${JSON.stringify(charQueryName(c))}){ id name{full} image{large} }`,
        );
        const data = await aniGraphql(`query{ ${parts.join(" ")} }`);
        const out: Record<string, string> = {};
        GACHA_ROSTER.forEach((c, i) => {
          out[c.id] = String(data?.[`c${i}`]?.image?.large ?? "");
        });
        return out;
      },
    )) as Record<string, string>;
  },
});

/** State gacha milik saya: Sacret, pity, koleksi, kartu terpasang. */
export const myState = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const u = await ctx.db.get(userId);
    const st = await ctx.db
      .query("gachaState")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .first();
    return {
      sacret: u?.diamonds ?? 0,
      pity: st?.pity ?? 0,
      totalPulls: st?.totalPulls ?? 0,
      sssCount: st?.sssCount ?? 0,
      ssCount: st?.ssCount ?? 0,
      owned: (st?.owned ?? {}) as Record<string, number>,
      equippedCard: u?.equippedCard ?? null,
      history: (st?.pullHistory ?? []) as {
        id: string;
        rank: string;
        at: number;
      }[],
    };
  },
});

function pickRank(pityAfter: number): GachaRank {
  // Pity 75: pull ke-75 tanpa SSS dijamin SSS.
  if (pityAfter >= PITY_MAX) return "SSS";
  const r = Math.random();
  if (r < 0.02) return "SSS"; // 2%
  if (r < 0.15) return "SS"; // 13%
  return "S"; // 85%
}

/** Tambah title collection (idempoten — hanya insert kalau belum ada). */
async function awardTitle(ctx: any, userId: any, titleId: string) {
  const hit = await ctx.db
    .query("userTitles")
    .withIndex("userId_title", (q: any) =>
      q.eq("userId", userId).eq("titleId", titleId),
    )
    .first();
  if (!hit)
    await ctx.db.insert("userTitles", {
      userId,
      titleId,
      earnedAt: Date.now(),
    });
}

/** PULL gacha — 1x (160 Sacret) atau 10x (1600 Sacret). */
export const pull = mutation({
  args: { count: v.union(v.literal(1), v.literal(10)) },
  handler: async (ctx, { count }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Masuk akun dulu");
    const u = await ctx.db.get(userId);
    if (!u) throw new Error("Akun tidak ditemukan");
    const cost = count === 1 ? PULL_COST_1 : PULL_COST_10;
    if ((u.diamonds ?? 0) < cost)
      throw new Error(`Sacret tidak cukup — butuh ${cost}`);

    let st = await ctx.db
      .query("gachaState")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .first();
    if (!st) {
      const id = await ctx.db.insert("gachaState", {
        userId,
        pity: 0,
        totalPulls: 0,
        sssCount: 0,
        ssCount: 0,
        streak: 0,
        bestStreak: 0,
        owned: {},
      });
      st = (await ctx.db.get(id))!;
    }

    const byRank: Record<GachaRank, GachaChar[]> = {
      SSS: GACHA_ROSTER.filter((c) => c.rank === "SSS"),
      SS: GACHA_ROSTER.filter((c) => c.rank === "SS"),
      S: GACHA_ROSTER.filter((c) => c.rank === "S"),
    };

    const owned: Record<string, number> = { ...(st.owned ?? {}) };
    let pity = st.pity;
    let sssInPull = 0;
    let ssInPull = 0;
    const results: GachaChar[] = [];
    for (let i = 0; i < count; i++) {
      const rank = pickRank(pity + 1);
      pity = rank === "SSS" ? 0 : pity + 1;
      const pool = byRank[rank];
      const card = pool[Math.floor(Math.random() * pool.length)];
      results.push(card);
      owned[card.id] = (owned[card.id] ?? 0) + 1;
      if (rank === "SSS") sssInPull++;
      else if (rank === "SS") ssInPull++;
    }

    const gotSss = sssInPull > 0;
    const streak = gotSss ? st.streak + 1 : 0;
    const bestStreak = Math.max(st.bestStreak, streak);
    const sssCount = st.sssCount + sssInPull;
    const ssCount = st.ssCount + ssInPull;

    // Riwayat pull terbaru disimpan (paling baru di depan, maksimal 100).
    const now = Date.now();
    const historyEntries = results
      .map((c) => ({ id: c.id, rank: c.rank as string, at: now }))
      .reverse();
    const pullHistory = [
      ...historyEntries,
      ...((st.pullHistory ?? []) as { id: string; rank: string; at: number }[]),
    ].slice(0, 100);

    await ctx.db.patch(st._id, {
      pity,
      totalPulls: st.totalPulls + count,
      sssCount,
      ssCount,
      streak,
      bestStreak,
      owned,
      pullHistory,
    });
    await ctx.db.patch(userId, { diamonds: (u.diamonds ?? 0) - cost });

    // ---- TITLE COLLECTION (dicek setiap pull) ----
    if (sssCount >= 1) await awardTitle(ctx, userId, "lucky_trinity");
    if (sssCount >= 2) await awardTitle(ctx, userId, "jackpot_hunter");
    if (bestStreak >= 3) await awardTitle(ctx, userId, "unbreakable_streak");
    if (sssInPull >= 3) await awardTitle(ctx, userId, "celestial_pull");
    if (sssInPull >= 1 && ssInPull >= 1)
      await awardTitle(ctx, userId, "ss_s_magnet");
    if (sssInPull >= 4) await awardTitle(ctx, userId, "three_of_kind");

    return {
      results: results.map((c) => ({
        id: c.id,
        name: c.name,
        anime: c.anime,
        rank: c.rank as string,
      })),
      pity,
      sssInPull,
      ssInPull,
      sacret: (u.diamonds ?? 0) - cost,
    };
  },
});

/** Pasang kartu anime (harus dimiliki) — "none" untuk melepas. */
export const equipCard = mutation({
  args: { cardId: v.string() },
  handler: async (ctx, { cardId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Masuk akun dulu");
    if (cardId !== "none") {
      const st = await ctx.db
        .query("gachaState")
        .withIndex("userId", (q) => q.eq("userId", userId))
        .first();
      if (!((st?.owned ?? {}) as Record<string, number>)[cardId])
        throw new Error("Kartu belum dimiliki");
    }
    await ctx.db.patch(userId, {
      equippedCard: cardId === "none" ? undefined : cardId,
    });
  },
});
