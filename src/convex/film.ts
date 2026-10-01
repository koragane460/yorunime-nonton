"use node";
/**
 * Katalog Film YoruNime.
 *
 * Dua sumber, dipilih otomatis:
 * 1. API LK21 tidak resmi yang di-host sendiri. Yang kompatibel:
 *    - github.com/febriadj/lk21-api   (Node/Express, /movies, /search/:title)
 *    - github.com/KenXinDev/lk21-unofficial-api
 *    Alamatnya diambil dari env FILM_API_BASE. Bentuk respons keduanya
 *    berbeda, jadi hasilnya dibaca secara defensif.
 * 2. TMDB (api.themoviedb.org) sebagai sumber metadata + trailer resmi.
 *    Butuh env TMDB_API_KEY. Kalau diisi, sinopsis dan judulnya memakai
 *    bahasa Indonesia (id-ID) dan region ID.
 *
 * Kalau tidak ada env yang terisi, endpoint mengembalikan kosong dan
 * antarmuka menampilkan Breed penanda, bukan data karangan.
 */
import { v } from "convex/values";
import { action } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api } from "./_generated/api";

const TTL = 30 * 60 * 1000;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

function lk21Base(): string | null {
  const raw =
    process.env.FILM_API_BASE ??
    process.env.LK21_API_BASE ??
    process.env.FILM_API_URL ??
    "";
  const b = raw.trim().replace(/\/+$/, "");
  return /^https?:\/\//i.test(b) ? b : null;
}

function tmdbKey(): string | null {
  const k = (process.env.TMDB_API_KEY ?? "").trim();
  return k.length > 0 ? k : null;
}

/** Sumber yang benar-benar terpasang. */
export const filmSources = action({
  args: {},
  handler: async (): Promise<{ lk21: boolean; tmdb: boolean }> => {
    return { lk21: lk21Base() !== null, tmdb: tmdbKey() !== null };
  },
});

async function fetchText(url: string, timeoutMs = 15_000): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": UA },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function fetchJson(url: string, timeoutMs = 15_000): Promise<any | null> {
  const t = await fetchText(url, timeoutMs);
  if (!t) return null;
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

// ------------------------------------------------------------- bentuk ----

export type FilmItem = {
  id: string;
  title: string;
  poster: string;
  backdrop?: string;
  description?: string;
  year?: string;
  rating?: string;
  genre?: string;
  duration?: string;
  /** URL yang bisa dimuat di <video> atau <iframe>. */
  video?: string;
  /** Trailer resmi YouTube (TMDB). */
  trailer?: string;
};

function pickList(json: any): any[] {
  if (!json) return [];
  if (Array.isArray(json)) return json;
  for (const k of ["data", "movies", "results", "items", "film", "list"]) {
    const v = json[k];
    if (Array.isArray(v)) return v;
    if (v && typeof v === "object") {
      for (const k2 of ["movies", "results", "items", "data"]) {
        if (Array.isArray(v[k2])) return v[k2];
      }
    }
  }
  return [];
}

function shapeLk(raw: any): FilmItem | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw.movie ?? raw.film ?? raw.data ?? raw;
  if (m && typeof m === "object" && !Array.isArray(m) && (m.title || m.name)) {
    const inner = m;
    const id = String(inner.id ?? inner.movieId ?? inner.slug ?? inner.code ?? "");
    const title = String(inner.title ?? inner.name ?? "");
    if (id && title)
      return {
        id,
        title,
        poster: String(inner.poster ?? inner.thumbnail ?? inner.image ?? inner.img ?? ""),
        backdrop: inner.backdrop ? String(inner.backdrop) : undefined,
        description: inner.description ? String(inner.description) : undefined,
        year: inner.year ? String(inner.year) : undefined,
        rating: inner.rating ? String(inner.rating) : undefined,
        genre: Array.isArray(inner.genres)
          ? inner.genres
              .map((g: any) => (typeof g === "string" ? g : g?.name ?? g?.genreName ?? ""))
              .filter(Boolean)
              .join(", ")
          : inner.genre
            ? String(inner.genre)
            : undefined,
        duration: inner.duration ? String(inner.duration) : undefined,
        video: inner.video || inner.streamUrl || inner.embedUrl || inner.url
          ? String(inner.video ?? inner.streamUrl ?? inner.embedUrl ?? inner.url)
          : undefined,
      };
  }
  return null;
}

