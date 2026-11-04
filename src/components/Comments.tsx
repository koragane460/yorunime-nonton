import { useMemo, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Avatar, BlueCheck, ClanTag, TitleBadge } from "@/components/lstream-ui";
import { DEFAULT_CLAN_ICON } from "@/lib/clanIcons";
import {
  ChevronDown,
  EyeOff,
  Heart,
  ImagePlus,
  Loader2,
  Reply,
  Send,
  Smile,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/lstream";
import { useModeration } from "@/components/ModerationGuard";
import { useAuth } from "@/hooks/use-auth";

export type CommentT = {
  _id: string;
  userId: string;
  username: string;
  image?: string;
  bannerUrl?: string;
  premium?: boolean;
  /** Tingkatan premium: basic / plus / vip. */
  premiumTier?: "basic" | "plus" | "vip";
  level?: number;
  staffRole?: string;
  clanTag?: string;
  clanTagIcon?: string;
  /** Level clan — menentukan warna nama clan di tag. */
  clanLevel?: number;
  clanNameColor?: string;
  text: string;
  sticker?: string;
  imageUrl?: string;
  spoiler?: boolean;
  likes?: string[];
  likeCount?: number;
  replyToId?: string;
  createdAt: number;
};

/** Isi komentar yang dikirim: teks, sticker, gambar, dan tanda spoiler. */
export type CommentPayload = {
  text: string;
  sticker?: string;
  imageStorageId?: string;
  spoiler?: boolean;
};

/** Label & warna tag tingkatan premium (Yoru Basic / Plus / VIP). */
const TIER_TAG: Record<
  string,
  { label: string; className: string }
> = {
  basic: {
    label: "Yoru Basic",
    className: "border-white/25 bg-white/[0.08] text-white/75",
  },
  plus: {
    label: "Yoru Plus",
    className: "border-[#1CA7EC]/55 bg-[#1CA7EC]/15 text-[#7fd3f7]",
  },
  vip: {
    label: "Yoru VIP",
    className: "border-[#FFD23F]/60 bg-[#FFD23F]/15 text-[#FFD23F]",
  },
};

/** Emoji yang bisa dipakai sebagai sticker komentar. */
const STICKERS = [
  "😂",
  "😭",
  "😍",
  "🔥",
  "👏",
  "😱",
  "🤣",
  "😎",
  "🥹",
  "💀",
  "❤️",
  "✨",
  "😴",
  "🤔",
  "👀",
  "🙏",
];

/**
 * Daftar komentar anime — gaya komentar modern:
 *  · kepala: judul + jumlah komentar di kiri, filter (Terbaru/Populer) di kanan
 *  · kolom komentar: avatar + input rounded kecil, tombol emoji, spoiler,
 *    gambar, dan kirim
 *  · kartu komentar: username + centang + level + tag premium, waktu, teks,
 *    like & reply, dan balasan yang mengalir ke bawah
 *  · sheet Reply Chat (60% layar) untuk membalas, lengkap dengan daftar
 *    balasan di dalam sheet itu sendiri.
 */
export function CommentsSection({
  animeId,
  comments,
  meId,
  onSend,
  onDeleted,
  onOpenImage,
}: {
  animeId: string;
  comments: CommentT[] | undefined;
  meId?: string;
  onSend: (payload: CommentPayload, replyToId?: string) => Promise<void>;
  /** Dipanggil setelah server menghapus komentar, supaya daftar langsung bersih. */
  onDeleted?: (id: string) => void;
  onOpenImage?: (url: string) => void;
}) {
  const { user } = useAuth();
  const [sort, setSort] = useState<"terbaru" | "populer">("terbaru");
  const [sortOpen, setSortOpen] = useState(false);
  const [text, setText] = useState("");
  const [sticker, setSticker] = useState<string | null>(null);
  const [spoiler, setSpoiler] = useState(false);
  const [stickerOpen, setStickerOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<CommentT | null>(null);
  /** Berapa reply yang sedang dibuka per komentar induk (kelipatan 5). */
  const [openReplies, setOpenReplies] = useState<Record<string, number>>({});
  /** KIRI SEDANG BERJALAN — mencegah komentar terkirim DOUBLE. */
  const [sending, setSending] = useState(false);
  /** Gambar yang sudah diunggah, menunggu dikirim bersama komentar. */
  const [image, setImage] = useState<{ id: string; preview: string } | null>(
    null,
  );
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { muted } = useModeration();
  const getUploadUrl = useMutation(api.storage.getUploadUrl);
  void animeId;

  const canSend =
    !muted && !sending && (text.trim().length > 0 || !!sticker || !!image);

  const send = async () => {
    if (muted) {
      toast.error("Kamu sedang dimute, tidak bisa komentar");
      return;
    }
    if (!canSend) return;
    setSending(true);
    try {
      await onSend(
        {
          text: text.trim(),
          sticker: sticker ?? undefined,
          imageStorageId: image?.id,
          spoiler: spoiler || undefined,
        },
        replyTo?._id,
      );
      setText("");
      setSticker(null);
      setSpoiler(false);
      setImage(null);
      setReplyTo(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal kirim");
    } finally {
      setSending(false);
    }
  };

  /** Unggah gambar dulu, baru tampil pratinjau sebelum benar-benar dikirim. */
  const pickImage = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("File harus berupa gambar");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Gambar maksimal 8 MB");
      return;
    }
    setUploading(true);
    const preview = URL.createObjectURL(file);
    try {
      const url = await getUploadUrl();
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": file.type || "image/jpeg" },
        body: file,
      });
      if (!res.ok) throw new Error("Gagal mengunggah gambar");
      const { storageId } = await res.json();
      setImage({ id: String(storageId), preview });
    } catch (e) {
      URL.revokeObjectURL(preview);
      toast.error(e instanceof Error ? e.message : "Gagal mengunggah gambar");
    } finally {
      setUploading(false);
    }
  };

  const list = [...(comments ?? [])].sort((a, b) =>
    sort === "terbaru"
      ? b.createdAt - a.createdAt
      : (b.likeCount ?? 0) - (a.likeCount ?? 0),
  );

  const all = comments ?? [];
  const roots = useMemo(
    () =>
      list.filter(
        (c) => !c.replyToId || !all.some((p) => p._id === c.replyToId),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sort, comments],
  );
  /** Semua balasan milik satu komentar induk (berjenjang). */
  const repliesOf = (id: string): CommentT[] => {
    const out: CommentT[] = [];
    const seen = new Set<string>([id]);
    let frontier = [id];
    while (frontier.length > 0) {
      const kids = all.filter(
        (r) => r.replyToId && frontier.includes(r.replyToId),
      );
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

  const replyList = replyTo ? repliesOf(replyTo._id) : [];

  return (
    <div className="px-3">
      {/* ---------- KEPALA: judul + jumlah (kiri), filter (kanan) ---------- */}
      <div className="relative flex items-center justify-between gap-2">
        <div className="flex items-baseline gap-1.5">
          <h2 className="text-base font-black tracking-tight">Komentar</h2>
          <span className="text-[11px] font-bold text-white/40">
            {(all.length ?? 0).toLocaleString("id-ID")}
          </span>
        </div>
        <button
          onClick={() => setSortOpen((v) => !v)}
          className="flex items-center gap-1 rounded-full border border-white/12 bg-white/[0.05] px-2.5 py-1 text-[11px] font-bold text-white/70 transition hover:bg-white/10"
        >
          {sort === "populer" ? "Populer" : "Terbaru"}
          <ChevronDown className="size-3.5" aria-hidden />
        </button>
        {sortOpen && (
          <>
            <span
              className="fixed inset-0 z-10"
              onClick={() => setSortOpen(false)}
              aria-hidden
            />
            <div className="absolute right-0 top-9 z-20 w-36 overflow-hidden rounded-xl border border-white/12 bg-[#141821] shadow-xl">
              {(["terbaru", "populer"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setSort(s);
                    setSortOpen(false);
                  }}
                  className={cn(
                    "block w-full px-3 py-2 text-left text-[12px] font-semibold transition",
                    sort === s
                      ? "bg-white/[0.08] text-[#7fd3f7]"
                      : "text-white/70 hover:bg-white/[0.05]",
                  )}
                >
                  {s === "terbaru" ? "Terbaru" : "Populer"}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ---------- KOLOM KOMENTAR ---------- */}
      <div className="mt-2.5 rounded-3xl border border-[#1CA7EC]/25 bg-gradient-to-br from-white/[0.08] via-white/[0.04] to-transparent p-2.5 shadow-[0_0_24px_-16px] shadow-[#1CA7EC]">
        <div className="flex items-start gap-2">
          {/* Foto profil user yang sedang menulis komentar. */}
          <Avatar
            src={user?.image}
            seed={user?.username ?? "user"}
            className="mt-0.5 size-8 shrink-0 ring-1 ring-white/15"
          />
          <div className="min-w-0 flex-1">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void send()}
              placeholder={
                muted
                  ? "Kamu sedang dimute…"
                  : replyTo
                    ? `Balas @${replyTo.username}…`
                    : "Tulis komentar…"
              }
              disabled={muted}
              className="h-10 w-full rounded-full border border-white/10 bg-black/25 px-3.5 text-[13px] outline-none transition focus:border-[#1CA7EC]/50 disabled:opacity-50"
            />

            {/* Pratinjau gambar + sticker yang akan dikirim. */}
            {(image || sticker) && (
              <div className="mt-2 flex items-center gap-2">
                {image && (
                  <div className="relative">
                    <img
                      src={image.preview}
                      alt=""
                      className="size-16 rounded-lg border border-white/15 object-cover"
                    />
                    <button
                      onClick={() => setImage(null)}
                      aria-label="Hapus gambar"
                      className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-black/80 text-white"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                )}
                {sticker && (
                  <button
                    onClick={() => setSticker(null)}
                    className="flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.06] px-2 py-1"
                  >
                    <span className="text-3xl leading-none">{sticker}</span>
                    <X className="size-3 text-white/50" />
                  </button>
                )}
              </div>
            )}

            {/* Baris alat: emoji (kiri) · spoiler (tengah) · gambar + kirim. */}
            <div className="mt-2 flex items-center gap-1.5">
              <button
                onClick={() => setStickerOpen((v) => !v)}
                aria-label="Sticker"
                className={cn(
                  "flex size-8 items-center justify-center rounded-full transition",
                  stickerOpen
                    ? "bg-[#1CA7EC]/20 text-[#7fd3f7]"
                    : "bg-white/[0.06] text-white/55 hover:text-white",
                )}
              >
                <Smile className="size-4" />
              </button>
              <button
                onClick={() => setSpoiler((v) => !v)}
                aria-pressed={spoiler}
                className={cn(
                  "flex size-8 items-center justify-center rounded-full transition",
                  spoiler
                    ? "bg-[#E84855]/25 text-[#ff9aa3]"
                    : "bg-white/[0.06] text-white/55 hover:text-white",
                )}
                aria-label="Tandai spoiler"
              >
                <EyeOff className="size-4" />
              </button>
              <span
                className={cn(
                  "text-[10px] font-bold",
                  spoiler ? "text-[#ff9aa3]" : "text-white/35",
                )}
              >
                {spoiler ? "Spoiler aktif" : "Spoiler?"}
              </span>

              <span className="flex-1" />

              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading || muted}
                aria-label="Kirim gambar"
                className="flex size-8 items-center justify-center rounded-full bg-white/[0.06] text-white/55 transition hover:text-white disabled:opacity-40"
              >
                {uploading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ImagePlus className="size-4" />
                )}
              </button>
              <button
                onClick={() => void send()}
                disabled={!canSend}
                aria-label="Kirim komentar"
                className={cn(
                  "flex size-8 items-center justify-center rounded-full transition active:scale-90",
                  canSend
                    ? "bg-[#1CA7EC] text-white"
                    : "bg-white/10 text-white/35",
                )}
              >
                <Send className="size-4" />
              </button>
            </div>

            {/* Pilihan sticker. */}
            {stickerOpen && (
              <div className="mt-2 grid grid-cols-8 gap-1 rounded-xl border border-white/10 bg-black/30 p-2">
                {STICKERS.map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setSticker(s);
                      setStickerOpen(false);
                    }}
                    className="flex h-8 items-center justify-center rounded-md text-xl transition hover:bg-white/10"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sedang membalas → penanda di bawah kolom komentar. */}
        {replyTo && (
          <div className="mt-2 flex items-center gap-1.5 rounded-full border border-[#1CA7EC]/35 bg-[#1CA7EC]/12 px-3 py-1.5">
            <Reply className="size-3.5 shrink-0 text-[#7fd3f7]" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-[#7fd3f7]">
              Balas komentar @{replyTo.username}
            </span>
            <button
              onClick={() => setReplyTo(null)}
              aria-label="Batalkan balasan"
              className="flex size-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/60"
            >
              <X className="size-3" />
            </button>
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void pickImage(f);
            e.target.value = "";
          }}
        />
      </div>

      {/* ---------- DAFTAR KOMENTAR ---------- */}
      <div className="mt-3 space-y-2">
        {comments === undefined && (
          <p className="py-6 text-center text-xs text-muted-foreground">
            Memuat…
          </p>
        )}
        {comments && comments.length === 0 && (
          <p className="py-6 text-center text-xs text-muted-foreground">
            Belum ada komentar — jadilah yang pertama!
          </p>
        )}
        {list.map((c) => {
          if (roots.length > 0 && !roots.some((r) => r._id === c._id))
            return null;
          const replies = repliesOf(c._id);
          const shown = openReplies[c._id] ?? 0;
          return (
            <div key={c._id}>
              <CommentCard
                c={c}
                meId={meId}
                onDeleted={onDeleted}
                onReply={() => setReplyTo(c)}
                replyCount={replies.length}
                repliesOpen={shown > 0}
                onToggleReplies={() =>
                  setOpenReplies((s) => ({
                    ...s,
                    [c._id]:
                      (s[c._id] ?? 0) > 0
                        ? 0
                        : Math.min(5, replies.length),
                  }))
                }
                onOpenImage={onOpenImage}
              />

              {/* Balasan — menjorok ke kanan, mengalir ke bawah. */}
              {shown > 0 && (
                <div className="ml-6 mt-1.5 space-y-1.5 border-l border-white/10 pl-2.5">
                  {replies.slice(0, shown).map((r) => (
                    <CommentCard
                      key={r._id}
                      c={r}
                      meId={meId}
                      onDeleted={onDeleted}
                      onReply={() => setReplyTo(c)}
                      isReply
                      onOpenImage={onOpenImage}
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
                      className="flex items-center gap-1 pl-1 text-[11px] font-bold text-[#7fd3f7]"
                    >
                      <ChevronDown className="size-3.5" aria-hidden />
                      Lihat {replies.length - shown} balasan lagi
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
}

/** Satu kartu komentar (dipakai untuk induk maupun balasan). */
function CommentCard({
  c,
  meId,
  onReply,
  onDeleted,
  replyCount = 0,
  repliesOpen = false,
  onToggleReplies,
  isReply = false,
  onOpenImage,
}: {
  c: CommentT;
  meId?: string;
  onReply: () => void;
  onDeleted?: (id: string) => void;
  replyCount?: number;
  repliesOpen?: boolean;
  onToggleReplies?: () => void;
  isReply?: boolean;
  onOpenImage?: (url: string) => void;
}) {
  const del = useMutation(api.activities.deleteComment);
  const like = useMutation(api.activities.toggleCommentLike);
  const [busy, setBusy] = useState(false);
  const [localLiked, setLocalLiked] = useState<boolean | null>(null);
  const [revealed, setRevealed] = useState(false);
  const mine = c.userId === meId;
  const liked = localLiked ?? (c.likes ?? []).includes(meId as string);
  const likeCount =
    (c.likeCount ?? (c.likes ?? []).length) +
    (localLiked === true && !(c.likes ?? []).includes(meId as string) ? 1 : 0) -
    (localLiked === false && (c.likes ?? []).includes(meId as string) ? 1 : 0);
  const tier = c.premiumTier && c.premium ? TIER_TAG[c.premiumTier] : null;
  const hidden = !!c.spoiler && !revealed;

  const remove = async () => {
    if (busy) return;
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
    <div
      className={cn(
        "rounded-2xl border border-white/10 bg-white/[0.035] p-2.5",
        isReply && "bg-white/[0.02]",
      )}
    >
      {/* Kepala: avatar · username + centang + level + tag premium · waktu */}
      <div className="flex items-start gap-2">
        <Avatar
          src={c.image}
          seed={c.username}
          className={cn(isReply ? "size-7" : "size-8", "ring-1 ring-white/10")}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1">
            <span className="truncate text-[12.5px] font-black">
              {c.username}
            </span>
            {c.premium && <BlueCheck className="size-3.5 shrink-0" />}
            {typeof c.level === "number" && (
              <span className="rounded-full border border-white/20 bg-white/[0.06] px-1.5 py-px text-[9px] font-bold text-white/70">
                Lv.{c.level}
              </span>
            )}
            <TitleBadge role={c.staffRole} compact />
            {tier && (
              <span
                className={cn(
                  "rounded-full border px-1.5 py-px text-[9px] font-black uppercase tracking-wide",
                  tier.className,
                )}
              >
                {tier.label}
              </span>
            )}
            {c.clanTag && (
              <ClanTag
                icon={c.clanTagIcon ?? DEFAULT_CLAN_ICON}
                tag={c.clanTag}
                level={c.clanLevel}
                className="scale-90 px-1.5 py-0 text-[9px]"
              />
            )}
          </div>
          <p className="mt-0.5 text-[10px] text-white/35">
            {timeAgo(c.createdAt)}
          </p>
        </div>
        {mine && (
          <button
            aria-label="Hapus komentar"
            disabled={busy}
            onClick={() => void remove()}
            className="shrink-0 text-white/30 transition hover:text-[#E84855] disabled:opacity-40"
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>

      {/* Isi komentar — disembunyikan kalau ditandai spoiler. */}
      <div className="mt-2 pl-10">
        {c.text && (
          <div className="relative">
            <p
              className={cn(
                "break-words text-[13.5px] leading-relaxed text-white/85 transition",
                hidden && "select-none blur-[5px]",
              )}
            >
              {c.text}
            </p>
            {hidden && (
              <button
                onClick={() => setRevealed(true)}
                className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/25 text-[11px] font-black text-[#ff9aa3]"
              >
                <EyeOff className="mr-1 size-3.5" /> Ketuk untuk lihat spoiler
              </button>
            )}
          </div>
        )}
        {c.imageUrl && (
          <img
            src={c.imageUrl}
            alt=""
            onClick={() => onOpenImage?.(c.imageUrl ?? "")}
            className={cn(
              "mt-1.5 max-h-56 cursor-zoom-in rounded-xl border border-white/10 object-contain",
              hidden && "blur-md",
            )}
          />
        )}
        {c.sticker && (
          <span
            className={cn(
              "mt-1 block select-none text-[44px] leading-none",
              hidden && "blur-[5px]",
            )}
          >
            {c.sticker}
          </span>
        )}
      </div>

      {/* Aksi: love + jumlah · reply + jumlah · lihat balasan. */}
      <div className="mt-2 flex items-center gap-4 pl-10 text-[11px] font-semibold text-white/45">
        <button
          aria-label="Suka"
          className={cn(
            "flex items-center gap-1 transition active:scale-95",
            liked && "text-[#E84855]",
          )}
          onClick={async () => {
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
          <Heart
            className={cn(
              "size-4 transition",
              liked && "fill-[#E84855] text-[#E84855]",
            )}
          />
          {likeCount}
        </button>
        <button
          aria-label="Reply"
          onClick={onReply}
          className="flex items-center gap-1 transition hover:text-[#7fd3f7] active:scale-95"
        >
          <Reply className="size-4" />
          {replyCount > 0 ? replyCount : ""}
        </button>
        {replyCount > 0 && onToggleReplies && (
          <button
            onClick={onToggleReplies}
            className="ml-auto flex items-center gap-1 font-bold text-[#7fd3f7]"
          >
            {repliesOpen ? "Sembunyikan" : `Lihat ${replyCount} balasan`}
            <ChevronDown
              className={cn(
                "size-3.5 transition-transform",
                repliesOpen && "rotate-180",
              )}
            />
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Sheet balas komentar — TIDAK DIPAKAI LAGI. Membalas sekarang dilakukan
 * langsung di kolom komentar (penanda "Balas komentar @user" di bawahnya),
 * jadi balasan tetap terlihat tanpa menutupi separuh layar.
 */
function ReplySheet({
  target,
  replies,
  muted,
  sending,
  text,
  sticker,
  spoiler,
  image,
  canSend,
  uploading,
  onText,
  onSticker,
  onSpoiler,
  onPickImage,
  onRemoveImage,
  onSend,
  onClose,
  onOpenImage,
}: {
  target: CommentT;
  replies: CommentT[];
  muted: boolean;
  sending: boolean;
  text: string;
  sticker: string | null;
  spoiler: boolean;
  image: { id: string; preview: string } | null;
  canSend: boolean;
  uploading: boolean;
  onText: (v: string) => void;
  onSticker: (v: string | null) => void;
  onSpoiler: () => void;
  onPickImage: () => void;
  onRemoveImage: () => void;
  onSend: () => void;
  onClose: () => void;
  onOpenImage?: (url: string) => void;
}) {
  const [stickerOpen, setStickerOpen] = useState(false);
  return (
    <div
      className="fixed inset-0 z-[70] flex items-end"
      role="dialog"
      aria-modal
    >
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div className="pop-enter relative flex h-[60vh] w-full flex-col overflow-hidden rounded-t-3xl border-t border-white/15 bg-[#141821]">
        {/* Kepala sheet: Reply Chat · jumlah · X */}
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
          <p className="text-sm font-black">Reply Chat</p>
          <span className="rounded-full bg-white/[0.08] px-2 py-0.5 text-[10px] font-bold text-white/60">
            {replies.length}
          </span>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="ml-auto flex size-8 items-center justify-center rounded-full bg-white/[0.08]"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Komentar yang dibalas + balasan yang sudah ada. */}
        <div className="thin-scroll min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3">
          <div className="rounded-2xl border border-white/12 bg-white/[0.06] p-2.5">
            <div className="flex items-center gap-2">
              <Avatar
                src={target.image}
                seed={target.username}
                className="size-7"
              />
              <span className="truncate text-[12px] font-black">
                {target.username}
              </span>
              {target.premium && <BlueCheck className="size-3.5" />}
              <span className="ml-auto text-[10px] text-white/40">
                {timeAgo(target.createdAt)}
              </span>
            </div>
            <p className="mt-1.5 break-words text-[13px] leading-relaxed text-white/85">
              {target.text}
            </p>
          </div>

          {replies.length > 0 && (
            <div className="space-y-1.5 border-l border-white/10 pl-2.5">
              {replies.map((r) => (
                <div
                  key={r._id}
                  className="rounded-xl border border-white/10 bg-white/[0.03] p-2"
                >
                  <div className="flex items-center gap-1.5">
                    <Avatar
                      src={r.image}
                      seed={r.username}
                      className="size-5"
                    />
                    <span className="truncate text-[11px] font-bold">
                      {r.username}
                    </span>
                    {r.premium && <BlueCheck className="size-3" />}
                    <span className="ml-auto text-[9px] text-white/35">
                      {timeAgo(r.createdAt)}
                    </span>
                  </div>
                  {r.text && (
                    <p className="mt-1 break-words text-[12.5px] leading-snug text-white/80">
                      {r.text}
                    </p>
                  )}
                  {r.imageUrl && (
                    <img
                      src={r.imageUrl}
                      alt=""
                      onClick={() => onOpenImage?.(r.imageUrl ?? "")}
                      className="mt-1 max-h-40 rounded-lg border border-white/10 object-contain"
                    />
                  )}
                  {r.sticker && (
                    <span className="text-2xl leading-none">{r.sticker}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Kolom balasan + alat. */}
        <div className="border-t border-white/10 px-3 py-2.5">
          <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold text-[#7fd3f7]">
            <Reply className="size-3" />
            Membalas @{target.username}
          </div>
          {stickerOpen && (
            <div className="mb-2 grid grid-cols-8 gap-1 rounded-xl border border-white/10 bg-black/30 p-2">
              {STICKERS.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    onSticker(s);
                    setStickerOpen(false);
                  }}
                  className="flex h-8 items-center justify-center rounded-md text-xl transition hover:bg-white/10"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          {(image || sticker) && (
            <div className="mb-1.5 flex items-center gap-2">
              {image && (
                <div className="relative">
                  <img
                    src={image.preview}
                    alt=""
                    className="size-12 rounded-lg border border-white/15 object-cover"
                  />
                  <button
                    onClick={onRemoveImage}
                    aria-label="Hapus gambar"
                    className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-black/80 text-white"
                  >
                    <X className="size-2.5" />
                  </button>
                </div>
              )}
              {sticker && (
                <button
                  onClick={() => onSticker(null)}
                  className="flex items-center gap-1 rounded-lg border border-white/12 bg-white/[0.06] px-2 py-1"
                >
                  <span className="text-xl leading-none">{sticker}</span>
                  <X className="size-3 text-white/50" />
                </button>
              )}
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setStickerOpen((v) => !v)}
              aria-label="Sticker"
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full transition",
                stickerOpen
                  ? "bg-[#1CA7EC]/20 text-[#7fd3f7]"
                  : "bg-white/[0.06] text-white/60",
              )}
            >
              <Smile className="size-4" />
            </button>
            <button
              onClick={onPickImage}
              disabled={uploading || muted}
              aria-label="Lampirkan gambar"
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-white/60 disabled:opacity-40"
            >
              {uploading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ImagePlus className="size-4" />
              )}
            </button>
            <input
              value={text}
              autoFocus
              onChange={(e) => onText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !sending) onSend();
              }}
              placeholder={
                muted ? "Kamu sedang dimute…" : `Balas @${target.username}…`
              }
              disabled={muted || sending}
              className="h-10 min-w-0 flex-1 rounded-full border border-white/12 bg-black/30 px-3.5 text-[13px] outline-none focus:border-[#1CA7EC]/50 disabled:opacity-50"
            />
            <button
              onClick={onSpoiler}
              aria-pressed={spoiler}
              aria-label="Tandai spoiler"
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full transition",
                spoiler
                  ? "bg-[#E84855]/25 text-[#ff9aa3]"
                  : "bg-white/[0.06] text-white/55",
              )}
            >
              <EyeOff className="size-4" />
            </button>
            <button
              onClick={onSend}
              disabled={!canSend}
              aria-label="Kirim balasan"
              className={cn(
                "flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-[11px] font-black transition active:scale-95",
                canSend
                  ? "bg-[#1CA7EC] text-white"
                  : "bg-white/10 text-white/35",
              )}
            >
              <Send className="size-3.5" /> Kirim
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
