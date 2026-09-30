"use node";
// YoruNime — sumber streaming subtitle Indonesia (Otakudesu + Oploverz).
// Semua request lewat API scraper (superanime) yang sudah stabil:
//   GET /otakudesu/search?q=        -> [{ title, animeId, sourceUrl, ... }]
//   GET /otakudesu/anime/:animeId   -> { episodeList: [{ title, url }] }
//   GET /otakudesu/episode/:slug    -> { server: [{ title, serverId }], defaultStreaming }
//   GET /otakudesu/server/:serverId -> { url }   (embed player)
//   GET /oploverz/search?q=         -> [{ title, slug }]
//   GET /oploverz/anime/:slug       -> { episodeList: [{ episode, url }] }
//   GET /oploverz/episode/:slug     -> { iframe }
// Judul di(link) anime selalu membawa "Subtitle Indonesia".
const API = "https://otakudesu-scrapper.vercel.app";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

export type IndoSource = {
  label: string;
  url: string;
  type: "embed" | "hls" | "mp4";
};

async function get(path: string): Promise<any | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(`${API}${path}`, {
        headers: { "User-Agent": UA, Accept: "application/json" },
        signal: AbortSignal.timeout(9_000),
      });
      if (!res.ok) return null;
      const json: any = await res.json();
      if (json?.statusCode && json.statusCode >= 400) return null;
      return json?.data ?? null;
    } catch {
      await new Promise((r) => setTimeout(r, 600));
    }
  }
  return null;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Skor kecocokan sederhana antara judul anime & judul hasil pencarian. */
function matchScore(query: string, title: string): number {
  const q = norm(query);
  const t = norm(title);
  if (!q || !t) return 0;
  if (t === q) return 100;
  if (t.startsWith(q)) return 80;
  if (t.includes(q)) return 60;
  const qt = q.split(" ").filter((w) => w.length > 2);
  if (qt.length === 0) return 0;
  const hit = qt.filter((w) => t.includes(w)).length;
  return Math.round((hit / qt.length) * 50);
}

/** Ambil slug episode dari URL sumber (https://otakudesu.blog/episode/<slug>/). */
const slugOf = (url?: string) =>
  String(url ?? "")
    .split("?")[0]
    .split("/")
    .filter(Boolean)
    .pop() ?? "";

/** Cari episode ke-n dari daftar {title|url} atau {episode|url}. */
function pickEpisode<T extends { title?: string; episode?: number; url?: string }>(
  list: T[],
  ep: number,
): T | null {
  if (!Array.isArray(list) || list.length === 0) return null;
  const re = new RegExp(`episode\\s*0*${ep}\\b|ep\\s*0*${ep}\\b`, "i");
  const byTitle = list.find((e) => re.test(String(e.title ?? "")));
  if (byTitle) return byTitle;
  const byNumber = list.find((e) => Number(e.episode) === ep);
  if (byNumber) return byNumber;
  const byIndex = list[ep - 1];
  // Jangan pernah mengembalikan episode lain: kalau daftar lebih pendek dari
  // episode yang diminta, lebih baik dianggap tidak ada.
  return byIndex ?? (ep === 1 ? list[0] ?? null : null);
}

/** Server embed yang bisa diputar di iframe (mega/filedon = link unduh). */
const PLAYABLE = /ondesu|odstream|stream|vidhide|upstream|server\s*0/i;

/**
 * Beberapa host (mis. desustream.net) mengirim X-Frame-Options: SAMEORIGIN
 * sehingga player di dalam iframe app kita jadi kosong. Server seperti ini
 * tidak pernah ditawarkan ke user — dicek sekali lalu disimpan di cache.
 */
const frameCache = new Map<string, boolean>();
async function isFramable(url: string): Promise<boolean> {
  const cached = frameCache.get(url);
  if (cached !== undefined) return cached;
  let ok = false;
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: { "User-Agent": UA, Range: "bytes=0-1024" },
      signal: AbortSignal.timeout(8_000),
    });
    const xfo = (res.headers.get("x-frame-options") ?? "").toLowerCase();
    const csp = res.headers.get("content-security-policy") ?? "";
    ok = res.ok && !xfo && !/frame-ancestors\s+('none'|'self')/i.test(csp);
  } catch {
    ok = false;
  }
  if (frameCache.size > 500) frameCache.clear();
  frameCache.set(url, ok);
  return ok;
}