function shapeTmdb(raw: any): FilmItem | null {
  if (!raw) return null;
  const id = String(raw.id ?? "");
  const title = raw.title ?? raw.original_title ?? "";
  if (!id || !title) return null;
  return {
    id: `tmdb-${id}`,
    title: String(title),
    poster: raw.poster_path
      ? `https://image.tmdb.org/t/p/w500${raw.poster_path}`
      : "",
    backdrop: raw.backdrop_path
      ? `https://image.tmdb.org/t/p/w1280${raw.backdrop_path}`
      : undefined,
    description: raw.overview || undefined,
    year: raw.release_date ? String(raw.release_date).slice(0, 4) : undefined,
    rating: raw.vote_average ? String(raw.vote_average.toFixed(1)) : undefined,
    genre: Array.isArray(raw.genres)
      ? raw.genres.map((g: any) => (typeof g === "string" ? g : g?.name ?? "")).join(", ")
      : undefined,
    duration: raw.runtime ? `${raw.runtime} menit` : undefined,
    trailer: raw.trailerKey ? `https://www.youtube-nocookie.com/embed/${raw.trailerKey}` : undefined,
  };
}

// --------------------------------------------------------------- cache ----

const memo = new Map<string, { at: number; value: unknown }>();
async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value as T;
  const value = await fn();
  memo.set(key, { at: Date.now(), value });
  return value;
}

// -------------------------------------------------------------- lk21 ----

async function lkList(path: string): Promise<FilmItem[]> {
  const base = lk21Base();
  if (!base) return [];
  const json = await fetchJson(`${base}${path}`);
  return pickList(json)
    .map(shapeLk)
    .filter((f): f is FilmItem => !!f && !!f.title);
}

async function lkDetail(id: string): Promise<FilmItem | null> {
  const base = lk21Base();
  if (!base) return null;
  const enc = encodeURIComponent(id);
  const json =
    (await fetchJson(`${base}/movies/${enc}`)) ??
    (await fetchJson(`${base}/movie/${enc}`)) ??
    (await fetchJson(`${base}/detail/${enc}`));
  return shapeLk(json);
}

// -------------------------------------------------------------- tmdb ----

const TMDB = "https://api.themoviedb.org/3";

async function tmdbList(path: string): Promise<FilmItem[]> {
  const key = tmdbKey();
  if (!key) return [];
  const sep = path.includes("?") ? "&" : "?";
  const json = await fetchJson(
    `${TMDB}${path}${sep}language=id-ID&region=ID&api_key=${key}`,
  );
  return pickList(json)
    .map(shapeTmdb)
    .filter((f): f is FilmItem => !!f && !!f.poster);
}

/** Trailer resmi (YouTube) untuk satu film TMDB. */
async function tmdbTrailer(id: number): Promise<string | undefined> {
  const key = tmdbKey();
  if (!key) return undefined;
  const json = await fetchJson(
    `${TMDB}/movie/${id}/videos?language=id-ID&api_key=${key}`,
  );
  const list = pickList(json.results);
  const yt =
    list.find((v: any) => v.site === "YouTube" && v.type === "Trailer") ??
    list.find((v: any) => v.site === "YouTube");
  return yt?.key ? String(yt.key) : undefined;
}

// -------------------------------------------------------------- akses ----

/**
 * Status Film untuk user yang sedang login.
 * - configured: ada sumber film yang terpasang
 * - allowed: punya izin akses. Developer selalu boleh, supaya menunya
 *   tetap kelihatan walau sumber belum dipasang.
 */
