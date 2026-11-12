import { useEffect, useMemo, useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { ChevronLeft, Loader2, Star, Tv } from "lucide-react";
import { StripBackIcon } from "@/components/StripBack";

/**
 * Asal data kartu. "sanka" berarti id-nya slug SankaVollereii (donghua),
 * BUKAN id AniList — layar detail harus memakai sumber yang berbeda supaya
 * judul donghua tidak tertukar dengan judul anime.
 */
export type PickSource = "anilist" | "sanka" | "film";

export type CardT = {
  id: string;
  title: string;
  image: string;
  score?: number;
  status?: string;
  synopsis?: string;
  type?: string;
  /** Jumlah episode (anime) — tampil "N episode" di bawah judul. */
  episodes?: number;
  /** Donghua: jumlah episode saat ini dari Sanka (dipakai "N episode"). */
  episode?: number;
};

export type CatalogKind =
  | "donghua"
  | "season"
  | "movie"
  | "ova"
  | "upcoming"
  | "popular";

/** Jumlah kartu per baris di carousel. */
const PER_ROW = 10;
/**
 * Berapa banyak yang benar-benar ditampilkan di Home. Tiga baris (30 kartu)
 * supaya katalog terasa penuh, sementara sisanya tetap ada di layar
 * "Lihat selengkapnya".
 */
export const CAROUSEL_COUNT = PER_ROW * 3;
/** Total yang diminta dari backend untuk baris + layar selengkapnya. */
const FETCH_COUNT = 120;

/* ====================================================================== *
 *  Deretan kartu geser-ke-kanan: 10 di atas, 10 di bawah.
 *  Dipakai untuk Donghua dan baris kategori lain yang diminta seperti ini.
 * ====================================================================== */

export function CardCarousel({
  kind,
  title,
  subtitle,
  onPick,
}: {
  kind: CatalogKind;
  title: string;
  subtitle?: string;
  onPick: (id: string, title?: string, source?: PickSource) => void;
}) {
  // Donghua diambil dari SankaVollereii (src/convex/sanka.ts), bukan dari
  // animeBrowse — katalognya terpisah dan subtitle-nya sudah Indonesia.
  const browse = useAction(api.anime.animeBrowse);
  const donghua = useAction(api.sanka.donghuaLatestCards);
  const [items, setItems] = useState<CardT[]>([]);
  const [busy, setBusy] = useState(true);
  const [openAll, setOpenAll] = useState(false);

  useEffect(() => {
    let alive = true;
    setBusy(true);
    const req =
      kind === "donghua"
        ? donghua({ limit: FETCH_COUNT })
        : browse({ kind, page: 1 });
    req
      .then((r: unknown) => {
        if (alive) setItems((r ?? []) as CardT[]);
      })
      .catch(() => {
        if (alive) setItems([]);
      })
      .finally(() => alive && setBusy(false));
    return () => {
      alive = false;
    };
  }, [kind, browse, donghua]);

  const rows = useMemo(() => {
    const out: CardT[][] = [];
    for (let i = 0; i < items.length && out.length < CAROUSEL_COUNT / PER_ROW; i++) {
      const row = items.slice(i * PER_ROW, (i + 1) * PER_ROW);
      if (row.length > 0) out.push(row);
    }
    return out;
  }, [items]);

  return (
    <>
      {/* Judul + "Lihat selengkapnya" TANPA background, menempel di kanan. */}
      <div className="mt-6 mb-2 flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-medium tracking-tight text-white/85">{title}</h2>
          {subtitle && (
            <span className="text-[11px] text-muted-foreground">{subtitle}</span>
          )}
        </div>
        {items.length > 0 && (
          <button
            onClick={() => setOpenAll(true)}
            className="shrink-0 whitespace-nowrap text-[11px] font-semibold text-primary underline-offset-4 hover:underline"
          >
            Lihat selengkapnya
          </button>
        )}
      </div>

      {busy ? (
        <div className="space-y-2.5">
          {[0, 1, 2].map((r) => (
            <div key={r} className="thin-scroll flex gap-2.5 overflow-hidden">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="w-28 shrink-0">
                  <div className="skeleton aspect-[2/3] w-full rounded-xl" />
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">
          {kind === "donghua"
            ? "Belum ada donghua di katalog. Cek lagi nanti."
            : "Belum ada data untuk kategori ini."}
        </p>
      ) : (
        <div className="space-y-2.5">
          {rows.map((row, ri) =>
            row.length === 0 ? null : (
              <div key={ri} className="thin-scroll flex gap-2.5 overflow-x-auto pb-1">
                {row.map((c) => (
                  <button
                    key={c.id}
                    onClick={() =>
                      onPick(c.id, c.title, kind === "donghua" ? "sanka" : "anilist")
                    }
                    className="group w-28 shrink-0 text-left"
                  >
                    <div className="relative overflow-hidden rounded-xl border border-border/60">
                      <img
                        src={c.image}
                        alt=""
                        className="aspect-[2/3] w-full object-cover transition duration-300 group-hover:scale-105"
                      />
                      {kind === "donghua" && (
                        <span className="absolute left-1 top-1 rounded bg-primary px-1.5 py-0.5 text-[8px] font-black uppercase text-white">
                          Donghua
                        </span>
                      )}
                    </div>
                    <p className="mt-1 line-clamp-2 min-h-8 text-[11px] font-medium leading-4">
                      {c.title}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[10px] text-white/70">
                      {c.score ? (
                        <span className="inline-flex items-center gap-0.5 font-bold text-yellow-400">
                          <Star className="size-3 fill-current" aria-hidden />
                          {c.score.toFixed(1)}
                        </span>
                      ) : null}
                      <span className="inline-flex items-center gap-0.5">
                        <Tv className="size-3" aria-hidden />
                        {kind === "donghua" ? "Donghua" : (c.type ?? "Anime")}
                      </span>
                      {c.episodes ?? c.episode ? (
                        <span>· {c.episodes ?? c.episode} episode</span>
                      ) : null}
                    </p>
                  </button>
                ))}
              </div>
            ),
          )}
        </div>
      )}

      {openAll && (
        <CatalogScreen
          kind={kind}
          title={title}
          items={items}
          onClose={() => setOpenAll(false)}
          onPick={onPick}
        />
      )}
    </>
  );
}

/* ====================================================================== *
 *  Layar penuh: daftar lengkap + tombol kembali (TANPA kolom pencarian —
 *  pencarian sudah tersedia di layar "Cari anime & donghua").
 * ====================================================================== */

export function CatalogScreen({
  kind,
  title,
  items: seed,
  onClose,
  onPick,
}: {
  kind: CatalogKind;
  title: string;
  items: CardT[];
  onClose: () => void;
  onPick: (id: string, title?: string, source?: PickSource) => void;
}) {
  const browse = useAction(api.anime.animeBrowse);
  const [all, setAll] = useState<CardT[]>(seed);
  const [loading, setLoading] = useState(seed.length === 0);

  // Muat beberapa halaman supaya "daftar lengkap" benar-benar punya isi.
  // Halaman 1 sudah diberikan lewat `seed`.
  useEffect(() => {
    let alive = true;
    // Untuk donghua, satu panggilan backend sudah mengambil banyak halaman
    // sekaligus (lihat `donghuaLatestInternal`), jadi tidak perlu fetch
    // tambahan di sini — cukup pakai `seed` apa adanya.
    if (kind === "donghua") {
      setAll(seed);
      setLoading(false);
      return;
    }
    const pages = [2, 3, 4];
    const fetches: Promise<CardT[]>[] = pages.map((p) =>
      browse({ kind, page: p })
        .then((r: unknown) => (r ?? []) as CardT[])
        .catch(() => [] as CardT[]),
    );
    void Promise.all(fetches).then((chunks) => {
      if (!alive) return;
      const merged = [...seed];
      const seen = new Set(merged.map((c) => c.id));
      for (const c of chunks.flat()) {
        if (!c?.id || seen.has(c.id)) continue;
        seen.add(c.id);
        merged.push(c);
      }
      setAll(merged);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [kind, browse, seed]);

  const list = all;

  return (
    <div className="screen-enter fixed inset-0 z-[80] flex flex-col bg-background">
      <header className="flex items-center gap-3 border-b border-border px-3 py-3">
        {/* Tombol kembali — selalu ada di layar ini. */}
        <button
          onClick={onClose}
          aria-label="Kembali"
          className="flex shrink-0 items-center py-1 pr-1 text-foreground/90 transition active:opacity-60"
        >
          <StripBackIcon />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-base font-bold tracking-tight">
          {title}
        </h1>
        {loading && <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />}
      </header>

      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {list.length === 0 ? (
          <p className="py-10 text-center text-xs text-muted-foreground">
            {loading ? "Memuat katalog…" : "Katalog kosong."}
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2 md:gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {list.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  onClose();
                  onPick(c.id, c.title, kind === "donghua" ? "sanka" : "anilist");
                }}
                className="group text-left"
              >
                <div className="relative overflow-hidden rounded-xl border border-border/60">
                  <img
                    src={c.image}
                    alt=""
                    className={cn(
                      "aspect-[2/3] w-full object-cover transition duration-300 group-hover:scale-105",
                    )}
                  />
                </div>
                <p className="mt-1 line-clamp-2 min-h-8 text-[11px] font-medium leading-4">
                  {c.title}
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[10px] text-white/70">
                  {c.score ? (
                    <span className="inline-flex items-center gap-0.5 font-bold text-yellow-400">
                      <Star className="size-3 fill-current" aria-hidden />
                      {c.score.toFixed(1)}
                    </span>
                  ) : null}
                  <span className="inline-flex items-center gap-0.5">
                    <Tv className="size-3" aria-hidden />
                    {kind === "donghua" ? "Donghua" : (c.type ?? "Anime")}
                  </span>
                  {c.episodes ?? c.episode ? (
                    <span>· {c.episodes ?? c.episode} episode</span>
                  ) : null}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}