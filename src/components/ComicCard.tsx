import { useEffect, useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { Eye } from "lucide-react";

export type ComicItem = {
  slug: string;
  title: string;
  image: string;
  kind: "manga" | "manhwa";
  ongoing: boolean;
  status: string;
  genres: string[];
  latestChapter?: string;
  updatedAgo?: string;
  views?: number;
};

export const COMIC_KIND_LABEL = { manga: "Manga", manhwa: "Manhwa" } as const;

/** 12.345 -> "12,3 rb" (gaya Indonesia). */
export function formatViews(n?: number) {
  if (n === undefined || n === null) return null;
  const v = Math.round(n);
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(".0", "")} jt`;
  if (v >= 1000) return `${(v / 1000).toFixed(1).replace(".0", "")} rb`;
  return `${v}`;
}

/** Chip status: hijau = tamat, amber = masih jalan. */
export function StatusChip({
  ongoing,
  className,
}: {
  ongoing: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide",
        ongoing ? "bg-amber-500 text-black" : "bg-emerald-600 text-white",
        className,
      )}
    >
      {ongoing ? "Ongoing" : "Tamat"}
    </span>
  );
}

/** Kartu vertikal untuk daftar manga/manhwa. */
export function ComicCard({
  item,
  onPick,
  ranked,
  wide,
}: {
  item: ComicItem;
  onPick: (slug: string) => void;
  ranked?: number;
  wide?: boolean;
}) {
  const views = formatViews(item.views);
  return (
    <button
      onClick={() => onPick(item.slug)}
      className="group relative w-full text-left"
    >
      <div className="relative overflow-hidden rounded-xl border border-border/60 transition group-hover:border-violet-500/70">
        <img
          src={item.image}
          alt=""
          loading="lazy"
          className={cn(
            "w-full bg-black/30 object-cover",
            wide ? "aspect-[16/10]" : "aspect-[2/3]",
          )}
        />
        {ranked !== undefined && (
          <span className="absolute left-0 top-0 flex h-6 min-w-6 items-center justify-center rounded-br-lg bg-red-500 px-1.5 text-xs font-black text-white">
            {ranked}
          </span>
        )}
        <StatusChip ongoing={item.ongoing} className="absolute right-1 top-1" />
        {views && (
          <span className="absolute bottom-1 left-1 flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-semibold text-white">
            <Eye className="size-2.5" /> {views}
          </span>
        )}
      </div>
      <p className="mt-1 line-clamp-2 text-[11px] font-medium leading-tight">
        {item.title}
      </p>
      <p className="truncate text-[10px] text-muted-foreground">
        {item.latestChapter ?? item.genres[0] ?? ""}
        {item.updatedAgo ? ` · ${item.updatedAgo}` : ""}
      </p>
    </button>
  );
}

export function ComicGrid({
  items,
  onPick,
  ranked,
  wide,
}: {
  items: ComicItem[];
  onPick: (slug: string) => void;
  ranked?: boolean;
  wide?: boolean;
}) {
  return (
    <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
      {items.map((it, i) => (
        <ComicCard
          key={it.slug}
          item={it}
          onPick={onPick}
          ranked={ranked ? i + 1 : undefined}
          wide={wide}
        />
      ))}
    </div>
  );
}

export function ComicSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}>
          <div className="skeleton aspect-[2/3] w-full rounded-xl" />
          <div className="skeleton mt-1.5 h-3 w-full rounded" />
        </div>
      ))}
    </div>
  );
}

/** Baris "muat lebih banyak" seperti di Home. */
export function ComicBrowseRow({
  kind,
  title,
  page,
  setPage,
  items,
  setItems,
  onPick,
  ranked,
}: {
  kind: "manga" | "manhwa";
  title: string;
  page: number;
  setPage: (p: number) => void;
  items: ComicItem[];
  setItems: (fn: (prev: ComicItem[]) => ComicItem[]) => void;
  onPick: (slug: string) => void;
  ranked?: boolean;
}) {
  const browse = useAction(api.manga.browse);
  const [busy, setBusy] = useState(items.length === 0);

  useEffect(() => {
    let alive = true;
    if (items.length > 0) {
      setBusy(false);
      return;
    }
    setBusy(true);
    browse({ kind, page: 1 })
      .then((r: any) => {
        if (alive) setItems(() => (r ?? []) as ComicItem[]);
      })
      .catch(() => {})
      .finally(() => alive && setBusy(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  const loadMore = async () => {
    const next = page + 1;
    setPage(next);
    setBusy(true);
    try {
      const r: any = await browse({ kind, page: next, withViews: false });
      setItems((prev) => [...prev, ...((r ?? []) as ComicItem[])]);
    } catch {
      /* diamkan */
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h2 className="mb-2 text-base font-bold tracking-tight">{title}</h2>
      {items.length === 0 ? (
        <ComicSkeleton count={12} />
      ) : (
        <>
          <ComicGrid items={items} onPick={onPick} ranked={ranked} />
          <div className="mt-3 flex justify-center">
            <button
              onClick={() => void loadMore()}
              disabled={busy || page >= 8}
              className="rounded-full border border-border px-4 py-1.5 text-xs font-semibold text-muted-foreground transition hover:border-violet-500/60 hover:text-violet-300 disabled:opacity-50"
            >
              {busy ? "Memuat…" : page >= 8 ? "Semua item sudah tampil" : "Muat lebih banyak"}
            </button>
          </div>
        </>
      )}
    </>
  );
}
