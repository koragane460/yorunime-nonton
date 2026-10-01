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
    process.env.LK21_API_URL ??
    process.env.MOVIE_API_BASE ??
    "";
  const b = raw.trim().replace(/\/+$/, "");
  return /^https?:\/\//i.test(b) ? b : null;
}

/** TMDB punya dua jenis key: API Key v3 (hex) dan Read Access Token v4. */
function tmdbKey(): { key: string; v4: boolean } | null {
  const token = (process.env.TMDB_READ_TOKEN ?? process.env.TMDB_ACCESS_TOKEN ?? "").trim();
  if (token) return { key: token, v4: true };
  const k = (process.env.TMDB_API_KEY ?? process.env.TMDB_KEY ?? "").trim();
  return k ? { key: k, v4: false } : null;
}

/** Susun URL TMDB dengan api_key v3 atau Bearer token v4. */
function tmdbUrl(path: string, extra: Record<string, string> = {}): string | null {
  const cred = tmdbKey();
  if (!cred) return null;
  const params = new URLSearchParams({
    language: "id-ID",
    region: "ID",
    ...extra,
  });
  const sep = path.includes("?") ? "&" : "?";
  return cred.v4
    ? `${TMDB}${path}${sep}${params.toString()}`
    : `${TMDB}${path}${sep}${params.toString()}&api_key=${encodeURIComponent(cred.key)}`;
}

async function tmdbGet(path: string): Promise<any | null> {
  const cred = tmdbKey();
  if (!cred) return null;
  const params = new URLSearchParams({ language: "id-ID", region: "ID" });
  const sep = path.includes("?") ? "&" : "?";
  const url = cred.v4
    ? `${TMDB}${path}${sep}${params.toString()}`
    : `${TMDB}${path}${sep}${params.toString()}&api_key=${encodeURIComponent(cred.key)}`;
  const json = await fetchJson(url);
  return json;
}

/** Nama env yang Dipakai, untuk diagnostik di panel developer. */
const ENV_NAMES = [
  "FILM_API_BASE",
  "LK21_API_BASE",
  "FILM_API_URL",
  "LK21_API_URL",
  "MOVIE_API_BASE",
  "TMDB_API_KEY",
  "TMDB_KEY",
  "TMDB_READ_TOKEN",
  "TMDB_ACCESS_TOKEN",
] as const;

function envReport(): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const n of ENV_NAMES) {
    out[n] = (process.env[n] ?? "").trim().length > 0;
  }
  return out;
}

/** Sumber yang benar-benar terpasang. */
export const filmSources = action({
  args: {},
  handler: async (): Promise<{
    lk21: boolean;
    tmdb: boolean;
    env: Record<string, boolean>;
  }> => {
    return { lk21: lk21Base() !== null, tmdb: tmdbKey() !== null, env: envReport() };
  },
});

/**
 * Diagnostik untuk developer: cek env mana yang terbaca dan coba panggil
 * sumbernya, supaya tidak menebak-nebak nama variabel.
 */
