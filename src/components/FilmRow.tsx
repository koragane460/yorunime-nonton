import { useEffect, useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useHideNavOnMount } from "@/components/AppLayout";
import { Clapperboard, Loader2, Play, Search, X, ChevronLeft } from "lucide-react";
import { toast } from "sonner";

type Film = {
  id: string;
  title: string;
  poster: string;
  backdrop?: string;
  description?: string;
  year?: string;
  rating?: string;
  genre?: string;
  duration?: string;
  video?: string;
  trailer?: string;
};

/**
 * Baris Film di beranda. Sembunyi total kalau server belum punya sumber
 * film atau user belum diberi akses, jadi tidak ada tombol mati.
 */
export function FilmRow() {
  const access = useAction(api.film.filmAccess);
  const listFilms = useAction(api.film.films);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [configured, setConfigured] = useState(false);
  const [items, setItems] = useState<Film[]>([]);
  const [loading, setLoading] = useState(false);
  const [pick, setPick] = useState<Film | null>(null);
  const [playing, setPlaying] = useState<{ url: string; title: string } | null>(null);
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<Film[] | null>(null);
  const searchFilms = useAction(api.film.searchFilms);

  useEffect(() => {
    let alive = true;
    access({})
      .then((r: any) => {
        if (!alive) return;
        setAllowed(!!r?.allowed);
        setConfigured(!!r?.configured);
      })
      .catch(() => alive && setAllowed(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!allowed) return;
    let alive = true;
    setLoading(true);
    listFilms({ kind: "recent" })
      .then((r: any) => {
        if (alive) setItems(r ?? []);
      })
      .catch(() => {
        if (alive) setItems([]);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed]);

  if (allowed !== true) return null;

  const doSearch = async () => {
    const term = q.trim();
    if (term.length < 2) return;
    setSearching(true);
    try {
      const r: any = await searchFilms({ q: term });
      setResults(r ?? []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const shown = results ?? items;

  return (
    <>
      <div className="mb-1 mt-5 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-lg font-bold">
          <Clapperboard className="size-4 text-violet-300" /> Film
        </h2>
        <span className="text-[11px] text-muted-foreground">subtitle Indonesia</span>
      </div>

      <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-2.5">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            if (!e.target.value) setResults(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && void doSearch()}
          placeholder="Cari judul film…"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {searching ? (
          <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
        ) : results ? (
          <button onClick={() => setResults(null)} aria-label="Tutup hasil">
            <X className="size-4 text-muted-foreground" />
          </button>
        ) : null}
      </div>

      {!configured ? (
        <p className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-4 text-center text-[11px] leading-relaxed text-muted-foreground">
          Sumber film belum dipasang. Developer perlu mengisi salah satu di tab
          Keys/API keys:
          <span className="mt-1.5 block space-y-1">
            <span className="block">
              <span className="rounded bg-white/[0.07] px-1.5 py-0.5 font-mono text-[10px] text-foreground">
                TMDB_API_KEY
              </span>{" "}
              metadata + trailer resmi
            </span>
            <span className="block">
              <span className="rounded bg-white/[0.07] px-1.5 py-0.5 font-mono text-[10px] text-foreground">
                FILM_API_BASE
              </span>{" "}
              API LK21 (subtitle Indonesia)
            </span>
          </span>
        </p>
      ) : loading ? (
        <div className="thin-scroll mt-2 flex gap-2.5 overflow-x-auto pb-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-40 w-28 shrink-0 rounded-xl" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">
          Belum ada film yang bisa ditonton.
        </p>
      ) : (
        <div className="thin-scroll mt-2 flex gap-2.5 overflow-x-auto pb-1">
          {shown.map((f) => (
            <button
              key={f.id}
              onClick={() => setPick(f)}
              className="w-28 shrink-0 text-left"
            >
              <div className="overflow-hidden rounded-xl border border-white/10">
                {f.poster ? (
                  <img src={f.poster} alt="" className="h-40 w-full object-cover" />
                ) : (
                  <div className="flex h-40 w-full items-center justify-center bg-card">
                    <Clapperboard className="size-6 text-muted-foreground" />
                  </div>
                )}
              </div>
              <p className="mt-1 line-clamp-2 text-[11px] font-semibold leading-tight">
                {f.title}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {[f.year, f.genre].filter(Boolean).join(" · ")}
              </p>
            </button>
          ))}
        </div>
      )}

      {pick && (
        <FilmDetail
          film={pick}
          onClose={() => setPick(null)}
          onWatch={(url, title) => {
            setPlaying({ url, title });
          }}
        />
      )}

      {playing && <FilmPlayer url={playing.url} title={playing.title} onClose={() => setPlaying(null)} />}
    </>
  );
}

/** Player film fullscreen: memuat mp4 langsung atau iframe embed. */
function FilmPlayer({
  url,
  title,
  onClose,
}: {
  url: string;
  title: string;
  onClose: () => void;
}) {
  useHideNavOnMount();
  const isFile = /\.(mp4|m3u8|mkv|webm)(\?|$)/i.test(url);
  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-black">
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2.5">
        <button
          onClick={onClose}
          aria-label="Tutup player"
          className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5"
        >
          <ChevronLeft className="size-4" />
        </button>
        <p className="min-w-0 flex-1 truncate text-sm font-bold">{title}</p>
      </div>
      <div className="relative flex-1">
        {isFile ? (
          <video
            src={url}
            controls
            autoPlay
            playsInline
            className="size-full bg-black"
          />
        ) : (
          <iframe
            src={url}
            title={title}
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            allowFullScreen
            className="size-full border-0"
          />
        )}
      </div>
    </div>
  );
}

/** Layar detail film: fullscreen, poster besar, tombol Lanjutkan. */
function FilmDetail({
  film,
  onClose,
  onWatch,
}: {
  film: Film;
  onClose: () => void;
  onWatch: (url: string, title: string) => void;
}) {
  useHideNavOnMount();
  const getDetail = useAction(api.film.filmDetail);
  const getSources = useAction(api.film.filmSourcesFor);
  const [sources, setSources] = useState<
    { provider: string; url: string; resolutions: string[] }[]
  >([]);
  const [full, setFull] = useState<Film>(film);
  const [loading, setLoading] = useState(true);

  // Film dari daftar belum punya URL tayang; detail diambil terpisah.
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setSources([]);
    getDetail({ id: film.id })
      .then((d: any) => {
        if (alive && d) setFull({ ...film, ...d });
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    getSources({ id: film.id })
      .then((s: any) => {
        if (alive) setSources(s ?? []);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [film.id]);

  return (
    <div className="screen-enter fixed inset-0 z-[60] overflow-y-auto bg-background">
      <div className="w-full pb-10">
        <div className="relative">
          <div className="relative h-64 w-full bg-black">
            {full.backdrop || full.poster ? (
              <img
                src={full.backdrop ?? full.poster}
                alt=""
                className="size-full object-cover"
              />
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-black/30" />
          </div>
          <button
            onClick={onClose}
            aria-label="Kembali"
            className="absolute left-3 top-3 z-10 flex size-10 items-center justify-center rounded-xl border border-white/15 bg-black/45 text-white backdrop-blur-sm"
          >
            <ChevronLeft className="size-4" />
          </button>
        </div>

        <div className="-mt-10 px-3">
          <h1 className="text-lg font-bold leading-tight">{full.title}</h1>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {[full.year, full.duration, full.genre].filter(Boolean).join(" · ")}
          </p>
          <div className="mt-3 space-y-2">
            {sources.length > 0 ? (
              <>
                <p className="text-[11px] font-bold text-muted-foreground">
                  Pilih server
                </p>
                <div className="space-y-1.5">
                  {sources.map((s, i) => (
                    <button
                      key={`${s.provider}-${i}`}
                      onClick={() => onWatch(s.url, full.title)}
                      className="flex w-full items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-left"
                    >
                      <Play className="size-4 shrink-0 text-violet-300" />
                      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">
                        {s.provider}
                      </span>
                      {s.resolutions.length > 0 && (
                        <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                          {s.resolutions.slice(0, 2).join(" · ")}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => onWatch(sources[0].url, full.title)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground"
                >
                  <Play className="size-4" /> Lanjutkan
                </button>
              </>
            ) : full.video ? (
              <button
                onClick={() => onWatch(full.video ?? "", full.title)}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground"
              >
                <Play className="size-4" /> Lanjutkan
              </button>
            ) : full.trailer ? (
              <button
                onClick={() => onWatch(full.trailer ?? "", full.title)}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground"
              >
                <Play className="size-4" /> Trailer resmi
              </button>
            ) : (
              <p className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-center text-[11px] text-muted-foreground">
                {loading ? "Memuat sumber…" : "Belum ada sumber tayang untuk film ini"}
              </p>
            )}
          </div>
          {full.rating && (
            <p className="mt-2 text-[11px] text-muted-foreground">Rating {full.rating}</p>
          )}
          {full.description && (
            <p className="mt-3 text-[13px] leading-relaxed text-zinc-300">
              {full.description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}