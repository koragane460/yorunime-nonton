// Layar yang dibuka tombol "Favorit" di navigasi bawah.
//
// Catatan penting soal namanya: tombol ini bukan daftar favorit. Yang tampil
// di dalamnya adalah tiga tab — Download, Paling sering, dan Untuk kamu —
// dan tab yang dipilih berganti ISI DI TEMPAT, bukan membuka layar
// fullscreen baru. Tab aktif ditandai garis putih di bawahnya.
//
// Daftar favorit yang sebenarnya tetap hidup di panel akun dan di tiap
// halaman detail, jadi tidak ada yang berubah soal penyimpanan favorit.

import { useState } from "react";
import { ChevronLeft, Download, Flame, Sparkles } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import {
  DownloadsPanel,
  ForYouPanel,
  MOST_MIN_TITLES,
  MostWatchedPanel,
} from "@/components/HomeTopButtons";

type Tab = "downloads" | "most" | "foryou";

export function FavoritesScreen({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const stats = useQuery(api.downloads.downloadStats, user ? {} : "skip");
  const watched = useQuery(api.activities.mostWatched, user ? { limit: 20 } : "skip");

  // Default-nya Download: tab itu selalu punya isi.
  const [tab, setTab] = useState<Tab>("downloads");

  const dlCount = stats?.done ?? 0;
  // "Paling sering" baru aktif setelah riwayat cukup; sebelum itu tombolnya
  // mati supaya tidak membuka analisis kosong.
  const mostReady = ((watched ?? []) as unknown[]).length >= MOST_MIN_TITLES;

  const tabs: { key: Tab; label: string; Icon: typeof Download; badge: string | null }[] = [
    {
      key: "downloads",
      label: "Download",
      Icon: Download,
      badge: dlCount > 0 ? (dlCount > 99 ? "99+" : String(dlCount)) : null,
    },
    { key: "most", label: "Paling sering", Icon: Flame, badge: null },
    { key: "foryou", label: "Untuk kamu", Icon: Sparkles, badge: null },
  ];

  return (
    <div className="screen-enter pb-24">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="flex items-center gap-3 pt-3">
          <button
            onClick={onClose}
            aria-label="Kembali"
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border"
          >
            <ChevronLeft className="size-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold tracking-tight">
              Koleksi kamu
            </h1>
            <p className="truncate text-[11px] text-muted-foreground">
              Unduhan, riwayat tonton, dan rekomendasi
            </p>
          </div>
        </div>

        {/* Tiga tab di paling atas. Tab aktif diberi garis putih di bawah;
            klik hanya menukar isi di bawah, tidak membuka layar baru. */}
        <div className="mt-2 flex items-stretch gap-1 overflow-x-auto">
          {tabs.map(({ key, label, Icon, badge }) => {
            const disabled = key === "most" && !mostReady;
            const active = tab === key;
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                disabled={disabled}
                aria-selected={active}
                title={
                  disabled ? `Butuh ${MOST_MIN_TITLES} judul ditonton` : label
                }
                className={cn(
                  "relative flex shrink-0 flex-col items-center gap-1 px-3.5 pb-2 pt-2.5 transition",
                  disabled && "opacity-40",
                  active ? "text-white" : "text-muted-foreground",
                )}
              >
                <span className="relative">
                  <Icon className="size-[18px]" aria-hidden />
                  {badge && (
                    <span className="absolute -right-2.5 -top-1.5 flex min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-4 text-white">
                      {badge}
                    </span>
                  )}
                </span>
                <span className="whitespace-nowrap text-[11px] font-semibold leading-none">
                  {label}
                </span>
                {/* Garis penanda tab aktif. */}
                <span
                  className={cn(
                    "absolute inset-x-1.5 bottom-0 h-0.5 rounded-full bg-white transition-opacity",
                    active ? "opacity-100" : "opacity-0",
                  )}
                />
              </button>
            );
          })}
        </div>
      </header>

      <div className="pt-3">
        {/* Ketiganya dirender inline, jadi tidak ada layar fullscreen. */}
        {tab === "downloads" && (
          <DownloadsPanel inline onClose={onClose} />
        )}
        {tab === "most" && <MostWatchedPanel inline onClose={onClose} />}
        {tab === "foryou" && <ForYouPanel inline onClose={onClose} />}
      </div>
    </div>
  );
}