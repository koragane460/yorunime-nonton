import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { BlueCheck } from "@/components/lstream-ui";
import { FramedAvatar } from "@/components/FramedAvatar";
import { NotifButton } from "@/components/NotifButton";
import { greetingOf, fmtShort } from "@/components/HomeHead";
import { TierIcon } from "@/components/ProfileSheet";
import { badgeForLevel, displayId } from "@/lib/lstream";
import { cn } from "@/lib/utils";
import {
  Megaphone,
  Settings,
  Play,
  Star,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import type { CardT } from "@/components/CatalogRows";

/* ====================================================================== *
 *  ATAS HOME
 *  Header akun (tanpa latar) · kotak pengumuman · SPOTLIGHT 3 judul
 * ====================================================================== */

/**
 * HEADER AKUN — TANPA background/kotak, sesuai permintaan:
 * kiri = foto profile + username + level + ID, kanan = tombol notif +
 * pengaturan. Sapaan waktu tetap ada sebagai eyebrow kecil di atas nama.
 */
export function AccountHeader() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const level = user?.level ?? 1;
  const premium = ((user as any)?.premiumUntil ?? 0) > Date.now();

  return (
    <header className="fade-enter flex w-full items-center gap-2.5 pt-1">
      {/* KIRI: foto profile (pakai SHOP BORDER) + nama + level + ID. */}
      <button
        type="button"
        onClick={() => navigate("/akun")}
        className="flex min-w-0 flex-1 items-center gap-2.5 rounded-2xl text-left transition active:scale-[0.98]"
        aria-label="Buka akun"
      >
        <FramedAvatar
          border={(user as any)?.avatarBorder}
          src={user?.image}
          seed={user?.username}
          className="mt-1.5 size-12 shrink-0"
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[11px] font-bold uppercase tracking-[0.14em] text-white/90">
            {greetingOf()}
          </span>
          <span className="mt-0.5 flex min-w-0 items-center gap-1.5">
            <span className="truncate text-[15px] font-black leading-tight tracking-tight">
              {user?.username ?? "user"}
            </span>
            {premium && <BlueCheck className="size-3.5 shrink-0" />}
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/40 bg-white/[0.07] px-1.5 py-0.5 text-[9px] font-bold text-white/95">
              <TierIcon tier={badgeForLevel(level).name} className="size-3" />
              Lv.{level}
            </span>
          </span>
          <span className="mt-0.5 block font-mono text-[10px] leading-none text-white/45">
            ID {displayId((user as any)?.seqId)}
          </span>
        </span>
      </button>

      {/* KANAN: notif + pengaturan. */}
      <div className="flex shrink-0 items-center gap-1.5">
        <NotifButton />
        <button
          type="button"
          onClick={() => navigate("/akun")}
          aria-label="Pengaturan"
          className="flex size-10 items-center justify-center text-white/75 transition hover:text-white active:scale-95"
        >
          <Settings className="size-[18px]" />
        </button>
      </div>
    </header>
  );
}

/** "2 jam lalu" singkat — cukup untuk stempel waktu pengumuman. */
function ago(ts: number): string {
  const d = Math.max(0, Date.now() - ts);
  const menit = Math.floor(d / 60_000);
  if (menit < 1) return "baru saja";
  if (menit < 60) return `${menit} menit lalu`;
  const jam = Math.floor(menit / 60);
  if (jam < 24) return `${jam} jam lalu`;
  return `${Math.floor(jam / 24)} hari lalu`;
}

/**
 * KOTAK PENGUMUMAN — besar & memanjang ke bawah (permintaan). Isinya pesan
 * developer terbaru (update / error / apa pun): datang dari tabel
 * `announcements` yang DIATUR lewat panel developer, jadi tidak perlu deploy
 * untuk mengganti isinya.
 *
 * Warna kotak ikut jenis pesan: diawali "[error]"/"[eror]" = merah (masalah),
 * "[update]" = emas, selain itu netral keemasan.
 */
