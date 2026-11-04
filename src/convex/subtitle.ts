"use node";
// YoruNime — subtitle Indonesia otomatis.
// Ambil track subtitle dari MegaPlay, terjemahkan ke Bahasa Indonesia
// (Google Translate), lalu dikembalikan sebagai WebVTT supaya bisa langsung
// dipasang ke player kita sendiri. Track aslinya (English) tetap dipakai
// sebagai cadangan kalau penerjemahannya gagal.
import { v } from "convex/values";
import { action } from "./_generated/server";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const REF = "https://megaplay.buzz/";
const MAX_CUES = 1500;

type Cue = { start: string; end: string; text: string };

/** Ambil URL file subtitle dari halaman episode MegaPlay (dengan retry). */
async function getSources(malId: string, ep: number, kind: "sub" | "dub") {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const page = await fetch(`${REF}stream/mal/${malId}/${ep}/${kind}`, {
        headers: { "User-Agent": UA, Referer: REF, "Accept-Language": "en-US,en;q=0.9" },
        signal: AbortSignal.timeout(20_000),
      });
      const html = await page.text();
      const fileId = html.match(/data-id="(\d+)"/)?.[1];
      if (!fileId) return null;
      const r = await fetch(`${REF}stream/getSources?id=${fileId}`, {
        headers: {
          "User-Agent": UA,
          Referer: REF,
          "X-Requested-With": "XMLHttpRequest",
        },
        signal: AbortSignal.timeout(20_000),
      });
      if (!r.ok) return null;
      return (await r.json()) as any;
    } catch {
      await new Promise((res) => setTimeout(res, 800));
    }
  }
  return null;
}

async function fetchText(url: string) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA, Referer: REF },
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) throw new Error(`subtitle ${res.status}`);
      return await res.text();
    } catch (e) {
      if (attempt === 1) throw e;
      await new Promise((res) => setTimeout(res, 800));
    }
  }
  return "";
}

const clean = (s: string) =>
  s
    .replace(/<[^>]+>/g, "")
    .replace(/\{\\[^}]*\}/g, "")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Parse WebVTT / SRT. Satu cue dibatasi dua baris supaya overlay di player
 * tetap rapi, bukan satu blok panjang tanpa jeda.
 */
function parseVtt(text: string): Cue[] {
  const out: Cue[] = [];
  for (const block of text.replace(/\r/g, "").split(/\n{2,}/)) {
    const lines = block.split("\n").filter((l) => l.trim() !== "");
    if (lines.length < 2) continue;
    const at = lines.findIndex((l) => l.includes("-->"));
    if (at < 0) continue;
    const timing = lines[at]!;
    const body = lines
      .slice(at + 1)
      .map((l) => clean(l))
      .filter(Boolean)
      .slice(0, 2)
      .join("\n");
    if (!body) continue;
    // PENTING: bagian setelah "-->" diawali spasi ("--> 00:00:06.300").
    // Tanpa trim, `split(" ")[0]` mengembalikan string kosong dan SELURUH
    // cue dibuang — subtitle tidak pernah muncul sama sekali. SRT juga
    // memakai koma untuk milidetik, sedangkan WebVTT memakai titik, jadi
    // keduanya dinormalkan ke format WebVTT di sini.
    const [start, end] = timing
      .split("-->")
      .map((s) => clean(s.trim().split(" ")[0] ?? "").replace(",", "."));
    if (!start || !end) continue;
    out.push({ start, end, text: body });
    if (out.length >= MAX_CUES) break;
  }
  return out;
}

const toVtt = (cues: Cue[]) =>
  "WEBVTT\n\n" +
  cues.map((c) => `${c.start} --> ${c.end}\n${c.text}`).join("\n\n") +
  "\n";

/**
 * Terjemahkan banyak baris sekaligus; separator dipakai agar urut terjaga.
 * `from` = "en" untuk track English, "auto" kalau bahasanya tidak diketahui.
 *
 * Mengembalikan `null` kalau jumlah hasil TIDAK sama dengan jumlah baris —
 * Google kadang menggabungkan/membuang separator, dan hasil yang dipaksa
 * cocok akan membuat sebagian dialog diam-diam tetap bahasa asli (persis
 * keluhan "subtitle tidak diterjemahkan di beberapa bagian").
 */
