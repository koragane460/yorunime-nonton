// Efek sayap terbuka + trail untuk tiga clan teratas di daftar clan.
//
// Aturan tampilan (ditetapkan pemilik aplikasi):
//   - Sayap ADA DI BELAKANG kartu, menjorok keluar ke kiri dan kanan.
//     Bagian sayap yang tumpang tindih dengan kartu tertutup kartu.
//   - Arah sayap benar: sayap kiri menghadap kiri, sayap kanan menghadap
//     kanan. Dulu keduanya terbalik sehingga terlihat seperti menekuk ke dalam.
//   - Sayapnya BESAR supaya jelas terlihat, bukan ornamen kecil.
//   - Warna sayap DAN trail tepi kartu mengikuti peringkat:
//       1 = emas, 2 = perak, 3 = perunggu.
//   - Animasinya animasi TERBUKA: dari menutup ke terbuka penuh sekali,
//     lalu bergoyang halus terus-menerus.
//
// Sayap digambar dengan SVG inline sehingga tajam di semua ukuran layar dan
// tidak butuh file gambar.

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type RankStyle = {
  from: string;
  to: string;
  glow: string;
  trail: string;
};

/** Palet per peringkat: sayap + trail tepi kartu memakai warna yang sama. */
export const RANK_STYLE: Record<1 | 2 | 3, RankStyle> = {
  1: {
    from: "#fef3c7",
    to: "#f59e0b",
    glow: "rgba(245,158,11,.45)",
    trail: "#f5b21b",
  },
  2: {
    from: "#f8fafc",
    to: "#94a3b8",
    glow: "rgba(148,163,184,.4)",
    trail: "#cbd5e1",
  },
  3: {
    from: "#fcd9b0",
    to: "#b45309",
    glow: "rgba(180,83,9,.4)",
    trail: "#c9741f",
  },
};

/**
 * Satu sayap. Tanpa `flip`, sayapnya MENGHADAP KANAN: pangkalnya di kiri,
 * ujung helai bulu menyapu ke kanan. Dipakai untuk sayap kanan.
 * `flip` mencerminkannya untuk sayap kiri.
 */
function WingShape({ id, flip }: { id: string; flip: boolean }) {
  return (
    <svg
      viewBox="0 0 130 140"
      aria-hidden
      className="h-full w-full"
      style={flip ? { transform: "scaleX(-1)" } : undefined}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--wing-from)" />
          <stop offset="100%" stopColor="var(--wing-to)" />
        </linearGradient>
      </defs>
      {/* Empat helai bulu, panjangnya bertingkat dan melengkung ke kanan,
          jadi siluetnya benar-benar seperti sayap terbuka ke kanan. */}
      <path
        d="M6 136 C 6 88, 18 44, 52 12 C 44 46, 40 92, 40 136 Z"
        fill={`url(#${id})`}
        opacity="0.96"
      />
      <path
        d="M26 136 C 30 94, 44 56, 76 26 C 66 56, 60 96, 58 136 Z"
        fill={`url(#${id})`}
        opacity="0.74"
      />
      <path
        d="M48 136 C 54 100, 66 72, 94 46 C 84 72, 78 104, 76 136 Z"
        fill={`url(#${id})`}
        opacity="0.5"
      />
      <path
        d="M70 136 C 78 108, 88 88, 112 70 C 102 92, 96 116, 94 136 Z"
        fill={`url(#${id})`}
        opacity="0.3"
      />
    </svg>
  );
}

export function ClanRankWings({
  rank,
  children,
  className,
}: {
  /** Peringkat clan. 1-3 dapat sayap + trail, selain itu tampil polos. */
  rank: number;
  children: ReactNode;
  className?: string;
}) {
  if (rank !== 1 && rank !== 2 && rank !== 3) {
    return <div className={className}>{children}</div>;
  }
  const s = RANK_STYLE[rank];
  const gid = `wing-grad-${rank}`;

  return (
    <div
      className={cn("yn-wing-host relative", className)}
      style={
        {
          "--wing-from": s.from,
          "--wing-to": s.to,
          "--wing-glow": s.glow,
          "--trail-color": s.trail,
        } as React.CSSProperties
      }
    >
      {/* Sayap kiri & kanan. z-0 = di bawah kartu (kartu pakai z-10),
          jadi bagian sayap yang menempel kartu tertutup oleh kartu. */}
      <span className="yn-wing yn-wing-left" aria-hidden>
        <WingShape id={`${gid}-l`} flip />
      </span>
      <span className="yn-wing yn-wing-right" aria-hidden>
        <WingShape id={`${gid}-r`} flip={false} />
      </span>

      {/* Trail tepi kartu: garis cahaya yang berjalan mengelilingi tepi. */}
      <span className="yn-wing-trail" aria-hidden />

      {/* Kartunya sendiri. relative + z-10 supaya sayap terlihat di belakang. */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}