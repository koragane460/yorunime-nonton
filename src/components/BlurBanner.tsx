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
            className="absolute inset-0 size-full scale-110 object-cover"
          />
          {/* Kabut ringan: foto tetap terbaca sebagai foto, tapi tidak tajam
              menusuk mata. Sengaja tipis supaya tidak jadi kotak warna. */}
          <div className="absolute inset-0 bg-black/45" />
          <div className="absolute inset-0 backdrop-blur-md" />
          {/* Luntur ke warna halaman, mulai dari bawah (2/3 tinggi) */}
          <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-background via-background/85 to-transparent" />
        </>
      ) : (
        <div className="yn-banner absolute inset-0" />
      )}
      {children}
    </div>
  );
}