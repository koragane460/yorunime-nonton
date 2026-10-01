"use node";
/**
 * YoruNime — sumber data manga & manhwa.
 *
 * Sumber: komiku.org (katalog komik bahasa Indonesia). Tidak butuh self-deploy:
 * scraping dijalankan di dalam Convex Action dan hasilnya disimpan ke tabel
 * `animeCache` (dipakai ulang lewat internal.anime.cacheGet/cacheSet), jadi
 * halaman tetap cepat walau situs asal sedang lambat.
 *
 * Endpoint yang dipakai:
 *   GET /                              -> section "Baru Ditambahkan" (update terbaru)
 *   GET /daftar-komik/?tipe=&halaman=  -> katalog per jenis (manga/manhwa)
 *   GET /manga/<slug>/                 -> detail + daftar chapter + idSeries
 *   GET /<slug>-chapter-<n>/           -> daftar URL gambar chapter
 *   GET analytics.komiku.org/api/views?idSeries= -> jumlah pembaca
 */
import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";

const SITE = "https://komiku.org";
const ANALYTICS = "https://analytics.komiku.org";
/** WordPress REST — dipakai untuk cari komik & memastikan jenis (manga/manhwa). */
const WP_API = `${SITE}/wp-json/wp/v2/manga`;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export type ComicKind = "manga" | "manhwa";

export type ComicListItem = {
  slug: string;
  title: string;
  image: string;
  kind: ComicKind;
  /** true = masih/releases chapter, false = tamat. */
  ongoing: boolean;
  status: string;
  genres: string[];
  latestChapter?: string;
  updatedAgo?: string;
  views?: number;
};

export type ComicChapter = {
  number: number;
  label: string;
  url: string;
  date?: string;
  dateMs?: number;
};

// --------------------------------------------------------------- util ----

const dec = (s: string) =>
  s
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

/** Teks bersih dari potongan HTML. */
const text = (s: string) => dec(s.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();

async function fetchHtml(url: string, timeoutMs = 15_000): Promise<string | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": UA,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "id-ID,id;q=0.9,en;q=0.6",
          Referer: SITE + "/",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) return null;
      const body = await res.text();
      if (body.length < 500) return null;
      return body;
    } catch {
      if (attempt === 0) await new Promise((r) => setTimeout(r, 500));
    }
  }
  return null;
}

/** Ambil satu blok <section id="..."> dari halaman. */
function sectionById(html: string, id: string): string {
  const i = html.indexOf(`<section id="${id}"`);
  if (i < 0) return "";
  const j = html.indexOf("</section>", i);
  return j < 0 ? html.slice(i) : html.slice(i, j);
}

async function fetchJson(url: string, timeoutMs = 12_000): Promise<any | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "application/json", Referer: SITE + "/" },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      if (attempt === 0) await new Promise((r) => setTimeout(r, 400));
    }
  }
  return null;
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, i: number) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from(
    { length: Math.max(1, Math.min(limit, items.length)) },
    async () => {
      for (;;) {
        const idx = next++;
        if (idx >= items.length) return;
        out[idx] = await fn(items[idx], idx);
      }
    },
  );
  await Promise.all(workers);
  return out;
}

/** Kartu peringkat homepage (<article class="ls4">): rank + views. */
function parseLs4(block: string): (ComicListItem & { rank: number }) | null {
  const slug = block.match(/href="\/manga\/([^"/]+)\/"/)?.[1];
  if (!slug) return null;
  const image = hdCover(block.match(/data-src="([^"]+)"/)?.[1] ?? "");
  const title = text(block.match(/<h4><a[^>]*>([\s\S]*?)<\/a>/)?.[1] ?? "");
  const rank = Number(block.match(/class="rank-num">(\d+)/)?.[1] ?? 0);
  const statLine = text(block.match(/class="ls4s">([\s\S]*?)<\/span>/)?.[1] ?? "");
  const parts = statLine.split("·").map((s) => s.trim()).filter(Boolean);
  const viewsText = parts[parts.length - 1] ?? "";
  const views = Number(viewsText.replace(/[^\d]/g, ""));
  return {
    slug,
    title: title || slug,
    image,
    kind: "manga",
    ongoing: true,
    status: "Ongoing",
    genres: parts.slice(0, -1),
    latestChapter: text(block.match(/class="ls24"[^>]*>([\s\S]*?)<\/a>/)?.[1] ?? "") || undefined,
    views: Number.isFinite(views) ? views : undefined,
    rank,
  };
}

