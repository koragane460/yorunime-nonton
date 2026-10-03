"use node";
// YoruNime — klien SankaVollereii REST API (sumber donghua).
//
// Base: https://www.sankavollerei.web.id
//   GET /anime/:source/home          → daftar terbaru
//   GET /anime/:source/search/:query → pencarian judul
//   GET /anime/:source/detail/:slug  → detail + sinopsis + genre + episode
//
// CATATAN PENTING soal gate "Plana AI Detector":
// Endpoint tertentu membalas 403 dengan `{"status":"Plana AI Detector"}`
// kalau diakses tanpa header browser. Sebagian source (samehadaku,
// animeindo, kuramanime, zoronime) memang memblokir seperti itu; sisanya
// (donghua, donghub, anoboy, oploverz, nimegami, winbu) tetap hidup. Jadi
// setiap request selalu mengirim User-Agent + Referer, dan pemanggil mencoba
// source satu per satu sampai ada yang menjawab — bukan bergantung pada satu
// sumber saja.
import { v } from "convex/values";
import { action } from "./_generated/server";

const BASE = "https://www.sankavollerei.web.id";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

/** Header wajib; tanpa ini server membalas 403 "Plana AI Detector". */
function headers(): Record<string, string> {
  return {
    "User-Agent": UA,
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "id-ID,id;q=0.9,en;q=0.8",
    Referer: `${BASE}/anime`,
  };
}

/**
 * Request JSON dengan timeout. Mengembalikan `null` kalau source sedang mati
 * atau memblokir — pemanggil lalu mencoba source berikutnya, bukan gagal
 * seluruhnya.
 */
async function sankaGet(
  path: string,
  timeoutMs = 15_000,
): Promise<Record<string, any> | null> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: headers(),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as Record<string, unknown>;
    // Gate anti-bot Sometimes balas status 200 dengan field status berisi
    // "Plana AI Detector", jadi harus diperiksa di body, bukan cuma HTTP.
    if (typeof j?.status === "string" && /detector/i.test(j.status)) return null;
    return j as Record<string, any>;
  } catch {
    return null;
  }
}

export type SankaAnime = {
  title: string;
  slug: string;
  poster?: string;
  status?: string;
  type?: string;
  rating?: string | number;
  current_episode?: string | number;
};

function toCard(x: any): SankaAnime | null {
  const title = String(x?.title ?? "").trim();
  const slug = String(x?.slug ?? "").trim();
  if (!title || !slug) return null;
  return {
    title,
    slug,
    poster: x.poster ? String(x.poster) : undefined,
    status: x.status ? String(x.status) : undefined,
    type: x.type ? String(x.type) : undefined,
    rating: x.rating,
    current_episode: x.current_episode,
  };
}

/** Ambil list dari respons apa pun bentuknya (tiap source beda struktur). */
function pickList(j: Record<string, any> | null): any[] {
  if (!j) return [];
  for (const key of [
    "anime_list",
    "latest_release",
    "completed_donghua",
    "data",
    "results",
    "anime",
  ]) {
    const val = j[key];
    if (Array.isArray(val) && val.length > 0) return val;
  }
  // Fallback: scan nilai apa pun yang berupa array of object.
  for (const val of Object.values(j)) {
    if (Array.isArray(val) && val.length > 0 && typeof val[0] === "object")
      return val;
  }
  return [];
}

/** Source yang stabil dipakai pertama, lalu dicoba satu per satu. */
const DONGHUA_SOURCES = ["donghua", "donghub"] as const;
const ANIME_SOURCES = ["oploverz", "anoboy", "nimegami", "winbu"] as const;

async function fetchLatest(source: string, limit: number) {
  const j = await sankaGet(`/anime/${source}/home`);
  const list = pickList(j).map(toCard).filter(Boolean) as SankaAnime[];
  return list.slice(0, Math.max(1, Math.min(40, limit)));
}

async function fetchSearch(source: string, q: string, limit: number) {
  const query = q.trim();
  if (query.length < 2) return [];
  const j = await sankaGet(`/anime/${source}/search/${encodeURIComponent(query)}`);
  const list = pickList(j).map(toCard).filter(Boolean) as SankaAnime[];
  return list.slice(0, Math.max(1, Math.min(40, limit)));
}

