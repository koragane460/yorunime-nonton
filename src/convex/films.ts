"use node";
// YoruNime — FILM (bioskop/series) — data + resolver stream.
//
// SUMBER DATA (berlapis supaya halaman tidak pernah kosong):
//   1. TMDb (utama, kalau env TMDB_API_KEY tersedia) — data paling lengkap
//      + id TMDB native untuk resolver streaming.
//   2. Tanpa TMDb: iTunes RSS Top Movies (tanpa API key) untuk katalog film,
//      TVmaze (tanpa API key) untuk series, IMDb suggestion untuk pencarian
//      & pemetaan judul → IMDb id (dipakai resolver VidSrc).
//   3. Daftar statis minimal sebagai jaring pengaman terakhir.
//
// PENTING: semua jalur tetap menghasilkan kartu + detail + tautan streaming,
// jadi halaman Film tetap berfungsi penuh walau TMDB_API_KEY belum diisi.
import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";

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

/** Ambil JSON apa pun dengan user-agent + timeout (sumber tanpa API key). */
async function jget(url: string, ms = 10_000): Promise<any | null> {
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(ms),
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

/** Katalog statis minimal supaya halaman tidak pernah kosong. */
const FALLBACK: FilmCard[] = [
  { id: "550", title: "Fight Club", image: "https://image.tmdb.org/t/p/w500/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg", year: "1999", rating: 8.4, kind: "movie" },
  { id: "155", title: "The Dark Knight", image: "https://image.tmdb.org/t/p/w500/qJ2tW6WMUDux911r6m7haRef0WH.jpg", year: "2008", rating: 8.5, kind: "movie" },
  { id: "603", title: "The Matrix", image: "https://image.tmdb.org/t/p/w500/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg", year: "1999", rating: 8.2, kind: "movie" },
  { id: "157336", title: "Interstellar", image: "https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg", year: "2014", rating: 8.4, kind: "movie" },
  { id: "27205", title: "Inception", image: "https://image.tmdb.org/t/p/w500/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg", year: "2010", rating: 8.4, kind: "movie" },
  { id: "680", title: "Pulp Fiction", image: "https://image.tmdb.org/t/p/w500/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg", year: "1994", rating: 8.5, kind: "movie" },
];

/** Detail statis (sinopsis Indonesia) untuk jaring pengaman tanpa API key. */
const FALLBACK_DETAIL: Record<string, any> = {
  "550": {
    synopsis:
      "Seorang pegawai kantor yang menderita insomnia parah membentuk klub tinju rahasia bersama seorang pedagang sabun yang eksentrik. Sebuah pelarian dari kehidupan biasa yang perlahan berubah menjadi sesuatu yang jauh lebih liar.",
    genres: [{ id: "18", name: "Drama" }, { id: "53", name: "Thriller" }],
    runtime: 139, tagline: "Mata pertama Fight Club.", director: "David Fincher",
    cast: ["Edward Norton", "Brad Pitt", "Helena Bonham Carter"],
  },
  "155": {
    synopsis:
      "Batman menghadapi ancaman paling destruktif dalam karirnya: Joker, seorang kriminal misterius yang menguasai kota Gotham dan memaksa pahlawan serta penegak hukum untuk memilih antara keadilan dan balas dendam.",
    genres: [{ id: "28", name: "Action" }, { id: "80", name: "Crime" }, { id: "18", name: "Drama" }],
    runtime: 152, tagline: "Seorang pahlawan bisa kita pantau.", director: "Christopher Nolan",
    cast: ["Christian Bale", "Heath Ledger", "Aaron Eckhart"],
  },
  "603": {
    synopsis:
      "Seorang programmer pemuda mengetahui bahwa kenyataan yang ia tinggali hanyalah simulasi buatan mesin. Ia bergabung dengan perlawanan untuk membebaskan umat manusia dari penjara digital.",
    genres: [{ id: "28", name: "Action" }, { id: "878", name: "Sci-Fi" }],
    runtime: 136, tagline: "Hidupmu adalah mimpi buruk.", director: "Lana & Lilly Wachowski",
    cast: ["Keanu Reeves", "Laurence Fishburne", "Carrie-Anne Moss"],
  },
  "157336": {
    synopsis:
      "Ketika bumi menjadi tak layak huni, sekelompok penjelajah melintasi lubang cacing di ruang angkasa untuk mencari rumah baru bagi umat manusia — dengan harga yang harus dibayar oleh keluarga.",
    genres: [{ id: "12", name: "Adventure" }, { id: "18", name: "Drama" }, { id: "878", name: "Sci-Fi" }],
    runtime: 169, tagline: "Rumah bukan sekadar tempat.", director: "Christopher Nolan",
    cast: ["Matthew McConaughey", "Anne Hathaway", "Jessica Chastain"],
  },
  "27205": {
    synopsis:
      "Seorang pencuri yang memasuki mimpi orang lain untuk mencuri rahasia diambil tawaran terakhir: menanam ide, bukan mencuri. Sebuah misi yang mengaburkan batas mimpi dan kenyataan.",
    genres: [{ id: "28", name: "Action" }, { id: "878", name: "Sci-Fi" }, { id: "12", name: "Adventure" }],
    runtime: 148, tagline: "Mimpimu, permainanku.", director: "Christopher Nolan",
    cast: ["Leonardo DiCaprio", "Joseph Gordon-Levitt", "Elliot Page"],
  },
  "680": {
    synopsis:
      "Dua cerita pembunuh bayaran, kotak berisi emas curian, dan petinju tersesat berpotongan dalam kisah brutal penuh dialog tajam khas Quentin Tarantino.",
    genres: [{ id: "53", name: "Thriller" }, { id: "80", name: "Crime" }],
    runtime: 154, tagline: "Sejurus sebelum pencurian, kekacauan.",
    director: "Quentin Tarantino",
    cast: ["John Travolta", "Uma Thurman", "Samuel L. Jackson"],
  },
};

// ==========================================================================
//  iTunes RSS — katalog film TANPA API key
// ==========================================================================

const ITUNES = "https://itunes.apple.com/id/rss";

/** Genre film iTunes (id → nama) — dipakai sebagai chip + feed per genre. */
const MOVIE_GENRES: { id: string; name: string }[] = [
  { id: "4401", name: "Action & Adventure" },
  { id: "4402", name: "Anime" },
  { id: "4403", name: "Classics" },
  { id: "4404", name: "Comedy" },
  { id: "4405", name: "Documentary" },
  { id: "4406", name: "Drama" },
  { id: "4407", name: "Foreign" },
  { id: "4408", name: "Horror" },
  { id: "4410", name: "Kids & Family" },
  { id: "4411", name: "Musicals" },
  { id: "4412", name: "Romance" },
  { id: "4413", name: "Sci-Fi & Fantasy" },
  { id: "4416", name: "Thriller" },
  { id: "4417", name: "Sports" },
  { id: "4418", name: "Western" },
];

/** Feed iTunes yang digabung: katalog lengkap di layar awal + dipakai
 *  juga saat mencari detail film supaya semua id yang tampil terpetakan. */
const RSS_GENRE_IDS = [
  undefined,
  "4401",
  "4404",
  "4406",
  "4408",
  "4413",
  "4416",
  "4412",
  "4410",
] as const;

/** Cache sederhana lewat tabel animeCache. */
async function cached(
  runCtx: any,
  endpoint: string,
  ttlMs: number,
  fetcher: () => Promise<unknown>,
): Promise<unknown> {
  const row = await runCtx.runQuery(internal.anime.cacheGet, { endpoint });
  if (row && Date.now() - row.updatedAt < ttlMs) return row.payload;
  const payload = await fetcher();
  try {
    await runCtx.runMutation(internal.anime.cacheSet, { endpoint, payload });
  } catch {
    /* cache gagal tidak menghalangi respons */
  }
  return payload;
}

function stripHtml(s?: string): string {
  return String(s ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function rssList(feed: any): any[] {
  const e = feed?.feed?.entry ?? [];
  return Array.isArray(e) ? e : e ? [e] : [];
}

function rssImage(entry: any): string | undefined {
  const imgs = (entry?.["im:image"] ?? []) as { label: string }[];
  if (!imgs.length) return undefined;
  const last = imgs[imgs.length - 1]?.label ?? "";
  // Naikkan resolusi poster (mzstatic melayani ukuran apa pun).
  return last.replace(/\/\d+x\d+bb\.(png|jpg|jpeg|webp)/, "/600x900bb.$1");
}

function rssCard(entry: any): FilmCard & { synopsis?: string; genre?: string; director?: string } {
  const raw = String(entry?.id?.attributes?.["im:id"] ?? "");
  return {
    // Prefiks "it" membedakan id Apple dari id TMDB.
    id: raw ? `it${raw}` : `it-${stripHtml(entry?.["im:name"]?.label ?? "film").slice(0, 40)}`,
    title: entry?.["im:name"]?.label ?? entry?.title?.label ?? "Tanpa judul",
    image: rssImage(entry),
    year: String(entry?.["im:releaseDate"]?.label ?? "").slice(0, 4) || undefined,
    kind: "movie",
    synopsis: stripHtml(entry?.summary?.label ?? ""),
    genre: entry?.category?.attributes?.label,
    director: entry?.["im:artist"]?.label,
  };
}

/** Ambil feed iTunes (top / per genre), di-cache 6–12 jam. */
async function rssMovies(ctx: any, genreId?: string): Promise<any[]> {
  // Kunci baru (v2) — kunci lama pernah menyimpan hasil rusak/nyaris
  // kosong, makanya layar awal film cuma menampilkan 1 film.
  const ep = genreId
    ? `films:rss:g:${genreId}:v2`
    : "films:rss:top:v2";
  const feed = (await cached(
    ctx,
    ep,
    genreId ? 12 * 3600_000 : 6 * 3600_000,
    async () =>
      jget(
        `${ITUNES}/topmovies/limit=30${genreId ? `/genre=${genreId}` : ""}/json`,
      ),
  )) as any;
  return rssList(feed);
}

// ==========================================================================
//  TVmaze — series TANPA API key
// ==========================================================================

const TVMAZE = "https://api.tvmaze.com";

function tvCard(show: any): FilmCard {
  return {
    id: `tv${show.id}`,
    title: show.name ?? "Tanpa judul",
    image: show.image?.original || show.image?.medium || undefined,
    year: String(show.premiered ?? "").slice(0, 4) || undefined,
    rating: show.rating?.average ? Number(show.rating.average) : undefined,
    kind: "tv",
  };
}

async function tvPages(ctx: any): Promise<any[]> {
  const out = await cached(ctx, "films:tv:pages:v1", 24 * 3600_000, async () => {
    const [p0, p1] = await Promise.all([
      jget(`${TVMAZE}/shows?page=0`),
      jget(`${TVMAZE}/shows?page=1`),
    ]);
    return [...((p0 as any[]) ?? []), ...((p1 as any[]) ?? [])]
      .filter((s) => s?.image?.original || s?.image?.medium)
      .slice(0, 300);
  });
  return (out as any[]) ?? [];
}

// ==========================================================================
//  IMDb suggestion — pencarian judul + pemetaan → IMDb id (tanpa key)
// ==========================================================================

async function imdbSuggest(q: string): Promise<any[]> {
  const term = q.trim().toLowerCase();
  if (!term) return [];
  const first = encodeURIComponent(term[0] === "#" ? "t" : term[0]);
  const data = await jget(
    `https://v3.sg.media-imdb.com/suggestion/${first}/${encodeURIComponent(term)}.json`,
  );
  return (data?.d ?? []) as any[];
}

/** Normalisasi judul untuk perbandingan. */
function normTitle(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Sinopsis ringkas dari Wikipedia (id dulu, lalu en) — tanpa API key. */
async function wikiSummary(ctx: any, title: string): Promise<string> {
  if (!title.trim()) return "";
  const hit = (await cached(
    ctx,
    `films:wiki:${normTitle(title).slice(0, 60)}`,
    30 * 86400_000,
    async () => {
      const q = encodeURIComponent(title.trim().replace(/ /g, "_"));
      for (const host of ["id.wikipedia.org", "en.wikipedia.org"]) {
        const d = await jget(`https://${host}/api/rest_v1/page/summary/${q}`, 7000);
        const extract = String(d?.extract ?? "").trim();
        if (extract) return extract;
      }
      return "";
    },
  )) as string;
  return hit ?? "";
}

/** Predikat entry saran IMDb: benarkah film atau series? */
function isMovieHit(d: any): boolean {
  return d?.qid === "movie" || d?.qid === "tvMovie" || d?.q === "feature";
}
function isTvHit(d: any): boolean {
  return d?.qid === "tvSeries" || d?.qid === "tvMiniSeries" || d?.q === "tvSeries";
}

/** Cari IMDb id yang cocok dengan judul + tahun (movie/tvSeries saja). */
async function imdbIdFor(title: string, year?: string, tv = false): Promise<string | null> {
  const list = await imdbSuggest(title);
  const y = year ? Number(year) : undefined;
  const pool = list.filter((d) =>
    typeof d?.id === "string" &&
    d.id.startsWith("tt") &&
    (tv ? isTvHit(d) : isMovieHit(d)),
  );
  const match =
    (y ? pool.find((d) => Number(d.y) === y) : undefined) ??
    pool.find((d) => (d.l ?? "").toLowerCase() === title.toLowerCase()) ??
    pool[0];
  return match?.id ?? null;
}

// ==========================================================================
//  Actions
// ==========================================================================

/** Pencarian film/series. TMDb kalau ada key; kalau tidak: IMDb + lokal. */
export const search = action({
  args: {
    q: v.optional(v.string()),
    kind: v.optional(v.union(v.literal("movie"), v.literal("tv"))),
  },
  handler: async (ctx, { q, kind }) => {
    const k = kind ?? "movie";
    const term = (q ?? "").trim();

    // ---- Jalur TMDb (utama) ----
    if (process.env.TMDB_API_KEY) {
      const path = term ? `/search/${k}` : `/${k}/popular`;
      const data = await tmdb(path, term ? { query: term, include_adult: "false" } : {});
      const results = (data?.results ?? []) as any[];
      const cards = results.filter((r) => r.poster_path).map((r) => toCard(r, k));
      if (cards.length) return cards;
      if (term) return [];
      return FALLBACK;
    }

    // ---- Jalur tanpa key: series pakai TVmaze ----
    if (k === "tv") {
      if (term) {
        const res = await jget(`${TVMAZE}/search/shows?q=${encodeURIComponent(term)}`);
        const cards = ((res ?? []) as any[]).map((x) => tvCard(x.show)).filter((c) => c.title);
        if (cards.length) return cards;
      }
      const pages = await tvPages(ctx);
      const pool = term
        ? pages.filter((s) => (s.name ?? "").toLowerCase().includes(term.toLowerCase()))
        : pages;
      return pool.slice(0, 30).map(tvCard);
    }

    // ---- Jalur tanpa key: film (iTunes RSS + IMDb suggestion) ----
    // LAYAR AWAL HARUS MEMUNCUKAN SEMUA FILM: gabung feed populer + feed
    // beberapa genre (masing-masing 30 judul), dedupe, lalu tampilkan.
    const gids = RSS_GENRE_IDS;
    const feeds = await Promise.all(gids.map((g) => rssMovies(ctx, g)));
    const feedCards: ReturnType<typeof rssCard>[] = [];
    const seenFeed = new Set<string>();
    for (const entry of feeds.flat()) {
      const card = rssCard(entry);
      if (!card.title || seenFeed.has(card.id)) continue;
      seenFeed.add(card.id);
      feedCards.push(card);
    }
    if (term) {
      const local = feedCards.filter((c) =>
        c.title.toLowerCase().includes(term.toLowerCase()),
      );
      // Judul yang sudah ada di katalog lokal tidak diulang dari saran IMDb
      // (kartu lokal membawa sinopsis + genre lengkap).
      const localSeen = new Set(local.map((c) => normTitle(c.title)));
      const sug = (await imdbSuggest(term))
        .filter((d) => isMovieHit(d) && !localSeen.has(normTitle(String(d.l ?? ""))))
        .map((d) => ({
          id: d.id as string,
          title: d.l as string,
          image: (d.i?.imageUrl as string | undefined) ?? undefined,
          year: d.y ? String(d.y) : undefined,
          kind: "movie" as const,
        }));
      const seen = new Set<string>();
      const merged = [...local, ...sug].filter((c) =>
        seen.has(c.id) ? false : (seen.add(c.id), true),
      );
      return merged.slice(0, 30);
    }
    if (feedCards.length) return feedCards.slice(0, 60);
    return FALLBACK;
  },
});

/** Daftar genre untuk chip. */
export const genres = action({
  args: { kind: v.optional(v.union(v.literal("movie"), v.literal("tv"))) },
  handler: async (ctx, { kind }) => {
    const k = kind ?? "movie";
    if (process.env.TMDB_API_KEY) {
      const data = await tmdb(`/genre/${k}/list`);
      const list = (data?.genres ?? []) as any[];
      if (list.length) return list.map((g) => ({ id: String(g.id), name: g.name }));
    }
    if (k === "tv") {
      const pages = await tvPages(ctx);
      const set = new Set<string>();
      for (const s of pages) for (const g of (s.genres ?? []) as string[]) set.add(g);
      return [...set].sort().map((name) => ({ id: `g:${name}`, name }));
    }
    return MOVIE_GENRES;
  },
});

/** Film per genre (TMDb discover / iTunes genre feed / filter lokal). */
export const byGenre = action({
  args: { genreId: v.string(), kind: v.optional(v.union(v.literal("movie"), v.literal("tv"))) },
  handler: async (ctx, { genreId, kind }) => {
    const k = kind ?? "movie";
    if (process.env.TMDB_API_KEY) {
      const data = await tmdb(`/discover/${k}`, {
        with_genres: genreId,
        sort_by: "popularity.desc",
      });
      const results = (data?.results ?? []) as any[];
      const cards = results.filter((r) => r.poster_path).map((r) => toCard(r, k));
      if (cards.length) return cards;
    }
    if (k === "tv") {
      const name = genreId.startsWith("g:") ? genreId.slice(2) : genreId;
      const pages = await tvPages(ctx);
      return pages
        .filter((s) => ((s.genres ?? []) as string[]).includes(name))
        .slice(0, 30)
        .map(tvCard);
    }
    const feed = MOVIE_GENRES.some((g) => g.id === genreId)
      ? await rssMovies(ctx, genreId)
      : await rssMovies(ctx);
    const cards = feed.map(rssCard);
    return cards.length ? cards.slice(0, 30) : FALLBACK;
  },
});

export type FilmCast = { name: string; character?: string; image?: string };

export type FilmDetail = {
  id: string;
  title: string;
  image?: string;
  backdrop?: string;
  year?: string;
  rating?: number;
  kind: "movie" | "tv";
  synopsis: string;
  genres: { id: string; name: string }[];
  runtime?: number;
  tagline?: string;
  director?: string;
  cast: string[];
  castFull: FilmCast[];
  seasons?: number;
  episodes?: number;
  trailer?: string;
  similar: FilmCard[];
};

/** Detail film/series lengkap: sinopsis, genre, pemeran, trailer, mirip. */
export const detail = action({
  args: { id: v.string(), kind: v.optional(v.union(v.literal("movie"), v.literal("tv"))) },
  handler: async (ctx, { id, kind }) => {
    const k = kind ?? "movie";

    // ---- Jalur TMDb (utama) ----
    if (process.env.TMDB_API_KEY) {
      const d = await tmdb(`/${k}/${id}`, {
        append_to_response: "credits,videos,similar",
      });
      if (d) {
        const runtime = k === "movie" ? d.runtime : (d.episode_run_time?.[0] as number | undefined);
        const castFull = ((d.credits?.cast ?? []) as any[]).slice(0, 12).map((c) => ({
          name: c.name as string,
          character: c.character as string | undefined,
          image: poster(c.profile_path),
        }));
        const videos = (d.videos?.results ?? []) as any[];
        const trailer = videos.find(
          (v: any) => v.site === "YouTube" && (v.type === "Trailer" || v.type === "Teaser"),
        );
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
          cast: castFull.map((c) => c.name),
          castFull,
          seasons: k === "tv" ? (d.number_of_seasons as number | undefined) : undefined,
          episodes: k === "tv" ? (d.number_of_episodes as number | undefined) : undefined,
          trailer: trailer?.key as string | undefined,
          similar: ((d.similar?.results ?? []) as any[])
            .filter((r: any) => r.poster_path)
            .slice(0, 6)
            .map((r: any) => toCard(r, k)),
        } satisfies FilmDetail;
      }
    }

    // ---- Jalur tanpa key: series TVmaze ----
    if (k === "tv") {
      const rawId = id.startsWith("tv") ? id.slice(2) : id;
      const s = await jget(`${TVMAZE}/shows/${rawId}`);
      if (s) {
        const [castRes, recRes] = await Promise.all([
          jget(`${TVMAZE}/shows/${rawId}/cast`),
          jget(`${TVMAZE}/shows/${rawId}/recommendations`),
        ]);
        const castFull = ((castRes ?? []) as any[]).slice(0, 12).map((c) => ({
          name: c.person?.name ?? "—",
          character: c.character?.name ?? undefined,
          image: c.person?.image?.original ?? undefined,
        }));
        return {
          id,
          title: s.name ?? "Tanpa judul",
          image: s.image?.original ?? undefined,
          backdrop: s.image?.original ?? undefined,
          year: String(s.premiered ?? "").slice(0, 4) || undefined,
          rating: s.rating?.average ? Number(s.rating.average) : undefined,
          kind: "tv",
          synopsis: stripHtml(s.summary ?? ""),
          genres: ((s.genres ?? []) as string[]).map((g) => ({ id: `g:${g}`, name: g })),
          runtime: typeof s.averageRuntime === "number" ? s.averageRuntime : undefined,
          tagline: undefined,
          director: undefined,
          cast: castFull.map((c) => c.name),
          castFull,
          seasons: (s._embedded?.seasons as number[] | undefined)?.length ??
            (s.number_of_seasons as number | undefined),
          episodes: undefined,
          trailer: undefined,
          similar: ((recRes ?? []) as any[]).slice(0, 6).map(tvCard),
        } satisfies FilmDetail;
      }
    }

    // ---- Jalur tanpa key: film dari katalog iTunes / daftar statis ----
    if (id.startsWith("it")) {
      const gids = RSS_GENRE_IDS;
      const feeds = await Promise.all(gids.map((g) => rssMovies(ctx, g)));
      const feed = feeds.flat();
      const entry = feed.find(
        (e) => `it${e?.id?.attributes?.["im:id"] ?? ""}` === id,
      );
      if (entry) {
        const card = rssCard(entry);
        const tt = await imdbIdFor(card.title, card.year);
        const suggest = tt ? await imdbSuggest(card.title) : [];
        const hit = suggest.find((d) => d.id === tt);
        const cast = String(hit?.s ?? "")
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean);
        const sameGenre = feed
          .map(rssCard)
          .filter((c) => c.id !== id && c.genre === card.genre)
          .slice(0, 6);
        return {
          id,
          title: card.title,
          image: card.image,
          backdrop: card.image,
          year: card.year,
          rating: undefined,
          kind: "movie",
          synopsis: card.synopsis ?? "",
          genres: card.genre
            ? [{ id: "g", name: card.genre }]
            : [],
          runtime: undefined,
          tagline: undefined,
          director: card.director,
          cast,
          castFull: cast.map((name) => ({ name })),
          trailer: undefined,
          similar: sameGenre.length ? sameGenre : FALLBACK.filter((f) => f.id !== id),
        } satisfies FilmDetail;
      }
    }

    // ---- Jaring pengaman: daftar statis dengan sinopsis ----
    // (untuk id yang tidak dikenal, coba dulu sinopsis Wikipedia per judul)
    if (id.startsWith("tt")) {
      const list = await imdbSuggest(id);
      const hit = list.find((d) => d.id === id);
      if (hit) {
        const title = String(hit.l ?? "Tanpa judul");
        const cast = String(hit.s ?? "")
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean);
        const synopsis = await wikiSummary(ctx, title);
        // Padankan dengan katalog RSS agar genre/sutradara ikut terisi.
        const gids = RSS_GENRE_IDS;
        const feeds = await Promise.all(gids.map((g) => rssMovies(ctx, g)));
        const entry = feeds
          .flat()
          .find((e) => normTitle(rssCard(e).title) === normTitle(title));
        const localCard = entry ? rssCard(entry) : null;
        return {
          id,
          title,
          image: (hit.i?.imageUrl as string | undefined) ?? localCard?.image,
          backdrop: (hit.i?.imageUrl as string | undefined) ?? localCard?.image,
          year: hit.y ? String(hit.y) : undefined,
          rating: undefined,
          kind: k,
          synopsis: localCard?.synopsis || synopsis,
          genres: localCard?.genre ? [{ id: "g", name: localCard.genre }] : [],
          runtime: undefined,
          tagline: undefined,
          director: localCard?.director,
          cast,
          castFull: cast.map((name) => ({ name })),
          trailer: undefined,
          similar: [],
        } satisfies FilmDetail;
      }
    }

    const f = FALLBACK.find((x) => x.id === id) ?? FALLBACK[0];
    const extra = FALLBACK_DETAIL[f.id] ?? {};
    return {
      id: f.id,
      title: f.title,
      image: f.image,
      backdrop: f.image,
      year: f.year,
      rating: f.rating,
      kind: k,
      synopsis: extra.synopsis ?? "",
      genres: extra.genres ?? [],
      runtime: extra.runtime,
      tagline: extra.tagline,
      director: extra.director,
      cast: extra.cast ?? [],
      castFull: (extra.cast ?? []).map((name: string) => ({ name })),
      trailer: undefined,
      similar: FALLBACK.filter((x) => x.id !== f.id),
    } satisfies FilmDetail;
  },
});

export type FilmSource = { label: string; url: string; type: "embed" | "hls" | "mp4" };

/**
 * Resolver stream film — VidSrc / 2Embed menerima id TMDB MAUPUN id IMDb
 * (format tt…). Untuk kartu iTunes (prefiks it) kita petakan dulu ke IMDb id
 * lewat saran IMDb, sehingga pemutar tetap menemukan film yang benar.
 */
export const resolveStream = action({
  args: {
    id: v.string(),
    kind: v.optional(v.union(v.literal("movie"), v.literal("tv"))),
    season: v.optional(v.number()),
    episode: v.optional(v.number()),
  },
  handler: async (ctx, { id, kind, season, episode }) => {
    const k = kind ?? "movie";
    let extId = id;
    let appleMode = false;

    if (id.startsWith("it")) {
      appleMode = true;
      // Petakan judul Apple → IMDb id (cache per id supaya tidak berulang).
      const tt = (await cached(
        ctx,
        `films:ext:${id}`,
        7 * 86400_000,
        async () => {
          const gids = RSS_GENRE_IDS;
          const feeds = await Promise.all(gids.map((g) => rssMovies(ctx, g)));
          const entry = feeds
            .flat()
            .find((e) => `it${e?.id?.attributes?.["im:id"] ?? ""}` === id);
          if (!entry) return null;
          const card = rssCard(entry);
          return await imdbIdFor(card.title, card.year, false);
        },
      )) as string | null;
      if (tt) extId = tt;
    } else if (id.startsWith("tv")) {
      // Series TVmaze → id eksternal (IMDb/TMDb) dari TVmaze.
      const show = (await cached(
        ctx,
        `films:ext:${id}`,
        7 * 86400_000,
        async () => {
          const s = await jget(`${TVMAZE}/shows/${id.slice(2)}`);
          return (s?.externals ?? {}) as Record<string, string>;
        },
      )) as Record<string, string> | null;
      const ext = show?.imdb ?? show?.thetvdb;
      if (ext) extId = ext;
    }

    const sources: FilmSource[] = [];

    const vidsrc =
      k === "tv"
        ? `https://vidsrc.to/embed/tv/${extId}/${season ?? 1}/${episode ?? 1}`
        : `https://vidsrc.to/embed/movie/${extId}`;
    sources.push({ label: "VidSrc HD", url: vidsrc, type: "embed" });

    const vidsrcPro =
      k === "tv"
        ? `https://vidsrc.pro/embed/tv/${extId}/${season ?? 1}/${episode ?? 1}`
        : `https://vidsrc.pro/embed/movie/${extId}`;
    sources.push({ label: "VidSrc Pro", url: vidsrcPro, type: "embed" });

    const twoEmbed =
      k === "tv"
        ? `https://www.2embed.cc/embedtv/${extId}&s=${season ?? 1}&e=${episode ?? 1}`
        : `https://www.2embed.cc/embed/${extId}`;
    sources.push({ label: "2Embed", url: twoEmbed, type: "embed" });

    // Coba resolve link langsung hanya untuk id TMDB numerik.
    if (!appleMode && /^\d+$/.test(extId)) {
      const direct = await tryDirect(extId, k, season, episode);
      if (direct) sources.unshift(direct);
    }

    return { sources, resolvedId: extId };
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
