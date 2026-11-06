// PET ART — ilustrasi SVG hewan BERBADAN untuk tiap pet YoruPet.
//
// Permintaan pemilik: pet jangan cuma emoji, pakai gambar dan ada badannya,
// harus hewan yang jelas. Semua gambar digambar inline (offline, tidak pernah
// gagal load), gaya chibi: kepala besar, badan kecil, ekor/kaki jelas.
import { useState, type ReactElement } from "react";
import { cn } from "@/lib/utils";
import { petById } from "@/lib/pets";

/** Satu hewan = kumpulan bentuk SVG sederhana di kanvas 0 0 100 100. */
function Chick() {
  return (
    <g>
      {/* kaki */}
      <path d="M42 84 L40 92 M42 92 L48 92" stroke="#e08a1e" strokeWidth="2.6" strokeLinecap="round" fill="none" />
      <path d="M58 84 L60 92 M60 92 L52 92" stroke="#e08a1e" strokeWidth="2.6" strokeLinecap="round" fill="none" />
      {/* badan */}
      <ellipse cx="50" cy="66" rx="24" ry="21" fill="#ffd84d" />
      {/* sayap */}
      <path d="M30 62 Q20 70 30 80 Q38 76 36 68 Z" fill="#f3c02f" />
      <path d="M70 62 Q80 70 70 80 Q62 76 64 68 Z" fill="#f3c02f" />
      {/* kepala */}
      <circle cx="50" cy="38" r="20" fill="#ffe066" />
      {/* jambul */}
      <path d="M50 20 Q46 12 52 8 Q54 15 56 12 Q58 18 50 20Z" fill="#ffd84d" />
      {/* mata */}
      <circle cx="43" cy="36" r="3.1" fill="#241c10" />
      <circle cx="57" cy="36" r="3.1" fill="#241c10" />
      <circle cx="44" cy="35" r="1" fill="#fff" />
      <circle cx="58" cy="35" r="1" fill="#fff" />
      {/* paruh */}
      <path d="M50 41 L45 46 L55 46 Z" fill="#f08a24" />
      {/* pipi */}
      <circle cx="37" cy="43" r="3" fill="#ff9d9d" opacity=".7" />
      <circle cx="63" cy="43" r="3" fill="#ff9d9d" opacity=".7" />
    </g>
  );
}

function Turtle() {
  return (
    <g>
      {/* kaki */}
      <ellipse cx="32" cy="80" rx="8" ry="5" fill="#5aa04f" />
      <ellipse cx="68" cy="80" rx="8" ry="5" fill="#5aa04f" />
      {/* ekor */}
      <path d="M80 68 L92 64 L82 74 Z" fill="#5aa04f" />
      {/* cangkang */}
      <ellipse cx="52" cy="62" rx="30" ry="20" fill="#3f7d38" />
      <ellipse cx="52" cy="60" rx="25" ry="16" fill="#6fb25d" />
      {/* motif cangkang */}
      <path d="M52 46 L62 56 L52 66 L42 56 Z" fill="#4d8f43" />
      <path d="M30 56 L42 56 M62 56 L76 56 M52 66 L52 74" stroke="#4d8f43" strokeWidth="2.4" />
      {/* kepala */}
      <circle cx="20" cy="60" r="11" fill="#7cc069" />
      <circle cx="16" cy="58" r="2.6" fill="#241c10" />
      <circle cx="16.8" cy="57" r=".9" fill="#fff" />
      <circle cx="24" cy="64" r="2.4" fill="#ff9d9d" opacity=".6" />
      {/* senyum */}
      <path d="M15 64 Q19 68 24 65" stroke="#241c10" strokeWidth="1.4" fill="none" strokeLinecap="round" />
    </g>
  );
}

function Canary() {
  return (
    <g>
      {/* dahan */}
      <path d="M18 84 Q50 78 86 84" stroke="#7a5230" strokeWidth="4" strokeLinecap="round" fill="none" />
      {/* kaki */}
      <path d="M44 74 L42 82 M56 74 L58 82" stroke="#d98a28" strokeWidth="2.4" strokeLinecap="round" />
      {/* ekor */}
      <path d="M70 52 Q92 46 88 66 Q78 60 68 60 Z" fill="#e9a825" />
      {/* badan */}
      <ellipse cx="48" cy="56" rx="23" ry="19" fill="#ffd54a" />
      {/* sayap */}
      <path d="M44 48 Q58 52 60 66 Q50 68 42 60 Z" fill="#efb52c" />
      {/* kepala */}
      <circle cx="30" cy="42" r="15" fill="#ffe071" />
      {/* mata */}
      <circle cx="25" cy="40" r="3" fill="#241c10" />
      <circle cx="26" cy="39" r="1" fill="#fff" />
      {/* paruh */}
      <path d="M17 43 L9 46 L17 49 Z" fill="#e07f22" />
      {/* jambul */}
      <path d="M30 28 Q27 21 33 18 Q34 24 37 21 Q38 27 30 28Z" fill="#ffd54a" />
    </g>
  );
}

