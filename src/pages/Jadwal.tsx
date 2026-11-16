import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useAction, useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

const DAYS_ID = [
  "Minggu",
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
];

/** Singkatan hari untuk strip tanggal (Min, Sen, Sel, …). */
const SHORT_DAYS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
/** Nama bulan singkat untuk label tanggal terpilih. */
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

/** Nama bulan penuh untuk kepala kalender. */
const MONTHS_FULL = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

/**
 * Tanggal konkret untuk tiap hari di minggu berjalan (Minggu..Sabtu).
 * Dipakai strip hari di atas daftar: tiap pilihan menampilkan tulisan hari
 * DAN angka tanggal sesuai tanggal hari ini (bukan sekadar "Senin-Minggu").
 */
function weekDates(): Date[] {
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  base.setDate(now.getDate() - now.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    return d;
  });
}

type AiringItem = {
  id: string;
  title: string;
  image: string;
  episode: number;
  airingAt: number;
  day: string;
  time: string;
  score?: number;
};

type DonghuaRow = {
  id: string;
  title: string;
  image: string;
  status?: string;
  episode?: number;
  estimated?: boolean;
};

type ComicSlot = {
  slug: string;
  title: string;
  image: string;
  kind: "manga" | "manhwa";
  nextChapter: number;
  nextLabel: string;
  lastDateMs: number;
  predictedMs: number;
  day: string;
  time: string;
};

// Satu tipe gabungan untuk SEMUA sumber jadwal (anime, manga, manhwa,
// donghua) supaya daftar bisa dicampur jadi satu tanpa pilihan tipe.
type ScheduleItem = {
  id?: string;
  slug?: string;
  title: string;
  image: string;
  episode?: number;
  airingAt?: number;
  predictedMs?: number;
  estimated?: boolean;
  time?: string;
  day?: string;
  source: "anime" | "donghua" | "manga" | "manhwa";
};

/**
 * Timestamp tayang sebuah item (ms epoch), atau 0 kalau benar-benar tidak
 * diketahui.
 *
 * Dua penjaga penting:
 *  1) `airingAt || predictedMs` (bukan `??`) — nilai 0 dianggap kosong,
 *     jadi item jadwal manual/komik yang `airingAt`-nya 0 tetap bisa
 *     memakai perkiraan `predictedMs`.
 *  2) Jam yang TAMPIL di kartu menang: kalau kartu menulis "08:00" tapi
 *     timestamp datanya sudah lewat (data AniList basi atau salah zona),
 *     status dihitung ulang dari jam itu untuk hari ini (zona WIB — jam
 *     kartu memang ditulis dalam WIB).
 */
function itemAiringMs(item: ScheduleItem, nowMs: number): number {
  let at = item.airingAt || item.predictedMs || 0;
  const m = (item.time ?? "").match(/(\d{1,2})[.:](\d{2})/);
  if (m) {
    const mark = Number(m[1]) * 3_600_000 + Number(m[2]) * 60_000;
    const wib = new Date(nowMs + 7 * 60_000);
    const nowMark =
      wib.getUTCHours() * 3_600_000 + wib.getUTCMinutes() * 60_000;
    if (mark > nowMark + 60_000) at = nowMs + (mark - nowMark);
  }
  return at;
}

export default function Jadwal() {
  return (
    <AppLayout hideAccountPanel>
      <JadwalContent />
    </AppLayout>
  );
}

