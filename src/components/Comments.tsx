import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Avatar, BlueCheck } from "@/components/lstream-ui";
import { Heart, Reply, Send, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/lstream";

export type CommentT = {
  _id: string;
  userId: string;
  username: string;
  image?: string;
  bannerUrl?: string;
  premium?: boolean;
  clanTag?: string;
  clanTagIcon?: string;
  clanNameColor?: string;
  text: string;
  likes?: string[];
  likeCount?: number;
  replyToId?: string;
  createdAt: number;
};

const REPLY_POPUP_LIMIT = 8;

/**
 * Daftar komentar anime — gaya baru:
 * kolom pesan lurus (tanpa rounded), foto kiri-atas, username kanan-atas,
 * tombol reply & hapus, like, filter Terbaru/Populer.
 */
export function CommentsSection({
  animeId,
  comments,
  meId,
  onSend,
}: {
  animeId: string;
  comments: CommentT[] | undefined;
  meId?: string;
  onSend: (text: string, replyToId?: string) => Promise<void>;
}) {
  const [sort, setSort] = useState<"terbaru" | "populer">("terbaru");
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<CommentT | null>(null);

  const send = async () => {
    if (!text.trim()) return;
    try {
      await onSend(text, replyTo?._id);
      setText("");
      setReplyTo(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal kirim");
    }
  };

  const list = [...(comments ?? [])].sort((a, b) =>
    sort === "terbaru"
      ? b.createdAt - a.createdAt
      : (b.likeCount ?? 0) - (a.likeCount ?? 0),
  );

  return (
    <div>
      {/* Kolom + tombol kirim di atas */}
      {replyTo && (
        <div className="mb-2 flex items-center justify-between rounded-lg border-l-2 border-violet-500 bg-black/40 px-3 py-1.5 text-xs">
          <div className="min-w-0">
            <p className="font-medium text-violet-300">{replyTo.username}</p>
            <p className="truncate text-muted-foreground">{replyTo.text}</p>
          </div>
          <button onClick={() => setReplyTo(null)} aria-label="Batal reply">
            <X className="size-4" />
          </button>
        </div>
      )}
      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void send()}
          placeholder="Tulis komentar…"
          className="flex-1 rounded-lg border border-input bg-background/60 px-4 py-2.5 text-sm outline-none"
        />
        <button
          onClick={() => void send()}
          className="flex items-center justify-center rounded-lg bg-violet-600 px-4 text-white transition hover:bg-violet-500"
          aria-label="Kirim komentar"
        >
          <Send className="size-4" />
        </button>
      </div>

      {/* Filter Terbaru / Populer */}
      <div className="mt-3 flex gap-2">
        {(["terbaru", "populer"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSort(s)}
            className={cn(
              "rounded-full border px-3.5 py-1 text-xs font-semibold capitalize",
              sort === s
                ? "border-violet-500 bg-violet-500/15 text-violet-300"
                : "border-border text-muted-foreground",
            )}
          >
            {s === "terbaru" ? "Terbaru" : "Populer"}
          </button>
        ))}
      </div>

      {/* Daftar komentar: kotak lurus */}
      <div className="mt-3 space-y-2.5">
        {comments === undefined && (
          <p className="py-6 text-center text-xs text-muted-foreground">Memuat…</p>
        )}
        {comments && comments.length === 0 && (
          <p className="py-6 text-center text-xs text-muted-foreground">
            Belum ada komentar — jadilah yang pertama!
          </p>
        )}
        {list.map((c) => (
          <CommentRow
            key={c._id}
            c={c}
            meId={meId}
            onReply={() => setReplyTo(c)}
          />
        ))}
      </div>
    </div>
  );
}

function CommentRow({ c, meId, onReply }: { c: CommentT; meId?: string; onReply: () => void }) {
  const del = useMutation(api.activities.deleteComment);
  const like = useMutation(api.activities.toggleCommentLike);
  const mine = c.userId === meId;
  const liked = (c.likes ?? []).includes(meId as string);
  void REPLY_POPUP_LIMIT;

  return (
    <div
      className="border border-border/70 bg-secondary/30"
      style={{ borderRadius: "4px" }}
    >
      {/* Banner mini user di atas komentar */}
      {c.bannerUrl && (
        <div
          className="h-8 w-full bg-cover bg-center opacity-70"
          style={{ backgroundImage: `url(${c.bannerUrl})` }}
        />
      )}
      <div className="flex items-center justify-between px-2.5 pt-2">
        <Avatar src={c.image} seed={c.username} className="size-7" />
        <div className="min-w-0 flex-1 pl-2">
          <div className="flex items-center gap-1">
            <p className="truncate text-xs font-bold">{c.username}</p>
            {c.premium && <BlueCheck className="size-3.5" />}
            {c.clanTag && (
              <span className="ml-1 text-[10px] text-gold">[{c.clanTag}]</span>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground">{timeAgo(c.createdAt)}</p>
        </div>
      </div>
      <p className="break-words px-3 pb-1.5 pt-1.5 text-sm leading-5">{c.text}</p>
      <div className="flex items-center gap-4 px-2.5 pb-2 text-[11px] text-muted-foreground">
        <button
          title="Suka"
          className={cn("flex items-center gap-1", liked && "text-violet-400")}
          onClick={async () => {
            try {
              await like({ commentId: c._id as never });
            } catch {
              /* noop */
            }
          }}
        >
          <Heart className={cn("size-3.5", liked && "fill-violet-400")} />
          {c.likeCount ?? 0}
        </button>
        <button aria-label="Reply" title="Reply" className="hover:text-violet-300" onClick={onReply}>
          <Reply className="size-3.5" />
        </button>
        {mine && (
          <button
            aria-label="Hapus komentar"
            title="Hapus"
            className="hover:text-red-400"
            onClick={async () => {
              try {
                await del({ commentId: c._id as never });
                toast.success("Komentar dihapus");
              } catch {
                /* noop */
              }
            }}
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
