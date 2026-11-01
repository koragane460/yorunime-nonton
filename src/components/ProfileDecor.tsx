import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * HIASAN DETAIL AKUN — toko + render fullscreen.
 *
 * Semua hiasan digambar dengan CSS/animasi frame (bukan GIF) supaya ringan.
 * Harga HARUS sama dengan DECOR_PRICES di `src/convex/account.ts`.
 */
export type DecorDef = {
  id: string;
  name: string;
  price: number;
  blurb: string;
  tone: string;
};

export const DECORATIONS: DecorDef[] = [
  {
    id: "none",
    name: "Tanpa Hiasan",
    price: 0,
    blurb: "Detail akun bersih tanpa efek.",
    tone: "from-white/15 to-white/5",
  },
  {
    id: "aurora",
    name: "Tirai Aurora",
    price: 900,
    blurb: "Pinggiran layar bergradasi aurora, bergerak pelan.",
    tone: "from-emerald-300/80 via-sky-400/70 to-fuchsia-400/70",
  },
  {
    id: "fire",
    name: "Percikan Api",
    price: 1200,
    blurb: "Percikan garis dari kiri atas ke kanan bawah.",
    tone: "from-amber-300 via-orange-500 to-red-600",
  },
  {
    id: "stardust",
    name: "Debu Bintang",
    price: 1400,
    blurb: "Bintang jatuh + kelip di pinggir layar.",
    tone: "from-sky-200 via-indigo-300 to-violet-400",
  },
  {
    id: "sakura",
    name: "Sakura Jatuh",
    price: 1800,
    blurb: "Kelopak jatuh, tepi layar pink, pohon sakura bertekstur.",
    tone: "from-pink-200 via-rose-400 to-pink-700",
  },
  {
    id: "pistol",
    name: "Kilat Pistol",
    price: 2200,
    blurb: "Pistol menembak dengan muzzle flash & garis tembakan.",
    tone: "from-zinc-200 via-slate-400 to-zinc-800",
  },
  {
    id: "newyear",
    name: "Kembang Api 2027",
    price: 3000,
    blurb: "Ledakan kembang api + tulisan HAPPY NEW YEAR 2027.",
    tone: "from-yellow-200 via-amber-400 to-rose-500",
  },
];

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Partikel dengan posisi acak deterministik — tidak berubah tiap render. */
function useParticles(n: number, seed = 11) {
  const [list] = useState(() => {
    const rnd = mulberry(seed);
    return Array.from({ length: n }).map(() => ({
      x: rnd() * 100,
      y: rnd() * 100,
      s: 0.6 + rnd() * 1.8,
      d: 2.6 + rnd() * 4.4,
      delay: rnd() * 6,
      drift: (rnd() - 0.5) * 160,
      rot: rnd() * 360,
    }));
  });
  return list;
}

function EdgeGlow({ className }: { className?: string }) {
  return <span aria-hidden className={cn("decor-edge", className)} />;
}

export function ProfileDecor({
  decor,
  className,
}: {
  decor?: string | null;
  className?: string;
}) {
  if (!decor || decor === "none") return null;
  return (
    <div className={cn("profile-decor", `decor-${decor}`, className)} aria-hidden>
      {decor === "aurora" && <EdgeGlow className="decor-edge-aurora" />}
      {decor === "fire" && <FireDecor />}
      {decor === "stardust" && <StarDecor />}
      {decor === "sakura" && <SakuraDecor />}
      {decor === "pistol" && <PistolDecor />}
      {decor === "newyear" && <NewYearDecor />}
    </div>
  );
}

function FireDecor() {
  const parts = useParticles(30, 77);
  return (
    <>
      <EdgeGlow className="decor-edge-fire" />
      {parts.map((p, i) => (
        <span
          key={i}
          className="decor-streak"
          style={
            {
              "--x": `${p.x}%`,
              "--y": `${p.y}%`,
              "--len": `${28 + p.s * 26}px`,
              "--dur": `${p.d}s`,
              "--delay": `${p.delay}s`,
              "--drift": `${p.drift}px`,
            } as React.CSSProperties
          }
        />
      ))}
    </>
  );
}

