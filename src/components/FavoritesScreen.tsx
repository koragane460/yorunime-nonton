// LAYAR SUBSCRIBE (tombol "Subscribe" di navigasi bawah).
//
// Judul besar + garis, lalu SATU daftar gabungan semua kategori (tab
// Anime/Manga/Manhwa/Donghua/Film di atas DIHAPUS — permintaan user).
// Mode SINGLE = semua favorite tampil polos; mode FILTER = otomatis
// dikelompokkan Ongoing (dengan chip tipe anime/manga/manhwa/donghua)
// → garis pembatas → Completed, dua-duanya berjudul putih tanpa dot.
// Di bawahnya tetap ada blok Download dan TOP VOTE CHARACTER.

import { useEffect, useMemo, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { motion } from "framer-motion";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "react-router";
import { DownloadsPanel } from "@/components/HomeTopButtons";
import { ComicDetailScreen } from "@/components/ComicDetailScreen";
import { cn } from "@/lib/utils";
import { Clapperboard, Crown, Filter, Heart, List, Tv, Vote as VoteIcon } from "lucide-react";

// Chip tipe di dalam kelompok Ongoing (mode filter saja).
type OngoingFilter = "semua" | "anime" | "manga" | "manhwa" | "donghua";

/**
 * Status tayang → kelompok Ongoing. Terima snapshot AniList (RELEASING),
 * label tampilan (Ongoing/Berjalan), maupun teks bebas sumber donghua —
 * asal bukan tamat/completed/movie/tv.
 */
function isOngoingStatus(s?: string): boolean {
  if (!s) return false;
  const v = s.toLowerCase();
  if (/(tamat|completed|selesai|finished|ended|end|movie|tv|hiatus)/.test(v)) {
    return false;
  }
  return /(releasing|ongoing|berjalan|airing|airing|belum tamat|publishing|jalan)/.test(v);
}

const ONGOING_CHIPS: { key: OngoingFilter; label: string }[] = [
  { key: "semua", label: "Semua" },
  { key: "anime", label: "Anime" },
  { key: "manga", label: "Manga" },
  { key: "manhwa", label: "Manhwa" },
  { key: "donghua", label: "Donghua" },
];

/** Tipe baris favorite untuk chip Ongoing. */
function rowType(f: SubRow): OngoingFilter {
  if ("slug" in f) return f.kind === "manhwa" ? "manhwa" : "manga";
  const k = f.kind ?? "anime";
  return k === "donghua" ? "donghua" : k === "anime" ? "anime" : k as OngoingFilter;
}

/** Baris favorite anime/donghua/film (tabel animeFavorites). */
type AnimeRow = {
  _id: string;
  animeId: string;
  animeTitle: string;
  animeImage?: string;
  kind?: string;
  /** Snapshot status tayang — diisi & disegarkan oleh aksi refresh. */
  status?: string;
  createdAt: number;
};

/** Baris favorite manga/manhwa (tabel comicFavorites). */
type ComicRow = {
  _id: string;
  slug: string;
  comicTitle: string;
  comicImage?: string;
  kind: string;
  /** Masih berjalan atau sudah tamat — disegarkan oleh aksi refresh. */
  ongoing?: boolean;
  createdAt: number;
};

type SubRow = AnimeRow | ComicRow;

export function FavoritesScreen({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const favorites = useQuery(api.activities.myFavorites, user ? {} : "skip");
  const comicFavorites = useQuery(api.comics.myFavorites, user ? {} : "skip");
  // Top 10 hasil voting karakter — hanya terisi setelah event (7 hari) selesai.
  const top = useQuery(api.votes.topCharacters, {});

  // Chip tipe di dalam kelompok Ongoing (mode filter saja).
  const [ongoingType, setOngoingType] = useState<OngoingFilter>("semua");
  // "filter" (DEFAULT) = daftar otomatis dikelompokkan Ongoing → garis
  // pembatas → Completed, tanpa satu pun tombol status.
  // "single" = SEMUA kategori dicampur, kartu berbaris polos urut favorite.
  const [mode, setMode] = useState<"single" | "filter">("filter");
  // Detail manga/manhwa dibuka sebagai layar penuh (sama seperti di Baca).
  const [pick, setPick] = useState<{ slug: string; kind: "manga" | "manhwa" } | null>(
    null,
  );

  const animeRows = useMemo(
    () => (favorites ?? []) as AnimeRow[],
    [favorites],
  );
  const comicRows = useMemo(
    () => (comicFavorites ?? []) as ComicRow[],
    [comicFavorites],
  );

  // Segarkan status tayang yang kadaluarsa — favorite menyimpan snapshot,
  // jadi anime/komik yang kelar beberapa minggu lalu harus pindah sendiri ke
  // kelompok Completed. Dibatasi tiap 3 jam (anime) / 6 jam (komik) per device.
  const refreshAnimeStatuses = useAction(api.activities.refreshStatuses);
  const refreshComicStatuses = useAction(api.comics.refreshStatuses);
  useEffect(() => {
    if (!user) return;
    const now = Date.now();
    try {
      const lastA = Number(window.localStorage.getItem("yn-sub-ref-a") ?? 0);
      if (now - lastA > 3 * 3600_000) {
        window.localStorage.setItem("yn-sub-ref-a", String(now));
        void refreshAnimeStatuses().catch(() => {});
      }
      const lastC = Number(window.localStorage.getItem("yn-sub-ref-c") ?? 0);
      if (now - lastC > 6 * 3600_000) {
        window.localStorage.setItem("yn-sub-ref-c", String(now));
        void refreshComicStatuses().catch(() => {});
      }
    } catch {
      /* localStorage ditolak — refresh manual tidak masalah */
    }
  }, [user, refreshAnimeStatuses, refreshComicStatuses]);

  /** SEMUA kategori dicampur jadi satu daftar (permintaan user). */
  const items = useMemo(
    () =>
      [...animeRows, ...comicRows].sort((a, b) => b.createdAt - a.createdAt),
    [animeRows, comicRows],
  );

  /** Pecah daftar jadi dua kelompok — dipakai mode "filter". */
  const { ongoingItems, doneItems } = useMemo(() => {
    const ongoing: SubRow[] = [];
    const done: SubRow[] = [];
    for (const f of items) {
      const flag =
        "slug" in f
          ? f.ongoing !== false
          : isOngoingStatus(f.status);
      (flag ? ongoing : done).push(f);
    }
    return { ongoingItems: ongoing, doneItems: done };
  }, [items]);

  // Chip tipe menyaring kelompok Ongoing saja (sesuai permintaan).
  const ongoingShown =
    ongoingType === "semua"
      ? ongoingItems
      : ongoingItems.filter((f) => {
          const t = rowType(f);
          return t === ongoingType;
        });

  const emptyText =
    "Belum ada judul yang di-subscribe. Tekan tombol hati di detail judul.";

  /** Satu grid kartu — dipakai mode single & tiap kelompok (Ongoing/Completed). */
  const renderGrid = (list: SubRow[]) => (
    <div className="mt-3 grid grid-cols-3 gap-2.5 sm:grid-cols-4">
      {list.map((f, i) => {
        const key = "slug" in f ? f.slug : f.animeId;
        const title = "slug" in f ? f.comicTitle : f.animeTitle;
        const image = "slug" in f ? f.comicImage : f.animeImage;
        return (
          <motion.button
            key={key}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 30, 350), duration: 0.26 }}
            onClick={() => {
              if ("slug" in f) {
                setPick({
                  slug: f.slug,
                  kind: f.kind === "manhwa" ? "manhwa" : "manga",
                });
              } else if ((f.kind ?? "anime") === "film") {
                // status menyimpan jenis film (movie/tv) — lihat Film.tsx
                navigate(
                  `/film?film=${encodeURIComponent(f.animeId)}&t=${f.status === "tv" ? "tv" : "movie"}`,
                );
              } else {
                navigate(
                  `/info?anime=${encodeURIComponent(f.animeId)}&judul=${encodeURIComponent(f.animeTitle)}`,
                );
              }
            }}
            className="group text-left"
          >
            <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-white/10 bg-black/40">
              {image ? (
                <img
                  src={image}
                  alt={title}
                  loading="lazy"
                  className="size-full object-cover transition duration-300 group-hover:scale-105"
                />
              ) : (
                <div className="flex size-full items-center justify-center">
                  {(f as AnimeRow).kind === "film" ? (
                    <Clapperboard className="size-6 text-muted-foreground" />
                  ) : (
                    <Tv className="size-6 text-muted-foreground" />
                  )}
                </div>
              )}
              {(f as AnimeRow).kind === "film" ? (
                <Clapperboard className="absolute right-1.5 top-1.5 size-4 fill-gold text-gold drop-shadow" />
              ) : (
                <Heart className="absolute right-1.5 top-1.5 size-4 fill-white/85 text-white/85 drop-shadow" />
              )}
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-2 pb-1.5 pt-4">
                <span className="line-clamp-2 text-[11px] font-bold leading-tight text-white">
                  {title}
                </span>
              </span>
            </div>
          </motion.button>
        );
      })}
    </div>
  );

  return (
    <div className="fade-enter pb-24">
      <div className="px-1 pt-4">
        {/* ---------------- JUDUL + GARIS ---------------- */}
        <h1 className="text-left text-2xl font-black tracking-tight">Subscribe</h1>
        <div className="mt-2 h-px w-full bg-gradient-to-r from-gold/70 via-border to-transparent" />

        {/* ---------------- DAFTAR SUBSCRIBE (semua tipe dicampur) ---------------- */}
        {items.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            {emptyText}
          </p>
        ) : mode === "single" ? (
          /* Tanpa filter: kartu berbaris sesuai urutan di-favorite. */
          renderGrid(items)
        ) : (
          /* Otomatis terbagi: Ongoing → garis pembatas → Completed. */
          <div>
            {ongoingItems.length > 0 && (
              <>
                {/* Judul ONGOING: putih, tanpa dot (permintaan user). */}
                <div className="mt-4 flex items-center gap-2">
                  <h2 className="text-sm font-black uppercase tracking-[0.14em] text-white">
                    Ongoing
                  </h2>
                  <span className="text-[11px] font-semibold text-muted-foreground">
                    {ongoingShown.length} masih jalan
                  </span>
                </div>
                {/* Chip tipe anime/manga/manhwa/donghua khusus Ongoing. */}
                <div className="thin-scroll -mx-1 mt-2 flex gap-2 overflow-x-auto px-1 pb-1">
                  {ONGOING_CHIPS.map((c) => (
                    <button
                      key={c.key}
                      onClick={() => setOngoingType(c.key)}
                      className={cn(
                        "shrink-0 rounded-full border px-3 py-1 text-[11px] font-bold transition",
                        ongoingType === c.key
                          ? "border-white bg-white text-black"
                          : "border-white/25 text-white/70",
                      )}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
                {ongoingShown.length === 0 ? (
                  <p className="mt-2 text-[12px] text-muted-foreground">
                    Tidak ada ongoing tipe ini.
                  </p>
                ) : (
                  renderGrid(ongoingShown)
                )}
              </>
            )}

            {/* Garis pembatas antar kelompok — hanya saat keduanya ada. */}
            {ongoingItems.length > 0 && doneItems.length > 0 && (
              <div className="my-4 flex items-center gap-3" aria-hidden>
                <span className="h-px flex-1 bg-gradient-to-r from-transparent via-white/25 to-white/25" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                  selesai
                </span>
                <span className="h-px flex-1 bg-gradient-to-l from-transparent via-white/25 to-white/25" />
              </div>
            )}

            {doneItems.length > 0 && (
              <>
                {/* Judul COMPLETED: putih, tanpa dot (permintaan user). */}
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-black uppercase tracking-[0.14em] text-white">
                    Completed
                  </h2>
                  <span className="text-[11px] font-semibold text-muted-foreground">
                    {doneItems.length} tamat
                  </span>
                </div>
                {renderGrid(doneItems)}
              </>
            )}
          </div>
        )}

        {/* ---------------- 2) DOWNLOAD ---------------- */}
        <div className="mt-6">
          <h2 className="text-left text-lg font-bold tracking-tight">Download</h2>
          <div className="mt-2">
            <DownloadsPanel inline onClose={onClose} minimalEmpty />
          </div>
        </div>

        {/* -------- 3) TOP VOTE CHARACTER ANIME — setelah voting 7 hari -------- */}
        {top?.ready && top.items.length > 0 && (
          <div className="mt-6">
            <h2 className="flex items-center gap-2 text-left text-lg font-bold tracking-tight">
              <VoteIcon className="size-5 text-primary" aria-hidden />
              TOP VOTE CHARACTER ANIME
            </h2>
            <div className="mt-2 space-y-2">
              {top.items.map((c, i) => (
                <motion.div
                  key={`${i}-${c.name}`}
                  initial={{ opacity: 0, x: -24, scale: 0.97 }}
                  whileInView={{ opacity: 1, x: 0, scale: 1 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ delay: i * 0.07, duration: 0.45, ease: "easeOut" }}
                  className="flex items-center gap-3 rounded-2xl border border-white/12 bg-white/[0.04] p-2.5"
                >
                  {/* Peringkat */}
                  <motion.span
                    initial={{ rotate: -20, scale: 0.5 }}
                    whileInView={{ rotate: 0, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.07 + 0.15, type: "spring", bounce: 0.5 }}
                    className={
                      c.rank <= 3
                        ? "flex size-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-b from-amber-300 to-amber-500 text-sm font-black text-black shadow-[0_0_14px_-4px] shadow-amber-400/70"
                        : "flex size-8 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] text-sm font-black text-white/80"
                    }
                  >
                    {c.rank === 1 ? <Crown className="size-4" aria-hidden /> : c.rank}
                  </motion.span>

                  {/* Gambar karakter */}
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-black/40">
                    {c.image ? (
                      <img
                        src={c.image}
                        alt={c.name}
                        loading="lazy"
                        className="size-full object-cover"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center">
                        <VoteIcon className="size-5 text-muted-foreground" aria-hidden />
                      </div>
                    )}
                  </div>

                  {/* Nama + anime + total vote */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-white">{c.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {c.animeTitle}
                    </p>
                    <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/10">
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{
                          width: `${Math.max(6, Math.round((c.votes / Math.max(1, top.items[0].votes)) * 100))}%`,
                        }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.07 + 0.2, duration: 0.9, ease: "easeOut" }}
                        className="h-full rounded-full bg-gradient-to-r from-primary to-amber-400"
                      />
                    </div>
                  </div>

                  {/* Total vote */}
                  <motion.span
                    initial={{ opacity: 0, y: 8 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.07 + 0.25, duration: 0.4 }}
                    className="shrink-0 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-[11px] font-black text-primary"
                  >
                    {c.votes.toLocaleString("id-ID")} vote
                  </motion.span>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Saklar tampilan di pojok kanan bawah — kotak rounded, biru muda,
          ada garis pembatas di tengah: kiri SINGLE (kartu sesuai urutan
          favorite), kanan FILTER (otomatis Ongoing → Completed). */}
      <div className="fixed bottom-24 right-4 z-40 flex items-stretch overflow-hidden rounded-full border border-sky-200/60 bg-sky-300 shadow-[0_10px_26px_-10px_rgba(56,189,248,0.9)]">
        <button
          type="button"
          onClick={() => setMode("single")}
          aria-pressed={mode === "single"}
          className={cn(
            "flex items-center gap-1.5 px-3.5 py-2.5 text-[11px] font-black transition active:scale-95",
            mode === "single"
              ? "bg-white text-sky-700"
              : "text-sky-950/75 hover:bg-white/30",
          )}
        >
          <List className="size-3.5" aria-hidden />
          Single
        </button>
        <span className="w-px shrink-0 bg-sky-950/25" aria-hidden />
        <button
          type="button"
          onClick={() => setMode("filter")}
          aria-pressed={mode === "filter"}
          className={cn(
            "flex items-center gap-1.5 px-3.5 py-2.5 text-[11px] font-black transition active:scale-95",
            mode === "filter"
              ? "bg-white text-sky-700"
              : "text-sky-950/75 hover:bg-white/30",
          )}
        >
          <Filter className="size-3.5" aria-hidden />
          Filter
        </button>
      </div>

      {/* Layar detail manga/manhwa yang di-subscribe */}
      {pick && (
        <ComicDetailScreen
          slug={pick.slug}
          fallbackKind={pick.kind}
          onClose={() => setPick(null)}
          onPick={(slug) => setPick({ slug, kind: pick.kind })}
        />
      )}
    </div>
  );
}
