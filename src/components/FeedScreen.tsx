import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
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
} from "lucide-react";

/** Waktu relatif singkat — "baru", "5 mnt", "2 jam", "3 hr". */
function timeAgo(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return "baru";
  if (s < 3600) return `${Math.floor(s / 60)} mnt`;
  if (s < 86400) return `${Math.floor(s / 3600)} jam`;
  if (s < 2592000) return `${Math.floor(s / 86400)} hr`;
  return `${Math.floor(s / 2592000)} bln`;
}

type Post = {
  postId: Id<"feedPosts">;
  userId: Id<"users">;
  kind: "image" | "music" | "text" | "video";
  caption: string;
  imageUrl: string | null;
  thumbUrl: string | null;
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
  privacy: "all" | "teman";
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
};

/* ------------------------------------------------------------------ *
 *  BAGIAN BAWAH KIRI — username + caption
 * ------------------------------------------------------------------ */
function CaptionBlock({ p }: { p: Post }) {
  return (
    <div className="pointer-events-auto absolute bottom-0 left-0 right-16 z-20 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-4 pb-5 pt-16">
      <p className="yn-title text-[1.35rem] leading-tight text-white drop-shadow">
        {p.username}
      </p>
      {p.caption && (
        <p className="mt-1.5 line-clamp-3 whitespace-pre-wrap text-[16px] font-semibold leading-snug text-white/95">
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
    <div className="absolute right-2 top-[31%] z-20 flex flex-col items-center gap-6">
      {/* Foto profil + Follow. Tombol merah muda HILANG total setelah follow. */}
      <div className="flex flex-col items-center gap-1.5">
        <button
          type="button"
          onClick={onOpenProfile}
          aria-label={`Buka profil ${p.username}`}
          className="transition active:scale-95"
        >
          <Avatar src={p.image ?? undefined} seed={p.username} className="size-14 ring-2 ring-white/60" />
        </button>
        {!p.isMe && !following && (
          <button
            onClick={onFollow}
            className="rounded-full bg-rose-400 px-3 py-1 text-[10px] font-black text-white shadow-[0_8px_18px_-10px_rgba(244,63,94,.9)] transition active:scale-90"
          >
            Follow
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
            p.favorited ? "fill-white text-white" : "text-white",
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
          <span className="relative grid size-12 place-items-center overflow-hidden rounded-full border border-white/35 bg-black/55 shadow-[0_10px_24px_-14px_rgba(0,0,0,.95)]">
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
          <span className="max-w-[62px] truncate text-[8px] font-bold text-white/80 drop-shadow">
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
}: {
  src: string;
  poster?: string;
  volume: number;
}) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.volume = Math.max(0, Math.min(1, volume));
    void el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  }, [src, volume]);

  const toggle = () => {
    const el = ref.current;
    if (!el) return;
    if (el.paused) {
      void el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    } else {
      el.pause();
      setPlaying(false);
    }
  };

  return (
    <div className="absolute inset-0">
      <video
        ref={ref}
        src={src}
        poster={poster}
        className="h-full w-full object-cover"
        autoPlay
        loop
        playsInline
        controls={false}
        disablePictureInPicture
        onClick={toggle}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />
      <button
        type="button"
        onClick={toggle}
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
  children?: ReactNode;
}) {
  // Geser ke kanan (dari tepi kiri) → buka profil pembuat.
  const touch = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touch.current;
    touch.current = null;
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
      onTouchEnd={onTouchEnd}
    >
      {p.kind === "video" && p.imageUrl ? (
        <>
          <FeedVideo
            src={p.imageUrl}
            poster={p.thumbUrl ?? undefined}
            volume={(p.audio?.videoVol ?? 100) / 100}
          />
          {/* Backsound musik — diputar seiring video (loop). */}
          {p.music?.audioUrl && (
            <audio
              src={p.music.audioUrl}
              autoPlay
              loop
              ref={(el) => {
                if (!el) return;
                el.volume = Math.max(
                  0,
                  Math.min(1, (p.audio?.musicVol ?? 100) / 100),
                );
              }}
            />
          )}
        </>
      ) : p.imageUrl ? (
        <img src={p.imageUrl} alt={p.caption} className="h-full w-full object-cover" />
      ) : p.kind === "music" ? (
        <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(120%_80%_at_50%_0%,#2a1330_0%,#0d0a14_65%,#070609_100%)]">
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
        <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(165deg,#171126_0%,#101018_55%,#0a0a10_100%)] px-7">
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

      <CaptionBlock p={p} />
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
            {!list && <p className="py-6 text-center text-xs text-zinc-500">Memuat…</p>}
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
function ShareSheet({ p, onClose }: { p: Post; onClose: () => void }) {
  const friends = useQuery(api.friends.listFriends, {});
  const send = useMutation(api.chat.sendMessage);
  const [picked, setPicked] = useState<{ userId: string; username: string } | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const share = async () => {
    if (!picked || busy) return;
    setBusy(true);
    try {
      // Kirim sebagai KARTU KONTEN FEED (bisa dibuka & kembali), bukan
      // tempelan teks — persis kartu yang terlihat di feed.
      await send({
        kind: "dm",
        peerId: picked.userId as Id<"users">,
        text: note.trim() || undefined,
        feedPostId: p.postId,
      });
      toast.success(`Terkirim ke ${picked.username}`);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengirim");
    } finally {
      setBusy(false);
    }
  };

  const list = (friends ?? []).map((f: any) => ({
    userId: String(f.userId ?? f._id ?? ""),
    username: f.username ?? "user",
    image: f.image ?? null,
  }));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[95] flex flex-col justify-end"
      onClick={onClose}
    >
      <div className="flex-1 bg-black/60 backdrop-blur-[2px]" />
      <motion.div
        initial={{ y: 60 }}
        animate={{ y: 0 }}
        exit={{ y: 60 }}
        transition={{ duration: 0.24, ease: "easeOut" }}
        onClick={(e) => e.stopPropagation()}
        className="rounded-t-3xl border-t border-white/15 bg-[#10131a] p-4 pb-6"
      >
        <span aria-hidden className="mx-auto mb-3 block h-1 w-10 rounded-full bg-white/25" />
        <p className="mb-3 text-center text-sm text-white yn-title">Bagikan ke</p>

        {/* Teman — geser ke kanan */}
        <div className="thin-scroll -mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
          {list.length === 0 && (
            <p className="py-4 text-center text-xs text-zinc-500">Belum ada teman untuk dikirimi.</p>
          )}
          {list.map((f) => (
            <button
              key={f.userId}
              onClick={() => setPicked(f)}
              className="flex w-16 shrink-0 flex-col items-center gap-1.5"
            >
              <span
                className={cn(
                  "rounded-full p-[2px] transition",
                  picked?.userId === f.userId ? "bg-primary" : "bg-transparent",
                )}
              >
                <Avatar src={f.image} seed={f.username} className="size-12" />
              </span>
              <span className="w-full truncate text-center text-[10px] font-bold text-white/80">
                {f.username}
              </span>
            </button>
          ))}
        </div>

        {picked && (
          <div className="mt-3 rounded-2xl border border-white/12 bg-white/[0.05] p-3">
            <div className="flex items-center gap-2.5">
              <Avatar src={list.find((f) => f.userId === picked.userId)?.image ?? null} seed={picked.username} className="size-10" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-black text-white">{picked.username}</p>
                <p className="text-[10px] text-white/50">Kirim konten ini lewat chat</p>
              </div>
            </div>

            {/* Kolom pesan + kotak konten di kanannya */}
            <div className="mt-2.5 flex items-stretch gap-2">
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Tulis pesan…"
                className="h-11 flex-1 rounded-xl border border-white/15 bg-black/50 px-3 text-sm text-white outline-none placeholder:text-white/40 focus-visible:ring-0"
              />
              <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-white/20 bg-black/50">
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-white/50">
                    <ImageIcon className="size-4" />
                  </span>
                )}
              </div>
            </div>

            {/* Tombol kirim — persegi panjang ke samping */}
            <button
              onClick={() => void share()}
              disabled={busy}
              className="mt-3 w-full rounded-xl bg-primary py-3 text-sm font-black text-primary-foreground transition active:scale-[0.99] disabled:opacity-60"
            >
              {busy ? "Mengirim…" : "Kirim"}
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
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
 *  LAYAR FEED (route /feed)
 * ------------------------------------------------------------------ */
export function FeedScreen() {
  const navigate = useNavigate();
  const posts = useQuery(api.feed.listFeed, { limit: 50 }) as Post[] | undefined;
  const toggleLike = useMutation(api.feed.toggleLike);
  const toggleFavorite = useMutation(api.feed.toggleFavorite);
  const addView = useMutation(api.feed.addView);
  const toggleFollow = useMutation(api.feed.toggleFollow);

  const [creating, setCreating] = useState(false);
  const [commentOn, setCommentOn] = useState<Id<"feedPosts"> | null>(null);
  const [shareOn, setShareOn] = useState<Post | null>(null);
  const [seen, setSeen] = useState<Set<string>>(new Set());

  // Setiap post yang tampil dihitung 1 view (sekali per pembukaan).
  const onVisible = (p: Post) => {
    if (seen.has(String(p.postId))) return;
    setSeen((s) => new Set(s).add(String(p.postId)));
    void addView({ postId: p.postId }).catch(() => {});
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black">
      {/* Kepala — tanpa latar tebal, menempel di atas */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center gap-2 bg-gradient-to-b from-black/70 to-transparent px-4 pb-8 pt-4">
        <button
          onClick={() => navigate(-1)}
          aria-label="Kembali"
          className="pointer-events-auto flex size-9 items-center justify-center text-white transition active:scale-95"
        >
          <ChevronLeft className="size-6" />
        </button>
        <p className="flex-1 text-lg text-white drop-shadow yn-title">Feed</p>
        <button
          onClick={() => setCreating(true)}
          aria-label="Buat konten"
          className="pointer-events-auto flex size-9 items-center justify-center rounded-full border border-white/30 bg-black/45 text-white backdrop-blur transition active:scale-95"
        >
          <Plus className="size-5" />
        </button>
      </div>

      {!posts && (
        <div className="flex h-full items-center justify-center text-sm text-white/60">
          Memuat feed…
        </div>
      )}
      {posts && posts.length === 0 && (
        <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
          <ImageIcon className="size-9 text-white/40" />
          <p className="text-sm font-bold text-white/70">Belum ada konten</p>
          <button
            onClick={() => setCreating(true)}
            className="rounded-full bg-primary px-5 py-2.5 text-xs font-black text-primary-foreground"
          >
            Buat konten pertama
          </button>
        </div>
      )}

      {posts && posts.length > 0 && (
        <div className="thin-scroll h-full snap-y snap-mandatory overflow-y-auto overscroll-y-contain">
          {posts.map((p) => (
            <PostShell
              key={String(p.postId)}
              p={p}
              onVisible={onVisible}
              onLike={() => void toggleLike({ postId: p.postId }).catch(() => {})}
              onFavorite={() => void toggleFavorite({ postId: p.postId }).catch(() => {})}
              onFollow={() => void toggleFollow({ targetId: p.userId }).catch(() => {})}
              onComment={() => setCommentOn(p.postId)}
              onShare={() => setShareOn(p)}
              onOpenProfile={() =>
                navigate(p.isMe ? "/akun" : `/akun?user=${String(p.userId)}`)
              }
            />
          ))}
        </div>
      )}

      <AnimatePresence>
        {creating && <CreatePostSheet onClose={() => setCreating(false)} />}
        {commentOn && <CommentSheet postId={commentOn} onClose={() => setCommentOn(null)} />}
        {shareOn && <ShareSheet p={shareOn} onClose={() => setShareOn(null)} />}
      </AnimatePresence>
    </div>
  );
}

/** Balikan `isFollowing` per pembuat — dipanggil dari dalam daftar. */
function PostShell({
  p,
  onVisible,
  onLike,
  onFavorite,
  onFollow,
  onComment,
  onShare,
  onOpenProfile,
}: {
  p: Post;
  onVisible: (p: Post) => void;
  onLike: () => void;
  onFavorite: () => void;
  onFollow: () => void;
  onComment: () => void;
  onShare: () => void;
  onOpenProfile: () => void;
}) {
  const following = useQuery(
    api.feed.isFollowing,
    p.isMe ? "skip" : { targetId: p.userId },
  ) as boolean | undefined;

  useEffect(() => {
    onVisible(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.postId]);

  return (
    <div className="h-full w-full snap-start">
      <PostView
        p={p}
        following={!!following}
        onFollow={onFollow}
        onLike={onLike}
        onComment={onComment}
        onFavorite={onFavorite}
        onShare={onShare}
        onOpenProfile={onOpenProfile}
      />
    </div>
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
  const [commentOn, setCommentOn] = useState<Id<"feedPosts"> | null>(null);
  const [shareOn, setShareOn] = useState<Post | null>(null);

  const p = posts[i];
  const following = useQuery(
    api.feed.isFollowing,
    !p || p.isMe ? "skip" : { targetId: p.userId },
  ) as boolean | undefined;

  if (!p) return null;

  return (
    <div className="fixed inset-0 z-[95] bg-black">
      <PostView
        p={p}
        following={!!following}
        onFollow={() => void toggleFollow({ targetId: p.userId }).catch(() => {})}
        onLike={() => void toggleLike({ postId: p.postId }).catch(() => {})}
        onFavorite={() => void toggleFavorite({ postId: p.postId }).catch(() => {})}
        onComment={() => setCommentOn(p.postId)}
        onShare={() => setShareOn(p)}
        onOpenProfile={() => onOpenProfile?.(p.userId)}
      >
        <button
          onClick={onClose}
          aria-label="Tutup"
          className="absolute left-3 top-4 z-30 flex size-9 items-center justify-center rounded-full border border-white/25 bg-black/45 text-white backdrop-blur transition active:scale-95"
        >
          <ChevronLeft className="size-5" />
        </button>
        {posts.length > 1 && (
          <div className="absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2">
            <button
              onClick={() => setI((v) => Math.max(0, v - 1))}
              disabled={i === 0}
              className="rounded-full border border-white/25 bg-black/50 px-3 py-1.5 text-[11px] font-black text-white disabled:opacity-30"
            >
              Sebelumnya
            </button>
            <span className="text-[11px] font-black text-white/70">
              {i + 1}/{posts.length}
            </span>
            <button
              onClick={() => setI((v) => Math.min(posts.length - 1, v + 1))}
              disabled={i === posts.length - 1}
              className="rounded-full border border-white/25 bg-black/50 px-3 py-1.5 text-[11px] font-black text-white disabled:opacity-30"
            >
              Berikutnya
            </button>
          </div>
        )}
        {/* Jumlah views — pojok kiri bawah kotak */}
        <span className="absolute left-3 top-16 z-30 flex items-center gap-1 rounded-full border border-white/20 bg-black/50 px-2.5 py-1 text-[10px] font-black text-white/85 backdrop-blur">
          <Eye className="size-3" aria-hidden />
          {p.views}
        </span>
      </PostView>

      <AnimatePresence>
        {commentOn && <CommentSheet postId={commentOn} onClose={() => setCommentOn(null)} />}
        {shareOn && <ShareSheet p={shareOn} onClose={() => setShareOn(null)} />}
      </AnimatePresence>
    </div>
  );
}

/** Grid kotak konten (3 per baris) + jumlah views — dipakai di profil. */
export function ContentGrid({
  posts,
  onOpen,
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
              preload="metadata"
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
          <span className="absolute bottom-1 left-1 flex items-center gap-0.5 rounded-md bg-black/65 px-1.5 py-0.5 text-[9px] font-black text-white">
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
