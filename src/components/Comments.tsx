import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { BlueCheck, ClanTag, TitleBadge } from "@/components/lstream-ui";
import { FramedAvatar } from "@/components/FramedAvatar";
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
  /** Shop Border yang sedang dipakai pembuat komentar. */
  avatarBorder?: string;
  bannerUrl?: string;
  premium?: boolean;
  staffRole?: string;
  clanTag?: string;
  clanTagIcon?: string;
  /** Level clan — menentukan warna nama clan di tag. */
  clanLevel?: number;
  clanNameColor?: string;
  text: string;
  likes?: string[];
  likeCount?: number;
  replyToId?: string;
  createdAt: number;
};

/**
 * Daftar komentar anime.
 *
 * Balas komentar memakai panel bawah (bottom sheet) seperti TikTok: komentar
 * yang dibalas dikutip di atas, kolom komentar dan tombol kirim ada di dalam
 * panel yang sama, jadi tidak ada input yang nyempil di luar panel.
 */
export function CommentsSection({
  animeId,
  comments,
  meId,
  onSend,
  onDeleted,
}: {
  animeId: string;
  comments: CommentT[] | undefined;
  meId?: string;
  onSend: (text: string, replyToId?: string) => Promise<void>;
  /** Dipanggil setelah server menghapus komentar, supaya daftar langsung bersih. */
  onDeleted?: (id: string) => void;
}) {
  const [sort, setSort] = useState<"terbaru" | "populer">("terbaru");
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<CommentT | null>(null);
  const { muted } = useModeration();
  void animeId;

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
      {/* Kolom komentar utama: full width, sudut lurus, TANPA outline dan
          nyaris tak terlihat — latar sangat samar supaya menyatu dengan
          halaman, tapi tetap bisa dipakai. Tinggi juga dipendekkan. */}
      <div className="flex w-full items-center gap-1 border-0 bg-white/[0.035] px-2 py-0.5 transition focus-within:bg-white/[0.06]">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void send()}
          placeholder={muted ? "Kamu sedang dimute…" : "Tulis komentar…"}
          disabled={muted}
          className="h-8 flex-1 bg-transparent px-1 text-sm outline-none disabled:opacity-50"
        />
        <button
          onClick={() => void send()}
          disabled={muted}
          className="yn-btn-warm flex size-7 shrink-0 items-center justify-center rounded-lg transition disabled:opacity-50"
          aria-label="Kirim komentar"
        >
          <Send className="size-3.5" />
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

      {/* Daftar komentar */}
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
            onDeleted={onDeleted}
            onReply={() => setReplyTo(c)}
          />
        ))}
      </div>

      {/* Panel balas komentar — kutipan + kolom + kirim, semuanya di sini */}
      {replyTo && (
        <ReplySheet
          target={replyTo}
          muted={muted}
          text={text}
          onText={setText}
          onSend={() => void send()}
          onClose={() => setReplyTo(null)}
        />
      )}
    </div>
  );
}

