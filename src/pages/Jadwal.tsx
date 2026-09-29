import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { Clock } from "lucide-react";

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
  const [sched, setSched] = useState<Record<string, AiringItem[]>>({});
  const [loading, setLoading] = useState(true);
  // DAYS_ID dimulai dari Minggu, jadi indeks hari = getDay() langsung.
  const todayIdx = new Date().getDay();
  const [day, setDay] = useState(todayIdx);

  useEffect(() => {
    schedule({})
      .then((r: any) => setSched((r as any) ?? {}))
      .catch(() => setSched({}))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hitung mundur tiap menit supaya jam tayang selalu akurat.
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const list = sched[DAYS_ID[day]] ?? [];
  const total = Object.values(sched).reduce((s, v) => s + v.length, 0);

  return (
    <div className="py-3">
      <h1 className="mb-1 text-lg font-bold">Jadwal Rilis Anime</h1>
      <p className="mb-3 text-[11px] text-muted-foreground">
        Jam tayang dalam waktu lokal kamu — dari jadwal tayang resmi AniList
      </p>

      <div className="thin-scroll mb-3 flex gap-1.5 overflow-x-auto pb-1">
        {DAYS_ID.map((d, i) => {
          const count = (sched[d] ?? []).length;
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

      {loading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Memuat jadwal…</p>
      ) : total === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Belum ada jadwal rilis yang tersedia
        </p>
      ) : list.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Tidak ada anime yang tayang hari {DAYS_ID[day]}
        </p>
      ) : (
        <div className="space-y-2">
          {list.map((a) => (
            <button
              key={`${a.id}-${a.episode}`}
              onClick={() => {
                if (!user) {
                  navigate("/auth");
                  return;
                }
                navigate(`/nonton?anime=${a.id}`);
              }}
              className="flex w-full items-center gap-3 rounded-xl border border-border/70 bg-secondary/30 p-2.5 text-left transition hover:border-amber-300/50"
            >
              <img
                src={a.image}
                alt=""
                className="h-16 w-11 shrink-0 rounded-lg object-cover"
              />
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
      )}
    </div>
  );
}

function countdown(ts: number) {
  const diff = ts - Date.now();
  if (diff <= 0) return "Sedang tayang";
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1000);
  if (h > 0) return `${h} jam ${m} menit lagi`;
  if (m > 0) return `${m} menit ${s} detik lagi`;
  return `${s} detik lagi`;
}
