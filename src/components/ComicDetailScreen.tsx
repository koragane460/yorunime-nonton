import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useHideNavOnMount } from "@/components/AppLayout";
import { useAuth } from "@/hooks/use-auth";
import { StatusChip, formatViews } from "@/components/ComicCard";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { BookOpen, ChevronLeft, Eye, Heart, List, X } from "lucide-react";

type Chapter = {
  number: number;
  label: string;
  url: string;
  date?: string;
  dateMs?: number;
};

type Detail = {
  slug: string;
  title: string;
  altTitle: string;
  synopsis: string;
  image: string;
  kind: "manga" | "manhwa";
  ongoing: boolean;
  status: string;
  genres: string[];
  author: string;
  theme: string;
  rating: string;
  readDir: string;
  views?: number;
  chapterCount: number;
  chapters: Chapter[];
  latest?: Chapter;
  first?: Chapter;
};

/**
 * Detail komik. Dua tampilan berbeda:
 *  - Manga: gaya "buku" — panel kertas gelap, daftar chapter sebagai baris
 *    bernomor, tombol Baca Biru (baca kanan→kiri).
 *  - Manhwa: gaya "webtoon" — banner lebar, chapter sebagai grid pill,
 *    tombol Baca Magenta (baca scroll ke bawah).
 */