export const filmAccess = action({
  args: {},
  handler: async (ctx): Promise<{ configured: boolean; allowed: boolean }> => {
    const configured = lk21Base() !== null || tmdbKey() !== null;
    const userId = await getAuthUserId(ctx);
    if (userId === null) return { configured, allowed: false };
    const me: any = await ctx.runQuery(api.users.currentUser, {});
    if (!me) return { configured, allowed: false };
    const isDev =
      me.role === "admin" ||
      me.staffRole === "dev" ||
      me.staffRole === "creator" ||
      (me.seqId === 1 && !me.staffRole);
    return { configured, allowed: isDev || me.filmAccess === true };
  },
});

// ------------------------------------------------------------- actions ---

/** Film terbaru / populer. Digabung dari semua sumber yang terpasang. */
export const films = action({
  args: { kind: v.optional(v.union(v.literal("recent"), v.literal("popular"))) },
  handler: async (ctx, { kind }): Promise<FilmItem[]> =>
    cached(`films:${kind ?? "recent"}`, async () => {
      const [lk, tm] = await Promise.all([
        lkList(kind === "popular" ? "/popular/movies" : "/movies"),
        tmdbList(kind === "popular" ? "/movie/popular" : "/movie/now_playing"),
      ]);
      const seen = new Set<string>();
      const out: FilmItem[] = [];
      // LK21 dulu karena film-nya subtitle Indonesia.
      for (const f of [...lk, ...tm]) {
        const key = f.title.toLowerCase().slice(0, 40);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(f);
      }
      return out;
    }),
});

/** Pencarian judul film. */
export const searchFilms = action({
  args: { q: v.string() },
  handler: async (ctx, { q }): Promise<FilmItem[]> => {
    const term = q.trim();
    if (term.length < 2) return [];
    return cached(`search:${term.toLowerCase()}`, async () => {
      const base = lk21Base();
      const key = tmdbKey();
      const [lk, tm] = await Promise.all([
        base
          ? fetchJson(`${base}/search/${encodeURIComponent(term)}`).then((j) =>
              pickList(j)
                .map(shapeLk)
                .filter((f): f is FilmItem => !!f && !!f.title),
            )
          : Promise.resolve([] as FilmItem[]),
        key
          ? tmdbList(
              `/search/movie?query=${encodeURIComponent(term)}&include_adult=false`,
            )
          : Promise.resolve([] as FilmItem[]),
      ]);
      const seen = new Set<string>();
      const out: FilmItem[] = [];
      for (const f of [...lk, ...tm]) {
        const k = f.title.toLowerCase().slice(0, 40);
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(f);
      }
      return out.slice(0, 24);
    });
  },
});

/** Detail satu film, termasuk URL tayang atau trailer resminya. */
export const filmDetail = action({
  args: { id: v.string() },
  handler: async (ctx, { id }): Promise<FilmItem | null> =>
    cached(`film:${id}`, async () => {
      if (id.startsWith("tmdb-")) {
        const num = Number(id.slice(5));
        if (!Number.isFinite(num)) return null;
        const key = tmdbKey();
        if (!key) return null;
        const json = await fetchJson(
          `${TMDB}/movie/${num}?append_to_response=videos&language=id-ID&api_key=${key}`,
        );
        const base = shapeTmdb(json);
        if (!base) return null;
        const vids = pickList(json?.videos?.results);
        const yt =
          vids.find((v: any) => v.site === "YouTube" && v.type === "Trailer") ??
          vids.find((v: any) => v.site === "YouTube");
        return yt?.key ? { ...base, trailer: `https://www.youtube-nocookie.com/embed/${yt.key}` } : base;
      }
      const d = await lkDetail(id);
      if (d) return d;
      const trailer = await cached(`tmdb-trailer:${id}`, () => tmdbTrailer(Number(id)));
      return trailer ? { id, title: "Film", poster: "", trailer } : null;
    }),
});