// YoruNime — penyedia data anime (Otakudesu via ANIME_API_BASE + Jikan rate-limit guard + fallback statis)
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { action, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";

// ---------------------------------------------------------------- cache ----

export const cacheGet = internalQuery({
  args: { endpoint: v.string() },
  handler: async (ctx, { endpoint }) => {
    return await ctx.db
      .query("animeCache")
      .withIndex("endpoint", (q) => q.eq("endpoint", endpoint))
      .first();
  },
});

export const cacheSet = internalMutation({
  args: { endpoint: v.string(), payload: v.any() },
  handler: async (ctx, { endpoint, payload }) => {
    const row = await ctx.db
      .query("animeCache")
      .withIndex("endpoint", (q) => q.eq("endpoint", endpoint))
      .first();
    if (row) await ctx.db.patch(row._id, { payload, updatedAt: Date.now() });
    else
      await ctx.db.insert("animeCache", { endpoint, payload, updatedAt: Date.now() });
  },
});

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

// --------------------------------------------------- jikan rate-limiter ----
// Jikan: 3 req/detik, 60/menit. Jangan pernah 429: antri di memori fungsi
// (setiap isolate convex punya antreannya sendiri; buat beberapa aksi paralel
// dari browser, antrean tetap melindungi secara efektif karena cache menjaga
// jumlah panggilan tetap rendah).

type Job = { resolve: (v: unknown) => void; reject: (e: unknown) => void; fn: () => Promise<unknown> };
const g = globalThis as unknown as { __jikanQueue?: Job[]; __jikanLast?: number[] };
g.__jikanQueue ??= [];
g.__jikanLast ??= [];

async function pump() {
  while ((g.__jikanQueue?.length ?? 0) > 0) {
    const now = Date.now();
    const window = (g.__jikanLast ?? []).filter((t) => now - t < 61_000);
    if (window.length >= 55) {
      await new Promise((r) => setTimeout(r, 61_000 - (now - window[0]) + 50));
      continue;
    }
    const last = (g.__jikanLast ?? []).slice(-1)[0] ?? 0;
    const waitMs = Math.max(0, 1200 - (now - last));
    if (waitMs > 0) await new Promise((r) => setTimeout(r, waitMs));
    const job = g.__jikanQueue!.shift()!;
    g.__jikanLast!.push(Date.now());
    job.fn().then(job.resolve, job.reject);
  }
}

function jikanEnqueue<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    g.__jikanQueue!.push({ resolve: resolve as (v: unknown) => void, reject, fn });
    void pump();
  });
}

async function fetchJson(url: string, timeoutMs = 12_000): Promise<any> {
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "YoruNime/1.0" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`Upstream ${res.status}: ${url}`);
  return await res.json();
}

// Base API data anime. Kalau env belum diisi, pakai API publik Otakudesu
// supaya katalog, detail, dan sinopsis tetap jalan tanpa konfigurasi.
const PUBLIC_ANIME_API = "https://otakudesu-scrapper.vercel.app";

function apiBase(): string | null {
  const raw =
    process.env.ANIME_API_BASE ??
    process.env.ANIME_API_URL ??
    process.env.OTAKUDESU_API ??
    process.env.OTAKUDESU_API_BASE;
  const base = String(raw ?? "").trim() || PUBLIC_ANIME_API;
  return base.startsWith("http") ? base.replace(/\/+$/, "") : PUBLIC_ANIME_API;
}

const LIST_TTL = 15 * 60 * 1000;
const DETAIL_TTL = 60 * 60 * 1000;

// ------------------------------------------------------------ normalize ----

export type AnimeCard = {
  source: "otakudesu" | "jikan" | "fallback" | "anilist";
  id: string;
  title: string;
  image: string;
  score?: number;
  episodes?: number;
  type?: string;
  status?: string;
  releaseDay?: string;
  synopsis?: string;
  /** Sinopsis versi Bahasa Indonesia (dihasilkan otomatis). */
  synopsisId?: string;
};

export type EpisodeItem = {
  id: string;
  number: number;
  title: string;
  duration?: string;
  aired?: string;
  /** false = episode belum rilis (dipakai buat disable di UI) */
  released?: boolean;
};

export type AnimeDetail = AnimeCard & {
  genres: string[];
  studio?: string;
  rating?: string;
  year?: number;
  synopsis: string;
  totalEpisodes: number;
  episodeList: EpisodeItem[];
};

// ------------------------------------------------------------- jikan ol ----

const DAY_FILTER = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];

function jikanStatus(a: any): string {
  const t = String(a.type ?? "");
  if (t === "OVA" || t === "ONA" || t === "Special") return "OVA";
  if (t === "Movie") return "Movie";
  if (a.status === "Currently Airing") return "Ongoing";
  if (a.status === "Not yet aired") return "Upcoming";
  return "Completed";
}

function jikanCard(a: any): AnimeCard {
  return {
    source: "jikan",
    id: String(a.mal_id),
    title: a.title ?? a.title_english ?? "Tanpa judul",
    image: a.images?.jpg?.large_image_url ?? a.images?.jpg?.image_url ?? "",
    score: a.score ?? undefined,
    episodes: a.episodes ?? undefined,
    type: a.type ?? undefined,
    status: jikanStatus(a),
    releaseDay: a.broadcast?.day
      ? String(a.broadcast.day).replace(/^\w/, (c: string) => c.toUpperCase())
      : undefined,
    synopsis: (a.synopsis ?? "").replace(/\[Written by MAL Rewrite\]/gi, "").trim() || undefined,
  };
}

async function jikanList(path: string): Promise<AnimeCard[]> {
  const data = await jikanEnqueue(() => fetchJson(`https://api.jikan.moe/v4/${path}`));
  return (data?.data ?? []).map(jikanCard);
}

function synthEpisodes(a: any, eps: EpisodeItem[]): EpisodeItem[] {
  if (eps.length > 0) return eps;
  // Jumlah episode harus jujur mengikuti data anime. Dulu di-cap 24 supaya
  // anime panjang (One Piece >1000 episode) jadi terpotong.
  const total = Math.min(a.episodes ?? 12, 3000) || 12;
  const out: EpisodeItem[] = [];
  for (let i = 1; i <= total; i++) {
    out.push({
      id: `${a.mal_id}__ep${i}`,
      number: i,
      title: `Episode ${i}`,
      duration: "24 menit",
    });
  }
  return out;
}

async function jikanDetail(id: string): Promise<AnimeDetail> {
  const data = await jikanEnqueue(() => fetchJson(`https://api.jikan.moe/v4/anime/${id}/full`));
  const a = data?.data;
  if (!a) throw new Error("Anime tidak ditemukan");
  let episodeList: EpisodeItem[] = [];
  try {
    const epsRes = await jikanEnqueue(() =>
      fetchJson(`https://api.jikan.moe/v4/anime/${id}/episodes`),
    );
    episodeList = (epsRes?.data ?? []).map((e: any, i: number) => ({
      id: `${id}__ep${e.mal_id ?? i + 1}`,
      number: e.mal_id ?? i + 1,
      title: e.title ?? `Episode ${e.mal_id ?? i + 1}`,
      aired: e.aired ?? undefined,
      released: true,
      duration: "24 menit",
    }));
  } catch {
    /* pakai sintetis */
  }
  episodeList = synthEpisodes(a, episodeList);
  return {
    ...jikanCard(a),
    genres: (a.genres ?? []).map((x: any) => x.name),
    studio: a.studios?.[0]?.name,
    rating: a.rating,
    year: a.year ?? a.aired?.prop?.from?.year ?? undefined,
    synopsis:
      (a.synopsis ?? "").replace(/\[Written by MAL Rewrite\]/gi, "").trim() ||
      "Sinopsis belum tersedia.",
    totalEpisodes: a.episodes ?? episodeList.length,
    episodes: episodeList.length,
    episodeList,
  };
}

