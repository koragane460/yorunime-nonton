import { Component, lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";

import { useFastChat } from "@/hooks/use-fast-chat";
import { AppLayout, useHideNavOnMount } from "@/components/AppLayout";
import { AnimeCard, AnimeGrid, SectionTitle, Avatar, BlueCheck, ClanTag, clanNameClass } from "@/components/lstream-ui";
import { DEFAULT_CLAN_ICON } from "@/lib/clanIcons";
import { STAFF_BADGE } from "@/lib/lstream";
import { ProfileSheet } from "@/components/ProfileSheet";
import { CharacterRow } from "@/components/CharacterRow";
import { RequestButtons } from "@/components/RequestButtons";
import { ChatPanel, type ChatMsg } from "@/components/ChatPanel";
import { NobarBar } from "@/components/NobarBar";
import { CardCarousel, CatalogScreen, type CardT as CatalogCard, type CatalogKind, type PickSource as CatalogPickSource } from "@/components/CatalogRows";
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
  TrendingUp,
} from "lucide-react";
// Ikon chrome Home memakai gaya SF Symbols (alias nama lama → JSX tetap utuh).
import {
  SearchIcon as Search,
  BellIcon as Bell,
  ChevronLeftIcon as ChevronLeft,
  ChevronRightIcon as ChevronRight,
  ChevronDownIcon as ChevronDown,
  ChevronUpIcon as ChevronUp,
  TrophyIcon as Trophy,
  GiftIcon as Gift,
  SwipeIcon as ArrowLeftRight,
  SlidersIcon as SlidersHorizontal,
  InfoIcon as Info,
  SparklesIcon as Sparkles,
  GemIcon as Gem,
  CrownIcon,
} from "@/components/ios-icons";
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
  /** Asal kartu: "sanka" = slug donghua, bukan MAL id anime. */
  source?: CatalogPickSource;
  /** Viewer count dari backend. */
  viewers?: number;
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

const DUMMY_TOP: AnimeCardT[] = Array.from({ length: 100 }, (_, i) => ({
  id: String(i + 1),
  title: `Top ${i + 1} Dummy Title ${
    i < 5 ? ["Gangsta", "Bokuto", "Hachi", "Kariya", "Raito"][i] : "Populer"
  }`,
  image: "",
  viewers: (i + 1) * 1200 + (i % 3) * 900,
}));

