import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Avatar, BlueCheck, ClanTag, TitleBadge } from "@/components/lstream-ui";
import { DEFAULT_CLAN_ICON } from "@/lib/clanIcons";
import { Heart, Reply, Send, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/lstream";
import { useModeration } from "@/components/ModerationGuard";

export type CommentT = {
  _id: string;
  userId: string;
  username: string;
  image?: string;
  bannerUrl?: string;
  premium?: boolean;
  staffRole?: string;
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
  const { muted } = useModeration();

  const send = async () => {
    if (muted) {
      toast.error("Kamu sedang dimute, tidak bisa komentar");
      return;
    }
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
        <div className="mb-2 flex items-center justify-between rounded-lg border-l-2 border-foreground/40 bg-black/40 px-3 py-1.5 text-xs">
          <div className="min-w-0">
            <p className="font-medium text-primary">{replyTo.username}</p>
            <p className="truncate text-muted-foreground">{replyTo.text}</p>
          </div>
          <button onClick={() => setReplyTo(null)} aria-label="Batal reply">
            <X className="size-4" />
          </button>
        </div>
      )}
      {/* Kolom komentar: satu kotak full width (input + tombol di dalam) */}
      <div className="flex w-full items-center gap-1 rounded-xl border border-border bg-background/60 px-3 py-1.5 focus-within:border-foreground/40">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void send()}
          placeholder={muted ? "Kamu sedang dimute…" : "Tulis komentar…"}
          disabled={muted}
          className="h-10 flex-1 bg-transparent px-1 text-sm outline-none disabled:opacity-50"
        />
        <button
          onClick={() => void send()}
          disabled={muted}
          className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-white transition hover:bg-primary disabled:opacity-50"
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
                ? "border-foreground/40 bg-primary/15 text-primary"
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
            <TitleBadge role={c.staffRole} compact />
            {c.clanTag && (
              <ClanTag
                icon={c.clanTagIcon ?? DEFAULT_CLAN_ICON}
                tag={c.clanTag}
                className="ml-1 scale-90 px-1.5 py-0 text-[9px]"
              />
            )}
          </div>
          <p className="text-[10px] text-muted-foreground">{timeAgo(c.createdAt)}</p>
        </div>
      </div>
      <p className="break-words px-3 pb-1.5 pt-1.5 text-sm leading-5">{c.text}</p>
      <div className="flex items-center gap-4 px-2.5 pb-2 text-[11px] text-muted-foreground">
        <button
          title="Suka"
          className={cn("flex items-center gap-1", liked && "text-primary")}
          onClick={async () => {
            try {
              await like({ commentId: c._id as never });
            } catch {
              /* noop */
            }
          }}
        >
          <Heart className={cn("size-3.5", liked && "fill-foreground")} />
          {c.likeCount ?? 0}
        </button>
        <button aria-label="Reply" title="Reply" className="hover:text-primary" onClick={onReply}>
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
