// Layar VOTE yang belum bisa dipakai: "belum dimulai" dan "selesai".
// Ditenangkan sesuai permintaan: tanpa animasi melayang, tanpa kilau, tanpa
// ikon warna-warni — hanya satu panel kecil yang tenang dan jelas.
import { Vote as VoteIcon, Trophy } from "lucide-react";

export function VoteNotStartedScreen() {
  return (
    <div className="flex min-h-[52vh] w-full items-center justify-center px-4 py-6">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card/60 px-5 py-6 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-xl border border-border bg-secondary/50 text-muted-foreground">
          <VoteIcon className="size-6" aria-hidden />
        </span>
        <h2 className="mt-3 text-sm font-bold text-foreground">
          Vote character belum dimulai
        </h2>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
          Developer akan membuka voting. Siapkan Token Vote kamu — 4 menit
          nonton = 2 T-V.
        </p>
      </div>
    </div>
  );
}

export function VoteEndedScreen() {
  return (
    <div className="flex min-h-[52vh] w-full items-center justify-center px-4 py-6">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card/60 px-5 py-6 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-xl border border-border bg-secondary/50 text-amber-300/80">
          <Trophy className="size-6" aria-hidden />
        </span>
        <h2 className="mt-3 text-sm font-bold text-foreground">
          Voting selesai
        </h2>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
          Periode vote sudah berakhir. Lihat Top Vote Character Anime di
          Koleksi, tepat di bawah bagian Download.
        </p>
      </div>
    </div>
  );
}
