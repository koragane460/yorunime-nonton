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
  Eye,
  Tv,
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

/** Judul seksi — SEMUA layar pakai perangkat yang sama: batang emas
 *  vertikal + judul tegas (design system v2, gaya editorial). */
export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="yn-sec mb-2.5 mt-6 text-[1.05rem]">
      {children}
    </h2>
  );
}

export function AnimeCard({
  id,
  title,
  image,
  score,
  status,
  type,
  rank,
  onClick,
  isNew,
  imageOnly,
  squareBottom,
  views,
  episodes,
}: {
  id?: string;
  title: string;
  image: string;
  score?: number;
  status?: string;
  /** Label format tayang: "TV", "Movie", "OVA", "Donghua", dll. */
  type?: string;
  rank?: number;
  onClick?: () => void;
  isNew?: boolean;
  /** true = hanya poster, judul & skor ditampilkan oleh pemanggil. */
  imageOnly?: boolean;
  /** true = sudut bawah poster SUDUT KOTAK (tidak rounded) supaya menyatu dengan
      kotak judul di bawahnya (permintaan: Update News). */
  squareBottom?: boolean;
  /** Jumlah views — ditampilkan di bawah judul saat tersedia. */
  views?: number;
  /** Jumlah episode — "N episode" di bawah judul (donghua memakai `episode`). */
  episodes?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative w-full overflow-hidden text-left transition hover:opacity-90",
        squareBottom ? "rounded-t-xl" : "rounded-xl",
      )}
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
        {/* Title ONGOING/TAMAT — melekat FLUSH di kiri ATAS kartu (rounded
            hanya pojok kanan-bawah, jadi kelihatan nyambung ke sudut poster).
            Badge rank/New ikut bergeser ke kanannya lewat satu flex. */}
        <div className="absolute left-0 top-0 z-10 flex items-start">
          {status && (
            <span
              className={cn(
                "rounded-none rounded-br-lg px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide",
                // Teks PUTIH (permintaan) — biru tua supaya kontras.
                /tamat|completed|ended|selesai|finish/i.test(status)
                  ? "bg-sky-800 text-white"
                  : "bg-sky-600 text-white",
              )}
            >
              {status}
            </span>
          )}
          {rank !== undefined && (
            <span className="m-1.5 rounded-md bg-black/75 px-1.5 py-0.5 text-xs font-bold text-primary">
              #{rank}
            </span>
          )}
          {isNew && (
            <span className="m-1.5 rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
              New
            </span>
          )}
        </div>
      </div>
      {!imageOnly && (
        <div className="rounded-b-xl bg-black/55 p-2 backdrop-blur-sm">
          {/* Judul di atas kotak SEMI-OPAQUE — gambar "screen home" masih
              sedikit kelihatan, tapi tidak ada "bolong" di balik teks. */}
          <p className="line-clamp-2 text-xs font-medium leading-4 text-white">
            {title}
          </p>
          {/* Baris meta meniru persis bagian "Yang serupa": bintang kuning
              + rating dulu, lalu ikon TV + tipe; "· N episode" wrap sendiri
              ke baris berikutnya di kartu yang sempit. */}
          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[11px] text-white/70">
            {score !== undefined && score > 0 && (
              <span className="inline-flex items-center gap-0.5 font-bold text-yellow-400">
                <Star className="size-3 fill-current" aria-hidden />
                {score.toFixed(1)}
              </span>
            )}
            {type && (
              <span className="inline-flex items-center gap-0.5">
                <Tv className="size-3" aria-hidden />
                {type === "MOVIE"
                  ? "Movie"
                  : type === "TV_SHORT"
                    ? "TV Short"
                    : type}
              </span>
            )}
            {typeof episodes === "number" && episodes > 0 && (
              <span>· {episodes} episode</span>
            )}
            {views !== undefined && views > 0 && (
              <span className="inline-flex items-center gap-0.5">
                <Eye className="size-3" aria-hidden />
                {views.toLocaleString("id-ID")}
              </span>
            )}
          </div>
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
  views,
}: {
  items: {
    id: string;
    title: string;
    image: string;
    score?: number;
    status?: string;
    type?: string;
    /** Jumlah episode — tampil di bawah judul ("N episode"). */
    episodes?: number;
    // "sanka" = slug donghua. Wajib diteruskan supaya kartu itu membuka layar
    // detail DONGHUA, bukan dicari sebagai MAL id anime. "film" = hasil
    // pencarian film (dibuka lewat rute /film).
    source?: "anilist" | "sanka" | "film";
  }[];
  // Judul ikut diteruskan supaya halaman detail bisa mencari metadata anime
  // dari kartu penghasilnya, walau id-nya bukan MAL id.
  onPick: (id: string, title?: string, source?: "anilist" | "sanka" | "film") => void;
  ranked?: boolean;
  newIds?: Set<string>;
  views?: number[];
}) {
  /* 3 kartu per baris di layar kecil (permintaan terbaru), melebar
     bertahap di tablet/desktop supaya kartu tetap proporsional. */
  return (
    <div className="grid grid-cols-3 gap-2 md:gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {items.map((a, i) => (
        <AnimeCard
          key={a.id + i}
          id={a.id}
          title={a.title}
          image={a.image}
          score={a.score}
          status={a.status}
          type={a.type}
          episodes={a.episodes}
          views={views?.[i]}
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

/** Centang UNGU — bot official YoruNime (Luna Bot musik). */
export function PurpleCheck({ className }: { className?: string }) {
  return (
    <BadgeCheck
      className={cn("size-4 shrink-0 fill-violet-500 text-white", className)}
      aria-label="Bot Official YoruNime"
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
        // badge-shine = animasi kilau menyapu (index.css) — tag level ikut
        // berkilau mengikuti tag clan.
        "badge-shine inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold text-white/95",
        b.cls,
        className,
      )}
    >
      <Icon className="size-3 drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]" aria-hidden />
      Lv.{level}
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
        // `||` (bukan `??`) supaya string kosong juga jatuh ke fallback yang
        // sama dengan StoryRing — foto profil konsisten di semua layar.
        src={src || avatarFallback(seed)}
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
          {progress} / {cost} <SacretIcon className="inline size-3 -translate-y-px" aria-hidden />
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
 * Aturan yang diminta:
 *   1-49    coklat (brown)
 *   50-99   emas (gold)
 *   100-149 merah (red)
 *   150-200 rainbow
 *
 * Warna tersebut IALAH warna namanya, belum termasuk shimmer. TAG-nya
 * (teks [YRNM]) selalu PUTIH, bentuknya kotak tanpa sudut bulat, dengan
 * segitiga lancip di kiri dan kanan (kiri menghadap kiri, kanan menghadap
 * kanan).
 */
export const CLAN_TIER_BROWN_MIN = 1;
export const CLAN_TIER_GOLD_MIN = 50;
export const CLAN_TIER_RED_MIN = 100;
export const CLAN_TIER_RAINBOW_MIN = 150;

export function clanTextClass(level?: number) {
  const n = Number(level ?? 0);
  if (n >= CLAN_TIER_RAINBOW_MIN) return "clan-tier-rainbow";
  if (n >= CLAN_TIER_RED_MIN) return "clan-tier-red";
  if (n >= CLAN_TIER_GOLD_MIN) return "clan-tier-gold";
  return "clan-tier-brown";
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

/**
 * Bentuk tag clan mengikuti TIER LEVEL clan (satu bentuk khusus tiap
 * ambang naik level — permintaan user):
 *   1-49    ribbon (bawaan, gaya yang sudah disukai)
 *   50-99   cut    (tersayat diagonal, ring emas)
 *   100-149 shield (perisai lancip bawah, ring merah)
 *   150-199 hex    (ujung runcing kiri-kanan, ring rainbow)
 *   200+    royal  (oktagon megah + glow emas)
 * clip-path-nya ada di index.css (`.clan-tag-cut`, dst) dan dipasang di
 * elemen RING sekaligus isi supaya tepinya ikut terpotong presisi.
 */
function clanTagShape(level?: number): "ribbon" | "cut" | "shield" | "hex" | "royal" {
  const n = Number(level ?? 0);
  if (n >= 200) return "royal";
  if (n >= 150) return "hex";
  if (n >= 100) return "shield";
  if (n >= 50) return "cut";
  return "ribbon";
}

const CLAN_TAG_SHAPE_CLS: Record<string, string> = {
  cut: "clan-tag-cut",
  shield: "clan-tag-shield",
  hex: "clan-tag-hex",
  royal: "clan-tag-royal",
};

/** Gradasi RING (garis tepi luar) per tier. */
const CLAN_TAG_RING_CLS: Record<string, string> = {
  cut: "bg-gradient-to-r from-amber-200 via-yellow-500 to-amber-700",
  shield: "bg-gradient-to-r from-rose-300 via-red-500 to-rose-800",
  hex: "bg-gradient-to-r from-fuchsia-300 via-sky-300 to-emerald-300",
  royal: "bg-gradient-to-r from-yellow-200 via-amber-400 to-orange-500",
};

/** Gradasi BADAN (latar teks) per tier — dipakai kalau clan tidak
 *  memilih warna background sendiri. */
const CLAN_TAG_BODY_CLS: Record<string, string> = {
  cut: "bg-gradient-to-r from-amber-800 to-zinc-900",
  shield: "bg-gradient-to-r from-red-800 to-zinc-900",
  hex: "bg-gradient-to-r from-fuchsia-700/90 via-indigo-800 to-emerald-700/90",
  royal: "bg-gradient-to-r from-amber-600 via-amber-800 to-orange-900",
};

export function ClanTag({
  icon,
  tag,
  color,
  level,
  tier,
  bg,
  className,
}: {
  icon: string;
  tag: string;
  color?: string;
  /** Level clan — menentukan warna nama clan & BENTUK tag per tier. */
  level?: number;
  /** TIER TAG YANG DIBELI (1-6) — bentuk & background beda per tier. */
  tier?: number;
  /** Warna latar tag (hex) yang dipilih saat bikin clan. Tanpa ini pakai
   *  latar galaxy bawaan. Diterapkan sebagai overlay translusen di atas
   *  animasi `.clan-tag` supaya tetap kelihatan hidup. */
  bg?: string;
  className?: string;
}) {
  const { Icon, tone } = resolveClanIcon(icon);
  void color;
  const shape = clanTagShape(level);
  const shapeCls = CLAN_TAG_SHAPE_CLS[shape];

  const inner = (
    <>
      {/* Ikon clan BERSIH: warna dari tone ikon saja — tanpa kotak hitam,
          tanpa ring, tanpa garis pemisah (permintaan: ikonnya aneh +
          ada garisnya, perbaiki). */}
      <span
        className="inline-flex size-3.5 shrink-0 items-center justify-center"
        style={{ color: tone }}
        aria-hidden
      >
        <Icon strokeWidth={2.4} className="size-3.5" />
      </span>
      {/* Tag clan selalu PUTIH, kapital, tanpa miring. */}
      <span className="text-[11px] font-black uppercase not-italic tracking-[0.1em] text-white">
        {tag}
      </span>
    </>
  );

  // TIER hasil pembelian di Clan Shop: bentuk + background khusus, bukan
  // sekadar level clan. Ini yang membuat tiap harga terasa berbeda.
  const tierN = Math.max(0, Math.min(6, Math.floor(Number(tier ?? 0))));
  if (tierN > 0) {
    return (
      <span
        className={cn(
          "clan-tag badge-shine inline-flex select-none items-center whitespace-nowrap",
          className,
        )}
      >
        <span
          className={cn(
            "inline-flex p-[2px] clan-tag-tier-" + tierN,
            "bg-gradient-to-r from-white/80 via-white/35 to-white/10",
          )}
        >
          <span
            className={cn(
              "clan-tag-tier-" + tierN,
              "inline-flex items-center gap-1 rounded-none px-2.5 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.35),inset_0_0_0_1px_rgba(0,0,0,0.18)]",
            )}
            style={
              bg
                ? {
                    backgroundImage: `linear-gradient(115deg, ${bg} 0%, ${bg} 58%, rgba(0,0,0,0.55) 100%)`,
                  }
                : undefined
            }
          >
            {inner}
          </span>
        </span>
      </span>
    );
  }

  const bodyStyle = bg
    ? {
        // Warna pilihan penuh di kiri, meredup ke gelap di ujung kanan —
        // memberi kesan berkilau seperti logam.
        backgroundImage: `linear-gradient(115deg, ${bg} 0%, ${bg} 55%, rgba(0,0,0,0.6) 100%)`,
      }
    : undefined;

  // Tier 1-49 (ribbon): bentuk yang sudah disukai user — dipertahankan
  // persis seperti aslinya.
  if (shape === "ribbon") {
    return (
      <span
        className={cn(
          // Tag clan gaya RIBBON: kiri bergerigi masuk, kanan runcing keluar
          // (.clan-tag-ribbon di index.css), huruf miring tebal, dan garis
          // tipis putih di dalam tepinya biar kelihatan tajam & cool.
          "clan-tag badge-shine inline-flex select-none items-center whitespace-nowrap",
          className,
        )}
      >
        <span
          className={cn(
            // KOTAK (siku) — bukan rounded, biar seragam dengan tag lainnya.
            "clan-tag-ribbon inline-flex items-center gap-1 rounded-none px-2 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.3),inset_0_0_0_1px_rgba(255,255,255,0.18)]",
            !bg && "bg-gradient-to-b from-zinc-500/90 via-zinc-700 to-zinc-900",
          )}
          style={bodyStyle}
        >
          {inner}
        </span>
      </span>
    );
  }

  // Tier 50/100/150/200: ring berwarna mengikuti bentuk clip-path +
  // badan dalam yang juga terpotong bentuk sama → tepinya presisi.
  return (
    <span
      className={cn(
        "clan-tag badge-shine inline-flex select-none items-center whitespace-nowrap",
        className,
      )}
    >
      <span
        className={cn(
          "inline-flex p-[2px]",
          shapeCls,
          CLAN_TAG_RING_CLS[shape],
        )}
      >
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-none px-2 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.28)]",
            shapeCls,
            !bg && CLAN_TAG_BODY_CLS[shape],
          )}
          style={bodyStyle}
        >
          {inner}
        </span>
      </span>
    </span>
  );
}

