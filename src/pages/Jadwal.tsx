import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useAction, useQuery } from "convex/react";
import { CalendarDays } from "lucide-react";

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

  // deteksi duplikat hari ini (sama id+episode)
  const dupCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of list) {
      const key = `${item.id}-${item.episode ?? 0}`;
      map[key] = (map[key] ?? 0) + 1;
    }
    return map;
  }, [list]);

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
    <div className="py-3">
      {/* Judul ditengah + garis pembatas di bawahnya; teks kecil di
          bawah judul dihapus (permintaan user). */}
      <h1 className="text-center text-lg font-bold">Jadwal Rilis</h1>
      <div className="mt-2 mb-3 h-px w-full bg-white/15" aria-hidden />

      {/* Pilih hari: tulisan hari + angka tanggal sesuai tanggal berjalan.
          Semua tipe (anime, manga, manhwa, donghua) tampil dalam SATU
          daftar tanpa pilihan tipe lagi. */}
      {/* KALENDER MINGGUAN — tiap hari tampil seperti lembar kalender:
          pita nama hari, angka tanggal besar, dan titik jumlah rilis. */}
      <div className="mb-3">
        <div className="mb-2 flex items-baseline justify-between px-0.5">
          <span className="text-[11px] font-black uppercase tracking-[0.16em] text-foreground/70">
            {MONTHS_FULL[weekDates()[0].getMonth()]}{" "}
            {weekDates()[0].getFullYear()}
          </span>
          <span className="text-[10px] font-semibold text-muted-foreground">
            Minggu ini
          </span>
        </div>
        <div className="grid grid-cols-7 gap-1.5">
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
                  "group relative flex h-[92px] flex-col overflow-hidden rounded-xl border transition active:scale-[0.97]",
                  active
                    ? "border-primary bg-primary/10 shadow-[0_6px_18px_-10px] shadow-primary/70"
                    : "border-white/10 bg-white/[0.03] hover:border-white/25",
                )}
              >
                {/* Pita hari di bagian atas, seperti kepala lembar kalender. */}
                <span
                  className={cn(
                    "w-full py-1 text-center text-[9px] font-black uppercase leading-none tracking-[0.08em]",
                    active
                      ? "bg-primary text-white"
                      : "bg-white/[0.06] text-zinc-400",
                  )}
                >
                  {SHORT_DAYS[i]}
                </span>
                <span className="flex flex-1 flex-col items-center justify-center gap-1.5">
                  <span
                    className={cn(
                      "text-[26px] font-black leading-none tabular-nums tracking-tight",
                      active ? "text-foreground" : "text-zinc-300",
                    )}
                  >
                    {d.getDate()}
                  </span>
                  {/* Titik rilis: maksimal 3, sisanya diwakili titik ketiga
                      yang lebih tebal warnanya. */}
                  <span className="flex h-1.5 items-center gap-0.5">
                    {count === 0 ? (
                      <span className="size-1 rounded-full bg-white/15" />
                    ) : (
                      Array.from({ length: Math.min(count, 3) }).map((_, k) => (
                        <span
                          key={k}
                          className={cn(
                            "size-1 rounded-full",
                            active ? "bg-primary" : "bg-[#1CA7EC]/70",
                          )}
                        />
                      ))
                    )}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Info jumlah rilis hari terpilih */}
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">
          {loadingAll
            ? "Memuat jadwal…"
            : list.length === 0
              ? `Tidak ada rilis pada ${DAYS_ID[day]}`
              : `${list.length} rilis pada ${DAYS_ID[day]}, ${weekDates()[day].getDate()} ${MONTHS[weekDates()[day].getMonth()]}`}
        </span>
        {!loadingAll &&
          list.length > 0 &&
          Object.values(dupCounts).filter((c) => c > 1).length > 0 && (
            <span className="text-[11px] text-muted-foreground">
              {Object.values(dupCounts).filter((c) => c > 1).length} judul
              duplikat
            </span>
          )}
      </div>

      {loadingAll ? (
        <div className="mb-2 flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-2xl bg-card p-2.5"
            >
              <div className="skeleton h-24 w-16 shrink-0 rounded-xl" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-4 w-3/4 rounded" />
                <div className="skeleton h-3 w-1/2 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : list.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Tidak ada jadwal rilis hari ini.
        </p>
      ) : (
        <div className="relative pb-2 pl-[62px]">
          {/* GARIS TIMELINE — satu garis lurus ke bawah; bagian yang sudah
              lewat waktu tayangnya berwarna (progress berjalan). */}
          <span
            aria-hidden
            className="absolute bottom-0 left-[30px] top-0 w-px bg-white/12"
          />
          <div className="space-y-2">
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
              <div
                key={`${item.source}-${item.id ?? item.slug ?? ""}-${item.episode ?? 0}`}
                className="relative"
              >
                {/* Titik waktu di tengah garis timeline. */}
                <span
                  className={cn(
                    "absolute top-4 z-10 flex w-[52px] -translate-x-1/2 items-center justify-center rounded-md px-1 py-0.5 text-[9.5px] font-black tabular-nums transition-colors",
                    itemAired
                      ? "bg-primary text-white shadow-[0_0_10px_-2px] shadow-primary/70"
                      : "bg-[#151922] text-white/60 ring-1 ring-white/15",
                  )}
                  style={{ left: "-32px" }}
                >
                  {timeLabel}
                </span>
                {/* Ruas garis berwarna untuk waktu yang sudah berjalan. */}
                <span
                  aria-hidden
                  className={cn(
                    "absolute -top-2 bottom-0 w-px",
                    itemAired ? "bg-primary" : "bg-transparent",
                  )}
                  style={{ left: "-32px" }}
                />
                <button
                  onClick={() => openItem(item)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-2.5 text-left transition hover:border-primary/40",
                    itemAired && "opacity-70",
                  )}
                >
                {/* Gambar + badge episode */}
                <div className="relative w-16 shrink-0">
                  <div className="aspect-[2/3] overflow-hidden rounded-xl bg-black">
                    <img
                      src={item.image}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </div>
                  {typeof item.episode === "number" && item.episode !== 0 && (
                    <span className="absolute left-1 top-1 rounded bg-primary px-1.5 py-0.5 text-[9px] font-bold text-white">
                      Ep {item.episode}
                    </span>
                  )}
                  {item.id != null &&
                    (dupCounts[`${item.id}-${item.episode ?? 0}`] ?? 0) > 1 && (
                      <span className="absolute -right-1.5 top-1 flex size-5 items-center justify-center rounded-full bg-rose-500 text-[9px] font-black text-white">
                        {dupCounts[`${item.id}-${item.episode ?? 0}`]}
                      </span>
                    )}
                </div>

                {/* Judul + jam rilis + hitung mundur + tipe sumber */}
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-semibold leading-5">
                    {item.title}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="rounded-md bg-white/10 px-1.5 py-0.5 font-medium uppercase text-white/60">
                      {item.source}
                    </span>
                    {item.time && (
                      <span className="rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-white/75">
                        {item.time}
                      </span>
                    )}
                    {itemCountdown && (
                      <span
                        className={cn(
                          "rounded-md px-1.5 py-0.5 font-bold",
                          itemAired
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "bg-primary/15 text-primary",
                        )}
                      >
                        {itemCountdown}
                      </span>
                    )}
                    {item.estimated && (
                      <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-black uppercase text-amber-300">
                        Estimasi
                      </span>
                    )}
                  </div>
                </div>
                </button>
              </div>
            );
          })}
          </div>
        </div>
      )}

      {/* DUA TOMBOL HARI — kotak rounded sama ukuran, berdampingan di
          kanan bawah. Kiri = hari sebelumnya, kanan = hari berikutnya. */}
      <div className="fixed inset-x-3 bottom-24 z-30 flex items-center justify-between">
        <button
          onClick={() => {
            setDay((d) => (d + 6) % 7);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          aria-label={`Lihat jadwal hari ${DAYS_ID[(day + 6) % 7]}`}
          className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-[#151922]/95 px-3 py-2.5 text-[11.5px] font-black text-white/75 backdrop-blur transition hover:text-white active:scale-95"
        >
          <CalendarDays className="size-3.5 text-white/50" />
          {DAYS_ID[(day + 6) % 7]}
        </button>
        <button
          onClick={() => {
            setDay((d) => (d + 1) % 7);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          aria-label={`Lihat jadwal hari ${DAYS_ID[(day + 1) % 7]}`}
          className="flex items-center gap-1.5 rounded-xl border border-primary/45 bg-[#151922]/95 px-3 py-2.5 text-[11.5px] font-black text-white backdrop-blur transition active:scale-95"
        >
          <CalendarDays className="size-3.5 text-primary" />
          {DAYS_ID[(day + 1) % 7]}
        </button>
      </div>

      {/* "Lihat semua" menampilkan seluruh rilis hari itu. "Kembali ke
          atas" tetap ada setelah semua rilis dibuka. */}
      {list.length > 8 && (
        <div className="mt-5 flex items-center justify-between gap-3 pb-6">
          {!showAll ? (
            <button
              onClick={() => {
                setShowAll(true);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="text-left text-xs font-bold text-primary transition hover:text-primary/80"
            >
              {`Lihat semua (${list.length} rilis hari ini)`}
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
      )}
    </div>
  );
}