// ------------------------------------------------------------- anilist ----
// AniList dipakai sebagai sumber utama by MAL id: stabil (tidak ada rate limit
// seperti Jikan) dan selalu mengembalikan judul + poster yang cocok dengan id.

const ANILIST_URL = "https://graphql.anilist.co";
const ANILIST_FIELDS = `
  id
  idMal
  title { romaji english native }
  coverImage { extraLarge large }
  averageScore
  episodes
  duration
  format
  status
  seasonYear
  genres
  isAdult
  studios(isMain: true) { nodes { name } }
  description(asHtml: false)
  nextAiringEpisode { episode }
`;

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

function anilistCard(m: any): AnimeCard {
  return {
    source: "anilist",
    id: String(m?.idMal ?? m?.id ?? ""),
    title:
      m?.title?.romaji ?? m?.title?.english ?? m?.title?.native ?? "Tanpa judul",
    image: m?.coverImage?.extraLarge ?? m?.coverImage?.large ?? "",
    score: m?.averageScore ? Number((m.averageScore / 10).toFixed(2)) : undefined,
    episodes: m?.episodes ?? undefined,
    type: m?.format ?? undefined,
    status:
      m?.status === "RELEASING"
        ? "Ongoing"
        : m?.status === "FINISHED"
          ? "Completed"
          : m?.status === "NOT_YET_RELEASED"
            ? "Upcoming"
            : undefined,
    synopsis:
      (m?.description ?? "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim() || undefined,
  };
}

/** Terjemahkan sinopsis ke Bahasa Indonesia (best-effort, cache di caller). */
async function translateId(text: string | undefined): Promise<string | undefined> {
  const clean = (text ?? "").replace(/\s+/g, " ").trim();
  if (clean.length < 25) return undefined;
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=id&dt=t&q=${encodeURIComponent(clean.slice(0, 1200))}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (YoruNime/1.0)" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return undefined;
    const j = await res.json();
    const out = Array.isArray(j?.[0])
      ? j[0].map((x: any) => x?.[0] ?? "").join("").trim()
      : "";
    return out.length > 20 ? out : undefined;
  } catch {
    return undefined;
  }
}

async function anilistDetail(malId: string): Promise<AnimeDetail | null> {
  const d = await aniGraphql(
    `query($id:Int){ Media(idMal:$id, type:ANIME){ ${ANILIST_FIELDS} } }`,
    { id: Number(malId) },
  );
  const m = d?.Media;
  if (!m) return null;
  const card = anilistCard(m);
  // Judul yang belum tayang tidak boleh dikarang jadi episode playable.
  const upcoming = m.status === "NOT_YET_RELEASED";
  // AniList mengisi `episodes` dengan null untuk anime yang masih tayang
  // (One Piece, Naruto, dll). `nextAiringEpisode.episode` adalah episode
  // terakhir yang sudah tayang, jadi itu jumlah episode yang bisa ditonton.
  const counted =
    m.episodes ??
    (m.status === "RELEASING" && m.nextAiringEpisode?.episode
      ? m.nextAiringEpisode.episode - 1
      : undefined);
  const total = upcoming ? 0 : Math.max(1, Math.min(counted ?? 1, 3000));
  const episodeList: EpisodeItem[] = [];
  for (let i = 1; i <= total; i++) {
    episodeList.push({
      id: `${malId}__ep${i}`,
      number: i,
      title: `Episode ${i}`,
      released: true,
      duration: m.duration ? `${m.duration} menit` : undefined,
    });
  }
  const synopsis = card.synopsis ?? "Sinopsis belum tersedia.";
  const synopsisId = await translateId(synopsis);
  return {
    ...card,
    genres: Array.isArray(m.genres) ? m.genres : [],
    year: m.seasonYear ?? undefined,
    studio:
      m.studios?.nodes?.[0]?.name ??
      m.studios?.nodes?.map((n: any) => n?.name).filter(Boolean).join(", ") ??
      undefined,
    rating: m.isAdult ? "Rating 17+" : "Rating 13+",
    episodes: total,
    synopsis,
    synopsisId: synopsisId ?? undefined,
    totalEpisodes: total,
    episodeList,
  };
}

// -------------------------------------------------------- otakudesu ol ----

/**
 * Sinkronkan judul & poster katalog statis dengan AniList (by MAL id) supaya
 * nama anime di hero/kartu selalu sama dengan gambarnya. Sinopsis Indonesia
 * buatan sendiri tetap dipertahankan.
 */
async function hydrateCatalog(cards: AnimeCard[]): Promise<AnimeCard[]> {
  const ids = [
    ...new Set(
      cards
        .map((c) => Number(c.id))
        .filter((n) => Number.isInteger(n) && n > 0),
    ),
  ];
  if (ids.length === 0) return cards;
  try {
    const d = await aniGraphql(
      `query($ids:[Int]){ Page(page:1, perPage:50){ media(idMal_in:$ids, type:ANIME){ ${ANILIST_FIELDS} } } }`,
      { ids: ids.slice(0, 50) },
    );
    const byMal = new Map<number, any>(
      (d?.Page?.media ?? []).map((m: any) => [Number(m.idMal), m]),
    );
    return cards.map((c) => {
      const m = byMal.get(Number(c.id));
      if (!m) return c;
      const fresh = anilistCard(m);
      return {
        ...c,
        source: "anilist" as const,
        title: fresh.title,
        image: fresh.image,
        score: fresh.score ?? c.score,
        episodes: fresh.episodes ?? c.episodes,
        type: fresh.type ?? c.type,
        status: fresh.status ?? c.status,
        synopsis: c.synopsis ?? fresh.synopsis,
      };
    });
  } catch {
    return cards;
  }
}

/** Fallback katalog + hidrasi judul/poster dari AniList. */
async function fbList(list: AnimeCard[], count: number): Promise<AnimeCard[]> {
  return hydrateCatalog(rotateByDate(list, count));
}

function odNum(v: any): number | undefined {
  const n = parseInt(String(v ?? "").replace(/[^0-9]/g, ""), 10);
  return Number.isNaN(n) ? undefined : n;
}

function odList(json: any): AnimeCard[] {
  const list = json?.data?.animeList ?? json?.data ?? [];
  return (Array.isArray(list) ? list : []).map((a: any) => ({
    source: "otakudesu" as const,
    id: a.animeId ?? a.anime_id ?? a.id ?? "",
    title: a.title ?? a.animeTitle ?? "Tanpa judul",
    image: a.poster ?? a.image ?? "",
    score: a.score ? odNum(a.score) : undefined,
    episodes: a.episodes ? odNum(a.episodes) : undefined,
    status: a.status
      ? String(a.status).includes("Ongoing")
        ? "Ongoing"
        : String(a.status).includes("Completed")
          ? "Completed"
          : "OVA"
      : undefined,
    releaseDay: a.releaseDay ?? undefined,
  }));
}

/** Sinopsis Otakudesu datang sebagai objek paragraphList, bukan string. */
function otakuSynopsis(v: any): string {
  if (!v) return "";
  if (typeof v === "string") return v.replace(/<[^>]*>/g, " ").trim();
  const parts = Array.isArray(v?.paragraphList)
    ? v.paragraphList
    : Array.isArray(v)
      ? v
      : [];
  return parts
    .map((p: any) => (typeof p === "string" ? p : (p?.text ?? "")))
    .filter(Boolean)
    .join("\n\n")
    .replace(/<[^>]*>/g, " ")
    .trim();
}

