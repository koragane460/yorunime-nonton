// Sumber musik untuk layar "Musik".
//
// Dua sumber, keduanya gratis tanpa API key dan keduanya sudah dicek punya
// header `Access-Control-Allow-Origin: *` + mendukung HTTP Range, jadi audio
// bisa langsung played dan di-seek dari elemen <audio> di browser:
//
//   1. iTunes Search API  -> potongannya 30 detik, katalog sangat besar
//      (OST anime, J-Pop, K-Pop, indie Indonesia, lofi, EDM, jazz).
//      SampeExperiment/YTMusic butuh OAuth + API key berbayar, jadi tidak
//      dipakai di sini.
//
//   2. Internet Archive  -> Trek PENUH (bukan 30 detik), koleksi netlabel,
//      musik klasik dan bebas hak cipta. Dipakai supaya ada lagu yang bisa
//      didengarkan sampai habis tanpa jeda.
//
// Skema hasil dibuat datar supaya aman dikirim lewat Convex.

import { v } from "convex/values";
import { action } from "./_generated/server";

export type MusicTrack = {
  id: string;
  title: string;
  artist: string;
  album: string;
  cover: string;
  /** URL audio yang bisa langsung di-stream browser. */
  audioUrl: string;
  /** Perkiraan durasi detik. 0 kalau belum diketahui (bagek elemen audio). */
  durationSec: number;
  source: "itunes" | "archive";
  /** "penuh" = trek utuh, "potongan" = pratinjau 30 detik. */
  kind: "penuh" | "potongan";
};

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/** Batas waktu satu request ke sumber luar. */
const TIMEOUT_MS = 12_000;

async function getJson(url: string): Promise<any | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

const clip = (v: unknown, max = 120): string =>
  typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";

/**
 * Saring lagu "brainrot" / meme / junk.
 *
 * Kata seperti "brainrot", "skibidi", atau "meme song" bikin lagu junk masuk
 * katalog utama (sebelumnya ada judul "Italian Brainrot Anime Opening" di
 * baris OST). Katalog resmi seharusnya lagu sungguhan, jadi yang judulnya
 * mengandung kata-kata ini dibuang.
 */
const BRAINROT_WORDS = [
  "brainrot",
  "skibidi",
  "meme song",
  "ohio",
  "gyatt",
  "rizz",
  "fanum tax",
  "grimace shake",
  "minecraft parody",
  "parody",
  "sped up",
  "slowed reverb",
  "tiktok version",
];

/** True kalau judul/album lagu ini termasuk junk yang tidak mau ditampilkan. */
export function isBrainrot(t: { title: string; album: string }): boolean {
  const hay = `${t.title} ${t.album}`.toLowerCase();
  return BRAINROT_WORDS.some((w) => hay.includes(w));
}

/** iTunes hanya punya audio kalau ada previewUrl; hasil tanpa preview dibuang. */
function mapItunes(raw: any): MusicTrack | null {
  const audioUrl = clip(raw?.previewUrl, 400);
  if (!audioUrl) return null;
  const title = clip(raw?.trackName);
  if (!title) return null;
  const cover100 = clip(raw?.artworkUrl100, 300);
  return {
    id: `it_${raw?.trackId ?? raw?.trackViewUrl ?? title}`,
    title,
    artist: clip(raw?.artistName) || "Artis tak diketahui",
    album: clip(raw?.collectionName, 90),
    // Ganti ukuran thumbnail Apple jadi 600px supaya tajam di layar HP.
    cover: cover100 ? cover100.replace("100x100bb", "600x600bb") : "",
    audioUrl,
    durationSec: 0,
    source: "itunes",
    kind: "potongan",
  };
}

