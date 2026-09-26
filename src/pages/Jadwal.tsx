import { useEffect, useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AppLayout } from "@/components/AppLayout";
import { AnimeGrid } from "@/components/lstream-ui";
import { DAYS_ID } from "@/lib/lstream";
import { cn } from "@/lib/utils";

export default function Jadwal() {
  return (
    <AppLayout hideAccountPanel>
      <JadwalContent />
    </AppLayout>
  );
}

function JadwalContent() {
  const schedule = useAction(api.anime.animeSchedule);
  const [sched, setSched] = useState<Record<string, any[]>>({});
  const todayIdx = (new Date().getDay() + 6) % 7;
  const [day, setDay] = useState(todayIdx);

  useEffect(() => {
    schedule({})
      .then((r: any) => setSched((r as any) ?? {}))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const list = sched[DAYS_EN[day]] ?? [];
  void DAYS_EN;

  return (
    <div className="py-3">
      <h1 className="mb-3 text-lg font-bold">Jadwal Anime</h1>
      <div className="thin-scroll mb-3 flex gap-1.5 overflow-x-auto pb-1">
        {DAYS_ID.map((d, i) => (
          <button
            key={d}
            onClick={() => setDay(i)}
            className={cn(
              "shrink-0 rounded-full border px-4 py-1.5 text-xs font-semibold transition",
              day === i
                ? "border-yellow-400 bg-yellow-400/15 text-yellow-300"
                : "border-border text-muted-foreground",
            )}
          >
            {d}
          </button>
        ))}
      </div>
      <p className="mb-2 text-xs text-muted-foreground">
        {list.length} anime rilis di hari {DAYS_ID[day]}
      </p>
      <AnimeGrid items={list} onPick={() => {}} newIds={new Set()} />
      {list.length === 0 && (
        <p className="py-12 text-center text-sm text-muted-foreground">Tidak ada data</p>
      )}
    </div>
  );
}

const DAYS_EN = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];
