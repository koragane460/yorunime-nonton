import { useState } from "react";
import { useNavigate } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/AppLayout";
import { Avatar, BlueCheck, ShineBadge } from "@/components/lstream-ui";
import { STAFF_BADGE, timeAgo } from "@/lib/lstream";
import { Bell, BookOpen, PlayCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = "notif" | "lanjut";

export default function Info() {
  return (
    <AppLayout>
      <InfoContent />
    </AppLayout>
  );
}

function InfoContent() {
  const [tab, setTab] = useState<Tab>("notif");

  return (
    <div className="pb-6">
      {/* Dua tombol dengan garis bawah di bawahnya */}
      <div className="flex border-b border-white/15">
        {(
          [
            ["notif", "Pemberitahuan", Bell],
            ["lanjut", "Lanjutkan", PlayCircle],
          ] as const
        ).map(([k, label, Icon]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={cn(
              "relative flex flex-1 items-center justify-center gap-1.5 pb-2.5 pt-3 text-sm font-semibold transition",
              tab === k ? "text-foreground" : "text-muted-foreground",
            )}
          >
            <Icon className="size-4" />
            {label}
            {tab === k && (
              <span className="absolute inset-x-4 bottom-0 h-0.5 rounded-full bg-white/90" />
            )}
          </button>
        ))}
      </div>

      {tab === "notif" ? <NotifTab /> : <LanjutTab />}
    </div>
  );
}

/** Pemberitahuan: komentar teman & developer (bug/fix/update), terbaru dulu. */
function NotifTab() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const friendComments = useQuery(
    api.activities.myFriendsComments,
    user ? {} : "skip",
  );

  return (
    <div className="space-y-2.5 pt-3">
      {(friendComments ?? []).map((c: any) => (
        <button
          key={c._id}
          onClick={() => navigate(`/?pilih=${c.animeId.split("__")[0]}`)}
          className="block w-full overflow-hidden rounded-lg border border-border/70 bg-secondary/30 text-left transition hover:border-violet-500/50"
        >
          {c.bannerUrl && (
            <div
              className="h-7 w-full bg-cover bg-center opacity-70"
              style={{ backgroundImage: `url(${c.bannerUrl})` }}
            />
          )}
          <div className="flex gap-2.5 p-2.5">
            <Avatar src={c.image} seed={c.username} className="size-8" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <p className="truncate text-xs font-bold">{c.username}</p>
                {c.premium && <BlueCheck className="size-3.5" />}
                {c.staffRole && STAFF_BADGE[c.staffRole] && (
                  <ShineBadge
                    label={STAFF_BADGE[c.staffRole].name}
                    gradient={STAFF_BADGE[c.staffRole].cls}
                  />
                )}
                <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                  {timeAgo(c.createdAt)}
                </span>
              </div>
              <p className="line-clamp-2 text-sm text-zinc-300">{c.text}</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                {c.likeCount ?? 0} suka
              </p>
            </div>
          </div>
        </button>
      ))}
      {friendComments && friendComments.length === 0 && (
        <p className="py-10 text-center text-xs text-muted-foreground">
          Belum ada pemberitahuan dari developer atau teman
        </p>
      )}
    </div>
  );
}

/**
 * Lanjutkan: anime yang belum dituntaskan. Kalau sudah nonton lebih dari 20
 * menit, dianggap selesai dan tidak muncul di sini.
 */
function LanjutTab() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const rows = useQuery(api.activities.continueWatching, user ? {} : "skip");
  const comicRows = useQuery(api.comics.continueReading, user ? {} : "skip");

  return (
    <div className="space-y-2 pt-3">
      {(comicRows ?? []).map((c: any) => (
        <button
          key={c._id}
          onClick={() =>
            navigate(
              `/baca/${encodeURIComponent(c.slug)}/${c.chapter}?jenis=${c.kind}`,
            )
          }
          className="flex w-full items-center gap-3 rounded-xl border border-border/70 bg-secondary/30 p-2.5 text-left transition hover:border-violet-500/50"
        >
          <img
            src={c.comicImage ?? ""}
            alt=""
            className="h-16 w-11 shrink-0 rounded-lg object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{c.comicTitle}</p>
            <p className="text-xs text-muted-foreground">
              {c.chapterLabel ?? `Chapter ${c.chapter}`}
            </p>
            <p className="text-[11px] text-violet-300">
              Lanjut dari halaman {Math.min((c.page ?? 0) + 1, c.totalPages ?? 0)}
            </p>
          </div>
          <BookOpen className="size-5 shrink-0 text-violet-400" />
        </button>
      ))}

      {(rows ?? []).map((h: any) => {
        const epId = `${h.animeId}__ep${h.episode}`;
        const pos = Math.max(0, h.progressSec ?? 0);
        const dur = h.durationSec ?? 0;
        const pct = dur > 0 ? Math.min(100, Math.round((pos / dur) * 100)) : 0;
        return (
          <button
            key={h._id}
            onClick={() =>
              navigate(`/nonton?anime=${h.animeId}&ep=${epId}&t=${Math.floor(pos)}`)
            }
            className="flex w-full items-center gap-3 rounded-xl border border-border/70 bg-secondary/30 p-2.5 text-left transition hover:border-violet-500/50"
          >
            <img
              src={h.animeImage ?? ""}
              alt=""
              className="h-16 w-11 shrink-0 rounded-lg object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{h.animeTitle}</p>
              <p className="text-xs text-muted-foreground">
                Episode {h.episode}
                {dur > 0 ? ` · durasi ${fmtTime(dur)}` : ""}
              </p>
              {/* Posisi terakhir + durasi episode, jadi jelas sudah berapa lama */}
              <div className="mt-1 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/15">
                  <div
                    className="h-full rounded-full bg-violet-500"
                    style={{ width: `${dur > 0 ? pct : 0}%` }}
                  />
                </div>
                <span className="shrink-0 text-[10px] font-semibold text-violet-300">
                  {dur > 0 ? `${fmtTime(pos)} / ${fmtTime(dur)}` : fmtTime(pos)}
                </span>
              </div>
            </div>
            <PlayCircle className="size-5 shrink-0 text-violet-400" />
          </button>
        );
      })}
      {rows && rows.length === 0 && (comicRows ?? []).length === 0 && (
        <p className="py-10 text-center text-xs text-muted-foreground">
          Belum ada anime atau komik yang belum selesai
        </p>
      )}
    </div>
  );
}

function fmtTime(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  return `${m}:${String(r).padStart(2, "0")}`;
}
