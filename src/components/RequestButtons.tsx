import { useState } from "react";
import { useMutation } from "convex/react";
import { Check, X } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

/**
 * Dua tombol Terima & Tolak untuk satu permintaan pertemanan. Dipakai di panel
 * Notifikasi (pakai refUserId) maupun di tab Request (pakai requestId) supaya
 * tampilannya sama persis dan sama-sama benar-benar bekerja.
 */
export function RequestButtons({
  userId,
  requestId,
  onDone,
  onError,
}: {
  userId?: Id<"users">;
  requestId?: Id<"friendRequests">;
  onDone?: (accepted: boolean) => void;
  onError?: (message: string) => void;
}) {
  const byUser = useMutation(api.friends.respondByUser);
  const byId = useMutation(api.friends.respondRequest);
  const [busy, setBusy] = useState<"yes" | "no" | null>(null);
  // Tahap 1: pilih dulu tombol mana yang mau dipakai.
  // Tahap 2: konfirmasi, baru request benar-benar dikirim.
  const [picking, setPicking] = useState<null | "yes" | "no">(null);

  const run = async (accept: boolean) => {
    if (busy) return;
    const choice = accept ? "yes" : "no";
    if (picking !== choice) {
      // Pertama kali dipencet = pilih dulu, belum ada yang terkirim.
      setPicking(choice);
      return;
    }
    setBusy(choice);
    try {
      if (requestId) await byId({ requestId, accept });
      else if (userId) await byUser({ fromUserId: userId, accept });
      onDone?.(accept);
    } catch (e) {
      onError?.(e instanceof Error ? e.message : "Gagal menyimpan");
    } finally {
      setBusy(null);
      setPicking(null);
    }
  };

  // Belum ada yang dipilih → tampil dua tombol (pilih dulu, belum terkirim).
  if (picking === null)
    return (
      <div className="flex shrink-0 items-center gap-1.5 self-center">
        <button
          type="button"
          aria-label="Terima pertemanan"
          onClick={() => run(true)}
          className="flex h-9 items-center gap-1 rounded-full bg-emerald-600 px-3 text-xs font-bold text-white transition hover:bg-emerald-500 active:scale-95"
        >
          <Check className="size-4" /> Terima
        </button>
        <button
          type="button"
          aria-label="Tolak pertemanan"
          onClick={() => run(false)}
          className="flex h-9 items-center gap-1 rounded-full bg-red-600 px-3 text-xs font-bold text-white transition hover:bg-red-500 active:scale-95"
        >
          <X className="size-4" /> Tolak
        </button>
      </div>
    );

  // Sudah dipilih → tombol konfirmasi.
  const accepting = picking === "yes";
  return (
    <div className="flex shrink-0 flex-col items-end gap-1 self-center">
      <p className="text-[10px] text-muted-foreground">
        {accepting ? "Terima request?" : "Tolak request?"}
      </p>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => run(accepting)}
          className="flex h-9 items-center gap-1 rounded-full bg-violet-600 px-3 text-xs font-bold text-white transition hover:bg-violet-500 active:scale-95 disabled:opacity-50"
        >
          {accepting ? <Check className="size-4" /> : <X className="size-4" />}
          {accepting ? "Ya, terima" : "Ya, tolak"}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => setPicking(null)}
          className="flex h-9 items-center rounded-full border border-border px-3 text-xs font-semibold text-muted-foreground transition hover:text-foreground disabled:opacity-50"
        >
          Batal
        </button>
      </div>
    </div>
  );
}
