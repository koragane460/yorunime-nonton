import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import {
  ComicBrowseRow,
  StatusChip,
  formatViews,
  type ComicItem,
} from "@/components/ComicCard";
import { ComicDetailScreen } from "@/components/ComicDetailScreen";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";

export type ComicKind = "manga" | "manhwa";

/** Halaman katalog manga / manhwa — tata letak mengikuti Home. */
export function ComicBrowsePage({ kind }: { kind: ComicKind }) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { user } = useAuth();
  // `?komik=<slug>` dipakai halaman Jadwal untuk membuka detail langsung.
  const [pick, setPick] = useState<string | null>(params.get("komik"));
  useEffect(() => {
    const s = params.get("komik");
    if (s) setPick(s);
  }, [params]);

  const newest = useAction(api.manga.newest);
  const [heroList, setHeroList] = useState<ComicItem[]>([]);
  const [topList, setTopList] = useState<ComicItem[]>([]);
  const [topPage, setTopPage] = useState(1);
  const [catItems, setCatItems] = useState<ComicItem[]>([]);
  const [catPage, setCatPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setHeroList([]);
    newest({ kind })
      .then((r: any) => {
        if (alive) setHeroList((r as ComicItem[]) ?? []);
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  const heroItems = heroList.slice(0, 3);
  const [heroIdx, setHeroIdx] = useState(0);
  useEffect(() => {
    setHeroIdx(0);
    if (heroItems.length < 2) return;
    const t = setInterval(() => setHeroIdx((i) => (i + 1) % heroItems.length), 6500);
    return () => clearInterval(t);
  }, [heroItems.length]);

  const favs = useQuery(api.comics.myFavorites, user ? {} : "skip");
  const myKindFavs = (favs ?? []).filter((f: any) => f.kind === kind);
  const open = (slug: string) => setPick(slug);

  return (
    <div className="pb-24">
      <ComicHero
        kind={kind}
        items={heroItems}
        index={heroIdx}
        onIndex={setHeroIdx}
        loading={loading}
        onPick={open}
      />

      <h2 className="mb-2 mt-5 text-base font-bold tracking-tight">
        {kind === "manga" ? "Manga Terbaru" : "Manhwa Terbaru"}
      </h2>
      <p className="-mt-1 mb-2 text-[11px] text-muted-foreground">
        Rilisan chapter terbaru, langsung dari sumber
      </p>
      {loading ? (
        <div className="flex gap-2.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-40 w-28 shrink-0 rounded-xl" />
          ))}
        </div>
      ) : heroList.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">
          Belum ada {kind} baru — coba refresh nanti
        </p>
      ) : (
        <div className="thin-scroll flex gap-2.5 overflow-x-auto pb-1">
          {heroList.map((c) => (
            <button
              key={c.slug}
              onClick={() => open(c.slug)}
              className="relative w-28 shrink-0 text-left"
            >
              <div className="relative overflow-hidden rounded-xl border border-border/60">
                <img
                  src={c.image}
                  alt=""
                  loading="lazy"
                  className="aspect-[2/3] w-full object-cover"
                />
                <StatusChip ongoing={c.ongoing} className="absolute right-1 top-1" />
                {c.latestChapter && (
                  <span className="absolute bottom-1 left-1 rounded bg-black/75 px-1 text-[9px] font-bold text-white">
                    {c.latestChapter}
                  </span>
                )}
              </div>
              <p className="mt-1 line-clamp-2 text-[10px] font-medium leading-tight">
                {c.title}
              </p>
              {c.updatedAgo && (
                <p className="text-[9px] text-amber-300">{c.updatedAgo}</p>
              )}
            </button>
          ))}
        </div>
      )}

      <div className="mt-6">
        <ComicBrowseRow
          kind={kind}
          title={kind === "manga" ? "Manga Paling Dibaca" : "Manhwa Paling Dibaca"}
          page={topPage}
          setPage={setTopPage}
          items={topList}
          setItems={setTopList}
          onPick={open}
          ranked
        />
      </div>

      <div className="mt-6">
        <ComicBrowseRow
          kind={kind}
          title={kind === "manga" ? "Semua Manga" : "Semua Manhwa"}
          page={catPage}
          setPage={setCatPage}
          items={catItems}
          setItems={setCatItems}
          onPick={open}
        />
      </div>

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

      {/* Tombol pintas pindah jenis */}
      <button
        onClick={() => navigate(kind === "manga" ? "/manhwa" : "/manga")}
        className="fixed bottom-20 right-4 z-30 rounded-full border border-violet-500/50 bg-violet-600/90 px-4 py-2 text-xs font-bold text-white shadow-lg backdrop-blur transition hover:bg-violet-500"
      >
        {kind === "manga" ? "Lihat Manhwa" : "Lihat Manga"}
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
  if (loading) return <div className="skeleton mt-1 h-56 w-full rounded-2xl" />;
  if (items.length === 0) return null;
  const cur = items[index % items.length];
  const views = formatViews(cur.views);
  return (
    <div
      className="relative mt-1 h-60 overflow-hidden rounded-2xl border border-white/10"
      style={{
        backgroundImage: `linear-gradient(0deg, rgba(0,0,0,.94) 0%, rgba(0,0,0,.5) 55%, rgba(0,0,0,.2) 100%), url(${cur.image})`,
        backgroundSize: "100% 100%, cover",
        backgroundPosition: "center bottom, center",
      }}
    >
      <div className="relative flex h-full flex-col justify-end p-4">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "rounded px-2 py-0.5 text-[10px] font-black uppercase",
              kind === "manga" ? "bg-sky-600 text-white" : "bg-fuchsia-600 text-white",
            )}
          >
            {kind === "manga" ? "Manga" : "Manhwa"}
          </span>
          <StatusChip ongoing={cur.ongoing} />
        </div>
        <h1 className="mt-1.5 line-clamp-2 text-lg font-black leading-tight text-white drop-shadow">
          {cur.title}
        </h1>
        <p className="mt-1 text-[11px] text-zinc-300">
          {[...cur.genres, cur.latestChapter].filter(Boolean).join(" · ")}
        </p>
        <div className="mt-2.5 flex items-center gap-2">
          <button
            onClick={() => onPick(cur.slug)}
            className={cn(
              "rounded-full px-4 py-1.5 text-xs font-bold text-white transition",
              kind === "manga"
                ? "bg-sky-600 hover:bg-sky-500"
                : "bg-fuchsia-600 hover:bg-fuchsia-500",
            )}
          >
            Baca Sekarang
          </button>
          {views && (
            <span className="rounded-full border border-white/25 bg-black/40 px-3 py-1.5 text-[10px] font-semibold text-white">
              {views} pembaca
            </span>
          )}
        </div>
      </div>
      <div className="absolute bottom-3 right-3 flex gap-1">
        <button
          className="rounded-full bg-black/60 p-1.5 text-white"
          onClick={() => onIndex((index + items.length - 1) % items.length)}
        >
          ‹
        </button>
        <button
          className="rounded-full bg-black/60 p-1.5 text-white"
          onClick={() => onIndex((index + 1) % items.length)}
        >
          ›
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
    </div>
  );
}
