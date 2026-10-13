"use node";
// Cuplikan karakter — cari klip TikTok pendek per karakter (BUKAN trailer).
//
// TikTok tidak menyediakan endpoint pencarian resmi yang bisa dipanggil dari
// backend tanpa cookie/token (riset: endpoint internal butuh `ttwid` dan
// mudah berubah). Karena itu:
//   1. Kita coba endpoint web internal TikTok dengan User-Agent browser +
//      cookie `ttwid` yang diambil sekali dari halaman utama.
//   2. Kalau gagal / diblokir, action ini diam-diam membalas [] dan UI
//      jatuh ke tombol "Cari di TikTok" (tautan pencarian resmi).
// Klip yang didapat di-embed lewat player resmi TikTok
// (https://www.tiktok.com/player/v1/:id) — tidak menyimpan file mentah.

import { action } from "./_generated/server";
import { v } from "convex/values";

type Clip = { id: string; desc: string; author: string };

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/** Ambil cookie ttwid dari halaman utama TikTok (sekali per pemanggilan). */
async function fetchTtwid(): Promise<string | null> {
  try {
    const r = await fetch("https://www.tiktok.com/", {
      headers: { "User-Agent": UA, Accept: "text/html" },
    });
    const setCookies = r.headers.getSetCookie?.() ?? [];
    for (const c of setCookies) {
      const m = /ttwid=([^;]+)/.exec(c);
      if (m) return `ttwid=${m[1]}`;
    }
  } catch {
    /* abaikan */
  }
  return null;
}

export const tiktokClips = action({
  args: { q: v.string(), limit: v.optional(v.number()) },
  handler: async (_ctx, { q, limit = 6 }) => {
    const query = String(q ?? "").trim();
    if (!query) return [] as Clip[];
    try {
      const ttwid = await fetchTtwid();
      const url =
        "https://www.tiktok.com/api/search/item/full/?" +
        new URLSearchParams({
          keyword: query,
          offset: "0",
          count: String(Math.min(12, Math.max(1, limit * 2))),
          from_page: "search",
        });
      const res = await fetch(url, {
        headers: {
          "User-Agent": UA,
          Accept: "application/json",
          Referer: "https://www.tiktok.com/search",
          ...(ttwid ? { Cookie: ttwid } : {}),
        },
      });
      if (!res.ok) return [] as Clip[];
      const data = (await res.json()) as {
        item_list?: {
          id?: string;
          desc?: string;
          author?: { unique_id?: string };
        }[];
      };
      const items = Array.isArray(data?.item_list) ? data.item_list : [];
      const clips: Clip[] = [];
      const seen = new Set<string>();
      for (const it of items) {
        const id = String(it?.id ?? "");
        if (!id || seen.has(id)) continue;
        seen.add(id);
        clips.push({
          id,
          desc: String(it?.desc ?? "").slice(0, 140),
          author: String(it?.author?.unique_id ?? ""),
        });
        if (clips.length >= limit) break;
      }
      return clips;
    } catch {
      // Diblokir / gagal jaringan → UI memakai fallback tautan TikTok.
      return [] as Clip[];
    }
  },
});
