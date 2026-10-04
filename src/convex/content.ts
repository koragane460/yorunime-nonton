// YoruNime — tools konten untuk developer.
//
// Dua kemampuan yang dipakai developer lewat panel Akun:
//   1. Sinopsis manual: kalau sinopsis dari sumber kosong, salah, atau
//      terlalu pendek, developer bisa menimpanya sendiri untuk anime (kunci
//      = MAL id) maupun donghua (kunci = slug Sanka).
//   2. Anime tambahan: judul yang belum ada di katalog bisa ditambahkan.
//      Episode TIDAK dikarang — slug sumber disimpan, dan daftar episode
//      diambil real-time dari sumber aslinya setiap kali detail dibuka,
//      sehingga episode yang muncul benar-benar ada (dan ikut bertambah
//      kalau sumber menambah episode baru).
//
// Semua mutasi di file ini hanya untuk developer; query publik hanya
// membaca.
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { action, mutation, query } from "./_generated/server";

const KINDS = ["anime", "donghua"] as const;
export type OverrideKind = (typeof KINDS)[number];

/** Hanya developer (role "dev" atau akun #1) yang boleh menulis konten. */
async function requireDev(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error("Not signed in");
  const me = await ctx.db.get(userId);
  if (!me) throw new Error("Not signed in");
  const isDev =
    String(me.role ?? "").toLowerCase() === "dev" || Number(me.seqId ?? 0) === 1;
  if (!isDev) throw new ConvexError("Hanya developer");
  return userId;
}

const norm = (s: unknown, max: number) =>
  String(s ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

/* --------------------------------------------------- sinopsis manual ---- */

export const setSynopsis = mutation({
  args: {
    key: v.string(),
    kind: v.union(v.literal("anime"), v.literal("donghua")),
    synopsis: v.string(),
  },
  handler: async (ctx, { key, kind, synopsis }) => {
    const userId = await requireDev(ctx);
    const k = norm(key, 120);
    const text = String(synopsis ?? "")
      .replace(/\r/g, "")
      .trim()
      .slice(0, 2000);
    if (!k) throw new ConvexError("Konten anime/donghua wajib diisi");
    if (text.length < 10)
      throw new ConvexError("Sinopsis terlalu pendek (minimal 10 karakter)");
    const existing = await ctx.db
      .query("contentOverrides")
      .withIndex("key_kind", (q) => q.eq("key", k).eq("kind", kind))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        synopsis: text,
        updatedAt: Date.now(),
        updatedBy: userId,
      });
    } else {
      await ctx.db.insert("contentOverrides", {
        key: k,
        kind,
        synopsis: text,
        updatedAt: Date.now(),
        updatedBy: userId,
      });
    }
    return { ok: true };
  },
});

export const clearSynopsis = mutation({
  args: { key: v.string(), kind: v.union(v.literal("anime"), v.literal("donghua")) },
  handler: async (ctx, { key, kind }) => {
    await requireDev(ctx);
    const k = norm(key, 120);
    const existing = await ctx.db
      .query("contentOverrides")
      .withIndex("key_kind", (q) => q.eq("key", k).eq("kind", kind))
      .first();
    if (existing) await ctx.db.delete(existing._id);
    return { ok: true };
  },
});

/** Sinopsis manual untuk satu judul — dipakai layar detail anime & donghua. */
export const overrideFor = query({
  args: {
    key: v.string(),
    kind: v.union(v.literal("anime"), v.literal("donghua")),
  },
  handler: async (ctx, { key, kind }) => {
    const k = norm(key, 120);
    if (!k) return null;
    const row = await ctx.db
      .query("contentOverrides")
      .withIndex("key_kind", (q) => q.eq("key", k).eq("kind", kind))
      .first();
    return row ? { synopsis: row.synopsis, updatedAt: row.updatedAt } : null;
  },
});

export const listOverrides = query({
  args: {},
  handler: async (ctx) => {
    await requireDev(ctx);
    return await ctx.db
      .query("contentOverrides")
      .withIndex("key_kind")
      .collect();
  },
});

/* ------------------------------------------------- cari MAL id ---- */

/**
 * Cari anime berdasarkan judul lalu kembalikan MAL id-nya.
 *
 * Dipakai developer di panel tools supaya tidak perlu membuka MyAnimeList
 * hanya untuk menyalin satu angka: ketik judul, pilih hasil, id langsung
 * terisi di kolom yang relevan.
 */
