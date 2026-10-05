"use node";
// YoruNime — klien SankaVollereii REST API (sumber donghua).
//
// Base: https://www.sankavollerei.web.id
//   GET /anime/:source/home          → daftar terbaru
//   GET /anime/:source/search/:query → pencarian judul
//   GET /anime/:source/detail/:slug  → detail + sinopsis + genre + episode
//   GET /anime/:source/episode/:slug → daftar server embed
//
// CATATAN PENTING soal gate "Plana AI Detector":
// Endpoint tertentu membalas 403 dengan `{"status":"Plana AI Detector"}`
// kalau diakses tanpa header browser. Sebagian source (otakudesu,
// kuramanime, animeindo) memang memblokir seperti itu; sisanya tetap hidup.
// Jadi setiap request selalu mengirim User-Agent + Referer, dan pemanggil
// mencoba source satu per satu sampai ada yang menjawab.
//
// SUMBER DONGHUA: `donghub` dipakai LEBIH DULU daripada `donghua`.
// Alasannya nyata, bukan selera:
//  1. `donghua` menyimpan katalog per-EPISODE, jadi judul di detail jadi
//     "Judul Episode 08 Subtitle Indonesia" dan sinopsisnya kosong.
//  2. `donghua` tidak pernah mengisi `episode_number` (selalu null), sehingga
//     nomor episodenya harus ditebak dari teks judul.
//  3. Server video `donghua` semuanya berlabel [ADS] (RPMShare, Earnvids,
//     Abyss, StreamHG) —_player iframe berat dan penuh iklan.
// `donghub` memakai slug PER-SERIES ("beyond-times-gaze"), `episode` berisi
// nomor asli ("42"), dan server utamanya Dailymotion yang jauh lebih ringan.
// `donghua` tetap dipakai sebagai cadangan kalau donghub tidak punya judulnya.
import { v } from "convex/values";
import { action } from "./_generated/server";

const BASE = "https://www.sankavollerei.web.id";

const b64url = (u: string) => Buffer.from(u, "utf8").toString("base64url");

/**
 * Host poster donghua (donghive.vip) memakai proteksi hotlink: gambar
 * dibalas 403 untuk request dari browser dan responsnya membawa
 * `Cross-Origin-Resource-Policy: same-origin`, jadi <img> menampilkannya
 * sebagai kotak hitam. Route /img di http.ts mengambil gambarnya di sisi
 * server lalu mengirimkannya sebagai response same-origin.
 */
function proxyImage(u?: string | null): string {
  const s = typeof u === "string" ? u.trim() : "";
  if (!s || !/^https:\/\//i.test(s)) return "";
  try {
    new URL(s);
  } catch {
    return "";
  }
  return `${process.env.CONVEX_SITE_URL ?? ""}/img?u=${b64url(s)}`;
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

/** Header wajib; tanpa ini server membalas 403 "Plana AI Detector". */
function headers(): Record<string, string> {
  return {
    "User-Agent": UA,
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "id-ID,id;q=0.9,en;q=0.8",
    Referer: `${BASE}/anime`,
  };
}

/**
 * Request JSON dengan timeout. Mengembalikan `null` kalau source sedang mati
 * atau memblokir — pemanggil lalu mencoba source berikutnya, bukan gagal
 * seluruhnya.
 */
async function sankaGet(
  path: string,
  timeoutMs = 15_000,
): Promise<Record<string, any> | null> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: headers(),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as Record<string, unknown>;
    // Gate anti-bot kadang balas status 200 dengan field status berisi
    // "Plana AI Detector", jadi harus diperiksa di body, bukan cuma HTTP.
    if (typeof j?.status === "string" && /detector/i.test(j.status)) return null;
    return j as Record<string, any>;
  } catch {
    return null;
  }
}

export type SankaAnime = {
  title: string;
  slug: string;
  poster?: string;
  status?: string;
  type?: string;
  rating?: string | number;
  current_episode?: string | number;
};

/**
 * Bentuk pembanding judul: huruf kecil, tanpa tanda baca, spasi rapat. Dipakai
 * untuk mencocokkan judul hasil search dengan judul di jadwal, karena keduanya
 * kadang beda tipis ("Againts the Sky Supreme" vs "Against the Sky Supreme").
 */
function norm(s: string): string {
  return String(s ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9 ]/g, "")
    .trim();
}

/**
 * Kemiripan dua judul 0-100. Bukan Exact: ejaan di sumber sering tidak sama
 * ("Againts" vs "Against"), jadi yang dibandingkan adalah berapa banyak kata
 * dari judul yang lebih pendek yang muncul di judul yang lebih panjang.
 */
