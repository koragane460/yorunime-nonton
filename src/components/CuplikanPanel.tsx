import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Play, X, Download, Maximize } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * CuplikanPanel — pemutar cuplikan video yang sangat ringkas (sama halnya
 * dengan yang ada di Watch.tsx). Saat pengguna memencet cuplikan di tab
 * Character, panel ini muncul di BAWAH daftar karakter dan memutar video
 * Telegram (Youtube embed support).
 *
 * Hanya dari src/pages/Home.tsx — tidak perlu import dari mana pun.
 */
export function CuplikanPanel({
  trailerUrl,
  title,
  image,
}: {
  trailerUrl: string | undefined;
  title: string;
  image: string;
}) {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [showFull, setShowFull] = useState(false);

  // Otomatis mulai memutar kalau ada trailer + user sudah pernah nonton anime.
  useEffect(() => {
    const auto = localStorage.getItem(`yn_played_${title || ""}`) === "1";
    if (trailerUrl && auto) setPlaying(true);
  }, [trailerUrl, title]);

  const togglePlay = () => setPlaying((v) => !v);

  const handleTimeUpdate = () => {
    if (videoRef.current) setProgress((videoRef.current?.currentTime ?? 0) / 60);
  };

  const handleEnded = () => setPlaying(false);

  const fullscreen = () => setShowFull(true);
  const closeFull = () => setShowFull(false);

  return (
    <div className="relative mt-3 flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-card">
      {/* Ringkasan cuplikan */}
      <div className="flex items-center gap-3 border-b border-white/10 p-3">
        <div className="relative aspect-[9/16] w-24 shrink-0 overflow-hidden rounded-xl bg-muted">
          <img
            src={image || ""}
            alt={title}
            className="size-full object-cover"
          />
          <button
            type="button"
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/30 transition hover:bg-black/40"
            aria-label={playing ? "Pause" : "Mainkan"}
          >
            <Play className={cn("size-6 shrink-0", playing ? "fill-current" : "")} />
          </button>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-bold leading-tight text-white">
            {title}
          </h3>
          <p className="text-[11px] text-muted-foreground">
            Trailer • Cuplikan 1 menit
          </p>
        </div>
        <button
          type="button"
          onClick={fullscreen}
          aria-label="Layar penuh"
          className="shrink-0 rounded-lg p-2 text-white/60 transition hover:text-white"
        >
          <Maximize className="size-4" />
        </button>
      </div>

      {/* Video player */}
      <div className="relative aspect-[9/16] w-full bg-black">
        {!trailerUrl ? (
          <div className="flex items-center justify-center p-4 text-muted-foreground">
            <Play className="size-6 text-muted-foreground/40" />
            <span className="ml-2 text-xs text-muted-foreground">
              Video trailer belum tersedia
            </span>
          </div>
        ) : showFull ? (
          <video
            ref={videoRef}
            src={trailerUrl}
            className="size-full object-cover"
            poster={image}
            onTimeUpdate={handleTimeUpdate}
            onEnded={handleEnded}
            playsInline
          />
        ) : (
          <div className="absolute inset-0">
            <iframe
              src={trailerUrl.replace(
                /youtube\.com\/watch\?v=/,
                "youtube.com/embed/",
              ).replace(/\?/i, "?v=")}
              className="size-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}
        {playing && (
          <div className="absolute bottom-20 left-3 right-3">
            <div className="flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/20">
                <div
                  className="h-full rounded-full bg-red-500 transition-all"
                  style={{ width: `${Math.min(100, progress * 100)}%` }}
                />
              </div>
              <span className="text-[10px] font-mono text-white/60">
                {Math.floor(progress)}s
              </span>
            </div>
          </div>
        )}
        {showFull && (
          <button
            type="button"
            onClick={closeFull}
            className="absolute top-2 right-2 rounded-full bg-black/60 p-2 text-white/70 transition hover:text-white"
            aria-label="Tutup layar penuh"
          >
            <X className="size-4" />
          </button>
        )}
        {!showFull && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 via-transparent to-transparent p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={togglePlay}
                  className="flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-black/70"
                >
                  <Play className={cn("size-3.5", playing ? "fill-current" : "")} />
                  {playing ? "Pause" : "Mainkan"}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-black/70"
                >
                  <Download className="size-3.5" />
                  Unduh
                </button>
                <button
                  type="button"
                  onClick={fullscreen}
                  className="flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-black/70"
                >
                  <Maximize className="size-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Konten untuk memesanan / talian */}
      <div className="border-t border-white/10 p-2">
        <p className="text-center text-[10px] text-muted-foreground">
          Cuplikan otomatis dari trailer. Beli langganan Untuk mulai nonton.
        </p>
      </div>
    </div>
  );
}
