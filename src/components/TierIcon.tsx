import type { ReactNode } from "react";

/**
 * Ikon material per tier level — ingot, ore, intan, zamrud, kristal,
 * medali, dan permata. Dipakai di tag level, daftar tier Akun, dan detail
 * akun supaya bentuknya konsisten di seluruh aplikasi.
 */
export function TierIcon({ tier, className }: { tier: string; className?: string }) {
  const art: Record<string, ReactNode> = {
    /* INGOT — batangan logam bertingkat. */
    Bronze: (
      <>
        <path d="M4.6 6.4 H11.4 L13.4 10.4 H2.6 Z" fill="#c87a4a" stroke="rgba(0,0,0,.5)" strokeWidth="0.9" strokeLinejoin="round" />
        <path d="M2.6 10.4 H13.4 V12.4 H2.6 Z" fill="#a35f38" opacity="0.9" stroke="rgba(0,0,0,.5)" strokeWidth="0.9" strokeLinejoin="round" />
        <path d="M5.4 7.5 H10.6" stroke="rgba(255,255,255,.5)" strokeWidth="0.8" />
      </>
    ),
    /* ORE — bongkahan bijih bersegmen. */
    Silver: (
      <>
        <path d="M3.4 8.6 L5.4 4.6 L9.6 3.6 L12.8 6.4 L11.8 11.4 L6.4 12.6 Z" fill="#b9c0ca" stroke="rgba(0,0,0,.5)" strokeWidth="0.9" strokeLinejoin="round" />
        <path d="M5.4 4.6 L7.6 8.2 L12.8 6.4 M7.6 8.2 L6.4 12.6 M7.6 8.2 L11.8 11.4" stroke="rgba(255,255,255,.55)" strokeWidth="0.7" fill="none" />
      </>
    ),
    /* INTAN — potongan brilian. */
    Diamond: (
      <>
        <path d="M8 13.6 L2.6 6.4 H13.4 Z" fill="#7ddffb" stroke="rgba(0,0,0,.5)" strokeWidth="0.9" strokeLinejoin="round" />
        <path d="M2.6 6.4 L4.7 3 H11.3 L13.4 6.4 Z" fill="#a9edff" stroke="rgba(0,0,0,.5)" strokeWidth="0.9" strokeLinejoin="round" />
        <path d="M4.7 3 L6.5 6.4 L8 13.6 M11.3 3 L9.5 6.4" stroke="rgba(255,255,255,.6)" strokeWidth="0.7" fill="none" />
      </>
    ),
    /* ZAMRUD — potongan octagon bertingkat. */
    Emerald: (
      <>
        <path d="M5.4 2.6 H10.6 L13.4 5.4 V10.6 L10.6 13.4 H5.4 L2.6 10.6 V5.4 Z" fill="#3fd07f" stroke="rgba(0,0,0,.5)" strokeWidth="0.9" strokeLinejoin="round" />
        <path d="M6.4 5.4 H9.6 V10.6 H6.4 Z" fill="rgba(255,255,255,.4)" stroke="rgba(0,0,0,.35)" strokeWidth="0.7" />
      </>
    ),
    /* KRISTAL — rumpun tiga bilah. */
    Master: (
      <>
        <path d="M4.4 13.4 L3.2 9 L5.4 4.2 L8 7.8 Z" fill="#e0455c" stroke="rgba(0,0,0,.5)" strokeWidth="0.9" strokeLinejoin="round" />
        <path d="M7 13.6 L6.4 8.6 L9.4 3.6 L12.6 9.4 L11.4 13.6 Z" fill="#ff7183" stroke="rgba(0,0,0,.5)" strokeWidth="0.9" strokeLinejoin="round" />
        <path d="M9.4 3.6 L9.6 13.6" stroke="rgba(255,255,255,.55)" strokeWidth="0.7" />
        <path d="M2.4 13.6 H13.6" stroke="rgba(0,0,0,.45)" strokeWidth="0.9" strokeLinecap="round" />
      </>
    ),
    /* MEDALI BINTANG — puncak tertinggi. */
    Grandmaster: (
      <>
        <path d="M8 1.6 L9.95 5.85 L14.6 6.4 L11.15 9.5 L12.1 14.1 L8 11.75 L3.9 14.1 L4.85 9.5 L1.4 6.4 L6.05 5.85 Z" fill="#f5c542" stroke="rgba(0,0,0,.5)" strokeWidth="0.9" strokeLinejoin="round" />
        <path d="M8 4.6 L8.85 6.7 L11.15 7 L9.4 8.6 L9.85 10.85 L8 9.75 L6.15 10.85 L6.6 8.6 L4.85 7 L7.15 6.7 Z" fill="rgba(255,255,255,.5)" />
      </>
    ),
    /* CENTRAL — mahkota emas berkilau dengan permata di puncak. */
    Central: (
      <>
        <path d="M2 6.2 L4.6 8.4 L8 3.4 L11.4 8.4 L14 6.2 L12.9 12.4 H3.1 Z" fill="#ffd76a" stroke="rgba(0,0,0,.55)" strokeWidth="0.9" strokeLinejoin="round" />
        <path d="M3.1 13.4 H12.9" stroke="rgba(0,0,0,.55)" strokeWidth="1.2" strokeLinecap="round" />
        <circle cx="8" cy="9.9" r="1.5" fill="#ff8f3f" stroke="rgba(0,0,0,.45)" strokeWidth="0.7" />
        <path d="M4.6 8.4 L5.4 11.6 M11.4 8.4 L10.6 11.6" stroke="rgba(255,255,255,.6)" strokeWidth="0.7" />
      </>
    ),
    /* RUBY — batu permata merah menyala dengan potongan faset. */
    Ruby: (
      <>
        <path d="M5.6 2.6 H10.4 L13.6 6 L8 13.8 L2.4 6 Z" fill="#e11d48" stroke="rgba(0,0,0,.55)" strokeWidth="0.9" strokeLinejoin="round" />
        <path d="M2.4 6 H13.6" stroke="rgba(0,0,0,.45)" strokeWidth="0.8" />
        <path d="M5.6 2.6 L4.6 6 L8 13.8 M10.4 2.6 L11.4 6 L8 13.8 M4.6 6 L11.4 6" stroke="rgba(255,255,255,.55)" strokeWidth="0.7" fill="none" />
        <path d="M6.2 3.4 L5.4 5.6" stroke="rgba(255,255,255,.85)" strokeWidth="0.9" strokeLinecap="round" />
        <circle cx="13.4" cy="2.9" r="0.7" fill="#ffd0dc" />
      </>
    ),
    /* ASCENDANT — bintang bersayap yang menanjak. */
    Ascendant: (
      <>
        <path d="M8 1.8 L9.85 6.05 L14.4 6.65 L11.05 9.75 L12 14.2 L8 11.9 L4 14.2 L4.95 9.75 L1.6 6.65 L6.15 6.05 Z" fill="#e8fbff" stroke="rgba(0,0,0,.5)" strokeWidth="0.9" strokeLinejoin="round" />
        <path d="M8 4.6 L8.8 6.85 L11.05 7.2 L9.35 8.85 L9.75 11.05 L8 9.85 L6.25 11.05 L6.65 8.85 L4.95 7.2 L7.2 6.85 Z" fill="#67e8f9" opacity="0.85" />
        <path d="M1.4 3.2 L3.4 4.4 M12.6 3.2 L14.6 4.4 M8 0.9 V0.1" stroke="#f0abfc" strokeWidth="0.9" strokeLinecap="round" />
        <circle cx="2.2" cy="12.4" r="0.6" fill="#f0abfc" />
        <circle cx="13.8" cy="12.4" r="0.6" fill="#67e8f9" />
      </>
    ),
  };
  if (art[tier])
    return (
      <svg viewBox="0 0 16 16" className={className} aria-hidden>
        {art[tier]}
      </svg>
    );
  const gem: Record<string, string> = {
    Diamond: "#7ddffb",
    Emerald: "#3fd07f",
    Master: "#ff5a6e",
  };
  const ingot: Record<string, string> = {
    Bronze: "#c87a4a",
    Silver: "#b9c0ca",
    Grandmaster: "#f5c542",
  };
  if (gem[tier]) {
    const c = gem[tier];
    return (
      <svg viewBox="0 0 16 16" className={className} aria-hidden>
        <path
          d="M8 2 L13.2 6.6 L8 14 L2.8 6.6 Z"
          fill={c}
          stroke="rgba(0,0,0,.5)"
          strokeWidth="0.9"
          strokeLinejoin="round"
        />
        <path
          d="M2.8 6.6 H13.2 M8 2 L5.6 6.6 M8 2 L10.4 6.6"
          stroke="rgba(255,255,255,.55)"
          strokeWidth="0.8"
          fill="none"
        />
      </svg>
    );
  }
  const c = ingot[tier] ?? "#c8cdd6";
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden>
      <path
        d="M4.6 6.4 H11.4 L13.4 10.4 H2.6 Z"
        fill={c}
        stroke="rgba(0,0,0,.5)"
        strokeWidth="0.9"
        strokeLinejoin="round"
      />
      <path
        d="M2.6 10.4 H13.4 V12.4 H2.6 Z"
        fill={c}
        opacity="0.8"
        stroke="rgba(0,0,0,.5)"
        strokeWidth="0.9"
        strokeLinejoin="round"
      />
    </svg>
  );
}