function parseRanking(html: string) {
  const section = sectionById(html, "Rekomendasi_Komik");
  const out: (ComicListItem & { rank: number })[] = [];
  const re = /<article class="ls4">([\s\S]*?)<\/article>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(section))) {
    const it = parseLs4(m[1]);
    if (it) out.push(it);
  }
  return out;
}

// -------------------------------------------------------------- parser ----

/**
 * Cover komik dari listing hanya dikirim resolusi kecil (`?resize=240,280`).
 * Kalau dipakai di hero yang besar, hasilnya pecah dan pecahanSamplingBlur.
 * Jadi naikkan ke ukuran yang masih ringan tapi tajam.
 */
function hdCover(url: string): string {
  if (!url) return url;
  return url.replace(/([?&])resize=\d+,\d+/, "$1resize=720,840");
}

/** Kartu katalog (daftar-komik / pencarian): <article class="manga-card"> */
function parseCatalogCard(block: string): ComicListItem | null {
  const slug = block.match(/href="\/manga\/([^"/]+)\/"/)?.[1];
  if (!slug) return null;
  const image = hdCover(block.match(/data-src="([^"]+)"/)?.[1] ?? "");
  const title = text(block.match(/<h4>\s*<a[^>]*>([\s\S]*?)<\/a>\s*<\/h4>/)?.[1] ?? "");
  const meta = block.match(/<p class="meta">([\s\S]*?)<\/p>/)?.[1] ?? "";
  const [typePart, statusPart] = meta.split(/<br\s*\/?>/i);
  const head = text(typePart ?? "");
  const parts = head.split("•").map((s) => s.trim()).filter(Boolean);
  const rawType = (parts[0] ?? "").toLowerCase();
  const kind: ComicKind = rawType.includes("manhwa") ? "manhwa" : "manga";
  const statusRaw = text(statusPart ?? "") || head;
  const ongoing = !/end|tamat|selesai/i.test(statusRaw);
  return {
    slug,
    title: title || slug,
    image,
    kind,
    ongoing,
    status: ongoing ? "Ongoing" : "Tamat",
    genres: parts.slice(1),
  };
}

function parseCatalog(html: string): ComicListItem[] {
  const out: ComicListItem[] = [];
  const re = /<article class="manga-card">([\s\S]*?)<\/article>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const item = parseCatalogCard(m[1]);
    if (item) out.push(item);
  }
  return out;
}

/** Kartu horizontal homepage (section "Baru Ditambahkan" / genre). */
function parseLs2(block: string): (ComicListItem & { latestUrl?: string }) | null {
  const slug = block.match(/href="\/manga\/([^"/]+)\/"/)?.[1];
  if (!slug) return null;
  const image = hdCover(block.match(/data-src="([^"]+)"/)?.[1] ?? "");
  const title = text(block.match(/<h3><a[^>]*>([\s\S]*?)<\/a><\/h3>/)?.[1] ?? "");
  const meta = text(block.match(/<span class="ls2t">([\s\S]*?)<\/span>/)?.[1] ?? "");
  const flag = block.match(/class="flag" src="\/asset\/img\/(\w+)\.png"/)?.[1]?.toLowerCase();
  const dataTipe = block.match(/data-tipe="(\w+)"/)?.[1]?.toLowerCase() ?? "";
  const raw = `${dataTipe} ${flag === "kr" ? "manhwa" : flag === "jp" ? "manga" : ""}`;
  const kind: ComicKind = raw.includes("manhwa") ? "manhwa" : "manga";
  const chapterLink = block.match(/<a href="([^"]+-chapter-[^"]+)" class="ls2l"[^>]*>([\s\S]*?)<\/a>/);
  const parts = meta.split("·").map((s) => s.trim()).filter(Boolean);
  return {
    slug,
    title: title || slug,
    image,
    kind,
    ongoing: true,
    status: "Ongoing",
    genres: parts.slice(0, 1),
    latestChapter: text(chapterLink?.[2] ?? "") || undefined,
    updatedAgo: parts.slice(1).join(" · ") || undefined,
    latestUrl: chapterLink?.[1],
  };
}

