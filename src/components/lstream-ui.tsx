import {
  BadgeCheck,
  Crown,
  Flag,
  Flame,
  FlaskConical,
  Gem,
  Palette,
  Shield,
  Star,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { badgeForLevel, avatarFallback } from "@/lib/lstream";
import { resolveClanIcon } from "@/lib/clanIcons";

/** Gaya title staff: dev merah, moderator biru, tester emas, sepuh kuning. */
const TITLE_STYLE: Record<
  string,
  { label: string; Icon: LucideIcon; cls: string }
> = {
  dev: {
    label: "Developer",
    Icon: Flame,
    cls: "bg-gradient-to-r from-red-700 via-red-500 to-rose-600",
  },
  creator: {
    label: "Creator",
    Icon: Palette,
    cls: "bg-gradient-to-r from-red-700 via-red-500 to-rose-600",
  },
  mod: {
    label: "Moderator",
    Icon: Shield,
    cls: "bg-gradient-to-r from-blue-700 via-blue-500 to-sky-600",
  },
  tester: {
    label: "Tester",
    Icon: FlaskConical,
    cls: "bg-gradient-to-r from-amber-600 via-amber-400 to-yellow-500",
  },
  sepuh: {
    label: "Sepuh",
    Icon: Crown,
    cls: "bg-gradient-to-r from-yellow-600 via-yellow-400 to-amber-500",
  },
};

/**
 * Resolusi title dari (role, seqId) dalam satu tempat.
 *
 * Ini dipisah dari komponen supaya Home, Akun, Chat, dan CommentsPasti
 * menampilkan title yang sama untuk user yang sama. Sebelumnya tiap layar
 * memanggil TitleBadge dengan argumen berbeda — beberapa tidak mengirim
 * seqId — sehingga akun yang sama terlihat "Developer" di Home tapi
 * "Moderator" di Akun.
 *
 * Aturannya: ID 1 adalah akun asli developer, jadi walau role-nya "mod"
 * title-nya tetap Developer. Role kosong/tidak dikenal TIDAK lagi jatuh ke
 * Developer — user biasa tidak punya badge sama sekali (sebelumnya semua
 * akun terlihat sebagai Developer).
 */
export function titleStyleOf(role?: string, seqId?: number) {
  const key = role === "mod" && seqId === 1 ? "dev" : (role ?? "");
  return TITLE_STYLE[key];
}

/** Sama seperti titleStyleOf, khusus warna tier clan. */
export function clanTierClass(level?: number) {
  return clanTextClass(level);
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-2 mt-5 text-[15px] font-bold">{children}</h2>
  );
}

