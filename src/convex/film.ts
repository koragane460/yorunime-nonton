"use node";
/**
 * Katalog Film untuk YoruNime.
 *
 * Sumber: API LK21 pihak ketiga (github.com/febriadj/lk21-api) yang mengambil
 * data film subtitle Bahasa Indonesia. API itu wajib di-host sendiri,
 * jadi alamatnya diambil dari env FILM_API_BASE. Kalau env belum diisi,
 * semua endpoint mengembalikan kosong dan tombol Film tidak muncul sama
 * sekali — tidak ada sumber yang dikarang.
 */
import { v } from "convex/values";
import { action } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api } from "./_generated/api";

const TTL = 30 * 60 * 1000;

/** Base URL API film. Env ini diisi lewat tab Keys/API keys di dashboard. */
function base(): string | null {
  const raw =
    process.env.FILM_API_BASE ??
    process.env.LK21_API_BASE ??
    process.env.FILM_API_URL ??
    "";
  const b = raw.trim().replace(/\/+$/, "");
  return /^https?:\/\//i.test(b) ? b : null;
}

async function get(path: string, timeoutMs = 12_000): Promise<any | null> {
  const b = base();
  if (!b) return null;
  try {
    const res = await fetch(`${b}${path}`, {
      headers: { Accept: "application/json", "User-Agent": "YoruNime/1.0" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Cache in-memory per instance: film tidak perlu cache database. */
const memo = new Map<string, { at: number; value: unknown }>();
async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value as T;
  const value = await fn();
  memo.set(key, { at: Date.now(), value });
  return value;
}

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
  video?: string;
};

/** Bentuk respons lk21-api bisa berbeda versi, jadi dibaca defensif. */
function shapeFilm(raw: any): FilmItem | null {
  if (!raw) return null;
  const m = raw.movie ?? raw.data ?? raw;
  const id = String(m.id ?? m.movieId ?? m.slug ?? "");
  const title = String(m.title ?? m.name ?? "");
  if (!id || !title) return null;
  return {
    id,
    title,
    poster: String(m.poster ?? m.thumbnail ?? m.image ?? ""),
    backdrop: m.backdrop ? String(m.backdrop) : undefined,
    description: m.description ? String(m.description) : undefined,
    year: m.year ? String(m.year) : undefined,
    rating: m.rating ? String(m.rating) : undefined,
    genre: Array.isArray(m.genres)
      ? m.genres.map((g: any) => (typeof g === "string" ? g : g?.name ?? "")).join(", ")
      : m.genre
        ? String(m.genre)
        : undefined,
    duration: m.duration ? String(m.duration) : undefined,
    video: m.video ?? m.streamUrl ?? m.trailer ? String(m.video ?? m.streamUrl ?? m.trailer) : undefined,
  };
}

/**
 * Status Film untuk user yang sedang login.
 * - configured: sumber film sudah dikonfigurasi (FILM_API_BASE terisi)
 * - allowed: punya izin akses Film. Developer selalu boleh, bahkan kalau
 *   sumber belum dikonfigurasi, supaya menunya tetap kelihatan dan bisa
 *   dipakai setelah sumber dipasang.
 */
export const filmAccess = action({
  args: {},
  handler: async (
    ctx,
  ): Promise<{ configured: boolean; allowed: boolean }> => {
    const configured = base() !== null;
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

/** Film terbaru / populer. Kosong kalau API belum dikonfigurasi. */
export const films = action({
  args: { kind: v.optional(v.union(v.literal("recent"), v.literal("popular"))) },
  handler: async (ctx, { kind }) => {
    const path = kind === "popular" ? "/popular/movies" : "/movies";
    const json = await cached(`films:${kind ?? "recent"}`, () => get(path));
    const list: any[] = json?.data ?? json?.movies ?? [];
    return list.map(shapeFilm).filter((f): f is FilmItem => !!f);
  },
});

/** Pencarian judul film. */
export const searchFilms = action({
  args: { q: v.string() },
  handler: async (ctx, { q }) => {
    const term = q.trim();
    if (term.length < 2) return [];
    const json = await get(`/search/${encodeURIComponent(term)}`);
    const list: any[] = json?.data ?? json?.movies ?? [];
    return list.map(shapeFilm).filter((f): f is FilmItem => !!f);
  },
});

/** Detail satu film, termasuk URL tayangnya. */
export const filmDetail = action({
  args: { id: v.string() },
  handler: async (ctx, { id }) => {
    const json = await cached(`film:${id}`, () =>
      get(`/movies/${encodeURIComponent(id)}`),
    );
    return shapeFilm(json?.data ?? json?.movie ?? json);
  },
});