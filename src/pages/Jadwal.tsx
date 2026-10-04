import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useAction } from "convex/react";

import { api } from "@/convex/_generated/api";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { BookOpen, ChevronDown, ChevronUp, Clock, PanelsTopLeft, Sparkles, Tv } from "lucide-react";

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
  const [tab, setTab] = useState<Tab>("anime");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sched, setSched] = useState<Record<string, AiringItem[]>>({});
  const [comics, setComics] = useState<Record<string, Record<string, ComicSlot[]>>>({});
  const [donghuaByDay, setDonghuaByDay] = useState<Record<string, DonghuaRow[]>>({});
  const [donghuaAcak, setDonghuaAcak] = useState<DonghuaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [comicLoading, setComicLoading] = useState(false);
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
    () => Object.values(sched).reduce((s, v) => s + v.length, 0),
    [sched],
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
      ? (sched[DAYS_ID[day]] ?? [])
      : tab === "donghua"
        ? (donghuaByDay[DAYS_ID[day]] ?? [])
        : (comics[tab]?.[DAYS_ID[day]] ?? []);
  const totalShown = tab === "anime" ? animeTotal : comicCounts[tab];

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
            "flex w-full items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition",
            tab === "anime"
              ? "border-amber-300/60 bg-amber-300/10"
              : tab === "manga"
                ? "border-sky-500/60 bg-sky-500/10"
                : tab === "manhwa"
                  ? "border-fuchsia-500/60 bg-fuchsia-500/10"
                  : "border-violet-500/60 bg-violet-500/10",
          )}
        >
          <ActiveIcon className="size-4" />
          <span className="flex-1 text-left">Jadwal {active.label}</span>
          <span className="text-xs opacity-60">{active.count}</span>
          {pickerOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </button>
        {pickerOpen && (
          <div className="pop-enter mt-1.5 grid grid-cols-4 gap-1.5">
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
                    // Empat tombol dalam satu baris → padding & font
                    // dikecilkan supaya tidak memenuhi layar.
                    "flex flex-col items-center gap-1 rounded-lg border px-1 py-2 text-[11px] font-semibold transition",
                    tab === t.key
                      ? "border-foreground/40 bg-primary/15 text-primary"
                      : "border-border text-muted-foreground hover:border-foreground/40",
                  )}
                >
                  <Icon className="size-3.5" />
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
            tab === "anime"
              ? (sched[d] ?? []).length
              : tab === "donghua"
                ? (donghuaByDay[d] ?? []).length
                : (comics[tab]?.[d] ?? []).length;
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

      {tab === "donghua" ? (
        comicLoading ? (
          <p className="py-12 text-center text-sm text-muted-foreground">Memuat donghua…</p>
        ) : (list as DonghuaRow[]).length === 0 && donghuaAcak.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Belum ada donghua untuk {DAYS_ID[day]}
          </p>
        ) : (
          <div className="space-y-2">
            {(list as DonghuaRow[]).map((d) => (
              <DonghuaCard key={d.id} row={d} dayLabel={DAYS_ID[day]} />
            ))}
            {/* Judul tanpa hari tetap tetap ditampilkan supaya tidak ada
                donghua yang hilang dari Jadwal. */}
            {donghuaAcak.map((d) => (
              <DonghuaCard key={`acak-${d.id}`} row={d} dayLabel="Tanpa hari" />
            ))}
          </div>
        )
      ) : tab === "anime" ? (
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
          : tab === "donghua"
            ? "Sumber: SankaVollerei"
            : "Estimasi, bukan jadwal resmi — chapter bisa saja terlambat."}
      </p>
    </div>
  );
}

/** Satu baris jadwal donghua; dipisah supaya daftar hari dan daftar
    "tanpa hari" punya tampilan yang sama. */
function DonghuaCard({ row, dayLabel }: { row: DonghuaRow; dayLabel: string }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  return (
    <button
      onClick={() =>
        navigate(
          user
            ? `/nonton?anime=${encodeURIComponent(row.id)}&judul=${encodeURIComponent(row.title ?? "")}&donghua=1`
            : "/auth",
        )
      }
      className="flex w-full items-center gap-3 rounded-xl border border-violet-500/40 bg-secondary/30 p-2.5 text-left transition hover:border-violet-400/70"
    >
      {row.image ? (
        <img
          src={row.image}
          alt=""
          className="h-16 w-11 shrink-0 rounded-lg object-cover"
        />
      ) : (
        <div className="flex h-16 w-11 shrink-0 items-center justify-center rounded-lg bg-black/40">
          <Sparkles className="size-4 text-violet-400/70" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{row.title}</p>
        <p className="text-xs text-muted-foreground">
          {row.episode ? `Sampai episode ${row.episode}` : dayLabel}
          {row.status ? ` • ${row.status}` : ""}
        </p>
      </div>
      <Sparkles className="size-5 shrink-0 text-violet-400/80" />
    </button>
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