export const searchAnime = action({
  args: { q: v.string() },
  handler: async (ctx, { q }) => {
    await requireDev(ctx);
    const term = norm(q, 80);
    if (term.length < 2) return [];
    const query = `query($s:String){
      Page(page:1, perPage:8){
        media(search:$s, type:ANIME, isAdult:false, sort:SEARCH_MATCH){
          id idMal title{ romaji english native } coverImage{ large }
          episodes status format seasonYear
        }
      }
    }`;
    const res = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables: { s: term } }),
      signal: AbortSignal.timeout(15_000),
    }).catch(() => null);
    const j: any = res && res.ok ? await res.json().catch(() => null) : null;
    const media: any[] = j?.data?.Page?.media ?? [];
    const shape = (m: any) => ({
      malId: m.idMal ? String(m.idMal) : "",
      anilistId: String(m.id ?? ""),
      title: m?.title?.romaji ?? m?.title?.english ?? m?.title?.native ?? "",
      image: m?.coverImage?.large ?? m?.images?.jpg?.large_image_url ?? "",
      episodes: m.episodes ?? null,
      status: String(m.status ?? ""),
      year: m.seasonYear ?? m.year ?? null,
    });
    if (media.length > 0) return media.filter(Boolean).map(shape);

    // Cadangan: Jikan (MyAnimeList). AniList sering tidak menemukan judul
    // yang di-index dengan ejaan lokal/Indonesia, sedangkan Jikan mencari
    // judul Inggris & Jepang langsung di database MAL.
    const jr = await fetch(
      `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(term)}&limit=8`,
      {
        headers: { "User-Agent": "Mozilla/5.0 (YoruNime/1.0)" },
        signal: AbortSignal.timeout(15_000),
      },
    ).catch(() => null);
    if (!jr || !jr.ok) return [];
    const jj: any = await jr.json().catch(() => null);
    const rows: any[] = jj?.data ?? [];
    return rows
      .filter((m) => !!m?.mal_id)
      .map((m) => ({
        malId: String(m.mal_id),
        anilistId: "",
        title: m?.title?.romaji ?? m?.title?.english ?? m?.title?.title_japanese ?? "",
        image:
          m?.images?.jpg?.large_image_url ?? m?.images?.jpg?.image_url ?? "",
        episodes: m?.episodes ?? null,
        status: String(m?.status ?? ""),
        year: m?.year ?? null,
      }));
  },
});

const DAYS = [
  "Minggu",
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
];

export const addCustomAnime = mutation({
  args: {
    title: v.string(),
    slug: v.string(),
    source: v.union(v.literal("sanka"), v.literal("anilist")),
    synopsis: v.string(),
    poster: v.optional(v.string()),
    airingDay: v.optional(v.string()),
    airingTime: v.optional(v.string()),
    genres: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const userId = await requireDev(ctx);
    const title = norm(args.title, 120);
    const slug = norm(args.slug, 160);
    const synopsis = String(args.synopsis ?? "").trim().slice(0, 2000);
    if (!title) throw new ConvexError("Judul wajib diisi");
    if (!slug) throw new ConvexError("Slug sumber wajib diisi");
    if (synopsis.length < 10)
      throw new ConvexError("Sinopsis terlalu pendek (minimal 10 karakter)");
    const day = args.airingDay ? norm(args.airingDay, 20) : undefined;
    if (day && !DAYS.includes(day))
      throw new ConvexError("Hari tayang tidak valid");
    const time = args.airingTime
      ? norm(args.airingTime, 10)
      : undefined;
    if (time && !/^\d{1,2}:\d{2}$/.test(time))
      throw new ConvexError("Jam tayang harus format HH:MM");
    const existing = await ctx.db
      .query("customAnime")
      .withIndex("slug", (q) => q.eq("slug", slug))
      .first();
    const payload = {
      title,
      slug,
      source: args.source,
      poster: args.poster ? norm(args.poster, 500) : undefined,
      synopsis,
      airingDay: day,
      airingTime: time,
      genres: (args.genres ?? []).map((g) => norm(g, 30)).filter(Boolean).slice(0, 8),
    };
    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return { ok: true, id: existing._id as string, updated: true };
    }
    const id = await ctx.db.insert("customAnime", {
      ...payload,
      createdAt: Date.now(),
    });
    void userId;
    return { ok: true, id, updated: false };
  },
});

export const deleteCustomAnime = mutation({
  args: { id: v.id("customAnime") },
  handler: async (ctx, { id }) => {
    await requireDev(ctx);
    await ctx.db.delete(id);
    return { ok: true };
  },
});

/** Daftar anime tambahan. Terbaca semua user (dipakai Home & Jadwal). */
export const listCustomAnime = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("customAnime").collect();
    return rows.sort((a, b) => a.title.localeCompare(b.title));
  },
});