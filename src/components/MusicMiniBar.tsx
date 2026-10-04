// Mini bar musik: bar kecil yang menempel di atas navigasi bawah supaya user
// tetap bisa controlling lagu dari layar mana pun tanpa membuka aplikasi musik
// penuh. Musik sendiri tidak pernah berhenti; hanya bar-nya yang muncul.

import { Loader2, Pause, Play, SkipForward, X } from "lucide-react";
import { useLocation } from "react-router";
import { cn } from "@/lib/utils";
import { useMusicPlayer } from "@/components/MusicPlayer";

/**
 * Sembunyi kalau tidak ada lagu, sedang di layar nonton (supaya tidak
 * menabrak video), atau saat aplikasi musik sedang dibuka (biaya dobel).
 * Status "layar musik terbuka" datang dari context, bukan variabel modul,
 * supaya bar ini ikut ter-render ulang saat statusnya berubah.
 */
export function MusicMiniBar() {
  const p = useMusicPlayer();
  const location = useLocation();
  if (!p.track) return null;
  if (p.screenOpen || location.pathname.startsWith("/nonton")) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[68px] z-[61] flex justify-center px-3 md:bottom-[76px]">
      <div className="pointer-events-auto relative flex w-full max-w-md items-center gap-2.5 rounded-2xl border border-white/15 bg-black/80 py-2 pl-2 pr-2.5 shadow-2xl backdrop-blur-md">
        <button
          onClick={p.openScreen}
          aria-label="Buka pemutar musik"
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
        >
          {p.track.cover ? (
            <img
              src={p.track.cover}
              alt=""
              className="size-9 shrink-0 rounded-lg object-cover"
            />
          ) : (
            <span className="size-9 shrink-0 rounded-lg bg-white/15" />
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-semibold text-white">
              {p.track.title}
            </span>
            <span className="block truncate text-[10px] text-white/55">
              {p.track.artist}
            </span>
          </span>
        </button>

        <button
          onClick={p.toggle}
          aria-label={p.playing ? "Jeda" : "Putar"}
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-black"
        >
          {p.loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : p.playing ? (
            <Pause className="size-4 fill-black" />
          ) : (
            <Play className="size-4 translate-x-px fill-black" />
          )}
        </button>
        <button
          onClick={() => p.next()}
          aria-label="Lagu berikutnya"
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-white/80"
        >
          <SkipForward className="size-4" />
        </button>
        <button
          onClick={p.clearQueue}
          aria-label="Hentikan dan kosongkan antrean"
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-full",
            "text-white/45 transition hover:text-white",
          )}
        >
          <X className="size-4" />
        </button>

        {/* Bilah progres tipis di dasar bar */}
        {p.duration > 0 && (
          <span className="absolute inset-x-3 bottom-0 h-px overflow-hidden rounded-full bg-white/10">
            <span
              className="block h-full bg-white/70"
              style={{
                width: `${Math.min(100, (p.position / p.duration) * 100)}%`,
              }}
            />
          </span>
        )}
      </div>
    </div>
  );
}