export function AnimeCard({
  id,
  title,
  image,
  score,
  status,
  rank,
  onClick,
  isNew,
  imageOnly,
}: {
  id?: string;
  title: string;
  image: string;
  score?: number;
  status?: string;
  rank?: number;
  onClick?: () => void;
  isNew?: boolean;
  /** true = hanya poster, judul & skor ditampilkan oleh pemanggil. */
  imageOnly?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="group relative w-full overflow-hidden rounded-xl border border-border/60 bg-card text-left transition hover:border-foreground/40 hover:border-foreground/60"
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-muted">
        {image ? (
          <img
            src={image}
            alt={title}
            loading="lazy"
            onError={(e) => {
              // Poster gagal load → ganti tampilan fallback gradient + judul
              const el = e.currentTarget;
              el.style.display = "none";
              el.nextElementSibling?.classList.remove("hidden");
            }}
            className="size-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : null}
        <div
          className={cn(
            "flex size-full flex-col items-center justify-center gap-1 bg-gradient-to-b from-secondary to-muted text-[10px] text-muted-foreground",
            image && "hidden",
          )}
        >
          <Star className="size-5 opacity-40" />
          {title.split(" ").slice(0, 2).join(" ")}
        </div>
        {rank !== undefined && (
          <span className="absolute left-1.5 top-1.5 rounded-md bg-black/75 px-1.5 py-0.5 text-xs font-bold text-primary">
            #{rank}
          </span>
        )}
        {isNew && (
          <span className="absolute left-1.5 top-1.5 rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
            New
          </span>
        )}
        {status && (
          <span className="absolute bottom-1.5 left-1.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px]">
            {status}
          </span>
        )}
      </div>
      {!imageOnly && (
        <div className="p-2">
          <p className="line-clamp-2 min-h-8 text-xs font-medium leading-4">{title}</p>
          {score !== undefined && score > 0 && (
            <p className="mt-1 flex items-center gap-1 text-[11px] text-gold">
              <Star className="size-3 fill-gold" /> {score.toFixed(2)}
            </p>
          )}
        </div>
      )}
    </button>
  );
}

export function AnimeGrid({
  items,
  onPick,
  ranked,
  newIds,
}: {
  items: {
    id: string;
    title: string;
    image: string;
    score?: number;
    status?: string;
    // "sanka" = slug donghua. Wajib diteruskan supaya kartu itu membuka layar
    // detail DONGHUA, bukan mencari id-nya sebagai MAL id anime.
    source?: "anilist" | "sanka";
  }[];
  // Judul ikut diteruskan supaya halaman detail bisa mencari metadata anime
  // dari kartu penghasilnya, walau id-nya bukan MAL id.
  onPick: (id: string, title?: string, source?: "anilist" | "sanka") => void;
  ranked?: boolean;
  newIds?: Set<string>;
}) {
  return (
    <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
      {items.map((a, i) => (
        <AnimeCard
          key={a.id + i}
          id={a.id}
          title={a.title}
          image={a.image}
          score={a.score}
          status={a.status}
          rank={ranked ? i + 1 : undefined}
          isNew={newIds?.has(a.id)}
          onClick={() => onPick(a.id, a.title, a.source)}
        />
      ))}
    </div>
  );
}

/** Badge berkilau (staff / clan role) */
export function ShineBadge({
  label,
  gradient,
  className,
}: {
  label: string;
  gradient: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "badge-shine inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold text-white shadow",
        "bg-gradient-to-r",
        gradient,
        className,
      )}
    >
      {label}
    </span>
  );
}

/**
 * Title staff dengan efek silau. Warna: dev merah, moderator biru,
 * tester emas, sepuh kuning.
 */
export function TitleBadge({
  role,
  seqId,
  className,
  compact,
}: {
  role?: string;
  seqId?: number;
  className?: string;
  compact?: boolean;
}) {
  const def = titleStyleOf(role, seqId);
  // User tanpa role staff tidak/badge staff pun tidak perlu dirender.
  if (!def) return null;
  return (
    <span
      className={cn(
        "badge-shine title-shine inline-flex shrink-0 items-center gap-1 rounded-md font-bold text-white shadow",
        compact ? "px-1.5 py-0 text-[9px]" : "px-2 py-0.5 text-[10px]",
        def.cls,
        className,
      )}
    >
      <span className="inline-flex size-3 items-center justify-center">
        <def.Icon className="size-3" aria-hidden />
      </span>
      {def.label}
    </span>
  );
}

/** Centang biru ala TikTok untuk user premium. */
export function BlueCheck({ className }: { className?: string }) {
  return (
    <BadgeCheck
      className={cn("size-4 shrink-0 fill-sky-500 text-white", className)}
      aria-label="Premium"
    />
  );
}

/** Logo merah untuk akun yang ditandai developer lewat "@username". */
export function RedMark({ className }: { className?: string }) {
  return (
    <span
      title="Ditandai developer"
      aria-label="Ditandai developer"
      className={cn(
        "inline-flex size-5 shrink-0 items-center justify-center rounded-md bg-red-600 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.15)_inset]",
        className,
      )}
    >
      <Flag className="size-3 fill-current" />
    </span>
  );
}

/** Badge level: ikon tier + angka level (tanpa tulisan tier). */
export function LevelBadge({ level, className }: { level: number; className?: string }) {
  const b = badgeForLevel(level);
  const Icon = b.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold text-white/95",
        b.cls,
        className,
      )}
    >
      <Icon className="size-3" aria-hidden /> Lv.{level}
    </span>
  );
}

export function UserBadges({
  level,
  staffRole,
}: {
  level: number;
  staffRole?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <LevelBadge level={level} />
      <TitleBadge role={staffRole} />
    </div>
  );
}

