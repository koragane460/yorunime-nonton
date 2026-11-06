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
  // Hasil KOSONG / null TIDAK ikut di-cache: sekali upstream (AniList/Jikan)
  // gagal atau kena rate limit, kartu anime boleh jadi abu-abu tanpa gambar
  // selama berjam-jam karena entri kosong itu menempel di cache. Tanpa ini,
  // baris Movie/OVA/Season di Home bisa kosong terus sampai TTL habis.
  const empty =
    payload === null ||
    payload === undefined ||
    (Array.isArray(payload) && payload.length === 0);
  if (!empty) {
    await runCtx.runMutation(internal.anime.cacheSet, { endpoint, payload });
  }
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
  /** Judul terjemahan Inggris — ditampilkan kecil di bawah judul asli. */
  titleEnglish?: string;
  studio?: string;
  rating?: string;
  year?: number;
  /** Musim tayang, mis. "Winter 2024" (badge di layar nonton). */
  seasonLabel?: string;
  synopsis: string;
  totalEpisodes: number;
  episodeList: EpisodeItem[];
  /** Video trailer YouTube (tombol "Cuplikan"). */
  trailerUrl?: string;
};

// ------------------------------------------------------------- jikan ol ----

const DAY_FILTER = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];

function jikanStatus(a: any): string {
  const t = String(a.type ?? "");
  if (t === "OVA" || t === "ONA" || t === "Special") return "OVA";
  if (t === "Movie") return "Movie";
  if (a.status === "Currently Airing") return "Ongoing";
  if (a.status === "Not yet aired") {
    // Sumber sering menahan "Not yet aired" padahal tanggal tayang pertama
    // sudah lewat; kalau begitu sebenarnya sudah tayang.
    const from = Date.parse(String(a.aired?.from ?? ""));
    if (!Number.isNaN(from) && from <= Date.now()) return "Ongoing";
    return "Upcoming";
  }
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
  // Anime yang masih tayang: `a.episodes` hanyalah rencana, bukan jumlah
  // episode yang sudah ada. Karena daftar aslinya tidak bisa diambil,
  // episodenya ditandai belum tayang daripada dikarang lengkap.
  const ongoing = /currently airing|airing/i.test(String(a?.status ?? ""));
  const out: EpisodeItem[] = [];
  for (let i = 1; i <= total; i++) {
    out.push({
      id: `${a.mal_id}__ep${i}`,
      number: i,
      title: `Episode ${i}`,
      duration: "24 menit",
      released: !ongoing,
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
    titleEnglish:
      typeof a.title_english === "string" && a.title_english
        ? a.title_english
        : undefined,
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
  nextAiringEpisode { episode airingAt timeUntilAiring }
  startDate { year month day }
  trailer { id site }
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

/**
 * Tanggal tayang pertama dari AniList (year/month/day) sebagai milidetik.
 * Bulan ke-0 = Januari, jadi harus di +1. Tanggal tanpa tanggal lengkap
 * tidak dipakai (year < 1900 dianggap belum jelas).
 */
function anilistStartAt(m: any): number | undefined {
  const d = m?.startDate;
  if (!d || !d.year || d.year < 1900) return undefined;
  const month = Number(d.month ?? 1) - 1;
  const day = Number(d.day ?? 1);
  if (month < 0 || month > 11 || day < 1 || day > 31) return undefined;
  return new Date(Date.UTC(d.year, month, day)).getTime();
}

/**
 * Status yang ditampilkan ke user.
 *
 * AniList sering menahan `status: NOT_YET_RELEASED` walaupun jam tayang
 * pertama sudah lewat (cache mereka jarang diperbarui). Kalau tanggal mulai
 * sudah lewat dari sekarang, judul itu sebenarnya sudah tayang, jadi
 * ditampilkan sebagai "Ongoing" supaya tidak menggantung di kategori
 * Segera Rilis selamanya.
 */
/**
 * Tanggal rilis episode ke-n (YYYY-MM-DD) dari tanggal mulai series.
 * Serial TV/ONA tayang mingguan → +7 hari per episode; movie/special hanya
 * punya satu tanggal, jadi episode lain tidak diberi tanggal.
 */
function episodeAirDate(
  startAt: number | undefined,
  number: number,
  format: string | undefined,
): string | undefined {
  if (startAt === undefined) return undefined;
  const weekly = /TV|ONA/i.test(String(format ?? ""));
  const n = Math.max(1, number);
  // Movie/special cuma satu tanggal — episode setelahnya tidak diberi tanggal.
  if (!weekly && n > 1) return undefined;
  const at = weekly ? startAt + (n - 1) * 7 * 86_400_000 : startAt;
  if (!Number.isFinite(at)) return undefined;
  return new Date(at).toISOString().slice(0, 10);
}

function anilistDisplayStatus(m: any): string | undefined {
  if (m?.status === "RELEASING") return "Ongoing";
  if (m?.status === "FINISHED") return "Completed";
  if (m?.status === "NOT_YET_RELEASED") {
    const start = anilistStartAt(m);
    // Tanggal mulai sudah lewat = sudah rilis.
    if (start !== undefined && start <= Date.now()) return "Ongoing";
    // Belum ada tanggal, tapi jadwal tayang berikutnya sudah diumumkan dan
    // waktunya sudah lewat = juga sudah rilis.
    const airing = m?.nextAiringEpisode?.airingAt;
    if (typeof airing === "number" && airing > 0 && airing <= Date.now())
      return "Ongoing";
    return "Upcoming";
  }
  return undefined;
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
    status: anilistDisplayStatus(m),
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

/**
 * Jumlah episode yang benar-benar sudah tayang, dibaca dari jadwal tayang
 * AniList.
 *
 * Media dengan `episodes: null` (season pendek, ONA, atau anthology seperti
 * "Yami Shibai 17") tidak punya jumlah total dari AniList. Kalau angka itu
 * dipakai langsung, hasilnya `null` dan UI jatuh ke fallback "1 episode",
 * padahal jadwal tayangnya sudah sampai episode 13. Jadwal airing tidak pernah
 * bohong soal nomor episode, jadi itu yang dipakai.
 */
async function anilistAiredCount(mediaId: number): Promise<number | undefined> {
  if (!Number.isFinite(mediaId) || mediaId <= 0) return undefined;
  try {
    const d = await aniGraphql(
      `query($id:Int){ Page(page:1, perPage:50){
        airingSchedules(mediaId:$id, sort: EPISODE_DESC){ episode airingAt }
      } }`,
      { id: mediaId },
    );
    const nowSec = Math.floor(Date.now() / 1000);
    let top = 0;
    for (const s of d?.Page?.airingSchedules ?? []) {
      const ep = Number(s?.episode ?? 0);
      if (!Number.isFinite(ep) || ep <= 0) continue;
      // Episode yang masih dijadwalkan (airingAt di masa depan) belum bisa
      // ditonton, jadi tidak dihitung.
      if (Number(s?.airingAt ?? 0) > nowSec) continue;
      if (ep > top) top = ep;
    }
    return top > 0 ? top : undefined;
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
  // Trailer YouTube untuk tombol "Cuplikan": AniList mengisi `trailer`
  // dengan id video YouTube (site: YOUTUBE) — dipakai langsung di player.
  const ytTrailer =
    m.trailer?.site?.toUpperCase() === "YOUTUBE" && m.trailer.id
      ? `https://www.youtube.com/watch?v=${m.trailer.id}`
      : undefined;
  const card0 = card;
  const cardWithTrailer = ytTrailer
    ? { ...card0, trailerUrl: ytTrailer }
    : card0;
  // Judul yang belum tayang tidak boleh dikarang jadi episode playable.
  const upcoming = m.status === "NOT_YET_RELEASED";
  // AniList mengisi `episodes` dengan null untuk anime yang masih tayang
  // (One Piece, Naruto, dll). `nextAiringEpisode.episode` adalah episode
  // terakhir yang sudah tayang, jadi itu jumlah episode yang bisa ditonton.
  //
  // PENTING: untuk anime yang masih tayang, `episodes` adalah RENCANA total
  // (mis. season baru = 12 episode) bukan jumlah yang sudah keluar. Kalau
  // angka itu dipakai langsung, episode 4-12 ikut terlihat padahal belum
  // pernah rilis. Jadi jumlah aired diambil dari `nextAiringEpisode`, dan
  // episode setelahnya tetap ditampilkan tapi ditandai `released: false`
  // supaya UI menonaktifkannya.
  const releasing = m.status === "RELEASING";
  const airedUpTo =
    releasing && m.nextAiringEpisode?.episode
      ? Number(m.nextAiringEpisode.episode) - 1
      : undefined;
  // `m.episodes` null = AniList tidak tahu jumlah totalnya. Angka itu WAJIB
  // diisi dari jadwal tayang, tidak boleh dibiarkan null (null berakhir
  // sebagai "cuma 1 episode" di halaman detail, padahal Update News sudah
  // menulis "Ep 13" karena itu memang episode yang tayang hari itu).
  const fromSchedule =
    m.episodes == null ? await anilistAiredCount(Number(m.id)) : undefined;
  const counted = releasing
    ? (airedUpTo ?? fromSchedule ?? m.episodes)
    : (m.episodes ?? fromSchedule);
  const total = upcoming ? 0 : Math.max(1, Math.min(counted ?? 1, 3000));
  // Kalau jumlah aired diketahui pasti, tampilkan sampai episode itu saja:
  // episode lanjutan yang tidak ada pun tidak perlu dikarang.
  const listUpTo = releasing && airedUpTo ? Math.max(airedUpTo, 1) : total;
  // Judul Inggris untuk teks kecil di bawah judul asli di layar detail.
  const titleEnglish =
    typeof m.title?.english === "string" &&
    m.title.english !== m.title.romaji
      ? m.title.english
      : undefined;
  // Tanggal rilis per episode. AniList tidak mengirim tanggal tiap episode,
  // tapi sumbernya (startDate) ada — untuk serial TV satu episode per minggu,
  // jadi tanggalnya bisa dihitung jujur tanpa mengarang angka acak.
  const startAt = anilistStartAt(m);
  const episodeList: EpisodeItem[] = [];
  for (let i = 1; i <= listUpTo; i++) {
    episodeList.push({
      id: `${malId}__ep${i}`,
      number: i,
      title: `Episode ${i}`,
      aired: episodeAirDate(startAt, i, m.format),
      released: true,
      duration: m.duration ? `${m.duration} menit` : undefined,
    });
  }
  const synopsis = cardWithTrailer.synopsis ?? "Sinopsis belum tersedia.";
  const synopsisId = await translateId(synopsis);
  return {
    ...cardWithTrailer,
    genres: Array.isArray(m.genres) ? m.genres : [],
    titleEnglish,
    year: m.seasonYear ?? undefined,
    studio:
      m.studios?.nodes?.[0]?.name ??
      m.studios?.nodes?.map((n: any) => n?.name).filter(Boolean).join(", ") ??
      undefined,
    rating: m.isAdult ? "Rating 17+" : "Rating 13+",
    // Musim tayang untuk badge di layar nonton: "Winter 2024", "Summer 2026".
    seasonLabel: (() => {
      const sd = m?.startDate;
      if (!sd?.month) return undefined;
      const season =
        sd.month <= 3
          ? "Winter"
          : sd.month <= 6
            ? "Spring"
            : sd.month <= 9
              ? "Summer"
              : "Fall";
      const year = sd.year ?? m?.seasonYear;
      return year ? `${season} ${year}` : season;
    })(),
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

/** Skor Otakudesu bisa berupa "8.2" atau "82" — jangan sampai titiknya
 *  hilang dan berubah jadi 682 seperti versi lama. */
function odScore(v: any): number | undefined {
  const n = parseFloat(String(v ?? "").replace(",", ".").replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return undefined;
  let out = n;
  if (out > 100) out /= 100;
  else if (out > 10) out /= 10;
  return Math.min(10, Number(out.toFixed(1)));
}

function odList(json: any): AnimeCard[] {
  const list = json?.data?.animeList ?? json?.data ?? [];
  return (Array.isArray(list) ? list : []).map((a: any) => ({
    source: "otakudesu" as const,
    id: a.animeId ?? a.anime_id ?? a.id ?? "",
    title: a.title ?? a.animeTitle ?? "Tanpa judul",
    image: a.poster ?? a.image ?? "",
    score: a.score ? odScore(a.score) : undefined,
    episodes: a.episodes ? odNum(a.episodes) : undefined,
    type: a.type ?? a.animeType ?? "Anime",
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
  // Anime ongoing: `d.episodes` adalah rencana total, sedangkan `episodeList`
  // berisi episode yang SUDAH tayang. Episode yang benar-benar ada harus tetap
  // diploader sebagai `released: true`; hanya nomor sisanya yang ditandai
  // belum tayang. Versi sebelumnya membangun ulang seluruh daftar dari nol,
  // sehingga episode yang sudah rilis ikut ter-disable (dan kalau kebalikan,
  // episode yang belum ada terlihat lengkap).
  const episodeAll: EpisodeItem[] =
    episodeList.length >= total
      ? episodeList
      : [
          ...episodeList,
          ...Array.from({ length: total - episodeList.length }, (_, i) => {
            const number = episodeList.length + i + 1;
            return {
              id: `${id}__ep${number}`,
              number,
              title: `Episode ${number}`,
              // Sisipan ini belum tayang (anime ongoing, contoh 25 episode tapi
              // baru 14 yang rilis) — UI harus men|gray-kan dan men-disable.
              released: false,
              duration: d.duration ?? "24 menit",
            };
          }),
        ];
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
    titleEnglish:
      typeof d.title_english === "string" && d.title_english
        ? d.title_english
        : undefined,
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
  // Kunci cache WAJIB memuat `where`: tanpa itu, rekomendasi per genre
  // (reco-genre + genre_in berbeda-beda) saling menimpa di satu kunci yang
  // sama — "Untuk kamu" jadi menampilkan campuran genre salah, poster beda,
  // dan episode tidak nyambung. v3 = buang entri lama yang sudah tercemar.
  return (await cached(
    runCtx,
    // `limit` ikut jadi bagian kunci: kalau tidak, permintaan 50 judul bisa
    // memakai entri cache lama yang hanya berisi 10.
    `${endpoint}:v3:${where || "-"}:${page}:${sort}:${limit}`,
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
  // Layar "Top anime" butuh sampai 50 judul; Home tetap boleh minta 10.
  args: { limit: v.optional(v.number()) },
  handler: async (runCtx, { limit }) => {
    const n = Math.min(Math.max(Math.floor(limit ?? 10) || 10, 1), 50);
    // Urut POPULARITY_DESC (paling populer di AniList di atas) — bukan skor
    // rating — supaya Top 1-50 = yang paling banyak ditonton/ditambahkan.
    const r = await aniList("top", LIST_TTL, runCtx, "", 1, n, "POPULARITY_DESC");
    if (r && r.length > 0) return r.slice(0, n);
    try {
      const tv = await jikanList(`top/anime?limit=${n}&type=tv&sfw`);
      if (tv.length > 0) return tv.slice(0, n);
    } catch {
      /* fallback statis */
    }
    return fbList(FALLBACK_TOP, n);
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

/**
 * Poster & judul ASLI dari AniList untuk sekumpulan id.
 *
 * Favorite menyimpan judul+poster saat pertama kali ditekan, jadi kalau
 * anime itu favorit dari kartu fallback (atau dari sumber lain), poster di
 * "Favorite Kamu" tidak sama dengan yang tampil di Home. Aqui ini mengambil
 * data asli dari AniList per id, jadi kartu favorit memakai gambar yang
 * sama dengan katalog dan epitope yang dibuka benar-benar milik anime itu.
 */
export const realCards = action({
  args: { ids: v.array(v.string()) },
  handler: async (runCtx, { ids }) => {
    const out: Record<string, { id: string; title: string; image: string }> = {};
    const list = (ids ?? []).filter((s) => !!String(s ?? "").trim()).slice(0, 40);
    for (const raw of list) {
      const id = String(raw).trim();
      if (out[id]) continue;
      const asInt = /^\d+$/.test(id);
      // AniList menolak query yang mengirim `id` dan `idMal` sekaligus, jadi
      // dua bentuk dicoba terpisah: MAL id dulu (dipakai seluruh katalog),
      // lalu id AniList.
      const variants: { q: string; vars: Record<string, number> }[] = asInt
        ? [
            {
              q: `query($idMal:Int){ Media(idMal:$idMal, type:ANIME){ id idMal title{ romaji english native } coverImage{ extraLarge large } } }`,
              vars: { idMal: Number(id) },
            },
            {
              q: `query($id:Int){ Media(id:$id, type:ANIME){ id idMal title{ romaji english native } coverImage{ extraLarge large } } }`,
              vars: { id: Number(id) },
            },
          ]
        : [];
      for (const v of variants) {
        const d: any = await aniGraphql(v.q, v.vars).catch(() => null);
        const m = d?.Media;
        if (!m) continue;
        out[id] = {
          id: String(m.idMal ?? m.id ?? id),
          title: m?.title?.romaji ?? m?.title?.english ?? m?.title?.native ?? "",
          image: m?.coverImage?.extraLarge ?? m?.coverImage?.large ?? "",
        };
        break;
      }
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
    // v2: entri cache lama pernah berisi objek mentah (name bukan string) yang
    // membuat chip genre di Pencarian tampil "[object Object]".
    cached(runCtx, "genres:v2", 7 * 24 * 3600 * 1000, async () => {
      // Satu nilai bisa datang sebagai string, objek berlabel, atau objek
      // yang menempel langsung — ambil nama dari bentuk apapun supaya chip
      // tidak pernah menampilkan "[object Object]".
      const asName = (val: any): string => {
        if (typeof val === "string") return val;
        if (val && typeof val === "object") {
          for (const k of ["name", "genreName", "genre_name", "romaji", "title"]) {
            const v2 = (val as Record<string, unknown>)[k];
            if (typeof v2 === "string" && v2.trim()) return v2.trim();
            if (v2 && typeof v2 === "object") {
              const inner = asName(v2);
              if (inner) return inner;
            }
          }
        }
        return "";
      };
      const asId = (val: any, name: string): string => {
        if (typeof val === "string" || typeof val === "number")
          return String(val).trim() || name.toLowerCase();
        return name.toLowerCase();
      };
      const harden = (list: any[]): { id: string; name: string }[] =>
        (Array.isArray(list) ? list : [])
          .map((x: any) => {
            const name = asName(
              typeof x === "object" && x !== null
                ? (x.genreName ?? x.genre_name ?? x.name ?? x)
                : x,
            );
            const rawId =
              x && typeof x === "object"
                ? (x.genreId ?? x.genre_id ?? x.mal_id ?? x.id)
                : x;
            return { id: asId(rawId, name), name };
          })
          .filter((g) => g.id && g.name && !g.name.includes("[object"));

      if (apiBase()) {
        try {
          const json = await fetchJson(`${apiBase()}/otakudesu/genre`);
          const list = json?.data?.genreList ?? json?.data ?? [];
          const mapped = harden(list);
          if (mapped.length > 0) return mapped;
        } catch {
          /* fallback */
        }
      }
      try {
        const json = await jikanEnqueue(() =>
          fetchJson("https://api.jikan.moe/v4/genres/anime?filter=genres"),
        );
        const mapped = harden(json?.data ?? []).slice(0, 75);
        if (mapped.length > 0) return mapped;
      } catch {
        /* fallback statis */
      }
      // Fallback statis — daftar LENGKAP genre AniList (permintaan: genre
      // kurang lengkap, tambahin lagi). Dikombinasikan dengan hasil API di
      // bawah supaya tidak pernah kosong dan tidak ada dobel.
      const STATIC_GENRES = [
        "Action","Adventure","Comedy","Drama","Fantasy","Horror","Mecha","Music","Mystery",
        "Psychological","Romance","Sci-Fi","Slice of Life","Sports","Supernatural","Thriller",
        "Cars","Avant Garde","Children","Dementia","Demons","Ecchi","Family","Game",
        "Harem","Historical","Isekai","Josei","Kids","Military","Parody","Police",
        "Seinen","Shoujo","Shoujo Ai","Shounen","Shounen Ai","Space","Super Power",
        "Samurai","Vampire","Yaoi","Yuri","Detective","Dining","Medical",
        "Organized Crime","Pet","Philosophy","Survival","Theatre","Crossdressing",
      ]
        .map((n) => n.trim())
        .filter(Boolean)
        .map((n, i) => ({ id: String(i + 1), name: n }));
      return STATIC_GENRES;
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

/**
 * Filter genre MULTI: semua genre yang dipilih harus ada di judul (irisan).
 * Nama genre dikirim dari client (dari animeGenres) dan dicocokkan langsung
 * ke AniList pakai `and:[{genre:"X"},{genre:"Y"}]`.
 */
export const animeByGenres = action({
  args: { genres: v.array(v.string()), page: v.optional(v.number()) },
  handler: async (runCtx, { genres, page = 1 }) => {
    const names = (genres ?? [])
      .map((g) => String(g ?? "").trim())
      .filter(Boolean)
      .slice(0, 6);
    if (names.length === 0) return [] as AnimeCard[];
    const key = `genres-multi:${names
      .map((n) => n.toLowerCase())
      .sort()
      .join("+")}:${Math.max(1, Math.round(page))}`;
    return (await cached(runCtx, key, LIST_TTL, async () => {
      try {
        const where = `and:[${names
          .map((n) => `genre:"${n.replace(/["\\]/g, "")}"`)
          .join(",")}]`;
        const d = await aniGraphql(browseQuery(Math.max(1, Math.round(page)), where));
        const list = (d?.Page?.media ?? [])
          .filter((m: any) => m?.idMal)
          .map(anilistCard);
        if (list.length > 0) return list.slice(0, 24);
      } catch {
        /* AniList gagal → kirim kosong, client tetap punya daftar sebelumnya */
      }
      return [] as AnimeCard[];
    })) as AnimeCard[];
  },
});

/**
 * Karakter anime (AniList) untuk bagian "Character" di detail.
 * Dicari lewat idMal; kalau tidak ada (mis. donghua), dicoba lewat judul.
 * Detail karakter digabung jadi satu teks tanpa label: peran, umur, VA,
 * lalu bio pendek — sesuai permintaan UI.
 */
export const animeCharacters = action({
  args: { idMal: v.optional(v.string()), title: v.optional(v.string()) },
  handler: async (runCtx, { idMal, title }) => {
    const id = String(idMal ?? "").trim();
    const t = String(title ?? "").trim();
    if (!id && !t) return [];
    // v2: cache lama (v1) menyimpan hasil 1 karakter — dipaksa refetch.
    // v3: cache v2 masih menyimpan penjelasan berformat markdown (__Height:__).
    const key = `chars:v3:${id || t.toLowerCase()}`;
    type Char = {
      id: string;
      name: string;
      image: string;
      meta: string;
      bio: string;
    };
    const query = String.raw`
      query($idMal:Int,$s:String){
        Media(idMal:$idMal, type:ANIME){
          characters(perPage:24, sort:[FAVOURITES_DESC,ROLE_DESC]){
            edges{
              role
              node{
                id
                name{ full }
                image{ large }
                description(asHtml: false)
                age
                dateOfBirth { year month day }
              }
              voiceActors(language:JAPANESE){ name{ full } }
            }
          }
        }
      }`;
    const queryByTitle = String.raw`
      query($s:String){
        Media(search:$s, type:ANIME){
          characters(perPage:24, sort:[FAVOURITES_DESC,ROLE_DESC]){
            edges{
              role
              node{
                id
                name{ full }
                image{ large }
                description(asHtml: false)
                age
                dateOfBirth { year month day }
              }
              voiceActors(language:JAPANESE){ name{ full } }
            }
          }
        }
      }`;
    return (await cached(runCtx, key, 12 * 3600 * 1000, async () => {
      const vars: Record<string, unknown> = {};
      if (id) vars.idMal = Number(id);
      if (!id && t) vars.s = t;
      const months = [
        "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
        "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
      ];
      const fmt = (d: any): string =>
        d?.year
          ? `${d.day ? `${d.day} ` : ""}${d.month ? `${months[d.month - 1] ?? ""} ` : ""}${d.year}`
          : "";
      // AniList menolak idMal + search sekaligus: coba by id dulu, lalu by judul.
      let edges: any[] =
        (await aniGraphql(id ? query : queryByTitle, vars)
          .then((d: any) => d?.Media?.characters?.edges)
          .catch(() => null)) ??
        (id && t
          ? await aniGraphql(queryByTitle, { s: t })
              .then((d: any) => d?.Media?.characters?.edges)
              .catch(() => null)
          : null) ??
        [];
      // Manga/manhwa: di AniList tipenya MANGA. Kalau pencarian ANIME kosong
      // (judul komik yang tidak punya adaptasi anime), ulangi pakai type MANGA
      // supaya bagian "Character" di detail manga/manhwa tetap terisi.
      if (edges.length === 0 && t) {
        edges =
          (await aniGraphql(queryByTitle.replace("type:ANIME", "type:MANGA"), {
            s: t,
          })
            .then((d: any) => d?.Media?.characters?.edges)
            .catch(() => null)) ?? [];
      }
      // Donghua / judul bercampur: kalau judul mentah tidak ditemukan, coba
      // judul yang DISIHKAN — tanda kurung ((Dub), Season 2) dan karakter
      // non-Latin dibuang dulu, karena AniList sering tidak cocok dengan judul
      // sumber donghua apa adanya.
      if (edges.length === 0 && t) {
        const t2 = t
          .replace(/\([^)]*\)/g, " ")
          .replace(/\[[^\]]*\]/g, " ")
          .replace(/[^\x20-\x7E]+/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        if (t2 && t2.toLowerCase() !== t.toLowerCase()) {
          for (const ty of ["ANIME", "MANGA"] as const) {
            edges =
              (await aniGraphql(queryByTitle.replace("type:ANIME", `type:${ty}`), {
                s: t2,
              })
                .then((d: any) => d?.Media?.characters?.edges)
                .catch(() => null)) ?? [];
            if (edges.length > 0) break;
          }
        }
      }
      try {
        const out: Char[] = [];
        for (const e of edges) {
          const n = e?.node;
          const name = String(n?.name?.full ?? "").trim();
          if (!name) continue;
          const role =
            e?.role === "MAIN"
              ? "Utama"
              : e?.role === "SUPPORTING"
                ? "Pendukung"
                : "";
          const va = Array.isArray(e?.voiceActors)
            ? String(e.voiceActors[0]?.name?.full ?? "")
            : "";
          const bits = [role, n?.age ? `${String(n.age)} tahun` : "", fmt(n?.dateOfBirth), va ? `VA: ${va}` : ""]
            .filter(Boolean)
            .join(" · ");
          const bio = String(n?.description ?? "")
            .replace(/<[^>]+>/g, " ")
            // Penjelasan karakter dari AniList kadang membawa formatting
            // markdown (`__Height:__ 172 cm`, `**tebal**`) — simbolnya
            // dibersihkan supaya penjelasan terbaca wajar di UI.
            .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
            .replace(/(__|\*\*|~~)(.+?)\1/g, "$2")
            .replace(/(^|[^*])\*([^*]+)\*/g, "$1$2")
            .replace(/^#{1,6}\s*/gm, "")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 320);
          out.push({
            id: String(n?.id ?? out.length),
            name,
            image: String(n?.image?.large ?? ""),
            meta: bits,
            bio,
          });
          if (out.length >= 20) break;
        }
        return out;
      } catch {
        return [] as Char[];
      }
    })) as Char[];
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
  ongoing: "status:RELEASING",
  completed: "status:FINISHED",
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
    // "donghua" sengaja TIDAK ada di sini. Katalog ini milik AniList, jadi
    // kind donghua di sini hanya bisa mengembalikan judul anime — persis bug
    // "kartu donghua tapi titled anime". Donghua dilayani SankaVollereii lewat
    // src/convex/sanka.ts.
    kind: v.union(
      v.literal("movie"),
      v.literal("ova"),
      v.literal("special"),
      v.literal("season"),
      v.literal("upcoming"),
      v.literal("ongoing"),
      v.literal("completed"),
      v.literal("popular"),
    ),
    page: v.optional(v.number()),
  },
  handler: async (runCtx, { kind, page }) => {
    const p = Math.max(1, Math.min(6, Math.round(page ?? 1)));
    // v4: buang entri lama — kunci v3 pernah menyimpan hasil KOSONG saat
    // AniList kena rate limit, sehingga kartu anime tampil tanpa gambar.
    return cached(runCtx, `browse:v4:${kind}:${p}`, 6 * 60 * 60 * 1000, async () => {
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
        const list = only(d?.Page?.media);
        if (list.length > 0) return list;
        // AniList kosong/gagal → pakai katalog statis yang GAMBARNYA sudah
        // pasti ada, supaya baris tidak pernah jadi kartu abu-abu tanpa poster.
        return await fbList([...FALLBACK_TOP, ...FALLBACK_SEASON], 12);
      } catch {
        if (kind === "season") return fbList(FALLBACK_SEASON, 12);
        return await fbList([...FALLBACK_TOP, ...FALLBACK_SEASON], 12);
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
    // Lebih baik tetap memakai cache: detail = metadata + daftar episode.
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
const DAY_ID = [
  "Minggu",
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
];

type AiringDay = {
  id: string;
  title: string;
  image: string;
  episode: number;
  airingAt: number;
  day: string;
  time: string;
  score?: number;
};

function emptyAiring(): Record<string, AiringDay[]> {
  const out: Record<string, AiringDay[]> = {};
  for (const key of DAY_ID) out[key] = [];
  return out;
}

/** Jadwal mingguan dari AniList (nextAiringEpisode per judul releasing). */
async function airingFromAniList(): Promise<Record<string, AiringDay[]>> {
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
    return emptyAiring();
  }

  const out = emptyAiring();
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
  for (const key of DAY_ID) out[key].sort((a, b) => a.airingAt - b.airingAt);
  return out;
}

/** Fallback Jikan (MyAnimeList) — dipakai kalau AniList gagal/rate-limit,
    supaya layar Jadwal tidak pernah kosong. */
async function airingFromJikan(): Promise<Record<string, AiringDay[]>> {
  const out = emptyAiring();
  for (const filter of DAY_FILTER) {
    try {
      const data = await jikanEnqueue(() =>
        fetchJson(`https://api.jikan.moe/v4/schedules?filter=${filter}&limit=100&sfw=true`),
      );
      for (const a of data?.data ?? []) {
        const startMs = Date.parse(String(a.airing_start ?? ""));
        if (Number.isNaN(startMs)) continue;
        const d = new Date(startMs + 7 * 3600_000);
        const day = DAY_ID[d.getUTCDay()];
        const hh = String(d.getUTCHours()).padStart(2, "0");
        const mm = String(d.getUTCMinutes()).padStart(2, "0");
        out[day].push({
          id: String(a.mal_id ?? ""),
          title: a.title ?? "Tanpa judul",
          image:
            a.images?.webp?.large_image_url ?? a.images?.jpg?.large_image_url ?? "",
          episode: Number(a.episodes ?? 0),
          airingAt: startMs,
          day,
          time: `${hh}:${mm}`,
          score: typeof a.score === "number" ? a.score : undefined,
        });
      }
    } catch {
      /* lanjut ke hari berikutnya */
    }
  }
  for (const key of DAY_ID) out[key].sort((a, b) => a.airingAt - b.airingAt);
  return out;
}

// Cache payload jadwal — `runCtx` sengaja dianotasikan `any` supaya tipe
// `internal` (yang menyertakan aksi ini sendiri) tidak bikin inferensi
// melingkar (TS7022).
async function scheduleCacheGet(
  runCtx: any,
  endpoint: string,
): Promise<{ updatedAt: number; payload: any } | null> {
  try {
    return await runCtx.runQuery(internal.anime.cacheGet, { endpoint });
  } catch {
    return null;
  }
}
async function scheduleCacheSet(
  runCtx: any,
  endpoint: string,
  payload: unknown,
) {
  try {
    await runCtx.runMutation(internal.anime.cacheSet, { endpoint, payload });
  } catch {
    /* cache tidak wajib */
  }
}

export const animeAiringSchedule = action({
  args: {},
  handler: async (runCtx): Promise<Record<string, AiringDay[]>> => {
    // Cache 2 jam supaya layar Jadwal tidak menembak AniList/Jikan tiap
    // dibuka (dulu tanpa cache → rawan rate-limit → "0 judul" terus).
    // Hasil KOSONG tidak pernah di-cache supaya kegagalan sesaat tidak
    // menempel dua jam.
    const KEY = "airing-schedule-weekly:v1";
    const TTL = 2 * 60 * 60 * 1000;
    const row = await scheduleCacheGet(runCtx, KEY);
    const full =
      row &&
      Object.values(row.payload ?? {}).some(
        (v: any) => Array.isArray(v) && v.length > 0,
      );
    if (row && full && Date.now() - row.updatedAt < TTL) return row.payload;

    let out = await airingFromAniList();
    const empty = Object.values(out).every((v) => v.length === 0);
    if (empty) out = await airingFromJikan();

    const anyData = Object.values(out).some((v) => v.length > 0);
    if (anyData) await scheduleCacheSet(runCtx, KEY, out);
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
    // Key cache ikut limit: Home meminta 14, Jadwal meminta 60. Kalau key-nya
    // sama, layar pertama yang cached (=14) dipakai juga untuk Jadwal sehingga
    // judul yang tayang hari ini tapi tidak muncul di sana.
    cached(runCtx, `anime:today-airing:${limit ?? 12}`, 30 * 60 * 1000, async () => {
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
        all.length = 0;
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
      // Fallback Jikan: kalau AniList gagal/rate-limit (all kosong), ambil
      // jadwal tayang hari ini dari MyAnimeList supaya tidak pernah kosong.
      if (all.length === 0) {
        try {
          const data = await jikanEnqueue(() =>
            fetchJson("https://api.jikan.moe/v4/schedules?limit=100&sfw=true"),
          );
          for (const a of data?.data ?? []) {
            const startMs = Date.parse(String(a.airing_start ?? ""));
            if (Number.isNaN(startMs) || startMs < dayStart || startMs >= dayEnd)
              continue;
            const key = `${a.mal_id}`;
            if (seen.has(key)) continue;
            seen.add(key);
            out.push({
              id: String(a.mal_id ?? ""),
              title: a.title ?? "Tanpa judul",
              image:
                a.images?.webp?.large_image_url ??
                a.images?.jpg?.large_image_url ??
                "",
              episode: Number(a.episodes ?? 0),
              airingAt: startMs,
              timeLabel: airingLabel(startMs),
              score: typeof a.score === "number" ? a.score : undefined,
            });
          }
        } catch {
          /* jaring pengaman */
        }
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
