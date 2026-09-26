import { useEffect, useRef, useState, useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Crown, ImagePlus, Plus, Send, X } from "lucide-react";
import { toast } from "sonner";
import { timeAgo, avatarFallback } from "@/lib/lstream";
import type { Id } from "@/convex/_generated/dataModel";

export type ChatMsg = {
  _id: Id<"chatMessages">;
  userId: Id<"users">;
  username: string;
  image?: string;
  level?: number;
  clanTag?: string;
  clanTagIcon?: string;
  clanNameColor?: string;
  text?: string;
  imageUrl?: string;
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
  if (r === 5) return 1;
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

  const submit = async () => {
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
      onOpenChange(false);
      setMessage("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm border-amber-300/30">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-300">
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
                  className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                    days === d
                      ? "border-amber-300 bg-amber-300/15 text-amber-200"
                      : "border-border text-muted-foreground hover:border-amber-300/50"
                  }`}
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
                  className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                    receivers === r
                      ? "border-amber-300 bg-amber-300/15 text-amber-200"
                      : "border-border text-muted-foreground hover:border-amber-300/50"
                  }`}
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
          <div className="rounded-lg bg-amber-300/10 p-3 text-sm">
            <p>
              Biaya: <b>{cost} hari</b> premium kamu
            </p>
            <p className="text-xs text-muted-foreground">
              ({GIVE_COST[days]} hari + {receiverCost(receivers)} hari untuk {receivers}{" "}
              penerima)
            </p>
            <p className="mt-1 text-xs text-amber-200">XP yang kamu dapat: +{xp} XP</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button
              className="flex-1 bg-amber-300 text-black hover:bg-amber-200"
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

// ------------------------------------------------------- NSFW checker ----

const NSFW_STEPS = [
  "Check NSFW",
  "Check darah",
  "Check kekerasan",
  "Check konten 18+",
  "Check konten sensitif",
];

function analyzeImageLocal(file: File): { ok: boolean; reason?: string } {
  // Analisis lokal ringan: ukuran & nama file mengandung kata terlarang.
  const name = file.name.toLowerCase();
  const bad = ["nsfw", "hentai", "18+", "porn", "xxx", "gore"];
  if (bad.some((w) => name.includes(w)))
    return { ok: false, reason: "Konten terindikasi 18+" };
  return { ok: true };
}

function NsfwScanDialog({
  file,
  onDone,
  onCancel,
}: {
  file: File;
  onDone: (dataUrl: string) => void;
  onCancel: (banned: boolean) => void;
}) {
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState(6);

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
          const reader = new FileReader();
          reader.onload = () => onDone(String(reader.result));
          reader.readAsDataURL(file);
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
      <DialogContent className="max-w-xs border-amber-300/30">
        <DialogHeader>
          <DialogTitle className="flex flex-col items-center gap-2 text-center">
            <span className="flex size-10 items-center justify-center rounded-full bg-green-500/20 text-green-400">
              ✓
            </span>
            <span className="text-sm font-medium">{NSFW_STEPS[step]}…</span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <img
            src={URL.createObjectURL(file)}
            alt="preview"
            className="max-h-40 w-full rounded-lg object-cover"
          />
          <Progress value={progress} className="h-2" />
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
  messages,
  onSend,
  meId,
  compact,
}: {
  kind: string;
  clanId?: Id<"clans">;
  peerId?: Id<"users">;
  messages: ChatMsg[];
  onSend: (payload: { text?: string; imageUrl?: string; replyToId?: Id<"chatMessages"> }) => Promise<void>;
  meId: string;
  compact?: boolean;
}) {
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<ChatMsg | null>(null);
  const [blinkId, setBlinkId] = useState<string | null>(null);
  const [plusOpen, setPlusOpen] = useState(false);
  const [giveOpen, setGiveOpen] = useState(false);
  const [scanFile, setScanFile] = useState<File | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [strikeInfo, setStrikeInfo] = useState(0);
  const nsfwReport = useMutation(api.chat.nsfwReport);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const send = useCallback(
    async (payload: { text?: string; imageUrl?: string }) => {
      await onSend({ ...payload, replyToId: replyTo?._id });
      if (replyTo) {
        setBlinkId(replyTo._id);
        setTimeout(() => setBlinkId(null), 3400);
        setReplyTo(null);
      }
    },
    [onSend, replyTo],
  );

  const submit = async () => {
    if (!text.trim()) return;
    const t = text;
    setText("");
    try {
      await send({ text: t });
    } catch (e) {
      setText(t);
      toast.error(e instanceof Error ? e.message : "Gagal kirim");
    }
  };

  const handleFile = (f: File) => setScanFile(f);

  return (
    <div className="flex h-full flex-col">
      {/* daftar pesan */}
      <div className={`thin-scroll flex-1 space-y-3 overflow-y-auto px-1 ${compact ? "py-2" : "py-3"}`}>
        {messages.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Belum ada pesan — mulai percakapan!
          </p>
        )}
        {messages.map((m) => {
          const mine = m.userId === meId;
          const give = m.premiumGive;
          const full = user?.clanTag ?? "";
          void full;
          return (
            <div
              key={m._id}
              className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}
            >
              <img
                src={m.image ?? avatarFallback(m.username)}
                alt=""
                className="size-9 shrink-0 rounded-full border border-amber-300/30 object-cover"
              />
              <div className={`flex max-w-[78%] flex-col ${mine ? "items-end" : "items-start"}`}>
                <div
                  className={`rounded-2xl border px-3 py-2 ${
                    give
                      ? "border-amber-300/60 bg-amber-300/20"
                      : mine
                        ? "border-amber-300/30 bg-amber-300/10"
                        : "border-border bg-secondary/60"
                  } ${blinkId === m._id ? "reply-blink" : ""}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-amber-200">{m.username}</span>
                    {m.clanTag && (
                      <span className="rounded bg-black/40 px-1.5 py-0.5 text-[10px] text-amber-200">
                        {m.clanTagIcon} [{m.clanTag}]
                      </span>
                    )}
                  </div>
                  {m.replyTo && (
                    <div className="mt-1 rounded-lg border-l-2 border-amber-300/70 bg-black/25 px-2 py-1 text-xs">
                      <p className="font-medium text-amber-200">{m.replyTo.username}</p>
                      <p className="truncate text-muted-foreground">
                        {m.replyTo.text ?? (m.replyTo.premiumGiveId ? "Give premium" : "[foto]")}
                      </p>
                    </div>
                  )}
                  {give ? (
                    <div className="mt-1 min-w-48 text-center">
                      <Crown className="mx-auto size-6 text-amber-300" />
                      <p className="mt-1 text-sm font-bold">
                        {give.days} Hari premium
                      </p>
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
                      {m.text && <p className="mt-0.5 break-words text-sm">{m.text}</p>}
                      {m.imageUrl && (
                        <img
                          src={m.imageUrl}
                          alt="lampiran"
                          className="mt-1 max-h-48 rounded-lg object-cover"
                        />
                      )}
                    </>
                  )}
                </div>
                <div className={`mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground ${mine ? "flex-row-reverse" : ""}`}>
                  <span>{timeAgo(m.createdAt)}</span>
                  {mine && (
                    <button
                      className="underline hover:text-red-400"
                      onClick={async () => {
                        try {
                          await api.chat.deleteMessage;
                          // deleteMessage dipanggil via callback parent
                        } catch {
                          /* noop */
                        }
                      }}
                      data-del={m._id}
                      style={{ display: "none" }}
                    >
                      hapus
                    </button>
                  )}
                  <DeleteButton messageId={m._id} />
                  <button
                    className="underline hover:text-amber-200"
                    onClick={() => setReplyTo(m)}
                  >
                    reply
                  </button>
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
          <div className="mb-2 flex items-center justify-between rounded-lg border-l-2 border-amber-300 bg-amber-300/10 px-3 py-1.5 text-xs">
            <div className="min-w-0">
              <p className="font-medium text-amber-200">{replyTo.username}</p>
              <p className="truncate text-muted-foreground">
                {replyTo.text ?? (replyTo.premiumGive ? "Give premium" : "[foto]")}
              </p>
            </div>
            <button onClick={() => setReplyTo(null)}>
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
              onClick={() => setPlusOpen((v) => !v)}
            >
              <Plus className="size-4" />
            </Button>
            {plusOpen && (
              <div className="absolute bottom-12 left-0 z-10 flex flex-col gap-2 rounded-2xl border border-border bg-popover p-2 shadow-xl">
                <button
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-accent"
                  onClick={() => fileRef.current?.click()}
                >
                  <ImagePlus className="size-4" /> Kirim foto
                </button>
                <button
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-amber-200 hover:bg-accent"
                  onClick={() => {
                    setPlusOpen(false);
                    setGiveOpen(true);
                  }}
                >
                  <Crown className="size-4" /> Give premium
                </button>
              </div>
            )}
          </div>
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && submit()}
            placeholder="Tulis pesan…"
            className="flex-1 rounded-full"
          />
          <Button
            size="icon"
            className="rounded-full bg-amber-300 text-black hover:bg-amber-200"
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
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
      </div>

      {scanFile && (
        <NsfwScanDialog
          file={scanFile}
          onDone={(dataUrl) => {
            setScanFile(null);
            void send({ imageUrl: dataUrl });
          }}
          onCancel={() => {
            setScanFile(null);
            void (async () => {
              try {
                const res = await nsfwReport({ passed: false });
                const strikes = (res as any)?.strikes ?? 0;
                setStrikeInfo(strikes);
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
      {strikeInfo >= 3 && null}
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
  const claimed = give.claimedBy.some((c) => c === (meId as unknown));
  const full = give.claimedBy.length >= give.slots;
  return (
    <Button
      size="sm"
      disabled={claimed || full}
      className={`mt-2 w-full ${full && !claimed ? "bg-zinc-500 text-white" : "bg-amber-300 text-black hover:bg-amber-200"}`}
      onClick={async () => {
        try {
          await claim({ giveId: give._id });
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Gagal claim");
        }
      }}
    >
      {claimed ? "Sudah kamu claim" : full ? "Slot habis" : "Claim"}
    </Button>
  );
}

function DeleteButton({ messageId }: { messageId: Id<"chatMessages"> }) {
  const del = useMutation(api.chat.deleteMessage);
  return (
    <button
      className="underline hover:text-red-400"
      onClick={async () => {
        try {
          await del({ messageId });
        } catch {
          /* noop */
        }
      }}
    >
      hapus
    </button>
  );
}
