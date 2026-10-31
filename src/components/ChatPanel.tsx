import { useEffect, useRef, useState, useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { avatarFallback, usernameColor } from "@/lib/lstream";
import { ClanTag, TitleBadge } from "@/components/lstream-ui";
import { TierIcon } from "@/components/ProfileSheet";
import { badgeForLevel } from "@/lib/lstream";
import { useNavigate } from "react-router";
import { DEFAULT_CLAN_ICON } from "@/lib/clanIcons";
import { useAuth } from "@/hooks/use-auth";
import { FramedAvatar } from "@/components/FramedAvatar";
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
import { Check, Crown, ImagePlus, MoreVertical, Reply, Send, Sticker, Trash2, VolumeX, X } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";

export type ChatMsg = {
  _id: Id<"chatMessages">;
  userId: Id<"users">;
  username: string;
  image?: string;
  level?: number;
  premium?: boolean;
  /** SHOP BORDER — bingkai foto profil yang sedang dipakai user ini. */
  avatarBorder?: string;
  staffRole?: string;
  clanTag?: string;
  clanTagIcon?: string;
  /** ID clan pembawa pesan — tag clan di bubble bisa dipencet → detail clan. */
  clanId?: string;
  /** Level clan — menentukan warna nama clan di tag. */
  clanLevel?: number;
  clanNameColor?: string;
  text?: string;
  imageUrl?: string;
  imageStorageId?: string;
  /** Emoji sticker besar dari toko sticker. */
  sticker?: string;
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
/**
 * Tambahan biaya hari untuk jumlah penerima. Semakin banyak user yang bisa
 * claim, semakin mahal — harus sinkan dengan RECEIVER_COST di convex/chat.ts.
 */
function receiverCost(r: number) {
  const table: Record<number, number> = { 5: 0, 15: 3, 20: 6, 30: 10 };
  if (table[r] !== undefined) return table[r];
  return Math.max(0, Math.ceil((r - 5) * 0.35));
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
  const { user } = useAuth();
  const [days, setDays] = useState(1);
  const [receivers, setReceivers] = useState(5);
  const [message, setMessage] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const give = useMutation(api.chat.givePremium);
  const cost = (GIVE_COST[days] ?? days + 1) + receiverCost(receivers);
  const xp = (GIVE_XP[days] ?? days * 200) + Math.max(0, receivers - 5) * 100;
  const msgLen = message.trim().length;
  const msgOk = msgLen === 0 || msgLen >= 50;
  const unlimited = !!(user as any)?.unlimitedPremium;
  const remaining = Math.max(
    0,
    Math.floor(((user?.premiumUntil ?? 0) - Date.now()) / 86400000),
  );
  const notEnough = !unlimited && remaining < cost;

  const submit = async () => {
    if (busy) return;
    setErr(null);
    setBusy(true);
    try {
      await give({
        kind,
        clanId,
        peerId,
        days,
        receivers,
        message: message.trim() || undefined,
      });
      onOpenChange(false);
      setMessage("");
    } catch (e) {
      // Tetap buka dialog + tampilkan alasannya inline (toaster dimatikan).
      setErr(e instanceof Error ? e.message : "Gagal kirim premium");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm gap-0 overflow-hidden border border-amber-400/25 bg-card p-0">
        {/* Header emas premium — crown di lingkaran lembut, tanpa neon. */}
        <div className="relative border-b border-amber-400/20 bg-gradient-to-b from-amber-500/[0.14] to-transparent px-5 pb-4 pt-5 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full border border-amber-400/40 bg-amber-500/15">
            <Crown className="size-6 text-amber-300" />
          </span>
          <DialogTitle className="mt-2.5 text-lg font-bold text-amber-200">
            Give Premium
          </DialogTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Bagikan hari premium ke member chat ini
          </p>
        </div>
        <div className="thin-scroll max-h-[70vh] space-y-4 overflow-y-auto px-5 py-4">
          <div>
            <p className="mb-2 text-xs font-semibold text-muted-foreground">Berapa hari</p>
            <div className="flex flex-wrap gap-1.5">
              {GIVE_DAYS.map((d) => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className={cn(
                    "flex-1 basis-[calc(25%-0.375rem)] rounded-xl border px-2 py-2 text-sm font-bold transition",
                    days === d
                      ? "border-amber-300/60 bg-amber-500/15 text-amber-200"
                      : "border-white/10 bg-white/[0.03] text-muted-foreground hover:border-amber-400/40 hover:text-foreground",
                  )}
                >
                  {d} hari
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold text-muted-foreground">
              Untuk berapa orang
              <span className="ml-1.5 font-normal text-[10px]">
                (makin banyak, makin mahal)
              </span>
            </p>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-2">
              <button
                aria-label="Kurangi penerima"
                disabled={receivers <= 5}
                onClick={() => setReceivers((r) => Math.max(5, r - 1))}
                className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-white/15 text-lg font-bold text-muted-foreground transition hover:border-amber-400/50 hover:text-foreground disabled:opacity-35"
              >
                −
              </button>
              <div className="min-w-0 text-center">
                <p className="text-lg font-black leading-none text-foreground">
                  {receivers} org
                </p>
                <p className="mt-1 text-[10px] text-amber-300/90">
                  +{receiverCost(receivers)} hari biaya penerima
                </p>
              </div>
              <button
                aria-label="Tambah penerima"
                disabled={receivers >= 30}
                onClick={() => setReceivers((r) => Math.min(30, r + 1))}
                className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-white/15 text-lg font-bold text-muted-foreground transition hover:border-amber-400/50 hover:text-foreground disabled:opacity-35"
              >
                +
              </button>
            </div>
            <div className="mt-2 flex gap-1.5">
              {[5, 15, 20, 30].map((r) => (
                <button
                  key={r}
                  onClick={() => setReceivers(r)}
                  className={cn(
                    "flex-1 rounded-lg border px-2 py-1.5 text-xs font-semibold transition",
                    receivers === r
                      ? "border-amber-300/60 bg-amber-500/15 text-amber-200"
                      : "border-white/10 text-muted-foreground hover:border-amber-400/40",
                  )}
                >
                  {r} org
                </button>
              ))}
            </div>
          </div>
          <div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Pesan (opsional, minimal 50 karakter)"
              rows={3}
              className="w-full rounded-xl border border-white/12 bg-white/[0.03] p-3 text-sm outline-none focus:border-amber-400/50"
            />
            {msgLen > 0 && msgLen < 50 && (
              <p className="mt-1 text-[11px] font-semibold text-amber-300">
                Pesan masih {50 - msgLen} karakter kurang — atau kosongkan saja.
              </p>
            )}
          </div>
          {/* Ringkasan biaya — emas lembut, angka utama besar. */}
          <div className="rounded-xl border border-amber-400/25 bg-amber-500/[0.08] p-3">
            <div className="flex items-end justify-between gap-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300/80">
                  Biaya
                </p>
                <p className="mt-0.5 text-2xl font-black leading-none text-amber-200">
                  {cost} hari
                </p>
              </div>
              <p className="pb-0.5 text-right text-[11px] leading-relaxed text-muted-foreground">
                {GIVE_COST[days]} hari dasar
                <br />+ {receiverCost(receivers)} hari × {receivers} penerima
              </p>
            </div>
            <p className="mt-2 border-t border-amber-400/15 pt-2 text-xs font-semibold text-amber-300/90">
              +{xp} XP untuk kamu
            </p>
            <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
              Sisa premium kamu:{" "}
              <span className="font-bold text-white/85">
                {unlimited ? "Tanpa batas" : `${remaining} hari`}
              </span>
            </p>
          </div>
          {(err || notEnough) && (
            <p className="rounded-xl border border-red-400/40 bg-red-500/10 px-3 py-2 text-[11px] font-semibold leading-snug text-red-200">
              {err ??
                `Premium kamu cuma ${remaining} hari, butuh ${cost} hari buat give ini.`}
            </p>
          )}
          <div className="flex gap-2 pb-1">
            <Button
              variant="outline"
              className="flex-1 border-white/15"
              onClick={() => onOpenChange(false)}
            >
              Batal
            </Button>
            <Button
              disabled={!msgOk || notEnough || busy}
              className="flex-1 bg-gradient-to-b from-amber-400 to-amber-500 font-bold text-black shadow-[0_2px_10px_-4px_rgba(251,191,36,.6)] hover:brightness-105"
              onClick={submit}
            >
              <Crown className="size-4" /> {busy ? "Mengirim…" : "Kirim"}
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

/**
 * Perkecil foto sebelum dikirim. Base64 mentah dari HP bisaUkuran 5-10 MB
 * sehingga ditolak server ("Server Error") tanpa pesan apa pun. Diperkecil ke
 * max 1280px + JPEG 0.82 supaya selalu muat di dalam satu dokumen chat.
 */
/**
 * Perkecil foto sebelum dikirim. Hasilnya Blob (bukan base64) supaya bisa
 * diunggah ke Convex storage - dokumen cuma boleh 1MB.
 */
/**
 * ANALISIS GAMBAR KETAT — bukan cuma nama file. Gambar benar-benar dibaca
 * pikselnya: rasio warna kulit + area merah/kegelapan dihitung untuk menolak
 * konten 18+ dan gambar berdarah. Ambang sengaja tinggi supaya foto anime
 * biasa (wajah + tangan) tidak ikut tertolak.
 */
async function analyzeImageStrict(file: File): Promise<{ ok: boolean; reason?: string }> {
  if (!file.type.startsWith("image/"))
    return { ok: false, reason: "File bukan gambar" };
  if (file.size > 12 * 1024 * 1024)
    return { ok: false, reason: "Gambar lebih dari 12 MB" };
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Gambar tidak bisa dibaca"));
      el.src = url;
    });
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return { ok: true };
    ctx.drawImage(img, 0, 0, size, size);
    const data = ctx.getImageData(0, 0, size, size).data;
    let skin = 0;
    let red = 0;
    let darkRed = 0;
    let colorful = 0;
    let total = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (a < 32) continue;
      total++;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const sat = max === 0 ? 0 : (max - min) / max;
      if (sat > 0.18) colorful++;
      // Kulit: merah dominan, hijau sedang, biru lebih rendah.
      if (r > 90 && r > g + 12 && g > b - 6 && r < 250 && sat > 0.15 && sat < 0.62) {
        skin++;
      }
      if (r > 90 && r > g * 1.6 && r > b * 1.6) red++;
      if (r > 60 && r > g * 1.8 && r > b * 1.8 && g < 70) darkRed++;
    }
    if (total === 0) return { ok: false, reason: "Gambar kosong" };
    const skinRatio = skin / total;
    const redRatio = red / total;
    const darkRedRatio = darkRed / total;
    const colorfulRatio = colorful / total;
    // Konten 18+: mayoritas bidang warna kulit DAN foto berwarna penuh.
    if (skinRatio > 0.52 && colorfulRatio > 0.6)
      return { ok: false, reason: "Konten 18+ (kulit) terdeteksi" };
    // Kekerasan/berdarah: area merah pekat yang luas.
    if (darkRedRatio > 0.34 && redRatio > 0.46)
      return { ok: false, reason: "Konten darah/kekerasan terdeteksi" };
    if (redRatio > 0.72)
      return { ok: false, reason: "Terlalu banyak area merah pekat" };
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : "Gambar tidak bisa diperiksa",
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

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
  onReject,
}: {
  file: File;
  onDone: (blob: Blob) => void;
  onCancel: (banned: boolean) => void;
  /** Analisis ketat menolak gambar — alasan ditampilkan di dialog. */
  onReject: (reason: string) => void;
}) {
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState(6);
  const [error, setError] = useState<string | null>(null);
  const previewUrl = useRef<string>("");
  if (!previewUrl.current) previewUrl.current = URL.createObjectURL(file);

  useEffect(() => {
    let s = 0;
    let stopped = false;
    const t = setInterval(() => {
      s += 1;
      setProgress((p) => Math.min(100, p + 9));
      if (s % 3 === 0) setStep((x) => Math.min(x + 1, NSFW_STEPS.length - 1));
      if (s >= 12) {
        clearInterval(t);
        void (async () => {
          const verdict = await analyzeImageStrict(file);
          if (stopped) return;
          if (verdict.ok) {
            try {
              const blob = await compressImage(file);
              onDone(blob);
            } catch {
              onCancel(false);
            }
          } else {
            setError(verdict.reason ?? "Gambar ditolak");
            setProgress(100);
            setTimeout(() => onReject(verdict.reason ?? "Gambar ditolak"), 1200);
          }
        })();
      }
    }, 160);
    return () => {
      stopped = true;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent className="max-w-xs border-foreground/40">
        <DialogHeader>
          <DialogTitle className="flex flex-col items-center gap-2 text-center">
            <span
              className={cn(
                "flex size-10 items-center justify-center rounded-full",
                error
                  ? "bg-red-500/20 text-red-400"
                  : "bg-emerald-500/20 text-emerald-400",
              )}
            >
              {error ? <X className="size-5" /> : <Check className="size-5" />}
            </span>
            <span className="text-sm font-medium">
              {error ? "Gambar ditolak" : `${NSFW_STEPS[step]}…`}
            </span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <img
            src={previewUrl.current}
            alt="preview"
            className="max-h-40 w-full rounded-lg object-cover"
          />
          <Progress value={progress} className="h-2" />
          {error && (
            <p className="rounded-lg border border-red-400/40 bg-red-500/10 px-2.5 py-2 text-center text-[11px] font-semibold leading-snug text-red-200">
              {error}
            </p>
          )}
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
  const [err, setErr] = useState<string | null>(null);
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
          {err && (
            <p className="rounded-lg border border-red-400/40 bg-red-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-red-200">
              {err}
            </p>
          )}
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
                setErr(null);
                try {
                  await report({
                    messageId: msg._id,
                    reason,
                    detail: detail.trim() || undefined,
                  });
                  onClose();
                } catch (e) {
                  setErr(e instanceof Error ? e.message : "Gagal mengirim laporan");
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
    /** Emoji sticker besar dari toko sticker. */
    sticker?: string;
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
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<ChatMsg | null>(null);
  const [blinkId, setBlinkId] = useState<string | null>(null);
  const [zoomImg, setZoomImg] = useState<string | null>(null);
  const [giveOpen, setGiveOpen] = useState(false);
  const [stickerOpen, setStickerOpen] = useState(false);
  const [scanFile, setScanFile] = useState<File | null>(null);
  const [reportMsg, setReportMsg] = useState<ChatMsg | null>(null);
  // Error ditampilkan LANGSUNG di kolom chat (toaster dimatikan permanen).
  const [sendError, setSendError] = useState<string | null>(null);
  const stickerList = useQuery(
    api.stickers.mine,
    user ? {} : "skip",
  ) as { key: string; sticker: string; title: string }[] | undefined;
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // Cegah tap dobel (Enter lalu ketuk, atau ketuk dua kali) mengirim isi yang
  // sama dua kali — tanpa kunci yang menelan pesan berikutnya diam-diam.
  const lastSent = useRef({ text: "", at: 0 });
  // Chat teman (DM): cooldown10 detik antar pesan.
  const lastDmAt = useRef(0);
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
      sticker?: string;
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

  // Cooldown DM: hitung mundur tampil di kiri atas kolom input.
  const [cdLeft, setCdLeft] = useState(0);
  useEffect(() => {
    if (cdLeft <= 0) return;
    const t = setTimeout(() => setCdLeft((v) => Math.max(0, v - 1)), 1000);
    return () => clearTimeout(t);
  }, [cdLeft]);

  const submit = async () => {
    if (muted) {
      setSendError("Kamu sedang dimute — tidak bisa mengirim pesan");
      return;
    }
    setSendError(null);
    if (!text.trim()) return;
    const t = text;
    const now = Date.now();
    // Chat teman (DM): cooldown10 detik sebelum bisa kirim lagi.
    if (peerId && lastDmAt.current && now - lastDmAt.current < 10000) {
      const sisa = Math.ceil((10000 - (now - lastDmAt.current)) / 1000);
      setCdLeft(sisa);
      setSendError(`Cooldown chat — tunggu ${sisa} detik lagi`);
      return;
    }
    // Kirim dua kali dalam <800ms dengan teks identik hampir pasti ketukan
    // dobel, bukan pesan baru.
    if (lastSent.current.text === t && now - lastSent.current.at < 800) return;
    lastSent.current = { text: t, at: now };
    setText("");
    try {
      await send({ text: t });
      if (peerId) {
        lastDmAt.current = Date.now();
        setCdLeft(10);
      }
    } catch (e) {
      // Kegagalan: kembalikan teks DAN buka lagi penjaga ketukan dobel,
      // supaya kirim ulang yang segera setelahnya tidak diblokir diam-diam.
      lastSent.current = { text: "", at: 0 };
      setText(t);
      setSendError(e instanceof Error ? e.message : "Gagal kirim pesan");
    }
  };  return (
    <div className="flex min-h-0 flex-1 flex-col bg-transparent">
      {muted && (
        <div className="mb-2 flex items-center justify-center gap-2 rounded-xl border border-zinc-500/30 bg-zinc-500/10 px-3 py-1.5 text-[11px] font-semibold text-zinc-300">
          <VolumeX className="size-3.5" /> Kamu sedang dimute — kolom chat dikunci
        </div>
      )}
      {/* daftar pesan */}
      <div
        className={`thin-scroll min-h-0 flex-1 space-y-3 overflow-y-auto px-1 bg-transparent ${
          compact ? "py-2" : "py-3"
        } ${
          muted ? "pointer-events-none select-none opacity-40 grayscale"
          :
          ""
        }`}
      >
        {messages.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Belum ada pesan — mulai percakapan!
          </p>
        )}
        {messages.map((m) => {
          const mine = m.userId === meId;          const give = m.premiumGive;
          return (
            <div
              key={m._id}
              className={cn("flex w-full items-end gap-2 border-0", mine && "flex-row-reverse")}
            >
              {/* Klik avatar → detail akun */}
              <button onClick={() => onOpenProfile?.(m.userId)} aria-label={`Profil ${m.username}`}>
                {m.avatarBorder && m.avatarBorder !== "none" ? (
                  /* Border shop terpasang → bingkai kreatif mengikuti foto
                      profil di chat (konsisten dengan halaman lain). */
                  <FramedAvatar
                    border={m.avatarBorder}
                    src={m.image}
                    seed={m.username}
                    className="size-9 shrink-0"
                  />
                ) : (
                  <img
                    src={m.image ?? avatarFallback(m.username)}
                    alt=""
                    className={cn(
                      "size-9 shrink-0 rounded-full object-cover",
                      // Avatar cuma diberi garis tipis, tanpa blok hitam.
                      !m.image && "bg-white/[0.08]",
                    )}
                  />
                )}
              </button>
              <div className={cn("flex w-3/4 min-w-0 flex-col", mine ? "items-end" : "items-start")}>
                <div
                  className={cn(
                    // Semua bubble panjangnya SAMA (w-full di kolom w-3/4):
                    // pesan pendek maupun panjang tetap satu ukuran kotak.
                    "flex w-full flex-col rounded-md px-3 py-2",
                    mine && "items-end",
                    // Pesan yang isinya cuma foto: bubble dibuat transparan
                    // supaya tidak ada kotak hitam di belakang fotonya.
                      (m.imageUrl || m.sticker) && !m.text
                          ? "border-transparent bg-transparent px-1 pb-1 pt-0 shadow-none"
                          : give
                              ? "bubble-give"
                              : mine
                                  ? "bubble-mine"
                                  : "bubble-other",
                    blinkId === m._id && "reply-blink",
                  )}
                >
                  {/* Header bubble: username + centang + title + tag level */}
                  <div className="flex w-fit min-w-0 max-w-full items-center gap-1.5">
                    <span className={cn("truncate text-xs font-semibold", usernameColor(m.username))}>
                      {m.username}
                    </span>
                    {m.premium && <BlueCheck className="size-3.5 shrink-0" />}
                    <TitleBadge role={m.staffRole} compact />
                    {/* Tag LEVEL user — ikon tier material + Lv.x,
                        gaya sama seperti di detail akun. */}
                    {typeof m.level === "number" && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/45 bg-white/5 px-1.5 py-0 text-[9px] font-bold leading-none text-white/95">
                        <TierIcon
                          tier={badgeForLevel(m.level).name}
                          className="size-3"
                        />
                        Lv.{m.level}
                      </span>
                    )}
                  </div>
                  {/* Tag CLAN — BARIS TERPISAH DI BAWAH username supaya
                      username tidak tertutup. Gaya sama persis dengan detail
                      clan, hitbox seukuran tag, dipencet → detail clan
                      FULLSCREEN. */}
                  {m.clanTag && (
                    <div className="mt-1 flex w-fit max-w-full">
                      <button
                        type="button"
                        aria-label={`Detail clan ${m.clanTag}`}
                        onClick={() =>
                          m.clanId && navigate(`/clan?clan=${m.clanId}`)
                        }
                        className="inline-flex shrink-0 items-center leading-none transition active:scale-95"
                      >
                        <ClanTag
                          icon={m.clanTagIcon ?? DEFAULT_CLAN_ICON}
                          tag={m.clanTag}
                          color={m.clanNameColor}
                          level={m.clanLevel}
                          className="pointer-events-none scale-90 px-1.5 py-0 text-[9px]"
                        />
                      </button>
                    </div>
                  )}
                  {m.replyTo && (
                    // Kutipan balas: kotak tipis yang tetap lapang, teks
                    // sumber ditampilkan sampai 3 baris supaya jelas.
                    <div className="bubble-reply mt-1 rounded-md px-2.5 py-1.5 text-xs">
                      <p className="font-medium text-foreground/90">{m.replyTo.username}</p>
                      <p className="line-clamp-3 text-muted-foreground">
                        {m.replyTo.text ?? (m.replyTo.premiumGiveId ? "Give premium" : "[foto]")}
                      </p>
                    </div>
                  )}
                  {give ? (
                    <div className="mt-1 min-w-48 text-center">
                      <Crown className="mx-auto size-6 text-amber-400" />
                      <p className="mt-1 text-sm font-bold">{give.days} Hari premium</p>
                      <p className="text-xs text-muted-foreground">
                        {give.days} hari premium untuk {give.slots} orang
                      </p>
                      {give.message && (
                        // Pesan give ditengahkan sesuai permintaan.
                        <p className="mt-2 rounded-lg bg-black/25 p-2 text-center text-xs leading-relaxed">
                          {give.message}
                        </p>
                      )}
                      <ClaimButton give={give} meId={meId} owner={mine} />
                    </div>
                  ) : (
                    <>
                      {m.text && (
                        /* Teks pesan ditebalkan (semibold) supaya terbaca kuat,
                           tapi tidak full-bold agar tidak terlihat tebal/gemuk. */
                        <p className="mt-0.5 w-fit max-w-full break-words text-sm font-semibold tracking-[0.01em]">
                          {m.text}
                        </p>
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
                      {m.sticker && (
                        <span className="select-none text-[64px] leading-none drop-shadow-[0_6px_10px_rgba(0,0,0,0.45)]">
                          {m.sticker}
                        </span>
                      )}
                    </>
                  )}
                  {/* Meta pesan — waktu, reply, dan menu titik-tiga SEMUA di
                      DALAM bubble, bukan di luar kotak. */}
                  <div
                    className={cn(
                      "mt-1.5 flex items-center gap-2 text-[10px] text-muted-foreground",
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
        {/* Countdown cooldown DM — kiri atas kolom kirim pesan */}
        {peerId && cdLeft > 0 && (
          <div className="mb-1.5 flex w-fit items-center gap-1.5 rounded-full border border-amber-300/35 bg-amber-400/12 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-amber-200">
            <span className="size-1.5 animate-pulse rounded-full bg-amber-300" />
            Cooldown chat · {cdLeft}
          </div>
        )}
        {sendError && (
          <div className="mb-2 flex items-start gap-2 rounded-xl border border-red-400/40 bg-red-500/10 px-3 py-2 text-[11px] font-semibold leading-snug text-red-200">
            <span className="min-w-0 flex-1">{sendError}</span>
            <button
              type="button"
              onClick={() => setSendError(null)}
              aria-label="Tutup pesan error"
              className="shrink-0 text-red-200/70 transition hover:text-red-100"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && submit()}
            placeholder={muted ? "Kamu sedang dimute…" : "Tulis pesan…"}
            disabled={muted}
            className="h-11 flex-1 rounded-full border-white/25 bg-black/50 text-[15px] focus-visible:border-white/45 focus-visible:ring-0 disabled:opacity-50"
          />
          <Button
            size="icon"
            disabled={muted}
            className="size-11 rounded-full bg-primary text-primary-foreground hover:brightness-110"
            onClick={submit}
          >
            <Send className="size-5" />
          </Button>
        </div>
        {/* 3 KOTAK ROUNDED di bawah kolom pesan: Foto · Give Prem · Sticker. */}
        <div className="mt-2 grid grid-cols-3 gap-2">
          <button
            type="button"
            disabled={muted}
            onClick={() => {
              if (muted) {
                setSendError("Kamu sedang dimute — tidak bisa kirim foto");
                return;
              }
              setSendError(null);
              fileRef.current?.click();
            }}
            className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-white/12 bg-white/[0.05] py-2.5 text-[10px] font-bold text-white/75 transition hover:border-sky-300/45 hover:bg-sky-400/10 hover:text-white active:scale-[0.97] disabled:opacity-40"
          >
            <ImagePlus className="size-4 text-sky-300" />
            Foto
          </button>
          <button
            type="button"
            disabled={muted || !!noPremium}
            onClick={() => {
              if (muted) {
                setSendError("Kamu sedang dimute — tidak bisa memberi premium");
                return;
              }
              setSendError(null);
              setGiveOpen(true);
            }}
            className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-white/12 bg-white/[0.05] py-2.5 text-[10px] font-bold text-white/75 transition hover:border-amber-300/45 hover:bg-amber-400/10 hover:text-white active:scale-[0.97] disabled:opacity-40"
          >
            <Crown className="size-4 text-amber-300" />
            Give Prem
          </button>
          <button
            type="button"
            disabled={muted}
            onClick={() => {
              if (muted) {
                setSendError("Kamu sedang dimute — tidak bisa kirim sticker");
                return;
              }
              setSendError(null);
              setStickerOpen(true);
            }}
            className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-white/12 bg-white/[0.05] py-2.5 text-[10px] font-bold text-white/75 transition hover:border-violet-300/45 hover:bg-violet-400/10 hover:text-white active:scale-[0.97] disabled:opacity-40"
          >
            <Sticker className="size-4 text-violet-300" />
            Sticker
          </button>
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

      {/* SHEET STICKER — 40% layar, TANPA blur. Grid 4 per baris, judul di
          bawah tiap sticker; sekali ketuk langsung terkirim. */}
      {stickerOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/30"
          onClick={() => setStickerOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="screen-enter h-[40dvh] w-full max-w-2xl overflow-hidden rounded-t-3xl border-t border-white/12 bg-[#0c0f16] pb-[env(safe-area-inset-bottom)]"
          >
            <div className="flex items-center gap-2 px-4 pb-2 pt-3">
              <Sticker className="size-4 text-violet-300" />
              <p className="min-w-0 flex-1 text-sm font-black text-white">
                Sticker
              </p>
              <button
                type="button"
                onClick={() => setStickerOpen(false)}
                aria-label="Tutup sticker"
                className="flex size-7 items-center justify-center rounded-full border border-white/12 bg-white/[0.06] text-white/70 transition hover:text-white"
              >
                <X className="size-3.5" />
              </button>
            </div>
            <div
              className="thin-scroll overflow-y-auto px-3 pb-4"
              style={{ maxHeight: "calc(40dvh - 52px)" }}
            >
              {stickerList && stickerList.length > 0 ? (
                <div className="grid grid-cols-4 gap-2">
                  {stickerList.map((s) => (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => {
                        setStickerOpen(false);
                        void send({ sticker: s.sticker }).catch((e) =>
                          setSendError(
                            e instanceof Error ? e.message : "Sticker gagal terkirim",
                          ),
                        );
                      }}
                      className="flex min-w-0 flex-col items-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] px-1 pb-1.5 pt-2 transition hover:border-violet-300/40 hover:bg-violet-400/10 active:scale-95"
                    >
                      <span className="text-3xl leading-none">{s.sticker}</span>
                      <span className="w-full truncate text-center text-[9px] font-semibold leading-tight text-white/45">
                        {s.title}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="px-4 py-8 text-center">
                  <p className="text-xs font-semibold text-white/70">
                    Belum punya sticker
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-white/45">
                    Buka Chat → tab Sticker untuk membeli pack. Sticker yang
                    sudah dibeli otomatis muncul di sini.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
                setSendError(null);
              } catch (e) {
                setSendError(
                  e instanceof Error
                    ? `Foto gagal terkirim: ${e.message}`
                    : "Foto gagal terkirim — coba foto yang lebih kecil",
                );
              }
            })();
          }}
          onCancel={() => setScanFile(null)}
          onReject={(reason) => {
            setScanFile(null);
            void (async () => {
              try {
                const res = await nsfwReport({ passed: false });
                const strikes = (res as any)?.strikes ?? 0;
                setSendError(
                  strikes >= 3
                    ? `Gambar ditolak: ${reason}. 3x pelanggaran — akun dibanned permanen!`
                    : `Gambar ditolak: ${reason}. Teguran ${strikes}/3 — 3x = banned permanen`,
                );
              } catch {
                setSendError(`Gambar ditolak: ${reason}`);
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
  owner,
}: {
  give: NonNullable<ChatMsg["premiumGive"]>;
  meId: string;
  /** true kalau give ini dibuat oleh user yang sedang melihat — pengirim
      hanya boleh melihat, tidak boleh claim (server juga menolak). */
  owner: boolean;
}) {
  const claim = useMutation(api.chat.claimGive);
  // Optimistik: begitu diklik, tulisannya langsung berubah tanpa menunggu server.
  const [mine, setMine] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const claimed = mine || give.claimedBy.some((c) => c === (meId as unknown));
  const full = give.claimedBy.length >= give.slots;
  const taken = Math.min(give.claimedBy.length, give.slots);
  return (
    <div className="mt-2">
      {/* Berapa slot yang sudah terpakai — jadi jelas berapa yang tersisa. */}
      <p className="text-[10px] text-muted-foreground">
        {taken}/{give.slots} orang sudah claim
        {!full && ` · sisa ${give.slots - taken}`}
      </p>
      {owner ? (
        // Pengirim give: tombolnya mati total (bukan sekadar disabled keabu),
        // supaya jelas dia hanya bisa melihat.
        <div className="mt-1 w-full shrink-0 rounded-md border border-white/12 bg-white/[0.05] px-2 py-1.5 text-center text-[11px] font-semibold text-white/60">
          Hanya bisa dilihat
        </div>
      ) : (
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
          setErr(null);
          setBusy(true);
          setMine(true);
          try {
            await claim({ giveId: give._id });
          } catch (e) {
            setMine(false);
            setErr(e instanceof Error ? e.message : "Gagal claim");
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
      )}
      {err && (
        <p className="mt-1 text-[10px] font-semibold text-red-300">{err}</p>
      )}
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
  const [err, setErr] = useState<string | null>(null);
  return (
    <>        <button
          aria-label="Hapus pesan"
          title={err ?? "Hapus"}
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
          } catch (e) {
            setErr(e instanceof Error ? e.message : "Gagal menghapus pesan");
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
          setErr(e instanceof Error ? e.message : "Gagal menghapus pesan");
        } finally {
          setBusy(false);
        }
      }}
    >
      <Trash2 className="size-3.5" />
    </button>
    {err && (
      <span className="text-[9px] font-semibold text-red-300">Gagal</span>
    )}
    </>
  );
}

export { REPORT_REASONS };
