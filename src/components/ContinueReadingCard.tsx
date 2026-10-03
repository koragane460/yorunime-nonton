import { useQuery } from "convex/react";
import { useNavigate } from "react-router";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { BookOpen, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Row = {
  slug: string;
  comicTitle: string;
  comicImage?: string;
  kind: "manga" | "manhwa";
  chapter: number;
  chapterLabel?: string;
  page: number;
  totalPages: number;
};

function pctOf(r: Row) {
  const total = Math.max(1, r.totalPages);
  return Math.max(0, Math.min(100, Math.round(((r.page + 1) / total) * 100)));
}

/**
 * "Lanjutkan baca" untuk manga & manhwa.
 *
 * Beda dari "Lanjutkan nonton" (anime): anime memakai kotak horizontal di
 * Home, komik memakai kotak vertikal — potret menghadap ke atas, karena
 * halaman komik memang dibaca ke bawah dan cover komik selalu potret.
 *
 * Ketuk kartu → langsung ke chapter terakhir yang sedang dibaca DAN halaman
 * terakhir yang sudah dicapai, persis seperti melompat ke menit terakhir
 * untuk anime.
 */
export function ContinueReadingCard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const history = useQuery(api.comics.continueReading, user ? {} : "skip");
  const rows = (history ?? []) as Row[];
  if (!user || rows.length === 0) return null;

  return (
    <section className="mt-6">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-base font-bold tracking-tight">Lanjutkan baca</h2>
        <span className="text-[11px] text-muted-foreground">
          comic yang belum tamat
        </span>
      </div>

      {/* Vertikal (ke atas), beda dari kartu anime yang lieding. */}
      <div className="thin-scroll flex gap-3 overflow-x-auto pb-1">
        {rows.map((r) => {
          const pct = pctOf(r);
          const total = Math.max(1, r.totalPages);
          const chapterTxt =
            r.chapterLabel ??
            (r.kind === "manga"
              ? `Chapter ${r.chapter}`
              : `Episode ${r.chapter}`);
          return (
            <button
              key={`${r.slug}-${r.chapter}`}
              onClick={() =>
                navigate(
                  `/baca/${encodeURIComponent(r.slug)}/${r.chapter}?p=${r.page}`,
                )
              }
              className="group w-32 shrink-0 text-left"
            >
              <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-black">
                {r.comicImage ? (
                  <img
                    src={r.comicImage}
                    alt=""
                    className="aspect-[3/4] w-full object-cover transition duration-300 group-hover:scale-[1.04]"
                  />
                ) : (
                  <div className="flex aspect-[3/4] w-full items-center justify-center bg-card">
                    <BookOpen className="size-6 text-muted-foreground" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />

                {/* Bar progres vertikal di tepi kiri: baca manga & manhwa
                    berlangsung ke bawah, jadi progresnya juga ke bawah. */}
                <div className="absolute inset-y-0 left-0 w-[3px] bg-white/20">
                  <div
                    className="absolute inset-x-0 top-0 bg-primary"
                    style={{ height: `${pct}%` }}
                  />
                </div>

                <div className="absolute inset-x-0 bottom-0 p-2">
                  <p className="line-clamp-2 text-[11px] font-bold leading-tight text-white">
                    {r.comicTitle}
                  </p>
                  <p className="mt-0.5 text-[10px] font-medium text-white/70">
                    Halaman {String((r.page ?? 0) + 1).padStart(2, "0")}/
                    {String(total).padStart(2, "0")}
                  </p>
                  <p className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-primary">
                    <BookOpen className="size-3" />
                    Lanjutkan {chapterTxt}
                  </p>
                </div>
              </div>
              {/* Label kategori di bawah cover, tetap kelihatan walau tanpa Premium. */}
              <span
                className={cn(
                  "mt-1 inline-block rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide",
                  r.kind === "manga"
                    ? "bg-sky-600/80 text-white"
                    : "bg-fuchsia-600/80 text-white",
                )}
              >
                {r.kind === "manga" ? "Manga" : "Manhwa"}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** Placeholder saat riwayat komik masih dimuat. */
export function ContinueReadingSkeleton() {
  return (
    <div className="mt-6 flex gap-3 overflow-hidden">
      {[0, 1, 2].map((i) => (
        <div key={i} className="w-32 shrink-0">
          <div className="skeleton aspect-[3/4] w-full rounded-2xl" />
          <div className="skeleton mt-1.5 h-3 w-full rounded" />
        </div>
      ))}
      <Loader2 className="size-4 animate-spin text-muted-foreground" />
    </div>
  );
}