function parseLs2All(html: string) {
  const out: (ComicListItem & { latestUrl?: string })[] = [];
  const re = /<article class="ls2"[^>]*>([\s\S]*?)<\/article>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const item = parseLs2(m[1]);
    if (item) out.push(item);
  }
  return out;
}

/** "28/09/2026" (WIB) -> timestamp ms. */
function parseIdDate(s?: string): number | undefined {
  if (!s) return undefined;
  const m = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return undefined;
  const [, dd, mm, yyyy] = m;
  return Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd), -7);
}

function parseDetail(html: string) {
  const title = text(
    html.match(/<h1><span>[^<]*<span itemprop="name"[^>]*>([\s\S]*?)<\/span>/)?.[1] ?? "",
  );
  const altTitle = text(html.match(/<span class="j2"[^>]*>([\s\S]*?)<\/span>/)?.[1] ?? "");
  const synopsis = text(
    html.match(/<p class="desc" itemprop="description">([\s\S]*?)<\/p>/)?.[1] ?? "",
  );
  const image = hdCover(html.match(/<div class="ims">\s*<img src="([^"]+)"/)?.[1] ?? "");
  const rawType = (html.match(/itemprop="additionalType" content="([^"]+)"/)?.[1] ?? "").toLowerCase();
  const kind: ComicKind = rawType.includes("manhwa") ? "manhwa" : "manga";
  const statusRaw = (html.match(/itemprop="creativeWorkStatus" content="([^"]+)"/)?.[1] ?? "").trim();
  const ongoing = !/completed|tamat|end|selesai/i.test(statusRaw);
  const genres = Array.from(
    new Set(
      Array.from(html.matchAll(/itemprop="genre" content="([^"]+)"/g)).map((m) =>
        dec(m[1]).trim(),
      ),
    ),
  ).filter(Boolean);
  const author = text(
    html.match(/<span itemprop="author"[^>]*><meta itemprop="name" content="([^"]*)"/)?.[1] ?? "",
  );
  const theme = text(html.match(/<tr><td>Tema:<\/td><td>([\s\S]*?)<\/td>/)?.[1] ?? "");
  const rating = text(html.match(/<tr><td>Rating:<\/td><td>([\s\S]*?)<\/td>/)?.[1] ?? "");
  const readDir = text(html.match(/<tr><td>Cara Baca:<\/td><td>([\s\S]*?)<\/td>/)?.[1] ?? "");
  const idSeries = html.match(/data-series-id="(\d+)"/)?.[1];
  const updatedIso = html.match(/itemprop="dateModified" content="([^"]+)"/)?.[1];
  const publishedIso = html.match(/itemprop="datePublished" content="([^"]+)"/)?.[1];

  const chapters: ComicChapter[] = [];
  const cre = /<tr itemprop="itemListElement"[\s\S]*?<\/tr>/g;
  let cm: RegExpExecArray | null;
  while ((cm = cre.exec(html))) {
    const row = cm[0];
    const url = row.match(/href="(\/[^"]+-chapter-[^"]+)"/)?.[1];
    if (!url) continue;
    const label = text(row.match(/<b>([\s\S]*?)<\/b>/)?.[1] ?? "") || "Chapter";
    const date = text(row.match(/class="tanggalseries">([\s\S]*?)<\/td>/)?.[1] ?? "");
    const num = Number(url.match(/-chapter-([0-9]+(?:\.[0-9]+)?)/)?.[1] ?? NaN);
    chapters.push({
      number: Number.isFinite(num) ? num : chapters.length + 1,
      label,
      url,
      date: date || undefined,
      dateMs: parseIdDate(date),
    });
  }

  return {
    title,
    altTitle,
    synopsis,
    image,
    kind,
    ongoing,
    status: ongoing ? "Ongoing" : "Tamat",
    genres,
    author,
    theme,
    rating,
    readDir,
    idSeries,
    chapters,
    updatedAtMs: updatedIso ? Date.parse(updatedIso) : undefined,
    publishedAtMs: publishedIso ? Date.parse(publishedIso) : undefined,
  };
}

