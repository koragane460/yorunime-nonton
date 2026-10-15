// YoruNime — Layar "BACA" (tab navigasi ke-4, di kanan History).
//
// Panel ganti kategori yang dulu muncul saat menekan lama tombol Home sekarang
// pindah ke sini: dua kartu Manga / Manhwa di paling atas, lalu katalog jenis
// terpilih (ComicBrowsePage) langsung di bawahnya. "Lihat selengkap" Manga /
// Manhwa di Home mengarah ke sini lewat ?jenis=manga|manhwa.
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { AppLayout } from "@/components/AppLayout";
import { ComicBrowsePage, type ComicKind } from "@/components/ComicBrowsePage";
import { BookIcon, PanelsIcon } from "@/components/ios-icons";
import { cn } from "@/lib/utils";

export default function Baca() {
  const [params, setParams] = useSearchParams();
  const initial: ComicKind = params.get("jenis") === "manhwa" ? "manhwa" : "manga";
  const [kind, setKind] = useState<ComicKind>(initial);

  // ?jenis=manga|manhwa dari tombol "Lihat selengkap" di Home.
  useEffect(() => {
    const j = params.get("jenis");
    if (j === "manga" || j === "manhwa") setKind(j);
  }, [params]);

  const pick = (k: ComicKind) => {
    setKind(k);
    const next = new URLSearchParams(params);
    next.set("jenis", k);
    // replace supaya tombol Back browser tidak menumpuk query yang sama.
    setParams(next, { replace: true });
  };

  return (
    <AppLayout hideAccountPanel>
      <div className="pb-6">
        {/* Judul layar */}
        <h1 className="px-1 pt-4 text-lg font-bold tracking-tight">Baca</h1>

        {/* Panel ganti kategori — dua kartu besar, aktif mendapat aksen. */}
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          {(
            [
              ["manga", "Manga", BookIcon, "Kanan ke kiri"] as const,
              ["manhwa", "Manhwa", PanelsIcon, "Gaya webtoon"] as const,
            ] as const
          ).map(([k, label, Icon, sub]) => {
            const active = kind === k;
            return (
              <button
                key={k}
                onClick={() => pick(k)}
                aria-pressed={active}
                className={cn(
                  "flex flex-col items-start gap-1 rounded-2xl border p-3.5 text-left transition active:scale-[0.97]",
                  active
                    ? "border-primary/60 bg-primary/15 shadow-[0_0_18px_-8px] shadow-primary/60"
                    : "border-border bg-card hover:border-foreground/40",
                )}
              >
                <span
                  className={cn(
                    "flex items-center gap-1.5 text-sm font-bold",
                    active ? "text-primary" : "text-foreground",
                  )}
                >
                  <Icon className="size-4" /> {label}
                </span>
                <span className="text-[10px] text-muted-foreground">{sub}</span>
              </button>
            );
          })}
        </div>

        {/* Katalog jenis terpilih — key supaya state dalam (hero, scroll)
            di-reset saat ganti kategori. */}
        <ComicBrowsePage key={kind} kind={kind} />
      </div>
    </AppLayout>
  );
}
