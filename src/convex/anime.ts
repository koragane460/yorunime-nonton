// LStream — penyedia data anime (Otakudesu-compatible + fallback Jikan)
//
// Sumber data:
//  - Jika env ANIME_API_BASE diisi (mis. deployment pribadi wajik-anime-api /
//    scraper otakudesu lain), katalog diambil dari sana: /otakudesu/ongoing,
//    /otakudesu/search, /otakudesu/anime/{id}, /otakudesu/episode/{id},
//    /otakudesu/schedule, /otakudesu/genre/{id}.
//  - Tanpa env itu, fallback otomatis ke Jikan (MyAnimeList) supaya aplikasi
//    tetap hidup dengan data nyata (top, musim ini, jadwal, detail, episode).
//    Player episode memakai stream demo bila tidak ada penyedia streaming.
//
// Semua hasil dicache di tabel animeCache agar hemat kuota & cepat.

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
      await ctx.db.insert("animeCache", {
        endpoint,
        payload,
        updatedAt: Date.now(),
      });
  },
});

async function cached(
  runCtx: { runQuery: any; runMutation: any },
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

// ---------------------------------------------------------------- fetch ----

async function getJson(url: string): Promise<any> {
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "LStream/1.0" },
  });
  if (!res.ok) throw new Error(`Upstream ${res.status}: ${url}`);
  return await res.json();
}

function apiBase(): string | null {
  const base = process.env.ANIME_API_BASE;
  return base && base.startsWith("http") ? base.replace(/\/+$/, "") : null;
}

const LIST_TTL = 10 * 60 * 1000;
const DETAIL_TTL = 60 * 60 * 1000;

// ------------------------------------------------------------ normalize ----

export type AnimeCard = {
  source: "otakudesu" | "jikan";
  id: string;
  title: string;
  image: string;
  score?: number;
  episodes?: number;
  type?: string;
  status?: string; // Ongoing | Completed | OVA | Movie | ...
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

const DAY_FILTER = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

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
    synopsis: a.synopsis ?? undefined,
  };
}

async function jikanList(path: string): Promise<AnimeCard[]> {
  const data = await getJson(`https://api.jikan.moe/v4/${path}`);
  return (data?.data ?? []).map(jikanCard);
}

async function jikanDetail(id: string): Promise<AnimeDetail> {
  const data = await getJson(`https://api.jikan.moe/v4/anime/${id}/full`);
  const a = data?.data;
  if (!a) throw new Error("Anime tidak ditemukan");
  const epsRes = await getJson(
    `https://api.jikan.moe/v4/anime/${id}/episodes`,
  ).catch(() => null);
  const episodeList: EpisodeItem[] = (epsRes?.data ?? []).map((e: any, i: number) => ({
    id: `${id}__ep${e.mal_id ?? i + 1}`,
    number: e.mal_id ?? i + 1,
    title: e.title ?? `Episode ${e.mal_id ?? i + 1}`,
    aired: e.aired ?? undefined,
    duration: a.duration?.split("per")[0]?.trim(),
  }));
  if (episodeList.length === 0 && (a.episodes ?? 0) > 0) {
    for (let i = 1; i <= Math.min(a.episodes!, 60); i++) {
      episodeList.push({
        id: `${id}__ep${i}`,
        number: i,
        title: `Episode ${i}`,
        duration: a.duration?.split("per")[0]?.trim(),
      });
    }
  }
  return {
    ...jikanCard(a),
    genres: (a.genres ?? []).map((g: any) => g.name),
    studio: a.studios?.[0]?.name,
    rating: a.rating,
    year: a.year ?? a.aired?.prop?.from?.year ?? undefined,
    synopsis: a.synopsis ?? "",
    totalEpisodes: a.episodes ?? episodeList.length,
    episodeList,
  };
}

// --------------------------------------------------------- otakudesu ol ----

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
    synopsis: a.synopsis ?? undefined,
  }));
}