async function searchItunes(
  term: string,
  limit: number,
  country?: string,
): Promise<MusicTrack[]> {// Pasar `country` untuk fokus pasar tertentu. Untuk Indonesia, iTunes jauh
    // lebih tepat: tanpa itu, kueri "lagu indonesia" mengembalikan artis
    // Amerika.
  const url =
    `https://itunes.apple.com/search?term=${encodeURIComponent(term)}` +
    `&entity=song&limit=${Math.min(50, Math.max(1, limit))}` +
    (country ? `&country=${country}` : "");
  const data = await getJson(url);
  if (!Array.isArray(data?.results)) return [];
  const out: MusicTrack[] = [];
  const seen = new Set<string>();
  for (const r of data.results) {
    const t = mapItunes(r);
    if (!t) continue;
    const key = `${t.artist}|${t.title}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    if (isBrainrot(t)) continue;
    out.push(t);
  }
  return out;
}

// ------------------------------------------------- Internet Archive ----

/** advancedsearch.php: cari item audio, urut dari yang paling banyak diunduh. */
async function archiveIds(term: string, rows: number): Promise<string[]> {
  const q = `(${term}) AND mediatype:(audio)`;
  const url =
    `https://archive.org/advancedsearch.php?q=${encodeURIComponent(q)}` +
    `&fl%5B%5D=identifier&fl%5B%5D=title&fl%5B%5D=creator` +
    `&sort%5B%5D=downloads+desc&rows=${rows}&page=1&output=json`;
  const data = await getJson(url);
  const docs = data?.response?.docs;
  if (!Array.isArray(docs)) return [];
  return docs
    .map((d: any) => clip(d?.identifier, 80))
    .filter((v: string) => v.length > 0);
}

/** Ambil trek mp3 dari satu item; durasi diambil dari metadata file. */
async function archiveTracks(id: string, max: number): Promise<MusicTrack[]> {
  const meta = await getJson(`https://archive.org/metadata/${encodeURIComponent(id)}`);
  const files = Array.isArray(meta?.files) ? meta.files : [];
  const title = clip(meta?.metadata?.title, 90) || id;
  const creatorRaw = meta?.metadata?.creator;
  const artist =
    (Array.isArray(creatorRaw) ? clip(creatorRaw[0], 60) : clip(creatorRaw, 60)) ||
    "Artis tak diketahui";

  const out: MusicTrack[] = [];
  for (const f of files) {
    if (out.length >= max) break;
    const name = clip(f?.name, 200);
    if (!name || !/\.mp3$/i.test(name)) continue;
    // Berkas yang rusak (mis. 0 byte atau terlalu kecil) jangan dipakai.
    const size = Number(f?.size ?? 0);
    if (size > 0 && size < 400_000) continue;
    const secs = Number(f?.length ?? 0);
    // Soundtrack sering diletakkan di subdirektori
    // (".../Disc 1/1 01 Main Theme.mp3"), jadi untuk judul hanya bagian
    // terakhir yang dipakai. URL tetap memakai nama lengkap.
    const base = (name.split("/").pop() ?? name).replace(/\.mp3$/i, "");
    const nice = base
      // Buang label disk dan penomoran urut ("Disc 1/01 - Opening Movie").
      .replace(/^disc\s*\d+\s*(\/\s*\d+)?\s*[-_.\s]\s*/i, "")
      .replace(/^track\s*\d+\s*[-_.\s]\s*/i, "")
      .replace(/^\d{1,3}[\s]*[._\-/]+/, "")
      .replace(/^\d{1,3}\s+/, "")
      // Buang kode item ("tcp_d1_", "ns050-", "NS050_") di depan judul.
      .replace(/^[a-z]{2,6}\d+[_-]/i, "")
      .replace(/^[a-z]{2,5}_d\d+_/i, "")
      .replace(/^[a-z]{2,5}_/i, "")
      .replace(/[_.]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase()
      .replace(/(^|\s)(\w)/g, (_m, sp: string, c: string) => sp + c.toUpperCase());
    out.push({
      id: `ar_${id}_${name}`,
      title: nice.slice(0, 120) || title,
      artist,
      album: title,
      cover: `https://archive.org/services/img/${encodeURIComponent(id)}`,
      audioUrl: `https://archive.org/download/${encodeURIComponent(id)}/${encodeURIComponent(name)}`,
      durationSec: Number.isFinite(secs) && secs > 0 ? Math.round(secs) : 0,
      source: "archive",
      kind: "penuh",
    });
  }
  return out;
}

/** Satu item bisa punya banyak file mp3; ambil paling banyak maxPerItem. */
async function searchArchive(
  term: string,
  items: number,
  maxPerItem: number,
): Promise<MusicTrack[]> {
  const ids = await archiveIds(term, items);
  if (ids.length === 0) return [];
  const lists = await Promise.all(
    ids.map((id) => archiveTracks(id, maxPerItem).catch(() => [] as MusicTrack[])),
  );
  return lists.flat();
}

// --------------------------------------------------------------- API ----

/**
 * Pencarian musik. iTunes (potongan 30 detik) digabung dengan Internet
 * Archive (trek penuh) supaya hasil tidak barren dan ada yang bisa
 * didengarkan sampai habis.
 */
/**
 * Pencarian archive memakai Lucene bebas, jadi kata kunci diinterpretasikan
 * sebagai OR pada semua field: kueri ngelantir bisa tetap mengembalikan
 * sesuatu yang sama sekali tidak berhubungan. Hasil yang judul/penyanyi/
 * albumnya tidak memuat satupun kata kueri dibuang.
 */
export function relevant(tracks: MusicTrack[], q: string): MusicTrack[] {
  const words = q
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3);
  if (words.length === 0) return tracks;
  return tracks.filter((t) => {
    const hay = `${t.title} ${t.artist} ${t.album}`.toLowerCase();
    return words.some((w) => hay.includes(w));
  });
}

export const musicSearch = action({
  args: { q: v. string(), limit: v.optional(v.number()) },
  handler: async (_ctx, args) => {
    const q = args.q.trim();
    if (q.length < 2) return [] as MusicTrack[];
    const limit = Math.min(40, Math.max(6, args.limit ?? 20));
    const [it, arRaw] = await Promise.all([
      searchItunes(q, Math.ceil(limit * 0.7)).catch(() => [] as MusicTrack[]),
      searchArchive(q, 3, 3).catch(() => [] as MusicTrack[]),
    ]);
    const ar = relevant(arRaw, q);
    const seen = new Set<string>();
    const merged: MusicTrack[] = [];
    // Potongannya didahulukan supaya hasil teratas tetap yang paling mudah
    // ditemukan, trek penuh menyusul di bawah.
    for (const t of [...it, ...ar]) {
      if (!t.audioUrl) continue;
      const key = `${t.artist}|${t.title}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      if (isBrainrot(t)) continue;
      merged.push(t);
      if (merged.length >= limit) break;
    }
    return merged;
  },
});

/** Daftar katalog siap pakai supaya layar Musik tidak kosong saat dibuka. */
type SectionDef = {
  id: string;
  label: string;
  /** Kueri iTunes. Diabaikan kalau `archive` diisi. */
  term?: string;
  /** Pasar iTunes. "id" bikin hasilnya benar-benar lagu Indonesia. */
  country?: string;
  /** Kueri Internet Archive untuk baris trek penuh. */
  archive?: string;
};

const SECTIONS: SectionDef[] = [
  { id: "anime", label: "Anime & OST", term: "anime soundtrack" },
  { id: "ost", label: "Opening & Ending", term: "anime opening theme" },
  {
    id: "ostpenuh",
    label: "OST Penuh",
    archive:
      'mediatype:audio AND subject:("original soundtrack") AND -title:(background)',
  },
  {
    id: "full",
    label: "Trek Penuh",
    archive: "collection:netlabels AND subject:(electronic)",
  },
  { id: "jpop", label: "J-Pop & K-Pop", term: "jpop kpop" },
  { id: "indo", label: "Lagu Indonesia", term: "indonesian", country: "id" },
  { id: "dangdut", label: "Dangdut", term: "dangdut", country: "id" },
  { id: "lofi", label: "Lofi & Chill", term: "lofi hip hop" },
];

/** Satu baris katalog musik (dipakai untuk baris di layar Musik). */
export const musicSection = action({
  args: { section: v.string(), limit: v.optional(v.number()) },
  handler: async (_ctx, args) => {
    const s = SECTIONS.find((x) => x.id === args.section) ?? SECTIONS[0];
    const limit = Math.min(30, Math.max(4, args.limit ?? 12));
    if (s.archive) {
      // Trek penuh hanya ada di Internet Archive.
      const ar = await searchArchive(s.archive, 4, Math.ceil(limit / 2)).catch(
        () => [] as MusicTrack[],
      );
      return { section: s.id, label: s.label, tracks: ar.slice(0, limit) };
    }
    const it = await searchItunes(s.term ?? s.id, limit, s.country).catch(
      () => [] as MusicTrack[],
    );
    return { section: s.id, label: s.label, tracks: it };
  },
});

/** Daftar semua section (buat baris judul + tab di layar Musik). */
export const musicSections = action({
  args: {},
  handler: async () => SECTIONS.map(({ id, label }) => ({ id, label })),
});

/**
 * Cari satu video YouTube untuk sebuah lagu.
 *
 * Kenapa YouTube: lagu dari iTunes hanya potongan 30 detik. YouTube memutar
 * lagu PENUH dan pemutar resminya (IFrame Player API) bisa dikontrol lewat
 * JavaScript tanpa API key, jadi UI player YoruNime tetap milik sendiri.
 *
 * Cara ambil videonya: halaman hasil pencarian YouTube berisi daftar video
 * beserta videoId di dalam JSON-nya. Kita ambil videoId non-trailer yang
 * paling relevan. Ini scraping ringan, bukan YouTube Data API, jadi tidak
 * butuh kunci apa pun. Kalau YouTube mengubah bentuk HTML-nya, fungsi ini
 * aman gagal (mengembalikan null) dan player jatuh ke pratinjau iTunes.
 */
export const youtubeFind = action({
  args: { q: v.string(), remix: v.optional(v.boolean()) },
  handler: async (_ctx, args) => {
    const q = args.q.trim();
    if (q.length < 2) return { videoId: null };

    // sp=EgIQAQ%3D%3D adalah filter "Video" saja (bukan playlist/channel).
    // Dulu saya menulisnya %253D (doobel encode), jadi nilainya salah dan
    // filter tidak diterapkan. Hasil pencarian tetap keluar karena kita
    // mengambil videoId, tapi kualitasnya tidak terjaga.
    //
    // `remix` menambahkan kata "remix" ke kueri supaya versi remix juga
    // ketemu, bukan cuma versi asli lagunya.
    const term = args.remix ? `${q} remix` : q;
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(term)}&sp=EgIQAQ%3D%3D`;
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": UA,
          "Accept-Language": "en-US,en;q=0.9,id;q=0.8",
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) return { videoId: null };
      const html = await res.text();

      // videoId valid: 11 karakter huruf/angka/-. Ambil berurutan dan buang
      // duplikat, lalu pilih yang pertama (YouTube mengurutkan dari yang
      // paling relevan untuk kueri ini).
      const ids: string[] = [];
      const re = /"videoId":"([A-Za-z0-9_-]{11})"/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(html)) !== null) {
        if (!ids.includes(m[1])) ids.push(m[1]);
        if (ids.length >= 6) break;
      }
      return { videoId: ids[0] ?? null };
    } catch {
      return { videoId: null };
    }
  },
});