function Fox() {
  return (
    <g>
      {/* ekor besar */}
      <path d="M74 66 Q98 58 92 38 Q86 54 70 56 Z" fill="#f2762a" />
      <path d="M92 38 Q96 52 84 58 Q90 48 88 40 Z" fill="#ffe8d1" />
      {/* kaki depan */}
      <rect x="36" y="76" width="8" height="14" rx="4" fill="#d95f1c" />
      <rect x="54" y="76" width="8" height="14" rx="4" fill="#d95f1c" />
      {/* badan */}
      <ellipse cx="50" cy="68" rx="24" ry="18" fill="#f2762a" />
      {/* dada putih */}
      <path d="M38 58 Q50 74 62 58 Q58 78 50 80 Q42 78 38 58Z" fill="#fff2e2" />
      {/* telinga */}
      <path d="M28 26 L22 6 L42 16 Z" fill="#f2762a" />
      <path d="M72 26 L78 6 L58 16 Z" fill="#f2762a" />
      <path d="M30 22 L27 12 L37 17 Z" fill="#3a2415" />
      <path d="M70 22 L73 12 L63 17 Z" fill="#3a2415" />
      {/* kepala */}
      <path d="M50 16 Q74 20 72 40 Q70 56 50 58 Q30 56 28 40 Q26 20 50 16Z" fill="#f6842f" />
      {/* pipi putih */}
      <path d="M50 38 Q62 40 62 50 Q56 58 50 58 Q44 58 38 50 Q38 40 50 38Z" fill="#fff2e2" />
      {/* mata */}
      <ellipse cx="41" cy="36" rx="3.2" ry="3.6" fill="#241c10" />
      <ellipse cx="59" cy="36" rx="3.2" ry="3.6" fill="#241c10" />
      <circle cx="42" cy="35" r="1.1" fill="#fff" />
      <circle cx="60" cy="35" r="1.1" fill="#fff" />
      {/* hidung & mulut */}
      <path d="M50 44 L46.5 47.5 Q50 50 53.5 47.5 Z" fill="#241c10" />
      <path d="M50 50 Q47 53 44 51 M50 50 Q53 53 56 51" stroke="#241c10" strokeWidth="1.3" fill="none" strokeLinecap="round" />
    </g>
  );
}

function Wolf() {
  return (
    <g>
      {/* ekor */}
      <path d="M72 66 Q94 62 90 42 Q84 58 68 58 Z" fill="#7b879b" />
      <path d="M90 42 Q93 56 82 60 Q88 50 86 44 Z" fill="#c7d0dd" />
      {/* kaki */}
      <rect x="36" y="76" width="8" height="14" rx="4" fill="#5d6878" />
      <rect x="55" y="76" width="8" height="14" rx="4" fill="#5d6878" />
      {/* badan */}
      <ellipse cx="50" cy="68" rx="24" ry="18" fill="#7b879b" />
      <path d="M38 60 Q50 76 62 60 Q58 80 50 82 Q42 80 38 60Z" fill="#d5dce6" />
      {/* telinga */}
      <path d="M28 26 L24 6 L44 16 Z" fill="#7b879b" />
      <path d="M72 26 L76 6 L56 16 Z" fill="#7b879b" />
      <path d="M30 22 L28 12 L38 17 Z" fill="#3c4552" />
      <path d="M70 22 L72 12 L62 17 Z" fill="#3c4552" />
      {/* kepala */}
      <path d="M50 16 Q74 20 72 40 Q70 56 50 58 Q30 56 28 40 Q26 20 50 16Z" fill="#8c98ab" />
      {/* moncong */}
      <path d="M50 40 Q62 42 60 50 Q56 58 50 58 Q44 58 40 50 Q38 42 50 40Z" fill="#d5dce6" />
      {/* mata */}
      <ellipse cx="41" cy="35" rx="3" ry="3.4" fill="#1d2530" />
      <ellipse cx="59" cy="35" rx="3" ry="3.4" fill="#1d2530" />
      <circle cx="42" cy="34" r="1" fill="#fff" />
      <circle cx="60" cy="34" r="1" fill="#fff" />
      <path d="M50 45 L46.5 48 Q50 50.5 53.5 48 Z" fill="#1d2530" />
    </g>
  );
}

