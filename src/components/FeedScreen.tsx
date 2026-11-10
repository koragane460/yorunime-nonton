import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { type Id } from "@/convex/_generated/dataModel";
import { Avatar, BlueCheck, ClanTag, LevelBadge } from "@/components/lstream-ui";
import { DEFAULT_CLAN_ICON } from "@/lib/clanIcons";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bookmark,
  Check,
  ChevronLeft,
  Eye,
  Globe,
  Heart,
  Image as ImageIcon,
  Lock,
  MessageCircle,
  Music,
  Play,
  Plus,
  Send,
  Share2,
  Search,
  Volume2,
  Type as TypeIcon,
  Video as VideoIcon,
  UserPlus,
  Users,
  X,
  Repeat2,
  Mail,
  MessageSquare,
  Link2,
  Flag,
  EyeOff,
  CircleSlash2,
  CheckCircle2,
  Compass,
  Home,
  UserRound,
  Grid3X3,
  Bell,
  ChevronRight,
  ChevronDown,
  MoreHorizontal,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useFastChat } from "@/hooks/use-fast-chat";
import { ChatPanel } from "@/components/ChatPanel";
import { StoryRing, StoryViewer } from "@/components/StoriesUI";
import { FeedCommentSheet } from "@/components/FeedCommentSheet";
import {
  FeedPrivacySheet,
  FeedViewersSheet,
} from "@/components/FeedSettingsSheets";
import { FeedEditProfileSheet } from "@/components/FeedEditProfile";
import {
  TierPinnedBadge,
  TierRewardsSheet,
  currentTierId,
} from "@/components/FeedTierBadges";

/** Waktu relatif singkat — "baru", "5 mnt", "2 jam", "3 hr". */
function timeAgo(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return "baru";
  if (s < 3600) return `${Math.floor(s / 60)} mnt`;
  if (s < 86400) return `${Math.floor(s / 3600)} jam`;
  if (s < 2592000) return `${Math.floor(s / 86400)} hr`;
  return `${Math.floor(s / 2592000)} bln`;
}

/** Angka ringkas gaya TikTok: 6,8 rb · 2,3 jt. */
function fmtCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".", ",")} jt`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(".", ",")} rb`;
  return String(n);
}

/* Sembunyikan konten tanpa menunggu server — dipakai aksi "Tidak tertarik"
   dan "Stop rekomendasi". Event lokal membuat feed langsung berubah. */
const FEED_HIDDEN_POSTS = "yn:feed-hidden-posts";
const FEED_HIDDEN_AUTHORS = "yn:feed-hidden-authors";
const FEED_FILTER_EVENT = "yn-feed-filter";
function readIdList(key: string): string[] {
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}
function hideFeedPost(postId: string) {
  const next = Array.from(new Set([...readIdList(FEED_HIDDEN_POSTS), postId]));
  try {
    window.localStorage.setItem(FEED_HIDDEN_POSTS, JSON.stringify(next));
  } catch {
    /* mode privat */
  }
  window.dispatchEvent(new Event(FEED_FILTER_EVENT));
}
function hideFeedAuthor(authorId: string) {
  const next = Array.from(new Set([...readIdList(FEED_HIDDEN_AUTHORS), authorId]));
  try {
    window.localStorage.setItem(FEED_HIDDEN_AUTHORS, JSON.stringify(next));
  } catch {
    /* mode privat */
  }
  window.dispatchEvent(new Event(FEED_FILTER_EVENT));
}

/** Clipboard dengan fallback untuk browser/preview yang tidak memberi izin. */
async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    const input = document.createElement("textarea");
    input.value = text;
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.appendChild(input);
    input.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(input);
    if (!ok) throw new Error("clipboard tidak tersedia");
  }
}

type Post = {
  postId: Id<"feedPosts">;
  userId: Id<"users">;
  kind: "image" | "music" | "text" | "video";
  caption: string;
  imageUrl: string | null;
  thumbUrl: string | null;
  imageStorageId?: string | null;
  thumbStorageId?: string | null;
  level?: number;
  clanTag?: string;
  clanTagIcon?: string;
  clanNameColor?: string;
  premium?: boolean;
  music: { title: string; artist?: string; cover?: string; audioUrl?: string } | null;
  overlay?: {
    text: string;
    font: string;
    italic: boolean;
    outline: boolean;
    size: number;
    /** Posisi teks (% dari kiri & atas) hasil drag di editor. */
    x?: number;
    y?: number;
    /** Warna teks (hex) — pilihan warna baru di panel teks. */
    color?: string;
  } | null;
  audio?: { musicVol: number; videoVol: number } | null;
  privacy: "all" | "teman" | "private";
  allowComments?: boolean;
  allowReuse?: boolean;
  likeCount: number;
  liked: boolean;
  favoriteCount: number;
  favorited: boolean;
  commentCount: number;
  views: number;
  createdAt: number;
  username: string;
  image: string | null;
  isMe: boolean;
  isFriend?: boolean;
  repostCount?: number;
  reposted?: boolean;
  reposterIds?: string[];
  reposters?: Reposter[];
};

type Reposter = {
  userId: Id<"users">;
  username: string;
  image: string | null;
  createdAt: number;
};

type FeedActivity = {
  _id: string;
  type: "like" | "favorite" | "comment" | "repost" | "follow";
  userId: string;
  username: string;
  image: string | null;
  postId: Id<"feedPosts"> | null;
  caption: string;
  cover: string | null;
  detail?: string;
  createdAt: number;
};

/* ------------------------------------------------------------------ *
 *  BAGIAN BAWAH KIRI — username + caption
 * ------------------------------------------------------------------ */
function CaptionBlock({
  p,
  onOpenReposters,
  onOpenViewers,
  onOpenPrivacy,
}: {
  p: Post;
  onOpenReposters: () => void;
  onOpenViewers?: () => void;
  onOpenPrivacy?: () => void;
}) {
  const repostCount = p.repostCount ?? 0;
  return (
    <div className="pointer-events-auto absolute bottom-0 left-0 right-[68px] z-20 px-4 pb-[5.7rem] pt-3">
      {repostCount > 0 && (
        <button
          type="button"
          onClick={onOpenReposters}
          className="mb-1.5 flex max-w-full items-center gap-1.5 rounded-xl bg-white px-2 py-1 text-left text-[#17151b] shadow-[0_10px_24px_-16px_rgba(0,0,0,.9)]"
        >
          <span className="flex -space-x-1.5">
            {(p.reposters ?? []).slice(0, 2).map((r) => (
              <Avatar
                key={String(r.userId)}
                src={r.image ?? undefined}
                seed={r.username}
                className="size-5 rounded-full ring-2 ring-white"
              />
            ))}
          </span>
          <span className="truncate text-[10px] font-black leading-none">
            {repostCount > 1 ? `${repostCount} ` : ""}Memosting ulang
          </span>
        </button>
      )}
      <div className="flex items-center gap-2">
        <p className="min-w-0 truncate text-[17px] font-black leading-tight text-white [text-shadow:0_1px_2px_rgba(0,0,0,.95),0_0_10px_rgba(0,0,0,.7)]">
          {p.username}
        </p>
        {p.isFriend && (
          <span className="shrink-0 rounded bg-white px-1.5 py-0.5 text-[7px] font-black leading-none text-black shadow">
            Teman Anda
          </span>
        )}
      </div>
      {p.isMe && (
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={onOpenViewers}
            className="flex items-center gap-1 rounded-full bg-black/38 px-2 py-1 text-[9px] font-black text-white/85 backdrop-blur-sm transition active:scale-95"
          >
            <Eye className="size-3" /> {p.views} penayangan
          </button>
          <button
            type="button"
            onClick={onOpenPrivacy}
            className="rounded-full bg-black/38 px-2.5 py-1 text-[9px] font-black text-white/85 backdrop-blur-sm transition active:scale-95"
          >
            Pengaturan Privasi
          </button>
        </div>
      )}
      {p.caption && (
        <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-[14px] font-semibold leading-snug text-white [text-shadow:0_2px_5px_rgba(0,0,0,.9)]">
          {p.caption}
        </p>
      )}
      {p.music && (
        <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-bold text-white/75">
          <Music className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">
            {p.music.title}
            {p.music.artist ? ` · ${p.music.artist}` : ""}
          </span>
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  RAIL KANAN — foto+follow, like, komentar, share
 * ------------------------------------------------------------------ */
function RightRail({
  p,
  following,
  onFollow,
  onLike,
  onComment,
  onFavorite,
  onShare,
  onOpenProfile,
}: {
  p: Post;
  following: boolean;
  onFollow: () => void;
  onLike: () => void;
  onComment: () => void;
  onFavorite: () => void;
  onShare: () => void;
  onOpenProfile: () => void;
}) {
  return (
    <div className="absolute bottom-[4.7rem] right-2 z-20 flex flex-col items-center justify-end gap-3.5">
      {/* Foto profil + Follow. Tombol merah muda HILANG total setelah follow. */}
      <div className="flex flex-col items-center gap-1.5">
        <button
          type="button"
          onClick={onOpenProfile}
          aria-label={`Buka profil ${p.username}`}
          className="transition active:scale-95"
        >
          <Avatar src={p.image ?? undefined} seed={p.username} className="size-12 ring-2 ring-white/60" />
        </button>
        {!p.isMe && !following && (
          <button
            onClick={onFollow}
            aria-label="Ikuti"
            title="Ikuti"
            className="grid size-7 place-items-center rounded-full bg-rose-400 text-white shadow-[0_8px_18px_-10px_rgba(244,63,94,.9)] transition active:scale-90"
          >
            <Plus className="size-4" strokeWidth={3} />
          </button>
        )}
      </div>

      <button onClick={onLike} className="flex flex-col items-center gap-1.5 transition active:scale-90">
        <Heart
          className={cn(
            "size-9 transition",
            p.liked ? "fill-rose-500 text-rose-500" : "text-white drop-shadow",
          )}
        />
        <span className="text-xs font-black text-white drop-shadow">{p.likeCount}</span>
      </button>

      <button onClick={onComment} className="flex flex-col items-center gap-1.5 transition active:scale-90">
        {/* Ikon chat TANPA background — polos seperti ikon share. */}
        <MessageCircle className="size-8 text-white drop-shadow" />
        <span className="text-xs font-black text-white drop-shadow">{p.commentCount}</span>
      </button>

      {/* Favorit bentuk pita, jumlah di bawah. */}
      <button onClick={onFavorite} className="flex flex-col items-center gap-1.5 transition active:scale-90">
        <Bookmark
          className={cn(
            "size-8 drop-shadow",
            p.favorited ? "fill-amber-400 text-amber-400" : "text-white",
          )}
          strokeWidth={2.3}
        />
        <span className="text-xs font-black text-white drop-shadow">
          {p.favoriteCount}
        </span>
      </button>

      <button onClick={onShare} className="flex flex-col items-center gap-1.5 transition active:scale-90">
        <Share2 className="size-8 text-white drop-shadow" />
        <span className="text-xs font-black text-white drop-shadow">Bagikan</span>
      </button>

      {/* Musik minimal: cakram berputar + label pendek. */}
      {(p.music || p.kind === "video") && (
        <div className="flex flex-col items-center gap-1.5">
          <span className="relative grid size-11 place-items-center overflow-hidden rounded-full border border-white/35 bg-black/55 shadow-[0_10px_24px_-14px_rgba(0,0,0,.95)]">
            <img
              src={
                p.music
                  ? p.music.cover || p.imageUrl || p.image || undefined
                  : p.image || p.imageUrl || undefined
              }
              alt=""
              className={cn(
                "size-full rounded-full object-cover opacity-90",
                p.music && "animate-[spin_8s_linear_infinite]",
              )}
            />
            <span className="absolute size-3 rounded-full border border-white/60 bg-black/75" />
            <Music className="absolute -right-0.5 -top-0.5 size-3.5 text-white drop-shadow" />
          </span>
          <span className="max-w-[62px] truncate text-[8px] font-bold text-white/85 drop-shadow">
            {p.music?.title ?? "Suara asli"}
          </span>
        </div>
      )}
    </div>
  );
}

/** Video Feed tanpa UI player bawaan: ketuk untuk play/pause. */
function FeedVideo({
  src,
  poster,
  volume,
  musicUrl,
  musicVolume,
  onDoubleTap,
}: {
  src: string;
  poster?: string;
  volume: number;
  musicUrl?: string;
  musicVolume?: number;
  onDoubleTap: () => void;
}) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const lastTap = useRef(0);
  const tapTimer = useRef<number | null>(null);

  // Video hanya berbunyi saat benar-benar terlihat. Dengan begini video di
  // post lain tidak ikut memutar audio di belakang dan scroll terasa ringan.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.volume = Math.max(0, Math.min(1, volume));
    if (audioRef.current) {
      audioRef.current.volume = Math.max(0, Math.min(1, musicVolume ?? 1));
    }
    const play = () => {
      const media = [el, audioRef.current].filter(Boolean) as HTMLMediaElement[];
      for (const m of media) {
        void m.play().catch(() => {
          // Browser kadang menolak autoplay bersuara. Video tetap diputar
          // (senyap), lalu suara dinyalakan pada ketukan pertama.
          if (m === el) {
            el.muted = true;
            void el.play().catch(() => {});
          }
        });
      }
    };
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) play();
        else {
          el.pause();
          audioRef.current?.pause();
        }
      },
      { threshold: 0.55 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [src, musicUrl, volume, musicVolume]);

  const toggle = () => {
    const el = ref.current;
    if (!el) return;
    if (el.paused) {
      void el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
      void audioRef.current?.play().catch(() => {});
    } else {
      el.pause();
      audioRef.current?.pause();
      setPlaying(false);
    }
  };

  /** Satu ketuk = pause/play, dua ketuk cepat = love (tidak ikut pause). */
  const tap = () => {
    const el = ref.current;
    // Ketukan pertama setelah autoplay senyap = nyalakan suara.
    if (el?.muted) {
      el.muted = false;
      void el.play().catch(() => {});
      void audioRef.current?.play().catch(() => {});
      setPlaying(true);
      return;
    }
    const now = Date.now();
    if (now - lastTap.current < 340) {
      if (tapTimer.current) window.clearTimeout(tapTimer.current);
      tapTimer.current = null;
      lastTap.current = 0;
      onDoubleTap();
      return;
    }
    lastTap.current = now;
    tapTimer.current = window.setTimeout(() => {
      tapTimer.current = null;
      toggle();
    }, 360);
  };

  return (
    <div className="absolute inset-0">
      <video
        ref={ref}
        src={src}
        poster={poster}
        className="h-full w-full object-cover"
        loop
        playsInline
        preload="auto"
        controls={false}
        disablePictureInPicture
        onClick={tap}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />
      {musicUrl && (
        <audio
          ref={audioRef}
          src={musicUrl}
          loop
          preload="none"
          onLoadedMetadata={() => {
            if (audioRef.current) {
              audioRef.current.volume = Math.max(0, Math.min(1, musicVolume ?? 1));
            }
          }}
        />
      )}
      <button
        type="button"
        onClick={tap}
        aria-label={playing ? "Pause video" : "Putar video"}
        className={cn(
          "absolute left-1/2 top-1/2 z-10 grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/35 text-white backdrop-blur-md transition-all duration-200 active:scale-90",
          playing ? "size-0 opacity-0" : "size-16 opacity-100",
        )}
      >
        <Play className="size-7 translate-x-px fill-current" strokeWidth={1.5} />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  SATU POST — layar penuh
 * ------------------------------------------------------------------ */
function PostView({
  p,
  following,
  onFollow,
  onLike,
  onComment,
  onFavorite,
  onShare,
  onOpenProfile,
  onOpenReposters,
  onDoubleLike,
  onOpenViewers,
  onOpenPrivacy,
  children,
}: {
  p: Post;
  following: boolean;
  onFollow: () => void;
  onLike: () => void;
  onComment: () => void;
  onFavorite: () => void;
  onShare: () => void;
  onOpenProfile: () => void;
  onOpenReposters: () => void;
  onDoubleLike: () => void;
  onOpenViewers?: () => void;
  onOpenPrivacy?: () => void;
  children?: ReactNode;
}) {
  const [hearts, setHearts] = useState<{ id: number; x: number; y: number; tilt: number }[]>([]);
  const lastTap = useRef(0);
  const tapTimer = useRef<number | null>(null);
  const popHearts = (x = 50, y = 55) => {
    const heart = {
      id: Date.now() + Math.random(),
      x: Math.max(12, Math.min(88, x)),
      y: Math.max(12, Math.min(78, y)),
      tilt: (x - 50) * 0.18,
    };
    setHearts((prev) => [...prev, heart]);
    window.setTimeout(() => {
      setHearts((prev) => prev.filter((h) => h.id !== heart.id));
    }, 900);
  };
  const mediaTap = (x: number, y: number, videoToggle: () => void) => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      if (tapTimer.current) window.clearTimeout(tapTimer.current);
      tapTimer.current = null;
      lastTap.current = 0;
      onDoubleLike();
      popHearts(x, y);
      return;
    }
    lastTap.current = now;
    tapTimer.current = window.setTimeout(() => {
      tapTimer.current = null;
      videoToggle();
    }, 240);
  };
  // Geser ke kanan → detail konten akun. Konten ikut bergeser sedikit
  // sebelum dilepas, jadi terasa seperti membuka panel, bukan pindah paksa.
  const touch = useRef<{ x: number; y: number } | null>(null);
  const [dragX, setDragX] = useState(0);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const s = touch.current;
    if (!s) return;
    const t = e.touches[0];
    const dx = t.clientX - s.x;
    const dy = Math.abs(t.clientY - s.y);
    if (dx > 0 && dx > dy * 1.4) setDragX(Math.min(120, dx * 0.5));
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touch.current;
    touch.current = null;
    setDragX(0);
    if (!s) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x;
    const dy = Math.abs(t.clientY - s.y);
    if (dx > 90 && dy < 70) onOpenProfile();
  };

  return (
    <div
      className="relative h-full w-full overflow-hidden bg-black"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{
        transform: dragX ? `translateX(${dragX}px)` : undefined,
        transition: dragX ? "none" : "transform 180ms ease-out",
      }}
    >
      {/* Pratinjau detail konten yang muncul perlahan saat digeser. */}
      {dragX > 8 && (
        <div
          className="absolute inset-y-0 left-0 z-0 flex w-[118px] flex-col items-center justify-center gap-2 bg-[#12141a] text-white"
          style={{ transform: `translateX(-${dragX}px)` }}
        >
          <Avatar src={p.image ?? undefined} seed={p.username} className="size-12 ring-2 ring-white/20" />
          <span className="px-2 text-center text-[9px] font-black leading-tight text-white/60">
            Detail konten
          </span>
        </div>
      )}
      {p.kind === "video" && p.imageUrl ? (
        <>
          <FeedVideo
            src={p.imageUrl}
            poster={p.thumbUrl ?? undefined}
            volume={(p.audio?.videoVol ?? 100) / 100}
            musicUrl={p.music?.audioUrl}
            musicVolume={(p.audio?.musicVol ?? 100) / 100}
            onDoubleTap={() => {
              onDoubleLike();
              popHearts(52, 54);
            }}
          />
        </>
      ) : p.imageUrl ? (
        <img
          src={p.imageUrl}
          alt={p.caption}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            mediaTap(
              ((e.clientX - r.left) / r.width) * 100,
              ((e.clientY - r.top) / r.height) * 100,
              () => undefined,
            );
          }}
        />
      ) : p.kind === "music" ? (
        <div
          className="flex h-full w-full items-center justify-center bg-[radial-gradient(120%_80%_at_50%_0%,#2a1330_0%,#0d0a14_65%,#070609_100%)]"
          onClick={() => mediaTap(50, 52, () => undefined)}
        >
          <div className="flex flex-col items-center gap-4 px-8 text-center">
            <div className="relative flex size-40 items-center justify-center rounded-full border border-white/15 bg-black/40">
              <img
                src={p.music?.cover ?? p.image ?? undefined}
                alt=""
                className="size-32 rounded-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
              <Music className="absolute size-8 text-white/70" aria-hidden />
            </div>
            <p className="text-lg font-black text-white">{p.music?.title}</p>
            <p className="text-xs font-bold text-white/60">{p.music?.artist ?? p.username}</p>
          </div>
        </div>
      ) : (
        <div
          className="flex h-full w-full items-center justify-center bg-[linear-gradient(165deg,#171126_0%,#101018_55%,#0a0a10_100%)] px-7"
          onClick={() => mediaTap(50, 52, () => undefined)}
        >
          <p className="whitespace-pre-wrap text-center text-xl font-black leading-relaxed text-white/90">
            {p.caption || "—"}
          </p>
        </div>
      )}

      {/* Teks overlay hasil editor post — font, miring, outline, ukuran. */}
      {p.overlay?.text && (p.imageUrl || p.kind === "video") && (
        <p
          className={cn(
            "pointer-events-none absolute z-10 max-w-[80%] whitespace-pre-wrap text-center",
            p.overlay.x === undefined && "inset-x-5 top-1/2 -translate-y-1/2",
          )}
          style={{
            ...(p.overlay.x !== undefined
              ? {
                  left: `${p.overlay.x}%`,
                  top: `${p.overlay.y ?? 50}%`,
                  transform: "translate(-50%, -50%)",
                }
              : {}),
            fontFamily: `var(--font-${p.overlay.font === "display" ? "display" : p.overlay.font === "mono" ? "mono" : "sans"})`,
            fontStyle: p.overlay.italic ? "italic" : "normal",
            fontSize: `${p.overlay.size * 4}px`,
            lineHeight: 1.15,
            color: p.overlay.color ?? "#fff",
            textShadow: p.overlay.outline
              ? "0 0 3px #000, 0 0 6px rgba(0,0,0,.9), 0 2px 4px rgba(0,0,0,.9)"
              : "0 2px 8px rgba(0,0,0,.55)",
          }}
        >
          {p.overlay.text}
        </p>
      )}

      <CaptionBlock
        p={p}
        onOpenReposters={onOpenReposters}
        onOpenViewers={onOpenViewers}
        onOpenPrivacy={onOpenPrivacy}
      />
      <RightRail
        p={p}
        following={following}
        onFollow={onFollow}
        onLike={onLike}
        onComment={onComment}
        onFavorite={onFavorite}
        onShare={onShare}
        onOpenProfile={onOpenProfile}
      />
      <AnimatePresence>
        {hearts.map((h) => (
          <motion.span
            key={h.id}
            initial={{ opacity: 0, scale: 0.4, y: 0 }}
            animate={{ opacity: [0, 1, 1, 0], scale: [0.35, 1.35, 1.15, 0.95], y: -110 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.88, ease: "easeOut" }}
            className="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-1/2 text-rose-500 drop-shadow-[0_10px_20px_rgba(0,0,0,.55)]"
            style={{ left: `${h.x}%`, top: `${h.y}%`, rotate: `${h.tilt}deg` }}
          >
            <Heart className="size-[108px] fill-current" strokeWidth={1.2} />
          </motion.span>
        ))}
      </AnimatePresence>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  SHEET KOMENTAR
 * ------------------------------------------------------------------ */