export function Avatar({
  src,
  seed,
  className,
  online,
}: {
  src?: string;
  seed?: string;
  className?: string;
  online?: boolean;
}) {
  return (
    <span
      className={cn(
        "relative block shrink-0 overflow-hidden rounded-full bg-secondary align-middle",
        className,
      )}
    >
      <img
        src={src ?? avatarFallback(seed)}
        alt=""
        className="block size-full rounded-full object-cover"
      />
      {online !== undefined && (
        <span
          className={cn(
            "absolute bottom-0 right-0 size-3 rounded-full border-2 border-background",
            online ? "bg-green-500" : "bg-zinc-500",
          )}
        />
      )}
    </span>
  );
}

/** Bar level 1..200 clan */
export function ClanLevelBar({
  level,
  progress,
  cost,
}: {
  level: number;
  progress: number;
  cost: number;
}) {
  const pct = Math.min(100, Math.round((progress / Math.max(1, cost)) * 100));
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-muted-foreground">
        <span>
          Level <b className="text-foreground">{level}</b> / 200
        </span>
        <span>
          {progress} / {cost} <Gem className="inline size-3 -translate-y-px" aria-hidden />
        </span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/** Tag clan: background galaxy silau sesuai warna clan. */

/**
 * Warna nama clan berdasarkan level clannya.
 *
 * Ambang ini HARUS sama persis dengan yang dipakai di halaman Clan dan di
 * chat clan - kalau berbeda, tag clan akan tampil beda warna di layar lain
 * padahal clan-nya sama. Tingkatan yang dipakai:
 *   1-49    biru muda
 *   50-99   hijau muda
 *   100-149 ungu
 *   150-200 emas
 *
 * Semua warna terang sudah dipilih kontras terhadap latar gelap tag, jadi
 * tetap terbaca di atas banner apa pun.
 */
export const CLAN_TIER_BLUE_MIN = 1;
export const CLAN_TIER_GREEN_MIN = 50;
export const CLAN_TIER_PURPLE_MIN = 100;
export const CLAN_TIER_GOLD_MIN = 150;

export function clanTextClass(level?: number) {
  const n = Number(level ?? 0);
  if (n >= CLAN_TIER_GOLD_MIN) return "clan-tier-gold";
  if (n >= CLAN_TIER_PURPLE_MIN) return "clan-tier-purple";
  if (n >= CLAN_TIER_GREEN_MIN) return "clan-tier-green";
  return "clan-tier-blue";
}

/**
 * Kelas warna untuk NAMA clan (bukan tag).
 *
 * Aturan yang diminta: NAMA clan berwarna sesuai level, tapi TAG-nya
 * (teks [YRNM] di dalam kotak) selalu PUTIH untuk semua clan. Dua fungsi
 * ini dulu satu-satunya dan tag ikut ke-pink/kuning, padahal yang harus
 * berwarna cuma namanya.
 *
 * `yn-shimmer` ditambahkan di sini (bukan di tiap pemanggilan) supaya efek
 * silau ikut konsisten di Home, daftar clan, podium, chat, dan detail —
 * dan otomatis ikut untuk clan baru tanpa perlu sentuh tiap layar.
 */
export function clanNameClass(level?: number) {
  return `${clanTextClass(level)} yn-shimmer`;
}

export function ClanTag({
  icon,
  tag,
  color,
  level,
  className,
}: {
  icon: string;
  tag: string;
  color?: string;
  /** Level clan — menentukan warna & animasi silau nama clan. */
  level?: number;
  className?: string;
}) {
  const { Icon, tone } = resolveClanIcon(icon);
  void color;
  return (
    <span
      className={cn(
        // Bentuk tag clan: persegi dengan dua sudut terpotong (sama seperti
        // preview saat bikin clan) + latar galaxy yang terus berkilau.
        "clan-tag inline-flex select-none items-center gap-1 whitespace-nowrap rounded-lg rounded-tl-none rounded-br-none border border-white/25 px-2 py-0.5 text-xs font-bold tracking-wide",
        className,
      )}
    >
      <span
        className="relative z-[2] inline-flex size-3.5 shrink-0 items-center justify-center"
        style={{ color: tone }}
        aria-hidden
      >
        <Icon className="size-3.5" />
      </span>
      {/* Tag clan (teks [TAG]) selalu PUTIH untuk semua clan. Warna per level
          dipakai di NAMA clan (lihat clanNameClass), bukan di sini. */}
      <span className="relative z-[2] text-white">[{tag}]</span>
    </span>
  );
}