function Deer() {
  return (
    <g>
      {/* ekor */}
      <path d="M74 58 Q84 54 82 46 Q76 50 72 52 Z" fill="#c98d52" />
      {/* kaki */}
      <rect x="38" y="74" width="7" height="18" rx="3.5" fill="#a06a35" />
      <rect x="56" y="74" width="7" height="18" rx="3.5" fill="#a06a35" />
      {/* badan */}
      <ellipse cx="50" cy="64" rx="25" ry="18" fill="#c98d52" />
      <ellipse cx="50" cy="72" rx="14" ry="9" fill="#e9c69b" />
      {/* tutul */}
      <circle cx="42" cy="58" r="2" fill="#f3ddc0" />
      <circle cx="58" cy="60" r="2" fill="#f3ddc0" />
      <circle cx="50" cy="55" r="1.7" fill="#f3ddc0" />
      {/* tanduk */}
      <path d="M38 24 Q32 12 26 10 M38 24 Q34 16 28 18" stroke="#8a5a2b" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M62 24 Q68 12 74 10 M62 24 Q66 16 72 18" stroke="#8a5a2b" strokeWidth="3" fill="none" strokeLinecap="round" />
      {/* telinga */}
      <ellipse cx="32" cy="30" rx="7" ry="4" fill="#b97c43" transform="rotate(-20 32 30)" />
      <ellipse cx="68" cy="30" rx="7" ry="4" fill="#b97c43" transform="rotate(20 68 30)" />
      {/* kepala */}
      <ellipse cx="50" cy="38" rx="17" ry="16" fill="#d69a5f" />
      <ellipse cx="50" cy="46" rx="8" ry="7" fill="#e9c69b" />
      {/* mata */}
      <ellipse cx="43" cy="36" rx="3" ry="3.4" fill="#241c10" />
      <ellipse cx="57" cy="36" rx="3" ry="3.4" fill="#241c10" />
      <circle cx="44" cy="35" r="1" fill="#fff" />
      <circle cx="58" cy="35" r="1" fill="#fff" />
      <ellipse cx="50" cy="44" rx="3" ry="2.2" fill="#241c10" />
    </g>
  );
}

function Peacock() {
  return (
    <g>
      {/* kipas ekor */}
      <g>
        <path d="M50 62 L14 30 A44 44 0 0 1 86 30 Z" fill="#0f7a6e" opacity=".35" />
        {[0, 1, 2, 3, 4, 5, 6].map((i) => {
          const a = (-160 + i * 40) * (Math.PI / 180);
          const x = 50 + Math.cos(a) * 38;
          const y = 58 + Math.sin(a) * 38;
          return (
            <g key={i}>
              <line x1="50" y1="58" x2={x} y2={y} stroke="#14a394" strokeWidth="2.4" strokeLinecap="round" />
              <circle cx={x} cy={y} r="5" fill="#1bb5a3" />
              <circle cx={x} cy={y} r="2.6" fill="#0b4f7a" />
              <circle cx={x} cy={y} r="1.1" fill="#ffd84d" />
            </g>
          );
        })}
      </g>
      {/* kaki */}
      <path d="M44 82 L42 90 M56 82 L58 90" stroke="#d98a28" strokeWidth="2.4" strokeLinecap="round" />
      {/* badan */}
      <ellipse cx="50" cy="66" rx="14" ry="17" fill="#0e8f82" />
      {/* dada */}
      <ellipse cx="50" cy="68" rx="8" ry="11" fill="#22c1b0" />
      {/* kepala */}
      <circle cx="50" cy="38" r="11" fill="#0e8f82" />
      {/* jambul */}
      {[42, 50, 58].map((x) => (
        <g key={x}>
          <line x1="50" y1="30" x2={x} y2="20" stroke="#14a394" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx={x} cy="19" r="2.2" fill="#ffd84d" />
        </g>
      ))}
      {/* mata & paruh */}
      <circle cx="46" cy="37" r="2.4" fill="#12232b" />
      <circle cx="54" cy="37" r="2.4" fill="#12232b" />
      <circle cx="46.7" cy="36.3" r=".8" fill="#fff" />
      <circle cx="54.7" cy="36.3" r=".8" fill="#fff" />
      <path d="M50 40 L46 44 L54 44 Z" fill="#f0a83a" />
    </g>
  );
}