/** Panel bawah untuk membalas komentar. */
function ReplySheet({
  target,
  muted,
  text,
  onText,
  onSend,
  onClose,
}: {
  target: CommentT;
  muted: boolean;
  text: string;
  onText: (v: string) => void;
  onSend: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-end" role="dialog" aria-modal>
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div className="pop-enter relative w-full max-h-[75vh] overflow-hidden rounded-t-2xl border-t border-white/15 bg-card shadow-2xl">
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
          <p className="text-sm font-bold">Balas {target.username}</p>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="ml-auto flex size-8 items-center justify-center rounded-full bg-white/10"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Komentar yang dibalas */}
        <div className="thin-scroll max-h-[38vh] overflow-y-auto bg-black/30 px-4 py-3">
          <div className="flex gap-2.5">
            <FramedAvatar
              border={target.avatarBorder}
              src={target.image}
              seed={target.username}
              className="size-8"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <p className="truncate text-xs font-bold">{target.username}</p>
                {target.premium && <BlueCheck className="size-3.5" />}
                <TitleBadge role={target.staffRole} compact />
                <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                  {timeAgo(target.createdAt)}
                </span>
              </div>
              <p className="mt-0.5 break-words text-sm leading-5 text-zinc-200">
                {target.text}
              </p>
            </div>
          </div>
        </div>

        {/* Kolom komentar + tombol kirim */}
        <div className="flex items-center gap-2 border-t border-white/10 px-3 py-3">
          <input
            value={text}
            autoFocus
            onChange={(e) => onText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSend()}
            placeholder={muted ? "Kamu sedang dimute…" : `Balas ${target.username}…`}
            disabled={muted}
            className="h-11 min-w-0 flex-1 rounded-full border border-white/15 bg-black/40 px-4 text-sm outline-none focus:border-primary disabled:opacity-50"
          />
          <button
            onClick={onSend}
            disabled={muted || !text.trim()}
            aria-label="Kirim balasan"
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-white disabled:opacity-40"
          >
            <Send className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function CommentRow({
  c,
  meId,
  onReply,
  onDeleted,
}: {
  c: CommentT;
  meId?: string;
  onReply: () => void;
  onDeleted?: (id: string) => void;
}) {
  const del = useMutation(api.activities.deleteComment);
  const like = useMutation(api.activities.toggleCommentLike);
  const [busy, setBusy] = useState(false);
  const mine = c.userId === meId;
  const liked = (c.likes ?? []).includes(meId as string);

  const remove = async () => {
    if (busy) return;
    // Komentar echo lokal (belum sampai server) cukup dibuang dari daftar.
    if (c._id.startsWith("local-")) {
      onDeleted?.(c._id);
      return;
    }
    setBusy(true);
    try {
      await del({ commentId: c._id as never });
      onDeleted?.(c._id);
      toast.success("Komentar dihapus");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menghapus komentar");
    } finally {
      setBusy(false);
    }
  };

  return (
    /* Kartu komentar TANPA outline — garis tepinya dihapus total (permintaan
       "outline nya jangan keliatan"), hanya latar samar yang memisahkan. */
    <div
      className="border-0 bg-white/[0.045]"
      style={{ borderRadius: "4px" }}
    >
      {c.bannerUrl && (
        // Banner profil ditarik ke dalam (tidak menyentuh tepi kartu) dan
        // diberi sudut membulat supaya tidak terlihat seperti gambar yang
        // dipaksa melebar penuh.
        <div
          className="mx-2 mt-2 h-8 rounded-md bg-cover bg-center opacity-70"
          style={{ backgroundImage: `url(${c.bannerUrl})` }}
        />
      )}
      <div className="flex items-center justify-between px-2.5 pt-2">
        <FramedAvatar
          border={c.avatarBorder}
          src={c.image}
          seed={c.username}
          className="size-7"
        />
        <div className="min-w-0 flex-1 pl-2">
          <div className="flex items-center gap-1">
            <p className="truncate text-xs font-bold">{c.username}</p>
            {c.premium && <BlueCheck className="size-3.5" />}
            <TitleBadge role={c.staffRole} compact />
            {c.clanTag && (
              <ClanTag
                icon={c.clanTagIcon ?? DEFAULT_CLAN_ICON}
                tag={c.clanTag}
                level={c.clanLevel}
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
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Gagal");
            }
          }}
        >
          <Heart className={cn("size-3.5", liked && "fill-foreground")} />
          {c.likeCount ?? 0}
        </button>
        <button
          aria-label="Reply"
          title="Reply"
          className="hover:text-primary"
          onClick={onReply}
        >
          <Reply className="size-3.5" />
        </button>
        {mine && (
          <button
            aria-label="Hapus komentar"
            title="Hapus"
            disabled={busy}
            className="hover:text-red-400 disabled:opacity-40"
            onClick={() => void remove()}
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
