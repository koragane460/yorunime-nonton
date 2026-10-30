import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import { getAntiLag } from "@/lib/antilag";
import { api } from "@/convex/_generated/api";
import { Avatar, BlueCheck, ClanTag, LevelBadge, RedMark, TitleBadge } from "@/components/lstream-ui";
import { BlurBanner } from "@/components/BlurBanner";
import { StripBackIcon } from "@/components/StripBack";
import { TitleRibbon } from "@/components/Cosmetics";
import { DEFAULT_CLAN_ICON } from "@/lib/clanIcons";
import {
  Award,
  Camera,
  ChevronLeft,
  Gift,
  HeartHandshake,
  MessageSquare,
  History as HistoryIcon,
  Heart,
  LogIn,
  PawPrint,
  RefreshCw,
  Send,
  Sparkles,
  Tv,
  UserPlus,
  Users,
  Zap,
} from "lucide-react";
import { YoruPetScreen } from "@/components/YoruPet";
import { AfinitasScreen } from "@/components/AfinitasScreen";
import { shrinkAvatar } from "@/lib/image";
import { cn } from "@/lib/utils";
import { xpForLevel } from "@/lib/level";
import {
  LEVEL_BADGE_TIERS,
  badgeForLevel,
  displayId,
  timeAgo,
  usernameColor,
} from "@/lib/lstream";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { StoryRing, StoryViewer } from "@/components/StoriesUI";
import { useHideNavOnMount } from "@/components/AppLayout";
import type { Id } from "@/convex/_generated/dataModel";

