// YoruNime — KOSMETIK PROFIL: tag TITLE + pita + KARTU KARAKTER.
//
// Dua komponen tampilan dipakai di banyak layar (Pengaturan, detail akun /
// ProfileSheet, halaman Title) supaya konsisten:
//   • TitleTag     — tag title BENTUK BERAGAM + effect (kayak tag clan).
//   • TitleRibbon   — pita bergaris emas berbentuk medali (bukan sekadar teks).
//   • CharacterCard — kartu potret karakter dengan GAMBAR ASLI + chip rank.
import { Award, Crown, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export type CosmeticRank = "SSS" | "SS" | "S";

const RANK_STYLE: Record<
  CosmeticRank,
  { chip: string; frame: string; text: string; glow: string }
> = {
  SSS: {
    chip: "bg-gradient-to-r from-amber-300 to-yellow-500 text-black",
    frame: "border-amber-400/70",
    text: "text-amber-300",
    glow: "shadow-[0_0_22px_-6px_rgba(251,191,36,.85)]",
  },
  SS: {
    chip: "bg-gradient-to-r from-violet-400 to-fuchsia-500 text-white",
    frame: "border-fuchsia-400/55",
    text: "text-fuchsia-300",
    glow: "shadow-[0_0_18px_-8px_rgba(192,132,252,.8)]",
  },
  S: {
    chip: "bg-gradient-to-r from-sky-400 to-blue-600 text-white",
    frame: "border-sky-400/55",
    text: "text-sky-300",
    glow: "shadow-[0_0_15px_-8px_rgba(56,189,248,.7)]",
  },
};

/** Bentuk tag title — BERAGAM, dipilih dari nama title (kayak tag clan):
 *  pita bergerigi, potong miring, perisai, heksagon, dan royal. */
const TITLE_SHAPES = [
  "clan-tag-ribbon",
  "clan-tag-cut",
  "clan-tag-shield",
  "clan-tag-hex",
  "clan-tag-royal",
] as const;

/** Gradasi RING (garis tepi luar) per bentuk. */
const TITLE_RING = [
  "from-amber-200 via-yellow-400 to-amber-600",
  "from-rose-300 via-red-400 to-rose-600",
  "from-sky-300 via-cyan-400 to-emerald-400",
  "from-fuchsia-300 via-purple-400 to-indigo-400",
  "from-yellow-200 via-amber-400 to-orange-500",
];

/** Gradasi BADAN (latar teks) per bentuk. */
const TITLE_BODY = [
  "from-amber-700 to-zinc-900",
  "from-rose-700 to-zinc-900",
  "from-sky-700 to-zinc-900",
  "from-fuchsia-700 to-indigo-900",
  "from-amber-600 via-amber-800 to-orange-900",
];

function titleShapeIdx(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h % TITLE_SHAPES.length;
}

/**
 * TAG TITLE — kotak title terpasang dengan BENTUK BERAGAM + EFEK:
 * ring gradien, outline tipis putih, drop-shadow, dan kilau yang menyapu.
 * Menggantikan pita miring polos di layar Title.
 */
export function TitleTag({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const i = titleShapeIdx(name);
  const shape = TITLE_SHAPES[i];
  const pad = size === "lg" ? "px-4 py-2 text-sm" : "px-2.5 py-1 text-[11px]";
  return (
    <span
      className={cn(
        "clan-tag inline-flex select-none items-center whitespace-nowrap",
        className,
      )}
    >
      {/* ring luar — bentuk yang sama supaya tepinya presisi */}
      <span
        className={cn(
          "inline-flex p-[2px]",
          shape,
          "bg-gradient-to-r",
          TITLE_RING[i],
        )}
      >
        <span
          className={cn(
            "relative inline-flex items-center gap-1.5 overflow-hidden font-black uppercase tracking-wide text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.28)]",
            shape,
            "bg-gradient-to-r",
            TITLE_BODY[i],
            pad,
          )}
        >
          <Award className="size-3.5 shrink-0" aria-hidden />
          <span className="line-clamp-1">{name}</span>
          <Sparkles className="size-3.5 shrink-0 opacity-80" aria-hidden />
          {/* kilau emas yang menyapu tag */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/35 to-transparent"
            style={{
              backgroundSize: "200% 100%",
              animation: "yn-sheen 3.2s ease-in-out infinite",
            }}
          />
        </span>
      </span>
    </span>
  );
}

/**
 * Pita TITLE — bentuk pita/medali (ujung terpotong miring), gradasi emas,
 * ornamen bintang. Bukan kotak rounded biasa.
 */
export function TitleRibbon({
  name,
  size = "md",
  dim = false,
  className,
}: {
  name: string;
  size?: "sm" | "md" | "lg";
  dim?: boolean;
  className?: string;
}) {
  const pad =
    size === "sm"
      ? "px-3 py-1 text-[10px]"
      : size === "lg"
        ? "px-5 py-2 text-sm"
        : "px-4 py-1.5 text-xs";
  return (
    <span
      className={cn(
        "relative inline-flex items-center gap-1.5 font-black uppercase tracking-wide",
        // clip-path memberi bentuk pita: ujung kiri/kanan terpotong miring.
        "[clip-path:polygon(8px_0,100%_0,calc(100%-8px)_100%,0_100%)]",
        pad,
        dim
          ? "bg-white/10 text-zinc-400"
          : "bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 text-black shadow-[0_0_16px_-6px_rgba(251,191,36,.9)]",
        className,
      )}
    >
      <Award className={cn("shrink-0", size === "lg" ? "size-4" : "size-3")} aria-hidden />
      <span className="line-clamp-1">{name}</span>
      {!dim && (
        <Sparkles className={cn("shrink-0 opacity-80", size === "lg" ? "size-4" : "size-3")} aria-hidden />
      )}
    </span>
  );
}

/**
 * KARTU KARAKTER — potret dengan GAMBAR ASLI, pita rank, nama + anime,
 * dan bingkai bercahaya sesuai rank. Kartu terpasang diberi mahkota.
 */
export function CharacterCard({
  name,
  anime,
  rank,
  image,
  active = false,
  dim = false,
  owned = true,
  onClick,
  disabled = false,
  className,
}: {
  name: string;
  anime?: string;
  rank: CosmeticRank;
  image?: string;
  /** Sedang dipasang di profil. */
  active?: boolean;
  /** Efek redup (mis. sedang sibuk). */
  dim?: boolean;
  /** false = kartu belum dimiliki (tampil tertutup). */
  owned?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const style = RANK_STYLE[rank] ?? RANK_STYLE.S;
  const Tag: any = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      disabled={disabled}
      title={`${name}${anime ? ` — ${anime}` : ""} (${rank})`}
      className={cn(
        "group relative block aspect-[3/4] w-full overflow-hidden rounded-xl border text-left transition active:scale-[0.97]",
        style.frame,
        owned ? style.glow : "opacity-45 grayscale",
        dim && "pointer-events-none opacity-60",
        active && "ring-2 ring-gold ring-offset-2 ring-offset-background",
        className,
      )}
    >
      {image ? (
        <img
          src={image}
          alt={name}
          loading="lazy"
          className="absolute inset-0 size-full object-cover object-top transition duration-300 group-hover:scale-105"
        />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-white/10 to-black/40 text-2xl font-black text-white/75">
          {name.slice(0, 1)}
        </span>
      )}

      {/* Scrim bawah supaya nama & anime tetap terbaca di atas gambar */}
      <span
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/15 to-black/30"
      />

      {/* Chip rank di pojok kiri atas */}
      <span
        className={cn(
          "absolute left-1.5 top-1.5 rounded-md px-1.5 py-0.5 text-[9px] font-black leading-none",
          style.chip,
        )}
      >
        {rank}
      </span>

      {/* Mahkota kecil untuk kartu yang sedang terpasang */}
      {active && (
        <span className="absolute right-1.5 top-1.5 flex items-center gap-0.5 rounded-md bg-gold px-1.5 py-0.5 text-[8px] font-black leading-none text-black">
          <Crown className="size-2.5" aria-hidden />
          PASANG
        </span>
      )}

      {/* Nama karakter + anime di bawah kartu */}
      <span className="absolute inset-x-0 bottom-0 block p-1.5">
        <span className="line-clamp-1 block text-[11px] font-black leading-tight text-white">
          {name}
        </span>
        {anime && (
          <span className="line-clamp-1 block text-[9px] font-semibold leading-tight text-white/70">
            {anime}
          </span>
        )}
      </span>

      {/* Padlock untuk kartu yang belum dimiliki */}
      {!owned && (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="rounded-full bg-black/70 px-2 py-1 text-[10px] font-black text-white/90">
            BELUM DIMILIKI
          </span>
        </span>
      )}
    </Tag>
  );
}
