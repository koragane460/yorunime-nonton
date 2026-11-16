import { useEffect, useState } from "react";
import { useAction } from "convex/react";
import { useNavigate } from "react-router";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { PosterRatingBadge, PosterStatusBadge } from "@/components/lstream-ui";
import { ChevronLeft, Grid3X3, Search, X } from "lucide-react";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

type Genre = { id: string; name: string };
type Card = {
  id: string;
  title: string;
  image?: string;
  score?: number;
  status?: string;
  source?: string;
  filmKind?: "movie" | "tv";
};
type CatalogKind = "anime" | "donghua" | "film";

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
  const searchDonghua = useAction(api.sanka.donghuaSearchCards);
  const searchFilms = useAction(api.films.search);
  const navigate = useNavigate();
  const [kind, setKind] = useState<CatalogKind>("anime");
  const [rows, setRows] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setRows([]);
    const starts = (title: unknown) =>
      String(title ?? "").trim().toUpperCase().startsWith(letter);
    const request: Promise<Card[]> =
      kind === "anime"
        ? load({ letter, page: 1 }).then((list) => (list ?? []) as Card[])
        : kind === "donghua"
          ? searchDonghua({ q: letter, limit: 60 }).then((list) =>
              ((list ?? []) as any[])
                .filter((c) => starts(c.title))
                .map((c) => ({ ...c, source: "sanka" })),
            )
          : searchFilms({ q: letter }).then((list) =>
              ((list ?? []) as any[])
                .filter((c) => starts(c.title))
                .map((c) => ({
                  id: String(c.id),
                  title: c.title,
                  image: c.image,
                  score: c.rating,
                  status: c.kind === "tv" ? "Series" : "Movie",
                  source: "film",
                  filmKind: c.kind === "tv" ? "tv" : "movie",
                })),
            );
    void request
      .then((list) => {
        if (alive) setRows(list);
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
  }, [letter, kind, load, searchDonghua, searchFilms]);

  const pickCard = (a: Card) => {
    if (a.source === "film") {
      onClose();
      navigate(`/film?film=${encodeURIComponent(a.id)}&t=${a.filmKind === "tv" ? "tv" : "movie"}`);
      return;
    }
    onPick(a.id, a.title, a.source ?? "anilist");
  };

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

      <div className="flex w-fit items-center gap-1 rounded-full border border-white/10 bg-white/[0.045] p-1 mx-3 mt-2 backdrop-blur-xl">
        {([
          ["anime", "Anime"],
          ["donghua", "Donghua"],
          ["film", "Film"],
        ] as const).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={cn(
              "rounded-full px-3 py-1.5 text-[10px] font-black transition",
              kind === k
                ? "bg-white text-black shadow-[0_5px_14px_-7px_rgba(255,255,255,.8)]"
                : "text-white/50 hover:text-white/85",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Rail A–Z vertikal di kiri — lebih lebar & membulat. */}
        <div className="thin-scroll m-2 flex w-14 shrink-0 flex-col items-center gap-0.5 overflow-y-auto rounded-lg border border-white/8 bg-[#101215] p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {LETTERS.map((l) => (
            <button
              key={l}
              onClick={() => onLetter(l)}
              aria-pressed={l === letter}
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-md font-mono text-[11px] font-bold transition",
                l === letter
                  ? "bg-[var(--primary)] text-white"
                  : "text-white/30 hover:bg-white/[0.05] hover:text-white/80",
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
                  onClick={() => pickCard(a)}
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
                    <PosterStatusBadge status={a.status} />
                    <PosterRatingBadge score={a.score} />
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
      <section className="fade-enter mt-6">
        <div className="mb-2.5 flex items-center justify-between gap-3">
          <h2 className="yn-sec text-[1rem]">Jelajahi</h2>
          <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-[#121417] p-0.5">
            <button
              type="button"
              onClick={() => setTab("genre")}
              aria-pressed={tab === "genre"}
              className={cn(
                "rounded-md px-2.5 py-1.5 text-[10px] font-bold transition",
                tab === "genre"
                  ? "bg-[#252a30] text-white"
                  : "text-white/42 hover:text-white/80",
              )}
            >
              Genre
            </button>
            <button
              type="button"
              onClick={() => setTab("catalog")}
              aria-pressed={tab === "catalog"}
              className={cn(
                "rounded-md px-2.5 py-1.5 text-[10px] font-bold transition",
                tab === "catalog"
                  ? "bg-[#252a30] text-white"
                  : "text-white/42 hover:text-white/80",
              )}
            >
              A-Z
            </button>
          </div>
        </div>

        {tab === "genre" ? (
          <div className="no-bar -mr-4 flex w-auto gap-2 overflow-x-auto pr-4 pb-1">
            {genres.map((g) => (
              <button
                key={g.id}
                onClick={() => onOpenGenre(g.id)}
                className="yn-chip shrink-0 whitespace-nowrap"
              >
                {g.name}
              </button>
            ))}
            {genres.length === 0 &&
              Array.from({ length: 5 }).map((_, i) => (
                <span
                  key={i}
                  className="skeleton h-11 w-20 shrink-0 rounded-full"
                />
              ))}
          </div>
        ) : (
          <div className="no-bar -mr-4 flex w-auto gap-1.5 overflow-x-auto pr-4 pb-1">
            {LETTERS.map((l) => (
              <button
                key={l}
                onClick={() => setLetter(l)}
                className="grid size-11 shrink-0 place-items-center rounded-lg border border-white/10 bg-[#121417] font-display text-[12px] font-bold text-white/68 transition hover:border-white/22 hover:bg-[#1b1e23] hover:text-white active:scale-95"
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