function Unicorn() {
  return (
    <g>
      {/* ekor */}
      <path d="M72 60 Q92 52 88 34 Q84 52 68 54 Z" fill="#f19bb8" />
      <path d="M84 38 Q86 50 74 55 Q82 48 80 40 Z" fill="#a5d8ff" />
      {/* kaki */}
      <rect x="36" y="74" width="8" height="18" rx="4" fill="#e8eef7" />
      <rect x="56" y="74" width="8" height="18" rx="4" fill="#e8eef7" />
      <rect x="36" y="86" width="8" height="6" rx="3" fill="#c3cede" />
      <rect x="56" y="86" width="8" height="6" rx="3" fill="#c3cede" />
      {/* badan */}
      <ellipse cx="50" cy="64" rx="25" ry="18" fill="#f4f7fc" />
      {/* selimut pelangi */}
      <path d="M30 58 Q50 70 70 58 Q66 74 50 76 Q34 74 30 58Z" fill="#f9d9e5" />
      {/* telinga */}
      <path d="M36 26 L34 14 L44 20 Z" fill="#f4f7fc" />
      <path d="M60 26 L62 14 L54 20 Z" fill="#f4f7fc" />
      {/* tanduk */}
      <path d="M50 22 L46 4 L58 16 Z" fill="#ffd54a" />
      <path d="M48.5 15 L56 15 M47.5 10 L54.5 11" stroke="#e0a91f" strokeWidth="1.2" />
      {/* surai */}
      <path d="M38 22 Q28 30 34 46 Q40 34 44 26 Z" fill="#f19bb8" />
      <path d="M62 22 Q72 30 66 46 Q60 34 56 26 Z" fill="#a5d8ff" />
      {/* kepala */}
      <ellipse cx="50" cy="38" rx="16" ry="15" fill="#f9fbff" />
      <ellipse cx="50" cy="45" rx="8" ry="6" fill="#e8eef7" />
      {/* mata */}
      <ellipse cx="43" cy="37" rx="3" ry="3.4" fill="#3a2c4d" />
      <ellipse cx="57" cy="37" rx="3" ry="3.4" fill="#3a2c4d" />
      <circle cx="44" cy="36" r="1" fill="#fff" />
      <circle cx="58" cy="36" r="1" fill="#fff" />
      <path d="M47 46 Q50 48 53 46" stroke="#3a2c4d" strokeWidth="1.3" fill="none" strokeLinecap="round" />
      <circle cx="38" cy="43" r="2.6" fill="#ffb7cf" opacity=".8" />
      <circle cx="62" cy="43" r="2.6" fill="#ffb7cf" opacity=".8" />
    </g>
  );
}

function Dragon() {
  return (
    <g>
      {/* sayap */}
      <path d="M64 50 L96 22 L90 52 L78 44 L74 60 Z" fill="#2f7a4a" />
      <path d="M64 50 L90 32 L86 50" stroke="#57b06f" strokeWidth="1.6" fill="none" />
      {/* ekor */}
      <path d="M30 70 Q8 66 12 48 Q18 60 34 60 Z" fill="#3d9459" />
      <path d="M12 48 L6 42 L14 44 Z" fill="#ffd54a" />
      {/* kaki */}
      <rect x="40" y="76" width="9" height="14" rx="4" fill="#2f7a4a" />
      <rect x="58" y="76" width="9" height="14" rx="4" fill="#2f7a4a" />
      {/* badan */}
      <ellipse cx="52" cy="66" rx="22" ry="17" fill="#3d9459" />
      <ellipse cx="52" cy="70" rx="12" ry="10" fill="#bfe6a5" />
      {/* punggung duri */}
      <path d="M40 48 L44 40 L48 48 L54 38 L58 48 Z" fill="#2f7a4a" />
      {/* kepala */}
      <path d="M50 22 Q68 24 68 38 Q68 50 50 50 Q34 50 34 38 Q34 24 50 22Z" fill="#4aa865" />
      {/* tanduk */}
      <path d="M40 24 L34 12 L46 20 Z" fill="#ffd54a" />
      <path d="M60 24 L66 12 L54 20 Z" fill="#ffd54a" />
      {/* mata */}
      <ellipse cx="43" cy="34" rx="3.2" ry="3.6" fill="#17351f" />
      <ellipse cx="57" cy="34" rx="3.2" ry="3.6" fill="#17351f" />
      <circle cx="44" cy="33" r="1.1" fill="#fff" />
      <circle cx="58" cy="33" r="1.1" fill="#fff" />
      {/* mulut + api kecil */}
      <path d="M44 44 Q50 48 56 44" stroke="#17351f" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <path d="M50 48 Q46 56 50 60 Q54 56 50 48Z" fill="#ffb020" opacity=".85" />
    </g>
  );
}