/**
 * Lirik lagu dengan penanda waktu per baris.
 *
 * Sumbernya LRCLIB (lrclib.net): gratis, tanpa API key, dan yang penting
 * liriknya BERSINKRON - setiap baris punya waktu mulai, jadi di UI lirik
 * bisa digulir otomatis mengikuti lagu seperti di Spotify.
 *
 * Format syncedLyrics adalah LRC: `[00:13.28] Perjalanan membawamu`.
 * Di sini diuraikan jadi daftar { waktuDetik, teks } supaya frontend tidak
 * perlu mem-parsing lagi.
 */
export const lyrics = action({
  args: {
    artist: v.string(),
    track: v.string(),
    /** Durasi lagu membantu LRCLIB memilih versi yang tepat. */
    durationSec: v.optional(v.number()),
  },
  handler: async (_ctx, args) => {
    const artist = args.artist.trim();
    const track = args.track.trim();
    if (!artist || !track) {
      return { synced: null, plain: null };
    }

    const headers = {
      "User-Agent": UA,
      Accept: "application/json",
    };

    // 1) Coba exact match dulu (paling akurat, termasuk durasi).
    // 2) Kalau tidak ada, pakai hasil pencarian teratas.
    const urls = [
      `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}` +
        `&track_name=${encodeURIComponent(track)}` +
        (args.durationSec && args.durationSec > 0
          ? `&duration=${Math.round(args.durationSec)}`
          : ""),
      `https://lrclib.net/api/search?track_name=${encodeURIComponent(track)}` +
        `&artist_name=${encodeURIComponent(artist)}`,
      `https://lrclib.net/api/search?q=${encodeURIComponent(`${artist} ${track}`)}`,
    ];

    for (const u of urls) {
      try {
        const res = await fetch(u, {
          headers,
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (!res.ok) continue;
        const data = await res.json();
        const rows: any[] = Array.isArray(data) ? data : [data];
        // Pilih yang punya lirik bersinkron; kalau tidak ada, yang plain saja.
        const best =
          rows.find((r) => r?.syncedLyrics) ??
          rows.find((r) => r?.plainLyrics) ??
          null;
        if (!best) continue;

        const raw: string = best.syncedLyrics ?? best.plainLyrics ?? "";
        if (!raw) continue;

        // Uraikan LRC: `[mm:ss.xx] teks`. Baris tanpa waktu (metadata)
        // dibuang.
        const lines: { t: number; text: string }[] = [];
        for (const line of raw.split("\n")) {
          const m = line.match(/^\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\](.*)$/);
          if (!m) continue;
          const min = Number(m[1]);
          const sec = Number(m[2]);
          const frac = m[3] ? Number(`0.${m[3]}`) : 0;
          const text = (m[4] ?? "").trim();
          lines.push({ t: min * 60 + sec + frac, text });
        }

        if (lines.length > 0) {
          return { synced: lines, plain: null };
        }
        const plain = (best.plainLyrics ?? "").split("\n").map((s: string) => s.trim());
        if (plain.length > 0 && plain.some(Boolean)) {
          return { synced: null, plain };
        }
      } catch {
        continue;
      }
    }
    return { synced: null, plain: null };
  },
});