/** Server penerjemah #1 — Google Translate (gtx), paling akurat. */
async function translateViaGtx(
  lines: string[],
  from: string,
): Promise<string[]> {
  const SEP = "\u241F";
  const payload = lines.join(SEP);
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=id&dt=t&q=${encodeURIComponent(payload)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (YoruNime/1.0)" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`translate ${res.status}`);
  const j: any = await res.json();
  const out = (Array.isArray(j?.[0]) ? j[0] : [])
    .map((seg: any) => (Array.isArray(seg) ? String(seg?.[0] ?? "") : ""))
    .join("");
  const parts = out.split(/\s*\u241F\s*/).map((s) => s.trim());
  if (parts.length !== lines.length || parts.some((p) => !p)) {
    throw new Error("jumlah baris tidak cocok");
  }
  return parts;
}

/**
 * Server penerjemah #2 — endpoint dictionary Chrome (clients5). Menerima
 * banyak `q` sekaligus dan membalas satu terjemahan per baris, jadi cocok
 * untuk paragraf subtitle.
 */
async function translateViaDictChrome(
  lines: string[],
  from: string,
): Promise<string[]> {
  const qs = lines.map((l) => `q=${encodeURIComponent(l)}`).join("&");
  const url = `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=${from}&tl=id&${qs}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (YoruNime/1.0)" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`dict ${res.status}`);
  const j: any = await res.json();
  const rows: any[] = Array.isArray(j)
    ? j
    : Array.isArray(j?.sentences)
      ? j.sentences
      : [];
  const out = rows.map((row: any) => {
    if (Array.isArray(row)) return String(row[0] ?? "");
    if (typeof row === "string") return row;
    return String(row?.trans ?? row?.translation ?? "");
  });
  const trimmed = out.map((s) => s.trim());
  if (trimmed.length !== lines.length || trimmed.some((p) => !p)) {
    throw new Error("bentuk balasan tidak dikenal");
  }
  return trimmed;
}

/**
 * Server penerjemah #3 — MyMemory. Hanya menerima satu baris per request,
 * tapi dipakai sebagai jaring pengaman terakhir waktu dua server Google
 * sedang menolak (rate limit / 5xx).
 */
async function translateViaMyMemory(
  lines: string[],
  from: string,
): Promise<string[]> {
  if (lines.length !== 1) throw new Error("satu baris per request");
  const src = from === "auto" ? "en" : from;
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
    lines[0]!,
  )}&langpair=${encodeURIComponent(src)}|id`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (YoruNime/1.0)" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`mymemory ${res.status}`);
  const j: any = await res.json();
  const text = String(j?.responseData?.translatedText ?? "").trim();
  if (!text) throw new Error("kosong");
  return [text];
}

/** Promise pertama yang berhasil; sisanya diabaikan (tidak membatalkan). */
function firstOk<T>(tasks: Promise<T>[]): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let pending = tasks.length;
    if (pending === 0) {
      reject(new Error("tidak ada server"));
      return;
    }
    let settled = false;
    for (const t of tasks) {
      t.then((v) => {
        if (settled) return;
        settled = true;
        resolve(v);
      }).catch(() => {
        pending -= 1;
        if (pending === 0 && !settled) reject(new Error("semua server gagal"));
      });
    }
  });
}

/**
 * Terjemahkan satu chunk dengan TIGA server yang dijalankan PARALEL: siapa
 * yang paling cepat membalas dengan jumlah baris yang benar, dia yang dipakai
 * — server yang error otomatis dilewati tanpa membuat subtitle kosong.
 */
