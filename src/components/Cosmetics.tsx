// YoruNime — KOSMETIK PROFIL: pita TITLE + KARTU KARAKTER.
//
// Dua komponen tampilan dipakai di banyak layar (Pengaturan, detail akun /
// ProfileSheet, halaman Title) supaya konsisten:
//   • TitleRibbon   — pita bergaris emas berbentuk medali (bukan sekadar teks).
//   • CharacterCard — kartu potret karakter dengan GAMBAR ASLI + chip rank.
import { Crown, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export type CosmeticRank = "SSS" | "SS" | "S";

const RANK_STYLE: Record<
  CosmeticRank,
  { chip: string; frame: string; text: string; glow: string }
> = {
  SSS: {
    chip: "bg-gradient-to-r from-amber-300 to-yellow-500 text-black",
    frame: "from-amber-300 via-yellow-400 to-amber-600",
    text: "text-amber-300",
    glow: "shadow-[0_0_22px_-6px_rgba(251,191,36,.85)]",
  },
  SS: {
    chip: "bg-gradient-to-r from-violet-400 to-fuchsia-500 text-white",
    frame: "from-violet-400 via-fuchsia-500 to-purple-700",
    text: "text-fuchsia-300",
    glow: "shadow-[0_0_18px_-8px_rgba(192,132,252,.8)]",
  },
  S: {
    chip: "bg-gradient-to-r from-sky-400 to-blue-600 text-white",
    frame: "from-sky-400 via-blue-500 to-indigo-600",
    text: "text-sky-300",
    glow: "shadow-[0_0_15px_-8px_rgba(56,189,248,.7)]",
  },
};

/**
 * Pita TITLE — bentuk medali/pita (ujung terpotong like pita), gradasi emas,
 * ornamen bintang. Bukan kotak rounded biasa.
 */
export function TitleRibbon({
  name,
  size = "md",
  dim = false,
  className,
}: {
  name: string;
  size?: "sm" | "md";
  dim?: boolean;
  className?: string;
}) {
  const small = size === "sm";
  return (
    <span
      className={cn(
        "relative inline-flex items-center gap-1.5 py-1 font-black uppercase tracking-wide",
        // clip-path memberi bentuk pita: ujung kiri/kanan terpotong V.
        "[clip-path:polygon(8px_0,100%_0,calc(100%-8px)_100%,0_100%)]",
        small ? "px-3 text-[10px]" : "px-4 text-xs",
        dim
          ? "bg-white/10 text-zinc-400"
          : cn(
              "bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 text-black shadow-[0_0_16px_-6px_rgba(212,175,55,.8)]",
            ),
        className,
      )}
    >
      {dim ? (
        <Crown className={cn(small ? "size-2.5" : "size-3")} aria-hidden />
      ) : (
        <Sparkles className={cn(small ? "size-2.5" : "size-3")} aria-hidden />
      )}
      <span className="truncate">{name}</span>
    </span>
  );
}

/**
 * KARTU KARAKTER — potret tegak dengan GAMBAR ASLI, bingkai gradasi rank,
 * chip rank di pojok, dan pita nama di bawah. Inilah tampilan kartu gacha.
 */
export function CharacterCard({
  name,
  anime,
  rank,
  image,
  className,
  locked = false,
}: {
  name: string;
  anime?: string;
  rank: CosmeticRank;
  image?: string;
  className?: string;
  locked?: boolean;
}) {
  const style = RANK_STYLE[rank] ?? RANK_STYLE.S;
  return (
    <div
      className={cn(
        "relative aspect-[3/4] w-full overflow-hidden rounded-xl border border-white/20 bg-gradient-to-b",
        style.frame,
        !locked && style.glow,
        locked && "opacity-60 grayscale",
        className,
      )}
    >
      {image ? (
        <img
          src={image}
          alt={name}
          loading="lazy"
          className="size-full object-cover"
        />
      ) : (
        <div className="flex size-full items-center justify-center text-2xl font-black text-white/80">
          {name.slice(0, 1)}
        </div>
      )}
      {/* Chip rank di pojok kiri atas */}
      <span
        className={cn(
          "absolute left-1 top-1 rounded px-1.5 py-0.5 text-[9px] font-black",
          style.chip,
        )}
      >
        {rank}
      </span>
      {/* Pita nama di bawah */}
      <span className="absolute inset-x-0 bottom-0 bg-black/65 px-1 py-1 text-center">
        <span className="block truncate text-[10px] font-bold leading-tight text-white">
          {name}
        </span>
        {anime && (
          <span className="block truncate text-[8px] leading-tight text-white/60">
            {anime}
          </span>
        )}
      </span>
    </div>
  );
}