// --------------------------------------------------------------- cache ----

async function cached<T>(
  ctx: any,
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T | null | undefined>,
): Promise<T | null> {
  const row = await ctx.runQuery(internal.anime.cacheGet, { endpoint: key });
  if (row && Date.now() - row.updatedAt < ttlMs) return row.payload as T;
  let payload: T | null | undefined;
  try {
    payload = await fetcher();
  } catch {
    payload = null;
  }
  // Fallback ke cache lama kalau sumber sedang gagal — halaman tidak pernah kosong.
  if (payload === null || payload === undefined) return (row?.payload ?? null) as T | null;
  await ctx.runMutation(internal.anime.cacheSet, { endpoint: key, payload });
  return payload;
}

const LIST_TTL = 10 * 60_000;
const DETAIL_TTL = 8 * 60_000;
const VIEWS_TTL = 20 * 60_000;
const SCHEDULE_TTL = 30 * 60_000;

async function viewsFor(idSeries: string | undefined): Promise<number | undefined> {
  if (!idSeries) return undefined;
  try {
    const res = await fetch(`${ANALYTICS}/api/views?idSeries=${idSeries}&format=json`, {
      headers: { "User-Agent": UA, Accept: "application/json", Referer: SITE + "/" },
      signal: AbortSignal.timeout(9_000),
    });
    if (!res.ok) return undefined;
    const j: any = await res.json();
    const total = j?.views?.total;
    return typeof total === "number" ? total : undefined;
  } catch {
    return undefined;
  }
}

/** Ambil idSeries + jumlah pembaca untuk satu slug (dipakai list & detail). */
async function seriesId(ctx: any, slug: string): Promise<string | undefined> {
  const id = await cached<string | null>(ctx, `comic:id:${slug}`, 30 * 60_000, async () => {
    const html = await fetchHtml(`${SITE}/manga/${slug}/`);
    return html?.match(/data-series-id="(\d+)"/)?.[1] ?? null;
  });
  return id ?? undefined;
}

async function attachViews(ctx: any, items: ComicListItem[]) {
  return mapLimit(items, 5, async (it) => {
    const id = await seriesId(ctx, it.slug);
    if (!id) return it;
    const views = await cached<number | null>(ctx, `comic:views:${id}`, VIEWS_TTL, () =>
      viewsFor(id) ?? null,
    );
    return views ? { ...it, views } : it;
  });
}

/** Jenis & status pasti dari WordPress REST (class_list: "tipe-manhwa" dll). */
async function wpMeta(
  ctx: any,
  slug: string,
): Promise<{ kind: ComicKind; ongoing: boolean; genres: string[] } | null> {
  return cached(ctx, `comic:wp:${slug}`, 30 * 60_000, async () => {
    const rows = await fetchJson(
      `${WP_API}?slug=${encodeURIComponent(slug)}&_fields=slug,class_list`,
    );
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row?.class_list) return null;
    const cls: string[] = row.class_list;
    const kind: ComicKind = cls.some((c) => /tipe-manhwa/.test(c)) ? "manhwa" : "manga";
    const ongoing = !cls.some((c) => /statusmanga-(tamat|end|completed)/i.test(c));
    const genres = cls
      .filter((c) => c.startsWith("genre-"))
      .map((c) => c.slice(6).replace(/-/g, " "))
      .slice(0, 4);
    return { kind, ongoing, genres };
  });
}

// ------------------------------------------------------------- actions ----

/**
 * Trending & paling dibaca. Sumber: section "Peringkat Komiku" di homepage
 * (punya rank + jumlah views), lalu jenisnya dipastikan lewat WordPress REST
 * supaya manga dan manhwa tidak tercampur. naturally berisi judul terkenal,
 * termasuk yang sudah jadi anime.
 */
