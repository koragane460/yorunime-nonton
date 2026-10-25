import { cn } from "@/lib/utils";

/**
 * Tombol kembali gaya STRIP PANAH — garis penuh + kepala panah, TANPA
 * background rounded. Dipakai di semua layar (kiri atas) sesuai permintaan.
 */
export function StripBackIcon({ className }: { className?: string }) {
  return (
    <svg
      width="26"
      height="18"
      viewBox="0 0 26 18"
      fill="none"
      className={className}
      aria-hidden
    >
      <path
        d="M25 9H2M8 2 1.5 9 8 16"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function StripBack({
  onClick,
  className,
  label = "Kembali",
}: {
  onClick: () => void;
  className?: string;
  label?: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={cn(
        "-ml-1 flex items-center py-1 pr-2 text-white/90 transition active:opacity-60",
        className,
      )}
    >
      <StripBackIcon />
    </button>
  );
}
