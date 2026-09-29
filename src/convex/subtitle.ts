"use node";
// YoruNime — subtitle Indonesia otomatis.
// Ambil track subtitle English dari MegaPlay, terjemahkan ke Bahasa Indonesia
// (Google Translate), lalu dikembalikan sebagai WebVTT supaya bisa langsung
// dipasang ke <track> di player kita sendiri. Hasil disimpan di storage Convex
// agar episode cukup diterjemahkan satu kali.
import { v } from "convex/values";
import { action } from "./_generated/server";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const REF = "https://megaplay.buzz/";
const MAX_CUES = 700;

type Cue = { start: string; end: string; text: string };

/** Ambil URL file subtitle dari halaman episode MegaPlay (dengan retry). */
async function getSources(malId: string, ep: number) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const page = await fetch(`${REF}stream/mal/${malId}/${ep}/sub`, {
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

/** Parse WebVTT (sederhana: blok dipisah baris kosong, timing di baris 1). */
function parseVtt(text: string): Cue[] {
  const out: Cue[] = [];
  for (const block of text.replace(/\r/g, "").split(/\n{2,}/)) {
    const lines = block.split("\n").filter((l) => l.trim() !== "");
    if (lines.length < 2) continue;
    const timing = lines.find((l) => l.includes("-->"));
    if (!timing) continue;
    const body = lines
      .slice(lines.indexOf(timing) + 1)
      .join(" ")
      .replace(/<[^>]+>/g, "")
      .trim();
    if (!body) continue;
    const [start, end] = timing.split("-->").map((s) => s.trim().split(" ")[0]);
    out.push({ start, end, text: body });
    if (out.length >= MAX_CUES) break;
  }
  return out;
}

const toVtt = (cues: Cue[]) =>
  "WEBVTT\n\n" +
  cues
    .map((c) => `${c.start} --> ${c.end}\n${c.text}`)
    .join("\n\n") +
  "\n";

/** Terjemahkan banyak baris sekaligus; separator dipakai agar urut terjaga. */
async function translateBatch(lines: string[]): Promise<string[]> {
  if (lines.length === 0) return [];
  const SEP = "\u241F";
  const payload = lines.join(SEP);
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=id&dt=t&q=${encodeURIComponent(payload)}`;
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
  // Fallback: jumlah baris tidak sama → pakai hasil apa adanya untuk yang
  // bisa dicocokkan, sisanya biarkan bahasa asli.
  return lines.map((_, i) => parts[i] ?? lines[i]);
}

async function translateCues(cues: Cue[]): Promise<{ cues: Cue[]; translated: boolean }> {
  const CHUNK = 25;
  const out: Cue[] = [];
  let okCount = 0;
  // Batas waktu total: kalau translator lambat, sisa cue dipakai apa adanya
  // supaya player tetap punya subtitle (daripada gagal sama sekali).
  const deadline = Date.now() + 45_000;
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
        done = await translateBatch(slice.map((c) => c.text));
      } catch {
        done = null;
        await new Promise((r) => setTimeout(r, 900 * (attempt + 1)));
      }
      if (Date.now() > deadline) break;
    }
    if (done) {
      okCount += slice.length;
      slice.forEach((c, k) => out.push({ ...c, text: done![k] || c.text }));
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

export const subtitleIndo = action({
  args: { malId: v.string(), ep: v.number() },
  handler: async (runCtx, { malId, ep }) => {
    void runCtx;
    try {
      const src = await getSources(malId, ep);
      const tracks: any[] = Array.isArray(src?.tracks) ? src.tracks : [];
      // Prioritas: track Indonesia asli kalau ada, kalau tidak English.
      const pick =
        tracks.find((t) => /indonesia|indonesian/i.test(String(t.label ?? ""))) ??
        tracks.find((t) => /^en\b|english/i.test(String(t.label ?? ""))) ??
        tracks[0];
      if (!pick?.file) return { ok: false as const, reason: "Subtitle tidak tersedia" };

      const raw = await fetchText(String(pick.file));
      const cues = parseVtt(raw);
      if (cues.length === 0)
        return { ok: false as const, reason: "Subtitle tidak bisa dibaca" };

      const isIndo = /indonesia|indonesian/i.test(String(pick.label ?? ""));
      const result = isIndo
        ? { cues, translated: true }
        : await translateCues(cues);
      return {
        ok: true as const,
        vtt: toVtt(result.cues),
        source: isIndo ? "indo" : result.translated ? "auto" : "raw",
      };
    } catch (e) {
      return {
        ok: false as const,
        reason: e instanceof Error ? e.message : "Gagal membuat subtitle",
      };
    }
  },
});
