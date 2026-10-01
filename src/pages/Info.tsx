import { useState } from "react";
import { useNavigate } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/AppLayout";
import { Avatar, BlueCheck, ShineBadge } from "@/components/lstream-ui";
import { STAFF_BADGE, timeAgo } from "@/lib/lstream";
import {
  Bell,
  BookOpen,
  Megaphone,
  PlayCircle,
  Plus,
  Send,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

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

/** Pemberitahuan: broadcast developer, notifikasi sistem, dan komentar teman. */
function NotifTab() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const friendComments = useQuery(
    api.activities.myFriendsComments,
    user ? {} : "skip",
  );
  const access = useQuery(api.moderation.myPanelAccess, user ? {} : "skip");
  const notifs = useQuery(
    api.moderation.myNotifications,
    user ? {} : "skip",
  );
  const [composeOpen, setComposeOpen] = useState(false);
  const isDev = access?.level === "dev";

  return (
    <div className="space-y-2.5 pt-3">
      {/* Tombol + khusus developer: kirim pesan ke semua user */}
      {isDev && (
        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold">
            <Megaphone className="size-3.5 text-muted-foreground" /> Broadcast
          </p>
          <button
            onClick={() => setComposeOpen((v) => !v)}
            className={cn(
              "flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-bold transition",
              composeOpen
                ? "border border-white/15 text-muted-foreground"
                : "bg-primary text-primary-foreground",
            )}
          >
            {composeOpen ? <X className="size-3.5" /> : <Plus className="size-4" />}
            {composeOpen ? "Batal" : "Kirim"}
          </button>
        </div>
      )}

      {composeOpen && isDev && (
        <BroadcastComposer onDone={() => setComposeOpen(false)} />
      )}

      {(notifs ?? []).map((n) => (
        <div
          key={n._id}
          className="flex gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] p-2.5"
        >
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06]">
            <Bell className="size-4 text-muted-foreground" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-xs font-bold">{n.title}</p>
              <span className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground">
                {timeAgo(n.createdAt)}
              </span>
            </div>
            {n.body && (
              <p className="mt-0.5 text-[13px] leading-snug text-zinc-300">
                {n.body}
              </p>
            )}
          </div>
        </div>
      ))}

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
      {friendComments && friendComments.length === 0 && (notifs ?? []).length === 0 && (
        <p className="py-10 text-center text-xs text-muted-foreground">
          Belum ada pemberitahuan dari developer atau teman
        </p>
      )}
    </div>
  );
}

/** Dialog dev: kirim pesan + title ke semua user lewat halaman Pemberitahuan. */
function BroadcastComposer({ onDone }: { onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const send = useMutation(api.moderation.broadcast);

  const submit = async () => {
    if (!title.trim() || !body.trim()) {
      toast.error("Title dan isi pesan wajib diisi");
      return;
    }
    setBusy(true);
    try {
      const res = await send({ title: title.trim(), body: body.trim() });
      toast.success(`Terkirim ke ${res.sent} user`);
      setTitle("");
      setBody("");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengirim");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2 rounded-xl border border-border bg-card p-3">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title pesan"
        className="w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-sm outline-none focus:border-violet-500/70"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Isi pesan untuk semua user"
        rows={4}
        className="w-full resize-none rounded-lg border border-border bg-background/60 px-3 py-2 text-sm outline-none focus:border-violet-500/70"
      />
      <Button
        onClick={() => void submit()}
        disabled={busy}
        className="w-full rounded-full bg-violet-600 font-bold text-white hover:bg-violet-500"
      >
        <Send className="size-4" /> {busy ? "Mengirim…" : "Kirim"}
      </Button>
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