/** Daftar donghua terbaru; mencoba tiap source sampai ada yang hidup. */
async function donghuaLatestInternal(limit: number): Promise<SankaAnime[]> {
  for (const src of DONGHUA_SOURCES) {
    const list = await fetchLatest(src, limit);
    if (list.length > 0) return list;
  }
  return [];
}

/** Pencarian donghua — hanya katalog donghua, tidak pernah tercampur anime. */
async function donghuaSearchInternal(
  q: string,
  limit: number,
): Promise<SankaAnime[]> {
  for (const src of DONGHUA_SOURCES) {
    const list = await fetchSearch(src, q, limit);
    if (list.length > 0) return list;
  }
  return [];
}

/* ------------------------------------------------------------------ *
 *  Action yang dipakai UI.
 *
 *  Bentuk output sengaja dibuat datar & stabil supaya komponen tidak
 *  perlu tahu bentuk mentah API.
 * ------------------------------------------------------------------ */

/** Peta satu item Sanka → bentuk yang dipakai kartu di UI. */
function uiCard(x: SankaAnime) {
  const epRaw = x.current_episode;
  const epNum =
    typeof epRaw === "number"
      ? epRaw
      : Number(String(epRaw ?? "").match(/(\d+)/)?.[1] ?? 0) || 0;
  return {
    id: x.slug,
    title: x.title,
    image: x.poster ?? "",
    status: x.status ?? "",
    // Selalu DONGHUA — dipakai UI untuk membedakan dari anime.
    type: "DONGHUA",
    score: x.rating != null ? Number(x.rating) || undefined : undefined,
    episode: epNum || undefined,
  };
}

/** Daftar donghua untuk baris "Donghua" di Home. */
export const donghuaLatestCards = action({
  args: { limit: v.optional(v.number()) },
  handler: async (_ctx, { limit = 20 }) => {
    const list = await donghuaLatestInternal(limit);
    return list.map(uiCard);
  },
});

/** Pencarian donghua (dipakai layar "Cari anime & donghua"). */
export const donghuaSearchCards = action({
  args: { q: v.string(), limit: v.optional(v.number()) },
  handler: async (_ctx, { q, limit = 20 }) => {
    const list = await donghuaSearchInternal(q, limit);
    return list.map(uiCard);
  },
});

/**
 * Jadwal donghua untuk tab Jadwal.
 *
 * Sanka tidak menyediakan jadwal airing per hari seperti AniList. Yang
 * dikembalikan adalah daftar donghua yang sedang jalan; `estimated: true`
 * menandai bahwa ini bukan jam tayang resmi, dan UI menulis "sedang jalan"
 * alih-alih menjanjikan waktu yang tidak dimiliki API.
 */
export const donghuaScheduleCards = action({
  args: {},
  handler: async () => {
    const list = await donghuaLatestInternal(24);
    return list.map((x) => ({ ...uiCard(x), estimated: true as const }));
  },
});

export type SankaDetail = {
  title: string;
  alterTitle?: string;
  poster?: string;
  cover?: string;
  rating?: string;
  status?: string;
  type?: string;
  synopsis: string;
  genres: string[];
  episodes: { number: number; title: string; url: string }[];
  /** Source tempat detail ini diambil (dipakai lagi saat ambil episode). */
  source: string;
};

