// YoruNime — penyedia data anime (Otakudesu via ANIME_API_BASE + Jikan rate-limit guard + fallback statis)
import { v } from "convex/values";
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

function apiBase(): string | null {
  const base = process.env.ANIME_API_BASE;
  return base && base.startsWith("http") ? base.replace(/\/+$/, "") : null;
}

const LIST_TTL = 15 * 60 * 1000;
const DETAIL_TTL = 60 * 60 * 1000;

// ------------------------------------------------------------ normalize ----

export type AnimeCard = {
  source: "otakudesu" | "jikan" | "fallback";
  id: string;
  title: string;
  image: string;
  score?: number;
  episodes?: number;
  type?: string;
  status?: string;
  releaseDay?: string;
  synopsis?: string;
};

export type EpisodeItem = {
  id: string;
  number: number;
  title: string;
  duration?: string;
  aired?: string;
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
  const total = Math.min(a.episodes ?? 12, 24) || 12;
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
    episodeList,
  };
}

// -------------------------------------------------------- otakudesu ol ----

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

async function otakuDetail(id: string): Promise<AnimeDetail> {
  const base = apiBase()!;
  const json = await fetchJson(`${base}/otakudesu/anime/${encodeURIComponent(id)}`);
  const d = json?.data ?? {};
  const genres = (d.genres ?? []).map((x: any) =>
    typeof x === "string" ? x : (x.genreName ?? x.name ?? ""),
  );
  const raw = d.episodeList ?? d.data?.episodeList ?? [];
  const episodeList: EpisodeItem[] = (Array.isArray(raw) ? raw : []).map((e: any, i: number) => {
    const title = e.episodeTitle ?? e.title ?? e.episode ?? `Episode ${i + 1}`;
    const num = odNum(e.episodeTitle ?? e.episode ?? title) ?? i + 1;
    return {
      id: e.episodeId ?? e.episode_id ?? `${id}__ep${num}`,
      number: num,
      title,
      aired: e.uploadedOn ?? e.releaseDate ?? undefined,
      duration: "24 menit",
    };
  });
  const status = String(d.status ?? "");
  return {
    source: "otakudesu",
    id,
    title: d.title ?? id,
    image: d.poster ?? "",
    score: d.score ? odNum(d.score) : undefined,
    status: status.includes("Ongoing") ? "Ongoing" : status.includes("Completed") ? "Completed" : "OVA",
    synopsis: String(d.synopsis ?? "").replace(/<[^>]*>/g, "").trim(),
    genres,
    studio: d.studios ?? undefined,
    rating: d.rating ?? undefined,
    totalEpisodes: episodeList.length,
    episodeList,
  };
}

// ------------------------------------------------- fallback katalog statis ----

function fb(title: string, id: string, score: number, year: number, status: string, synopsis: string): AnimeCard {
  return {
    source: "fallback",
    id,
    title,
    image: "",
    score,
    status,
    type: "TV",
    synopsis: `${title} (${year}). ${synopsis}`,
  };
}

