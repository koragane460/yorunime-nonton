import { useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Avatar, BlueCheck, ClanTag, TitleBadge } from "@/components/lstream-ui";
import { DEFAULT_CLAN_ICON } from "@/lib/clanIcons";
import { ChevronDown, Heart, Reply, Send, Trash2, X } from "lucide-react";
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
  /** Berapa reply yang sedang dibuka per komentar induk (kelipatan 5). */
  const [openReplies, setOpenReplies] = useState<Record<string, number>>({});
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

  // Komentar induk = yang TIDAK membalas siapa pun; sisanya jadi reply
  // yang menempel di bawah induknya (digeser sedikit ke kanan, permintaan).
  const all = comments ?? [];
  const roots = useMemo(
    () =>
      list.filter(
        (c) => !c.replyToId || !all.some((p) => p._id === c.replyToId),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sort, comments],
  );
  /** Semua balasan milik satu komentar induk — termasuk balasan dari balasan
      (dijelajahi berjenjang), supaya tidak ada reply yang hilang. */
  const repliesOf = (id: string): CommentT[] => {
    const out: CommentT[] = [];
    const seen = new Set<string>([id]);
    let frontier = [id];
    while (frontier.length > 0) {
      const kids = all.filter((r) => r.replyToId && frontier.includes(r.replyToId));
      frontier = [];
      for (const k of kids) {
        if (seen.has(k._id)) continue;
        seen.add(k._id);
        out.push(k);
        frontier.push(k._id);
      }
    }
    return out.sort((a, b) => a.createdAt - b.createdAt);
  };

  return (
    <div>
      {/* Kolom komentar utama: KOTAK LURUS (tanpa rounded) yang melebar
          penuh ke samping sampai mentok tepi — permintaan pemilik. */}
      <div className="flex w-full items-center gap-2 border-y border-white/10 bg-white/[0.06] py-1.5 pl-4 pr-2 transition focus-within:border-white/25 focus-within:bg-white/[0.09]">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void send()}
          placeholder={muted ? "Kamu sedang dimute…" : "Tulis komentar…"}
          disabled={muted}
          className="h-8 min-w-0 flex-1 bg-transparent text-sm outline-none disabled:opacity-50"
        />
        {/* Tombol kirim HIDUP: gradien emas + kilau berjalan + membesar
            saat ada teks (permintaan: jangan membosankan). */}
        <button
          onClick={() => void send()}
          disabled={muted || !text.trim()}
          className={cn(
            "group relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full transition-all duration-300 active:scale-90",
            text.trim()
              ? "bg-gradient-to-br from-amber-300 via-gold-strong to-orange-500 text-black shadow-[0_0_18px_-4px_rgba(251,191,36,.95)]"
              : "bg-white/10 text-white/40",
          )}
          aria-label="Kirim komentar"
        >
          <Send className={cn("size-4 transition-transform", text.trim() && "group-hover:translate-x-0.5")} />
          {text.trim() && (
            <span
              aria-hidden
              className="absolute inset-0 bg-[linear-gradient(115deg,transparent_38%,rgba(255,255,255,.65)_50%,transparent_62%)] bg-[length:250%_100%] bg-no-repeat [background-position:200%_0] animate-[yn-shine-sweep_2.4s_ease-in-out_infinite]"
            />
          )}
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
        {list.map((c) => {
          if (roots.length > 0 && !roots.some((r) => r._id === c._id)) return null;
          const replies = repliesOf(c._id);
          const shown = openReplies[c._id] ?? 0;
          return (
            <div key={c._id}>
              <CommentRow
                c={c}
                meId={meId}
                onDeleted={onDeleted}
                onReply={() => setReplyTo(c)}
                replyCount={replies.length}
                repliesOpen={shown > 0}
                onToggleReplies={() =>
                  setOpenReplies((s) => ({
                    ...s,
                    [c._id]: (s[c._id] ?? 0) > 0 ? 0 : Math.min(5, replies.length),
                  }))
                }
              />

              {/* Balasan — posisi agak ke kanan dari komentar induk. */}
              {shown > 0 && (
                <div className="ml-7 space-y-2 border-l border-white/10 pl-3">
                  {replies.slice(0, shown).map((r) => (
                    <CommentRow
                      key={r._id}
                      c={r}
                      meId={meId}
                      onDeleted={onDeleted}
                      onReply={() => setReplyTo(c)}
                      isReply
                    />
                  ))}
                  {shown < replies.length && (
                    <button
                      onClick={() =>
                        setOpenReplies((s) => ({
                          ...s,
                          [c._id]: Math.min(replies.length, (s[c._id] ?? 0) + 5),
                        }))
                      }
                      className="flex items-center gap-1 pl-9 text-[11px] font-bold text-gold-strong transition hover:text-white"
                    >
                      <ChevronDown className="size-3.5" aria-hidden />
                      Lihat {replies.length - shown} reply lagi
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
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
          <p className="yn-title text-sm">Balas {target.username}</p>
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
            <Avatar src={target.image} seed={target.username} className="size-8" />
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
            className="h-11 min-w-0 flex-1 rounded-full border border-white/15 bg-black/40 px-4 text-sm outline-none focus:border-white/45 disabled:opacity-50"
          />
          <button
            onClick={onSend}
            disabled={muted || !text.trim()}
            aria-label="Kirim balasan"
            className={cn(
              "group relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full transition-all duration-300 active:scale-90",
              text.trim()
                ? "bg-gradient-to-br from-amber-300 via-gold-strong to-orange-500 text-black shadow-[0_0_22px_-5px_rgba(251,191,36,1)]"
                : "bg-white/10 text-white/40",
            )}
          >
            <Send className="size-4 transition-transform group-hover:translate-x-0.5" />
            {text.trim() && (
              <span
                aria-hidden
                className="absolute inset-0 bg-[linear-gradient(115deg,transparent_38%,rgba(255,255,255,.65)_50%,transparent_62%)] bg-[length:250%_100%] bg-no-repeat [background-position:200%_0] animate-[yn-shine-sweep_2.4s_ease-in-out_infinite]"
              />
            )}
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
  replyCount = 0,
  repliesOpen = false,
  onToggleReplies,
  isReply = false,
}: {
  c: CommentT;
  meId?: string;
  onReply: () => void;
  onDeleted?: (id: string) => void;
  /** Jumlah balasan — tampil sebagai tombol "Lihat N reply". */
  replyCount?: number;
  repliesOpen?: boolean;
  onToggleReplies?: () => void;
  /** True untuk komentar balasan (tampil lebih ringkas). */
  isReply?: boolean;
}) {
  const del = useMutation(api.activities.deleteComment);
  const like = useMutation(api.activities.toggleCommentLike);
  const [busy, setBusy] = useState(false);
  // LIKE optimistik: hati langsung terisi tanpa menunggu server.
  const [localLiked, setLocalLiked] = useState<boolean | null>(null);
  const mine = c.userId === meId;
  const liked = localLiked ?? (c.likes ?? []).includes(meId as string);
  const likeCount =
    (c.likeCount ?? (c.likes ?? []).length) + (localLiked === true && !((c.likes ?? []).includes(meId as string)) ? 1 : 0) -
    (localLiked === false && (c.likes ?? []).includes(meId as string) ? 1 : 0);

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
    /* Komentar TANPA kotak/latar — polos seperti feed premium:
       avatar bulat, nama + waktu, lalu pesan tanpa bubble. */
    <div className="border-0 bg-transparent px-0.5 py-1.5">
      <div className="flex items-start gap-2.5 px-2.5 pt-1">
        <Avatar src={c.image} seed={c.username} className="size-8 ring-1 ring-white/15" />
        <div className="min-w-0 flex-1 pl-2">
          <div className="flex items-center gap-1">
            <p className="truncate text-[13px] font-black">{c.username}</p>
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
      <p className="break-words px-3 pb-0.5 pl-[42px] pt-1.5 text-[14.5px] leading-relaxed text-foreground/90">
        {c.text}
      </p>
      <div className="flex items-center gap-4 px-3 pb-1 pl-[42px] pt-0.5 text-[11px] text-muted-foreground">
        {/* REPLAY dulu (kiri), baru LIKE — urutan sesuai permintaan. */}
        <button
          aria-label="Reply"
          title="Reply"
          className="flex items-center gap-1 transition hover:text-gold-strong active:scale-95"
          onClick={onReply}
        >
          <Reply className="size-3.5" />
          Reply
        </button>
        <button
          title="Suka"
          className={cn(
            "flex items-center gap-1 transition active:scale-95",
            liked && "text-rose-400",
          )}
          onClick={async () => {
            // Optimistik — hati & jumlah like berubah langsung.
            const prev = liked;
            setLocalLiked(!prev);
            try {
              await like({ commentId: c._id as never });
            } catch (e) {
              setLocalLiked(prev);
              toast.error(e instanceof Error ? e.message : "Gagal");
            }
          }}
        >
          <Heart className={cn("size-3.5 transition", liked && "fill-rose-400 text-rose-400")} />
          {likeCount}
        </button>
        {replyCount > 0 && onToggleReplies && (
          <button
            onClick={onToggleReplies}
            className="flex items-center gap-1 font-bold text-gold-strong transition hover:text-white active:scale-95"
          >
            {repliesOpen ? "Sembunyikan reply" : `Lihat ${replyCount} reply`}
          </button>
        )}
        {mine && (
          <button
            aria-label="Hapus komentar"
            title="Hapus"
            disabled={busy}
            className="ml-auto hover:text-red-400 disabled:opacity-40"
            onClick={() => void remove()}
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>
      {c.bannerUrl && (
        // Banner profil diletakkan di PALING BAWAH kartu komentar
        // (permintaan: "banner di detail itu paling ke bawah lagi"),
        // ditarik ke dalam dengan sudut membulat.
        <div
          className="mx-2 mb-2 h-8 rounded-md bg-cover bg-center opacity-70"
          style={{ backgroundImage: `url(${c.bannerUrl})` }}
        />
      )}
    </div>
  );
}
