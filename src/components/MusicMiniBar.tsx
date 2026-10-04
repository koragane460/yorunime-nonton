// Mini bar musik: menempel tepat di atas navigasi bawah supaya user tetap
// bisa mengontrol lagu dari layar mana pun tanpa membuka aplikasi musik
// penuh. Musik sendiri tidak pernah berhenti; hanya bar-nya yang muncul.
//
// Dua bentuk:
//   - Bar (default): sampul kecil + judul + kontrol.
//   - Bulet: cuma sampul lagu, bentuk lingkaran. Di-toggle lewat tombol di
//     ujung bar. Permintaan: pas tombolnya dipencet miniplayer jadi bulat
//     kecil yang kelihatan sampulnya saja, dipencet lagi balik ke bar.
//
// Menyentuh area bar (bukan tombolnya) membuka tampilan Pemutar - sama
// seperti Spotify.

import { useState } from "react";
import {
  ChevronDown,
  Loader2,
  Pause,
  Play,
  SkipForward,
} from "lucide-react";
import { useLocation } from "react-router";
import { cn } from "@/lib/utils";
import { useMusicPlayer } from "@/components/MusicPlayer";

export function MusicMiniBar() {
  const p = useMusicPlayer();
  const location = useLocation();
  // Bentuk mini player: "bar" atau "bulet".
  const [round, setRound] = useState(false);
  if (!p.track) return null;
  if (p.screenOpen || location.pathname.startsWith("/nonton")) return null;

  const cover = p.track.cover ? (
    <img
      src={p.track.cover}
      alt=""
      className={cn(
        "shrink-0 object-cover",
        round ? "size-14 rounded-full" : "size-10 rounded-lg",
      )}
    />
  ) : (
    <span
      className={cn(
        "shrink-0 bg-white/15",
        round ? "size-14 rounded-full" : "size-10 rounded-lg",
      )}
    />
  );

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[62px] z-[61] flex justify-center px-3 md:bottom-[70px]">
      {round ? (
        /* Bentuk bulet: cuma sampul, plus tombol play di atasnya. */
        <div className="pointer-events-auto relative">
          <button
            onClick={() => setRound(false)}
            aria-label="Kembalikan mini player ke bentuk bar"
            className="block rounded-full ring-1 ring-white/25 transition active:scale-95"
          >
            {cover}
          </button>
          <button
            onClick={p.toggle}
            aria-label={p.playing ? "Jeda" : "Putar"}
            className="absolute inset-0 flex items-center justify-center rounded-full bg-black/45"
          >
            {p.loading ? (
              <Loader2 className="size-5 animate-spin text-white" />
            ) : p.playing ? (
              <Pause className="size-5 fill-white text-white" />
            ) : (
              <Play className="size-5 translate-x-px fill-white text-white" />
            )}
          </button>
          {/* Progres tipis mengelilingi sampul. */}
          {p.duration > 0 && (
            <span className="pointer-events-none absolute inset-0 rounded-full">
              <svg viewBox="0 0 100 100" className="size-full -rotate-90">
                <circle
                  cx="50"
                  cy="50"
                  r="48"
                  fill="none"
                  stroke="rgba(255,255,255,.25)"
                  strokeWidth="3"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="48"
                  fill="none"
                  stroke="currentColor"
                  className="text-[oklch(0.86_0.16_90)]"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 48}
                  strokeDashoffset={
                    2 * Math.PI * 48 * (1 - Math.min(1, p.position / p.duration))
                  }
                />
              </svg>
            </span>
          )}
        </div>
      ) : (
        /* Bentuk bar: sampul + judul + kontrol + tombol bulet. */
        <div className="pointer-events-auto relative w-full max-w-md overflow-hidden rounded-2xl border border-white/15 bg-black/85 shadow-2xl backdrop-blur-md">
          {/* Seluruh bar bisa dipencet untuk buka pemutar. Tombol di dalamnya
              memakai stopPropagation supaya tidak ikut memicu ini. */}
          <div
            role="button"
            tabIndex={0}
            onClick={p.openScreen}
            onKeyDown={(e) => {
              if (e.key === "Enter") p.openScreen();
            }}
            className="flex items-center gap-2.5 px-2 py-2"
          >
            {cover}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold text-white">
                {p.track.title}
              </span>
              <span className="block truncate text-[10px] text-white/55">
                {p.track.artist}
              </span>
            </span>

            <button
              onClick={(e) => {
                e.stopPropagation();
                p.toggle();
              }}
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
              onClick={(e) => {
                e.stopPropagation();
                p.next();
              }}
              aria-label="Lagu berikutnya"
              className="flex size-8 shrink-0 items-center justify-center rounded-full text-white/80"
            >
              <SkipForward className="size-4" />
            </button>
            {/* Tombol bentuk: bar <-> bulet. Dipencet lagi balik ke bar. */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setRound((v) => !v);
              }}
              aria-label="Ubah bentuk mini player"
              aria-pressed={round}
              title={round ? "Bentuk bar" : "Bentuk bulet"}
              className="flex size-8 shrink-0 items-center justify-center rounded-full text-white/60 transition hover:text-white"
            >
              <ChevronDown className="size-4" />
            </button>
          </div>

          {/* Bilah progres tipis di dasar bar. */}
          {p.duration > 0 && (
            <span className="absolute inset-x-3 bottom-0 h-px overflow-hidden rounded-full bg-white/10">
              <span
                className="block h-full bg-[oklch(0.86_0.16_90)]"
                style={{
                  width: `${Math.min(100, (p.position / p.duration) * 100)}%`,
                }}
              />
            </span>
          )}
        </div>
      )}
    </div>
  );
}