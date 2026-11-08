/**
 * Ikon gaya SF Symbols (iOS).
 *
 * Semua chrome yang paling terlihat — nav bawah, header Home, tiga tombol
 * atas, lonceng notifikasi — memakai ikon-ikon di sini supaya punya satu
 * bahasa bentuk yang sama: garis 1.7px, ujung & sudut membulat, proporsi
 * alami (bukan geometri kaku). Bentuknya sengaja mengikuti bobot visual
 * SF Symbols: garis tidak terlalu tebal, ruang napas lega, simetri rapi.
 *
 * Dipakai lewat alias nama lucide di tiap file (mis. `SearchIcon as Search`),
 * jadi perpindahannya cuma menyentuh baris import — badan JSX tetap utuh.
 * Varian `*Fill` untuk state aktif di nav (iOS mengisi ikon saat terpilih).
 */
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function S({ strokeWidth = 2.2, children, ...rest }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={24}
      height={24}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

/* ---------------------------------------------------------- navigasi ---- */

/** Rumah: atap melebihi dinding (overhang) + pintu, seperti ikon Home iOS. */
export function HomeIcon(props: IconProps) {
  return (
    <S {...props}>
      <path d="M2.7 11.35 11.35 4.2a1.35 1.35 0 0 1 1.3 0l8.65 7.15" />
      <path d="M5 9.7v9.2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9.7" />
      <path d="M9.6 20.9v-5.3a1.5 1.5 0 0 1 1.5-1.5h1.8a1.5 1.5 0 0 1 1.5 1.5v5.3" />
    </S>
  );
}

export function HomeIconFill(props: IconProps) {
  return (
    <S {...props}>
      <path
        fill="currentColor"
        stroke="none"
        d="M11.35 4.35Q12 3.85 12.65 4.35L21.3 11.35V18.9A2 2 0 0 1 19.3 20.9H14.4V15.6A1.5 1.5 0 0 0 12.9 14.1H11.1A1.5 1.5 0 0 0 9.6 15.6V20.9H4.7A2 2 0 0 1 2.7 18.9V11.35Z"
      />
    </S>
  );
}

/** Kalender dengan dua tiang penggantung di atas. */
export function CalendarIcon(props: IconProps) {
  return (
    <S {...props}>
      <path d="M6.7 5.4h10.6a3.1 3.1 0 0 1 3.1 3.1v9.3a3.1 3.1 0 0 1-3.1 3.1H6.7a3.1 3.1 0 0 1-3.1-3.1V8.5a3.1 3.1 0 0 1 3.1-3.1z" />
      <path d="M8.4 3.2v3.6" />
      <path d="M15.6 3.2v3.6" />
      <path d="M3.6 10.1h16.8" />
    </S>
  );
}

export function CalendarIconFill(props: IconProps) {
  return (
    <S {...props}>
      <path
        fill="currentColor"
        stroke="none"
        fillRule="evenodd"
        d="M6.7 5.4h10.6a3.1 3.1 0 0 1 3.1 3.1v9.3a3.1 3.1 0 0 1-3.1 3.1H6.7a3.1 3.1 0 0 1-3.1-3.1V8.5a3.1 3.1 0 0 1 3.1-3.1zm-2.1 4h14.8v1.7H4.6z"
      />
      <path d="M8.4 3.2v3.6" />
      <path d="M15.6 3.2v3.6" />
    </S>
  );
}

/** Jam analog kecil dengan jarum pendek + panjang — ikon History/Clock. */
export function InfoIcon(props: IconProps) {
  return (
    <S {...props}>
      <circle cx="12" cy="12" r="9.2" />
      <path d="M12 7v5l3 2.8" />
    </S>
  );
}

export function InfoIconFill(props: IconProps) {
  return (
    <S {...props}>
      <path fill="currentColor" stroke="none" fillRule="evenodd" d="M12 2.8a9.2 9.2 0 1 0 0 18.4A9.2 9.2 0 0 0 12 2.8z" />
      <path fill="currentColor" stroke="none" d="M12 7v5l3 2.8" />
    </S>
  );
}

/** Ikon katalog: EMPAT kotak (grid 2×2). */
export function CatalogIcon(props: IconProps) {
  return (
    <S {...props}>
      <rect x="4" y="4" width="7" height="7" rx="1.8" />
      <rect x="13" y="4" width="7" height="7" rx="1.8" />
      <rect x="4" y="13" width="7" height="7" rx="1.8" />
      <rect x="13" y="13" width="7" height="7" rx="1.8" />
    </S>
  );
}

export function CatalogIconFill(props: IconProps) {
  return (
    <S {...props}>
      <rect fill="currentColor" stroke="none" x="4" y="4" width="7" height="7" rx="1.8" />
      <rect fill="currentColor" stroke="none" x="13" y="4" width="7" height="7" rx="1.8" />
      <rect fill="currentColor" stroke="none" x="4" y="13" width="7" height="7" rx="1.8" />
      <rect fill="currentColor" stroke="none" x="13" y="13" width="7" height="7" rx="1.8" />
    </S>
  );
}

/** Penanda simpan: sudut membulat, lekuk bawah halus. */
export function BookmarkIcon(props: IconProps) {
  return (
    <S {...props}>
      <path d="M6.6 5.4A2.4 2.4 0 0 1 9 3.1h6a2.4 2.4 0 0 1 2.4 2.3v15a1 1 0 0 1-1.55.83L12 18.9l-3.85 2.33A1 1 0 0 1 6.6 20.4z" />
    </S>
  );
}

export function BookmarkIconFill(props: IconProps) {
  return (
    <S {...props}>
      <path
        fill="currentColor"
        stroke="none"
        d="M6.6 5.4A2.4 2.4 0 0 1 9 3.1h6a2.4 2.4 0 0 1 2.4 2.3v15a1 1 0 0 1-1.55.83L12 18.9l-3.85 2.33A1 1 0 0 1 6.6 20.4z"
      />
    </S>
  );
}

/** Orke: kepala bulat + bahu memanjang, gaya person iOS. */
export function PersonIcon(props: IconProps) {
  return (
    <S {...props}>
      <circle cx="12" cy="8.4" r="4.1" />
      <path d="M4.9 20.4c.7-3.7 3.5-6.1 7.1-6.1s6.4 2.4 7.1 6.1" />
    </S>
  );
}

export function PersonIconFill(props: IconProps) {
  return (
    <S {...props}>
      <circle cx="12" cy="8.2" r="4.4" fill="currentColor" stroke="none" />
      <path
        fill="currentColor"
        stroke="none"
        d="M12 14.1c-4.1 0-7.48 2.6-8.32 6.2a.9.9 0 0 0 .89 1.12h14.86a.9.9 0 0 0 .89-1.12C19.48 16.7 16.1 14.1 12 14.1z"
      />
    </S>
  );
}

/* -------------------------------------------------- switcher kategori ---- */

/** Buku terbuka — Manga. */
export function BookIcon(props: IconProps) {
  return (
    <S {...props}>
      <path d="M12 6.9C10.4 5.5 8.35 4.9 5.5 4.9v13.2c2.85 0 4.9.6 6.5 2 1.6-1.4 3.65-2 6.5-2V4.9c-2.85 0-4.9.6-6.5 2z" />
      <path d="M12 6.9v13.2" />
    </S>
  );
}

/** Dua panel bertumpuk — Manhwa / webtoon (dibaca vertikal). */
export function PanelsIcon(props: IconProps) {
  return (
    <S {...props}>
      <rect x="4.4" y="4.7" width="15.2" height="5.9" rx="1.7" />
      <rect x="4.4" y="13.4" width="15.2" height="5.9" rx="1.7" />
    </S>
  );
}

/* ------------------------------------------------------- chrome atas ---- */

/** Lonceng notifikasi dengan klintik di bawah. */
export function BellIcon(props: IconProps) {
  return (
    <S {...props}>
      <path d="M12 3.3a5.9 5.9 0 0 0-5.9 5.9v2.6c0 .73-.25 1.43-.7 2l-.6.78a1.15 1.15 0 0 0 .88 1.89h12.64a1.15 1.15 0 0 0 .88-1.89l-.6-.78c-.45-.57-.7-1.27-.7-2V9.2A5.9 5.9 0 0 0 12 3.3z" />
      <path d="M9.85 18.5a2.3 2.3 0 0 0 4.3 0" />
    </S>
  );
}

/** Kaca pembesar — lingkaran besar + gagang natural. */
export function SearchIcon(props: IconProps) {
  return (
    <S {...props}>
      <circle cx="10.9" cy="10.9" r="6.7" />
      <path d="M15.7 15.7 20.4 20.4" />
    </S>
  );
}

/** Kilau bintang: satu bintang besar + satu kecil (SF sparkles). */
export function SparklesIcon(props: IconProps) {
  return (
    <S {...props}>
      <path d="M12.2 4.2c.6 3.4 1.9 4.7 5.3 5.3-3.4.6-4.7 1.9-5.3 5.3-.6-3.4-1.9-4.7-5.3-5.3 3.4-.6 4.7-1.9 5.3-5.3z" />
      <path d="M18.7 14.9c.3 1.6.9 2.2 2.5 2.5-1.6.3-2.2.9-2.5 2.5-.3-1.6-.9-2.2-2.5-2.5 1.6-.3 2.2-.9 2.5-2.5z" />
    </S>
  );
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <S {...props}>
      <path d="M14.9 5.6 8.5 12l6.4 6.4" />
    </S>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <S {...props}>
      <path d="M9.1 5.6 15.5 12l-6.4 6.4" />
    </S>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <S {...props}>
      <path d="M5.6 9.1 12 15.5l6.4-6.4" />
    </S>
  );
}

