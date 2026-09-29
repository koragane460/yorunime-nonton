import { Component, useEffect, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout, useHideNavOnMount } from "@/components/AppLayout";
import { AnimeCard, AnimeGrid, SectionTitle, Avatar, BlueCheck } from "@/components/lstream-ui";
import { ProfileSheet } from "@/components/ProfileSheet";
import { ChatPanel, type ChatMsg } from "@/components/ChatPanel";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Check,
  Heart,
  Trophy,
  X,
  Gem,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Lock,
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
              className="rounded-full border border-border px-4 py-1.5 text-xs font-semibold text-muted-foreground transition hover:border-violet-500/60 hover:text-violet-300 disabled:opacity-50"
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
  const [searchGenre, setSearchGenre] = useState<string | null>(null);
  const [updateFirst, setUpdateFirst] = useState(true);

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
      {/* 1) YORUNIME PREMIUM — card ke /premium, tombol beli masih di-lock */}
      <button
        onClick={() => navigate("/premium")}
        className="fade-enter mt-4 flex w-full items-center gap-3 rounded-2xl border border-violet-500/40 bg-gradient-to-r from-violet-600/15 via-violet-600/5 to-transparent p-3.5 text-left transition hover:border-violet-500/70"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-violet-500/15">
          <Sparkles className="size-6 text-violet-300" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold">YoruNime</span>
          <span className="block text-xs text-zinc-400">
            Dukung YoruNime — sistem pembayaran segera dibuka
          </span>
        </span>
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation(); // jangan ikut navigasi card
            toast.info("Pembayaran masih dalam proses — segera hadir 🔒");
          }}
          className="flex shrink-0 cursor-pointer items-center gap-1 rounded-full bg-zinc-700/80 px-3.5 py-1.5 text-xs font-bold text-zinc-300 transition hover:bg-zinc-600/80"
        >
          <Lock className="size-3.5" /> Segera
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
                  <span className="rounded-md bg-violet-600 px-1.5 py-0.5 text-[10px] font-black text-white">
                    {a.status ?? "Ongoing"}
                  </span>
                  <h3 className="mt-1.5 text-lg font-black">{a.title}</h3>
                  <p className="mt-1 line-clamp-4 text-xs leading-relaxed text-zinc-300">
                    {a.synopsis ?? "Sinopsis belum tersedia."}
                  </p>
                  <div className="mt-2.5 flex gap-2">
                    <button
                      onClick={() => openAnime(a.id)}
                      className="rounded-full bg-violet-600 px-4 py-1.5 text-xs font-bold text-white transition hover:bg-violet-500"
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
        className="fade-enter mt-3 w-full rounded-2xl border border-white/10 bg-card p-3 text-left transition hover:border-violet-500/40"
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
        className="fade-enter mt-3 w-full rounded-2xl border border-white/10 bg-card p-3 text-left transition hover:border-violet-500/40"
      >
        <div className="flex items-center justify-between pb-2.5">
          <p className="flex items-center gap-2 font-bold">💬 Chat bareng</p>
          <span className="text-xs text-muted-foreground">buka ›</span>
        </div>
        {/* Garis pembatas di bawah judul (sebelum dipencet) */}
        <div className="h-px bg-white/15" />
        <QueryBoundary label="Gagal memuat chat">
          <GlobalChatPreview />
        </QueryBoundary>
      </button>

      {/* 6) CARI ANIME — buka layar full screen */}
      <SectionTitle>Cari Anime</SectionTitle>
      <button
        onClick={() => {
          setSearchGenre(null);
          setShowSearch(true);
        }}
        className="flex w-full items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-left"
      >
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <span className="flex-1 text-sm text-muted-foreground">Contoh: naruto, frieren…</span>
        <span className="rounded-full bg-violet-600 px-3 py-1 text-xs font-bold text-white">
          Cari
        </span>
      </button>

      {/* 6b) ANIME UPDATE NEWS — di bawah tombol search */}
      {updateFirst && (
        <>
          <div className="mt-4 flex items-center justify-between">
            <h2 className="text-lg font-bold tracking-tight">Anime Update News</h2>
            <span className="text-[11px] text-muted-foreground">rilis hari ini</span>
          </div>
          {loading ? (
            <div className="mt-2 flex gap-2.5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton h-44 w-28 shrink-0 rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="thin-scroll mt-2 flex gap-2.5 overflow-x-auto pb-1">
              {updateNews.map((a) => (
                <div key={a.id} className="relative w-28 shrink-0">
                  <AnimeCard title={a.title} image={a.image} onClick={() => openAnime(a.id)} />
                  <span className="absolute left-1.5 top-1.5 rounded bg-violet-600 px-1 text-[9px] font-bold text-white">
                    New
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* 6c) KATEGORI LENGKAP: Movie / OVA / Special / Upcoming / Season ini */}
      <BrowseRow kind="season" title="Season Ini" onPick={openAnime} />
      <BrowseRow kind="movie" title="Movie" onPick={openAnime} />
      <BrowseRow kind="ova" title="OVA &amp; ONA" onPick={openAnime} />
      <BrowseRow kind="special" title="Special" onPick={openAnime} />
      <BrowseRow kind="upcoming" title="Segera Rilis (Upcoming)" onPick={openAnime} />

      {/* 7) ANIME-ANIME */}
      <SectionTitle>Top Anime</SectionTitle>
      {loading ? <GridSkeleton /> : <AnimeGrid items={topList.slice(0, 10)} onPick={openAnime} ranked newIds={new Set()} />}

      <SectionTitle>Top Anime Hari Ini</SectionTitle>
      {loading ? <GridSkeleton /> : <AnimeGrid items={todayList.slice(0, 10)} onPick={openAnime} ranked newIds={new Set()} />}

      <SectionTitle>Untuk Kamu</SectionTitle>
      {loading ? <GridSkeleton count={12} /> : <AnimeGrid items={foryouList.slice(0, 12)} onPick={openAnime} newIds={new Set()} />}

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
                <Heart className="absolute right-1 top-1 size-4 fill-red-500 text-violet-400" />
                <p className="line-clamp-2 bg-black/60 p-1.5 text-left text-[10px] leading-3">
                  {f.animeTitle}
                </p>
              </button>
            ))}
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
        />
      )}
      {showChat && <GlobalChatScreen onClose={() => setShowChat(false)} />}
      {pickId && <AnimeDetailScreen animeId={pickId} onClose={() => setPickId(null)} />}
    </div>
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
      <div className="flex items-center gap-2 text-xs">
        <Avatar src={m.image} seed={m.username} className="size-7" />
        <p className="truncate">
          <span className="font-semibold text-violet-300">{m.username}</span>
          {m.premium && <BlueCheck className="ml-1 inline size-3.5" />}
          <span className="text-muted-foreground"> : </span>
          <span className="text-zinc-300">
            {m.premiumGive ? "🎁 give premium" : m.text ?? "[foto]"}
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
    <div className="flex flex-col items-center">
      <Avatar src={image} seed={username} className="size-12" />
      <p className="mt-1 line-clamp-1 max-w-full text-xs font-semibold">{username ?? "user"}</p>
      <p className="text-[10px] text-violet-300">{xp.toLocaleString("id-ID")} XP</p>
      <div
        className={cn(
          "mt-1.5 flex w-full items-start justify-center rounded-t-xl border border-b-0 border-violet-500/40 bg-gradient-to-t from-red-500/10 to-red-500/25 pt-1 text-lg font-black text-red-200",
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
        Belum ada yang bagi premium — jadilah yang pertama lewat chat! 🎁
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
          suffix="hari dibagi"
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
        <div className="mb-3 mt-3 flex items-center gap-3">
          <button
            onClick={onClose}
            className="rounded-full border border-border p-2 transition hover:border-violet-500"
          >
            <ChevronLeft className="size-4" />
          </button>
          <h1 className="text-lg font-bold">Leaderboard</h1>
        </div>

        {/* Toggle swap: XP ⇄ Top Give Premium */}
        <div className="tab-pill-track mb-3">
          <button
            onClick={() => setMode("xp")}
            className={cn("tab-pill", mode === "xp" && "tab-pill-active")}
          >
            Leaderboard XP
          </button>
          <button
            onClick={() => setMode("give")}
            className={cn("tab-pill", mode === "give" && "tab-pill-active")}
          >
            Top Give Premium
          </button>
        </div>

        {mode === "xp" && (
          <>
            <div className="mb-3 flex gap-2">
              {["harian", "mingguan", "bulanan"].map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={cn(
                    "relative flex-1 rounded-lg py-2 text-sm font-medium capitalize",
                    period === p ? "text-violet-300" : "text-muted-foreground",
                  )}
                >
                  {p}
                  {period === p && (
                    <span className="absolute inset-x-3 bottom-0 h-0.5 rounded bg-red-500" />
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
}: {
  onClose: () => void;
  onPick: (id: string) => void;
  initialGenre?: string | null;
}) {
  useHideNavOnMount();
  const searchAnime = useAction(api.anime.animeSearch);
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
    setSearching(true);
    try {
      const r = (await searchAnime({ q: query })) as AnimeCardT[];
      setResults(r ?? []);
    } catch {
      setResults([]);
    }
    setSearching(false);
  };

  return (
    <div className="screen-enter fixed inset-0 z-50 overflow-y-auto bg-background">
      <div className="w-full p-3">
        <div className="mb-3 mt-3 flex items-center gap-3">
          <button onClick={onClose} className="rounded-full border border-border p-2">
            <ChevronLeft className="size-4" />
          </button>
          <h1 className="text-lg font-bold">Cari Anime</h1>
        </div>

        {/* Input + tombol Cari */}
        <div className="flex w-full items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
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
                setResults(null);
              }}
            >
              <X className="size-4 text-muted-foreground" />
            </button>
          )}
          <button
            onClick={() => void doSearch()}
            className="rounded-full bg-violet-600 px-3 py-1 text-xs font-bold text-white"
          >
            Cari
          </button>
        </div>

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
                    ? "border-violet-500 bg-violet-500/15 text-violet-300"
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
                      ? "border-violet-500 bg-violet-500/15 text-violet-300"
                      : "border-border text-muted-foreground hover:border-violet-500/50",
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
              <p className="py-10 text-center text-sm text-muted-foreground">
                Anime tidak ditemukan
              </p>
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
  const [tab, setTab] = useState<"chat" | "clan" | "teman">("chat");
  const [friendTab, setFriendTab] = useState<"teman" | "request">("teman");
  const [profileId, setProfileId] = useState<Id<"users"> | null>(null);
  const msgs = useQuery(api.chat.listMessages, { kind: "global", limit: 100 });
  const send = useMutation(api.chat.sendMessage);
  const myClan = useQuery(api.clans.myMembership, user ? {} : "skip");
  const clanMsgs = useQuery(
    api.chat.listMessages,
    myClan?.clanId ? { kind: "clan", clanId: myClan.clanId, limit: 100 } : "skip",
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
          {/* Tab tanpa kotak — garis bawah saat aktif */}
          <div className="flex border-b border-border/60">
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
                  <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-violet-500" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Isi di atas input; chat rata full tanpa rounding */}
        <div className="flex min-h-0 w-full flex-1 flex-col pb-2 pt-3">
          {tab === "chat" && (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-y border-border/60 bg-card">
              {msgs && user ? (
                <ChatPanel
                  kind="global"
                  messages={msgs as unknown as ChatMsg[]}
                  meId={meId}
                  onOpenProfile={(id) => setProfileId(id)}
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
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-y border-border/60 bg-card">
                {clanMsgs && user ? (
                  <ChatPanel
                    kind="clan"
                    clanId={myClan.clanId}
                    messages={clanMsgs as unknown as ChatMsg[]}
                    meId={meId}
                    onSend={async (p) => {
                      await send({ kind: "clan", clanId: myClan.clanId, ...(p as any) });
                    }}
                  />
                ) : (
                  <p className="py-10 text-center text-sm text-muted-foreground">Memuat…</p>
                )}
              </div>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
                <p className="text-base font-bold">Kamu belum join clan</p>
                <p className="max-w-xs text-xs text-muted-foreground">
                  Join clan untuk mendapatkan Sacret dan buat clan mu nomor 1
                </p>
                <div className="flex w-56 flex-col gap-2">
                  <button
                    onClick={() => {
                      onClose();
                      navigate("/clan?buat=1");
                    }}
                    className="rounded-full bg-violet-600 py-2.5 text-sm font-bold text-white transition hover:bg-violet-500"
                  >
                    Buat Clan
                  </button>
                  <button
                    onClick={() => {
                      onClose();
                      navigate("/clan");
                    }}
                    className="rounded-full border border-border py-2.5 text-sm font-semibold transition hover:border-violet-500"
                  >
                    Lihat Clan
                  </button>
                </div>
              </div>
            ))}

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
                      <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-violet-500" />
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
                            className="text-xs text-violet-300 underline"
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
                        <button
                          onClick={async () => {
                            try {
                              await respond({ requestId: r.requestId, accept: true });
                              toast.success(`${r.username} sekarang temanmu!`);
                            } catch (e) {
                              toast.error(e instanceof Error ? e.message : "Gagal terima");
                            }
                          }}
                          aria-label="Terima"
                          className="flex size-9 items-center justify-center rounded-full border border-green-500/40 bg-green-500/15 text-green-400 transition hover:bg-green-500/30"
                        >
                          <Check className="size-4" />
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              await respond({ requestId: r.requestId, accept: false });
                            } catch (e) {
                              toast.error(e instanceof Error ? e.message : "Gagal tolak");
                            }
                          }}
                          aria-label="Tolak"
                          className="flex size-9 items-center justify-center rounded-full border border-red-500/40 bg-red-500/15 text-red-400 transition hover:bg-red-500/30"
                        >
                          <X className="size-4" />
                        </button>
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
          meId={meId}
          onBack={() => setDmPeer(null)}
          onOpenProfile={(id) => setProfileId(id)}
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

      {profileId && <ProfileSheet userId={profileId} onClose={() => setProfileId(null)} />}
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
}: {
  peer: { id: Id<"users">; name: string };
  msgs: ChatMsg[];
  meId: string;
  onBack: () => void;
  onSend: (p: any) => Promise<void>;
  onAddFriend: () => void;
  onOpenProfile: (id: Id<"users">) => void;
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
          className="ml-auto rounded-full border border-violet-500/50 px-3 py-1 text-xs text-violet-300"
        >
          + Teman
        </button>
      </div>
      <div className="min-h-0 flex-1">
        <ChatPanel
          kind="dm"
          peerId={peer.id}
          messages={msgs}
          meId={meId}
          onOpenProfile={onOpenProfile}
          onSend={onSend}
        />
      </div>
    </div>
  );
}


