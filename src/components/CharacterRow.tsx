import { useEffect, useState } from "react";
import { useAction } from "convex/react";
import { X } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { SectionTitle } from "@/components/lstream-ui";
import { avatarFallback } from "@/lib/lstream";

type Char = {
  id: string;
  name: string;
  image: string;
  meta?: string;
  bio?: string;
};

/** Umur dari `meta` ("Utama · 25 tahun · …") — dikembalikan tanpa satuan. */
function ageOf(meta?: string): string {
  const seg = (meta ?? "")
    .split("·")
    .map((s) => s.trim())
    .find((s) => /\btahun\b/i.test(s));
  return seg ? seg.replace(/\btahun\b/i, "").trim() : "";
}

/** Personalitas: `bio` dari AniList, dipotong supaya kotak tidak terlalu tinggi. */
function personalityOf(bio?: string): string {
  const t = (bio ?? "").trim();
  if (!t) return "";
  return t.length > 220 ? `${t.slice(0, 217).trimEnd()}…` : t;
}

/**
 * Bagian "Character" di layar detail: kolom mendatar berisi foto karakter
 * PALING IKONIK (urut favorit dari AniList) + nama.
 *
 * - Karakter tanpa foto memakai avatar cadangan (dicebear pixel-art), jadi
 *   tidak pernah ada kotak "NO IMAGE" di tengah deretan.
 * - Menekan satu karakter membuka kotak di BAWAH deretan berisi nama, umur,
 *   dan personalitas. Background kotaknya memakai foto karakter yang sama
 *   (di-blur + digelapkan) supaya terasa nyambung.
 *
 * Data diambil dari `api.anime.animeCharacters` yang mencari via id MAL, lalu
 * jatuh ke judul (donghua/manga/manhwa tetap bisa dapat karakter lewat judul).
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
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setChars(null);
    setOpenId(null);
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

  const shown = chars.slice(0, 16);
  const open = shown.find((c) => c.id === openId) ?? null;
  const openImg = open ? (open.image || avatarFallback(open.name)) : "";
  const openAge = open ? ageOf(open.meta) : "";
  const openPersonality = open ? personalityOf(open.bio) : "";

  return (
    <div className="mt-5">
      <SectionTitle>Character</SectionTitle>
      {/* KARAKTER MENGALIR KE BAWAH (grid 2 kolom), bukan geser ke samping.
          Kotak detail selalu muncul di bawah daftar. */}
      <div className="grid grid-cols-2 gap-2.5">
        {shown.map((c) => {
          const active = c.id === openId;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setOpenId(active ? null : c.id)}
              aria-pressed={active}
              className="flex items-start gap-2.5 rounded-xl border border-border/60 bg-card/50 p-2 text-left transition active:scale-[0.99]"
            >
              <div
                className={
                  "h-20 w-16 shrink-0 overflow-hidden rounded-lg border bg-muted transition " +
                  (active ? "border-primary" : "border-border/60")
                }
              >
                <img
                  src={c.image || avatarFallback(c.name)}
                  alt={c.name}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className={
                    "line-clamp-2 text-[11px] font-bold leading-tight " +
                    (active ? "text-primary" : "")
                  }
                >
                  {c.name}
                </p>
                <p className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground">
                  {openAge || (c.meta ?? "").split("·")[0]?.trim() || ""}
                </p>
                <p className="mt-1 line-clamp-3 text-[10px] leading-snug text-white/70">
                  {personalityOf(c.bio) || "Personalitas: belum tersedia."}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Kotak detail karakter — muncul tepat di bawah daftar. Backgroundnya
          foto karakter yang sama, di-blur & digelapkan supaya teks tetap jelas. */}
      {open && (
        <div className="relative mt-3 overflow-hidden rounded-2xl border border-white/10">
          <img
            src={openImg}
            alt=""
            aria-hidden
            className="pointer-events-none absolute inset-0 h-full w-full scale-125 object-cover blur-2xl brightness-[0.35]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/85 via-black/65 to-black/35"
          />
          <div className="relative flex gap-3 p-3">
            <img
              src={openImg}
              alt={open.name}
              className="size-20 shrink-0 rounded-xl border border-white/15 object-cover"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-bold leading-tight text-white">
                  {open.name}
                </p>
                <button
                  type="button"
                  onClick={() => setOpenId(null)}
                  aria-label="Tutup detail karakter"
                  className="-mr-1 -mt-1 shrink-0 rounded-full p-1 text-white/60 transition hover:text-white"
                >
                  <X className="size-4" />
                </button>
              </div>
              <p className="mt-0.5 text-[11px] text-white/65">
                {openAge ? `Umur: ${openAge}` : (open.meta ?? "").split("·")[0]?.trim()}
              </p>
              <p className="mt-1.5 line-clamp-4 text-[11px] leading-relaxed text-white/85">
                {openPersonality || "Personalitas belum tersedia untuk karakter ini."}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