async function translateBatch(
  lines: string[],
  from: string,
): Promise<string[] | null> {
  if (lines.length === 0) return [];
  const servers: Promise<string[]>[] = [
    translateViaGtx(lines, from),
    translateViaDictChrome(lines, from),
  ];
  // MyMemory cuma bisa satu baris; ikutkan hanya kalau chunk-nya satu baris.
  if (lines.length === 1) servers.push(translateViaMyMemory(lines, from));
  try {
    return await firstOk(servers);
  } catch {
    return null;
  }
}

/**
 * Terjemahkan SELURUH cue — tidak ada lagi batas waktu yang memotong
 * pekerjaan di tengah jalan.
 *
 * Kenapa dulu cuma ~10% episode yang ke-translate: pekerjaannya dijalankan
 * berurutan dengan deadline 75 detik. Satu chunk yang gagal lalu jatuh ke
 * mode "satu baris satu request" (≈0,5 dtk per baris) sehingga deadline
 * habis saat episode baru seperempat jalan, dan sisanya dikembalikan apa
 * adanya (bahasa Inggris). Di episode 24 menit itu terlihat seperti subtitle
 * yang berhenti diterjemahkan setelah beberapa menit pertama.
 *
 * Sekarang: chunk kecil (maks 12 baris / ~900 karakter) dijalankan PARALEL
 * (8 sekaligus), tanpa deadline. Chunk yang gagal dipecah dua, lalu per
 * baris, jadi baris yang benar-benar gagal cuma sedikit dan tetap ditandai
 * "partial" — bukan seluruh sisa episode.
 */
async function translateCues(
  cues: Cue[],
  from: string,
): Promise<{ cues: Cue[]; translated: boolean; partial: boolean }> {
  const texts = cues.map((c) => c.text);
  const out = texts.slice();
  const done = new Array<boolean>(texts.length).fill(false);
  let failCount = 0;

  // Bagi cue jadi chunk kecil. Batas karakter penting: URL GET Google
  // Translate (client=gtx) mulai terpotong di sekitar 2.000 karakter, dan
  // payload terpotong = separator hilang = seluruh chunk gagal.
  const MAX_LINES = 12;
  const MAX_CHARS = 900;
  const chunks: number[][] = [];
  let cur: number[] = [];
  let chars = 0;
  texts.forEach((t, i) => {
    const len = t.length + 1;
    if (cur.length >= MAX_LINES || (chars + len > MAX_CHARS && cur.length > 0)) {
      chunks.push(cur);
      cur = [];
      chars = 0;
    }
    cur.push(i);
    chars += len;
  });
  if (cur.length > 0) chunks.push(cur);

  /** Satu daftar indeks; gagal → belah dua; satu baris → tandai gagal. */
  const doChunk = async (idx: number[]): Promise<void> => {
    const lines = idx.map((i) => texts[i]!);
    for (let attempt = 0; attempt < 2; attempt++) {
      const parts = await translateBatch(lines, from).catch(() => null);
      if (parts && parts.length === lines.length) {
        idx.forEach((ci, k) => {
          const v = parts[k]?.trim();
          if (v) {
            out[ci] = v;
            done[ci] = true;
          }
        });
        return;
      }
      await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
    }
    if (idx.length > 1) {
      const mid = Math.ceil(idx.length / 2);
      await doChunk(idx.slice(0, mid));
      await doChunk(idx.slice(mid));
      return;
    }
    failCount += 1;
  };

  const CONCURRENCY = 8;
  let cursor = 0;
  const worker = async () => {
    while (cursor < chunks.length) {
      const my = chunks[cursor++]!;
      await doChunk(my);
      // Jeda tipis per worker supaya tidak dianggap flood oleh Google.
      await new Promise((r) => setTimeout(r, 40));
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, chunks.length) }, worker),
  );

  const translated = done.some(Boolean);
  const partial = failCount > 0;
  return {
    cues: cues.map((c, i) => ({ ...c, text: out[i] ?? c.text })),
    translated,
    partial,
  };
}

/**
 * Urutan track yang paling masuk akal untuk dijadikan subtitle Indonesia:
 * Indonesia dulu, lalu English, lalu track lain.
 */
