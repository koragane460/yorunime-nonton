import { Avatar } from "@/components/lstream-ui";
import { cn } from "@/lib/utils";

/**
 * Foto profil yang mengenakan SHOP BORDER milik user.
 *
 * `border` diambil dari `user.avatarBorder` ("none"/undefined = tanpa
 * bingkai). Kalau tidak ada border, tampilan persis seperti `Avatar`
 * biasa — jadi komponen ini aman dipakai di mana saja tanpa mengubah
 * layout yang sudah ada.
 */
export function FramedAvatar({
  border,
  src,
  seed,
  className,
  online,
}: {
  border?: string;
  src?: string;
  seed?: string;
  className?: string;
  online?: boolean;
}) {
  const id = border && border !== "none" ? border : undefined;
  if (!id) {
    return <Avatar src={src} seed={seed} className={className} online={online} />;
  }
  return (
    <span className={cn("yn-frame", `yn-frame-${id}`, className)}>
      {/* Aura: halo berpendar mengelilingi bingkai. */}
      <span className="yn-aura" aria-hidden />
      {/* Trail: ekor cahaya komet yang mengikuti karakter pengorbit. */}
      <span className="yn-trail" aria-hidden />
      <span className="yn-frame-in">
        <Avatar src={src} seed={seed} online={online} className="size-full" />
      </span>
    </span>
  );
}
