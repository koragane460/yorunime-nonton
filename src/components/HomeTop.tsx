import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, BlueCheck } from "@/components/lstream-ui";
import { FramedAvatar } from "@/components/FramedAvatar";
import { NotifButton } from "@/components/NotifButton";
import { greetingOf, fmtShort } from "@/components/HomeHead";
import { TierIcon } from "@/components/ProfileSheet";
import { badgeForLevel, displayId } from "@/lib/lstream";
import { cn } from "@/lib/utils";
import { Megaphone, Play, Search, Star, ChevronRight } from "lucide-react";
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
export function AccountHeader({ onSearch }: { onSearch?: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const level = user?.level ?? 1;
  const premium = ((user as any)?.premiumUntil ?? 0) > Date.now();

  return (
    <header className="fade-enter flex w-full items-center gap-3 pt-2">
      {/* KIRI: foto profile (pakai SHOP BORDER) + nama + level + ID. */}
      <button
        type="button"
        onClick={() => navigate("/akun")}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl text-left transition active:scale-[0.98]"
        aria-label="Buka akun"
      >
        <FramedAvatar
          border={(user as any)?.avatarBorder}
          src={user?.image}
          seed={user?.username}
          className="size-16 shrink-0"
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-white/55">
            {greetingOf()}
          </span>
          <span className="mt-1 flex min-w-0 items-center gap-2">
            <span className="truncate text-lg font-black leading-tight tracking-tight">
              {user?.username ?? "user"}
            </span>
            {premium && <BlueCheck className="size-4 shrink-0" />}
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/40 bg-white/[0.07] px-2 py-0.5 text-[10px] font-bold text-white/95">
              <TierIcon tier={badgeForLevel(level).name} className="size-3.5" />
              Lv.{level}
            </span>
          </span>
          <span className="mt-1 block font-mono text-[11px] leading-none text-white/45">
            ID {displayId((user as any)?.seqId)}
          </span>
        </span>
      </button>

      {/* KANAN: cari + notif. Tombol pengaturan DIHAPUS dari sini (pindah ke
          Akun), tempatnya dipakai notifikasi dan tombol cari di kirinya. */}
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onSearch}
          aria-label="Cari anime"
          className="flex size-12 items-center justify-center rounded-2xl border border-white/12 bg-white/[0.06] text-white/80 transition hover:border-gold-strong/40 hover:bg-white/[0.1] hover:text-white active:scale-95"
        >
          <Search className="size-5" />
        </button>
        <NotifButton className="size-12 rounded-2xl border border-white/12 bg-white/[0.06] hover:border-gold-strong/40 hover:bg-white/[0.1]" />
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
        "fade-enter relative mt-3 flex min-h-[160px] flex-col overflow-hidden rounded-3xl border p-3.5",
        tone.border,
        // Kotak PENGUMUMAN: krem keemasan (bukan hitam), jadi beda jelas
        // dari kotak deskripsi clan (biru) & claim berlian (kuning).
        "bg-[#FFD23F]/[0.08] backdrop-blur-sm",
      )}
    >
      {/* KIRI ATAS — ikon + judul (tanpa nama pengirim). */}
      <div className="relative flex items-center gap-2">          <span className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-[#FFD23F]/35 bg-[#FFD23F]/15 text-[#FFD23F]">
          <Megaphone className="size-4" />
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px] font-black tracking-tight text-white">
          Pengumuman
        </span>
      </div>

      {/* GARIS PEMBATAS di bawah judul. */}
      <span aria-hidden className="relative mt-2.5 h-px w-full bg-white/15" />

      {/* PESAN — panel krem lembut di bawah garis. */}
      <div className="relative mt-2.5 flex-1 rounded-2xl border border-[#FFD23F]/25 bg-[#FFFAF0]/[0.07] p-3">
        <p className="whitespace-pre-wrap font-display text-[15px] font-bold leading-[1.4] tracking-tight text-white">
          {text}
        </p>
        {more > 0 && (
          <span className="mt-2.5 inline-block rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-black text-white/75">
            +{more} lainnya
          </span>
        )}
      </div>
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
    <section className="fade-enter mt-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="yn-sec text-base">Spotlight</h2>
          <p className="mt-0.5 text-[10px] font-semibold text-white/45">
            Anime yang sedang trending
          </p>
        </div>
        {/* Titik halaman pindah ke kanan judul — tidak lagi memakan
            ruang di bawah kartu. */}
        <div className="flex shrink-0 items-center gap-1.5">
          {list.map((a, i) => (
            <button
              key={a.id}
              onClick={() => go(i)}
              aria-label={`Slide spotlight ${i + 1}`}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                i === idx ? "w-5 bg-[#FFD23F]" : "w-1.5 bg-white/25 hover:bg-white/45",
              )}
            />
          ))}
        </div>
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
        className="thin-scroll -mx-4 flex snap-x snap-mandatory gap-2.5 overflow-x-auto scroll-smooth px-4 pb-1"
      >
        {list.map((a, rank) => {
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
              className="group flex h-[182px] w-[94%] shrink-0 snap-center overflow-hidden rounded-2xl border border-white/12 bg-white/[0.05] text-left transition hover:border-white/30 active:scale-[0.99] sm:w-[70%] lg:w-[54%]"
            >
              {/* Poster di kiri — ukurannya tetap supaya kartu rapi. */}
              <span className="relative h-full w-[104px] shrink-0 overflow-hidden bg-black/40">
                <img
                  src={a.image}
                  alt=""
                  className="size-full object-cover transition duration-500 group-hover:scale-[1.04]"
                />
                <span className="absolute left-1.5 top-1.5 flex size-6 items-center justify-center rounded-lg bg-black/75 font-mono text-[11px] font-black text-[#FFD23F]">
                  {rank + 1}
                </span>
              </span>

              {/* Info di kanan: status+rating, judul, lalu meta & tombol. */}
              <span className="flex min-w-0 flex-1 flex-col justify-between gap-1.5 p-3">
                <span className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider",
                      done
                        ? "border-white/20 bg-white/[0.06] text-white/65"
                        : "border-[#1CA7EC]/45 bg-[#1CA7EC]/12 text-[#7fd3f7]",
                    )}
                  >
                    <span
                      className={cn(
                        "size-1.5 rounded-full",
                        done ? "bg-white/50" : "animate-pulse bg-[#1CA7EC]",
                      )}
                    />
                    {status}
                  </span>
                  <span className="ml-auto flex items-center gap-1 rounded-full border border-[#FFD23F]/40 bg-[#FFD23F]/10 px-2 py-0.5 text-[10px] font-black text-[#FFD23F]">
                    <Star className="size-2.5 fill-[#FFD23F] text-[#FFD23F]" />
                    {(a.score ?? 0).toFixed(1)}
                  </span>
                </span>

                <span className="line-clamp-2 text-[15px] font-black leading-tight tracking-tight text-[#FFFAF0]">
                  {a.title}
                </span>

                {/* Sinopsis singkat di bawah judul — 2 baris, tidak memotong
                    tombol Nonton di baris bawah. */}
                {a.synopsis && (
                  <span className="line-clamp-2 text-[10.5px] font-medium leading-snug text-white/45">
                    {String(a.synopsis)}
                  </span>
                )}

                <span className="flex items-center gap-2 text-[10px] font-semibold text-white/50">
                  {a.type && (
                    <span className="rounded border border-white/12 bg-white/[0.05] px-1.5 py-0.5 uppercase text-white/65">
                      {String(a.type)}
                    </span>
                  )}
                  {typeof a.episodes === "number" && a.episodes > 0 && (
                    <span>{a.episodes} eps</span>
                  )}
                  <span className="flex items-center gap-1">
                    <Play className="size-2.5 fill-white/50" />
                    {fmtShort(viewsOf(a.id))}
                  </span>
                  <span className="ml-auto flex items-center gap-0.5 rounded-lg bg-[#FFD23F] px-2.5 py-1 text-[10px] font-black text-black transition group-hover:brightness-105">
                    Nonton <ChevronRight className="size-3" />
                  </span>
                </span>
              </span>
            </button>
          );
        })}
      </div>

    </section>
  );
}
