import { useEffect, useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { ChevronLeft, Grid3X3, Search, Star, X } from "lucide-react";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

type Genre = { id: string; name: string };
type Card = {
  id: string;
  title: string;
  image?: string;
  score?: number;
  status?: string;
  source?: string;
};

/**
 * KATALOG A–Z — semua judul yang berawalan huruf terpilih.
 * Rail huruf di kiri, grid poster di kanan; tetap satu layar penuh.
 */
export function AZCatalog({
  letter,
  onLetter,
  onClose,
  onPick,
}: {
  letter: string;
  onLetter: (l: string) => void;
  onClose: () => void;
  onPick: (id: string, title?: string, source?: string) => void;
}) {
  const load = useAction(api.anime.animeByLetter);
  const [rows, setRows] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setRows([]);
    void load({ letter, page: 1 })
      .then((list) => {
        if (alive) setRows((list ?? []) as Card[]);
      })
      .catch(() => {
        if (alive) setRows([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [letter, load]);

  return (
    <div className="screen-enter fixed inset-0 z-[92] flex flex-col bg-[#07080d]">
      <header className="flex items-center gap-3 border-b border-white/10 px-3 py-3">
        <button
          onClick={onClose}
          aria-label="Kembali"
          className="flex size-9 shrink-0 items-center justify-center text-white/85 transition active:scale-90"
        >
          <ChevronLeft className="size-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-black uppercase tracking-[0.22em] text-white/35">
            Katalog
          </p>
          <h1 className="truncate font-display text-xl font-black leading-tight text-white">
            Awalan {letter}
          </h1>
        </div>
        <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[10px] font-bold text-white/50">
          {loading ? "…" : `${rows.length} judul`}
        </span>
        <button
          onClick={onClose}
          aria-label="Tutup"
          className="flex size-9 shrink-0 items-center justify-center text-white/55 transition active:scale-90"
        >
          <X className="size-4" />
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Rail A–Z vertikal di kiri — lebih lebar & membulat. */}
        <div className="thin-scroll m-2 flex w-16 shrink-0 flex-col items-center gap-1 overflow-y-auto rounded-[22px] border border-white/10 bg-white/[0.045] p-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {LETTERS.map((l) => (
            <button
              key={l}
              onClick={() => onLetter(l)}
              aria-pressed={l === letter}
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-[14px] font-display text-[12px] font-black transition",
                l === letter
                  ? "bg-gold-strong text-black shadow-[0_8px_18px_-10px_rgba(255,210,63,.9)]"
                  : "text-white/40 hover:bg-white/[0.08] hover:text-white/80",
              )}
            >
              {l}
            </button>
          ))}
        </div>

        <div className="thin-scroll min-w-0 flex-1 overflow-y-auto px-3 py-3">
          {loading ? (
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="skeleton aspect-[2/3] w-full rounded-xl" />
                  <div className="skeleton h-2.5 w-4/5 rounded" />
                </div>
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <Search className="size-7 text-white/25" />
              <p className="text-sm font-bold text-white/70">
                Belum ada judul berawalan {letter}
              </p>
              <p className="max-w-[15rem] text-[11px] leading-relaxed text-white/40">
                Coba huruf lain di rail kiri.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-x-2 gap-y-3">
              {rows.map((a) => (
                <button
                  key={a.id}
                  onClick={() => onPick(a.id, a.title, a.source ?? "anilist")}
                  className="group min-w-0 text-left"
                >
                  <span className="relative block overflow-hidden rounded-xl border border-white/10 bg-black">
                    {a.image ? (
                      <img
                        src={a.image}
                        alt=""
                        loading="lazy"
                        className="aspect-[2/3] w-full object-cover transition duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <span className="flex aspect-[2/3] w-full items-center justify-center bg-white/[0.04]">
                        <Grid3X3 className="size-5 text-white/20" />
                      </span>
                    )}
                    {typeof a.score === "number" && a.score > 0 && (
                      <span className="absolute bottom-1 right-1 inline-flex items-center gap-0.5 rounded-md bg-black/75 px-1 py-0.5 text-[8.5px] font-black text-gold-strong backdrop-blur">
                        <Star className="size-2 fill-current" />
                        {a.score.toFixed(1)}
                      </span>
                    )}
                  </span>
                  <span className="mt-1 line-clamp-2 block text-[10.5px] font-semibold leading-snug text-white/80">
                    {a.title}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * QUICK GENRE — kotak "Genre" di kiri atas, "Katalog" di kanan.
 * Katalog membuka baris huruf A–Z horizontal; pilih huruf → katalog penuh.
 */
export function QuickGenre({
  genres,
  onOpenGenre,
  onPick,
}: {
  genres: Genre[];
  onOpenGenre: (id: string) => void;
  onPick: (id: string, title?: string, source?: string) => void;
}) {
  const [tab, setTab] = useState<"genre" | "catalog">("genre");
  const [letter, setLetter] = useState<string | null>(null);

  return (
    <>
      <section className="fade-enter relative mt-5 overflow-hidden rounded-[24px] border border-rose-300/15 bg-[linear-gradient(145deg,#1a1012_0%,#110b0d_55%,#08070b_100%)] p-3">
        <span
          aria-hidden
          className="pointer-events-none absolute -right-12 -top-14 size-40 rounded-full bg-rose-500/10 blur-3xl"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -left-10 -bottom-16 size-32 rounded-full bg-gold/5 blur-3xl"
        />

        {/* Satu kotak toggle: Genre kiri, Katalog kanan (dengan ikon). */}
        <div className="relative flex rounded-2xl border border-white/10 bg-white/[0.045] p-1">
          <button
            type="button"
            onClick={() => setTab("genre")}
            aria-pressed={tab === "genre"}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-black transition active:scale-[0.98]",
              tab === "genre"
                ? "bg-white text-black shadow-[0_8px_18px_-12px_rgba(0,0,0,.9)]"
                : "text-white/55 hover:text-white",
            )}
          >
            <span
              className={cn(
                "size-1.5 rounded-full transition",
                tab === "genre" ? "bg-rose-500" : "bg-rose-400/60",
              )}
            />
            Genre
          </button>
          <button
            type="button"
            onClick={() => setTab("catalog")}
            aria-pressed={tab === "catalog"}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-black transition active:scale-[0.98]",
              tab === "catalog"
                ? "bg-gold-strong text-black shadow-[0_8px_18px_-12px_rgba(255,210,63,.9)]"
                : "text-white/55 hover:text-white",
            )}
          >
            <Grid3X3 className="size-3.5" />
            Katalog
          </button>
        </div>

        {tab === "genre" ? (
          <div className="thin-scroll relative mt-2.5 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {genres.map((g) => (
              <button
                key={g.id}
                onClick={() => onOpenGenre(g.id)}
                className="shrink-0 whitespace-nowrap rounded-full border border-rose-400/50 bg-rose-500/[0.07] px-3 py-1.5 text-[10.5px] font-bold text-white/75 transition hover:border-rose-300/80 hover:bg-rose-500/15 hover:text-white active:scale-[0.97]"
              >
                {g.name}
              </button>
            ))}
            {genres.length === 0 && (
              <span className="py-2 text-center text-[11px] text-white/35">
                Memuat genre…
              </span>
            )}
          </div>
        ) : (
          <div className="thin-scroll relative mt-2.5 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {LETTERS.map((l) => (
              <button
                key={l}
                onClick={() => setLetter(l)}
                className="flex size-8 shrink-0 items-center justify-center rounded-[10px] border border-white/12 bg-white/[0.055] font-display text-[11px] font-black text-white/70 transition hover:border-gold-strong/50 hover:bg-gold-strong/15 hover:text-gold-strong active:scale-95"
              >
                {l}
              </button>
            ))}
          </div>
        )}
      </section>

      {letter && (
        <AZCatalog
          letter={letter}
          onLetter={setLetter}
          onClose={() => setLetter(null)}
          onPick={(id, title, source) => {
            setLetter(null);
            onPick(id, title, source);
          }}
        />
      )}
    </>
  );
}