async function otakuDetail(id: string): Promise<AnimeDetail> {
  const base = apiBase()!;
  const json = await fetchJson(`${base}/otakudesu/anime/${encodeURIComponent(id)}`);
  const d = json?.data ?? {};
  // Genre ada di `genreList` (objek { title }) atau `genres` (string/objek).
  const genres = [
    ...(Array.isArray(d.genreList) ? d.genreList : []),
    ...(Array.isArray(d.genres) ? d.genres : []),
  ]
    .map((x: any) =>
      typeof x === "string" ? x : (x?.title ?? x?.genreName ?? x?.name ?? ""),
    )
    .filter(Boolean) as string[];
  const raw = d.episodeList ?? d.data?.episodeList ?? [];
  const episodeList: EpisodeItem[] = (Array.isArray(raw) ? raw : []).map((e: any, i: number) => {
    const title = e.episodeTitle ?? e.title ?? e.episode ?? `Episode ${i + 1}`;
    const num = odNum(e.episodeTitle ?? e.episode ?? title) ?? i + 1;
    return {
      id: e.episodeId ?? e.episode_id ?? `${id}__ep${num}`,
      number: num,
      title,
      aired: e.uploadedOn ?? e.releaseDate ?? undefined,
      released: true,
      duration: d.duration ?? "24 menit",
    };
  });
  const status = String(d.status ?? "");
  const synopsis = otakuSynopsis(d.synopsis);
  // Jumlah episode dari katalog lebih dipercaya daripada panjang daftar:
  // kadang daftar episode belum lengkap padahal anime sudah selesai tayang.
  const declared = odNum(d.episodes);
  const total = Math.max(episodeList.length, declared ?? 0);
  const episodeAll: EpisodeItem[] =
    episodeList.length === total
      ? episodeList
      : Array.from({ length: total }, (_, i) => ({
          id: `${id}__ep${i + 1}`,
          number: i + 1,
          title: `Episode ${i + 1}`,
          // Sisipan ini belum tayang (anime ongoing, contoh 25 episode tapi baru
          // 14 yang rilis) — UI harus men|gray-kan dan men-disable.
          released: false,
          duration: d.duration ?? "24 menit",
        }));
  const year = Number(String(d.aired ?? "").match(/\b(19|20)\d{2}\b/)?.[0]);
  return {
    source: "otakudesu",
    id,
    title: d.title ?? id,
    image: d.poster ?? "",
    score: d.score ? odNum(d.score) : undefined,
    status: status.includes("Ongoing") ? "Ongoing" : status.includes("Completed") ? "Completed" : "OVA",
    synopsis: synopsis || "Sinopsis belum tersedia.",
    synopsisId: synopsis || undefined,
    genres,
    studio: typeof d.studios === "string" ? d.studios : (d.studios?.[0] ?? undefined),
    rating: d.rating ?? undefined,
    year: Number.isFinite(year) ? year : undefined,
    totalEpisodes: total,
    episodeList: episodeAll,
  };
}

// ------------------------------------------------- fallback katalog statis ----

function fb(
  title: string,
  id: string,
  score: number,
  year: number,
  status: string,
  synopsis: string,
  image = "",
  episodes?: number,
): AnimeCard {
  return {
    source: "fallback",
    id,
    title,
    image,
    score,
    status,
    type: "TV",
    episodes,
    synopsis: `${title} (${year}). ${synopsis}`,
  };
}

export const FALLBACK_TOP: AnimeCard[] = [
  fb("Sword Art Online", "11757", 8.1, 2012, "Completed", "Pemain game terperangkap di dunia virtual dan harus membersihkan dungeon untuk bisa keluar.", "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx11757-Fp2q1VbFunu.jpg"),
  fb("Fullmetal Alchemist: Brotherhood", "5114", 9, 2009, "Completed", "Dua bersaudara alkimia mencari Batu Filsafat untuk mengembalikan tubuh mereka.", "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx5114-nSWCgQlmOMtj.jpg"),
  fb("Steins;Gate", "9253", 8.9, 2011, "Completed", "Ilmuwan gila menemukan cara mengirim pesan ke masa lalu lewat microwave.", "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx9253-tIUXF2gfU8Sg.jpg"),
  fb("Hunter x Hunter (2011)", "11061", 8.9, 2011, "Completed", "Gon berlatih jadi Hunter demi mencari ayahnya.", "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx11061-y5gsT1hoHuHw.png"),
  fb("Attack on Titan", "16498", 8.5, 2013, "Completed", "Manusia bertahan di balik tembok dari serangan Titan raksasa.", "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx16498-buvcRTBx4NSm.jpg"),
  fb("Demon Slayer", "38000", 8.2, 2019, "Completed", "Tanjiro memburu iblis untuk menyembuhkan adiknya.", "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx101922-WBsBl0ClmgYL.jpg"),
  fb("Jujutsu Kaisen", "40748", 8.4, 2020, "Completed", "Siswa SMA menelan jari kutukan dan masuk dunia jujutsu.", "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx113415-LHBAeoZDIsnF.jpg"),
  fb("One Punch Man", "30276", 8.2, 2015, "Completed", "Pahlawan yang mengalahkan musuh dengan satu pukulan mencari tantangan.", "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx21087-B5DHjqZ3kW4b.jpg"),
  fb("Death Note", "1535", 8.4, 2006, "Completed", "Siswa menemukan buku yang bisa membunuh siapa pun namanya ditulis.", "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx1535-kUgkcrfOrkUM.jpg"),
  fb("Frieren: Beyond Journey's End", "52991", 9.1, 2023, "Completed", "Penyihir elf berkeliling menengok kembali perjalanan masa lalunya.", "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx154587-qQTzQnEJJ3oB.jpg"),
  fb("SPY x FAMILY", "50265", 8.3, 2022, "Completed", "Keluarga mata-mata paling tidak biasa di dunia.", "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx140960-Kb6R5nYQfjmP.jpg"),
  fb("One Piece", "21", 8.7, 1999, "Ongoing", "Bajak laut topi jerami berlayar mencari One Piece.", "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx21-ELSYx3yMPcKM.jpg", 1100),
  fb("Vinland Saga S2", "49387", 8.8, 2023, "Completed", "Thorfinn mencari kedamaian setelah masa perbudakannya.", "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx136430-gsBsJjA7hGh9.jpg"),
  fb("Chainsaw Man", "44511", 8.3, 2022, "Completed", "Denji hidup dengan ibu jantung berantai mesin.", "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx127230-DdP4vAdssLoz.png"),
  fb("Mob Psycho 100 III", "50172", 8.7, 2022, "Completed", "Esper muda belajar hidup normal.", "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx140439-bPKmhe1wNxc9.jpg"),
  fb("Bocchi the Rock!", "47917", 8.7, 2022, "Completed", "Gitaris pemalu bergabung dengan band sekolah.", "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx130003-HTDmeL4RGeJ4.png"),
  fb("Oshi no Ko", "52034", 8.4, 2023, "Completed", "Dunia gelap industri idola Jepang.", "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx150672-WqmmwZ4nMzAy.png"),
  fb("My Hero Academia", "31964", 7.6, 2016, "Completed", "Sekolah pahlawan super generasi baru.", "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx21459-nYh85uj2Fuwr.jpg"),
  fb("BLUE LOCK", "49596", 7.9, 2022, "Completed", "Program pelatihan striker paling brutal.", "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx137822-U8naszP96vzC.png"),
  fb("Dandadan", "57334", 8.3, 2024, "Completed", "Hantu, alien, dan cinta remaja yang kacau.", "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx171018-60q1B6GK2Ghb.jpg"),
];

