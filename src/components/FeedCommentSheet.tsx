import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { type Id } from "@/convex/_generated/dataModel";
import { Avatar, BlueCheck, ClanTag } from "@/components/lstream-ui";
import { DEFAULT_CLAN_ICON } from "@/lib/clanIcons";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import {
  AtSign,
  ChevronDown,
  Heart,
  Image as ImageIcon,
  Send,
  Smile,
  X,
} from "lucide-react";

export type CommentPost = {
  postId: Id<"feedPosts">;
  kind: string;
  caption: string;
  imageUrl: string | null;
  thumbUrl: string | null;
  likeCount: number;
  allowComments?: boolean;
};

type FeedComment = {
  commentId: Id<"feedComments">;
  text: string;
  createdAt: number;
  userId: string;
  username: string;
  image: string | null;
  bannerUrl: string | null;
  level?: number;
  clanTag?: string;
  clanTagIcon?: string;
  clanNameColor?: string;
  premium?: boolean;
  parentId: Id<"feedComments"> | null;
  replyTo: string | null;
  likeCount: number;
  liked: boolean;
};

function timeAgoComment(ts: number) {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return "baru";
  if (s < 3600) return `${Math.floor(s / 60)} mnt`;
  if (s < 86400) return `${Math.floor(s / 3600)} jam`;
  if (s < 2592000) return `${Math.floor(s / 86400)} hr`;
  return `${Math.floor(s / 2592000)} bln`;
}

const QUICK_EMOJI = ["😂", "❤️", "🥰", "😘", "🤣", "😭", "🤩", "😍", "🙏", "🔥"];

