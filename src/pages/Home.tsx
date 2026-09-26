import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/AppLayout";
import { AnimeGrid, SectionTitle, Avatar, ShineBadge } from "@/components/lstream-ui";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DAYS_ID, avatarFallback, timeAgo } from "@/lib/lstream";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";

export default function Home() {
  return (
    <AppLayout>
      <HomeContent />
    </AppLayout>
  );
}

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

  const [heroList, setHeroList] = useState<any[]>([]);
  const [topList, setTopList] = useState<any[]>([]);
  const [todayList, setTodayList] = useState<any[]>([]);
  const [foryouList, setForyouList] = useState<any[]>([]);
  const [genreList, setGenreList] = useState<{ id: string; name: string }[]>([]);
  const [sched, setSched] = useState<Record<string, any[]>>({});
  const [genresOpen, setGenresOpen] = useState(false);
  const [activeGenre, setActiveGenre] = useState<string | null>(null);
  const [genreAnimes, setGenreAnimes] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[] | null>(null);
  const [heroIdx, setHeroIdx] = useState(0);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showChat, setShowChat] = useState(false);

  const loadGenre = useAction(api.anime.animeByGenre);
  const searchAnime = useAction(api.anime.animeSearch);

  // Muat data katalog
  useEffect(() => {
    hero({ page: 1 }).then((r: any) => setHeroList((r as any) ?? [])).catch(() => {});
    top({}).then((r: any) => setTopList((r as any) ?? [])).catch(() => {});
    today({}).then((r: any) => setTodayList((r as any) ?? [])).catch(() => {});
    forYou({ seed: (user?.name?.length ?? 0) + 3 }).then((r: any) => setForyouList((r as any) ?? [])).catch(() => {});
    genres({}).then((r: any) => setGenreList((r as any) ?? [])).catch(() => {});
    schedule({})
      .then((r: any) => setSched((r as any) ?? {}))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doSearch = async () => {
    if (!query.trim()) {
      setSearchResults(null);
      return;
    }
    try {
      const r = (await searchAnime({ q: query })) as any;
      setSearchResults(r ?? []);
    } catch {
      setSearchResults([]);
    }
  };

  const pickGenre = async (g: { id: string; name: string }) => {
    if (activeGenre === g.id) {
      setActiveGenre(null);
      return;
    }
    setActiveGenre(g.id);
    try {
      const r = (await loadGenre({ genreId: g.id })) as any;
      setGenreAnimes(r ?? []);
    } catch {
      setGenreAnimes([]);
    }
  };

  const heroItems = heroList.slice(0, 2);
  const updateNews = heroList.slice(0, 8);
  const todayDay = DAYS_ID[(new Date().getDay() + 6) % 7];
  const favQuery = useQuery(api.activities.myFavorites, user ? {} : "skip");

  const openAnime = (id: string) => setPickId(id);

  return (
    <div>
      {/* Search */}
      <button
        onClick={() => document.getElementById("ls-search-input")?.focus()}
        className="mt-3 flex w-full items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground"
      >
        <Search className="size-4" />
        <input
          id="ls-search-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && doSearch()}
          placeholder="Cari anime: contoh naruto"
          className="w-full bg-transparent outline-none placeholder:text-muted-foreground"
        />
        {query && (
          <button onClick={() => { setQuery(""); setSearchResults(null); }}>
            <X className="size-4" />
          </button>
        )}
      </button>

      {searchResults !== null && (
        <div className="mt-3">
          {searchResults.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Anime tidak ditemukan
            </p>
          ) : (
            <AnimeGrid
              items={searchResults}
              onPick={openAnime}
              newIds={new Set()}
            />
          )}
        </div>
      )}

      {searchResults === null && (
        <>
          {/* Hero banner slide */}
          {heroItems.length > 0 && (
            <div className="relative mt-3 overflow-hidden rounded-2xl border border-yellow-500/30">
              {heroItems.map((a: any, i: number) => (
                <div
                  key={a.id}
                  className={cn(
                    "transition-opacity duration-500",
                    i === heroIdx ? "block opacity-100" : "hidden opacity-0",
                  )}
                >
                  <div
                    className="relative min-h-44 bg-cover bg-center"
                    style={{
                      backgroundImage: `linear-gradient(90deg, rgba(0,0,0,.85), rgba(0,0,0,.25)), url(${a.image})`,
                    }}
                  >
                    <div className="max-w-[70%] p-4">
                      <h3 className="line-clamp-1 text-lg font-bold text-yellow-300">
                        {a.title}
                      </h3>
                      <p className="mt-1 line-clamp-2 text-xs text-zinc-300">
                        {a.synopsis ?? "Sinopsis belum tersedia."}
                      </p>
                      <button
                        onClick={() => openAnime(a.id)}
                        className="mt-2 rounded-full bg-yellow-500 px-4 py-1.5 text-xs font-bold text-black hover:bg-yellow-400"
                      >
                        Lihat detail
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              <div className="absolute bottom-2 right-2 flex gap-1">
                <button
                  className="rounded-full bg-black/60 p-1.5"
                  onClick={() => setHeroIdx((i) => (i + heroItems.length - 1) % heroItems.length)}
                >
                  <ChevronLeft className="size-4" />
                </button>
                <button
                  className="rounded-full bg-black/60 p-1.5"
                  onClick={() => setHeroIdx((i) => (i + 1) % heroItems.length)}
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
            </div>
          )}

          {/* Leaderboard XP box */}
          <button
            onClick={() => setShowLeaderboard(true)}
            className="mt-3 w-full rounded-2xl border border-yellow-500/30 bg-card p-3 text-left"
          >
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-2 font-bold">
                <Trophy className="size-4 text-yellow-400" /> Leaderboard XP
              </p>
              <span className="text-xs text-muted-foreground">lihat semua ›</span>
            </div>
            <HomeLeaderboardPreview />
          </button>

          {/* Chat bareng box */}
          <button
            onClick={() => setShowChat(true)}
            className="mt-3 w-full rounded-2xl border border-yellow-500/30 bg-card p-3 text-left"
          >
            <p className="mb-2 font-bold">Chat bareng</p>
            <GlobalChatPreview />
          </button>

          {/* Beli premium */}
          <button
            onClick={() => navigate("/premium")}
            className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-yellow-500/40 bg-gradient-to-r from-yellow-500/15 to-transparent p-3 text-left"
          >
            <Crown className="size-7 shrink-0 text-yellow-400" />
            <span className="text-sm font-semibold">
              Beli premium disini mulai dari 7 ribuan aja!!
            </span>
          </button>

          {/* Genre */}
          <SectionTitle>Genre</SectionTitle>
          <div className="flex flex-wrap gap-1.5">
            {(genresOpen ? genreList : genreList.slice(0, 5)).map((g) => (
              <button
                key={g.id}
                onClick={() => pickGenre(g)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition",
                  activeGenre === g.id
                    ? "border-yellow-400 bg-yellow-400/15 text-yellow-300"
                    : "border-border text-muted-foreground hover:border-yellow-400/50",
                )}
              >
                {g.name}
              </button>
            ))}
            {genreList.length > 5 && (
              <button
                onClick={() => setGenresOpen((v) => !v)}
                className="rounded-full border border-yellow-500/50 px-3 py-1 text-xs font-medium text-yellow-300"
              >
                {genresOpen ? "Tutup" : `${genreList.length} genre / semua genre`}
              </button>
            )}
          </div>
          {activeGenre && (
            <div className="mt-3">
              <AnimeGrid items={genreAnimes} onPick={openAnime} newIds={new Set()} />
            </div>
          )}

          {searchResults === null && !activeGenre && (
            <>
              {/* Top anime */}
              <SectionTitle>Top Anime</SectionTitle>
              <AnimeGrid items={topList.slice(0, 10)} onPick={openAnime} ranked newIds={new Set()} />

              {/* Top anime hari ini */}
              <SectionTitle>Top Anime Hari Ini</SectionTitle>
              <AnimeGrid items={todayList.slice(0, 10)} onPick={openAnime} ranked newIds={new Set()} />

              {/* Untuk Kamu */}
              <SectionTitle>Untuk Kamu</SectionTitle>
              <AnimeGrid items={foryouList.slice(0, 12)} onPick={openAnime} newIds={new Set()} />
            </>
          )}

          {/* Anime Update News */}
          <SectionTitle>Anime Update News</SectionTitle>
          <p className="mb-2 text-xs text-muted-foreground">
            Episode baru rilis hari ini
          </p>
          <div className="thin-scroll flex gap-2.5 overflow-x-auto pb-1">
            {updateNews.map((a: any) => (
              <button
                key={a.id}
                onClick={() => openAnime(a.id)}
                className="relative w-28 shrink-0 overflow-hidden rounded-xl border border-border/60"
              >
                <img src={a.image} alt="" className="aspect-[2/3] w-full object-cover" />
                <span className="absolute left-1 top-1 rounded bg-green-500 px-1 text-[10px] font-bold text-black">
                  New
                </span>
                <p className="line-clamp-2 bg-black/60 p-1.5 text-left text-[10px] leading-3">
                  {a.title}
                </p>
              </button>
            ))}
          </div>

          {/* Jadwal update + favorite */}
          <SectionTitle>Jadwal Update Anime</SectionTitle>
          <div className="rounded-2xl border border-border bg-card p-3">
            <div className="flex justify-end">
              <button
                onClick={() => navigate("/akun?tab=favorite")}
                className="flex items-center gap-1 rounded-full border border-yellow-500/40 px-3 py-1 text-xs text-yellow-300"
              >
                <Heart className="size-3.5" /> Favorite
              </button>
            </div>
            <div className="mt-2 space-y-2">
              {DAYS_ID.map((d) => (
                <ScheduleRow key={d} day={d} animes={sched[d.toLowerCase()] ?? []} onPick={openAnime} />
              ))}
            </div>
          </div>

          {favQuery && favQuery.length > 0 && (
            <>
              <SectionTitle>Favorite Kamu</SectionTitle>
              <div className="thin-scroll flex gap-2.5 overflow-x-auto pb-1">
                {favQuery.map((f) => (
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
      <span className="w-6 text-center text-sm font-bold text-yellow-400">{rank}</span>
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
      <p className="text-[10px] text-yellow-400">{xp.toLocaleString("id-ID")} XP</p>
      <div
        className={cn(
          "mt-1.5 flex w-full items-start justify-center rounded-t-xl border border-b-0 border-yellow-500/40 bg-gradient-to-t from-yellow-500/10 to-yellow-400/25 pt-1 text-lg font-black text-yellow-300",
          height,
        )}
      >
        {rank}
      </div>
    </div>
  );
}

export function LeaderboardList({ period }: { period: string }) {
  const harian = useQuery(api.xp.leaderboard, { period, limit: 50 });
  if (!harian) return <p className="py-8 text-center text-sm text-muted-foreground">Memuat…</p>;
  const [t1, t2, t3, ...rest] = harian;
  return (
    <div className="space-y-2">
      {harian.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Belum ada data XP periode ini
        </p>
      )}
      {harian.length > 0 && (
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
              period === p ? "text-yellow-300" : "text-muted-foreground",
            )}
          >
            {p}
            {period === p && (
              <span className="absolute inset-x-3 bottom-0 h-0.5 rounded bg-yellow-400" />
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
  if (!data) return null;
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
  const { user } = useAuth();
  const msgs = useQuery(api.chat.listMessages, { kind: "global", limit: 6 });
  if (!msgs) return null;
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
            <span className="font-semibold text-yellow-300">{m.username}</span>
            <span className="text-muted-foreground"> : </span>
            <span className="text-zinc-300">
              {m.premiumGive ? "🎁 give premium" : m.text ?? "[foto]"}
            </span>
          </p>
        </div>
      ))}
      {user && null}
    </div>
  );
}

function GlobalChatScreen({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
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
              <span className="absolute inset-x-4 bottom-0 h-0.5 rounded bg-white" />
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
              onClick={() => onClose()}
              className="w-full rounded-xl border border-yellow-500/40 p-3 text-left text-sm"
            >
              {myClan.clan.tagIcon} [{myClan.clan.tag}] {myClan.clan.name} — buka chat clan ›
            </button>
            <p className="text-xs text-muted-foreground">
              Chat clan tersedia di tab clan setelah masuk halaman clan.
            </p>
          </div>
        ) : (
          <div className="py-10 text-center">
            <p className="font-semibold">Kamu belum join clan</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Join clan untuk mendapatkan Sacret dan buat clan mu nomor 1
            </p>
            <button
              onClick={() => onClose()}
              className="mt-4 rounded-full bg-yellow-500 px-5 py-2 text-sm font-bold text-black"
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
              friends.map((f) => (
                <div
                  key={f.userId}
                  className="mb-1.5 flex items-center gap-3 rounded-xl border border-border/70 bg-secondary/40 p-2.5"
                >
                  <Avatar src={f.image} seed={f.username} className="size-10" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{f.username}</p>
                    <button
                      className="text-xs text-yellow-300 underline"
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
              requests.map((r) => (
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
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex items-center gap-3 border-b border-border p-3">
        <button onClick={onBack} className="rounded-full border border-border p-1.5">
          <ChevronLeft className="size-4" />
        </button>
        <Avatar seed={peer.name} className="size-9" />
        <p className="font-semibold">{peer.name}</p>
        <button
          onClick={onAddFriend}
          className="ml-auto rounded-full border border-yellow-500/50 px-3 py-1 text-xs text-yellow-300"
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
      className="rounded-full bg-yellow-500 px-3 py-1 text-xs font-bold text-black hover:bg-yellow-400"
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
  animes: any[];
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

function AnimeGridItem({ a, onPick }: { a: any; onPick: (id: string) => void }) {
  return (
    <button onClick={() => onPick(a.id)} className="overflow-hidden rounded-lg border border-border/60">
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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background">
      <div className="mx-auto max-w-2xl p-3">
        <div className="mb-3 mt-3 flex items-center gap-3">
          <button
            onClick={onClose}
            className="rounded-full border border-border p-2 hover:border-yellow-400"
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
        <p className="py-16 text-center text-sm text-muted-foreground">Memuat…</p>
      </ScreenWrapper>
    );
  if (detail.error)
    return (
      <ScreenWrapper title="Detail" onClose={onClose}>
        <p className="py-16 text-center text-sm text-muted-foreground">Anime tidak ditemukan</p>
      </ScreenWrapper>
    );

  const eps = [...(detail.episodeList ?? [])];
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
            className="-mt-12 aspect-[2/3] w-24 rounded-xl border border-yellow-500/40 object-cover"
          />
          <div className="min-w-0 flex-1">
            <h2 className="line-clamp-2 font-bold">{detail.title}</h2>
            <div className="mt-1 flex flex-wrap gap-1">
              {(detail.genres ?? []).slice(0, 4).map((g: string) => (
                <span key={g} className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                  {g}
                </span>
              ))}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {detail.rating ?? "Rating 13+"} • {detail.studio ?? "Studio tidak diketahui"}
            </p>
            <span className="mt-1 inline-block rounded bg-yellow-500/20 px-2 py-0.5 text-[10px] font-bold text-yellow-300">
              {detail.status ?? "Ongoing"}
            </span>
          </div>
        </div>
      </div>

      <button
        onClick={() => navigate(`/nonton?anime=${animeId}`)}
        className="mt-3 w-full rounded-xl bg-yellow-500 py-3 font-bold text-black hover:bg-yellow-400"
      >
        ▶ Menonton
      </button>

      <SectionTitle>Sinopsis</SectionTitle>
      <p className={cn("text-sm leading-6 text-zinc-300", !synopsisOpen && "line-clamp-3")}>
        {detail.synopsis ?? "Sinopsis belum tersedia."}
      </p>
      <button
        onClick={() => setSynopsisOpen((v) => !v)}
        className="mt-1 text-xs font-medium text-yellow-300 underline"
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
      <div className="space-y-1.5">
        {shownEps.map((e: any) => (
          <button
            key={e.id}
            onClick={() => navigate(`/nonton?anime=${animeId}&ep=${e.id}`)}
            className="flex w-full items-center gap-3 rounded-xl border border-border/60 bg-secondary/30 p-2.5 text-left hover:border-yellow-400/50"
          >
            <span className="flex size-9 items-center justify-center rounded-lg bg-yellow-500/15 text-sm font-bold text-yellow-300">
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
            className="rounded-full bg-yellow-500 p-2 text-black"
          >
            <Send className="size-4" />
          </button>
        </div>
      )}
      <div className="space-y-2">
        {(comments ?? []).map((c) => (
          <div key={c._id} className="flex items-start gap-2.5 rounded-xl border border-border/60 bg-secondary/30 p-2.5">
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
