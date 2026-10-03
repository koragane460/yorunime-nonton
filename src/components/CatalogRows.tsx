import { useEffect, useMemo, useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { ChevronLeft, Loader2, Search, X } from "lucide-react";

/**
 * Asal data kartu. "sanka" berarti id-nya slug SankaVollereii (donghua),
 * BUKAN id AniList — layar detail harus memakai sumber yang berbeda supaya
 * judul donghua tidak tertukar dengan judul anime.
 */
export type PickSource = "anilist" | "sanka";

export type CardT = {
  id: string;
  title: string;
  image: string;
  score?: number;
  status?: string;
  synopsis?: string;
  type?: string;
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
/** Jumlah baris yang tampil di Home sebelum dibuka lewat "Lihat selengkapnya". */
const ROWS = 2;
/** Berapa banyak yang benar-benar ditampilkan: 10 atas + 10 bawah. */
export const CAROUSEL_COUNT = PER_ROW * ROWS;

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
      kind === "donghua" ? donghua({ limit: 24 }) : browse({ kind, page: 1 });
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

  const top = items.slice(0, PER_ROW);
  const bottom = items.slice(PER_ROW, CAROUSEL_COUNT);

  return (
    <>
      {/* Judul + "Lihat selengkapnya" TANPA background, menempel di kanan. */}
      <div className="mt-6 mb-2 flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-bold tracking-tight">{title}</h2>
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
          {[0, 1].map((r) => (
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
          {[top, bottom].map((row, ri) =>
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
                        <span className="absolute left-1 top-1 rounded bg-violet-600 px-1.5 py-0.5 text-[8px] font-black uppercase text-white">
                          Donghua
                        </span>
                      )}
                    </div>
                    <p className="mt-1 line-clamp-2 min-h-8 text-[11px] font-medium leading-4">
                      {c.title}
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
 *  Layar penuh: daftar lengkap + kolom pencarian + tombol kembali.
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
  const searchAnime = useAction(api.anime.animeSearch);
  const donghuaLatest = useAction(api.sanka.donghuaLatestCards);
  const donghuaSearch = useAction(api.sanka.donghuaSearchCards);
  const [q, setQ] = useState("");
  const [all, setAll] = useState<CardT[]>(seed);
  const [loading, setLoading] = useState(seed.length === 0);
  const [results, setResults] = useState<CardT[] | null>(null);
  const [searching, setSearching] = useState(false);

  // Muat beberapa halaman supaya "daftar lengkap" benar-benar punya isi.
  // Halaman 1 sudah gegeben lewat `seed`.
  useEffect(() => {
    let alive = true;
    const pages = [2, 3, 4];
    const fetches: Promise<CardT[]>[] = pages.map((p) =>
      (kind === "donghua"
        ? donghuaLatest({ limit: 24 * p })
        : browse({ kind, page: p })
      )
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
  }, [kind, browse, donghuaLatest, seed]);

  // Pencarian: untuk donghua, kueri+donghua; untuk anime, animeSearch biasa.
  const doSearch = async () => {
    const term = q.trim();
    if (term.length < 2) {
      setResults(null);
      return;
    }
    setSearching(true);
    try {
      // Donghua dicari lewat SankaVollereii (katalog terpisah, subtitle
      // Indonesia). Menyaring daftar lokal saja akan salah, karena daftar
      // lokal cuma halaman pertama.
      const r =
        kind === "donghua"
          ? await donghuaSearch({ q: term, limit: 40 })
          : await searchAnime({ q: term, page: 1 });
      setResults(((r ?? []) as CardT[]).filter((c) => c?.id));
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const list = useMemo(
    () => results ?? all,
    [results, all],
  );

  return (
    <div className="screen-enter fixed inset-0 z-[80] flex flex-col bg-background">
      <header className="flex items-center gap-3 border-b border-border px-3 py-3">
        {/* Tombol kembali — selalu ada di layar ini. */}
        <button
          onClick={onClose}
          aria-label="Kembali"
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border"
        >
          <ChevronLeft className="size-5" />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-base font-bold tracking-tight">
          {title}
        </h1>
        {loading && <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />}
      </header>

      <div className="px-4 pt-3">
        <div className="flex w-full items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2.5">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void doSearch()}
            placeholder={
              kind === "donghua"
                ? "Cari donghua… contoh: battle through"
                : "Cari anime… contoh: ayanokoji"
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
            className="shrink-0 rounded-full bg-primary px-3 py-1 text-xs font-bold text-white disabled:opacity-60"
          >
            {searching ? <Loader2 className="size-3 animate-spin" /> : "Cari"}
          </button>
        </div>
        {results !== null && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            {results.length} hasil untuk “{q.trim()}”
          </p>
        )}
      </div>

      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {list.length === 0 ? (
          <p className="py-10 text-center text-xs text-muted-foreground">
            {loading
              ? "Memuat katalog…"
              : results !== null
                ? "Tidak ditemukan."
                : "Katalog kosong."}
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
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
                  {c.score ? (
                    <span className="absolute right-1 top-1 rounded bg-black/75 px-1 py-0.5 text-[9px] font-bold text-amber-300">
                      ★ {c.score.toFixed(1)}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 line-clamp-2 min-h-8 text-[11px] font-medium leading-4">
                  {c.title}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}