async function otakudesuSearch(q: string): Promise<any[]> {
  const key = `ot:${q.toLowerCase()}`;
  const cached = readCache<any[] | null>(searchCache, key);
  if (cached) return cached;
  const search = await get(`/otakudesu/search?q=${encodeURIComponent(q)}`);
  const items = Array.isArray(search) ? search : [];
  writeCache(searchCache, key, items);
  if (items.length === 0) {
    searchCache.get(key)!.at = Date.now() - TTL_OK + TTL_EMPTY;
  }
  return items;
}

async function otakudesu(title: string, ep: number): Promise<IndoSource[]> {
  const items = await otakudesuSearch(title);
  if (items.length === 0) return [];
  const best = items
    .map((it: any) => ({ it, score: matchScore(title, String(it?.title ?? "")) }))
    .sort((a, b) => b.score - a.score)[0];
  if (!best || best.score < 20) return [];
  const animeId = String(best.it?.animeId ?? slugOf(best.it?.sourceUrl) ?? "");
  if (!animeId) return [];

  const detailKey = `ot:${animeId}`;
  const detail =
    readCache<any>(slugCache, detailKey) ??
    (await get(`/otakudesu/anime/${encodeURIComponent(animeId)}`));
  if (detail) writeCache(slugCache, detailKey, detail);
  const target = pickEpisode(detail?.episodeList ?? [], ep);
  if (!target?.url) return [];
  const epSlug = slugOf(target.url);
  if (!epSlug) return [];

  const epKey = `ot:${epSlug}`;
  const episode =
    readCache<any>(epCache, epKey) ??
    (await get(`/otakudesu/episode/${encodeURIComponent(epSlug)}`));
  if (episode) writeCache(epCache, epKey, episode);
  const out: IndoSource[] = [];
  const fallback = episode?.defaultStreaming;
  if (fallback && (await isFramable(String(fallback)))) {
    out.push({ label: "Otakudesu · Sub Indo", url: String(fallback), type: "embed" });
  }
  const servers: any[] = Array.isArray(episode?.server) ? episode.server : [];
  const picked = servers
    .filter((s) => PLAYABLE.test(String(s?.title ?? "")))
    .slice(0, 4);
  for (const s of picked) {
    const data = await get(`/otakudesu/server/${encodeURIComponent(String(s.serverId))}`);
    const u = data?.url ? String(data.url) : "";
    if (!u || !(await isFramable(u))) continue;
    out.push({
      label: `Otakudesu · ${String(s.title ?? "Server")} · Sub Indo`,
      url: u,
      type: "embed",
    });
  }
  return out;
}

/** Cache sederhana biar tidak terlalu banyak kena API pihak ketiga. */
type CacheEntry = { value: any; at: number };
const searchCache = new Map<string, CacheEntry>();
const slugCache = new Map<string, CacheEntry>();
const epCache = new Map<string, CacheEntry>();
const TTL_OK = 30 * 60_000;
const TTL_EMPTY = 5 * 60_000;

function readCache<T>(map: Map<string, CacheEntry>, key: string): T | null {
  const hit = map.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > TTL_OK) {
    map.delete(key);
    return null;
  }
  return hit.value as T;
}
function writeCache(map: Map<string, CacheEntry>, key: string, value: any) {
  if (map.size > 400) map.clear();
  map.set(key, { value, at: Date.now() });
}

/** Search Oploverz + cache (termasuk hasil kosong, supaya tidak hammering API). */
// ------------------------------------------------------------ xtwap / HLS --
// Sumber "anime-indo.lol" (lewat SankaApi) menaruh link GDrive yang kalau
// dibuka menghasilkan player jwplayer dengan URL HLS langsung. Link itu kita
// ambil -> m3u8 asli -> diputar dengan player milik kita sendiri (hls.js).
//
// CATATAN SUBTITLE: file video dari sumber ini sudah membawa subtitle Bahasa
// Indonesia yang menempel di dalam video. Subtitle itu milik penyedia konten,
// BUKAN milik kita. Karena itu di player kita tidak menambahkan track subtitle
// sendiri untuk sumber ini (overlay subtitle dimatikan 100%) supaya tidak
// doabel dan tidak mengubah file aslinya.
const XT_REF = "https://play.xtwap.top/";

