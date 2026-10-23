// YoruNime — konsumsi API CONSUMET (https://docs.consumet.org).
//
// Tiga penyedia sesuai permintaan:
//   • flixhq    → streaming FILM & SERIES   /movies/flixhq/…
//   • gogoanime → streaming ANIME & DONGHUA /anime/gogoanime/…
//   • mangadex  → baca MANGA & MANHWA       /manga/mangadex/…
//
// Semua dipanggil sebagai ACTION (server → internet), bukan dari browser,
// jadi tidak kena CORS. Base URL bisa diganti lewat env CONSUMET_BASE /
// CONSUMET_API (deploy sendiri) karena API Consumet publik sudah tidak
// lagi di-hosting resmi; default memakai host resmi dokumentasi Consumet.
//
// Hasil di-memo per isolate supaya buka/muat ulang layar nonton tidak
// memanggil upstream berulang-ulang.
import { v } from "convex/values";
import { action } from "./_generated/server";

type StreamSrc = { label: string; url: string; type: "hls" | "mp4" | "embed" };
type StreamSub = { label: string; lang: string; url: string };

/** Base URL API Consumet — bisa dioverride tanpa ubah kode. */
function baseUrl(): string {
  const raw =
    process.env.CONSUMET_BASE ??
    process.env.CONSUMET_API ??
    process.env.CONSUMET_URL ??
    // Dokumentasi resmi Consumet (dipakai sebagai host default).
    "https://docs-consumet-org-coral.vercel.app";
  return String(raw).trim().replace(/\/+$/, "");
}

/** Cache mini per isolate (action bisa jalan berulang di isolate yang sama). */
const MEMO = new Map<string, { at: number; v: unknown }>();
async function memo<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = MEMO.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.v as T;
  const val = await fn();
  MEMO.set(key, { at: Date.now(), v: val });
  return val;
}

