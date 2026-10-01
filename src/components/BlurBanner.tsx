import { cn } from "@/lib/utils";

/**
 * Banner akun: fotonya tampil apa adanya (tajam, tidak di-blur seluruhnya).
 * Hanya kaki banner yang diburamkan supaya foto menyatu pelan ke konten di
 * bawahnya dan teks tetap terbaca.
 */
export function BlurBanner({
  src,
  className,
  children,
}: {
  src?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("relative overflow-hidden bg-[#0b0b14]", className)}>
      {src ? (
        <>
          <img
            src={src}
            alt=""
            aria-hidden
            className="absolute inset-0 size-full object-cover"
          />
          {/* Redup tipis supaya username/badge tetap kebaca */}
          <div className="absolute inset-0 bg-black/25" />
          {/* Kabut hanya di bawah, bagian atas tetap tajam */}
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-background via-background/45 to-transparent" />
        </>
      ) : (
        <div className="yn-banner absolute inset-0" />
      )}
      {children}
    </div>
  );
}