export default function Home() {
  // Set setiap kali Home dibuka (termasuk setelah keluar dari halaman lain),
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
  // Genre sudah dipindah ke layar Pencarian, jadi disini hanya penyaring
  // tampilan tanpa menarik genre.
  const genres = useAction(api.anime.animeGenres);

  const [heroList, setHeroList] = useState<AnimeCardT[]>([]);
  const [topList, setTopList] = useState<AnimeCardT[]>([]);
  const [todayList, setTodayList] = useState<AnimeCardT[]>([]);
  const [foryouList, setForyouList] = useState<AnimeCardT[]>([]);
  const [genreList, setGenreList] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [heroIdx, setHeroIdx] = useState(0);
  // Geser hero pakai tangan (tanpa tombol panah).
  const heroTouchX = useRef<number | null>(null);
  const heroSwipe = (dir: 1 | -1) => {
    if (heroItems.length < 2) return;
    setHeroIdx((i) => (i + dir + heroItems.length) % heroItems.length);
  };

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

  // Tab di sini cuma penyaring tampilan (tidak menarik genre).
  const tabs = useMemo(
    () => [
      { id: "semua", label: "Semua" },
      { id: "terbaru", label: "Terbaru" },
      { id: "populer", label: "Populer" },
      { id: "kontroversi", label: "Kontroversi" },
    ],
    [],
  );

  return (
    <div className="pb-8">
      {/* 1) YORUNIME PREMIUM — card ke /premium */}
      <button
        onClick={() => navigate("/premium")}
        className="fade-enter mt-4 flex w-full items-center gap-3 rounded-3xl border border-gold/30 bg-gradient-to-r from-gold/15 via-secondary/40 to-secondary/40 p-3.5 text-left shadow-[0_0_24px_-8px] shadow-gold/40 transition hover:border-gold/60"
      >
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full border border-gold/40 bg-gold/15 shadow-[0_0_16px_-4px] shadow-gold/50">
          <CrownIcon className="size-7 text-gold" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-mono text-[11px] font-bold tracking-[0.2em] text-gold">
            PREMIUM
          </span>
          <span className="mt-0.5 block text-xs leading-snug text-zinc-300">
            Premium mulai dari 7.000 — baca manga dan manhwa sepuasnya
          </span>
        </span>
        <span className="flex shrink-0 items-center rounded-xl bg-gold px-3.5 py-2 text-xs font-bold text-black glow-btn">
          <GiftIcon className="size-3.5" />
          <span className="label">Buka Premium</span>
        </span>
      </button>

      {/* 2) DUAL TAB HORIZONTAL */}
      <div className="fade-enter mt-4 flex flex-wrap items-end gap-2 pb-1">
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {tabs.map((t, i) => (
            <button
              key={t.id}
              onClick={() => {
                setActiveTab(i);
                setShowSearch(false);
              }}
              className={cn(
                "shrink-0 first:rounded-s-2xl last:rounded-e-2xl border border-white/10 bg-card px-3 py-1.5 text-xs font-semibold transition",
                activeTab === i
                  ? "border-gold-strong bg-gold-soft text-gold-strong shadow-[0_0_14px_-4px] shadow-gold/40"
                  : "border-border bg-secondary/40 text-muted-foreground hover:border-foreground/40",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowMusic(true)}
          className="shrink-0 flex size-11 items-center justify-center rounded-full border border-white/10 bg-card text-zinc-400 transition hover:border-foreground/40 hover:text-primary"
          aria-label="Buka pemutar musik"
        >
          <span className="flex size-7 items-center justify-center">
            <Play className="size-4" aria-hidden />
          </span>
        </button>
      </div>

      {/* 3) HERO BANNER DG LEADERBOARD + VIEWER COUNT */}
      {loading ? (
        <HeroSkeleton />
      ) : heroItems.length > 0 ? (
        <div
          className="fade-enter relative mt-3 touch-pan-y overflow-hidden rounded-2xl border border-white/10"
          onPointerDown={(e) => {
            heroTouchX.current = e.clientX;
          }}
          onPointerUp={(e) => {
            if (heroTouchX.current === null) return;
            const dx = e.clientX - heroTouchX.current;
            heroTouchX.current = null;
            if (Math.abs(dx) > 48) heroSwipe(dx < 0 ? 1 : -1);
          }}
          onPointerCancel={() => {
            heroTouchX.current = null;
          }}
        >
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
                  <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-black text-white">
                        {a.status ?? "Ongoing"}
                      </span>
                      <span className="rounded-md bg-gold-soft px-1.5 py-0.5 text-[10px] font-black text-gold-strong">
                        New
                      </span>
                      <span className="flex items-center gap-1 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-black text-white">
                        <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                          <circle cx="12" cy="12" r="2.5" />
                        </svg>
                        {(a.viewers ?? 0).toLocaleString("id-ID")} nonton
                      </span>
                    </div>
                    <button
                      onClick={() => setShowLeaderboard(true)}
                      className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-zinc-300 transition hover:border-foreground/40 hover:text-foreground"
                    >
                      <Trophy className="size-3.5" />
                      <span className="hidden sm:inline">Leaderboard</span>
                    </button>
                  </div>

                  <h3 className="mt-1.5 text-lg font-black">{a.title}</h3>
                  <p className="mt-1 line-clamp-4 text-xs leading-relaxed text-zinc-300">
                    {a.synopsis ?? "Sinopsis belum tersedia."}
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-2">
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
          {/* Geser pakai tangan saja — tanpa tombol panah */}
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
      {topList && topList.length > 0 && (
        <button
          onClick={() => setShowLeaderboard(true)}
          className="fade-enter mt-3 w-full rounded-2xl border border-white/10 bg-card p-3 text-left transition hover:border-foreground/40"
        >
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 font-bold">
              <Trophy className="size-4 text-primary" /> Leaderboard
            </p>
            <span className="text-xs text-muted-foreground">lihat semua ›</span>
          </div>
          <HomeLeaderboardPreview />
        </button>
      ) : null}

      {/* 5) CHAT BARENG — rounded, tanpa garis pembatas */}
      <button
        onClick={() => setShowChat(true)}
        className="fade-enter mt-3 w-full rounded-3xl border border-white/10 bg-card p-3 text-left transition hover:border-foreground/40"
      >
        <div className="flex items-center justify-between pb-2">
          <p className="flex items-center gap-2 font-bold">
            <span className="flex size-8 items-center justify-center rounded-xl bg-primary/15">
              <MessageSquare className="size-5 text-primary" aria-hidden />
            </span>
            Chat bareng
          </p>
          <span className="text-xs text-muted-foreground">buka ›</span>
        </div>
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

      {/* 7b) TOP 100 — ditampilkan ketika data hero kosong (fallback dummy). */}
      {!loading && topList.length === 0 && (
        <div className="fade-enter mt-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-base font-extrabold tracking-tight">
              <Trophy className="size-4 text-primary" />
              Top 100
            </p>
            <span className="text-[11px] text-muted-foreground">
              data (100)
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {DUMMY_TOP.slice(0, 100).map((a, i) => (
              <button
                key={a.id}
                onClick={() => openAnime(a.id, a.title)}
                className={cn(
                  "group relative aspect-[2/3] overflow-hidden rounded-2xl border border-white/10",
                  i === 0 && "rounded-t-2xl rounded-b-lg",
                  i === 1 && "rounded-b-2xl",
                  i === 98 && "rounded-t-2xl rounded-b-lg",
                  i === 99 && "rounded-b-2xl",
                )}
              >
                {a.image ? (
                  <img
                    src={a.image}
                    alt={a.title}
                    loading="lazy"
                    className="size-full object-cover transition duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="size-full bg-muted" />
                )}
                {/* Podium 1-3 jadi bundar-bulat */}
                <span
                  className={cn(
                    "absolute left-1.5 top-1.5 flex size-7 items-center justify-center rounded-lg font-black text-black",
                    i === 0
                      ? "bg-yellow-400"
                      : i === 1
                        ? "bg-zinc-300"
                        : "bg-amber-600",
                  )}
                >
                  {i + 1}
                </span>
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-1.5 pt-4">
                  <p className="line-clamp-2 text-left text-[10px] font-semibold leading-tight text-white">
                    {a.title}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Anime Hot — Top 1-3 yang lagi panas */}
      {!loading && topList.length > 0 && (
        <div className="fade-enter mt-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-base font-extrabold tracking-tight">
              <span className="text-lg" aria-hidden>🔥</span> Anime Hot
            </p>
            <button
              onClick={() =>
                setCatalog({ kind: "popular", title: "Anime Hot", items: topList as unknown as CatalogCard[] })
              }
              className="text-xs font-semibold text-primary"
            >
              Lihat selengkap ›
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {topList.slice(0, 3).map((a, i) => (
              <button
                key={a.id}
                onClick={() => openAnime(a.id, a.title, a.source)}
                className="group relative aspect-[2/3] overflow-hidden rounded-2xl border border-white/10"
              >
                {a.image ? (
                  <img
                    src={a.image}
                    alt={a.title}
                    loading="lazy"
                    className="size-full object-cover transition duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="size-full bg-muted" />
                )}
                <span
                  className={cn(
                    "absolute left-1.5 top-1.5 flex size-7 items-center justify-center rounded-lg font-black text-black",
                    i === 0 ? "bg-yellow-400" : i === 1 ? "bg-zinc-300" : "bg-amber-600",
                  )}
                >
                  {i + 1}
                </span>
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-1.5 pt-4">
                  <p className="line-clamp-2 text-left text-[10px] font-semibold leading-tight text-white">
                    {a.title}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

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
        />
