import { useEffect, useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { SectionTitle } from "@/components/lstream-ui";

type Char = {
  id: string;
  name: string;
  image: string;
  meta?: string;
  bio?: string;
};

/**
 * Bagian "Character" di layar detail: kolom mendatar berisi foto karakter
 * PALING IKONIK (urut favorit dari AniList) + nama.
 *
 * Sengaja TIDAK menampilkan teks personalitas/umur/V.A. — yang diminta hanya
 * kolom foto karakter paling ikonik. Data diambil dari
 * `api.anime.animeCharacters` yang mencari via id MAL, lalu jatuh ke judul
 * (donghua/manga/manhwa tetap bisa dapat karakter lewat judulnya).
 */
export function CharacterRow({
  idMal,
  title,
}: {
  idMal?: string;
  title?: string;
}) {
  const fetchChars = useAction(api.anime.animeCharacters);
  const [chars, setChars] = useState<Char[] | null>(null);

  useEffect(() => {
    let alive = true;
    setChars(null);
    fetchChars({ idMal, title })
      .then((r) => {
        if (alive) setChars((r as Char[]) ?? []);
      })
      .catch(() => {
        if (alive) setChars([]);
      });
    return () => {
      alive = false;
    };
  }, [fetchChars, idMal, title]);

  // Masih memuat → baris skeleton supaya tata letak tidak melompat.
  if (chars === null) {
    return (
      <div className="mt-5">
        <SectionTitle>Character</SectionTitle>
        <div className="thin-scroll flex gap-2.5 overflow-x-auto pb-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="w-24 shrink-0">
              <div className="skeleton aspect-[3/4] w-full rounded-xl" />
              <div className="skeleton mt-1.5 h-3 w-3/4 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (chars.length === 0) return null;

  return (
    <div className="mt-5">
      <SectionTitle>Character</SectionTitle>
      <div className="thin-scroll -mx-3 flex gap-2.5 overflow-x-auto px-3 pb-1">
        {chars.slice(0, 16).map((c) => (
          <div key={c.id} className="w-24 shrink-0">
            <div className="aspect-[3/4] w-full overflow-hidden rounded-xl border border-border/60 bg-muted">
              {c.image ? (
                <img
                  src={c.image}
                  alt={c.name}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              ) : null}
            </div>
            <p className="mt-1 line-clamp-2 text-[11px] font-medium leading-4">
              {c.name}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
