import { useEffect, useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";

// Cache di module-level supaya gambar hanya diambil sekali per sesi meski
// banyak layar (Gacha, Pengaturan, Profil) yang sama-sama butuh.
let cache: Record<string, string> | null = null;
let inflight: Promise<Record<string, string>> | null = null;

/** Ambil gambar karakter gacha: { [characterId]: url }. Anti-flash, nge-cache. */
export function useRosterImages() {
  const rosterImages = useAction(api.gacha.rosterImages);
  const [images, setImages] = useState<Record<string, string>>(() => cache ?? {});

  useEffect(() => {
    if (cache) {
      setImages(cache);
      return;
    }
    let alive = true;
    if (!inflight) {
      inflight = rosterImages()
        .then((r) => {
          cache = r ?? {};
          return cache;
        })
        .catch(() => {
          inflight = null;
          return {} as Record<string, string>;
        });
    }
    inflight.then((r) => {
      if (alive) setImages(r ?? {});
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return images;
}