export function ChevronUpIcon(props: IconProps) {
  return (
    <S {...props}>
      <path d="M5.6 14.9 12 8.5l6.4 6.4" />
    </S>
  );
}

/* --------------------------------------------------------- kejuaraan ---- */

/** Piala: cawan, pegangan melengkung, kaki trapesium. */
export function TrophyIcon(props: IconProps) {
  return (
    <S {...props}>
      <path d="M6.2 3.6h11.6v5.4a5.8 5.8 0 0 1-11.6 0z" />
      <path d="M6.2 5.4H4.6a2.7 2.7 0 0 0 0 5.4h1.6" />
      <path d="M17.8 5.4h1.6a2.7 2.7 0 0 1 0 5.4h-1.6" />
      <path d="M12 14.8v2.6" />
      <path d="M10.1 17.4h3.8l1.5 3.6H8.6z" />
    </S>
  );
}

/** Panah dua arah — indikator geser (swipe) leaderboard. */
export function SwipeIcon(props: IconProps) {
  return (
    <S {...props}>
      <path d="M7.9 8.3 4.7 12l3.2 3.7" />
      <path d="M4.8 12h14.4" />
      <path d="M16.1 8.3 19.3 12l-3.2 3.7" />
    </S>
  );
}

/** Tiga bilah dengan pegangan — filter genre (SF slider.horizontal). */
export function SlidersIcon(props: IconProps) {
  return (
    <S {...props}>
      <path d="M3.4 6.6h9.8" />
      <path d="M16.6 6.6h4" />
      <path d="M14.6 4.4v4.4" />
      <path d="M3.4 12h3.8" />
      <path d="M11 12h9.6" />
      <path d="M9 9.8v4.4" />
      <path d="M3.4 17.4h9.8" />
      <path d="M16.4 17.4h4.2" />
      <path d="M14.4 15.2v4.4" />
    </S>
  );
}

