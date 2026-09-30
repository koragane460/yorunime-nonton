import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { useAction, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Columns3,
  List,
  Loader2,
  Minus,
  Moon,
  Plus,
  Sun,
  X,
} from "lucide-react";

type Chapter = { number: number; label: string; url: string; date?: string };

// Cache halaman antar chapter supaya buka ulang chapter sebelumnya instan.
const pageCache = new Map<string, string[]>();
const cacheKey = (slug: string, ch: number) => `${slug}#${ch}`;

/** Ambil daftar gambar chapter (dari cache dulu, lalu pramuat chapter depan). */
async function loadPages(
  slug: string,
  chapter: number,
  getPages: (a: { slug: string; chapter: number }) => Promise<any>,
) {
  const key = cacheKey(slug, chapter);
  const hit = pageCache.get(key);
  if (hit) return hit;
  const r = await getPages({ slug, chapter });
  const images: string[] = r?.images ?? [];
  pageCache.set(key, images);
  return images;
}

/**
 * Reader manga & manhwa.
 *  - Mode manga  : panel satu-satu, geser horizontal, gambar SELURUH halaman
 *                  terlihat (contain, tidak di-crop, tidak ter-zoom).
 *  - Mode manhwa : strip panjang (webtoon), scroll ke bawah.
 *  - Pemuatan cepat: 3 halaman depan di-pramuat, chapter berikutnya dipramuat
 *    saat pengguna sudah di halaman >= 60%.
 */