function Spirit() {
  return (
    <g>
      {/* sayap kilau */}
      <path d="M24 56 Q4 46 8 30 Q18 42 28 44 Z" fill="#fff2c2" opacity=".8" />
      <path d="M76 56 Q96 46 92 30 Q82 42 72 44 Z" fill="#fff2c2" opacity=".8" />
      {/* rok cahaya */}
      <path d="M32 62 Q50 96 68 62 Q62 84 50 86 Q38 84 32 62Z" fill="#ffe9a3" />
      {/* bintang badan */}
      <path d="M50 8 L61 34 L89 37 L68 56 L74 84 L50 69 L26 84 L32 56 L11 37 L39 34 Z" fill="#ffd54a" />
      <path d="M50 16 L59 36 L80 38 L64 52 L69 74 L50 62 L31 74 L36 52 L20 38 L41 36 Z" fill="#ffe071" />
      {/* wajah */}
      <ellipse cx="43" cy="44" rx="3" ry="3.6" fill="#5a3d00" />
      <ellipse cx="57" cy="44" rx="3" ry="3.6" fill="#5a3d00" />
      <circle cx="44" cy="43" r="1.1" fill="#fff" />
      <circle cx="58" cy="43" r="1.1" fill="#fff" />
      <path d="M46 52 Q50 56 54 52" stroke="#5a3d00" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <circle cx="37" cy="50" r="3" fill="#ff9d9d" opacity=".65" />
      <circle cx="63" cy="50" r="3" fill="#ff9d9d" opacity=".65" />
      {/* kilauan sekitar */}
      <path d="M18 18 L20 24 L26 26 L20 28 L18 34 L16 28 L10 26 L16 24 Z" fill="#fff2c2" />
      <path d="M82 66 L83.5 70 L88 71.5 L83.5 73 L82 77 L80.5 73 L76 71.5 L80.5 70 Z" fill="#fff2c2" />
    </g>
  );
}

const ART: Record<string, () => ReactElement> = {
  kunai: Chick,
  penyu: Turtle,
  kenari: Canary,
  rubah: Fox,
  serigala: Wolf,
  // Belum ada ilustrasi khusus untuk dua pet baru — pakai fallback terdekat
  // (foto asli tetap yang tampil; ilustrasi hanya muncul kalau foto gagal).
  "harimau-putih": Wolf,
  "macan-tutul-salju": Fox,
  rusa: Deer,
  merak: Peacock,
  unikorn: Unicorn,
  naga: Dragon,
  tetrix: Spirit,
};

/**
 * Gambar hewan untuk satu pet. `petId` boleh apa pun (id pet milik user
 * atau id definisi) — yang dipakai adalah prefix id definisi bila string.
 *
 * FOTO ASLI dulu (permintaan: "hewan tolong pake foto aja"): kalau definisi
 * pet punya `image` (file di `public/pets/`), tampilkan foto itu. Bila
 * gagal dimuat (offline / file belum ada), otomatis jatuh kembali ke
 * ilustrasi SVG di bawah — jadi tampilan tidak pernah kosong.
 */
export function PetArt({
  petId,
  className,
}: {
  petId: string;
  className?: string;
}) {
  const def = petById(petId);
  const photo = def?.image;
  // `failed` per instance supaya fallback SVG tidak mengganggu instance lain.
  const [failed, setFailed] = useState(false);
  const Art = ART[petId] ?? Chick;

  if (photo && !failed) {
    return (
      <img
        src={photo}
        alt={def?.name ?? petId}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        // object-contain: seluruh badan pet terlihat (tidak terpotong),
        // tanpa lingkaran latar yang membuat sudut foto terlihat kasar.
        className={cn(
          "size-full object-contain object-bottom drop-shadow-[0_4px_6px_rgba(0,0,0,0.45)]",
          className,
        )}
        style={{
          maskImage:
            "radial-gradient(ellipse at center, #000 62%, transparent 84%)",
          WebkitMaskImage:
            "radial-gradient(ellipse at center, #000 62%, transparent 84%)",
        }}
      />
    );
  }

  return (
    <svg
      viewBox="0 0 100 100"
      className={cn("size-full", className)}
      role="img"
      aria-hidden
    >
      <Art />
    </svg>
  );
}