const b64url = (s: string) => Buffer.from(s, "utf8").toString("base64url");
const proxied = (u: string, ref: string) =>
  `${process.env.CONVEX_SITE_URL ?? ""}/megastream?u=${b64url(u)}&r=${b64url(ref)}`;

async function xtwapHls(title: string, ep: number): Promise<IndoSource[]> {
  const list = await sankaGet(`/anime/stream/search/${encodeURIComponent(title)}`);
  const items: any[] = Array.isArray(list?.anime_list)
    ? list.anime_list ?? list
    : Array.isArray(list)
      ? list
      : [];
  if (items.length === 0) return [];
  const ranked = items
    .map((it: any) => ({
      it,
      score: matchScore(title, String(it?.title ?? "")),
      slug: String(it?.slug ?? slugOf(it?.href) ?? ""),
    }))
    .filter((x) => x.slug && x.score >= 20)
    .sort((a, b) => b.score - a.score);

  for (const cand of ranked.slice(0, 3)) {
    const detail = await sankaGet(`/anime/stream/anime/${cand.slug}`);
    const eps: any[] = Array.isArray(detail?.episodes) ? detail.episodes : [];
    const target = pickEpisode(eps, ep);
    const epSlug = String(target?.eps_slug ?? target?.slug ?? "").trim();
    if (!epSlug) continue;
    const episode = await sankaGet(`/anime/stream/episode/${epSlug}`);
    const links: any[] = Array.isArray(episode?.stream_links)
      ? episode.stream_links
      : [];
    if (links.length === 0) continue;
    // Setiap server player (hls.php / btube3.php / cepat.php / ...) dibuka dan
    // diambil file aslinya: HLS (m3u8) lebih dulu, kalau tidak ada MP4 langsung.
    for (const l of links) {
      const playerUrl = String(l?.url ?? "");
      if (!/^https?:/i.test(playerUrl)) continue;
      try {
        const html = await fetch(playerUrl, {
          headers: { "User-Agent": UA, Referer: XT_REF },
          signal: AbortSignal.timeout(12_000),
        });
        if (!html.ok) continue;
        const body = await html.text();
        const m3u8 = body.match(/"file"\s*:\s*"(https?:[^"]+\.m3u8)"/)?.[1];
        if (m3u8) {
          return [
            { label: "HLS · Sub Indo", url: proxied(m3u8, XT_REF), type: "hls" },
          ];
        }
        // Player video.js: file video langsung. URL-nya tidak selalu berakhiran
        // .mp4 (googlevideo/bloger pakai path videoplayback?...&mime=video/mp4).
        const mp4 = body
          .match(/<source[^>]+src="(https?:[^"]+)"[^>]*>/i)?.[1]
          ?.replace(/&amp;/g, "&");
        if (mp4 && /mime=video\/mp4|\.mp4(\?|$)/i.test(body)) {
          return [
            { label: "HLS · Sub Indo", url: proxied(mp4, XT_REF), type: "mp4" },
          ];
        }
      } catch {
        continue;
      }
    }
  }
  return [];
}

// ---------------------------------------------------------------- SankaApi --
// REST API gabungan (sankavollerei.web.id) yangNEW punya 12+ situs Indonesia.
// Dipakai untuk sumber Samehadaku & Otakudesu: katalognya jauh lebih lengkap
// (One Piece 1.178 episode, Naruto, Bleach, dst).
const SANKA = "https://www.sankavollerei.web.id";

async function sankaGet(path: string): Promise<any | null> {
  const key = `sanka:${path}`;
  const cached = readCache<any>(epCache, key);
  if (cached) return cached;
  // SankaApi kadang balas 503 sementara — coba 2x.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(`${SANKA}${path}`, {
        headers: { "User-Agent": UA, Accept: "application/json" },
        signal: AbortSignal.timeout(9_000),
      });
      if (!res.ok) {
        await new Promise((r) => setTimeout(r, 800));
        continue;
      }
      const json: any = await res.json();
      const data = json?.data ?? null;
      if (data) writeCache(epCache, key, data);
      return data;
    } catch {
      await new Promise((r) => setTimeout(r, 800));
    }
  }
  return null;
}