// ------------------------------------------------------- detail screen ----

function AnimeDetailScreen({ animeId, onClose }: { animeId: string; onClose: () => void }) {
  useHideNavOnMount();
  const navigate = useNavigate();
  const { user } = useAuth();
  const getDetail = useAction(api.anime.animeDetail);
  const isFav = useQuery(api.activities.isFavorite, user ? { animeId } : "skip");
  const toggleFav = useMutation(api.activities.toggleFavorite);
  const [detail, setDetail] = useState<any>(null);
  const [synopsisOpen, setSynopsisOpen] = useState(false);
  const [episodeOrder, setEpisodeOrder] = useState<"first" | "last">("first");
  const [allEpisodes, setAllEpisodes] = useState(false);

  useEffect(() => {
    getDetail({ id: animeId })
      .then((d: any) => setDetail(d))
      .catch(() => setDetail({ error: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animeId]);

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
  const shownEps = allEpisodes ? eps : eps.slice(0, 15);

  return (
    <div className="screen-enter fixed inset-0 z-50 overflow-y-auto bg-background">
      <div className="w-full pb-24">
        {/* Header transparan di atas banner full-bleed */}
        <div className="relative">
          {/* Banner: background anime full lebar sampai pinggir (kesamping panjang) */}
          <div
            className="h-64 w-full bg-cover bg-center"
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

          {/* Header + fav mengambang */}
          <div className="absolute inset-x-0 top-0 z-10">
            <DetailHeader title="Detail Anime" onClose={onClose} fav={
              <button
                className="rounded-full bg-black/50 p-2"
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
                <Heart className={cn("size-5", isFav ? "fill-red-500 text-violet-400" : "text-white")} />
              </button>
            } />
          </div>

          {/* Info overlay: poster kiri, judul+genre kanan, di ATAS banner */}
          <div className="absolute inset-x-0 bottom-0 flex gap-3 px-3 pb-3">
            {detail.image ? (
              <img
                src={detail.image}
                alt=""
                className="aspect-[2/3] w-24 shrink-0 rounded-lg object-cover shadow-xl"
              />
            ) : (
              <div className="aspect-[2/3] w-24 shrink-0 rounded-lg bg-black/40" />
            )}
            <div className="min-w-0 flex-1">
              <h2 className="line-clamp-2 text-lg font-black leading-tight text-white drop-shadow">
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
                      : "bg-violet-600 text-white",
                )}
              >
                {detail.status ?? "Ongoing"}
              </span>
            </div>
          </div>
        </div>

        <div className="px-3">
          {/* Sinopsis dulu (baca selengkapnya), BARU tombol Nonton */}
          <SectionTitle>Sinopsis</SectionTitle>
          <p className={cn("text-sm leading-6 text-zinc-300", !synopsisOpen && "line-clamp-3")}>
            {detail.synopsisId ?? detail.synopsis ?? "Sinopsis belum tersedia."}
          </p>
          <button
            onClick={() => setSynopsisOpen((v) => !v)}
            className="mt-1 text-xs font-medium text-violet-300 underline"
          >
            {synopsisOpen ? "Tutup" : "Baca selengkapnya"}
          </button>

          <button
            onClick={() => navigate(`/nonton?anime=${animeId}`)}
            className="mt-4 w-full rounded-full bg-violet-600 py-3 font-bold text-white transition hover:bg-violet-500"
          >
            ▶ Nonton
          </button>

          {/* Episode grid + jumlah di kanan atas */}
          <div className="mb-1 mt-5 flex items-center justify-between">
            <h2 className="text-lg font-bold">Episode</h2>
            <span className="text-xs text-muted-foreground">{eps.length} episode</span>
          </div>
          <button
            onClick={() => setEpisodeOrder(episodeOrder === "first" ? "last" : "first")}
            className="mb-2 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition hover:border-violet-500/60"
          >
            {episodeOrder === "first" ? "Urutkan: Terlama ↓" : "Urutkan: Terbaru ↑"}
          </button>
          {eps.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">
              {detail.status === "Upcoming"
                ? "Belum tayang — nantikan jadwal rilisnya"
                : "Daftar episode belum tersedia"}
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {shownEps.map((e: any) => (
                <button
                  key={e.id}
                  onClick={() => navigate(`/nonton?anime=${animeId}&ep=${e.id}`)}
                  className="size-10 rounded-lg border border-border bg-secondary/40 text-sm font-semibold text-foreground transition hover:border-violet-500/60"
                >
                  {e.number}
                </button>
              ))}
            </div>
          )}
          {eps.length > 15 && (
            <button
              onClick={() => setAllEpisodes((v) => !v)}
              className="mt-2 w-full rounded-lg border border-border py-2 text-xs"
            >
              {allEpisodes ? "Tutup" : "Tampilkan semua episode"}
            </button>
          )}

          {/* Komentar hanya ada di halaman Nonton */}
        </div>
      </div>
    </div>
  );
}

function DetailHeader({
  title,
  onClose,
  fav,
}: {
  title: string;
  onClose: () => void;
  fav?: ReactNode;
}) {
  return (
    <div className="relative z-10 flex items-center justify-between p-3">
      <div className="flex items-center gap-3">
        <button
          onClick={onClose}
          className="rounded-full bg-black/50 p-2 backdrop-blur transition hover:border-violet-500"
        >
          <ChevronLeft className="size-4" />
        </button>
        <h1 className="text-lg font-bold">{title}</h1>
      </div>
      {fav}
    </div>
  );
}
