import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useAction, useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  ChevronLeft,
  Clapperboard,
  Clock,
  Film as FilmIcon,
  Heart,
  Loader2,
  Play,
  Search,
  Send,
  Star,
  X,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useHideNavOnMount } from "@/components/AppLayout";
import { useAuth } from "@/hooks/use-auth";
import { CommentsSection, type CommentT } from "@/components/Comments";
import { SectionTitle } from "@/components/lstream-ui";
import { cn } from "@/lib/utils";
import type {
  FilmCard as FilmCardT,
  FilmDetail as FilmDetailT,
  FilmSource,
} from "@/convex/films";

/**
 * Cache daftar film per kueri (module-level) + stempel waktu fetch terakhir.
 * Halaman film yang dibuka ulang menampilkan isi cache secara instan,
 * lalu menyegarkan di belakang layar bila sudah lebih dari 3 menit.
 */
const filmListCache = new Map<string, FilmCardT[]>();
const filmListAt = new Map<string, number>();
const FILM_STALE_MS = 3 * 60_000;

/**
 * HALAMAN FILM — tampilan khas bioskop, dengan DETAIL mengikuti pola
 * detail anime: banner sinematik + judul besar, chip meta & genre, baris
 * aksi (Putar + Subscribe), pemutar, lalu tab Info · Pemeran · Komentar
 * plus deretan "Film Serupa". Data berlapis (TMDb / iTunes RSS / TVmaze /
 * IMDb + Wikipedia) supaya daftar film tidak pernah kosong.
 */
