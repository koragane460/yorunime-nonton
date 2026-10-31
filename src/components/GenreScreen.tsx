import { useEffect, useRef, useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useHideNavOnMount } from "@/components/AppLayout";
import { ArrowLeft, Search, Star, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

type GenreCard = {
  id: string;
  title: string;
  image: string;
  score?: number;
  type?: string;
};

type GenreOption = { id: string; name: string };

/** Views stabil per judul (angka yang sama tiap render). */
function viewsOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 100000;
  return 900 + (h % 700);
}

/**
 * LAYAR GENRE (fullscreen) — dibuka dari kotak genre di Home.
 * Atas: panah kiri tanpa latar · ikon cari di kanan (tanpa latar).
 * Judul "GENRE" tebal, di bawahnya nama genre terpilih, lalu chip genre,
 * lalu grid 3 kartu per baris (poster · judul · rating · views).
 * Menekan ikon cari memunculkan kolom pencarian tepat di bawah judul genre.
 */
export function GenreScreen({
  genres,
  initialId,
  onClose,
  onPick,
}: {
  genres: GenreOption[];
  initialId: string;
  onClose: () => void;
  onPick: (id: string, title?: string, source?: any) => void;
}) {
  useHideNavOnMount();
  const loadGenre = useAction(api.anime.animeByGenre);
  const searchAnime = useAction(api.anime.animeSearch);

  const [sel, setSel] = useState(initialId);
  const [items, setItems] = useState<GenreCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<GenreCard[] | null>(null);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const name =
    genres.find((g) => g.id === sel)?.name ?? genres.find((g) => g.id === initialId)?.name ?? "";

  // Hasil genre terpilih.
  useEffect(() => {
    let alive = true;
    setLoading(true);
    void (async () => {
      try {
        const r = (await loadGenre({ genreId: sel })) as GenreCard[];
        if (alive) setItems(r ?? []);
      } catch {
        if (alive) setItems([]);
      }
      if (alive) setLoading(false);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel]);

  // Pencarian hidup (debounce 300ms).
  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    const t = setTimeout(() => {
      void (async () => {
        try {
          const r = (await searchAnime({ q: term })) as GenreCard[];
          setResults(r ?? []);
        } catch {
          setResults([]);
        }
        setSearching(false);
      })();
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const list: GenreCard[] = results ?? items;

  return (
    <div className="fade-enter fixed inset-0 z-[70] flex flex-col bg-background">
      {/* ATAS — panah kiri & ikon cari, keduanya TANPA latar/kotak. */}
      <header className="flex items-center justify-between px-4 pt-4">
        <button
          type="button"
          onClick={onClose}
          aria-label="Kembali"
          className="flex size-10 items-center justify-center text-white/90 transition active:scale-90"
        >
          <ArrowLeft className="size-6" />
        </button>
        <button
          type="button"
          onClick={() => {
            setShowSearch((s) => !s);
            if (!showSearch) setTimeout(() => inputRef.current?.focus(), 60);
          }}
          aria-label="Cari anime"
          className={cn(
            "flex size-10 items-center justify-center transition active:scale-90",
            showSearch ? "text-gold-strong" : "text-white/90",
          )}
        >
          <Search className="size-5" />
        </button>
      </header>

      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-4 pb-24">
        {/* Judul + nama genre terpilih (agak ke kanan). */}
        <div className="mt-2 pl-5">
          <h1 className="yn-title text-[34px] leading-none">GENRE</h1>
          <p className="mt-1.5 text-sm font-bold text-white/60">
            Genre {name || "..."}
          </p>
        </div>

        {/* Kolom pencarian — muncul di bawah tulisan genre. */}
        {showSearch && (
          <div className="mt-3 pl-5">
            <div className="flex items-center gap-2 rounded-2xl border border-white/12 bg-white/[0.06] px-3.5 py-2.5">
              <Search className="size-4 shrink-0 text-gold-strong" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cari anime…"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-white/40"
              />
              {q && (
                <button
                  type="button"
                  onClick={() => setQ("")}
                  aria-label="Bersihkan"
                  className="text-[11px] font-bold text-white/45"
                >
                  Hapus
                </button>
              )}
            </div>
          </div>
        )}

        {/* Chip genre — kotak rounded, tanpa label berlebih. */}
        {!showSearch && (
          <div className="thin-scroll mt-4 flex gap-2 overflow-x-auto pb-1">
            {genres.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setSel(g.id)}
                className={cn(
                  "shrink-0 rounded-full border px-3.5 py-2 text-xs font-bold transition active:scale-95",
                  g.id === sel
                    ? "border-gold-strong/70 bg-gold-strong text-black"
                    : "border-white/14 bg-white/[0.06] text-white/80 hover:border-white/35",
                )}
              >
                {g.name}
              </button>
            ))}
          </div>
        )}

        {/* Judul daftar hasil. */}
        <div className="mt-4 flex items-baseline justify-between gap-2">
          <h2 className="yn-sec text-lg">
            {results ? `Hasil "${q.trim()}"` : `Genre ${name}`}
          </h2>
          <span className="text-[11px] font-bold text-white/45">
            {loading || searching ? "Memuat…" : `${list.length} judul`}
          </span>
        </div>

        {/* GRID 3 PER BARIS — poster, judul, rating, views. */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          {list.map((c, i) => (
            <button
              key={`${c.id}-${i}`}
              type="button"
              onClick={() => onPick(c.id, c.title, "anilist")}
              className="group text-left"
            >
              <div className="relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.04]">
                <img
                  src={c.image}
                  alt=""
                  loading="lazy"
                  className="aspect-[2/3] w-full object-cover transition duration-300 group-hover:scale-105"
                />
                {typeof c.score === "number" && c.score > 0 && (
                  <span className="absolute left-1 top-1 flex items-center gap-0.5 rounded-md bg-black/75 px-1.5 py-0.5 text-[9px] font-black text-amber-300 backdrop-blur">
                    <Star className="size-2.5 fill-amber-300" />
                    {c.score.toFixed(1)}
                  </span>
                )}
              </div>
              <p className="mt-1.5 line-clamp-2 text-[11px] font-bold leading-tight text-white/90">
                {c.title}
              </p>
              <p className="mt-0.5 flex items-center gap-1 text-[10px] text-white/45">
                <Star className="size-2.5 fill-amber-300 text-amber-300" />
                {(c.score ?? 0).toFixed(1)}
                <span className="mx-0.5 opacity-40">·</span>
                <Eye className="size-2.5" />
                {viewsOf(c.id).toLocaleString("id-ID")}
              </p>
            </button>
          ))}
        </div>

        {!loading && list.length === 0 && !searching && (
          <p className="py-10 text-center text-xs text-muted-foreground">
            Belum ada judul untuk genre ini.
          </p>
        )}
      </div>
    </div>
  );
}