export const filmDiag = action({
  args: {},
  handler: async (): Promise<{
    env: Record<string, boolean>;
    lk21Url: string | null;
    tmdbSample: { ok: boolean; count: number; error: string | null };
    lk21Sample: { ok: boolean; count: number; error: string | null };
  }> => {
    const lk = lk21Base();
    let tm: { ok: boolean; count: number; error: string | null } = {
      ok: false,
      count: 0,
      error: null,
    };
    if (tmdbKey()) {
      try {
        const j = await fetchJson(tmdbUrl("/movie/popular") ?? "");
        const list = pickList(j);
        tm = {
          ok: !!j && !j.status_message && !j.status_code,
          count: list.length,
          error:
            j?.status_message ??
            (j?.status_code ? `HTTP ${j.status_code}` : null),
        };
      } catch (e) {
        tm = { ok: false, count: 0, error: e instanceof Error ? e.message : "gagal" };
      }
    }
    let lkS: { ok: boolean; count: number; error: string | null } = {
      ok: false,
      count: 0,
      error: null,
    };
    if (lk) {
      try {
        const j = await fetchJson(`${lk}/movies`);
        lkS = { ok: !!j, count: pickList(j).length, error: null };
      } catch (e) {
        lkS = { ok: false, count: 0, error: e instanceof Error ? e.message : "gagal" };
      }
    }
    return {
      env: envReport(),
      lk21Url: lk,
      tmdbSample: tm,
      lk21Sample: lkS,
    };
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

/**
 * Bentuk data film. `febriadj/lk21-api` memakai nama field `_id`,
 * `posterImg`, `type`, `qualityResolution`, `synopsis`, `releaseDate`,
 * dan `trailerUrl` — bukan `id`/`poster`/`description` seperti API lain.
 * Semua alias itu ditangani di sini.
 */
function shapeLk(raw: any): FilmItem | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw.movie ?? raw.film ?? raw.data ?? raw;
  if (!m || typeof m !== "object" || Array.isArray(m)) return null;
  const title = String(m.title ?? m.name ?? "");
  const id = String(m._id ?? m.id ?? m.movieId ?? m.slug ?? m.code ?? "");
  if (!id || !title) return null;
  const poster = String(m.posterImg ?? m.poster ?? m.thumbnail ?? m.image ?? m.img ?? "");
  const release = m.releaseDate ? String(m.releaseDate) : undefined;
  return {
    id,
    title,
    poster,
    backdrop: m.backdrop ? String(m.backdrop) : undefined,
    description: m.synopsis ?? m.description
      ? String(m.synopsis ?? m.description)
      : undefined,
    year: m.year ? String(m.year) : release ? release.slice(0, 4) : undefined,
    rating: m.rating ? String(m.rating) : undefined,
    genre: Array.isArray(m.genres)
      ? m.genres
          .map((g: any) => (typeof g === "string" ? g : g?.name ?? g?.genreName ?? ""))
          .filter(Boolean)
          .join(", ")
      : m.genre
        ? String(m.genre)
        : undefined,
    duration: m.duration ? String(m.duration) : undefined,
    trailer: m.trailerUrl ? String(m.trailerUrl) : undefined,
  };
}

/** Sumber streaming film: API LK21 memisahkannya di endpoint /streams. */
export type FilmSource = { provider: string; url: string; resolutions: string[] };

function shapeSources(raw: any): FilmSource[] {
  const list = Array.isArray(raw) ? raw : pickList(raw);
  const out: FilmSource[] = [];
  for (const s of list) {
    const url = s?.url ?? s?.link ?? s?.embedUrl ?? s?.file;
    if (typeof url !== "string" || !url) continue;
    out.push({
      provider: String(s?.provider ?? s?.name ?? "Server"),
      url,
      resolutions: Array.isArray(s?.resolutions)
        ? s.resolutions.map((r: any) => String(r))
        : [],
    });
  }
  return out;
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

/** Daftar server streaming untuk satu film (sub Indo). */
async function lkSources(id: string): Promise<FilmSource[]> {
  const base = lk21Base();
  if (!base) return [];
  const enc = encodeURIComponent(id);
  const json =
    (await fetchJson(`${base}/movies/${enc}/streams`)) ??
    (await fetchJson(`${base}/movies/${enc}/sources`)) ??
    (await fetchJson(`${base}/streams/${enc}`));
  return shapeSources(json);
}

// -------------------------------------------------------------- tmdb ----

const TMDB = "https://api.themoviedb.org/3";

async function tmdbList(path: string): Promise<FilmItem[]> {
  const json = await tmdbGet(path);
  return pickList(json)
    .map(shapeTmdb)
    .filter((f): f is FilmItem => !!f && !!f.poster);
}

/** Trailer resmi (YouTube) untuk satu film TMDB. */
async function tmdbTrailer(id: number): Promise<string | undefined> {
  const json = await tmdbGet(`/movie/${id}/videos`);
  const list = pickList(json?.results);
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
      const [lk, tm] = await Promise.all([
        base
          ? fetchJson(`${base}/search/${encodeURIComponent(term)}`).then((j) =>
              pickList(j)
                .map(shapeLk)
                .filter((f): f is FilmItem => !!f && !!f.title),
            )
          : Promise.resolve([] as FilmItem[]),
        tmdbList(
          `/search/movie?query=${encodeURIComponent(term)}&include_adult=false`,
        ),
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
        const json = await tmdbGet(`/movie/${num}?append_to_response=videos`);
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

/**
 * Server streaming untuk satu film. Film dari API LK21 memakai ini; kalau
 * kosong, film tersebut belum punya sumber yang bisa dimuat.
 */
export const filmSourcesFor = action({
  args: { id: v.string() },
  handler: async (ctx, { id }): Promise<FilmSource[]> =>
    cached(`sources:${id}`, () => lkSources(id)),
});