function JadwalContent() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const schedule = useAction(api.anime.animeAiringSchedule);
  const todayAiring = useAction(api.anime.animeTodayAiring);
  const comicSchedule = useAction(api.manga.schedule);
  const donghuaSchedule = useAction(api.sanka.donghuaWeeklySchedule);
  // Anime yang ditambahkan developer lewat tools konten.
  const customAnime = useQuery(api.content.listCustomAnime, {});
  const [sched, setSched] = useState<Record<string, AiringItem[]>>({});
  const [comics, setComics] = useState<Record<string, ComicSlot[]>>({});
  const [donghuaByDay, setDonghuaByDay] = useState<Record<string, DonghuaRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [comicLoading, setComicLoading] = useState(true);
  const [donghuaLoading, setDonghuaLoading] = useState(true);
  const todayIdx = new Date().getDay();
  const [day, setDay] = useState(todayIdx);
  // "Lihat semua" menampilkan seluruh rilis hari itu; tanpa ini daftar
  // dipotong supaya halaman tidak terlalu panjang saat pertama dibuka.
  const [showAll, setShowAll] = useState(false);
  useEffect(() => {
    setShowAll(false);
  }, [day]);

  useEffect(() => {
    // Jadwal mingguan AniList digabung dengan "Update News" hari ini.
    Promise.allSettled([schedule({}), todayAiring({ limit: 60 })]).then(
      ([weekRes, todayRes]) => {
        const base = (weekRes.status === "fulfilled" ? weekRes.value : {}) ?? {};
        const out: Record<string, AiringItem[]> = {};
        for (const k of Object.keys(base)) {
          out[k] = [...(((base as Record<string, AiringItem[]>)[k] ?? []))];
        }
        if (todayRes.status === "fulfilled" && Array.isArray(todayRes.value)) {
          const todayKey = DAYS_ID[todayIdx];
          const bucket = (out[todayKey] ??= []);
          const have = new Set(
            bucket.map((a) => `${a.id}-${a.episode}`),
          );
          for (const t of todayRes.value as any[]) {
            const key = `${t.id}-${t.episode}`;
            if (have.has(key)) continue;
            have.add(key);
            bucket.push({
              id: String(t.id ?? ""),
              title: String(t.title ?? ""),
              image: String(t.image ?? ""),
              episode: Number(t.episode ?? 0),
              airingAt: Number(t.airingAt ?? 0),
              day: todayKey,
              time: String(t.timeLabel ?? "").replace(/\s*[A-Z]{2,4}$/, ""),
              score: t.score,
            });
          }
          bucket.sort((a, b) => a.airingAt - b.airingAt);
        }
        setSched(out);
      },
    )
      .catch(() => setSched({}))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Manga & manhwa dimuat sekali di awal — semuanya langsung dicampur ke
  // satu daftar (permintaan user: pilihan tipe dihapus, jadi satu saja).
  useEffect(() => {
    let alive = true;
    setComicLoading(true);
    Promise.all([
      comicSchedule({ kind: "manga" }),
      comicSchedule({ kind: "manhwa" }),
    ])
      .then(([mangaR, manhwaR]: any[]) => {
        if (!alive) return;
        const out: Record<string, ComicSlot[]> = {};
        const ingest = (list: any[]) => {
          for (const c of (list ?? []) as Omit<ComicSlot, "day" | "time">[]) {
            // Tanggal sumber sudah WIB -> geser ke UTC supaya hari lokal benar.
            const d = new Date(c.predictedMs + 7 * 3600_000);
            const key = DAYS_ID[d.getUTCDay()];
            const hh = String(d.getUTCHours()).padStart(2, "0");
            const mm = String(d.getUTCMinutes()).padStart(2, "0");
            (out[key] ??= []).push({ ...c, day: key, time: `${hh}:${mm}` });
          }
        };
        ingest(mangaR);
        ingest(manhwaR);
        for (const k of Object.keys(out)) {
          out[k].sort((a, b) => a.predictedMs - b.predictedMs);
        }
        setComics(out);
      })
      .catch(() => {})
      .finally(() => alive && setComicLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Donghua dimuat mengikuti hari yang dipilih (poster hari itu saja).
  useEffect(() => {
    let alive = true;
    setDonghuaLoading(true);
    donghuaSchedule({ day: DAYS_ID[day] })
      .then((r: any) => {
        if (!alive) return;
        setDonghuaByDay(r?.byDay ?? {});
      })
      .catch(() => {})
      .finally(() => alive && setDonghuaLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day]);

  // Hitung mundur tiap 30 detik.
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  // Daftar gabungan untuk hari terpilih: anime + manga + manhwa + donghua,
  // diurutkan dari jam rilis paling awal.
  const list: ScheduleItem[] = useMemo(() => {
    const dayKey = DAYS_ID[day];
    const animeItems: ScheduleItem[] = [
      ...(sched[dayKey] ?? []).map((a) => ({ ...a, source: "anime" as const })),
      ...(customAnime ?? [])
        .filter((c: any) => c.airingDay === dayKey)
        .map((c: any) => ({
          id: c.slug,
          title: c.title,
          image: c.poster ?? "",
          episode: 0,
          airingAt: 0,
          day: dayKey,
          time: c.airingTime ?? "",
          source: "anime" as const,
        })),
    ];
    const comicItems: ScheduleItem[] = (comics[dayKey] ?? []).map((c) => ({
      slug: c.slug,
      id: c.slug,
      title: c.title,
      image: c.image,
      episode: c.nextChapter,
      predictedMs: c.predictedMs,
      time: c.time,
      day: c.day,
      source: c.kind,
    }));
    const donghuaItems: ScheduleItem[] = (donghuaByDay[dayKey] ?? []).map(
      (d) => ({
        id: d.id,
        title: d.title,
        image: d.image,
        episode: d.episode,
        estimated: d.estimated,
        source: "donghua" as const,
      }),
    );
    const all = [...animeItems, ...comicItems, ...donghuaItems];
    const nowMs = Date.now();
    return all.sort(
      (a, b) =>
        (itemAiringMs(a, nowMs) || Number.MAX_SAFE_INTEGER) -
        (itemAiringMs(b, nowMs) || Number.MAX_SAFE_INTEGER),
    );
  }, [day, sched, comics, donghuaByDay, customAnime]);

  const loadingAll = loading || comicLoading || donghuaLoading;

  /** Jumlah rilis tiap hari (anime + komik + judul custom + donghua) untuk
   *  titik-titik di bawah angka tanggal pada kartu kalender. */
  const countsByDay = useMemo(() => {
    const custom = (customAnime ?? []) as any[];
    return DAYS_ID.map(
      (key) =>
        (sched[key]?.length ?? 0) +
        (comics[key]?.length ?? 0) +
        custom.filter((c) => c.airingDay === key).length +
        (donghuaByDay[key]?.length ?? 0),
    );
  }, [sched, comics, customAnime, donghuaByDay]);

  // Daftar yang dirender: default dipotong, "Lihat semua" menampilkan semua.
  const shownList = showAll ? list : list.slice(0, 8);

  /** Buka item sesuai jenisnya: nonton (anime/donghua) atau baca (komik). */
  function openItem(item: ScheduleItem) {
    if (item.source === "anime") {
      const id = String(item.id ?? "");
      const ep = item.episode != null ? String(item.episode) : "0";
      navigate(
        `/nonton?anime=${encodeURIComponent(id)}&ep=${encodeURIComponent(`${id}__ep${ep}`)}&judul=${encodeURIComponent(item.title ?? "")}`,
      );
    } else if (item.source === "donghua") {
      const donghuaId = String(item.id ?? "");
      const donghuaEp = item.episode != null ? String(item.episode) : "1";
      navigate(
        `/nonton?anime=${encodeURIComponent(donghuaId)}&ep=${encodeURIComponent(`sanka__${donghuaId}__ep${donghuaEp}`)}&judul=${encodeURIComponent(item.title ?? "")}&donghua=1`,
      );
    } else {
      // Manga / manhwa -> halaman Baca dengan detail langsung terbuka.
      navigate(
        `/baca?jenis=${item.source}&komik=${encodeURIComponent(String(item.slug ?? item.id ?? ""))}`,
      );
    }
  }

  return (
    <div className="pb-24 pt-3">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-[28px] font-bold leading-none tracking-[-0.04em]">
            Jadwal
          </h1>
          <p className="mt-1.5 text-[10.5px] font-medium text-white/42">
            {MONTHS_FULL[weekDates()[0].getMonth()]} {weekDates()[0].getFullYear()} · rilis minggu ini
          </p>
        </div>
        <span className="rounded-lg border border-white/10 bg-[#121417] px-2.5 py-1.5 font-mono text-[10px] font-bold text-white/52">
          {list.length} hari ini
        </span>
      </header>

      <div className="mt-4">
        <div className="grid grid-cols-7 gap-1">
          {weekDates().map((d, i) => {
            const active = i === day;
            const count = countsByDay[i] ?? 0;
            return (
              <button
                key={i}
                onClick={() => setDay(i)}
                aria-current={active ? "date" : undefined}
                aria-label={`${DAYS_ID[i]}, ${d.getDate()} ${MONTHS[d.getMonth()]} — ${count} rilis`}
                title={`${count} rilis`}
                className={cn(
                  "flex h-[68px] flex-col items-center justify-center gap-1 rounded-lg border transition active:scale-[0.97]",
                  active
                    ? "border-[rgba(211,62,48,.45)] bg-[rgba(211,62,48,.12)] text-white"
                    : "border-white/8 bg-[#121417] text-white/48 hover:border-white/18",
                )}
              >
                <span className="text-[8.5px] font-bold uppercase tracking-[0.06em]">
                  {SHORT_DAYS[i]}
                </span>
                <span
                  className={cn(
                    "text-[18px] font-bold leading-none tabular-nums tracking-tight",
                    active ? "text-white" : "text-white/72",
                  )}
                >
                  {d.getDate()}
                </span>
                <span className="flex h-1 items-center gap-0.5">
                  {count > 0 && (
                    <span
                      className={cn(
                        "size-1 rounded-full",
                        active ? "bg-[var(--primary)]" : "bg-white/30",
                      )}
                    />
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mb-1 mt-5 flex items-baseline justify-between gap-3">
        <h2 className="font-display text-[18px] font-bold tracking-[-0.03em]">
          {DAYS_ID[day]}{" "}
          <span className="font-sans text-[10px] font-medium tracking-normal text-white/38">
            {weekDates()[day].getDate()} {MONTHS[weekDates()[day].getMonth()]}
          </span>
        </h2>
        <span className="text-[10px] font-medium text-white/38">
          {loadingAll ? "Memuat…" : `${list.length} rilis`}
        </span>
      </div>

      {loadingAll ? (
        <div className="mt-2 divide-y divide-white/6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-3">
              <div className="skeleton h-3 w-9 shrink-0 rounded" />
              <div className="skeleton h-[62px] w-[46px] shrink-0 rounded-md" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-3.5 w-3/4 rounded" />
                <div className="skeleton h-2.5 w-1/2 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="py-14 text-center">
          <p className="text-[12px] font-semibold text-white/62">
            Tidak ada rilis pada {DAYS_ID[day]}
          </p>
          <p className="mx-auto mt-1 max-w-[15rem] text-[10px] leading-relaxed text-white/35">
            Coba hari lain di strip tanggal di atas.
          </p>
        </div>
      ) : (
        <div className="mt-1">
          <div className="divide-y divide-white/7">
          {shownList.map((item) => {
            // Hitung mundur per item: "x jam lagi" sampai jam rilis tiba,
            // lalu berubah jadi "Sudah tayang" dan itemnya sedikit redup.
            const at = itemAiringMs(item, Date.now());
            const leftMs = at - Date.now();
            const itemAired = at > 0 && leftMs <= 0;
            const ih = Math.floor(leftMs / 3_600_000);
            const im = Math.floor(leftMs / 60_000) % 60;
            const is = Math.floor(leftMs / 1_000) % 60;
            const itemCountdown =
              leftMs <= 0
                ? itemAired
                  ? "Sudah tayang"
                  : ""
                : ih > 0
                  ? `${ih}j ${im}m lagi`
                  : im > 0
                    ? `${im}m ${is}s lagi`
                    : `${is}s lagi`;
            const wibAt = at > 0 ? new Date(at + 7 * 3_600_000) : null;
            const timeLabel =
              item.time ||
              (wibAt
                ? `${String(wibAt.getUTCHours()).padStart(2, "0")}:${String(wibAt.getUTCMinutes()).padStart(2, "0")}`
                : "--:--");
            return (
              <button
                key={`${item.source}-${item.id ?? item.slug ?? ""}-${item.episode ?? 0}`}
                onClick={() => openItem(item)}
                className={cn(
                  "flex w-full items-start gap-3 py-3 text-left transition hover:bg-white/[0.025] active:bg-white/[0.04]",
                  itemAired && "opacity-58",
                )}
              >
                <span className="w-9 shrink-0 pt-0.5 text-right">
                  <span
                    className={cn(
                      "block font-mono text-[10.5px] font-bold tabular-nums",
                      itemAired ? "text-[var(--yn-mint)]" : "text-white/58",
                    )}
                  >
                    {timeLabel}
                  </span>
                  {itemAired && (
                    <span className="mt-1 block text-[7px] font-bold uppercase tracking-[0.06em] text-[rgba(116,223,194,.7)]">
                      Tayang
                    </span>
                  )}
                </span>

                <span className="relative w-[46px] shrink-0 overflow-hidden rounded-md border border-white/10 bg-black">
                  <img
                    src={item.image}
                    alt=""
                    loading="lazy"
                    className="aspect-[2/3] w-full object-cover"
                  />
                  {typeof item.episode === "number" && item.episode !== 0 && (
                    <span className="absolute inset-x-0 bottom-0 bg-black/72 px-1 py-0.5 text-center font-mono text-[7.5px] font-bold text-white">
                      EP {item.episode}
                    </span>
                  )}
                </span>

                <span className="min-w-0 flex-1 pt-0.5">
                  <span className="line-clamp-2 block text-[12px] font-semibold leading-[1.35] text-white/90">
                    {item.title}
                  </span>
                  <span className="mt-1 flex items-center gap-1.5 text-[9px] font-medium text-white/34">
                    <span className="uppercase tracking-[0.05em]">{item.source}</span>
                    {typeof item.episode === "number" && item.episode !== 0 && (
                      <span>Episode {item.episode}</span>
                    )}
                  </span>
                  {(itemCountdown || item.estimated) && (
                    <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {itemCountdown && (
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[8px] font-bold",
                            itemAired
                              ? "bg-[rgba(116,223,194,.1)] text-[var(--yn-mint)]"
                              : "bg-[rgba(211,62,48,.12)] text-[#f09a8f]",
                          )}
                        >
                          {itemCountdown}
                        </span>
                      )}
                      {item.estimated && (
                        <span className="rounded bg-[rgba(230,196,124,.1)] px-1.5 py-0.5 text-[8px] font-bold uppercase text-[var(--gold)]">
                          Estimasi
                        </span>
                      )}
                    </span>
                  )}
                </span>

                {!itemAired && (
                  <span className="mt-1 shrink-0 rounded bg-[var(--primary)] px-1.5 py-0.5 text-[7.5px] font-extrabold uppercase tracking-[0.05em] text-white">
                    Baru
                  </span>
                )}
              </button>
            );
          })}
          </div>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between gap-3 pb-2">
        {list.length > 8 && !showAll ? (
          <button
            onClick={() => {
              setShowAll(true);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="text-left text-xs font-bold text-primary transition hover:text-primary/80"
          >
            Lihat selengkapnya
          </button>
        ) : (
          <span />
        )}
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="ml-auto shrink-0 text-xs font-semibold text-muted-foreground transition hover:text-foreground"
        >
          Kembali ke atas
        </button>
      </div>
    </div>
  );
}