function rankTracks(tracks: any[]) {
  const label = (t: any) => String(t?.label ?? "");
  const isIndo = (t: any) => /indonesia|indonesian|\bids?\b/i.test(label(t));
  const isEn = (t: any) => /^en\b|english/i.test(label(t));
  const usable = tracks.filter((t: any) => !!t?.file);
  return [
    ...usable.filter((t: any) => isIndo(t)),
    ...usable.filter((t: any) => !isIndo(t) && !!t?.default && isEn(t)),
    ...usable.filter((t: any) => !isIndo(t) && !t?.default && isEn(t)),
    ...usable.filter((t: any) => !isIndo(t) && !isEn(t)),
  ];
}

/**
 * Cache per instance action: episode yang sama tidak perlu diterjemahkan ulang
 * saat user pindah-pindah server atau membuka ulang halaman.
 */
const cache = new Map<string, { vtt: string; source: string; at: number }>();
const CACHE_TTL = 60 * 60_000;
// Naikkan versi cache setiap kali cara penerjemahan berubah, supaya hasil
// lama yang hanya sebagian tidak terus disajikan.
const CACHE_VERSION = "v4";

export const subtitleIndo = action({
  args: { malId: v.string(), ep: v.number() },
  handler: async (runCtx, { malId, ep }): Promise<
    | { ok: true; vtt: string; source: string; lang: string }
    | { ok: false; reason: string }
  > => {
    void runCtx;
    if (!/^\d+$/.test(String(malId ?? "")) || !(ep > 0)) {
      return { ok: false as const, reason: "Subtitle tidak tersedia" };
    }
    const cacheKey = `${CACHE_VERSION}:${malId}:${ep}`;
    const hit = cache.get(cacheKey);
    if (hit && Date.now() - hit.at < CACHE_TTL) {
      return { ok: true as const, vtt: hit.vtt, source: hit.source, lang: "id" };
    }
    try {
      // Halaman SUB biasanya punya track subtitle; kalau ternyata tidak, coba
      // halaman DUB sebelum menyerah.
      let tracks: any[] = [];
      for (const kind of ["sub", "dub"] as const) {
        const src = await getSources(String(malId), ep, kind).catch(() => null);
        const list = Array.isArray(src?.tracks) ? src.tracks : [];
        if (list.some((t: any) => t?.file)) {
          tracks = list;
          break;
        }
      }
      const ranked = rankTracks(tracks);
      if (ranked.length === 0)
        return { ok: false as const, reason: "Subtitle tidak tersedia" };

      // Setiap track dicoba satu per satu. Track pertama kadang file-nya rusak
      // atau formatnya tidak terbaca. Daripada langsung menyerah, lanjut ke
      // track berikutnya supaya user tetap dapat subtitle.
      // Semua kandidat track diunduh PARALEL: track yang servernya lambat
      // atau rusak tidak lagi menahan yang lain, dan file yang paling lengkap
      // (cue terbanyak) yang dipakai.
      let pick: any = null;
      let cues: Cue[] = [];
      const loaded = await Promise.all(
        ranked.slice(0, 4).map(async (cand) => {
          const raw = await fetchText(String(cand.file)).catch(() => "");
          return { cand, cues: parseVtt(raw) };
        }),
      );
      for (const row of loaded) {
        if (row.cues.length > cues.length) {
          cues = row.cues;
          pick = row.cand;
        }
      }
      if (!pick)
        return { ok: false as const, reason: "Subtitle tidak bisa dibaca" };

      const label = String(pick.label ?? "");
      const isIndo = /indonesia|indonesian/i.test(label);
      // Track English → sumber terjemahan "en". Track lain (mis. Spanish)
      // biarkan dideteksi otomatis oleh Google.
      const result = isIndo
        ? { cues, translated: true, partial: false }
        : await translateCues(cues, /^en\b|english/i.test(label) ? "en" : "auto");
      // "partial" = sebagian baris gagal diterjemahkan (UI memberi tahu user
      // dan tidak menyimpannya ke cache lokal supaya bisa dicoba lagi).
      const source = isIndo
        ? "indo"
        : !result.translated
          ? "raw"
          : result.partial
            ? "partial"
            : "auto";
      const vtt = toVtt(result.cues);
      if (cache.size > 120) cache.clear();
      cache.set(cacheKey, { vtt, source, at: Date.now() });
      return { ok: true as const, vtt, source, lang: isIndo ? "id" : "en" };
    } catch (e) {
      return {
        ok: false as const,
        reason: e instanceof Error ? e.message : "Gagal membuat subtitle",
      };
    }
  },
});

