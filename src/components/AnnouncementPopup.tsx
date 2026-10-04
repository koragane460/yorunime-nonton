import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Megaphone, X } from "lucide-react";

/**
 * Popup pengumuman.
 *
 * Muncul di atas halaman kalau ada pengumuman aktif dari developer yang belum
 * pernah dilihat user ini di perangkat ini. Satu per satu (paling baru dulu)
 * supaya tidak menumpuk kalau developer mengirim beberapa pesan sekaligus.
 * Lebar dibatasi max-w-md dan tingginya mengikuti isi, tidak menutup layar.
 */

const SEEN_KEY = "yn-announcement-seen";

function readSeen(): string[] {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v.filter((x: unknown) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeSeen(ids: string[]) {
  try {
    // Batasi 40 id terbaru supaya localStorage tidak menumpuk selamanya.
    localStorage.setItem(SEEN_KEY, JSON.stringify(ids.slice(0, 40)));
  } catch {
    /* storage penuh atau ditolak: pesan akan muncul lagi lain kali */
  }
}

export function AnnouncementPopup() {
  const list = useQuery(api.moderation.activeAnnouncements, {});
  // Antrean id pesan yang belum pernah dilihat, terbaru di depan.
  const [queue, setQueue] = useState<string[]>([]);

  useEffect(() => {
    if (!list) return;
    const done = readSeen();
    setQueue(list.filter((a) => !done.includes(a._id)).map((a) => a._id));
  }, [list]);

  const currentId = queue[0];
  const current = currentId
    ? (list ?? []).find((a) => a._id === currentId)
    : undefined;
  if (!current) return null;

  const close = () => {
    const next = readSeen();
    if (!next.includes(current._id)) next.unshift(current._id);
    writeSeen(next);
    setQueue((q) => q.slice(1));
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 top-1/2 z-[70] flex -translate-y-1/2 justify-center px-4">
      <div
        role="status"
        className="pop-enter pointer-events-auto relative w-full max-w-md border-2 border-brand/40 bg-black/95 p-4 pr-12 shadow-2xl backdrop-blur-xl"
      >
        <div className="flex items-center gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center bg-brand/20">
            <Megaphone className="size-4 text-brand" />
          </span>
          <p className="text-[13px] font-bold">Pengumuman</p>
          {queue.length > 1 && (
            <span className="shrink-0 text-[11px] text-white/50">
              sisa {queue.length - 1}
            </span>
          )}
        </div>
        <p className="mt-2 whitespace-pre-line text-[13px] leading-snug text-white/90">
          {current.message}
        </p>
        <button
          onClick={close}
          aria-label="Tutup pengumuman"
          className="absolute right-2 top-2 flex size-10 items-center justify-center text-white/70 transition hover:bg-white/10 hover:text-white"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}