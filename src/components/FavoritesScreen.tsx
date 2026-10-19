// LAYAR SUBSCRIBE (tombol "Subscribe" di navigasi bawah).
//
// Judul besar + garis, lalu tab kategori Anime / Manga / Manhwa /
// Donghua / Film, dan filter status Ongoing / Tamat untuk kategori yang
// punya status. Daftar = koleksi yang pernah di-subscribe (favorite).
// Di bawahnya tetap ada blok Download dan TOP VOTE CHARACTER.

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { motion } from "framer-motion";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "react-router";
import { DownloadsPanel } from "@/components/HomeTopButtons";
import { ComicDetailScreen } from "@/components/ComicDetailScreen";
import { cn } from "@/lib/utils";
import { Clapperboard, Crown, Heart, Tv, Vote as VoteIcon } from "lucide-react";

type SubTab = "anime" | "manga" | "manhwa" | "donghua" | "film";
type StatusFilter = "semua" | "ongoing" | "tamat";

const TABS: { key: SubTab; label: string }[] = [
  { key: "anime", label: "Anime" },
  { key: "manga", label: "Manga" },
  { key: "manhwa", label: "Manhwa" },
  { key: "donghua", label: "Donghua" },
  { key: "film", label: "Film" },
];

export function FavoritesScreen({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const favorites = useQuery(api.activities.myFavorites, user ? {} : "skip");
  const comicFavorites = useQuery(api.comics.myFavorites, user ? {} : "skip");
  // Top 10 hasil voting karakter — hanya terisi setelah event (7 hari) selesai.
  const top = useQuery(api.votes.topCharacters, {});

  const [tab, setTab] = useState<SubTab>("anime");
  const [status, setStatus] = useState<StatusFilter>("semua");
  // Detail manga/manhwa dibuka sebagai layar penuh (sama seperti di Baca).
  const [pick, setPick] = useState<{ slug: string; kind: "manga" | "manhwa" } | null>(
    null,
  );

  const animeRows = useMemo(
    () =>
      (favorites ?? []) as {
        _id: string;
        animeId: string;
        animeTitle: string;
        animeImage?: string;
        kind?: string;
        status?: string;
        createdAt: number;
      }[],
    [favorites],
  );
  const comicRows = useMemo(
    () =>
      (comicFavorites ?? []) as {
        _id: string;
        slug: string;
        comicTitle: string;
        comicImage?: string;
        kind: string;
        createdAt: number;
      }[],
    [comicFavorites],
  );

  /** Anime / Donghua / Film punya status RELEASING = ongoing. */
  const animeItems = useMemo(() => {
    const wanted = tab === "donghua" ? "donghua" : tab === "film" ? "film" : "anime";
    let rows = animeRows.filter((f) => (f.kind ?? "anime") === wanted);
    if (status !== "semua") {
      rows = rows.filter((f) =>
        status === "ongoing"
          ? f.status === "RELEASING"
          : f.status != null && f.status !== "RELEASING",
      );
    }
    return rows;
  }, [animeRows, tab, status]);

  const comicItems = useMemo(() => {
    if (tab !== "manga" && tab !== "manhwa") return [];
    return comicRows.filter((c) => c.kind === tab);
  }, [comicRows, tab]);

  const showStatus = tab === "anime" || tab === "donghua";
  const items =
    tab === "manga" || tab === "manhwa" ? comicItems : animeItems;

  const emptyText =
    tab === "film"
      ? "Belum ada film yang di-subscribe. Buka halaman Film lalu tekan tombol Subscribe."
      : tab === "manga" || tab === "manhwa"
        ? `Belum ada ${tab} yang di-subscribe. Tekan tombol hati di detail ${tab}.`
        : "Belum ada judul yang di-subscribe. Tekan tombol hati di detail judul.";

  return (
    <div className="screen-enter pb-24">
      <div className="px-1 pt-4">
        {/* ---------------- JUDUL + GARIS ---------------- */}
        <h1 className="text-left text-2xl font-black tracking-tight">Subscribe</h1>
        <div className="mt-2 h-px w-full bg-gradient-to-r from-gold/70 via-border to-transparent" />

        {/* ---------------- TAB KATEGORI ---------------- */}
        <div className="thin-scroll -mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "shrink-0 rounded-full border px-3.5 py-1.5 text-[12px] font-bold transition",
                tab === t.key
                  ? "border-gold bg-gold/15 text-gold"
                  : "border-border text-muted-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ---------------- FILTER STATUS ---------------- */}
        {showStatus && (
          <div className="mt-2 flex gap-1.5">
            {(
              [
                { key: "semua", label: "Semua" },
                { key: "ongoing", label: "Ongoing" },
                { key: "tamat", label: "Tamat" },
              ] as { key: StatusFilter; label: string }[]
            ).map((s) => (
              <button
                key={s.key}
                onClick={() => setStatus(s.key)}
                className={cn(
                  "rounded-lg border px-3 py-1 text-[11px] font-semibold transition",
                  status === s.key
                    ? "border-foreground/40 bg-white/[0.08] text-white"
                    : "border-border text-muted-foreground",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}

        {/* ---------------- DAFTAR SUBSCRIBE ---------------- */}
        {items.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            {emptyText}
          </p>
        ) : (
          <div className="mt-3 grid grid-cols-3 gap-2.5 sm:grid-cols-4">
            {items.map((f, i) => {
              const key = "slug" in f ? f.slug : f.animeId;
              const title = "slug" in f ? f.comicTitle : f.animeTitle;
              const image = "slug" in f ? f.comicImage : f.animeImage;
              return (
                <motion.button
                  key={key}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 30, 350), duration: 0.26 }}
                  onClick={() => {
                    if ("slug" in f) {
                      setPick({
                        slug: f.slug,
                        kind: f.kind === "manhwa" ? "manhwa" : "manga",
                      });
                    } else if (tab === "film") {
                      // status menyimpan jenis film (movie/tv) — lihat Film.tsx
                      navigate(
                        `/film?film=${encodeURIComponent(f.animeId)}&t=${f.status === "tv" ? "tv" : "movie"}`,
                      );
                    } else {
                      navigate(
                        `/info?anime=${encodeURIComponent(f.animeId)}&judul=${encodeURIComponent(f.animeTitle)}`,
                      );
                    }
                  }}
                  className="group text-left"
                >
                  <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-white/10 bg-black/40">
                    {image ? (
                      <img
                        src={image}
                        alt={title}
                        loading="lazy"
                        className="size-full object-cover transition duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center">
                        {tab === "film" ? (
                          <Clapperboard className="size-6 text-muted-foreground" />
                        ) : (
                          <Tv className="size-6 text-muted-foreground" />
                        )}
                      </div>
                    )}
                    {tab === "film" ? (
                      <Clapperboard className="absolute right-1.5 top-1.5 size-4 fill-gold text-gold drop-shadow" />
                    ) : (
                      <Heart className="absolute right-1.5 top-1.5 size-4 fill-white/85 text-white/85 drop-shadow" />
                    )}
                    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-2 pb-1.5 pt-4">
                      <span className="line-clamp-2 text-[11px] font-bold leading-tight text-white">
                        {title}
                      </span>
                    </span>
                  </div>
                </motion.button>
              );
            })}
          </div>
        )}

        {/* ---------------- 2) DOWNLOAD ---------------- */}
        <div className="mt-6">
          <h2 className="text-left text-lg font-bold tracking-tight">Download</h2>
          <div className="mt-2">
            <DownloadsPanel inline onClose={onClose} minimalEmpty />
          </div>
        </div>

        {/* -------- 3) TOP VOTE CHARACTER ANIME — setelah voting 7 hari -------- */}
        {top?.ready && top.items.length > 0 && (
          <div className="mt-6">
            <h2 className="flex items-center gap-2 text-left text-lg font-bold tracking-tight">
              <VoteIcon className="size-5 text-primary" aria-hidden />
              TOP VOTE CHARACTER ANIME
            </h2>
            <div className="mt-2 space-y-2">
              {top.items.map((c, i) => (
                <motion.div
                  key={`${i}-${c.name}`}
                  initial={{ opacity: 0, x: -24, scale: 0.97 }}
                  whileInView={{ opacity: 1, x: 0, scale: 1 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ delay: i * 0.07, duration: 0.45, ease: "easeOut" }}
                  className="flex items-center gap-3 rounded-2xl border border-white/12 bg-white/[0.04] p-2.5"
                >
                  {/* Peringkat */}
                  <motion.span
                    initial={{ rotate: -20, scale: 0.5 }}
                    whileInView={{ rotate: 0, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.07 + 0.15, type: "spring", bounce: 0.5 }}
                    className={
                      c.rank <= 3
                        ? "flex size-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-b from-amber-300 to-amber-500 text-sm font-black text-black shadow-[0_0_14px_-4px] shadow-amber-400/70"
                        : "flex size-8 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] text-sm font-black text-white/80"
                    }
                  >
                    {c.rank === 1 ? <Crown className="size-4" aria-hidden /> : c.rank}
                  </motion.span>

                  {/* Gambar karakter */}
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-black/40">
                    {c.image ? (
                      <img
                        src={c.image}
                        alt={c.name}
                        loading="lazy"
                        className="size-full object-cover"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center">
                        <VoteIcon className="size-5 text-muted-foreground" aria-hidden />
                      </div>
                    )}
                  </div>

                  {/* Nama + anime + total vote */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-white">{c.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {c.animeTitle}
                    </p>
                    <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/10">
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{
                          width: `${Math.max(6, Math.round((c.votes / Math.max(1, top.items[0].votes)) * 100))}%`,
                        }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.07 + 0.2, duration: 0.9, ease: "easeOut" }}
                        className="h-full rounded-full bg-gradient-to-r from-primary to-amber-400"
                      />
                    </div>
                  </div>

                  {/* Total vote */}
                  <motion.span
                    initial={{ opacity: 0, y: 8 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.07 + 0.25, duration: 0.4 }}
                    className="shrink-0 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-[11px] font-black text-primary"
                  >
                    {c.votes.toLocaleString("id-ID")} vote
                  </motion.span>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Layar detail manga/manhwa yang di-subscribe */}
      {pick && (
        <ComicDetailScreen
          slug={pick.slug}
          fallbackKind={pick.kind}
          onClose={() => setPick(null)}
          onPick={(slug) => setPick({ slug, kind: pick.kind })}
        />
      )}
    </div>
  );
}
