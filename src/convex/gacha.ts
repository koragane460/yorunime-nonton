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
const JIKAN_URL = "https://api.jikan.moe/v4";
const KITSU_URL = "https://kitsu.io/api/edge";

/** Ambil JSON dengan timeout — dipakai fallback sumber gambar. */
async function jget(url: string, ms = 9000): Promise<any | null> {
  try {
    const r = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "YoruNime/1.0",
      },
      signal: AbortSignal.timeout(ms),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

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

/** Cari gambar karakter di Jikan (MyAnimeList) — tanpa API key. */
async function jikanImage(name: string): Promise<string> {
  const d = await jget(
    `${JIKAN_URL}/characters?q=${encodeURIComponent(name)}&limit=1&order_by=favorites&sort=desc`,
  );
  return String(d?.data?.[0]?.images?.jpg?.image_url ?? "");
}

/** Cari gambar karakter di Kitsu — tanpa API key. */
async function kitsuImage(name: string): Promise<string> {
  const d = await jget(
    `${KITSU_URL}/characters?filter[name]=${encodeURIComponent(name)}&page[limit]=1`,
  );
  return String(d?.data?.[0]?.attributes?.image?.original ?? "");
}

/** Tarik semua gambar roster dari sumber berlapis. Hasil dibungkus
 *  timestamp + tanda "lengkap" supaya cache sebagian tidak dipakai lama. */
type RosterPayload = { at: number; full: boolean; images: Record<string, string> };

async function fetchRosterImages(): Promise<RosterPayload> {
  const out: Record<string, string> = {};
  // --- 1) AniList: satu query untuk semua karakter ---
  try {
    const parts = GACHA_ROSTER.map(
      (c, i) =>
        `c${i}: Character(search: ${JSON.stringify(charQueryName(c))}){ id name{full} image{large} }`,
    );
    const data = await aniGraphql(`query{ ${parts.join(" ")} }`);
    GACHA_ROSTER.forEach((c, i) => {
      out[c.id] = String(data?.[`c${i}`]?.image?.large ?? "");
    });
  } catch {
    /* AniList gagal → lanjut ke fallback */
  }

  // --- 2) & 3) fallback per karakter yang masih kosong ---
  const missing = GACHA_ROSTER.filter((c) => !out[c.id]);
  for (const c of missing) {
    let url = "";
    try {
      url = await jikanImage(c.name);
    } catch {
      url = "";
    }
    if (!url) {
      try {
        url = await kitsuImage(c.name);
      } catch {
        url = "";
      }
    }
    out[c.id] = url;
    // jeda kecil — Jikan membatasi ~3 request/detik.
    await new Promise((r) => setTimeout(r, 350));
  }

  const full = GACHA_ROSTER.every((c) => !!out[c.id]);
  return { at: Date.now(), full, images: out };
}

/**
 * Gambar semua karakter roster — SUMBER BERLAPIS supaya gambar tidak pernah
 * kosong dan TIDAK seragam:
 *   1. AniList (satu query alias per karakter) — paling lengkap.
 *   2. Jikan / MyAnimeList — untuk yang kosong di AniList.
 *   3. Kitsu — untuk yang masih kosong.
 * Cache 30 hari kalau LENGKAP; hasil sebagian cuma dipakai 1 hari lalu
 * ditarik ulang (kesalahan lama: hasil gagal di-cache 30 hari penuh,
 * makanya kartu cuma huruf doang).
 */
export const rosterImages = action({
  args: {},
  handler: async (ctx) => {
    const payload = (await cached(
      ctx,
      "gacha:roster:v2",
      30 * 86400 * 1000,
      fetchRosterImages,
    )) as RosterPayload;
    // Hasil kosong total → langsung tarik ulang. Hasil sebagian yang sudah
    // tua (>1 hari) → tarik ulang sekali tanpa cache.
    const cachedOk = Object.values(payload.images ?? {}).filter(Boolean).length;
    if (cachedOk === 0 || (!payload.full && Date.now() - payload.at > 86400 * 1000)) {
      const fresh = await fetchRosterImages();
      const okCount = Object.values(fresh.images).filter(Boolean).length;
      if (okCount > 0) return fresh.images;
    }
    return payload.images;
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