function titleSimilarity(a: string, b: string): number {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return 0;
  if (x === y) return 100;
  const ax = x.split(" ").filter((w) => w.length > 1);
  const ay = y.split(" ").filter((w) => w.length > 1);
  if (ax.length === 0 || ay.length === 0) return 0;
  const [small, big] = ax.length <= ay.length ? [ax, ay] : [ay, ax];
  const pool = new Set(big);
  const hit = small.filter((w) => pool.has(w)).length;
  return Math.round((hit / small.length) * 100);
}

/**
 * Bersihkan judul dari "nama seri\t\t\tnama episode" yang dipakai donghub.
 * API menyatukan keduanya dengan beberapa tab; yang dibutuhkan user adalah nama
 * serinya saja supaya kartu tidak menulis "Judul Episode 08 Subtitle Indonesia".
 */
function cleanTitle(raw: unknown): string {
  const first = String(raw ?? "").split("\t")[0];
  return first.replace(/\s+/g, " ").trim();
}

/**
 * Buang ekor "Episode 08 Subtitle Indonesia" dari judul supaya yang tampil
 * adalah nama serinya.
 */
function stripEpisodeSuffix(title: string): string {
  return title
    .replace(/\s*[-–]?\s*episode\s*\d+\s*(subtitle\s*indonesia)?\s*$/i, "")
    .trim();
}

/**
 * Slug seri dari slug per-episode.
 *
 * Pola yang muncul di data nyata:
 *   "x-episode-42-subtitle-indonesia"  → "x"
 *   "x-episode-42"                    → "x"
 *   "x"                               → "x"  (tidak diubah)
 */
function seriesSlug(slug: string): string {
  const cut = slug.replace(/-episode-\d+.*$/i, "");
  return cut.length > 0 ? cut : slug;
}

function toCard(x: any): SankaAnime | null {
  const rawTitle = cleanTitle(x?.title);
  const slug = String(x?.slug ?? "").trim();
  if (!slug) return null;
  // `episode` di donghub bernilai "42" (string) atau "Ongoing"; kalau tidak
  // ada, nomornya diambil dari teks judul. Kalau pun keduanya tidak memberi
  // nomor, slug-nya tetap dinormalkan ke slug seri: kartu tanpa nomor pun
  // harus membuka detail seri utuh, bukan satu episode.
  const epRaw = x?.current_episode ?? x?.episode;
  const epNum = parseEpisodeNumber(epRaw) || parseEpisodeNumber(rawTitle);
  const title = stripEpisodeSuffix(rawTitle) || rawTitle;
  return {
    title,
    slug: seriesSlug(slug),
    poster: x.poster ? String(x.poster) : undefined,
    status: x.status && x.status !== "Unknown" ? String(x.status) : undefined,
    type: x.type ? String(x.type) : undefined,
    rating: x.rating,
    current_episode: epNum > 0 ? epNum : undefined,
  };
}

/**
 * Nomor episode dari berbagai bentuk nilai: 7, "7", "Ep 08", "Episode 08
 * Subtitle Indonesia", atau null. Semua sumber punya setidaknya salah satu
 * bentuk ini — tidak ada yang bisa_andalkan `episode_number` saja karena
 * `donghua` selalu mengisinya dengan null.
 */
function parseEpisodeNumber(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw)) return Math.trunc(raw);
  const m = String(raw ?? "").match(/(\d+)/);
  const n = m ? Number(m[1]) : 0;
  return Number.isFinite(n) ? n : 0;
}

/** Ambil list dari respons apa pun bentuknya (tiap source beda struktur). */
function pickList(j: Record<string, any> | null): any[] {
  if (!j) return [];
  // donghub membungkus daftar di `data.{slider,popular,latest}`.
  const d = j.data;
  if (d && typeof d === "object" && !Array.isArray(d)) {
    for (const key of ["latest", "popular", "slider"]) {
      const val = d[key];
      if (Array.isArray(val) && val.length > 0) return val;
    }
  }
  for (const key of [
    "anime_list",
    "latest_release",
    "completed_donghua",
    "data",
    "results",
    "anime",
  ]) {
    const val = j[key];
    if (Array.isArray(val) && val.length > 0) return val;
  }
  // Fallback: scan nilai apa pun yang berupa array of object.
  for (const val of Object.values(j)) {
    if (Array.isArray(val) && val.length > 0 && typeof val[0] === "object")
      return val;
  }
  return [];
}

/**
 * Urutan sumber donghua: `donghub` (lengkap & server ringan) lebih dulu,
 * `donghua` (per-episode, penuh iklan) sebagai cadangan.
 */
const DONGHUA_SOURCES = ["donghub", "donghua"] as const;
/**
 * Urutan sumber anime. `samehadaku` tidak dipakai di sini untuk streaming —
 * episodenya dipanggil lewat `indo.ts` yang sudah punya judul Indonesia.
 */