async function samehadaku(title: string, ep: number): Promise<IndoSource[]> {
  const list = await sankaGet(
    `/anime/samehadaku/search?q=${encodeURIComponent(title)}`,
  );
  const items: any[] = Array.isArray(list?.animeList) ? list.animeList : [];
  if (items.length === 0) return [];
  const ranked = items
    .map((it: any) => ({
      it,
      score: matchScore(title, String(it?.title ?? "")),
      id: String(it?.animeId ?? slugOf(it?.href) ?? ""),
    }))
    .filter((x) => x.id && x.score >= 20)
    .sort((a, b) => b.score - a.score);

  for (const cand of ranked.slice(0, 3)) {
    const detail = await sankaGet(`/anime/samehadaku/anime/${cand.id}`);
    const raw: any[] = Array.isArray(detail?.episodeList) ? detail.episodeList : [];
    // `title` di Samehadaku adalah nomor episode.
    const eps = raw.map((e: any) => ({
      episode: Number(e.title),
      url: e.href ?? `https://v2.samehadaku.how/${e.episodeId}/`,
    }));
    const target = pickEpisode(eps, ep);
    if (!target?.url) continue;
    const epId = String(target.url).split("/").filter(Boolean).pop() ?? "";
    if (!epId) continue;
    const episode = await sankaGet(`/anime/samehadaku/episode/${epId}`);
    const url = episode?.defaultStreamingUrl ? String(episode.defaultStreamingUrl) : "";
    if (!url || !(await isFramable(url))) continue;
    return [{ label: "Samehadaku · Sub Indo", url, type: "embed" }];
  }
  return [];
}

async function oploverzSearch(q: string): Promise<any[]> {
  const key = q.toLowerCase();
  const cached = readCache<any[] | null>(searchCache, key);
  if (cached) return cached;
  const list = await get(`/oploverz/search?q=${encodeURIComponent(q)}`);
  const items = Array.isArray(list) ? list : [];
  writeCache(searchCache, key, items);
  if (items.length === 0) {
    // hasil kosong hanya sebentar, lalu boleh dicoba lagi
    searchCache.get(key)!.at = Date.now() - TTL_OK + TTL_EMPTY;
  }
  return items;
}

async function oploverz(title: string, ep: number): Promise<IndoSource[]> {
  const items = await oploverzSearch(title);
  if (items.length === 0) return [];
  // Banyak hasil mirip (mis. "One Piece" → "One Piece: Heroines"). Pilih yang
  // judulnya paling cocok DAN benar-benar punya episode yang diminta.
  const ranked = items
    .map((it: any) => ({
      it,
      score: matchScore(title, String(it?.title ?? "")),
      slug: String(it?.slug ?? slugOf(it?.sourceUrl) ?? ""),
    }))
    .filter((x) => x.slug && x.score >= 20)
    .sort((a, b) => b.score - a.score);

  for (const cand of ranked.slice(0, 5)) {
    const detailKey = `op:${cand.slug}`;
    const detail =
      readCache<any>(slugCache, detailKey) ??
      (await get(`/oploverz/anime/${encodeURIComponent(cand.slug)}`));
    if (detail) writeCache(slugCache, detailKey, detail);
    const eps: any[] = detail?.episodeList ?? [];
    const target = pickEpisode(eps, ep);
    // Kalau kandidat ini tidak punya episode yang diminta, coba kandidat lain.
    if (!target?.url) continue;
    const epSlug = slugOf(target.url);
    if (!epSlug) continue;
    const epKey = `op:${epSlug}`;
    const episode =
      readCache<any>(epCache, epKey) ??
      (await get(`/oploverz/episode/${encodeURIComponent(epSlug)}`));
    if (episode) writeCache(epCache, epKey, episode);
    const iframe = episode?.iframe ? String(episode.iframe) : "";
    if (!iframe || !(await isFramable(iframe))) continue;
    return [{ label: "Oploverz · Sub Indo", url: iframe, type: "embed" }];
  }
  return [];
}

