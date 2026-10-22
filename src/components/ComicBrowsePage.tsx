import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import {
  ComicBrowseRow,
  ComicGrid,
  StatusChip,
  formatViews,
  type ComicItem,
} from "@/components/ComicCard";
import { ComicDetailScreen } from "@/components/ComicDetailScreen";
import { ContinueReadingCard } from "@/components/ContinueReadingCard";
import { PremiumOnlyChip } from "@/components/PremiumOnlyGate";
import { ChevronLeft, ChevronRight, Heart, Loader2, Lock, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ComicKind = "manga" | "manhwa";

const LABEL = { manga: "Manga", manhwa: "Manhwa" } as const;

/** Halaman katalog manga / manhwa — tata letak mengikuti Home. */
export function ComicBrowsePage({ kind }: { kind: ComicKind }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const { user } = useAuth();
  // `?komik=<slug>` dipakai halaman Jadwal untuk membuka detail langsung.
  const [pick, setPick] = useState<string | null>(params.get("komik"));

  const trending = useAction(api.manga.trending);
  const searchComic = useAction(api.manga.search);

  const [heroList, setHeroList] = useState<ComicItem[]>([]);
  const [hotList, setHotList] = useState<ComicItem[]>([]);
  const [catItems, setCatItems] = useState<ComicItem[]>([]);
  const [catPage, setCatPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<ComicItem[] | null>(null);

  useEffect(() => {
    const s = params.get("komik");
    if (s) setPick(s);
  }, [params]);

  // Trending = paling banyak dibaca saat ini (judul terkenal, termasuk yang
  // sudah jadi anime) — dipakai untuk hero sekaligus section "Trending".
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setHeroList([]);
    setHotList([]);
    trending({ kind, limit: 12 })
      .then((r: any) => {
        if (!alive) return;
        const list = (r ?? []) as ComicItem[];
        setHotList(list);
        setHeroList(list.slice(0, 3));
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  const [heroIdx, setHeroIdx] = useState(0);
  useEffect(() => {
    setHeroIdx(0);
    if (heroList.length < 2) return;
    const t = setInterval(() => setHeroIdx((i) => (i + 1) % heroList.length), 6500);
    return () => clearInterval(t);
  }, [heroList.length]);

  const favs = useQuery(api.comics.myFavorites, user ? {} : "skip");
  const myKindFavs = (favs ?? []).filter((f: any) => f.kind === kind);
  const open = (slug: string) => setPick(slug);

  // Pencarian judul (dijalankan saat pengguna menekan enter / tombol).
  const doSearch = async () => {
    const term = q.trim();
    if (term.length < 2) {
      toastSearch();
      return;
    }
    setSearching(true);
    try {
      const r: any = await searchComic({ q: term, kind, limit: 18 });
      setResults((r ?? []) as ComicItem[]);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };
  const toastSearch = () => {
    setResults([]);
  };

  // Pencarian hidup: begitu user mengetik (minimal 2 huruf) hasilnya langsung
  // muncul tanpa menekan tombol. Debounce 320ms supaya tidak membanjiri
  // backend, dan jawaban dari ketikan lama diabaikan kalau user sudah
  // mengetik lagi — jadi hasilnya selalu cocok dengan kata yang terlihat.
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults(null);
      setSearching(false);
      return;
    }
    let alive = true;
    setSearching(true);
    const t = setTimeout(() => {
      searchComic({ q: term, kind, limit: 18 })
        .then((r: any) => {
          if (!alive) return;
          setResults((r ?? []) as ComicItem[]);
        })
        .catch(() => {
          if (alive) setResults([]);
        })
        .finally(() => {
          if (alive) setSearching(false);
        });
    }, 320);
    return () => {
      alive = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, kind]);

  // User tanpa Premium tetap boleh melihat seluruh katalog (dan tombol ganti
  // kategori tetap aktif) — hanya pembacaannya yang terkunci.
  const isPremium = (user?.premiumUntil ?? 0) > Date.now();

  return (
    <div className="pb-24">
      {/* Baris penanda Premium: TIDAK memblokir apa pun. Tombol ganti
          kategori dan kotak pencarian tetap aktif; hanya tag kecil ini yang
          memberi tahu bahwa bacaannya perlu Premium. */}
      {!isPremium && (
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-card/60 px-3 py-2">
          <PremiumOnlyChip />
          <p className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
            Katalog tetap bisa dilihat, baca chapter perlu Premium
          </p>
          <button
            onClick={() => navigate("/premium")}
            className="shrink-0 rounded-full bg-primary px-3 py-1 text-[11px] font-bold text-white"
          >
            Buka
          </button>
        </div>
      )}

      {/* Lanjutkan baca — vertikal, beda dari "Lanjutkan nonton" di Home. */}
      <ContinueReadingCard />
      {/* Hero — bersih seperti Home: poster potret penuh, teks di bawah */}
      <ComicHero
        kind={kind}
        items={heroList}
        index={heroIdx}
        onIndex={setHeroIdx}
        loading={loading}
        onPick={open}
      />

      {/* Cari manga / manhwa */}
      <div className="mt-4 flex w-full items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void doSearch()}
          placeholder={
            kind === "manga"
              ? "Cari manga… contoh: one piece, solo leveling"
              : "Cari manhwa… contoh: tower of god, solo leveling"
          }
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {q && (
          <button
            onClick={() => {
              setQ("");
              setResults(null);
            }}
            aria-label="Bersihkan pencarian"
          >
            <X className="size-4 text-muted-foreground" />
          </button>
        )}
        <button
          onClick={() => void doSearch()}
          disabled={searching}
          className="flex shrink-0 items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-bold text-white disabled:opacity-60"
        >
          {searching && <Loader2 className="size-3 animate-spin" />}
          Cari
        </button>
      </div>

      {searching && (
        <p className="mt-4 text-center text-xs text-muted-foreground">Mencari…</p>
      )}

      {results !== null && !searching ? (
        <div className="mt-4">
          <h2 className="mb-2 text-base font-bold tracking-tight">
            Hasil untuk “{q.trim()}”
          </h2>
          {results.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {LABEL[kind]} tidak ditemukan
            </p>
          ) : (
            <ComicGrid items={results} onPick={open} />
          )}
          <button
            onClick={() => setResults(null)}
            className="mt-3 w-full rounded-full border border-border py-2 text-xs text-muted-foreground"
          >
            Kembali ke katalog
          </button>
        </div>
      ) : (
        <>
          {/* Trending */}
          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-base font-bold tracking-tight">
                Trending {LABEL[kind]}
              </h2>
              <span className="text-[11px] text-muted-foreground">paling banyak dibaca</span>
            </div>
            {loading ? (
              <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i}>
                    <div className="skeleton aspect-[2/3] w-full rounded-xl" />
                    <div className="skeleton mt-1.5 h-3 w-full rounded" />
                  </div>
                ))}
              </div>
            ) : hotList.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                Belum ada data trending — coba refresh nanti
              </p>
            ) : (
              <ComicGrid items={hotList} onPick={open} ranked />
            )}
          </div>

          <div className="mt-6">
            <ComicBrowseRow
              kind={kind}
              title={`Katalog ${LABEL[kind]}`}
              page={catPage}
              setPage={setCatPage}
              items={catItems}
              setItems={setCatItems}
              onPick={open}
              limit={30}
            />
          </div>
        </>
      )}

      {myKindFavs.length > 0 && (
        <>
          <h2 className="mb-2 mt-6 text-base font-bold tracking-tight">Favorite Kamu</h2>
          <div className="thin-scroll flex gap-2.5 overflow-x-auto pb-1">
            {myKindFavs.map((f: any) => (
              <button
                key={f._id}
                onClick={() => open(f.slug)}
                className="relative w-24 shrink-0 text-left"
              >
                <div className="relative overflow-hidden rounded-xl border border-border/60">
                  <img
                    src={f.comicImage ?? ""}
                    alt=""
                    className="aspect-[2/3] w-full object-cover"
                  />
                  <Heart className="absolute right-1 top-1 size-3.5 fill-red-500 text-white" />
                </div>
                <p className="mt-1 line-clamp-2 text-[10px] font-medium leading-tight">
                  {f.comicTitle}
                </p>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Tombol ganti kategori. Selalu bisa diketuk (termasuk tanpa Premium),
          dan ikut membawa tag "Premium Only" supaya jelas halaman ini
          konten Premium tanpa harus ditekan dulu untuk mengetahui.
          Di tab Baca (/baca) tombol ini mengganti ?jenis=… supaya user
          tetap di tab yang sama; di route /manga & /manhwa tetap pindah
          route seperti biasa. */}
      <button
        onClick={() => {
          const next = kind === "manga" ? "manhwa" : "manga";
          if (location.pathname === "/baca") {
            const p = new URLSearchParams(params);
            p.set("jenis", next);
            setParams(p, { replace: true });
            return;
          }
          navigate(next === "manga" ? "/manga" : "/manhwa");
        }}
        className="fixed bottom-20 right-4 z-30 flex items-center gap-1.5 rounded-full border border-foreground/40 bg-primary/90 px-3.5 py-2 text-xs font-bold text-white shadow-lg backdrop-blur transition hover:bg-primary"
      >
        {kind === "manga" ? "Lihat Manhwa" : "Lihat Manga"}
        {!isPremium && (
          <span className="inline-flex items-center gap-0.5 rounded-full bg-black/45 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider">
            <Lock className="size-2.5" />
            Premium
          </span>
        )}
      </button>

      {pick && (
        <ComicDetailScreen
          slug={pick}
          fallbackKind={kind}
          onClose={() => {
            setPick(null);
            if (params.get("komik")) {
              params.delete("komik");
              setParams(params, { replace: true });
            }
          }}
          onPick={setPick}
        />
      )}
    </div>
  );
}

function ComicHero({
  kind,
  items,
  index,
  onIndex,
  loading,
  onPick,
}: {
  kind: ComicKind;
  items: ComicItem[];
  index: number;
  onIndex: (i: number) => void;
  loading: boolean;
  onPick: (slug: string) => void;
}) {
  if (loading) return <div className="skeleton mt-1 h-64 w-full rounded-2xl" />;
  if (items.length === 0) return null;
  const cur = items[index % items.length];
  const views = formatViews(cur.views);
  const badge = kind === "manga" ? "bg-sky-600" : "bg-rose-600";
  return (
    <div className="yn-banner-box relative mt-1 rounded-2xl border border-white/10 bg-black">
      {/* Poster komik vertikal: tinggi mengikuti rasio gambar asli supaya
          tidak terpotong, dan tetap tajam karena cover-nya 720px. */}
      <img
        src={cur.image}
        alt=""
        className="block max-h-[420px] w-full bg-black object-cover object-top"
        loading="eager"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-black/5" />
      <div className="absolute inset-0 flex flex-col justify-end p-4">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "rounded px-2 py-0.5 text-[10px] font-black uppercase text-white",
              badge,
            )}
          >
            {LABEL[kind]}
          </span>
          <StatusChip ongoing={cur.ongoing} />
          <span className="rounded bg-red-600 px-1.5 py-0.5 text-[9px] font-black uppercase text-white">
            Trending
          </span>
        </div>
        <h1 className="mt-1.5 line-clamp-2 text-lg font-black leading-tight text-white yn-outline">
          {cur.title}
        </h1>
        <p className="mt-0.5 text-[11px] text-zinc-300">
          {[...cur.genres.slice(0, 2), cur.latestChapter].filter(Boolean).join(" · ")}
        </p>
        <div className="mt-2.5 flex items-center gap-2">
          <button
            onClick={() => onPick(cur.slug)}
            className={cn(
              "rounded-full px-4 py-1.5 text-xs font-bold text-white transition",
              kind === "manga" ? "bg-sky-600 hover:bg-sky-500" : "bg-rose-600 hover:bg-rose-500",
            )}
          >
            Baca Sekarang
          </button>
          {views && (
            <span className="rounded-full border border-white/25 bg-black/45 px-3 py-1.5 text-[10px] font-semibold text-white">
              {views} pembaca
            </span>
          )}
        </div>
      </div>
      {items.length > 1 && (
        <>
          <div className="absolute bottom-3 right-3 flex gap-1">
            <button
              className="rounded-full bg-black/60 p-1.5 text-white"
              onClick={() => onIndex((index + items.length - 1) % items.length)}
              aria-label="Sebelumnya"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              className="rounded-full bg-black/60 p-1.5 text-white"
              onClick={() => onIndex((index + 1) % items.length)}
              aria-label="Berikutnya"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
          <div className="absolute bottom-3.5 left-4 flex gap-1">
            {items.map((it, i) => (
              <span
                key={it.slug}
                className={cn(
                  "h-1 rounded-full transition-all",
                  i === index ? "w-5 bg-red-500" : "w-2 bg-white/30",
                )}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