const ANIME_SOURCES = ["oploverz", "anoboy", "nimegami", "winbu"] as const;

/** Halaman yang diambil per sumber; cukup untuk 2 baris + layar "selengkapnya". */
const PAGE_STEP = 24;

async function fetchLatestPage(
  source: string,
  limit: number,
  page: number,
): Promise<SankaAnime[]> {
  const qs = page > 1 ? `?page=${page}` : "";
  const j = await sankaGet(`/anime/${source}/home${qs}`);
  const list = pickList(j).map(toCard).filter(Boolean) as SankaAnime[];
  return list.slice(0, Math.max(1, Math.min(40, limit)));
}

async function fetchSearch(source: string, q: string, limit: number) {
  const query = q.trim();
  if (query.length < 2) return [];
  const j = await sankaGet(
    `/anime/${source}/search/${encodeURIComponent(query)}`,
  );
  const list = pickList(j).map(toCard).filter(Boolean) as SankaAnime[];
  return list.slice(0, Math.max(1, Math.min(40, limit)));
}

/**
 * Ambil daftar donghua dari beberapa halaman sekaligus, lalu buang duplikat
 * (donghub memuat episode yang sama sebagai kartu berbeda). Halaman diambil
 * paralel supaya "lihat selengkapnya" tidak menambah satu detik per halaman.
 */
async function donghuaLatestInternal(limit: number): Promise<SankaAnime[]> {
  const pagesWanted = Math.max(1, Math.ceil(limit / PAGE_STEP));
  for (const src of DONGHUA_SOURCES) {
    const pages = await Promise.all(
      Array.from({ length: pagesWanted }, (_, i) =>
        fetchLatestPage(src, PAGE_STEP, i + 1).catch(() => []),
      ),
    );
    const seen = new Set<string>();
    const out: SankaAnime[] = [];
    for (const c of pages.flat()) {
      if (!c?.slug || seen.has(c.slug)) continue;
      seen.add(c.slug);
      out.push(c);
    }
    if (out.length > 0) return out.slice(0, Math.max(1, Math.min(120, limit)));
  }
  return [];
}

/**
 * Cari poster satu judul lewat endpoint search Sanka.
 *
 * Dipakai sebagai cadangan kalau endpoint detail gagal: sebagian judul di
 * jadwal mingguan dijawab Sanka dengan "Error fetching detail", sehingga kartu
 * tidak punya poster sama sekali dan tampil kosong di Update News. Search
 * mengembalikan poster asli, tapi slugnya bisa beda tipis dari jadwal, jadi
 * kandidat dicocokkan dari judulnya.
 */
async function donghuaPosterByTitle(title: string): Promise<string> {
  if (norm(title).length < 3) return "";
  let best = "";
  let bestScore = 0;
  for (const src of DONGHUA_SOURCES) {
    const j = await sankaGet(
      `/anime/${src}/search/${encodeURIComponent(String(title).trim())}`,
      10_000,
    );
    for (const item of pickList(j)) {
      const card = toCard(item);
      if (!card?.poster) continue;
      // Poster asli dari kartu search, jadi tidak perlu request detail lagi.
      const score = titleSimilarity(title, card.title);
      if (score > bestScore) {
        bestScore = score;
        best = proxyImage(card.poster);
      }
      if (score === 100) return best;
    }
  }
  // 80 = semua kata kunci cocok, hanya satu kata yang salah eja. Di bawah itu
  // judulnya beda seri, jadi lebih baik poster kosong daripada poster orang
  // lain.
  return bestScore >= 80 ? best : "";
}

/** Pencarian donghua — hanya katalog donghua, tidak pernah tercampur anime. */
async function donghuaSearchInternal(
  q: string,
  limit: number,
): Promise<SankaAnime[]> {
  for (const src of DONGHUA_SOURCES) {
    const list = await fetchSearch(src, q, limit);
    if (list.length > 0) return list;
  }
  return [];
}

/* ------------------------------------------------------------------ *
 *  Action yang dipakai UI.
 *
 *  Bentuk output sengaja dibuat datar & stabil supaya komponen tidak
 *  perlu tahu bentuk mentah API.
 * ------------------------------------------------------------------ */

/** Peta satu item Sanka → bentuk yang dipakai kartu di UI. */
function uiCard(x: SankaAnime) {
  const epNum = parseEpisodeNumber(x.current_episode);
  return {
    id: x.slug,
    title: x.title,
    image: proxyImage(x.poster),
    status: x.status ?? "",
    // Selalu DONGHUA — dipakai UI untuk membedakan dari anime.
    type: "DONGHUA",
    // id-nya slug Sanka, bukan MAL id. UI memakai penanda ini untuk membuka
    // layar detail DONGHUA; tanpa itu hasil pencarian donghua kebuka detail
    // anime dan judulnya tertukar.
    source: "sanka" as const,
    score: x.rating != null ? Number(x.rating) || undefined : undefined,
    episode: epNum || undefined,
  };
}