function StarDecor() {
  const parts = useParticles(26, 31);
  return (
    <>
      <EdgeGlow className="decor-edge-stardust" />
      {parts.map((p, i) => (
        <span
          key={i}
          className="decor-star"
          style={
            {
              "--x": `${p.x}%`,
              "--y": `${p.y}%`,
              "--dur": `${p.d * 2.2}s`,
              "--delay": `${p.delay}s`,
            } as React.CSSProperties
          }
        />
      ))}
    </>
  );
}

function SakuraDecor() {
  const petals = useParticles(26, 53);
  return (
    <>
      <EdgeGlow className="decor-edge-sakura" />
      <img src="/yn-sakura-tree.svg" alt="" className="decor-sakura-tree" />
      {petals.map((p, i) => (
        <span
          key={i}
          className="decor-petal"
          style={
            {
              "--x": `${p.x}%`,
              "--dur": `${7 + p.s * 3}s`,
              "--delay": `${p.delay}s`,
              "--drift": `${p.drift}px`,
              "--rot": `${p.rot}deg`,
              "--size": `${8 + p.s * 6}px`,
            } as React.CSSProperties
          }
        />
      ))}
    </>
  );
}

function PistolDecor() {
  return (
    <>
      <EdgeGlow className="decor-edge-pistol" />
      <div className="decor-gun-wrap">
        <img src="/yn-pistol.svg" alt="" className="decor-gun" />
        <span className="decor-muzzle" />
        <span className="decor-tracer decor-tracer-a" />
        <span className="decor-tracer decor-tracer-b" />
        <span className="decor-tracer decor-tracer-c" />
      </div>
    </>
  );
}

function NewYearDecor() {
  const bursts = [
    { x: 22, y: 30, delay: 0, hue: "amber" },
    { x: 74, y: 24, delay: 0.28, hue: "rose" },
    { x: 50, y: 46, delay: 0.56, hue: "sky" },
  ];
  return (
    <>
      <EdgeGlow className="decor-edge-newyear" />
      {bursts.map((b, bi) => (
        <div
          key={bi}
          className={cn("decor-fw", `decor-fw-${b.hue}`)}
          style={
            {
              left: `${b.x}%`,
              top: `${b.y}%`,
              "--delay": `${b.delay}s`,
            } as React.CSSProperties
          }
        >
          {Array.from({ length: 18 }).map((_, i) => (
            <span
              key={i}
              className="decor-fw-spark"
              style={{ "--a": `${i * 20}deg`, "--d": `${26 + (i % 5) * 8}px` } as React.CSSProperties}
            />
          ))}
        </div>
      ))}
      <span className="decor-ny-text">HAPPY NEW YEAR 2027</span>
    </>
  );
}

/**
 * Kartu PREVIEW untuk toko: hiasan ditampilkan di dalam kotak kecil sehingga
 * user bisa melihat hasilnya sebelum membeli.
 */
export function DecorPreview({ id }: { id: string }) {
  return (
    <div className="decor-preview">
      <span className="decor-preview-bg" />
      <span className="decor-preview-avatar">Y</span>
      <ProfileDecor decor={id} className="profile-decor-preview" />
    </div>
  );
}

/** Apakah hiasan ini sudah dipakai user (untuk label toko). */
export function decorLabel(id: string) {
  return DECORATIONS.find((d) => d.id === id)?.name ?? id;
}

/** Reset preview saat komponen di-unmount (dipakai beberapa layar). */
export function useDecorPreview() {
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!preview) return;
    const t = window.setTimeout(() => setPreview(null), 6000);
    return () => window.clearTimeout(t);
  }, [preview]);
  return { preview, setPreview };
}
