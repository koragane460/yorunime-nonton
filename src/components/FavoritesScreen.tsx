// Layar Koleksi (tombol "Koleksi" di navigasi bawah).
//
// Susunan layar ini diminta ulang: bukan tab, tapi tiga blok vertikal yang
// seluruhnya rata kiri —
//   1) Favorite  — judul + daftar poster yang digeser ke kanan.
//   2) Download  — daftar unduhan (posisi berbeda dari sebelumnya, di bawah Favorite).
//   3) Info      — ringkasan info anime/manga/manhwa/donghua favorit.
//
// Batas unduhan: 5 unduhan per hari (dicek server-side di downloads.enqueue;
// layar ini hanya menampilkan sisa kuota).

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "react-router";
import { cn } from "@/lib/utils";
import { DownloadsPanel } from "@/components/HomeTopButtons";
import { Heart, Info as InfoIcon, Tv } from "lucide-react";

/** Kuota unduhan per hari — harus sama dengan aturan di downloads.enqueue. */
export const DAILY_DOWNLOAD_LIMIT = 5;

/** Judul tanpa musiman dipakai untuk menebak jenis judul di blok Info. */
function guessKind(title: string): "Manga" | "Manhwa" | "Donghua" | "Anime" {
  const t = title.toLowerCase();
  // Donghua hampir selalu berbahasa Mandarin / istilah xianxia.
  if (/manhua|donghua|xianxia|cultivat| immortal|System\b/.test(t)) return "Donghua";
  return "Anime";
}

export function FavoritesScreen({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const favorites = useQuery(api.activities.myFavorites, user ? {} : "skip");
  const stats = useQuery(api.downloads.downloadStats, user ? {} : "skip");

  const favRows = (favorites ?? []) as {
    _id: string;
    animeId: string;
    animeTitle: string;
    animeImage?: string;
    createdAt: number;
  }[];

  // Sisa kuota unduhan hari ini (5/hari).
  const dlToday = stats?.today ?? 0;
  const dlLeft = Math.max(0, DAILY_DOWNLOAD_LIMIT - dlToday);

  // Blok Info: ringkas tiap favorit — jenis judul + kapan difavoritkan.
  const infoRows = useMemo(
    () =>
      favRows.map((f) => ({
        id: f.animeId,
        title: f.animeTitle,
        kind: guessKind(f.animeTitle),
        favAt: f.createdAt,
      })),
    [favRows],
  );

  return (
    <div className="screen-enter pb-24">
      <div className="px-1 pt-4">
        {/* ---------------- 1) FAVORITE — rata kiri, geser ke kanan -------- */}
        <h2 className="text-left text-lg font-bold tracking-tight">Favorite</h2>
        {favRows.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Belum ada favorite. Tekan hati di halaman detail untuk menyimpan.
          </p>
        ) : (
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
          <div className="flex items-center justify-between">
            <h2 className="text-left text-lg font-bold tracking-tight">Download</h2>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-bold",
                dlLeft > 0
                  ? "bg-emerald-500/15 text-emerald-300"
                  : "bg-red-500/15 text-red-300",
              )}
            >
              {dlLeft > 0 ? `Sisa ${dlLeft}/5 hari ini` : "Kuota habis — besok lagi"}
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Maksimal 5 unduhan per hari. File tersimpan di perangkatmu.
          </p>
          <div className="mt-2">
            <DownloadsPanel inline onClose={onClose} />
          </div>
        </div>

        {/* ---------------- 3) INFO — di bawah Download -------------------- */}
        <div className="mt-6">
          <h2 className="text-left text-lg font-bold tracking-tight">Info</h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Info judul yang kamu favorite — manga, manhwa, donghua, atau anime.
          </p>
          {infoRows.length === 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Belum ada info untuk ditampilkan.
            </p>
          ) : (
            <div className="mt-2 space-y-1.5">
              {infoRows.map((r) => (
                <button
                  key={r.id}
                  onClick={() => navigate(`/info?anime=${encodeURIComponent(r.id)}&judul=${encodeURIComponent(r.title)}`)}
                  className="flex w-full items-center gap-3 rounded-xl border border-border/60 bg-card p-2.5 text-left transition hover:border-foreground/40"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15">
                    <InfoIcon className="size-4 text-primary" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{r.title}</span>
                    <span className="block text-[11px] text-muted-foreground">
                      {r.kind} · Favorite {new Date(r.favAt).toLocaleDateString("id-ID")}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