/** Daftar donghua untuk baris "Donghua" di Home. */
export const donghuaLatestCards = action({
  args: { limit: v.optional(v.number()) },
  handler: async (_ctx, { limit = 20 }) => {
    const list = await donghuaLatestInternal(limit);
    return list.map(uiCard);
  },
});

/** Pencarian donghua (dipakai layar "Cari anime & donghua"). */
export const donghuaSearchCards = action({
  args: { q: v.string(), limit: v.optional(v.number()) },
  handler: async (_ctx, { q, limit = 20 }) => {
    const list = await donghuaSearchInternal(q, limit);
    return list.map(uiCard);
  },
});

/**
 * Jadwal donghua untuk tab Jadwal.
 *
 * Sanka tidak menyediakan jadwal airing per hari seperti AniList. Yang
 * dikembalikan adalah daftar donghua yang sedang jalan; `estimated: true`
 * menandai bahwa ini bukan jam tayang resmi, dan UI menulis "sedang jalan"
 * alih-alih menjanjikan waktu yang tidak dimiliki API.
 */
export const donghuaScheduleCards = action({
  args: {},
  handler: async () => {
    const list = await donghuaLatestInternal(24);
    return list.map((x) => ({ ...uiCard(x), estimated: true as const }));
  },
});

/**
 * Jadwal donghua PER HARI dari sumber resmi Sanka (`/anime/donghua/schedule`).
 *
 * Endpoint `donghuaScheduleCards` di atas hanya mengembalikan daftar yang
 * sedang update (tanpa hari), jadi tab Jadwal tidak bisa mengelompokkannya per
 * hari. Endpoint jadwal resmi mengembalikan `{ day, donghua_list: [{ title,
 * slug }] }` — slug-nya seri (bukan per-episode), jadi aman dibuka di
 * halaman nonton.
 *
 * Poster tidak ada di endpoint ini. Supaya tidak memanggil `/detail` untuk
 * tiap judul (puluhan request, batas 30/menit), poster diambil dari satu
 * request `/donghub/home` lalu dicocokkan lewat slug; judul yang tidak ada di
 * sana tetap tampil tanpa poster, bukan dikarang.
 */
const DAY_NORMALIZE: Record<string, string> = {
  minggu: "Minggu",
  senin: "Senin",
  selasa: "Selasa",
  rabu: "Rabu",
  kamis: "Kamis",
  "jum'at": "Jumat",
  jumat: "Jumat",
  sabtu: "Sabtu",
};

export const donghuaWeeklySchedule = action({
  args: { day: v.optional(v.string()) },
  handler: async (_ctx, { day }) => {
    const j = await sankaGet("/anime/donghua/schedule");
    const rows = Array.isArray(j?.schedule) ? (j.schedule as any[]) : [];

    // Satu request untuk peta slug → poster/episode/status.
    const hub = await sankaGet("/anime/donghub/home");
    const meta = new Map<string, SankaAnime>();
    const hubData =
      hub?.data && typeof hub.data === "object" ? (hub.data as any) : null;
    for (const list of [hubData?.latest, hubData?.popular, hubData?.slider]) {
      if (!Array.isArray(list)) continue;
      for (const raw of list) {
        const card = toCard(raw);
        if (card && !meta.has(card.slug)) meta.set(card.slug, card);
      }
    }

    const byDay: Record<string, ReturnType<typeof uiCard>[]> = {};
    const acak: ReturnType<typeof uiCard>[] = [];
    const seen = new Set<string>();
    for (const row of rows) {
      const raw = DAY_NORMALIZE[String(row?.day ?? "").trim().toLowerCase()];
      const list = Array.isArray(row?.donghua_list) ? row.donghua_list : [];
      for (const item of list) {
        const slug = seriesSlug(String(item?.slug ?? "").trim());
        if (!slug || seen.has(slug)) continue;
        seen.add(slug);
        // Judul di endpoint jadwal sering diawali prefix "[SVIP] " yang tidak
        // perlu ikut tampil di kartu.
        const title = stripEpisodeSuffix(cleanTitle(item?.title))
          .replace(/^\s*\[\s*svip\s*\]\s*/i, "")
          .trim();
        const card = uiCard(meta.get(slug) ?? { title, slug });
        if (!raw) {
          // `Acak` = tidak punya hari tetap; tetap ditampilkan, tapi di
          // kelompok sendiri supaya tidak diklaim sebagai jadwal hari tertentu.
          acak.push(card);
        } else {
          (byDay[raw] ??= []).push(card);
        }
      }
    }

    // Poster hanya diambil untuk satu hari yang sedang dibuka: satu request
    // detail per judul (maks 7), jadi tetap di bawah batas 30 request/menit
    // dan tidak membanjiri API setiap jadwal mingguan dimuat.
    const wanted = day ? byDay[DAY_NORMALIZE[day.trim().toLowerCase()]] : undefined;
    if (wanted && wanted.length > 0) {
      // Sanka dibalas kosong kalau terlalu banyak request bersamaan, dan poster
      // yang gagal diambil tidak akan dicoba lagi selama 30 menit (cache
      // halaman jadwal). Jadi postcard diproses BERURUTAN: 7 judul x 2 sumber
      // = 14 request sekaligus dijawab 429, dan hasilnya justru lebih banyak
      // kartu tanpa poster.
      for (const card of wanted) {
        if (card.image) continue;
        let found = "";
        for (const src of DONGHUA_SOURCES) {
          const raw = await sankaGet(
            `/anime/${src}/detail/${encodeURIComponent(card.id)}`,
            10_000,
          );
          const d: Record<string, any> =
            raw?.data && typeof raw.data === "object" && !Array.isArray(raw.data)
              ? (raw.data as Record<string, any>)
              : (raw ?? {});
          const poster = proxyImage(d.poster);
          if (poster) {
            found = poster;
            break;
          }
        }
        // Detail gagal untuk sebagian judul (Sanka balas "Error fetching
        // detail"), jadi posternya kosong dan kartu tampil tanpa gambar.
        // Endpoint search YANG SAMA mengembalikan poster untuk judul itu.
        if (!found) found = await donghuaPosterByTitle(card.title);
        if (found) card.image = found;
      }
    }
    return { byDay, acak };
  },
});

