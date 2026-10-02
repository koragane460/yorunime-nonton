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
const MAX_CUES = 900;

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
    const [start, end] = timing.split("-->").map((s) => clean(s.split(" ")[0] ?? ""));
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
 */
async function translateBatch(lines: string[], from: string): Promise<string[]> {
  if (lines.length === 0) return [];
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
  if (parts.length === lines.length) return parts;
  // Jumlah baris tidak sama → pakai hasil yang bisa dicocokkan, sisanya biarkan
  // bahasa asli supaya tidak ada baris yang hilang.
  return lines.map((_, i) => parts[i] ?? lines[i]);
}

async function translateCues(
  cues: Cue[],
  from: string,
): Promise<{ cues: Cue[]; translated: boolean }> {
  const CHUNK = 20;
  const out: Cue[] = [];
  let okCount = 0;
  // Batas waktu total: kalau translator lambat, sisa cue dipakai apa adanya
  // supaya player tetap punya subtitle (daripada gagal sama sekali).
  const deadline = Date.now() + 40_000;
  for (let i = 0; i < cues.length; i += CHUNK) {
    const slice = cues.slice(i, i + CHUNK);
    if (Date.now() > deadline) {
      slice.forEach((c) => out.push(c));
      continue;
    }
    let done: string[] | null = null;
    // Dua percobaan: Google Translate kadang rate-limit sesaat.
    for (let attempt = 0; attempt < 2 && !done; attempt++) {
      try {
        done = await translateBatch(slice.map((c) => c.text), from);
      } catch {
        done = null;
        await new Promise((r) => setTimeout(r, 900 * (attempt + 1)));
      }
      if (Date.now() > deadline) break;
    }
    if (done) {
      okCount += slice.length;
      slice.forEach((c, k) =>
        out.push({ ...c, text: done![k]?.trim() || c.text }),
      );
    } else {
      slice.forEach((c) => out.push(c));
    }
    // Jeda kecil supaya Google Translate tidak rate-limit.
    await new Promise((r) => setTimeout(r, 350));
  }
  // Kalau tak ada satu pun chunk yang berhasil, tetap kirim subtitle aslinya
  // supaya player tidak kehilangan subtitle sama sekali.
  return { cues: out, translated: okCount > 0 };
}

/** Track paling masuk akal untuk dijadikan subtitle Indonesia. */
function pickTrack(tracks: any[]) {
  const label = (t: any) => String(t?.label ?? "");
  const isIndo = (t: any) => /indonesia|indonesian|\bids?\b/i.test(label(t));
  const isEn = (t: any) => /^en\b|english/i.test(label(t));
  return (
    tracks.find((t) => isIndo(t) && t?.file) ??
    tracks.find((t) => t?.default && isEn(t)) ??
    tracks.find((t) => isEn(t) && t?.file) ??
    tracks.find((t) => t?.file) ??
    null
  );
}

/**
 * Cache per instance action: episode yang sama tidak perlu diterjemahkan ulang
 * saat user pindah-pindah server atau membuka ulang halaman.
 */
const cache = new Map<string, { vtt: string; source: string; at: number }>();
const CACHE_TTL = 60 * 60_000;

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
    const cacheKey = `${malId}:${ep}`;
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
      const pick = pickTrack(tracks);
      if (!pick?.file) return { ok: false as const, reason: "Subtitle tidak tersedia" };

      const raw = await fetchText(String(pick.file));
      const cues = parseVtt(raw);
      if (cues.length === 0)
        return { ok: false as const, reason: "Subtitle tidak bisa dibaca" };

      const label = String(pick.label ?? "");
      const isIndo = /indonesia|indonesian/i.test(label);
      // Track English → sumber terjemahan "en". Track lain (mis. Spanish)
      // biarkan dideteksi otomatis oleh Google.
      const result = isIndo
        ? { cues, translated: true }
        : await translateCues(cues, /^en\b|english/i.test(label) ? "en" : "auto");
      const source = isIndo ? "indo" : result.translated ? "auto" : "raw";
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