import {
  ContentGrid,
  FeedPostOverlay,
  FollowButton,
} from "@/components/FeedScreen";

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
  // Detail akun harus benar-benar FULLSCREEN: bar navigasi bawah disembunyikan
  // selama layar ini terbuka, bukan tampil menumpuk di bawahnya.
  useHideNavOnMount();
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
  // ---- MODE DETAIL KONTEN (feed) — tombol swipe di kanan atas banner.
  // Berganti dengan fade: stats jadi Mengikuti · Followers · Like, dan
  // bagian bawah jadi grid Konten (3 per baris + jumlah views).
  const [detailKonten, setDetailKonten] = useState(false);
  const followData = useQuery(api.feed.followCounts, { userId });
  const myPosts = useQuery(api.feed.userPosts, { userId }) as any[] | undefined;
  const [openPost, setOpenPost] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  // Story pemilik profil ini: cincin biru muda + penampil saat avatar
  // ditekan. Sama seperti story di halaman Akun.
  const theirStories = useQuery(api.stories.storiesOf, { userId }) as
    | { _id: string; createdAt: number }[]
    | undefined;
  const [viewStory, setViewStory] = useState(false);
  // Tombol detail akun: YoruPet (lihat kebun orang lain) & Afinitas,
  // plus popup daftar tier tag level.
  const [viewPet, setViewPet] = useState(false);
  const [affinity, setAffinity] = useState(false);
  const [tierPopup, setTierPopup] = useState(false);
  // Intro sinematik (awan/gagak) DIHAPUS sesuai permintaan — layar langsung
  // menampilkan detail akun dengan banner foto yang bisa diatur di
  // Pengaturan (premium).

  // Title yang sedang dipasang — tampil di bawah stat akun.
  const cosmetics = useQuery(api.titles.publicOf, { userId });
  // GACHA KARTU ANIME DIHAPUS PERMANEN — profil tidak lagi menampilkan
  // kartu karakter; hadiah gacha sekarang langsung masuk (XP/telur/Sacret/
  // premium) lewat mesin vending di YoruVerse › Shop.

  // Animasi intro FULLSCREEN (awan/gagak) DIHAPUS permanen sesuai permintaan
  // — profil langsung tampil tanpa pembuka animasi.
  const cost = profile ? xpForLevel(profile.level) : 1;
  const inLevel = profile ? Math.max(0, Math.min(profile.xpInLevel, cost)) : 0;
  const pct = Math.min(100, (inLevel / Math.max(1, cost)) * 100);
  const isMe = me?._id === userId;

  // ---- PHOTO PROFILE (detail akun sendiri): tombol kamera bulat kecil di
  // pojok kanan bawah foto → sheet berisi "Ganti photo profile" (atas) dan
  // "Refresh Photo Profile" (bawah) — permintaan user. ----
  const updateProfile = useMutation(api.account.updateProfile);
  const refreshPhotoMut = useMutation(api.account.refreshPhoto);
  const [photoSheet, setPhotoSheet] = useState(false);
  const [busyPhoto, setBusyPhoto] = useState(false);
  const [busyRefresh, setBusyRefresh] = useState(false);
  const photoFileRef = useRef<HTMLInputElement | null>(null);

  const onPickPhoto = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setBusyPhoto(true);
    void (async () => {
      try {
        // Foto HP bisa 2-8 MB — perkecil dulu supaya muat di dokumen (1 MiB).
        const small = await shrinkAvatar(f);
        await updateProfile({ image: small });
        setPhotoSheet(false);
        toast.success("Photo profile diganti ✨");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Gagal mengganti photo");
      } finally {
        setBusyPhoto(false);
      }
    })();
  };

  const doRefreshPhoto = async () => {
    if (busyRefresh || busyPhoto) return;
    setBusyRefresh(true);
    try {
      await refreshPhotoMut();
      setPhotoSheet(false);
      toast.success("Photo profile di-refresh — user lain akan melihat foto terbaru");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal refresh photo");
    } finally {
      setBusyRefresh(false);
    }
  };

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
        <div className="w-full pb-10">
          {/* Banner paling atas (panjang) */}
          <div className="relative">
            <div className="relative">
              {/* Banner FULLSCREEN besar & tajam: foto dari Pengaturan
                  (premium) atau foto profile sebagai fallback. HD (1200px). */}
              {/* Banner NORMAL (tanpa blur) — foto tampil tajam apa adanya. */}
              <img
                src={profile.bannerUrl ?? profile.image ?? ""}
                alt=""
                className="h-64 w-full object-cover"
              />
              {/* Bilah sambung warna tipis di bawah banner */}
              <div aria-hidden className="yn-banner-fade" />
            </div>
            <button
              onClick={onClose}
              className="absolute left-3 top-3 z-10 flex items-center py-1 pr-1 text-white transition active:opacity-60"
              aria-label="Tutup"
            >
              <StripBackIcon />
            </button>
            {/* Tombol SWIPE di kanan atas — TANPA background. Berganti
                antara Detail akun ⇄ Detail Konten dengan fade halus. */}
            <button
              type="button"
              onClick={() => setDetailKonten((v) => !v)}
              aria-label={detailKonten ? "Lihat detail akun" : "Lihat detail konten"}
              aria-pressed={detailKonten}
              className="absolute right-3 top-3 z-10 flex items-center gap-1.5 py-1 text-white transition active:scale-95"
            >
              <span className="text-[11px] font-black tracking-wide drop-shadow">
                {detailKonten ? "Detail akun" : "Detail Konten"}
              </span>
              <svg
                width="22"
                height="16"
                viewBox="0 0 22 16"
                fill="none"
                aria-hidden
              >
                <path
                  d="M8 3 3 8l5 5M14 3l5 5-5 5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            {/* Kotak info di banner DIHAPUS permanen — isinya sudah pindah
                ke kotak ringkas (Top XP / Top Give / tag clan) di bawah
                kotak ID/level/teman. */}
          </div>

          {/* KOTAK ISI di bawah banner — FULL lebar tanpa celah,
              warna SOLID (tanpa transparan/blur), naik ke atas,
              sudut atas ROUND (pojok kanan & kiri). */}
          <div className="relative -mt-20">
            <div className="rounded-3xl border border-white/10 bg-[#0c111b] p-4 text-center">
            {/* Baris atas: foto profile BESAR di kiri, username + chips di
                kanan (rata kiri, bukan tengah lagi). */}
            <div className="flex items-start gap-3.5 text-left">
              <div className="relative shrink-0 self-center">
                <div className="yn-avatar-ring">
                  <StoryRing
                    image={profile.image}
                    seed={profile.username}
                    size={92}
                    hasStory={(theirStories?.length ?? 0) > 0}
                    seen={false}
                    onClick={() =>
                      (theirStories?.length ?? 0) > 0 && setViewStory(true)
                    }
                    className="rounded-full bg-background p-[2px]"
                  />
                </div>
                {/* Tombol kamera bulat KECIL di foto (hanya profil sendiri)
                    → sheet Ganti / Refresh photo. */}
                {isMe && (
                  <button
                    type="button"
                    onClick={() => setPhotoSheet(true)}
                    aria-label="Ganti photo profile"
                    className="absolute -bottom-0.5 right-0 z-10 flex size-7 items-center justify-center rounded-full border-[3px] border-background bg-gold-strong text-black shadow-[0_4px_12px_-4px_rgba(0,0,0,0.6)] transition active:scale-90"
                  >
                    <Camera className="size-3.5" aria-hidden />
                  </button>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p
                    key={profile.username}
                    className={cn(
                      "truncate text-xl yn-title",
                      usernameColor(profile.username),
                    )}
                  >
                    {profile.username ?? "user"}
                  </p>
                  {profile.premium && <BlueCheck className="size-4" />}
                  {profile.devTagged && <RedMark className="size-4" />}
                  <TitleBadge
                    role={profile.staffRole}
                    seqId={profile.seqId}
                    compact
                  />
                </div>
                {/* Chips: ID · tag level · jumlah teman */}
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[13px]">
                  <span className="inline-flex items-center rounded-full bg-zinc-500/25 px-2.5 py-1 font-mono font-bold text-white/95">
                    {displayId(profile.seqId)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setTierPopup(true)}
                    aria-label="Daftar tag level"
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/45 bg-white/5 px-2.5 py-1 font-bold text-white/95 transition active:scale-95"
                  >
                    <TierIcon
                      tier={badgeForLevel(profile.level).name}
                      className="size-4"
                    />
                    Lv.{profile.level}
                  </button>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-500/25 px-2.5 py-1 font-bold text-white/95">
                    <Users className="size-3.5" aria-hidden />
                    {profile.friendCount ?? 0}
                  </span>
                </div>
              </div>
            </div>

            {/* KOTAK RINGKAS tanpa background: TOP XP · TOP GIVE PREMIUM ·
                TAG CLAN + nama + centang biru — MENDEKAT persis di bawah
                kotak ID/tag level/teman. */}
            <div className="mt-2 flex flex-wrap items-center justify-start gap-2 text-left">
              {profile.xpRank ? (
                <span className="inline-flex items-center gap-1 rounded-lg border border-yellow-400/45 bg-yellow-400/10 px-2 py-1 text-[11px] font-black text-yellow-200">
                  <Zap className="size-3" aria-hidden /> Top XP {profile.xpRank}
                </span>
              ) : null}
              {profile.giverRank ? (
                <span className="inline-flex items-center gap-1 rounded-lg border border-rose-400/45 bg-rose-400/10 px-2 py-1 text-[11px] font-black text-rose-200">
                  <Gift className="size-3" aria-hidden /> Top Give{" "}
                  {profile.giverRank}
                </span>
              ) : null}
              {profile.clanTag && profile.clanName ? (
                <span className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-white/20 bg-white/[0.06] px-2 py-1">
                  <ClanTag
                    icon={profile.clanTagIcon ?? DEFAULT_CLAN_ICON}
                    tag={profile.clanTag}
                    color={profile.clanNameColor}
                    level={profile.clanLevel}
                    className="shrink-0 scale-90 px-1 py-0 text-[9px]"
                  />
                  <span className="truncate text-[11px] font-bold text-white/95">
                    {profile.clanName}
                  </span>
                  {profile.clanVerified && <BlueCheck className="size-3.5 shrink-0" />}
                </span>
              ) : null}
            </div>

            {/* Urutan lama (username di tengah + chips) sudah pindah ke
                baris atas kotak ini. */}

            {/* Tombol pindah ke kotak 3-tombol (di bawah title). */}


            {/* STATS — Detail akun: History · Komen · Bergabung · Menit.
                Detail Konten: Mengikuti · Followers · Like (lebih besar,
                tanpa background, karena cuma tiga). */}
            <div
              key={detailKonten ? "konten" : "akun"}
              className="fade-enter mt-3"
            >
              {detailKonten ? (
                <div className="grid grid-cols-3 gap-2 text-center">
                  {(
                    [
                      ["Mengikuti", followData?.following ?? 0],
                      ["Followers", followData?.followers ?? 0],
                      ["Like", followData?.likes ?? 0],
                    ] as const
                  ).map(([label, value]) => (
                    <div key={label} className="py-1.5">
                      <p className="text-2xl font-black leading-none text-white">
                        {Number(value).toLocaleString("id-ID")}
                      </p>
                      <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-white/55">
                        {label}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-4 divide-x divide-white/15 text-center">
                  <StatCell label="History" value={profile.watchCount} />
                  <StatCell label="Komen" value={profile.commentCount} />
                  <StatCell
                    label="Bergabung"
                    value={`${Math.max(0, Math.floor((Date.now() - profile.joinedAt) / 86400000))}h`}
                  />
                  <StatCell label="Menit" value={profile.minutesWatched} />
                </div>
              )}
            </div>

            {/* BAR LEVEL BESAR — DISIMPAN di mode Detail Konten (diminta
                hilang di mode swipe konten). */}
            {!detailKonten && (
            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between text-[12px]">
                <span className="font-black text-white">Level {profile.level}</span>
                <span className="text-zinc-300">
                  {inLevel.toLocaleString("id-ID")}/{cost.toLocaleString("id-ID")}
                </span>
              </div>
              <div className="h-3.5 overflow-hidden rounded-full bg-black/60 ring-1 ring-white/25">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-gold to-gold-strong transition-[width] duration-700"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
            )}

            {/* TITLE terpasang — sebesar bar level, geser ke kanan. */}
            {(() => {
              const titles =
                cosmetics?.titles ??
                (cosmetics?.title ? [cosmetics.title] : []);
              if (titles.length === 0) return null;
              return (
                <div className="thin-scroll mt-3 flex items-stretch gap-2 overflow-x-auto pb-1">
                  {titles.slice(0, 3).map((t) => (
                    <div key={t.id} className="min-w-[85%] shrink-0">
                      {/* Gede banget (permintaan) — size lg + text override. */}
                      <TitleRibbon
                        name={t.name}
                        size="lg"
                        className="w-full justify-center text-base"
                      />
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* 3 tombol DIGABUNG (Add Friend · YoruPet · Afinitas) —
                DISIMPAN di mode Detail Konten (diminta tak terlihat di sana). */}
            {!detailKonten && (
            <div
              className={cn(
                "mt-4 grid divide-x divide-white/15 overflow-hidden rounded-2xl border border-white/12 bg-white/[0.05]",
                isMe ? "grid-cols-2" : "grid-cols-3",
              )}
            >
              {!isMe && (
                <button
                  type="button"
                  onClick={requestFriend}
                  disabled={
                    sending || friendStatus === "friend" || friendStatus === "pending"
                  }
                  className={cn(
                    "flex min-w-0 flex-col items-center justify-center gap-1 px-1 py-3 text-[12px] font-bold transition active:scale-[0.98]",
                    friendStatus === "friend" || friendStatus === "pending"
                      ? "text-white/45"
                      : "text-white",
                  )}
                >
                  {sending ? (
                    <Send className="size-4" />
                  ) : (
                    <UserPlus className="size-4" />
                  )}
                  {friendStatus === "friend"
                    ? "Teman"
                    : friendStatus === "pending"
                      ? "Terkirim"
                      : "Add Friend"}
                </button>
              )}
              <button
                type="button"
                onClick={() => setViewPet(true)}
                className="flex min-w-0 flex-col items-center justify-center gap-1 px-1 py-3 text-[12px] font-bold text-amber-200 transition active:scale-[0.98]"
              >
                <PawPrint className="size-4" />
                YoruPet
              </button>
              <button
                type="button"
                onClick={() => setAffinity(true)}
                className="flex min-w-0 flex-col items-center justify-center gap-1 px-1 py-3 text-[12px] font-bold text-pink-100 transition active:scale-[0.98]"
              >
                <HeartHandshake className="size-4" />
                Afinitas
              </button>
            </div>
            )}
            </div>

            {/* BAGIAN BAWAH — mode Detail Konten menampilkan grid Konten
                (3 per baris + jumlah views); mode detail akun tetap tab
                Komen / History / Favorite. */}
            {detailKonten && (
              <div className="fade-enter px-4 pb-6">
                <div className="mt-5 flex items-end justify-between">
                  <div className="flex items-center gap-2.5">
                    {/* Garis vertikal tegas — gaya judul chapter manga/manhwa. */}
                    <span
                      aria-hidden
                      className="h-6 w-[5px] shrink-0 rounded-sm bg-gradient-to-b from-white via-white/80 to-transparent"
                    />
                    <p className="text-[15px] font-black tracking-tight text-white">
                      {isMe ? "Konten Mu" : "Konten"}
                    </p>
                  </div>
                  <span className="text-[11px] font-bold text-white/45">
                    {myPosts?.length ?? 0} konten
                  </span>
                </div>
                <div className="mt-2.5">
                  {!myPosts ? (
                    <p className="py-8 text-center text-xs text-white/50">
                      Memuat konten…
                    </p>
                  ) : (
                    <ContentGrid
                      posts={myPosts}
                      onOpen={(i) => setOpenPost(i)}
                    />
                  )}
                </div>
                {!isMe && (
                  <div className="mt-4 flex justify-center">
                    <FollowButton targetId={userId} />
                  </div>
                )}
              </div>
            )}

            {/* BAGIAN BAWAH TANPA BUNGKUS — tab & daftar menempel
                langsung di latar sheet, bukan di dalam kotak kartu. */}
            <div className={cn("px-4 pb-2", detailKonten && "hidden")}>

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
                          : "bg-primary text-primary-foreground",
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
                          : "bg-primary text-primary-foreground",
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
                  kotak dan halaman tidak bisa lanjut ke bawah.
                  BUNGKUS -mx-4: kolom komentar MELEBAR ke samping sampai
                  mentok tepi layar (membatalkan px-4 kontainer) tapi TIDAK
                  keluar jalur — permintaan user. */}
              <div className="-mx-4">
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
            </div>

            {profile.premium === false && (
              <p className="mt-4 flex items-center justify-center gap-1 text-[11px] text-zinc-500">
                <LogIn className="size-3.5" /> Belum premium — centang biru eksklusif
              </p>
            )}
            </div>
          </div>
        </div>
      )}

      {/* SHEET PHOTO PROFILE — dibuka tombol kamera di bawah foto (profil
          sendiri). Tombol PERTAMA di atas: "Ganti photo profile" (buka
          galeri, tanpa tulisan "dari galeri"); tombol KEDUA di bawah:
          "Refresh Photo Profile" supaya photo tampil ke user lain. */}
      {isMe && photoSheet && (
        <div
          // Tanpa blur (permintaan: "gausah kasih blur segala") — cukup lapisan
          // gelap tipis supaya sheet-nya terasa mengambang.
          className="fixed inset-0 z-[90] flex items-end justify-center bg-black/45 p-3 pb-5"
          onClick={() => !busyPhoto && !busyRefresh && setPhotoSheet(false)}
          role="dialog"
          aria-modal
        >
          <div
            className="pop-enter w-full max-w-sm overflow-hidden rounded-3xl border border-white/12 bg-[#10131a] shadow-[0_-8px_40px_-12px_rgba(0,0,0,.8)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header sheet: pegangan + judul + penjelasan singkat. */}
            <div className="px-4 pb-2 pt-2.5 text-center">
              <span
                aria-hidden
                className="mx-auto mb-2.5 block h-1 w-10 rounded-full bg-white/20"
              />
              <p className="text-sm font-bold text-foreground">Photo profile</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                Pakai foto dari galeri, atau refresh supaya foto baru langsung
                tampil ke user lain.
              </p>
            </div>
            <div className="space-y-1 px-3 pb-3">
              <button
                type="button"
                onClick={() => photoFileRef.current?.click()}
                disabled={busyPhoto || busyRefresh}
                className="flex w-full items-center gap-3 rounded-2xl border border-white/12 bg-white/[0.05] px-3.5 py-3 text-left transition hover:border-gold-strong/40 hover:bg-gold-strong/10 active:scale-[0.99] disabled:opacity-50"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gold-strong/15">
                  <Camera className="size-4 text-gold-strong" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-foreground">
                    {busyPhoto ? "Memproses gambar…" : "Ganti photo profile"}
                  </span>
                  <span className="block text-[11px] text-muted-foreground">
                    Pilih foto baru dari galeri
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => void doRefreshPhoto()}
                disabled={busyPhoto || busyRefresh}
                className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3.5 py-3 text-left transition hover:bg-white/[0.06] active:scale-[0.99] disabled:opacity-50"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10">
                  <RefreshCw
                    className={cn("size-4 text-foreground/80", busyRefresh && "animate-spin")}
                    aria-hidden
                  />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-foreground">
                    {busyRefresh ? "Me-refresh…" : "Refresh Photo Profile"}
                  </span>
                  <span className="block text-[11px] text-muted-foreground">
                    Sinkronkan foto ke tampilan user lain
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setPhotoSheet(false)}
                disabled={busyPhoto || busyRefresh}
                className="w-full rounded-2xl px-3.5 py-2.5 text-center text-sm font-semibold text-muted-foreground transition hover:text-foreground active:scale-[0.99] disabled:opacity-50"
              >
                Batal
              </button>
            </div>
            <input
              ref={photoFileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onPickPhoto}
            />
          </div>
        </div>
      )}

      {/* Story pemilik profil */}
      {viewStory && (
        <StoryViewer userId={undefined} onClose={() => setViewStory(false)} />
      )}

      {/* POP-UP DAFTAR TIER TAG LEVEL (tap chip "Lv.") — ikon material,
          nama tier, syarat level, dan penjelasan. */}
      {tierPopup && profile && (
        <div
          className="fixed inset-0 z-[92] flex items-center justify-center bg-black/60 p-4"
          onClick={() => setTierPopup(false)}
          role="dialog"
          aria-modal
        >
          <div
            className="pop-enter w-full max-w-sm overflow-hidden rounded-3xl border border-white/12 bg-[#10131a] p-3.5"
            onClick={(e) => e.stopPropagation()}
          >
            <span
              aria-hidden
              className="mx-auto mb-2.5 block h-1 w-10 rounded-full bg-white/20"
            />
            <p className="text-center text-sm font-bold text-foreground">
              Daftar Tag Level
            </p>
            <div className="thin-scroll mt-2.5 max-h-[64vh] space-y-1.5 overflow-y-auto pr-1">
              {LEVEL_BADGE_TIERS.slice()
                .reverse()
                .map((t) => {
                  const now = badgeForLevel(profile.level).name === t.name;
                  return (
                    <div
                      key={t.name}
                      className={cn(
                        "flex items-center gap-2.5 rounded-2xl border p-2.5",
                        now
                          ? "border-white/40 bg-white/[0.08]"
                          : "border-white/10 bg-white/[0.04]",
                      )}
                    >
                      <TierIcon tier={t.name} className="size-6 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-black text-white">
                            {t.name}
                          </span>
                          <span
                            className={cn(
                              "rounded-full bg-gradient-to-r px-1.5 py-px text-[9px] font-black text-black/85",
                              t.cls,
                            )}
                          >
                            Lv.{t.minLevel}+
                          </span>
                          {now && (
                            <span className="rounded-full bg-primary px-1.5 py-px text-[9px] font-black text-primary-foreground">
                              Kamu
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-[10.5px] leading-snug text-zinc-400">
                          {TIER_DESC[t.name]}
                        </p>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* DETAIL KONTEN — satu post fullscreen + rail like/komen/share */}
      {detailKonten && openPost !== null && myPosts && (
        <FeedPostOverlay
          posts={myPosts}
          index={openPost}
          onClose={() => setOpenPost(null)}
          onOpenProfile={(id) => {
            if (String(id) === String(userId)) {
              setOpenPost(null);
              return;
            }
            setOpenPost(null);
            onClose();
            navigate(`/akun?user=${String(id)}`);
          }}
        />
      )}

      {/* YORUPET — kebun binatang milik user ini (mode lihat) */}
      {viewPet && (
        <div className="screen-enter fixed inset-0 z-[93] overflow-y-auto bg-background">
          <YoruPetScreen
            onBack={() => setViewPet(false)}
            viewUserId={userId}
          />
        </div>
      )}

      {/* AFINITAS — relasi dekat, layar penuh */}
      {affinity && (
        <AfinitasScreen
          targetUserId={userId}
          onClose={() => setAffinity(false)}
        />
      )}
    </div>
  );
}

/** Penjelasan singkat tiap tier tag level (popup daftar tag level). */
const TIER_DESC: Record<string, string> = {
  Bronze: "Langkah pertama perjalananmu di YoruNime.",
  Silver: "Teman lama yang makin sering muncul.",
  Diamond: "Sangat aktif — hampir tiap hari berseliweran.",
  Emerald: "Langka, konsisten, dan bergengsi.",
  Master: "Legenda komunitas YoruNime.",
  Grandmaster: "Puncak tertinggi — hanya segelintir yang sampai.",
  Central: "Tier rahasia di atas Grandmaster — level 13.000 ke atas.",
  Ruby: "Permata merah paling langka — level 20.000 ke atas.",
  Ascendant: "Puncak tertinggi YoruNime, di atas Central — level 28.000 ke atas.",
};

/** Ikon material per tier level — ingot (Bronze/Silver/Grandmaster) dan
 *  permata (Diamond/Emerald/Master). SVG kecil tanpa latar (clean). */
export function TierIcon({ tier, className }: { tier: string; className?: string }) {
  /** Enam material BERBEDA — ingot, ore, intan, zamrud, kristal, medali. */
  const art: Record<string, ReactNode> = {
    /* INGOT — batangan logam bertingkat. */
    Bronze: (
      <>
        <path d="M4.6 6.4 H11.4 L13.4 10.4 H2.6 Z" fill="#c87a4a" stroke="rgba(0,0,0,.5)" strokeWidth="0.9" strokeLinejoin="round" />
        <path d="M2.6 10.4 H13.4 V12.4 H2.6 Z" fill="#a35f38" opacity="0.9" stroke="rgba(0,0,0,.5)" strokeWidth="0.9" strokeLinejoin="round" />
        <path d="M5.4 7.5 H10.6" stroke="rgba(255,255,255,.5)" strokeWidth="0.8" />
      </>
    ),
    /* ORE — bongkahan bijih bersegmen. */
    Silver: (
      <>
        <path d="M3.4 8.6 L5.4 4.6 L9.6 3.6 L12.8 6.4 L11.8 11.4 L6.4 12.6 Z" fill="#b9c0ca" stroke="rgba(0,0,0,.5)" strokeWidth="0.9" strokeLinejoin="round" />
        <path d="M5.4 4.6 L7.6 8.2 L12.8 6.4 M7.6 8.2 L6.4 12.6 M7.6 8.2 L11.8 11.4" stroke="rgba(255,255,255,.55)" strokeWidth="0.7" fill="none" />
      </>
    ),
    /* INTAN — potongan brilian. */
    Diamond: (
      <>
        <path d="M8 13.6 L2.6 6.4 H13.4 Z" fill="#7ddffb" stroke="rgba(0,0,0,.5)" strokeWidth="0.9" strokeLinejoin="round" />
        <path d="M2.6 6.4 L4.7 3 H11.3 L13.4 6.4 Z" fill="#a9edff" stroke="rgba(0,0,0,.5)" strokeWidth="0.9" strokeLinejoin="round" />
        <path d="M4.7 3 L6.5 6.4 L8 13.6 M11.3 3 L9.5 6.4" stroke="rgba(255,255,255,.6)" strokeWidth="0.7" fill="none" />
      </>
    ),
    /* ZAMRUD — potongan octagon bertingkat. */
    Emerald: (
      <>
        <path d="M5.4 2.6 H10.6 L13.4 5.4 V10.6 L10.6 13.4 H5.4 L2.6 10.6 V5.4 Z" fill="#3fd07f" stroke="rgba(0,0,0,.5)" strokeWidth="0.9" strokeLinejoin="round" />
        <path d="M6.4 5.4 H9.6 V10.6 H6.4 Z" fill="rgba(255,255,255,.4)" stroke="rgba(0,0,0,.35)" strokeWidth="0.7" />
      </>
    ),
    /* KRISTAL — rumpun tiga bilah. */
    Master: (
      <>
        <path d="M4.4 13.4 L3.2 9 L5.4 4.2 L8 7.8 Z" fill="#e0455c" stroke="rgba(0,0,0,.5)" strokeWidth="0.9" strokeLinejoin="round" />
        <path d="M7 13.6 L6.4 8.6 L9.4 3.6 L12.6 9.4 L11.4 13.6 Z" fill="#ff7183" stroke="rgba(0,0,0,.5)" strokeWidth="0.9" strokeLinejoin="round" />
        <path d="M9.4 3.6 L9.6 13.6" stroke="rgba(255,255,255,.55)" strokeWidth="0.7" />
        <path d="M2.4 13.6 H13.6" stroke="rgba(0,0,0,.45)" strokeWidth="0.9" strokeLinecap="round" />
      </>
    ),
    /* MEDALI BINTANG — puncak tertinggi. */
    Grandmaster: (
      <>
        <path d="M8 1.6 L9.95 5.85 L14.6 6.4 L11.15 9.5 L12.1 14.1 L8 11.75 L3.9 14.1 L4.85 9.5 L1.4 6.4 L6.05 5.85 Z" fill="#f5c542" stroke="rgba(0,0,0,.5)" strokeWidth="0.9" strokeLinejoin="round" />
        <path d="M8 4.6 L8.85 6.7 L11.15 7 L9.4 8.6 L9.85 10.85 L8 9.75 L6.15 10.85 L6.6 8.6 L4.85 7 L7.15 6.7 Z" fill="rgba(255,255,255,.5)" />
      </>
    ),
    /* CENTRAL — mahkota emas berkilau dengan permata di puncak,
       tier rahasia di atas Grandmaster (level 13.000+). */
    Central: (
      <>
        <path d="M2 6.2 L4.6 8.4 L8 3.4 L11.4 8.4 L14 6.2 L12.9 12.4 H3.1 Z" fill="#ffd76a" stroke="rgba(0,0,0,.55)" strokeWidth="0.9" strokeLinejoin="round" />
        <path d="M3.1 13.4 H12.9" stroke="rgba(0,0,0,.55)" strokeWidth="1.2" strokeLinecap="round" />
        <circle cx="8" cy="9.9" r="1.5" fill="#ff8f3f" stroke="rgba(0,0,0,.45)" strokeWidth="0.7" />
        <path d="M4.6 8.4 L5.4 11.6 M11.4 8.4 L10.6 11.6" stroke="rgba(255,255,255,.6)" strokeWidth="0.7" />
      </>
    ),
    /* RUBY — batu permata merah menyala dengan potongan faset.
       Tier di atas Central (level 20.000+). */
    Ruby: (
      <>
        <path d="M5.6 2.6 H10.4 L13.6 6 L8 13.8 L2.4 6 Z" fill="#e11d48" stroke="rgba(0,0,0,.55)" strokeWidth="0.9" strokeLinejoin="round" />
        <path d="M2.4 6 H13.6" stroke="rgba(0,0,0,.45)" strokeWidth="0.8" />
        <path d="M5.6 2.6 L4.6 6 L8 13.8 M10.4 2.6 L11.4 6 L8 13.8 M4.6 6 L11.4 6" stroke="rgba(255,255,255,.55)" strokeWidth="0.7" fill="none" />
        <path d="M6.2 3.4 L5.4 5.6" stroke="rgba(255,255,255,.85)" strokeWidth="0.9" strokeLinecap="round" />
        <circle cx="13.4" cy="2.9" r="0.7" fill="#ffd0dc" />
      </>
    ),
    /* ASCENDANT — bintang bersayap yang menanjak: simbol puncak baru
       di atas Central (level 28.000+). */
    Ascendant: (
      <>
        <path d="M8 1.8 L9.85 6.05 L14.4 6.65 L11.05 9.75 L12 14.2 L8 11.9 L4 14.2 L4.95 9.75 L1.6 6.65 L6.15 6.05 Z" fill="#e8fbff" stroke="rgba(0,0,0,.5)" strokeWidth="0.9" strokeLinejoin="round" />
        <path d="M8 4.6 L8.8 6.85 L11.05 7.2 L9.35 8.85 L9.75 11.05 L8 9.85 L6.25 11.05 L6.65 8.85 L4.95 7.2 L7.2 6.85 Z" fill="#67e8f9" opacity="0.85" />
        <path d="M1.4 3.2 L3.4 4.4 M12.6 3.2 L14.6 4.4 M8 0.9 V0.1" stroke="#f0abfc" strokeWidth="0.9" strokeLinecap="round" />
        <circle cx="2.2" cy="12.4" r="0.6" fill="#f0abfc" />
        <circle cx="13.8" cy="12.4" r="0.6" fill="#67e8f9" />
      </>
    ),
  };
  if (art[tier])
    return (
      <svg viewBox="0 0 16 16" className={className} aria-hidden>
        {art[tier]}
      </svg>
    );
  const gem: Record<string, string> = {
    Diamond: "#7ddffb",
    Emerald: "#3fd07f",
    Master: "#ff5a6e",
  };
  const ingot: Record<string, string> = {
    Bronze: "#c87a4a",
    Silver: "#b9c0ca",
    Grandmaster: "#f5c542",
  };
  if (gem[tier]) {
    const c = gem[tier];
    return (
      <svg viewBox="0 0 16 16" className={className} aria-hidden>
        <path
          d="M8 2 L13.2 6.6 L8 14 L2.8 6.6 Z"
          fill={c}
          stroke="rgba(0,0,0,.5)"
          strokeWidth="0.9"
          strokeLinejoin="round"
        />
        <path
          d="M2.8 6.6 H13.2 M8 2 L5.6 6.6 M8 2 L10.4 6.6"
          stroke="rgba(255,255,255,.55)"
          strokeWidth="0.8"
          fill="none"
        />
      </svg>
    );
  }
  const c = ingot[tier] ?? "#c8cdd6";
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden>
      <path
        d="M4.6 6.4 H11.4 L13.4 10.4 H2.6 Z"
        fill={c}
        stroke="rgba(0,0,0,.5)"
        strokeWidth="0.9"
        strokeLinejoin="round"
      />
      <path
        d="M2.6 10.4 H13.4 V12.4 H2.6 Z"
        fill={c}
        opacity="0.8"
        stroke="rgba(0,0,0,.5)"
        strokeWidth="0.9"
        strokeLinejoin="round"
      />
    </svg>
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

/* --------------------------------------------------------------
 * Animasi intro FULLSCREEN — pilihan Pengaturan > Animasi profil.
 *   • "awan"  — awan lembut melayang di langit senja.
 *   • "gagak" — siluet gagak melintas dengan kepakan sayap.
 * Ketuk untuk melewati; otomatis selesai dalam 2.6 detik.
 * ------------------------------------------------------------- */
const CLOUDS = [
  { l: -8, t: 12, w: 62, h: 15, delay: 0, dur: 7 },
  { l: 30, t: 30, w: 55, h: 13, delay: -2, dur: 8 },
  { l: -4, t: 50, w: 70, h: 17, delay: -4, dur: 9 },
  { l: 40, t: 66, w: 58, h: 14, delay: -1, dur: 7.5 },
  { l: 6, t: 82, w: 66, h: 16, delay: -5, dur: 8.5 },
];

const RAVENS = [
  { t: 12, delay: 0, dur: 2.3, scale: 1 },
  { t: 30, delay: 0.35, dur: 2.0, scale: 0.7 },
  { t: 47, delay: 0.12, dur: 2.5, scale: 1.3 },
  { t: 64, delay: 0.5, dur: 2.1, scale: 0.85 },
  { t: 79, delay: 0.28, dur: 2.4, scale: 0.6 },
];

function ProfileIntro({
  style,
  onSkip,
}: {
  style: string;
  onSkip: () => void;
}) {
  useEffect(() => {
    const t = window.setTimeout(onSkip, 2600);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ravens = style === "gagak";
  return (
    <motion.button
      type="button"
      aria-label="Lewati animasi pembuka"
      onClick={onSkip}
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 z-[95] block w-full overflow-hidden"
      style={
        ravens
          ? {
              background:
                "radial-gradient(120% 90% at 50% 15%, #1b1230 0%, #0a0714 65%, #05040a 100%)",
            }
          : { background: "linear-gradient(180deg,#0a1022 0%,#152443 48%,#2b3d63 100%)" }
      }
    >
      {ravens ? (
        <span aria-hidden className="absolute inset-0">
          {/* Kabut gelap di bawah */}
          <span className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/75 to-transparent" />
          {RAVENS.map((b, i) => (
            <span
              key={i}
              className="absolute left-0"
              style={{
                top: `${b.t}%`,
                animation: `yn-raven-fly ${b.dur}s ease-in ${b.delay}s both`,
              }}
            >
              <svg
                viewBox="0 0 40 16"
                width={46 * b.scale}
                height={20 * b.scale}
                className="drop-shadow-[0_2px_6px_rgba(0,0,0,.85)]"
                style={{
                  animation: `yn-flap ${0.32 + i * 0.05}s ease-in-out ${b.delay}s infinite alternate`,
                }}
              >
                <path
                  d="M1 11 C9 11 12 5 15 4 C17 3.4 19 5 20 8 C21 5 23 3.4 25 4 C28 5 31 11 39 11 C31 9.6 28 8 25 7.2 C23 6.6 21 7.6 20 10 C19 7.6 17 6.6 15 7.2 C12 8 9 9.6 1 11 Z"
                  fill="#04030a"
                />
              </svg>
            </span>
          ))}
          {/* Bulan samar */}
          <span className="absolute right-[14%] top-[16%] size-16 rounded-full bg-white/10 blur-md" />
        </span>
      ) : (
        <span aria-hidden className="absolute inset-0">
          {/* Bintang kecil */}
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <span
              key={i}
              className="absolute size-1 rounded-full bg-white/70"
              style={{
                left: `${(i * 29 + 7) % 92}%`,
                top: `${(i * 17 + 6) % 40}%`,
                animation: `yn-twinkle ${2.2 + (i % 3) * 0.6}s ease-in-out ${i * 0.3}s infinite`,
              }}
            />
          ))}
          {/* Awan melayang */}
          {CLOUDS.map((c, i) => (
            <span
              key={i}
              className="absolute rounded-full bg-white/20 blur-2xl"
              style={{
                left: `${c.l}%`,
                top: `${c.t}%`,
                width: `${c.w}%`,
                height: `${c.h}%`,
                animation: `yn-cloud-drift ${c.dur}s ease-in-out ${c.delay}s infinite alternate`,
              }}
            />
          ))}
        </span>
      )}

      {/* Teks pembuka */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.55 }}
        className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center"
      >
        <p
          className={cn(
            "text-[11px] font-black uppercase tracking-[0.4em]",
            ravens ? "text-white/45" : "text-white/55",
          )}
        >
          {ravens ? "Gagak melintas…" : "Awan berarak…"}
        </p>
        <p className="mt-2 text-2xl tracking-tight text-white yn-title">
          Membuka profil
        </p>
        <p className="mt-1 text-[11px] font-semibold text-white/55">
          Ketuk untuk melewati
        </p>
      </motion.div>
    </motion.button>
  );
}