/* ------------------------------------------------------------------ *
 *  Subtitle untuk DONGHUA.
 *
 *  Episode donghua tidak punya MAL id, jadi `subtitleIndo` di atas selalu
 *  gagal untuknya — itulah alasan subtitle Indonesia tidak pernah muncul di
 *  halaman nonton donghua. Sumbernya: file DailyMotion milik episode itu
 *  sendiri, yang metadata-nya memuat track subtitle (SRT).
 * ------------------------------------------------------------------ */

const SANKA = "https://www.sankavollerei.web.id";

function sankaHeaders(): Record<string, string> {
  return {
    "User-Agent": UA,
    Accept: "application/json, text/plain, */*",
    Referer: `${SANKA}/anime`,
  };
}

const DM_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

/**
 * Ambil file subtitle (SRT/VTT) dari CDN DailyMotion.
 *
 * Header sederhana saja sudah cukup dari jaringan publik, tapi isolate
 * Convex kadang dibalas 403 tanpa `Referer`, jadi tiga bentuk header
 * dicoba sebelum menyerah. Status terakhir dikembalikan supaya pesan error
 * di UI menyebut penyebabnya, bukan asal "gagal".
 */
async function fetchSubtitleFile(
  url: string,
): Promise<{ text: string; status: string }> {
  const tries: Record<string, string>[] = [
    { "User-Agent": DM_UA, Referer: "https://www.dailymotion.com/" },
    { "User-Agent": DM_UA },
    { "User-Agent": DM_UA, Referer: "https://geo.dailymotion.com/", Accept: "*/*" },
  ];
  let status = "gagal";
  for (const headers of tries) {
    try {
      const res = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(15_000),
      });
      status = `HTTP ${res.status}`;
      if (!res.ok) continue;
      // CDN ini kadang membalas 200 dengan body terkompresi yang `res.text()`
      // tidak berhasil di-decode di dalam isolate; arrayBuffer + decode
      // manual jauh lebih andal.
      const buf = new Uint8Array(await res.arrayBuffer());
      let text = new TextDecoder("utf-8").decode(buf);
      if (text.includes("�")) text = new TextDecoder("windows-1252").decode(buf);
      if (text.length > 0)
        return { text, status: `${status} ${buf.length}B` };
    } catch (e) {
      status = e instanceof Error ? e.message.slice(0, 60) : "gagal";
    }
  }
  return { text: "", status };
}

/** Ambil semua track subtitle milik satu video DailyMotion. */
async function dmSubtitleTracks(videoId: string) {
  try {
    const res = await fetch(
      `https://www.dailymotion.com/player/metadata/video/${videoId}`,
      {
        headers: { "User-Agent": DM_UA, Referer: "https://www.dailymotion.com/" },
        signal: AbortSignal.timeout(12_000),
      },
    );
    if (!res.ok) return [] as { key: string; label: string; url: string }[];
    const j: any = await res.json();
    const data = j?.subtitles?.data;
    if (!data || typeof data !== "object") return [];
    const out: { key: string; label: string; url: string }[] = [];
    for (const [key, val] of Object.entries(data as Record<string, any>)) {
      const url = Array.isArray(val?.urls) ? String(val?.urls[0] ?? "") : "";
      if (url) out.push({ key, label: String(val?.label ?? key), url });
    }
    return out;
  } catch {
    return [] as { key: string; label: string; url: string }[];
  }
}

