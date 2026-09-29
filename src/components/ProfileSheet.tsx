import { useState } from "react";
import { useNavigate } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Avatar, BlueCheck, ClanTag, LevelBadge } from "@/components/lstream-ui";
import { DEFAULT_CLAN_ICON } from "@/lib/clanIcons";
import {
  ChevronLeft,
  MessageSquare,
  History as HistoryIcon,
  Heart,
  LogIn,
  Plus,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { xpForLevel } from "@/lib/level";
import { timeAgo } from "@/lib/lstream";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
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
}: {
  userId: Id<"users">;
  onClose: () => void;
}) {
  const { user: me } = useAuth();
  const navigate = useNavigate();
  const profile = useQuery(api.account.getPublicProfile, { userId });
  const addFriend = useMutation(api.friends.sendFriendRequest);
  const history = useQuery(api.activities.myHistory, me ? {} : "skip");
  const favorites = useQuery(api.activities.myFavorites, me ? {} : "skip");
  const [tab, setTab] = useState<Tab>("komen");
  const [sending, setSending] = useState(false);

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
            <div
              className="h-48 w-full bg-cover bg-center"
              style={
                profile.bannerUrl
                  ? { backgroundImage: `url(${profile.bannerUrl})` }
                  : undefined
              }
            >
              {!profile.bannerUrl && <div className="h-full w-full bg-hero-gradient" />}
            </div>
            <button
              onClick={onClose}
              className="absolute left-4 top-3 rounded-full bg-black/60 p-2 text-white"
              aria-label="Tutup"
            >
              <ChevronLeft className="size-4" />
            </button>
            {/* Foto profile menutupi banner, tepat di tengah */}
            <div className="relative -mt-14 flex justify-center">
              <Avatar
                src={profile.image}
                seed={profile.username}
                className="size-28"
                online={!profile.hideOnline}
              />
            </div>
          </div>

          <div className="px-4 text-center">
            {/* Username + centang biru + ID */}
            <div className="mt-2 flex items-center justify-center gap-1.5">
              <p className="text-lg font-black text-white">{profile.username ?? "user"}</p>
              {profile.premium && <BlueCheck className="size-5" />}
            </div>
            <p className="text-xs text-zinc-400">
              ID: {profile.seqId !== undefined ? `#${profile.seqId}` : "—"}
            </p>

            {/* Tag clan di kiri, badge level, tombol + add friend di sebelahnya */}
            <div className="mt-3 flex items-center justify-center gap-2">
              {profile.clanTag && (
                <ClanTag
                  icon={profile.clanTagIcon ?? DEFAULT_CLAN_ICON}
                  tag={profile.clanTag}
                  color={profile.clanNameColor}
                />
              )}
              <LevelBadge level={profile.level} />
              {!isMe && (
                <button
                  type="button"
                  onClick={requestFriend}
                  disabled={sending}
                  aria-label="Tambah teman"
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white transition hover:bg-violet-500 active:scale-95 disabled:opacity-50"
                >
                  {sending ? (
                    <Send className="size-4" />
                  ) : (
                    <Plus className="size-5" strokeWidth={3} />
                  )}
                </button>
              )}
            </div>

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
                  className="h-full rounded-full bg-gradient-to-r from-violet-600 to-violet-400"
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
                      navigate(`/nonton?anime=${h.animeId}&ep=`);
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
              {tab === "history" && (history ?? []).length === 0 && (
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
                      navigate(`/nonton?anime=${f.animeId}`);
                    }}
                    className="flex w-full items-center gap-3 rounded-xl border border-border/70 bg-secondary/30 p-2.5 text-left"
                  >
                    <img
                      src={f.animeImage ?? ""}
                      className="h-14 w-10 rounded object-cover"
                      alt=""
                    />
                    <Heart className="size-4 fill-violet-400 text-violet-400" />
                    <p className="min-w-0 flex-1 truncate text-sm font-semibold">
                      {f.animeTitle}
                    </p>
                  </button>
                ))}
              {tab === "favorite" && (favorites ?? []).length === 0 && (
                <p className="py-8 text-center text-xs text-muted-foreground">
                  Belum ada favorite
                </p>
              )}

              {tab === "komen" && (profile.myComments ?? []).length === 0 && (
                <p className="py-8 text-center text-xs text-muted-foreground">
                  Belum ada komentar
                </p>
              )}
              {tab === "komen" && (
                <div className="thin-scroll max-h-[50vh] overflow-y-auto">
                  {(profile.myComments ?? []).map((c: any) => (
                    <button
                      key={c._id}
                      onClick={() => {
                        onClose();
                        navigate(`/nonton?anime=${c.animeId}`);
                      }}
                      className="mb-2 block w-full rounded-xl border border-border/70 bg-secondary/30 p-3 text-left"
                    >
                      <p className="text-sm">{c.text}</p>
                      <p className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span>{timeAgo(c.createdAt)}</span>
                        <span className="flex items-center gap-0.5">
                          <Heart className="size-3 text-violet-400" /> {c.likeCount}
                        </span>
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {profile.premium === false && (
              <p className="mt-4 flex items-center justify-center gap-1 text-[11px] text-zinc-500">
                <LogIn className="size-3.5" /> Belum premium — centang biru eksklusif
              </p>
            )}
          </div>
        </div>
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