function odEpisodeList(detail: any, animeId: string): EpisodeItem[] {
  const raw = detail?.episodeList ?? detail?.data?.episodeList ?? [];
  return (Array.isArray(raw) ? raw : []).map((e: any, i: number) => {
    const title = e.episodeTitle ?? e.title ?? e.episode ?? `Episode ${i + 1}`;
    const num = odNum(e.episodeTitle ?? e.episode ?? title) ?? i + 1;
    return {
      id: e.episodeId ?? e.episode_id ?? `${animeId}__ep${num}`,
      number: num,
      title,
      aired: e.uploadedOn ?? e.releaseDate ?? undefined,
      duration: "24 menit",
    };
  });
}

async function otakuDetail(id: string): Promise<AnimeDetail> {
  const base = apiBase()!;
  const json = await getJson(`${base}/otakudesu/anime/${encodeURIComponent(id)}`);
  const d = json?.data ?? {};
  const genres = (d.genres ?? []).map((g: any) =>
    typeof g === "string" ? g : (g.genreName ?? g.name ?? ""),
  );
  const episodeList = odEpisodeList(d, id);
  const status = String(d.status ?? "");
  return {
    source: "otakudesu",
    id,
    title: d.title ?? id,
    image: d.poster ?? "",
    score: d.score ? odNum(d.score) : undefined,
    episodes: odNum(d.episodes ?? d.totalEpisode),
    status: status.includes("Ongoing")
      ? "Ongoing"
      : status.includes("Completed")
        ? "Completed"
        : "OVA",
    synopsis: String(d.synopsis ?? "").replace(/<[^>]*>/g, "").trim(),
    genres,
    studio: d.studios ?? undefined,
    rating: d.rating ?? undefined,
    year: odNum(d.japanese ? "" : "") ?? undefined,
    totalEpisodes: episodeList.length,
    episodeList,
  };
}

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
    return jk();
  });
}

export const animeOngoing = action({
  args: { page: v.optional(v.number()) },
  handler: async (runCtx, { page = 1 }) =>
    withFallback(
      runCtx,
      `ongoing:${page}`,
      async () => odList(await getJson(`${apiBase()}/otakudesu/ongoing?page=${page}`)),
      () => jikanList(`seasons/now?limit=24&page=${page}`),
    ),
});

export const animeCompleted = action({
  args: { page: v.optional(v.number()) },
  handler: async (runCtx, { page = 1 }) =>
    withFallback(
      runCtx,
      `completed:${page}`,
      async () => odList(await getJson(`${apiBase()}/otakudesu/completed?page=${page}`)),
      () => jikanList("top/anime?limit=24&type=tv"),
    ),
});

export const animeTop = action({
  args: {},
  handler: async (runCtx) =>
    cached(runCtx, "top", LIST_TTL, () =>
      jikanList("top/anime?limit=25&filter=bypopularity"),
    ),
});

export const animeTrendingToday = action({
  args: {},
  handler: async (runCtx) => {
    const day = DAY_FILTER[(new Date().getDay() + 6) % 7];
    return cached(runCtx, `trending:${day}`, 6 * 60 * 60 * 1000, () =>
      jikanList(`schedules?filter=${day}&limit=20&sfw`),
    );
  },
});

export const animeForYou = action({
  args: { seed: v.optional(v.number()) },
  handler: async (runCtx, { seed = 0 }) =>
    cached(runCtx, `foryou:${seed % 5}`, LIST_TTL, async () => {
      const base = await jikanList("top/anime?limit=25");
      const season = await jikanList("seasons/now?limit=25").catch(() => []);
      const all = [...base, ...season];
      const start = (seed * 7) % Math.max(1, all.length - 12);
      return all.slice(start, start + 12);
    }),
});

export const animeSearch = action({
  args: { q: v.string() },
  handler: async (runCtx, { q }) => {
    const query = q.trim();
    if (query.length === 0) return [];
    return withFallback(
      runCtx,
      `search:${query.toLowerCase()}`,
      async () => odList(await getJson(`${apiBase()}/otakudesu/search?q=${encodeURIComponent(query)}`)),
      async () =>
        jikanList(
          `anime?q=${encodeURIComponent(query)}&limit=24&order_by=members&sort=desc&sfw`,
        ),
    );
  },
});

