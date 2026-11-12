import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useHideNavOnMount } from "@/components/AppLayout";
import { useAuth } from "@/hooks/use-auth";
import { StatusChip, formatViews } from "@/components/ComicCard";
import { CharacterRow } from "@/components/CharacterRow";
import { PremiumOnlyGate } from "@/components/PremiumOnlyGate";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Bell, BookOpen, CalendarDays, Eye, Lock } from "lucide-react";
import { BookmarkPickerSheet } from "@/components/BookmarkPicker";
import { StripBackIcon } from "@/components/StripBack";

/** Nama hari Indonesia — dipakai tag "Update setiap …" (komik ongoing). */
const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
function hariDariTanggal(v?: string | number): string | undefined {
  if (!v) return undefined;
  const t = typeof v === "number" ? v : Date.parse(String(v));
  if (!Number.isFinite(t)) return undefined;
  return HARI[new Date(t).getDay()];
}

type Chapter = {
  number: number;
  label: string;
  url: string;
  date?: string;
  dateMs?: number;
};

const LABEL_KIND = { manga: "Manga", manhwa: "Manhwa" } as const;

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
  // Layer "Premium Only" muncul kalau user tanpa Premium mencoba membaca.
  const [showGate, setShowGate] = useState(false);
  const [bookmarkOpen, setBookmarkOpen] = useState(false);
  const isPremium = (user?.premiumUntil ?? 0) > Date.now();

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
  const accent = isManga ? "bg-sky-600 hover:bg-sky-500" : "bg-rose-600 hover:bg-rose-500";
  const accentText = isManga ? "text-sky-300" : "text-rose-300";
  const accentBorder = isManga ? "border-sky-500/60" : "border-rose-500/60";

  const chapters = d ? (asc ? [...d.chapters].reverse() : d.chapters) : [];
  // Hari update — diambil dari tanggal chapter terbaru (komik yang masih
  // ongoing). Tidak ada tanggal = tag tidak ditampilkan (tidak dikarang).
  const updateDay = d?.ongoing
    ? hariDariTanggal(d?.latest?.dateMs ?? d?.latest?.date)
    : undefined;
  const shown = showAll ? chapters : chapters.slice(0, 30);
  const views = formatViews(d?.views);

  const read = (ch: Chapter) => {
    // Manga & manhwa = konten Premium. Tanpa Premium user tetap boleh
    // melihat semua judul & chapter (dan tombol kategori tetap aktif),
    // tapi tidak bisa membuka halamannya untuk dibaca.
    if (!isPremium) {
      setShowGate(true);
      return;
    }
    navigate(`/baca/${encodeURIComponent(d!.slug)}/${ch.number}?jenis=${d!.kind}`);
  };

  return (
    <div className="screen-enter fixed inset-0 z-50 overflow-y-auto bg-background">
      {/* Layer "Premium Only" — munculDIATAS konten, tapi pointer-nya cuma
          memblokir area konten. Area tombol kembali / tutup / ganti kategori
          tetap di atas layer ini (z-60) sehingga tidak ikut terkunci. */}
      {showGate && !isPremium && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowGate(false)}
          aria-hidden
        />
      )}
      {bookmarkOpen && d && (
        <BookmarkPickerSheet
          item={{
            id: d.slug,
            title: d.title,
            image: d.image,
            kind: d.kind,
            status: d.ongoing ? "Ongoing" : "Completed",
          }}
          defaultSaved={!!isFav}
          onToggleDefault={async () => {
            if (!user || !d) return;
            const r = await toggleFav({
              slug: d.slug,
              comicTitle: d.title,
              comicImage: d.image,
              kind: d.kind,
              ongoing: d.ongoing,
            });
            toast.success(r.favorited ? "Masuk Subscribe" : "Dihapus dari Subscribe");
          }}
          onClose={() => setBookmarkOpen(false)}
        />
      )}
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
              className="flex items-center py-1 pr-1 text-white transition active:opacity-60"
            >
              <StripBackIcon />
            </button>
            <button
              onClick={() => {
                if (!user || !d) return;
                setBookmarkOpen(true);
              }}
              className="rounded-full bg-black/55 p-2 backdrop-blur"
            >
              <Bell
                className={cn(
                  "size-5",
                  isFav ? "fill-gold text-gold" : "text-white",
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
                      isManga ? "bg-sky-600 text-white" : "bg-rose-600 text-white",
                    )}
                  >
                    {isManga ? "Manga" : "Manhwa"}
                  </span>
                  <StatusChip ongoing={d.ongoing} />
                  {updateDay && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[9px] font-bold text-amber-300 ring-1 ring-amber-300/35">
                      <CalendarDays className="size-3" aria-hidden />
                      Update setiap {updateDay}
                    </span>
                  )}
                </div>
                <h1 className="mt-1 line-clamp-2 text-lg font-black leading-tight text-white yn-outline">
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
                    ["Tema", d.theme || d.genres.join(", ") || "-"],
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
                      className="rounded-full border border-white/25 px-2.5 py-1 text-[11px] font-semibold text-white"
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
                  {!isPremium && <Lock className="size-3.5" />}
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

              {/* Kolom karakter paling ikonik manga/manhwa — foto + nama.
                  Muncul tepat di bawah tombol Baca, SEBELUM sinopsis. */}
              <CharacterRow title={d.title} />

              {/* Sinopsis — di BAWAH Character (permintaan user). */}
              <h2 className="mb-1 mt-5 text-base font-bold">Sinopsis</h2>
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

              {/* Chapter — manga: baris, manhwa: grid pill */}
              {!isPremium && (
                <div className="relative mt-5">
                  {/* Daftar chapter tetap terlihat (agar user tahu isi apa
                      yang terkunci), tapi diberi pita miring Premium Only dan
                      tidak bisa diketuk. */}
                  <div className="pointer-events-none select-none opacity-40 blur-[1.5px]">
                    <div className="mb-1 flex items-center justify-between">
                      <h2 className="text-base font-bold">Chapter</h2>
                      <span className="text-[11px] text-muted-foreground">
                        {d.chapterCount} chapter
                      </span>
                    </div>
                    <div
                      className={cn(
                        "max-h-56 overflow-hidden rounded-xl border border-white/10",
                        isManga ? "divide-y divide-white/8" : "p-2",
                      )}
                    >
                      {(asc ? [...d.chapters].reverse() : d.chapters)
                        .slice(0, 8)
                        .map((ch) => (
                          <div
                            key={ch.url}
                            className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
                          >
                            <span
                              className={cn(
                                "w-9 shrink-0 rounded-md py-1 text-center text-xs font-black",
                                isManga
                                  ? "bg-sky-600/20 text-sky-200"
                                  : "bg-rose-600/20 text-rose-200",
                              )}
                            >
                              {ch.number}
                            </span>
                            <span className="truncate text-xs">
                              {ch.label}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                  <PremiumOnlyGate className="bottom-0 top-auto h-full" />
                  <button
                    onClick={() => setShowGate(true)}
                    aria-label={`Buka daftar chapter ${LABEL_KIND[kind]} (Premium)`}
                    className="absolute inset-0 z-30 cursor-pointer"
                  />
                </div>
              )}
              {isPremium && (
                <>
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
                    className="mb-2 rounded-full border border-border px-3 py-1 text-[11px] text-muted-foreground transition hover:border-rose-500/60"
                  >
                    {asc ? "Urutkan: Terbaru ↓" : "Urutkan: Terlama ↑"}
                  </button>
                  <div className="flex flex-wrap gap-1.5">
                    {shown.map((ch) => (
                      <button
                        key={ch.url}
                        onClick={() => read(ch)}
                        className="min-w-14 rounded-lg border border-rose-500/35 bg-rose-500/10 px-2.5 py-1.5 text-xs font-bold text-rose-100 transition hover:bg-rose-600/40"
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
              </>

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

      {/* Tombol mengambang "Daftar Chapter" DIHAPUS — daftar chapter sudah
          tampil inline di halaman ini, jadi tombol itu hanya menutupi
          konten (permintaan user: "daftar nya kenapa keliatan"). */}

      {/* Gate modal: muncul saat user tanpa Premium menekan tombol baca /
          chapter. Isinya pita miring Premium Only + tombol menuju halaman
          Premium, dan tetap bisa ditutup (tombol "Nanti saja"). */}
      {showGate && !isPremium && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-hidden p-6">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowGate(false)}
          />
          <div className="relative w-full max-w-md">
            <PremiumOnlyGate />
            <button
              onClick={() => setShowGate(false)}
              className="mt-4 w-full rounded-full border border-border py-2.5 text-xs font-semibold text-muted-foreground"
            >
              Nanti saja
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


