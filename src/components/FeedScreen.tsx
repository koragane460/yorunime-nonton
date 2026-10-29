import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { type Id } from "@/convex/_generated/dataModel";
import { Avatar } from "@/components/lstream-ui";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronLeft,
  Eye,
  Globe,
  Heart,
  Image as ImageIcon,
  Lock,
  MessageCircle,
  Music,
  Plus,
  Send,
  Share2,
  Type as TypeIcon,
  UserPlus,
  Users,
  X,
} from "lucide-react";

type Post = {
  postId: Id<"feedPosts">;
  userId: Id<"users">;
  kind: "image" | "music" | "text";
  caption: string;
  imageUrl: string | null;
  music: { title: string; artist?: string; cover?: string } | null;
  privacy: "all" | "teman";
  likeCount: number;
  liked: boolean;
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
      <p className="text-[15px] font-black leading-tight text-white drop-shadow">
        {p.username}
      </p>
      {p.caption && (
        <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-[13px] font-medium leading-snug text-white/90">
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
  onShare,
}: {
  p: Post;
  following: boolean;
  onFollow: () => void;
  onLike: () => void;
  onComment: () => void;
  onShare: () => void;
}) {
  return (
    <div className="absolute bottom-6 right-2 z-20 flex flex-col items-center gap-4">
      {/* Foto profil + tombol + (hanya untuk orang lain) */}
      <div className="relative">
        <Avatar src={p.image ?? undefined} seed={p.username} className="size-12 ring-2 ring-white/60" />
        {!p.isMe && (
          <button
            onClick={onFollow}
            aria-label={following ? "Berhenti mengikuti" : "Ikuti"}
            className={cn(
              "absolute -bottom-2 left-1/2 flex size-6 -translate-x-1/2 items-center justify-center rounded-full border-2 border-black/70 transition active:scale-90",
              following ? "bg-white text-black" : "bg-primary text-primary-foreground",
            )}
          >
            {following ? <X className="size-3.5" /> : <Plus className="size-3.5" />}
          </button>
        )}
      </div>

      <button onClick={onLike} className="flex flex-col items-center gap-0.5 transition active:scale-90">
        <Heart
          className={cn(
            "size-7 transition",
            p.liked ? "fill-rose-500 text-rose-500" : "text-white drop-shadow",
          )}
        />
        <span className="text-[11px] font-black text-white drop-shadow">{p.likeCount}</span>
      </button>

      <button onClick={onComment} className="flex flex-col items-center gap-0.5 transition active:scale-90">
        <span className="flex size-9 items-center justify-center rounded-full border border-white/35 bg-black/45 backdrop-blur">
          <MessageCircle className="size-5 text-white" />
        </span>
        <span className="text-[11px] font-black text-white drop-shadow">{p.commentCount}</span>
      </button>

      <button onClick={onShare} className="flex flex-col items-center gap-0.5 transition active:scale-90">
        <Share2 className="size-6 text-white drop-shadow" />
        <span className="text-[11px] font-black text-white drop-shadow">Bagikan</span>
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
  onShare,
  onOpenProfile,
  children,
}: {
  p: Post;
  following: boolean;
  onFollow: () => void;
  onLike: () => void;
  onComment: () => void;
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
      {p.kind === "image" && p.imageUrl ? (
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

      {/* Foto pembuat di tengah-atas (hanya konten orang lain) */}
      {!p.isMe && (
        <button
          onClick={onOpenProfile}
          aria-label={`Buka profil ${p.username}`}
          className="absolute left-1/2 top-4 z-20 -translate-x-1/2 transition active:scale-95"
        >
          <Avatar src={p.image ?? undefined} seed={p.username} className="size-14 ring-2 ring-white/70" />
        </button>
      )}

      <CaptionBlock p={p} />
      <RightRail
        p={p}
        following={following}
        onFollow={onFollow}
        onLike={onLike}
        onComment={onComment}
        onShare={onShare}
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

  const submit = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      await add({ postId, text });
      setText("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengirim komentar");
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
      <div className="flex-1 bg-black/60 backdrop-blur-[2px]" />
      <motion.div
        initial={{ y: 60 }}
        animate={{ y: 0 }}
        exit={{ y: 60 }}
        transition={{ duration: 0.24, ease: "easeOut" }}
        onClick={(e) => e.stopPropagation()}
        className="rounded-t-3xl border-t border-white/15 bg-[#10131a] p-4 pb-6"
      >
        <div className="mb-3 flex items-center gap-2">
          <span aria-hidden className="mx-auto block h-1 w-10 rounded-full bg-white/25" />
        </div>
        <p className="mb-2 text-center text-sm font-black text-white">Komentar</p>
        <div className="thin-scroll max-h-[46vh] space-y-2.5 overflow-y-auto pb-2">
          {!list && <p className="py-6 text-center text-xs text-zinc-500">Memuat…</p>}
          {list?.length === 0 && (
            <p className="py-6 text-center text-xs text-zinc-500">
              Belum ada komentar — jadi yang pertama.
            </p>
          )}
          {list?.map((c) => (
            <div key={c.commentId} className="flex items-start gap-2.5">
              <Avatar src={c.image} seed={c.username} className="size-8 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-black text-white">{c.username}</p>
                <p className="text-[13px] leading-snug text-white/80">{c.text}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void submit()}
            placeholder="Tulis komentar…"
            className="h-11 flex-1 rounded-full border border-white/20 bg-black/50 px-4 text-[15px] text-white outline-none placeholder:text-white/40 focus-visible:ring-0"
          />
          <button
            onClick={() => void submit()}
            disabled={busy || !text.trim()}
            aria-label="Kirim komentar"
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition active:scale-95 disabled:opacity-40"
          >
            <Send className="size-5" />
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
      const line = `📦 ${p.username} membagikan konten Feed${
        p.caption ? `: "${p.caption.slice(0, 120)}"` : ""
      }${note.trim() ? `\n\n${note.trim()}` : ""}`;
      await send({ kind: "dm", peerId: picked.userId as Id<"users">, text: line });
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
        <p className="mb-3 text-center text-sm font-black text-white">Bagikan ke</p>

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
              className="mt-3 w-full rounded-xl bg-gradient-to-b from-primary to-primary/85 py-3 text-sm font-black text-primary-foreground transition active:scale-[0.99] disabled:opacity-60"
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
  const [kind, setKind] = useState<"image" | "text" | "music">("image");
  const [caption, setCaption] = useState("");
  const [privacy, setPrivacy] = useState<"all" | "teman">("all");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [musicTitle, setMusicTitle] = useState("");
  const [musicArtist, setMusicArtist] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const pick = (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast.error("Pilih gambar dari galeri");
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setKind("image");
  };

  const submit = async () => {
    if (busy) return;
    if (kind === "image" && !file) {
      toast.error("Pilih gambar dulu");
      return;
    }
    if (kind === "text" && !caption.trim()) {
      toast.error("Tulis sesuatu dulu");
      return;
    }
    setBusy(true);
    try {
      let imageStorageId: string | undefined;
      if (kind === "image" && file) {
        const url = await upload({});
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!res.ok) throw new Error("Unggahan gagal");
        const { storageId } = (await res.json()) as { storageId: string };
        imageStorageId = storageId;
      }
      await create({
        kind,
        caption: caption.trim() || undefined,
        imageStorageId,
        music:
          kind === "music" && musicTitle.trim()
            ? { title: musicTitle.trim(), artist: musicArtist.trim() || undefined }
            : undefined,
        privacy,
      });
      toast.success("Konten sudah diposting ke profilmu");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal memposting");
    } finally {
      setBusy(false);
    }
  };

  const KINDS = [
    { key: "image" as const, label: "Galeri", Icon: ImageIcon },
    { key: "text" as const, label: "Text", Icon: TypeIcon },
    { key: "music" as const, label: "Musik", Icon: Music },
  ];

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
          <p className="flex-1 text-sm font-black text-white">Buat konten</p>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="flex size-8 items-center justify-center rounded-full border border-white/15 text-white/70"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Pratinjau / pilih sumber */}
        <div className="relative flex aspect-[4/5] w-full items-center justify-center overflow-hidden rounded-2xl border border-white/12 bg-black/50">
          {preview && kind === "image" ? (
            <img src={preview} alt="" className="h-full w-full object-cover" />
          ) : kind === "text" ? (
            <p className="px-6 text-center text-lg font-black text-white/85">
              {caption || "Tulis teks…"}
            </p>
          ) : kind === "music" ? (
            <div className="flex flex-col items-center gap-2 px-6 text-center">
              <Music className="size-8 text-white/60" />
              <input
                value={musicTitle}
                onChange={(e) => setMusicTitle(e.target.value)}
                placeholder="Judul musik"
                className="w-full rounded-xl border border-white/15 bg-black/50 px-3 py-2.5 text-center text-sm text-white outline-none placeholder:text-white/40 focus-visible:ring-0"
              />
              <input
                value={musicArtist}
                onChange={(e) => setMusicArtist(e.target.value)}
                placeholder="Artis"
                className="w-full rounded-xl border border-white/15 bg-black/50 px-3 py-2.5 text-center text-sm text-white outline-none placeholder:text-white/40 focus-visible:ring-0"
              />
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              className="flex flex-col items-center gap-2 text-white/60"
            >
              <ImageIcon className="size-8" />
              <span className="text-xs font-bold">Pilih dari galeri</span>
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => pick(e.target.files?.[0])}
          />
        </div>

        {/* Aksi sampingan: ganti sumber */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          {KINDS.map((k) => (
            <button
              key={k.key}
              onClick={() => {
                setKind(k.key);
                if (k.key === "image") setTimeout(() => fileRef.current?.click(), 0);
              }}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-[11px] font-black transition",
                kind === k.key
                  ? "border-primary/60 bg-primary/15 text-primary"
                  : "border-white/12 bg-white/[0.05] text-white/70",
              )}
            >
              <k.Icon className="size-3.5" />
              {k.label}
            </button>
          ))}
        </div>

        {/* Privasi — gaya TikTok: Semua orang / Teman only */}
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
          className="mt-4 w-full rounded-2xl bg-gradient-to-b from-primary to-primary/85 py-3.5 text-sm font-black text-primary-foreground transition hover:brightness-105 active:scale-[0.98] disabled:opacity-60"
        >
          {busy ? "Mengunggah… memposting…" : "Post"}
        </button>
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
        <p className="flex-1 text-lg font-black text-white drop-shadow">Feed</p>
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
  onFollow,
  onComment,
  onShare,
  onOpenProfile,
}: {
  p: Post;
  onVisible: (p: Post) => void;
  onLike: () => void;
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
    cover: string | null;
    caption: string;
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
          {p.imageUrl ?? p.cover ? (
            <img
              src={(p.imageUrl ?? p.cover) as string}
              alt=""
              className="h-full w-full object-cover transition group-hover:scale-105"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center px-1.5 text-center text-[9px] font-bold text-muted-foreground">
              {p.caption || p.kind}
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
