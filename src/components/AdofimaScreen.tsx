import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Search, Star, Clapperboard } from "lucide-react";
import { cn } from "@/lib/utils";

type Cat = "anime" | "manga" | "manhwa" | "film";

type Item = {
  key: string;
  title: string;
  image?: string;
  cat: Exclude<Cat, "semua">;
  /** Navigasi tujuan. */
  go: () => void;
};

const AZ = ["Semua", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")];

export function AdofimaScreen({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const searchAnime = useAction(api.anime.animeSearch);
  const getComicNewest = useAction(api.manga.newest);
  const searchFilms = useAction(api.films.search);

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [letter, setLetter] = useState("Semua");
  const [q, setQ] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);

    const animeP = searchAnime({ q: "" })
      .then((r: any) => (r ?? []).map((c: any) => ({
        key: `a-${c.id}`,
        title: c.title,
        image: c.image,
        cat: "anime" as const,
        go: () => navigate(`/home?pilih=${encodeURIComponent(String(c.id))}&src=anilist`),
      })))
      .catch(() => [] as Item[]);

    const mangaP = getComicNewest({ kind: "manga" })
      .then((r: any) => (r ?? []).map((c: any) => ({
        key: `m-${c.slug}`,
        title: c.title,
        image: c.image,
        cat: "manga" as const,
        go: () => navigate(`/baca?jenis=manga&komik=${encodeURIComponent(c.slug)}`),
      })))
      .catch(() => [] as Item[]);

    const manhwaP = getComicNewest({ kind: "manhwa" })
      .then((r: any) => (r ?? []).map((c: any) => ({
        key: `w-${c.slug}`,
        title: c.title,
        image: c.image,
        cat: "manhwa" as const,
        go: () => navigate(`/baca?jenis=manhwa&komik=${encodeURIComponent(c.slug)}`),
      })))
      .catch(() => [] as Item[]);

    const filmP = searchFilms({ q: "" })
      .then((r: any) => (r ?? []).map((c: any) => ({
        key: `f-${c.id}`,
        title: c.title,
        image: c.image,
        cat: "film" as const,
        go: () => navigate(`/film?film=${encodeURIComponent(String(c.id))}&t=${c.kind ?? "movie"}`),
      })))
      .catch(() => [] as Item[]);

    void Promise.all([animeP, mangaP, manhwaP, filmP]).then(([a, m, w, f]) => {
      if (!alive) return;
      setItems([...a, ...m, ...w, ...f]);
      setLoading(false);
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shown = useMemo(() => {
    let list = items;
    if (q.trim()) {
      const t = q.trim().toLowerCase();
      list = list.filter((i) => i.title.toLowerCase().includes(t));
    }
    if (letter !== "Semua")
      list = list.filter((i) => i.title.toUpperCase().startsWith(letter));
    return list;
  }, [items, q, letter]);

  return (
    <div className="space-y-3">
      {/* Kolom pencarian. */}
      <div className="flex items-center gap-2 rounded-full border border-white/15 bg-black/30 px-3 py-2.5">
        <Search className="size-4 shrink-0 text-zinc-500" aria-hidden />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari judul…"
          className="w-full bg-transparent text-sm font-bold outline-none placeholder:text-zinc-600"
        />
      </div>

      {/* Filter A-Z + Semua. */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {AZ.map((l) => (
          <button
            key={l}
            onClick={() => setLetter(l)}
            className={cn(
              "shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-black transition",
              letter === l ? "bg-sky-400 text-black" : "bg-white/8 text-white/60 hover:bg-white/15",
            )}
          >
            {l}
          </button>
        ))}
      </div>

      {loading && <p className="py-10 text-center text-sm text-white/50">Memuat judul…</p>}

      {/* Grid kartu. */}
      <div className="grid grid-cols-3 gap-2.5">
        {shown.map((it) => (
          <button
            key={it.key}
            onClick={it.go}
            className="group overflow-hidden rounded-xl text-left"
          >
            <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-white/5">
              {it.image ? (
                <img
                  src={it.image}
                  alt={it.title}
                  loading="lazy"
                  className="absolute inset-0 size-full object-cover transition duration-300 group-hover:scale-105"
                />
              ) : (
                <div className="flex size-full items-center justify-center">
                  <Star className="size-5 text-white/25" />
                </div>
              )}
              <span className={cn(
                "absolute left-1 top-1 rounded px-1 py-0.5 text-[8px] font-black uppercase",
                it.cat === "film" ? "bg-sky-500/80 text-black"
                  : it.cat === "manga" || it.cat === "manhwa" ? "bg-emerald-500/80 text-black"
                    : "bg-fuchsia-500/80 text-black",
              )}>
                {it.cat}
              </span>
            </div>
            <p className="mt-1 line-clamp-2 text-[11px] font-semibold leading-tight">{it.title}</p>
          </button>
        ))}
      </div>

      {!loading && shown.length === 0 && (
        <p className="py-10 text-center text-xs font-bold text-zinc-500">Tidak ada judul.</p>
      )}
    </div>
  );
}