export const trending = action({
  args: {
    kind: v.union(v.literal("manga"), v.literal("manhwa")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { kind, limit = 12 }) => {
    const ranked = await cached<(ComicListItem & { rank: number })[]>(
      ctx,
      "comic:rank",
      LIST_TTL,
      async () => {
        const html = await fetchHtml(`${SITE}/`);
        if (!html) return null;
        const list = parseRanking(html);
        return list.length > 0 ? list : null;
      },
    );
    const list = ranked ?? [];
    // Ada dua panel peringkat (harian & mingguan) jadi slug bisa dobel.
    const seen = new Set<string>();
    const unique = list.filter((r) => {
      if (seen.has(r.slug)) return false;
      seen.add(r.slug);
      return true;
    });
    const resolved = await mapLimit(unique, 6, async (item) => {
      const meta = await wpMeta(ctx, item.slug);
      if (!meta) return null;
      return { ...item, ...meta } as ComicListItem & { rank: number };
    });
    return resolved
      .filter((r): r is ComicListItem & { rank: number } => !!r && r.kind === kind)
      .sort((a, b) => (b.views ?? 0) - (a.views ?? 0))
      .slice(0, limit);
  },
});

/** Pencarian judul (WordPress REST) + cover/sinopsis dari detail ter-cache. */
export const search = action({
  args: {
    q: v.string(),
    kind: v.optional(v.union(v.literal("manga"), v.literal("manhwa"))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { q, kind, limit = 12 }) => {
    const query = q.trim().slice(0, 80);
    if (query.length < 2) return [];
    const rows = await fetchJson(
      `${WP_API}?search=${encodeURIComponent(query)}&per_page=${Math.min(40, limit * 3)}&_fields=slug,title,class_list`,
    );
    if (!Array.isArray(rows) || rows.length === 0) return [];
    const candidates = rows
      .map((r: any) => {
        const cls: string[] = r?.class_list ?? [];
        const k: ComicKind = cls.some((c) => /tipe-manhwa/.test(c)) ? "manhwa" : "manga";
        return {
          slug: String(r.slug ?? ""),
          title: text(r?.title?.rendered ?? ""),
          kind: k,
          ongoing: !cls.some((c) => /statusmanga-(tamat|end|completed)/i.test(c)),
        };
      })
      .filter((c: any) => c.slug && (!kind || c.kind === kind));

    const out = await mapLimit(candidates.slice(0, limit), 5, async (c: any) => {
      const d = await cached<ReturnType<typeof parseDetail> | null>(
        ctx,
        `comic:detail:${c.slug}`,
        30 * 60_000,
        async () => {
          const html = await fetchHtml(`${SITE}/manga/${c.slug}/`);
          if (!html) return null;
          const p = parseDetail(html);
          return p.title ? p : null;
        },
      );
      if (!d) return null;
      const id = d.idSeries;
      const views = id
        ? ((await cached<number | null>(ctx, `comic:views:${id}`, VIEWS_TTL, () =>
            viewsFor(id) ?? null,
          )) ?? undefined)
        : undefined;
      const item: ComicListItem = {
        slug: c.slug,
        title: d.title || c.title,
        image: d.image,
        kind: d.kind,
        ongoing: d.ongoing,
        status: d.status,
        genres: d.genres.slice(0, 4),
        latestChapter: d.chapters[0]?.label,
        views,
      };
      return item;
    });
    return out.filter((x): x is ComicListItem => !!x);
  },
});

/** Update terbaru (dari section "Baru Ditambahkan" homepage), per jenis. */
export const newest = action({
  args: { kind: v.union(v.literal("manga"), v.literal("manhwa")) },
  handler: async (ctx, { kind }) => {
    const list = await cached<ComicListItem[]>(
      ctx,
      `comic:newest:${kind}`,
      LIST_TTL,
      async () => {
        const html = await fetchHtml(`${SITE}/`);
        if (!html) return null;
        const section = sectionById(html, "Baru_Ditambahkan");
        const all = parseLs2All(section);
        const seen = new Set<string>();
        const out: ComicListItem[] = [];
        for (const it of all) {
          if (it.kind !== kind) continue;
          if (seen.has(it.slug)) continue;
          seen.add(it.slug);
          out.push(it);
        }
        return out;
      },
    );
    return (list ?? []).slice(0, 14);
  },
});

/** Katalog per jenis, paginasi ala "daftar komik". */
export const browse = action({
  args: {
    kind: v.union(v.literal("manga"), v.literal("manhwa")),
    page: v.optional(v.number()),
    withViews: v.optional(v.boolean()),
  },
  handler: async (ctx, { kind, page = 1, withViews = true }) => {
    const list = await cached<ComicListItem[]>(
      ctx,
      `comic:list:${kind}:${page}`,
      LIST_TTL,
      async () => {
        const url = `${SITE}/daftar-komik/?tipe=${kind}&halaman=${page}`;
        const html = await fetchHtml(url);
        if (!html) return null;
        const parsed = parseCatalog(html).filter((c) => c.kind === kind);
        return parsed.length > 0 ? parsed : parseCatalog(html);
      },
    );
    const items = list ?? [];
    const head = items.slice(0, 18);
    const tail = items.slice(18);
    if (!withViews) return [...head, ...tail];
    return [...(await attachViews(ctx, head)), ...tail];
  },
});

/** Detail komik + daftar chapter + jumlah pembaca. */
export const detail = action({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const s = slug.replace(/[^a-z0-9\-_.~%]/gi, "").slice(0, 160);
    const d = await cached<ReturnType<typeof parseDetail> | null>(
      ctx,
      `comic:detail:${s}`,
      DETAIL_TTL,
      async () => {
        const html = await fetchHtml(`${SITE}/manga/${s}/`);
        if (!html) return null;
        const parsed = parseDetail(html);
        return parsed.title ? parsed : null;
      },
    );
    if (!d) return null;
    const views = d.idSeries
      ? ((await cached<number | null>(ctx, `comic:views:${d.idSeries}`, VIEWS_TTL, () =>
          viewsFor(d.idSeries) ?? null,
        )) ?? undefined)
      : undefined;
    const chapters = d.chapters;
    return {
      slug: s,
      title: d.title,
      altTitle: d.altTitle,
      synopsis: d.synopsis,
      image: d.image,
      kind: d.kind,
      ongoing: d.ongoing,
      status: d.status,
      genres: d.genres,
      author: d.author,
      theme: d.theme,
      rating: d.rating,
      readDir: d.readDir,
      views,
      chapterCount: chapters.length,
      chapters,
      latest: chapters[0],
      first: chapters[chapters.length - 1],
      updatedAtMs: d.updatedAtMs,
      publishedAtMs: d.publishedAtMs,
    };
  },
});

/** URL chapter asli dari daftar chapter di halaman detail seri. */
async function chapterUrlFor(
  ctx: any,
  slug: string,
  chapter: number,
): Promise<string | undefined> {
  const d = await cached<ReturnType<typeof parseDetail> | null>(
    ctx,
    `comic:detail:${slug}`,
    DETAIL_TTL,
    async () => {
      const html = await fetchHtml(`${SITE}/manga/${slug}/`);
      if (!html) return null;
      const parsed = parseDetail(html);
      return parsed.title ? parsed : null;
    },
  );
  return d?.chapters?.find((c) => c.number === chapter)?.url;
}

/** URL gambar untuk satu chapter (urutan baca). */
export const pages = action({
  args: { slug: v.string(), chapter: v.number() },
  handler: async (ctx, { slug, chapter }) => {
    const s = slug.replace(/[^a-z0-9\-_.~%]/gi, "").slice(0, 160);
    const key = `comic:pages:${s}:${chapter}`;
    const cachedPages = await cached<{ images: string[]; title?: string } | null>(
      ctx,
      key,
      DETAIL_TTL,
      async () => {
        // URL chapter tidak selalu memakai slug yang sama dengan slug seri
        // (mis. seri "komik-one-piece-indo" punya chapter "/one-piece-chapter-1/").
        // Jadi coba pola langsung dulu, kalau gagal ambil URL aslinya dari
        // daftar chapter di halaman detail.
        let html = await fetchHtml(`${SITE}/${s}-chapter-${chapter}/`);
        if (!html) {
          const alt = await chapterUrlFor(ctx, s, chapter);
          if (alt) html = await fetchHtml(`${SITE}${alt}`);
        }
        if (!html) return null;
        const found: { id: number; url: string }[] = [];
        const re = /<img\s[^>]*>/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(html))) {
          const tag = m[0];
          if (!/klazy/.test(tag)) continue;
          const src = tag.match(/src="(https:\/\/[^"]+)"/)?.[1];
          if (!src) continue;
          const id = Number(tag.match(/id="(\d+)"/)?.[1] ?? found.length + 1);
          // beberapa hostimage (image2..image13) di-backup ke img.komiku.org
          found.push({ id, url: src.replace(/https:\/\/image\d+\.komiku\.to/, "https://img.komiku.org") });
        }
        found.sort((a, b) => a.id - b.id);
        if (found.length === 0) return null;
        return {
          images: found.map((f) => f.url),
          title: text(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? "") || undefined,
        };
      },
    );
    return cachedPages ?? { images: [] };
  },
});

