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
  const list =
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
  const diff = Math.max(
    0,
    (list[0]?.airingAt ?? list[0]?.predictedMs ?? 0) - now.getTime(),
  );
  const mins = Math.floor(diff / 60_000);
  const hrs = Math.floor(mins / 60);
  const secs = diff % 60;

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
            "flex w-full items-center gap-2 rounded-xl border border-border bg-secondary/40 px-4 py-2.5 text-sm font-semibold text-foreground",
            pickerOpen ? "border-foreground/40" : "",
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
          <div className="mt-2 rounded-xl border border-border bg-secondary/40 p-2">
            {tabs
              .filter((t) => t.key !== tab)
              .map((t) => (
                <button
                  key={t.key}
                  onClick={() => {
                    setTab(t.key);
                    setPickerOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-foreground/5",
                    t.key === "donghua" && "mt-1",
                  )}
                >
                  <t.icon className="size-4 shrink-0 text-primary" />
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

      {/* timer hitung mundur + pengalihan hari */}
      {(tab === "anime" || tab === "donghua") && (
        <div className="mb-3 flex items-center gap-3 rounded-xl border border-border bg-secondary/40 px-4 py-2.5">
          <Clock className="size-4 shrink-0 text-primary" />
          <div className="flex-1">
            {list.length > 0 ? (
              <>
                <p className="text-sm font-semibold">{list[0].title}</p>
                <p className="text-[11px] text-muted-foreground">
                  tayang dalam {hrs > 0 ? `${hrs}j` : ""}
                  {mins > 0 ? `${mins % 60}m` : ""}
                  {sec && hrs === 0 ? `${secs}s` : ""}
                  {list[0].episode ? ` · Ep ${list[0].episode}` : ""}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Tidak ada jadwal hari ini
              </p>
            )}
          </div>
          <div className="flex items-center gap-1">
            {day > 0 && (
              <button
                onClick={() => setDay((d) => (d - 1 + 7) % 7)}
                className="flex size-8 items-center justify-center rounded-full border border-border text-zinc-500 hover:border-foreground/40"
                aria-label="Hari sebelumnya"
              >
                <ChevronLeft className="size-4" />
              </button>
            )}
            <span className="flex-1 text-center text-[11px] font-semibold text-zinc-400">
              {DAYS_ID[day]}
            </span>
            {day < 6 && (
              <button
                onClick={() => setDay((d) => (d + 1) % 7)}
                className="flex size-8 items-center justify-center rounded-full border border-border text-zinc-500 hover:border-foreground/40"
                aria-label="Hari berikutnya"
              >
                <ChevronRight className="size-4" />
              </button>
            )}
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
        <div className="mb-2 flex gap-2.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-44 w-28 shrink-0 overflow-hidden rounded-xl bg-card"
            >
              <div className="skeleton h-full w-full" />
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
        <div className="thin-scroll flex gap-2.5 overflow-x-auto pb-2">
          {list.map((item, i) => (
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
              className="w-28 shrink-0 text-left"
            >
              <div className="relative">
                <div className="aspect-[2/3] overflow-hidden rounded-xl bg-black">
                  <img
                    src={item.image}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </div>
                {typeof item.episode === "number" &&
                  item.episode !== 0 && (
                    <span className="absolute left-1.5 top-1.5 rounded bg-primary px-1.5 py-0.5 text-[9px] font-bold text-white">
                      Ep {item.episode}
                    </span>
                  )}
                {item.estimated && (
                  <span className="absolute right-1.5 top-1.5 rounded bg-amber-500/90 px-1.5 py-0.5 text-[8px] font-black uppercase text-white">
                    Estimasi
                  </span>
                )}
                {item.id != null &&
                  (dupCounts[`${item.id}-${item.episode ?? 0}`] > 1) && (
                    <span className="absolute -right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-rose-500 text-[9px] font-black text-white">
                      {dupCounts[`${item.id}-${item.episode ?? 0}]`}
                    </span>
                  )
                }
              </div>
              <p className="mt-1 line-clamp-2 min-h-8 text-[11px] font-medium leading-4">
                {item.title}
              </p>
              {item.time && (
                <p className="font-mono text-[10px] text-muted-foreground">
                  {item.time}
                </p>
              )}
            </button>
          ))}
        </div>
      )}

      {/* tab show all + footer small */}
      {list.length > 0 && (
        <div className="mt-4 flex items-center justify-between">
          <button
            onClick={() => setTab(tab === "anime" ? "anime" : "anime")}
            className="text-[11px] text-primary hover:underline"
          >
            Lihat semua
          </button>
          <button
            onClick={() => {
              const t = document.querySelector(".thin-scroll") as HTMLElement | null;
              t?.scrollTo({ left: 0, behavior: "smooth" });
            }}
            className="text-[11px] text-muted-foreground hover:text-foreground"
          >
            Kembali ke atas
          </button>
        </div>
      )}

      <p className="mt-4 text-[11px] text-zinc-500 text-center">
        Jadwal rilis hanya menampilkan judul yang sudah ada di database — tidak
        semua episode hari ini.
      </p>
    </div>
  );
}
