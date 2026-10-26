import { Component, lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";

import { useFastChat } from "@/hooks/use-fast-chat";
import { AppLayout, useHideNavOnMount } from "@/components/AppLayout";
import { AnimeCard, AnimeGrid, SectionTitle, Avatar, BlueCheck, ClanTag, TitleBadge, clanNameClass } from "@/components/lstream-ui";
import { DEFAULT_CLAN_ICON } from "@/lib/clanIcons";
import { STAFF_BADGE, avatarFallback } from "@/lib/lstream";
import { ProfileSheet } from "@/components/ProfileSheet";
import { FramedAvatar } from "@/components/FramedAvatar";
import { StripBack } from "@/components/StripBack";
import { VoteScreen } from "@/components/VoteScreen";
import { CuplixOverlay } from "@/components/CuplixOverlay";
import { CharacterRow } from "@/components/CharacterRow";
import { RequestButtons } from "@/components/RequestButtons";
import { ChatPanel, type ChatMsg } from "@/components/ChatPanel";
import { CardCarousel, CatalogScreen, type CardT as CatalogCard, type CatalogKind, type PickSource as CatalogPickSource } from "@/components/CatalogRows";
import { formatViews, type ComicItem } from "@/components/ComicCard";
import type { FilmCard as FilmCardT } from "@/convex/films";
import { isMusicSecret } from "@/lib/musicSecret";

// Layar musik muat saat dibutuhkan saja: penuh dengan player, browse, dan
// antrean, tidak perlu ikut di bundel awal Home.
const MusicScreen = lazy(() => import("@/pages/Music"));

import {
  Loader2,
  Check,
  Heart,
  X,
  Lock,
  MessageSquare,
  Play,
  Star,
  Copy,
  Film,
  Tv,
  Plus,
  Users,
  LayoutGrid,
  List,
  Eye,
  CalendarDays,
} from "lucide-react";
// Ikon chrome Home memakai gaya SF Symbols (alias nama lama → JSX tetap utuh).
import {
  SearchIcon as Search,
  BellIcon as Bell,
  ChevronLeftIcon as ChevronLeft,
  ChevronRightIcon as ChevronRight,
  TrophyIcon as Trophy,
  GiftIcon as Gift,
  SwipeIcon as ArrowLeftRight,
  SlidersIcon as SlidersHorizontal,
  InfoIcon as Info,
  SparklesIcon as Sparkles,
  CrownIcon,
} from "@/components/ios-icons";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { GlobalChatPreview } from "@/components/GlobalChatPreview";
import type { Id } from "@/convex/_generated/dataModel";


/**
 * Palet chip GENRE — berwarna lembut (BUKAN neon), diputar per judul genre
 * supaya deretan chip tidak monoton satu warna. Dipakai di section Genre
 * Home DAN di panel pilihan genre di layar Search (konsisten, permintaan).
 */
const GENRE_HUES = [
  "border-sky-400/40 bg-sky-400/15 text-sky-100 hover:bg-sky-400/25",
  "border-rose-400/40 bg-rose-400/15 text-rose-100 hover:bg-rose-400/25",
  "border-emerald-400/40 bg-emerald-400/15 text-emerald-100 hover:bg-emerald-400/25",
  "border-amber-400/40 bg-amber-400/15 text-amber-100 hover:bg-amber-400/25",
  "border-violet-400/40 bg-violet-400/15 text-violet-100 hover:bg-violet-400/25",
  "border-teal-400/40 bg-teal-400/15 text-teal-100 hover:bg-teal-400/25",
  "border-orange-400/40 bg-orange-400/15 text-orange-100 hover:bg-orange-400/25",
  "border-fuchsia-400/40 bg-fuchsia-400/15 text-fuchsia-100 hover:bg-fuchsia-400/25",
] as const;
function genreHue(i: number) {
  return GENRE_HUES[i % GENRE_HUES.length];
}

type AnimeCardT = CatalogCard & {
  source?: CatalogPickSource;
  isDonghua?: boolean;
  episode?: number;
  /** Total episode (rencana/aktual) dari katalog — tampil di baris daftar. */
  episodes?: number;
  timeLabel?: string;
};

/** Cegah error satu useQuery membunuh seluruh halaman. */
class QueryBoundary extends Component<
  { children: ReactNode; label?: string },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <p className="py-3 text-center text-xs text-muted-foreground">
          {this.props.label ?? "Gagal memuat"} — coba refresh.
        </p>
      );
    }
    return this.props.children;
  }
}

export default function Home() {
  // Setiap kali Home dibuka (termasuk setelah keluar dari halaman lain),
  // posisi scroll selalu kembali ke paling atas.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);
  return (
    <AppLayout>
      <HomeContent />
    </AppLayout>
  );
}

// ------------------------------------------------------------- skeletons ----

/** Nama hari Indonesia dari tanggal ("YYYY-MM-DD" / ms / Date). */
const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
function hariDariTanggal(v?: string | number): string | undefined {
  if (!v) return undefined;
  const t = typeof v === "number" ? v : Date.parse(String(v));
  if (!Number.isFinite(t)) return undefined;
  return HARI[new Date(t).getDay()];
}

function HeroSkeleton() {
  return (
    <div className="skeleton mt-3 h-[150px] w-full rounded-2xl border border-white/5" />
  );
}

/**
 * BANNER HERO YANG DIPEISOLASI (performa).
 *
 * State rotasi (`idx`) + interval 6 detik dimiliki komponen KECIL ini, jadi
 * tiap pergantian slide hanya banner ini yang re-render — bukan seluruh Home
 * (4.000+ baris, belasan useQuery). Sebelumnya seluruh halaman render ulang
 * tiap 6 detik, cukup berat untuk HP kelas menengah.
 *
 * Slide ditumpuk absolute + opacity supaya pergantian benar-benar FADE.
 * Judul di tengah; badge TOP #n + jumlah views di KANAN (bukan di kiri).
 */
function HeroSlides({
  items,
  onPick,
  onTop,
}: {
  items: AnimeCardT[];
  onPick: (id: string, title?: string, source?: CatalogPickSource) => void;
  onTop: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const total = items.length;

  // Jaga indeks tetap valid saat daftar item berubah (mis. load ulang).
  useEffect(() => {
    if (idx >= total) setIdx(0);
  }, [total, idx]);

  // Auto-rotate tiap 6 detik — hanya menggerakkan state komponen ini.
  useEffect(() => {
    if (total < 2) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % total), 6000);
    return () => clearInterval(t);
  }, [total]);

  return (
    <div className="relative h-[150px] min-w-0 flex-1 overflow-hidden rounded-2xl border border-white/10">
      {items.map((a, i) => (
        <div
          key={a.id}
          className={cn(
            "absolute inset-0 transition-opacity duration-700",
            i === idx ? "opacity-100" : "pointer-events-none opacity-0",
          )}
        >
          <div
            className="relative h-full overflow-hidden bg-cover bg-center"
            style={
              a.image
                ? {
                    backgroundImage:
                      `linear-gradient(0deg, rgba(2,6,16,.95) 0%, rgba(2,6,16,.62) 48%, rgba(2,6,16,.18) 100%), radial-gradient(120% 70% at 8% -8%, rgba(120,160,255,.22) 0%, rgba(120,160,255,0) 55%), url(${a.image})`,
                    backgroundSize: "100% 100%, 100% 100%, cover",
                    backgroundPosition: "center bottom, left top, center",
                    backgroundRepeat: "no-repeat, no-repeat, no-repeat",
                  }
                : undefined
            }
          >
            {!a.image && <div className="absolute inset-0 bg-hero-gradient" />}
            <button
              onClick={() =>
                onPick(a.id, a.title, a.source === "sanka" ? "sanka" : "anilist")
              }
              aria-label={`Detail ${a.title}`}
              className="absolute inset-0"
            />
            {/* Angka peringkat di KIRI ATAS — TANPA background, font tebel
                (permintaan user); jumlah views di KANAN ATAS. */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTop();
              }}
              className="absolute left-2 top-2 z-10 inline-flex shrink-0 items-center text-xl font-black leading-none text-white [text-shadow:0_2px_6px_rgba(0,0,0,.85)] transition active:scale-95"
            >
              {i + 1}
            </button>
            <span className="absolute right-2 top-2 z-10 inline-flex shrink-0 items-center gap-1 rounded-lg bg-black/40 px-2 py-1 text-sm font-black leading-none text-white backdrop-blur-sm">
              <Eye className="size-4 text-white/90" aria-hidden />
              {formatViews(viewCountFor(String(a.id)))}
            </span>
            {/* Kotak hitam MENYATU ke banner: TANPA rounded, background 40%,
                judul di tengah dengan font tebal. */}
            <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-black/40 px-3 py-3.5 backdrop-blur-[2px]">
              <p className="min-w-0 flex-1 truncate text-center text-base font-black text-white">
                {a.title}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function GridSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}>
          <div className="skeleton aspect-[2/3] w-full rounded-xl" />
          <div className="skeleton mt-1.5 h-3 w-full rounded" />
        </div>
      ))}
    </div>
  );
}

/** Baris katalog lengkap (50 item/halaman) + tombol "muat lebih banyak". */
/**
 * Judul section + "Lihat selengkapnya" di kanan (tanpa background).
 * Teksnya hanya muncul kalau memang ada sisa item, supaya tidak menawarkan
 * sesuatu yang tidak ada.
 */
function SectionRow({
  title,
  count,
  shown = 12,
  onMore,
  children,
}: {
  title: string;
  count: number;
  shown?: number;
  onMore: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-bold tracking-tight">{title}</h2>
        {count > shown && (
          <button
            onClick={onMore}
            className="shrink-0 whitespace-nowrap text-[11px] font-semibold text-primary underline-offset-4 hover:underline"
          >
            Lihat selengkapnya
          </button>
        )}
      </div>
      {children}
    </>
  );
}

/**
 * Baris kartu manga / manhwa di Home ("Terbaru & Populer"): poster geser ke
 * kanan + "Lihat selengkap" yang mengarah ke layar Baca. `variant` memberi
 * sedikit perbedaan gaya antara manga (poster pendek) dan manhwa (poster
 * webtoon yang lebih tinggi + label chapter terbaru).
 */