function CommentSheet({ postId, onClose }: { postId: Id<"feedPosts">; onClose: () => void }) {
  const list = useQuery(api.feed.listComments, { postId });
  const add = useMutation(api.feed.addComment);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  /** Komentar yang sedang dibalas (balasan juga ada di Feed, bukan cuma di
   *  komentar halaman Nonton). */
  const [replyTo, setReplyTo] = useState<{
    id: Id<"feedComments">;
    username: string;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  /** Jaga posisi scroll halaman saat kolom komentar difokus — keyboard
      membuka dan browser suka menarik halaman ke atas sedikit (permintaan). */
  const keepScroll = () => {
    const y = window.scrollY;
    requestAnimationFrame(() => window.scrollTo({ top: y }));
  };

  const submit = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      await add({
        postId,
        text,
        ...(replyTo
          ? { parentId: replyTo.id, replyTo: replyTo.username }
          : {}),
      });
      setText("");
      setReplyTo(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal mengirim komentar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}        className="fixed inset-0 z-[95] flex flex-col justify-end"
        onClick={onClose}
      >
        <div className="flex-1 bg-black/60 backdrop-blur-[2px]" />
        <motion.div
          initial={{ y: 60 }}
          animate={{ y: 0 }}
          exit={{ y: 60 }}
          transition={{ duration: 0.24, ease: "easeOut" }}
          onClick={(e) => e.stopPropagation()}
          className="flex h-[42vh] max-h-[68vh] flex-col rounded-t-3xl border-t border-white/15 bg-[#141821] p-4 pb-6"
        >
          <div className="mb-2 flex items-center gap-2">
            <span aria-hidden className="mx-auto block h-1 w-10 rounded-full bg-white/25" />
          </div>
          <p className="mb-2 shrink-0 text-center text-sm text-white yn-title">
            Komentar
          </p>
          <div className="thin-scroll min-h-0 flex-1 space-y-4 overflow-y-auto pb-2 pt-1">
            {!list && (
              <div className="space-y-3 py-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex gap-2.5">
                    <div className="skeleton size-8 shrink-0 rounded-full" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="skeleton h-3 w-1/3 rounded-full" />
                      <div className="skeleton h-2.5 w-4/5 rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {list?.length === 0 && (
              <p className="py-6 text-center text-xs text-zinc-500">
                Belum ada komentar — jadi yang pertama.
              </p>
            )}
            {list?.map((c: any) => (
              <div
                key={c.commentId}
                className="relative flex items-start gap-2.5 overflow-hidden rounded-2xl px-2 py-2"
              >
                {c.bannerUrl && (
                  <>
                    <img
                      src={c.bannerUrl}
                      alt=""
                      className="pointer-events-none absolute inset-0 size-full object-cover"
                      loading="lazy"
                    />
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-0 bg-black/62"
                    />
                  </>
                )}
                <Avatar
                  src={c.image}
                  seed={c.username}
                  className="relative size-8 shrink-0 ring-1 ring-white/15"
                />
                <div className="relative min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[13px] font-black text-white">
                      {c.username}
                    </span>
                    {c.premium && <BlueCheck className="size-3.5 shrink-0" />}
                    {c.clanTag && (
                      <ClanTag
                        icon={c.clanTagIcon ?? DEFAULT_CLAN_ICON}
                        tag={c.clanTag}
                        color={c.clanNameColor}
                        level={c.level}
                        className="scale-[0.72] px-1 py-0 text-[9px]"
                      />
                    )}
                    {c.level !== undefined && (
                      <LevelBadge
                        level={c.level}
                        className="scale-[0.85] px-1 py-0"
                      />
                    )}
                    <span className="ml-auto shrink-0 text-[10px] font-semibold text-white/45">
                      {timeAgo(c.createdAt)}
                    </span>
                  </div>
                  {/* Pesan dibungkus kotak dengan ekor kiri bawah, sama
                      bentuknya seperti ikon Collection. */}
                  <div className="yn-tail-l mt-1 rounded-2xl border border-white/10 bg-white/[0.07] px-3 py-2">
                    {c.replyTo && (
                      <p className="mb-0.5 text-[10px] font-bold text-gold">
                        @{c.replyTo}
                      </p>
                    )}
                    <p className="break-words text-[14px] leading-relaxed text-white/90">
                      {c.text}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setReplyTo({ id: c.commentId, username: c.username });
                      inputRef.current?.focus();
                    }}
                    className="mt-1 flex items-center gap-1 text-[11px] font-bold text-white/45 transition active:scale-95"
                  >
                    Balas
                  </button>
                </div>
              </div>
            ))}
          </div>
          {replyTo && (
            <div className="mb-1 flex shrink-0 items-center gap-2 rounded-xl bg-gold/12 px-3 py-1.5">
              <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-gold">
                Membalas @{replyTo.username}
              </span>
              <button
                onClick={() => setReplyTo(null)}
                aria-label="Batal balas"
                className="text-[11px] font-black text-white/50"
              >
                Batal
              </button>
            </div>
          )}
          <div className="mt-2 flex shrink-0 items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-4 py-1">
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={keepScroll}
            onKeyDown={(e) => e.key === "Enter" && void submit()}
            placeholder={
              err ??
              (replyTo ? `Balas @${replyTo.username}…` : "Tulis komentar…")
            }
            className={cn(
              "h-10 flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-white/40 focus-visible:ring-0",
              err && "placeholder:text-red-300",
            )}
          />
          {/* Tombol kirim — WARNA FLAT (tanpa gradien & kilau berjalan). */}
          <button
            onClick={() => void submit()}
            disabled={busy || !text.trim()}
            aria-label="Kirim komentar"
            className={cn(
              "group relative flex size-11 shrink-0 items-center justify-center rounded-full transition-all duration-300 active:scale-90",
              text.trim()
                ? "bg-gold text-[#241c02]"
                : "bg-primary text-primary-foreground",
            )}
          >
            <Send className="size-5 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ *
 *  SHEET BAGIKAN — pilih teman lalu kirim ke chat
 * ------------------------------------------------------------------ */
function ShareAction({
  icon,
  label,
  bg,
  color = "#fff",
  onClick,
}: {
  icon: ReactNode;
  label: string;
  bg: string;
  color?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-[58px] shrink-0 flex-col items-center gap-1.5 transition active:scale-95"
    >
      <span
        className="grid size-12 place-items-center rounded-full shadow-[0_12px_24px_-16px_rgba(0,0,0,.9)]"
        style={{ background: bg, color }}
      >
        {icon}
      </span>
      <span className="w-full truncate text-center text-[8.5px] font-bold leading-tight text-white/70">
        {label}
      </span>
    </button>
  );
}

