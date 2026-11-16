import { useEffect, useMemo, useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { Eye, Loader2, Star } from "lucide-react";

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
  /** Rating numerik (kalau tersedia dari sumber) — bintang kuning strong. */
  score?: number;
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

/** Chip status: biru muda lembut (tanpa neon) — Ongoing / Tamat. */
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
        "rounded px-1.5 py-0.5 text-[7.5px] font-bold uppercase tracking-[0.05em]",
        ongoing ? "bg-[var(--primary)] text-white" : "bg-white/15 text-white/72",
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
      <div className="yn-media-cut relative overflow-hidden rounded-lg border border-white/10 bg-[#1a1d22] transition group-hover:border-white/20">
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
          <span className="absolute left-0 top-0 flex h-6 min-w-6 items-center justify-center rounded-br-md bg-black/72 px-1.5 font-mono text-[10px] font-bold text-[var(--gold)]">
            {ranked}
          </span>
        )}
        {/* Title ONGOING/TAMAT — melekat di kiri ATAS kartu: flush ke
            sudut (rounded hanya pojok kanan-bawah supaya "nyambung"),
            digeser ke kanan kalau ada badge peringkat di depannya. */}
        <StatusChip
          ongoing={item.ongoing}
          className="absolute right-0 top-0 rounded-none rounded-bl-md"
        />
        {views && (
          <span className="absolute bottom-0 left-0 flex items-center gap-1 rounded-tr-md bg-black/72 px-1.5 py-1 font-mono text-[7.5px] font-semibold text-white/72">
            <Eye className="size-2.5" /> {views}
          </span>
        )}
      </div>
      {/* Kotak judul semi-opaque MENYATU dengan poster (tanpa jarak) —
          gaya sama seperti kartu anime. */}
      <div className="pt-2">
        <p className="line-clamp-2 min-h-8 text-[11px] font-semibold leading-4 text-white/90">
          {item.title}
        </p>
        <p className="mt-0.5 flex items-center gap-1 text-[8.5px] font-medium text-white/28">
          <span className="truncate">
            {item.latestChapter ?? item.genres[0] ?? COMIC_KIND_LABEL[item.kind]}
            {item.updatedAgo ? ` · ${item.updatedAgo}` : ""}
          </span>
          {typeof item.score === "number" && item.score > 0 && (
            <>
              <span className="text-white/16">·</span>
              <Star className="size-2.5 shrink-0 fill-[var(--gold)] text-[var(--gold)]" />
              <span>{item.score.toFixed(1)}</span>
            </>
          )}
        </p>
      </div>
    </button>
  );
}

export function ComicGrid({
  items,
  onPick,
  ranked,
  wide,
  limit,
}: {
  items: ComicItem[];
  onPick: (slug: string) => void;
  ranked?: boolean;
  wide?: boolean;
  limit?: number;
}) {
  const list = limit ? items.slice(0, limit) : items;
  return (
    <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
      {list.map((it, i) => (
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
  limit,
}: {
  kind: "manga" | "manhwa";
  title: string;
  page: number;
  setPage: (p: number) => void;
  items: ComicItem[];
  setItems: (fn: (prev: ComicItem[]) => ComicItem[]) => void;
  onPick: (slug: string) => void;
  limit?: number;
}) {
  const browse = useAction(api.manga.browse);
  const [busy, setBusy] = useState(items.length === 0);
  const [status, setStatus] = useState<"all" | "ongoing" | "ended">("all");

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

  const filtered = useMemo(
    () =>
      status === "all"
        ? items
        : items.filter((c) => (status === "ongoing" ? c.ongoing : !c.ongoing)),
    [items, status],
  );
  const ongoingCount = items.filter((c) => c.ongoing).length;
  const endedCount = items.length - ongoingCount;

  return (
    <>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-base font-bold tracking-tight">{title}</h2>
        <span className="text-[11px] text-muted-foreground">
          {items.length} judul
        </span>
      </div>
      {/* Filter status: masih jalan atau tamat */}
      <div className="mb-2.5 flex gap-1.5">
        {(
          [
            ["all", `Semua ${items.length}`],
            ["ongoing", `Ongoing ${ongoingCount}`],
            ["ended", `Tamat ${endedCount}`],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setStatus(k)}
            className={cn(
              "rounded-full border px-3 py-1 text-[11px] font-semibold transition",
              status === k
                ? "border-foreground/40 bg-primary/15 text-primary"
                : "border-border text-muted-foreground hover:border-foreground/40",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        items.length === 0 ? (
          <ComicSkeleton count={12} />
        ) : (
          <p className="py-6 text-center text-xs text-muted-foreground">
            Tidak ada komik dengan status ini di halaman loaded
          </p>
        )
      ) : (
        <>
          <ComicGrid items={filtered} onPick={onPick} limit={limit} />
          <div className="mt-3 flex justify-center">
            <button
              onClick={() => void loadMore()}
              disabled={busy || page >= 8}
              className="rounded-full border border-border bg-black/55 px-4 py-1.5 text-xs font-semibold text-muted-foreground backdrop-blur-md transition hover:border-foreground/40 hover:text-primary disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" aria-label="Memuat" />
              ) : page >= 8 ? (
                "Semua item sudah tampil"
              ) : (
                "Muat lebih banyak"
              )}
            </button>
          </div>
        </>
      )}
    </>
  );
}
