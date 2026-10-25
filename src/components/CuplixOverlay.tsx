// Cuplix — overlay FULLSCREEN klip TikTok untuk satu judul anime.
//
// Dibuka dari tab "Cuplix" di detail anime (pengganti Like). Feed vertikal
// ala TikTok: tiap klip memenuhi layar dan di-snap. Klip di-embed lewat
// player resmi TikTok (https://www.tiktok.com/player/v1/:id) — tidak ada
// penyimpanan file mentah. Kalau pencarian TikTok diblokir dari aplikasi,
// overlay jatuh ke tombol "Cari di TikTok" (tautan resmi).
import { useEffect, useState } from "react";
import { useAction } from "convex/react";
import { Loader2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { StripBack } from "@/components/StripBack";

type Clip = { id: string; desc: string; author: string };

export function CuplixOverlay({
  title,
  onClose,
}: {
  title: string;
  onClose: () => void;
}) {
  const searchClips = useAction(api.cuplikan.tiktokClips);
  const [clips, setClips] = useState<Clip[] | null>(null);

  useEffect(() => {
    let alive = true;
    setClips(null);
    searchClips({ q: title, limit: 8 })
      .then((r: unknown) => {
        if (alive) setClips(((r ?? []) as Clip[]) ?? []);
      })
      .catch(() => {
        if (alive) setClips([]);
      });
    return () => {
      alive = false;
    };
  }, [title, searchClips]);

  // Kunci scroll body + tutup pakai Escape selama overlay terbuka.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const searchUrl = `https://www.tiktok.com/search?q=${encodeURIComponent(
    `${title} anime`,
  )}`;

  return (
    <div className="fixed inset-0 z-[150] flex flex-col bg-black">
      {/* Header: strip back + judul + label TikTok */}
      <div className="relative z-10 flex items-center gap-3 bg-gradient-to-b from-black/80 to-transparent px-3 pb-3 pt-4">
        <StripBack onClick={onClose} className="text-white" label="Tutup Cuplix" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-white">Cuplix</p>
          <p className="truncate text-[11px] text-white/55">{title}</p>
        </div>
        <span className="shrink-0 rounded-full border border-white/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white/70">
          TikTok
        </span>
      </div>

      {/* Feed: satu klip per layar, snap vertikal */}
      <div className="min-h-0 flex-1">
        {clips === null ? (
          <div className="flex h-full flex-col items-center justify-center gap-3">
            <Loader2 className="size-6 animate-spin text-white/75" aria-hidden />
            <p className="text-xs text-white/55">Mengambil Cuplix dari TikTok…</p>
          </div>
        ) : clips.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
            <p className="text-sm font-bold text-white">Cuplix tidak ditemukan</p>
            <p className="max-w-[17rem] text-xs leading-relaxed text-white/55">
              Pencarian TikTok sedang diblokir dari aplikasi. Buka TikTok untuk
              menemukan Cuplix {title} secara manual.
            </p>
            <a
              href={searchUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-[#FE2C55] px-4 py-2 text-xs font-bold text-white"
            >
              Cari di TikTok
            </a>
          </div>
        ) : (
          <div className="thin-scroll h-full snap-y snap-mandatory overflow-y-auto">
            {clips.map((c) => (
              <div
                key={c.id}
                className="flex h-full w-full snap-start items-center justify-center"
              >
                <iframe
                  src={`https://www.tiktok.com/player/v1/${c.id}`}
                  allow="fullscreen; encrypted-media; picture-in-picture"
                  title={c.desc || `Cuplix ${title}`}
                  className="aspect-[9/16] h-full w-auto border-0 bg-black"
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