async function jget(path: string, timeoutMs = 15_000): Promise<any> {
  const url = `${baseUrl()}${path}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`Consumet ${res.status} ${path}`);
  const json = await res.json().catch(() => null);
  // Beberapa deploy membungkus payload di `data`.
  if (json && typeof json === "object" && json.data && !json.results && !json.sources) {
    return json.data;
  }
  return json;
}

/** Normalisasi judul untuk pembandingan longgar. */
function norm(s: string): string {
  return String(s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Pilih hasil pencarian yang paling mirip judul yang dicari. */
function pickResult(results: any[], want: string): any | null {
  if (!Array.isArray(results) || results.length === 0) return null;
  const w = norm(want);
  const exact = results.find((r) => norm(r?.title ?? r?.name ?? "") === w);
  if (exact) return exact;
  const contains = results.find((r) => {
    const t = norm(r?.title ?? r?.name ?? "");
    return t.includes(w) || w.includes(t);
  });
  if (contains) return contains;
  return results[0];
}

/** Ubah payload `sources` Consumet → bentuk sumber YoruNime. */
function toSources(raw: any): StreamSrc[] {
  const list = Array.isArray(raw) ? raw : (raw?.sources ?? []);
  const out: StreamSrc[] = [];
  const seen = new Set<string>();
  for (const s of list) {
    const url = String(s?.url ?? "").trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const isHls = Boolean(s?.isM3U8) || /\.m3u8(\?|$)/i.test(url);
    const digits = String(s?.quality ?? s?.label ?? "").replace(/\D/g, "");
    const label = digits ? `${digits}p` : isHls ? "HLS" : "MP4";
    out.push({ label, url, type: isHls ? "hls" : "mp4" });
  }
  // Kualitas tertinggi di depan (player mulai dari yang terbaik).
  out.sort((a, b) => (parseInt(b.label, 10) || 0) - (parseInt(a.label, 10) || 0));
  // Cadangan: beberapa penyedia menyimpan mirror di `sources.backup`.
  const backup = (raw?.sources?.backup ?? []) as any[];
  for (const s of backup) {
    const url = String(s?.url ?? "").trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const isHls = Boolean(s?.isM3U8) || /\.m3u8(\?|$)/i.test(url);
    out.push({ label: isHls ? "HLS" : "MP4", url, type: isHls ? "hls" : "mp4" });
  }
  return out;
}

/** Subtitle — Bahasa Indonesia diprioritaskan, sisanya tetap dibawa. */
function toSubs(raw: any): StreamSub[] {
  const list = Array.isArray(raw) ? raw : (raw?.subtitles ?? []);
  const out: StreamSub[] = [];
  for (const s of list) {
    const url = String(s?.url ?? s?.file ?? "").trim();
    if (!url) continue;
    const lang = String(s?.lang ?? s?.language ?? s?.label ?? "").trim();
    const isId = /(^|\b)(id|ind|indonesian|indonesia)(\b|$)/i.test(lang);
    out.push({
      label: isId ? "Indonesia" : lang || "Server",
      lang: isId ? "id" : (lang || "xx").slice(0, 8),
      url,
    });
  }
  out.sort((a, b) => (a.lang === "id" ? -1 : 0) - (b.lang === "id" ? -1 : 0));
  return out;
}

// ------------------------------------------------------------- film ----

async function flixhqResolve(title: string, episode: number) {
  const search = await jget(
    `/movies/flixhq/${encodeURIComponent(title)}`,
  ).catch(() => null);
  const hit = pickResult(search?.results ?? search ?? [], title);
  if (!hit?.id) return { ok: false as const, reason: "Judul tidak ditemukan di FlixHQ" };
  const mediaId = String(hit.id);
  const info = await jget(
    `/movies/flixhq/info?id=${encodeURIComponent(mediaId)}&episodes=true`,
  ).catch(() => null);
  const eps: any[] = info?.episodes?.sub ?? info?.episodes?.dub ?? info?.episodes ?? [];
  const target =
    eps.find((e) => Number(e?.number) === episode && (!e?.season || Number(e.season) === 1)) ??
    eps.find((e) => Number(e?.number) === episode) ??
    eps[episode - 1] ??
    eps[0];
  if (!target?.id) return { ok: false as const, reason: "Episode tidak ditemukan di FlixHQ" };
  const watch = await jget(
    `/movies/flixhq/watch?episodeId=${encodeURIComponent(
      String(target.id),
    )}&mediaId=${encodeURIComponent(mediaId)}`,
  ).catch(() => null);
  const sources = toSources(watch);
  if (sources.length === 0) return { ok: false as const, reason: "FlixHQ tidak punya sumber" };
  return {
    ok: true as const,
    matchedTitle: info?.title ?? hit.title ?? title,
    sources,
    subtitles: toSubs(watch),
  };
}

// ------------------------------------------------------ anime/donghua ----

async function gogoResolve(title: string, episode: number) {
  const search = await jget(
    `/anime/gogoanime/${encodeURIComponent(title)}`,
  ).catch(() => null);
  const hit = pickResult(search?.results ?? search ?? [], title);
  if (!hit?.id) return { ok: false as const, reason: "Judul tidak ditemukan di Gogoanime" };
  const mediaId = String(hit.id);
  // EpisodeId: ambil dari daftar episode (lebih akurat), fallback bentuk
  // baku "<slug>-episode-<n>".
  let episodeId = `${mediaId}-episode-${episode}`;
  const info = await jget(
    `/anime/gogoanime/info/${encodeURIComponent(mediaId)}`,
  ).catch(() => null);
  const eps: any[] = info?.episodes ?? [];
  const target = eps.find((e) => Number(e?.number) === episode);
  if (target?.id) episodeId = String(target.id);
  const watch = await jget(
    `/anime/gogoanime/watch/${encodeURIComponent(episodeId)}`,
  ).catch(() => null);
  const sources = toSources(watch);
  if (sources.length === 0) return { ok: false as const, reason: "Gogoanime tidak punya sumber" };
  return {
    ok: true as const,
    matchedTitle: info?.title ?? hit.title ?? title,
    sources,
    subtitles: toSubs(watch),
  };
}

// ---------------------------------------------------------- actions ----

/**
 * Sumber streaming CONSUMET untuk 1 episode.
 *
 * `kind: "film"`  → FlixHQ (film & series, subtitle Indonesia disertakan).
 * `kind: "anime"` → Gogoanime (anime & donghua).
 *
 * Selalu dipanggil sebagai CADANGAN di samping server utama YoruNime, jadi
 * kalau Consumet sedang mati layar nonton tetap jalan seperti biasa.
 */
export const resolve = action({
  args: {
    kind: v.union(v.literal("film"), v.literal("anime")),
    title: v.string(),
    episode: v.number(),
  },
  handler: async (_ctx, { kind, title, episode }) => {
    const q = String(title ?? "").trim();
    if (!q) return { ok: false as const, reason: "Judul kosong" };
    const ep = Math.max(1, Math.floor(episode || 1));
    try {
      const key = `res:${kind}:${norm(q)}:${ep}`;
      const r = await memo(key, 30 * 60_000, () =>
        kind === "film" ? flixhqResolve(q, ep) : gogoResolve(q, ep),
      );
      if (r.ok) return { ...r, provider: kind === "film" ? "flixhq" : "gogoanime" };
      return r;
    } catch (e) {
      return {
        ok: false as const,
        reason: e instanceof Error ? e.message : "Consumet tidak terjangkau",
      };
    }
  },
});

// ------------------------------------------------------------ mangadex ----

/** Cari manga/manhwa di MangaDex lewat Consumet. */
export const mangaSearch = action({
  args: { query: v.string() },
  handler: async (_ctx, { query }) => {
    const q = String(query ?? "").trim();
    if (!q) return [] as { id: string; title: string; image?: string }[];
    try {
      return await memo(`msearch:${norm(q)}`, 30 * 60_000, async () => {
        const r = await jget(`/manga/mangadex/${encodeURIComponent(q)}`);
        const list: any[] = r?.results ?? r ?? [];
        return list.slice(0, 20).map((m: any) => ({
          id: String(m?.id ?? ""),
          title: String(m?.title ?? m?.name ?? "Tanpa judul"),
          image: typeof m?.image === "string" ? m?.image : undefined,
        }));
      });
    } catch {
      return [] as { id: string; title: string; image?: string }[];
    }
  },
});

/** Daftar chapter satu judul (MangaDex) — dipakai pemilih chapter. */
export const mangaChapters = action({
  args: { mediaId: v.string() },
  handler: async (_ctx, { mediaId }) => {
    if (!mediaId) return [] as { id: string; title: string; number: number }[];
    try {
      return await memo(`mch:${mediaId}`, 15 * 60_000, async () => {
        const r = await jget(
          `/manga/mangadex/info/${encodeURIComponent(mediaId)}`,
        );
        const list: any[] = r?.chapters ?? [];
        return list.map((c: any, i: number) => ({
          id: String(c?.id ?? c?.chapterId ?? ""),
          title: String(c?.title ?? c?.name ?? `Chapter ${i + 1}`),
          number: Number(c?.number ?? c?.chapterNumber ?? i + 1) || i + 1,
        }));
      });
    } catch {
      return [] as { id: string; title: string; number: number }[];
    }
  },
});

/** Semua lembar gambar 1 chapter (MangaDex) untuk pembaca YoruNime. */
export const mangaRead = action({
  args: { chapterId: v.string() },
  handler: async (_ctx, { chapterId }) => {
    if (!chapterId) return [] as string[];
    try {
      return await memo(`mread:${chapterId}`, 6 * 3600_000, async () => {
        const r = await jget(
          `/manga/mangadex/read/${encodeURIComponent(chapterId)}`,
        );
        const pages: any[] = Array.isArray(r) ? r : (r?.pages ?? []);
        return pages
          .map((p: any) => (typeof p === "string" ? p : String(p?.url ?? "")))
          .filter((u: string) => !!u && !/data:image/i.test(u));
      });
    } catch {
      return [] as string[];
    }
  },
});
