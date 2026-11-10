import { cn } from "@/lib/utils";

type PromoKey = "sale" | "premium" | "more";

/** Ikon digambar sendiri supaya tidak terlihat seperti ikon stok. */
function PromoGlyph({ kind }: { kind: PromoKey }) {
  if (kind === "premium") {
    return (
      <svg viewBox="0 0 48 48" className="size-8" aria-hidden>
        <path
          d="M9 16.5 16.4 22 24 9l7.6 13L39 16.5 35.6 36H12.4L9 16.5Z"
          fill="currentColor"
          opacity=".95"
        />
        <path d="M13.5 39h21" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <circle cx="24" cy="26" r="2.4" fill="#3a2600" />
      </svg>
    );
  }
  if (kind === "more") {
    return (
      <svg viewBox="0 0 48 48" className="size-8" aria-hidden>
        <path
          d="M8 20h6v18H8V20Zm26 0h6v18h-6V20ZM4 40h40v4H4v-4Z"
          fill="currentColor"
        />
        <path d="M14 24h20v5H14v-5Z" fill="currentColor" opacity=".85" />
        <path
          d="M24 7c3.2 4.5 8 5.4 10.5 8.2 1.6 1.8 1.1 4.9-1.4 5.6-2.1.6-4.4-.4-5.6-2.1L24 15.2l-3.5 3.5c-1.2 1.7-3.5 2.7-5.6 2.1-2.5-.7-3-3.8-1.4-5.6C16 12.4 20.8 11.5 24 7Z"
          fill="currentColor"
          opacity=".9"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 48 48" className="size-8" aria-hidden>
      <path
        d="M10 8h28a3 3 0 0 1 3 3v26a3 3 0 0 1-3 3H10a3 3 0 0 1-3-3V11a3 3 0 0 1 3-3Z"
        fill="currentColor"
        opacity=".18"
      />
      <path d="M13 13h22v5H13v-5Zm0 9h22v5H13v-5Zm0 9h14v5H13v-5Z" fill="currentColor" />
      <circle cx="34.5" cy="33.5" r="6.5" fill="currentColor" />
      <path d="m31.8 33.4 1.9 1.9 3.9-4" stroke="#4a0410" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

const PANELS: {
  key: PromoKey;
  badge: string;
  title: string;
  titleAccent?: string;
  desc: string;
  button: string;
  bg: string;
  accent: string;
  badgeBg: string;
  buttonBorder: string;
  textOnBadge: string;
}[] = [
  {
    key: "sale",
    badge: "50% OFF",
    title: "Flash Sale",
    titleAccent: "Sale",
    desc: "Penawaran spesial untukmu!",
    button: "Beli Sekarang",
    bg: "linear-gradient(118deg,#33040b 0%,#5a0a16 48%,#1b0207 100%)",
    accent: "#ff6b80",
    badgeBg: "#ff2f4f",
    buttonBorder: "#ff536b",
    textOnBadge: "#fff",
  },
  {
    key: "premium",
    badge: "Premium",
    title: "Premium",
    desc: "Nikmati fitur eksklusif!",
    button: "Upgrade Sekarang",
    bg: "linear-gradient(118deg,#2d1b00 0%,#513400 46%,#211300 100%)",
    accent: "#ffd23f",
    badgeBg: "#e1af1e",
    buttonBorder: "#ffd75e",
    textOnBadge: "#332100",
  },
  {
    key: "more",
    badge: "Lainnya",
    title: "Lainnya",
    desc: "Temukan lebih banyak!",
    button: "Lihat Semua",
    bg: "linear-gradient(118deg,#04152c 0%,#0b2f61 50%,#030f1e 100%)",
    accent: "#6fb6ff",
    badgeBg: "#1f6fe5",
    buttonBorder: "#79baff",
    textOnBadge: "#fff",
  },
];

/**
 * Banner beli premium bersama — dipakai di halaman Premium dan Home supaya
 * bentuknya benar-benar sama. Garis pemisah dibuat miring, ikonnya custom,
 * dan tinggi kotak dipadatkan.
 */
export function PremiumPromoBanner({
  className,
  onAction,
}: {
  className?: string;
  onAction?: (key: PromoKey) => void;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[20px] border border-white/12 bg-[#07080d] shadow-[0_22px_55px_-34px_rgba(0,0,0,.95)]",
        className,
      )}
    >
      <div className="grid grid-cols-3">
        {PANELS.map((p, i) => (
          <button
            key={p.key}
            type="button"
            onClick={() => onAction?.(p.key)}
            className={cn(
              "relative flex min-h-[142px] flex-col overflow-hidden px-2.5 py-2.5 text-left transition active:brightness-110",
              i === 1 && "z-10",
            )}
          >
            {/* Bidang warnanya sendiri yang miring — bukan sekadar garis
                dekoratif. Konten tetap tegak supaya teks tidak ikut miring. */}
            <span
              aria-hidden
              className="absolute inset-y-[-8%] -left-3 -right-3 -skew-x-[7deg] border-x border-white/15"
              style={{ background: p.bg }}
            />
            <span
              aria-hidden
              className="absolute inset-y-0 left-0 w-px bg-black/35"
              style={{ left: i === 0 ? 0 : -1 }}
            />
            <span className="relative z-10 flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[7.5px] font-black"
              style={{ background: p.badgeBg, color: p.textOnBadge }}
            >
              {p.badge}
            </span>

            <span
              className="relative z-10 mt-2 flex flex-1 flex-col items-center justify-center"
              style={{ color: p.accent }}
            >
              <span className="relative grid size-10 place-items-center">
                <span
                  className="absolute inset-0 rounded-full border"
                  style={{ borderColor: `${p.accent}45` }}
                />
                <span
                  className="absolute -inset-1.5 rounded-full border opacity-40"
                  style={{ borderColor: `${p.accent}25` }}
                />
                <PromoGlyph kind={p.key} />
              </span>
              <span className="mt-1.5 text-center text-[12px] font-black leading-none tracking-tight text-white">
                {p.titleAccent ? (
                  <>
                    {p.title.replace(p.titleAccent, "")}
                    <span style={{ color: p.accent }}>{p.titleAccent}</span>
                  </>
                ) : (
                  p.title
                )}
              </span>
              <span className="mt-1 max-w-[92px] text-center text-[6.5px] font-medium leading-snug text-white/55">
                {p.desc}
              </span>
            </span>

            <span
              className="relative z-10 mt-auto flex items-center justify-center gap-0.5 rounded-full border bg-black/20 px-1.5 py-1 text-[6.8px] font-bold text-white"
              style={{ borderColor: `${p.buttonBorder}a8` }}
            >
              {p.button}
              <svg viewBox="0 0 16 16" className="size-2" aria-hidden>
                <path d="m6 3 5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>

            <span
              aria-hidden
              className="pointer-events-none absolute right-2 top-8 z-10 size-1 rounded-full"
              style={{ background: p.accent, opacity: 0.55 }}
            />
            <span
              aria-hidden
              className="pointer-events-none absolute left-2 top-[58px] z-10 size-[3px] rounded-full"
              style={{ background: p.accent, opacity: 0.35 }}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

export type { PromoKey };