export const FALLBACK_TOP: AnimeCard[] = [
  fb("Frieren: Beyond Journey's End", "52991", 9.3, 2023, "Completed", "Penyihir elf berkeliling menengok kembali perjalanan masa lalunya."),
  fb("Fullmetal Alchemist: Brotherhood", "5114", 9.1, 2009, "Completed", "Dua bersaudara alkimia mencari Batu Filsafat untuk mengembalikan tubuh mereka."),
  fb("Steins;Gate", "9253", 9.0, 2011, "Completed", "Ilmuwan gila menemukan cara mengirim pesan ke masa lalu lewat microwave."),
  fb("Hunter x Hunter (2011)", "11061", 9.0, 2011, "Completed", "Gon berlatih jadi Hunter demi mencari ayahnya."),
  fb("Attack on Titan", "16498", 8.9, 2013, "Completed", "Manusia bertahan di balik tembok dari serangan Titan raksasa."),
  fb("Demon Slayer", "38000", 8.8, 2019, "Completed", "Tanjiro memburu iblis untuk menyembuhkan adiknya."),
  fb("Jujutsu Kaisen", "40748", 8.7, 2020, "Completed", "Siswa SMA menelan jari kutukan dan masuk dunia jujutsu."),
  fb("One Punch Man", "30276", 8.6, 2015, "Completed", "Pahlawan yang mengalahkan musuh dengan satu pukulan mencari tantangan."),
  fb("Death Note", "1535", 8.9, 2006, "Completed", "Siswa menemukan buku yang bisa membunuh siapa pun namanya ditulis."),
  fb("Sousou no Frieren S2", "58567", 9.0, 2026, "Ongoing", "Kelanjutan perjalanan Frieren dan rombongannya."),
  fb("Spy x Family Season 3", "54595", 8.6, 2026, "Ongoing", "Keluarga mata-mata paling tidak biasa di dunia."),
  fb("One Piece", "21", 8.7, 1999, "Ongoing", "Bajak laut topi jerami berlayar mencari One Piece."),
  fb("Vinland Saga S2", "49387", 8.8, 2023, "Completed", "Thorfinn mencari kedamaian setelah masa perbudakannya."),
  fb("Chainsaw Man", "44511", 8.5, 2022, "Completed", "Denji hidup dengan ibu jantung berantai mesin."),
  fb("Mob Psycho 100 III", "51009", 8.6, 2022, "Completed", "Esper muda belajar hidup normal."),
  fb("Bocchi the Rock!", "47917", 8.7, 2022, "Completed", "Gitaris pemalu bergabung dengan band sekolah."),
  fb("Oshi no Ko", "52034", 8.6, 2023, "Completed", "Dunia gelap industri idola Jepang."),
  fb("My Hero Academia S7", "53119", 8.0, 2024, "Completed", "Sekolah pahlawan super generasi baru."),
  fb("Blue Lock S2", "54392", 8.1, 2024, "Completed", "Program pelatihan striker paling brutal."),
  fb("Dandadan", "56895", 8.5, 2024, "Completed", "Hantu, alien, dan cinta remaja yang kacau."),
];