// =========================================================== AnimeIndo ====
// AnimeIndo (animeindo.me / .tv / .id) adalah situs subtitle Indonesia dengan
// katalog episode lengkap. Polanya:
//   Search  : /?s=<judul>
//   Detail  : /anime/<slug>/   (daftar episode: /<slug>-episode-N-subtitle-indonesia/)
//   Episode : /<slug>-episode-N-subtitle-indonesia/
// Situs ini berbasis WordPress tema "animestream": file video diambil lewat JS
// tema atau admin-ajax, jadi pola filenya berbeda tiap versi. Parser di bawah
// sengaja dibuat toleran (mencoba banyak pola). Kalau tidak ada file yang bisa
// diambil, halaman episode-nya sendiri dikembalikan sebagai embed supaya tetap
// bisa ditonton di dalam player.
const INDO_HOSTS = [
  "https://animeindo.me",
  "https://animeindo.tv",
  "https://animeindo.id",
  "https://animeindo.fun",
  "https://animeindo.site",
  "https://animeindo.top",
];

const INDO_HEADERS = {
  "User-Agent": UA,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
};

async function indoHtml(
  path: string,
): Promise<{ host: string; body: string } | null> {
  for (const host of INDO_HOSTS) {
    try {
      const res = await fetch(`${host}${path}`, {
        headers: INDO_HEADERS,
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) continue;
      const body = await res.text();
      // Halaman tolak/404 di beberapa mirror tetap 200 tapi isinya pendek atau
      // halaman Fawdah — dua-duanya jangan dipakai.
      if (body.length < 8000) continue;
      if (/HematQQ|BandarQQ|Situs BandarQQ/i.test(body)) continue;
      // Cloudflare / proteksi bot: jangan dipakai, coba mirror berikutnya.
      if (
        /Just a moment|cf-chl|Enable JavaScript and cookies to continue|Attention Required/i.test(
          body,
        )
      )
        continue;
      return { host, body };
    } catch {
      continue;
    }
  }
  return null;
}

/** Ambil URL video dari HTML episode (banyak sekali polanya di.fmex). */
function pickStreamFromHtml(
  body: string,
): { url: string; type: "hls" | "mp4" } | null {
  const m3u8 =
    body.match(
      /["'`]\s*(?:file|src|url)\s*["'`]\s*:\s*["'`](https?:[^"'`\s]+\.m3u8[^"'`\s]*)["'`]/i,
    )?.[1] ??
    body.match(/(https?:\\?\/\\?\/[^"'`\s<>]+?\.m3u8[^"'`\s<>]*)/i)?.[1];
  if (m3u8) return { url: m3u8.replace(/\\\//g, "/"), type: "hls" };
  const fileField =
    body.match(/["'`]file["'`]\s*:\s*["'`]([^"'`]+)["'`]/i)?.[1] ??
    body.match(/data-file\s*=\s*["']([^"']+)["']/i)?.[1] ??
    body.match(/<source[^>]+src\s*=\s*["']([^"']+\.mp4[^"']*)["']/i)?.[1];
  if (fileField && /\.mp4|mime=video/i.test(fileField)) {
    return {
      url: fileField.replace(/\\\//g, "/").replace(/&amp;/g, "&"),
      type: "mp4",
    };
  }
  return null;
}

/** Cari iframe player di halaman episode (lebih baik daripada embed halaman penuh). */
function pickPlayerIframe(body: string, origin: string): string | null {
  const frames = Array.from(
    body.matchAll(/<iframe[^>]+src\s*=\s*["']([^"']+)["']/gi),
  ).map((m) => m[1]!);
  for (const raw of frames) {
    const url = raw.trim();
    if (!url || url.startsWith("javascript:")) continue;
    if (/disqus|facebook|twitter|ads|doubleclick/i.test(url)) continue;
    const abs = url.startsWith("http")
      ? url
      : new URL(url, `${origin}/`).toString();
    return abs;
  }
  return null;
}

async function animeindo(title: string, ep: number): Promise<IndoSource[]> {
  const searchKey = `ai:s:${title.toLowerCase()}`;
  let animeUrls: string[] | null = readCache<string[] | null>(
    searchCache,
    searchKey,
  );
  if (!animeUrls) {
    const page = await indoHtml(`/?s=${encodeURIComponent(title)}`);
    animeUrls = page
      ? Array.from(
          new Set(
            Array.from(
              page.body.matchAll(/href="(https?:\/\/[^"]*\/anime\/[^"]+\/)"/g),
            ).map((m) => m[1]!),
          ),
        )
      : [];
    writeCache(searchCache, searchKey, animeUrls);
  }
  if (animeUrls.length === 0) return [];

  for (const animeUrl of animeUrls.slice(0, 4)) {
    const detailKey = `ai:a:${animeUrl}`;
    let detail = readCache<string | null>(slugCache, detailKey);
    if (detail === null) {
      const page = await indoHtml(new URL(animeUrl).pathname);
      detail = page ? page.body : "";
      writeCache(slugCache, detailKey, detail);
    }
    if (!detail) continue;
    const eps = Array.from(
      new Set(
        Array.from(
          detail.matchAll(
            /href="(https?:\/\/[^"]+?-episode-(\d+)-subtitle-indonesia\/)"/g,
          ),
        ).map((m) => ({ url: m[1]!, ep: Number(m[2]) })),
      ),
    );
    const target = eps.find((e) => e.ep === ep);
    if (!target) continue;

    const epKey = `ai:e:${target.url}`;
    let epBody = readCache<string | null>(epCache, epKey);
    if (epBody === null) {
      const page = await indoHtml(new URL(target.url).pathname);
      epBody = page ? page.body : "";
      writeCache(epCache, epKey, epBody);
    }
    if (!epBody) continue;

    const stream = pickStreamFromHtml(epBody);
    if (stream) {
      return [
        {
          label: "AnimeIndo \u00b7 Sub Indo",
          url: proxied(stream.url, `${new URL(target.url).origin}/`),
          type: stream.type,
        },
      ];
    }
    // Tidak ada file yang bisa diambil: pakai iframe player-nya kalau ada,
    // kalau tidak baru halaman episode-nya sendiri sebagai embed.
    const iframe = pickPlayerIframe(epBody, new URL(target.url).origin);
    return [
      {
        label: "AnimeIndo \u00b7 Sub Indo",
        url: iframe ?? target.url,
        type: "embed",
      },
    ];
  }
  return [];
}

/**
 * Sumber streaming subtitle Indonesia untuk satu episode.
 * Urutan: AnimeIndo (lengkap episode) -> HLS xtwap -> Samehadaku -> Oploverz
 * -> Otakudesu. Tidak pernah menolak episode: kalau AnimeIndo tidak punya
 * episodenya, otomatis pindah ke sumber Indonesia lain.
 */
export async function resolveIndo(
  title: string,
  ep: number,
): Promise<IndoSource[]> {
  const clean = String(title ?? "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return [];
  // Varian penulisan season di situs Indo: "2nd Season" ↔ "Season 2".
  const variants = [
    clean,
    clean.replace(/\b(\d+)(st|nd|rd|th)\s+season\b/gi, "season $1"),
    clean.replace(/\bseason\s+(\d+)\b/gi, "$1$2 season"),
    clean.replace(/\b(season\s*\d+|\d+(st|nd|rd|th)\s+season)\b/gi, "").trim(),
    // Judul AniList sering ada sufiks format ("Movie", "TV", "ONA") yang tidak
    // dipakai di katalog Indo.
    clean.replace(/\b(movie|tv|ova|ona|special|part\s*\d+)\b/gi, "").trim(),
    clean.replace(/\b(movie|tv|ova|ona|special)\b/gi, "").replace(/\s+/g, " ").trim(),
  ].filter((v, i, arr) => v.length > 2 && arr.indexOf(v) === i);

  // Semua varian dicoba untuk sumber bersubtitle Indonesia. Urutan:
  // 1) AnimeIndo  → katalog episode paling lengkap.
  // 2) HLS xtwap  → HLS asli, bisa diputar player kita sendiri (UI penuh).
  // 3) Samehadaku → Oploverz → Otakudesu (embed player pihak ketiga).
  for (const q of variants) {
    const ai = await animeindo(q, ep).catch(() => []);
    if (ai.length > 0) return ai;
  }
  for (const q of variants) {
    const h = await xtwapHls(q, ep).catch(() => []);
    if (h.length > 0) return h;
  }
  for (const q of variants) {
    const sh = await samehadaku(q, ep).catch(() => []);
    if (sh.length > 0) return sh;
  }
  for (const q of variants) {
    const op = await oploverz(q, ep).catch(() => []);
    if (op.length > 0) return op;
  }
  for (const q of variants) {
    const ot = await otakudesu(q, ep).catch(() => []);
    if (ot.length > 0) return ot;
  }
  return [];
}
