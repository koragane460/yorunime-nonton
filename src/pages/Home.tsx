import { Component, lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";

import { useFastChat } from "@/hooks/use-fast-chat";
import { AppLayout, useHideNavOnMount } from "@/components/AppLayout";
import { AnimeCard, AnimeGrid, SectionTitle, Avatar, BlueCheck, ClanTag, clanNameClass } from "@/components/lstream-ui";
import { DEFAULT_CLAN_ICON } from "@/lib/clanIcons";
import { ProfileSheet } from "@/components/ProfileSheet";
import { RequestButtons } from "@/components/RequestButtons";
import { ChatPanel, type ChatMsg } from "@/components/ChatPanel";
import { NobarBar } from "@/components/NobarBar";
import { CardCarousel, CatalogScreen, type CardT as CatalogCard, type CatalogKind, type PickSource as CatalogPickSource } from "@/components/CatalogRows";
import { isMusicSecret } from "@/lib/musicSecret";

// Layar musik muat saat dibutuhkan saja: penuh dengan player, browse, dan
// antrean, tidak perlu ikut di bundel awal Home.
const MusicScreen = lazy(() => import("@/pages/Music"));

import {
  Search,
  Bell,
  ChevronLeft,
  Loader2,
  ChevronRight,
  Check,
  Heart,
  Trophy,
  Gift,
  X,
  Gem,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Lock,
  MessageSquare,
  Play,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";

type AnimeCardT = {
  id: string;
  title: string;
  image: string;
  score?: number;
  status?: string;
  synopsis?: string;
  /** Format dari AniList ("TV", "MOVIE", "DONGHUA", …). */
  type?: string;
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

function HeroSkeleton() {
  return (
    <div className="skeleton mt-3 h-44 w-full rounded-2xl border border-white/5" />
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
        const list = (r ?? []) as AnimeCardT[];
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
          <AnimeGrid items={items} onPick={onPick} newIds={new Set()} />
          <div className="mt-3 flex justify-center">
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={busy || page >= 6}
              className="rounded-full border border-border px-4 py-1.5 text-xs font-semibold text-muted-foreground transition hover:border-foreground/40 hover:text-primary disabled:opacity-50"
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
  const [showChat, setShowChat] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
const [showMusic, setShowMusic] = useState(false);
  const [searchGenre, setSearchGenre] = useState<string | null>(null);
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

  const hero = useAction(api.anime.animeOngoing);
  const top = useAction(api.anime.animeTop);
  const today = useAction(api.anime.animeTrendingToday);
  const forYou = useAction(api.anime.animeForYou);
  const genres = useAction(api.anime.animeGenres);

  const [heroList, setHeroList] = useState<AnimeCardT[]>([]);
  const [topList, setTopList] = useState<AnimeCardT[]>([]);
  const [todayList, setTodayList] = useState<AnimeCardT[]>([]);
  const [foryouList, setForyouList] = useState<AnimeCardT[]>([]);
  const [genreList, setGenreList] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [heroIdx, setHeroIdx] = useState(0);

  // Muat data katalog (backend punya fallback statis, jadi selalu ada hasil)
  useEffect(() => {
    let alive = true;
    Promise.allSettled([
      hero({ page: 1 }),
      top({}),
      today({}),
      forYou({ seed: (user?.name?.length ?? 0) + 3 }),
      genres({}),
    ]).then(([rHero, rTop, rToday, rForYou, rGenres]) => {
      if (!alive) return;
      if (rHero.status === "fulfilled") setHeroList((rHero.value as AnimeCardT[]) ?? []);
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

  const heroItems = heroList.slice(0, 2);
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

  // Auto-rotate hero
  useEffect(() => {
    if (heroItems.length < 2) return;
    const t = setInterval(() => setHeroIdx((i) => (i + 1) % heroItems.length), 6000);
    return () => clearInterval(t);
  }, [heroItems.length]);

  // Judul ikut disimpan: kartu dari sumber non-MAL (mis. Otakudesu) punya id
  // berupa slug, jadi tanpa judul backend tidak bisa menemukan sinopsis,
  // studio, rating, dan jumlah episodenya.
  const [pickTitle, setPickTitle] = useState<string | undefined>(undefined);
  // Kartu donghua (slug Sanka) dan kartu anime (id AniList) butuh layar
  // detail yang berbeda; kalau dicampur, judul donghua tertukar dengan anime.
  const [pickSource, setPickSource] = useState<CatalogPickSource>("anilist");
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
  }, [heroList.length, todayAiring.length, foryouList.length, genreList.length]);

  return (
    <div className="pb-8">
      {/* 1) YORUNIME PREMIUM — card ke /premium, tombol beli masih di-lock */}
      <button
        onClick={() => navigate("/premium")}
        className="fade-enter mt-4 flex w-full items-center gap-3 rounded-2xl border border-white/10 border-white/10 bg-white/[0.04] p-3.5 text-left transition hover:border-foreground/40"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/15">
          <Sparkles className="size-6 text-primary" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold">YoruNime</span>
          <span className="block text-xs text-zinc-400">
            Dukung YoruNime — nonton tanpa batas, tanpa iklan
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-primary px-3.5 py-1.5 text-xs font-bold text-primary-foreground">
          Beli
        </span>
      </button>

      {/* 3) HERO BANNER */}
      {loading ? (
        <HeroSkeleton />
      ) : heroItems.length > 0 ? (
        <div className="fade-enter relative mt-3 overflow-hidden rounded-2xl border border-white/10">
          {heroItems.map((a, i) => (
            <div
              key={a.id}
              className={cn(
                "transition-opacity duration-500",
                i === heroIdx ? "block opacity-100" : "hidden opacity-0",
              )}
            >
              <div
                className="relative min-h-60 overflow-hidden bg-cover bg-center"
                style={
                  a.image
                    ? {
                        // Layer 1: vignette vertikal gelap (gradient dari bawah ke atas) agar teks terbaca di bawah
                        // Layer 2: gambar anime
                        backgroundImage: `linear-gradient(0deg, rgba(0,0,0,.92) 0%, rgba(0,0,0,.55) 50%, rgba(0,0,0,.2) 100%), url(${a.image})`,
                        backgroundSize: "100% 100%, cover",
                        backgroundPosition: "center bottom, center",
                        backgroundRepeat: "no-repeat, no-repeat",
                      }
                    : undefined
                }
              >
                {!a.image && (
                  <div className="absolute inset-0 bg-hero-gradient" />
                )}
                <div className="relative w-full p-4">
                  <span className="rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-black text-white">
                    {a.status ?? "Ongoing"}
                  </span>
                  <h3 className="mt-1.5 text-lg font-black">{a.title}</h3>
                  <p className="mt-1 line-clamp-4 text-xs leading-relaxed text-zinc-300">
                    {a.synopsis ?? "Sinopsis belum tersedia."}
                  </p>
                  <div className="mt-2.5 flex gap-2">
                    <button
                      onClick={() => openAnime(a.id, a.title)}
                      className="rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-white transition hover:bg-primary"
                    >
                      Lihat detail
                    </button>
                    <button
                      onClick={() =>
                        navigate(
                          `/nonton?anime=${encodeURIComponent(a.id)}&judul=${encodeURIComponent(a.title ?? "")}`,
                        )
                      }
                      className="rounded-full border border-white/25 bg-black/40 px-4 py-1.5 text-xs font-semibold text-white transition hover:border-white/50"
                    >
                      ▶ Tonton
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
          <div className="absolute bottom-2.5 right-2.5 flex gap-1">
            <button
              className="rounded-full bg-black/60 p-1.5 text-white"
              onClick={() => setHeroIdx((i) => (i + heroItems.length - 1) % heroItems.length)}
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              className="rounded-full bg-black/60 p-1.5 text-white"
              onClick={() => setHeroIdx((i) => (i + 1) % heroItems.length)}
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
          <div className="absolute bottom-3 left-4 flex gap-1">
            {heroItems.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1 rounded-full transition-all",
                  i === heroIdx ? "w-5 bg-red-500" : "w-2 bg-white/30",
                )}
              />
            ))}
          </div>
        </div>
      ) : null}

      {/* 4) LEADERBOARD (gabung XP + Top Give Premium) */}
      <button
        onClick={() => setShowLeaderboard(true)}
        className="fade-enter mt-3 w-full rounded-2xl border border-white/10 bg-card p-3 text-left transition hover:border-foreground/40"
      >
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 font-bold">
            <Trophy className="size-4 text-red-400" /> Leaderboard
          </p>
          <span className="text-xs text-muted-foreground">lihat semua ›</span>
        </div>
        <HomeLeaderboardPreview />
      </button>

      {/* 5) CHAT BARENG */}
      <button
        onClick={() => setShowChat(true)}
        className="fade-enter mt-3 w-full rounded-2xl border border-white/10 bg-card p-3 text-left transition hover:border-foreground/40"
      >
        <div className="flex items-center justify-between pb-2.5">
          <p className="flex items-center gap-2 font-bold">
            <MessageSquare className="size-5" aria-hidden /> Chat bareng
          </p>
          <span className="text-xs text-muted-foreground">buka ›</span>
        </div>
        {/* Garis pembatas di bawah judul (sebelum dipencet) */}
        <div className="h-px bg-white/15" />
        <QueryBoundary label="Gagal memuat chat">
          <GlobalChatPreview />
        </QueryBoundary>
      </button>

      {/* 5b) KOTAK CLAN — langsung di bawah Chat bareng (hanya kalau punya clan) */}
      <QueryBoundary label="Gagal memuat clan">
        <ClanBox onOpen={() => navigate("/clan")} />
      </QueryBoundary>

      {/* 6) CARI ANIME — buka layar full screen.
          `searchAnchor` dipakai untuk mengukur tinggi warna ungu di latar:
          warna itu harus berhenti tepat di bawah tombol ini. */}
      <div ref={searchAnchor}>
        <SectionTitle>Cari anime &amp; donghua</SectionTitle>
        <button
          onClick={() => {
            setSearchGenre(null);
            setShowSearch(true);
          }}
        className="flex w-full items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-left"
        >
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <span className="flex-1 text-sm text-muted-foreground">
            contoh: ayanokoji adalah aku
          </span>
          <span className="rounded-full bg-primary px-3 py-1 text-xs font-bold text-white">
            Cari
          </span>
        </button>
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
                      onClick={() =>
                        openAnime(a.id, a.title, a.isDonghua ? "sanka" : "anilist")
                      }
                    />
                    <span
                      className={cn(
                        "absolute left-1.5 top-1.5 rounded px-1.5 py-0.5 font-mono text-[9px] font-bold",
                        a.isDonghua
                          ? "bg-violet-600 text-white"
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
                  <p className="mt-1 line-clamp-2 min-h-8 text-[11px] font-medium leading-4">
                    {a.title}
                  </p>
                  {/* Jam rilis di bawah judul, mengikuti zona waktu device. */}
                  <p className="font-mono text-[10px] text-muted-foreground">
                    {a.timeLabel}
                  </p>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* 6c) KATEGORI LENGKAP: Movie / OVA / Special / Upcoming / Season ini */}
      <BrowseRow kind="season" title="Season Ini" onPick={openAnime} />
      <BrowseRow kind="movie" title="Movie" onPick={openAnime} />
      <BrowseRow kind="ova" title="OVA &amp; ONA" onPick={openAnime} />
      {/* Slot "Special" diganti Donghua: dua baris geser ke kanan (10 atas +
          10 bawah) + "Lihat selengkapnya" yang membuka layar penuh. */}
      <CardCarousel
        kind="donghua"
        title="Donghua"
        subtitle="subtitle Indonesia"
        onPick={openAnime}
      />
      <BrowseRow kind="upcoming" title="Segera Rilis (Upcoming)" onPick={openAnime} />

      {/* 7) ANIME-ANIME — tiap baris dibatasi 12 kartu; sisanya ada di
          "Lihat selengkapnya" yang membuka layar penuh berisi daftar
          lengkap + kolom pencarian + tombol kembali. */}
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
          <AnimeGrid items={foryouList.slice(0, 12)} onPick={openAnime} newIds={new Set()} />
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
      {showSearch && (
        <SearchScreen
          initialGenre={searchGenre}
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
        <span className="rounded-full bg-primary px-3 py-1 text-xs font-bold text-white">
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
          <span className="font-semibold text-primary">{last.username}</span>:{" "}
          {last.text ?? (last.premiumGive ? "Give premium" : "[foto]")}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Belum ada chat di clan — sapa teman kamu!
        </p>
      )}
    </button>
  );
}

// ------------------------------------------------------ chat preview ----

function GlobalChatPreview() {
  const msgs = useQuery(api.chat.listMessages, { kind: "global", limit: 6 });
  const [idx, setIdx] = useState(0);

  // Rotasi 1 pesan setiap 3 menit
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => i + 1), 180_000);
    return () => clearInterval(t);
  }, []);

  if (!msgs)
    return <div className="skeleton mt-2 h-10 w-full rounded-lg" />;

  const visible = msgs.slice(-6);
  if (visible.length === 0)
    return (
      <p className="fog-card py-3 text-center text-xs text-muted-foreground">
        Belum ada chat — jadi yang pertama!
      </p>
    );

  const m = visible[idx % visible.length] as any;
  return (
    <div className="fog-card mt-2 h-14 overflow-hidden">
      <div className="flex items-center gap-2.5 text-[13px]">
        <Avatar src={m.image} seed={m.username} className="size-9" />
        <p className="truncate">
          <span className="font-semibold text-primary">{m.username}</span>
          {m.premium && <BlueCheck className="ml-1 inline size-3.5" />}
          <span className="text-muted-foreground"> : </span>
          <span className="text-zinc-300">
            {m.premiumGive ? (
              <span className="inline-flex items-center gap-1">
                <Gift className="size-3.5" aria-hidden /> give premium
              </span>
            ) : (
              m.text ?? "[foto]"
            )}
          </span>
        </p>
      </div>
    </div>
  );
}

// ------------------------------------------------------ leaderboard ----

function LeaderEntryRow({
  rank,
  username,
  image,
  xp,
  suffix = "XP",
}: {
  rank: number;
  username?: string;
  image?: string;
  xp: number;
  suffix?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-secondary/40 p-2.5">
      <span className="w-6 text-center text-sm font-bold text-red-400">{rank}</span>
      <Avatar src={image} seed={username} className="size-10" />
      <div>
        <p className="text-sm font-semibold">{username ?? "user"}</p>
        <p className="text-xs text-muted-foreground">
          {xp.toLocaleString("id-ID")} {suffix}
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
}: {
  rank: number;
  username?: string;
  image?: string;
  xp: number;
  height: string;
}) {
  return (
    <div className="flex min-w-0 flex-col items-center">
      <Avatar src={image} seed={username} className="size-11" />
      <p className="mt-1 w-full truncate text-center text-[11px] font-semibold leading-tight">
        {username ?? "user"}
      </p>
      <p className="text-[10px] leading-tight text-primary">{xp.toLocaleString("id-ID")} XP</p>
      <div
        className={cn(
          "mt-1.5 flex w-full items-start justify-center rounded-t-xl border border-b-0 border-foreground/40 bg-gradient-to-t from-red-500/10 to-red-500/25 pt-1 text-lg font-black text-red-200",
          height,
        )}
      >
        {rank}
      </div>
    </div>
  );
}

function LeaderboardList({ period }: { period: string }) {
  const data = useQuery(api.xp.leaderboard, { period, limit: 50 });
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
      {data.length > 0 && (
        <div className="grid grid-cols-3 items-end gap-2">
          {t2 && <PodiumCard rank={2} username={t2.username} image={t2.image} xp={t2.xp} height="h-20" />}
          {t1 && <PodiumCard rank={1} username={t1.username} image={t1.image} xp={t1.xp} height="h-28" />}
          {t3 && <PodiumCard rank={3} username={t3.username} image={t3.image} xp={t3.xp} height="h-16" />}
        </div>
      )}
      {rest.slice(0, 47).map((e) => (
        <LeaderEntryRow key={e.userId} rank={e.rank} username={e.username} image={e.image} xp={e.xp} />
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
          key={g.userId}
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
            <h1 className="text-base font-bold leading-tight">
              {mode === "xp" ? "Leaderboard XP" : "Top Give Premium"}
            </h1>
            <p className="text-[11px] text-muted-foreground">
              {mode === "xp" ? "Peringkat XP komunitas" : "Peringkat orang paling banyak memberi premium"}
            </p>
          </div>
          {/* Tukar mode lewat ikon di kanan — tidak ada lagi dua pil lebar. */}
          <button
            onClick={() => setMode(mode === "xp" ? "give" : "xp")}
            aria-label={mode === "xp" ? "Lihat Top Give Premium" : "Lihat Leaderboard XP"}
            className="ml-auto flex size-10 items-center justify-center rounded-xl border border-white/10 bg-white/5"
          >
            {mode === "xp" ? (
              <Gift className="size-4 text-[oklch(0.86_0.16_90)]" />
            ) : (
              <Trophy className="size-4" />
            )}
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
            <p className="mb-2.5 px-1 text-[10px] leading-relaxed text-muted-foreground">
              {period === "harian"
                ? "XP yang kamu dapet dalam 24 jam terakhir. Semua user ikut dihitung."
                : period === "mingguan"
                  ? "XP dalam 7 hari terakhir. Hanya user yang sudah gabung minimal 7 hari yang dihitung."
                  : "XP dalam 30 hari terakhir. Hanya user yang sudah gabung minimal 30 hari yang dihitung."}
            </p>
            <LeaderboardList period={period} />
          </>
        )}
        {mode === "give" && <TopGiveList />}
      </div>
    </div>
  );
}

function HomeLeaderboardPreview() {
  const data = useQuery(api.account.totalLeaderboard, { limit: 5 });
  if (!data)
    return (
      <div className="mt-2 space-y-1.5">
        <div className="skeleton h-16 w-full rounded-xl" />
        <div className="skeleton h-10 w-full rounded-xl" />
      </div>
    );
  const [t1, t2, t3, ...rest] = data;
  return (
    <div className="mt-2">
      <div className="grid grid-cols-3 items-end gap-2">
        {t2 && <PodiumCard rank={2} username={t2.username} image={t2.image} xp={t2.xp} height="h-14" />}
        {t1 && <PodiumCard rank={1} username={t1.username} image={t1.image} xp={t1.xp} height="h-20" />}
        {t3 && <PodiumCard rank={3} username={t3.username} image={t3.image} xp={t3.xp} height="h-11" />}
      </div>
      <div className="mt-2 space-y-1.5">
        {rest.map((e) => (
          <LeaderEntryRow key={e.userId} rank={e.rank} username={e.username} image={e.image} xp={e.xp} />
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------ search screen ----

function SearchScreen({
  onClose,
  onPick,
  initialGenre,
  onOpenMusic,
}: {
  onClose: () => void;
  onPick: (id: string) => void;
  initialGenre?: string | null;
  onOpenMusic: () => void;
}) {
  useHideNavOnMount();
  const searchAnime = useAction(api.anime.animeSearch);
  const searchDonghua = useAction(api.sanka.donghuaSearchCards);
  const loadGenre = useAction(api.anime.animeByGenre);
  const loadAll = useAction(api.anime.animeTop);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AnimeCardT[] | null>(null);
  const [list, setList] = useState<AnimeCardT[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [genresOpen, setGenresOpen] = useState(false);
  const [genreList, setGenreList] = useState<{ id: string; name: string }[]>([]);
  const [activeGenre, setActiveGenre] = useState<string | "all">("all");
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
      .then((r) => setGenreList((r as any) ?? []))
      .catch(() => {});
    loadAll({})
      .then((r) => {
        setList((r as AnimeCardT[]) ?? []);
        setListLoading(false);
      })
      .catch(() => setListLoading(false));
    if (initialGenre) {
      setActiveGenre(initialGenre);
      void pickGenreById(initialGenre);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pickGenreById = async (id: string) => {
    if (id === "all") {
      setActiveGenre("all");
      setListLoading(true);
      try {
        const r = (await loadAll({})) as AnimeCardT[];
        setList(r ?? []);
      } catch {
        setList([]);
      }
      setListLoading(false);
      return;
    }
    setActiveGenre(id);
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
      const [animeRes, donghuaRes] = await Promise.all([animeP, donghuaP]);
      const seen = new Set<string>();
      const merged: AnimeCardT[] = [];
      for (const c of [...(animeRes ?? []), ...(donghuaRes ?? [])]) {
        if (!c?.id || seen.has(c.id)) continue;
        seen.add(c.id);
        merged.push({ ...c, type: c.type });
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
        <div className="flex w-full items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void doSearch()}
            placeholder="contoh: ayanokoji adalah aku / battle through"
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
            className="rounded-full bg-primary px-3 py-1 text-xs font-bold text-white"
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
              className="shrink-0 text-[10px] font-semibold text-primary underline"
            >
              reset
            </button>
          )}
        </div>
        )}

        {/* Genre collapsible — "Semua" paling kiri */}
        <div className="mt-3">
          <button
            onClick={() => setGenresOpen((v) => !v)}
            className="flex w-full items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold"
          >
            <SlidersHorizontal className="size-4 text-red-400" /> Genre
            {genresOpen ? <ChevronUp className="ml-auto size-4" /> : <ChevronDown className="ml-auto size-4" />}
          </button>
          {genresOpen && (
            <div className="fade-enter mt-2 flex flex-wrap gap-1.5">
              <button
                onClick={() => void pickGenreById("all")}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs",
                  activeGenre === "all"
                    ? "border-foreground/40 bg-primary/15 text-primary"
                    : "border-border text-muted-foreground",
                )}
              >
                Semua
              </button>
              {genreList.map((g) => (
                <button
                  key={g.id}
                  onClick={() => void pickGenreById(g.id)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs",
                    activeGenre === g.id
                      ? "border-foreground/40 bg-primary/15 text-primary"
                      : "border-border text-muted-foreground hover:border-foreground/40",
                  )}
                >
                  {g.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Hasil: hasil pencarian > daftar genre/semua */}
        {searching && (
          <p className="mt-3 text-center text-xs text-muted-foreground">Mencari…</p>
        )}
        {results !== null && !searching && (
          <div className="mt-4">
            {results.length === 0 ? (
              <div className="py-8 text-center">
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
                <div className="mt-6 text-left">
                  <p className="mb-2 text-xs font-semibold text-muted-foreground">
                    Mungkin kamu mencari salah satu ini
                  </p>
                  {listLoading ? (
                    <GridSkeleton count={6} />
                  ) : (
                    <AnimeGrid items={list.slice(0, 10)} onPick={onPick} newIds={new Set()} />
                  )}
                </div>
              </div>
            ) : (
              <AnimeGrid items={results} onPick={onPick} newIds={new Set()} />
            )}
          </div>
        )}
        {results === null && (
          <div className="mt-4">
            {listLoading ? <GridSkeleton count={12} /> : <AnimeGrid items={list} onPick={onPick} newIds={new Set()} />}
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
  const [tab, setTab] = useState<"chat" | "teman">("chat");
  const [friendTab, setFriendTab] = useState<"teman" | "request">("teman");
  const [profileId, setProfileId] = useState<Id<"users"> | null>(null);
  const { messages: msgs, sendFast, dropLocal, loading: chatLoading } = useFastChat(
    { kind: "global", limit: 60 },
    { kind: "global" },
    user,
  );
  const friends = useQuery(api.friends.listFriends, user ? {} : "skip");
  const requests = useQuery(api.friends.listRequests, user ? {} : "skip");
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
        <div className="w-full px-4">
          {/* Tab tanpa kotak — garis bawah saat aktif (chat clan pindah ke kotak clan di Home) */}
          <div className="flex border-b border-border/60">
            {(["chat", "teman"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "relative flex-1 pb-2.5 pt-1 text-sm font-semibold capitalize transition",
                  tab === t ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {t === "chat" ? "Chat" : "Teman"}
                {tab === t && (
                  <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-primary" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Isi di atas input; chat rata full tanpa rounding */}
        <div className="flex min-h-0 w-full flex-1 flex-col pb-2 pt-3">
          {tab === "chat" && (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-y border-border/60 bg-card">
              {/* Nobar: daftar room nonton bareng */}
              <NobarBar
                onJoined={(roomId) => {
                  onClose();
                  navigate(`/nonton?room=${roomId}`);
                }}
              />
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
                      <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-primary" />
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
      <div className="flex min-h-0 flex-1 flex-col">
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
  const [detail, setDetail] = useState<any>(null);
  const [synopsisOpen, setSynopsisOpen] = useState(false);
  const [episodeOrder, setEpisodeOrder] = useState<"first" | "last">("first");
  const [allEpisodes, setAllEpisodes] = useState(false);
  const [episodeOpen, setEpisodeOpen] = useState(true);
  const [similar, setSimilar] = useState<AnimeCardT[]>([]);

  useEffect(() => {
    getDetail({ id: animeId, title: animeTitle })
      .then((d: any) => setDetail(d))
      .catch(() => setDetail({ error: true }));
    setSimilar([]);
    getSimilar({ id: animeId })
      .then((r: any) => setSimilar((r as AnimeCardT[]) ?? []))
      .catch(() => {});
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
  if (episodeOrder === "last") eps.reverse();
  // Anime panjang bisa punya ribuan episode, jadi ditampilkan bertahap
  // (60 per halaman) supaya HP tidak berat.
  const PAGE = 60;
  const shownEps = allEpisodes ? eps : eps.slice(0, PAGE);
  const releasedCount = eps.filter((e: any) => e.released !== false).length;
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
        {/* Header transparan di atas banner full-bleed */}
        <div className="relative">
          {/* Banner: background anime full lebar sampai pinggir (kesamping panjang) */}
          <div
            className="h-64 w-full shrink-0 bg-cover bg-center"
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
          </div>

          {/* Info overlay: poster kiri, judul+genre kanan, di ATAS banner */}
          <div className="absolute inset-x-0 bottom-0 flex items-end gap-3 px-3 pb-3">
            {detail.image ? (
              <img
                src={detail.image}
                alt=""
                className="aspect-[2/3] w-24 shrink-0 self-end rounded-lg object-cover shadow-xl"
              />
            ) : (
              <div className="aspect-[2/3] w-24 shrink-0 self-end rounded-lg bg-black/40" />
            )}
            <div className="min-w-0 flex-1">
              <h2 className="line-clamp-2 text-lg font-black leading-tight text-white yn-outline">
                {detail.title}
              </h2>
              <div className="mt-1 flex flex-wrap gap-1">
                {(detail.genres ?? []).slice(0, 3).map((g: string) => (
                  <span
                    key={g}
                    className="rounded-full border border-white/25 bg-black/45 px-2 py-0.5 text-[10px] text-white/85"
                  >
                    {g}
                  </span>
                ))}
              </div>
              <p className="mt-1 line-clamp-1 text-[11px] text-white/70">
                {detail.rating ?? "Rating 13+"} • {detail.studio ?? "Studio tidak diketahui"}
              </p>
              <span
                className={cn(
                  "mt-1 inline-block rounded px-2 py-0.5 text-[10px] font-bold",
                  detail.status === "Completed"
                    ? "bg-emerald-500/80 text-white"
                    : detail.status === "OVA" || detail.status === "Movie"
                      ? "bg-purple-500/80 text-white"
                      : "bg-primary text-white",
                )}
              >
                {detail.status ?? "Ongoing"}
              </span>
            </div>
          </div>
        </div>

        <div className="px-3">
          {/* Baris aksi: "Lanjut episode" lebar, "Favorite" kotak miring di
              kanannya. Dua-duanya satu tinggi supaya rata di layar HP. */}
          <div className="mt-4 flex items-stretch gap-2">
            <SkewButton
              variant="accent"
              className="flex-1 bg-sky-700 text-white hover:bg-sky-600"
              onClick={() =>
                navigate(
                  `/nonton?anime=${animeId}${
                    animeTitle
                      ? `&judul=${encodeURIComponent(animeTitle)}`
                      : ""
                  }`,
                )
              }
            >
              <Play className="size-4 fill-current" aria-hidden />
              {progress && !progress.finished && progress.progressSec > 30
                ? `Lanjut episode ${progress.episode}`
                : "Lanjut episode"}
            </SkewButton>
            <SkewButton
              variant="quiet"
              aria-label="Favorite"
              onClick={async () => {
                if (!user) return;
                const r = await toggleFav({
                  animeId,
                  animeTitle: detail.title,
                  animeImage: detail.image,
                });
                toast.success(
                  r.favorited
                    ? "Ditambahkan ke favorite"
                    : "Dihapus dari favorite",
                );
              }}
            >
              <Bell
                className={cn(
                  "size-4",
                  isFav && "fill-current text-accent",
                )}
                aria-hidden
              />
              Favorite
            </SkewButton>
          </div>
          {/* Baris di bawah tombol: posisi tontonan dalam menit, lalu
              jumlah orang yang mem-favoritkan (format ringkas). */}
          {progress && progress.durationSec > 0 && (
            <p className="mt-1.5 text-center text-[11px] text-white/60">
              Lanjut menit {Math.floor(progress.progressSec / 60)}/
              {Math.floor(progress.durationSec / 60)}
            </p>
          )}
          <p className="mt-1 text-center text-[11px] text-white/55">
            {fmtFavoritCount(favCount ?? 0)}
          </p>

          {/* Sinopsis — 5/6 paragraf dulu sebelum "baca selengkapnya" */}
          <SectionTitle>Sinopsis</SectionTitle>
          <p className="whitespace-pre-line text-sm leading-6 text-white">
            {synopsisBody}
          </p>
          {canExpandSynopsis && (
            <button
              onClick={() => setSynopsisOpen((v) => !v)}
              className="mt-2 inline-flex h-8 items-center text-[13px] font-medium text-white/70 transition hover:text-white"
            >
              {synopsisOpen ? "Tutup" : "Baca selengkapnya"}
            </button>
          )}

          {/* Episode — bisa dibuka & ditutup */}
          <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-card">
            <button
              onClick={() => setEpisodeOpen((v) => !v)}
              className="flex w-full items-center justify-between gap-2 px-3 py-3 text-left"
            >
              <h2 className="text-base font-bold text-white">Episode</h2>
              <span className="flex items-center gap-1.5 text-xs text-white/80">
                {releasedCount} dari {eps.length} tayang
                {episodeOpen ? (
                  <ChevronUp className="size-4" aria-hidden />
                ) : (
                  <ChevronDown className="size-4" aria-hidden />
                )}
              </span>
            </button>
            {episodeOpen && (
              <div className="px-3 pb-3">
                {eps.length === 0 ? (
                  <p className="py-4 text-center text-xs text-white/70">
                    {detail.status === "Upcoming"
                      ? "Belum tayang — nantikan jadwal rilisnya"
                      : "Daftar episode belum tersedia"}
                  </p>
                ) : (
                  <>
                    <button
                      onClick={() =>
                        setEpisodeOrder(episodeOrder === "first" ? "last" : "first")
                      }
                      className="mb-2 rounded-full border border-white/20 px-3 py-1 text-xs text-white/85 transition hover:border-foreground/40"
                    >
                      {episodeOrder === "first"
                        ? "Urutkan: Terlama ↓"
                        : "Urutkan: Terbaru ↑"}
                    </button>
                    <div className="flex flex-wrap gap-1.5">
                      {shownEps.map((e: any) => {
                        const released = e.released !== false;
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
                              "size-10 rounded-lg border text-sm font-semibold transition",
                              released
                                ? "border-border bg-secondary/40 text-white hover:border-foreground/40"
                                : "cursor-not-allowed border-white/5 bg-white/[0.03] text-white/25",
                            )}
                          >
                            {e.number}
                          </button>
                        );
                      })}
                    </div>
                    {eps.length > PAGE && (
                      <button
                        onClick={() => setAllEpisodes((v) => !v)}
                        className="mt-2 w-full rounded-lg border border-white/15 py-2 text-xs text-white/85"
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
          </div>

          {/* Yang serupa — 2 baris kartu (atas + bawah), geser ke kanan */}
          {similar.length > 0 && (
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
                    {s.score ? (
                      <p className="flex items-center gap-1 text-[10px] text-white/80">
                        <Star className="size-3 fill-current" aria-hidden /> {s.score}
                      </p>
                    ) : null}
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
 * Jumlah favorit, format ringkas: "1 Favorit", "10+", "100+", "1k", "1.2k".
 * Di bawah 10 ditulis penuh supaya tidak terasa sepi; 10-99 dan 100-999
 * dibulatkan ke puluhan/ratusan; ribuan pakai satuan k dengan satu desimal
 * (1.1k, 1.2k, 1.3k) sampai 9.9k, lalu bulat ribuan.
 */
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

function DetailHeader({
  title,
  onClose,
}: {
  title: string;
  onClose: () => void;
}) {
  return (
    <div className="relative z-10 flex items-center gap-3 p-3">
      <button
        onClick={onClose}
        aria-label="Kembali"
        className="-ml-1 flex size-10 items-center justify-center rounded-full text-white transition hover:bg-white/10"
      >
        <ChevronLeft className="size-5" />
      </button>
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
  related: { id: string; title: string; image: string }[];
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
}) {useHideNavOnMount();
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

  // Sinopsis dipotong 5 baris; sisa teksnya ada di tombol "Baca selengkapnya".
  // Sinopsis manual dari developer (tools konten) menggantikan yang dari sumber.
  const customDonghuaSynopsis = useQuery(
    api.content.overrideFor,
    slug ? { key: slug, kind: "donghua" } : "skip",
  );
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
  const truncated =
    !synopsisOpen &&
    synopsisLines.length <= 5 &&
    synopsisLines.join(" ").length > 420;
  const total = detail.episodes.length;

  return (
    <div className="screen-enter fixed inset-0 z-50 overflow-y-auto bg-background">
      <div className="w-full pb-24">
        <div className="relative">
          <div
            className="h-64 w-full shrink-0 bg-cover bg-center"
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
          <div className="absolute inset-x-0 bottom-0 flex items-end gap-3 px-3 pb-3">
            {detail.poster ? (
              <img
                src={detail.poster}
                alt=""
                className="aspect-[2/3] w-24 shrink-0 self-end rounded-lg object-cover shadow-xl"
              />
            ) : (
              <div className="aspect-[2/3] w-24 shrink-0 self-end rounded-lg bg-black/40" />
            )}
            <div className="min-w-0 flex-1 self-end pb-1">
              <h2 className="yn-outline text-xl font-black leading-tight text-white">
                {detail.title}
              </h2>
              {detail.genres.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {detail.genres.slice(0, 3).map((g) => (
                    <span
                      key={g}
                      className="rounded-full border border-white/25 bg-black/40 px-2 py-0.5 text-[10px] font-semibold text-white/90"
                    >
                      {g}
                    </span>
                  ))}
                </div>
              )}
              <p className="mt-1.5 text-[11px] font-medium text-white/85">
                {detail.rating ? `★ ${detail.rating}` : "Rating belum ada"}
                {detail.status ? ` • ${detail.status}` : ""}
              </p>
            </div>
          </div>
        </div>

        <div className="px-3">
          {/* Baris aksi: "Tonton" untuk episode pertama, "Favorite" di
              kanannya. Sama seperti di detail anime. */}
          <div className="mt-4 flex items-stretch gap-2">
            <SkewButton
              variant="accent"
              className="flex-1"
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
            </SkewButton>
            <SkewButton
              variant="quiet"
              aria-label="Favorite"
              onClick={async () => {
                if (!user) return;
                const r = await toggleFav({
                  animeId: `donghua:${slug}`,
                  animeTitle: detail.title,
                  animeImage: detail.poster ?? detail.cover ?? "",
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
            </SkewButton>
          </div>

          <SectionTitle>Sinopsis</SectionTitle>
          <p
            className="whitespace-pre-line text-sm leading-6 text-white"
            style={
              truncated ? { maxHeight: "9rem", overflow: "hidden" } : undefined
            }
          >
            {shownParas.join("\n\n")}
          </p>
          {canExpand && (
            <button
              onClick={() => setSynopsisOpen((v) => !v)}
              className="mt-2 inline-flex h-8 items-center text-[13px] font-medium text-white/70 transition hover:text-white"
            >
              {synopsisOpen ? "Tutup" : "Baca selengkapnya"}
            </button>
          )}

          <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-card">
            <div className="flex items-center justify-between gap-2 px-3 py-3">
              <h2 className="text-base font-bold text-white">Episode</h2>
              <span className="text-xs text-white/80">
                {total > 0 ? `${total} episode` : "Belum ada"}
              </span>
            </div>
            <div className="px-3 pb-3">
              {eps.length === 0 ? (
                <p className="py-4 text-center text-xs text-white/70">
                  Daftar episode belum tersedia
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-1.5">
                    {eps.map((e) => (
                      <button
                        key={e.number || e.url}
                        onClick={() => onPlay(e.url, e.number || 1, detail.title)}
                        className="size-10 rounded-lg border border-border bg-secondary/40 text-sm font-semibold text-white transition hover:border-foreground/40"
                      >
                        {e.number}
                      </button>
                    ))}
                  </div>
                  {total > DONGHUA_EP_PREVIEW && (
                    <button
                      onClick={() => setAllEpisodes((v) => !v)}
                      className="mt-2 w-full rounded-lg border border-white/15 py-2 text-xs text-white/85"
                    >
                      {allEpisodes
                        ? "Tampilkan lebih sedikit"
                        : `Lihat semua ${total} episode`}
                    </button>
                  )}
                </>
              )}
            </div>
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
