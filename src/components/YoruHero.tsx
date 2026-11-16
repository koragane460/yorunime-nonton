import { useRef, useState } from "react";
import { ChevronRight, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PickSource } from "@/components/CatalogRows";

export type YoruHeroItem = {
  id: string;
  title: string;
  image?: string;
  score?: number;
  type?: string;
  episodes?: number;
  status?: string;
  source?: PickSource;
};

/**
 * Hero swipe-only: gambar menjadi fokus, judul memakai huruf editorial, dan
 * hanya satu ajakan. Tidak ada rotasi otomatis supaya layar tidak bergerak
 * sendiri saat sedang dibaca.
 */
export function YoruHero({
  items,
  onPick,
}: {
  items: YoruHeroItem[];
  onPick: (id: string, title?: string, source?: PickSource) => void;
}) {
  const track = useRef<HTMLDivElement | null>(null);
  const [index, setIndex] = useState(0);
  const list = items.slice(0, 6);

  if (list.length === 0) {
    return <div className="skeleton mt-5 h-[224px] w-full rounded-[18px]" />;
  }

  return (
    <section className="fade-enter mt-5" aria-label="Pilihan utama">
      <div
        ref={track}
        onScroll={(event) => {
          const el = event.currentTarget;
          const child = el.children[0] as HTMLElement | undefined;
          if (!el || !child) return;
          const step = child.offsetWidth + 12;
          const next = Math.max(
            0,
            Math.min(list.length - 1, Math.round(el.scrollLeft / step)),
          );
          if (next !== index) setIndex(next);
        }}
        className="no-bar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1"
      >
        {list.map((item, i) => {
          const ongoing = /airing|ongoing|releasing|tayang/i.test(
            String(item.status ?? ""),
          );
          return (
            <div
              key={`${item.id}-${i}`}
              role="button"
              tabIndex={0}
              onClick={() => onPick(item.id, item.title, item.source)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onPick(item.id, item.title, item.source);
                }
              }}
              className={cn(
                "yn-media-cut group relative h-[224px] w-[92%] shrink-0 cursor-pointer snap-center overflow-hidden rounded-[18px] border border-white/10 bg-[#15181c] text-left outline-none transition",
                "focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]",
              )}
            >
              {item.image ? (
                <img
                  src={item.image}
                  alt=""
                  loading={i === 0 ? "eager" : "lazy"}
                  fetchPriority={i === 0 ? "high" : "auto"}
                  className="absolute inset-0 size-full object-cover transition duration-500 group-hover:scale-[1.025]"
                />
              ) : (
                <div className="absolute inset-0 bg-[#1a1d22]" />
              )}
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,6,8,.08)_0%,rgba(5,6,8,.16)_38%,rgba(5,6,8,.94)_100%)]" />

              <div className="absolute inset-x-0 top-0 flex items-start justify-between p-3">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-black/55 px-2 py-1 text-[9px] font-extrabold uppercase tracking-[0.1em] text-white/88 backdrop-blur-sm">
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      ongoing ? "bg-[var(--yn-mint)]" : "bg-white/45",
                    )}
                  />
                  {ongoing ? "Sedang tayang" : "Pilihan malam ini"}
                </span>
                {Number(item.score) > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-black/55 px-2 py-1 font-mono text-[10px] font-bold text-[var(--gold)] backdrop-blur-sm">
                    <Star className="size-3 fill-current" />
                    {Number(item.score).toFixed(1)}
                  </span>
                )}
              </div>

              <div className="absolute inset-x-0 bottom-0 p-3.5">
                <p className="line-clamp-2 font-[family-name:var(--font-serif)] text-[27px] leading-[0.98] tracking-[-0.015em] text-white">
                  {item.title}
                </p>
                <div className="mt-2 flex items-center gap-2 text-[10px] font-semibold text-white/62">
                  {item.type && <span>{item.type}</span>}
                  {typeof item.episodes === "number" && item.episodes > 0 && (
                    <span>{item.episodes} episode</span>
                  )}
                  <span className="ml-auto inline-flex items-center gap-0.5 text-[10px] font-bold text-white">
                    Buka
                    <ChevronRight className="size-3.5" />
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {list.length > 1 && (
        <div className="mt-2.5 flex items-center justify-center gap-1.5">
          {list.map((item, i) => (
            <button
              key={`${item.id}-dot`}
              type="button"
              aria-label={`Pilihan ${i + 1}: ${item.title}`}
              aria-current={i === index ? "true" : undefined}
              onClick={() => {
                const el = track.current;
                const child = el?.children[i] as HTMLElement | undefined;
                if (el && child) {
                  el.scrollTo({ left: child.offsetLeft - 16, behavior: "smooth" });
                }
                setIndex(i);
              }}
              className={cn(
                "h-1 rounded-full transition-all",
                i === index
                  ? "w-5 bg-[var(--primary)]"
                  : "w-1 bg-white/22 hover:bg-white/40",
              )}
            />
          ))}
        </div>
      )}
    </section>
  );
}
