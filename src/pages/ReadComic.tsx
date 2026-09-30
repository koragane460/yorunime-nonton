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
  Minus,
  Moon,
  Plus,
  Sun,
  X,
} from "lucide-react";

type Chapter = { number: number; label: string; url: string; date?: string };

/**
 * Reader manga & manhwa.
 *  - Mode manga: panel satu-satu, geser horizontal (RTL), double-tap zoom.
 *  - Mode manhwa: strip panjang, scroll vertikal, tinggi panel menyesuaikan
 *    lebar layar (gaya webtoon).
 *  - Toolbar: daftar chapter, mode baca, terang/gelap, zoom, dan lompat
 *    ke chapter lalu/sebelumnya.
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
  const [broken, setBroken] = useState<Record<number, string>>({});

  const containerRef = useRef<HTMLDivElement>(null);
  const chNum = Number(chapter) || 1;
  const total = images.length;

  // Muat gambar chapter.
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setImages([]);
    setIndex(0);
    setZoom(1);
    setBroken({});
    setUiOn(true);
    setStrip(kind === "manhwa");
    containerRef.current?.scrollTo({ top: 0 });
    getPages({ slug, chapter: chNum })
      .then((r: any) => {
        if (alive) setImages((r?.images ?? []) as string[]);
      })
      .catch(() => toast.error("Gagal memuat halaman chapter"))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, chNum, kind]);

  // Detail (judul + daftar chapter) — diambil sekali per slug.
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

  // Simpan ke history setiap halaman berganti.
  useEffect(() => {
    if (loading || total === 0 || !detail) return;
    void recordRead({
      slug,
      comicTitle: detail.title,
      comicImage: detail.image,
      kind: detail.kind ?? kind,
      chapter: chNum,
      chapterLabel: detail.chapters?.find((c: Chapter) => c.number === chNum)?.label,
      page: index,
      totalPages: total,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, chNum, total, loading]);

  const goto = useCallback(
    (next: number) => {
      setIndex(Math.max(0, Math.min(total - 1, next)));
      if (!strip) containerRef.current?.scrollTo({ left: 0 });
    },
    [total, strip],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goto(strip ? index + 1 : index - 1);
      if (e.key === "ArrowLeft") goto(strip ? index - 1 : index + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goto, index, strip]);

  const chapters: Chapter[] = detail?.chapters ?? [];
  const prevCh = chapters.find((c) => c.number === chNum + 1);
  const nextCh = chapters.find((c) => c.number === chNum - 1);

  const goChapter = (n: number) => {
    setSheet(false);
    navigate(`/baca/${encodeURIComponent(slug)}/${n}?jenis=${kind}`);
  };


  return (
    <div
      className={cn(
        "fixed inset-0 z-[70] flex flex-col",
        dark ? "bg-black" : "bg-zinc-100",
      )}
    >
      {/* Konten */}
      <div
        ref={containerRef}
        onScroll={(e) => {
          if (!strip) return;
          const el = e.currentTarget;
          const idx = Math.round(el.scrollTop / Math.max(1, el.clientHeight));
          if (idx !== index) setIndex(idx);
        }}
        className={cn(
          "min-h-0 flex-1",
          strip ? "overflow-y-auto" : "overflow-x-hidden overflow-y-auto",
        )}
      >
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-zinc-400">
            Memuat chapter {chNum}…
          </div>
        ) : total === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-zinc-400">
            <p className="text-sm">Chapter tidak punya gambar</p>
            <button
              onClick={() => navigate(-1)}
              className="rounded-full border border-white/20 px-4 py-2 text-xs"
            >
              Kembali
            </button>
          </div>
        ) : strip ? (
          // ---- Mode manhwa: strip panjang, satu gambar = satu layar ----
          <div className="mx-auto w-full max-w-2xl">
            {images.map((src, i) => (
              <button
                key={`${src}-${i}`}
                onClick={() => setUiOn((v) => !v)}
                onDoubleClick={() =>
                  setZoom((z) => (z === 1 ? 2 : z === 2 ? 3 : 1))
                }
                className="block w-full"
              >
                <img
                  src={broken[i] ?? src}
                  onError={() => setBroken((b) => ({ ...b, [i]: src }))}
                  alt={`Halaman ${i + 1}`}
                  loading="lazy"
                  style={zoom !== 1 ? { width: `${zoom * 100}%` } : undefined}
                  className="w-full select-none"
                />
              </button>
            ))}
            <ChapterNav
              prevCh={nextCh}
              nextCh={prevCh}
              onGo={goChapter}
              dark={dark}
              kind={kind}
            />
          </div>
        ) : (
          // ---- Mode manga: panel satu-satu, geser sideways ----
          <div
            className="flex h-full snap-x snap-mandatory overflow-x-auto"
            onScroll={(e) => {
              const el = e.currentTarget;
              const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
              if (i !== index) setIndex(i);
            }}
          >
            {images.map((src, i) => (
              <div
                key={`${src}-${i}`}
                className="flex h-full w-full shrink-0 snap-center items-center justify-center"
                onClick={() => setUiOn((v) => !v)}
                onDoubleClick={() => setZoom((z) => (z === 1 ? 2 : 1))}
              >
                <img
                  src={broken[i] ?? src}
                  alt={`Halaman ${i + 1}`}
                  loading="lazy"
                  draggable={false}
                  style={zoom !== 1 ? { maxWidth: "none", width: `${zoom * 100}%` } : undefined}
                  className="max-h-full w-auto max-w-full select-none object-contain"
                />
              </div>
            ))}
            <div className="flex h-full w-full shrink-0 snap-center items-center justify-center">
              <ChapterNav
                prevCh={nextCh}
                nextCh={prevCh}
                onGo={goChapter}
                dark={dark}
                kind={kind}
                compact
              />
            </div>
          </div>
        )}
      </div>

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
            dark ? "bg-gradient-to-b from-black/85 to-transparent" : "bg-gradient-to-b from-white/95 to-transparent",
          )}
        >
          <button
            onClick={() => navigate(-1)}
            className="pointer-events-auto flex size-8 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white"
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
              className={cn(
                "truncate text-[10px]",
                dark ? "text-zinc-400" : "text-zinc-600",
              )}
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
      {uiOn && total > 0 && !strip && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20">
          <div className="flex items-center justify-between gap-2 bg-gradient-to-t from-black/85 to-transparent px-3 py-3">
            <button
              onClick={() => goto(index - 1)}
              disabled={index <= 0}
              className="pointer-events-auto flex size-10 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white disabled:opacity-35"
            >
              <ChevronLeft className="size-5" />
            </button>
            <div className="pointer-events-auto flex items-center gap-2">
              <button
                onClick={() => setZoom((z) => Math.max(1, Number((z - 0.5).toFixed(1))))}
                className="flex size-8 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white"
              >
                <Minus className="size-4" />
              </button>
              <span className="min-w-10 text-center text-[11px] font-bold text-white">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => setZoom((z) => Math.min(4, Number((z + 0.5).toFixed(1))))}
                className="flex size-8 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white"
              >
                <Plus className="size-4" />
              </button>
            </div>
            <button
              onClick={() => goto(index + 1)}
              disabled={index >= total - 1}
              className="pointer-events-auto flex size-10 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white disabled:opacity-35"
            >
              <ChevronRight className="size-5" />
            </button>
          </div>
        </div>
      )}

      {uiOn && total > 0 && strip && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20">
          <div className="flex items-center justify-between gap-2 bg-gradient-to-t from-black/85 to-transparent px-3 py-3">
            <button
              onClick={() => goChapter(nextCh?.number ?? chNum)}
              disabled={!nextCh}
              className="pointer-events-auto flex h-9 items-center gap-1.5 rounded-full border border-white/20 bg-black/60 px-3 text-[11px] font-bold text-white disabled:opacity-35"
            >
              <ChevronLeft className="size-4" /> Sebelumnya
            </button>
            <span className="pointer-events-auto text-[11px] font-bold text-white">
              {index + 1}/{total}
            </span>
            <button
              onClick={() => goChapter(prevCh?.number ?? chNum)}
              disabled={!prevCh}
              className="pointer-events-auto flex h-9 items-center gap-1.5 rounded-full border border-white/20 bg-black/60 px-3 text-[11px] font-bold text-white disabled:opacity-35"
            >
              Berikutnya <ChevronRight className="size-4" />
            </button>
          </div>
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

function ChapterNav({
  prevCh,
  nextCh,
  onGo,
  dark,
  kind,
  compact,
}: {
  prevCh?: Chapter;
  nextCh?: Chapter;
  onGo: (n: number) => void;
  dark: boolean;
  kind: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex w-full flex-col items-center gap-3 px-6",
        compact ? "justify-center" : "py-10",
      )}
    >
      {kind === "manhwa" ? (
        <p className={cn("text-xs", dark ? "text-zinc-400" : "text-zinc-600")}>
          Selesai — lanjut ke chapter berikutnya
        </p>
      ) : (
        <p className={cn("text-xs", dark ? "text-zinc-400" : "text-zinc-600")}>
          Geser untuk halaman berikutnya
        </p>
      )}
      <div className="flex gap-3">
        {nextCh && (
          <button
            onClick={() => onGo(nextCh.number)}
            className="rounded-full border border-white/20 bg-black/60 px-4 py-2 text-xs font-bold text-white"
          >
            Chapter {nextCh.number} →
          </button>
        )}
        {prevCh && (
          <button
            onClick={() => onGo(prevCh.number)}
            className="rounded-full border border-white/20 bg-black/60 px-4 py-2 text-xs font-bold text-white"
          >
            ← Chapter {prevCh.number}
          </button>
        )}
      </div>
    </div>
  );
}
