"use node";
// YoruNime — FILM (bioskop/series) — data TMDb + resolver stream.
//
// Pendekatan (rekomendasi developer streaming):
//   * DATA lengkap (judul, sinopsis, poster, genre, rating, backdrop) dari
//     TMDb API — resmi, gratis, metadata Indonesia tersedia.
//   * TAUTAN streaming dari resolver gaya VidSrc / Cinepro: pakai tmdb id
//     untuk membangun embed (langsung main di iframe) ATAU mencoba resolve
//     .m3u8/.mp4 langsung lewat beberapa provider cadangan.
//
// Kunci disimpan sebagai env var Convex: TMDB_API_KEY (opsional — kalau
// kosong, katalog jatuh ke daftar statis supaya halaman tidak pernah kosong).
import { v } from "convex/values";
import { action } from "./_generated/server";

const TMDB = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

async function tmdb(path: string, params: Record<string, string> = {}) {
  const key = process.env.TMDB_API_KEY;
  if (!key) return null;
  const url = new URL(`${TMDB}${path}`);
  url.searchParams.set("api_key", key);
  url.searchParams.set("language", "id-ID");
  for (const [k, val] of Object.entries(params)) url.searchParams.set(k, val);
  try {
    const r = await fetch(url.toString(), {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

const poster = (p?: string | null) => (p ? `${IMG}/w500${p}` : undefined);
const backdrop = (p?: string | null) => (p ? `${IMG}/original${p}` : undefined);

export type FilmCard = {
  id: string;
  title: string;
  image?: string;
  year?: string;
  rating?: number;
  kind: "movie" | "tv";
};

function toCard(r: any, kind: "movie" | "tv"): FilmCard {
  return {
    id: String(r.id),
    title: r.title || r.name || r.original_title || r.original_name || "Tanpa judul",
    image: poster(r.poster_path),
    year: String(r.release_date || r.first_air_date || "").slice(0, 4) || undefined,
    rating: r.vote_average ? Number(r.vote_average) : undefined,
    kind,
  };
}

/** Katalog statis minimal supaya halaman tidak pernah kosong tanpa API key. */
const FALLBACK: FilmCard[] = [
  { id: "550", title: "Fight Club", image: "https://image.tmdb.org/t/p/w500/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg", year: "1999", rating: 8.4, kind: "movie" },
  { id: "155", title: "The Dark Knight", image: "https://image.tmdb.org/t/p/w500/qJ2tW6WMUDux911r6m7haRef0WH.jpg", year: "2008", rating: 8.5, kind: "movie" },
  { id: "603", title: "The Matrix", image: "https://image.tmdb.org/t/p/w500/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg", year: "1999", rating: 8.2, kind: "movie" },
  { id: "157336", title: "Interstellar", image: "https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg", year: "2014", rating: 8.4, kind: "movie" },
  { id: "27205", title: "Inception", image: "https://image.tmdb.org/t/p/w500/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg", year: "2010", rating: 8.4, kind: "movie" },
  { id: "680", title: "Pulp Fiction", image: "https://image.tmdb.org/t/p/w500/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg", year: "1994", rating: 8.5, kind: "movie" },
];

/** Pencarian film (TMDb). Query kosong → populer. */
export const search = action({
  args: { q: v.optional(v.string()), kind: v.optional(v.union(v.literal("movie"), v.literal("tv"))) },
  handler: async (_ctx, { q, kind }) => {
    const k = kind ?? "movie";
    const term = (q ?? "").trim();
    const path = term ? `/search/${k}` : `/${k}/popular`;
    const data = await tmdb(path, term ? { query: term, include_adult: "false" } : {});
    const results = (data?.results ?? []) as any[];
    const cards = results.filter((r) => r.poster_path).map((r) => toCard(r, k));
    return cards.length ? cards : (term ? [] : FALLBACK);
  },
});

/** Genre list film (untuk chip genre di halaman Film). */
export const genres = action({
  args: { kind: v.optional(v.union(v.literal("movie"), v.literal("tv"))) },
  handler: async (_ctx, { kind }) => {
    const k = kind ?? "movie";
    const data = await tmdb(`/genre/${k}/list`);
    const list = (data?.genres ?? []) as any[];
    return list.map((g) => ({ id: String(g.id), name: g.name }));
  },
});

/** Film per genre (discover). */
export const byGenre = action({
  args: { genreId: v.string(), kind: v.optional(v.union(v.literal("movie"), v.literal("tv"))) },
  handler: async (_ctx, { genreId, kind }) => {
    const k = kind ?? "movie";
    const data = await tmdb(`/discover/${k}`, { with_genres: genreId, sort_by: "popularity.desc" });
    const results = (data?.results ?? []) as any[];
    const cards = results.filter((r) => r.poster_path).map((r) => toCard(r, k));
    return cards.length ? cards : FALLBACK;
  },
});

/** Detail film lengkap: sinopsis, poster, backdrop, genre, rating, runtime. */
export const detail = action({
  args: { id: v.string(), kind: v.optional(v.union(v.literal("movie"), v.literal("tv"))) },
  handler: async (_ctx, { id, kind }) => {
    const k = kind ?? "movie";
    const d = await tmdb(`/${k}/${id}`, { append_to_response: "credits,videos" });
    if (!d) {
      // Fallback dari daftar statis + resolver tetap jalan.
      const f = FALLBACK.find((x) => x.id === id) ?? FALLBACK[0];
      return {
        id: f.id, title: f.title, image: f.image, year: f.year, rating: f.rating,
        kind: k, synopsis: "", genres: [] as { id: string; name: string }[],
        runtime: undefined as number | undefined, tagline: undefined as string | undefined,
        director: undefined as string | undefined, cast: [] as string[],
      };
    }
    const runtime = k === "movie" ? d.runtime : (d.episode_run_time?.[0] as number | undefined);
    return {
      id: String(d.id),
      title: d.title || d.name || d.original_title || d.original_name || "Tanpa judul",
      image: poster(d.poster_path),
      backdrop: backdrop(d.backdrop_path),
      year: String(d.release_date || d.first_air_date || "").slice(0, 4) || undefined,
      rating: d.vote_average ? Number(Number(d.vote_average).toFixed(1)) : undefined,
      kind: k,
      synopsis: d.overview || "",
      genres: ((d.genres ?? []) as any[]).map((g) => ({ id: String(g.id), name: g.name })),
      runtime: typeof runtime === "number" && runtime > 0 ? runtime : undefined,
      tagline: d.tagline || undefined,
      director: ((d.credits?.crew ?? []) as any[]).find((c) => c.job === "Director")?.name,
      cast: ((d.credits?.cast ?? []) as any[]).slice(0, 6).map((c) => c.name),
      seasons: k === "tv" ? (d.number_of_seasons as number | undefined) : undefined,
      episodes: k === "tv" ? (d.number_of_episodes as number | undefined) : undefined,
    };
  },
});

export type FilmSource = { label: string; url: string; type: "embed" | "hls" | "mp4" };

/**
 * Resolver stream film — rangkai beberapa provider gaya VidSrc/Cinepro.
 *
 * Strategi:
 *   1. Coba resolve .m3u8/.mp4 lewat provider scraping (Cinepro-style). Kalau
 *      ketemu link langsung → tipe "hls"/"mp4" (bisa diputar di player native).
 *   2. Kalau gagal, sediakan embed VidSrc (langsung main di iframe) sebagai
 *      cadangan — selalu ada minimal satu sumber.
 *
 * catatan legal: endpoint publik ini bisa berubah/mati sewaktu-waktu; karena
 * itu selalu ada fallback embed supaya pengguna tidak mentok di layar kosong.
 */
export const resolveStream = action({
  args: {
    id: v.string(),
    kind: v.optional(v.union(v.literal("movie"), v.literal("tv"))),
    season: v.optional(v.number()),
    episode: v.optional(v.number()),
  },
  handler: async (_ctx, { id, kind, season, episode }) => {
    const k = kind ?? "movie";
    const sources: FilmSource[] = [];

    // Provider 1 — VidSrc (embed, paling stabil untuk movie & tv).
    const vidsrc =
      k === "tv"
        ? `https://vidsrc.to/embed/tv/${id}/${season ?? 1}/${episode ?? 1}`
        : `https://vidsrc.to/embed/movie/${id}`;
    sources.push({ label: "VidSrc HD", url: vidsrc, type: "embed" });

    // Provider 2 — VidSrc Pro (cadangan, kadang lebih cepat).
    const vidsrcPro =
      k === "tv"
        ? `https://vidsrc.pro/embed/tv/${id}/${season ?? 1}/${episode ?? 1}`
        : `https://vidsrc.pro/embed/movie/${id}`;
    sources.push({ label: "VidSrc Pro", url: vidsrcPro, type: "embed" });

    // Provider 3 — 2embed (cadangan kedua).
    const twoEmbed = `https://www.2embed.cc/embed/${k === "tv" ? "tv" : "movie"}/${id}`;
    sources.push({ label: "2Embed", url: twoEmbed, type: "embed" });

    // Coba resolve link langsung (Cinepro-style) — kalau berhasil, sisipkan di
    // urutan pertama supaya player native (HLS/MP4) dipakai bila tersedia.
    const direct = await tryDirect(id, k, season, episode);
    if (direct) sources.unshift(direct);

    return { sources };
  },
});

/** Percobaan resolve .m3u8/.mp4 langsung dari provider publik. */
async function tryDirect(
  id: string,
  k: "movie" | "tv",
  season?: number,
  episode?: number,
): Promise<FilmSource | null> {
  const path =
    k === "tv" ? `/tv/${id}/${season ?? 1}/${episode ?? 1}` : `/movie/${id}`;
  for (const base of ["https://moviesapi.club", "https://2embed.cc"]) {
    try {
      const r = await fetch(`${base}${path}`, {
        headers: { "User-Agent": UA, Accept: "application/json" },
        signal: AbortSignal.timeout(7_000),
      });
      if (!r.ok) continue;
      const text = await r.text();
      // Cari URL stream langsung di dalam respons (JSON / HTML).
      const m3u8 = text.match(/https?:\/\/[^\s"'\\]+\.m3u8[^\s"'\\]*/)?.[0];
      const mp4 = text.match(/https?:\/\/[^\s"'\\]+\.mp4[^\s"'\\]*/)?.[0];
      if (m3u8) return { label: "Streaming HD", url: m3u8, type: "hls" };
      if (mp4) return { label: "Streaming MP4", url: mp4, type: "mp4" };
    } catch {
      /* provider ini tidak merespons — lanjut ke berikutnya */
    }
  }
  return null;
}