/** Detail satu judul; donghua dicoba lebih dulu kalau diminta. */
export const detail = action({
  args: { slug: v.string(), preferDonghua: v.optional(v.boolean()) },
  handler: async (
    _ctx,
    { slug, preferDonghua = true },
  ): Promise<SankaDetail | { error: string }> => {
    const s = slug.trim();
    if (!s) return { error: "Slug kosong" };
    const order = preferDonghua
      ? [...DONGHUA_SOURCES, ...ANIME_SOURCES]
      : [...ANIME_SOURCES, ...DONGHUA_SOURCES];

    for (const src of order) {
      const d = await sankaGet(`/anime/${src}/detail/${encodeURIComponent(s)}`);
      if (!d) continue;

      // Sinopsis bisa string atau objek {text}; ambil yang terbaca.
      let synopsis = "";
      const rawSyn = d.synopsis ?? d.description ?? d.sinopsisId;
      if (typeof rawSyn === "string") synopsis = rawSyn;
      else if (rawSyn && typeof rawSyn === "object")
        synopsis = String(rawSyn.text ?? rawSyn.synopsis ?? "");

      const genres = Array.isArray(d.genres)
        ? d.genres
            .map((g: any) => (typeof g === "string" ? g : String(g?.name ?? "")))
            .filter(Boolean)
        : [];

      // Kunci daftar episode di API adalah `episodes_list` (nama field
      // `episode` tidak pernah dipakai). Karena itu daftar ini pernah kosong
      // padahal API mengirimkannya.
      const rawEps = Array.isArray(d.episodes_list)
        ? d.episodes_list
        : Array.isArray(d.episode)
          ? d.episode
          : [];
      const eps = rawEps.map((e: any) => ({
        number:
          Number(e?.episode_number ?? e?.number ?? e?.episode ?? 0) || 0,
        title: String(e?.episode ?? e?.title ?? e?.name ?? ""),
        // `slug` dipakai sebagai identitas episode: endpoint stream-nya
        // `/anime/:source/episode/:slug`.
        url: String(e?.slug ?? e?.href ?? ""),
      }));

      // Respon kosong (cuma judul) dianggap gagal supaya mencoba source lain.
      if (!synopsis && eps.length === 0 && genres.length === 0) continue;

      return {
        title: String(d.title ?? s),
        alterTitle: d.alter_title ? String(d.alter_title) : undefined,
        poster: d.poster ? String(d.poster) : undefined,
        cover: d.cover ? String(d.cover) : undefined,
        rating: d.rating != null ? String(d.rating) : undefined,
        status: d.status ? String(d.status) : undefined,
        type: d.type ? String(d.type) : undefined,
        synopsis,
        genres,
        episodes: eps,
        source: src,
      };
    }
    return { error: "Detail tidak ditemukan" };
  },
});
/**
 * Stream satu episode donghua.
 *
 * Endpoint: GET /anime/:source/episode/:slug  → daftar server embed.
 *
 * Semua server dari API ini adalah player embed yang subtitle Bahasa
 *Indonesianya sudah menempel di video, jadi `baked: true` — player tidak
 * perlu menggambar subtitle sendiri dan tidak akan menimpa subtitle aslinya.
 * Bentuk dikembalikan sengaja sama dengan `megaplay.resolveEpisode` supaya
 * halaman Nonton tidak perlu tahu asal bedanya.
 */
export const resolveEpisode = action({
  args: { slug: v.string(), source: v.optional(v.string()) },
  handler: async (_ctx, { slug, source }) => {
    const epSlug = String(slug ?? "").trim();
    if (!epSlug) {
      return { ok: false as const, reason: "Episode belum tersedia" };
    }
    // Source dari parameter kalau ada; kalau tidak, coba donghua dulu lalu
    // sisanya — persis urutan yang dipakai `detail`.
    const order = source
      ? [source, ...DONGHUA_SOURCES.filter((s) => s !== source)]
      : [...DONGHUA_SOURCES, ...ANIME_SOURCES];

    for (const src of order) {
      const j = await sankaGet(
        `/anime/${src}/episode/${encodeURIComponent(epSlug)}`,
        20_000,
      );
      const list = j?.streaming?.servers;
      if (!Array.isArray(list) || list.length === 0) continue;
      const sources = list
        .map((s: any) => ({
          label: String(s?.name ?? src),
          url: String(s?.url ?? ""),
          type: "embed" as const,
          baked: true,
        }))
        .filter((s: { url: string }) => s.url.length > 0);
      if (sources.length === 0) continue;
      return {
        ok: true as const,
        sources,
        subtitle: null,
        subtitles: [] as { label: string; url: string }[],
        subTracks: [] as unknown[],
        hasIndonesian: true,
        bakedSubs: true,
        intro: null,
        outro: null,
        megaM3u8: null,
        megaRef: null,
      };
    }
    return { ok: false as const, reason: "Episode belum tersedia" };
  },
});
