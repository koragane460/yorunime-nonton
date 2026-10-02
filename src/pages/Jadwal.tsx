import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useAction } from "convex/react";

import { api } from "@/convex/_generated/api";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { BookOpen, ChevronDown, ChevronUp, Clock, PanelsTopLeft, Tv } from "lucide-react";

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

type Tab = "anime" | "manga" | "manhwa";

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
  const comicSchedule = useAction(api.manga.schedule);
  const [tab, setTab] = useState<Tab>("anime");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sched, setSched] = useState<Record<string, AiringItem[]>>({});
  const [comics, setComics] = useState<Record<string, Record<string, ComicSlot[]>>>({});
  const [loading, setLoading] = useState(true);
  const [comicLoading, setComicLoading] = useState(false);
  const todayIdx = new Date().getDay();
  const [day, setDay] = useState(todayIdx);

  useEffect(() => {
    schedule({})
      .then((r: any) => setSched((r as any) ?? {}))
      .catch(() => setSched({}))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Manga & manhwa dimuat saat tabnya dibuka (hemat request).
  useEffect(() => {
    if (tab === "anime" || comics[tab]) return;
    let alive = true;
    setComicLoading(true);
    comicSchedule({ kind: tab })
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

  // Hitung mundur tiap 30 detik.
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const animeTotal = useMemo(
    () => Object.values(sched).reduce((s, v) => s + v.length, 0),
    [sched],
  );
  const comicCounts: Record<string, number> = {};
  for (const t of ["manga", "manhwa"] as const) {
    comicCounts[t] = Object.values(comics[t] ?? {}).reduce((s, v) => s + (v?.length ?? 0), 0);
  }

  const tabs: { key: Tab; label: string; icon: typeof Tv; count: number }[] = [
    { key: "anime", label: "Anime", icon: Tv, count: animeTotal },
    { key: "manga", label: "Manga", icon: BookOpen, count: comicCounts.manga },
    { key: "manhwa", label: "Manhwa", icon: PanelsTopLeft, count: comicCounts.manhwa },
  ];
  const active = tabs.find((t) => t.key === tab) ?? tabs[0];
  const ActiveIcon = active.icon;
  const list =
    tab === "anime" ? (sched[DAYS_ID[day]] ?? []) : (comics[tab]?.[DAYS_ID[day]] ?? []);
  const totalShown = tab === "anime" ? animeTotal : comicCounts[tab];

  return (
    <div className="py-3">
      <h1 className="mb-1 text-lg font-bold">Jadwal Rilis</h1>
      <p className="mb-3 text-[11px] text-muted-foreground">
        {tab === "anime"
          ? "Jam tayang dalam waktu lokal kamu — dari jadwal tayang resmi AniList"
          : "Proyeksi chapter berikutnya dari rata-rata jarak rilis chapter terakhir"}
      </p>

      {/* Switcher: anime di atas, pilihan manga & manhwa muncul saat diklik */}
      <div className="mb-3">
        <button
          onClick={() => setPickerOpen((v) => !v)}
          className={cn(
            "flex w-full items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition",
            tab === "anime"
              ? "border-amber-300/60 bg-amber-300/10"
              : tab === "manga"
                ? "border-sky-500/60 bg-sky-500/10"
                : "border-fuchsia-500/60 bg-fuchsia-500/10",
          )}
        >
          <ActiveIcon className="size-4" />
          <span className="flex-1 text-left">Jadwal {active.label}</span>
          <span className="text-xs opacity-60">{active.count}</span>
          {pickerOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </button>
        {pickerOpen && (
          <div className="pop-enter mt-1.5 grid grid-cols-3 gap-1.5">
            {tabs.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.key}
                  onClick={() => {
                    setTab(t.key);
                    setPickerOpen(false);
                  }}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-xl border py-2.5 text-xs font-semibold transition",
                    tab === t.key
                      ? "border-violet-500 bg-violet-500/15 text-violet-200"
                      : "border-border text-muted-foreground hover:border-violet-500/50",
                  )}
                >
                  <Icon className="size-4" />
                  {t.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="thin-scroll mb-3 flex gap-1.5 overflow-x-auto pb-1">
        {DAYS_ID.map((d, i) => {
          const count =
            tab === "anime" ? (sched[d] ?? []).length : (comics[tab]?.[d] ?? []).length;
          return (
            <button
              key={d}
              onClick={() => setDay(i)}
              className={cn(
                "shrink-0 rounded-full border px-4 py-1.5 text-xs font-semibold transition",
                day === i
                  ? "border-amber-300 bg-amber-300/15 text-amber-200"
                  : "border-border text-muted-foreground",
              )}
            >
              {d}
              <span className="ml-1 opacity-60">{count}</span>
            </button>
          );
        })}
      </div>

      {tab === "anime" ? (
        loading ? (
          <p className="py-12 text-center text-sm text-muted-foreground">Memuat jadwal…</p>
        ) : animeTotal === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Belum ada jadwal rilis yang tersedia
          </p>
        ) : list.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Tidak ada anime yang tayang hari {DAYS_ID[day]}
          </p>
        ) : (
          <div className="space-y-2">
            {(list as AiringItem[]).map((a) => (
              <button
                key={`${a.id}-${a.episode}`}
                onClick={() =>
                  navigate(
                    user
                      ? `/nonton?anime=${encodeURIComponent(a.id)}&judul=${encodeURIComponent(a.title ?? "")}`
                      : "/auth",
                  )
                }
                className="flex w-full items-center gap-3 rounded-xl border border-border/70 bg-secondary/30 p-2.5 text-left transition hover:border-amber-300/50"
              >
                <img src={a.image} alt="" className="h-16 w-11 shrink-0 rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{a.title}</p>
                  <p className="text-xs text-muted-foreground">
                    Episode {a.episode} — {a.day}, {a.time} WIB
                  </p>
                  <p className="text-[11px] text-amber-300">{countdown(a.airingAt)}</p>
                </div>
                <Clock className="size-5 shrink-0 text-amber-300/80" />
              </button>
            ))}
          </div>
        )
      ) : comicLoading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Memuat jadwal…</p>
      ) : totalShown === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Belum ada jadwal {tab} — cek lagi nanti
        </p>
      ) : (list as ComicSlot[]).length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Tidak ada chapter {tab} yang diperkirakan hari {DAYS_ID[day]}
        </p>
      ) : (
        <div className="space-y-2">
          {(list as ComicSlot[]).map((c) => (
            <button
              key={`${c.slug}-${c.nextChapter}`}
              onClick={() => navigate(`/manga?komik=${encodeURIComponent(c.slug)}`)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border bg-secondary/30 p-2.5 text-left transition",
                tab === "manga"
                  ? "border-border/70 hover:border-sky-400/60"
                  : "border-border/70 hover:border-fuchsia-400/60",
              )}
            >
              <img src={c.image} alt="" className="h-16 w-11 shrink-0 rounded-lg object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{c.title}</p>
                <p className="text-xs text-muted-foreground">
                  {c.nextLabel} — {DAYS_ID[day]}, {c.time} WIB
                </p>
                <p className="text-[11px] text-amber-300">{countdown(c.predictedMs)}</p>
              </div>
              <Clock className="size-5 shrink-0 text-amber-300/80" />
            </button>
          ))}
        </div>
      )}

      <p className="mt-4 text-center text-[10px] text-muted-foreground">
        {tab === "anime"
          ? "Sumber: AniList"
          : "Estimasi, bukan jadwal resmi — chapter bisa saja terlambat."}
      </p>
    </div>
  );
}

function countdown(ts: number) {
  const diff = ts - Date.now();
  if (diff <= 0) return "Kemungkinan sudah rilis";
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor((diff % 86_400_000) / 3_600_000);
  if (d > 0) return `${d} hari ${h} jam lagi`;
  if (h > 0) return `${h} jam lagi`;
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (m > 0) return `${m} menit lagi`;
  return `${Math.floor((diff % 60_000) / 1000)} detik lagi`;
}
