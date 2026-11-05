// DYNAMIC ISLAND MUSIK — muncul di atas layar (bentuk pil hitam seperti
// Dynamic Island iPhone) saat lagu tetap diputar setelah keluar dari layar
// Musik. Ketuk pil → melebar jadi kartu berisi kaset berputar, sampul,
// judul, progres, dan kontrol play/prev/next.

import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Maximize2,
  Pause,
  Play,
  SkipBack,
  SkipForward,
} from "lucide-react";
import { useLocation } from "react-router";
import { cn } from "@/lib/utils";
import { fmtTime, useMusicPlayer } from "@/components/MusicPlayer";

export function MusicMiniBar() {
  const p = useMusicPlayer();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  if (!p.track) return null;
  if (p.screenOpen || location.pathname.startsWith("/nonton")) return null;

  const pct =
    p.duration > 0 ? Math.min(1, Math.max(0, p.position / p.duration)) : 0;

  const cover = (size: string) =>
    p.track?.cover ? (
      <img
        src={p.track.cover}
        alt=""
        className={cn("shrink-0 rounded-lg object-cover", size)}
      />
    ) : (
      <span className={cn("shrink-0 rounded-lg bg-white/15", size)} />
    );

  return (
    <div className="pointer-events-none fixed inset-x-0 top-2 z-[70] flex justify-center px-3">
      <div
        className={cn(
          "pointer-events-auto overflow-hidden border border-white/12 bg-black/95 text-white shadow-[0_18px_40px_-18px_rgba(0,0,0,0.95)] backdrop-blur-xl transition-all duration-300",
          open
            ? "w-full max-w-sm rounded-[28px] p-3"
            : "h-12 w-[min(80vw,310px)] rounded-full px-2",
        )}
      >
        {open ? (
          <>
            <div className="flex items-center gap-2">
              {/* Kaset berputar */}
              <div className="relative h-[74px] w-[104px] shrink-0 overflow-hidden rounded-xl border border-white/15 bg-gradient-to-br from-[#2a2f3a] to-[#12151c]">
                <span className="absolute inset-x-2 top-2 flex justify-between">
                  {[0, 1].map((i) => (
                    <span
                      key={i}
                      className="relative flex size-7 items-center justify-center rounded-full border-2 border-white/25 bg-black/60"
                    >
                      <span
                        className="absolute inset-0 animate-[spin_3s_linear_infinite] rounded-full"
                        style={{ animationDirection: i ? "reverse" : "normal" }}
                      >
                        {[0, 60, 120].map((deg) => (
                          <span
                            key={deg}
                            className="absolute left-1/2 top-1/2 h-2.5 w-[2px] origin-bottom -translate-x-1/2 -translate-y-full rounded bg-white/70"
                            style={{ transform: `rotate(${deg}deg)` }}
                          />
                        ))}
                      </span>
                      <span className="size-1.5 rounded-full bg-white/80" />
                    </span>
                  ))}
                </span>
                <span className="absolute inset-x-2 bottom-1.5 flex items-center gap-1.5 rounded-md bg-white/10 px-1.5 py-1">
                  {cover("size-6")}
                  <span className="min-w-0 truncate text-[8px] font-bold text-white/70">
                    {p.track.artist}
                  </span>
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-black leading-tight">
                  {p.track.title}
                </p>
                <p className="mt-0.5 truncate text-[10px] text-white/50">
                  {p.track.artist}
                </p>
                <div className="mt-1.5 flex items-center gap-1">
                  <span className="flex items-end gap-0.5" aria-hidden>
                    {[0, 1, 2, 3].map((i) => (
                      <span
                        key={i}
                        className={cn(
                          "w-[2px] rounded-full bg-[#FFD23F]",
                          p.playing ? "animate-pulse" : "opacity-40",
                        )}
                        style={{
                          height: `${4 + ((i * 5) % 9)}px`,
                          animationDelay: `${i * 120}ms`,
                        }}
                      />
                    ))}
                  </span>
                  <span className="text-[9px] font-bold text-white/35">
                    {p.playing ? "Sedang diputar" : "Dijeda"}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setOpen(false)}
                aria-label="Kecilkan"
                className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/60"
              >
                <ChevronUp className="size-4" />
              </button>
            </div>

            {/* Notch progres — garis dengan penanda posisi lagu. */}
            <button
              onClick={(e) => {
                const el = e.currentTarget;
                const r = el.getBoundingClientRect();
                const ratio = Math.min(
                  1,
                  Math.max(0, (e.clientX - r.left) / r.width),
                );
                if (p.duration > 0) p.seek(ratio * p.duration);
              }}
              aria-label="Geser posisi lagu"
              className="relative mt-2.5 block h-1.5 w-full rounded-full bg-white/12"
            >
              <span
                className="absolute inset-y-0 left-0 rounded-full bg-[#FFD23F]"
                style={{ width: `${pct * 100}%` }}
              />
              <span
                className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow"
                style={{ left: `${pct * 100}%` }}
              />
            </button>
            <div className="mt-1 flex justify-between text-[9px] tabular-nums text-white/40">
              <span>{fmtTime(p.position)}</span>
              <span>{fmtTime(p.duration)}</span>
            </div>

            <div className="mt-1 flex items-center justify-center gap-3">
              <button
                onClick={p.prev}
                aria-label="Lagu sebelumnya"
                className="flex size-9 items-center justify-center rounded-full text-white/75 active:scale-95"
              >
                <SkipBack className="size-5 fill-current" />
              </button>
              <button
                onClick={p.toggle}
                aria-label={p.playing ? "Jeda" : "Putar"}
                className="flex size-11 items-center justify-center rounded-full bg-white text-black active:scale-95"
              >
                {p.loading ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : p.playing ? (
                  <Pause className="size-5 fill-black" />
                ) : (
                  <Play className="size-5 translate-x-px fill-black" />
                )}
              </button>
              <button
                onClick={() => p.next()}
                aria-label="Lagu berikutnya"
                className="flex size-9 items-center justify-center rounded-full text-white/75 active:scale-95"
              >
                <SkipForward className="size-5 fill-current" />
              </button>
              <button
                onClick={p.openScreen}
                aria-label="Buka pemutar musik"
                className="ml-2 flex size-9 items-center justify-center rounded-full bg-white/10 text-white/70"
              >
                <Maximize2 className="size-4" />
              </button>
            </div>
          </>
        ) : (
          <div className="flex h-full items-center gap-2">
            <button
              onClick={() => setOpen(true)}
              className="flex min-w-0 flex-1 items-center gap-2 text-left"
              aria-label="Buka kartu pemutar"
            >
              {cover("size-8")}
              <span className="flex items-end gap-0.5" aria-hidden>
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className={cn(
                      "w-[2px] rounded-full bg-[#FFD23F]",
                      p.playing ? "animate-pulse" : "opacity-40",
                    )}
                    style={{
                      height: `${5 + ((i * 4) % 8)}px`,
                      animationDelay: `${i * 130}ms`,
                    }}
                  />
                ))}
              </span>
              <span className="min-w-0 flex-1 truncate text-[11px] font-bold">
                {p.track.title}
              </span>
            </button>
            <button
              onClick={p.toggle}
              aria-label={p.playing ? "Jeda" : "Putar"}
              className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white text-black"
            >
              {p.loading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : p.playing ? (
                <Pause className="size-3.5 fill-black" />
              ) : (
                <Play className="size-3.5 translate-x-px fill-black" />
              )}
            </button>
            <button
              onClick={() => setOpen(true)}
              aria-label="Perbesar"
              className="flex size-6 shrink-0 items-center justify-center rounded-full text-white/50"
            >
              <ChevronDown className="size-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