export const FALLBACK_SEASON: AnimeCard[] = [
  fb("Sakamoto Days", "58939", 7.6, 2025, "Ongoing", "Pembunuh legendaris pensiun jadi pemilik minimarket.", "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx177709-e5Qx6RlsBgD5.png"),
  fb("Kaiju No. 8", "52588", 8.1, 2024, "Completed", "Pria dewasa berubah jadi kaiju dan ikut pasukan pertahanan.", "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx153288-25FBfFJzEQ5O.jpg"),
  fb("Gachiakuta", "59062", 8.2, 2025, "Ongoing", "Anak buangan turun ke dunia sampah penuh monster.", "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx178025-cWJKEsZynkil.jpg"),
  fb("Grand Blue Dreaming", "37105", 8.2, 2018, "Completed", "Klub penyelaman paling kacau di kampus.", "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx100922-uxEhaCsqMMp3.png"),
  fb("Call of the Night", "50346", 7.9, 2022, "Completed", "Vampir dan bocah yang jatuh cinta pada malam.", "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx141391-M3ZgUKTPENUk.jpg"),
  fb("Zom 100: Bucket List", "54112", 7.6, 2023, "Completed", "Daftar keinginan saat kiamat zombie.", "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx159831-cJUNqCqzuApc.png"),
  fb("Undead Unluck", "52741", 7.6, 2023, "Completed", "Gadis pembawa sial vs pria abadi.", "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx154116-3ydDI9hhvPgw.png"),
  fb("Solo Leveling", "52299", 8, 2024, "Completed", "Hunter terlemah bangkit sebagai Shadow Monarch.", "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx151807-it355ZgzquUd.png"),
  fb("That Time I Got Reincarnated as a Slime", "37430", 8, 2018, "Completed", "Rimu bertransformasi jadi raja iblis.", "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx101280-tDxCVJm714nt.jpg"),
  fb("The Apothecary Diaries", "54492", 8.8, 2023, "Completed", "Ahli racun istana memecahkan misteri.", "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx161645-QLbzHXiYRgV2.jpg"),
  fb("WIND BREAKER", "54900", 7.7, 2024, "Completed", "Geng sekolah pelindung kota.", "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx163270-wboZJp0ybwVK.jpg"),
  fb("Fire Force", "38671", 7.6, 2019, "Completed", "Regu pemadam melawan pembakar manusia.", "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx105310-2PKUvoaA6fTn.jpg"),
];

// -------------------------------------------------------------- actions ----

async function withFallback(
  runCtx: any,
  endpoint: string,
  od: () => Promise<unknown>,
  jk: () => Promise<unknown>,
): Promise<unknown> {
  return cached(runCtx, endpoint, LIST_TTL, async () => {
    if (apiBase()) {
      try {
        return await od();
      } catch {
        /* fallback ke jikan */
      }
    }
    try {
      return await jk();
    } catch {
      return null; // caller pakai fallback statis
    }
  });
}

const LIMIT = 24;

function pick(list: AnimeCard[], start: number, count: number): AnimeCard[] {
  if (list.length === 0) return [];
  const out: AnimeCard[] = [];
  for (let i = 0; i < count; i++) {
    out.push(list[(start + i) % list.length]);
  }
  return out;
}

function rotateByDate(list: AnimeCard[], count: number): AnimeCard[] {
  const day = Math.floor(Date.now() / 86_400_000);
  return pick(list, day % Math.max(1, list.length), count);
}

// Daftar utama: AniList dulu (lengkap & stabil), baru otakudesu/Jikan, lalu
// katalog statis yang sudah dihidrasi dari AniList.
async function aniList(
  endpoint: string,
  ttlMs: number,
  runCtx: any,
  where: string,
  page = 1,
  limit = 24,
  sort = "POPULARITY_DESC",
): Promise<AnimeCard[] | null> {
  return (await cached(
    runCtx,
    `${endpoint}:v2:${page}:${sort}`,
    ttlMs,
    async () => {
      try {
        const d = await aniGraphql(browseQuery(page, where, sort));
        const list = (d?.Page?.media ?? [])
          .filter((m: any) => m?.idMal)
          .map(anilistCard);
        if (list.length > 0) return list.slice(0, limit);
      } catch {
        /* lanjut ke sumber lain */
      }
      if (apiBase()) {
        try {
          const od = odList(await fetchJson(`${apiBase()}/otakudesu/ongoing?page=${page}`));
          if (od.length > 0) return od.slice(0, limit);
        } catch {
          /* lanjut */
        }
      }
      return null;
    },
  )) as AnimeCard[] | null;
}

export const animeOngoing = action({
  args: { page: v.optional(v.number()) },
  handler: async (runCtx, { page = 1 }) => {
    const r = await aniList("ongoing", LIST_TTL, runCtx, "status:RELEASING", page, 24);
    if (r && r.length > 0) return r;
    try {
      const season = await jikanList("seasons/now?limit=24&sfw");
      if (season.length > 0) return season;
    } catch {
      /* fallback statis */
    }
    return fbList([...FALLBACK_SEASON, ...FALLBACK_TOP], LIMIT);
  },
});

export const animeCompleted = action({
  args: { page: v.optional(v.number()) },
  handler: async (runCtx, { page = 1 }) => {
    const r = (await withFallback(
      runCtx,
      `completed:${page}`,
      async () => odList(await fetchJson(`${apiBase()}/otakudesu/completed?page=${page}`)),
      async () => {
        const top = await jikanList(`top/anime?limit=24&type=tv&sfw&page=${page}`);
        if (top.length > 0) return top;
        return null;
      },
    )) as AnimeCard[] | null;
    return r && r.length > 0 ? r : pick(FALLBACK_TOP, (page - 1) * 12, 12);
  },
});

export const animeTop = action({
  args: {},
  handler: async (runCtx) => {
    const r = await aniList("top", LIST_TTL, runCtx, "", 1, 10, "SCORE_DESC");
    if (r && r.length > 0) return r.slice(0, 10);
    try {
      const tv = await jikanList("top/anime?limit=10&type=tv&sfw");
      if (tv.length > 0) return tv;
    } catch {
      /* fallback statis */
    }
    return fbList(FALLBACK_TOP, 10);
  },
});

export const animeTrendingToday = action({
  args: {},
  handler: async (runCtx) => {
    const r = await aniList("trending", LIST_TTL, runCtx, "", 1, 10, "TRENDING_DESC");
    if (r && r.length > 0) return r.slice(0, 10);
    const day = DAY_FILTER[(new Date().getDay() + 6) % 7];
    try {
      const sched = await jikanList(`schedules?filter=${day}&limit=10&sfw`);
      if (sched.length > 0) return sched;
    } catch {
      /* fallback statis */
    }
    return fbList(FALLBACK_TOP, 10);
  },
});

/**
 * Katalog Donghua.
 *
 * AniList punya format `DONGHUA` sebagai field tersendiri, jadi daftar ini
 * benar-benar terpisah dari anime: judul, gambar, dan genre-nya milik
 * donghua. Di Home modul ini tampil dengan judul section sendiri supaya
 * tidak tercampur dengan deretan anime.
 *
 * Fallback: kalau AniList sedang tidak mengembalikan apa-apa, daftar
 * statis dipakai supaya barisnya tidak kosong sama sekali.
 */
export const donghuaList = action({
  args: {
    page: v.optional(v.number()),
    // Hanya dua urutan yang dipakai UI: populer dan terbaru.
    sort: v.optional(v.union(v.literal("POPULARITY_DESC"), v.literal("START_DATE_DESC"))),
  },
  handler: async (runCtx, { page = 1, sort = "POPULARITY_DESC" }) => {
    // PENTING: jangan pernah fallback ke daftar anime di sini. `aniList`
    // jatuh ke sumber lain (Otakudesu) kalau AniList kosong, dan sumber itu
    // hanya punya anime — hasilnya deretan judul anime berlabel "Donghua".
    // Kalau memang tidak ada donghua, lebih baik kosong daripada salah label.
    const r = await aniList("donghua", LIST_TTL, runCtx, "format:DONGHUA", page, 24, sort);
    if (!r || r.length === 0) return [];
    // Second guard: buang apa pun yang jelas bukan donghua (label anime dari
    // sumber cadangan), hanya menyisakan yang benar-benar berformat donghua.
    return r.filter((c) => !/^(TV|Movie|OVA|ONA|Special)$/i.test(String(c.type ?? "")));
  },
});