export type SankaDetail = {
  title: string;
  alterTitle?: string;
  poster?: string;
  cover?: string;
  rating?: string;
  status?: string;
  type?: string;
  studio?: string;
  synopsis: string;
  genres: string[];
  episodes: { number: number; title: string; url: string }[];
  /** Judul lain dari API yang recommendsJudul serupa (donghua). */
  related: { id: string; title: string; image: string }[];
  /** Source tempat detail ini diambil (dipakai lagi saat ambil episode). */
  source: string;
};

function genresOf(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  return list
    .map((g: any) => (typeof g === "string" ? g : String(g?.name ?? g?.title ?? "")))
    .map((s: string) => s.trim())
    .filter(Boolean);
}

/**
 * Normalisasi satu entri episode dari berbagai bentuk sumber.
 * Prioritas: `episode_number` (kalau ada) → `episode` → nomor di judul →
 * nomor di slug. `donghua` selalu null di `episode_number`, dan `donghub`
 * menyimpan nomornya sebagai string dua digit ("07"), jadi keduanya wajib
 * ditangani.
 */
function mapEpisode(e: any): { number: number; title: string; url: string } {
  const rawTitle = cleanTitle(e?.episode ?? e?.title ?? e?.name ?? "");
  const fromField = parseEpisodeNumber(e?.episode_number ?? e?.number);
  const fromLabel = parseEpisodeNumber(e?.episode ?? e?.number);
  const fromTitle = parseEpisodeNumber(rawTitle);
  const slug = String(e?.slug ?? e?.episodeId ?? e?.href ?? "")
    .split("/")
    .filter(Boolean)
    .pop();
  const fromSlug = parseEpisodeNumber(slug);
  const number = fromField || fromLabel || fromTitle || fromSlug || 0;
  return {
    number,
    // Judul episode diringkas supaya tidak mengulang nama seri yang sudah
    // tampil di atas: yang tersisa "Episode 08".
    title: shortEpisodeTitle(rawTitle, number),
    url: String(e?.slug ?? e?.href ?? ""),
  };
}

/** "Judul Seri Episode 08 Subtitle Indonesia" → "Episode 08". */
function shortEpisodeTitle(raw: string, number: number): string {
  const stripped = raw.replace(/\s*subtitle\s*indonesia\s*$/i, "").trim();
  const m = stripped.match(/episode\s*\d+\s*$/i) ?? stripped.match(/\bep\.?\s*\d+\s*$/i);
  if (m) return m[0].replace(/\s+/g, " ").trim();
  return stripped || (number > 0 ? `Episode ${number}` : "");
}

/**
 * Detail satu judul; donghua dicoba lebih dulu kalau diminta.
 *
 * Catatan: episode lama sengaja TIDAK ditambah-tambah. Sumber donghua
 * hanya mengembalikan jendela episode terbaru, tapi slugs di luar jendela
 * itu tidak bisa dipastikan — kalau dikarang, halaman nonton berhenti di
 * "episode tidak ada" / judul jadi Untitled. Lebih baik daftar apa adanya.
 */