/**
 * Jadwal rilis manga/manhwa. Sumber tidak menyediakan jam tayang resmi, jadi
 * interval antar chapter terakhir dipakai untuk memproyeksikan chapter berikutnya.
 */
export const schedule = action({
  args: { kind: v.union(v.literal("manga"), v.literal("manhwa")) },
  handler: async (ctx, { kind }) => {
    type Entry = {
      slug: string;
      title: string;
      image: string;
      kind: ComicKind;
      nextChapter: number;
      nextLabel: string;
      lastDateMs: number;
      predictedMs: number;
    };
    const entries = await cached<Entry[]>(
      ctx,
      `comic:schedule:${kind}`,
      SCHEDULE_TTL,
      async () => {
        const html = await fetchHtml(`${SITE}/`);
        if (!html) return null;
        const fresh = parseLs2All(sectionById(html, "Baru_Ditambahkan")).filter(
          (c) => c.kind === kind,
        );
        // Kalau "Baru Ditambahkan" terlalu sedikit, lengkapi dari katalog.
        let wanted = fresh.slice(0, 14);
        if (wanted.length < 8) {
          const catHtml = await fetchHtml(`${SITE}/daftar-komik/?tipe=${kind}&halaman=1`);
          const seen = new Set(wanted.map((w) => w.slug));
          for (const c of parseCatalog(catHtml ?? "")) {
            if (c.kind !== kind || !c.ongoing || seen.has(c.slug)) continue;
            seen.add(c.slug);
            wanted.push(c);
            if (wanted.length >= 14) break;
          }
        }
        const out = await mapLimit(wanted, 4, async (c) => {
          const d = await cached<ReturnType<typeof parseDetail> | null>(
            ctx,
            `comic:detail:${c.slug}`,
            DETAIL_TTL,
            async () => {
              const h = await fetchHtml(`${SITE}/manga/${c.slug}/`);
              if (!h) return null;
              const p = parseDetail(h);
              return p.title ? p : null;
            },
          );
          if (!d || !d.ongoing) return null;
          const dated = d.chapters.filter((ch) => ch.dateMs).slice(0, 5);
          if (dated.length < 2) return null;
          // Jarak antar rilis (hari) → rata-rata.
          const gaps: number[] = [];
          for (let i = 0; i < dated.length - 1; i++) {
            const g = (dated[i].dateMs! - dated[i + 1].dateMs!) / 86_400_000;
            if (g > 0 && g < 120) gaps.push(g);
          }
          if (gaps.length === 0) return null;
          const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
          const latest = d.chapters[0];
          const nextNumber = Math.floor(latest.number) + 1;
          return {
            slug: c.slug,
            title: d.title || c.title,
            image: d.image || c.image,
            kind,
            nextChapter: nextNumber,
            nextLabel: `Chapter ${nextNumber}`,
            lastDateMs: latest.dateMs ?? Date.now(),
            predictedMs: (latest.dateMs ?? Date.now()) + avg * 86_400_000,
          } satisfies Entry;
        });
        const clean = out.filter((x): x is Entry => !!x);
        return clean.length > 0 ? clean : null;
      },
    );
    return entries ?? [];
  },
});