/**
 * Jadwal rilis DONGHUA untuk tab Jadwal.
 *
 *-structure sama dengan `animeAiringSchedule` (AniList memberi
 * `nextAiringEpisode.airingAt`), tapi disaring `format:DONGHUA` supaya anime
 * tidak ikut masuk. Kalau AniList tidak punya jadwal donghua, hasilnya kosong
 * — bukan diisi anime.
 */
export const donghuaAiringSchedule = action({
  args: {},
  handler: async (runCtx) =>
    cached(
      runCtx,
      "donghua:today-airing",
      30 * 60 * 1000,
      async () => {
        const query = `query ($page:Int){
          Page(page:$page, perPage:50){
            media(type:ANIME, format:DONGHUA, sort:POPULARITY_DESC, isAdult:false){
              ${ANILIST_FIELDS}
              nextAiringEpisode { airingAt episode timeUntilAiring }
            }
          }
        }`;
        try {
          const d = await aniGraphql(query, { page: 1 });
          const list = (Array.isArray(d?.Page?.media) ? d.Page.media : [])
            .filter((m: any) => m?.idMal && m?.nextAiringEpisode?.airingAt)
            .map((m: any) => anilistCard(m))
            .filter(Boolean);
          return list;
        } catch {
          return [];
        }
      },
    ),
});

/**
 * Pencarian DONGHUA saja.
 *
 * Dipakai bersama `animeSearch` dari layar "Cari anime & donghua" supaya
 * satu kolom pencarian bisa mencari keduanya. Sengaja memakai filter
 * `format:DONGHUA` yang eksplisit: tanpa itu, pencarian akan mengembalikan
 * anime biasa dan users terribly salah label.
 */
export const donghuaSearch = action({
  args: { q: v.string(), page: v.optional(v.number()) },
  handler: async (runCtx, { q, page = 1 }) => {
    const query = q.trim();
    if (query.length === 0) return [];
    const p = Math.max(1, Math.min(6, Math.round(page)));
    return cached(
      runCtx,
      `donghua-search:${p}:${query.toLowerCase()}`,
      6 * 60 * 60 * 1000,
      async () => {
        try {
          const d = await aniGraphql(
            `query($s:String,$p:Int){ Page(page:$p, perPage:50){ media(type:ANIME, search:$s, sort:SEARCH_MATCH, isAdult:false, format:DONGHUA){ ${ANILIST_FIELDS} } } }`,
            { s: query, p },
          );
          const list = (Array.isArray(d?.Page?.media) ? d.Page.media : [])
            .filter((m: any) => m?.idMal)
            .map(anilistCard);
          return list;
        } catch {
          return [];
        }
      },
    );
  },
});

/**
 * Rekomendasi "Untuk kamu" berdasarkan selo rasa user.
 *
 * Berbeda dari `animeForYou` (yang murni urutan dari AniList), ini memakai
 * data user: `genres` berisi genre yang paling sering ditonton user (diambil
 * client dari `activities.genreTaste`) dan `exclude` berisi anime yang sudah
 * ada di riwayat, supaya rekomendasi tidak berputar mengulang judul yang sama.
 *
 * Genre dikirim dari client karena aksi ini tidak punya akses ke query
 * `activities`; logika pengumpul genre tetap hidup di `genreTaste` yang hanya
 * membaca data yang sudah tersimpan.
 */
export const animeRecommended = action({
  args: {
    genres: v.optional(v.array(v.string())),
    exclude: v.optional(v.array(v.string())),
  },
  handler: async (runCtx, { genres, exclude }) => {
    const seen = new Set((exclude ?? []).filter(Boolean));
    const wanted = (genres ?? [])
      .map((g) => g.trim().toUpperCase())
      .filter((g) => g.length > 1 && g.length < 30 && /^[A-Z ]+$/.test(g))
      .slice(0, 5);
    if (wanted.length === 0) {
      // Belum ada sinyal selera → pakai anime yang sedang rilis saja.
      return (
        (await aniList("reco-cold", LIST_TTL, runCtx, "status:RELEASING", 1, 14)) ?? []
      );
    }

    const out: AnimeCard[] = [];
    for (const g of wanted) {
      if (out.length >= 12) break;
      const rows = await aniList(
        "reco-genre",
        LIST_TTL,
        runCtx,
        `genre_in:[${g}],status:RELEASING,isAdult:false`,
        1,
        12,
        "POPULARITY_DESC",
      );
      for (const c of rows ?? []) {
        if (out.length >= 12) break;
        if (seen.has(c.id)) continue;
        seen.add(c.id);
        out.push(c);
      }
    }
    if (out.length >= 6) return out;

    // Cadangan: anime yang sedang populer, dan yang belum pernah ditonton.
    const pop =
      (await aniList("reco-fallback", LIST_TTL, runCtx, "status:RELEASING", 1, 20)) ?? [];
    for (const c of pop) {
      if (out.length >= 14) break;
      if (seen.has(c.id)) continue;
      out.push(c);
    }
    return out;
  },
});

export const animeForYou = action({
  args: { seed: v.optional(v.number()) },
  handler: async (runCtx, { seed = 0 }) => {
    const r = await aniList(
      "foryou",
      LIST_TTL,
      runCtx,
      "",
      (seed % 3) + 1,
      12,
    );
    if (r && r.length > 0) return r.slice(0, 12);
    return fbList(FALLBACK_TOP, 12);
  },
});

export const animeSearch = action({
  args: { q: v.string(), page: v.optional(v.number()), adult: v.optional(v.boolean()) },
  handler: async (runCtx, { q, page, adult = false }) => {
    const query = q.trim();
    if (query.length === 0) return [];
    // Pencarian 18+ hanya untuk staff (dev/mod/tester/sepuh).
    let allowAdult = false;
    if (adult) {
      const authUserId = await getAuthUserId(runCtx);
      if (authUserId) {
        const me = await runCtx.runQuery(internal.moderation.adultAccess, {
          userId: authUserId,
        });
        allowAdult = !!me;
      }
      if (!allowAdult) return [];
    }
    const p = Math.max(1, Math.min(6, Math.round(page ?? 1)));
    const lower = query.toLowerCase();
    // 1) AniList (pencarian lengkap & selalu punya MAL id → bisa distream).
    //    `isAdult` mengikuti pilihan 18+ pengguna.
    try {
      const d = await aniGraphql(
        `query($s:String,$p:Int,$a:Boolean){ Page(page:$p, perPage:50){ media(type:ANIME, search:$s, sort:SEARCH_MATCH, isAdult:$a){ ${ANILIST_FIELDS} } } }`,
        { s: query, p, a: !!adult },
      );
      const list = (d?.Page?.media ?? []).filter((m: any) => m?.idMal).map(anilistCard);
      if (list.length > 0) return list;
      // Retry tanpa sort SEARCH_MATCH — beberapa judul hanya ketemu di mode ini.
      const d2 = await aniGraphql(
        `query($s:String,$a:Boolean){ Page(page:1, perPage:50){ media(type:ANIME, search:$s, isAdult:$a){ ${ANILIST_FIELDS} } } }`,
        { s: query, a: !!adult },
      );
      const list2 = (d2?.Page?.media ?? []).filter((m: any) => m?.idMal).map(anilistCard);
      if (list2.length > 0) return list2;
    } catch {
      /* lanjut */
    }
    // 2) cache
    const cacheKey = `search:v3:${adult ? "18+" : "sfw"}:${lower}`;
    const row = (await runCtx.runQuery(internal.anime.cacheGet, {
      endpoint: cacheKey,
    })) as { payload?: unknown; updatedAt?: number } | null;
    if (row && row.updatedAt && Date.now() - row.updatedAt < LIST_TTL)
      return (row.payload as AnimeCard[]) ?? [];
    // 3) jikan — tanpa `sfw` supaya tidak membuat judul 18+ lenyap dari hasil.
    try {
      const r = await jikanList(
        `anime?q=${encodeURIComponent(query)}&limit=24&order_by=members&sort=desc`,
      );
      if (r.length > 0) {
        await runCtx.runMutation(internal.anime.cacheSet, {
          endpoint: cacheKey,
          payload: r,
        });
        return r;
      }
    } catch {
      /* lanjut */
    }
    // 4) fallback statis (supaya halaman tidak pernah kosong)
    return [...FALLBACK_TOP, ...FALLBACK_SEASON].filter(
      (a) => a.title.toLowerCase().includes(lower) || lower.length >= 3,
    );
  },
});