/**
 * Subtitle Indonesia untuk satu episode donghua.
 *
 * Urutan syarat: cari server DailyMotion milik episode itu (bukan pencarian
 * judul, yang bisa jadi video episode lain), ambil track yang Indonesia kalau
 * ada; kalau tidak, track English/Mandarin otomatis diterjemahkan — sama
 * seperti alur subtitle anime, jadi user tidak lagi melihat layar tanpa
 * subtitle.
 */
export const donghuaSubtitle = action({
  args: { slug: v.string() },
  handler: async (_ctx, { slug }): Promise<
    | { ok: true; vtt: string; source: string; lang: string }
    | { ok: false; reason: string }
  > => {
    const epSlug = String(slug ?? "").trim();
    if (!epSlug) return { ok: false as const, reason: "Episode belum tersedia" };

    const cacheKey = `${CACHE_VERSION}:donghua:${epSlug}`;
    const hit = cache.get(cacheKey);
    if (hit && Date.now() - hit.at < CACHE_TTL) {
      return { ok: true as const, vtt: hit.vtt, source: hit.source, lang: "id" };
    }

    // Server episode: coba donghub dulu (punya DailyMotion), lalu donghua.
    let videos: string[] = [];
    for (const src of ["donghub", "donghua"]) {
      try {
        const res = await fetch(
          `${SANKA}/anime/${src}/episode/${encodeURIComponent(epSlug)}`,
          { headers: sankaHeaders(), signal: AbortSignal.timeout(15_000) },
        );
        if (!res.ok) continue;
        const j: any = await res.json();
        const streams: any[] = Array.isArray(j?.data?.streams)
          ? j.data.streams
          : Array.isArray(j?.streaming?.servers)
            ? j.streaming.servers
            : [];
        videos = streams
          .map((s: any) => String(s?.url ?? ""))
          .map((u: string) => (u.match(/video=([a-z0-9]+)/i) ?? [])[1] ?? "")
          .filter(Boolean);
        if (videos.length > 0) break;
      } catch {
        /* coba source berikutnya */
      }
    }
    if (videos.length === 0)
      return { ok: false as const, reason: "Episode ini tidak punya subtitle" };

    // Track dari video pertama yang benar-benar punya subtitle.
    const ranked: { label: string; url: string }[] = [];
    for (const vid of videos.slice(0, 2)) {
      const tracks = await dmSubtitleTracks(vid);
      for (const t of tracks) ranked.push({ label: t.label, url: t.url });
      if (ranked.some((t) => /indonesia|indonesian|\bids?\b/i.test(t.label)))
        break;
    }
    if (ranked.length === 0)
      return { ok: false as const, reason: "Subtitle tidak tersedia" };

    const sorted = [
      ...ranked.filter((t) => /indonesia|indonesian|\bids?\b/i.test(t.label)),
      ...ranked.filter((t) => !/indonesia|indonesian|\bids?\b/i.test(t.label)),
    ];

    let pick: { label: string; url: string } | null = null;
    let cues: Cue[] = [];
    let lastStatus = "tidak ada track";
    for (const cand of sorted.slice(0, 3)) {
      // CDN DailyMotion kadang memblokir header minimal; coba dua bentuk.
      const raw = await fetchSubtitleFile(cand.url);
      lastStatus = raw.status;
      cues = parseVtt(raw.text);
      if (cues.length > 0) {
        pick = cand;
        break;
      }
    }
    if (!pick)
      return {
        ok: false as const,
        reason: `Subtitle tidak bisa dibaca (${lastStatus})`,
      };

    const isIndo = /indonesia|indonesian|\bids?\b/i.test(pick.label);
    const result = isIndo
      ? { cues, translated: true, partial: false }
      : await translateCues(cues, /english|\ben\b/i.test(pick.label) ? "en" : "auto");
    const source = isIndo
      ? "indo"
      : !result.translated
        ? "raw"
        : result.partial
          ? "partial"
          : "auto";
    const vtt = toVtt(result.cues);
    if (cache.size > 120) cache.clear();
    cache.set(cacheKey, { vtt, source, at: Date.now() });
    return { ok: true as const, vtt, source, lang: isIndo ? "id" : "en" };
  },
});