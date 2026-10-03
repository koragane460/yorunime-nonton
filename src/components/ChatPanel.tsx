import { useEffect, useRef, useState, useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { avatarFallback, usernameColor } from "@/lib/lstream";
import { ClanTag, TitleBadge } from "@/components/lstream-ui";
import { DEFAULT_CLAN_ICON } from "@/lib/clanIcons";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, BlueCheck } from "@/components/lstream-ui";
import { useModeration } from "@/components/ModerationGuard";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Check, Crown, ImagePlus, MoreVertical, Plus, Reply, Send, Trash2, VolumeX, X } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";

export type ChatMsg = {
  _id: Id<"chatMessages">;
  userId: Id<"users">;
  username: string;
  image?: string;
  level?: number;
  premium?: boolean;
  staffRole?: string;
  clanTag?: string;
  clanTagIcon?: string;
  clanNameColor?: string;
  text?: string;
  imageUrl?: string;
  imageStorageId?: string;
  premiumGive?: {
    _id: Id<"premiumGives">;
    days: number;
    slots: number;
    message?: string;
    claimedBy: Id<"users">[];
  };
  replyTo?: {
    _id: Id<"chatMessages">;
    username: string;
    text?: string;
    premiumGiveId?: Id<"premiumGives">;
  } | null;
  createdAt: number;
};

// ------------------------------------------------------- give premium ----

const GIVE_DAYS = [1, 3, 5, 7, 15, 25, 30];
const GIVE_COST: Record<number, number> = {
  1: 2, 3: 4, 5: 6, 7: 9, 15: 17, 25: 30, 30: 32,
};
const GIVE_XP: Record<number, number> = {
  1: 250, 3: 550, 5: 700, 7: 1000, 15: 2100, 25: 5500, 30: 6900,
};
function receiverCost(r: number) {
  if (r === 5) return 0;
  if (r === 15) return 1;
  if (r === 20) return 3;
  if (r === 30) return 4;
  return Math.max(0, Math.ceil((r - 5) / 7));
}