export const animeGenres = action({
  args: {},
  handler: async (runCtx) =>
    cached(runCtx, "genres", 7 * 24 * 3600 * 1000, async () => {
      if (apiBase()) {
        try {
          const json = await fetchJson(`${apiBase()}/otakudesu/genre`);
          const list = json?.data?.genreList ?? json?.data ?? [];
          const mapped = (Array.isArray(list) ? list : []).map((x: any) => ({
            id: String(x.genreId ?? x.genre_id ?? x.id ?? x.genreName),
            name: String(x.genreName ?? x.genre_name ?? x.name ?? x),
          }));
          if (mapped.length > 0) return mapped;
        } catch {
          /* fallback */
        }
      }
      try {
        const json = await jikanEnqueue(() =>
          fetchJson("https://api.jikan.moe/v4/genres/anime?filter=genres"),
        );
        const mapped = (json?.data ?? [])
          .filter((x: any) => x.count > 60)
          .slice(0, 75)
          .map((x: any) => ({ id: String(x.mal_id), name: x.name }));
        if (mapped.length > 0) return mapped;
      } catch {
        /* fallback statis */
      }
      return [
        "Action","Adventure","Comedy","Drama","Fantasy","Horror","Mecha","Music","Mystery",
        "Psychological","Romance","Sci-Fi","Slice of Life","Sports","Supernatural","Thriller",
      ].map((n, i) => ({ id: String(i + 1), name: n }));
    }),
});

export const animeByGenre = action({
  args: { genreId: v.string(), page: v.optional(v.number()) },
  handler: async (runCtx, { genreId, page = 1 }) => {
    const r = (await withFallback(
      runCtx,
      `genre:${genreId}:${page}`,
      async () =>
        odList(
          await fetchJson(`${apiBase()}/otakudesu/genre/${encodeURIComponent(genreId)}?page=${page}`),
        ),
      async () => {
        const data = await jikanList(
          `anime?genres=${encodeURIComponent(genreId)}&page=${page}&limit=24&order_by=members&sort=desc&sfw`,
        );
        if (data.length > 0) return data;
        return null;
      },
    )) as AnimeCard[] | null;
    return r && r.length > 0 ? r : rotateByDate(FALLBACK_TOP, 12);
  },
});

// Katalog lengkap: ambil banyak halaman sekaligus (50 item per halaman).
const browseQuery = (page: number, where: string, sort = "POPULARITY_DESC") =>
  `query{ Page(page:${page}, perPage:50){ media(type:ANIME, sort:${sort}, isAdult:false${where ? ", " + where : ""}){ ${ANILIST_FIELDS} } } }`;

const BROWSE_WHERE = {
  movie: "format:MOVIE",
  ova: "format_in:[OVA,ONA]",
  special: "format:SPECIAL",
  // Donghua menggantikan Special di deretan kategori Home.
  donghua: "format:DONGHUA",
  upcoming: "status:NOT_YET_RELEASED",
  popular: "",
} as const;

const seasonQuery = (page: number, s: string, y: number) =>
  `query{ Page(page:${page}, perPage:50){ media(type:ANIME, sort:POPULARITY_DESC, isAdult:false, season:${s}, seasonYear:${y}, format_in:[TV,TV_SHORT]){ ${ANILIST_FIELDS} } } }`;

/**
 * Katalog lengkap: Movie / OVA / Special / Upcoming / Season ini.
 * `page` dipakai frontend untuk "muat lebih banyak" (tiap halaman 50 item).
 */
export const animeBrowse = action({
  args: {
    kind: v.union(
      v.literal("movie"),
      v.literal("ova"),
      v.literal("special"),
      v.literal("donghua"),
      v.literal("season"),
      v.literal("upcoming"),
      v.literal("popular"),
    ),
    page: v.optional(v.number()),
  },
  handler: async (runCtx, { kind, page }) => {
    const p = Math.max(1, Math.min(6, Math.round(page ?? 1)));
    return cached(runCtx, `browse:v3:${kind}:${p}`, 6 * 60 * 60 * 1000, async () => {
      const now = new Date();
      const year = now.getUTCFullYear();
      const season = ["WINTER", "SPRING", "SUMMER", "FALL"][
        Math.floor(((now.getUTCMonth() + 1) % 12) / 3)
      ];
      const only = (media: any[]) =>
        (Array.isArray(media) ? media : [])
          .filter((m) => m?.idMal)
          .map(anilistCard);
      try {
        if (kind === "season") {
          const d = await aniGraphql(seasonQuery(p, season, year));
          const list = only(d?.Page?.media);
          return list.length >= 8 ? list : await fbList(FALLBACK_SEASON, 12);
        }
        const where = BROWSE_WHERE[kind as keyof typeof BROWSE_WHERE];
        const d = await aniGraphql(browseQuery(p, where));
        // Donghua: TIDAK ada fallback statis (lihat catatan di `donghuaList`).
        // Kalau AniList tidak mengembalikan apa-apa, hasilnya kosong — itu
        // lebih jujur daripada menampilkan judul anime berlabel "Donghua".
        return only(d?.Page?.media);
      } catch {
        if (kind === "season") return fbList(FALLBACK_SEASON, 12);
        return [];
      }
    });
  },
});

export const animeSimilar = action({
  args: { id: v.string() },
  handler: async (runCtx, { id }) =>
    cached(runCtx, `similar:${id}`, DETAIL_TTL, async () => {
      const malId = Number(String(id).replace(/\D/g, ""));
      if (!malId) return [];
      try {
        const d = await aniGraphql(
          `query($id:Int){ Media(idMal:$id, type:ANIME){ recommendations(sort:RATING_DESC, perPage:14){ nodes{ mediaRecommendation{ ${ANILIST_FIELDS} } } } } }`,
          { id: malId },
        );
        const nodes = d?.Media?.recommendations?.nodes ?? [];
        return nodes
          .map((n: any) => n?.mediaRecommendation)
          .filter((m: any) => m?.idMal)
          .map((m: any) => anilistCard(m));
      } catch {
        return [];
      }
    }),
});

