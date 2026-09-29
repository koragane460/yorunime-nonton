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

export const resolveEpisode = action({
  args: { malId: v.string(), ep: v.number(), title: v.optional(v.string()) },
  handler: async (_ctx, { malId, ep, title }) => {
    try {
      // Sumber subtitle Indonesia (Otakudesu / Oploverz) dicek bersamaan dengan
      // MegaPlay; hasilnya digabung ke daftar server player.
      const indo: IndoSource[] = title
        ? await resolveIndo(title, ep).catch(() => [])
        : [];
      const sub = await pickVariant(malId, ep, "sub");
      // MegaPlay tidak punya episodenya — kalau sumber Sub Indo ada, tetap main.
      if (!sub) {
        if (indo.length > 0) {
          return {
            ok: true as const,
            sources: indo,
            subtitle: null,
            subtitles: [],
            subTracks: [],
            hasIndonesian: true,
            intro: null,
            outro: null,
            embedSub: null,
            embedDub: null,
          };
        }
        return { ok: false as const, reason: "Episode tidak tersedia" };
      }

      const dub = await pickVariant(malId, ep, "dub").catch(() => null);
      const embedSub = `${REF}stream/mal/${malId}/${ep}/sub`;
      const embedDub = `${REF}stream/mal/${malId}/${ep}/dub`;

      const megaSources = [
        { label: "Direct HLS · SUB", url: sub.m3u8, type: "hls" },
        { label: "MegaPlay Player · SUB", url: embedSub, type: "embed" },
        ...(dub
          ? [
              { label: "Direct HLS · DUB", url: dub.m3u8, type: "hls" },
              { label: "MegaPlay Player · DUB", url: embedDub, type: "embed" },
            ]
          : []),
      ];
      // Prioritas server:
      // - Kalau MegaPlay punya track subtitle Indonesia → pakai HLS (player
      //   milik kita sendiri, subtitle ID aktif otomatis).
      // - Selain itu → server Sub Indo (Oploverz/Otakudesu) dulu, baru HLS.
      const hasIdTrack = allTracks.some((t) => t.lang === "id");
      const sources = hasIdTrack
        ? [...megaSources, ...indo]
        : [...indo, ...megaSources];

      const allTracks = [
        ...sub.tracks,
        ...(dub ? dub.tracks.map((t) => ({ ...t, kind: "dub" })) : []),
      ];
      // Prioritas subtitle: Indonesia > English > track pertama.
      const isEn = (t: Track) =>
        /^en(|-|_)/i.test(t.label.trim()) || t.lang === "en";
      const preferred =
        allTracks.find((t) => t.lang === "id") ??
        allTracks.find(isEn) ??
        allTracks[0] ??
        null;

      return {
        ok: true as const,
        sources,
        subtitle: preferred,
        subtitles: allTracks,
        // Track subtitle versi SUB (untuk pemilih subtitle di player)
        subTracks: sub.tracks,
        hasIndonesian: allTracks.some((t) => t.lang === "id") || indo.length > 0,
        intro: sub.intro,
        outro: sub.outro,
        embedSub,
        embedDub,
      };
    } catch (e) {
      return {
        ok: false as const,
        reason: e instanceof Error ? e.message : "Gagal memuat episode",
      };
    }
  },
});
