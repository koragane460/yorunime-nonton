import { useState } from "react";
import { useNavigate } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Avatar, BlueCheck, ClanTag, LevelBadge, RedMark, TitleBadge } from "@/components/lstream-ui";
import { BlurBanner } from "@/components/BlurBanner";
import { DEFAULT_CLAN_ICON } from "@/lib/clanIcons";
import {
  ChevronLeft,
  MessageSquare,
  History as HistoryIcon,
  Heart,
  LogIn,
  Send,
  Tv,
  UserPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { xpForLevel } from "@/lib/level";
import { timeAgo, usernameColor } from "@/lib/lstream";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { StoryRing, StoryViewer } from "@/components/StoriesUI";
import type { Id } from "@/convex/_generated/dataModel";

type Tab = "komen" | "history" | "favorite";

/**
 * Detail akun (diri sendiri / orang lain) — muncul saat avatar diklik:
 * banner panjang, foto profile menutupi banner di tengah, username + centang
 * biru + ID, tag clan di kiri badge level, tombol Komen/History/Favorite.
 */
export function ProfileSheet({
  userId,
  onClose,
  onChat,
}: {
  userId: Id<"users">;
  onClose: () => void;
  /** Dipanggil saat tombol Chat ditekan. Kalau tidak diberikan, tombol
      Chat disembunyikan saja (tidak bisa membuka chat dari layar ini). */
  onChat?: (peer: { id: Id<"users">; name: string }) => void;
}) {
  const { user: me } = useAuth();
  const navigate = useNavigate();
  const profile = useQuery(api.account.getPublicProfile, { userId });
  const addFriend = useMutation(api.friends.sendFriendRequest);
  const friendStatus = useQuery(
    api.friends.statusWith,
    me && me._id !== userId ? { toUserId: userId } : "skip",
  );
  // PENTING: yang ditampilkan adalah data user yang sedang dibuka, bukan
  // data akun yang sedang dipakai (dulu selalu pakai akun sendiri).
  const history = useQuery(api.activities.historyOf, { userId });
  const favorites = useQuery(api.activities.favoritesOf, { userId });
  const comicHistory = useQuery(api.comics.historyOf, { userId });
  const comicFavorites = useQuery(api.comics.favoritesOf, { userId });
  const [tab, setTab] = useState<Tab>("komen");
  const [sending, setSending] = useState(false);
  // Story pemilik profil ini: cincin biru muda + penampil saat avatar
  // ditekan. Sama seperti story di halaman Akun.
  const theirStories = useQuery(api.stories.storiesOf, { userId }) as
    | { _id: string; createdAt: number }[]
    | undefined;
  const [viewStory, setViewStory] = useState(false);

  const cost = profile ? xpForLevel(profile.level) : 1;
  const inLevel = profile ? Math.max(0, Math.min(profile.xpInLevel, cost)) : 0;
  const pct = Math.min(100, (inLevel / Math.max(1, cost)) * 100);
  const isMe = me?._id === userId;

  const requestFriend = async () => {
    if (sending) return;
    setSending(true);
    try {
      await addFriend({ toUserId: userId });
      toast.success("Request pertemanan terkirim");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengirim request");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="screen-enter fixed inset-0 z-[70] overflow-y-auto bg-background">
      {!profile ? (
        <p className="py-24 text-center text-sm text-muted-foreground">Memuat profil…</p>
      ) : (
        <div className="w-full pb-24">
          {/* Banner paling atas (panjang) */}
          <div className="relative">
            <div className="relative">
              {/* Banner: foto profil/banner tajam, luntur ke warna halaman */}
              <BlurBanner
                src={profile.bannerUrl ?? profile.image}
                className="h-44 w-full"
              />
              {/* Bilah sambung warna tipis di bawah banner */}
              <div aria-hidden className="yn-banner-fade" />
            </div>
            <button
              onClick={onClose}
              className="absolute left-3 top-3 z-10 flex size-10 items-center justify-center rounded-xl border border-white/15 bg-black/45 text-white backdrop-blur-sm"
              aria-label="Tutup"
            >
              <ChevronLeft className="size-4" />
            </button>
            {/* Foto profile menutupi banner, tepat di tengah — dengan cincin glow */}
            <div className="relative -mt-16 flex justify-center">
              <div className="yn-avatar-ring">
                <StoryRing
                  image={profile.image}
                  seed={profile.username}
                  size={96}
                  hasStory={(theirStories?.length ?? 0) > 0}
                  seen={false}
                  onClick={() =>
                    (theirStories?.length ?? 0) > 0 && setViewStory(true)
                  }
                  className="rounded-full bg-background p-[2px]"
                />
              </div>
            </div>
          </div>

          <div className="-mt-1 px-4 text-center">
            {/* Urutan: username -> ID -> level badge + tag clan */}
            <div className="flex items-center justify-center gap-1.5"><p
              key={profile.username}
              className={cn(
                "text-base font-black",
                usernameColor(profile.username),
              )}
            >
              {profile.username ?? "user"}
            </p>
            {profile.premium && <BlueCheck className="size-4" />}
            {profile.devTagged && <RedMark className="size-4" />}
            <TitleBadge role={profile.staffRole} seqId={profile.seqId} compact />
            </div>
            <p className="text-[11px] text-zinc-400">
              ID: {profile.seqId !== undefined ? `#${profile.seqId}` : "—"}
            </p>

            <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5 text-[11px]">
              <LevelBadge level={profile.level} />
              {profile.clanTag && (
                <ClanTag
                  icon={profile.clanTagIcon ?? DEFAULT_CLAN_ICON}
                  tag={profile.clanTag}
                  color={profile.clanNameColor}
                  level={profile.clanLevel}
                  className="px-1.5 py-0 text-[9px]"
                />
              )}
            </div>

            {/* Dua tombol membulat (pill), tidak lagi kotak panjang yang memenuhi
                lebar layar: lebar keduanya ikut isi teks + justify-self, jadi
                rapih berdampingan dan tidak melar ke pinggir. Add Friend
                memakai warna kotak pesan chat (abu-abu gelap); Chat kuning
                tua dan baru bisa ditekan kalau sudah berteman. */}
            {!isMe && (
              <div className="mx-auto mt-3 flex max-w-sm justify-center gap-2">
                <button
                  type="button"
                  onClick={requestFriend}
                  disabled={sending || friendStatus === "friend" || friendStatus === "pending"}
                  className={cn(
                    "inline-flex w-fit items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.07] px-4 py-2 text-[12px] font-bold text-white transition active:scale-[0.98]",
                    (friendStatus === "friend" || friendStatus === "pending") &&
                      "opacity-50",
                  )}
                >
                  {sending ? (
                    <Send className="size-4 shrink-0" />
                  ) : (
                    <UserPlus className="size-4 shrink-0" />
                  )}
                  {friendStatus === "friend"
                    ? "Teman"
                    : friendStatus === "pending"
                      ? "Terkirim"
                      : "Add Friend"}
                </button>
                {onChat && (
                  <button
                    type="button"
                    disabled={friendStatus !== "friend"}
                    onClick={() =>
                      onChat({
                        id: userId,
                        name: profile.username ?? "user",
                      })
                    }
                    className={cn(
                      "inline-flex w-fit items-center justify-center gap-2 rounded-full border px-4 py-2 text-[12px] font-bold transition active:scale-[0.98]",
                      friendStatus === "friend"
                        ? "border-amber-500/50 bg-amber-600 text-white hover:bg-amber-500"
                        : "cursor-not-allowed border-white/10 bg-white/[0.04] text-white/35",
                    )}
                  >
                    <MessageSquare className="size-4 shrink-0" />
                    Chat
                  </button>
                )}
              </div>
            )}

            {/* Bar level: kiri Level n, kanan 1/12.000 */}
            <div className="mx-auto mt-3 max-w-sm">
              <div className="mb-1 flex items-center justify-between text-[11px]">
                <span className="font-semibold text-white">Level {profile.level}</span>
                <span className="text-zinc-300">
                  {inLevel.toLocaleString("id-ID")}/{cost.toLocaleString("id-ID")}
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-black/60 ring-1 ring-white/25">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>

            {/* Stats horizontal tanpa background */}
            <div className="mt-4 grid grid-cols-4 divide-x divide-white/15 text-center">
              <StatCell label="History" value={profile.watchCount} />
              <StatCell label="Komen" value={profile.commentCount} />
              <StatCell
                label="Bergabung"
                value={`${Math.max(0, Math.floor((Date.now() - profile.joinedAt) / 86400000))}h`}
              />
              <StatCell label="Menit" value={profile.minutesWatched} />
            </div>

            {/* Tab tanpa background: garis bawah, bisa pindah */}
            <div className="mt-5 flex border-b border-white/15">
              {(
                [
                  ["komen", "Komen", MessageSquare],
                  ["history", "History", HistoryIcon],
                  ["favorite", "Favorite", Heart],
                ] as const
              ).map(([key, label, Icon]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={cn(
                    "relative flex flex-1 items-center justify-center gap-1.5 pb-2.5 text-sm font-semibold transition",
                    tab === key ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  <Icon className="size-4" />
                  {label}
                  {tab === key && (
                    <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-white/90" />
                  )}
                </button>
              ))}
            </div>

            {/* Isi tab: sama persis dengan tab di halaman AKUN */}
            <div className="mt-3 space-y-2">
              {tab === "history" &&
                (history ?? []).map((h: any) => (
                  <button
                    key={h._id}
                    onClick={() => {
                      onClose();
                      navigate(
                        `/nonton?anime=${h.animeId}&ep=&judul=${encodeURIComponent(h.animeTitle ?? "")}`,
                      );
                    }}
                    className="flex w-full items-center gap-3 rounded-xl border border-border/70 bg-secondary/30 p-2.5 text-left"
                  >
                    <img
                      src={h.animeImage ?? ""}
                      className="h-14 w-10 rounded object-cover"
                      alt=""
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{h.animeTitle}</p>
                      <p className="text-xs text-muted-foreground">
                        Episode {h.episode}
                      </p>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {timeAgo(h.updatedAt)}
                    </span>
                  </button>
                ))}
              {tab === "history" &&
                (comicHistory ?? []).map((c: any) => (
                  <button
                    key={c._id}
                    onClick={() => {
                      onClose();
                      navigate(
                        `/baca/${encodeURIComponent(c.slug)}/${c.chapter}?jenis=${c.kind}`,
                      );
                    }}
                    className="flex w-full items-center gap-3 rounded-xl border border-border/70 bg-secondary/30 p-2.5 text-left"
                  >
                    <img
                      src={c.comicImage ?? ""}
                      className="h-14 w-10 rounded object-cover"
                      alt=""
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{c.comicTitle}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.chapterLabel ?? `Chapter ${c.chapter}`}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded px-1.5 py-0.5 text-[9px] font-black uppercase",
                        c.kind === "manhwa"
                          ? "bg-rose-600 text-white"
                          : "bg-sky-600 text-white",
                      )}
                    >
                      {c.kind}
                    </span>
                  </button>
                ))}
              {tab === "history" &&
                (history ?? []).length === 0 &&
                (comicHistory ?? []).length === 0 && (
                  <p className="py-8 text-center text-xs text-muted-foreground">
                    Belum ada history
                  </p>
                )}

              {tab === "favorite" &&
                (favorites ?? []).map((f: any) => (
                  <button
                    key={f._id}
                    onClick={() => {
                      onClose();
                      navigate(
                        `/nonton?anime=${f.animeId}&judul=${encodeURIComponent(f.animeTitle ?? "")}`,
                      );
                    }}
                    className="flex w-full items-center gap-3 rounded-xl border border-border/70 bg-secondary/30 p-2.5 text-left"
                  >
                    <img
                      src={f.animeImage ?? ""}
                      className="h-14 w-10 rounded object-cover"
                      alt=""
                    />
                    <Heart className="size-4 fill-foreground text-primary" />
                    <p className="min-w-0 flex-1 truncate text-sm font-semibold">
                      {f.animeTitle}
                    </p>
                  </button>
                ))}
              {tab === "favorite" &&
                (comicFavorites ?? []).map((f: any) => (
                  <button
                    key={f._id}
                    onClick={() => {
                      onClose();
                      navigate(
                        `/${f.kind === "manhwa" ? "manhwa" : "manga"}?komik=${encodeURIComponent(f.slug)}`,
                      );
                    }}
                    className="flex w-full items-center gap-3 rounded-xl border border-border/70 bg-secondary/30 p-2.5 text-left"
                  >
                    <img
                      src={f.comicImage ?? ""}
                      className="h-14 w-10 rounded object-cover"
                      alt=""
                    />
                    <Heart className="size-4 fill-foreground text-primary" />
                    <p className="min-w-0 flex-1 truncate text-sm font-semibold">
                      {f.comicTitle}
                    </p>
                    <span
                      className={cn(
                        "shrink-0 rounded px-1.5 py-0.5 text-[9px] font-black uppercase",
                        f.kind === "manhwa"
                          ? "bg-rose-600 text-white"
                          : "bg-sky-600 text-white",
                      )}
                    >
                      {f.kind}
                    </span>
                  </button>
                ))}
              {tab === "favorite" &&
                (favorites ?? []).length === 0 &&
                (comicFavorites ?? []).length === 0 && (
                  <p className="py-8 text-center text-xs text-muted-foreground">
                    Belum ada favorite
                  </p>
                )}

              {tab === "komen" && (profile.myComments ?? []).length === 0 && (
                <p className="py-8 text-center text-xs text-muted-foreground">
                  Belum ada komentar
                </p>
              )}
              {/* Tidak ada kotak scroll sendiri: daftar komentar ikut
                  gulir dengan halaman, sama seperti tab History. Kalau
                  dibungkus max-h + overflow, komentarnya terkurung di
                  kotak dan halaman tidak bisa lanjut ke bawah. */}
              {tab === "komen" &&
                (profile.myComments ?? []).map((c: any) => (
                    <button
                      key={c._id}
                      onClick={() => {
                        onClose();
                        navigate(
                          `/nonton?anime=${encodeURIComponent(String(c.animeId).split("__ep")[0] ?? "")}&judul=${encodeURIComponent(c.animeTitle ?? "")}`,
                        );
                      }}
                      className="w-full rounded-xl border border-border/70 bg-secondary/30 p-2.5 text-left"
                    >
                      {/* SATU baris di atas: foto profile (bulat) + username,
                          centang, title, level pill — rata dalam satu baris,
                          waktu di ujung kanan. */}
                      <div className="flex items-center gap-2 overflow-hidden">
                        <Avatar
                          src={profile.image}
                          seed={profile.username}
                          className="size-7 shrink-0"
                        />
                        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
                          <span
                            className={cn(
                              "truncate text-[13px] font-black",
                              usernameColor(profile.username),
                            )}
                          >
                            {profile.username ?? "user"}
                          </span>
                          {profile.premium && (
                            <BlueCheck className="size-3.5 shrink-0" />
                          )}
                          <TitleBadge
                            role={profile.staffRole}
                            seqId={profile.seqId}
                            compact
                          />
                          <LevelBadge
                            level={profile.level}
                            className="shrink-0 rounded-full px-1.5"
                          />
                        </div>
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {timeAgo(c.createdAt)}
                        </span>
                      </div>

                      {/* Di bawahnya: poster kecil + judul & episode */}
                      <div className="mt-1.5 flex items-center gap-2 pl-1">
                        {c.animeImage ? (
                          <img
                            src={c.animeImage}
                            alt=""
                            className="h-10 w-7 shrink-0 rounded object-cover"
                          />
                        ) : (
                          <span className="flex h-10 w-7 shrink-0 items-center justify-center rounded bg-white/5">
                            <Tv className="size-3.5 text-muted-foreground" />
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold">
                            {c.animeTitle ?? "Anime"}
                          </p>
                          {c.episode !== undefined && (
                            <p className="text-[10px] text-muted-foreground">
                              Episode {c.episode}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Teks komen: rata dengan tepi kartu */}
                      <p className="mt-1.5 line-clamp-2 text-[13px] leading-snug text-zinc-300">
                        {c.text}
                      </p>
                      <p className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-0.5">
                          <Heart className="size-3 text-primary" /> {c.likeCount}
                        </span>
                      </p>
                    </button>
                  ))}
            </div>

            {profile.premium === false && (
              <p className="mt-4 flex items-center justify-center gap-1 text-[11px] text-zinc-500">
                <LogIn className="size-3.5" /> Belum premium — centang biru eksklusif
              </p>
            )}
          </div>
        </div>
      )}

      {/* Story pemilik profil */}
      {viewStory && (
        <StoryViewer userId={undefined} onClose={() => setViewStory(false)} />
      )}
    </div>
  );
}

function StatCell({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="py-1">
      <p className="text-base font-bold text-white">{value}</p>
      <p className="text-[10px] text-zinc-400">{label}</p>
    </div>
  );
}