export function FeedCommentSheet({
  post,
  onClose,
}: {
  post: CommentPost;
  onClose: () => void;
}) {
  const list = useQuery(api.feed.listComments, { postId: post.postId }) as
    | FeedComment[]
    | undefined;
  const add = useMutation(api.feed.addComment);
  const toggleLike = useMutation(api.feed.toggleCommentLike);
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showEmoji, setShowEmoji] = useState(true);
  const [openedReplies, setOpenedReplies] = useState<Set<string>>(new Set());
  const [replyTo, setReplyTo] = useState<{
    id: Id<"feedComments">;
    username: string;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const comments = (list ?? []) as FeedComment[];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return comments;
    return comments.filter(
      (c) =>
        c.text.toLowerCase().includes(q) ||
        c.username.toLowerCase().includes(q),
    );
  }, [comments, search]);

  const byId = useMemo(
    () => new Map(comments.map((c) => [String(c.commentId), c])),
    [comments],
  );
  const rootFor = (c: FeedComment) => {
    let cur = c;
    const guard = new Set<string>();
    while (cur.parentId && !guard.has(String(cur.commentId))) {
      guard.add(String(cur.commentId));
      const parent = byId.get(String(cur.parentId));
      if (!parent) break;
      cur = parent;
    }
    return cur;
  };
  const roots = filtered.filter((c) => !c.parentId);
  const children = new Map<string, FeedComment[]>();
  for (const c of filtered) {
    if (!c.parentId) continue;
    const root = rootFor(c);
    const key = String(root.commentId);
    const rows = children.get(key) ?? [];
    rows.push(c);
    children.set(key, rows);
  }

  const submit = async () => {
    if (!text.trim() || busy) return;
    if (post.allowComments === false) {
      setErr("Pemilik konten menonaktifkan komentar");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await add({
        postId: post.postId,
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

  const startReply = (c: FeedComment) => {
    setReplyTo({ id: c.commentId, username: c.username });
    setErr(null);
    inputRef.current?.focus();
  };

  const likeComment = (c: FeedComment) => {
    void toggleLike({ commentId: c.commentId }).catch((e) =>
      toast.error(e instanceof Error ? e.message : "Gagal menyukai komentar"),
    );
  };

  const renderRow = (c: FeedComment, nested = false) => (
    <div
      key={String(c.commentId)}
      className={cn(
        "flex items-start gap-2.5 py-2.5",
        nested && "ml-10",
      )}
    >
      <Avatar
        src={c.image ?? undefined}
        seed={c.username}
        className={cn("shrink-0", nested ? "size-8" : "size-9")}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[12px] font-semibold text-white/66">
            {c.username}
          </span>
          {c.premium && <BlueCheck className="size-3.5 shrink-0" />}
          {c.clanTag && (
            <ClanTag
              icon={c.clanTagIcon ?? DEFAULT_CLAN_ICON}
              tag={c.clanTag}
              color={c.clanNameColor}
              level={c.level}
              className="scale-[0.66] px-1 py-0 text-[8px]"
            />
          )}
          {c.replyTo && (
            <span className="flex min-w-0 items-center gap-1 text-[10px] font-semibold text-white/32">
              <span>▸</span>
              <span className="truncate">@{c.replyTo}</span>
            </span>
          )}
        </div>
        <p className="mt-0.5 whitespace-pre-wrap break-words text-[14.5px] leading-[1.34] text-white">
          {c.text}
        </p>
        <div className="mt-1 flex items-center gap-3 text-[10px] font-semibold text-white/38">
          <span>{timeAgoComment(c.createdAt)}</span>
          <button
            type="button"
            onClick={() => startReply(c)}
            className="transition active:opacity-60"
          >
            Jawab
          </button>
          {children.get(String(c.commentId))?.length ? (
            <button
              type="button"
              onClick={() => {
                setOpenedReplies((prev) => {
                  const next = new Set(prev);
                  next.add(String(c.commentId));
                  return next;
                });
                startReply(c);
              }}
              className="transition active:opacity-60"
            >
              {children.get(String(c.commentId))!.length} balasan
            </button>
          ) : null}
        </div>
      </div>
      <button
        type="button"
        onClick={() => likeComment(c)}
        className="mt-0.5 flex w-8 shrink-0 flex-col items-center gap-0.5 text-white/38 transition active:scale-90"
        aria-label="Sukai komentar"
      >
        <Heart
          className={cn(
            "size-[17px]",
            c.liked ? "fill-rose-500 text-rose-500" : "text-white/55",
          )}
        />
        {c.likeCount > 0 && (
          <span className="text-[8px] font-bold text-white/35">{c.likeCount}</span>
        )}
      </button>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[105] flex flex-col justify-end"
      onClick={onClose}
    >
      <div className="flex-1 bg-black/45 backdrop-blur-[1px]" />
      <motion.div
        initial={{ y: 70 }}
        animate={{ y: 0 }}
        exit={{ y: 70 }}
        transition={{ duration: 0.26, ease: "easeOut" }}
        onClick={(e) => e.stopPropagation()}
        className="flex h-[88dvh] max-h-[calc(100dvh-env(safe-area-inset-top))] flex-col overflow-hidden rounded-t-[22px] border-t border-white/10 bg-[#111217] text-white shadow-[0_-30px_80px_-30px_rgba(0,0,0,.95)]"
      >
        <div className="relative h-[30dvh] min-h-44 shrink-0 overflow-hidden bg-black">
          {post.kind === "video" && post.imageUrl ? (
            <video
              src={post.imageUrl}
              poster={post.thumbUrl ?? undefined}
              muted
              loop
              autoPlay
              playsInline
              className="size-full object-contain"
            />
          ) : post.imageUrl || post.thumbUrl ? (
            <img
              src={post.imageUrl ?? post.thumbUrl ?? ""}
              alt=""
              className="size-full object-contain"
            />
          ) : (
            <div className="flex size-full items-center justify-center bg-[radial-gradient(circle_at_50%_25%,#29203b,#0a0a0e_70%)] px-8 text-center text-[16px] font-black leading-snug text-white/80">
              {post.caption || "Konten Feed"}
            </div>
          )}
          <span className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#111217] via-[#111217]/60 to-transparent" />
        </div>

        <div className="relative -mt-2 shrink-0 px-3">
          <div className="flex items-center gap-2 rounded-xl bg-[#202128] px-3 py-2.5">
            <span className="shrink-0 text-[13px] font-bold text-[#56a8ff]">Cari:</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={post.caption || "cari komentar"}
              className="min-w-0 flex-1 bg-transparent text-[14px] text-white outline-none placeholder:text-white/35 focus-visible:ring-0"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Hapus pencarian"
                className="text-white/45"
              >
                <X className="size-4" />
              </button>
            ) : (
              <span className="text-lg leading-none text-white/35">⌕</span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 px-3 pb-1 pt-2.5">
          <span className="flex-1" />
          <p className="text-center text-[13px] font-bold text-white/85">
            {comments.length} komentar
          </p>
          <div className="flex flex-1 items-center justify-end gap-3">
            <span className="flex flex-col items-center gap-0.5 text-white/50">
              <Heart className="size-[18px]" />
              <span className="text-[8px] font-bold">{post.likeCount}</span>
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup komentar"
              className="grid size-8 place-items-center rounded-full text-white/80 transition active:scale-90"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-3">
          {!list && (
            <p className="py-8 text-center text-xs text-white/35">Memuat komentar…</p>
          )}
          {list?.length === 0 && (
            <p className="py-10 text-center text-xs text-white/35">
              Belum ada komentar — jadi yang pertama.
            </p>
          )}
          {filtered.length === 0 && comments.length > 0 && (
            <p className="py-10 text-center text-xs text-white/35">
              Komentar yang cocok tidak ditemukan.
            </p>
          )}
          {roots.map((root) => {
            const replies = children.get(String(root.commentId)) ?? [];
            const open = openedReplies.has(String(root.commentId));
            const preview = open ? replies : replies.slice(0, 2);
            return (
              <div key={String(root.commentId)} className="border-b border-white/[0.055] last:border-b-0">
                {renderRow(root)}
                {preview.map((r) => renderRow(r, true))}
                {replies.length > 2 && (
                  <button
                    type="button"
                    onClick={() =>
                      setOpenedReplies((prev) => {
                        const next = new Set(prev);
                        if (next.has(String(root.commentId))) next.delete(String(root.commentId));
                        else next.add(String(root.commentId));
                        return next;
                      })
                    }
                    className="mb-2 ml-[50px] flex items-center gap-1 text-[10.5px] font-bold text-white/42"
                  >
                    {open ? "Sembunyikan" : `Lihat ${replies.length - 2} balasan`}
                    <ChevronDown className={cn("size-3 transition", open && "rotate-180")} />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {post.allowComments === false ? (
          <div className="shrink-0 border-t border-white/8 px-4 py-4 text-center text-[11px] font-semibold text-white/40">
            Komentar dinonaktifkan untuk konten ini.
          </div>
        ) : (
          <div className="shrink-0 border-t border-white/8 bg-[#14151b] px-3 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2">
            <AnimatePresence initial={false}>
              {replyTo && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  className="mb-1.5 flex items-center gap-2 rounded-lg bg-white/[0.06] px-2.5 py-1.5"
                >
                  <span className="min-w-0 flex-1 truncate text-[10px] font-bold text-white/55">
                    Membalas <span className="text-[#76b8ff]">@{replyTo.username}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setReplyTo(null)}
                    className="text-[10px] font-black text-white/38"
                  >
                    Batal
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex items-center gap-2">
              <Avatar seed="kamu" className="size-8 shrink-0" />
              <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-full bg-[#23242b] px-3 py-1.5">
                <input
                  ref={inputRef}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void submit()}
                  placeholder={
                    err ??
                    (replyTo
                      ? `Balas @${replyTo.username}…`
                      : "Tambah komentar…")
                  }
                  className={cn(
                    "h-8 min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-white/38 focus-visible:ring-0",
                    err && "placeholder:text-rose-300",
                  )}
                />
                <button
                  type="button"
                  onClick={() =>
                    toast.info("Lampiran gambar di komentar Feed belum didukung")
                  }
                  aria-label="Lampiran gambar"
                  className="text-white/60"
                >
                  <ImageIcon className="size-5" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowEmoji((v) => !v)}
                  aria-label="Emoji"
                  className="text-white/60"
                >
                  <Smile className="size-5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setText((v) => `${v}@`);
                    inputRef.current?.focus();
                  }}
                  aria-label="Sebut pengguna"
                  className="text-white/60"
                >
                  <AtSign className="size-5" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => void submit()}
                disabled={busy || !text.trim()}
                aria-label="Kirim komentar"
                className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-full transition active:scale-90",
                  text.trim() ? "bg-[#e12f5b] text-white" : "bg-[#4d1826] text-white/55",
                )}
              >
                <Send className="size-[18px]" />
              </button>
            </div>

            <AnimatePresence initial={false}>
              {showEmoji && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 36 }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-3 overflow-x-auto pt-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                  {QUICK_EMOJI.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() =>
                        setText((v) => {
                          const next = `${v}${emoji}`;
                          return next.slice(0, 400);
                        })
                      }
                      className="shrink-0 text-[22px] leading-none transition active:scale-90"
                    >
                      {emoji}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