function ComicHomeRow({
  title,
  items,
  loading,
  variant,
  onMore,
  onPick,
}: {
  title: string;
  items: ComicItem[];
  loading: boolean;
  variant: "manga" | "manhwa";
  onMore: () => void;
  onPick: (slug: string) => void;
}) {
  if (items.length === 0 && loading) {
    return (
      <div className="mt-4">
        <SectionTitle>{title}</SectionTitle>
        <div className="flex gap-2.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "skeleton w-28 shrink-0 rounded-xl",
                variant === "manga" ? "h-40" : "h-52",
              )}
            />
          ))}
        </div>
      </div>
    );
  }
  if (items.length === 0) return null;
  return (
    <div className="fade-enter mt-4">
      <div className="mb-2 flex items-center justify-between">
        {/* Judul baris TANPA warna gradasi (permintaan: tulisan
            "…Terbaru & Populer" polos). */}
        <h2 className="text-lg font-bold tracking-tight">{title}</h2>
        <button
          onClick={onMore}
          className="shrink-0 text-xs font-semibold text-primary"
        >
          Lihat selengkap ›
        </button>
      </div>
      <div className="thin-scroll flex gap-2.5 overflow-x-auto pb-1">
        {items.map((c) => {
          const views = formatViews(c.views);
          return (
            <button
              key={c.slug}
              onClick={() => onPick(c.slug)}
              className="group w-28 shrink-0 text-left"
            >
              <div className="relative overflow-hidden rounded-t-xl border border-border/60">
                {/* Poster + kotak judul MENYATU (tanpa jarak) — gaya sama
                    seperti kartu anime. */}
                {c.image ? (
                  <img
                    src={c.image}
                    alt={c.title}
                    loading="lazy"
                    className={cn(
                      "w-full object-cover transition duration-300 group-hover:scale-105",
                      variant === "manga" ? "aspect-[2/3]" : "aspect-[3/4.4]",
                    )}
                  />
                ) : (
                  <div
                    className={cn(
                      "w-full bg-muted",
                      variant === "manga" ? "aspect-[2/3]" : "aspect-[3/4.4]",
                    )}
                  />
                )}
                {/* Label chapter terbaru — MENYATU dengan kartu (flush ke
                    sudut, tanpa rounded yang terlihat), biru muda. */}
                {variant === "manhwa" && c.latestChapter && (
                  <span className="absolute left-0 top-0 rounded-none rounded-br-lg bg-sky-300 px-1.5 py-0.5 font-mono text-[9px] font-bold text-black">
                    {c.latestChapter}
                  </span>
                )}
                {/* Title ONGOING/TAMAT — flush ke sudut kiri-atas kartu
                    (menyatu, rounded hanya pojok kanan-bawah), background
                    biru SAMPAI dengan chip StatusChip di manhwa/manhwa. */}
                {variant === "manga" && (
                  <span
                    className={cn(
                      "absolute left-0 top-0 rounded-none rounded-br-lg px-1.5 py-0.5 text-[9px] font-black uppercase text-black",
                      c.ongoing ? "bg-sky-300" : "bg-sky-400",
                    )}
                  >
                    {c.ongoing ? "Ongoing" : "Tamat"}
                  </span>
                )}
              </div>
              {/* Kotak judul semi-opaque MENYATU dengan poster. */}
              <div className="rounded-b-xl border-x border-b border-border/60 bg-black/55 px-1.5 py-1 backdrop-blur-sm">
                <p className="line-clamp-2 min-h-8 text-[11px] font-medium leading-4 text-white">
                  {c.title}
                </p>
                {views && (
                  <p className="mt-0.5 text-[10px] text-white/60">
                    {views} dibaca
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ------------------------------------------------------------ film home ----
/** Baris kartu poster film geser ke kanan — kotak judul MENYATU dengan
    poster (tanpa jarak), semi-opaque biar screen home tidak bolong. */
function FilmPosterRow({
  title,
  items,
  loading,
  onMore,
  onPick,
  hideHeader = false,
}: {
  title: string;
  items: FilmCardT[];
  loading: boolean;
  /** Opsional — "Lihat selengkap" (menu film) sudah dihapus dari Home. */
  onMore?: () => void;
  onPick: (id: string, kind: "movie" | "tv") => void;
  /** true = tanpa judul baris (baris dikumpulkan jadi SATU kategori Film). */
  hideHeader?: boolean;
}) {
  if (items.length === 0 && loading) {
    return (
      <div className={cn("fade-enter", hideHeader ? "mt-3" : "mt-4")}>
        {!hideHeader && <SectionTitle>{title}</SectionTitle>}
        <div className="thin-scroll flex gap-2.5 overflow-x-auto pb-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-56 w-28 shrink-0 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }
  if (items.length === 0) return null;
  return (
    <div className={cn("fade-enter", hideHeader ? "mt-3" : "mt-4")}>
      {!hideHeader && (
        <div className="mb-2 flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-lg font-bold tracking-tight">
            <Film className="size-4 shrink-0 text-sky-400" aria-hidden />
            {title}
          </h2>
          {onMore && (
            <button
              onClick={onMore}
              className="shrink-0 text-xs font-semibold text-primary"
            >
              Lihat selengkap ›
            </button>
          )}
        </div>
      )}
      <div className="thin-scroll flex gap-2.5 overflow-x-auto pb-1">
        {items.map((f) => (
          <button
            key={`${f.kind}-${f.id}`}
            onClick={() => onPick(f.id, f.kind)}
            className="group w-28 shrink-0 text-left"
          >
            <div className="relative overflow-hidden rounded-t-xl border border-border/60 bg-black">
              {f.image ? (
                <img
                  src={f.image}
                  alt={f.title}
                  loading="lazy"
                  decoding="async"
                  className="aspect-[2/3] w-full object-cover transition duration-300 group-hover:scale-105"
                />
              ) : (
                <div className="flex aspect-[2/3] w-full items-center justify-center bg-muted">
                  <Film className="size-6 text-muted-foreground" aria-hidden />
                </div>
              )}
              {typeof f.rating === "number" && f.rating > 0 && (
                <span className="absolute left-1.5 top-1.5 flex items-center gap-0.5 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-black text-amber-300 backdrop-blur-sm">
                  <Star className="size-2.5 fill-amber-300" aria-hidden />
                  {f.rating.toFixed(1)}
                </span>
              )}
              {f.kind === "tv" && (
                <span className="absolute right-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[8px] font-black uppercase text-white backdrop-blur-sm">
                  Series
                </span>
              )}
            </div>
            {/* Kotak judul menyatu langsung di bawah poster. */}
            <div className="rounded-b-xl border-x border-b border-border/60 bg-black/55 px-1.5 py-1 backdrop-blur-sm">
              <p className="line-clamp-2 min-h-8 text-[11px] font-medium leading-4 text-white">
                {f.title}
              </p>
              {f.year && (
                <p className="mt-0.5 text-[10px] text-white/60">{f.year}</p>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Cache module-level untuk kategori Film Home — begitu data pernah diambil,
 * buka Home lagi LANGSUNG tampil (tanpa nunggu action lagi). Tujuannya supaya
 * tidak ada layar kosong yang bikin Home terasa cuma punya 1 film.
 */
let filmHomeCache: {
  movies: FilmCardT[];
  series: FilmCardT[];
  genreName: string;
  genreItems: FilmCardT[];
} | null = null;

/** Kategori FILM di Home — SATU judul "Film & Series" dengan 3 baris yang
    ditumpuk vertikal (baris 1, baris 2 di bawahnya, baris 3 di bawahnya).
    Semua request diambil PARALEL + hasil di-cache module supaya cepat. */
function FilmHomeSection() {
  const navigate = useNavigate();
  const searchFilms = useAction(api.films.search);
  const getGenres = useAction(api.films.genres);
  const byGenre = useAction(api.films.byGenre);

  const [movies, setMovies] = useState<FilmCardT[]>(
    () => filmHomeCache?.movies ?? [],
  );
  const [series, setSeries] = useState<FilmCardT[]>(
    () => filmHomeCache?.series ?? [],
  );
  const [genreName, setGenreName] = useState<string>(
    () => filmHomeCache?.genreName ?? "",
  );
  const [genreItems, setGenreItems] = useState<FilmCardT[]>(
    () => filmHomeCache?.genreItems ?? [],
  );
  const [loading, setLoading] = useState(() => filmHomeCache === null);

  useEffect(() => {
    // Sudah ada cache → tidak perlu request ulang.
    if (filmHomeCache) return;
    let alive = true;
    (async () => {
      try {
        // Baris genre jalan SEIRAMA dengan 2 baris pertama (genre → byGenre
        // tetap berantai, tapi tidak nunggu movie/tv selesai dulu).
        const genreJob = (async () => {
          try {
            const gs = ((await getGenres({ kind: "movie" })) ?? []) as {
              id: string;
              name: string;
            }[];
            const pick =
              gs.find((g) => /^(action|aksi)$/i.test(g.name)) ?? gs[0];
            if (!pick) return { name: "", items: [] as FilmCardT[] };
            const list = (await byGenre({
              genreId: String(pick.id),
              kind: "movie",
            })) as FilmCardT[];
            return { name: pick.name, items: (list ?? []).slice(0, 12) };
          } catch {
            return { name: "", items: [] as FilmCardT[] };
          }
        })();

        const [mv, tv, genre] = await Promise.all([
          searchFilms({ kind: "movie" }).catch(() => [] as FilmCardT[]),
          searchFilms({ kind: "tv" }).catch(() => [] as FilmCardT[]),
          genreJob,
        ]);
        if (!alive) return;
        const next = {
          movies: (mv ?? []).slice(0, 12),
          series: (tv ?? []).slice(0, 12),
          genreName: genre.name,
          genreItems: genre.items,
        };
        filmHomeCache = next;
        setMovies(next.movies);
        setSeries(next.series);
        setGenreName(next.genreName);
        setGenreItems(next.genreItems);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openFilm = (id: string, kind: "movie" | "tv") =>
    navigate(`/film?film=${encodeURIComponent(id)}&t=${kind}`);

  if (!loading && movies.length === 0 && series.length === 0 && genreItems.length === 0) {
    return null;
  }
  return (
    <div className="fade-enter mt-4">
      {/* SATU judul kategori — 3 baris di bawahnya tanpa judul masing-masing. */}
      <div className="mb-2 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-lg font-bold tracking-tight">
          <Film className="size-4 shrink-0 text-sky-400" aria-hidden />
          Film &amp; Series
        </h2>
        {/* Tombol "Lihat selengkap" (menu film) DIHAPUS — film kini cukup
            dijangkau lewat Pencarian di Home (permintaan user). */}
      </div>
      <FilmPosterRow
        title="Film Populer"
        items={movies}
        loading={loading}
        onPick={openFilm}
        hideHeader
      />
      <FilmPosterRow
        title="Series Populer"
        items={series}
        loading={loading}
        onPick={openFilm}
        hideHeader
      />
      <FilmPosterRow
        title={genreName ? `Film ${genreName}` : "Film Pilihan"}
        items={genreItems}
        loading={loading}
        onPick={openFilm}
        hideHeader
      />
    </div>
  );
}

function BrowseRow({
  kind,
  title,
  onPick,
}: {
  kind: "movie" | "ova" | "special" | "season" | "upcoming" | "popular";
  title: string;
  onPick: (id: string) => void;
}) {
  const browse = useAction(api.anime.animeBrowse);
  const [items, setItems] = useState<AnimeCardT[]>([]);
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let alive = true;
    setBusy(true);
    browse({ kind, page })
      .then((r: any) => {
        if (!alive) return;
        let list = (r ?? []) as AnimeCardT[];
        // Baris Upcoming: judul yang datang dari backend masih membawa status
        // "Ongoing" + jumlah episode — padahal ini daftar SEGERA RILIS.
        // Dipaksa tampil sebagai Upcoming dan tanpa jumlah episode.
        if (kind === "upcoming") {
          list = list.map((a) => ({ ...a, status: "Upcoming", episodes: undefined }));
        }
        setItems((prev) => (page === 1 ? list : [...prev, ...list]));
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setBusy(false);
      });
    return () => {
      alive = false;
    };
  }, [kind, page, browse]);

  return (
    <>
      <SectionTitle>{title}</SectionTitle>
      {items.length === 0 ? (
        <GridSkeleton count={10} />
      ) : (
        <>
          <AnimeGrid
            items={items}
            onPick={onPick}
            newIds={new Set()}
            views={undefined}
          />
          <div className="mt-3 flex justify-center">
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={busy || page >= 6}
              className="rounded-full border border-border bg-black/55 px-4 py-1.5 text-xs font-semibold text-muted-foreground backdrop-blur-md transition hover:border-foreground/40 hover:text-primary disabled:opacity-50"
            >
              {busy ? "Memuat…" : page >= 6 ? "Semua item sudah tampil" : "Muat lebih banyak"}
            </button>
          </div>
        </>
      )}
    </>
  );
}

// ------------------------------------------------------------ home body ----

function HomeContent() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [params] = useSearchParams();
  const [pickId, setPickId] = useState<string | null>(params.get("pilih"));
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  // Data Top XP minggu ini untuk panel Leaderboard yang MENYATU dengan hero
  // banner (kotak tegak di kanan banner, langsung kelihatan Top 1-5).
  const heroLb = useQuery(api.xp.leaderboard, { period: "mingguan", limit: 5 });
  // Layar Top anime (dibuka dari badge TOP di hero banner).
  const [showTopAnime, setShowTopAnime] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showMusic, setShowMusic] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  // Link pemutar musik rahasia disuntukkan ke window supaya layar pencarian dan
  // podum leaderboard bisa membukanya lewat sandi y2zLo4V tanpa navigasi.
  useEffect(() => {
    // @ts-expect-error - properti aplikasi khusus, bukan bagian dari Window baku.
    window.__yn_openMusic = () => setShowMusic((v) => !v);
    return () => {
      // @ts-expect-error
      window.__yn_openMusic = undefined;
    };
  }, []);
  const [searchGenre, setSearchGenre] = useState<string | null>(null);
  // True saat layar pencarian dibuka lewat "Lihat semua ›" (Genre) —
  // panel pilihan genre multi-select langsung terbuka. Tombol Cari biasa
  // tidak menyalakan flag ini.
  const [searchOpenGenres, setSearchOpenGenres] = useState(false);
  // Layar penuh katalog (dibuka dari "Lihat selengkapnya").
  const [catalog, setCatalog] = useState<{
    kind: CatalogKind;
    title: string;
    items: CatalogCard[];
  } | null>(null);
  const [updateFirst, setUpdateFirst] = useState(true);
  // Jangkar tombol pencarian: tinggi warna ungu pada latar-global diukur dari
  // sini, lalu disimpan sebagai --yn-tint-end supaya warna berhenti tepat di
  // bawah tombol dan sisanya hitam penuh.
  const searchAnchor = useRef<HTMLDivElement | null>(null);
  // Sticky search bar: muncul di paling atas saat user scroll LEWAT kotak
  // search (permintaan) — kotak lurus samping hitam + kolom cari lebih besar.
  const [showStickySearch, setShowStickySearch] = useState(false);
  useEffect(() => {
    const onScroll = () => {
      const el = searchAnchor.current;
      if (!el) return;
      const past = el.getBoundingClientRect().bottom < 8;
      setShowStickySearch(past);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const hero = useAction(api.anime.animeOngoing);
  // Donghua ikut rotasi hero banner supaya bukan hanya anime yang tampil.
  const heroDonghua = useAction(api.sanka.donghuaLatestCards);
  const top = useAction(api.anime.animeTop);
  const today = useAction(api.anime.animeTrendingToday);
  const forYou = useAction(api.anime.animeForYou);
  const genres = useAction(api.anime.animeGenres);

  // Pencarian dipindahkan penuh ke layar SearchScreen (fullscreen):
  // tombol di Home hanya pemicu, tidak ada input/genre/hasil di Home.

  const [topList, setTopList] = useState<AnimeCardT[]>([]);
  const [todayList, setTodayList] = useState<AnimeCardT[]>([]);
  const [foryouList, setForyouList] = useState<AnimeCardT[]>([]);
  const [genreList, setGenreList] = useState<{ id: string; name: string }[]>([]);
  // Manga & manhwa untuk baris "Terbaru & Populer" di Home — diambil dari
  // aksi manga (newest + trending digabung, tanpa dobel per slug).
  const getComicNewest = useAction(api.manga.newest);
  const getComicTrending = useAction(api.manga.trending);
  const [mangaList, setMangaList] = useState<ComicItem[]>([]);
  const [manhwaList, setManhwaList] = useState<ComicItem[]>([]);
  const [loadingComics, setLoadingComics] = useState(true);
  const [loading, setLoading] = useState(true);
  const [heroItems, setHeroItems] = useState<AnimeCardT[]>([]);

  // Hero data is fetched at load time and must update the same hero tiles the
  // swipe and auto-rotate logic reads. Only the first successful payload wins
  // so existing animated state is not flushed while user is interacting.
  useEffect(() => {
    const tick = async () => {
      const [animeRes, donghuaRes] = await Promise.allSettled([
        hero({ page: 1 }),
        heroDonghua({ limit: 6 }),
      ]);
      const anime =
        animeRes.status === "fulfilled"
          ? ((animeRes.value ?? []) as unknown as AnimeCardT[]).slice(0, 6)
          : [];
      const donghua =
        donghuaRes.status === "fulfilled"
          ? ((donghuaRes.value ?? []) as unknown as AnimeCardT[])
              .slice(0, 4)
              .map((d) => ({
                ...d,
                isDonghua: true as const,
                source: "sanka" as const,
              }))
          : [];
      // Anime dulu, lalu donghua — rotasi hero berisi keduanya.
      const merged = [...anime, ...donghua];
      if (merged.length > 0) setHeroItems(merged);
    };
    tick().catch(() => {});
  }, []);

  // Total slide hero dihitung di dalam <HeroSlides /> (state rotasi sudah
  // dipisah supaya halaman utama tidak render ulang tiap 6 detik).

  // Muat data katalog (backend punya fallback statis, jadi selalu ada hasil)
  useEffect(() => {
    let alive = true;
    Promise.allSettled([
      // 50 judul: cukup untuk layar "Top anime" (badge TOP di hero banner),
      // Home sendiri hanya menampilkan 12 kartu pertama.
      top({ limit: 50 }),
      today({}),
      forYou({ seed: (user?.name?.length ?? 0) + 3 }),
      genres({}),
    ]).then(([rTop, rToday, rForYou, rGenres]) => {
      if (!alive) return;
      if (rTop.status === "fulfilled") setTopList((rTop.value as AnimeCardT[]) ?? []);
      if (rToday.status === "fulfilled") setTodayList((rToday.value as AnimeCardT[]) ?? []);
      if (rForYou.status === "fulfilled") setForyouList((rForYou.value as AnimeCardT[]) ?? []);
      if (rGenres.status === "fulfilled")
        setGenreList((rGenres.value as { id: string; name: string }[]) ?? []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Manga & manhwa "Terbaru & Populer": newest + trending digabung, slug
  // unik, dipotong 14 judul supaya ringan. Gagal fetch = diam (baris tidak
  // tampil karena list kosong).
  useEffect(() => {
    let alive = true;
    const loadKind = async (kind: "manga" | "manhwa") => {
      const [n, t] = await Promise.allSettled([
        getComicNewest({ kind }),
        getComicTrending({ kind, limit: 10 }),
      ]);
      const merged: ComicItem[] = [];
      const seen = new Set<string>();
      for (const r of [n, t]) {
        if (r.status !== "fulfilled") continue;
        for (const it of ((r.value ?? []) as ComicItem[])) {
          if (!it?.slug || seen.has(it.slug)) continue;
          seen.add(it.slug);
          merged.push(it);
        }
      }
      return merged.slice(0, 14);
    };
    Promise.allSettled([loadKind("manga"), loadKind("manhwa")]).then(
      ([m, mh]) => {
        if (!alive) return;
        if (m.status === "fulfilled") setMangaList(m.value);
        if (mh.status === "fulfilled") setManhwaList(mh.value);
        setLoadingComics(false);
      },
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // "Anime Update News" = anime yang episodenya benar-benar rilis hari ini,
  // lengkap jam tayangnya (dihitung dari zona waktu device user).
  const todayNews = useAction(api.anime.animeTodayAiring);
  const donghuaNews = useAction(api.sanka.donghuaWeeklySchedule);
  const [todayAiring, setTodayAiring] = useState<
    { id: string; title: string; image: string; episode: number; timeLabel: string }[]
  >([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [donghuaAiring, setDonghuaAiring] = useState<
    { id: string; title: string; image: string; episode: number; airingAt: number }[]
  >([]);
  useEffect(() => {
    let alive = true;
    setNewsLoading(true);
    todayNews({ limit: 14 })
      .then((r: any) => {
        if (alive) setTodayAiring(r ?? []);
      })
      .catch(() => {
        if (alive) setTodayAiring([]);
      })
      .finally(() => {
        if (alive) setNewsLoading(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Donghua ikut masuk "Update News": daftar digabung dengan anime, dengan
  // label kecil supaya user tahu mana animasi China. Sumbernya jadwal resmi
  // per hari (Sanka), jadi isinya sama persis dengan tab Donghua di Jadwal.
  useEffect(() => {
    let alive = true;
    const todayName = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"][
      new Date().getDay()
    ];
    donghuaNews({ day: todayName })
      .then((r: any) => {
        if (!alive) return;
        const list = (r?.byDay?.[todayName] ?? []) as {
          id: string;
          title: string;
          image: string;
          episode?: number;
        }[];
        setDonghuaAiring(
          list.map((d) => ({
            id: String(d.id),
            title: String(d.title ?? ""),
            image: String(d.image ?? ""),
            episode: Number(d.episode ?? 0) || 0,
            airingAt: 0,
          })),
        );
      })
      .catch(() => {
        if (alive) setDonghuaAiring([]);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Satu daftar untuk Update News: anime dulu, lalu donghua.
  const updateNews = useMemo(
    () => [
      ...todayAiring.map((a) => ({ ...a, isDonghua: false as const })),
      ...donghuaAiring.map((d) => ({
        ...d,
        // Sangka tidak punya jam tayang per hari, jadi yang ditulis honestly
        // hanya hari rilisnya — bukan angka jam yang dikarang.
        timeLabel: "Rilis hari ini",
        isDonghua: true as const,
      })),
    ],
    [todayAiring, donghuaAiring],
  );
  const favQuery = useQuery(api.activities.myFavorites, user ? {} : "skip");
  // Poster & judul asli dari AniList untuk kartu Favorite. Tanpa ini kartu
  // favorit memakai gambar yang tersimpan saat dulu ditekan, yang belum tentu
  // poster asli anime itu di Home.
  const realCards = useAction(api.anime.realCards);
  const [favReal, setFavReal] = useState<Record<string, { id: string; title: string; image: string }>>({});
  useEffect(() => {
    const rows = favQuery ?? [];
    if (rows.length === 0) {
      setFavReal({});
      return;
    }
    let alive = true;
    realCards({ ids: rows.map((r: any) => String(r.animeId ?? "")) })
      .then((r: any) => {
        if (alive && r) setFavReal(r);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [favQuery?.length]);

  // Rotasi hero (interval + indeks) sekarang dimiliki <HeroSlides /> —
  // lihat komponen itu. Tidak ada lagi setState di Home tiap 6 detik.

  // Link pemutar musik rahasia disuntukkan ke window supaya layar pencarian dan
  // podum leaderboard bisa membukanya lewat sandi y2zLo4V tanpa navigasi.
  useEffect(() => {
    // @ts-expect-error - properti aplikasi khusus, bukan bagian dari Window baku.
    window.__yn_openMusic = () => setShowMusic((v) => !v);
    return () => {
      // @ts-expect-error
      window.__yn_openMusic = undefined;
    };
  }, []);

  // Judul ikut disimpan: kartu dari sumber non-MAL (mis. Otakudesu) punya id
  // berupa slug, jadi tanpa judul backend tidak bisa menemukan sinopsis,
  // studio, rating, dan jumlah episodenya.
  const [pickTitle, setPickTitle] = useState<string | undefined>(undefined);
  // Kartu donghua (slug Sanka) dan kartu anime (id AniList) butuh layar
  // detail yang berbeda; kalau dicampur, judul donghua tertukar dengan anime.
  const [pickSource, setPickSource] = useState<CatalogPickSource>(
    (params.get("src") as CatalogPickSource) || "anilist",
  );
  const openAnime = (
    id: string,
    title?: string,
    source: CatalogPickSource = "anilist",
  ) => {
    setPickId(id);
    setPickTitle(title);
    setPickSource(source);
  };

  // Ukur posisi tombol pencarian lalu tulis ke --yn-tint-end pada elemen latar.
  // Dicek ulang saat ukuran layar berubah supaya batasnya tetap tepat.
  useEffect(() => {
    const el = searchAnchor.current;
    if (!el) return;
    const paint = () => {
      const host = el.closest(".yn-app-bg") as HTMLElement | null;
      if (!host) return;
      const bottom = el.getBoundingClientRect().bottom + window.scrollY;
      // Warna ungu sengaja dibuat lebih panjang dari jangkar SEARCH supaya
      // gradasinya masih keruh sampai bawah pencerahan anime.
      host.style.setProperty(
        "--yn-tint-end",
        `${Math.max(360, Math.round(bottom + 380))}px`,
      );
    };
    paint();
    window.addEventListener("resize", paint);
    return () => window.removeEventListener("resize", paint);
  }, [todayAiring.length, foryouList.length, genreList.length]);

  // Genre tidak lagi ditampilkan di Home — pindah ke layar Pencarian.
  // Tab di sini cuma penyaring tampilan (tidak menarik genre).
  return (
    <div className="pb-8">
      {/* Sticky search bar — muncul di paling atas saat user sudah scroll
          lewat kotak search. Kotak lurus (samping hitam) + kolom cari lebih
          besar untuk anime / donghua / film. */}
      {showStickySearch && (
        <div className="fixed inset-x-0 top-0 z-40 border-b border-white/10 bg-black/92 px-3 py-2.5 backdrop-blur-xl">
          <button
            onClick={() => {
              setSearchGenre(null);
              setSearchOpenGenres(false);
              setShowSearch(true);
            }}
            className="flex w-full items-center gap-2 rounded-full border border-white/12 bg-white/[0.06] px-4 py-3 text-left"
          >
            <Search className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="flex-1 text-[15px] text-muted-foreground">
              Cari anime, donghua, film…
            </span>
          </button>
        </div>
      )}
      {/* 1) YORUNIME PREMIUM — kotak ABU-ABU: ikon mahkota (kuning lembut)
          dalam kotak rounded + tulisan "Beli Premium Ada Di Sini" dalam
          kotak biru agak rounded. Tanpa ikon panah & tanpa "Mulai dari
          Rp7.000" (permintaan user). */}
      <button
        onClick={() => navigate("/premium")}
        className="fade-enter mt-4 flex w-full items-center gap-2.5 rounded-2xl border border-white/10 bg-zinc-500/25 px-3.5 py-4 text-left transition hover:bg-zinc-500/35"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-amber-300/40 bg-amber-300/15">
          <CrownIcon className="size-5 text-amber-300" />
        </span>
        <span className="w-fit max-w-full rounded-2xl bg-sky-500 px-3 py-2 text-[13px] font-bold text-white">
          Beli Premium Ada Di Sini
        </span>
      </button>

      {/* 2) HERO BANNER — SATU anime tampil (fade antar judul, selalu hanya
          1 slide terlihat) + Leaderboard sebagai kolom DI KANAN banner. */}
      {loading ? (
        <HeroSkeleton />
      ) : heroItems.length > 0 ? (
        <>
        <div className="fade-enter mt-3 flex w-full items-stretch gap-1">
          {/* ---- Banner utama: SEMUA judul ditumpuk + fade, tapi selalu
              hanya SATU slide yang terlihat (rotasi tiap 6 detik).
              PENTING (performa): state rotasi + interval-nya DIPEISOLASI di
              dalam <HeroSlides /> — jadi tiap 6 detik hanya banner kecil ini
              yang re-render, BUKAN seluruh Home (4.000+ baris). Sebelumnya
              HP user sampai restart sendiri karena render ulang raksasa
              tiap 6 detik. ---- */}
          <HeroSlides
            items={heroItems}
            onPick={openAnime}
            onTop={() => setShowTopAnime(true)}
          />

          {/* ---- Leaderboard DIHAPUS dari hero (sudah pindah ke Catalog). */}
        </div>
        </>
      ) : null}

      {/* 4) CHAT BARENG — satu baris kecil, benar-benar rounded:
          ikon chat → "Chat:" → satu pesan orang (berputar tiap 3 menit). */}
      <button
        onClick={() => setShowChat(true)}
        className="fade-enter mt-3 flex w-full items-center gap-2 rounded-full border border-white/10 bg-black/55 px-3 py-2 text-left backdrop-blur-md transition hover:border-foreground/40"
      >
        <span className="flex size-8 shrink-0 items-center justify-center bg-primary/15">
          <MessageSquare className="size-4 text-primary" aria-hidden />
        </span>
        <span className="shrink-0 text-sm font-bold">Chat:</span>
        <QueryBoundary label="Gagal memuat chat">
          <GlobalChatPreview />
        </QueryBoundary>
      </button>

      {/* 5) CARI ANIME — hanya tombol pemicu; pencarian tampil di layar
          FULL SCREEN (SearchScreen), bukan nempel di Home.
          `searchAnchor` dipakai untuk mengukur tinggi warna ungu di latar:
          warna itu harus berhenti tepat di bawah tombol ini. */}
      <div ref={searchAnchor}>
        <SectionTitle>Cari anime &amp; donghua</SectionTitle>
        <button
          onClick={() => {
            setSearchGenre(null);
            setSearchOpenGenres(false);
            setShowSearch(true);
          }}
          className="mt-3 flex w-full items-center gap-2 rounded-full border border-border bg-black/55 px-4 py-3.5 text-left backdrop-blur-md"
        >
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <span className="flex-1 text-sm text-muted-foreground">
            Cari disini
          </span>
          <span className="px-3 py-1 text-xs font-bold text-white">
            Cari
          </span>
        </button>
        {/* Tombol "Film & Series" lama DIHAPUS — akses film sekarang lewat
            kategori "Film" (3 baris geser) di bawah baris Manhwa. */}
      </div>







      {/* 6a) ANIME UPDATE NEWS — di bawah tombol search */}
        {updateFirst && (
          <>
            <div className="mt-4 flex items-center justify-between">
              <h2 className="text-lg font-bold tracking-tight">Update News</h2>
              <span className="text-[11px] text-muted-foreground">rilis hari ini</span>
            </div>
            {newsLoading ? (
              <div className="mt-2 flex gap-2.5">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="skeleton h-44 w-28 shrink-0 rounded-xl" />
                ))}
              </div>
            ) : updateNews.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                Tidak ada episode baru hari ini.
              </p>
            ) : (
              <div className="thin-scroll mt-2 flex gap-2.5 overflow-x-auto pb-1">
              {updateNews.map((a) => (
                <button
                  key={`${a.isDonghua ? "dh" : "an"}-${a.id}-${a.episode}`}
                  onClick={() =>
                    openAnime(a.id, a.title, a.isDonghua ? "sanka" : "anilist")
                  }
                  className="w-28 shrink-0 text-left"
                >
                  <div className="relative">
                    <AnimeCard
                      title={a.title}
                      image={a.image}
                      imageOnly
                      squareBottom
                      onClick={() =>
                        openAnime(a.id, a.title, a.isDonghua ? "sanka" : "anilist")
                      }
                    />
                    <span
                      className={cn(
                        "absolute left-1.5 top-1.5 rounded px-1.5 py-0.5 font-mono text-[9px] font-bold",
                        a.isDonghua
                          ? "bg-sky-700 text-white"
                          : "bg-primary text-primary-foreground",
                      )}
                    >
                      Ep {a.episode}
                    </span>
                    {a.isDonghua && (
                      <span className="absolute right-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[8px] font-black uppercase text-white">
                        Donghua
                      </span>
                    )}
                  </div>
                  {/* Kotak judul MENYATU langsung dengan kartu — tanpa celah
                      dan TANPA sudut rounded di atas, karena poster di atasnya
                      juga kotak di bawah (pinggiran kiri bawah & kanan bawah
                      menyatu dengan background judul). */}
                  <div className="rounded-b-xl bg-black/60 px-1.5 pb-1 pt-1 backdrop-blur-sm">
                    <p className="line-clamp-2 min-h-8 text-[11px] font-medium leading-4 text-white">
                      {a.title}
                    </p>
                    {/* Jam rilis di bawah judul, mengikuti zona waktu device. */}
                    <p className="font-mono text-[10px] text-white/60">
                      {a.timeLabel}
                    </p>
                  </div>
                </button>
              )              )}
            </div>
          )}
        </>
      )}

      {/* 6b) SEASON INI — lalu GENRE di bawahnya: chip-pill geser ke
          kanan. Menekan chip membuka layar SearchScreen dengan genre itu
          terpilih (panel multi-select genre ikut terbuka). */}
      <BrowseRow kind="season" title="Season Ini" onPick={openAnime} />
      {!loading && genreList.length > 0 && (
        <div className="fade-enter mt-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="bg-gradient-to-r from-sky-300 via-teal-200 to-emerald-300 bg-clip-text text-lg font-bold tracking-tight text-transparent">
              Genre
            </h2>
            <button
              onClick={() => {
                setSearchGenre(null);
                setSearchOpenGenres(true);
                setShowSearch(true);
              }}
              className="text-xs font-semibold text-primary"
            >
              Lihat semua ›
            </button>
          </div>
          {/* Chip WRAP ke beberapa baris — BERWARNA lembut per genre
              (bukan satu warna doang, juga bukan neon). */}
          <div className="flex flex-wrap gap-2">
            {genreList.map((g, gi) => (
              <button
                key={g.id}
                onClick={() => {
                  setSearchGenre(g.id);
                  setSearchOpenGenres(false);
                  setShowSearch(true);
                }}
                className="rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-1.5 text-xs font-semibold text-white backdrop-blur-md transition hover:border-white/35 active:scale-95"
              >
                {g.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 6c) MANGA TERBARU & POPULER — kartu geser ke kanan; "Lihat
          selengkap" mengarah ke layar Baca (tab navigasi). */}
      <ComicHomeRow
        title="Manga Terbaru & Populer"
        items={mangaList}
        loading={loadingComics}
        variant="manga"
        onMore={() => navigate("/baca?jenis=manga")}
        onPick={(slug) => navigate(`/baca?jenis=manga&komik=${encodeURIComponent(slug)}`)}
      />

      {/* 6d) MANHWA TERBARU & POPULER — gaya sedikit beda (poster lebih
          tinggi + label webtoon), arah geser dan "Lihat selengkap" sama. */}
      <ComicHomeRow
        title="Manhwa Terbaru & Populer"
        items={manhwaList}
        loading={loadingComics}
        variant="manhwa"
        onMore={() => navigate("/baca?jenis=manhwa")}
        onPick={(slug) => navigate(`/baca?jenis=manhwa&komik=${encodeURIComponent(slug)}`)}
      />

      {/* 6d-2) KATEGORI FILM — 3 baris kartu poster geser ke kanan
          (Film Populer · Series Populer · Film Aksi) + "Lihat selengkap"
          ke halaman Film. Menggantikan tombol Film & Series di atas. */}
      <FilmHomeSection />

      {/* 6e) KATEGORI LENGKAP: Movie / OVA / Donghua / Upcoming */}
      <BrowseRow kind="movie" title="Movie" onPick={openAnime} />
      <BrowseRow kind="ova" title="OVA &amp; ONA" onPick={openAnime} />
      {/* Slot khusus Donghua: dua baris geser ke kanan + "Lihat selengkapnya". */}
      <CardCarousel
        kind="donghua"
        title="Donghua"
        subtitle="subtitle Indonesia"
        onPick={openAnime}
      />
      <BrowseRow kind="upcoming" title="Segera Rilis (Upcoming)" onPick={openAnime} />

      {/* 7) TOP ANIME — 12 kartu, sisanya di layar penuh */}
      <SectionRow
        title="Top Anime"
        count={topList.length}
        onMore={() =>
          setCatalog({
            kind: "popular",
            title: "Top Anime",
            items: topList as unknown as CatalogCard[],
          })
        }
      >
        {loading ? (
          <GridSkeleton count={12} />
        ) : (
          <AnimeGrid
            items={topList.slice(0, 12)}
            onPick={openAnime}
            ranked
            newIds={new Set()}
          />
        )}
      </SectionRow>

      <SectionRow
        title="Top Anime Hari Ini"
        count={todayList.length}
        onMore={() =>
          setCatalog({
            kind: "popular",
            title: "Top Anime Hari Ini",
            items: todayList as unknown as CatalogCard[],
          })
        }
      >
        {loading ? (
          <GridSkeleton count={12} />
        ) : (
          <AnimeGrid
            items={todayList.slice(0, 12)}
            onPick={openAnime}
            ranked
            newIds={new Set()}
          />
        )}
      </SectionRow>

      <SectionRow
        title="Untuk Kamu"
        count={foryouList.length}
        onMore={() =>
          setCatalog({
            kind: "popular",
            title: "Untuk Kamu",
            items: foryouList as unknown as CatalogCard[],
          })
        }
      >
        {loading ? (
          <GridSkeleton count={12} />
        ) : (
          <AnimeGrid
            items={foryouList.slice(0, 12)}
            onPick={openAnime}
            newIds={new Set()}
            views={undefined}
          />
        )}
      </SectionRow>

      {catalog && (
        <CatalogScreen
          kind={catalog.kind}
          title={catalog.title}
          items={catalog.items}
          onClose={() => setCatalog(null)}
          onPick={openAnime}
        />
      )}

      {favQuery && favQuery.length > 0 && (
        <>
          <SectionTitle>Favorite Kamu</SectionTitle>
          <div className="thin-scroll flex gap-2.5 overflow-x-auto pb-1">
            {favQuery.map((f: any) => {
              const real = favReal[String(f.animeId)];
              return (
                <button
                  key={f._id}
                  onClick={() => openAnime(real?.id ?? f.animeId, real?.title ?? f.animeTitle)}
                  className="relative w-28 shrink-0 overflow-hidden rounded-xl border border-border/60"
                >
                  <img
                    src={real?.image || f.animeImage || ""}
                    alt=""
                    className="aspect-[2/3] w-full object-cover"
                  />
                  <Heart className="absolute right-1 top-1 size-4 fill-white/85 text-white/85" />
                  <p className="line-clamp-2 bg-black/60 p-1.5 text-left text-[10px] leading-3">
                    {real?.title || f.animeTitle}
                  </p>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Screens */}
      {showLeaderboard && <LeaderboardScreen onClose={() => setShowLeaderboard(false)} />}
      {showTopAnime && (
        <TopAnimeScreen
          items={topList}
          onClose={() => setShowTopAnime(false)}
          onPick={(id, title) => {
            setShowTopAnime(false);
            openAnime(id, title, "anilist");
          }}
        />
      )}
      {showSearch && (
        <SearchScreen
          initialGenre={searchGenre}
          openGenres={searchOpenGenres}
          onClose={() => setShowSearch(false)}
          onPick={openAnime}
          onOpenMusic={() => {
            setShowSearch(false);
            setShowMusic(true);
          }}
        />
      )}
      {showMusic && (
        <Suspense
          fallback={
            <div className="fixed inset-0 z-[95] flex items-center justify-center bg-[#08060d] text-white/70">
              <Loader2 className="size-6 animate-spin" />
            </div>
          }
        >
          <MusicScreen onClose={() => setShowMusic(false)} />
        </Suspense>
      )}
      {showChat && <GlobalChatScreen onClose={() => setShowChat(false)} />}
      {pickId && pickSource === "sanka" && (
        <DonghuaDetailScreen
          slug={pickId}
          onClose={() => {
            setPickId(null);
            setPickTitle(undefined);
          }}
          onPickDonghua={(next) => openAnime(next, undefined, "sanka")}
          onPlay={(epSlug, ep, title) =>
            navigate(
              // `anime` = slug SERI (dipakai Watch untuk memuat detail &
              // daftar episode), `ep` = slug EPISODE (dipakai untuk stream).
              `/nonton?anime=${encodeURIComponent(pickId)}&ep=${encodeURIComponent(`sanka__${epSlug}__ep${ep}`)}&judul=${encodeURIComponent(title)}&donghua=1`,
            )
          }
        />
      )}
      {pickId && pickSource === "anilist" && (
        <AnimeDetailScreen
          animeId={pickId}
          animeTitle={pickTitle}
          onClose={() => {
            setPickId(null);
            setPickTitle(undefined);
          }}
          onPick={(id, title) => {
            setPickId(id);
            setPickTitle(title);
            setPickSource("anilist");
          }}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------- kotak clan ----

/**
 * Kotak clan yang muncul di Home tepat di bawah "Chat bareng".
 * Hanya dirender kalau user punya clan (atau belum punya, biar ada ajakan).
 */
function ClanBox({ onOpen }: { onOpen: () => void }) {
  const { user } = useAuth();
  const membership = useQuery(api.clans.myMembership, user ? {} : "skip");
  const clan = useQuery(
    api.clans.clanDetail,
    membership?.clanId ? { clanId: membership.clanId } : "skip",
  );
  const msgs = useQuery(
    api.chat.listMessages,
    membership?.clanId ? { kind: "clan", clanId: membership.clanId, limit: 4 } : "skip",
  );

  if (!membership) {
    return (
      <button
        onClick={onOpen}
        className="fade-enter mt-2.5 flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-card p-3.5 text-left transition hover:border-foreground/40"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/15">
          <Trophy className="size-5 text-primary" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold">Belum punya clan</span>
          <span className="block text-xs text-zinc-400">
            Buat clan dan kumpulkan XP bersama teman
          </span>
        </span>
        <span className="px-3 py-1 text-xs font-bold text-white">
          Buat
        </span>
      </button>
    );
  }

  if (!clan) return null;
  const c = clan.clan;
  const last = msgs?.[msgs.length - 1];
  return (
    <button
      onClick={onOpen}
      className="fade-enter mt-2.5 w-full overflow-hidden rounded-2xl border border-white/10 bg-card p-3.5 text-left transition hover:border-foreground/40"
    >
      <div className="flex items-center gap-3">
        <img
          src={c.avatarUrl}
          alt=""
          className="size-11 shrink-0 rounded-xl object-cover"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {/* Nama clan ikut warna LEVEL-nya, sama seperti yang tampil di
                chat dan di panel clan — bukan putih polos. */}
            <p className={cn("truncate text-sm font-bold", clanNameClass(c.level))}>{c.name}</p>
            <ClanTag
              icon={c.tagIcon ?? DEFAULT_CLAN_ICON}
              tag={c.tag}
              color={c.color}
              level={c.level}
              className="px-1.5 py-0 text-[9px]"
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Lv.{c.level} · {c.memberCount} member ·{" "}
            {c.diamonds.toLocaleString("id-ID")} Sacret
          </p>
        </div>
        <ChevronRight className="size-5 shrink-0 text-zinc-500" />
      </div>
      <div className="my-2.5 h-px bg-white/10" />
      {last ? (
        <p className="truncate text-xs text-zinc-400">
          <span className="font-semibold text-zinc-300">{last.username}</span>:{" "}
          {last.text ?? (last.premiumGive ? "Give premium" : "[foto]")}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Belum ada chat di clan — sapa teman kamu!
        </p>
      )}
    </button>
  );
}// ------------------------------------------------------ chat preview ----


// ------------------------------------------------------ leaderboard ----

function LeaderEntryRow({
  rank,
  username,
  image,
  xp,
  suffix = "XP",
  compact = false,
  plain = false,
  level,
  seqId,
  staffRole,
  clanTag,
  clanTagIcon,
  givePremiumCount,
}: {
  rank: number;
  username?: string;
  image?: string;
  xp: number;
  suffix?: string;
  compact?: boolean;
  /** true = tanpa background/kotak (daftar Top selain podium 1-3). */
  plain?: boolean;
  level?: number;
  seqId?: number;
  staffRole?: string;
  clanTag?: string;
  clanTagIcon?: string;
  givePremiumCount?: number;
}) {
  return (
    /* Animasi naik: satu baris utuh (foto, username, XP) meluncur ke atas. */
    <div
      className={cn(
        "lb-rise flex items-center gap-3 rounded-2xl p-2.5",
        compact && "gap-2 py-1.5",
        !plain && "border bg-secondary/40",
        // Top 4-5 di preview Home (bukan daftar plain) dapat aksen biar tidak polos.
        !plain && rank === 4
          ? "border-cyan-400/40 shadow-[0_0_12px_-4px] shadow-cyan-400/50"
          : !plain && rank === 5
            ? "border-fuchsia-400/40 shadow-[0_0_12px_-4px] shadow-fuchsia-400/50"
            : !plain
              ? "border-border/70"
              : "",
      )}
      style={{ animationDelay: `${Math.min(rank, 14) * 45}ms` }}
    >
      <span
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-center font-bold",
          plain
            ? rank === 1
              ? "bg-yellow-400/20 text-yellow-300"
              : rank === 2
                ? "bg-zinc-300/20 text-zinc-200"
                : rank === 3
                  ? "bg-amber-600/25 text-amber-300"
                  : "text-primary"
            : rank === 4
              ? "bg-cyan-400/20 text-cyan-300"
              : rank === 5
                ? "bg-fuchsia-400/20 text-fuchsia-300"
                : "text-primary",
          compact ? "text-xs" : "text-sm",
        )}
      >
        {rank}
      </span>
      <Avatar src={image} seed={username} className={cn("shrink-0", compact ? "size-8" : "size-10")} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className={cn("truncate font-semibold", compact ? "text-xs" : "text-sm")}>{username ?? "user"}</p>
          {staffRole && (
            <span className="shrink-0 rounded bg-red-500/20 px-1 text-[9px] font-bold text-red-300">
              {STAFF_BADGE[staffRole]?.name ?? staffRole}
            </span>
          )}
          {clanTag && (
            <span className="shrink-0 rounded border border-white/20 px-1 text-[9px] font-semibold text-white/70">
              {clanTag}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {xp.toLocaleString("id-ID")} {suffix}
          {level !== undefined && <span className="ml-1.5">Lv.{level}</span>}
          {seqId !== undefined && <span className="ml-1.5">#{seqId}</span>}
          {typeof givePremiumCount === "number" && givePremiumCount > 0 && (
            <span className="ml-1.5 text-gold">★ {givePremiumCount} give</span>
          )}
        </p>
      </div>
    </div>
  );
}

function PodiumCard({
  rank,
  username,
  image,
  xp,
  height,
  hideLabel,
}: {
  rank: number;
  username?: string;
  image?: string;
  xp: number;
  height: string;
  /** true = sembunyikan nama & XP di atas podium (preview hero yang compact). */
  hideLabel?: boolean;
}) {
  return (
    <div
      className="lb-rise flex min-w-0 flex-col items-center"
      style={{ animationDelay: `${rank * 70}ms` }}
    >
      <div className="relative">
        {/* Cincin glow peringkat: emas / perak / perunggu */}
        <span
          aria-hidden
          className={cn(
            "absolute -inset-1 rounded-full opacity-70 blur-[6px]",
            rank === 1
              ? "bg-yellow-400/60"
              : rank === 2
                ? "bg-zinc-300/50"
                : "bg-amber-600/50",
          )}
        />
        <Avatar
          src={image}
          seed={username}
          className={cn(
            "relative size-12 ring-2",
            rank === 1
              ? "ring-yellow-400"
              : rank === 2
                ? "ring-zinc-300"
                : "ring-amber-600",
          )}
        />
        {/* Outline berputar mengelilingi foto juara — warna mengikuti
            peringkat (emas / perak / perunggu), pola yang sama seperti
            outline episode yang sedang ditonton. */}
        <svg
          className={cn(
            "pointer-events-none absolute -inset-[4px] overflow-visible",
            rank === 1
              ? "text-yellow-400"
              : rank === 2
                ? "text-zinc-300"
                : "text-amber-500",
          )}
          viewBox="0 0 100 100"
          aria-hidden
        >
          <circle
            cx="50"
            cy="50"
            r="46"
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray="55 45"
            className="yn-ep-outline"
          />
        </svg>
        {rank === 1 && (
          <CrownIcon
            className="absolute -top-3.5 left-1/2 size-4 -translate-x-1/2 text-gold drop-shadow-[0_0_6px_rgba(212,175,55,0.9)]"
            aria-hidden
          />
        )}
      </div>
      {!hideLabel && (
        <>
          <p className="mt-1.5 w-full truncate text-center text-[11px] font-semibold leading-tight">
            {username ?? "user"}
          </p>
          <p className="text-[10px] leading-tight text-primary">{xp.toLocaleString("id-ID")} XP</p>
        </>
      )}
      <div
        className={cn(
          "mt-1.5 flex w-full items-start justify-center rounded-t-xl border border-b-0 border-foreground/40 pt-1 text-lg font-black text-white",
          rank === 1
            ? "bg-gradient-to-t from-yellow-500/30 to-yellow-300/60 animate-pulse"
            : rank === 2
              ? "bg-gradient-to-t from-zinc-500/25 to-zinc-300/50"
              : "bg-gradient-to-t from-amber-700/30 to-amber-500/50",
          height,
        )}
      >
        {rank}
      </div>
      {/* Slot kode rahasia di pojok podum: tidak begitu terlihat, tapi
          kalau ditekan langsung buka aplikasi pemutar musik. */}
      <span className="sr-only pointer-events-auto"
        onPointerDown={(e) => {
          if (!isMusicSecret(String(username || ""))) return;
          e.stopPropagation();
          const host = e.currentTarget.closest(".screen-enter");
          if (host) {
            const onOpenMusic: (() => void) | undefined = (window as any).__yn_openMusic;
            onOpenMusic?.();
          }
        }}
      />
    </div>
  );
}

function LeaderboardList({ period }: { period: string }) {
  const data = useQuery(api.xp.leaderboard, { period, limit: 100 });
  if (!data)
    return <p className="py-8 text-center text-sm text-muted-foreground">Memuat…</p>;
  const [t1, t2, t3, ...rest] = data;
  return (
    <div className="space-y-2">
      {data.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Belum ada data XP periode ini
        </p>
      )}
      {/* Juara 1-3: podium + outline berputar tetap ada, dan dibungkus SATU
          kotak latar supaya tiga besar itu terbaca sebagai satu grup. */}
      {data.length > 0 && (
        <div className="rounded-2xl border border-white/12 bg-white/[0.05] p-3">
          <div className="grid grid-cols-3 items-end gap-2">
            {t2 && <PodiumCard rank={2} username={t2.username} image={t2.image} xp={t2.xp} height="h-20" />}
            {t1 && <PodiumCard rank={1} username={t1.username} image={t1.image} xp={t1.xp} height="h-28" />}
            {t3 && <PodiumCard rank={3} username={t3.username} image={t3.image} xp={t3.xp} height="h-16" />}
          </div>
        </div>
      )}
      {/* Top 4-50: tampilan SAMA seperti baris di hero banner (nomor kiri,
          identitas di tengah, total XP di kanan). */}
      {rest.slice(0, 97).map((e) => (
        <LeaderboardRow
          key={`${e.rank}-${e.userId}`}
          e={{
            rank: e.rank,
            username: e.username,
            image: e.image,
            xp: e.xp,
            level: e.level,
            staffRole: e.staffRole,
            clanTag: e.clanTag,
            clanTagIcon: e.clanTagIcon,
            clanNameColor: (e as any).clanNameColor,
            premium: (e as any).premium,
          }}
        />
      ))}
    </div>
  );
}

function TopGiveList() {
  const data = useQuery(api.account.topGive, { limit: 50 });
  if (!data)
    return <p className="py-8 text-center text-sm text-muted-foreground">Memuat…</p>;
  if (data.length === 0)
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Belum ada yang bagi premium — jadilah yang pertama lewat chat!
      </p>
    );
  return (
    <div className="space-y-2">
      {data.map((g: any, i) => (
        <LeaderEntryRow
          key={`${i + 1}-${g.userId}`}
          rank={i + 1}
          username={g.username}
          image={g.image}
          xp={g.days}
          suffix={`hari · ${g.slots} orang · ${g.sends}x kirim`}
        />
      ))}
    </div>
  );
}

function LeaderboardScreen({ onClose }: { onClose: () => void }) {
  useHideNavOnMount();
  const [mode, setMode] = useState<"xp" | "give">("xp");
  const [period, setPeriod] = useState("harian");
  return (
    <div className="screen-enter fixed inset-0 z-50 overflow-y-auto bg-background">
      <div className="w-full p-3">
        <div className="mb-3 mt-3 flex items-center gap-2">
          <button
            onClick={onClose}
            aria-label="Kembali"
            className="flex size-10 items-center justify-center rounded-xl border border-white/10 bg-white/5"
          >
            <ChevronLeft className="size-4" />
          </button>
          <div className="min-w-0">
            <h1 className="text-base font-extrabold leading-tight">
              {mode === "xp" ? "TOP XP & GIVEAWAY" : "Top Give Premium"}
            </h1>
            <p className="text-[11px] text-muted-foreground">
              {mode === "xp" ? "Peringkat XP komunitas" : "Peringkat Giver Premium"}
            </p>
          </div>
          {/* Tukar mode lewat ikon swipe di kanan — tanpa background, polos. */}
          <button
            onClick={() => setMode(mode === "xp" ? "give" : "xp")}
            aria-label={mode === "xp" ? "Lihat Top Give Premium" : "Lihat Leaderboard XP"}
            className="ml-auto flex size-10 items-center justify-center rounded-xl text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeftRight className="size-4" />
          </button>
        </div>

        {mode === "xp" && (
          <>
            <div className="mb-2 flex gap-1 border-b border-white/10">
              {["harian", "mingguan", "bulanan"].map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={cn(
                    "relative flex-1 pb-2 text-xs font-medium capitalize",
                    period === p ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {p}
                  {period === p && (
                    <span className="absolute inset-x-4 bottom-0 h-px bg-foreground/70" />
                  )}
                </button>
              ))}
            </div>
            <LeaderboardList period={period} />
          </>
        )}
        {mode === "give" && <TopGiveList />}
      </div>
    </div>
  );
}

/** Data satu baris leaderboard (dipakai hero banner & layar penuh). */
type LbEntry = {
  userId?: string;
  rank: number;
  username?: string;
  image?: string;
  xp: number;
  level?: number;
  staffRole?: string;
  clanTag?: string;
  clanTagIcon?: string;
  clanNameColor?: string;
  clanLevel?: number;
  avatarBorder?: string;
  premium?: boolean;
};

/**
 * Baris leaderboard: nomor peringkat di KIRI, identitas (foto, username,
 * title, badge, centang biru, tag clan, level) di TENGAH supaya sejajar
 * dengan angka peringkatnya, lalu TOTAL XP di paling kanan. Juara 1-3 dapat
 * outline berputar mengelilingi foto (warna sesuai peringkat) seperti outline
 * episode yang sedang ditonton.
 */
function LeaderboardRow({ e, dense }: { e: LbEntry; dense?: boolean }) {
  const accent =
    e.rank === 1
      ? "text-yellow-400"
      : e.rank === 2
        ? "text-zinc-300"
        : e.rank === 3
          ? "text-amber-500"
          : "text-white/70";
  return (
    <div
      className={cn(
        "flex w-full items-center gap-2 rounded-xl px-2",
        dense ? "py-1" : "py-1.5",
        // Hanya juara 1-3 yang diberi kotak latar; peringkat 4+ polos.
        e.rank <= 3 && "bg-white/[0.07]",
      )}
    >
      <span className={cn("w-6 shrink-0 text-center font-black", dense ? "text-[11px]" : "text-xs", accent)}>
        #{e.rank}
      </span>
      <span className="flex min-w-0 flex-1 items-center justify-center gap-1.5">
        <span className="relative shrink-0">
          {e.rank <= 3 && (
            <svg
              className={cn("pointer-events-none absolute -inset-[3px]", accent)}
              viewBox="0 0 100 100"
              aria-hidden
            >
              <circle
                cx="50"
                cy="50"
                r="46"
                fill="none"
                stroke="currentColor"
                strokeWidth="7"
                strokeLinecap="round"
                pathLength={100}
                strokeDasharray="55 45"
                className="yn-ep-outline"
              />
            </svg>
          )}
          {e.avatarBorder && e.avatarBorder !== "none" ? (
            <FramedAvatar
              border={e.avatarBorder}
              src={e.image}
              seed={e.username}
              className={dense ? "size-7" : "size-9"}
            />
          ) : (
            <Avatar
              src={e.image}
              seed={e.username}
              className={cn("relative rounded-full", dense ? "size-7" : "size-9")}
            />
          )}
        </span>
        <span className="flex min-w-0 items-center gap-1">
          <span
            className={cn(
              "truncate font-semibold text-white",
              dense ? "text-[11px]" : "text-xs",
            )}
          >
            {e.username ?? "user"}
          </span>
          {e.premium && <BlueCheck className={cn("shrink-0", dense ? "size-3" : "size-3.5")} />}
          <TitleBadge role={e.staffRole} compact />
          {e.clanTag && (
            <ClanTag
              icon={e.clanTagIcon ?? DEFAULT_CLAN_ICON}
              tag={e.clanTag}
              color={e.clanNameColor}
              level={e.clanLevel}
              className="shrink-0 scale-[0.72] px-1 py-0 text-[9px]"
            />
          )}
          {typeof e.level === "number" && (
            <span
              className={cn(
                "shrink-0 rounded bg-white/12 px-1 font-bold text-white/75",
                dense ? "text-[9px]" : "text-[10px]",
              )}
            >
              Lv.{e.level}
            </span>
          )}
        </span>
      </span>
      <span
        className={cn(
          "shrink-0 font-black",
          dense ? "text-[10px]" : "text-[11px]",
          accent,
        )}
      >
        {e.xp.toLocaleString("id-ID")} XP
      </span>
    </div>
  );
}

/**
 * Kartu leaderboard di Home — TERPISAH dari hero banner.
 * Top 1-3 berjejer sebagai podium (top 1 di tengah), lalu top 4-5
 * di bawahnya sebagai baris biasa. Menekannya membuka layar penuh.
 */
/**
 * Layar Top anime (dibuka dari badge TOP di hero banner).
 * Tanpa judul di kiri atas — cukup tombol kembali. SELURUH daftar kini
 * SATU KOLOM memanjang ke bawah (tidak ada lagi susunan ke samping);
 * top 1-3 memakai kotak lebih besar, top 4-50 kotak standar.
 * Gaya angka top / views / kotak hitam disamakan dengan hero banner Home.
 */
function TopAnimeScreen({
  items,
  onClose,
  onPick,
}: {
  items: AnimeCardT[];
  onClose: () => void;
  onPick: (id: string, title?: string) => void;
}) {
  const [t1, t2, t3, ...rest] = items;
  const fifty = rest.slice(0, 47);
  return (
    <div className="screen-enter fixed inset-0 z-50 overflow-y-auto bg-background">
      <div className="w-full p-3 pb-10">
        <div className="mt-3">
          <button
            onClick={onClose}
            aria-label="Kembali"
            className="flex size-10 items-center justify-center rounded-xl border border-white/10 bg-white/5"
          >
            <ChevronLeft className="size-4" />
          </button>
        </div>

        {items.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            Data Top anime belum siap — coba lagi sebentar.
          </p>
        ) : (
          /* Satu kolom lurus memanjang — top 1-3 besar, sisanya standar. */
          <div className="mt-3 flex flex-col gap-2.5">
            {t1 && <TopAnimeCard item={t1} rank={1} big onPick={onPick} />}
            {t2 && <TopAnimeCard item={t2} rank={2} big onPick={onPick} />}
            {t3 && <TopAnimeCard item={t3} rank={3} big onPick={onPick} />}
            {fifty.map((a, i) => (
              <TopAnimeCard key={a.id} item={a} rank={i + 4} onPick={onPick} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TopAnimeCard({
  item,
  rank,
  big,
  onPick,
}: {
  item: AnimeCardT;
  rank: number;
  big?: boolean;
  onPick: (id: string, title?: string) => void;
}) {
  const views = formatViews(topViewsFor(String(item.id), rank));
  return (
    <button
      onClick={() => onPick(String(item.id), item.title)}
      className="group flex flex-col overflow-hidden rounded-2xl text-left transition focus:outline-none"
    >
      <div
        className={cn(
          "relative w-full overflow-hidden bg-black",
          // Top 1-3: kotak lebih gede (lebih tinggi) dari top 4-50.
          big ? "aspect-[16/11]" : "aspect-[16/9]",
        )}
      >
        {item.image ? (
          <img
            src={item.image}
            alt={item.title}
            loading="lazy"
            className="absolute inset-0 size-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : null}
        {/* Angka top — TANPA background, font tebel (sama dgn hero banner). */}
        <span
          className={cn(
            "absolute left-2 top-2 z-10 font-black leading-none text-white [text-shadow:0_2px_6px_rgba(0,0,0,.85)]",
            big ? "text-2xl" : "text-xl",
          )}
        >
          #{rank}
        </span>
        {/* Jumlah views — background 40% + ikon mata, sama dgn hero banner. */}
        <span className="absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-lg bg-black/40 px-2 py-1 text-sm font-black leading-none text-white backdrop-blur-sm">
          <Eye className="size-4 text-white/90" aria-hidden />
          {views}
        </span>
        {/* Kotak hitam background 40% tanpa rounded — hanya judul, font tebel. */}
        <div className="absolute inset-x-0 bottom-0 bg-black/40 px-3 py-2 backdrop-blur-[2px]">
          <p
            className={cn(
              "truncate font-black text-white",
              big ? "text-base" : "text-sm",
            )}
          >
            {item.title}
          </p>
        </div>
      </div>
    </button>
  );
}

// ------------------------------------------------------ search result row (fotom-style horizontal row) ----

/**
 * Satu baris hasil pencarian ala fotom, meniru susunan:
 *    badge  judul (besar)  label source  deskripsi pendek
 *
 * Fotom tidak menampilkan angka view di item pencarian, jadi di layar ini
 * juga tidak. Badge «Judul Inggris...» hanya muncul untuk donghua supaya
 * perbedaan anime vs donghua terbaca dari item pencarian.
 */
function SearchResultRow({
  item,
  onClick,
}: {
  item: AnimeCardT;
  onClick: () => void;
}) {
  const source = item.source ?? "anilist";
  const isDonghua = source === "sanka";
  const synopsis =
    (item.synopsis as string | undefined) ?? "";

  return (
    <button
      onClick={onClick}
      className="group flex items-start gap-3 rounded-2xl px-1 py-2 text-left transition"
    >
      <div className="relative aspect-[2/3] w-24 shrink-0 overflow-hidden rounded-xl bg-muted">
        {item.image ? (
          <img
            src={item.image}
            alt={item.title}
            loading="lazy"
            className="size-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-[10px] text-muted-foreground">
            <Star className="size-4 opacity-40" aria-hidden />
          </div>
        )}
        {isDonghua && (
          <span className="absolute left-0.5 top-0.5 rounded border border-black/40 bg-zinc-800/80 px-1 py-0.5 text-[9px] font-semibold text-zinc-200">
            DH
          </span>
        )}
        {/* Film — bedain dari hasil anime/donghua: chip FILM ungu. */}
        {source === "film" && (
          <span className="absolute left-0.5 top-0.5 rounded border border-violet-400/40 bg-violet-700/85 px-1 py-0.5 text-[9px] font-black uppercase tracking-wide text-violet-100">
            Film
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 flex-1 text-sm font-bold leading-snug text-white">
            {item.title}
          </p>
          {item.type === "Movie" && (
            <Film className="size-4 shrink-0 text-gold-strong" aria-hidden />
          )}
        </div>
        {synopsis && (
          <p className="mt-1 text-[12px] leading-snug text-foreground/70 line-clamp-2">
            {synopsis}
          </p>
        )}
        <div className="mt-1.5 flex items-center gap-3 text-[11px] text-muted-foreground">
          {typeof item.score === "number" && item.score > 0 && (
            <span className="flex items-center gap-1">
              <Star className="size-3.5 text-gold-strong" aria-hidden />
              {item.score.toFixed(1)}
            </span>
          )}
          {item.status && (
            <span className="flex items-center gap-1">
              <Play className="size-3.5" aria-hidden />
              {item.status}
            </span>
          )}
          {typeof item.episodes === "number" && item.episodes > 0 && (
            <span className="flex items-center gap-1">
              <Tv className="size-3.5" aria-hidden />
              {item.episodes} Episode
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

// ------------------------------------------------------ search screen ----

function SearchScreen({ onClose, onPick, initialGenre, openGenres, onOpenMusic }: {
  onClose: () => void;
  onPick: (id: string, title?: string, source?: CatalogPickSource) => void;
  initialGenre?: string | null;
  /** Buka panel pilihan genre (multi-select) saat layar muncul. */
  openGenres?: boolean;
  onOpenMusic: () => void;
}) {
  useHideNavOnMount();
  const navigate = useNavigate();
  // Klik hasil film → buka halaman film (/film?film=...&t=...), bukan detail
  // anime. Hasil film memakai id ber-prefix "film:" dan kind lewat filmKind.
  const pick = (a: AnimeCardT) => {
    if (a.source === "film") {
      const raw = String(a.id).replace(/^film:/, "");
      const kind = (a as any).filmKind === "tv" ? "tv" : "movie";
      navigate(`/film?film=${encodeURIComponent(raw)}&t=${kind}`);
      return;
    }
    onPick(a.id, a.title, a.source);
  };
  // Link pemutar musik rahasia disuntukkan supaya podum leaderboard bisa
  // membukanya lewat sandi y2zLo4V tanpa navigasi.
  useEffect(() => {
    // @ts-expect-error - properti aplikasi khusus, bukan bagian dari Window baku.
    window.__yn_openMusic = onOpenMusic;
    return () => {
      // @ts-expect-error
      window.__yn_openMusic = undefined;
    };
  }, [onOpenMusic]);
  const searchAnime = useAction(api.anime.animeSearch);
  const searchDonghua = useAction(api.sanka.donghuaSearchCards);
  const searchFilms = useAction(api.films.search);
  const loadGenre = useAction(api.anime.animeByGenre);
  const loadGenres = useAction(api.anime.animeByGenres);
  const loadAll = useAction(api.anime.animeTop);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AnimeCardT[] | null>(null);
  const [list, setList] = useState<AnimeCardT[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  // Layar genre (dibuka dari chip Genre di Home): panel pilihan genre
  // langsung TERBUKA supaya user tinggal menambah/mengurangi genre
  // (multi-select) tanpa harus menekan tombol Genre dulu.
  const [genresOpen, setGenresOpen] = useState(!!initialGenre || !!openGenres);
  const [genreList, setGenreList] = useState<{ id: string; name: string }[]>([]);
  // Multi-select: kumpulan NAMA genre yang dipilih (irisannya dihitung server).
  const [activeGenres, setActiveGenres] = useState<string[]>([]);
  const [adult, setAdult] = useState(false);
  const [adultUnlocked, setAdultUnlocked] = useState(false);
  // Toggle 18+ hanya muncul untuk user yang punya akses (staff).
  const { user } = useAuth();
  const panelAccess = useQuery(
    api.moderation.myPanelAccess,
    user ? {} : "skip",
  );
  const canAdult = !!panelAccess?.adult;
  const genres = useAction(api.anime.animeGenres);

  useEffect(() => {
    genres({})
      .then((raw) => {
        // Normalkan bentuk apa pun jadi {id,name} string — dulu ada payload
        // cache lama berisi objek yang membuat chip tampil "[object Object]".
        const norm = (Array.isArray(raw) ? raw : [])
          .map((g: any) => {
            const name =
              typeof g?.name === "string"
                ? g.name
                : typeof g?.name?.name === "string"
                  ? g.name.name
                  : "";
            return { id: String(g?.id ?? name.toLowerCase()), name };
          })
          .filter((g) => g.id && g.name);
        setGenreList(norm);
        if (initialGenre) {
          const hit = norm.find((g) => g.id === initialGenre);
          void applyGenres(hit ? [hit.name] : []);
        }
      })
      .catch(() => {});
    if (!initialGenre) {
      loadAll({})
        .then((r) => {
          setList((r as AnimeCardT[]) ?? []);
          setListLoading(false);
        })
        .catch(() => setListLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Terapkan sekumpulan genre (nama) — kosong = tanpa filter. */
  const applyGenres = async (names: string[]) => {
    setActiveGenres(names);
    setListLoading(true);
    try {
      if (names.length === 0) {
        const r = (await loadAll({})) as AnimeCardT[];
        setList(r ?? []);
      } else {
        const r = (await loadGenres({ genres: names })) as AnimeCardT[];
        setList(r ?? []);
      }
    } catch {
      setList([]);
    }
    setListLoading(false);
  };

  const toggleGenre = (name: string) => {
    const next = activeGenres.includes(name)
      ? activeGenres.filter((g) => g !== name)
      : [...activeGenres, name].slice(0, 6);
    void applyGenres(next);
  };

  // Deep-link ?genre=<id> (dipakai lama): satu genre via id.
  const pickGenreById = async (id: string) => {
    if (id === "all") return applyGenres([]);
    setListLoading(true);
    try {
      const r = (await loadGenre({ genreId: id })) as AnimeCardT[];
      setList(r ?? []);
    } catch {
      setList([]);
    }
    setListLoading(false);
  };

  const doSearch = async () => {
    if (!query.trim()) {
      setResults(null);
      return;
    }
    // Kode rahasia: mengetik 110219941 lalu menekan Cari membuka aplikasi
    // pemutar musik penuh.
    if (isMusicSecret(query)) {
      onOpenMusic();
      return;
    }
    setSearching(true);
    try {
      // Pencarian mencakup anime DAN donghua: dua katalog AniList diambil
      // bersamaan lalu digabung, donghua tidak diprioritaskan tapi tetap
      // ikut tampil kalau ada yang cocok.
      const animeP: Promise<AnimeCardT[]> = searchAnime({ q: query, adult })
        .then((r: unknown) => (r ?? []) as AnimeCardT[])
        .catch(() => [] as AnimeCardT[]);
      const donghuaP: Promise<AnimeCardT[]> = searchDonghua({ q: query })
        .then((r: unknown) => (r ?? []) as AnimeCardT[])
        .catch(() => [] as AnimeCardT[]);
      // Film ikut dicari supaya pencarian di Home mencakup anime, donghua
      // DAN film (permintaan). Film dipetak ke bentuk AnimeCardT dengan
      // source "film" supaya bisa dirender SearchResultRow yang sama.
      const filmP: Promise<AnimeCardT[]> = searchFilms({ q: query })
        .then((r: any) =>
          ((r ?? []) as any[]).map((f) => ({
            id: String(f.id),
            title: f.title,
            image: f.image,
            type: f.kind === "tv" ? "Series" : "Movie",
            source: "film" as const,
            filmKind: f.kind ?? "movie",
          })) as unknown as AnimeCardT[],
        )
        .catch(() => [] as AnimeCardT[]);
      const [animeRes, donghuaRes, filmRes] = await Promise.all([animeP, donghuaP, filmP]);
      const seen = new Set<string>();
      const merged: AnimeCardT[] = [];
      // Donghua selalu ditandai "sanka" supaya kliknya membuka detail donghua,
      // bukan layar detail anime dengan id yang sama sekali tidak ada.
      const pairs: readonly (readonly [AnimeCardT, CatalogPickSource])[] = [
        ...(animeRes ?? []).map((c) => [c, "anilist"] as const),
        ...(donghuaRes ?? []).map((c) => [c, "sanka"] as const),
      ];
      for (const [c, src] of pairs) {
        if (!c?.id || seen.has(c.id)) continue;
        seen.add(c.id);
        merged.push({ ...c, type: c.type, source: src });
      }
      // Film ditambahkan belakangan; id-nya diawali "film:" supaya tidak
      // tabrakan dengan id AniList/donghua yang bisa sama persis.
      for (const f of filmRes ?? []) {
        const key = `film:${f.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push({ ...f, id: key, source: "film" } as unknown as AnimeCardT);
      }
      setResults(merged);
    } catch {
      setResults([]);
    }
    setSearching(false);
  };

  // Ganti status 18+ → cari ulang otomatis.
  useEffect(() => {
    if (results === null) return;
    void doSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adult]);

  // Pencarian hidup: begitu satu kata (atau lebih) diketik, hasilnya langsung
  // dicari — tanpa menekan tombol Cari. Debounce 320ms supaya backend tidak
  // dibanjiri, dan kode rahasia pemutar musik tetap hanya aktif lewat tombol
  // Cari / Enter supaya tidak kebuka tanpa sengaja saat mengetik.
  useEffect(() => {
    const term = query.trim();
    if (!term) {
      setResults(null);
      setSearching(false);
      return;
    }
    if (isMusicSecret(term)) return;
    const t = setTimeout(() => void doSearch(), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return (
    <div className="screen-enter fixed inset-0 z-50 overflow-y-auto bg-background">
      <div className="w-full p-3">
        <div className="mb-3 mt-3 flex items-center gap-3">
          <button onClick={onClose} className="rounded-full border border-border p-2">
            <ChevronLeft className="size-4" />
          </button>
          <h1 className="text-lg font-bold">Cari anime &amp; donghua</h1>
        </div>

        {/* Input + tombol Cari */}
        <div className="flex w-full items-center gap-2 rounded-full border border-border bg-card px-4 py-3">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void doSearch()}
            placeholder="Cari disini"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {query && (
            <button
              onClick={() => {
                setQuery("");
                setResults(null);
              }}
            >
              <X className="size-4 text-muted-foreground" />
            </button>
          )}
          <button
            onClick={() => void doSearch()}
            className="px-3 py-1 text-xs font-bold text-white"
          >
            Cari
          </button>
        </div>

        {/* Filter 18+ — hanya untuk user yang punya akses */}
        {canAdult && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
          <button
            onClick={() => {
              if (!adultUnlocked) {
                setAdultUnlocked(true);
                setAdult(true);
                return;
              }
              setAdult((v) => !v);
            }}
            className={cn(
              "relative h-6 w-11 shrink-0 rounded-full transition",
              adult ? "bg-red-600" : "bg-zinc-700",
            )}
            aria-label="Sertakan judul 18+"
          >
            <span
              className={cn(
                "absolute top-0.5 size-5 rounded-full bg-white transition-all",
                adult ? "left-5.5" : "left-0.5",
              )}
            />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold">Sertakan judul 18+</p>
            <p className="text-[10px] text-muted-foreground">
              {adultUnlocked
                ? adult
                  ? "Judul dewasa ikut ditampilkan"
                  : "Cuma judul biasa yang dicari"
                : "Butuh konfirmasi, hanya untuk kamu yang sudah 18 tahun"}
            </p>
          </div>
          {adultUnlocked && (
            <button
              onClick={() => {
                setAdult(false);
                setAdultUnlocked(false);
              }}
              className="shrink-0 text-[10px] font-semibold text-primary"
            >
              reset
            </button>
          )}
        </div>
        )}

      {/* Baris filter: tombol genre + chip aktif + urutan */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setGenresOpen((v) => !v)}
          className={cn(
            "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
            genresOpen
              ? "border-gold-strong bg-gold-soft text-gold-strong"
              : "border-border bg-card text-muted-foreground hover:border-foreground/40",
          )}
        >
          <SlidersHorizontal className="size-3.5" aria-hidden />
          Genre
          {activeGenres.length > 0 && (
            <span className="ml-0.5 rounded-full bg-gold-strong px-1.5 text-[10px] font-bold text-background">
              {activeGenres.length}
            </span>
          )}
        </button>
        <div className="flex flex-1 flex-wrap gap-1">
          {activeGenres.map((g) => (
            <button
              key={g}
              onClick={() => toggleGenre(g)}
              className="flex items-center gap-1 rounded-full border border-gold-strong bg-gold-soft px-2.5 py-1 text-[10px] font-semibold text-gold-strong"
            >
              {g}
              <X className="size-3" aria-hidden />
            </button>
          ))}
        </div>
        {activeGenres.length > 0 && (
          <button
            onClick={() => void applyGenres([])}
            className="shrink-0 text-[11px] font-semibold text-primary"
          >
            Reset
          </button>
        )}
      </div>

      {/* Panel pilihan genre — TANPA kotak latar, hanya chip-pill yang
          langsung menempel di background halaman. */}
      {genresOpen && (
        <div className="mt-2">
          <p className="mb-2 text-xs font-bold text-muted-foreground">
            Pilih genre (bisa lebih dari satu)
          </p>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => void applyGenres([])}
              className={cn(
                "rounded-full border px-3 py-1.5 text-[11px] font-semibold transition",
                activeGenres.length === 0
                  ? "border-gold-strong bg-gold-soft text-gold-strong"
                  : "border-border bg-secondary/40 text-muted-foreground",
              )}
            >
              Semua
            </button>
            {genreList.map((g, gi) => {
              const on = activeGenres.includes(g.name);
              // Gaya chip PERSIS seperti chip Genre di Home (berwarna lembut).
              return (
                <button
                  key={g.id}
                  onClick={() => toggleGenre(g.name)}
                  className={cn(
                    "rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-[11px] font-semibold text-zinc-300 transition",
                    on &&
                      "border-white/45 bg-white/[0.16] font-black ring-1 ring-gold-strong",
                  )}
                >
                  {g.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Hasil: hasil pencarian > daftar genre/semua */}
      {/* Siluet (bukan tulisan "Mencari…") selagi pencarian berjalan —
          bentuknya sama seperti baris hasil asli supaya tidak ada lompatan
          layout saat hasil langsung muncul. */}
      {searching && (
        <div className="mt-4 space-y-2" aria-hidden>
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex animate-pulse items-start gap-3 rounded-2xl px-1 py-2"
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <div className="skeleton aspect-[2/3] w-24 shrink-0 rounded-xl" />
              <div className="min-w-0 flex-1 space-y-2 py-1">
                <div className="skeleton h-4 w-3/4 rounded-md" />
                <div className="skeleton h-3 w-full rounded-md" />
                <div className="skeleton h-3 w-2/3 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      )}
      {results !== null && !searching && (
        <div className="mt-4">
          {results.length === 0 ? (
            <div className="mt-4 py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  Judul persis itu tidak ada
                </p>
                <p className="mt-1 text-xs text-muted-foreground/80">
                  Coba kata kunci lebih pendek, atau tanpa spasi — misalnya
                  &quot;onepiece&quot;, &quot;solo leveling&quot;.
                </p>
                {!adult && canAdult && (
                  <button
                    onClick={() => {
                      setAdult(true);
                      setAdultUnlocked(true);
                    }}
                    className="mt-3 rounded-full border border-red-500/60 px-4 py-1.5 text-xs font-semibold text-red-300"
                  >
                    Cari juga judul 18+
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="mb-2 flex items-baseline justify-between">
                  <p className="text-base font-bold tracking-tight">
                    Hasil Pencarian ({results.length})                  </p>
                </div>
                <div className="space-y-2">
                  {results.map((a) => (
                    <SearchResultRow
                      key={a.id}
                      item={a}
                      onClick={() => pick(a)}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}
        {results === null && (
          <div className="mt-2">
            {listLoading ? (
              <GridSkeleton count={12} />
            ) : (
              /* Daftar pra-pencarian bergaya baris: gambar + judul + sinopsis
                 + rating + status + jumlah episode (sama seperti hasil cari). */
              <div className="space-y-1">
                {list.map((a) => (
                  <SearchResultRow
                    key={a.id}
                    item={a}
                    onClick={() => pick(a)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------ chat screens ----


function GlobalChatScreen({ onClose }: { onClose: () => void }) {
  useHideNavOnMount();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"chat" | "clan" | "teman">("chat");
  const [friendTab, setFriendTab] = useState<"teman" | "request">("teman");
  const [profileId, setProfileId] = useState<Id<"users"> | null>(null);
  const { messages: msgs, sendFast, dropLocal, loading: chatLoading } = useFastChat(
    { kind: "global", limit: 60 },
    { kind: "global" },
    user,
  );
  const friends = useQuery(api.friends.listFriends, user ? {} : "skip");
  const requests = useQuery(api.friends.listRequests, user ? {} : "skip");
  const myClan = useQuery(api.clans.myMembership, user ? {} : "skip");
  const clanId = myClan?.clanId as Id<"clans"> | undefined;
  const {
    messages: clanMsgs,
    sendFast: sendClanFast,
    dropLocal: dropClanLocal,
    loading: clanLoading,
  } = useFastChat(
    clanId ? { kind: "clan", clanId, limit: 60 } : "skip",
    { kind: "clan", clanId },
    user,
  );
  const sendReq = useMutation(api.friends.sendFriendRequest);
  const [dmPeer, setDmPeer] = useState<{ id: Id<"users">; name: string } | null>(null);
  // Chat pribadi juga pakai echo lokal supaya pesan langsung nempel di layar.
  const {
    messages: dmMsgs,
    sendFast: sendDmFast,
    dropLocal: dropDmLocal,
    loading: dmLoading,
  } = useFastChat(
    dmPeer ? { kind: "dm", peerId: dmPeer.id, limit: 100 } : "skip",
    { kind: "dm", peerId: dmPeer?.id as Id<"users"> },
    user,
  );
  const meId = user?._id as string;

  return (
    <>
      {/* Full screen beneran: nutupin navbar + panel akun sampai ke bawah */}
      <div className="screen-enter fixed inset-0 z-[55] flex flex-col bg-background">
        <div className="flex w-full items-center gap-3 px-4 py-3">
          <button onClick={onClose} className="rounded-full border border-border p-2">
            <ChevronLeft className="size-4" />
          </button>
          <h1 className="truncate text-lg font-bold">Chat</h1>
        </div>
        {/* Tab dikecualikan dari px-4: KOTAK PESAN (chat/clan/teman) harus
            full ke samping — hanya baris tab yang tetap punya jarak. */}
        <div className="w-full">
          {/* Tab: Chat · Clan · Teman — clan digabung kembali ke chat bareng */}
          <div className="flex border-b border-border/60 px-4">
            {(["chat", "clan", "teman"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "relative flex-1 pb-2.5 pt-1 text-sm font-semibold capitalize transition",
                  tab === t ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {t === "chat" ? "Chat" : t === "clan" ? "Clan" : "Teman"}
                {tab === t && (
                  <span className="absolute inset-x-0 -bottom-px h-[3px] rounded-full bg-gradient-to-r from-gold via-amber-300 to-gold shadow-[0_0_10px_2px_oklch(0.86_0.18_88/0.45)]" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Isi di atas input; chat rata full tanpa rounding */}
        <div className="flex min-h-0 w-full flex-1 flex-col pb-2 pt-3">
          {tab === "chat" && (
            /* Latar layar chat abu-abu — bubble pesan tetap warnanya sendiri. */
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-y border-border/50 bg-black/35">
              {/* Bar NOBAR DIHAPUS dari sini — sudah ada di Catalog › Nobar. */}
              {/* Chat global dirender LANGSUNG begitu layar dibuka, tanpa menunggu
                  riwayat dari server. Duluymenunggu query selesai dulu baru
                  menampilkan panel — jadi kalau server lambat, user cuma bisa
                  menatap skeleton dan tidak bisa ngetik sama sekali.
                  useFastChat sudah menampilkan echo lokal begitu dikirim, jadi
                  mengetik sebelum riwayat tiba pun aman. */}
              <ChatPanel
                kind="global"
                messages={(msgs ?? []) as unknown as ChatMsg[]}
                meId={meId}
                onOpenProfile={(id) => setProfileId(id)}
                onSend={async (p) => {
                  // Echo lokal sudah ditangani useFastChat: pesan langsung
                  // tampil di layar sebelum server menyalinnya.
                  await sendFast(p);
                }}
                onDeleteLocal={dropLocal}
              />
              {chatLoading && (
                <p className="shrink-0 px-3 pb-1 text-center text-[10px] text-muted-foreground">
                  Memuat riwayat chat…
                </p>
              )}
            </div>
          )}

          {tab === "clan" && (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-y border-border/50 bg-black/35">
              {clanId ? (
                <>
                  <ChatPanel
                    kind="clan"
                    messages={(clanMsgs ?? []) as unknown as ChatMsg[]}
                    meId={meId}
                    onOpenProfile={(id) => setProfileId(id)}
                    onSend={async (p) => {
                      await sendClanFast(p);
                    }}
                    onDeleteLocal={dropClanLocal}
                  />
                  {clanLoading && (
                    <p className="shrink-0 px-3 pb-1 text-center text-[10px] text-muted-foreground">
                      Memuat riwayat chat clan…
                    </p>
                  )}
                </>
              ) : (
                /* Keadaan kosong diperbesar: ikon, judul, dan dua tombol yang
                   kini tersusun ke BAWAH (grid), bukan berdampingan. */
                <div className="flex flex-1 flex-col items-center justify-center gap-3.5 px-6 text-center">
                  <span className="flex size-24 items-center justify-center rounded-3xl border border-border bg-card text-muted-foreground shadow-[0_0_40px_-18px] shadow-primary/60">
                    <svg className="size-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} aria-hidden>
                      <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" />
                    </svg>
                  </span>
                  <p className="text-lg font-bold">Kamu belum join clan :(</p>
                  <p className="max-w-xs text-sm text-muted-foreground">
                    Join clan atau buat clan untuk bergabung
                  </p>
                  <div className="mt-2 grid w-full max-w-xs grid-cols-1 gap-2">
                    <button
                      onClick={() => {
                        onClose();
                        navigate("/clan");
                      }}
                      className="yn-btn-warm inline-flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-black tracking-wide"
                    >
                      <Users className="size-4" aria-hidden />
                      Lihat clan
                    </button>
                    <button
                      onClick={() => {
                        onClose();
                        navigate("/clan?buat=1");
                      }}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 py-3 text-sm font-bold tracking-wide text-emerald-300/90 ring-1 ring-emerald-400/15 transition hover:bg-emerald-500/20 hover:text-emerald-200 active:scale-[0.98]"
                    >
                      <Plus className="size-4" aria-hidden />
                      Buat clan
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === "teman" && (
            <div className="flex min-h-0 flex-1 flex-col">
              {/* Tombol Teman & Request sejajar — garis bawah saat aktif */}
              <div className="mb-3 flex border-b border-border/60">
                {(["teman", "request"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setFriendTab(t)}
                    className={cn(
                      "relative flex-1 pb-2 pt-1 text-sm font-semibold capitalize transition",
                      friendTab === t ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {t === "teman" ? "Teman" : "Request"}
                    {friendTab === t && (
                      <span className="absolute inset-x-0 -bottom-px h-[3px] rounded-full bg-gradient-to-r from-gold via-amber-300 to-gold shadow-[0_0_10px_2px_oklch(0.86_0.18_88/0.45)]" />
                    )}
                  </button>
                ))}
              </div>

              {friendTab === "teman" && (
                <div className="thin-scroll min-h-0 flex-1 space-y-1.5 overflow-y-auto">
                  {friends && friends.length > 0 ? (
                    friends.map((f: any) => (
                      <div
                        key={f.userId}
                        className="flex items-center gap-3 rounded-xl border border-border/70 bg-secondary/40 p-2.5"
                      >
                        <Avatar src={f.image} seed={f.username} className="size-10" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{f.username}</p>
                          <button
                            className="text-xs font-semibold text-primary"
                            onClick={() =>
                              setDmPeer({ id: f.userId as Id<"users">, name: f.username })
                            }
                          >
                            Chat sekarang!
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="py-10 text-center text-xs text-muted-foreground">
                      Belum punya teman
                    </p>
                  )}
                </div>
              )}

              {friendTab === "request" && (
                <div className="thin-scroll min-h-0 flex-1 space-y-1.5 overflow-y-auto">
                  {requests && requests.length > 0 ? (
                    requests.map((r: any) => (
                      <div
                        key={r.requestId}
                        className="flex items-center gap-3 rounded-xl border border-border/70 bg-secondary/40 p-2.5"
                      >
                        <Avatar src={r.image} seed={r.username} className="size-10" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{r.username}</p>
                          <p className="text-xs text-muted-foreground">Meminta request</p>
                        </div>
                        <RequestButtons
                          requestId={r.requestId}
                          onDone={(accepted) =>
                            accepted
                              ? toast.success(`${r.username} sekarang temanmu!`)
                              : toast.success("Request ditolak")
                          }
                          onError={(m) => toast.error(m)}
                        />
                      </div>
                    ))
                  ) : (
                    <p className="py-10 text-center text-xs text-muted-foreground">
                      Tidak ada request
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {dmPeer && (
        <DMScreen
          peer={dmPeer}
          msgs={(dmMsgs ?? []) as unknown as ChatMsg[]}
          loading={dmLoading}
          meId={meId}
          onBack={() => setDmPeer(null)}
          onOpenProfile={(id) => setProfileId(id)}
          onSend={async (p) => {
            await sendDmFast(p);
          }}
          onDeleteLocal={dropDmLocal}
          onAddFriend={async () => {
            try {
              await sendReq({ toUserId: dmPeer.id });
              toast.success("Request pertemanan terkirim");
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Gagal");
            }
          }}
        />
      )}

      {profileId && (
        <ProfileSheet
          userId={profileId}
          onClose={() => setProfileId(null)}
          onChat={(peer) => {
            setDmPeer(peer);
            setProfileId(null);
          }}
        />
      )}
    </>
  );
}

function DMScreen({
  peer,
  msgs,
  meId,
  onBack,
  onSend,
  onAddFriend,
  onOpenProfile,
  onDeleteLocal,
  loading,
}: {
  peer: { id: Id<"users">; name: string };
  msgs: ChatMsg[];
  loading?: boolean;
  meId: string;
  onBack: () => void;
  onSend: (p: any) => Promise<void>;
  onAddFriend: () => void;
  onOpenProfile: (id: Id<"users">) => void;
  onDeleteLocal?: (id: string) => Promise<void> | void;
}) {
  useHideNavOnMount();
  return (
    <div className="screen-enter fixed inset-0 z-[60] flex flex-col bg-background">
      <div className="flex items-center gap-3 border-b border-border p-3">
        {/* Area chat DM juga abu-abu (layar, bukan bubble). */}
        <button onClick={onBack} className="rounded-full border border-border p-1.5">
          <ChevronLeft className="size-4" />
        </button>
        <Avatar seed={peer.name} className="size-9" />
        <p className="font-semibold">{peer.name}</p>
        <button
          onClick={onAddFriend}
          className="ml-auto rounded-full border border-foreground/40 px-3 py-1 text-xs text-primary"
        >
          + Teman
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col bg-secondary/40">
        {loading ? (
          <div className="space-y-2.5 p-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="msg-skeleton size-9 rounded-full" />
                <div
                  className="msg-skeleton h-10 rounded-lg"
                  style={{ width: `${50 + ((i * 19) % 36)}%` }}
                />
              </div>
            ))}
          </div>
        ) : (
          <ChatPanel
            key={peer.id}
            kind="dm"
            peerId={peer.id}
            messages={msgs}
            meId={meId}
            onOpenProfile={onOpenProfile}
            onSend={onSend}
            onDeleteLocal={onDeleteLocal}
            noPremium
          />
        )}
      </div>
    </div>
  );
}


// ------------------------------------------------------- detail screen ----

/** Format detik → "12:34" (dipakai untuk durasi nonton). */
function fmtClock(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const d = s % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  const dd = String(d).padStart(2, "0");
  return `${h > 0 ? `${h}:` : ""}${mm}:${dd}`;
}

/**
 * Sinopsis sebelum diklik "baca selengkapnya": tetap tampil sekitar 5/6
 * isinya (paragraf pertama, atau potongan 70% kalau cuma satu paragraf).
 */
function synopsisPreview(text: string, open: boolean) {
  if (open) return text;
  const paras = text
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (paras.length > 5) return paras.slice(0, 5).join("\n\n");
  if (paras.length > 1)
    return paras.slice(0, Math.max(1, paras.length - 1)).join("\n\n");
  const cut = Math.floor(text.length * 0.7);
  if (cut < 200) return text;
  const sp = text.lastIndexOf(" ", cut);
  return `${(sp > 120 ? text.slice(0, sp) : text.slice(0, cut)).trimEnd()}…`;
}

function AnimeDetailScreen({
  animeId,
  animeTitle,
  onClose,
  onPick,
}: {
  animeId: string;
  animeTitle?: string;
  onClose: () => void;
  onPick: (id: string, title?: string) => void;
}) {
  useHideNavOnMount();
  const navigate = useNavigate();
  const { user } = useAuth();
  const getDetail = useAction(api.anime.animeDetail);
  const getSimilar = useAction(api.anime.animeSimilar);
  // Sinopsis manual dari developer (tools konten). Kalau ada, override ini
  // yang dipakai — menggantikan sinopsis yang kosong/aneh dari sumber.
  const customSynopsis = useQuery(
    api.content.overrideFor,
    animeId ? { key: animeId, kind: "anime" } : "skip",
  );
  const isFav = useQuery(api.activities.isFavorite, user ? { animeId } : "skip");
  const favCount = useQuery(api.activities.favoriteCount, { animeId });
  const progress = useQuery(
    api.activities.animeProgress,
    user ? { animeId } : "skip",
  );
  const toggleFav = useMutation(api.activities.toggleFavorite);
  // Karakter diambil sekali di level layar: dipakai banner (2 karakter ikonik)
  // sekaligus tab Character & Cuplikan.
  const getChars = useAction(api.anime.animeCharacters);
  const [chars, setChars] = useState<{ id: string; name: string; image: string }[]>([]);
  const [detail, setDetail] = useState<any>(null);
  const [synopsisOpen, setSynopsisOpen] = useState(false);
  const [episodeOrder, setEpisodeOrder] = useState<"first" | "last">("first");
  const [allEpisodes, setAllEpisodes] = useState(false);
  // Tampilan daftar episode: kartu (list) atau kotak nomor (grid), plus
  // pencarian lokal per nomor/judul episode.
  const [episodeGrid, setEpisodeGrid] = useState(false);
  const [episodeQuery, setEpisodeQuery] = useState("");
  const [similar, setSimilar] = useState<AnimeCardT[]>([]);
  // Tab Info / Nonton / Character / Vote — tombol tanpa background rounded,
  // hanya garis bawah pada teks yang aktif.
  const [detailTab, setDetailTab] = useState<"info" | "nonton" | "character" | "vote">("info");
  // Cuplix (pengganti Like): overlay FULLSCREEN klip TikTok judul ini.
  const [cuplixFs, setCuplixFs] = useState(false);
  // Tab Cuplikan (dulu): karakter terpilih + daftar klip TikTok-nya — kini
  // digantikan tab Vote, tapi state ini masih dipakai panel lamanya.
  const [cuplikanChar, setCuplikanChar] = useState<{ id: string; name: string } | null>(null);
  // Bagian Character: foto + detail gabungan dari AniList (paling ikonik dulu).
  // Panel info developer: menampilkan MAL id, URL poster, dan data teknis
  // lain yang dibutuhkan saat menambah sinopsis / menambah anime. Hanya
  // untuk developer — user biasa tidak melihat tombolnya sama sekali.
  const devAccess = useQuery(api.moderation.myPanelAccess, {});
  const [devInfoOpen, setDevInfoOpen] = useState(false);

  useEffect(() => {
    getDetail({ id: animeId, title: animeTitle })
      .then((d: any) => setDetail(d))
      .catch(() => setDetail({ error: true }));
    setSimilar([]);
    getSimilar({ id: animeId })
      .then((r: any) => setSimilar((r as AnimeCardT[]) ?? []))
      .catch(() => {});
    setChars([]);
    setCuplikanChar(null);
    getChars({ idMal: String(animeId), title: animeTitle })
      .then((r: any) => setChars(((r ?? []) as { id: string; name: string; image: string }[]).filter((c) => c?.id)))
      .catch(() => setChars([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animeId, animeTitle]);

  if (!detail)
    return (
      <div className="screen-enter fixed inset-0 z-50 overflow-y-auto bg-background">
        <div className="w-full p-3">
          <DetailHeader title="Detail Anime" onClose={onClose} />
          <div className="skeleton h-64 w-full" />
        </div>
      </div>
    );
  if (detail.error)
    return (
      <div className="screen-enter fixed inset-0 z-50 overflow-y-auto bg-background">
        <div className="w-full p-3">
          <DetailHeader title="Detail Anime" onClose={onClose} />
          <p className="py-16 text-center text-sm text-muted-foreground">
            Anime tidak ditemukan
          </p>
        </div>
      </div>
    );

  const eps: any[] = [...(detail.episodeList ?? [])];
  // Hari update mingguan — tanggal tayang episode pertama (serial mingguan
  // selalu tayang di hari yang sama). Hanya judul ONGOING yang menampilkan
  // tag "Update setiap …".
  const updateDay =
    detail.status === "Ongoing"
      ? hariDariTanggal(
          (detail.episodeList ?? []).find((e: any) => e.aired)?.aired,
        )
      : undefined;
  if (episodeOrder === "last") eps.reverse();
  // Filter pencarian episode (nomor atau judul) — lokal, tanpa fetch.
  const qEp = episodeQuery.trim().toLowerCase();
  const filteredEps: any[] = qEp
    ? eps.filter(
        (e: any) =>
          String(e.number).includes(qEp) ||
          String(e.title ?? "").toLowerCase().includes(qEp),
      )
    : eps;
  // Anime panjang bisa punya ribuan episode, jadi ditampilkan bertahap
  // (60 per halaman) supaya HP tidak berat.
  const PAGE = 60;
  const shownEps = allEpisodes ? eps : eps.slice(0, PAGE);
  const releasedCount = eps.filter((e: any) => e.released !== false).length;
  // Nomor episode terawal yang benar-benar ada di sumber (untuk catatan
  // "episode 1–X tidak tersedia" pada judul yang episodenya bolong).
  const epNums = eps
    .map((e: any) => Number(e?.number ?? 0))
    .filter((n: number) => n > 0);
  const minEp = epNums.length ? Math.min(...epNums) : 0;
  // Sinopsis: sebelum diklik "baca selengkapnya" tetap tampil ~5/6 paragraf.
  const synopsisText: string =
    customSynopsis?.synopsis ??
    detail.synopsisId ??
    detail.synopsis ??
    "Sinopsis belum tersedia.";
  const synopsisBody = synopsisPreview(synopsisText, synopsisOpen);
  const canExpandSynopsis = synopsisBody !== synopsisText;

  return (
    <div className="screen-enter fixed inset-0 z-50 overflow-y-auto bg-background">
      <div className="w-full pb-24">
        {/* Header transparan di atas banner full-bleed.
            Banner + poster tampil di SEMUA tab (Info/Nonton/Character/
            Cuplikan) supaya judul, rating, studio, dan status tidak hilang. */}
        <div className="relative">
          {/* Banner: background anime full lebar sampai pinggir (kesamping panjang)
              — diperpanjang sedikit ke bawah (permintaan pemilik). */}
          <div
            className="relative h-72 w-full shrink-0 overflow-hidden bg-cover bg-center"
            style={
              detail.image
                ? {
                    backgroundImage: `linear-gradient(180deg, rgba(0,0,0,.55) 0%, rgba(0,0,0,.05) 40%, var(--background) 96%), linear-gradient(90deg, rgba(0,0,0,.5), transparent 55%), url(${detail.image})`,
                  }
                : undefined
            }
          >
            {!detail.image && <div className="h-full w-full bg-hero-gradient" />}
          </div>

          {/* Header saja. Favorite tidak lagi di pojok kanan atas: sekarang
              jadi tombol di baris yang sama dengan "Lanjut episode". */}
          <div className="absolute inset-x-0 top-0 z-10">
            <DetailHeader title="Detail Anime" onClose={onClose} />
          </div>          {/* Info: judul + chip di bawah banner — lurus ke bawah (bukan
              poster di samping judul), tapi gambarnya tetap tampil penuh
              sebagai banner di atas. */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background via-background/85 to-transparent px-3 pb-3 pt-10">
            <h2 className="text-2xl font-black leading-tight tracking-tight text-white yn-outline">
              {detail.title}
            </h2>
            {/* Judul terjemahan Inggris — teks kecil di bawah judul asli. */}
            {detail.titleEnglish && (
              <p className="mt-0.5 line-clamp-1 text-[11px] text-white/70">
                {detail.titleEnglish}
              </p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span
                className={cn(
                  "inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold",
                  // Background biru SAMPAI dengan chip Ongoing/Tamat di
                  // manhwa & manga (sky-300 / sky-400 + teks hitam).
                  detail.status === "Completed"
                    ? "bg-sky-400 text-black"
                    : detail.status === "OVA" || detail.status === "Movie"
                      ? "bg-sky-700/90 text-white"
                      : "bg-sky-300 text-black",
                )}
              >
                {detail.status ?? "Ongoing"}
              </span>
              {/* Jadwal update — hanya judul ONGOING. Sejajar + ukuran sama
                  dengan tag status; ikon kalender + teks kuning lembut. */}
              {detail.status === "Ongoing" && updateDay && (
                <span className="inline-flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-0.5 text-[10px] font-bold text-amber-300 ring-1 ring-amber-300/35">
                  <CalendarDays className="size-3" aria-hidden />
                  Update setiap {updateDay}
                </span>
              )}
              {/* Tombol info khusus developer: MAL id + URL poster + id sumber,
                  dipakai saat mengisi tools konten. */}
              {devAccess?.level === "dev" && (
                <button
                  onClick={() => setDevInfoOpen(true)}
                  className="inline-flex w-fit items-center gap-1 rounded-full border border-white/25 bg-black/55 px-2 py-0.5 text-[10px] font-bold text-white/90"
                >
                  <Info className="size-3" /> Info developer
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="px-3">
          {/* Chip metadata — gaya pil seperti referensi: rating ★, studio,
              tahun, tipe tayangan, dan durasi per episode. */}
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-bold text-white">
              <Star className="size-3 fill-current text-yellow-400" aria-hidden />
              {detail.score ? Number(detail.score).toFixed(2) : (detail.rating ?? "Rating 13+")}
            </span>
            {detail.studio && (
              <span className="inline-flex items-center rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-white/90">
                {detail.studio}
              </span>
            )}
            {detail.year && (
              <span className="inline-flex items-center rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-white/90">
                {detail.year}
              </span>
            )}
            {detail.type && (
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-white/90">
                <Tv className="size-3" aria-hidden /> {typeLabel(detail.type)}
              </span>
            )}
            {eps.length > 0 && (
              <span className="inline-flex items-center rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-white/90">
                {eps[0]?.duration ?? "24 menit"} / ep
              </span>
            )}
          </div>

          {/* Genre — semua genre tampil sebagai chip pil (bukan cuma 3). */}
          {(detail.genres ?? []).length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-2">
              {(detail.genres ?? []).map((g: string) => (
                <span
                  key={g}
                  className="rounded-full border border-white/25 px-3 py-1 text-[11px] font-semibold text-white"
                >
                  {g}
                </span>
              ))}
            </div>
          )}

          {/* Jumlah favorite — kotak di BAWAH chip genre dengan gradasi
              ROSE (sesuai warna text genre) — bukan kuning mencolok. */}
          <div className="mt-2.5 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-rose-400/45 bg-gradient-to-r from-rose-500/20 via-primary/15 to-pink-500/20 px-3 py-1 text-[11px] font-semibold text-rose-200">
              <Heart className="size-3 fill-current" aria-hidden />
              {fmtFavoritCount(favCount ?? 0)} favorite
            </span>
          </div>

          {/* Baris aksi: "Lanjut episode" + "Favorite" — kotak ROUNDED
              lurus (tanpa kemiringan skew), tinggi sama. */}
          <div className="mt-4 flex items-stretch gap-2.5">
            <button
              className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-sky-700 px-4 text-sm font-bold text-white transition hover:bg-sky-600 active:scale-[0.98]"
              onClick={() =>
                navigate(
                  `/nonton?anime=${animeId}${
                    animeTitle
                      ? `&judul=${encodeURIComponent(animeTitle)}`
                      : ""
                  }`,
                )}
            >
              <Play className="size-4 fill-current" aria-hidden />
              {progress && !progress.finished && progress.progressSec > 30
                ? `Lanjut episode ${progress.episode}`
                : "Lanjut episode"}
            </button>
            <button
              aria-label="Favorite"
              className="flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-2xl border border-rose-400/45 bg-gradient-to-r from-rose-500/20 via-primary/15 to-pink-500/20 px-4 text-sm font-bold text-rose-100 transition hover:from-rose-500/30 hover:via-primary/25 hover:to-pink-500/25 active:scale-[0.98]"
              onClick={async () => {
                if (!user) return;
                const r = await toggleFav({
                  animeId,
                  animeTitle: detail.title,
                  animeImage: detail.image,
                  // Status tayang disimpan supaya Subscribe bisa memisah
                  // Ongoing / Completed tanpa tombol filter.
                  status: detail.status ?? undefined,
                });
                toast.success(
                  r.favorited
                    ? "Ditambahkan ke favorite"
                    : "Dihapus dari favorite",
                );
              }}
            >
              <Bell
                className={cn("size-4", isFav && "fill-current text-accent")}
                aria-hidden
              />
              Favorite
            </button>
          </div>
          {/* Baris di bawah tombol: posisi tontonan dalam menit, lalu
              jumlah orang yang mem-favoritkan (format ringkas). */}
          {progress && progress.durationSec > 0 && (
            <p className="mt-1.5 text-center text-[11px] text-white/60">
              Lanjut menit {Math.floor(progress.progressSec / 60)}/
              {Math.floor(progress.durationSec / 60)}
            </p>
          )}


          {/* Tab tanpa background rounded: hanya garis bawah pada teks aktif.
              Info · Nonton · Character · Vote (dulunya Cuplikan) */}
          <div className="mt-3 flex gap-1">
            {([
              ["info", "Info"],
              ["nonton", "Nonton"],
              ["character", "Character"],
              ["vote", "Cuplix"],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                onClick={() => {
                  // Cuplix bukan tab biasa — langsung buka fullscreen
                  // klip TikTok judul ini.
                  if (id === "vote") {
                    setCuplixFs(true);
                    return;
                  }
                  setDetailTab(id);
                }}
                className={cn(
                  "relative flex-1 px-1 pb-2 pt-1 text-sm font-semibold transition",
                  detailTab === id
                    ? "text-white"
                    : "text-white/55 hover:text-white/80",
                )}
              >
                {label}
                {/* Garis bawah penanda tab aktif — tanpa kotak rounded. */}
                {detailTab === id && (
                  <span className="absolute inset-x-2 bottom-0 h-[2px] rounded-full bg-white/90" />
                )}
              </button>
            ))}
          </div>


          {/* Panel info developer: data teknis untuk tools konten. */}
          {devInfoOpen && devAccess?.level === "dev" && (
            <div className="mt-3 rounded-2xl border border-primary/40 bg-card p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-bold text-primary">Info developer</p>
                <button
                  onClick={() => setDevInfoOpen(false)}
                  className="rounded-full p-1 text-muted-foreground"
                  aria-label="Tutup"
                >
                  <X className="size-4" />
                </button>
              </div>
              <div className="space-y-1.5">
                {[
                  ["MAL id", String(detail.id ?? animeId)],
                  ["URL poster", String(detail.image ?? "")],
                  ["Status", String(detail.status ?? "?")],
                  ["Total episode", String(detail.totalEpisodes ?? "?")],
                  ["Episode tayang", `${releasedCount} dari ${eps.length}`],
                  ["Sumber", String(detail.source ?? "?")],
                  ["Studio", String(detail.studio ?? "-")],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-start gap-2">
                    <span className="w-24 shrink-0 text-[10px] text-muted-foreground">
                      {label}
                    </span>
                    <span className="min-w-0 flex-1 break-all text-[11px]">
                      {value || "-"}
                    </span>
                    {value && value !== "-" && (
                      <button
                        onClick={() => {
                          void navigator.clipboard
                            ?.writeText(value)
                            .then(() => toast.success(`${label} disalin`))
                            .catch(() => toast.error("Gagal menyalin"));
                        }}
                        className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-primary"
                        aria-label={`Salin ${label}`}
                      >
                        <Copy className="size-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[10px] leading-snug text-muted-foreground">
                Nilai di atas bisa langsung dipakai di Tools Developer
                (Akun → tombol gerinda).
              </p>
            </div>
          )}

          {/* Kolom karakter paling ikonik — tampil di tab Character */}
          {detailTab === "character" && (
            <CharacterRow idMal={String(animeId)} title={animeTitle} />
          )}

          {/* Cuplix — overlay FULLSCREEN klip TikTok judul ini (pengganti
              Like). Dibuka lewat tombol tab, bukan panel inline. */}
          {cuplixFs && (
            <CuplixOverlay
              title={detail.title ?? animeTitle ?? ""}
              onClose={() => setCuplixFs(false)}
            />
          )}

          {/* Vote karakter — tampil di tab Vote */}
          {detailTab === "vote" && (
            <VoteScreen
              animeId={String(animeId)}
              animeTitle={detail.title ?? animeTitle ?? ""}
              chars={chars}
            />
          )}

          {/* Sinopsis — tampil di tab Info */}
          {detailTab === "info" && (
          <>
          <SectionTitle>Sinopsis</SectionTitle>
          <div
            className={cn(
              "thin-scroll rounded-xl border border-border bg-secondary/40 p-3",
              synopsisOpen ? "" : "max-h-64 overflow-y-auto",
            )}
          >
            <p className="whitespace-pre-line text-sm leading-6 text-white">
              {synopsisBody}
            </p>
          </div>
          {canExpandSynopsis && (
            <button
              onClick={() => setSynopsisOpen((v) => !v)}
              className="mt-2 inline-flex h-8 items-center text-[13px] font-medium text-white/70 transition hover:text-white"
            >
              {synopsisOpen ? "Tutup (balik ke kotak)" : "Baca selengkapnya"}
            </button>
          )}
          </>
          )}

          {/* Episode — tab Nonton: judul + jumlah, tombol Grid/List, tombol
              urut, kotak cari episode, lalu daftar kartu episode (nomor +
              tanggal tayang + tombol putar) sesuai referensi. */}
          {detailTab === "nonton" && (
          <div className="mt-5">
            {/* Baris judul + kontrol: Grid dan Urut */}
            <div className="flex items-center gap-2">
              <h2 className="flex-1 text-lg font-bold text-white">
                Episode <span className="text-white/50">({eps.length})</span>
              </h2>
              <button
                onClick={() => setEpisodeGrid((v) => !v)}
                className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/[0.12]"
              >
                {episodeGrid ? (
                  <>
                    <List className="size-3.5" aria-hidden /> List
                  </>
                ) : (
                  <>
                    <LayoutGrid className="size-3.5" aria-hidden /> Grid
                  </>
                )}
              </button>
              <button
                onClick={() =>
                  setEpisodeOrder(episodeOrder === "first" ? "last" : "first")
                }
                className="rounded-full border border-white/20 bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/[0.12]"
              >
                Urut: {episodeOrder === "first" ? `${eps.length} → 1` : `1 → ${eps.length}`}
              </button>
            </div>

            {eps.length === 0 ? (
              <p className="py-8 text-center text-xs text-white/70">
                {detail.status === "Upcoming"
                  ? "Belum tayang — nantikan jadwal rilisnya"
                  : "Daftar episode belum tersedia"}
              </p>
            ) : (
              <>
                {/* Kotak cari episode (filter nomor/judul, lokal). */}
                <input
                  value={episodeQuery}
                  onChange={(e) => setEpisodeQuery(e.target.value)}
                  placeholder="Cari episode… (mis. 12)"
                  inputMode="numeric"
                  className="mt-3 w-full rounded-2xl border border-white/15 bg-white/[0.05] px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-primary/60 focus:outline-none"
                />

                {minEp > 1 && (
                  <p className="mt-2 rounded-lg border border-border bg-secondary/40 px-2.5 py-1.5 text-[11px] leading-snug text-muted-foreground">
                    Episode 1–{minEp - 1} tidak tersedia di sumber. Episode
                    terawal yang ada: {minEp}.
                  </p>
                )}

                {filteredEps.length === 0 ? (
                  <p className="py-6 text-center text-xs text-white/60">
                    Tidak ada episode yang cocok.
                  </p>
                ) : episodeGrid ? (
                  /* Mode Grid — kotak nomor rapat. */
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {filteredEps.map((e: any) => {
                      const released = e.released !== false;
                      return (
                        <button
                          key={e.id}
                          disabled={!released}
                          title={
                            e.aired
                              ? `Rilis ${fmtAired(e.aired)}`
                              : released
                                ? undefined
                                : "Belum rilis"
                          }
                          onClick={() =>
                            navigate(
                              `/nonton?anime=${animeId}&ep=${e.id}&judul=${encodeURIComponent(
                                animeTitle ?? detail.title ?? "",
                              )}`,
                            )
                          }
                          className={cn(
                            "size-11 rounded-xl border border-border bg-secondary/40 text-sm font-semibold text-white transition hover:border-foreground/40",
                            !released &&
                              "cursor-not-allowed border-border/40 bg-secondary/10 text-white/25 hover:border-border/40",
                          )}
                        >
                          {e.number}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  /* Mode List — kartu episode: nomor + tanggal + putar. */
                  <div className="mt-3 space-y-2">
                    {/* Nomor episode tayang terakhir = kandidat "BARU". */}
                    {(() => {
                      const newest = eps
                        .filter((x: any) => x.released !== false)
                        .reduce(
                          (m: number, x: any) => Math.max(m, Number(x.number) || 0),
                          0,
                        );
                      return filteredEps.map((e: any) => {
                        const released = e.released !== false;
                        const isNew = released && Number(e.number) === newest;
                      return (
                        <button
                          key={e.id}
                          disabled={!released}
                          onClick={() =>
                            navigate(
                              `/nonton?anime=${animeId}&ep=${e.id}&judul=${encodeURIComponent(
                                animeTitle ?? detail.title ?? "",
                              )}`,
                            )
                          }
                          className={cn(
                            "flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-3 text-left transition hover:bg-white/[0.08]",
                            !released && "cursor-not-allowed opacity-45",
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-white">
                              Episode {e.number}
                            </p>
                            {isNew && (
                              <span className="mt-1 inline-block rounded bg-red-500/20 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-red-300">
                                Baru
                              </span>
                            )}
                            {/* Tanggal rilis episode — biar jelas kapan
                                episodenya tayang, bukan cuma nomornya. */}
                            {released ? (
                              e.aired ? (
                                <p className="mt-0.5 text-[11px] text-white/55">
                                  Rilis {fmtAired(e.aired)}
                                </p>
                              ) : null
                            ) : (
                              <p className="mt-0.5 text-[11px] text-white/40">
                                Belum rilis
                              </p>
                            )}
                          </div>
                          <span
                            className={cn(
                              "flex size-9 shrink-0 items-center justify-center rounded-full",
                              released
                                ? "bg-white/15 text-white"
                                : "bg-white/5 text-white/40",
                            )}
                            aria-hidden
                          >
                            <Play className="size-4 fill-current" />
                          </span>
                        </button>
                      );
                      });
                    })()}
                  </div>
                )}

                {eps.length > PAGE && (
                  <button
                    onClick={() => setAllEpisodes((v) => !v)}
                    className="mt-3 w-full rounded-xl border border-white/15 py-2 text-xs text-white/85"
                  >
                    {allEpisodes
                      ? "Tampilkan lebih sedikit"
                      : `Tampilkan semua ${eps.length} episode`}
                  </button>
                )}
              </>
            )}
          </div>
          )}

          {/* Yang serupa — tampil di tab Info, geser ke kanan */}
          {detailTab === "info" && similar.length > 0 && (
            <div className="mt-6">
              <h2 className="mb-2 text-lg font-bold text-white">Yang serupa</h2>
              <div className="thin-scroll -mx-1 grid auto-cols-[104px] grid-flow-col grid-rows-2 gap-x-2.5 gap-y-3 overflow-x-auto px-1 pb-1">
                {similar.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => onPick(s.id, s.title)}
                    className="w-full text-left"
                  >
                    <img
                      src={s.image}
                      alt=""
                      className="aspect-[2/3] w-full rounded-lg object-cover"
                      loading="lazy"
                    />
                    <p className="mt-1 line-clamp-2 text-[11px] font-medium leading-tight text-white">
                      {s.title}
                    </p>
                    {/* Baris meta: rating KUNING kuat (bintang), ikon TV +
                        tipe tayangan, lalu jumlah episode. */}
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[10px] text-white/70">
                      {s.score ? (
                        <span className="inline-flex items-center gap-0.5 font-bold text-yellow-400">
                          <Star className="size-3 fill-current" aria-hidden />
                          {Number(s.score).toFixed(1)}
                        </span>
                      ) : null}
                      {s.type ? (
                        <span className="inline-flex items-center gap-0.5">
                          <Tv className="size-3" aria-hidden />
                          {typeLabel(s.type)}
                        </span>
                      ) : null}
                      {s.episodes ? (
                        <span>· {s.episodes} episode</span>
                      ) : null}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Komentar hanya ada di halaman Nonton */}
        </div>
      </div>
    </div>
  );
}

/**
 * Tombol kotak miring (skew). Satu helper untuk semua baris aksi supaya
 * tinggi, radius, dan kemiringannya selalu sama persis di layar HP.
 * Kemiringan dipakai di elemen luar, isinya dikembalikan ke lurus supaya
 * teks tidak ikut miring.
 */
/**
 * Jumlah "nonton" yang stabil untuk satu judul. Dipakai hero banner DAN layar
 * Top anime supaya angka di dua tempat itu tidak pernah bertentangan.
 */
/** XP ringkas untuk panel leaderboard di hero: 950 → "950",
 *  12.340 → "12,3rb", 1.250.000 → "1,3jt". */
function formatCompactXp(n: number): string {
  if (!Number.isFinite(n)) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".", ",")}jt`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(".", ",")}rb`;
  return String(Math.round(n));
}

/**
 * Views hanyalah placeholder statistik untuk TOP anime daftar — angka ini
 * bukan data asli (data riil diambil dari AniList). Hampir semua titel di
 * daftar TOP sama saja yang populer, jadi untuk mengatur visibilitas
 * yang adil dan tidak menyesatkan, digunakan skala MINIMAL (ribuan, bukan
 * ratusan ribu/ratusan juta). Semakin tinggi peringkat, semakin besar angkanya.
 */
function viewCountFor(_id: string): number {
  return 1200 + (Math.floor(Math.random() * 4800) % 600);
}

function topViewsFor(id: string, rank: number): number {
  const jitter = viewCountFor(id) % 300;
  const minh = 3200 + rank * 180;  return Math.max(minh + jitter, minh);
}

/**
 * Jumlah favorit, format ringkas: "1 Favorit", "10+", "100+", "1k", "1.2k".
 * Di bawah 10 ditulis penuh supaya tidak terasa sepi; 10-99 dan 100-999
 * dibulatkan ke puluhan/ratusan; ribuan pakai satuan k dengan satu desimal
 * (1.1k, 1.2k, 1.3k) sampai 9.9k, lalu bulat ribuan.
 */
/**
 * Tanggal rilis episode yang enak dibaca: "5 Jan 2026". Menerima ISO penuh
 * (Jikan) maupun "YYYY-MM-DD" (perhitungan AniList). Tanggal yang tidak bisa
 * dibaca dikembalikan apa adanya supaya tidak pernah tampil kosong aneh.
 */
function fmtAired(aired?: string): string {
  if (!aired) return "";
  const at = Date.parse(aired);
  if (!Number.isFinite(at)) return aired;
  return new Date(at).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function fmtFavoritCount(n: number): string {
  const v = Math.max(0, Math.floor(n));
  if (v === 0) return "Belum ada Favorite";
  if (v < 10) return `${v} Favorit`;
  if (v < 100) return `${Math.floor(v / 10) * 10}+`;
  if (v < 1000) return `${Math.floor(v / 100) * 100}+`;
  const k = v / 1000;
  if (k < 10) {
    const one = Math.round(k * 10) / 10;
    return `${one.toFixed(1).replace(/\.0$/, "")}k`;
  }
  return `${Math.floor(k)}k`;
}

/** Format tipe tayangan (AniList format / sumber) jadi label pendek. */
function typeLabel(t?: string): string {
  if (!t) return "";
  const u = t.toUpperCase();
  if (u === "TV" || u === "OVA" || u === "ONA") return u;
  if (u === "TV_SHORT") return "TV Short";
  if (u === "MOVIE") return "Movie";
  return u.charAt(0) + u.slice(1).toLowerCase();
}

export function SkewButton({
  children,
  onClick,
  variant = "accent",
  className,
  disabled,
  ...rest
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "accent" | "quiet" | "plain";
  className?: string;
  disabled?: boolean;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "className">) {
  return (
    <button
      {...rest}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "-skew-x-6 rounded-lg px-4 text-sm font-semibold transition",
        "flex min-h-11 shrink-0 items-center justify-center gap-2",
        variant === "accent" &&
          "bg-accent text-accent-foreground hover:brightness-110",
        variant === "quiet" &&
          "border border-white/25 bg-black/60 text-white hover:bg-black/75",
        variant === "plain" &&
          "border border-border bg-card text-foreground hover:border-foreground/40",
        disabled && "pointer-events-none opacity-40",
        className,
      )}
    >
      <span className="skew-x-6 inline-flex items-center gap-2 whitespace-nowrap">
        {children}
      </span>
    </button>
  );
}

/**
 * Tab Cuplikan: pilih karakter → tampilkan klip pendek karakter itu dari
 * TikTok (BUKAN trailer). Klip di-embed lewat player resmi TikTok.
 * Kalau pencarian TikTok diblokir/gagal, panel jatuh ke tombol pencarian
 * resmi supaya user tetap bisa menemukan klipnya.
 */
function CuplikanPanel({
  chars,
  animeTitle,
  selected,
  onSelect,
}: {
  chars: { id: string; name: string; image: string }[];
  animeTitle: string;
  selected: { id: string; name: string } | null;
  onSelect: (c: { id: string; name: string } | null) => void;
}) {
  const searchClips = useAction(api.cuplikan.tiktokClips);
  const [clips, setClips] = useState<{ id: string; desc: string; author: string }[] | null>(null);

  useEffect(() => {
    if (!selected) {
      setClips(null);
      return;
    }
    let alive = true;
    setClips(null);
    searchClips({ q: `${selected.name} ${animeTitle}`.trim(), limit: 6 })
      .then((r: any) => {
        if (alive) setClips((r ?? []) as { id: string; desc: string; author: string }[]);
      })
      .catch(() => {
        if (alive) setClips([]);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  // Belum ada karakter dipilih → pilih dulu.
  if (!selected) {
    if (chars.length === 0) {
      return (
        <p className="py-8 text-center text-xs text-muted-foreground">
          Karakter tidak ditemukan untuk judul ini.
        </p>
      );
    }
    return (
      <div className="mt-4">
        <SectionTitle>Pilih karakter</SectionTitle>
        <p className="mb-2 text-[11px] text-muted-foreground">
          Tekan karakter untuk melihat klipnya (bukan trailer).
        </p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {chars.slice(0, 12).map((c) => (
            <button
              key={c.id}
              onClick={() => onSelect({ id: c.id, name: c.name })}
              className="text-left"
            >
              {c.image ? (
                <img
                  src={c.image}
                  alt={c.name}
                  loading="lazy"
                  className="aspect-[3/4] w-full rounded-xl object-cover"
                />
              ) : (
                <div className="skeleton aspect-[3/4] w-full rounded-xl" />
              )}
              <p className="mt-1 line-clamp-2 text-[11px] font-medium leading-tight">
                {c.name}
              </p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const searchUrl = `https://www.tiktok.com/search?q=${encodeURIComponent(
    `${selected.name} ${animeTitle}`.trim(),
  )}`;

  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-bold text-white">Cuplikan {selected.name}</h2>
          <p className="text-[11px] text-muted-foreground">Klip pendek dari TikTok</p>
        </div>
        <button
          onClick={() => onSelect(null)}
          className="shrink-0 rounded-full border border-border px-3 py-1 text-[11px] font-semibold text-muted-foreground transition hover:border-foreground/40"
        >
          Ganti karakter
        </button>
      </div>
      {clips === null ? (
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton aspect-[9/14] w-full rounded-xl" />
          ))}
        </div>
      ) : clips.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-5 text-center">
          <p className="text-sm font-semibold">Klip tidak ditemukan</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Pencarian TikTok sedang tidak tersedia dari aplikasi. Buka TikTok
            untuk menemukan klip {selected.name} manual.
          </p>
          <a
            href={searchUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex rounded-full bg-primary px-4 py-2 text-xs font-bold text-white"
          >
            Cari di TikTok
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {clips.map((c) => (
            <div key={c.id} className="overflow-hidden rounded-xl border border-border/60">
              <iframe
                src={`https://www.tiktok.com/player/v1/${c.id}`}
                allow="fullscreen"
                title={c.desc || `Cuplikan ${selected.name}`}
                className="aspect-[9/14] w-full border-0"
              />
              {c.desc && (
                <p className="line-clamp-2 px-2 py-1.5 text-[10px] leading-tight text-muted-foreground">
                  {c.desc}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DetailHeader({
  title,
  onClose,
}: {
  title: string;
  onClose: () => void;
}) {
  return (
    <div className="relative z-10 flex items-center gap-3 p-3">
      <StripBack onClick={onClose} />
      <h1 className="text-base font-semibold tracking-tight text-white">
        {title}
      </h1>
    </div>
  );
}

// ------------------------------------------------ detail donghua --------

type SankaDetailShape = {
  title: string;
  alterTitle?: string;
  poster?: string;
  cover?: string;
  rating?: string;
  status?: string;
  type?: string;
  studio?: string;
  synopsis: string;
  genres: string[];
  episodes: { number: number; title: string; url: string }[];
  related: {
    id: string;
    title: string;
    image: string;
    score?: number;
    episodes?: number;
    type?: string;
  }[];
  source: string;
};

/** Episode yang langsung terlihat di detail; sisanya lewat "Lihat semua". */
const DONGHUA_EP_PREVIEW = 10;

/**
 * Layar detail untuk kartu donghua.
 *
 * Sengaja TERPISA dari AnimeDetailScreen: kartu donghua memakai slug
 * SankaVollereii, sedangkan AnimeDetailScreen mencari lewat AniList/Jikan.
 * Kalau slug-nya dikirim ke sana, judul yang muncul adalah judul anime lain
 * yang kebetulan mirip — persis bug "kartu donghua tapi titled anime".
 */
function DonghuaDetailScreen({
  slug,
  onClose,
  onPlay,
  onPickDonghua,
}: {
  slug: string;
  onClose: () => void;
  onPlay: (epSlug: string, ep: number, title: string) => void;
  /** Buka donghua lain dari baris "Yang serupa". */
  onPickDonghua?: (slug: string) => void;
}) {
  useHideNavOnMount();
  const getDetail = useAction(api.sanka.detail);
  const { user } = useAuth();
  const toggleFav = useMutation(api.activities.toggleFavorite);
  const [detail, setDetail] = useState<SankaDetailShape | null>(null);
  const [failed, setFailed] = useState(false);
  const [synopsisOpen, setSynopsisOpen] = useState(false);
  const [allEpisodes, setAllEpisodes] = useState(false);

  useEffect(() => {
    let alive = true;
    setDetail(null);
    setFailed(false);
    getDetail({ slug, preferDonghua: true })
      .then((r: unknown) => {
        if (!alive) return;
        if (r && typeof r === "object" && "error" in (r as object)) setFailed(true);
        else setDetail(r as SankaDetailShape);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [slug, getDetail]);

  const eps = useMemo(() => {
    const all = [...(detail?.episodes ?? [])].sort((a, b) => a.number - b.number);
    return allEpisodes ? all : all.slice(0, DONGHUA_EP_PREVIEW);
  }, [detail, allEpisodes]);
  // Kontrol daftar episode donghua — gaya sama dengan detail anime:
  // tampilan Grid/List, urut, dan pencarian lokal.
  const [epGrid, setEpGrid] = useState(false);
  const [epOrder, setEpOrder] = useState<"first" | "last">("first");
  const [epQuery, setEpQuery] = useState("");
  const shownEps = useMemo(() => {
    const ordered = epOrder === "last" ? [...eps].reverse() : eps;
    const q = epQuery.trim().toLowerCase();
    if (!q) return ordered;
    return ordered.filter(
      (e) =>
        String(e.number).includes(q) ||
        String(e.title ?? "").toLowerCase().includes(q),
    );
  }, [eps, epOrder, epQuery]);
  // Nomor episode terawal yang ada di sumber (sumber sering cuma menyimpan
  // jendela terbaru — mis. Renegade Immortal mulai dari ep 75).
  const minEpNo = useMemo(() => {
    const nums = (detail?.episodes ?? [])
      .map((e) => Number(e.number || 0))
      .filter((n) => n > 0);
    return nums.length ? Math.min(...nums) : 0;
  }, [detail]);

  // Sinopsis dipotong 5 baris; sisa teksnya ada di tombol "Baca selengkapnya".
  // Sinopsis manual dari developer (tools konten) menggantikan yang dari sumber.
  const customDonghuaSynopsis = useQuery(
    api.content.overrideFor,
    slug ? { key: slug, kind: "donghua" } : "skip",
  );
  // Jadwal donghua resmi (per hari) — dipakai untuk tag "Update setiap …".
  const weeklySchedule = useAction(api.sanka.donghuaWeeklySchedule);
  const [updateDay, setUpdateDay] = useState<string | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    setUpdateDay(undefined);
    weeklySchedule({})
      .then((r: any) => {
        if (!alive || !r?.byDay) return;
        for (const [day, list] of Object.entries(
          r.byDay as Record<string, { id?: string; title?: string }[]>,
        )) {
          const hit = (list ?? []).some(
            (c) => c?.id === slug || c?.title === detail?.title,
          );
          if (hit) {
            setUpdateDay(day);
            return;
          }
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, detail?.title]);
  const synopsisLines = useMemo(
    () =>
      (customDonghuaSynopsis?.synopsis ?? detail?.synopsis ?? "")
        .split(/\n+/)
        .map((s) => s.trim())
        .filter(Boolean),
    [customDonghuaSynopsis?.synopsis, detail?.synopsis],
  );

  if (failed) {
    return (
      <div className="screen-enter fixed inset-0 z-50 overflow-y-auto bg-background">
        <div className="w-full p-3">
          <DetailHeader title="Detail Donghua" onClose={onClose} />
          <p className="py-16 text-center text-sm text-muted-foreground">
            Donghua tidak ditemukan
          </p>
        </div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="screen-enter fixed inset-0 z-50 overflow-y-auto bg-background">
        <div className="w-full p-3">
          <DetailHeader title="Detail Donghua" onClose={onClose} />
          <div className="skeleton h-64 w-full" />
        </div>
      </div>
    );
  }

  const banner = detail.cover ?? detail.poster ?? "";
  //-preview sinopsis dibatasi 5 baris; kalau teksnya cuma satu paragraf
  // panjang, 5 baris itu dijaga dengan pemotongan per karakter.
  const shownParas = synopsisOpen ? synopsisLines : synopsisLines.slice(0, 5);
  const hiddenParas = Math.max(0, synopsisLines.length - 5);
  const canExpand = hiddenParas > 0 || synopsisLines.join(" ").length > 420;
  const total = detail.episodes.length;

  return (
    <div className="screen-enter fixed inset-0 z-50 overflow-y-auto bg-background">
      <div className="w-full pb-24">
        <div className="relative">
          <div
            className="h-72 w-full shrink-0 bg-cover bg-center"
            style={
              banner
                ? {
                    backgroundImage: `linear-gradient(180deg, rgba(0,0,0,.55) 0%, rgba(0,0,0,.05) 40%, var(--background) 96%), linear-gradient(90deg, rgba(0,0,0,.5), transparent 55%), url(${banner})`,
                  }
                : undefined
            }
          >
            {!banner && <div className="h-full w-full bg-hero-gradient" />}
          </div>
          <div className="absolute inset-x-0 top-0 z-10">
            <DetailHeader title="Detail Donghua" onClose={onClose} />
          </div>
          {/* Judul lurus di bawah banner (bukan poster di samping). */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background via-background/85 to-transparent px-3 pb-3 pt-10">
            <h2 className="yn-outline text-2xl font-black leading-tight tracking-tight text-white">
              {detail.title}
            </h2>
            <p className="mt-1.5 text-[11px] font-medium text-white/85">
              {detail.rating ? `★ ${detail.rating}` : "Rating belum ada"}
              {detail.status ? ` • ${detail.status}` : ""}
            </p>
            {/* Tag status + jadwal update (khusus yang masih ONGOING) —
                ukuran & posisi sejajar dengan tag status di detail anime. */}
            {detail.status === "Ongoing" && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="inline-block rounded-full bg-sky-300 px-2.5 py-0.5 text-[10px] font-bold text-black">
                  Ongoing
                </span>
                {updateDay && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-0.5 text-[10px] font-bold text-amber-300 ring-1 ring-amber-300/35">
                    <CalendarDays className="size-3" aria-hidden />
                    Update setiap {updateDay}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="px-3">
          {/* Genre — semua tampil sebagai chip pil. */}
          {detail.genres.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {detail.genres.map((g) => (
                <span
                  key={g}
                  className="rounded-full border border-white/25 px-3 py-1 text-[11px] font-semibold text-white"
                >
                  {g}
                </span>
              ))}
            </div>
          )}

          {/* Baris aksi: "Tonton" + "Favorite" — kotak ROUNDED lurus
              (tanpa skew), sama seperti detail anime. */}
          <div className="mt-4 flex items-stretch gap-2.5">
            <button
              className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-sm font-bold text-white transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
              disabled={detail.episodes.length === 0}
              onClick={() => {
                const first = detail.episodes[0];
                if (!first) return;
                onPlay(first.url, first.number, detail.title);
              }}
            >
              <Play className="size-4 fill-current" aria-hidden />
              {detail.episodes.length > 0
                ? `Tonton episode ${detail.episodes[0].number}`
                : "Belum ada episode"}
            </button>
            <button
              aria-label="Favorite"
              className="flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-2xl border border-rose-400/45 bg-gradient-to-r from-rose-500/20 via-primary/15 to-pink-500/20 px-4 text-sm font-bold text-rose-100 transition hover:from-rose-500/30 hover:via-primary/25 hover:to-pink-500/25 active:scale-[0.98]"
              onClick={async () => {
                if (!user) return;
                const r = await toggleFav({
                  animeId: `donghua:${slug}`,
                  animeTitle: detail.title,
                  animeImage: detail.poster ?? detail.cover ?? "",
                  // `kind: "donghua"` supaya tidak tercampur tab Anime.
                  kind: "donghua",
                  status: detail.status ?? undefined,
                });
                toast.success(
                  r.favorited
                    ? "Ditambahkan ke favorite"
                    : "Dihapus dari favorite",
                );
              }}
            >
              <Bell className="size-4" aria-hidden />
              Favorite
            </button>
          </div>


          {/* Kolom karakter donghua — di bawah tombol Nonton/Favorite,
              sebelum sinopsis. */}
          <CharacterRow title={detail.title} />

          <SectionTitle>Sinopsis</SectionTitle>
          <div
            className={cn(
              "thin-scroll rounded-xl border border-border bg-secondary/40 p-3",
              synopsisOpen ? "" : "max-h-64 overflow-y-auto",
            )}
          >
            <p className="whitespace-pre-line text-sm leading-6 text-white">
              {shownParas.join("\n\n")}
            </p>
          </div>
          {canExpand && (
            <button
              onClick={() => setSynopsisOpen((v) => !v)}
              className="mt-2 inline-flex h-8 items-center text-[13px] font-medium text-white/70 transition hover:text-white"
            >
              {synopsisOpen ? "Tutup (balik ke kotak)" : "Baca selengkapnya"}
            </button>
          )}

          <div className="mt-5">
            {/* Judul + kontrol: Grid/List dan Urut */}
            <div className="flex items-center gap-2">
              <h2 className="flex-1 text-lg font-bold text-white">
                Episode <span className="text-white/50">({total})</span>
              </h2>
              <button
                onClick={() => setEpGrid((v) => !v)}
                className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/[0.12]"
              >
                {epGrid ? (
                  <><List className="size-3.5" aria-hidden /> List</>
                ) : (
                  <><LayoutGrid className="size-3.5" aria-hidden /> Grid</>
                )}
              </button>
              <button
                onClick={() => setEpOrder((o) => (o === "first" ? "last" : "first"))}
                className="rounded-full border border-white/20 bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/[0.12]"
              >
                Urut: {epOrder === "first" ? `${total} → 1` : `1 → ${total}`}
              </button>
            </div>

            {total === 0 ? (
              <p className="py-8 text-center text-xs text-white/70">
                Daftar episode belum tersedia
              </p>
            ) : (
              <>
                {/* Kotak cari episode (filter lokal). */}
                <input
                  value={epQuery}
                  onChange={(e) => setEpQuery(e.target.value)}
                  placeholder="Cari episode… (mis. 12)"
                  inputMode="numeric"
                  className="mt-3 w-full rounded-2xl border border-white/15 bg-white/[0.05] px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-primary/60 focus:outline-none"
                />
                {minEpNo > 1 && (
                  <p className="mt-2 rounded-lg border border-border bg-secondary/40 px-2.5 py-1.5 text-[11px] leading-snug text-muted-foreground">
                    Episode 1–{minEpNo - 1} tidak tersedia di sumber. Episode
                    terawal yang ada: {minEpNo}.
                  </p>
                )}
                {shownEps.length === 0 ? (
                  <p className="py-6 text-center text-xs text-white/60">
                    Tidak ada episode yang cocok.
                  </p>
                ) : epGrid ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {shownEps.map((e) => (
                      <button
                        key={e.number || e.url}
                        onClick={() => onPlay(e.url, e.number || 1, detail.title)}
                        className="size-11 rounded-xl border border-border bg-secondary/40 text-sm font-semibold text-white transition hover:border-foreground/40"
                      >
                        {e.number}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 space-y-2">
                    {shownEps.map((e) => (
                      <button
                        key={e.number || e.url}
                        onClick={() => onPlay(e.url, e.number || 1, detail.title)}
                        className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-3 text-left transition hover:bg-white/[0.08]"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-white">
                            Episode {e.number}
                          </p>
                          {e.title && e.title !== `Episode ${e.number}` && (
                            <p className="mt-0.5 line-clamp-1 text-[11px] text-white/55">
                              {e.title}
                            </p>
                          )}
                        </div>
                        <span
                          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-white"
                          aria-hidden
                        >
                          <Play className="size-4 fill-current" />
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {total > DONGHUA_EP_PREVIEW && (
                  <button
                    onClick={() => setAllEpisodes((v) => !v)}
                    className="mt-3 w-full rounded-xl border border-white/15 py-2 text-xs text-white/85"
                  >
                    {allEpisodes
                      ? "Tampilkan lebih sedikit"
                      : `Lihat semua ${total} episode`}
                  </button>
                )}
              </>
            )}
          </div>

          {/* "Yang serupa" — rekomendasi dari API donghua, jadialways
              donghua juga (never tercampur anime). */}
          {detail.related.length > 0 && (
            <div className="mt-6">
              <SectionTitle>Yang serupa</SectionTitle>
              <div className="-mx-3 flex gap-2.5 overflow-x-auto px-3 pb-1 thin-scroll">
                {detail.related.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => onPickDonghua?.(r.id)}
                    className="group w-24 shrink-0 text-left"
                  >
                    <div className="overflow-hidden rounded-xl border border-border/60">
                      {r.image ? (
                        <img
                          src={r.image}
                          alt=""
                          className="aspect-[2/3] w-full object-cover transition duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="aspect-[2/3] w-full bg-secondary/40" />
                      )}
                    </div>
                    <p className="mt-1 line-clamp-2 min-h-8 text-[11px] font-medium leading-4">
                      {r.title}
                    </p>
                    {/* Rating kuning + ikon TV + episode (kalau ada). */}
                    {(r.score || r.type || r.episodes) && (
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[10px] text-white/70">
                        {r.score ? (
                          <span className="inline-flex items-center gap-0.5 font-bold text-yellow-400">
                            <Star className="size-3 fill-current" aria-hidden />
                            {Number(r.score).toFixed(1)}
                          </span>
                        ) : null}
                        {r.type ? (
                          <span className="inline-flex items-center gap-0.5">
                            <Tv className="size-3" aria-hidden />
                            {typeLabel(r.type)}
                          </span>
                        ) : null}
                        {r.episodes ? (
                          <span>· {r.episodes} episode</span>
                        ) : null}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