/** Hadiah: kotak + pita + pita kupu di atas. */
export function GiftIcon(props: IconProps) {
  return (
    <S {...props}>
      <rect x="4.4" y="8.6" width="15.2" height="3.9" rx="1.1" />
      <path d="M5.7 12.5h12.6v7.2a1.3 1.3 0 0 1-1.3 1.3H7a1.3 1.3 0 0 1-1.3-1.3z" />
      <path d="M12 8.6v12.4" />
      <path d="M12 8.6c-1-3.2-3.3-4.4-4.6-3.7-1.4.8-.9 2.9 1.5 3.7" />
      <path d="M12 8.6c1-3.2 3.3-4.4 4.6-3.7 1.4.8.9 2.9-1.5 3.7" />
    </S>
  );
}

/** Berlian Sacret: mahkota lebar + sisi memancar ke titik bawah. */
export function GemIcon(props: IconProps) {
  return (
    <S {...props}>
      <path d="M7.4 4.6h9.2L20 9.4 12 20.5 4 9.4z" />
      <path d="M4 9.4h16" />
      <path d="M8.2 9.4 12 20.5" />
      <path d="M15.8 9.4 12 20.5" />
      <path d="M7.4 4.6 8.2 9.4" />
      <path d="M16.6 4.6 15.8 9.4" />
    </S>
  );
}

/** Mahkota: tiga ujung membulat + lekuk dalam, seperti SF crown. */
export function CrownIcon(props: IconProps) {
  return (
    <S {...props}>
      <path d="M3.6 18.6 2.45 8a1 1 0 0 1 1.57-.9L8.3 10.7 10.95 5.5a1 1 0 0 1 1.76 0l2.65 5.2 4.28-3.6a1 1 0 0 1 1.57.9L20.05 18.6z" />
      <path d="M5.2 21.2h13.6" />
    </S>
  );
}

/* ----------------------------------------------------------- aksi ---- */

/** Panah turun menuju garis — unduh (SF arrow.down). */
export function DownloadIcon(props: IconProps) {
  return (
    <S {...props}>
      <path d="M12 3.9v10.6" />
      <path d="M7.9 10.9 12 15l4.1-4.1" />
      <path d="M5 18.9h14" />
    </S>
  );
}

/** Nyala api — Paling sering ditonton. */
export function FlameIcon(props: IconProps) {
  return (
    <S {...props}>
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </S>
  );
}