export const detail = action({
  args: { slug: v.string(), preferDonghua: v.optional(v.boolean()) },
  handler: async (
    _ctx,
    { slug, preferDonghua = true },
  ): Promise<SankaDetail | { error: string }> => {
    const s = slug.trim();
    if (!s) return { error: "Slug kosong" };
    const order = preferDonghua
      ? [...DONGHUA_SOURCES, ...ANIME_SOURCES]
      : [...ANIME_SOURCES, ...DONGHUA_SOURCES];

    // Sumber pertama yang punya konten TAPI tanpa daftar episode disimpan
    // di sini. Loop tetap jalan ke sumber berikutnya yang mungkin punya
    // daftar episode lengkap — dulu sumber pertama langsung menang sehingga
    // ada judul yang metadatanya bilang episodenya banyak, tapi daftar
    // episodnya kosong saat dibuka.
    let fallback: SankaDetail | null = null;

    for (const src of order) {
      const raw = await sankaGet(
        `/anime/${src}/detail/${encodeURIComponent(s)}`,
      );
      if (!raw) continue;
      // donghub membungkus semuanya di `data`; donghua/anoboy tidak.
      const d: Record<string, any> =
        raw.data && typeof raw.data === "object" && !Array.isArray(raw.data)
          ? raw.data
          : raw;
      const info: Record<string, any> =
        d.info && typeof d.info === "object" ? d.info : {};

      // Sinopsis bisa string atau objek {text}; ambil yang terbaca.
      let synopsis = "";
      const rawSyn = d.synopsis ?? d.description ?? d.sinopsisId;
      if (typeof rawSyn === "string") synopsis = rawSyn;
      else if (rawSyn && typeof rawSyn === "object")
        synopsis = String(rawSyn.text ?? rawSyn.synopsis ?? "");

      const genres = genresOf(d.genres ?? d.genreList);

      // Kunci daftar episode berbeda per sumber:
      //   donghub → `episodes` (per-seri, lengkap)
      //   donghua → `episodes_list` (per-episode, `episode_number` null)
      const rawEps: any[] = Array.isArray(d.episodes)
        ? d.episodes
        : Array.isArray(d.episodes_list)
          ? d.episodes_list
          : Array.isArray(d.episode)
            ? d.episode
            : [];
      const eps = rawEps.map(mapEpisode).filter((e) => e.url.length > 0);
      // Nomor episode boleh 0 kalau sumber memang tidak memberi nomor, tapi
      // daftar tetap boleh kosong — itu yang membuat mencoba source lain.
      if (!synopsis && eps.length === 0 && genres.length === 0) continue;

      const related = (Array.isArray(d.recommendations)
        ? d.recommendations
        : []
      )
        .map((r: any) => ({
          id: String(r?.slug ?? ""),
          title: stripEpisodeSuffix(cleanTitle(r?.title)),
          image: proxyImage(r?.poster),
        }))
        .filter((r: { id: string; title: string }) => r.id && r.title);

      const title =
        stripEpisodeSuffix(cleanTitle(d.title)) || cleanTitle(d.title) || s;
      const ratingRaw = d.rating ?? info.rating;
      const res: SankaDetail = {
        title,
        alterTitle: d.alter_title ? String(d.alter_title) : undefined,
        poster: proxyImage(d.poster) || undefined,
        cover: proxyImage(d.cover) || undefined,
        rating: ratingRaw != null ? String(ratingRaw) : undefined,
        status: (d.status ?? info.status)
          ? String(d.status ?? info.status)
          : undefined,
        type: (d.type ?? info.type) ? String(d.type ?? info.type) : undefined,
        studio: d.studio ? String(d.studio) : undefined,
        synopsis,
        genres,
        episodes: eps,
        related,
        source: src,
      };
      // Punya daftar episode → langsung menang. Tidak punya → simpan
      // sebagai cadangan dan coba sumber lain dulu.
      if (eps.length > 0) return res;
      fallback ??= res;
    }
    return fallback ?? { error: "Detail tidak ditemukan" };
  },
});

/**
 * Cari satu episode di DailyMotion dan ambil URL HLS-nya.
 *
 * Dipakai lebih dulu untuk donghua: kalau ada, playback memakai file m3u8
 * (HLS) yang diputar player bawaan aplikasi sendiri, bukan iframe server
 * penuh iklan. Kalau DailyMotion tidak punya / tidak bisa dibaca, pemanggil
 * falls back ke server Sanka seperti biasa.
 */