export const animeDetail = action({
  args: {
    id: v.string(),
    source: v.optional(v.string()),
    title: v.optional(v.string()),
  },
  handler: async (runCtx, { id, source, title }) => {
    const detail = (await cached(
      runCtx,
      `detail:${source ?? "auto"}:${id}:${title ?? ""}`,
      DETAIL_TTL,
      async () => {
      const raw = String(id ?? "").trim();
      const isMalId = /^\d+$/.test(raw);
      const malId = isMalId ? raw : raw.replace(/\D/g, "");
      // 1) Otakudesu untuk kartu yang memang dari otakudesu (id-nya slug,
      //    bukan MAL id — mencampur keduanya bikin judul ketuker). Dipakai juga
      //    kalau id-nya sama sekali bukan angka, karena itu pasti bukan MAL id.
      if ((source === "otakudesu" || !isMalId) && apiBase()) {
        try {
          return await otakuDetail(raw);
        } catch {
          /* lanjut */
        }
      }
      // 2) AniList by MAL id (utama): judul & poster selalu cocok dengan kartu.
      if (malId) {
        try {
          const d = await anilistDetail(malId);
          if (d) return d;
        } catch {
          /* lanjut */
        }
      }
      // 2b) Id tidak dikenal sebagai MAL id, tapi kartu membawa judulnya.
      // Cari judul itu di AniList supaya sinopsis, studio, rating, dan jumlah
      // episodenya benar — bukan lagiplaceholder "Anime" yang kosong.
      const wanted = String(title ?? "").trim();
      if (wanted.length > 2) {
        try {
          const d = await aniGraphql(
            `query($s:String){ Page(page:1, perPage:5){ media(type:ANIME, search:$s, sort:SEARCH_MATCH){ ${ANILIST_FIELDS} } } }`,
            { s: wanted },
          );
          const hit = (d?.Page?.media ?? []).find((m: any) => m?.idMal);
          if (hit?.idMal) {
            const found = await anilistDetail(String(hit.idMal));
            if (found) {
              // Judul dari kartu lebih dikenal user daripada hasil pencarian,
              // tapi id tetap memakai id kartu supaya URL tidak berubah.
              return { ...found, id: raw, title: wanted || found.title };
            }
          }
        } catch {
          /* lanjut */
        }
      }
      // 3) Jikan (cadangan, sering kena rate limit).
      if (malId) {
        try {
          return await jikanDetail(malId);
        } catch {
          /* lanjut */
        }
      }
      // 4) Katalog fallback statis.
      const card = [...FALLBACK_TOP, ...FALLBACK_SEASON].find((c) => c.id === malId);
      if (card) {
        const eps = synthEpisodes(
          { mal_id: card.id, episodes: card.episodes ?? 12 },
          [],
        );
        return {
          ...card,
          genres: [],
          synopsis: card.synopsis ?? "Sinopsis belum tersedia.",
          synopsisId: card.synopsis,
          totalEpisodes: eps.length,
          episodeList: eps,
        } as AnimeDetail;
      }
      // 5) Terakhir. Placeholder "Anime" hanya muncul kalau benar-benar tidak
      //    ada data sama sekali. Kalau kartu membawa judul, judul itu tetap
      //    dipakai supaya halaman tidak menampilkan teks generik.
      const eps = synthEpisodes({ mal_id: malId || "0", episodes: 1 }, []);
      return {
        source: "fallback" as const,
        id: raw,
        title: wanted || "Anime",
        image: "",
        status: "Ongoing",
        type: "TV",
        genres: [],
        synopsis: "Informasi anime belum tersedia.",
        synopsisId: "Informasi anime belum tersedia.",
        totalEpisodes: eps.length,
        episodeList: eps,
      } as AnimeDetail;
      },
    )) as AnimeDetail;

    // Cache genre terpisah dengan kunci pendek & stabil. Query `genreTaste`
    // (activities.ts) membacanya dari dalam query — query Convex tidak boleh
    // fetch ke luar, jadi genres harus sudah tersimpan di sini lebih dulu.
    const genres = Array.isArray(detail?.genres) ? detail!.genres : [];
    if (genres.length > 0) {
      await runCtx.runMutation(internal.anime.cacheSet, {
        endpoint: `genres:${id}`,
        payload: { genres },
      });
    }
    return detail;
  },
});

/**
 * Jadwal rilis yang benar: AniList memberi jam tayang berikutnya tiap anime
 * yang sedang airing (nextAiringEpisode.airingAt), jadi kita tahu hari DAN jam
 * episodenya tayang, bukan cuma "hari apa".
 */
export const animeAiringSchedule = action({
  args: {},
  handler: async () => {
    const query = `query ($page:Int){
      Page(page:$page, perPage:50){
        pageInfo{ hasNextPage }
        media(type:ANIME, status:RELEASING, sort:POPULARITY_DESC, isAdult:false, countryOfOrigin:JP){
          id idMal
          title{ romaji english native }
          coverImage{ extraLarge large }
          averageScore
          episodes
          format
          status
          nextAiringEpisode{ episode airingAt timeUntilAiring }
        }
      }
    }`;
    const all: any[] = [];
    try {
      for (let page = 1; page <= 3; page++) {
        const d: any = await aniGraphql(query, { page });
        const media = d?.Page?.media ?? [];
        all.push(...media);
        if (!d?.Page?.pageInfo?.hasNextPage) break;
      }
    } catch {
      return [];
    }

    const DAY_ID = [
      "Minggu",
      "Senin",
      "Selasa",
      "Rabu",
      "Kamis",
      "Jumat",
      "Sabtu",
    ];
    const out: Record<
      string,
      {
        id: string;
        title: string;
        image: string;
        episode: number;
        airingAt: number;
        day: string;
        time: string;
        score?: number;
      }[]
    > = {};
    for (const key of DAY_ID) out[key] = [];

    for (const m of all) {
      const ep = m?.nextAiringEpisode;
      if (!ep?.airingAt) continue;
      // Convex berjalan di UTC, jadi jam & hari harus dihitung sendiri dalam
      // zona WIB (UTC+7) supaya yang tampil benar di perangkat user.
      const d = new Date(ep.airingAt * 1000 + 7 * 3600_000);
      const day = DAY_ID[d.getUTCDay()];
      const hh = String(d.getUTCHours()).padStart(2, "0");
      const mm = String(d.getUTCMinutes()).padStart(2, "0");
      out[day].push({
        id: String(m?.idMal ?? m?.id ?? ""),
        title:
          m?.title?.romaji ?? m?.title?.english ?? m?.title?.native ?? "Tanpa judul",
        image: m?.coverImage?.extraLarge ?? m?.coverImage?.large ?? "",
        episode: Number(ep.episode ?? 0),
        airingAt: Number(ep.airingAt) * 1000,
        day,
        time: `${hh}:${mm}`,
        score: m?.averageScore ? Math.round(m.averageScore / 10) : undefined,
      });
    }
    for (const key of DAY_ID)
      out[key].sort((a, b) => a.airingAt - b.airingAt);
    return out;
  },
});

export type TodayAiring = {
  id: string;
  title: string;
  image: string;
  episode: number;
  airingAt: number;
  /** Jam rilis dalam zona waktu user, mis. "19:30 WIB". */
  timeLabel: string;
  score?: number;
};

/** Zona waktu yang dipakai di label jam, urut dari yang paling umum. */
const ZONES: { label: string; offsetMin: number }[] = [
  { label: "WIB", offsetMin: 420 },
  { label: "WITA", offsetMin: 480 },
  { label: "WIT", offsetMin: 540 },
  { label: "GMT", offsetMin: 0 },
];

/** Ambil zona waktu browser user, fallback ke WIB. */
function userZone(): { label: string; offsetMin: number } {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const guess = new Intl.DateTimeFormat(undefined, {
      timeZoneName: "shortOffset",
    })
      .formatToParts(new Date())
      .find((p) => p.type === "timeZoneName")?.value;
    const m = guess?.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
    if (m) {
      const mins =
        (Number(m[2]) * 60 + Number(m[3] ?? 0)) * (m[1] === "-" ? -1 : 1);
      const known = ZONES.find((z) => z.offsetMin === mins);
      return known ?? { label: tz, offsetMin: mins };
    }
  } catch {
    /* fallback */
  }
  return ZONES[0];
}