function ShareSheet({ p, onClose }: { p: Post; onClose: () => void }) {
  const friends = useQuery(api.friends.listFriends, {});
  const send = useMutation(api.chat.sendMessage);
  const toggleRepost = useMutation(api.feed.toggleRepost);
  const addStory = useMutation(api.stories.addStory);
  const getUploadUrl = useMutation(api.storage.getUploadUrl);
  const [picker, setPicker] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reported, setReported] = useState(false);
  const [reposted, setReposted] = useState(!!p.reposted);
  const [busy, setBusy] = useState(false);

  const link = `${window.location.origin}/feed?post=${String(p.postId)}`;
  const list = (friends ?? []).map((f: any) => ({
    userId: String(f.userId ?? f._id ?? ""),
    username: f.username ?? "user",
    image: f.image ?? null,
  }));

  const doRepost = async () => {
    if (busy) return;
    setBusy(true);
    const next = !reposted;
    setReposted(next);
    try {
      await toggleRepost({ postId: p.postId });
      toast.success(next ? "Konten diposting ulang" : "Posting ulang dibatalkan");
    } catch (e) {
      setReposted(!next);
      toast.error(e instanceof Error ? e.message : "Gagal repost");  } finally {
    setBusy(false);
  }
};

  const makeStory = async () => {
    setBusy(true);
    try {
      let storageId = p.imageStorageId ?? "";
      let mediaType: "image" | "video" = p.kind === "video" ? "video" : "image";
      // Post teks/musik tanpa media tetap bisa jadi story: render kartu
      // bergradasi berisi caption + username, lalu unggah seperti foto biasa.
      if (!storageId) {
        const canvas = document.createElement("canvas");
        canvas.width = 1080;
        canvas.height = 1920;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas tidak tersedia");
        const grad = ctx.createLinearGradient(0, 0, 1080, 1920);
        grad.addColorStop(0, "#191126");
        grad.addColorStop(0.55, "#10131a");
        grad.addColorStop(1, "#08080c");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 1080, 1920);
        ctx.fillStyle = "rgba(255,255,255,.08)";
        ctx.beginPath();
        ctx.arc(880, 300, 330, 0, Math.PI * 2);
        ctx.fill();
        ctx.textAlign = "center";
        ctx.fillStyle = "#ffffff";
        ctx.font = "900 68px sans-serif";
        const words = (p.caption || p.music?.title || "Konten YoruNime").split(" ");
        const lines: string[] = [];
        let line = "";
        for (const word of words) {
          const test = line ? `${line} ${word}` : word;
          if (ctx.measureText(test).width > 840 && line) {
            lines.push(line);
            line = word;
          } else line = test;
        }
        if (line) lines.push(line);
        const shown = lines.slice(0, 6);
        const startY = 960 - ((shown.length - 1) * 86) / 2;
        shown.forEach((l, idx) => ctx.fillText(l, 540, startY + idx * 86));
        ctx.fillStyle = "rgba(255,255,255,.7)";
        ctx.font = "700 42px sans-serif";
        ctx.fillText(`@${p.username}`, 540, 1680);
        ctx.fillStyle = "rgba(255,255,255,.35)";
        ctx.font = "600 30px sans-serif";
        ctx.fillText("YoruNime Feed", 540, 1740);
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob((b) => resolve(b), "image/jpeg", 0.9),
        );
        if (!blob) throw new Error("Gagal membuat gambar story");
        const uploadUrl = await getUploadUrl({});
        const res = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": "image/jpeg" },
          body: blob,
        });
        if (!res.ok) throw new Error("Gagal mengunggah story");
        const data = (await res.json()) as { storageId?: string };
        if (!data.storageId) throw new Error("Unggahan story tidak lengkap");
        storageId = data.storageId;
        mediaType = "image";
      }
      await addStory({
        storageId,
        mediaType,
        caption: p.caption || undefined,
        privacy: "all",
      });
      toast.success("Konten ditambahkan ke story");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal membuat story");
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[95] flex flex-col justify-end"
      onClick={onClose}
    >
      <div className="flex-1 bg-black/65 backdrop-blur-[2px]" />
      <motion.div
        initial={{ y: 80 }}
        animate={{ y: 0 }}
        exit={{ y: 80 }}
        transition={{ duration: 0.24, ease: "easeOut" }}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[72vh] overflow-y-auto rounded-t-[28px] border-t border-white/12 bg-[#10131a] p-4 pb-[max(env(safe-area-inset-bottom),1rem)]"
      >
        <span aria-hidden className="mx-auto mb-3 block h-1 w-10 rounded-full bg-white/20" />
        <p className="mb-3 text-center text-[13px] font-black text-white">Bagikan ke</p>

        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <ShareAction
            icon={<Repeat2 className="size-5" />}
            label={reposted ? "Batalkan" : "Repost"}
            bg="linear-gradient(145deg,#36d399,#0f9f73)"
            onClick={() => void doRepost()}
          />
          <ShareAction
            icon={<Send className="size-5" />}
            label="Pesan"
            bg="linear-gradient(145deg,#59a6ff,#1f6fe5)"
            onClick={() => setPicker(true)}
          />
          <ShareAction
            icon={<Link2 className="size-5" />}
            label="Salin tautan"
            bg="linear-gradient(145deg,#a78bfa,#7c3aed)"
            onClick={() => {
              void copyText(link)
                .then(() => toast.success("Tautan disalin"))
                .catch(() => toast.error("Gagal menyalin"));
            }}
          />
          <ShareAction
            icon={<Mail className="size-5" />}
            label="Gmail"
            bg="linear-gradient(145deg,#ff6b6b,#d93025)"
            onClick={() => {
              window.location.href = `mailto:?subject=${encodeURIComponent("Konten YoruNime")}&body=${encodeURIComponent(link)}`;
            }}
          />
          <ShareAction
            icon={<MessageSquare className="size-5" />}
            label="SMS"
            bg="linear-gradient(145deg,#4ade80,#16a34a)"
            onClick={() => {
              window.location.href = `sms:?&body=${encodeURIComponent(link)}`;
            }}
          />
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <ShareAction
            icon={<Flag className="size-5" />}
            label="Laporkan"
            bg="#3a3a42"
            onClick={() => setReporting(true)}
          />
          <ShareAction
            icon={<EyeOff className="size-5" />}
            label="Tidak tertarik"
            bg="#34343b"
            onClick={() => {
              hideFeedPost(String(p.postId));
              toast.success("Konten disembunyikan dari feed");
              onClose();
            }}
          />
          <ShareAction
            icon={<ImageIcon className="size-5" />}
            label="Jadikan story"
            bg="#3d3a49"
            onClick={() => void makeStory()}
          />
          <ShareAction
            icon={<CircleSlash2 className="size-5" />}
            label="Stop rekomendasi"
            bg="#3a3a42"
            onClick={() => {
              hideFeedAuthor(String(p.userId));
              toast.success(`Konten dari ${p.username} tidak direkomendasikan lagi`);
              onClose();
            }}
          />
        </div>
      </motion.div>

      <AnimatePresence>
        {reporting && (
          <ReportPostSheet
            postId={p.postId}
            onClose={() => setReporting(false)}
            onDone={() => {
              setReported(true);
              setReporting(false);
            }}
          />
        )}
      </AnimatePresence>

      {reported && (
        <span className="pointer-events-none absolute inset-x-0 bottom-[52%] mx-auto w-fit rounded-full bg-white/12 px-3 py-1.5 text-[10px] font-bold text-white/80">
          Laporan terkirim
        </span>
      )}

      <AnimatePresence>
        {picker && (
          <MessagePickerSheet
            postId={p.postId}
            friends={list}
            onClose={() => setPicker(false)}
            onSent={() => {
              setPicker(false);
              onClose();
            }}
            send={(peerId, text) => send({ kind: "dm", peerId, text, feedPostId: p.postId })}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ReportPostSheet({
  postId,
  onClose,
  onDone,
}: {
  postId: Id<"feedPosts">;
  onClose: () => void;
  onDone: () => void;
}) {
  const report = useMutation(api.feed.reportPost);
  const [reason, setReason] = useState("Konten tidak pantas");
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);
  const reasons = [
    "Konten tidak pantas",
    "Spam atau penipuan",
    "Ujaran kebencian",
    "Pelanggaran hak cipta",
  ];
  const submit = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await report({ postId, reason, detail: detail.trim() || undefined });
      toast.success("Laporan terkirim ke moderator");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengirim laporan");
    } finally {
      setBusy(false);
    }
  };
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[120] flex items-end bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 60 }}
        animate={{ y: 0 }}
        exit={{ y: 60 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full rounded-t-[28px] border-t border-white/12 bg-[#10131a] p-4 pb-[max(env(safe-area-inset-bottom),1rem)]"
      >
        <span aria-hidden className="mx-auto mb-3 block h-1 w-10 rounded-full bg-white/20" />
        <div className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-full bg-rose-500/15 text-rose-300">
            <Flag className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-black text-white">Laporkan konten</p>
            <p className="text-[10px] text-white/40">Pilih alasan yang paling sesuai</p>
          </div>
          <button onClick={onClose} aria-label="Tutup" className="p-1 text-white/45">
            <X className="size-4" />
          </button>
        </div>
        <div className="mt-3 space-y-1.5">
          {reasons.map((r) => (
            <button
              key={r}
              onClick={() => setReason(r)}
              className={cn(
                "flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-[12px] font-bold transition",
                reason === r
                  ? "border-rose-400/45 bg-rose-500/12 text-white"
                  : "border-white/10 bg-white/[0.04] text-white/60",
              )}
            >
              <span
                className={cn(
                  "grid size-4 place-items-center rounded-full border",
                  reason === r ? "border-rose-300 bg-rose-400 text-black" : "border-white/25",
                )}
              >
                {reason === r && <Check className="size-2.5" strokeWidth={4} />}
              </span>
              {r}
            </button>
          ))}
        </div>
        <textarea
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          rows={2}
          maxLength={200}
          placeholder="Tambahkan detail (opsional)…"
          className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/35 px-3 py-2.5 text-[12px] text-white outline-none placeholder:text-white/30 focus-visible:ring-0"
        />
        <button
          onClick={() => void submit()}
          disabled={busy}
          className="mt-3 w-full rounded-xl bg-rose-500 py-3 text-[12px] font-black text-white transition active:scale-[0.99] disabled:opacity-50"
        >
          {busy ? "Mengirim…" : "Kirim laporan"}
        </button>
      </motion.div>
    </motion.div>
  );
}

function MessagePickerSheet({
  friends,
  onClose,
  onSent,
  send,
}: {
  postId: Id<"feedPosts">;
  friends: { userId: string; username: string; image: string | null }[];
  onClose: () => void;
  onSent: () => void;
  send: (peerId: Id<"users">, text?: string) => Promise<unknown>;
}) {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const filtered = friends.filter((f) =>
    f.username.toLowerCase().includes(q.trim().toLowerCase()),
  );
  const submit = async () => {
    if (selected.size === 0 || busy) return;
    setBusy(true);
    try {
      for (const id of selected) await send(id as Id<"users">);
      toast.success(`Terkirim ke ${selected.size} teman`);
      onSent();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengirim");
    } finally {
      setBusy(false);
    }
  };
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[110] flex flex-col bg-[#0b0e15]"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-3">
        <button onClick={onClose} aria-label="Kembali" className="p-1 text-white/75">
          <ChevronLeft className="size-5" />
        </button>
        <p className="flex-1 text-[15px] font-black text-white">Kirim pesan</p>
        <button
          onClick={() => void submit()}
          disabled={selected.size === 0 || busy}
          className="rounded-full bg-primary px-4 py-1.5 text-[11px] font-black text-primary-foreground disabled:opacity-40"
        >
          {busy ? "Mengirim…" : `Kirim${selected.size ? ` (${selected.size})` : ""}`}
        </button>
      </div>
      <div className="flex items-center gap-2 border-b border-white/8 px-4 py-2.5">
        <Search className="size-4 text-white/35" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari teman…"
          className="w-full bg-transparent text-[13px] text-white outline-none placeholder:text-white/30"
        />
      </div>
      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {filtered.length === 0 && (
          <p className="py-10 text-center text-[11px] text-white/35">Teman tidak ditemukan.</p>
        )}
        {filtered.map((f) => {
          const on = selected.has(f.userId);
          return (
            <button
              key={f.userId}
              type="button"
              onClick={() =>
                setSelected((prev) => {
                  const n = new Set(prev);
                  if (n.has(f.userId)) n.delete(f.userId);
                  else n.add(f.userId);
                  return n;
                })
              }
              className="flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left transition active:bg-white/[0.05]"
            >
              <Avatar src={f.image ?? undefined} seed={f.username} className="size-11" />
              <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-white">{f.username}</span>
              <span
                className={cn(
                  "grid size-6 place-items-center rounded-full border",
                  on ? "border-transparent bg-primary text-primary-foreground" : "border-white/25 text-transparent",
                )}
              >
                <Check className="size-3.5" strokeWidth={3} />
              </span>
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}

function RepostersSheet({
  p,
  onClose,
}: {
  p: Post;
  onClose: () => void;
}) {
  const data = useQuery(api.feed.listReposters, { postId: p.postId }) as
    | {
        reposters: (Reposter & { premium?: boolean; isMe: boolean })[];
        mine: boolean;
        count: number;
      }
    | undefined;
  const toggleRepost = useMutation(api.feed.toggleRepost);
  const send = useMutation(api.chat.sendMessage);
  const [dm, setDm] = useState<{ id: Id<"users">; name: string } | null>(null);

  const love = async (r: Reposter) => {
    try {
      await send({ kind: "dm", peerId: r.userId, text: "❤️" });
      toast.success(`Love terkirim ke ${r.username}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengirim love");
    }
  };

  const cancel = async () => {
    try {
      await toggleRepost({ postId: p.postId });
      toast.success("Posting ulang dibatalkan");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal membatalkan");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex flex-col justify-end bg-black/55 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 80 }}
        animate={{ y: 0 }}
        exit={{ y: 80 }}
        transition={{ duration: 0.26, ease: "easeOut" }}
        onClick={(e) => e.stopPropagation()}
        className="flex h-[62vh] flex-col overflow-hidden rounded-t-[30px] bg-[linear-gradient(180deg,#0d3168_0%,#082247_58%,#061a34_100%)] text-white"
      >
        <span aria-hidden className="mx-auto mt-2 h-1 w-10 rounded-full bg-white/30" />
        <p className="py-3 text-center text-[14px] font-black">Memosting ulang</p>
        <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-4">
          {(data?.reposters ?? []).length === 0 && (
            <p className="py-10 text-center text-[11px] text-white/45">Belum ada yang memosting ulang.</p>
          )}
          {(data?.reposters ?? []).map((r) => (
            <div key={String(r.userId)} className="flex items-center gap-3 py-3">
              <button onClick={() => setDm({ id: r.userId, name: r.username })} className="shrink-0">
                <Avatar src={r.image ?? undefined} seed={r.username} className="size-12 ring-2 ring-white/25" />
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-black leading-tight">{r.username}</p>
                <p className="mt-0.5 text-[9.5px] font-medium text-white/45">{timeAgo(r.createdAt)}</p>
              </div>
              <button
                onClick={() => void love(r)}
                aria-label="Kirim love"
                className="grid size-9 place-items-center rounded-full bg-white/12 text-rose-300 transition active:scale-90"
              >
                <Heart className="size-4 fill-current" />
              </button>
              <button
                onClick={() => setDm({ id: r.userId, name: r.username })}
                aria-label="Kirim pesan"
                className="grid size-9 place-items-center rounded-full bg-white/12 text-sky-200 transition active:scale-90"
              >
                <MessageSquare className="size-4" />
              </button>
            </div>
          ))}
        </div>
        {data?.mine && (
          <div className="shrink-0 border-t border-white/10 p-3">
            <button
              onClick={() => void cancel()}
              className="mx-auto flex w-full max-w-[260px] items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-[11px] font-black text-[#0b2f61] transition active:scale-[0.98]"
            >
              <Repeat2 className="size-4" />
              Batalkan Posting Ulang
            </button>
          </div>
        )}
      </motion.div>
      {dm && (
        <DmSheet peerId={dm.id} username={dm.name} onClose={() => setDm(null)} />
      )}
    </motion.div>
  );
}

function DmSheet({
  peerId,
  username,
  onClose,
}: {
  peerId: Id<"users">;
  username: string;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const { messages, sendFast } = useFastChat(
    { kind: "dm", peerId, limit: 100 },
    { kind: "dm", peerId },
    user,
  );
  return (
    <div className="fixed inset-0 z-[130] flex flex-col bg-[#0b0e15] text-white" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2.5">
        <button onClick={onClose} aria-label="Kembali" className="p-1">
          <ChevronLeft className="size-5" />
        </button>
        <Avatar src={undefined} seed={username} className="size-8" />
        <p className="min-w-0 flex-1 truncate text-[13px] font-black">{username}</p>
        <span className="size-8" />
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <ChatPanel
          kind="dm"
          peerId={peerId}
          messages={messages}
          onSend={(payload) => sendFast(payload)}
          meId={String(user?._id ?? "")}
          compact
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  SHEET BUAT POST — galeri / teks / musik + privasi + caption
 * ------------------------------------------------------------------ */
export function CreatePostSheet({ onClose }: { onClose: () => void }) {
  const create = useMutation(api.feed.createPost);
  const upload = useMutation(api.storage.getUploadUrl);
  const musicSearch = useAction(api.music.musicSearch);
  const [kind, setKind] = useState<"image" | "text" | "video">("image");
  const [caption, setCaption] = useState("");
  const [privacy, setPrivacy] = useState<"all" | "teman">("all");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // PESAN ERROR INLINE — Toaster sonner dimatikan di app ini, jadi kegagalan
  // upload harus terlihat langsung di layar (bukan hilang diam-diam).
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Alur 3 langkah: PILIH (foto/video) → EDIT (teks/audio/privasi) → CAPTION.
  const [step, setStep] = useState<"pick" | "edit" | "caption">("pick");
  const [tool, setTool] = useState<"text" | "audio" | "privacy" | null>(null);
  // Editor teks overlay — font, miring, outline, ukuran.
  const [overlay, setOverlay] = useState({
    text: "",
    font: "display",
    italic: false,
    outline: true,
    size: 4,
    // Posisi (% dari kiri/atas) — bisa DIGERAKKAN dengan jari di pratinjau.
    x: 50,
    y: 50,
    color: "#ffffff",
  });
  // Campuran audio: backsound musik vs suara asli video (0-100).
  const [musicVol, setMusicVol] = useState(100);
  const [videoVol, setVideoVol] = useState(100);
  // Lagu dipilih lewat PENCARIAN (bukan diketik manual) — ala musik YoruVerse.
  const [track, setTrack] = useState<{
    title: string;
    artist?: string;
    cover?: string;
    audioUrl?: string;
  } | null>(null);
  const [mq, setMq] = useState("");
  const [mres, setMres] = useState<any[]>([]);
  const [mSearching, setMSearching] = useState(false);
  // Pratinjau video BERSUARA — default senyap (biar autoPlay diizinkan
  // browser), ada tombol kecil buat nyalain suara pas mengedit.
  const [previewMuted, setPreviewMuted] = useState(true);

  const pick = (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith("image/") && !f.type.startsWith("video/")) {
      setErr("Pilih gambar atau video dari galeri");
      return;
    }
    // BATAS UKURAN — file yang kebesaran bikin unggahan gagal dengan pesan
    // "Failed to fetch" yang membingungkan. Dicek di sini supaya user langsung
    // tahu sebelum proses unggah dimulai.
    const mb = f.size / (1024 * 1024);
    // Video boleh sampai 100 MB, foto 12 MB.
    const limitMb = f.type.startsWith("video/") ? 100 : 12;
    if (mb > limitMb) {
      setErr(
        `File terlalu besar (${mb.toFixed(1)} MB). Maksimal ${limitMb} MB untuk ${f.type.startsWith("video/") ? "video" : "foto"} — compress dulu sebelum unggah.`,
      );
      return;
    }
    setErr(null);
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setKind(f.type.startsWith("video/") ? "video" : "image");
    // Setelah pilih dari galeri → langsung masuk layar EDIT.
    setStep("edit");
    setTool(null);
  };

  /** Ambil satu frame video (≈0.5 dtk) sebagai thumbnail grid konten. */
  const grabFrame = (v: File): Promise<Blob | null> =>
    new Promise((resolve) => {
      const url = URL.createObjectURL(v);
      const el = document.createElement("video");
      el.muted = true;
      el.playsInline = true;
      el.preload = "metadata";
      el.src = url;
      el.onloadeddata = () => {
        el.currentTime = Math.min(0.5, (el.duration || 1) / 2);
      };
      el.onseeked = () => {
        try {
          const c = document.createElement("canvas");
          const w = 360;
          const h =
            Math.round((el.videoHeight / Math.max(1, el.videoWidth)) * w) ||
            480;
          c.width = w;
          c.height = h;
          c.getContext("2d")?.drawImage(el, 0, 0, w, h);
          c.toBlob((b) => resolve(b), "image/jpeg", 0.82);
        } catch {
          resolve(null);
        } finally {
          URL.revokeObjectURL(url);
        }
      };
      el.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
    });

  /**
   * Unggah SATU berkas ke storage Convex dengan PENANGKAL "failed to fetch":
   * - Kalau type kosong, jangan kirim header Content-Type kosong (bikin
   *   preflight CORS gagal → TypeError "Failed to fetch").
   * - Coba sampai 3 kali (koneksi goyah), lalu lempar pesan yang jelas.
   */
  const uploadBlob = async (b: Blob, ct?: string): Promise<string> => {
    const mime = ct || b.type || "application/octet-stream";
    let lastErr = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const url = await upload({});
        // Pakai XHR, sama seperti upload Story. Fetch streaming untuk video
        // besar sering berhenti sebagai "Failed to fetch" di tengah jalan,
        // sementara XHR mengirim body utuh dan memberi status yang jelas.
        const storageId = await new Promise<string>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("POST", url);
          xhr.setRequestHeader("Content-Type", mime);
          xhr.onload = () => {
            if (xhr.status < 200 || xhr.status >= 300) {
              reject(new Error(`server menolak (${xhr.status})`));
              return;
            }
            try {
              const data = JSON.parse(xhr.responseText) as {
                storageId?: string;
              };
              if (!data.storageId) {
                reject(new Error("respons server tidak lengkap"));
                return;
              }
              resolve(data.storageId);
            } catch {
              reject(new Error("respons server tidak valid"));
            }
          };
          xhr.onerror = () => reject(new Error("jaringan bermasalah"));
          xhr.ontimeout = () => reject(new Error("unggahan melewati batas waktu"));
          xhr.send(b);
        });
        return storageId;
      } catch (e) {
        lastErr = e instanceof Error ? e.message : String(e);
        // Tunggu sebentar sebelum coba lagi (koneksi pulih).
        await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
      }
    }
    throw new Error(
      `Gagal mengunggah media — ${lastErr || "jaringan bermasalah"}. Cek koneksi lalu coba lagi.`,
    );
  };

  const submit = async () => {
    if (busy) return;
    setErr(null);
    if (!file && !caption.trim()) {
      setErr("Pilih foto/video atau tulis caption dulu");
      return;
    }
    const postKind = file ? (kind === "video" ? "video" : "image") : "text";
    setBusy(true);
    try {
      let imageStorageId: string | undefined;
      let thumbStorageId: string | undefined;
      if ((kind === "image" || kind === "video") && file) {
        imageStorageId = await uploadBlob(file);
        // Video: unggah 1 frame sebagai thumbnail grid konten.
        if (kind === "video") {
          const blob = await grabFrame(file);
          if (blob) {
            try {
              thumbStorageId = await uploadBlob(blob, "image/jpeg");
            } catch {
              /* thumbnail gagal pun post tetap jalan */
            }
          }
        }
      }
      await create({
        kind: postKind,
        caption: caption.trim() || undefined,
        imageStorageId,
        thumbStorageId,
        music: track
          ? {
              title: track.title,
              artist: track.artist || undefined,
              cover: track.cover || undefined,
              audioUrl: track.audioUrl || undefined,
            }
          : undefined,
        overlay: overlay.text.trim()
          ? {
              text: overlay.text.trim().slice(0, 140),
              font: overlay.font,
              italic: overlay.italic,
              outline: overlay.outline,
              size: overlay.size,
              x: Math.round(overlay.x),
              y: Math.round(overlay.y),
              color: overlay.color,
            }
          : undefined,
        audio: file ? { musicVol, videoVol } : undefined,
        privacy,
      });
      toast.success("Konten sudah diposting ke profilmu");
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal memposting");
    } finally {
      setBusy(false);
    }
  };

  /** Font yang tersedia untuk teks overlay. */
  const FONTS: { key: string; label: string; css: string }[] = [
    { key: "display", label: "Display", css: "var(--font-display)" },
    { key: "sans", label: "Sans", css: "var(--font-sans)" },
    { key: "mono", label: "Mono", css: "var(--font-mono)" },
    { key: "serif", label: "Serif", css: "Georgia, 'Times New Roman', serif" },
    {
      key: "impact",
      label: "Impact",
      css: "Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif",
    },
  ];
  const fontCss = (k: string) =>
    FONTS.find((f) => f.key === k)?.css ?? "var(--font-sans)";

  /** Cari lagu — lagu DIPILIH dari hasil pencarian, bukan diketik manual. */
  const runMusicSearch = async () => {
    const q = mq.trim();
    if (!q || mSearching) return;
    setMSearching(true);
    try {
      const r = (await musicSearch({ q, limit: 15 })) as any[];
      setMres((r ?? []).filter((t) => t?.audioUrl));
    } catch {
      setMres([]);
    } finally {
      setMSearching(false);
    }
  };

  /** Gaya teks overlay pada pratinjau edit & feed. */
  const overlayStyle: CSSProperties = {
    fontFamily: fontCss(overlay.font),
    fontStyle: overlay.italic ? "italic" : "normal",
    fontSize: `${overlay.size * 4}px`,
    lineHeight: 1.15,
    color: overlay.color,
    textShadow: overlay.outline
      ? "0 0 3px #000, 0 0 6px rgba(0,0,0,.9), 0 2px 4px rgba(0,0,0,.9)"
      : "0 2px 8px rgba(0,0,0,.55)",
  };

  /** Pilihan privasi — dipakai di panel edit & layar caption. */
  const privacyBlock = (
    <>
      <p className="mt-4 text-[11px] font-black uppercase tracking-widest text-white/45">
        Privasi
      </p>
      <div className="mt-1.5 grid grid-cols-2 gap-2">
        {(
          [
            { key: "all" as const, label: "Semua orang", desc: "Semua bisa melihat", Icon: Globe },
            { key: "teman" as const, label: "Teman only", desc: "Hanya teman", Icon: Users },
          ] as const
        ).map((o) => (
          <button
            key={o.key}
            onClick={() => setPrivacy(o.key)}
            className={cn(
              "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition",
              privacy === o.key
                ? "border-primary/60 bg-primary/12"
                : "border-white/12 bg-black/30",
            )}
          >
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-lg border",
                privacy === o.key
                  ? "border-primary/50 bg-primary/20 text-primary"
                  : "border-white/15 bg-white/5 text-white/60",
              )}
            >
              <o.Icon className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-[12px] font-bold text-white">{o.label}</span>
              <span className="block text-[10px] text-white/50">{o.desc}</span>
            </span>
            {privacy === o.key && (
              <Lock className="ml-auto size-3.5 shrink-0 text-primary" aria-hidden />
            )}
          </button>
        ))}
      </div>
    </>
  );

  /** Picker lagu — pencarian + hasil yang bisa diketuk (dipakai panel audio
      & layar caption, persis konsep musik di YoruVerse: pilih, bukan ketik). */
  const musicPicker = (
    <div className="space-y-2">
      {track && (
        <div className="flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-2.5 py-2">
          {track.cover ? (
            <img src={track.cover} alt="" className="size-8 rounded-lg object-cover" />
          ) : (
            <Music className="size-4 shrink-0 text-white/70" />
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12px] font-black text-white">
              {track.title}
            </span>
            {track.artist && (
              <span className="block truncate text-[10px] text-white/50">
                {track.artist}
              </span>
            )}
          </span>
          <button
            onClick={() => setTrack(null)}
            aria-label="Hapus lagu"
            className="shrink-0 text-white/50 transition hover:text-white"
          >
            <X className="size-4" />
          </button>
        </div>
      )}
      <div className="flex gap-2">
        <input
          value={mq}
          onChange={(e) => setMq(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void runMusicSearch()}
          placeholder="Cari lagu…"
          className="h-9 min-w-0 flex-1 rounded-xl border border-white/15 bg-black/50 px-3 text-sm text-white outline-none placeholder:text-white/40 focus-visible:ring-0"
        />
        <button
          onClick={() => void runMusicSearch()}
          disabled={mSearching}
          className="flex shrink-0 items-center gap-1 rounded-xl bg-primary px-3 text-[11px] font-black text-primary-foreground transition active:scale-95 disabled:opacity-50"
        >
          <Search className="size-3.5" />
          {mSearching ? "…" : "Cari"}
        </button>
      </div>
      {mres.length > 0 && (
        <div className="thin-scroll max-h-40 space-y-1 overflow-y-auto">
          {mres.map((t: any) => (
            <button
              key={String(t.id)}
              onClick={() =>
                setTrack({
                  title: t.title,
                  artist: t.artist,
                  cover: t.cover,
                  audioUrl: t.audioUrl,
                })
              }
              className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1.5 text-left transition hover:bg-white/[0.07]"
            >
              {t.cover ? (
                <img src={t.cover} alt="" className="size-8 shrink-0 rounded object-cover" />
              ) : (
                <Music className="size-4 shrink-0 text-white/50" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-bold text-white">
                  {t.title}
                </span>
                <span className="block truncate text-[10px] text-white/45">
                  {t.artist}
                </span>
              </span>
              {track?.audioUrl === t.audioUrl && (
                <Check className="size-4 shrink-0 text-primary" />
              )}
            </button>
          ))}
        </div>
      )}
      {!track && mres.length === 0 && (
        <p className="text-[10px] leading-relaxed text-white/40">
          Cari lagu lalu ketuk hasilnya — lagunya jadi backsound video kamu.
        </p>
      )}
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[95] flex flex-col justify-end"
      onClick={onClose}
    >
      <div className="flex-1 bg-black/65 backdrop-blur-[2px]" />
      <motion.div
        initial={{ y: 70 }}
        animate={{ y: 0 }}
        exit={{ y: 70 }}
        transition={{ duration: 0.26, ease: "easeOut" }}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] overflow-y-auto rounded-t-3xl border-t border-white/15 bg-[#10131a] p-4 pb-7"
      >
        <span aria-hidden className="mx-auto mb-3 block h-1 w-10 rounded-full bg-white/25" />
        <div className="mb-3 flex items-center gap-2">
          <p className="flex-1 text-sm text-white yn-title">
            {step === "pick"
              ? "Buat konten"
              : step === "edit"
                ? "Edit konten"
                : "Caption & posting"}
          </p>
          {step !== "pick" && (
            <button
              onClick={() => setStep(step === "caption" ? "edit" : "pick")}
              aria-label="Kembali"
              className="flex size-8 items-center justify-center rounded-full border border-white/15 text-white/70"
            >
              <ChevronLeft className="size-4" />
            </button>
          )}
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="flex size-8 items-center justify-center rounded-full border border-white/15 text-white/70"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Status GAGAL — tampil langsung di layar komposer. */}
        {err && (
          <div className="mb-2 rounded-xl border border-red-400/45 bg-red-500/15 px-3 py-2 text-[12px] font-bold leading-snug text-red-200">
            {err}
          </div>
        )}

        {/* ============ LANGKAH 1 — PILIH: tombol Foto / Video ============ */}
        {step === "pick" && (
          <>
            {/* Dua tombol rounded berikon di kiri atas. */}
            <div className="mb-3 flex gap-2">
              <button
                onClick={() => {
                  setKind("image");
                  setTimeout(() => fileRef.current?.click(), 0);
                }}
                className={cn(
                  "flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-xs font-black transition active:scale-95",
                  kind === "image"
                    ? "border-primary/60 bg-primary/15 text-primary"
                    : "border-white/15 bg-white/[0.05] text-white/70",
                )}
              >
                <ImageIcon className="size-4" /> Foto
              </button>
              <button
                onClick={() => {
                  setKind("video");
                  setTimeout(() => fileRef.current?.click(), 0);
                }}
                className={cn(
                  "flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-xs font-black transition active:scale-95",
                  kind === "video"
                    ? "border-primary/60 bg-primary/15 text-primary"
                    : "border-white/15 bg-white/[0.05] text-white/70",
                )}
              >
                <VideoIcon className="size-4" /> Video
              </button>
            </div>

            {/* Area tengah: ikon media + ajakan ketuk untuk menambahkan. */}
            <div className="relative flex aspect-[4/5] w-full items-center justify-center overflow-hidden rounded-2xl border border-white/12 bg-black/50">
              <button
                onClick={() => fileRef.current?.click()}
                className="flex flex-col items-center gap-3 px-6 text-center"
              >
                <span className="flex size-16 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.06] text-white/70">
                  {kind === "video" ? (
                    <VideoIcon className="size-8" />
                  ) : (
                    <ImageIcon className="size-8" />
                  )}
                </span>
                <span className="text-sm font-black text-white/85">
                  Ketuk disini untuk menambahkan{" "}
                  {kind === "video" ? "video" : "foto"}
                </span>
                <span className="text-[11px] text-white/40">
                  Pilih dari galeri — nanti masuk layar edit
                </span>
              </button>
              <input
                ref={fileRef}
                type="file"
                accept={kind === "video" ? "video/*" : "image/*"}
                className="hidden"
                onChange={(e) => pick(e.target.files?.[0])}
              />
            </div>
          </>
        )}

        {/* ============ LANGKAH 2 — EDIT: preview + tool kanan atas ============ */}
        {step === "edit" && (
          <>
            {/* Tombol tool di KANAN ATAS: Teks, Audio, Privasi. */}
            <div className="mb-2 flex justify-end gap-1.5">
              {([
                { key: "text" as const, label: "Teks", Icon: TypeIcon },
                { key: "audio" as const, label: "Audio", Icon: Volume2 },
                { key: "privacy" as const, label: "Privasi", Icon: Lock },
              ]).map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTool(tool === t.key ? null : t.key)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-black transition",
                    tool === t.key
                      ? "border-primary/60 bg-primary/15 text-primary"
                      : "border-white/15 bg-white/[0.05] text-white/75",
                  )}
                >
                  <t.Icon className="size-3.5" /> {t.label}
                </button>
              ))}
            </div>

            {/* Preview di TENGAH — video/foto + teks overlay. */}
            <div className="relative flex aspect-[4/5] w-full items-center justify-center overflow-hidden rounded-2xl border border-white/12 bg-black/50">
              {preview && kind === "video" ? (
                <video
                  src={preview}
                  className="h-full w-full object-cover"
                  muted={previewMuted}
                  loop
                  autoPlay
                  playsInline
                  controls={false}
                />
              ) : preview ? (
                <img src={preview} alt="" className="h-full w-full object-cover" />
              ) : null}
              {/* Suara pratinjau video — biar kelihatan & kedengaran saat edit. */}
              {preview && kind === "video" && (
                <button
                  onClick={() => {
                    const nv = !previewMuted;
                    setPreviewMuted(nv);
                  }}
                  className="absolute bottom-2 left-2 z-20 flex items-center gap-1 rounded-full border border-white/25 bg-black/60 px-2.5 py-1.5 text-[10px] font-black text-white backdrop-blur transition active:scale-95"
                >
                  <Volume2 className="size-3.5" />
                  {previewMuted ? "Suara mati" : "Suara hidup"}
                </button>
              )}
              {overlay.text.trim() && (
                <p
                  style={{
                    ...overlayStyle,
                    left: `${overlay.x}%`,
                    top: `${overlay.y}%`,
                    transform: "translate(-50%, -50%)",
                    touchAction: "none",
                  }}
                  className="absolute z-10 max-w-[86%] cursor-move select-none whitespace-pre-wrap text-center"
                  /* Teks bisa DIGERAKKAN dengan jari: seret ke mana saja
                     di dalam pratinjau (permintaan). */
                  onPointerDown={(e) => {
                    const box = e.currentTarget.parentElement?.getBoundingClientRect();
                    if (!box) return;
                    e.currentTarget.setPointerCapture?.(e.pointerId);
                    const sx = e.clientX;
                    const sy = e.clientY;
                    const ox = overlay.x;
                    const oy = overlay.y;
                    const move = (ev: PointerEvent) => {
                      const nx = Math.max(
                        8,
                        Math.min(92, ox + ((ev.clientX - sx) / box.width) * 100),
                      );
                      const ny = Math.max(
                        6,
                        Math.min(94, oy + ((ev.clientY - sy) / box.height) * 100),
                      );
                      setOverlay((o) => ({ ...o, x: nx, y: ny }));
                    };
                    const up = () => {
                      window.removeEventListener("pointermove", move);
                      window.removeEventListener("pointerup", up);
                    };
                    window.addEventListener("pointermove", move);
                    window.addEventListener("pointerup", up);
                  }}
                >
                  {overlay.text}
                  {/* Pegangan RESIZE — tarik ke kanan-bawah buat membesar,
                      ke kiri-atas buat mengecilkan. */}
                  <span
                    aria-hidden
                    className="absolute -bottom-2.5 -right-2.5 size-5 cursor-nwse-resize rounded-full border border-black/50 bg-white/85 shadow"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      const sx = e.clientX;
                      const os = overlay.size;
                      const move = (ev: PointerEvent) => {
                        const ns = Math.max(
                          2,
                          Math.min(14, os + (ev.clientX - sx) / 16),
                        );
                        setOverlay((o) => ({ ...o, size: Math.round(ns) }));
                      };
                      const up = () => {
                        window.removeEventListener("pointermove", move);
                        window.removeEventListener("pointerup", up);
                      };
                      window.addEventListener("pointermove", move);
                      window.addEventListener("pointerup", up);
                    }}
                  />
                </p>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*,video/*"
                className="hidden"
                onChange={(e) => pick(e.target.files?.[0])}
              />
            </div>

            <button
              onClick={() => fileRef.current?.click()}
              className="mt-2 w-full rounded-xl border border-white/15 bg-white/[0.05] py-2 text-[11px] font-black text-white/70 transition active:scale-[0.98]"
            >
              Ganti media
            </button>

            {/* Panel TEKS — font, miring, outline, ukuran. */}
            {tool === "text" && (
              <div className="mt-3 space-y-3 rounded-2xl border border-white/12 bg-black/45 p-3">
                <input
                  value={overlay.text}
                  onChange={(e) =>
                    setOverlay((o) => ({ ...o, text: e.target.value }))
                  }
                  maxLength={140}
                  placeholder="Tulis teks di atas media…"
                  className="w-full rounded-xl border border-white/15 bg-black/50 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/40 focus-visible:ring-0"
                />
                <div className="flex flex-wrap gap-1.5">
                  {FONTS.map((f) => (
                    <button
                      key={f.key}
                      onClick={() => setOverlay((o) => ({ ...o, font: f.key }))}
                      style={{ fontFamily: f.css }}
                      className={cn(
                        "rounded-lg border px-3 py-1.5 text-[11px] font-bold transition",
                        overlay.font === f.key
                          ? "border-primary/60 bg-primary/15 text-white"
                          : "border-white/12 bg-white/[0.05] text-white/60",
                      )}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setOverlay((o) => ({ ...o, italic: !o.italic }))}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-[11px] font-black italic transition",
                      overlay.italic
                        ? "border-primary/60 bg-primary/15 text-white"
                        : "border-white/12 bg-white/[0.05] text-white/60",
                    )}
                  >
                    Miring
                  </button>
                  <button
                    onClick={() => setOverlay((o) => ({ ...o, outline: !o.outline }))}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-[11px] font-black transition",
                      overlay.outline
                        ? "border-primary/60 bg-primary/15 text-white"
                        : "border-white/12 bg-white/[0.05] text-white/60",
                    )}
                  >
                    Outline
                  </button>
                </div>
                <label className="block">
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/45">
                    Ukuran font — {overlay.size * 4}px
                  </span>
                  <input
                    type="range"
                    min={2}
                    max={14}
                    value={overlay.size}
                    onChange={(e) =>
                      setOverlay((o) => ({ ...o, size: Number(e.target.value) }))
                    }
                    className="mt-1.5 w-full accent-primary"
                  />
                </label>
                {/* Pilihan WARNA teks (pengaturan baru). */}
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/45">
                    Warna teks
                  </span>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {[
                      "#ffffff",
                      "#facc15",
                      "#38bdf8",
                      "#f472b6",
                      "#34d399",
                      "#000000",
                    ].map((col) => (
                      <button
                        key={col}
                        onClick={() => setOverlay((o) => ({ ...o, color: col }))}
                        aria-label={`Warna ${col}`}
                        className={cn(
                          "size-7 rounded-full border-2 transition active:scale-90",
                          overlay.color === col
                            ? "border-white scale-110"
                            : "border-white/25",
                        )}
                        style={{ backgroundColor: col }}
                      />
                    ))}
                  </div>
                </div>
                <p className="text-[10px] font-semibold leading-snug text-white/45">
                  Seret teks di pratinjau buat memindahkan — tarik bulatan di
                  pojoknya buat memperbesar / mengecilkan.
                </p>
              </div>
            )}

            {/* Panel AUDIO — pilih lagu + campur volume musik/suara asli. */}
            {tool === "audio" && (
              <div className="mt-3 space-y-3 rounded-2xl border border-white/12 bg-black/45 p-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-white/45">
                  Backsound
                </p>
                {musicPicker}
                <label className="block">
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/45">
                    Volume musik — {musicVol}%
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={musicVol}
                    onChange={(e) => setMusicVol(Number(e.target.value))}
                    className="mt-1.5 w-full accent-primary"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/45">
                    Suara asli video — {videoVol}%
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={videoVol}
                    onChange={(e) => setVideoVol(Number(e.target.value))}
                    className="mt-1.5 w-full accent-primary"
                  />
                </label>
                <p className="text-[10px] leading-relaxed text-white/45">
                  {videoVol === 0
                    ? "Suara asli dimatikan — hanya musik yang terdengar."
                    : musicVol === 0
                      ? "Musik dimatikan — hanya suara asli video."
                      : "Musik jadi backsound di atas suara asli video."}
                </p>
              </div>
            )}

            {/* Panel PRIVASI. */}
            {tool === "privacy" && <div className="mt-1">{privacyBlock}</div>}

            <button
              onClick={() => setStep("caption")}
              className="mt-4 w-full rounded-2xl bg-primary py-3.5 text-sm font-black text-primary-foreground transition hover:brightness-105 active:scale-[0.98]"
            >
              Lanjut ke caption
            </button>
          </>
        )}

        {/* ============ LANGKAH 3 — CAPTION & POST ============ */}
        {step === "caption" && (
          <>
            {/* Pilih lagu — bisa dilakukan sebelum post. */}
            <p className="text-[11px] font-black uppercase tracking-widest text-white/45">
              Musik (opsional)
            </p>
            <div className="mt-1.5">{musicPicker}</div>

            {privacyBlock}

            {/* Caption */}
            <p className="mt-4 text-[11px] font-black uppercase tracking-widest text-white/45">
              Caption
            </p>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Tulis caption…"
              className="mt-1.5 w-full resize-none rounded-xl border border-white/15 bg-black/45 px-3 py-3 text-sm text-white outline-none placeholder:text-white/40 focus-visible:ring-0"
            />

            <button
              onClick={() => void submit()}
              disabled={busy}
              className="mt-4 w-full rounded-2xl bg-primary py-3.5 text-sm font-black text-primary-foreground transition hover:brightness-105 active:scale-[0.98] disabled:opacity-60"
            >
              {busy ? "Mengunggah… memposting…" : "Post"}
            </button>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ *
 *  LAYAR FEED (route /feed) — Feed Mode dengan beranda sendiri
 * ------------------------------------------------------------------ */
type FeedTab = "friends" | "home" | "following";

function readFeedSeen(): Record<FeedTab, number> {
  try {
    const raw = window.localStorage.getItem("yn:feed-mode-seen");
    if (raw) return { friends: 0, home: 0, following: 0, ...JSON.parse(raw) };
  } catch {
    /* mode privat */
  }
  return { friends: 0, home: 0, following: 0 };
}

const INBOX_SEEN_KEY = "yn:feed-inbox-seen-ids";
function readInboxSeenIds(): Set<string> {
  try {
    const raw = window.localStorage.getItem(INBOX_SEEN_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch {
    return new Set();
  }
}

export function FeedScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [view, setView] = useState<"feed" | "explore" | "inbox">("feed");
  const postsQuery = useQuery(api.feed.listFeed, { limit: 30 }) as Post[] | undefined;
  const toggleLike = useMutation(api.feed.toggleLike);
  const toggleFavorite = useMutation(api.feed.toggleFavorite);
  const addView = useMutation(api.feed.addView);
  const toggleFollow = useMutation(api.feed.toggleFollow);
  const friends = useQuery(api.friends.listFriends, user ? {} : "skip") as
    | { userId: string; username: string; image?: string | null; premium?: boolean; level?: number }[]
    | undefined;
  const following = useQuery(
    api.feed.followList,
    user ? { userId: user._id, mode: "following" as const } : "skip",
  ) as { userId: string; username?: string; image?: string | null }[] | undefined;
  const followers = useQuery(
    api.feed.followList,
    user && view === "inbox"
      ? { userId: user._id, mode: "followers" as const }
      : "skip",
  ) as { userId: string; username: string; image: string | null; level?: number }[] | undefined;
  const activities = useQuery(
    api.feed.activityFeed,
    user ? { limit: 50 } : "skip",
  ) as FeedActivity[] | undefined;
  const storyGroups = useQuery(
    api.stories.allStories,
    view === "inbox" ? {} : "skip",
  ) as
    | {
        userId: string;
        username: string;
        userImage?: string;
        hasUnseen?: boolean;
        stories: { _id: string }[];
      }[]
    | undefined;

  const [tab, setTab] = useState<FeedTab>("home");
  const [creating, setCreating] = useState(false);
  const [commentOn, setCommentOn] = useState<Post | null>(null);
  const [shareOn, setShareOn] = useState<Post | null>(null);
  const [viewersOn, setViewersOn] = useState<Post | null>(null);
  const [privacyOn, setPrivacyOn] = useState<Post | null>(null);
  const [detailOwner, setDetailOwner] = useState<{
    _id: Id<"users">;
    username: string;
    image: string | null;
    isMe: boolean;
    full?: boolean;
  } | null>(null);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [seenTabs, setSeenTabs] = useState(() => readFeedSeen());
  const [inboxSeenIds, setInboxSeenIds] = useState(readInboxSeenIds);
  const [inboxSnapshot, setInboxSnapshot] = useState({
    activity: 0,
    followers: 0,
  });
  const inboxMarked = useRef(false);
  const [hiddenPosts, setHiddenPosts] = useState<Set<string>>(
    () => new Set(readIdList(FEED_HIDDEN_POSTS)),
  );
  const [hiddenAuthors, setHiddenAuthors] = useState<Set<string>>(
    () => new Set(readIdList(FEED_HIDDEN_AUTHORS)),
  );
  const [storyOpen, setStoryOpen] = useState<string | null>(null);
  const [activityOpen, setActivityOpen] = useState(false);
  const [followersOpen, setFollowersOpen] = useState(false);
  const [chatWith, setChatWith] = useState<{ id: Id<"users">; name: string } | null>(null);
  const [sharedPostId] = useState<Id<"feedPosts"> | null>(() => {
    try {
      const id = new URLSearchParams(window.location.search).get("post");
      return id ? (id as Id<"feedPosts">) : null;
    } catch {
      return null;
    }
  });
  const [sharedClosed, setSharedClosed] = useState(false);
  const sharedPost = useQuery(
    api.feed.postById,
    sharedPostId ? { postId: sharedPostId } : "skip",
  ) as Post | null | undefined;
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const refresh = () => {
      setHiddenPosts(new Set(readIdList(FEED_HIDDEN_POSTS)));
      setHiddenAuthors(new Set(readIdList(FEED_HIDDEN_AUTHORS)));
      setView("feed");
    };
    window.addEventListener(FEED_FILTER_EVENT, refresh);
    return () => window.removeEventListener(FEED_FILTER_EVENT, refresh);
  }, []);

  // Dot merah hanya baru. Saat Kotak Masuk dibuka, angka sesi tetap terlihat
  // di baris, tetapi penanda belum-dibaca langsung dibersihkan.
  useEffect(() => {
    if (view !== "inbox") {
      inboxMarked.current = false;
      return;
    }
    if (!activities || inboxMarked.current) return;
    inboxMarked.current = true;
    const fresh = activities.filter((a) => !inboxSeenIds.has(a._id));
    setInboxSnapshot({
      activity: fresh.length,
      followers: fresh.filter((a) => a.type === "follow").length,
    });
    const next = new Set(inboxSeenIds);
    for (const a of activities) next.add(a._id);
    const trimmed = new Set(Array.from(next).slice(-400));
    setInboxSeenIds(trimmed);
    try {
      window.localStorage.setItem(INBOX_SEEN_KEY, JSON.stringify([...trimmed]));
    } catch {
      /* mode privat */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, activities]);

  const inboxUnread = (activities ?? []).filter(
    (a) => !inboxSeenIds.has(a._id),
  ).length;

  const friendIds = useMemo(
    () => new Set((friends ?? []).map((f) => String(f.userId))),
    [friends],
  );
  const followingIds = useMemo(
    () => new Set((following ?? []).map((f) => String(f.userId))),
    [following],
  );
  const posts = (postsQuery ?? []).filter(
    (p) =>
      !hiddenPosts.has(String(p.postId)) &&
      !hiddenAuthors.has(String(p.userId)),
  );

  const friendPosts = posts.filter((p) => friendIds.has(String(p.userId)));
  const followingPosts = posts.filter((p) => followingIds.has(String(p.userId)));
  const shown =
    tab === "friends"
      ? friendPosts
      : tab === "following"
        ? followingPosts
        : posts;

  const dotFor = (t: FeedTab) => {
    if (t === tab) return false;
    const list = t === "friends" ? friendPosts : t === "following" ? followingPosts : (posts ?? []);
    return list.some((p) => p.createdAt > (seenTabs[t] ?? 0));
  };

  const openTab = (t: FeedTab) => {
    setTab(t);
    const now = Date.now();
    const next = { ...seenTabs, [t]: now };
    setSeenTabs(next);
    try {
      window.localStorage.setItem("yn:feed-mode-seen", JSON.stringify(next));
    } catch {
      /* mode privat */
    }
    scrollRef.current?.scrollTo({ top: 0 });
  };

  // Setiap post yang tampil dihitung 1 view (sekali per pembukaan).
  const onVisible = (p: Post) => {
    if (seen.has(String(p.postId))) return;
    setSeen((s) => new Set(s).add(String(p.postId)));
    void addView({ postId: p.postId }).catch(() => {});
  };

  const navItems = [
    { key: "home", label: "Beranda", Icon: Home },
    { key: "explore", label: "Explore", Icon: Compass },
    { key: "create", label: "Buat", Icon: Plus },
    { key: "chat", label: "Kotak Masuk", Icon: MessageSquare },
    { key: "account", label: "Akun", Icon: UserRound },
  ] as const;

  return (
    <div className="fixed inset-0 z-[60] bg-black">
      {/* Beranda feed — tab atas hanya muncul di tampilan feed. */}
      {view === "feed" && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-40 flex items-center gap-0 bg-gradient-to-b from-black/90 via-black/45 to-transparent px-1.5 pb-8 pt-[max(env(safe-area-inset-top),0.35rem)]">
          <button
            onClick={() => navigate("/home")}
            aria-label="Keluar feed mode"
            className="pointer-events-auto flex size-8 shrink-0 items-center justify-center text-white/80 transition active:scale-90"
          >
            <ChevronLeft className="size-5" />
          </button>
          {([
            ["following", "Mengikuti"],
            ["friends", "Teman"],
            ["home", "Saran"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => openTab(key)}
              className={cn(
                "pointer-events-auto relative flex-1 py-1 text-center text-[15px] font-black tracking-tight transition",
                tab === key ? "text-white" : "text-white/48",
              )}
            >
              {label}
              {dotFor(key) && (
                <span className="absolute right-[12%] top-0.5 size-1.5 rounded-full bg-rose-500/80" />
              )}
              {tab === key && (
                <span className="absolute -bottom-0.5 left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full bg-white" />
              )}
            </button>
          ))}
          <button
            onClick={() => setView("explore")}
            aria-label="Cari konten"
            className="pointer-events-auto grid size-8 shrink-0 place-items-center text-white/90 transition active:scale-90"
          >
            <Search className="size-5" strokeWidth={2.4} />
          </button>
        </div>
      )}

      {view === "feed" && !postsQuery && (
        <div className="flex h-full items-center justify-center text-sm text-white/60">
          Memuat feed…
        </div>
      )}
      {view === "feed" && postsQuery && shown.length === 0 && (
        <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
          <Users className="size-9 text-white/35" />
          <p className="text-sm font-bold text-white/65">
            {tab === "friends"
              ? "Belum ada konten dari temanmu"
              : tab === "following"
                ? "Belum ada konten dari akun yang kamu ikuti"
                : "Belum ada konten"}
          </p>
          <button
            onClick={() => setCreating(true)}
            className="rounded-full bg-primary px-5 py-2.5 text-xs font-black text-primary-foreground"
          >
            Buat konten pertama
          </button>
        </div>
      )}

      {view === "feed" && shown.length > 0 && (
        <div
          ref={scrollRef}
          className="feed-mode-scroll thin-scroll h-full overflow-y-auto overscroll-y-contain"
        >
          {shown.map((p) => (
            <PostShell
              key={String(p.postId)}
              p={p}
              following={followingIds.has(String(p.userId))}
              onVisible={onVisible}
              onLike={() => toggleLike({ postId: p.postId })}
              onFavorite={() => toggleFavorite({ postId: p.postId })}
              onFollow={() => toggleFollow({ targetId: p.userId })}
              onComment={() => setCommentOn(p)}
              onShare={() => setShareOn(p)}
              onOpenProfile={() =>
                setDetailOwner({
                  _id: p.userId,
                  username: p.username,
                  image: p.image,
                  isMe: p.isMe,
                  full: true,
                })
              }
              onOpenViewers={() => setViewersOn(p)}
              onOpenPrivacy={() => setPrivacyOn(p)}
            />
          ))}
        </div>
      )}

      {view === "explore" && <ExplorePanel posts={posts} onBack={() => setView("feed")} />}

      {view === "inbox" && (
        <InboxPanel
          friends={friends ?? []}
          activities={activities ?? []}
          unread={inboxUnread}
          activityUnread={inboxSnapshot.activity}
          followerUnread={inboxSnapshot.followers}
          followers={followers ?? []}
          stories={(storyGroups ?? []).filter(
            (g) =>
              friendIds.has(String(g.userId)) || followingIds.has(String(g.userId)),
          )}
          onBack={() => setView("feed")}
          onCreate={() => setCreating(true)}
          onStory={setStoryOpen}
          onActivity={() => setActivityOpen(true)}
          onFollowers={() => setFollowersOpen(true)}
          onChat={(userId, name) => setChatWith({ id: userId as Id<"users">, name })}
        />
      )}

      {/* Navigasi bawah Feed Mode — full lebar, label di bawah ikon. */}
      <nav className="absolute inset-x-0 bottom-0 z-50 flex items-stretch border-t border-white/10 bg-[#0b0c11]/95 px-1 pb-[max(env(safe-area-inset-bottom),0.35rem)] pt-1.5 backdrop-blur-xl">
        {navItems.map(({ key, label, Icon }) => {
          const active =
            (key === "home" && view === "feed") ||
            (key === "explore" && view === "explore") ||
            (key === "chat" && view === "inbox");
          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                if (key === "home") {
                  if (view === "feed") scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
                  else setView("feed");
                } else if (key === "explore") setView("explore");
                else if (key === "chat") setView("inbox");
                else if (key === "account") {
                  if (user)
                    setDetailOwner({
                      _id: user._id,
                      username: user.username ?? "user",
                      image: user.image ?? null,
                      isMe: true,
                      full: true,
                    });
                } else setCreating(true);
              }}
              className={cn(
                "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 py-1 transition active:scale-95",
                active ? "text-white" : "text-white/45",
              )}
            >
              <span
                className={cn(
                  "relative grid size-6 place-items-center rounded-full",
                  key === "create" && "size-8 bg-[var(--ui-c)] text-black shadow-[0_8px_20px_-10px_rgba(0,0,0,.9)]",
                )}
              >
                <Icon className={cn(key === "create" ? "size-4" : "size-5")} strokeWidth={2.2} />
                {key === "chat" && inboxUnread > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-rose-500 ring-2 ring-[#0b0c11]" />
                )}
              </span>
              <span className="whitespace-nowrap text-[8px] font-bold leading-none">
                {label}
              </span>
            </button>
          );
        })}
      </nav>

      <AnimatePresence>
        {creating && <CreatePostSheet onClose={() => setCreating(false)} />}
        {commentOn && <FeedCommentSheet post={commentOn} onClose={() => setCommentOn(null)} />}
        {shareOn && <ShareSheet p={shareOn} onClose={() => setShareOn(null)} />}
        {viewersOn && (
          <FeedViewersSheet
            postId={viewersOn.postId}
            count={viewersOn.views}
            onClose={() => setViewersOn(null)}
          />
        )}
        {privacyOn && (
          <FeedPrivacySheet
            post={privacyOn}
            onClose={() => setPrivacyOn(null)}
          />
        )}
        {detailOwner && (
          <FeedContentSheet
            owner={detailOwner}
            allPosts={posts}
            onClose={() => setDetailOwner(null)}
            onCreate={() => {
              setDetailOwner(null);
              setCreating(true);
            }}
          />
        )}
      </AnimatePresence>

      {storyOpen && (
        <StoryViewer
          initialUserId={storyOpen}
          onClose={() => setStoryOpen(null)}
        />
      )}

      {activityOpen && (
        <ActivityFullScreen
          activities={activities ?? []}
          onClose={() => setActivityOpen(false)}
        />
      )}

      {followersOpen && (
        <FollowersFullScreen
          followers={followers ?? []}
          onClose={() => setFollowersOpen(false)}
          onChat={(userId, name) => {
            setFollowersOpen(false);
            setChatWith({ id: userId as Id<"users">, name });
          }}
        />
      )}

      {chatWith && (
        <DmSheet
          peerId={chatWith.id}
          username={chatWith.name}
          onClose={() => setChatWith(null)}
        />
      )}

      {sharedPost && !sharedClosed && (
        <FeedPostOverlay
          posts={[sharedPost]}
          index={0}
          onClose={() => {
            setSharedClosed(true);
            try {
              window.history.replaceState({}, "", "/feed");
            } catch {
              /* history diblokir */
            }
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  EXPLORE — grid dua kolom ala halaman Jelajahi
 * ------------------------------------------------------------------ */
type ExploreItem = {
  id: string;
  title: string;
  image: string | null;
  author: string;
  authorImage: string | null;
  likes: number;
  score?: number;
  kind: string;
  post: Post | null;
};

function ExplorePanel({ posts, onBack }: { posts: Post[]; onBack: () => void }) {
  const navigate = useNavigate();
  const top = useAction(api.anime.animeTop);
  const [anime, setAnime] = useState<
    { id: string; title: string; image?: string; score?: number }[]
  >([]);
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");
  const [cat, setCat] = useState<"all" | "photo" | "video" | "music" | "anime">("all");
  const [opened, setOpened] = useState<{ posts: Post[]; index: number } | null>(null);

  useEffect(() => {
    let alive = true;
    top({ limit: 24 })
      .then((r: any) => {
        if (alive) setAnime((r ?? []).filter((a: any) => a?.image));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const feedItems: ExploreItem[] = posts.map((p) => ({
    id: String(p.postId),
    title: p.caption || (p.kind === "video" ? "Video baru" : "Konten baru"),
    image: p.thumbUrl ?? p.imageUrl ?? p.music?.cover ?? null,
    author: p.username,
    authorImage: p.image,
    likes: p.likeCount,
    kind: p.kind,
    post: p,
  }));
  const animeItems: ExploreItem[] = anime.map((a) => ({
    id: `anime:${a.id}`,
    title: a.title,
    image: a.image ?? null,
    author: "Anime & Komik",
    authorImage: null,
    likes: 0,
    score: a.score,
    kind: "anime",
    post: null,
  }));
  const items = [...feedItems, ...animeItems].filter((it) => {
    if (cat === "photo" && it.kind !== "image") return false;
    if (cat === "video" && it.kind !== "video") return false;
    if (cat === "music" && it.kind !== "music") return false;
    if (cat === "anime" && it.kind !== "anime") return false;
    const q = term.trim().toLowerCase();
    return !q || `${it.title} ${it.author}`.toLowerCase().includes(q);
  });
  const categories = [
    ["all", "Semua"],
    ["photo", "Foto"],
    ["video", "Video"],
    ["music", "Musik"],
    ["anime", "Anime & Komik"],
  ] as const;

  return (
    <div className="absolute inset-0 z-10 overflow-y-auto bg-[#0b0c11] pb-[calc(env(safe-area-inset-bottom)+4.6rem)]">
      <div className="sticky top-0 z-20 bg-[#0b0c11]/95 px-3 pb-2 pt-[max(env(safe-area-inset-top),0.65rem)] backdrop-blur-xl">
        <div className="flex items-center gap-2 rounded-xl bg-[#24252b] px-3 py-2.5">
          <Search className="size-5 shrink-0 text-white/70" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && setTerm(query)}
            placeholder="Temukan topik baru"
            className="min-w-0 flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-white/55"
          />
          {query && (
            <button
              onClick={() => {
                setQuery("");
                setTerm("");
              }}
              aria-label="Hapus pencarian"
              className="text-white/45"
            >
              <X className="size-4" />
            </button>
          )}
          <button
            onClick={() => setTerm(query)}
            className="shrink-0 border-l border-white/15 pl-2.5 text-[14px] font-black text-white"
          >
            Cari
          </button>
        </div>
        <div className="mt-2.5 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {categories.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setCat(key)}
              className={cn(
                "shrink-0 rounded-full border px-3.5 py-1.5 text-[12px] font-bold transition",
                cat === key
                  ? "border-white/20 bg-[#34353b] text-white"
                  : "border-white/10 bg-[#25262c] text-white/60",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-2 pt-2">
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-5 py-16 text-center">
            <Compass className="size-8 text-white/25" />
            <p className="text-[12px] font-bold text-white/45">
              Tidak ada konten untuk pencarian ini.
            </p>
            <button
              onClick={() => {
                setQuery("");
                setTerm("");
                setCat("all");
              }}
              className="text-[11px] font-black text-[var(--ui-c)]"
            >
              Tampilkan semua
            </button>
          </div>
        ) : (
          <div className="columns-2 gap-2.5 [column-fill:_balance]">
            {items.map((it, index) => (
              <button
                key={it.id}
                onClick={() => {
                  if (it.post) {
                    const nextPosts = posts;
                    setOpened({
                      posts: nextPosts,
                      index: nextPosts.findIndex((p) => p.postId === it.post!.postId),
                    });
                  } else {
                    const id = it.id.replace(/^anime:/, "");
                    navigate(`/home?pilih=${encodeURIComponent(id)}&judul=${encodeURIComponent(it.title)}`);
                  }
                }}
                className="mb-2.5 block w-full break-inside-avoid overflow-hidden rounded-lg bg-[#15161b] text-left transition active:scale-[0.99]"
              >
                <div
                  className={cn(
                    "relative w-full overflow-hidden bg-[#24252b]",
                    index % 3 === 0 ? "aspect-[3/4]" : index % 3 === 1 ? "aspect-[4/5]" : "aspect-square",
                  )}
                >
                  {it.image ? (
                    <img
                      src={it.image}
                      alt={it.title}
                      loading="lazy"
                      className="size-full object-cover"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center bg-[radial-gradient(circle_at_30%_20%,#30323c,#131419)] px-3 text-center text-[13px] font-black text-white/80">
                      {it.title}
                    </div>
                  )}
                  <span className="absolute right-2 top-2 grid size-7 place-items-center rounded-md bg-black/55 text-white/90 backdrop-blur-sm">
                    <Bookmark className="size-3.5" />
                  </span>
                  {it.kind === "video" && (
                    <span className="absolute left-2 top-2 rounded bg-black/55 px-1.5 py-0.5 text-[8px] font-black text-white">
                      VIDEO
                    </span>
                  )}
                </div>
                <div className="px-1.5 pb-2 pt-1.5">
                  <p className="line-clamp-2 text-[13px] font-bold leading-snug text-white">
                    {it.title}
                  </p>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <Avatar
                      src={it.authorImage ?? undefined}
                      seed={it.author}
                      className="size-6"
                    />
                    <span className="min-w-0 flex-1 truncate text-[10px] font-semibold text-white/60">
                      {it.author}
                    </span>
                    <span className="flex shrink-0 items-center gap-0.5 text-[9px] font-bold text-white/55">
                      {it.kind === "anime" ? (
                        <>★ {it.score?.toFixed(1) ?? "—"}</>
                      ) : (
                        <><Heart className="size-3" /> {fmtCount(it.likes)}</>
                      )}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {opened && opened.index >= 0 && (
        <FeedPostOverlay
          posts={opened.posts}
          index={opened.index}
          onClose={() => setOpened(null)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  KOTAK MASUK — story, aktivitas, pengikut, chat teman
 * ------------------------------------------------------------------ */
function InboxPanel({
  friends,
  activities,
  unread,
  activityUnread,
  followerUnread,
  followers,
  stories,
  onBack,
  onCreate,
  onStory,
  onActivity,
  onFollowers,
  onChat,
}: {
  friends: { userId: string; username: string; image?: string | null; premium?: boolean }[];
  activities: FeedActivity[];
  unread: number;
  activityUnread: number;
  followerUnread: number;
  followers: { userId: string; username: string; image: string | null }[];
  stories: {
    userId: string;
    username: string;
    userImage?: string;
    hasUnseen?: boolean;
    stories: { _id: string }[];
  }[];
  onBack: () => void;
  onCreate: () => void;
  onStory: (userId: string) => void;
  onActivity: () => void;
  onFollowers: () => void;
  onChat: (userId: string, name: string) => void;
}) {
  const preview = activities.slice(0, 1);
  const newFollowers = followers.slice(0, 1);
  const storyItems = stories.filter((s) => s.stories.length > 0).slice(0, 12);
  return (
    <div className="absolute inset-0 z-10 overflow-y-auto bg-[#0b0c11] pb-[calc(env(safe-area-inset-bottom)+4.7rem)]">
      <div className="sticky top-0 z-20 flex items-center bg-[#0b0c11] px-3 pb-2 pt-[max(env(safe-area-inset-top),0.7rem)]">
        <button
          onClick={onCreate}
          aria-label="Buat konten"
          className="grid size-8 place-items-center rounded-full border border-white/70 text-white/90 transition active:scale-90"
        >
          <Plus className="size-5" />
        </button>
        <div className="pointer-events-none absolute inset-x-0 flex items-center justify-center gap-1.5">
          <span className="text-[17px] font-black tracking-tight text-white">Kotak Masuk</span>
          <span className="size-1.5 rounded-full bg-white/25" />
          {unread > 0 && <span className="size-1.5 rounded-full bg-rose-500" />}
          <ChevronDown className="size-3.5 text-white/35" />
        </div>
        <span className="ml-auto size-8" />
      </div>

      {storyItems.length > 0 && (
        <div className="flex gap-3 overflow-x-auto px-3 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {storyItems.map((s) => (
            <div
              key={s.userId}
              role="button"
              tabIndex={0}
              onClick={() => onStory(s.userId)}
              onKeyDown={(e) => e.key === "Enter" && onStory(s.userId)}
              className="flex w-[78px] shrink-0 cursor-pointer flex-col items-center gap-1.5"
            >
              <StoryRing
                image={s.userImage}
                seed={s.username}
                size={72}
                hasStory
                seen={!s.hasUnseen}
                onClick={() => onStory(s.userId)}
              />
              <span className="w-full truncate text-center text-[10.5px] font-semibold text-white/78">
                {s.username}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-1">
        <button
          onClick={onActivity}
          className="flex w-full items-center gap-3 px-3 py-3 text-left transition active:bg-white/[0.035]"
        >
          <span className="grid size-[54px] shrink-0 place-items-center rounded-full bg-[#f43f6b] text-white shadow-[0_8px_22px_-14px_rgba(244,63,107,.8)]">
            <Bell className="size-6 fill-white/20" strokeWidth={2.2} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2 text-[15px] font-black text-white">
              Aktivitas
            </span>
            {preview.length === 0 ? (
              <span className="mt-0.5 block truncate text-[12px] text-white/48">
                Belum ada aktivitas baru
              </span>
            ) : (
              preview.map((a) => (
                <span
                  key={a._id}
                  className="mt-0.5 flex items-center gap-1 truncate text-[12px] text-white/48"
                >
                  <span className="truncate">{a.username} {activityText(a)}</span>
                </span>
              ))
            )}
          </span>
          {activityUnread > 0 && (
            <span className="grid min-w-6 shrink-0 place-items-center rounded-full bg-[#f43f6b] px-1.5 py-0.5 text-[10px] font-black text-white">
              {activityUnread > 99 ? "99+" : activityUnread}
            </span>
          )}
        </button>

        <button
          onClick={onFollowers}
          className="flex w-full items-center gap-3 px-3 py-3 text-left transition active:bg-white/[0.035]"
        >
          <span className="grid size-[54px] shrink-0 place-items-center rounded-full bg-[#249ee8] text-white shadow-[0_8px_22px_-14px_rgba(36,158,232,.8)]">
            <Users className="size-6" strokeWidth={2.2} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-black text-white">Pengikut baru</span>
            <span className="mt-0.5 block truncate text-[12px] text-white/48">
              {newFollowers.length === 0
                ? "Belum ada yang mengikuti kamu"
                : `${newFollowers.map((f) => f.username).join(", ")} mulai mengikuti kamu`}
            </span>
          </span>
          {followerUnread > 0 ? (
            <span className="grid min-w-6 shrink-0 place-items-center rounded-full bg-[#f43f6b] px-1.5 py-0.5 text-[10px] font-black text-white">
              {followerUnread > 99 ? "99+" : followerUnread}
            </span>
          ) : (
            <ChevronRight className="size-4 shrink-0 text-white/30" />
          )}
        </button>
      </div>

      <div className="mt-1 bg-[#17181e] pb-2">
        {friends.length === 0 ? (
          <p className="px-4 py-8 text-center text-[11px] text-white/35">
            Belum punya teman. Tambahkan teman dari halaman Teman.
          </p>
        ) : (
          friends.map((f) => (
            <button
              key={f.userId}
              onClick={() => onChat(f.userId, f.username)}
              className="flex w-full items-center gap-3 border-b border-white/[0.045] px-3 py-2.5 text-left transition last:border-b-0 active:bg-white/[0.04]"
            >
              <Avatar src={f.image ?? undefined} seed={f.username} className="size-12" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 truncate text-[13px] font-bold text-white">
                  {f.username}
                  {f.premium && <BlueCheck className="size-3.5 shrink-0" />}
                </span>
                <span className="mt-0.5 block truncate text-[11px] text-white/38">
                  Ketuk untuk mulai chat
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-white/22" />
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function activityText(a: FeedActivity): string {
  switch (a.type) {
    case "like":
      return "menyukai video kamu";
    case "favorite":
      return "menyimpan konten kamu";
    case "comment":
      return a.detail ? `mengomentari: ${a.detail}` : "mengomentari konten kamu";
    case "repost":
      return "memosting ulang konten kamu";
    case "follow":
      return "mulai mengikuti kamu";
    default:
      return "berinteraksi dengan konten kamu";
  }
}

const ACTIVITY_FILTERS = [
  ["all", "Semua aktivitas"],
  ["like", "Suka"],
  ["comment", "Komentar"],
  ["favorite", "Favorit"],
  ["repost", "Repost"],
  ["follow", "Pengikut"],
] as const;

type ActivityFilter = (typeof ACTIVITY_FILTERS)[number][0];

function ActivityBadge({ type }: { type: FeedActivity["type"] }) {
  const style =
    type === "like"
      ? "bg-[#ff3d74] text-white"
      : type === "comment"
        ? "bg-[#249ee8] text-white"
        : type === "repost"
          ? "bg-[#f4b51c] text-white"
          : type === "follow"
            ? "bg-[#19b58a] text-white"
            : "bg-[#f59e0b] text-white";
  return (
    <span
      className={cn(
        "absolute -bottom-0.5 -right-0.5 grid size-[19px] place-items-center rounded-full border-2 border-[#0b0c11]",
        style,
      )}
    >
      {type === "follow" ? (
        <UserPlus className="size-2.5" strokeWidth={3} />
      ) : type === "comment" ? (
        <MessageCircle className="size-2.5 fill-current" strokeWidth={2} />
      ) : type === "repost" ? (
        <Repeat2 className="size-2.5" strokeWidth={2.7} />
      ) : (
        <Heart className="size-2.5 fill-current" strokeWidth={2} />
      )}
    </span>
  );
}

function ActivityFullScreen({
  activities,
  onClose,
}: {
  activities: FeedActivity[];
  onClose: () => void;
}) {
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const [picking, setPicking] = useState(false);
  const list = activities.filter((a) => filter === "all" || a.type === filter);
  const label = ACTIVITY_FILTERS.find(([key]) => key === filter)?.[1] ?? "Semua aktivitas";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[110] flex flex-col bg-[#0b0c11] text-white"
    >
      <div className="relative flex items-center px-3 pb-3 pt-[max(env(safe-area-inset-top),0.7rem)]">
        <button onClick={onClose} aria-label="Tutup" className="grid size-9 place-items-center text-white/85">
          <ChevronLeft className="size-6" />
        </button>
        <button
          type="button"
          onClick={() => setPicking((v) => !v)}
          className="absolute inset-x-0 mx-auto flex w-fit items-center gap-1 text-[17px] font-black"
        >
          {filter === "all" ? "Semua aktivitas" : label}
          <ChevronDown className={cn("size-4 transition", picking && "rotate-180")} />
        </button>
        <span className="ml-auto size-9" />
        {picking && (
          <div className="absolute left-1/2 top-12 z-30 w-56 -translate-x-1/2 overflow-hidden rounded-2xl border border-white/12 bg-[#1a1b21] p-1 shadow-2xl">
            {ACTIVITY_FILTERS.map(([key, text]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setFilter(key);
                  setPicking(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-[11px] font-bold",
                  filter === key ? "bg-white/10 text-white" : "text-white/55",
                )}
              >
                {key === "all" ? "Semua aktivitas" : text}
                {filter === key && <span className="size-1.5 rounded-full bg-[#f43f6b]" />}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-3 pb-[max(env(safe-area-inset-bottom),1rem)]">
        <p className="mb-1 mt-1 text-[12px] font-semibold text-white/65">Baru</p>
        {list.length === 0 && (
          <p className="py-16 text-center text-[12px] text-white/35">
            Belum ada aktivitas di bagian ini.
          </p>
        )}
        {list.map((a) => (
          <div
            key={a._id}
            className="flex items-center gap-3 border-b border-white/[0.045] py-3 last:border-b-0"
          >
            <div className="relative shrink-0">
              <Avatar src={a.image ?? undefined} seed={a.username} className="size-[46px]" />
              <ActivityBadge type={a.type} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-semibold leading-tight text-white">
                {a.username}
              </p>
              <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-white/78">
                {activityText(a)}{" "}
                <span className="text-white/35">{timeAgo(a.createdAt)} lalu</span>
              </p>
            </div>
            {a.cover ? (
              <img src={a.cover} alt="" className="size-[48px] shrink-0 rounded-lg object-cover" />
            ) : a.postId ? (
              <span className="grid size-[48px] shrink-0 place-items-center rounded-lg bg-white/8 text-white/40">
                <MessageSquare className="size-4" />
              </span>
            ) : (
              <span className="size-[48px] shrink-0 rounded-lg bg-white/[0.035]" />
            )}
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function FollowersFullScreen({
  followers,
  onClose,
  onChat,
}: {
  followers: { userId: string; username: string; image: string | null }[];
  onClose: () => void;
  onChat: (userId: string, name: string) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[110] flex flex-col bg-[#0b0c11] text-white"
    >
      <div className="flex items-center gap-2 border-b border-white/8 px-3 pb-2 pt-[max(env(safe-area-inset-top),0.7rem)]">
        <button onClick={onClose} aria-label="Tutup" className="grid size-9 place-items-center text-white/75">
          <ChevronLeft className="size-5" />
        </button>
        <h2 className="text-[16px] font-black">Pengikut</h2>
      </div>
      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {followers.length === 0 && (
          <p className="py-16 text-center text-[12px] text-white/35">Belum ada pengikut.</p>
        )}
        {followers.map((f) => (
          <div key={f.userId} className="flex items-center gap-3 border-b border-white/6 py-3 last:border-b-0">
            <Avatar src={f.image ?? undefined} seed={f.username} className="size-12" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-black text-white">{f.username}</p>
              <p className="mt-0.5 text-[10px] text-white/35">Mengikuti kamu</p>
            </div>
            <button
              onClick={() => onChat(f.userId, f.username)}
              className="shrink-0 rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-black text-white/75"
            >
              Kirim pesan
            </button>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

/** Detail akun penuh dari Feed — header profil, statistik, bio, tab, grid. */
function FeedContentSheet({
  owner,
  allPosts,
  onClose,
  onCreate,
}: {
  owner: {
    _id: Id<"users">;
    username: string;
    image: string | null;
    isMe: boolean;
    full?: boolean;
  };
  allPosts: Post[];
  onClose: () => void;
  onCreate?: () => void;
}) {
  const navigate = useNavigate();
  const mine = owner.isMe;
  const profile = useQuery(api.account.getPublicProfile, { userId: owner._id }) as
    | {
        username?: string;
        image?: string;
        bio?: string;
        premium?: boolean;
        level?: number;
        pinnedTierBadge?: string | null;
      }
    | null
    | undefined;
  const counts = useQuery(api.feed.followCounts, { userId: owner._id }) as
    | { following: number; followers: number; likes: number }
    | undefined;
  const ownerPosts = useQuery(api.feed.userPosts, { userId: owner._id }) as
    | Post[]
    | undefined;
  const isFollowing = useQuery(
    api.feed.isFollowing,
    mine ? "skip" : { targetId: owner._id },
  ) as boolean | undefined;
  const toggleFollow = useMutation(api.feed.toggleFollow);
  const [followed, setFollowed] = useState(!!isFollowing);
  const [menu, setMenu] = useState(false);
  const [filter, setFilter] = useState<"post" | "like" | "favorite" | "repost" | "private">("post");
  const [opened, setOpened] = useState<number | null>(null);
  const [viewersOn, setViewersOn] = useState<Post | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [rewardsOpen, setRewardsOpen] = useState(false);
  const pinTier = useMutation(api.account.setPinnedTierBadge);
  useEffect(() => setFollowed(!!isFollowing), [isFollowing]);

  const username = profile?.username ?? owner.username;
  const image = profile?.image ?? owner.image;
  const base = ownerPosts ?? allPosts.filter((p) => String(p.userId) === String(owner._id));
  const list =
    filter === "like"
      ? allPosts.filter((p) => p.liked)
      : filter === "favorite"
        ? allPosts.filter((p) => p.favorited)
        : filter === "repost"
          ? allPosts.filter((p) =>
              mine ? p.reposted : (p.reposterIds ?? []).includes(String(owner._id)),
            )
          : filter === "private"
            ? base.filter((p) => p.privacy === "private" || p.privacy === "teman")
            : base;

  const tabs = mine
    ? ([
        ["post", "Konten", Grid3X3],
        ["like", "Like", Heart],
        ["favorite", "Favorit", Bookmark],
        ["repost", "Repost", Repeat2],
        ["private", "Private", Lock],
      ] as const)
    : ([
        ["post", "Konten", Grid3X3],
        ["repost", "Repost", Repeat2],
      ] as const);

  const doFollow = () => {
    const next = !followed;
    setFollowed(next);
    void toggleFollow({ targetId: owner._id }).catch(() => setFollowed(!next));
  };

  const copyProfile = async () => {
    try {
      await copyText(`${window.location.origin}/akun?user=${String(owner._id)}`);
      toast.success("Tautan profil disalin");
    } catch {
      toast.error("Gagal menyalin tautan");
    }
    setMenu(false);
  };

  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ duration: 0.24, ease: "easeOut" }}
      className="fixed inset-0 z-[90] flex flex-col overflow-hidden bg-[#0b0b0e] text-white"
    >
      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        <div className="flex items-center px-4 pt-[max(env(safe-area-inset-top),0.8rem)]">
          <button
            onClick={onClose}
            aria-label="Kembali"
            className="grid size-9 place-items-center text-white/90 transition active:scale-90"
          >
            <ChevronLeft className="size-6" />
          </button>
          <span className="flex-1" />
          {!mine && (
            <button
              onClick={doFollow}
              aria-label="Ikuti"
              className="grid size-9 place-items-center text-white/85 transition active:scale-90"
            >
              <UserPlus className="size-5" />
            </button>
          )}
          <button
            onClick={() => setMenu((v) => !v)}
            aria-label="Menu profil"
            className="grid size-9 place-items-center text-white/85 transition active:scale-90"
          >
            <MoreHorizontal className="size-5" />
          </button>
        </div>

        {menu && (
          <div className="absolute right-4 top-14 z-20 w-48 overflow-hidden rounded-2xl border border-white/12 bg-[#16161c] p-1 shadow-2xl">
            <button
              onClick={() => void copyProfile()}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[11px] font-bold text-white/75 transition hover:bg-white/8"
            >
              <Link2 className="size-3.5" /> Salin tautan profil
            </button>
            {!mine && (
              <button
                onClick={() => {
                  doFollow();
                  setMenu(false);
                }}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[11px] font-bold text-white/75 transition hover:bg-white/8"
              >
                <UserPlus className="size-3.5" /> {followed ? "Berhenti mengikuti" : "Ikuti akun"}
              </button>
            )}
          </div>
        )}

        <div className="flex flex-col items-center px-5 pt-1">
          <div className="relative">
            <Avatar
              src={image ?? undefined}
              seed={username}
              className="size-[104px] ring-4 ring-white/75"
            />
            {mine && onCreate && (
              <button
                onClick={onCreate}
                aria-label="Tambah konten"
                className="absolute -bottom-1 -right-1 grid size-8 place-items-center rounded-full border-2 border-[#0b0b0e] bg-[#00c8ff] text-white shadow-lg transition active:scale-90"
              >
                <Plus className="size-4" strokeWidth={3} />
              </button>
            )}
          </div>

          <div className="mt-3 flex items-center justify-center gap-2">
            {mine ? (
              <button
                onClick={() => setEditOpen(true)}
                className="rounded-lg bg-white/12 px-5 py-2 text-[13px] font-black text-white transition active:scale-95"
              >
                Edit
              </button>
            ) : (
              <button
                onClick={doFollow}
                className={cn(
                  "rounded-lg px-5 py-2 text-[13px] font-black transition active:scale-95",
                  followed
                    ? "bg-white/12 text-white"
                    : "bg-[#fe2c55] text-white",
                )}
              >
                {followed ? "Mengikuti" : "Ikuti"}
              </button>
            )}
            <button
              onClick={() => void copyProfile()}
              aria-label="Bagikan profil"
              className="grid size-9 place-items-center rounded-lg bg-white/12 text-white"
            >
              <Share2 className="size-4" />
            </button>
          </div>

          <p className="mt-2 text-[13px] font-semibold text-white/55">@{username}</p>
          {profile?.pinnedTierBadge && (
            <div className="mt-1.5">
              <TierPinnedBadge badgeId={profile.pinnedTierBadge} />
            </div>
          )}

          <div className="mt-3 grid w-full max-w-[330px] grid-cols-3 divide-x divide-white/15 text-center">
            {[
              [fmtCount(counts?.following ?? 0), "Mengikuti"],
              [fmtCount(counts?.followers ?? 0), "Pengikut"],
              [fmtCount(counts?.likes ?? 0), "Suka"],
            ].map(([value, label]) => (
              <div key={label} className="px-2">
                <p className="text-[17px] font-black leading-tight text-white">{value}</p>
                <p className="text-[11px] text-white/48">{label}</p>
              </div>
            ))}
          </div>

          <button
            onClick={() => {
              if (mine) setEditOpen(true);
            }}
            className={cn(
              "mt-3 max-w-full truncate rounded-full px-4 py-1.5 text-[12px] font-semibold",
              profile?.bio?.trim()
                ? "bg-transparent text-white/78"
                : "bg-white/10 text-white/35",
            )}
          >
            {profile?.bio?.trim() || (mine ? "+ Tambahkan bio" : "Belum ada bio")}
          </button>

          <div className="mt-3 flex w-full pb-1">
            <button
              onClick={() => setRewardsOpen(true)}
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-amber-300/18 bg-[linear-gradient(120deg,rgba(246,200,53,.16),rgba(255,255,255,.05))] px-3 py-2 text-[11px] font-bold text-amber-100/85"
            >
              <span className="grid size-4 place-items-center rounded-full border border-rose-400 text-[8px] font-black text-rose-400">P</span>
              Reward
            </button>
          </div>
        </div>

        <div
          className="mt-3 grid border-b border-white/10 px-2"
          style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
        >
          {tabs.map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              aria-label={label}
              title={label}
              className={cn(
                "relative flex flex-col items-center justify-center px-2 pb-2.5 pt-1 transition",
                filter === key ? "text-white" : "text-white/35",
              )}
            >
              <Icon className="size-[21px]" strokeWidth={1.8} />
              {filter === key && (
                <span className="absolute inset-x-[28%] bottom-0 h-0.5 rounded-full bg-white" />
              )}
            </button>
          ))}
        </div>

        {mine && onCreate && (
          <div className="mx-4 mt-3 flex items-center gap-2 rounded-lg bg-white/[0.07] px-3 py-2.5">
            <Plus className="size-5 shrink-0 text-white/85" />
            <p className="min-w-0 flex-1 truncate text-[12px] font-bold text-white/75">
              Unggah momen untuk mengosongkan galeri
            </p>
            <button
              onClick={onCreate}
              className="shrink-0 rounded-full bg-white px-4 py-1.5 text-[11px] font-black text-black"
            >
              Unggah
            </button>
          </div>
        )}

        <div className="px-3 pb-6 pt-2">
          {!ownerPosts && !allPosts.length ? (
            <p className="py-12 text-center text-[11px] text-white/30">Memuat konten…</p>
          ) : list.length === 0 ? (
            <p className="py-14 text-center text-[11px] text-white/30">
              Belum ada konten di bagian ini.
            </p>
          ) : (
            <ContentGrid
              posts={list as any}
              onOpen={(i) => setOpened(i)}
              onOpenViewers={
                mine ? (i) => setViewersOn(list[i] ?? null) : undefined
              }
            />
          )}
        </div>
      </div>

      {opened !== null && list[opened] && (
        <FeedPostOverlay
          posts={list}
          index={opened}
          onClose={() => setOpened(null)}
          onOpenProfile={() => undefined}
        />
      )}
      {viewersOn && (
        <FeedViewersSheet
          postId={viewersOn.postId}
          count={viewersOn.views}
          onClose={() => setViewersOn(null)}
        />
      )}
      {editOpen && <FeedEditProfileSheet onClose={() => setEditOpen(false)} />}
      {rewardsOpen && (
        <TierRewardsSheet
          followers={counts?.followers ?? 0}
          likes={counts?.likes ?? 0}
          pinned={profile?.pinnedTierBadge}
          onPin={async (badgeId) => {
            try {
              await pinTier({ badgeId });
              toast.success("Tier badge dipasang");
              setRewardsOpen(false);
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Gagal memasang badge");
            }
          }}
          onClose={() => setRewardsOpen(false)}
        />
      )}
    </motion.div>
  );
}

/** Balikan `isFollowing` per pembuat — dipanggil dari dalam daftar. */
function PostShell({
  p,
  following,
  onVisible,
  onLike,
  onFavorite,
  onFollow,
  onComment,
  onShare,
  onOpenProfile,
  onOpenViewers,
  onOpenPrivacy,
}: {
  p: Post;
  following: boolean;
  onVisible: (p: Post) => void;
  onLike: () => Promise<unknown>;
  onFavorite: () => Promise<unknown>;
  onFollow: () => Promise<unknown> | void;
  onComment: () => void;
  onShare: () => void;
  onOpenProfile: () => void;
  onOpenViewers?: () => void;
  onOpenPrivacy?: () => void;
}) {
  const holderRef = useRef<HTMLDivElement | null>(null);
  const [like, setLike] = useState({ liked: p.liked, count: p.likeCount });
  const [fav, setFav] = useState({ favorited: p.favorited, count: p.favoriteCount });
  const [followed, setFollowed] = useState(following);
  const [repostOn, setRepostOn] = useState(false);

  useEffect(() => {
    setLike({ liked: p.liked, count: p.likeCount });
    setFav({ favorited: p.favorited, count: p.favoriteCount });
  }, [p.liked, p.likeCount, p.favorited, p.favoriteCount]);
  useEffect(() => setFollowed(following), [following]);

  const doLike = () => {
    const next = { liked: !like.liked, count: like.count + (like.liked ? -1 : 1) };
    setLike(next);
    void onLike().catch(() => setLike({ liked: p.liked, count: p.likeCount }));
  };
  const doDoubleLike = () => {
    if (like.liked) return;
    setLike({ liked: true, count: like.count + 1 });
    void onLike().catch(() => setLike({ liked: p.liked, count: p.likeCount }));
  };
  const doFavorite = () => {
    const next = {
      favorited: !fav.favorited,
      count: fav.count + (fav.favorited ? -1 : 1),
    };
    setFav(next);
    void onFavorite().catch(() =>
      setFav({ favorited: p.favorited, count: p.favoriteCount }),
    );
  };

  const doFollow = () => {
    const next = !followed;
    setFollowed(next);
    void Promise.resolve(onFollow()).catch(() => setFollowed(!next));
  };

  // View baru dihitung saat post benar-benar terlihat di layar, bukan saat
  // seluruh daftar dirender. Ini menghemat puluhan mutation saat feed dibuka.
  useEffect(() => {
    const el = holderRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) onVisible(p);
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.postId]);

  return (
    <>
      <div ref={holderRef} className="h-full w-full snap-start">
        <PostView
          p={{
            ...p,
            liked: like.liked,
            likeCount: like.count,
            favorited: fav.favorited,
            favoriteCount: fav.count,
          }}
          following={followed}
          onFollow={doFollow}
          onLike={doLike}
          onDoubleLike={doDoubleLike}
          onComment={onComment}
          onFavorite={doFavorite}
          onShare={onShare}
          onOpenProfile={onOpenProfile}
          onOpenReposters={() => setRepostOn(true)}
          onOpenViewers={onOpenViewers}
          onOpenPrivacy={onOpenPrivacy}
        />
      </div>
      <AnimatePresence>
        {repostOn && <RepostersSheet p={p} onClose={() => setRepostOn(false)} />}
      </AnimatePresence>
    </>
  );
}

/* ------------------------------------------------------------------ *
 *  OVERLAY POST — dipakai dari grid Konten di profil
 * ------------------------------------------------------------------ */
export function FeedPostOverlay({
  posts,
  index,
  onClose,
  onOpenProfile,
}: {
  posts: Post[];
  index: number;
  onClose: () => void;
  onOpenProfile?: (userId: Id<"users">) => void;
}) {
  const toggleLike = useMutation(api.feed.toggleLike);
  const toggleFavorite = useMutation(api.feed.toggleFavorite);
  const toggleFollow = useMutation(api.feed.toggleFollow);
  const [i, setI] = useState(index);
  const [commentOn, setCommentOn] = useState<Post | null>(null);
  const [shareOn, setShareOn] = useState<Post | null>(null);
  const [repostOn, setRepostOn] = useState(false);
  const [viewersOn, setViewersOn] = useState<Post | null>(null);
  const [privacyOn, setPrivacyOn] = useState<Post | null>(null);
  const swipe = useRef<{ x: number; y: number } | null>(null);

  const p = posts[i];
  const following = useQuery(
    api.feed.isFollowing,
    !p || p.isMe ? "skip" : { targetId: p.userId },
  ) as boolean | undefined;

  if (!p) return null;

  return (
    <div
      className="fixed inset-0 z-[95] bg-black"
      onTouchStart={(e) => {
        const t = e.touches[0];
        swipe.current = { x: t.clientX, y: t.clientY };
      }}
      onTouchEnd={(e) => {
        const s = swipe.current;
        swipe.current = null;
        if (!s) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - s.x;
        const dy = t.clientY - s.y;
        if (Math.abs(dx) < 55 || Math.abs(dx) < Math.abs(dy) * 1.25) return;
        if (dx < 0) setI((v) => Math.min(posts.length - 1, v + 1));
        else setI((v) => Math.max(0, v - 1));
      }}
    >
      <PostView
        p={p}
        following={!!following}
        onFollow={() => void toggleFollow({ targetId: p.userId }).catch(() => {})}
        onLike={() => void toggleLike({ postId: p.postId }).catch(() => {})}
        onFavorite={() => void toggleFavorite({ postId: p.postId }).catch(() => {})}
        onDoubleLike={() => {
          if (!p.liked) void toggleLike({ postId: p.postId }).catch(() => {});
        }}
        onComment={() => setCommentOn(p)}
        onShare={() => setShareOn(p)}
        onOpenProfile={() => onOpenProfile?.(p.userId)}
        onOpenReposters={() => setRepostOn(true)}
        onOpenViewers={() => setViewersOn(p)}
        onOpenPrivacy={() => setPrivacyOn(p)}
      >
        <button
          onClick={onClose}
          aria-label="Tutup"
          className="absolute left-3 top-4 z-30 flex size-9 items-center justify-center rounded-full border border-white/25 bg-black/45 text-white backdrop-blur transition active:scale-95"
        >
          <ChevronLeft className="size-5" />
        </button>
        {posts.length > 1 && (
          <div className="pointer-events-none absolute bottom-[5.7rem] left-1/2 z-30 flex max-w-[70%] -translate-x-1/2 flex-wrap items-center justify-center gap-1.5 rounded-full bg-black/25 px-3 py-1.5 backdrop-blur-sm">
            {posts.slice(0, 10).map((item, di) => (
              <span
                key={String(item.postId)}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-200",
                  di === i % 10 ? "w-5 bg-white" : "w-1.5 bg-white/35",
                )}
              />
            ))}
            {posts.length > 10 && (
              <span className="ml-1 text-[9px] font-bold text-white/60">
                {i + 1}/{posts.length}
              </span>
            )}
          </div>
        )}
        {/* Jumlah views — bisa dibuka sebagai daftar penonton untuk konten sendiri. */}
        <button
          type="button"
          onClick={() => p.isMe && setViewersOn(p)}
          className="absolute left-3 top-16 z-30 flex items-center gap-1 rounded-full border border-white/20 bg-black/50 px-2.5 py-1 text-[10px] font-black text-white/85 backdrop-blur transition active:scale-95"
        >
          <Eye className="size-3" aria-hidden />
          {p.views}
        </button>
      </PostView>

      <AnimatePresence>
        {commentOn && <FeedCommentSheet post={commentOn} onClose={() => setCommentOn(null)} />}
        {shareOn && <ShareSheet p={shareOn} onClose={() => setShareOn(null)} />}
        {repostOn && <RepostersSheet p={p} onClose={() => setRepostOn(false)} />}
        {viewersOn && (
          <FeedViewersSheet
            postId={viewersOn.postId}
            count={viewersOn.views}
            onClose={() => setViewersOn(null)}
          />
        )}
        {privacyOn && (
          <FeedPrivacySheet
            post={privacyOn}
            onClose={() => setPrivacyOn(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/** Grid kotak konten (3 per baris) + jumlah views — dipakai di profil. */
export function ContentGrid({
  posts,
  onOpen,
  onOpenViewers,
}: {
  posts: {
    postId: Id<"feedPosts">;
    kind: string;
    imageUrl: string | null;
    thumbUrl: string | null;
    cover: string | null;
    caption: string;
    overlay?: {
      text: string;
      font: string;
      italic: boolean;
      outline: boolean;
      size: number;
    } | null;
    likeCount: number;
    commentCount?: number;
    views: number;
  }[];
  onOpen: (index: number) => void;
  onOpenViewers?: (index: number) => void;
}) {
  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center">
        <ImageIcon className="size-7 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">Belum ada konten</p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {posts.map((p, i) => (
        <button
          key={String(p.postId)}
          onClick={() => onOpen(i)}
          className="group relative aspect-[3/4] overflow-hidden rounded-lg border border-border bg-muted"
        >
          {p.thumbUrl ?? (p.kind === "video" ? null : p.imageUrl) ?? p.cover ? (
            <img
              src={(p.thumbUrl ?? (p.kind === "video" ? null : p.imageUrl) ?? p.cover) as string}
              alt=""
              className="h-full w-full object-cover transition group-hover:scale-105"
            />
          ) : p.kind === "video" && p.imageUrl ? (
            /* Video lama tanpa thumbnail — tampilkan frame videonya sendiri
               (bukan teks) supaya grid akun tidak cuma tulisan. */
            <video
              src={p.imageUrl}
              muted
              loop
              playsInline
              preload="auto"
              className="h-full w-full object-cover transition group-hover:scale-105"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center px-1.5 text-center text-[9px] font-bold text-muted-foreground">
              {p.caption || p.kind}
            </span>
          )}
          {/* Teks overlay — ikut tampil di grid supaya konsisten dengan feed. */}
          {p.overlay?.text && (p.thumbUrl ?? p.imageUrl) && (
            <span
              className="pointer-events-none absolute inset-x-1 top-1/2 -translate-y-1/2 px-1 text-center leading-tight text-white"
              style={{
                fontFamily: `var(--font-${p.overlay.font === "mono" ? "mono" : "sans"})`,
                fontStyle: p.overlay.italic ? "italic" : "normal",
                fontSize: `${Math.max(8, p.overlay.size * 1.8)}px`,
                textShadow: p.overlay.outline
                  ? "0 0 3px #000, 0 0 5px rgba(0,0,0,.9)"
                  : "0 1px 4px rgba(0,0,0,.6)",
              }}
            >
              {p.overlay.text}
            </span>
          )}
          {p.kind === "image" && (p.thumbUrl || p.imageUrl || p.cover) && (
            <span className="absolute right-1 top-1 grid size-6 place-items-center rounded-md bg-black/55 text-white/90 backdrop-blur-sm">
              <ImageIcon className="size-3.5" />
            </span>
          )}
          <span
            onClick={(e) => {
              if (!onOpenViewers) return;
              e.stopPropagation();
              onOpenViewers(i);
            }}
            className="absolute bottom-1 left-1 flex items-center gap-0.5 rounded-md bg-black/65 px-1.5 py-0.5 text-[9px] font-black text-white"
          >
            <Eye className="size-2.5" aria-hidden />
            {p.views}
          </span>
        </button>
      ))}
    </div>
  );
}

/** Tombol ikut / berhenti mengikuti — dipakai di profil orang lain. */
export function FollowButton({ targetId }: { targetId: Id<"users"> }) {
  const following = useQuery(api.feed.isFollowing, { targetId });
  const toggle = useMutation(api.feed.toggleFollow);
  const [busy, setBusy] = useState(false);
  return (
    <button
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const r = await toggle({ targetId });
          toast.success(r.following ? "Mengikuti" : "Berhenti mengikuti");
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Gagal");
        } finally {
          setBusy(false);
        }
      }}
      className={cn(
        "flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-black transition active:scale-95 disabled:opacity-60",
        following
          ? "border border-white/25 bg-white/10 text-white"
          : "bg-primary text-primary-foreground",
      )}
    >
      {following ? "Mengikuti" : <UserPlus className="size-3.5" />}
    </button>
  );
}
