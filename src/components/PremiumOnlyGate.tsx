import { useNavigate } from "react-router";
import { Gem, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Gate "Premium Only" untuk Manga & Manhwa.
 *
 * Sifat yang diminta:
 *  - Manga/manhwa hanya untuk akun Premium. Tanpa Premium user TIDAK bisa
 *    membuka chapter untuk dibaca.
 *  - Tapi tetap HALUS: tombol ganti kategori (Manga <-> Manhwa) dan tombol
 *    Premium sendiri harus tetap kelihatan & bisa diketuk. Jadi komponen ini
 *    hanya MENAMPAK layer miring di dalam kotak baca, bukan mengganti isi
 *    halaman atau memblokir navigasi.
 *  - Bentuknya seperti lembaran kertas miring (slanted ribbon), bukan kotak
 *    abu-abu generik.
 */
export function PremiumOnlyGate({
  label = "Premium Only",
  className,
}: {
  label?: string;
  className?: string;
}) {
  const navigate = useNavigate();
  return (
    <div
      className={cn(
        "absolute inset-0 z-20 flex items-center justify-center overflow-hidden",
        className,
      )}
    >
      {/* Kabut tipis supaya isi di bawah tetap terbaca sebagai "--terkunci". */}
      <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" />

      {/* Lembaran miring: dua pita gelap berpotongan forming strip diagonal. */}
      <div className="relative flex w-full max-w-[520px] -rotate-[7deg] scale-110 items-center justify-between gap-6 border-y border-white/15 bg-black/85 px-6 py-4 shadow-2xl">
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/20">
            <Gem className="size-4 text-primary" />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-black uppercase tracking-[0.22em] text-white">
              {label}
            </p>
            <p className="text-[11px] leading-snug text-white/60">
              Manga & Manhwa khusus member Premium
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate("/premium")}
          className="shrink-0 rounded-full bg-primary px-4 py-2 text-xs font-bold text-white transition hover:brightness-110 active:scale-[0.98]"
        >
          Buka Premium
        </button>
      </div>
    </div>
  );
}

/** Badge "Premium Only" kecil untuk ditempel di kartu / tombol. */
export function PremiumOnlyChip({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "pointer-events-none inline-flex items-center gap-1 rounded-full bg-black/75 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.18em] text-white backdrop-blur",
        className,
      )}
    >
      <Lock className="size-2.5" />
      Premium Only
    </span>
  );
}