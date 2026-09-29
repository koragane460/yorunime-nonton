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

  const run = async (accept: boolean) => {
    if (busy) return;
    setBusy(accept ? "yes" : "no");
    try {
      if (requestId) await byId({ requestId, accept });
      else if (userId) await byUser({ fromUserId: userId, accept });
      onDone?.(accept);
    } catch (e) {
      onError?.(e instanceof Error ? e.message : "Gagal menyimpan");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex shrink-0 items-center gap-1.5 self-center">
      <button
        type="button"
        aria-label="Terima pertemanan"
        disabled={busy !== null}
        onClick={() => run(true)}
        className="flex size-9 items-center justify-center rounded-full bg-emerald-600 text-white transition hover:bg-emerald-500 active:scale-95 disabled:opacity-50"
      >
        <Check className="size-4" />
      </button>
      <button
        type="button"
        aria-label="Tolak pertemanan"
        disabled={busy !== null}
        onClick={() => run(false)}
        className="flex size-9 items-center justify-center rounded-full bg-red-600 text-white transition hover:bg-red-500 active:scale-95 disabled:opacity-50"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