/**
 * Ikon SACRET — bintang 4 sudut (sacred star) yang bersinar, menggantikan
 * ikon berlian/permata untuk mata uang Sacret. Vektor murni supaya tajam
 * di layar mana pun dan bisa dipakai seukuran ikon navigasi.
 */
export function SacretIcon({
  className,
  strokeWidth: _strokeWidth,
}: {
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M12 1.6c.85 5.15 3.25 8.05 8.4 8.9v.2c-5.15.85-7.55 3.75-8.4 8.9h-.2c-.85-5.15-3.25-8.05-8.4-8.9v-.2c5.15-.85 7.55-3.75 8.4-8.9h.2Z" />
      <path
        d="M18.8 15.4c.35 2.05 1.3 3.2 3.35 3.55v.15c-2.05.35-3 1.5-3.35 3.55h-.15c-.35-2.05-1.3-3.2-3.35-3.55v-.15c2.05-.35 3-1.5 3.35-3.55h.15Z"
        opacity=".7"
      />
    </svg>
  );
}

/** Ikon Google "G" warna asli — untuk tombol Masuk dengan Google. */
export function GoogleGIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.46H12v4.65h6.46a5.52 5.52 0 0 1-2.4 3.62v3.01h3.88c2.27-2.09 3.58-5.17 3.58-8.82z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.92l-3.88-3.01c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.95H1.28v3.11A12 12 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.27a7.19 7.19 0 0 1 0-4.54V6.62H1.28a12 12 0 0 0 0 10.76l3.99-3.11z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.28 6.62l3.99 3.11C6.22 6.86 8.87 4.75 12 4.75z"
      />
    </svg>
  );
}