export function AnnouncementBox() {
  const rows = useQuery(api.moderation.activeAnnouncements, {});
  if (!rows || rows.length === 0) return null;

  const item = rows[0];
  const raw = item.message ?? "";
  const tag = (raw.match(/^\[(error|eror|update|info)\]/i)?.[1] ?? "").toLowerCase();
  const text = raw.replace(/^\[[a-z]+\]\s*/i, "");
  const kind: "error" | "update" | "info" =
    tag === "error" || tag === "eror"
      ? "error"
      : tag === "update"
        ? "update"
        : "info";
  const more = rows.length - 1;

  const tone =
    kind === "error"
      ? {
          border: "border-red-400/35",
          icon: "text-red-300",
          rule: "bg-red-400/80",
        }
      : kind === "update"
        ? {
            border: "border-gold-strong/40",
            icon: "text-gold-strong",
            rule: "bg-gold-strong/80",
          }
        : {
            border: "border-white/12",
            icon: "text-white/75",
            rule: "bg-white/60",
          };

  return (
    <section
      className={cn(
        "fade-enter relative mt-3 flex min-h-[160px] flex-col overflow-hidden rounded-2xl border p-4 backdrop-blur-md",
        tone.border,
        "bg-white/[0.055] shadow-[0_18px_40px_-34px_rgba(0,0,0,.9)]",
      )}
    >
      {/* Garis tipis di kiri — kecil saja, hanya penanda. */}
      <span
        aria-hidden
        className={cn("absolute left-2.5 top-6 bottom-6 w-[3px] rounded-full", tone.rule)}
      />

      <div className="relative flex items-center justify-between gap-3 pl-3.5">
        <span className="flex items-center gap-2">
          <Megaphone className={cn("size-4 shrink-0", tone.icon)} />
          <span className="text-[11px] font-black uppercase tracking-[0.16em] text-white">
            Pengumuman
          </span>
        </span>
      </div>

      <p className="relative mt-3 flex-1 whitespace-pre-wrap pl-3.5 font-display text-[17px] font-black leading-[1.3] tracking-tight text-white">
        {text}
      </p>

      {more > 0 && (
        <span className="relative mt-3 self-start rounded-full bg-white/10 px-2 py-0.5 pl-3.5 text-[10px] font-black text-white/75">
          +{more} lainnya
        </span>
      )}
    </section>
  );
}

type SpotlightItem = CardT & { source?: string };

/**
 * SPOTLIGHT — pengganti hero banner: kotak BESAR memanjang ke bawah untuk 3
 * judul, digeser dengan snap (rasa "hero" tanpa rotasi otomatis). Tiap kartu
 * menampilkan status Ongoing/Completed, rating, jumlah views, dan judul.
 */
