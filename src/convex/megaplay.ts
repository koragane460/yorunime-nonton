"use node";
// YoruNime — MegaPlay: ambil URL HLS langsung (m3u8) + subtitle + intro/outro.
// Halaman & getSources butuh header Referer megaplay.buzz; file `enc` di-dekripsi
// AES-256-CBC (key "i?LMTAx0Q6,:}50U" di-pad ke 32 byte, IV "W0;27ToaUpl_P%'c").
// Semua URL video/sub dikirim lewat proxy /megastream (lihat http.ts) karena
// segment & .vtt menolak request tanpa Referer.
import { v } from "convex/values";
import { action } from "./_generated/server";
import { resolveIndo, type IndoSource } from "./indo";
import crypto from "node:crypto";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const REF = "https://megaplay.buzz/";

const b64url = (u: string) => Buffer.from(u, "utf8").toString("base64url");
const proxyUrl = (u: string) =>
  `${process.env.CONVEX_SITE_URL ?? ""}/megastream?u=${b64url(u)}`;

function decryptEnc(enc: string): string {
  const key = Buffer.concat([
    Buffer.from("i?LMTAx0Q6,:}50U", "utf8"),
    Buffer.alloc(16),
  ]);
  const iv = Buffer.from("W0;27ToaUpl_P%'c", "utf8");
  const ct = Buffer.from(
    String(enc).replace(/-/g, "+").replace(/_/g, "/"),
    "base64",
  );
  const d = crypto.createDecipheriv("aes-256-cbc", key, iv);
  return Buffer.concat([d.update(ct), d.final()]).toString("utf8");
}

type Track = { label: string; url: string; lang: string; kind: string };

async function pickVariant(malId: string, ep: number, kind: "sub" | "dub") {
  const page = await fetch(`${REF}stream/mal/${malId}/${ep}/${kind}`, {
    headers: {
      "User-Agent": UA,
      Referer: REF,
      "Accept-Language": "en-US,en;q=0.9",
    },
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
  });
  if (!r.ok) return null;
  const j = (await r.json()) as any;
  if (!j?.enc) return null;

  const decoded = JSON.parse(decryptEnc(j.enc)) as { file?: string };
  if (!decoded.file) return null;

  const tracks: Track[] = (Array.isArray(j.tracks) ? j.tracks : []).map(
    (t: any) => ({
      label: String(t.label ?? "Subtitle"),
      url: proxyUrl(String(t.file)),
      lang: /indonesia|indonesian/i.test(String(t.label ?? ""))
        ? "id"
        : String(t.label ?? "und").slice(0, 8).toLowerCase(),
      kind,
    }),
  );

  return {
    kind,
    m3u8: proxyUrl(decoded.file),
    tracks,
    intro: j.intro ?? null,
    outro: j.outro ?? null,
  };
}

// Label cadangan kalau tidak ada sumber Indonesia.
const HLS_LABEL = "MegaPlay · SUB";

// Cache hasil akhir per episode. Ganti episode jadi instan karena URL HLS
// Sub Indo tidak perlu dicari ulang ke penyedia.
const resultCache = new Map<string, { value: any; at: number }>();
const RESULT_TTL = 30 * 60_000;

/** Bentuk hasil yang sama dengan resolveEpisode, dirakit dari sumber Indo saja.
 *  Dipakai untuk judul tanpa MAL id — MegaPlay tidak bisa dipakai, jadi
 *  sumber Indonesia langsung yang jadi andalan supaya episodenya tetap ada. */
  async function resolveByTitle(
    ep: number,
    title: string | undefined,
    fast: boolean,
  ): Promise<Record<string, any> | { ok: false; reason: string }> {
    if (!title) {
      return { ok: false as const, reason: "Episode ini belum tersedia di server MegaPlay" };
    }
    const indo = await resolveIndo(title, ep, { max: fast ? 2 : 5 }).catch(() => []);
    const direct = indo.filter((s) => s.type === "hls" || s.type === "mp4");
    if (direct.length === 0) {
      return { ok: false as const, reason: "Episode ini belum tersedia di server MegaPlay" };
    }
    return {
      ok: true as const,
      sources: direct.slice(0, 3).map((s) => ({
        label: s.label || "SUB Indonesia",
        url: s.url,
        type: s.type === "mp4" ? ("mp4" as const) : ("hls" as const),
        baked: true,
      })),
      subtitle: null,
      subtitles: [],
      subTracks: [],
      hasIndonesian: true,
      // Subtitle Indonesia menempel langsung di video sumber Indo.
      bakedSubs: true,
      intro: null,
      outro: null,
      megaM3u8: null,
      megaRef: REF,
    };
  }