export const animeGenres = action({
  args: {},
  handler: async (runCtx) =>
    cached(runCtx, "genres", 7 * 24 * 3600 * 1000, async () => {
      if (apiBase()) {
        try {
          const json = await getJson(`${apiBase()}/otakudesu/genre`);
          const list = json?.data?.genreList ?? json?.data ?? [];
          return (Array.isArray(list) ? list : []).map((g: any) => ({
            id: g.genreId ?? g.genre_id ?? g.id ?? g.genreName,
            name: g.genreName ?? g.genre_name ?? g.name ?? String(g),
          }));
        } catch {
          /* fallback */
        }
      }
      const json = await getJson("https://api.jikan.moe/v4/genres/anime");
      return (json?.data ?? []).slice(0, 75).map((g: any) => ({
        id: String(g.mal_id),
        name: g.name,
      }));
    }),
});

export const animeByGenre = action({
  args: { genreId: v.string(), page: v.optional(v.number()) },
  handler: async (runCtx, { genreId, page = 1 }) =>
    withFallback(
      runCtx,
      `genre:${genreId}:${page}`,
      async () =>
        odList(
          await getJson(
            `${apiBase()}/otakudesu/genre/${encodeURIComponent(genreId)}?page=${page}`,
          ),
        ),
      async () => {
        const data = await getJson(
          `https://api.jikan.moe/v4/anime?genres=${encodeURIComponent(genreId)}&page=${page}&limit=24&order_by=members&sort=desc&sfw`,
        );
        return (data?.data ?? []).map(jikanCard);
      },
    ),
});

export const animeDetail = action({
  args: { id: v.string(), source: v.optional(v.string()) },
  handler: async (runCtx, { id, source }) =>
    cached(runCtx, `detail:${source ?? "auto"}:${id}`, DETAIL_TTL, async () => {
      if (source === "otakudesu" || (source !== "jikan" && apiBase())) {
        try {
          return await otakuDetail(id);
        } catch {
          /* fallback jikan */
        }
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
          const json = await getJson(`${apiBase()}/otakudesu/schedule`);
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
      const out: Record<string, AnimeCard[]> = {};
      for (const day of DAY_FILTER) {
        try {
          out[day] = await jikanList(`schedules?filter=${day}&limit=15&sfw`);
        } catch {
          out[day] = [];
        }
      }
      return out;
    }),
});

export const animeEpisode = action({
  args: { animeId: v.string(), episodeId: v.string(), source: v.optional(v.string()) },
  handler: async (runCtx, { animeId, episodeId, source }) =>
    cached(
      runCtx,
      `episode:${source ?? "auto"}:${episodeId}`,
      6 * 60 * 60 * 1000,
      async () => {
        // 1) Penyedia otakudesu (kalau dikonfigurasi): resolve server streaming.
        if (apiBase() && source !== "jikan" && !episodeId.includes("__ep")) {
          try {
            const json = await getJson(
              `${apiBase()}/otakudesu/episode/${encodeURIComponent(episodeId)}`,
            );
            const d = json?.data ?? {};
            const servers = d.serverList ?? d.server ?? [];
            const sources: { label: string; url: string; type: string }[] = [];
            for (const s of (Array.isArray(servers) ? servers : []).slice(0, 4)) {
              const sid = s.serverId ?? s.server_id ?? s.id;
              if (!sid) continue;
              try {
                const sv = await getJson(
                  `${apiBase()}/otakudesu/server/${encodeURIComponent(sid)}`,
                );
                const url = sv?.data?.iframeUrl ?? sv?.data?.url ?? sv?.data?.streamUrl;
                if (url)
                  sources.push({
                    label: sv?.data?.serverName ?? s.serverName ?? "Server",
                    url,
                    type: String(url).includes(".mp4") ? "mp4" : "iframe",
                  });
              } catch {
                /* skip server */
              }
            }
            if (sources.length > 0) {
              return {
                episodeId,
                animeId,
                title: d.title ?? episodeId,
                sources,
                demo: false,
              };
            }
          } catch {
            /* fallback demo */
          }
        }
        // 2) Mode demo (tanpa penyedia streaming): player tetap berfungsi penuh.
        const num = Number(episodeId.split("__ep")[1] ?? "1") || 1;
        return {
          episodeId,
          animeId,
          title: `Episode ${num}`,
          sources: [
            {
              label: "LStream Demo",
              url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
              type: "mp4",
            },
          ],
          demo: true,
        };
      },
    ),
});
