import { Component, useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/AppLayout";
import { AnimeGrid, SectionTitle, Avatar } from "@/components/lstream-ui";
import { ChatPanel, type ChatMsg } from "@/components/ChatPanel";
import {
  Crown,
  Search,
  ChevronLeft,
  ChevronRight,
  Heart,
  Send,
  Trophy,
  X,
  Gem,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DAYS_ID, timeAgo } from "@/lib/lstream";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";

type AnimeCardT = {
  id: string;
  title: string;
  image: string;
  score?: number;
  status?: string;
  synopsis?: string;
};

/** Cegah error satu useQuery (mis. Server Error) membunuh seluruh halaman. */
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

function ChipsSkeleton() {
  return (
    <div className="flex flex-wrap gap-1.5">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="skeleton h-7 w-20 rounded-full" />
      ))}
    </div>
  );
}

// ------------------------------------------------------------ home body ----

function HomeContent() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [pickId, setPickId] = useState<string | null>(null);

  const hero = useAction(api.anime.animeOngoing);
  const top = useAction(api.anime.animeTop);
  const today = useAction(api.anime.animeTrendingToday);
  const forYou = useAction(api.anime.animeForYou);
  const genres = useAction(api.anime.animeGenres);
  const schedule = useAction(api.anime.animeSchedule);

  const [heroList, setHeroList] = useState<AnimeCardT[]>([]);
  const [topList, setTopList] = useState<AnimeCardT[]>([]);
  const [todayList, setTodayList] = useState<AnimeCardT[]>([]);
  const [foryouList, setForyouList] = useState<AnimeCardT[]>([]);
  const [genreList, setGenreList] = useState<{ id: string; name: string }[]>([]);
  const [sched, setSched] = useState<Record<string, AnimeCardT[]>>({});
  const [loading, setLoading] = useState(true);
  const [genresOpen, setGenresOpen] = useState(false);
  const [activeGenre, setActiveGenre] = useState<string | null>(null);
  const [genreAnimes, setGenreAnimes] = useState<AnimeCardT[]>([]);
  const [genreLoading, setGenreLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<AnimeCardT[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [heroIdx, setHeroIdx] = useState(0);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showChat, setShowChat] = useState(false);

  const loadGenre = useAction(api.anime.animeByGenre);
  const searchAnime = useAction(api.anime.animeSearch);

  // Muat data katalog (backend punya fallback statis, jadi selalu ada hasil)
  useEffect(() => {
    let alive = true;
    Promise.allSettled([
      hero({ page: 1 }),
      top({}),
      today({}),
      forYou({ seed: (user?.name?.length ?? 0) + 3 }),
      genres({}),
      schedule({}),
    ]).then(([rHero, rTop, rToday, rForYou, rGenres, rSched]) => {
      if (!alive) return;
      if (rHero.status === "fulfilled") setHeroList((rHero.value as AnimeCardT[]) ?? []);
      if (rTop.status === "fulfilled") setTopList((rTop.value as AnimeCardT[]) ?? []);
      if (rToday.status === "fulfilled") setTodayList((rToday.value as AnimeCardT[]) ?? []);
      if (rForYou.status === "fulfilled") setForyouList((rForYou.value as AnimeCardT[]) ?? []);
      if (rGenres.status === "fulfilled")
        setGenreList((rGenres.value as { id: string; name: string }[]) ?? []);
      if (rSched.status === "fulfilled")
        setSched((rSched.value as Record<string, AnimeCardT[]>) ?? {});
      setLoading(false);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doSearch = async () => {
    if (!query.trim()) {
      setSearchResults(null);
      return;
    }
    setSearching(true);
    try {
      const r = (await searchAnime({ q: query })) as AnimeCardT[];
      setSearchResults(r ?? []);
    } catch {
      setSearchResults([]);
    }
    setSearching(false);
  };

  const pickGenre = async (g: { id: string; name: string }) => {
    if (activeGenre === g.id) {
      setActiveGenre(null);
      return;
    }
    setActiveGenre(g.id);
    setGenreLoading(true);
    try {
      const r = (await loadGenre({ genreId: g.id })) as AnimeCardT[];
      setGenreAnimes(r ?? []);
    } catch {
      setGenreAnimes([]);
    }
    setGenreLoading(false);
  };

  const heroItems = heroList.slice(0, 2);
  const updateNews = heroList.slice(0, 8);
  const favQuery = useQuery(api.activities.myFavorites, user ? {} : "skip");

  // Auto-rotate hero
  useEffect(() => {
    if (heroItems.length < 2) return;
    const t = setInterval(() => setHeroIdx((i) => (i + 1) % heroItems.length), 6000);
    return () => clearInterval(t);
  }, [heroItems.length]);

  const openAnime = (id: string) => setPickId(id);

  return (
    <div>
      {/* 1) BELI PREMIUM — di bawah panel akun */}
      <button
        onClick={() => navigate("/premium")}
        className="pop-enter mt-3 flex w-full items-center gap-3 rounded-2xl border border-amber-300/40 bg-gradient-to-r from-amber-300/15 via-amber-300/5 to-transparent p-3.5 text-left transition hover:border-amber-300/70"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-300/15">
          <Crown className="size-6 text-amber-300" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold">Beli Premium</span>
          <span className="block text-xs text-zinc-400">
            Mulai 7 ribuan aja — DANA / QRIS / GoPay / VA
          </span>
        </span>
        <span className="rounded-full bg-amber-300 px-3.5 py-1.5 text-xs font-bold text-black">
          Beli
        </span>
      </button>

      {/* 2) HERO BANNER + LEADERBOARD + TOP GIVE PREMIUM */}
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
                className="relative min-h-48 bg-cover bg-center"
                style={{
                  backgroundImage: `linear-gradient(90deg, rgba(0,0,0,.88) 20%, rgba(0,0,0,.15)), url(${a.image})`,
                }}
              >
                <div className="max-w-[70%] p-4">
                  <span className="rounded-md bg-amber-300/90 px-1.5 py-0.5 text-[10px] font-black text-black">
                    {a.status ?? "Ongoing"}
                  </span>
                  <h3 className="mt-1.5 line-clamp-1 text-lg font-black">{a.title}</h3>
                  <p className="mt-1 line-clamp-2 text-xs text-zinc-300">
                    {a.synopsis ?? "Sinopsis belum tersedia."}
                  </p>
                  <div className="mt-2.5 flex gap-2">
                    <button
                      onClick={() => openAnime(a.id)}
                      className="rounded-full bg-amber-300 px-4 py-1.5 text-xs font-bold text-black transition hover:bg-amber-200"
                    >
                      Lihat detail
                    </button>
                    <button
                      onClick={() => navigate(`/nonton?anime=${a.id}`)}
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
              className="rounded-full bg-black/60 p-1.5 text-white transition hover:bg-black/80"
              onClick={() => setHeroIdx((i) => (i + heroItems.length - 1) % heroItems.length)}
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              className="rounded-full bg-black/60 p-1.5 text-white transition hover:bg-black/80"
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
                  i === heroIdx ? "w-5 bg-amber-300" : "w-2 bg-white/30",
                )}
              />
            ))}
          </div>
        </div>
      ) : null}

      {/* Leaderboard XP */}
      <button
        onClick={() => setShowLeaderboard(true)}
        className="fade-enter mt-3 w-full rounded-2xl border border-white/10 bg-card p-3 text-left transition hover:border-amber-300/40"
      >
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 font-bold">
            <Trophy className="size-4 text-amber-300" /> Leaderboard XP
          </p>
          <span className="text-xs text-muted-foreground">lihat semua ›</span>
        </div>
        <HomeLeaderboardPreview />
      </button>

      {/* Top Give Premium */}
      <QueryBoundary label="Gagal memuat Top Give">
        <TopGiveCard />
      </QueryBoundary>

      {/* 3) CHAT BARENG */}
      <button
        onClick={() => setShowChat(true)}
        className="fade-enter mt-3 w-full rounded-2xl border border-white/10 bg-card p-3 text-left transition hover:border-amber-300/40"
      >
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 font-bold">
            💬 Chat bareng
          </p>
          <span className="text-xs text-muted-foreground">buka ›</span>
        </div>
        <QueryBoundary label="Gagal memuat chat">
          <GlobalChatPreview />
        </QueryBoundary>
      </button>

      {/* 4) CARI ANIME */}
      <SectionTitle>Cari Anime</SectionTitle>
      <div className="flex w-full items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          id="ls-search-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void doSearch()}
          placeholder="Contoh: naruto, frieren…"
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              setSearchResults(null);
            }}
          >
            <X className="size-4 text-muted-foreground" />
          </button>
        )}
        <button
          onClick={() => void doSearch()}
          className="rounded-full bg-amber-300 px-3 py-1 text-xs font-bold text-black"
        >
          Cari
        </button>
      </div>
      {searching && (
        <p className="mt-2 text-center text-xs text-muted-foreground">Mencari…</p>
      )}
      {searchResults !== null && !searching && (
        <div className="mt-3">
          {searchResults.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Anime tidak ditemukan
            </p>
          ) : (
            <AnimeGrid items={searchResults} onPick={openAnime} newIds={new Set()} />
          )}
        </div>
      )}

      {/* 5) GENRE */}
      <SectionTitle>Genre</SectionTitle>
      {loading ? (
        <ChipsSkeleton />
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            {(genresOpen ? genreList : genreList.slice(0, 6)).map((g) => (
              <button
                key={g.id}
                onClick={() => void pickGenre(g)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition",
                  activeGenre === g.id
                    ? "border-amber-300 bg-amber-300/15 text-amber-200"
                    : "border-border text-muted-foreground hover:border-amber-300/50",
                )}
              >
                {g.name}
              </button>
            ))}
            {genreList.length > 6 && (
              <button
                onClick={() => setGenresOpen((v) => !v)}
                className="rounded-full border border-amber-300/50 px-3 py-1 text-xs font-medium text-amber-200"
              >
                {genresOpen ? "Tutup" : `${genreList.length} genre / semua genre`}
              </button>
            )}
          </div>
          {activeGenre && (
            <div className="mt-3">
              {genreLoading ? (
                <GridSkeleton count={6} />
              ) : (
                <AnimeGrid items={genreAnimes} onPick={openAnime} newIds={new Set()} />
              )}
            </div>
          )}
        </>
      )}

      {/* 6) ANIME-ANIME */}
      {searchResults === null && !activeGenre && (
        <>
          <SectionTitle>Top Anime</SectionTitle>
          {loading ? <GridSkeleton /> : <AnimeGrid items={topList.slice(0, 10)} onPick={openAnime} ranked newIds={new Set()} />}

          <SectionTitle>Top Anime Hari Ini</SectionTitle>
          {loading ? <GridSkeleton /> : <AnimeGrid items={todayList.slice(0, 10)} onPick={openAnime} ranked newIds={new Set()} />}

          <SectionTitle>Untuk Kamu</SectionTitle>
          {loading ? <GridSkeleton count={12} /> : <AnimeGrid items={foryouList.slice(0, 12)} onPick={openAnime} newIds={new Set()} />}
        </>
      )}

      <SectionTitle>Anime Update News</SectionTitle>
      <p className="mb-2 text-xs text-muted-foreground">Episode baru rilis hari ini</p>
      {loading ? (
        <div className="flex gap-2.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-44 w-28 shrink-0 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="thin-scroll flex gap-2.5 overflow-x-auto pb-1">
          {updateNews.map((a) => (
            <button
              key={a.id}
              onClick={() => openAnime(a.id)}
              className="relative w-28 shrink-0 overflow-hidden rounded-xl border border-border/60 text-left transition hover:border-amber-300/50"
            >
              <img src={a.image} alt="" className="aspect-[2/3] w-full object-cover" />
              <span className="absolute left-1 top-1 rounded bg-emerald-500 px-1 text-[10px] font-bold text-black">
                New
              </span>
              <p className="line-clamp-2 bg-black/60 p-1.5 text-[10px] leading-3">{a.title}</p>
            </button>
          ))}
        </div>
      )}

      <SectionTitle>Jadwal Update Anime</SectionTitle>
      <div className="rounded-2xl border border-border bg-card p-3">
        <div className="flex justify-end">
          <button
            onClick={() => navigate("/akun?tab=favorite")}
            className="flex items-center gap-1 rounded-full border border-amber-300/40 px-3 py-1 text-xs text-amber-200"
          >
            <Heart className="size-3.5" /> Favorite
          </button>
        </div>
        <div className="mt-2 space-y-2">
          {loading
            ? Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="skeleton h-10 w-full rounded-xl" />
              ))
            : DAYS_ID.map((d) => (
                <ScheduleRow
                  key={d}
                  day={d}
                  animes={sched[d.toLowerCase()] ?? []}
                  onPick={openAnime}
                />
              ))}
        </div>
      </div>

      {favQuery && favQuery.length > 0 && (
        <>
          <SectionTitle>Favorite Kamu</SectionTitle>
          <div className="thin-scroll flex gap-2.5 overflow-x-auto pb-1">
            {favQuery.map((f: any) => (
              <button
                key={f._id}
                onClick={() => openAnime(f.animeId)}
                className="relative w-28 shrink-0 overflow-hidden rounded-xl border border-border/60"
              >
                <img src={f.animeImage ?? ""} alt="" className="aspect-[2/3] w-full object-cover" />
                <Heart className="absolute right-1 top-1 size-4 fill-red-500 text-red-500" />
                <p className="line-clamp-2 bg-black/60 p-1.5 text-left text-[10px] leading-3">
                  {f.animeTitle}
                </p>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Screens */}
      {showLeaderboard && (
        <LeaderboardScreen onClose={() => setShowLeaderboard(false)} />
      )}
      {showChat && <GlobalChatScreen onClose={() => setShowChat(false)} />}
      {pickId && <AnimeDetailScreen animeId={pickId} onClose={() => setPickId(null)} />}
    </div>
  );
}

// ------------------------------------------------------ top give premium ----

function TopGiveCard() {
  const data = useQuery(api.account.topGive, { limit: 3 });
  return (
    <div className="fade-enter mt-3 w-full rounded-2xl border border-white/10 bg-card p-3 text-left">

      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 font-bold">
          <Gem className="size-4 text-amber-300" /> Top Give Premium
        </p>
        <span className="text-xs text-muted-foreground">pembagi terbaik ›</span>
      </div>
      {!data ? (
        <div className="mt-2 space-y-1.5">
          <div className="skeleton h-10 w-full rounded-xl" />
          <div className="skeleton h-10 w-full rounded-xl" />
        </div>
      ) : data.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Belum ada yang bagi premium — jadilah yang pertama lewat chat! 🎁
        </p>
      ) : (
        <div className="mt-2 space-y-1.5">
          {data.map((g: any, i: number) => (
            <div
              key={g.userId}
              className="flex items-center gap-3 rounded-xl border border-border/70 bg-secondary/40 p-2"
            >
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-md text-xs font-black",
                  i === 0
                    ? "bg-amber-300 text-black"
                    : i === 1
                      ? "bg-zinc-300 text-black"
                      : "bg-amber-700 text-white",
                )}
              >
                {i + 1}
              </span>
              <Avatar src={g.image} seed={g.username} className="size-8" />
              <p className="min-w-0 flex-1 truncate text-sm font-semibold">{g.username}</p>
              <span className="flex items-center gap-1 text-xs text-amber-300">
                <Crown className="size-3.5" /> {g.days} hari dibagi
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------ leaderboard ----

function LeaderEntryRow({
  rank,
  username,
  image,
  xp,
}: {
  rank: number;
  username?: string;
  image?: string;
  xp: number;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-secondary/40 p-2.5">
      <span className="w-6 text-center text-sm font-bold text-amber-300">{rank}</span>
      <Avatar src={image} seed={username} className="size-10" />
      <div>
        <p className="text-sm font-semibold">{username ?? "user"}</p>
        <p className="text-xs text-muted-foreground">{xp.toLocaleString("id-ID")} XP</p>
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
    <div className="flex flex-col items-center">
      <Avatar src={image} seed={username} className="size-12" />
      <p className="mt-1 line-clamp-1 max-w-full text-xs font-semibold">{username ?? "user"}</p>
      <p className="text-[10px] text-amber-300">{xp.toLocaleString("id-ID")} XP</p>
      <div
        className={cn(
          "mt-1.5 flex w-full items-start justify-center rounded-t-xl border border-b-0 border-amber-300/40 bg-gradient-to-t from-amber-300/10 to-amber-300/25 pt-1 text-lg font-black text-amber-200",
          height,
        )}
      >
        {rank}
      </div>
    </div>
  );
}

export function LeaderboardList({ period }: { period: string }) {
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

function LeaderboardScreen({ onClose }: { onClose: () => void }) {
  const [period, setPeriod] = useState("harian");
  return (
    <ScreenWrapper title="Leaderboard XP" onClose={onClose}>
      <div className="mb-3 flex gap-2">
        {["harian", "mingguan", "bulanan"].map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={cn(
              "relative flex-1 rounded-lg py-2 text-sm font-medium capitalize",
              period === p ? "text-amber-200" : "text-muted-foreground",
            )}
          >
            {p}
            {period === p && (
              <span className="absolute inset-x-3 bottom-0 h-0.5 rounded bg-amber-300" />
            )}
          </button>
        ))}
      </div>
      <LeaderboardList period={period} />
    </ScreenWrapper>
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

// ------------------------------------------------------ chat bareng ----

function GlobalChatPreview() {
  const msgs = useQuery(api.chat.listMessages, { kind: "global", limit: 6 });
  if (!msgs)
    return (
      <div className="mt-2 space-y-1.5">
        <div className="skeleton h-6 w-3/4 rounded" />
        <div className="skeleton h-6 w-1/2 rounded" />
      </div>
    );
  const visible = msgs.slice(-6);
  return (
    <div className="space-y-1.5">
      {visible.length === 0 && (
        <p className="py-2 text-center text-xs text-muted-foreground">
          Belum ada chat — jadi yang pertama!
        </p>
      )}
      {visible.map((m) => (
        <div key={m._id} className="flex items-center gap-2 text-xs">
          <Avatar src={m.image} seed={m.username} className="size-6" />
          <p className="truncate">
            <span className="font-semibold text-amber-200">{m.username}</span>
            <span className="text-muted-foreground"> : </span>
            <span className="text-zinc-300">
              {m.premiumGive ? "🎁 give premium" : m.text ?? "[foto]"}
            </span>
          </p>
        </div>
      ))}
    </div>
  );
}

function GlobalChatScreen({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"chat" | "clan" | "teman">("chat");
  const msgs = useQuery(api.chat.listMessages, { kind: "global", limit: 100 });
  const send = useMutation(api.chat.sendMessage);
  const myClan = useQuery(api.clans.myMembership, user ? {} : "skip");
  const clanMsgs = useQuery(
    api.chat.listMessages,
    myClan ? { kind: "clan", clanId: myClan.clanId as Id<"clans">, limit: 100 } : "skip",
  );
  const friends = useQuery(api.friends.listFriends, user ? {} : "skip");
  const requests = useQuery(api.friends.listRequests, user ? {} : "skip");
  const respond = useMutation(api.friends.respondRequest);
  const sendReq = useMutation(api.friends.sendFriendRequest);
  const [dmPeer, setDmPeer] = useState<{ id: Id<"users">; name: string } | null>(null);
  const dmMsgs = useQuery(
    api.chat.listMessages,
    dmPeer ? { kind: "dm", peerId: dmPeer.id, limit: 100 } : "skip",
  );
  const meId = user?._id as string;
  void clanMsgs;

  return (
    <ScreenWrapper title="Chat" onClose={onClose}>
      <div className="mb-2 flex gap-2">
        {(["chat", "clan", "teman"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "relative flex-1 rounded-lg py-2 text-sm font-medium capitalize",
              tab === t ? "text-white" : "text-muted-foreground",
            )}
          >
            {t === "chat" ? "Chat" : t}
            {tab === t && (
              <span className="absolute inset-x-4 bottom-0 h-0.5 rounded bg-amber-300" />
            )}
          </button>
        ))}
      </div>

      {tab === "chat" && (
        <div className="h-[65vh] overflow-hidden rounded-2xl border border-border bg-card">
          {msgs && user ? (
            <ChatPanel
              kind="global"
              messages={msgs as unknown as ChatMsg[]}
              meId={meId}
              onSend={async (p) => {
                await send({ kind: "global", ...p });
              }}
            />
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">Memuat…</p>
          )}
        </div>
      )}

      {tab === "clan" &&
        (myClan ? (
          <div className="space-y-2">
            <button
              onClick={() => {
                onClose();
                navigate("/clan");
              }}
              className="w-full rounded-xl border border-amber-300/40 p-3 text-left text-sm transition hover:border-amber-300/70"
            >
              {myClan.clan.tagIcon} [{myClan.clan.tag}] {myClan.clan.name} — buka chat clan ›
            </button>
            <p className="text-xs text-muted-foreground">
              Chat clan lengkap tersedia di halaman clan.
            </p>
          </div>
        ) : (
          <div className="py-10 text-center">
            <p className="font-semibold">Kamu belum join clan</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Join clan untuk mendapatkan Sacret dan buat clan mu nomor 1
            </p>
            <button
              onClick={() => {
                onClose();
                navigate("/clan");
              }}
              className="mt-4 rounded-full bg-amber-300 px-5 py-2 text-sm font-bold text-black transition hover:bg-amber-200"
            >
              Lihat clan
            </button>
          </div>
        ))}

      {tab === "teman" && (
        <div className="space-y-3">
          <div>
            <p className="mb-1.5 text-sm font-semibold">Teman</p>
            {friends && friends.length > 0 ? (
              friends.map((f: any) => (
                <div
                  key={f.userId}
                  className="mb-1.5 flex items-center gap-3 rounded-xl border border-border/70 bg-secondary/40 p-2.5"
                >
                  <Avatar src={f.image} seed={f.username} className="size-10" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{f.username}</p>
                    <button
                      className="text-xs text-amber-200 underline"
                      onClick={() => setDmPeer({ id: f.userId as Id<"users">, name: f.username })}
                    >
                      Chat sekarang!
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">Belum punya teman</p>
            )}
          </div>
          <div>
            <p className="mb-1.5 text-sm font-semibold">Request</p>
            {requests && requests.length > 0 ? (
              requests.map((r: any) => (
                <div
                  key={r.requestId}
                  className="mb-1.5 flex items-center gap-3 rounded-xl border border-border/70 bg-secondary/40 p-2.5"
                >
                  <Avatar src={r.image} seed={r.username} className="size-10" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{r.username}</p>
                    <p className="text-xs text-muted-foreground">Meminta request</p>
                  </div>
                  <ButtonSmall
                    label="Terima"
                    onClick={async () => {
                      await respond({ requestId: r.requestId, accept: true });
                    }}
                  />
                  <ButtonSmall
                    label="Tolak"
                    onClick={async () => {
                      await respond({ requestId: r.requestId, accept: false });
                    }}
                  />
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">Tidak ada request</p>
            )}
          </div>
          {dmPeer && (
            <DMScreen
              peer={dmPeer}
              msgs={(dmMsgs ?? []) as unknown as ChatMsg[]}
              meId={meId}
              onBack={() => setDmPeer(null)}
              onSend={async (p) => {
                await send({ kind: "dm", peerId: dmPeer.id, ...p });
              }}
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
        </div>
      )}
    </ScreenWrapper>
  );
}

function DMScreen({
  peer,
  msgs,
  meId,
  onBack,
  onSend,
  onAddFriend,
}: {
  peer: { id: Id<"users">; name: string };
  msgs: ChatMsg[];
  meId: string;
  onBack: () => void;
  onSend: (p: any) => Promise<void>;
  onAddFriend: () => void;
}) {
  return (
    <div className="screen-enter fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex items-center gap-3 border-b border-border p-3">
        <button onClick={onBack} className="rounded-full border border-border p-1.5">
          <ChevronLeft className="size-4" />
        </button>
        <Avatar seed={peer.name} className="size-9" />
        <p className="font-semibold">{peer.name}</p>
        <button
          onClick={onAddFriend}
          className="ml-auto rounded-full border border-amber-300/50 px-3 py-1 text-xs text-amber-200"
        >
          + Teman
        </button>
      </div>
      <div className="flex-1 overflow-hidden">
        <ChatPanel kind="dm" peerId={peer.id} messages={msgs} meId={meId} onSend={onSend} />
      </div>
    </div>
  );
}

function ButtonSmall({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-full bg-amber-300 px-3 py-1 text-xs font-bold text-black transition hover:bg-amber-200"
    >
      {label}
    </button>
  );
}

// --------------------------------------------------------- schedule ----

function ScheduleRow({
  day,
  animes,
  onPick,
}: {
  day: string;
  animes: AnimeCardT[];
  onPick: (id: string) => void;
}) {
  return (
    <details className="group rounded-xl border border-border/60 bg-secondary/30 p-2">
      <summary className="cursor-pointer list-none text-sm font-semibold">
        {day}{" "}
        <span className="text-xs text-muted-foreground">({animes.length} anime)</span>
      </summary>
      <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
        {animes.slice(0, 12).map((a) => (
          <AnimeGridItem key={a.id} a={a} onPick={onPick} />
        ))}
      </div>
    </details>
  );
}

function AnimeGridItem({ a, onPick }: { a: AnimeCardT; onPick: (id: string) => void }) {
  return (
    <button
      onClick={() => onPick(a.id)}
      className="overflow-hidden rounded-lg border border-border/60 transition hover:border-amber-300/50"
    >
      <img src={a.image} alt="" className="aspect-[2/3] w-full object-cover" />
      <p className="line-clamp-2 bg-black/50 p-1 text-left text-[10px] leading-3">{a.title}</p>
    </button>
  );
}

// ------------------------------------------------------- screen wrap ----

export function ScreenWrapper({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="screen-enter fixed inset-0 z-50 overflow-y-auto bg-background">
      <div className="mx-auto max-w-2xl p-3">
        <div className="mb-3 mt-3 flex items-center gap-3">
          <button
            onClick={onClose}
            className="rounded-full border border-border p-2 transition hover:border-amber-300"
          >
            <ChevronLeft className="size-4" />
          </button>
          <h1 className="text-lg font-bold">{title}</h1>
        </div>
        {children}
      </div>
    </div>
  );
}

// ----------------------------------------------------- detail screen ----

function AnimeDetailScreen({ animeId, onClose }: { animeId: string; onClose: () => void }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const getDetail = useAction(api.anime.animeDetail);
  const isFav = useQuery(api.activities.isFavorite, user ? { animeId } : "skip");
  const toggleFav = useMutation(api.activities.toggleFavorite);
  const comments = useQuery(api.activities.listComments, { animeId });
  const postComment = useMutation(api.activities.postComment);
  const deleteComment = useMutation(api.activities.deleteComment);
  const [detail, setDetail] = useState<any>(null);
  const [synopsisOpen, setSynopsisOpen] = useState(false);
  const [episodeOrder, setEpisodeOrder] = useState<"first" | "last">("first");
  const [allEpisodes, setAllEpisodes] = useState(false);
  const [commentText, setCommentText] = useState("");

  useEffect(() => {
    getDetail({ id: animeId })
      .then((d: any) => setDetail(d))
      .catch(() => setDetail({ error: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animeId]);

  if (!detail)
    return (
      <ScreenWrapper title="Detail" onClose={onClose}>
        <div className="skeleton h-40 w-full rounded-2xl" />
        <div className="skeleton mt-3 h-8 w-full rounded" />
        <div className="skeleton mt-2 h-4 w-2/3 rounded" />
      </ScreenWrapper>
    );
  if (detail.error)
    return (
      <ScreenWrapper title="Detail" onClose={onClose}>
        <p className="py-16 text-center text-sm text-muted-foreground">Anime tidak ditemukan</p>
      </ScreenWrapper>
    );

  const eps: any[] = [...(detail.episodeList ?? [])];
  if (episodeOrder === "last") eps.reverse();
  const shownEps = allEpisodes ? eps : eps.slice(0, 10);

  return (
    <ScreenWrapper title="Detail Anime" onClose={onClose}>
      <div className="relative overflow-hidden rounded-2xl border border-border">
        <div
          className="h-40 bg-cover bg-center"
          style={{
            backgroundImage: `linear-gradient(0deg, rgba(0,0,0,.8), rgba(0,0,0,.15)), url(${detail.image})`,
          }}
        />
        <button
          className="absolute right-3 top-3 rounded-full bg-black/60 p-2"
          onClick={async () => {
            if (!user) return;
            const r = await toggleFav({
              animeId,
              animeTitle: detail.title,
              animeImage: detail.image,
            });
            toast.success(r.favorited ? "Ditambahkan ke favorite ❤️" : "Dihapus dari favorite");
          }}
        >
          <Heart className={cn("size-5", isFav ? "fill-red-500 text-red-500" : "text-white")} />
        </button>
        <div className="flex gap-3 bg-card p-3">
          <img
            src={detail.image}
            alt=""
            className="-mt-12 aspect-[2/3] w-24 rounded-xl border border-amber-300/40 object-cover"
          />
          <div className="min-w-0 flex-1">
            <h2 className="line-clamp-2 font-bold">{detail.title}</h2>
            <div className="mt-1 flex flex-wrap gap-1">
              {(detail.genres ?? []).slice(0, 4).map((g: string) => (
                <span
                  key={g}
                  className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground"
                >
                  {g}
                </span>
              ))}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {detail.rating ?? "Rating 13+"} • {detail.studio ?? "Studio tidak diketahui"}
            </p>
            <span
              className={cn(
                "mt-1 inline-block rounded px-2 py-0.5 text-[10px] font-bold",
                detail.status === "Completed"
                  ? "bg-emerald-500/20 text-emerald-300"
                  : detail.status === "OVA" || detail.status === "Movie"
                    ? "bg-purple-500/20 text-purple-300"
                    : "bg-amber-300/20 text-amber-200",
              )}
            >
              {detail.status ?? "Ongoing"}
            </span>
          </div>
        </div>
      </div>

      <button
        onClick={() => navigate(`/nonton?anime=${animeId}`)}
        className="mt-3 w-full rounded-xl bg-amber-300 py-3 font-bold text-black transition hover:bg-amber-200"
      >
        ▶ Menonton
      </button>

      <SectionTitle>Sinopsis</SectionTitle>
      <p className={cn("text-sm leading-6 text-zinc-300", !synopsisOpen && "line-clamp-3")}>
        {detail.synopsis ?? "Sinopsis belum tersedia."}
      </p>
      <button
        onClick={() => setSynopsisOpen((v) => !v)}
        className="mt-1 text-xs font-medium text-amber-200 underline"
      >
        {synopsisOpen ? "Tutup" : "Baca selengkapnya"}
      </button>

      <SectionTitle>Episode</SectionTitle>
      <div className="mb-2 flex items-center gap-2">
        <button
          onClick={() => setEpisodeOrder(episodeOrder === "first" ? "last" : "first")}
          className="rounded-full border border-border px-3 py-1 text-xs"
        >
          {episodeOrder === "first" ? "Terlama dulu ↓" : "Terbaru dulu ↑"}
        </button>
      </div>
      {eps.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted-foreground">
          Daftar episode belum tersedia
        </p>
      ) : (
        <div className="space-y-1.5">
          {shownEps.map((e: any) => (
            <button
              key={e.id}
              onClick={() => navigate(`/nonton?anime=${animeId}&ep=${e.id}`)}
              className="flex w-full items-center gap-3 rounded-xl border border-border/60 bg-secondary/30 p-2.5 text-left transition hover:border-amber-300/50"
            >
              <span className="flex size-9 items-center justify-center rounded-lg bg-amber-300/15 text-sm font-bold text-amber-200">
                {e.number}
              </span>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 text-sm font-medium">{e.title}</p>
                <p className="text-xs text-muted-foreground">{e.duration ?? "24 menit"}</p>
              </div>
              <span className="text-[10px] text-muted-foreground">
                {e.aired ? new Date(e.aired).toLocaleDateString("id-ID") : ""}
              </span>
            </button>
          ))}
        </div>
      )}
      {eps.length > 10 && (
        <button
          onClick={() => setAllEpisodes((v) => !v)}
          className="mt-2 w-full rounded-lg border border-border py-2 text-xs"
        >
          {allEpisodes ? "Tutup" : `Buka semua ${eps.length} episode`}
        </button>
      )}

      <SectionTitle>Komentar</SectionTitle>
      {user && (
        <div className="mb-3 flex gap-2">
          <input
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Tulis komentar…"
            className="flex-1 rounded-full border border-input bg-background/60 px-4 py-2 text-sm"
          />
          <button
            onClick={async () => {
              if (!commentText.trim()) return;
              try {
                await postComment({ animeId, text: commentText });
                setCommentText("");
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Gagal");
              }
            }}
            className="rounded-full bg-amber-300 p-2 text-black"
          >
            <Send className="size-4" />
          </button>
        </div>
      )}
      <div className="space-y-2">
        {(comments ?? []).map((c: any) => (
          <div
            key={c._id}
            className="flex items-start gap-2.5 rounded-xl border border-border/60 bg-secondary/30 p-2.5"
          >
            <Avatar src={c.image} seed={c.username} className="size-8" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold">{c.username}</p>
                <span className="text-[10px] text-muted-foreground">{timeAgo(c.createdAt)}</span>
                {c.userId === user?._id && (
                  <button
                    className="ml-auto text-[10px] text-red-400 underline"
                    onClick={() => void deleteComment({ commentId: c._id })}
                  >
                    hapus
                  </button>
                )}
              </div>
              <p className="text-sm text-zinc-300">{c.text}</p>
            </div>
          </div>
        ))}
        {comments && comments.length === 0 && (
          <p className="py-4 text-center text-xs text-muted-foreground">Belum ada komentar</p>
        )}
      </div>
    </ScreenWrapper>
  );
}
