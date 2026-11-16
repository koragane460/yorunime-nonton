import { Check, ChevronRight, Crown } from "lucide-react";
import { cn } from "@/lib/utils";

export type PromoKey = "sale" | "premium" | "more";

/**
 * Satu tawaran premium yang ringkas. Tiga panel promosi lama diganti karena
 * tidak ada tiga keputusan berbeda yang perlu diambil pengguna di sini.
 */
export function PremiumPromoBanner({
  className,
  onAction,
}: {
  className?: string;
  onAction?: (key: PromoKey) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onAction?.("premium")}
      className={cn(
        "group flex w-full items-center gap-3 rounded-xl border border-[rgba(230,196,124,.22)] bg-[#15130f] p-3 text-left transition hover:border-[rgba(230,196,124,.4)] hover:bg-[#191610] active:scale-[0.995]",
        className,
      )}
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-[rgba(230,196,124,.22)] bg-[rgba(230,196,124,.1)] text-[var(--gold)]">
        <Crown className="size-[18px]" strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="text-[11px] font-bold text-white">Yoru+</span>
          <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-[var(--gold)]">
            <Check className="size-3" /> Tanpa iklan
          </span>
        </span>
        <span className="mt-0.5 block truncate text-[10px] font-medium text-white/42">
          Kualitas tinggi, unduhan offline, dan akses lebih awal.
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-0.5 text-[10px] font-bold text-[var(--gold)]">
        Lihat paket
        <ChevronRight className="size-3.5 transition group-hover:translate-x-0.5" />
      </span>
    </button>
  );
}
