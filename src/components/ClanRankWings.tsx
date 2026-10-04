// Efek sayap terbuka untuk tiga clan teratas di daftar clan.
//
// Sayapnya digambar murni dengan CSS + SVG inline, jadi tidak perlu file
// gambar dan tetap tajam di semua ukuran layar. Animasinya: sayap terbuka
// pelan sekali saat kartu masuk layar, lalu bergoyang halus terus-menerus
// supaya terlihat hidup tapi tidak ramai.
//
// Pemakaian: bungkus kartu clan dengan <RankWings rank={1}> ... </RankWings>.
// Rank di luar 1-3 dikembalikan apa adanya (tanpa sayap).

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Warna dan ukuran sayap per peringkat. */
const WING_STYLE: Record<
  1 | 2 | 3,
  { from: string; to: string; glow: string; scale: number }
> = {
  1: {
    from: "#fde68a",
    to: "#f59e0b",
    glow: "rgba(245,158,11,.55)",
    scale: 1,
  },
  2: {
    from: "#e5e7eb",
    to: "#9ca3af",
    glow: "rgba(156,163,175,.45)",
    scale: 0.86,
  },
  3: {
    from: "#fdba74",
    to: "#b45309",
    glow: "rgba(180,83,9,.42)",
    scale: 0.8,
  },
};

function WingShape({ id, flip }: { id: string; flip: boolean }) {
  return (
    <svg
      viewBox="0 0 100 120"
      aria-hidden
      className="h-full w-full"
      style={flip ? { transform: "scaleX(-1)" } : undefined}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--wing-from)" />
          <stop offset="100%" stopColor="var(--wing-to)" />
        </linearGradient>
      </defs>
      {/* Tiga helai bulu per sayap: panjangnya bertingkat supaya bentuknya
          menyerupai sayap terbuka, bukan segitiga polos. */}
      <path
        d="M4 116 C 8 74, 20 44, 46 24 C 38 52, 32 82, 30 116 Z"
        fill={`url(#${id})`}
        opacity="0.95"
      />
      <path
        d="M14 116 C 20 80, 32 54, 56 36 C 48 62, 42 88, 40 116 Z"
        fill={`url(#${id})`}
        opacity="0.7"
      />
      <path
        d="M26 116 C 32 90, 42 70, 62 56 C 55 78, 50 96, 48 116 Z"
        fill={`url(#${id})`}
        opacity="0.45"
      />
    </svg>
  );
}

export function ClanRankWings({
  rank,
  children,
  className,
}: {
  /** Peringkat clan. 1-3 dapat sayap, selain itu tidak. */
  rank: number;
  children: ReactNode;
  className?: string;
}) {
  if (rank !== 1 && rank !== 2 && rank !== 3) {
    return <div className={className}>{children}</div>;
  }
  const style = WING_STYLE[rank];
  const gid = `wing-grad-${rank}`;

  return (
    <div
      className={cn("yn-wing-host relative overflow-hidden", className)}
      style={
        {
          "--wing-from": style.from,
          "--wing-to": style.to,
          "--wing-glow": style.glow,
          "--wing-scale": style.scale,
        } as React.CSSProperties
      }
    >
      {/* Cahaya lembut di belakang kartu supaya sayap tidak terlihat
          menempel di atas warna gelap. */}
      <span className="yn-wing-glow" aria-hidden />

      {/* Dua sayap: kiri dan kanan, masing-masing di luar tepi kartu. */}
      <span className="yn-wing yn-wing-left" aria-hidden>
        <WingShape id={`${gid}-l`} flip={false} />
      </span>
      <span className="yn-wing yn-wing-right" aria-hidden>
        <WingShape id={`${gid}-r`} flip />
      </span>

      {children}
    </div>
  );
}