export default function Film() {
  useHideNavOnMount();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [q, setQ] = useState("");
  const [genreId, setGenreId] = useState<string | null>(null);
  const [kind, setKind] = useState<"movie" | "tv">(
    params.get("t") === "tv" ? "tv" : "movie",
  );
  const [openId, setOpenId] = useState<string | null>(params.get("film"));

  // Koleksi film yang di-subscribe (favorite kind="film").
  const myFavs = useQuery(
    api.activities.myFavorites,
    openId ? "skip" : {},
  ) as
    | {
        _id: string;
        animeId: string;
        animeTitle: string;
        animeImage?: string;
        kind?: string;
        status?: string;
      }[]
    | undefined;
  const koleksi = useMemo(
    () => (myFavs ?? []).filter((f) => (f.kind ?? "anime") === "film"),
    [myFavs],
  );

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

  // Daftar film: search / genre / populer.
  // CACHE module-level → daftar tampil LANGSUNG tanpa skeleton saat dibuka
  // lagi (permintaan: "film langsung kelihatan, ga perlu tunggu loading").
  useEffect(() => {
    let alive = true;
    const term = q.trim();
    const key = `${kind}|${genreId ?? ""}|${term}`;
    const cached = filmListCache.get(key);
    if (cached) {
      setItems(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }
    if (cached && (filmListAt.get(key) ?? 0) + FILM_STALE_MS > Date.now()) {
      return; // masih segar → tidak perlu fetch ulang
    }
    const run = term
      ? searchFilms({ q: term, kind })
      : genreId
        ? byGenre({ genreId, kind })
        : searchFilms({ kind });
    run
      .then((r: any) => {
        if (!alive) return;
        const rows = (r ?? []) as FilmCardT[];
        filmListCache.set(key, rows);
        filmListAt.set(key, Date.now());
        setItems(rows);
      })
      .catch(() => {
        if (alive && !filmListCache.get(key)) setItems([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, genreId, kind]);

  const openFilm = (id: string, k: "movie" | "tv") => {
    setKind(k);
    setOpenId(id);
    navigate(`/film?film=${encodeURIComponent(id)}&t=${k}`, { replace: true });
  };

  if (openId) {
    return (
      <FilmDetail
        id={openId}
        kind={kind}
        onOpen={openFilm}
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
          <h1 className="flex min-w-0 flex-1 items-center gap-2 text-lg font-black tracking-tight">
            <Clapperboard className="size-5 text-gold" aria-hidden />
            Film
          </h1>
          {/* Toggle Movie / Series */}
          <div className="flex rounded-full border border-border bg-card p-0.5 text-[11px] font-black">
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
            className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-muted-foreground"
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
                "shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-bold transition",
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
                  "shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-bold transition",
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

        {/* Strip KOLEKSI SAYA */}
        {!q && !genreId && koleksi.length > 0 && !loading && (
          <div className="mt-4">
            <h2 className="flex items-center gap-2 text-base font-black tracking-tight">
              <Heart className="size-4 fill-gold text-gold" aria-hidden />
              Koleksi Saya
              <span className="text-[11px] font-bold text-muted-foreground">
                {koleksi.length} film
              </span>
            </h2>
            <div className="thin-scroll -mx-1 mt-2 flex gap-2.5 overflow-x-auto px-1 pb-1">
              {koleksi.map((f) => (
                <button
                  key={f._id}
                  onClick={() =>
                    openFilm(f.animeId, f.status === "tv" ? "tv" : "movie")
                  }
                  className="w-28 shrink-0 text-left"
                >
                  <div className="relative overflow-hidden rounded-xl border border-gold/25 bg-black/30">
                    {f.animeImage ? (
                      <img
                        src={f.animeImage}
                        alt={f.animeTitle}
                        loading="lazy"
                        className="aspect-[2/3] w-full object-cover"
                      />
                    ) : (
                      <div className="flex aspect-[2/3] w-full items-center justify-center">
                        <FilmIcon className="size-6 text-muted-foreground" />
                      </div>
                    )}
                    <Heart className="absolute right-1 top-1 size-4 fill-gold text-gold drop-shadow" />
                  </div>
                  <p className="mt-1 line-clamp-2 text-[11px] font-bold leading-tight">
                    {f.animeTitle}
                  </p>
                </button>
              ))}
            </div>
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
          <p className="py-16 text-center text-sm font-bold text-muted-foreground">
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
                onClick={() => openFilm(f.id, f.kind)}
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
                  {/* Genre Film Movie — ada di SETIAP film */}
                  <span className="absolute left-1.5 top-1.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[9px] font-black text-gold backdrop-blur-sm">
                    Film Movie
                  </span>
                  {typeof f.rating === "number" && f.rating > 0 && (
                    <span className="absolute right-1.5 top-1.5 inline-flex items-center gap-0.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[9px] font-black text-gold backdrop-blur-sm">
                      <Star className="size-2.5 fill-current" /> {f.rating.toFixed(1)}
                    </span>
                  )}
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-2 pb-1.5 pt-4">
                    <span className="line-clamp-1 text-[11px] font-black text-white">
                      {f.title}
                    </span>
                    {f.year && (
                      <span className="text-[9px] font-semibold text-white/60">
                        {f.year}
                      </span>
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
  onOpen,
  onClose,
}: {
  id: string;
  kind: "movie" | "tv";
  onOpen: (id: string, kind: "movie" | "tv") => void;
  onClose: () => void;
}) {
  const getDetail = useAction(api.films.detail);
  const toggleFav = useMutation(api.activities.toggleFavorite);
  const postComment = useMutation(api.activities.postComment);
  const myFavs = useQuery(api.activities.myFavorites, {});
  const { user } = useAuth();

  const favorited = (
    (myFavs ?? []) as { animeId: string; kind?: string }[]
  ).some((f) => (f.kind ?? "anime") === "film" && f.animeId === id);

  const comments = useQuery(api.activities.listComments, {
    animeId: `film:${id}`,
    sort: "terbaru",
  }) as unknown as CommentT[] | undefined;

  const [d, setD] = useState<FilmDetailT | null>(null);
  const [tab, setTab] = useState<"info" | "cast">("info");
  const [synopsisOpen, setSynopsisOpen] = useState(false);
  /** NONTON → layar TERPISAH (pemutar + komentar saja), bukan di detail. */
  const [watching, setWatching] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    setD(null);
    scrollRef.current?.scrollTo({ top: 0 });
    getDetail({ id, kind })
      .then((r: any) => alive && setD(r as FilmDetailT))
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, kind]);

  const runtimeLabel = useMemo(() => {
    if (!d?.runtime) return null;
    const h = Math.floor(d.runtime / 60);
    const m = d.runtime % 60;
    return h > 0 ? `${h}j ${m}m` : `${m}m`;
  }, [d?.runtime]);

  const longSynopsis = (d?.synopsis ?? "").length > 220;

  /** Tombol SUBSCRIBE — masukkan/keluarkan film dari koleksi. */
  const onSubscribe = async () => {
    if (!d) return;
    try {
      const res = await toggleFav({
        animeId: id,
        animeTitle: d.title,
        animeImage: d.image,
        kind: "film",
        status: kind,
      });
      toast.success(
        res.favorited
          ? "Ditambahkan ke Subscribe ✨"
          : "Dihapus dari Subscribe",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan");
    }
  };

  return (
    <div
      ref={scrollRef}
      className="screen-enter fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-background"
    >
      {/* ===================== BANNER SINEMATIK ===================== */}
      <div className="relative">
        <div
          className="relative h-72 w-full overflow-hidden bg-cover bg-center"
          style={
            d?.backdrop || d?.image
              ? {
                  backgroundImage: `linear-gradient(180deg, rgba(0,0,0,.55) 0%, rgba(0,0,0,.05) 40%, var(--background) 96%), linear-gradient(90deg, rgba(0,0,0,.5), transparent 55%), url(${d?.backdrop ?? d?.image})`,
                }
              : { background: "linear-gradient(135deg,#1a1030,#0b0714)" }
          }
        >
          <div className="absolute inset-x-0 top-0 z-10 flex items-center gap-2 p-3">
            <button
              onClick={onClose}
              aria-label="Kembali"
              className="flex size-9 items-center justify-center rounded-full border border-white/20 bg-black/40 backdrop-blur transition active:scale-90"
            >
              <ChevronLeft className="size-5 text-white" />
            </button>
            <span className="rounded-full border border-gold/40 bg-black/40 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-gold backdrop-blur">
              {kind === "tv" ? "Series" : "Film"}
            </span>
            <button
              onClick={() => void onSubscribe()}
              aria-label={favorited ? "Hapus dari Subscribe" : "Subscribe"}
              className="ml-auto flex size-9 items-center justify-center rounded-full border border-white/20 bg-black/40 backdrop-blur transition active:scale-90"
            >
              <Heart
                className={cn(
                  "size-5 transition-colors",
                  favorited ? "fill-gold text-gold" : "text-white",
                )}
                aria-hidden
              />
            </button>
          </div>

          {/* Judul menempel di bawah banner — gaya sama seperti detail anime */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background via-background/85 to-transparent px-3 pb-3 pt-10">
            <h1 className="text-2xl font-black leading-tight tracking-tight text-white yn-outline">
              {d?.title ?? "…"}
            </h1>
            {d?.tagline && (
              <p className="mt-0.5 line-clamp-1 text-[11px] font-semibold italic text-gold/80">
                “{d.tagline}”
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-2xl px-3 pb-24">
        {/* Chip meta — pil seperti detail anime */}
        <div className="mt-3 flex flex-wrap gap-2">
          {d?.rating ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-black text-white">
              <Star className="size-3 fill-current text-yellow-400" aria-hidden />
              {d.rating.toFixed(1)}
            </span>
          ) : null}
          {d?.year && (
            <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-bold text-white/90">
              {d.year}
            </span>
          )}
          {runtimeLabel && (
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-bold text-white/90">
              <Clock className="size-3" /> {runtimeLabel}
            </span>
          )}
          {kind === "tv" && d?.seasons ? (
            <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-bold text-white/90">
              {d.seasons} season
            </span>
          ) : null}
          {kind === "tv" && d?.episodes ? (
            <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-bold text-white/90">
              {d.episodes} episode
            </span>
          ) : null}
          {d?.director && (
            <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-bold text-white/90">
              Sutradara: {d.director}
            </span>
          )}
        </div>

        {/* Genre — Film Movie selalu jadi genre pertama tiap film */}
        <div className="mt-2.5 flex flex-wrap gap-2">
          <span className="rounded-full border border-gold/45 bg-gold/10 px-3 py-1 text-[11px] font-bold text-gold">
            Film Movie
          </span>
          {(d?.genres ?? []).map((g) => (
            <span
              key={g.id}
              className="rounded-full border border-primary/45 px-3 py-1 text-[11px] font-bold text-primary"
            >
              {g.name}
            </span>
          ))}
        </div>

        {/* Baris aksi: Nonton + Subscribe — Nonton membuka LAYAR TERPISAH
            berisi pemutar + komentar (bukan pemutar di halaman detail). */}
        <div className="mt-4 flex items-stretch gap-2.5">
          <button
            onClick={() => setWatching(true)}
            className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-sky-700 px-4 text-sm font-black text-white transition hover:bg-sky-600 active:scale-[0.98]"
          >
            <Play className="size-4 fill-current" aria-hidden />
            {kind === "tv" ? "Nonton Episode" : "Nonton"}
          </button>
          <button
            onClick={() => void onSubscribe()}
            className="flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-2xl border border-rose-400/45 bg-gradient-to-r from-rose-500/20 via-primary/15 to-pink-500/20 px-4 text-sm font-black text-rose-100 transition active:scale-[0.98]"
          >
            <Heart
              className={cn("size-4", favorited && "fill-current text-gold")}
              aria-hidden
            />
            {favorited ? "Subscribed" : "Subscribe"}
          </button>
        </div>

        {/* LAYAR NONTON — pemutar + komentar saja, menutupi detail */}
        {watching && (
          <FilmWatch id={id} kind={kind} onClose={() => setWatching(false)} />
        )}

        {/* PEMUTAR tidak ada di detail — tekan Nonton untuk membuka
            layar terpisah (pemutar + komentar). */}

        {/* ============== TAB: Info · Pemeran — Komentar selalu tampil
            di bawah (permintaan: "di detail film gak ada komen") ====== */}
        <div className="mt-5 flex gap-1">
          {([
            ["info", "Info"],
            ["cast", "Pemeran"],
          ] as const).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "relative flex-1 px-1 pb-2 pt-1 text-sm font-black transition",
                tab === t ? "text-white" : "text-white/55 hover:text-white/80",
              )}
            >
              {label}
              {tab === t && (
                <span className="absolute inset-x-2 bottom-0 h-[2px] rounded-full bg-white/90" />
              )}
            </button>
          ))}
        </div>

        {/* ---------- TAB INFO: sinopsis + trailer + film serupa ------- */}
        {tab === "info" && (
          <>
            <SectionTitle>Sinopsis</SectionTitle>
            <div
              className={cn(
                "thin-scroll rounded-xl border border-border bg-secondary/40 p-3",
                synopsisOpen ? "" : "max-h-64 overflow-y-auto",
              )}
            >
              <p className="whitespace-pre-line text-sm font-medium leading-6 text-white">
                {d?.synopsis || "Sinopsis belum tersedia."}
              </p>
            </div>
            {longSynopsis && (
              <button
                onClick={() => setSynopsisOpen((v) => !v)}
                className="mt-2 inline-flex h-8 items-center text-[13px] font-bold text-white/70 transition hover:text-white"
              >
                {synopsisOpen ? "Tutup (balik ke kotak)" : "Baca selengkapnya"}
              </button>
            )}

            {/* Trailer (hanya tersedia lewat TMDb) */}
            {d?.trailer && (
              <>
                <SectionTitle>Trailer</SectionTitle>
                <div className="aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-black">
                  <iframe
                    src={`https://www.youtube.com/embed/${d.trailer}`}
                    title={`Trailer ${d.title}`}
                    allowFullScreen
                    className="size-full border-0"
                  />
                </div>
              </>
            )}

            {/* Film serupa */}
            {(d?.similar ?? []).length > 0 && (
              <>
                <SectionTitle>Film Serupa</SectionTitle>
                <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
                  {d!.similar.map((s) => (
                    <button
                      key={`${s.kind}-${s.id}`}
                      onClick={() => onOpen(s.id, s.kind)}
                      className="group text-left"
                    >
                      <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-white/10 bg-black/40">
                        {s.image ? (
                          <img
                            src={s.image}
                            alt={s.title}
                            loading="lazy"
                            className="size-full object-cover transition duration-300 group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex size-full items-center justify-center">
                            <FilmIcon className="size-5 text-muted-foreground" />
                          </div>
                        )}
                        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-1.5 pb-1 pt-4">
                          <span className="line-clamp-1 text-[10px] font-black text-white">
                            {s.title}
                          </span>
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* ------------------ TAB PEMERAN ------------------ */}
        {tab === "cast" && (
          <>
            <SectionTitle>Pemeran</SectionTitle>
            {(d?.castFull ?? []).length > 0 ? (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {d!.castFull.map((c, i) => (
                  <div key={`${c.name}-${i}`} className="text-center">
                    <div className="mx-auto size-16 overflow-hidden rounded-full border border-white/10 bg-gradient-to-br from-white/10 to-white/[0.03]">
                      {c.image ? (
                        <img
                          src={c.image}
                          alt={c.name}
                          loading="lazy"
                          className="size-full object-cover"
                        />
                      ) : (
                        <span className="flex size-full items-center justify-center text-xl font-black text-white/60">
                          {c.name.slice(0, 1)}
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 line-clamp-1 text-[11px] font-black text-white/90">
                      {c.name}
                    </p>
                    {c.character && (
                      <p className="line-clamp-1 text-[10px] text-muted-foreground">
                        {c.character}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-6 text-center text-sm font-bold text-muted-foreground">
                Data pemeran belum tersedia.
              </p>
            )}
          </>
        )}

        {/* ------------------ KOMENTAR (selalu tampil) ------------------ */}
        <div className="mt-3">
          <SectionTitle>
            <span className="normal-case">
              {(comments?.length ?? 0).toLocaleString("id-ID")} Komentar
            </span>
          </SectionTitle>
          <CommentsSection
              animeId={`film:${id}`}
              comments={comments}
              meId={user?._id}
              onSend={async (text, replyToId) => {
                if (!user) {
                  toast.error("Masuk akun dulu untuk komentar");
                  return;
                }
                await postComment({
                  animeId: `film:${id}`,
                  animeTitle: d?.title ?? "Film",
                  animeImage: d?.image,
                  text,
                  replyToId: replyToId as never,
                });
              }}
            />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------- nonton ---- */

/**
 * LAYAR NONTON — hanya PEMUTAR + KOMENTAR (permintaan pemilik: nonton bukan
 * di halaman detail, tapi terbuka sendiri setelah tombol Nonton ditekan,
 * kayak layar nonton anime). KOTAK KOMENTAR TINGGI TETAP (stabil) dan judul
 * "Komentar" memuat jumlahnya.
 */
function FilmWatch({
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
  const postComment = useMutation(api.activities.postComment);
  const { user } = useAuth();
  const comments = useQuery(api.activities.listComments, {
    animeId: `film:${id}`,
    sort: "terbaru",
  }) as unknown as CommentT[] | undefined;

  const [d, setD] = useState<FilmDetailT | null>(null);
  const [sources, setSources] = useState<FilmSource[]>([]);
  const [srcIdx, setSrcIdx] = useState(0);
  const [resolving, setResolving] = useState(true);
  const [season, setSeason] = useState(1);
  const [episode, setEpisode] = useState(1);

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

  const src = sources[srcIdx];
  const commentCount = (comments?.length ?? 0).toLocaleString("id-ID");

  return (
    <div className="screen-enter fixed inset-0 z-[60] overflow-y-auto overscroll-contain bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-background/90 px-3 py-3 backdrop-blur">
        <button
          onClick={onClose}
          aria-label="Kembali ke detail film"
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border transition active:scale-90"
        >
          <ChevronLeft className="size-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black">{d?.title ?? "…"}</p>
          <p className="text-[10px] font-bold text-muted-foreground">
            {kind === "tv" ? "Series" : "Film"} · Nonton
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-gold/40 bg-gold/10 px-2.5 py-1 text-[10px] font-black text-gold">
          Film Movie
        </span>
      </div>

      {/* ============ PEMUTAR — FULL KE SAMPING, TANPA ROUNDED ============
          Menempel tepi kiri–kanan layar (tanpa padding, tanpa border-radius)
          kayak nonton anime. */}
      <div className="relative aspect-video w-full overflow-hidden border-b border-white/10 bg-black">
          {resolving ? (
            <div className="flex size-full flex-col items-center justify-center gap-2 text-white/70">
              <Loader2 className="size-6 animate-spin text-gold" />
              <p className="text-[11px] font-bold">Mencari server streaming…</p>
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
              <p className="text-[12px] font-bold">
                Server sedang tidak tersedia. Coba lagi nanti.
              </p>
            </div>
          )}
      </div>

      <div className="mx-auto w-full max-w-2xl px-3 pb-12 pt-3">
        {/* Pemilih server */}
        {sources.length > 1 && (
          <div className="thin-scroll mt-2 flex gap-2 overflow-x-auto pb-1">
            {sources.map((s, i) => (
              <button
                key={s.url}
                onClick={() => setSrcIdx(i)}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-black transition",
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
            <span className="text-[11px] font-black text-muted-foreground">
              Season
            </span>
            {Array.from({ length: Math.min(d.seasons, 12) }).map((_, i) => (
              <button
                key={i}
                onClick={() => {
                  setSeason(i + 1);
                  setEpisode(1);
                }}
                className={cn(
                  "size-8 rounded-lg border text-[11px] font-black transition",
                  season === i + 1
                    ? "border-gold bg-gold text-black"
                    : "border-border text-muted-foreground",
                )}
              >
                {i + 1}
              </button>
            ))}
            <span className="ml-2 text-[11px] font-black text-muted-foreground">
              Ep
            </span>
            <button
              onClick={() => setEpisode((e) => Math.max(1, e - 1))}
              className="size-8 rounded-lg border border-border font-black text-muted-foreground"
            >
              −
            </button>
            <span className="min-w-6 text-center text-sm font-black">
              {episode}
            </span>
            <button
              onClick={() => setEpisode((e) => e + 1)}
              className="size-8 rounded-lg border border-border font-black text-muted-foreground"
            >
              +
            </button>
          </div>
        ) : null}

        {/* ============ KOMENTAR — gaya sama seperti nonton anime ============ */}
        <div className="mt-5">
          <SectionTitle>
            <span className="normal-case">{commentCount} Komentar</span>
          </SectionTitle>
          <CommentsSection
            animeId={`film:${id}`}
            comments={comments}
            meId={user?._id}
            onSend={async (text, replyToId) => {
              if (!user) {
                toast.error("Masuk akun dulu untuk komentar");
                return;
              }
              await postComment({
                animeId: `film:${id}`,
                animeTitle: d?.title ?? "Film",
                animeImage: d?.image,
                text,
                replyToId: replyToId as never,
              });
            }}
          />
        </div>
      </div>
    </div>
  );
}