export const FALLBACK_SEASON: AnimeCard[] = [
  fb("Sakamoto Days", "58673", 7.8, 2026, "Ongoing", "Pembunuh legendaris pensiun jadi pemilik minimarket."),
  fb("Kaiju No. 8 S2", "56704", 8.2, 2026, "Ongoing", "Pria dewasa berubah jadi kaiju dan ikut pasukan pertahanan."),
  fb("Gachiakuta", "58712", 7.9, 2026, "Ongoing", "Anak buangan turun ke dunia sampah penuh monster."),
  fb("Grand Blue S2", "54457", 8.4, 2026, "Ongoing", "Klub penyelaman paling kacau di kampus."),
  fb("Call of the Night S2", "54087", 8.0, 2026, "Ongoing", "Vampir dan bocah yang jatuh cinta pada malam."),
  fb("Zom 100: Bucket List", "48736", 7.6, 2023, "Completed", "Daftar keinginan saat kiamat zombie."),
  fb("Undead Unluck", "47917", 7.8, 2023, "Completed", "Gadis pembawa sial vs pria abadi."),
  fb("Solo Leveling S2", "52299", 8.3, 2026, "Ongoing", "Hunter terlemah bangkit sebagai Shadow Monarch."),
  fb("Tensei Slime S3", "52347", 8.0, 2024, "Ongoing", "Rimu bertransformasi jadi raja iblis."),
  fb("Apothecary Diaries S2", "54492", 8.7, 2026, "Ongoing", "Ahli racun istana memecahkan misteri."),
  fb("Wind Breaker S2", "56771", 7.9, 2026, "Ongoing", "Geng sekolah pelindung kota."),
  fb("Fire Force S3", "55791", 8.0, 2026, "Ongoing", "Regu pemadam melawan pembakar manusia."),
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

export const animeOngoing = action({
  args: { page: v.optional(v.number()) },
  handler: async (runCtx, { page = 1 }) => {
    const r = (await withFallback(
      runCtx,
      `ongoing:${page}`,
      async () => odList(await fetchJson(`${apiBase()}/otakudesu/ongoing?page=${page}`)),
      async () => {
        const season = await jikanList("seasons/now?limit=24&sfw");
        if (season.length > 0) return season;
        return null;
      },
    )) as AnimeCard[] | null;
    return r && r.length > 0 ? r : rotateByDate([...FALLBACK_SEASON, ...FALLBACK_TOP], LIMIT);
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
    const r = (await withFallback(
      runCtx,
      "top",
      async () => null, // otakudesu tidak punya ranking global
      async () => {
        const tv = await jikanList("top/anime?limit=10&type=tv&sfw");
        if (tv.length > 0) return tv;
        return null;
      },
    )) as AnimeCard[] | null;
    return r && r.length > 0 ? r.slice(0, 10) : FALLBACK_TOP.slice(0, 10);
  },
});

export const animeTrendingToday = action({
  args: {},
  handler: async (runCtx) => {
    const day = DAY_FILTER[(new Date().getDay() + 6) % 7];
    const r = (await withFallback(
      runCtx,
      `trending:${day}`,
      async () => null,
      async () => {
        const sched = await jikanList(`schedules?filter=${day}&limit=10&sfw`);
        if (sched.length > 0) return sched;
        return null;
      },
    )) as AnimeCard[] | null;
    return r && r.length > 0 ? r.slice(0, 10) : rotateByDate(FALLBACK_TOP, 10);
  },
});

export const animeForYou = action({
  args: { seed: v.optional(v.number()) },
  handler: async (runCtx, { seed = 0 }) => {
    const r = (await withFallback(
      runCtx,
      `foryou:${seed % 5}`,
      async () => null,
      async () => {
        const base = await jikanList("top/anime?limit=12&sfw");
        const season = await jikanList("seasons/now?limit=12&sfw").catch(() => [] as AnimeCard[]);
        const all = [...base, ...season];
        if (all.length === 0) return null;
        const start = (seed * 7) % Math.max(1, all.length - 12);
        return all.slice(start, start + 12);
      },
    )) as AnimeCard[] | null;
    if (r && r.length > 0) return r.slice(0, 12);
    return rotateByDate(FALLBACK_TOP, 12);
  },
});

export const animeSearch = action({
  args: { q: v.string() },
  handler: async (runCtx, { q }) => {
    const query = q.trim();
    if (query.length === 0) return [];
    const lower = query.toLowerCase();
    // 1) coba otakudesu
    if (apiBase()) {
      try {
        const r = odList(await fetchJson(`${apiBase()}/otakudesu/search?q=${encodeURIComponent(query)}`));
        if (r.length > 0) return r;
      } catch {
        /* lanjut */
      }
    }
    // 2) coba cache dulu
    const row = (await runCtx.runQuery(
      internal.anime.cacheGet,
      { endpoint: `search:${lower}` },
    )) as { payload?: unknown; updatedAt?: number } | null;
    if (row && row.updatedAt && Date.now() - row.updatedAt < LIST_TTL)
      return (row.payload as AnimeCard[]) ?? [];
    // 3) jikan
    try {
      const r = await jikanList(
        `anime?q=${encodeURIComponent(query)}&limit=24&order_by=members&sort=desc&sfw`,
      );
      if (r.length > 0) {
        await runCtx.runMutation(internal.anime.cacheSet, { endpoint: `search:${lower}`, payload: r });
        return r;
      }
    } catch {
      /* lanjut */
    }
    // 4) fallback statis
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

export const animeDetail = action({
  args: { id: v.string(), source: v.optional(v.string()) },
  handler: async (runCtx, { id, source }) =>
    cached(runCtx, `detail:${source ?? "auto"}:${id}`, DETAIL_TTL, async () => {
      if (apiBase() && source !== "jikan") {
        try {
          return await otakuDetail(id);
        } catch {
          /* fallback jikan */
        }
      }
      if (source === "fallback" || /^\d+$/.test(id) === false) {
        // fallback statis punya id angka juga; biarkan jikan mencoba
      }
      return jikanDetail(id);
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