export const resolveEpisode = action({
  args: {
    malId: v.optional(v.string()),
    ep: v.number(),
    title: v.optional(v.string()),
    /** Premium: resolusi jalan cepat (sumber indo dibatasi + MegaPlay paralel). */
    fast: v.optional(v.boolean()),
  },
  handler: async (_ctx, { malId, ep, title, fast }) => {
    // Anime dari sumber non-MAL (mis. Otakudesu) tidak punya MAL id, jadi
    // MegaPlay tidak bisa dipakai. Hanya sumber subtitle Indonesia yang bisa.
    if (!malId || !/^\d+$/.test(malId)) {
      return resolveByTitle(ep, title, fast === true);
    }
    const key = `${malId}__ep${ep}`;
    const hit = resultCache.get(key);
    if (hit && Date.now() - hit.at < RESULT_TTL) return hit.value;
    if (resultCache.size > 300) resultCache.clear();

    const finish = (value: any) => {
      if (value?.ok) resultCache.set(key, { value, at: Date.now() });
      return value;
    };

    try {
      // Sumber Indonesia dicek bersamaan dengan MegaPlay. Untuk member premium
      // keduanya ditembakkan benar-benar paralel (tidak menunggu indo selesai
      // dulu sebelum MegaPlay dimulai), jadi frame pertama muncul lebih cepat.
      const subPromise = pickVariant(malId, ep, "sub").catch(() => null);
      const indoPromise: Promise<IndoSource[]> = title
        ? resolveIndo(title, ep, { max: fast ? 2 : 5 }).catch(() => [])
        : Promise.resolve([]);
      const [sub, indo] = await Promise.all([subPromise, indoPromise]);
      // Daftar server DIBATASI hanya MegaPlay (permintaan: server lain seperti
      // sumber Indonesia / embed dihapus semua). `indo` tetap diambil untuk
      // menentukan apakah subtitle Indonesia sudah menempel pada video
      // (bakedSubs), tapi URL-nya tidak pernah dikirim ke player lagi.
      void indo;
      const indoDirect = indo.filter((s) => s.type === "hls" || s.type === "mp4");
      const indoHasBaked = indoDirect.length > 0;

      // Urutan sumber: HANYA HLS MegaPlay SUB — server lain (sumber Indonesia
      // langsung & embed) sudah dihapus sesuai permintaan. Artinya tiap episode
      // selalu memakai satu server yang sama, dan kualitas ditentukan oleh
      // level HLS di dalamnya (bukan oleh pindah server).
      // `baked` false: subtitle Indonesia tidak menempel di video MegaPlay,
      // jadi overlay subtitle buatan kita yang dipakai.
      const sources: {
        label: string;
        url: string;
        type: "hls" | "mp4" | "embed";
        baked: boolean;
      }[] = [];
      if (sub) {
        sources.push({ label: HLS_LABEL, url: sub.m3u8, type: "hls", baked: false });
      }

      // Cadangan: MegaPlay tidak selalu punya semua judul/season (episode
      // bisa terdaftar tapi tidak punya video di sana). Kalau sumbernya
      // kosong, pakai sumber Indonesia langsung supaya video tetap ada.
      if (sources.length === 0) {
        for (const s of indoDirect.slice(0, 3)) {
          sources.push({
            label: s.label || "SUB Indonesia",
            url: s.url,
            type: s.type === "mp4" ? "mp4" : "hls",
            baked: true,
          });
        }
      }

      if (sources.length === 0) {
        return { ok: false as const, reason: "Episode belum tersedia" };
      }

      // Track subtitle MegaPlay selalu dikirim. Player cuma memakainya saat server
      // yang diputar tidak punya subtitle sendiri, jadi tidak mungkin doabel —
      // dan tetap jadi cadangan kalau terjemahan kita gagal dibuat.
      const allTracks: Track[] = sub?.tracks ?? [];
      // Prioritas subtitle: Indonesia > English > track pertama.
      const isEn = (t: Track) =>
        /^en(|-|_)/i.test(t.label.trim()) || t.lang === "en";
      const preferred =
        allTracks.find((t) => t.lang === "id") ??
        allTracks.find(isEn) ??
        allTracks[0] ??
        null;

      return finish({
        ok: true as const,
        sources,
        subtitle: preferred,
        subtitles: allTracks,
        // Track subtitle versi SUB (untuk pemilih subtitle di player)
        subTracks: allTracks,
        hasIndonesian: indoHasBaked || allTracks.some((t) => t.lang === "id"),
        // false: subtitle Indonesia tidak menempel di video MegaPlay.
        bakedSubs: false,
        intro: sub?.intro ?? null,
        outro: sub?.outro ?? null,
        // Versi HLS MegaPlay — dipakai mini player.
        megaM3u8: sub?.m3u8 ?? null,
        megaRef: REF,
      });
    } catch (e) {
      return {
        ok: false as const,
        reason: e instanceof Error ? e.message : "Gagal memuat episode",
      };
    }
  },
});