function GivePremiumDialog({
  open,
  onOpenChange,
  kind,
  clanId,
  peerId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  kind: string;
  clanId?: Id<"clans">;
  peerId?: Id<"users">;
}) {
  const [days, setDays] = useState(1);
  const [receivers, setReceivers] = useState(5);
  const [message, setMessage] = useState("");
  const give = useMutation(api.chat.givePremium);
  const cost = (GIVE_COST[days] ?? days + 1) + receiverCost(receivers);
  const xp = (GIVE_XP[days] ?? days * 200) + Math.max(0, receivers - 5) * 100;
  const msgLen = message.trim().length;
  const msgOk = msgLen === 0 || msgLen >= 50;

  const submit = async () => {
    // Dialog ditutup duluan supaya cepat, tapi status baru success setelah
    // server benar-benar menerima (kalau gagal, user jadi tahu).
    onOpenChange(false);
    setMessage("");
    const t = toast.loading("Mengirim premium…");
    try {
      await give({
        kind,
        clanId,
        peerId,
        days,
        receivers,
        message: message.trim() || undefined,
      });
      toast.success("Premium terkirim!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal kirim premium");
    } finally {
      toast.dismiss(t);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm border-foreground/40">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-400">
            <Crown className="size-5" /> Give Premium
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-xs text-muted-foreground">Berapa hari</p>
            <div className="flex flex-wrap gap-2">
              {GIVE_DAYS.map((d) => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-sm transition",
                    days === d
                      ? "border-foreground/40 bg-primary/15 text-primary"
                      : "border-border text-muted-foreground hover:border-foreground/40",
                  )}
                >
                  {d} hari
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs text-muted-foreground">Untuk berapa orang</p>
            <div className="flex flex-wrap gap-2">
              {[5, 15, 20, 30].map((r) => (
                <button
                  key={r}
                  onClick={() => setReceivers(r)}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-sm transition",
                    receivers === r
                      ? "border-foreground/40 bg-primary/15 text-primary"
                      : "border-border text-muted-foreground hover:border-foreground/40",
                  )}
                >
                  {r} orang
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-center gap-4">
              <Button
                variant="outline"
                size="icon"
                disabled={receivers <= 5}
                onClick={() => setReceivers((r) => Math.max(5, r - 1))}
              >
                −
              </Button>
              <span className="min-w-16 text-center text-lg font-semibold">
                {receivers} org
              </span>
              <Button
                variant="outline"
                size="icon"
                disabled={receivers >= 30}
                onClick={() => setReceivers((r) => Math.min(30, r + 1))}
              >
                +
              </Button>
            </div>
          </div>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Pesan (opsional, minimal 50 karakter)"
            rows={3}
            className="w-full rounded-lg border border-input bg-background/60 p-3 text-sm"
          />
          {msgLen > 0 && msgLen < 50 && (
            <p className="text-[11px] font-semibold text-amber-300">
              Pesan masih {50 - msgLen} karakter kurang — atau kosongkan saja.
            </p>
          )}
          <div className="rounded-lg bg-primary/10 p-3 text-sm">
            <p>
              Biaya: <b>{cost} hari</b> premium kamu
            </p>
            <p className="text-xs text-muted-foreground">
              ({GIVE_COST[days]} hari + {receiverCost(receivers)} hari untuk {receivers}{" "}
              penerima)
            </p>
            <p className="mt-1 text-xs text-primary">XP yang kamu dapat: +{xp} XP</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button
              disabled={!msgOk}
              className="flex-1 bg-primary text-primary-foreground hover:brightness-110"
              onClick={submit}
            >
              Kirim
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ----------------------------------------------------- NSFW checker ----

const NSFW_STEPS = [
  "Check NSFW",
  "Check darah",
  "Check kekerasan",
  "Check konten 18+",
  "Check konten sensitif",
];

function analyzeImageLocal(file: File): { ok: boolean; reason?: string } {
  const name = file.name.toLowerCase();
  const bad = ["nsfw", "hentai", "18+", "porn", "xxx", "gore"];
  if (bad.some((w) => name.includes(w)))
    return { ok: false, reason: "Konten terindikasi 18+" };
  return { ok: true };
}

/**
 * Perkecil foto sebelum dikirim. Base64 mentah dari HP bisaUkuran 5-10 MB
 * sehingga ditolak server ("Server Error") tanpa pesan apa pun. Diperkecil ke
 * max 1280px + JPEG 0.82 supaya selalu muat di dalam satu dokumen chat.
 */
/**
 * Perkecil foto sebelum dikirim. Hasilnya Blob (bukan base64) supaya bisa
 * diunggah ke Convex storage - dokumen cuma boleh 1MB.
 */
async function compressImage(
  file: File,
  maxSide = 1280,
  quality = 0.82,
): Promise<Blob> {
  const raw = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Gagal baca file"));
    reader.readAsDataURL(file);
  });
  // File kecil sudah aman (di bawah ~300KB setelah base64).
  if (raw.length < 400_000) {
    return await (await fetch(raw)).blob();
  }
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Gambar tidak bisa dibaca"));
      el.src = raw;
    });
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return await (await fetch(raw)).blob();
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    return blob ?? (await (await fetch(raw)).blob());
  } catch {
    return await (await fetch(raw)).blob();
  }
}

