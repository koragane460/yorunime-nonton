import { useState } from "react";
import { useMutation } from "convex/react";
import { Check, X } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

/**
 * Dua tombol Terima & Tolak untuk satu permintaan pertemanan.
 *
 * Sekali pencet langsung berlaku, tanpa konfirmasi kedua: dialog konfirmasi
 * bikin user mengira tombolnya mati, terutama di dalam panel chat yang
 * sering Dirender ulang. Sambil request diproses, kedua tombol dinonaktifkan
 * supaya tidak terkirim dua kali.
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
      onError?.(
        e instanceof Error
          ? e.message.replace(/^\[CONVEX[^\]]*\]\s*/, "")
          : "Gagal menyimpan",
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex shrink-0 items-center gap-1.5 self-center">
      <button
        type="button"
        disabled={busy !== null}
        onClick={() => void run(true)}
        className="flex h-9 items-center gap-1 rounded-lg bg-white px-3 text-xs font-semibold text-black transition enabled:hover:bg-white/85 disabled:opacity-40"
      >
        <Check className="size-4" />
        {busy === "yes" ? "..." : "Terima"}
      </button>
      <button
        type="button"
        disabled={busy !== null}
        onClick={() => void run(false)}
        className="flex h-9 items-center gap-1 rounded-lg border border-white/20 px-3 text-xs font-semibold text-white transition enabled:hover:bg-white/10 disabled:opacity-40"
      >
        <X className="size-4" />
        {busy === "no" ? "..." : "Tolak"}
      </button>
    </div>
  );
}
