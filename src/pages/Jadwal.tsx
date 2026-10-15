import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useAction, useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  PanelsTopLeft,
  Sparkles,
  Tv,
} from "lucide-react";

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

// Tipe gabungan untuk semua tab: tiap cabang (anime/donghua/comic) punya
// field berbeda, jadi dinormalisasi ke satu tipe longgar supaya render kartu,
// deteksi duplikat, dan timer hitung mundur bisa mengakses field apa pun
// tanpa error union.
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
};

type Tab = "anime" | "manga" | "manhwa" | "donghua";
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
  // Anime yang ditambahkan developer lewat tools konten. Episodenya real-time,
  // tapi jadwal episodenya mengikuti hari yang diisi developer saat menambah.
  const customAnime = useQuery(api.content.listCustomAnime, {});
  const [tab, setTab] = useState<Tab>("anime");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sched, setSched] = useState<Record<string, AiringItem[]>>({});
  const [comics, setComics] = useState<Record<string, Record<string, ComicSlot[]>>>({});
  const [donghuaByDay, setDonghuaByDay] = useState<Record<string, DonghuaRow[]>>({});
  const [donghuaAcak, setDonghuaAcak] = useState<DonghuaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [comicLoading, setComicLoading] = useState(false);
  const [duplicates, setDuplicates] = useState<Record<string, Record<string, number>>>({});
  const todayIdx = new Date().getDay();
  const [day, setDay] = useState(todayIdx);
  // "Lihat semua" menampilkan seluruh rilis hari itu; tanpa ini daftar
  // dipotong supaya halaman tidak terlalu panjang saat pertama dibuka.
  const [showAll, setShowAll] = useState(false);
  useEffect(() => {
    setShowAll(false);
  }, [tab, day]);

  useEffect(() => {
    // Jadwal mingguan AniList (lengkap per hari) digabung dengan daftar
    // "Update News" hari ini. Keduanya dari sumber yang sama, tapi
    // `animeTodayAiring` memakai airingSchedules sehingga sudut-sudut yang
    // tidak masuk 3 halaman paling populer tetap ikut terlihat — tanpa ini
    // ada judul yang tayang hari ini tapi tidak muncul di Jadwal.
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

  // Manga & manhwa dimuat saat tabnya dibuka (hemat request).
  useEffect(() => {
    if (tab === "anime" || comics[tab]) return;
    let alive = true;
    setComicLoading(true);
    comicSchedule({ kind: tab as "manga" | "manhwa" })
      .then((r: any) => {
        if (!alive) return;
        const list = (r ?? []) as Omit<ComicSlot, "day" | "time">[];
        const byDay: Record<string, ComicSlot[]> = {};
        for (const c of list) {
          // Tanggal sumber sudah WIB -> Geser ke UTC supaya hari lokal benar.
          const d = new Date(c.predictedMs + 7 * 3600_000);
          const key = DAYS_ID[d.getUTCDay()];
          const hh = String(d.getUTCHours()).padStart(2, "0");
          const mm = String(d.getUTCMinutes()).padStart(2, "0");
          const slot: ComicSlot = {
            ...c,
            day: key,
            time: `${hh}:${mm}`,
          };
          (byDay[key] ??= []).push(slot);
        }
        for (const k of Object.keys(byDay)) {
          byDay[k].sort((a, b) => a.predictedMs - b.predictedMs);
        }
        setComics((prev) => ({ ...prev, [tab]: byDay }));
      })
      .catch(() => {})
      .finally(() => alive && setComicLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Donghua dimuat saat tabnya dibuka. Sekarang memakai jadwal resmi per hari
  // (`/anime/donghua/schedule`), bukan daftar "sedang jalan" tanpa hari.
  // `day` ikut dikirim supaya poster hari itu saja yang melengkapi.
  useEffect(() => {
    if (tab !== "donghua") return;
    let alive = true;
    setComicLoading(true);
    donghuaSchedule({ day: DAYS_ID[day] })
      .then((r: any) => {
        if (!alive) return;
        setDonghuaByDay(r?.byDay ?? {});
        setDonghuaAcak(r?.acak ?? []);
      })
      .catch(() => {})
      .finally(() => alive && setComicLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, day]);

  // Hitung mundur tiap 30 detik.
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const animeTotal = useMemo(
    () =>
      Object.values(sched).reduce((s, v) => s + v.length, 0) +
      (customAnime ?? []).filter((c: any) => !!c.airingDay).length,
    [sched, customAnime],
  );
  const donghuaTotal = useMemo(
    () =>
      Object.values(donghuaByDay).reduce((s, v) => s + v.length, 0) +
      donghuaAcak.length,
    [donghuaByDay, donghuaAcak],
  );
  const comicCounts: Record<string, number> = {};
  for (const t of ["manga", "manhwa"] as const) {
    comicCounts[t] = Object.values(comics[t] ?? {}).reduce((s, v) => s + (v?.length ?? 0), 0);
  }

  const tabs: { key: Tab; label: string; icon: typeof Tv; count: number }[] = [
    { key: "anime", label: "Anime", icon: Tv, count: animeTotal },
    { key: "manga", label: "Manga", icon: BookOpen, count: comicCounts.manga },
    { key: "manhwa", label: "Manhwa", icon: PanelsTopLeft, count: comicCounts.manhwa },
    // Donghua di sebelah kanan Manhwa, jadi total 4 pilihan jadwal.
    { key: "donghua", label: "Donghua", icon: Sparkles, count: donghuaTotal },
  ];
  const active = tabs.find((t) => t.key === tab) ?? tabs[0];
  const ActiveIcon = active.icon;
  const list: ScheduleItem[] =
    tab === "anime"
      ? [
          ...(sched[DAYS_ID[day]] ?? []),
          // Anime tambahan ikut muncul di hari yang diisi developer.
          ...(customAnime ?? [])
            .filter((c: any) => c.airingDay === DAYS_ID[day])
            .map((c: any) => ({
              id: c.slug,
              title: c.title,
              image: c.poster ?? "",
              episode: 0,
              airingAt: 0,
              day: DAYS_ID[day],
              time: c.airingTime ?? "",
            })),
        ]
      : tab === "donghua"
        ? (donghuaByDay[DAYS_ID[day]] ?? [])
        : (comics[tab]?.[DAYS_ID[day]] ?? []);
  const totalShown = tab === "anime" ? animeTotal : comicCounts[tab];

  // deteksi duplikat hari ini (sama id+episode)
  const dupCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of list) {
      const key = `${item.id}-${item.episode}`;
      map[key] = (map[key] ?? 0) + 1;
    }
    return map;
  }, [list]);

  const now = new Date();
  // Kartu hitung mundur menunjuk anime berikutnya yang BELUM tayang — kalau
  // jam rilisnya sudah lewat, otomatis berganti ke yang berikutnya
  // (permintaan user: "kalo udah di luar jam rilis ... jadi selanjutnya").
  const nextUp =
    list.find((it) => (it.airingAt ?? it.predictedMs ?? 0) > now.getTime()) ??
    list[0];
  const diff = Math.max(
    0,
    (nextUp?.airingAt ?? nextUp?.predictedMs ?? 0) - now.getTime(),
  );
  const mins = Math.floor(diff / 60_000);
  const hrs = Math.floor(mins / 60);
  const secs = diff % 60;
  // Daftar yang dirender: default dipotong, "Lihat semua" menampilkan semua.
  const shownList = showAll ? list : list.slice(0, 6);

  return (
    <div className="py-3">
      <h1 className="mb-1 text-lg font-bold">Jadwal Rilis</h1>
      <p className="mb-3 text-[11px] text-muted-foreground">
        {tab === "anime"
          ? "Jam tayang dalam waktu lokal kamu — dari jadwal tayang resmi AniList"
          : tab === "donghua"
            ? "Jadwal rilis donghua per hari dari sumber subtitle Indonesia (SankaVollerei)"
            : "Proyeksi chapter berikutnya dari rata-rata jarak rilis chapter terakhir"}
      </p>

      {/* Switcher: anime di atas, pilihan manga & manhwa muncul saat diklik */}
      <div className="mb-3">
        <button
          onClick={() => setPickerOpen((v) => !v)}
          className={cn(
            "flex w-full items-center gap-2 rounded-2xl border border-white/10 bg-gradient-to-r from-white/[0.07] to-white/[0.02] px-4 py-3 text-sm font-semibold text-foreground",
            pickerOpen ? "border-primary/50" : "",
          )}
        >
          <ActiveIcon className="size-4 shrink-0 text-primary" />
          <span className="flex-1">{active.label}</span>
          {tab === "anime" ? (
            <>
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                {totalShown} judul
              </span>
              <ChevronDown className="size-4 shrink-0 text-zinc-500" />
            </>
          ) : (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              {totalShown} item
            </span>
          )}
        </button>

        {pickerOpen && (
          <div className="mt-2 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02]">
            {tabs
              .filter((t) => t.key !== tab)
              .map((t) => (
                <button
                  key={t.key}
                  onClick={() => {
                    setTab(t.key);
                    setPickerOpen(false);
                  }}
                  className="flex w-full items-center gap-3 border-b border-white/10 px-4 py-3 text-left transition last:border-b-0 hover:bg-white/5"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/15">
                    <t.icon className="size-4 text-primary" />
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{t.label}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {t.key === "anime"
                        ? `${t.count} judul · ${Object.keys(sched).length} hari`
                        : t.key === "donghua"
                          ? `${t.count} item · ${Object.keys(donghuaByDay).length} hari`
                          : `${t.count} chapter`}
                    </p>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-zinc-500" />
                </button>
              ))}
          </div>
        )}
      </div>

      {/* Pilih hari: tulisan hari + angka tanggal sesuai tanggal berjalan.
          Berlaku untuk SEMUA tab (anime, manga, manhwa, donghua). */}
      <div className="mb-3 grid grid-cols-7 gap-1.5">
        {weekDates().map((d, i) => {
          const active = i === day;
          return (
            <button
              key={i}
              onClick={() => setDay(i)}
              aria-current={active ? "date" : undefined}
              aria-label={`${DAYS_ID[i]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`}
              className={cn(
                "flex flex-col items-center rounded-xl border px-1 py-1.5 transition",
                active
                  ? "border-primary bg-primary/15"
                  : "border-white/10 hover:border-white/30",
              )}
            >
              <span
                className={cn(
                  "text-[9px] font-semibold leading-none",
                  active ? "text-primary" : "text-zinc-500",
                )}
              >
                {SHORT_DAYS[i]}
              </span>
              <span
                className={cn(
                  "mt-1 text-[13px] font-black leading-none tabular-nums",
                  active ? "text-foreground" : "text-zinc-400",
                )}
              >
                {d.getDate()}
              </span>
            </button>
          );
        })}
      </div>

      {/* timer hitung mundur + pengalihan hari */}
      {(tab === "anime" || tab === "donghua") && (
        <div className="mb-3 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
          {/* Gambar anime yang bakal tayang selanjutnya */}
          {nextUp?.image ? (
            <img
              src={nextUp.image}
              alt=""
              className="h-14 w-10 shrink-0 rounded-lg object-cover"
            />
          ) : (
            <Clock className="size-4 shrink-0 text-primary" />
          )}
          <div className="min-w-0 flex-1">
            {nextUp ? (
              <>
                <p className="line-clamp-2 text-sm font-semibold">{nextUp.title}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {diff > 0
                    ? `tayang dalam ${hrs > 0 ? `${hrs}j` : ""}${mins > 0 ? `${mins % 60}m` : ""}${secs > 0 && hrs === 0 ? `${secs}s` : ""}`
                    : "sudah tayang"}
                  {nextUp.episode ? ` · Ep ${nextUp.episode}` : ""}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Tidak ada jadwal hari ini
              </p>
            )}
          </div>
          <div className="shrink-0 text-right text-[11px] font-semibold text-zinc-400">
            {DAYS_ID[day]}, {weekDates()[day].getDate()} {MONTHS[weekDates()[day].getMonth()]}
          </div>
        </div>
      )}

      {/* list item: sisa duplikat kayak di foto katalog */}
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">
          {list.length === 0
            ? tabs.find((t) => t.key === tab)?.label
            : `${list.length} item`}{" "}
          hari ini
        </span>
        {list.length > 0 && (
          <span className="text-[11px] text-muted-foreground">
            {Object.values(dupCounts).filter((c) => c > 1).length > 0
              ? `${Object.values(dupCounts).filter((c) => c > 1).length} judul duplikat`
              : ""}
          </span>
        )}
      </div>

      {loading ? (
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
          Tidak ada jadwal{" "}
          {tab === "anime"
            ? "hari ini"
            : tab === "donghua"
              ? "pada hari ini"
              : "dalam minggu ini"}.
        </p>
      ) : (
        <div className="space-y-2 pb-2">
          {shownList.map((item) => {
            // Hitung mundur per item: "x jam lagi" sampai jam rilis tiba,
            // lalu berubah jadi "Sudah tayang" dan itemnya sedikit redup.
            const at = item.airingAt ?? item.predictedMs ?? 0;
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
            return (
            <button
              key={`${item.id ?? item.slug}-${item.episode ?? 0}-${item.slug ?? ""}`}
              onClick={() => {
                if (tab === "anime") {
                  const id = String(item.id ?? "");
                  const ep = item.episode != null ? String(item.episode) : "0";
                  navigate(
                    `/nonton?anime=${encodeURIComponent(id)}&ep=${encodeURIComponent(`${id}__ep${ep}`)}&judul=${encodeURIComponent(item.title ?? "")}`,
                  );
                } else if (tab === "donghua") {
                  const donghuaId = String(item.id ?? "");
                  const donghuaEp = item.episode != null ? String(item.episode) : "1";
                  navigate(
                    `/nonton?anime=${encodeURIComponent(donghuaId)}&ep=${encodeURIComponent(`sanka__${donghuaId}__ep${donghuaEp}`)}&judul=${encodeURIComponent(item.title ?? "")}&donghua=1`,
                  );
                }
              }}
              className={cn(
                "flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-2.5 text-left transition hover:border-primary/40",
                itemAired && "opacity-60",
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
                {typeof item.episode === "number" &&
                  item.episode !== 0 && (
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

              {/* Judul + jam rilis + hitung mundur */}
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-semibold leading-5">
                  {item.title}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
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
            );
          })}
        </div>
      )}

      {/* "Lihat semua" menampilkan seluruh rilis hari itu (permintaan user);
          disclaimer lama sudah dihapus. */}
      {list.length > 0 && (
        <div className="mt-5 flex items-center justify-between gap-3 pb-6">
          <button
            onClick={() => {
              setShowAll(true);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="flex-1 rounded-2xl border border-primary/50 bg-primary/10 px-4 py-3 text-xs font-bold text-primary transition hover:bg-primary/20"
          >
            {showAll
              ? `Semua ${list.length} rilis hari ini ditampilkan`
              : `Lihat semua (${list.length} rilis hari ini)`}
          </button>
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="shrink-0 rounded-2xl border border-white/15 bg-white/[0.04] px-4 py-3 text-xs font-semibold text-muted-foreground transition hover:border-foreground/40 hover:text-foreground"
          >
            Kembali ke atas
          </button>
        </div>
      )}
    </div>
  );
}