export default function ReadComic() {
  const { slug = "", chapter = "1" } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const kind = params.get("jenis") === "manhwa" ? "manhwa" : "manga";

  const getPages = useAction(api.manga.pages);
  const getDetail = useAction(api.manga.detail);
  const recordRead = useMutation(api.comics.recordRead);

  const [images, setImages] = useState<string[]>([]);
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [uiOn, setUiOn] = useState(true);
  const [dark, setDark] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [strip, setStrip] = useState(kind === "manhwa");
  const [sheet, setSheet] = useState(false);

  const stripRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const chNum = Number(chapter) || 1;
  const total = images.length;

  // Muat gambar chapter.
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setImages([]);
    setIndex(0);
    setZoom(1);
    setUiOn(true);
    setStrip(kind === "manhwa");
    loadPages(slug, chNum, getPages)
      .then((imgs) => {
        if (alive) setImages(imgs);
      })
      .catch(() => toast.error("Gagal memuat halaman chapter"))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, chNum, kind]);

  // Detail (judul + daftar chapter).
  useEffect(() => {
    let alive = true;
    getDetail({ slug })
      .then((r: any) => alive && setDetail(r))
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const chapters: Chapter[] = detail?.chapters ?? [];
  // Daftar chapter dari sumber urut terbaru (idx 0 = terbaru).
  const olderChapter = chapters.find((c) => c.number === chNum + 1);
  const newerChapter = chapters.find((c) => c.number === chNum - 1);

  // Pramuat chapter berikutnya di paruh akhir chapter supaya perpindahan instan.
  useEffect(() => {
    if (!olderChapter || !chapters.length) return;
    if (total === 0 || index < Math.ceil(total * 0.6)) return;
    const key = cacheKey(slug, olderChapter.number);
    if (pageCache.has(key)) return;
    void loadPages(slug, olderChapter.number, getPages).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, total, olderChapter, slug, chapters.length]);

  // Simpan ke history setiap halaman berganti.
  useEffect(() => {
    if (loading || total === 0 || !detail) return;
    void recordRead({
      slug,
      comicTitle: detail.title,
      comicImage: detail.image,
      kind: detail.kind ?? kind,
      chapter: chNum,
      chapterLabel: chapters.find((c) => c.number === chNum)?.label,
      page: index,
      totalPages: total,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, chNum, total, loading, detail]);

  // Ganti halaman: selalu scroll kontainer yang benar (panel atau strip).
  const goto = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(Math.max(total - 1, 0), next));
      setIndex(clamped);
      const el = panelRef.current;
      if (el) el.scrollTo({ left: clamped * el.clientWidth, behavior: "smooth" });
      const s = stripRef.current;
      if (s) s.scrollTo({ top: clamped * s.clientHeight, behavior: "smooth" });
    },
    [total],
  );

  // Mode panel: tombol kiri = halaman berikutnya (manga dibaca RTL).
  const nextPage = () => goto(index + 1);
  const prevPage = () => goto(index - 1);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") nextPage();
      if (e.key === "ArrowRight") prevPage();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, total]);

  const goChapter = (n: number) => {
    setSheet(false);
    navigate(`/baca/${encodeURIComponent(slug)}/${n}?jenis=${kind}`);
  };

  const atEnd = total > 0 && index >= total - 1;

  return (
    <div className={cn("fixed inset-0 z-[70] flex flex-col", dark ? "bg-black" : "bg-zinc-100")}>
      {/* Konten */}
      {loading ? (
        <div className="flex min-h-0 flex-1 items-center justify-center gap-2 text-sm text-zinc-400">
          <Loader2 className="size-4 animate-spin" /> Memuat chapter {chNum}…
        </div>
      ) : total === 0 ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 text-zinc-400">
          <p className="text-sm">Chapter ini tidak punya gambar</p>
          <button
            onClick={() => navigate(-1)}
            className="rounded-full border border-white/20 px-4 py-2 text-xs"
          >
            Kembali
          </button>
        </div>
      ) : strip ? (
        // ---- Mode manhwa: strip webtoon, scroll vertikal ----
        <div
          ref={stripRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            const i = Math.round(el.scrollTop / Math.max(1, el.clientHeight));
            if (i !== index) setIndex(i);
          }}
          className="thin-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain"
        >
          <div className="mx-auto w-full max-w-2xl">
            {images.map((src, i) => (
              <div key={`${src}-${i}`} className="relative bg-black">
                <img
                  src={src}
                  alt={`Halaman ${i + 1}`}
                  loading={i < 3 ? "eager" : "lazy"}
                  decoding="async"
                  draggable={false}
                  onClick={() => setUiOn((v) => !v)}
                  style={zoom !== 1 ? { width: `${zoom * 100}%`, maxWidth: "none" } : undefined}
                  className="w-full select-none"
                />
              </div>
            ))}
            <div
              className={cn(
                "px-5 py-10 text-center",
                dark ? "bg-black text-zinc-400" : "bg-zinc-100 text-zinc-600",
              )}
            >
              <p className="text-xs">Selesai — chapter ini habis dibaca</p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                {olderChapter && (
                  <button
                    onClick={() => goChapter(olderChapter.number)}
                    className="rounded-full bg-violet-600 px-5 py-2.5 text-xs font-bold text-white"
                  >
                    Lanjut Chapter {olderChapter.number}
                  </button>
                )}
                {newerChapter && (
                  <button
                    onClick={() => goChapter(newerChapter.number)}
                    className="rounded-full border border-white/25 px-5 py-2.5 text-xs font-semibold"
                  >
                    Kembali Chapter {newerChapter.number}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        // ---- Mode manga: panel satu-satu, gambar penuh di dalam layar ----
        <div
          ref={panelRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
            if (i !== index) setIndex(i);
          }}
          className="flex h-full min-h-0 w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain"
        >
          {images.map((src, i) => (
            <div
              key={`${src}-${i}`}
              className="relative flex h-full w-full shrink-0 snap-center items-center justify-center bg-black"
              onClick={() => setUiOn((v) => !v)}
              onDoubleClick={() => setZoom((z) => (z === 1 ? 2 : 1))}
            >
              <img
                src={src}
                alt={`Halaman ${i + 1}`}
                loading={i < 2 ? "eager" : "lazy"}
                decoding="async"
                draggable={false}
                style={zoom !== 1 ? { width: `${zoom * 100}%`, maxWidth: "none" } : undefined}
                className="block h-full w-auto max-w-full select-none object-contain"
              />
            </div>
          ))}
          <div className="flex h-full w-full shrink-0 snap-center items-center justify-center bg-black">
            <div className="px-6 text-center text-zinc-400">
              <p className="text-xs">Selesai — chapter ini habis dibaca</p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                {olderChapter && (
                  <button
                    onClick={() => goChapter(olderChapter.number)}
                    className="rounded-full bg-violet-600 px-5 py-2.5 text-xs font-bold text-white"
                  >
                    Lanjut Chapter {olderChapter.number}
                  </button>
                )}
                {newerChapter && (
                  <button
                    onClick={() => goChapter(newerChapter.number)}
                    className="rounded-full border border-white/25 px-5 py-2.5 text-xs font-semibold text-white"
                  >
                    Kembali Chapter {newerChapter.number}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar atas */}
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 z-20 transition-opacity",
          uiOn ? "opacity-100" : "opacity-0",
        )}
      >
        <div
          className={cn(
            "flex items-center gap-2 px-3 py-2.5",
            dark
              ? "bg-gradient-to-b from-black/85 to-transparent"
              : "bg-gradient-to-b from-white/95 to-transparent",
          )}
        >
          <button
            onClick={() => navigate(-1)}
            className="pointer-events-auto flex size-8 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white"
            aria-label="Kembali"
          >
            <ArrowLeft className="size-4" />
          </button>
          <div className="pointer-events-auto min-w-0 flex-1">
            <p
              className={cn(
                "truncate text-xs font-bold",
                dark ? "text-white" : "text-zinc-900",
              )}
            >
              {detail?.title ?? "Membaca…"}
            </p>
            <p
              className={cn("truncate text-[10px]", dark ? "text-zinc-400" : "text-zinc-600")}
            >
              Chapter {chNum} · Halaman {Math.min(index + 1, total)}/{total}
            </p>
          </div>
          <button
            onClick={() => setSheet(true)}
            className="pointer-events-auto flex size-8 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white"
            aria-label="Daftar chapter"
          >
            <List className="size-4" />
          </button>
          <button
            onClick={() => setStrip((v) => !v)}
            className="pointer-events-auto flex size-8 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white"
            aria-label="Ganti mode baca"
          >
            <Columns3 className="size-4" />
          </button>
          <button
            onClick={() => setDark((v) => !v)}
            className="pointer-events-auto flex size-8 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white"
            aria-label="Terang/gelap"
          >
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
        </div>
      </div>

      {/* Toolbar bawah: navigasi halaman + zoom */}
      {uiOn && total > 0 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20">
          <div className="flex items-center justify-between gap-2 bg-gradient-to-t from-black/85 to-transparent px-3 py-3">
            {!strip ? (
              <>
                {/* Manga dibaca kanan -> kiri: tombol kiri = halaman berikutnya */}
                <button
                  onClick={prevPage}
                  disabled={index <= 0}
                  className="pointer-events-auto flex size-11 items-center justify-center rounded-full border border-white/20 bg-black/70 text-white disabled:opacity-30"
                  aria-label="Halaman sebelumnya"
                >
                  <ChevronRight className="size-5" />
                </button>
              </>
            ) : (
              <button
                onClick={() => goChapter(olderChapter?.number ?? chNum)}
                disabled={!olderChapter}
                className="pointer-events-auto flex h-9 items-center gap-1.5 rounded-full border border-white/20 bg-black/70 px-3 text-[11px] font-bold text-white disabled:opacity-30"
              >
                <ChevronLeft className="size-4" /> Bab
              </button>
            )}

            <div className="pointer-events-auto flex items-center gap-2">
              <button
                onClick={() => setZoom((z) => Math.max(1, Number((z - 0.5).toFixed(1))))}
                className="flex size-8 items-center justify-center rounded-full border border-white/20 bg-black/70 text-white"
                aria-label="Perkecil"
              >
                <Minus className="size-4" />
              </button>
              <span className="min-w-11 text-center text-[11px] font-bold text-white">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => setZoom((z) => Math.min(4, Number((z + 0.5).toFixed(1))))}
                className="flex size-8 items-center justify-center rounded-full border border-white/20 bg-black/70 text-white"
                aria-label="Perbesar"
              >
                <Plus className="size-4" />
              </button>
            </div>

            {strip ? (
              <button
                onClick={() => goChapter(olderChapter?.number ?? chNum)}
                disabled={!olderChapter}
                className="pointer-events-auto flex h-9 items-center gap-1.5 rounded-full border border-white/20 bg-black/70 px-3 text-[11px] font-bold text-white disabled:opacity-30"
              >
                Bab <ChevronRight className="size-4" />
              </button>
            ) : (
              <button
                onClick={nextPage}
                disabled={atEnd}
                className="pointer-events-auto flex size-11 items-center justify-center rounded-full border border-white/20 bg-black/70 text-white disabled:opacity-30"
                aria-label="Halaman berikutnya"
              >
                <ChevronLeft className="size-5" />
              </button>
            )}
          </div>

          {strip && atEnd && olderChapter && (
            <div className="pointer-events-none pb-2">
              <button
                onClick={() => goChapter(olderChapter.number)}
                className="pointer-events-auto mx-auto flex items-center gap-2 rounded-full bg-violet-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg"
              >
                Lanjut Chapter {olderChapter.number}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Sheet daftar chapter */}
      {sheet && (
        <div className="absolute inset-0 z-30 flex flex-col bg-black/70 backdrop-blur-sm">
          <div className="mt-auto max-h-[80%] w-full overflow-hidden rounded-t-2xl border-t border-white/15 bg-background">
            <div className="flex items-center justify-between border-b border-border p-3">
              <h3 className="text-sm font-bold">Daftar Chapter</h3>
              <button
                onClick={() => setSheet(false)}
                className="rounded-full border border-border p-1.5"
                aria-label="Tutup"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="thin-scroll max-h-[65vh] overflow-y-auto p-3">
              <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                {chapters.map((c) => (
                  <button
                    key={c.url}
                    onClick={() => goChapter(c.number)}
                    className={cn(
                      "rounded-lg border py-2 text-xs font-bold transition",
                      c.number === chNum
                        ? "border-violet-500 bg-violet-600 text-white"
                        : "border-border bg-secondary/40 hover:border-violet-500",
                    )}
                  >
                    {c.number}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