export function Spotlight({
  items,
  viewsOf,
  onPick,
}: {
  items: SpotlightItem[];
  viewsOf: (id: string) => number;
  onPick: (id: string, title?: string, source?: any) => void;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [idx, setIdx] = useState(0);
  const list = items.slice(0, 3);

  /** Posisi scroll untuk slide ke-i — pakai posisi ELEMENNYA (bukan
   *  perkiraan lebar layar), supaya titik pagination & auto-geser pas
   *  walaupun tiap kartu cuma 88% lebar + jarak antar kartu. */
  const slideLeft = (i: number): number => {
    const el = trackRef.current;
    const child = el?.children[i] as HTMLElement | undefined;
    if (!el || !child) return 0;
    return child.getBoundingClientRect().left - el.getBoundingClientRect().left + el.scrollLeft;
  };

  const go = (i: number) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollTo({ left: slideLeft(i), behavior: "smooth" });
    setIdx(i);
  };

  // Auto-geser halus tiap 6 detik — berhenti sendiri saat tab di background.
  useEffect(() => {
    if (list.length < 2) return;
    const t = setInterval(() => {
      if (document.hidden) return;
      setIdx((cur) => {
        const next = (cur + 1) % list.length;
        const el = trackRef.current;
        if (el) el.scrollTo({ left: slideLeft(next), behavior: "smooth" });
        return next;
      });
    }, 6000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.length]);

  if (list.length === 0) return null;

  return (
    <section className="fade-enter mt-3">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="yn-sec text-lg">Spotlight</h2>
        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-gold-strong">
          Geser untuk lihat
        </span>
      </div>

      <div
        ref={trackRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          // Indeks = slide yang paling dekat dengan sisi kiri viewport.
          let best = 0;
          let bestD = Infinity;
          for (let i = 0; i < el.children.length; i++) {
            const d = Math.abs(slideLeft(i) - el.scrollLeft);
            if (d < bestD) {
              bestD = d;
              best = i;
            }
          }
          if (best !== idx) setIdx(best);
        }}
        className="thin-scroll -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-4 pb-1"
      >
        {list.map((a) => {
          const done = /tamat|completed|finished|selesai|ended/i.test(
            String(a.status ?? ""),
          );
          const status = a.status
            ? done
              ? "Completed"
              : /ongoing|airing|tayang/i.test(String(a.status))
                ? "Ongoing"
                : String(a.status)
            : "Ongoing";
          return (
            <button
              key={a.id}
              onClick={() => onPick(a.id, a.title, (a.source as any) ?? "anilist")}
              className="group relative h-[298px] w-[97%] shrink-0 snap-center overflow-hidden rounded-[26px] border border-white/12 bg-black text-left shadow-[0_30px_60px_-40px_rgba(0,0,0,1)] transition hover:border-white/30 active:scale-[0.99] sm:w-[76%] lg:w-[58%]"
            >
              <img
                src={a.image}
                alt=""
                className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]"
              />
              {/* Scrim: gelap di bawah supaya teks terbaca, jernih di atas. */}
              <span
                aria-hidden
                className="absolute inset-0 bg-[linear-gradient(to_top,rgba(5,6,10,.97)_16%,rgba(5,6,10,.72)_38%,rgba(5,6,10,.18)_66%,rgba(5,6,10,.42)_100%)]"
              />

              {/* Atas: status kiri, rating kanan. */}
              <span className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
                <span
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider backdrop-blur-md",
                    done
                      ? "border-white/25 bg-black/55 text-white/85"
                      : "border-emerald-300/45 bg-emerald-500/20 text-emerald-200",
                  )}
                >
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      done ? "bg-white/70" : "animate-pulse bg-emerald-300",
                    )}
                  />
                  {status}
                </span>
                <span className="flex items-center gap-1 rounded-full border border-amber-300/45 bg-black/60 px-2.5 py-1 text-[11px] font-black text-amber-200 backdrop-blur-md">
                  <Star className="size-3 fill-amber-300 text-amber-300" />
                  {(a.score ?? 0).toFixed(1)}
                </span>
              </span>

              {/* Bawah: judul + meta + tombol. */}
              <span className="absolute inset-x-0 bottom-0 flex flex-col gap-2.5 p-4">
                <span className="yn-eyebrow text-[9px]">
                  {a.type ? String(a.type) : "Spotlight"}
                </span>
                <span className="line-clamp-2 font-display text-[22px] font-black leading-[1.08] tracking-[-0.02em] text-white drop-shadow-[0_2px_10px_rgba(0,0,0,.75)]">
                  {a.title}
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  <span className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.09] px-2 py-1 text-[11px] font-bold text-white/90 backdrop-blur">
                    <Play className="size-3 fill-white/90" />
                    {fmtShort(viewsOf(a.id))}
                    <span className="font-medium text-white/55">views</span>
                  </span>
                  {typeof a.episodes === "number" && a.episodes > 0 && (
                    <span className="rounded-lg border border-white/12 bg-white/[0.06] px-2 py-1 text-[11px] font-bold text-white/75">
                      {a.episodes} eps
                    </span>
                  )}
                  <span className="ml-auto flex items-center gap-1 rounded-full bg-gold-strong px-3 py-1.5 text-[11px] font-black text-black transition group-hover:brightness-105">
                    Nonton <ChevronRight className="size-3.5" />
                  </span>
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Titik pagination — aktif mengikuti posisi geser. */}
      <div className="mt-2.5 flex items-center justify-center gap-1.5">
        {list.map((a, i) => (
          <button
            key={a.id}
            onClick={() => go(i)}
            aria-label={`Slide spotlight ${i + 1}`}
            className={cn(
              "h-1.5 rounded-full transition-all duration-300",
              i === idx ? "w-6 bg-gold-strong" : "w-1.5 bg-white/25 hover:bg-white/45",
            )}
          />
        ))}
      </div>
    </section>
  );
}
