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
  /** Status tayang — tampil sebagai chip di kiri atas poster (spt Home). */
  status?: string;
  episodes?: number;
};

type GenreOption = { id: string; name: string };

/** Views stabil per judul (angka yang sama tiap render). */
function viewsOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 100000;
  return 900 + (h % 700);
}

/** Skor dari API lama bisa berupa 682 (titik hilang) — normalisasi ke 6.8. */
function scoreOf(c: GenreCard): number {
  const raw = Number(c.score ?? 0);
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  let out = raw;
  if (out > 100) out /= 100;
  else if (out > 10) out /= 10;
  return Math.min(10, out);
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
  const [loadingAll, setLoadingAll] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<GenreCard[] | null>(null);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const name =
    genres.find((g) => g.id === sel)?.name ?? genres.find((g) => g.id === initialId)?.name ?? "";

  // Hasil genre terpilih — halaman pertama tampil dulu, lalu sisanya
  // diambil otomatis sampai habis supaya SEMUA judul genre ini muncul.
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setLoadingAll(false);
    void (async () => {
      let first: GenreCard[] = [];
      try {
        first = ((await loadGenre({ genreId: sel })) as GenreCard[]) ?? [];
      } catch {
        first = [];
      }
      if (!alive) return;
      setItems(first);
      setLoading(false);
      if (first.length === 0) return;

      setLoadingAll(true);
      const seen = new Set(first.map((c) => String(c.id)));
      for (let page = 2; page <= 6; page++) {
        let more: GenreCard[] = [];
        try {
          more = ((await loadGenre({ genreId: sel, page })) as GenreCard[]) ?? [];
        } catch {
          break;
        }
        if (!alive) return;
        const fresh = more.filter((c) => !seen.has(String(c.id)));
        if (fresh.length === 0) break;
        fresh.forEach((c) => seen.add(String(c.id)));
        setItems((prev) => [...prev, ...fresh]);
      }
      if (alive) setLoadingAll(false);
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
        {/* Judul + nama genre terpilih — rata KIRI (permintaan: kurang
            kiri dikit, jadi tanpa pl-5 lagi). */}
        <div className="mt-2">
          <h1 className="yn-title text-[34px] leading-none">GENRE</h1>
          <p className="mt-1.5 text-sm font-bold text-white/60">
            Genre {name || "..."}
          </p>
        </div>

        {/* Kolom pencarian — muncul di bawah tulisan genre. */}
        {showSearch && (
          <div className="mt-3">
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
                  // Outline memakai Ember Red palet YoruNime (#E84855),
                  // sama persis dengan chip genre di Home & detail anime.
                  "shrink-0 rounded-full border border-[#E84855]/55 px-3.5 py-2 text-xs font-bold transition active:scale-95",
                  g.id === sel
                    ? "border-[#E84855] bg-[#E84855]/25 text-white"
                    : "bg-white/[0.06] text-white/80 hover:border-[#E84855] hover:bg-white/[0.1]",
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
            {loading || searching
              ? "Memuat…"
              : loadingAll
                ? `${list.length}+ judul`
                : `${list.length} judul`}
          </span>
        </div>

        {/* GRID 3 PER BARIS — poster, judul, rating, views. */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          {list.map((c, i) => {
            const score = scoreOf(c);
            const status =
              (c.status ?? "").toLowerCase() === "completed"
                ? "Completed"
                : "Ongoing";
            return (
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
                {/* SATU kotak netral: status + rating. Tidak berubah warna. */}
                <span className="absolute left-1 top-1 flex items-center gap-1 rounded-md bg-black/70 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-white backdrop-blur-sm">
                  {status}
                  {score > 0 && (
                    <span className="inline-flex items-center gap-0.5 text-amber-300">
                      <Star className="size-2 fill-amber-300" />
                      {score.toFixed(1)}
                    </span>
                  )}
                </span>
              </div>
              <p className="mt-1.5 line-clamp-2 text-[11px] font-bold leading-tight text-white/90">
                {c.title}
              </p>
              {/* Rating · views · tipe — selalu tampil. */}
              <p className="mt-0.5 flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[9.5px] text-white/55">
                <span className="inline-flex items-center gap-0.5">
                  <Star className="size-2.5 shrink-0 fill-amber-300 text-amber-300" />
                  {score.toFixed(1)}
                </span>
                <span className="opacity-40">·</span>
                <span className="inline-flex items-center gap-0.5">
                  <Eye className="size-2.5 shrink-0" />
                  {viewsOf(c.id).toLocaleString("id-ID")}
                </span>
                <span className="opacity-40">·</span>
                <span>{c.type ?? "Anime"}</span>
              </p>
            </button>
            );
          })}
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