export function ComicDetailScreen({
  slug,
  fallbackKind,
  onClose,
  onPick,
}: {
  slug: string;
  fallbackKind: "manga" | "manhwa";
  onClose: () => void;
  onPick: (slug: string) => void;
}) {
  useHideNavOnMount();
  const navigate = useNavigate();
  const { user } = useAuth();
  const getDetail = useAction(api.manga.detail);
  const isFav = useQuery(api.comics.isFavorite, user ? { slug } : "skip");
  const toggleFav = useMutation(api.comics.toggleFavorite);
  const [d, setD] = useState<Detail | null>(null);
  const [failed, setFailed] = useState(false);
  const [openSynopsis, setOpenSynopsis] = useState(false);
  const [asc, setAsc] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [showChapters, setShowChapters] = useState(false);

  useEffect(() => {
    let alive = true;
    setD(null);
    setFailed(false);
    getDetail({ slug })
      .then((r: any) => {
        if (!alive) return;
        if (!r) setFailed(true);
        else setD(r as Detail);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const kind: "manga" | "manhwa" = d?.kind ?? fallbackKind;
  const isManga = kind === "manga";
  const accent = isManga ? "bg-sky-600 hover:bg-sky-500" : "bg-fuchsia-600 hover:bg-fuchsia-500";
  const accentText = isManga ? "text-sky-300" : "text-fuchsia-300";
  const accentBorder = isManga ? "border-sky-500/60" : "border-fuchsia-500/60";

  const chapters = d ? (asc ? [...d.chapters].reverse() : d.chapters) : [];
  const shown = showAll ? chapters : chapters.slice(0, 30);
  const views = formatViews(d?.views);

  const read = (ch: Chapter) => {
    navigate(`/baca/${encodeURIComponent(d!.slug)}/${ch.number}?jenis=${d!.kind}`);
  };

  return (
    <div className="screen-enter fixed inset-0 z-50 overflow-y-auto bg-background">
      <div className="pb-24">
        {/* Banner — manga memakai potret memanjang, manhua banner lebar webtoon */}
        <div className="relative">
          <div
            className={cn("w-full bg-cover bg-center", isManga ? "h-72" : "h-56")}
            style={{
              backgroundImage: `linear-gradient(180deg, rgba(0,0,0,.6) 0%, rgba(0,0,0,.15) 45%, var(--background) 97%), url(${d?.image ?? ""})`,
            }}
          />
          <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between p-3">
            <button
              onClick={onClose}
              className="rounded-full bg-black/55 p-2 backdrop-blur transition hover:border-sky-400"
            >
              <ChevronLeft className="size-4 text-white" />
            </button>
            <button
              onClick={async () => {
                if (!user || !d) return;
                const r = await toggleFav({
                  slug: d.slug,
                  comicTitle: d.title,
                  comicImage: d.image,
                  kind: d.kind,
                });
                toast.success(r.favorited ? "Masuk favorite" : "Dihapus dari favorite");
              }}
              className="rounded-full bg-black/55 p-2 backdrop-blur"
            >
              <Heart
                className={cn(
                  "size-5",
                  isFav ? "fill-red-500 text-red-500" : "text-white",
                )}
              />
            </button>
          </div>

          {d && (
            <div className="absolute inset-x-0 bottom-0 flex items-end gap-3 px-3 pb-3">
              <img
                src={d.image}
                alt=""
                className={cn(
                  "shrink-0 self-end rounded-lg object-cover shadow-xl",
                  isManga ? "aspect-[2/3] w-24" : "aspect-[3/4] w-20",
                )}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[9px] font-black uppercase",
                      isManga ? "bg-sky-600 text-white" : "bg-fuchsia-600 text-white",
                    )}
                  >
                    {isManga ? "Manga" : "Manhwa"}
                  </span>
                  <StatusChip ongoing={d.ongoing} />
                </div>
                <h1 className="mt-1 line-clamp-2 text-lg font-black leading-tight text-white drop-shadow">
                  {d.title}
                </h1>
                {views && (
                  <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-white/85">
                    <Eye className="size-3" /> {views} pembaca
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="px-3">
          {!d && !failed && <div className="skeleton mt-3 h-56 w-full rounded-xl" />}
          {failed && (
            <p className="py-16 text-center text-sm text-muted-foreground">
              Komik tidak ditemukan
            </p>
          )}

          {d && (
            <>
              {/* Info strip — manga: baris label/nilai, manhwa: chip grid */}
              {isManga ? (
                <div className="mt-3 overflow-hidden rounded-xl border border-sky-500/25 bg-sky-500/5">
                  {[
                    ["Judul Alternatif", d.altTitle || "-"],
                    ["Pengarang", d.author || "-"],
                    ["Tema", d.theme || d.genres.slice(0, 3).join(", ") || "-"],
                    ["Rating", d.rating || "13+"],
                    ["Arah Baca", d.readDir || (isManga ? "Kanan ke kiri" : "Atas ke bawah")],
                    ["Jumlah Chapter", `${d.chapterCount} chapter`],
                  ].map(([k, v], i) => (
                    <div
                      key={k}
                      className={cn(
                        "flex gap-3 px-3 py-2 text-xs",
                        i % 2 === 1 && "bg-white/[0.03]",
                      )}
                    >
                      <span className="w-28 shrink-0 text-muted-foreground">{k}</span>
                      <span className="min-w-0 flex-1 font-semibold">{v}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {d.genres.map((g) => (
                    <span
                      key={g}
                      className="rounded-full border border-fuchsia-500/40 bg-fuchsia-500/10 px-2.5 py-1 text-[11px] font-semibold text-fuchsia-200"
                    >
                      {g}
                    </span>
                  ))}
                  <span className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground">
                    {d.author || "-"}
                  </span>
                  <span className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground">
                    {d.rating || "13+"}
                  </span>
                </div>
              )}

              <h2 className="mb-1 mt-4 text-base font-bold">Sinopsis</h2>
              <p
                className={cn(
                  "text-sm leading-6 text-zinc-300",
                  !openSynopsis && "line-clamp-4",
                )}
              >
                {d.synopsis || "Sinopsis belum tersedia."}
              </p>
              {d.synopsis.length > 160 && (
                <button
                  onClick={() => setOpenSynopsis((v) => !v)}
                  className={cn("mt-1 text-xs font-semibold underline", accentText)}
                >
                  {openSynopsis ? "Tutup" : "Baca selengkapnya"}
                </button>
              )}

              {/* Tombol baca — manga & manhwa beda warna & ikon */}
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => d.latest && read(d.latest)}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-2 rounded-full py-3 font-bold text-white transition",
                    accent,
                  )}
                >
                  <BookOpen className="size-4" />
                  Baca {d.latest ? d.latest.label : ""}
                </button>
                {d.first && d.first !== d.latest && (
                  <button
                    onClick={() => read(d.first!)}
                    className={cn(
                      "rounded-full border px-4 text-xs font-semibold transition",
                      accentBorder,
                      accentText,
                    )}
                  >
                    Awal
                  </button>
                )}
              </div>

              {/* Chapter — manga: baris, manhwa: grid pill */}
              <div className="mb-1 mt-5 flex items-center justify-between">
                <h2 className="text-base font-bold">Chapter</h2>
                <span className="text-[11px] text-muted-foreground">
                  {d.chapterCount} chapter
                </span>
              </div>
              {d.chapterCount === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">
                  Belum ada chapter
                </p>
              ) : isManga ? (
                <>
                  <button
                    onClick={() => setAsc((v) => !v)}
                    className="mb-2 rounded-full border border-border px-3 py-1 text-[11px] text-muted-foreground transition hover:border-sky-500/60"
                  >
                    {asc ? "Urutkan: Terbaru ↓" : "Urutkan: Terlama ↑"}
                  </button>
                  <div className="divide-y divide-white/8 overflow-hidden rounded-xl border border-white/10">
                    {shown.map((ch) => (
                      <button
                        key={ch.url}
                        onClick={() => read(ch)}
                        className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-sky-500/10"
                      >
                        <span className="w-9 shrink-0 rounded-md bg-sky-600/20 py-1 text-center text-xs font-black text-sky-200">
                          {ch.number}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                          {ch.label}
                        </span>
                        {ch.date && (
                          <span className="shrink-0 text-[10px] text-muted-foreground">
                            {ch.date}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setAsc((v) => !v)}
                    className="mb-2 rounded-full border border-border px-3 py-1 text-[11px] text-muted-foreground transition hover:border-fuchsia-500/60"
                  >
                    {asc ? "Urutkan: Terbaru ↓" : "Urutkan: Terlama ↑"}
                  </button>
                  <div className="flex flex-wrap gap-1.5">
                    {shown.map((ch) => (
                      <button
                        key={ch.url}
                        onClick={() => read(ch)}
                        className="min-w-14 rounded-lg border border-fuchsia-500/35 bg-fuchsia-500/10 px-2.5 py-1.5 text-xs font-bold text-fuchsia-100 transition hover:bg-fuchsia-600/40"
                      >
                        {ch.number}
                      </button>
                    ))}
                  </div>
                </>
              )}
              {chapters.length > 30 && (
                <button
                  onClick={() => setShowAll((v) => !v)}
                  className="mt-2 w-full rounded-lg border border-border py-2 text-xs"
                >
                  {showAll ? "Tampilkan lebih sedikit" : `Tampilkan semua (${chapters.length})`}
                </button>
              )}

              <p className="mt-4 text-[11px] leading-5 text-muted-foreground">
                {d.ongoing
                  ? "Masih Ongoing — chapter berikutnya menyusul. Halaman ini ikut masuk Jadwal."
                  : "Series sudah Tamat — tidak ada chapter lanjutan."}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Sheet daftar chapter */}
      {showChapters && d && (
        <ChapterSheet
          chapters={chapters}
          onClose={() => setShowChapters(false)}
          onPick={(ch) => {
            setShowChapters(false);
            read(ch);
          }}
        />
      )}
      <button
        onClick={() => setShowChapters(true)}
        className="fixed bottom-4 right-4 z-[55] flex items-center gap-1.5 rounded-full border border-white/20 bg-black/70 px-3.5 py-2 text-xs font-semibold text-white backdrop-blur"
      >
        <List className="size-3.5" /> Daftar Chapter
      </button>
    </div>
  );
}

function ChapterSheet({
  chapters,
  onClose,
  onPick,
}: {
  chapters: Chapter[];
  onClose: () => void;
  onPick: (ch: Chapter) => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/70 backdrop-blur-sm">
      <div className="mt-auto max-h-[80%] w-full overflow-hidden rounded-t-2xl border-t border-white/15 bg-background">
        <div className="flex items-center justify-between border-b border-border p-3">
          <h3 className="text-sm font-bold">Daftar Chapter ({chapters.length})</h3>
          <button onClick={onClose} className="rounded-full border border-border p-1.5">
            <X className="size-4" />
          </button>
        </div>
        <div className="thin-scroll max-h-[65vh] overflow-y-auto p-3">
          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
            {chapters.map((ch) => (
              <button
                key={ch.url}
                onClick={() => onPick(ch)}
                className="rounded-lg border border-border bg-secondary/40 py-2 text-xs font-bold transition hover:border-violet-500"
              >
                {ch.number}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
