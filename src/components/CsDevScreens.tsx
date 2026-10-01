import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Avatar } from "@/components/lstream-ui";
import { useHideNavOnMount } from "@/components/AppLayout";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Headset,
  PhoneOff,
  Send,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";

/** Badge jumlah antrean CS yang menunggu (dipakai tombol di panel dev). */
export function CsBadge() {
  const q = useQuery(api.cs.devQueue, {});
  const n = q?.waiting.length ?? 0;
  if (n === 0) return null;
  return (
    <span className="shrink-0 rounded-full bg-primary px-1.5 font-mono text-[10px] text-primary-foreground">
      {n}
    </span>
  );
}

/**
 * Layar CS developer: FULLSCREEN terpisah (bukan bagian Developer Panel).
 * Isinya daftar user yang mengirim pesan, tombol terima/tolak, dan layar chat
 * per pengguna dengan tombol Akhiri CS di kanan atas.
 */
export function CsScreen({ onClose }: { onClose: () => void }) {
  useHideNavOnMount();
  const queue = useQuery(api.cs.devQueue, {});
  const acceptCs = useMutation(api.cs.accept);
  const rejectCs = useMutation(api.cs.reject);
  const [pickedId, setPickedId] = useState<Id<"csThreads"> | null>(null);

  const waiting = queue?.waiting ?? [];
  const open = queue?.open ?? [];

  return (
    <div className="fixed inset-0 z-[85] flex flex-col bg-background">
      <div className="flex items-center gap-2.5 border-b border-white/10 px-3 py-2.5">
        <button
          onClick={onClose}
          aria-label="Tutup"
          className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5"
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/15">
          <Headset className="size-4 text-violet-300" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold leading-tight">Customer Service</p>
          <p className="text-[11px] text-muted-foreground">
            {waiting.length > 0
              ? `${waiting.length} permintaan menunggu`
              : "Tidak ada permintaan menunggu"}
          </p>
        </div>
      </div>

      {pickedId ? (
        <CsChatDev threadId={pickedId} onBack={() => setPickedId(null)} />
      ) : (
        <div className="thin-scroll flex-1 overflow-y-auto px-3 py-3">
          {waiting.length === 0 && open.length === 0 && (
            <p className="py-16 text-center text-xs text-muted-foreground">
              Belum ada yang menghubungi CS.
            </p>
          )}

          {waiting.length > 0 && (
            <>
              <p className="mb-1.5 text-[11px] font-bold text-muted-foreground">
                Menunggu ({waiting.length})
              </p>
              <div className="space-y-1.5">
                {waiting.map((t) => (
                  <div
                    key={t.threadId}
                    className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5"
                  >
                    <div className="flex items-center gap-2.5">
                      <Avatar src={t.image} seed={t.username} className="size-10" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{t.username}</p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {t.preview || "kosong"}
                        </p>
                      </div>
                      <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                        {t.ageMin}m lalu
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <button
                        onClick={async () => {
                          try {
                            await acceptCs({ threadId: t.threadId });
                            toast.success("Permintaan CS diterima");
                            setPickedId(t.threadId);
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : "Gagal");
                          }
                        }}
                        className="flex items-center justify-center gap-1 rounded-lg bg-primary py-2.5 text-xs font-bold text-primary-foreground"
                      >
                        <Check className="size-4" /> Terima pesan
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            await rejectCs({ threadId: t.threadId });
                            toast.success("Permintaan CS ditolak");
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : "Gagal");
                          }
                        }}
                        className="flex items-center justify-center gap-1 rounded-lg border border-white/15 py-2.5 text-xs font-bold text-muted-foreground"
                      >
                        <X className="size-4" /> Tolak
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {open.length > 0 && (
            <>
              <p className="mb-1.5 mt-4 text-[11px] font-bold text-muted-foreground">
                Sedang jalan ({open.length})
              </p>
              <div className="space-y-1.5">
                {open.map((t) => (
                  <button
                    key={t.threadId}
                    onClick={() => setPickedId(t.threadId)}
                    className="flex w-full items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] p-2.5 text-left"
                  >
                    <Avatar src={t.image} seed={t.username} className="size-10" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{t.username}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {t.preview || "kosong"}
                      </p>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** Layar chat developer untuk satu thread, juga fullscreen. */
function CsChatDev({
  threadId,
  onBack,
}: {
  threadId: Id<"csThreads">;
  onBack: () => void;
}) {
  const info = useQuery(api.cs.devThreadInfo, { threadId }) as {
    username: string;
    image?: string;
  } | null;
  const messages = useQuery(api.cs.threadMessages, { threadId });
  const reply = useMutation(api.cs.devReply);
  const endThread = useMutation(api.cs.endThread);
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages?.length]);

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    try {
      await reply({ threadId, text: body });
      setText("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal");
    }
  };

  return (
    <>
      <div className="flex items-center gap-2.5 border-b border-white/10 px-3 py-2.5">
        <button
          onClick={onBack}
          aria-label="Kembali"
          className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5"
        >
          <ChevronLeft className="size-4" />
        </button>
        <Avatar src={info?.image} seed={info?.username} className="size-9" />
        <p className="min-w-0 flex-1 truncate text-sm font-bold">{info?.username ?? "user"}</p>
        <button
          onClick={async () => {
            try {
              await endThread({ threadId });
              toast.success("CS diakhiri");
              onBack();
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Gagal");
            }
          }}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-red-500/40 px-2.5 py-2 text-[11px] font-bold text-red-400"
        >
          <PhoneOff className="size-3.5" /> Akhiri CS
        </button>
      </div>

      <div className="thin-scroll flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {(messages ?? []).map((m: any) => (
          <div
            key={m._id}
            className={cn(
              "max-w-[80%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed",
              m.from === "dev"
                ? "ml-auto rounded-br-md bg-primary text-primary-foreground"
                : "rounded-bl-md border border-white/10 bg-card",
            )}
          >
            {m.text}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="border-t border-white/10 p-3 pb-6">
        <div className="flex items-end gap-2 rounded-2xl border border-border bg-card px-3 py-2 focus-within:border-violet-500/60">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            rows={1}
            placeholder="Balas user…"
            className="max-h-28 min-h-[36px] flex-1 resize-none bg-transparent py-2 text-[13px] outline-none"
          />
          <button
            onClick={() => void send()}
            disabled={!text.trim()}
            aria-label="Kirim"
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-xl",
              text.trim() ? "bg-primary text-primary-foreground" : "bg-white/[0.06] text-zinc-600",
            )}
          >
            <Send className="size-4" />
          </button>
        </div>
      </div>
    </>
  );
}