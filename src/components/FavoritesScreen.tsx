// Layar Koleksi (tombol "Koleksi" di navigasi bawah).
//
// Hanya DUA blok dengan judul besar: Favorite dan Download. Tidak ada
// chip kuota, subjudul kecil, maupun blok Info — diminta supaya layar
// bersih dan tidak ramai tulisan kecil.

import { useQuery } from "convex/react";
import { motion } from "framer-motion";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "react-router";
import { DownloadsPanel } from "@/components/HomeTopButtons";
import { Crown, Heart, Tv, Vote as VoteIcon } from "lucide-react";

export function FavoritesScreen({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const favorites = useQuery(api.activities.myFavorites, user ? {} : "skip");
  // Top 10 hasil voting karakter — hanya terisi setelah event (7 hari) selesai.
  const top = useQuery(api.votes.topCharacters, {});

  const favRows = (favorites ?? []) as {
    _id: string;
    animeId: string;
    animeTitle: string;
    animeImage?: string;
    createdAt: number;
  }[];

  return (
    <div className="screen-enter pb-24">
      <div className="px-1 pt-4">
        {/* ---------------- 1) FAVORITE — rata kiri, geser ke kanan -------- */}
        <h2 className="text-left text-lg font-bold tracking-tight">Favorite</h2>
        {favRows.length > 0 && (
          <div className="thin-scroll -mx-1 mt-2 flex gap-2.5 overflow-x-auto px-1 pb-1">
            {favRows.map((f) => (
              <button
                key={f._id}
                onClick={() => navigate(`/info?anime=${encodeURIComponent(f.animeId)}&judul=${encodeURIComponent(f.animeTitle)}`)}
                className="w-28 shrink-0 text-left"
              >
                <div className="relative overflow-hidden rounded-xl border border-border/60">
                  {f.animeImage ? (
                    <img
                      src={f.animeImage}
                      alt=""
                      loading="lazy"
                      className="aspect-[2/3] w-full bg-black/30 object-cover"
                    />
                  ) : (
                    <div className="flex aspect-[2/3] w-full items-center justify-center bg-muted">
                      <Tv className="size-6 text-muted-foreground" aria-hidden />
                    </div>
                  )}
                  <Heart className="absolute right-1 top-1 size-4 fill-white/85 text-white/85" />
                </div>
                <p className="mt-1 line-clamp-2 text-[11px] font-medium leading-tight">
                  {f.animeTitle}
                </p>
              </button>
            ))}
          </div>
        )}

        {/* ---------------- 2) DOWNLOAD — di bawah Favorite ---------------- */}
        <div className="mt-6">
          <h2 className="text-left text-lg font-bold tracking-tight">Download</h2>
          <div className="mt-2">
            <DownloadsPanel inline onClose={onClose} minimalEmpty />
          </div>
        </div>

        {/* -------- 3) TOP VOTE CHARACTER ANIME — setelah voting 7 hari --------
            Muncul HANYA kalau event voting sudah selesai. Satu kotak lurus
            per karakter (gambar + nama + total vote + judul anime), ditumpuk
            ke bawah, dengan animasi masuk berjenjang. */}
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
    </div>
  );
}
