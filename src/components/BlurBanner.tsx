import { cn } from "@/lib/utils";

/**
 * Banner akun: foto tampil apa adanya (tajam, tanpa blur) lalu luntur pelan
 * ke warna background di bagian bawah. Tidak ada filter apa pun di sini,
 * supaya banner tidak pernah terbaca sebagai kotak buram.
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
    <div className={cn("yn-banner-box bg-[#0b0b14]", className)}>
      {src ? (
        <>
          <img
            src={src}
            alt=""
            aria-hidden
            className="absolute inset-0 size-full object-cover"
          />
          {/* Redup tipis supaya username dan badge tetap kebaca */}
          <div className="absolute inset-0 bg-black/30" />
          {/* Luntur ke warna halaman, mulai dari bawah */}
          <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-background via-background/80 to-transparent" />
        </>
      ) : (
        <div className="yn-banner absolute inset-0" />
      )}
      {children}
    </div>
  );
}