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

export type IndoSource = { label: string; url: string; type: "embed" };

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
  return list[ep - 1] ?? list[0] ?? null;
}

/** Server embed yang bisa diputar di iframe (mega/filedon = link unduh). */
const PLAYABLE = /ondesu|odstream|stream|vidhide|upstream|server\s*0/i;

async function otakudesu(title: string, ep: number): Promise<IndoSource[]> {
  const list = await get(`/otakudesu/search?q=${encodeURIComponent(title)}`);
  const items = Array.isArray(list) ? list : [];
  if (items.length === 0) return [];
  const best = items
    .map((it: any) => ({ it, score: matchScore(title, String(it?.title ?? "")) }))
    .sort((a, b) => b.score - a.score)[0];
  if (!best || best.score < 20) return [];
  const animeId = String(best.it?.animeId ?? slugOf(best.it?.sourceUrl) ?? "");
  if (!animeId) return [];

  const detail = await get(`/otakudesu/anime/${encodeURIComponent(animeId)}`);
  const target = pickEpisode(detail?.episodeList ?? [], ep);
  if (!target?.url) return [];
  const epSlug = slugOf(target.url);
  if (!epSlug) return [];

  const episode = await get(`/otakudesu/episode/${encodeURIComponent(epSlug)}`);
  const out: IndoSource[] = [];
  const fallback = episode?.defaultStreaming;
  if (fallback) {
    out.push({ label: "Otakudesu · Sub Indo", url: String(fallback), type: "embed" });
  }
  const servers: any[] = Array.isArray(episode?.server) ? episode.server : [];
  const picked = servers
    .filter((s) => PLAYABLE.test(String(s?.title ?? "")))
    .slice(0, 3);
  for (const s of picked) {
    const data = await get(`/otakudesu/server/${encodeURIComponent(String(s.serverId))}`);
    if (data?.url) {
      out.push({
        label: `Otakudesu · ${String(s.title ?? "Server")} · Sub Indo`,
        url: String(data.url),
        type: "embed",
      });
    }
  }
  return out;
}

async function oploverz(title: string, ep: number): Promise<IndoSource[]> {
  const list = await get(`/oploverz/search?q=${encodeURIComponent(title)}`);
  const items = Array.isArray(list) ? list : [];
  if (items.length === 0) return [];
  const best = items
    .map((it: any) => ({ it, score: matchScore(title, String(it?.title ?? "")) }))
    .sort((a, b) => b.score - a.score)[0];
  if (!best || best.score < 20) return [];
  const slug = String(best.it?.slug ?? slugOf(best.it?.sourceUrl) ?? "");
  if (!slug) return [];

  const detail = await get(`/oploverz/anime/${encodeURIComponent(slug)}`);
  const target = pickEpisode(detail?.episodeList ?? [], ep);
  if (!target?.url) return [];
  const epSlug = slugOf(target.url);
  if (!epSlug) return [];

  const episode = await get(`/oploverz/episode/${encodeURIComponent(epSlug)}`);
  if (!episode?.iframe) return [];
  return [{ label: "Oploverz · Sub Indo", url: String(episode.iframe), type: "embed" }];
}

/**
 * Sumber streaming subtitle Indonesia untuk satu episode.
 * Urutan: Otakudesu (paling lengkap) → Oploverz (cadangan).
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
  ].filter((v, i, arr) => v.length > 2 && arr.indexOf(v) === i);

  for (const q of variants) {
    const ot = await otakudesu(q, ep).catch(() => []);
    if (ot.length > 0) return ot;
    const op = await oploverz(q, ep).catch(() => []);
    if (op.length > 0) return op;
  }
  return [];
}
