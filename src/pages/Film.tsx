import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useHideNavOnMount } from "@/components/AppLayout";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  Clapperboard,
  Clock,
  Film as FilmIcon,
  Loader2,
  Search,
  Star,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

type FilmCardT = {
  id: string;
  title: string;
  image?: string;
  year?: string;
  rating?: number;
  kind: "movie" | "tv";
};
type FilmDetailT = {
  id: string;
  title: string;
  image?: string;
  backdrop?: string;
  year?: string;
  rating?: number;
  kind: "movie" | "tv";
  synopsis: string;
  genres: { id: string; name: string }[];
  runtime?: number;
  tagline?: string;
  director?: string;
  cast: string[];
  seasons?: number;
  episodes?: number;
};
type FilmSource = { label: string; url: string; type: "embed" | "hls" | "mp4" };

/**
 * HALAMAN FILM — tampilan khas bioskop, BERBEDA dari anime/manga/manhwa/
 * donghua: latar backdrop sinematik full-bleed, kartu poster Lebar 16:9 untuk
 * banner + portrait untuk grid, chip genre, dan pemutar stream resolver
 * (TMDb + VidSrc/Cinepro) di layar detail.
 */
export default function Film() {
  useHideNavOnMount();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [q, setQ] = useState("");
  const [genreId, setGenreId] = useState<string | null>(null);
  const [kind, setKind] = useState<"movie" | "tv">("movie");
  const [openId, setOpenId] = useState<string | null>(params.get("film"));

  const searchFilms = useAction(api.films.search);
  const getGenres = useAction(api.films.genres);
  const byGenre = useAction(api.films.byGenre);

  const [items, setItems] = useState<FilmCardT[]>([]);
  const [genreList, setGenreList] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // Genre chips
  useEffect(() => {
    let alive = true;
    getGenres({ kind })
      .then((r: any) => alive && setGenreList(r ?? []))
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  // Daftar film: search / genre / populer
  useEffect(() => {
    let alive = true;
    setLoading(true);
    const term = q.trim();
    const run = term
      ? searchFilms({ q: term, kind })
      : genreId
        ? byGenre({ genreId, kind })
        : searchFilms({ kind });
    run
      .then((r: any) => alive && setItems((r ?? []) as FilmCardT[]))
      .catch(() => alive && setItems([]))
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, genreId, kind]);

  if (openId) {
    return (
      <FilmDetail
        id={openId}
        kind={kind}
        onClose={() => {
          setOpenId(null);
          navigate("/film", { replace: true });
        }}
      />
    );
  }

  return (
    <div className="screen-enter fixed inset-0 z-40 overflow-y-auto overscroll-contain bg-background">
      <div className="mx-auto w-full max-w-2xl px-3 pb-24">
        {/* Header */}
        <div className="sticky top-0 z-10 -mx-3 flex items-center gap-2 bg-background/85 px-3 py-3 backdrop-blur">
          <button
            onClick={() => navigate("/")}
            aria-label="Kembali"
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border"
          >
            <ChevronLeft className="size-5" />
          </button>
          <h1 className="flex min-w-0 flex-1 items-center gap-2 text-lg font-extrabold tracking-tight">
            <Clapperboard className="size-5 text-gold" aria-hidden />
            Film
          </h1>
          {/* Toggle Movie / Series */}
          <div className="flex rounded-full border border-border bg-card p-0.5 text-[11px] font-bold">
            {(["movie", "tv"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setKind(k)}
                className={cn(
                  "rounded-full px-3 py-1 capitalize transition",
                  kind === k ? "bg-gold text-black" : "text-muted-foreground",
                )}
              >
                {k === "movie" ? "Film" : "Series"}
              </button>
            ))}
          </div>
        </div>

        {/* Kolom pencarian */}
        <div className="mt-2 flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2.5">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setGenreId(null);
            }}
            placeholder="Cari film / series…"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {q && (
            <button onClick={() => setQ("")} aria-label="Bersihkan">
              <X className="size-4 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Chip genre */}
        {genreList.length > 0 && (
          <div className="thin-scroll mt-3 flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setGenreId(null)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition",
                genreId === null
                  ? "border-gold bg-gold/15 text-gold"
                  : "border-border text-muted-foreground",
              )}
            >
              Semua
            </button>
            {genreList.map((g) => (
              <button
                key={g.id}
                onClick={() => setGenreId(g.id)}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition",
                  genreId === g.id
                    ? "border-gold bg-gold/15 text-gold"
                    : "border-border text-muted-foreground",
                )}
              >
                {g.name}
              </button>
            ))}
          </div>
        )}

        {/* Grid poster */}
        {loading ? (
          <div className="mt-4 grid grid-cols-3 gap-2.5 sm:grid-cols-4">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="skeleton aspect-[2/3] w-full rounded-xl" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            Film tidak ditemukan.
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-3 gap-2.5 sm:grid-cols-4">
            {items.map((f, i) => (
              <motion.button
                key={`${f.kind}-${f.id}`}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 30, 350), duration: 0.26 }}
                onClick={() => {
                  setKind(f.kind);
                  setOpenId(f.id);
                  navigate(`/film?film=${f.id}`, { replace: true });
                }}
                className="group text-left"
              >
                <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-white/10 bg-black/40">
                  {f.image ? (
                    <img
                      src={f.image}
                      alt={f.title}
                      loading="lazy"
                      className="size-full object-cover transition duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center">
                      <FilmIcon className="size-6 text-muted-foreground" />
                    </div>
                  )}
                  {typeof f.rating === "number" && f.rating > 0 && (
                    <span className="absolute right-1.5 top-1.5 inline-flex items-center gap-0.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[9px] font-bold text-gold backdrop-blur-sm">
                      <Star className="size-2.5 fill-current" /> {f.rating.toFixed(1)}
                    </span>
                  )}
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-2 pb-1.5 pt-4">
                    <span className="line-clamp-1 text-[11px] font-bold text-white">
                      {f.title}
                    </span>
                    {f.year && (
                      <span className="text-[9px] text-white/60">{f.year}</span>
                    )}
                  </span>
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ detail ---- */

function FilmDetail({
  id,
  kind,
  onClose,
}: {
  id: string;
  kind: "movie" | "tv";
  onClose: () => void;
}) {
  const getDetail = useAction(api.films.detail);
  const resolve = useAction(api.films.resolveStream);
  const [d, setD] = useState<FilmDetailT | null>(null);
  const [sources, setSources] = useState<FilmSource[]>([]);
  const [srcIdx, setSrcIdx] = useState(0);
  const [resolving, setResolving] = useState(true);
  const [season, setSeason] = useState(1);
  const [episode, setEpisode] = useState(1);
  const [tab, setTab] = useState<"sinopsis" | "cast">("sinopsis");

  useEffect(() => {
    let alive = true;
    getDetail({ id, kind })
      .then((r: any) => alive && setD(r as FilmDetailT))
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, kind]);

  useEffect(() => {
    let alive = true;
    setResolving(true);
    resolve({ id, kind, season, episode })
      .then((r: any) => {
        if (!alive) return;
        setSources((r?.sources ?? []) as FilmSource[]);
        setSrcIdx(0);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setResolving(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, kind, season, episode]);

  const runtimeLabel = useMemo(() => {
    if (!d?.runtime) return null;
    const h = Math.floor(d.runtime / 60);
    const m = d.runtime % 60;
    return h > 0 ? `${h}j ${m}m` : `${m}m`;
  }, [d?.runtime]);

  const src = sources[srcIdx];

  return (
    <div className="screen-enter fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-background">
      {/* Backdrop sinematik full-bleed khas FILM (beda dari anime) */}
      <div className="relative">
        <div
          className="relative h-72 w-full overflow-hidden bg-cover bg-center"
          style={
            d?.backdrop || d?.image
              ? {
                  backgroundImage: `linear-gradient(0deg, var(--background) 4%, rgba(10,7,16,.55) 55%, rgba(10,7,16,.35) 100%), url(${d?.backdrop ?? d?.image})`,
                }
              : { background: "linear-gradient(135deg,#1a1030,#0b0714)" }
          }
        >
          <div className="absolute inset-x-0 top-0 flex items-center gap-2 p-3">
            <button
              onClick={onClose}
              aria-label="Kembali"
              className="flex size-9 items-center justify-center rounded-full border border-white/20 bg-black/40 backdrop-blur"
            >
              <ChevronLeft className="size-5 text-white" />
            </button>
            <span className="rounded-full border border-gold/40 bg-black/40 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-gold backdrop-blur">
              {kind === "tv" ? "Series" : "Film"}
            </span>
          </div>
          {/* Poster + judul menempel di bawah backdrop */}
          <div className="absolute inset-x-0 bottom-0 flex items-end gap-3 px-3 pb-3">
            {d?.image && (
              <img
                src={d.image}
                alt=""
                className="h-28 w-20 shrink-0 rounded-lg border border-white/15 object-cover shadow-lg"
              />
            )}
            <div className="min-w-0 flex-1 pb-1">
              <h1 className="line-clamp-2 text-xl font-black leading-tight text-white">
                {d?.title ?? "…"}
              </h1>
              {d?.tagline && (
                <p className="mt-0.5 line-clamp-1 text-[11px] italic text-gold/80">
                  “{d.tagline}”
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-2xl px-3 pb-24">
        {/* Chip meta */}
        <div className="mt-3 flex flex-wrap gap-2">
          {d?.rating ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-gold/40 bg-gold/10 px-2.5 py-1 text-[11px] font-bold text-gold">
              <Star className="size-3 fill-current" /> {d.rating.toFixed(1)}
            </span>
          ) : null}
          {d?.year && (
            <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-white/90">
              {d.year}
            </span>
          )}
          {runtimeLabel && (
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-white/90">
              <Clock className="size-3" /> {runtimeLabel}
            </span>
          )}
          {kind === "tv" && d?.seasons ? (
            <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-white/90">
              {d.seasons} season
            </span>
          ) : null}
        </div>

        {/* Genre */}
        {(d?.genres ?? []).length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-2">
            {d!.genres.map((g) => (
              <span
                key={g.id}
                className="rounded-full border border-gold/30 px-3 py-1 text-[11px] font-semibold text-gold/90"
              >
                {g.name}
              </span>
            ))}
          </div>
        )}

        {/* Pemutar stream resolver */}
        <div className="mt-4">
          <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-black">
            {resolving ? (
              <div className="flex size-full flex-col items-center justify-center gap-2 text-white/70">
                <Loader2 className="size-6 animate-spin text-gold" />
                <p className="text-[11px]">Mencari server streaming…</p>
              </div>
            ) : src?.type === "embed" ? (
              <iframe
                key={src.url}
                src={src.url}
                title={src.label}
                allowFullScreen
                className="size-full border-0"
              />
            ) : src ? (
              <video
                key={src.url}
                src={src.url}
                controls
                playsInline
                className="size-full bg-black"
              />
            ) : (
              <div className="flex size-full flex-col items-center justify-center gap-2 px-6 text-center text-white/60">
                <FilmIcon className="size-8" />
                <p className="text-[12px]">Server sedang tidak tersedia. Coba lagi nanti.</p>
              </div>
            )}
          </div>

          {/* Pemilih server */}
          {sources.length > 1 && (
            <div className="thin-scroll mt-2 flex gap-2 overflow-x-auto pb-1">
              {sources.map((s, i) => (
                <button
                  key={s.url}
                  onClick={() => setSrcIdx(i)}
                  className={cn(
                    "shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-bold transition",
                    i === srcIdx
                      ? "border-gold bg-gold text-black"
                      : "border-border text-muted-foreground",
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}

          {/* Pemilih season/episode untuk series */}
          {kind === "tv" && d?.seasons ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold text-muted-foreground">Season</span>
              {Array.from({ length: Math.min(d.seasons, 12) }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setSeason(i + 1)}
                  className={cn(
                    "size-8 rounded-lg border text-[11px] font-bold transition",
                    season === i + 1
                      ? "border-gold bg-gold text-black"
                      : "border-border text-muted-foreground",
                  )}
                >
                  {i + 1}
                </button>
              ))}
              <span className="ml-2 text-[11px] font-bold text-muted-foreground">Ep</span>
              <button
                onClick={() => setEpisode((e) => Math.max(1, e - 1))}
                className="size-8 rounded-lg border border-border text-muted-foreground"
              >
                −
              </button>
              <span className="min-w-6 text-center text-sm font-bold">{episode}</span>
              <button
                onClick={() => setEpisode((e) => e + 1)}
                className="size-8 rounded-lg border border-border text-muted-foreground"
              >
                +
              </button>
            </div>
          ) : null}
        </div>

        {/* Tab Sinopsis / Cast */}
        <div className="mt-4 flex gap-6 border-b border-white/10">
          {(["sinopsis", "cast"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "relative pb-2.5 text-sm font-bold capitalize transition",
                tab === t ? "text-white" : "text-muted-foreground",
              )}
            >
              {t === "sinopsis" ? "Sinopsis" : "Pemeran"}
              {tab === t && (
                <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-gradient-to-r from-gold to-amber-400" />
              )}
            </button>
          ))}
        </div>

        {tab === "sinopsis" ? (
          <p className="mt-3 whitespace-pre-line text-sm leading-6 text-white/85">
            {d?.synopsis || "Sinopsis belum tersedia."}
          </p>
        ) : (
          <div className="mt-3 space-y-2 text-sm">
            {d?.director && (
              <p className="text-white/85">
                <span className="font-bold text-gold">Sutradara:</span> {d.director}
              </p>
            )}
            {(d?.cast ?? []).length > 0 && (
              <p className="leading-6 text-white/80">
                <span className="font-bold text-gold">Pemeran:</span> {d!.cast.join(", ")}
              </p>
            )}
            {(d?.cast ?? []).length === 0 && !d?.director && (
              <p className="text-muted-foreground">Data pemeran belum tersedia.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