async function dailymotionHls(title: string): Promise<{
  label: string;
  url: string;
  type: "hls";
  baked: boolean;
  ads: boolean;
} | null> {
  const q = String(title ?? "")
    .replace(/episode\s*\d+/gi, "")
    .replace(/subtitle\s*indonesia/gi, "")
    .trim();
  if (!q) return null;
  try {
    const u = `https://api.dailymotion.com/videos?search=${encodeURIComponent(
      q,
    )}&limit=5&fields=id,title`;
    const res = await fetch(u, {
      headers: { "User-Agent": "Mozilla/5.0 (YoruNime/1.0)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const list = (await res.json()) as { list?: { id: string; title?: string }[] };
    const items = (list?.list ?? []).filter((v) => v?.id);
    if (items.length === 0) return null;

    for (const v of items) {
      const meta = await fetch(
        `https://www.dailymotion.com/player/metadata/video/${v.id}`,
        {
          headers: { "User-Agent": "Mozilla/5.0 (YoruNime/1.0)" },
          signal: AbortSignal.timeout(8000),
        },
      ).catch(() => null);
      if (!meta || !meta.ok) continue;
      const j: any = await meta.json().catch(() => null);
      const qualities: any[] = Array.isArray(j?.qualities) ? j.qualities : [];
      // Prioritas paling tinggi dulu: pilih sesuai urutan di bawah.
      const wanted = [
        "2160",
        "1440",
        "1080",
        "720",
        "480",
        "380",
        "240",
        "auto",
      ];
      for (const w of wanted) {
        const qy = qualities.find((x) => String(x?.quality) === w);
        const m3u8 = qy?.type === "application/x-mpegURL" && qy?.url;
        if (m3u8) {
          return {
            label: `DailyMotion ${w === "auto" ? "auto" : `${w}p`}`,
            url: String(m3u8),
            type: "hls" as const,
            baked: false,
            ads: false,
          };
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Stream satu episode donghua.
 *
 * Endpoint: GET /anime/:source/episode/:slug  → daftar server.
 * Bentuk yang dipakai dua sumber berbeda, jadi keduanya dinormalisasi:
 *   donghub → `data.streams[]`  (server, url)
 *   donghua → `streaming.servers[]` (name, url)
 *
 * Server berlabel [ADS] diturunkan ke urutan terakhir: player iframe-nya
 * berat dan penuh iklan, jadi hanya dipakai kalau tidak ada pilihan lain.
 *
 * Bentuk dikembalikan sengaja sama dengan `megaplay.resolveEpisode` supaya
 * halaman Nonton tidak perlu tahu asal bedanya.
 */
/**
 * Subtitle milik DailyMotion untuk satu video id.
 *
 * File donghua (donghive/anichin) memang diberi label "Subtitle Indonesia",
 * tapi saat diunggah ke DailyMotion track Indonesianya sering tidak ikut, jadi
 * yang tersisa cuma `en-auto`. Fungsi ini mengembalikan semua track yang
 * benar-benar ada supaya pemanggil bisa memakai yang Indonesia, atau
 * menerjemahkannya.
 */
export async function dailymotionSubtitles(
  videoId: string,
): Promise<{ key: string; label: string; url: string }[]> {
  try {
    const res = await fetch(
      `https://www.dailymotion.com/player/metadata/video/${videoId}`,
      {
        headers: { "User-Agent": UA, Referer: "https://www.dailymotion.com/" },
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!res.ok) return [];
    const j: any = await res.json();
    const data = j?.subtitles?.data;
    if (!data || typeof data !== "object") return [];
    const out: { key: string; label: string; url: string }[] = [];
    for (const [key, val] of Object.entries(data as Record<string, any>)) {
      const url = Array.isArray(val?.urls) ? String(val?.urls[0] ?? "") : "";
      if (!url) continue;
      out.push({ key, label: String(val?.label ?? key), url });
    }
    return out;
  } catch {
    return [];
  }
}

/** Video DailyMotion dari URL embed (…/player/xid.html?video=kXXXX). */
export function dailymotionIdFromUrl(url: string): string {
  return (String(url ?? "").match(/video=([a-z0-9]+)/i) ?? [])[1] ?? "";
}

/**
 * Video HLS dari stream DailyMotion milik EPISODE INI saja.
 *
 * Versi lama mencari DailyMotion pakai judul seri (`dailymotionHls`), yang
 * sering mengembalikan video episode lain — atau video yang sudah dihapus —
 * sehingga subtitle tidak nyambung. Sekarang id video diambil dari daftar
 * server episode yang sebenarnya, jadi video dan subtitle-nya satu paket.
 */
async function dailymotionHlsForEpisode(
  slug: string,
): Promise<{ label: string; url: string; subs: { key: string; label: string; url: string }[] } | null> {
  for (const src of DONGHUA_SOURCES) {
    const j = await sankaGet(`/anime/${src}/episode/${encodeURIComponent(slug)}`, 20_000);
    const streams: any[] = Array.isArray(j?.data?.streams) ? j.data.streams : [];
    for (const s of streams) {
      const vid = dailymotionIdFromUrl(String(s?.url ?? ""));
      if (!vid) continue;
      let qualities: any = null;
      try {
        const meta = await fetch(
          `https://www.dailymotion.com/player/metadata/video/${vid}`,
          {
            headers: { "User-Agent": UA, Referer: "https://www.dailymotion.com/" },
            signal: AbortSignal.timeout(10_000),
          },
        );
        if (!meta.ok) continue;
        qualities = (await meta.json())?.qualities;
      } catch {
        continue;
      }
      if (!qualities || typeof qualities !== "object") continue;
      const wanted = ["1080", "720", "480", "380", "240", "auto"];
      for (const w of wanted) {
        const list = (qualities as Record<string, any>)[w];
        const m3u8 = Array.isArray(list) ? String(list[0]?.url ?? "") : "";
        if (!m3u8) continue;
        const subs = await dailymotionSubtitles(vid);
        return {
          label: `DailyMotion ${w === "auto" ? "auto" : `${w}p`}`,
          url: m3u8,
          subs,
        };
      }
    }
  }
  return null;
}

export const resolveEpisode = action({
  args: { slug: v.string(), source: v.optional(v.string()) },
  handler: async (_ctx, { slug, source }) => {
    const epSlug = String(slug ?? "").trim();
    if (!epSlug) {
      return { ok: false as const, reason: "Episode belum tersedia" };
    }

    // Prioritas 1: DailyMotion milik episode ini (bukan pencarian judul).
    const fromDm = await dailymotionHlsForEpisode(epSlug);
    if (fromDm) {
      const indo = fromDm.subs.find((s) =>
        /^(id|ind|indonesia|indon)/i.test(s.key) ||
        /indonesia/i.test(s.label),
      );
      return {
        ok: true as const,
        sources: [
          {
            label: fromDm.label,
            url: fromDm.url,
            type: "hls" as const,
            baked: false,
          },
        ],
        subtitle: indo?.url ?? null,
        subtitles: fromDm.subs.map((s) => ({ label: s.label, url: s.url })),
        subTracks: [] as unknown[],
        hasIndonesian: !!indo,
        bakedSubs: false,
        intro: null,
        outro: null,
      };
    }

    // Cadangan: pencarian judul, dipakai hanya kalau episode tidak punya
    // server DailyMotion sama sekali (mis. sumber anichin/OK.ru).
    const fromTitle = await dailymotionHls(
      epSlug
        .replace(/-episode-\d+.*$/i, "")
        .replace(/-/g, " ")
        .trim(),
    );
    if (fromTitle) {
      return {
        ok: true as const,
        sources: [
          {
            label: fromTitle.label,
            url: fromTitle.url,
            type: "hls" as const,
            baked: false,
          },
        ],
        subtitle: null,
        subtitles: [] as { label: string; url: string }[],
        subTracks: [] as unknown[],
        hasIndonesian: false,
        bakedSubs: false,
        intro: null,
        outro: null,
      };
    }
    // Source dari parameter kalau ada; kalau tidak, coba donghua dulu lalu
    // sisanya — persis urutan yang dipakai `detail`.
    const order = source
      ? [source, ...DONGHUA_SOURCES.filter((s) => s !== source)]
      : [...DONGHUA_SOURCES, ...ANIME_SOURCES];

    for (const src of order) {
      const j = await sankaGet(
        `/anime/${src}/episode/${encodeURIComponent(epSlug)}`,
        20_000,
      );
      const rawList: any[] = Array.isArray(j?.data?.streams)
        ? j.data.streams
        : Array.isArray(j?.streaming?.servers)
          ? j.streaming.servers
          : [];
      if (rawList.length === 0) continue;
      const all = rawList
        .map((s: any) => ({
          label: String(s?.server ?? s?.name ?? src),
          url: String(s?.url ?? ""),
          type: "embed" as const,
          baked: true,
          ads: /\[ads\]|\bads\b/i.test(String(s?.server ?? s?.name ?? "")),
        }))
        .filter((s: { url: string }) => s.url.length > 0);
      if (all.length === 0) continue;
      // Tanpa iklan dulu; kalau tidak ada, semua server tetap dipakai.
      const clean = all.filter((s) => !s.ads);
      const sources = (clean.length > 0 ? clean : all).map(
        ({ label, url, type, baked }) => ({ label, url, type, baked }),
      );
      return {
        ok: true as const,
        sources,
        subtitle: null,
        subtitles: [] as { label: string; url: string }[],
        subTracks: [] as unknown[],
        hasIndonesian: true,
        bakedSubs: true,
        intro: null,
        outro: null,
        megaM3u8: null,
        megaRef: null,
      };
    }
    return { ok: false as const, reason: "Episode belum tersedia" };
  },
});