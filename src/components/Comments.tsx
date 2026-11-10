import { useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Avatar, BlueCheck, ClanTag, LevelBadge, TitleBadge } from "@/components/lstream-ui";
import { DEFAULT_CLAN_ICON } from "@/lib/clanIcons";
import {
  Ban,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  EyeOff,
  Flag,
  Heart,
  ImagePlus,
  Loader2,
  MessageCircle,
  MoreVertical,
  Pin,
  Reply,
  Send,
  Share2,
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
  /** Disematkan developer ("Disemangatkan"). */
  pinnedAt?: number;
  /** Judul anime + nomor episode — dipakai di layar laporan. */
  animeTitle?: string;
  episode?: number;
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
  onSeek,
  bannerUrl,
}: {
  animeId: string;
  comments: CommentT[] | undefined;
  meId?: string;
  /** Banner anime di belakang kolom komentar Nonton. */
  bannerUrl?: string;
  onSend: (payload: CommentPayload, replyToId?: string) => Promise<void>;
  /** Dipanggil setelah server menghapus komentar, supaya daftar langsung bersih. */
  onDeleted?: (id: string) => void;
  onOpenImage?: (url: string) => void;
  /** Menit di komentar (mis. "14.45") → lompat ke detik itu di pemutar. */
  onSeek?: (seconds: number) => void;
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

  // Akses developer: hanya developer yang boleh "Semangatkan komentar".
  const panel = useQuery(api.moderation.myPanelAccess);
  const isDev = panel?.level === "dev";
  const pinM = useMutation(api.activities.pinComment);
  const unpinM = useMutation(api.activities.unpinComment);
  const reportM = useMutation(api.activities.reportComment);
  const blockM = useMutation(api.activities.blockUser);

  /** Sheet semangat, layar laporan, dan dialog blokir yang sedang dibuka. */
  const [pinTarget, setPinTarget] = useState<CommentT | null>(null);
  const [reportTarget, setReportTarget] = useState<CommentT | null>(null);
  const [blockTarget, setBlockTarget] = useState<CommentT | null>(null);
  /** Komentar disemangatkan yang sudah ditutup penonton (per sesi). */
  const [pinDismissed, setPinDismissed] = useState<Set<string>>(new Set());

  const jumpTo = (id: string) => {
    document
      .getElementById(`yn-comment-${id}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

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
  /** Komentar yang disemangatkan — selalu tampil paling atas. */
  const pinned = all.find((c) => c.pinnedAt);
  const roots = useMemo(
    () =>
      list
        .filter((c) => !c.replyToId || !all.some((p) => p._id === c.replyToId))
        .sort((a, b) => (b.pinnedAt ?? 0) - (a.pinnedAt ?? 0)),
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
        <div className="flex items-center gap-2">
          <MessageCircle className="size-[18px] text-white/85" strokeWidth={2.25} aria-hidden />
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
      <div className="relative mt-2.5 overflow-hidden rounded-3xl border border-[#1CA7EC]/25 bg-gradient-to-br from-white/[0.08] via-white/[0.04] to-transparent p-2.5 shadow-[0_0_24px_-16px] shadow-[#1CA7EC]">
        {bannerUrl && (
          <>
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-[0.42]"
              style={{ backgroundImage: `url(${bannerUrl})` }}
            />
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[linear-gradient(100deg,rgba(8,11,17,.86),rgba(8,11,17,.58)_52%,rgba(8,11,17,.82))]"
            />
          </>
        )}
        <div className="relative flex items-start gap-2">
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
              className="h-10 w-full rounded-full border border-white/15 bg-black/40 px-3.5 text-[13px] text-white outline-none backdrop-blur-md transition placeholder:text-white/35 focus:border-[#1CA7EC]/60 focus:bg-black/50 disabled:opacity-50"
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
                  <Loader2 className="size-[17px] animate-spin" />
                ) : (
                  <ImagePlus className="size-[17px]" strokeWidth={2.2} />
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
                <Send className="size-[17px]" strokeWidth={2.15} />
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

      {/* ---------- KOMENTAR DISEMANGATKAN ----------
          Kotak lurus (tanpa sudut membulat) tepat di bawah kolom komentar.
          Ketuk isinya → langsung melompat ke komentar tersebut. */}
      {pinned && !pinDismissed.has(pinned._id) && (
        <div className="mt-2 border-y border-[#FFD23F]/35 bg-[#FFD23F]/[0.06]">
          <div className="flex items-center gap-1.5 px-3 pt-2">
            <Pin className="size-3 shrink-0 text-[#FFD23F]" aria-hidden />
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#FFD23F]">
              Komentar Disemangatkan
            </span>
            <button
              onClick={() =>
                setPinDismissed((s) => new Set(s).add(pinned._id))
              }
              aria-label="Sembunyikan komentar disemangatkan"
              className="ml-auto flex size-5 items-center justify-center rounded-full text-white/45 transition hover:bg-white/10 hover:text-white"
            >
              <X className="size-3.5" />
            </button>
          </div>
          <button
            onClick={() => jumpTo(pinned._id)}
            className="flex w-full items-start gap-2 px-3 pb-2.5 pt-1.5 text-left"
          >
            <Avatar
              src={pinned.image}
              seed={pinned.username}
              className="mt-0.5 size-7 shrink-0 ring-1 ring-[#FFD23F]/40"
            />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-1">
                <span className="truncate text-[12px] font-black">
                  {pinned.username}
                </span>
                {pinned.premium && <BlueCheck className="size-3 shrink-0" />}
                {typeof pinned.level === "number" && (
                  <LevelBadge level={pinned.level} className="scale-90 origin-left" />
                )}
              </span>
              <span className="mt-0.5 block truncate text-[12.5px] text-white/80">
                {pinned.text || pinned.sticker || "[gambar]"}
              </span>
            </span>
          </button>
        </div>
      )}

      {/* ---------- DAFTAR KOMENTAR ---------- */}
      <div className="mt-3 space-y-2">
        {comments === undefined && (
          <div className="space-y-2.5 py-1">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-2.5 rounded-2xl border border-white/6 bg-white/[0.025] p-3">
                <div className="skeleton size-8 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="skeleton h-3 w-1/3 rounded-full" />
                  <div className="skeleton h-2.5 w-4/5 rounded-full" />
                  <div className="skeleton h-2.5 w-3/5 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        )}
        {comments && comments.length === 0 && (
          <p className="py-6 text-center text-xs text-muted-foreground">
            Belum ada komentar — jadilah yang pertama!
          </p>
        )}
        {roots.map((c) => {
          const replies = repliesOf(c._id);
          const shown = openReplies[c._id] ?? 0;
          return (
            <div key={c._id} id={`yn-comment-${c._id}`}>
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
                isDev={isDev}
                onPin={() => setPinTarget(c)}
                onUnpin={() => setPinTarget(c)}
                onReport={() => setReportTarget(c)}
                onBlock={() => setBlockTarget(c)}
                onSeek={onSeek}
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
                      isDev={isDev}
                      onPin={() => setPinTarget(r)}
                      onUnpin={() => setPinTarget(r)}
                      onReport={() => setReportTarget(r)}
                      onBlock={() => setBlockTarget(r)}
                      onSeek={onSeek}
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

      {/* ---------- SHEET SEMANGATKAN (45% LAYAR) ---------- */}
      {pinTarget && (
        <PinSheet
          c={pinTarget}
          onClose={() => setPinTarget(null)}
          onConfirm={async () => {
            try {
              if (pinTarget.pinnedAt) {
                await unpinM({ commentId: pinTarget._id as never });
                toast.success("Semangat dilepas");
              } else {
                await pinM({ commentId: pinTarget._id as never });
                setPinDismissed((s) => {
                  const next = new Set(s);
                  next.delete(pinTarget._id);
                  return next;
                });
                toast.success("Komentar disemangatkan ✨");
              }
              setPinTarget(null);
            } catch (e) {
              toast.error(
                e instanceof Error ? e.message : "Gagal menyemangatkan",
              );
            }
          }}
        />
      )}

      {/* ---------- LAYAR LAPORKAN (FULLSCREEN) ---------- */}
      {reportTarget && (
        <ReportScreen
          c={reportTarget}
          onClose={() => setReportTarget(null)}
          onDone={() => setReportTarget(null)}
          onSubmit={async ({ category, detail, hideComment, blockAuthor }) => {
            await reportM({
              commentId: reportTarget._id as never,
              category,
              detail,
              hideComment,
              blockAuthor,
            });
            if (hideComment) onDeleted?.(reportTarget._id);
          }}
        />
      )}

      {/* ---------- DIALOG BLOKIR ---------- */}
      {blockTarget && (
        <BlockDialog
          c={blockTarget}
          lastComment={[...all]
            .filter((x) => x.userId === blockTarget.userId)
            .sort((a, b) => b.createdAt - a.createdAt)[0]}
          onClose={() => setBlockTarget(null)}
          onDone={() => setBlockTarget(null)}
          onConfirm={async ({
            reason,
            reportReason,
            reportCommentId,
            hideHistory,
          }) => {
            await blockM({
              userId: blockTarget.userId as never,
              reason: reason || reportReason,
              hideHistory,
              animeTitle: blockTarget.animeTitle,
              episode: blockTarget.episode,
              evidence: blockTarget.text,
            });
            if (reportCommentId && reportReason) {
              await reportM({
                commentId: reportCommentId as never,
                category: reportReason,
                blockAuthor: true,
              });
              onDeleted?.(reportCommentId);
            }
          }}
        />
      )}
    </div>
  );
}

/**
 * Isi komentar dengan penanda waktu (mis. "14.45" atau "1:14:45").
 * Penanda waktu diberi warna biru dan bisa ditekan untuk melompat ke detik
 * tersebut di pemutar video.
 */
const TIME_TOKEN = /(?<!\d)(\d{1,2})[.:]([0-5]\d)(?::([0-5]\d))?(?!\d)/g;
function CommentText({
  text,
  onSeek,
}: {
  text: string;
  onSeek?: (seconds: number) => void;
}) {
  if (!onSeek) return <>{text}</>;
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  TIME_TOKEN.lastIndex = 0;
  while ((m = TIME_TOKEN.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const secs = m[3]
      ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])
      : Number(m[1]) * 60 + Number(m[2]);
    out.push(
      <button
        key={`ts-${i++}`}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onSeek(secs);
        }}
        className="mx-0.5 inline rounded bg-[#1CA7EC]/15 px-1 font-bold text-[#7fd3f7] underline decoration-[#1CA7EC]/50 underline-offset-2"
        title={`Lompat ke ${m[0]}`}
      >
        {m[0]}
      </button>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
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
  onSeek,
  isDev = false,
  onPin,
  onUnpin,
  onReport,
  onBlock,
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
  isDev?: boolean;
  onSeek?: (seconds: number) => void;
  onPin?: () => void;
  onUnpin?: () => void;
  onReport?: () => void;
  onBlock?: () => void;
}) {
  const del = useMutation(api.activities.deleteComment);
  /** Menu titik tiga (satu kotak berisi semua tindakan). */
  const [menuOpen, setMenuOpen] = useState(false);
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
              <LevelBadge level={c.level} className="scale-90 origin-left" />
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
        {/* Kanan atas: label "Disemangatkan" (kalau ada) lalu titik tiga. */}
        <div className="relative flex shrink-0 items-center gap-1">
          {c.pinnedAt && (
            <span className="flex items-center gap-1 rounded-full border border-[#FFD23F]/40 bg-[#FFD23F]/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-[#FFD23F]">
              <Pin className="size-2.5" aria-hidden />
              Disemangatkan
            </span>
          )}
          <button
            aria-label="Menu komentar"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className="flex size-7 items-center justify-center rounded-full text-white/45 transition hover:bg-white/10 hover:text-white"
          >
            <MoreVertical className="size-4" />
          </button>

          {menuOpen && (
            <>
              <span
                className="fixed inset-0 z-20"
                onClick={() => setMenuOpen(false)}
                aria-hidden
              />
              <div className="absolute right-0 top-8 z-30 w-56 overflow-hidden rounded-xl border border-white/12 bg-[#151a23] py-1 shadow-2xl shadow-black/60">
                {isDev && (
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      if (c.pinnedAt) onUnpin?.();
                      else onPin?.();
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] font-bold text-[#FFD23F] transition hover:bg-white/[0.06]"
                  >
                    <Pin className="size-4 shrink-0" />
                    {c.pinnedAt
                      ? "Lepas Semangatkan"
                      : "Semangatkan komentar"}
                  </button>
                )}
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    void navigator.clipboard
                      ?.writeText(c.text)
                      .then(() => toast.success("Komentar disalin"))
                      .catch(() => toast.error("Gagal menyalin komentar"));
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] font-semibold text-white/85 transition hover:bg-white/[0.06]"
                >
                  <Copy className="size-4 shrink-0 text-white/55" />
                  Copy komentar
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    const link = `${window.location.origin}${window.location.pathname}#yn-comment-${c._id}`;
                    const nav = navigator as Navigator & {
                      share?: (d: ShareData) => Promise<void>;
                    };
                    if (nav.share) {
                      void nav
                        .share({
                          title: `Komentar @${c.username}`,
                          text: c.text,
                          url: link,
                        })
                        .catch(() => undefined);
                    } else {
                      void navigator.clipboard
                        ?.writeText(link)
                        .then(() => toast.success("Tautan komentar disalin"))
                        .catch(() => toast.error("Gagal membagikan"));
                    }
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] font-semibold text-white/85 transition hover:bg-white/[0.06]"
                >
                  <Share2 className="size-4 shrink-0 text-white/55" />
                  Bagikan komentar
                </button>
                {!mine && (
                  <>
                    {/* Garis pemisah dengan opacity hanya 20%. */}
                    <div className="my-1 h-px bg-white/20" />
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        onReport?.();
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] font-semibold text-amber-300 transition hover:bg-white/[0.06]"
                    >
                      <Flag className="size-4 shrink-0" />
                      Laporkan pengguna
                    </button>
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        onBlock?.();
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] font-semibold text-[#E84855] transition hover:bg-white/[0.06]"
                    >
                      <Ban className="size-4 shrink-0" />
                      Blokir pengguna
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
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
              <CommentText text={c.text} onSeek={onSeek} />
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
        {/* Hapus komentar — tepat di kanan tombol reply, merah kuat. */}
        {mine && (
          <button
            aria-label="Hapus komentar"
            disabled={busy}
            onClick={() => void remove()}
            className="flex items-center gap-1 font-bold text-[#FF3B47] transition hover:text-[#ff6b74] active:scale-95 disabled:opacity-40"
          >
            <Trash2 className="size-4" />
            Hapus
          </button>
        )}
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

/* ==================== SHEET "SEMANGATKAN KOMENTAR" ====================
   Menutupi 45% layar dari bawah: ikon pin + judul di kiri atas, tombol X di
   paling kanan, penjelasan, kotak pratinjau komentar, lalu 2 tombol. */
function PinSheet({
  c,
  onClose,
  onConfirm,
}: {
  c: CommentT;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="fixed inset-0 z-[120] flex items-end" role="dialog" aria-modal>
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative flex h-[45vh] w-full flex-col overflow-y-auto rounded-t-3xl border-t border-[#FFD23F]/30 bg-[#12161f] px-4 pb-4 pt-3">
        <div className="flex items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#FFD23F]/15 text-[#FFD23F]">
            <Pin className="size-4" />
          </span>
          <p className="min-w-0 flex-1 truncate text-sm font-black">
            {c.pinnedAt ? "Lepas Semangatkan?" : "Semangatkan Komentar?"}
          </p>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-white/70"
          >
            <X className="size-4" />
          </button>
        </div>

        <p className="mt-2 text-[12px] leading-relaxed text-white/60">
          Komentar ini akan disematkan di bagian paling atas kolom komentar
          penggemar dan terlihat pertama kali oleh seluruh penonton.
        </p>

        {/* Kotak pratinjau — agak ke kanan dan lebih kecil. */}
        <div className="ml-4 mt-3 rounded-xl border border-white/12 bg-white/[0.04] p-2.5">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/45">
            Preview Komentar Disemangatkan
          </p>
          <p className="mt-1.5 line-clamp-3 break-words text-[12.5px] leading-relaxed text-white/85">
            {c.text || c.sticker || "[gambar]"}
          </p>
          <p className="mt-1 text-[10px] font-bold text-white/40">
            -Oleh @{c.username}
          </p>
        </div>

        <div className="mt-auto flex gap-2 pt-3">
          <button
            onClick={onClose}
            disabled={busy}
            className="flex-1 rounded-xl border border-white/15 py-2.5 text-[12px] font-black text-white/70 transition active:scale-[0.98] disabled:opacity-50"
          >
            Batal
          </button>
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
              } finally {
                setBusy(false);
              }
            }}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#FFD23F] py-2.5 text-[12px] font-black text-[#1a1200] transition active:scale-[0.98] disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Pin className="size-4" />
            )}
            {c.pinnedAt ? "Lepas" : "Semangatkan"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** 5 kategori pelanggaran pada layar laporan. */
const REPORT_CATEGORIES = [
  "Spam / promosi",
  "Ujaran kebencian",
  "Konten dewasa",
  "Spoiler tanpa peringatan",
  "Perundungan / pelecehan",
];

/** Layar laporan komentar — fullscreen, anonim. */
function ReportScreen({
  c,
  onClose,
  onDone,
  onSubmit,
}: {
  c: CommentT;
  onClose: () => void;
  onDone: () => void;
  onSubmit: (v: {
    category: string;
    detail?: string;
    hideComment?: boolean;
    blockAuthor?: boolean;
  }) => Promise<void>;
}) {
  const [category, setCategory] = useState(REPORT_CATEGORIES[0]);
  const [detail, setDetail] = useState("");
  const [hideComment, setHideComment] = useState(true);
  const [blockAuthor, setBlockAuthor] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const where = `${c.animeTitle ?? "judul ini"}${
    c.episode ? ` Episode ${c.episode}` : ""
  }`;

  return (
    <div className="fixed inset-0 z-[130] flex flex-col bg-[#0b0e14]" role="dialog" aria-modal>
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2.5">
        <button
          onClick={onClose}
          aria-label="Tutup"
          className="flex size-8 items-center justify-center rounded-full bg-white/[0.08] text-white/70"
        >
          <X className="size-4" />
        </button>
        <p className="text-sm font-black">Laporkan Komentar</p>
      </div>

      {sent ? (
        <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
            <CheckCircle2 className="size-9" />
          </span>
          <p className="mt-4 text-base font-black">Laporanmu sudah terkirim</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-white/55">
            Terima kasih atas laporanmu! Kurator akan memverifikasi komentar ini.
          </p>
          <button
            onClick={onDone}
            className="mt-5 rounded-xl bg-[#1CA7EC] px-6 py-2.5 text-[12px] font-black text-white"
          >
            Tutup
          </button>
        </div>
      ) : (
        <>
          <div className="thin-scroll min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-3">
            {/* Kutipan komentar yang dilaporkan. */}
            <div className="rounded-xl border border-white/12 bg-white/[0.04] p-2.5">
              <p className="break-words text-[13px] leading-relaxed text-white/85">
                {c.text || c.sticker || "[gambar]"}
              </p>
              <p className="mt-1.5 text-[10px] text-white/40">
                Diposting {timeAgo(c.createdAt)} di {where}
              </p>
            </div>

            <div>
              <p className="mb-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-white/45">
                Kategori Pelanggaran
              </p>
              <div className="space-y-1.5">
                {REPORT_CATEGORIES.map((r) => (
                  <button
                    key={r}
                    onClick={() => setCategory(r)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-[12.5px] font-semibold transition",
                      category === r
                        ? "border-[#1CA7EC]/60 bg-[#1CA7EC]/12 text-white"
                        : "border-white/10 bg-white/[0.03] text-white/70",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center rounded-full border",
                        category === r
                          ? "border-[#1CA7EC] bg-[#1CA7EC] text-white"
                          : "border-white/25",
                      )}
                    >
                      {category === r && <Check className="size-3" />}
                    </span>
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-white/45">
                Tindakan Lanjutan
              </p>
              <div className="space-y-1.5">
                <ActionToggle
                  icon={<EyeOff className="size-4" />}
                  label={`Sembunyikan komentar @${c.username}`}
                  on={hideComment}
                  onToggle={() => setHideComment((v) => !v)}
                />
                <ActionToggle
                  icon={<Flag className="size-4" />}
                  label="Laporkan ke kurator"
                  on
                  onToggle={() => undefined}
                />
                <ActionToggle
                  icon={<Ban className="size-4" />}
                  label={`Blokir @${c.username}`}
                  on={blockAuthor}
                  onToggle={() => setBlockAuthor((v) => !v)}
                />
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-white/45">
                Penjelasan (opsional)
              </p>
              <textarea
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                rows={3}
                maxLength={400}
                placeholder="Jelaskan kenapa komentar ini melanggar…"
                className="w-full resize-none rounded-xl border border-white/12 bg-black/30 px-3 py-2 text-[12.5px] outline-none transition focus:border-[#1CA7EC]/50"
              />
            </div>

            <div className="rounded-xl border border-white/15 bg-white/[0.04] p-2.5 text-[11px] leading-relaxed text-white/55">
              Laporan Anda bersifat anonim. Tim kurator akan memverifikasi dan
              menandai komentar dalam waktu maks 10 menit.
            </div>
          </div>

          <div className="flex gap-2 border-t border-white/10 px-3 py-2.5">
            <button
              onClick={onClose}
              disabled={busy}
              className="flex-1 rounded-xl border border-white/15 py-2.5 text-[12px] font-black text-white/70 disabled:opacity-50"
            >
              Batal
            </button>
            <button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onSubmit({
                    category,
                    detail: detail.trim() || undefined,
                    hideComment,
                    blockAuthor,
                  });
                  setSent(true);
                } catch (e) {
                  toast.error(
                    e instanceof Error ? e.message : "Gagal mengirim laporan",
                  );
                } finally {
                  setBusy(false);
                }
              }}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#E84855] py-2.5 text-[12px] font-black text-white transition active:scale-[0.98] disabled:opacity-60"
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Flag className="size-4" />
              )}
              Laporkan
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/** Baris tindakan dengan sakelar on/off di layar laporan. */
function ActionToggle({
  icon,
  label,
  on,
  onToggle,
}: {
  icon: React.ReactNode;
  label: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        "flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-[12.5px] font-semibold transition",
        on
          ? "border-[#1CA7EC]/50 bg-[#1CA7EC]/10 text-white"
          : "border-white/10 bg-white/[0.03] text-white/60",
      )}
    >
      <span className={on ? "text-[#7fd3f7]" : "text-white/45"}>{icon}</span>
      <span className="min-w-0 flex-1">{label}</span>
      <span
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full transition",
          on ? "bg-[#1CA7EC]" : "bg-white/20",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-4 rounded-full bg-white transition-all",
            on ? "left-[18px]" : "left-0.5",
          )}
        />
      </span>
    </button>
  );
}

