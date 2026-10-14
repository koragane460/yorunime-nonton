// Layar Koleksi (tombol "Koleksi" di navigasi bawah).
//
// Hanya DUA blok dengan judul besar: Favorite dan Download. Tidak ada
// chip kuota, subjudul kecil, maupun blok Info — diminta supaya layar
// bersih dan tidak ramai tulisan kecil.

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "react-router";
import { DownloadsPanel } from "@/components/HomeTopButtons";
import { Heart, Tv } from "lucide-react";

export function FavoritesScreen({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const favorites = useQuery(api.activities.myFavorites, user ? {} : "skip");

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
      </div>
    </div>
  );
}