/** Awal hari (00:00) menurut zona waktu user, dalam ms epoch. */
function startOfLocalDay(nowMs: number, offsetMin: number): number {
  const local = new Date(nowMs + offsetMin * 60_000);
  return Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate(),
  ) - offsetMin * 60_000;
}

/** "19:30 WIB" dari timestamp tayang, mengikuti zona waktu user. */
export function airingLabel(airingAtMs: number): string {
  const z = userZone();
  const d = new Date(airingAtMs + z.offsetMin * 60_000);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm} ${z.label}`;
}

/**
 * Anime yang benar-benar rilis episode baru HARI INI, lengkap dengan jam
 * tayangnya. Dipakai "Anime Update News" supaya isinya bukan sekadar
 * anime sedang tayang, tapi yang episodenya benar-benar keluar hari ini.
 */
export const animeTodayAiring = action({
  args: { limit: v.optional(v.number()) },
  handler: async (runCtx, { limit }) =>
    cached(runCtx, "anime:today-airing", 30 * 60 * 1000, async () => {
      // AniList punya airing schedule resmi per hari; itu sumber paling
      // akurat untuk "anime yang episodenya benar-benar keluar hari ini".
      const z = userZone();
      const now = Date.now();
      const dayStart = startOfLocalDay(now, z.offsetMin);
      const dayEnd = dayStart + 24 * 3600_000;
      const query = `query ($start:Int, $end:Int, $page:Int){
        Page(page:$page, perPage:50){
          pageInfo{ hasNextPage }
          airingSchedules(airingAt_greater: $start, airingAt_lesser: $end, sort: TIME){
            episode
            airingAt
            media{
              id idMal
              title{ romaji english native }
              coverImage{ extraLarge large }
              averageScore
              format
            }
          }
        }
      }`;
      const all: any[] = [];
      try {
        for (let page = 1; page <= 2; page++) {
          const d: any = await aniGraphql(query, {
            start: Math.floor(dayStart / 1000),
            end: Math.floor(dayEnd / 1000),
            page,
          });
          all.push(...(d?.Page?.airingSchedules ?? []));
          if (!d?.Page?.pageInfo?.hasNextPage) break;
        }
      } catch {
        return [] as TodayAiring[];
      }
      const seen = new Set<string>();
      const out: TodayAiring[] = [];
      for (const s of all) {
        const m = s?.media;
        if (!m || s?.airingAt == null) continue;
        const key = `${m.id}-${s.episode}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const airingAt = Number(s.airingAt) * 1000;
        out.push({
          id: String(m.idMal ?? m.id ?? ""),
          title:
            m?.title?.romaji ?? m?.title?.english ?? m?.title?.native ?? "Tanpa judul",
          image: m?.coverImage?.extraLarge ?? m?.coverImage?.large ?? "",
          episode: Number(s.episode ?? 0),
          airingAt,
          timeLabel: airingLabel(airingAt),
          score: m?.averageScore ? Math.round(m.averageScore / 10) : undefined,
        });
      }
      out.sort((a, b) => a.airingAt - b.airingAt);
      return out.slice(0, Math.max(1, limit ?? 12));
    }),
});

export const animeSchedule = action({
  args: {},
  handler: async (runCtx) =>
    cached(runCtx, "schedule", 6 * 60 * 60 * 1000, async () => {
      if (apiBase()) {
        try {
          const json = await fetchJson(`${apiBase()}/otakudesu/schedule`);
          const days = json?.data?.days ?? json?.data ?? [];
          const out: Record<string, AnimeCard[]> = {};
          for (const d of Array.isArray(days) ? days : []) {
            const day = String(d.day ?? d.dayName ?? "").toLowerCase();
            out[day] = (d.animeList ?? []).map((a: any) => ({
              source: "otakudesu" as const,
              id: a.animeId ?? a.anime_id ?? "",
              title: a.title ?? a.animeTitle ?? "",
              image: a.poster ?? a.image ?? "",
              score: a.score ? odNum(a.score) : undefined,
            }));
          }
          if (Object.keys(out).length > 0) return out;
        } catch {
          /* fallback */
        }
      }
      // Jikan schedule = 7 request; jalankan berurutan lewat antrean.
      const out: Record<string, AnimeCard[]> = {};
      try {
        for (const day of DAY_FILTER) {
          out[day] = await jikanList(`schedules?filter=${day}&limit=12&sfw`).catch(() => []);
        }
      } catch {
        /* fallback statis */
      }
      if (Object.values(out).every((v) => v.length === 0)) {
        for (let i = 0; i < DAY_FILTER.length; i++) {
          out[DAY_FILTER[i]] = pick(FALLBACK_SEASON, i * 2, 6);
        }
      }
      return out;
    }),
});

export const animeEpisode = action({
  args: { animeId: v.string(), episodeId: v.string(), source: v.optional(v.string()) },
  handler: async (runCtx, { animeId, episodeId, source }) =>
    cached(runCtx, `episode:${source ?? "auto"}:${episodeId}`, 6 * 60 * 60 * 1000, async () => {
      // 0) MegaPlay (aktif, embed HLS, terima MAL ID) — sumber utama utk katalog jikan/fallback
      const mm = episodeId.match(/^(\d+)__ep(\d+)$/);
      if (mm) {
        const malId = mm[1];
        const epNum = Math.max(1, Number(mm[2]) || 1);
        return {
          episodeId,
          animeId,
          title: `Episode ${epNum}`,
          sources: [
            {
              label: "MegaPlay SUB",
              url: `https://megaplay.buzz/stream/mal/${malId}/${epNum}/sub`,
              type: "embed",
            },
            {
              label: "MegaPlay DUB",
              url: `https://megaplay.buzz/stream/mal/${malId}/${epNum}/dub`,
              type: "embed",
            },
          ],
          demo: false,
        };
      }
      // 1) Penyedia otakudesu: resolve server streaming (iframe/mp4)
      if (apiBase() && source !== "jikan" && !episodeId.includes("__ep")) {
        try {
          const json = await fetchJson(`${apiBase()}/otakudesu/episode/${encodeURIComponent(episodeId)}`);
          const d = json?.data ?? {};
          const servers = d.serverList ?? d.server ?? [];
          const sources: { label: string; url: string; type: string }[] = [];
          for (const s of (Array.isArray(servers) ? servers : []).slice(0, 4)) {
            const sid = s.serverId ?? s.server_id ?? s.id;
            if (!sid) continue;
            try {
              const sv = await fetchJson(`${apiBase()}/otakudesu/server/${encodeURIComponent(sid)}`);
              const url = sv?.data?.iframeUrl ?? sv?.data?.url ?? sv?.data?.streamUrl;
              if (url)
                sources.push({
                  label: sv?.data?.serverName ?? s.serverName ?? "Server",
                  url,
                  type: String(url).includes(".mp4") || String(url).endsWith(".m3u8") ? "mp4" : "embed",
                });
            } catch {
              /* skip server */
            }
          }
          if (sources.length > 0)
            return { episodeId, animeId, title: d.title ?? episodeId, sources, demo: false };
        } catch {
          /* fallback demo */
        }
      }
      // 2) Mode demo: player berfungsi penuh dengan video sampel
      const num = Number(episodeId.split("__ep")[1] ?? "1") || 1;
      const demos = [
        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4",
      ];
      return {
        episodeId,
        animeId,
        title: `Episode ${num}`,
        sources: [{ label: "YoruNime Demo", url: demos[num % demos.length], type: "mp4" }],
        demo: true,
      };
    }),
});