/** 4 alasan cepat untuk melaporkan komentar terakhir saat memblokir. */
const BLOCK_REASONS = [
  "Spam / promosi",
  "Kata kasar / hinaan",
  "Spoiler tanpa tanda",
  "Tidak relevan",
];

/** Dialog blokir user: konsekuensi, laporan opsional, hapus riwayat. */
function BlockDialog({
  c,
  lastComment,
  onClose,
  onDone,
  onConfirm,
}: {
  c: CommentT;
  lastComment?: CommentT;
  onClose: () => void;
  onDone: () => void;
  onConfirm: (v: {
    reason?: string;
    reportReason?: string;
    reportCommentId?: string;
    hideHistory: boolean;
  }) => Promise<void>;
}) {
  const [reportReason, setReportReason] = useState<string | null>(null);
  const [hideHistory, setHideHistory] = useState(true);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center px-4" role="dialog" aria-modal>
      <div className="absolute inset-0 bg-black/75" onClick={onClose} />
      <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-white/12 bg-[#12161f] p-4">
        {done ? (
          <div className="flex flex-col items-center py-4 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-[#E84855]/15 text-[#ff6b74]">
              <CheckCircle2 className="size-8" />
            </span>
            <p className="mt-3 text-sm font-black">@{c.username} telah diblokir</p>
            <p className="mt-1 text-[11.5px] leading-relaxed text-white/55">
              Komentarnya tidak akan muncul lagi untukmu. Kamu bisa membuka
              blokir kapan saja di Pengaturan › Privasi.
            </p>
            <button
              onClick={onDone}
              className="mt-4 w-full rounded-xl bg-white/10 py-2.5 text-[12px] font-black text-white"
            >
              Selesai
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2.5">
              <Avatar src={c.image} seed={c.username} className="size-10 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-black">{c.username}</p>
                <p className="text-[10.5px] text-white/45">Blokir pengguna ini?</p>
              </div>
              <button
                onClick={onClose}
                aria-label="Tutup"
                className="flex size-7 items-center justify-center rounded-full bg-white/[0.08] text-white/60"
              >
                <X className="size-3.5" />
              </button>
            </div>

            <div className="mt-3 space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
              {[
                "Komentar & balasan pengguna ini tidak tampil lagi untukmu.",
                "Pengguna ini tidak bisa melihat profil, aktivitas, dan komentarmu.",
                "Kamu tidak menerima pesan atau permintaan pertemanan darinya.",
              ].map((t) => (
                <div key={t} className="flex items-start gap-2">
                  <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-[#E84855]/20 text-[#ff6b74]">
                    <Check className="size-2.5" />
                  </span>
                  <p className="text-[11.5px] leading-snug text-white/65">{t}</p>
                </div>
              ))}
            </div>

            <p className="mt-3 text-[10px] font-black uppercase tracking-[0.14em] text-white/45">
              Laporkan komentar terakhir (opsional)
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {BLOCK_REASONS.map((r) => (
                <button
                  key={r}
                  onClick={() => setReportReason(reportReason === r ? null : r)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[10.5px] font-bold transition",
                    reportReason === r
                      ? "border-amber-300/60 bg-amber-300/15 text-amber-200"
                      : "border-white/12 bg-white/[0.04] text-white/60",
                  )}
                >
                  {r}
                </button>
              ))}
            </div>

            <button
              onClick={() => setHideHistory((v) => !v)}
              className="mt-3 flex w-full items-start gap-2 text-left"
            >
              <span
                className={cn(
                  "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border",
                  hideHistory
                    ? "border-[#1CA7EC] bg-[#1CA7EC] text-white"
                    : "border-white/25",
                )}
              >
                {hideHistory && <Check className="size-2.5" />}
              </span>
              <span className="text-[11.5px] leading-snug text-white/70">
                Hapus semua riwayat interaksi dengan @{c.username}
              </span>
            </button>

            <div className="mt-4 flex gap-2">
              <button
                onClick={onClose}
                disabled={busy}
                className="flex-1 rounded-xl border border-white/15 py-2.5 text-[12px] font-black text-white/70 disabled:opacity-50"
              >
                Batal
              </button>
              <button
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await onConfirm({
                      reason: reportReason ?? undefined,
                      reportReason: reportReason ?? undefined,
                      reportCommentId: reportReason
                        ? lastComment?._id
                        : undefined,
                      hideHistory,
                    });
                    setDone(true);
                  } catch (e) {
                    toast.error(
                      e instanceof Error ? e.message : "Gagal memblokir",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#E84855] py-2.5 text-[12px] font-black text-white transition active:scale-[0.98] disabled:opacity-60"
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Ban className="size-4" />
                )}
                Blokir
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
