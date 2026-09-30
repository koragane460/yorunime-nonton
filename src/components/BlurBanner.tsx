import { cn } from "@/lib/utils";

/**
 * Banner bercorak foto: fotonya diperbesar + diblur halus, lalu diberi
 * gradasi gelap di bawah supaya teks di atasnya tetap terbaca. Kalau tidak
 * ada fotonya, banner jatuh ke warna gelap (bukan kosong).
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
            className="absolute inset-0 h-full w-full scale-150 object-cover blur-2xl opacity-80"
          />
          {/* Kabut gelap biar tidak terlalu mencolok */}
          <div className="absolute inset-0 bg-black/25" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/35 to-transparent" />
        </>
      ) : (
        <div className="yn-banner absolute inset-0" />
      )}
      {children}
    </div>
  );
}