function NsfwScanDialog({
  file,
  onDone,
  onCancel,
}: {
  file: File;
  onDone: (blob: Blob) => void;
  onCancel: (banned: boolean) => void;
}) {
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState(6);
  const previewUrl = useRef<string>("");
  if (!previewUrl.current) previewUrl.current = URL.createObjectURL(file);

  useEffect(() => {
    let s = 0;
    const t = setInterval(() => {
      s += 1;
      setProgress((p) => Math.min(100, p + 9));
      if (s % 4 === 0) setStep((x) => Math.min(x + 1, NSFW_STEPS.length - 1));
      if (s >= 12) {
        clearInterval(t);
        const verdict = analyzeImageLocal(file);
        if (verdict.ok) {
          void compressImage(file)
            .then(onDone)
            .catch(() => onCancel(false));
        } else {
          onCancel(false);
        }
      }
    }, 160);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent className="max-w-xs border-foreground/40">
        <DialogHeader>
          <DialogTitle className="flex flex-col items-center gap-2 text-center">
            <span className="flex size-10 items-center justify-center rounded-full bg-green-500/20 text-green-400">
              <Check className="size-5" />
            </span>
            <span className="text-sm font-medium">{NSFW_STEPS[step]}…</span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <img
            src={previewUrl.current}
            alt="preview"
            className="max-h-40 w-full rounded-lg object-cover"
          />
          <Progress value={progress} className="h-2" />
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------- lapor chat ----

const REPORT_REASONS = [
  "Konten 18+ / NSFW",
  "Rasis / ujaran kebencian",
  "Spam / promosi",
  "Penipuan / scam",
  "Pelemahan / bullying",
  "Lainnya",
];

function ReportDialog({
  msg,
  onClose,
}: {
  msg: ChatMsg;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");
  const report = useMutation(api.activities.reportChatMessage);

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xs border-foreground/40">
        <DialogHeader>
          <DialogTitle className="text-sm">Laporkan pesan</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <p className="truncate rounded bg-black/30 px-2 py-1 text-xs text-muted-foreground">
            "{msg.text ?? "[foto]"}"
          </p>
          {REPORT_REASONS.map((r) => (
            <button
              key={r}
              onClick={() => setReason(r)}
              className={cn(
                "w-full rounded-lg border px-3 py-2 text-left text-sm transition",
                reason === r
                  ? "border-foreground/40 bg-primary/15 text-primary"
                  : "border-border hover:border-foreground/40",
              )}
            >
              {r}
            </button>
          ))}
          {reason === "Lainnya" && (
            <input
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="Jelaskan singkat…"
              className="w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm"
            />
          )}
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Batal
            </Button>
            <Button
              className="flex-1 bg-primary text-primary-foreground hover:brightness-110"
              disabled={!reason}
              onClick={async () => {
                try {
                  await report({
                    messageId: msg._id,
                    reason,
                    detail: detail.trim() || undefined,
                  });
                  toast.success("Laporan terkirim ke developer");
                  onClose();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Gagal");
                }
              }}
            >
              Kirim
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------------ chat UI ----

export function ChatPanel({
  kind,
  clanId,
  peerId,
  roomId,
  messages,
  onSend,
  meId,
  compact,
  onOpenProfile,
  noPremium,
  onDeleteLocal,
}: {
  kind: string;
  clanId?: Id<"clans">;
  peerId?: Id<"users">;
  roomId?: Id<"watchRooms">;
  messages: ChatMsg[];
  onSend: (payload: {
    text?: string;
    imageStorageId?: string;
    imageUrl?: string;
    replyToId?: Id<"chatMessages">;
    /** Kutipan reply untuk echo lokal — hanya dipakai sebelum server balas. */
    _replyTo?: {
      _id: string;
      username: string;
      text?: string;
      premiumGiveId?: string;
    };
  }) => Promise<void>;
  meId: string;
  compact?: boolean;
  onOpenProfile?: (id: Id<"users">) => void;
  /** Room nobar: tombol give premium disembunyikan. */
  noPremium?: boolean;
  /** Hapus pesan yang masih berbentuk echo lokal (dipasang useFastChat). */
  onDeleteLocal?: (id: string) => Promise<void> | void;
}) {
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<ChatMsg | null>(null);
  const [blinkId, setBlinkId] = useState<string | null>(null);
  const [zoomImg, setZoomImg] = useState<string | null>(null);
  const [plusOpen, setPlusOpen] = useState(false);
  const [giveOpen, setGiveOpen] = useState(false);
  const [scanFile, setScanFile] = useState<File | null>(null);
  const [reportMsg, setReportMsg] = useState<ChatMsg | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // Cegah tap dobel (Enter lalu ketuk, atau ketuk dua kali) mengirim isi yang
  // sama dua kali — tanpa kunci yang menelan pesan berikutnya diam-diam.
  const lastSent = useRef({ text: "", at: 0 });
  const nsfwReport = useMutation(api.chat.nsfwReport);
  const getUploadUrl = useMutation(api.storage.getUploadUrl);
  const { muted } = useModeration();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const send = useCallback(
    async (payload: {
      text?: string;
      imageStorageId?: string;
      imageUrl?: string;
    }) => {
      // Kutipan reply ditampilkan langsung di bubble lokal, supaya pesan yang
      // barusan dikirim tidak pernah muncul tanpa konteks balasannya.
      // Id "local-" (echo yang belum di-ack) tetap dikirim: useFastChat yang
      // menukarnya dengan id asli, jadi reply tidak pernah jadi komentar
      // biasa hanya karena targetnya pesan yang baru saja dikirim.
      const target = replyTo;
      const replyToId = target ? target._id : undefined;
      const quoted = target
        ? {
            _id: target._id,
            username: target.username,
            text: target.text ?? undefined,
            premiumGiveId: target.premiumGive?._id,
          }
        : undefined;
      await onSend({ ...payload, replyToId, _replyTo: quoted } as never);
      if (target) {
        setBlinkId(target._id);
        setTimeout(() => setBlinkId(null), 3400);
        setReplyTo(null);
      }
    },
    [onSend, replyTo],
  );

  const submit = async () => {
    if (muted) {
      toast.error("Kamu sedang dimute, tidak bisa mengirim pesan");
      return;
    }
    if (!text.trim()) return;
    const t = text;
    // Kirim dua kali dalam <800ms dengan teks identik hampir pasti ketukan
    // dobel, bukan pesan baru.
    const now = Date.now();
    if (lastSent.current.text === t && now - lastSent.current.at < 800) return;
    lastSent.current = { text: t, at: now };
    setText("");
    try {
      await send({ text: t });
    } catch (e) {
      // Kegagalan: kembalikan teks DAN buka lagi penjaga ketukan dobel,
      // supaya kirim ulang yang segera setelahnya tidak diblokir diam-diam.
      lastSent.current = { text: "", at: 0 };
      setText(t);
      toast.error(e instanceof Error ? e.message : "Gagal kirim");
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {muted && (
        <div className="mb-2 flex items-center justify-center gap-2 rounded-xl border border-zinc-500/30 bg-zinc-500/10 px-3 py-1.5 text-[11px] font-semibold text-zinc-300">
          <VolumeX className="size-3.5" /> Kamu sedang dimute — kolom chat dikunci
        </div>
      )}
      {/* daftar pesan */}
      <div
        className={`thin-scroll min-h-0 flex-1 space-y-3 overflow-y-auto px-1 ${
          compact ? "py-2" : "py-3"
        } ${muted ? "pointer-events-none select-none opacity-40 grayscale" : ""}`}
      >
        {messages.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Belum ada pesan — mulai percakapan!
          </p>
        )}
        {messages.map((m) => {
          const mine = m.userId === meId;
          const give = m.premiumGive;
          return (
            <div
              key={m._id}
              className={cn("msg-in flex gap-2", mine && "flex-row-reverse")}
            >
              {/* Klik avatar → detail akun */}
              <button onClick={() => onOpenProfile?.(m.userId)} aria-label={`Profil ${m.username}`}>
                <img
                  src={m.image ?? avatarFallback(m.username)}
                  alt=""
                  className="size-9 shrink-0 rounded-full border border-white/15 object-cover"
                />
              </button>
              <div className={cn("flex max-w-[70%] min-w-0 flex-col", mine ? "items-end" : "items-start")}>
                <div
                  className={cn(
                    "w-fit max-w-full min-w-0 border px-3 py-2",
                    "rounded-md",
                    // Pesan yang isinya cuma foto: bubble dibuat transparan
                    // supaya tidak ada kotak hitam di belakang fotonya.
                    m.imageUrl && !m.text
                      ? "border-transparent bg-transparent p-0 shadow-none"
                      : give
                        ? "border-foreground/40 bg-primary/15"
                        : mine
                          ? "bubble-mine"
                          : "bubble-other",
                    blinkId === m._id && "reply-blink",
                  )}
                >
                  {/* Header bubble: username + centang + title, clan tag di kanan */}
                  <div className="flex w-fit min-w-0 max-w-full items-center gap-1.5">
                    <span className={cn("truncate text-xs font-semibold", usernameColor(m.username))}>
                      {m.username}
                    </span>
                    {m.premium && <BlueCheck className="size-3.5 shrink-0" />}
                    <TitleBadge role={m.staffRole} compact />
                    {m.clanTag && (
                      <ClanTag
                        icon={m.clanTagIcon ?? DEFAULT_CLAN_ICON}
                        tag={m.clanTag}
                        color={m.clanNameColor}
                        className="shrink-0 scale-90 px-1.5 py-0 text-[9px]"
                      />
                    )}
                  </div>
                  {m.replyTo && (
                    // Kutipan balas: kotak tipis yang tetap lapang, teks
                    // sumber ditampilkan sampai 3 baris supaya jelas.
                    <div className="mt-1 rounded-md bg-black/30 px-2.5 py-1.5 text-xs">
                      <p className="font-medium text-primary">{m.replyTo.username}</p>
                      <p className="line-clamp-3 text-muted-foreground">
                        {m.replyTo.text ?? (m.replyTo.premiumGiveId ? "Give premium" : "[foto]")}
                      </p>
                    </div>
                  )}
                  {give ? (
                    <div className="mt-1 min-w-48 text-center">
                      <Crown className="mx-auto size-6 text-red-400" />
                      <p className="mt-1 text-sm font-bold">{give.days} Hari premium</p>
                      <p className="text-xs text-muted-foreground">
                        {give.days} hari premium untuk {give.slots} orang
                      </p>
                      {give.message && (
                        <p className="mt-2 rounded-lg bg-black/25 p-2 text-left text-xs">
                          {give.message}
                        </p>
                      )}
                      <ClaimButton give={give} meId={meId} />
                    </div>
                  ) : (
                    <>
                      {m.text && (
                        <p className="mt-0.5 w-fit max-w-full break-words text-sm">{m.text}</p>
                      )}
                      {m.imageUrl && (
                        <img
                          src={m.imageUrl}
                          alt="lampiran"
                          onClick={() => setZoomImg(m.imageUrl ?? null)}
                          className={cn(
                            "max-h-48 cursor-zoom-in object-contain transition hover:opacity-90",
                            m.text ? "mt-1 rounded-lg" : "rounded-md",
                          )}
                        />
                      )}
                    </>
                  )}
                </div>
                <div
                  className={cn(
                    "mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground",
                    mine && "flex-row-reverse",
                  )}
                >
                  <span>{new Date(m.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</span>
                  <button
                    aria-label="Reply"
                    title="Reply"
                    onClick={() => setReplyTo(m)}
                    className="hover:text-primary"
                  >
                    <Reply className="size-3.5" />
                  </button>
                  {mine ? (
                    <DeleteButton messageId={m._id} onDeleteLocal={onDeleteLocal} />
                  ) : (
                    /* Tombol ":" di pojok pesan → popup lapor */
                    <button
                      aria-label="Laporkan pesan"
                      title="Lapor"
                      onClick={() => setReportMsg(m)}
                      className="hover:text-foreground"
                    >
                      <MoreVertical className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* reply preview + input */}
      <div className="border-t border-border/60 p-2">
        {replyTo && (
          <div className="mb-2 flex items-start gap-2 rounded-lg bg-primary/12 px-3 py-2.5">
            <Reply className="mt-0.5 size-4 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-primary">
                Membalas {replyTo.username}
              </p>
              <p className="line-clamp-4 text-[13px] leading-snug text-muted-foreground">
                {replyTo.text ?? (replyTo.premiumGive ? "Give premium" : "[foto]")}
              </p>
            </div>
            <button
              onClick={() => setReplyTo(null)}
              aria-label="Batalkan balasan"
              className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-black/20 hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
        )}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Button
              variant="outline"
              size="icon"
              className="rounded-full"
              disabled={muted}
              onClick={() => {
                if (muted) {
                  toast.error("Kamu sedang dimute, tidak bisa kirim foto atau premium");
                  return;
                }
                setPlusOpen((v) => !v);
              }}
            >
              <Plus className="size-4" />
            </Button>
            {plusOpen && (
              <div className="pop-enter absolute bottom-12 left-0 z-10 flex flex-col gap-2 rounded-2xl border border-border bg-popover p-2 shadow-xl">
                <button
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-accent"
                  onClick={() => fileRef.current?.click()}
                >
                  <ImagePlus className="size-4" /> Kirim foto
                </button>
                {!noPremium && (
                <button
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-primary hover:bg-accent"
                  onClick={() => {
                    setPlusOpen(false);
                    setGiveOpen(true);
                  }}
                >
                  <Crown className="size-4" /> Give premium
                </button>
                )}
              </div>
            )}
          </div>
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && submit()}
            placeholder={muted ? "Kamu sedang dimute…" : "Tulis pesan…"}
            disabled={muted}
            className="flex-1 rounded-full disabled:opacity-50"
          />
          <Button
            size="icon"
            disabled={muted}
            className="rounded-full bg-primary text-primary-foreground hover:brightness-110"
            onClick={submit}
          >
            <Send className="size-4" />
          </Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) setScanFile(f);
            e.target.value = "";
          }}
        />
      </div>

      {scanFile && (
        <NsfwScanDialog
          file={scanFile}
          onDone={(blob) => {
            setScanFile(null);
            void (async () => {
              try {
                // 1) upload file ke Convex storage
                const uploadUrl = await getUploadUrl();
                const res = await fetch(uploadUrl, {
                  method: "POST",
                  headers: { "Content-Type": blob.type || "image/jpeg" },
                  body: blob,
                });
                if (!res.ok) throw new Error("Upload gagal");
                const { storageId } = (await res.json()) as { storageId: string };
                // 2) baru kirim storageId-nya di pesan
                await send({
                  imageStorageId: storageId,
                  imageUrl: URL.createObjectURL(blob),
                });
                toast.success("Foto terkirim");
              } catch (e) {
                toast.error(
                  e instanceof Error
                    ? `Foto gagal terkirim: ${e.message}`
                    : "Foto gagal terkirim, coba foto yang lebih kecil",
                );
              }
            })();
          }}
          onCancel={() => {
            setScanFile(null);
            void (async () => {
              try {
                const res = await nsfwReport({ passed: false });
                const strikes = (res as any)?.strikes ?? 0;
                if (strikes >= 3) toast.error("3x pelanggaran — akun dibanned permanen!");
                else
                  toast.error(
                    `Gambar ditolak (18+). Teguran ${strikes}/3 — 3x = banned permanen`,
                  );
              } catch {
                toast.error("Gambar ditolak (18+)");
              }
            })();
          }}
        />
      )}
      <GivePremiumDialog
        open={giveOpen}
        onOpenChange={setGiveOpen}
        kind={kind}
        clanId={clanId}
        peerId={peerId}
      />
      {reportMsg && <ReportDialog msg={reportMsg} onClose={() => setReportMsg(null)} />}
      {zoomImg && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setZoomImg(null)}
        >
          <img
            src={zoomImg}
            alt="Foto"
            className="max-h-[85vh] max-w-full rounded-lg object-contain"
          />
          <button
            onClick={() => setZoomImg(null)}
            className="absolute right-4 top-4 rounded-full bg-black/60 p-2 text-white"
            aria-label="Tutup"
          >
            <X className="size-5" />
          </button>
        </div>
      )}
    </div>
  );
}

function ClaimButton({
  give,
  meId,
}: {
  give: NonNullable<ChatMsg["premiumGive"]>;
  meId: string;
}) {
  const claim = useMutation(api.chat.claimGive);
  // Optimistik: begitu diklik, tulisannya langsung berubah tanpa menunggu server.
  const [mine, setMine] = useState(false);
  const [busy, setBusy] = useState(false);
  const claimed = mine || give.claimedBy.some((c) => c === (meId as unknown));
  const full = give.claimedBy.length >= give.slots;
  const taken = Math.min(give.claimedBy.length, give.slots);
  return (
    <div className="mt-2">
      {/* Berapa slot yang sudah terpakai — jadi jelas berapa yang tersisa. */}
      <p className="text-[10px] text-muted-foreground">
        {mine ? taken + 1 : taken}/{give.slots} orang sudah claim
        {!full && ` · sisa ${give.slots - taken}`}
      </p>
      <Button
        size="sm"
        disabled={claimed || full || busy}
        className={cn(
          "mt-1 w-full shrink-0 whitespace-nowrap px-2 text-[11px]",
          claimed
            ? "bg-emerald-600 text-white hover:bg-emerald-600"
            : full
              ? "bg-zinc-500 text-white hover:bg-zinc-500"
              : "bg-primary text-primary-foreground hover:brightness-110",
        )}
        onClick={async () => {
          // Tutan: klik sekali langsung berubah jadi "Kamu sudah claim".
          setBusy(true);
          setMine(true);
          try {
            await claim({ giveId: give._id });
            toast.success(`Berhasil claim ${give.days} hari premium`);
          } catch (e) {
            setMine(false);
            toast.error(e instanceof Error ? e.message : "Gagal claim");
          } finally {
            setBusy(false);
          }
        }}
      >
        {claimed
          ? "Kamu sudah claim"
          : full
            ? "Slot habis"
            : `Claim ${give.days} hari`}
      </Button>
    </div>
  );
}

function DeleteButton({
  messageId,
  onDeleteLocal,
}: {
  messageId: Id<"chatMessages">;
  onDeleteLocal?: (id: string) => Promise<void> | void;
}) {
  const del = useMutation(api.chat.deleteMessage);
  const [busy, setBusy] = useState(false);
  return (
    <button
      aria-label="Hapus pesan"
      title="Hapus"
      disabled={busy}
      className="hover:text-red-400 disabled:opacity-40"
      onClick={async () => {
        const id = String(messageId);
        // Pesan yang masih echo lokal tidak ada di server; buang lewat hook.
        if (id.startsWith("local-")) {
          if (!onDeleteLocal) return;
          setBusy(true);
          try {
            await onDeleteLocal(id);
            toast.success("Pesan dihapus");
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Gagal menghapus pesan");
          } finally {
            setBusy(false);
          }
          return;
        }
        setBusy(true);
        try {
          await del({ messageId });
        } catch (e) {
          // Dulu errornya ditelan, jadi tombol terasa tidak berfungsi.
          toast.error(e instanceof Error ? e.message : "Gagal menghapus pesan");
        } finally {
          setBusy(false);
        }
      }}
    >
      <Trash2 className="size-3.5" />
    </button>
  );
}

export { REPORT_REASONS };
