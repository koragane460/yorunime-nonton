import { useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { BlueCheck, ClanTag, LevelBadge } from "@/components/lstream-ui";
import { FramedAvatar } from "@/components/FramedAvatar";
import { greetingOf, fmtShort } from "@/components/HomeHead";
import { DEFAULT_CLAN_ICON } from "@/lib/clanIcons";
import { xpForLevel } from "@/lib/level";
import { cn } from "@/lib/utils";
import {
  Clapperboard,
  Heart,
  Megaphone,
  Play,
  Share2,
  Star,
  Tv,
  ChevronRight,
} from "lucide-react";
import type { CardT } from "@/components/CatalogRows";

/* ====================================================================== *
 *  ATAS HOME
 *  Header akun (tanpa latar) · kotak pengumuman · SPOTLIGHT 3 judul
 * ====================================================================== */

/**
 * Cincin progres level: total XP di tengah + tujuan level berikutnya.
 * Progresnya bergerak halus saat XP berubah. */
function LevelRing({ level, xp }: { level: number; xp: number }) {
  const gid = useId().replace(/:/g, "");
  const cost = Math.max(1, xpForLevel(level));
  const inLevel = Math.max(0, Math.min(xp, cost));
  const pct = Math.min(100, (inLevel / cost) * 100);
  const [shownPct, setShownPct] = useState(0);
  useEffect(() => {
    const t = window.setTimeout(() => setShownPct(pct), 140);
    return () => window.clearTimeout(t);
  }, [pct]);
  const r = 25;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - shownPct / 100);
  return (
    <span className="relative grid size-[58px] shrink-0 place-items-center">
      <svg viewBox="0 0 60 60" className="absolute inset-0 size-full -rotate-90" aria-hidden>
        <defs>
          <linearGradient id={`xp-${gid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FFD23F" />
            <stop offset="52%" stopColor="#7FD3F7" />
            <stop offset="100%" stopColor="#F0ABFC" />
          </linearGradient>
        </defs>
        <circle cx="30" cy="30" r={r} fill="none" stroke="rgba(255,255,255,.14)" strokeWidth="3.5" />
        <circle
          cx="30"
          cy="30"
          r={r}
          fill="none"
          stroke={`url(#xp-${gid})`}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <span className="relative flex flex-col items-center justify-center leading-none">
        <span className="text-[13px] font-black tracking-tight text-white">
          {fmtShort(xp)}
        </span>
        <span className="mt-0.5 text-[7px] font-black uppercase tracking-[0.02em] text-white/55">
          LV{level} › LV{level + 1}
        </span>
      </span>
    </span>
  );
}

/**
 * HEADER HOME — satu pil kaca berisi foto, sapaan, username, level + clan,
 * dan cincin XP. Search/notif tinggal di navigasi bawah, bukan di sini. */
export function AccountHeader() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const level = user?.level ?? 1;
  const xp = user?.xp ?? 0;
  const premium = ((user as any)?.premiumUntil ?? 0) > Date.now();

  return (
    <header className="fade-enter flex w-full flex-col gap-2 pt-1">
      <button
        type="button"
        onClick={() => navigate("/akun")}
        className="yn-account-pill relative flex h-[62px] w-full min-w-0 items-center gap-2 overflow-hidden rounded-full border border-white/20 bg-white/[0.095] p-1.5 text-left shadow-[0_20px_50px_-28px_rgba(0,0,0,.98),inset_0_1px_0_rgba(255,255,255,.2)] backdrop-blur-2xl transition active:scale-[0.985]"
        aria-label="Buka akun"
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,.14),transparent_38%,rgba(127,211,247,.08)_72%,rgba(255,210,63,.1))]"
        />
        <FramedAvatar
          border={(user as any)?.avatarBorder}
          src={user?.image}
          seed={user?.username}
          className="relative size-[46px] shrink-0"
        />
        <span className="relative min-w-0 flex-1">
          <span className="block truncate text-[9px] font-black uppercase tracking-[0.17em] text-white/60">
            {greetingOf()}
          </span>
          <span className="mt-0.5 flex min-w-0 items-center gap-1">
            <span className="truncate text-[15.5px] font-black leading-tight tracking-[-0.02em] text-white">
              {user?.username ?? "user"}
            </span>
            {premium && <BlueCheck className="size-3.5 shrink-0" />}
          </span>
          <span className="mt-1 flex min-w-0 items-center gap-1">
            <LevelBadge level={level} className="origin-left scale-[0.9]" />
            {user?.clanTag && (
              <ClanTag
                icon={user.clanTagIcon ?? DEFAULT_CLAN_ICON}
                tag={user.clanTag}
                level={user.clanLevel}
                className="max-w-[54px] origin-left scale-[0.82] overflow-hidden"
              />
            )}
          </span>
        </span>
        <span className="-mr-0.5 shrink-0 scale-[0.82]">
          <LevelRing level={level} xp={xp} />
        </span>
      </button>
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
  const body = raw.replace(/^\[[a-z]+\]\s*/i, "");
  const kind: "error" | "update" | "info" =
    tag === "error" || tag === "eror"
      ? "error"
      : tag === "update"
        ? "update"
        : "info";

  // Format bebas dari panel dev:
  //   v1.0.0 | Judul pengumuman
  //   - poin update pertama
  //   - poin kedua
  // Baris pertama tanpa "| " tetap dipakai sebagai judul.
  const lines = body
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const first = lines[0] ?? "";
  const headMatch = first.match(/^(v?\d+(?:\.\d+){0,3})\s*[|\-–:]\s*(.+)$/i);
  const version = headMatch ? headMatch[1] : "";
  const heading = headMatch ? headMatch[2] : first;
  const updates = (headMatch ? lines.slice(1) : lines.slice(1))
    .map((l) => l.replace(/^[-*•]\s*/, ""))
    .filter(Boolean);
  const updatedAt = item.createdAt;
  const updatedLabel = new Date(updatedAt).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
  });

  // Warna titik update — bervariasi, konsisten per indeks.
  const DOTS = ["#FFD23F", "#1CA7EC", "#E84855", "#7bd88f", "#c084fc"];

  return (
    <section className="fade-enter relative mt-3 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
      <div className="flex items-start gap-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#FFD23F]/15 text-[#FFD23F]">
          <Megaphone className="size-4" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-black leading-tight tracking-tight text-white">
            Pengumuman
          </p>
          {heading && (
            <h3 className="mt-0.5 text-[14px] font-black leading-snug tracking-tight text-white">
              {heading}
            </h3>
          )}

          {updates.length > 0 && (
            /* Isi update 2 kolom: #1 kiri, #2 kanan, #3 kiri baris berikutnya. */
            <ul className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1">
              {updates.map((u, i) => (
                <li key={i} className="flex min-w-0 items-start gap-1.5">
                  <span
                    aria-hidden
                    className="mt-1.5 size-1.5 shrink-0 rounded-full"
                    style={{ background: DOTS[i % DOTS.length] }}
                  />
                  <span className="min-w-0 text-[10.5px] font-medium leading-snug text-white/75">
                    {u}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-1.5 text-[9.5px] font-medium text-white/35">
            Diperbarui {updatedLabel}
          </p>
        </div>
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
  const toggleFav = useMutation(api.activities.toggleFavorite);
  const { user } = useAuth();
  // Untuk mewarnai ikon love MERAH saat judul sudah ada di Favorite.
  const favs = useQuery(
    api.activities.myFavorites,
    user ? {} : "skip",
  ) as { animeId?: string }[] | undefined;
  const favIds = new Set((favs ?? []).map((f) => String(f.animeId)));

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
            <div
              key={a.id}
              className="group relative h-[318px] w-[94%] shrink-0 snap-center overflow-hidden rounded-[26px] border border-white/12 bg-black text-left transition hover:border-white/30 sm:h-[340px] sm:w-[76%] lg:w-[62%]"
            >
              {/* Banner anime sebagai latar penuh. */}
              <img
                src={a.image}
                alt=""
                className="absolute inset-0 size-full object-cover transition duration-500 group-hover:scale-[1.03]"
              />
              <span
                aria-hidden
                className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-transparent"
              />

              {/* Badge status — menempel flush di pojok kiri atas. */}
              <span
                className={cn(
                  "absolute left-0 top-0 flex items-center gap-1 rounded-br-xl px-3 py-1 text-[10px] font-black uppercase tracking-wider text-white",
                  done ? "bg-zinc-700" : "bg-[#1CA7EC]",
                )}
              >
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    done ? "bg-white/70" : "animate-pulse bg-white",
                  )}
                />
                {status}
              </span>

              {/* Rating — menempel flush di pojok kanan atas. */}
              <span className="absolute right-0 top-0 flex items-center gap-1 rounded-bl-xl bg-[#FFD23F] px-2.5 py-1 text-[11px] font-black text-black">
                <Star className="size-3 fill-black text-black" />
                {(a.score ?? 0).toFixed(1)}
              </span>

              <div className="absolute inset-x-0 bottom-0 p-3">
                <p className="line-clamp-1 text-[16px] font-black leading-tight tracking-tight text-white">
                  {a.title}
                </p>
                {a.synopsis && (
                  <p className="mt-0.5 line-clamp-2 text-[10.5px] font-medium leading-snug text-white/60">
                    {String(a.synopsis)}
                  </p>
                )}

                <div className="mt-1.5 flex flex-wrap items-center gap-2.5 text-[10px] font-semibold text-white/60">
                  <span className="flex items-center gap-1">
                    <Clapperboard className="size-3" />
                    {a.type ? String(a.type) : "Anime"}
                  </span>
                  {typeof a.episodes === "number" && a.episodes > 0 && (
                    <span className="flex items-center gap-1">
                      <Tv className="size-3" /> {a.episodes} eps
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Play className="size-3" />
                    {fmtShort(viewsOf(a.id))}
                  </span>
                </div>

                <div className="mt-2 flex items-center gap-1.5">
                  <button
                    onClick={() =>
                      onPick(a.id, a.title, (a.source as any) ?? "anilist")
                    }
                    className="flex min-w-0 flex-1 items-center justify-center gap-1 rounded-lg bg-[#FFD23F] px-2 py-1.5 text-[11px] font-black text-black transition active:scale-[0.98]"
                  >
                    <Play className="size-3 fill-black" /> Nonton Sekarang
                  </button>
                  <button
                    aria-label="Tambah ke Favorite"
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (!user) {
                        toast.error("Masuk dulu untuk menyimpan Favorite");
                        return;
                      }
                      try {
                        const r = await toggleFav({
                          animeId: a.id,
                          animeTitle: a.title,
                          animeImage: a.image,
                          kind: /sanka/.test(String(a.source ?? ""))
                            ? "donghua"
                            : "anime",
                          status: status,
                        });
                        if ((r as any)?.favorited === false)
                          toast.success("Dihapus dari Favorite");
                        else
                          toast.success("Telah ditambahkan ke Favorite");
                      } catch (err) {
                        toast.error(
                          err instanceof Error ? err.message : "Gagal",
                        );
                      }
                    }}
                    aria-pressed={favIds.has(String(a.id))}
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-lg backdrop-blur transition active:scale-95",
                      favIds.has(String(a.id))
                        ? "bg-[#E84855] text-white"
                        : "bg-white/15 text-white",
                    )}
                  >
                    <Heart
                      className={cn(
                        "size-3.5",
                        favIds.has(String(a.id)) && "fill-current text-white",
                      )}
                    />
                  </button>
                  <button
                    aria-label="Bagikan"
                    onClick={async (e) => {
                      e.stopPropagation();
                      const url = `${window.location.origin}/info?anime=${encodeURIComponent(String(a.id))}&judul=${encodeURIComponent(a.title ?? "")}`;
                      const nav = navigator as Navigator & {
                        share?: (d: ShareData) => Promise<void>;
                      };
                      if (nav.share) {
                        void nav
                          .share({ title: a.title, url })
                          .catch(() => undefined);
                        return;
                      }
                      void navigator.clipboard
                        ?.writeText(url)
                        .then(() => toast.success("Tautan disalin"))
                        .catch(() => undefined);
                    }}
                    className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/15 text-white backdrop-blur transition active:scale-95"
                  >
                    <Share2 className="size-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Titik halaman di TENGAH BAWAH — tanpa judul Spotlight. */}
      <div className="mt-2.5 flex items-center justify-center gap-1.5">
        {list.map((a, i) => (
          <button
            key={a.id}
            onClick={() => go(i)}
            aria-label={`Slide spotlight ${i + 1}`}
            className={cn(
              "h-1.5 rounded-full transition-all duration-300",
              i === idx
                ? "w-6 bg-[#FFD23F]"
                : "w-1.5 bg-white/25 hover:bg-white/45",
            )}
          />
        ))}
      </div>
    </section>
  );
}
