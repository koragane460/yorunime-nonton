import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/AppLayout";
import {
  BookOpen,
  ChevronDown,
  Clock,
  ChevronUp,
  Eye,
  EyeOff,
  Megaphone,
  PlayCircle,
  Plus,
  Send,
  Trash2,
  X,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Tab = "lanjut";

export default function Info() {
  return (
    <AppLayout>
      <InfoContent />
    </AppLayout>
  );
}

function InfoContent() {
  const [tab, setTab] = useState<Tab>("lanjut");

  return (
    <div className="pb-6">
      {/* Pemberitahuan tidak lagi tampil di sini — semuanya sudah pindah ke
          area Notif (tombol lonceng di banner akun). Sisa halaman ini khusus
          "Lanjutkan" agar isinya tidak terasa kosong. */}
      <div className="flex border-b border-white/15">
        {([["lanjut", "Lanjutkan", Layers]] as const).map(
          ([k, label, Icon]) => (
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
          ),
        )}
      </div>

      {tab === "lanjut" ? <LanjutTab /> : null}
      <DevTools />
    </div>
  );
}

/**
 * Alat developer: kirim pesan massal + kelola popup pengumuman.
 *
 * Isi notifikasi yang dikirim dari sini sudah otomatis muncul di area Notif
 * (tombol lonceng di banner akun), jadi halaman ini tidak perlu menampilkan
 * daftar notifikasi lagi — hanya alat untuk mengirimnya.
 */
function DevTools() {
  const { user } = useAuth();
  const access = useQuery(api.moderation.myPanelAccess, user ? {} : "skip");
  const [composeOpen, setComposeOpen] = useState(false);
  // Query daftar pengumuman baru jalan setelah panelnya diketuk, supaya
  // halaman Info tidak lambat saat dibuka.
  const [annOpen, setAnnOpen] = useState(false);
  const isDev = access?.level === "dev";

  if (!isDev) return null;

  return (
    <div className="space-y-2 pt-3">
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

      {composeOpen && <BroadcastComposer onDone={() => setComposeOpen(false)} />}

      <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
        <button
          onClick={() => setAnnOpen((v) => !v)}
          className="flex min-h-9 w-full items-center justify-between text-xs font-semibold"
        >
          <span className="flex items-center gap-1.5">
            <Megaphone className="size-3.5 text-muted-foreground" />
            Popup pengumuman
          </span>
          {annOpen ? (
            <ChevronUp className="size-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-4 text-muted-foreground" />
          )}
        </button>
        {annOpen && <AnnouncementManager />}
      </div>
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
        className="w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-sm outline-none focus:border-foreground/40"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Isi pesan untuk semua user"
        rows={4}
        className="w-full resize-none rounded-lg border border-border bg-background/60 px-3 py-2 text-sm outline-none focus:border-foreground/40"
      />
      <Button
        onClick={() => void submit()}
        disabled={busy}
        className="w-full rounded-full bg-primary font-bold text-white hover:bg-primary"
      >
        <Send className="size-4" /> {busy ? "Mengirim…" : "Kirim"}
      </Button>
    </div>
  );
}function AnnouncementManager() {
  const rows = useQuery(api.moderation.allAnnouncements, {});
  const create = useMutation(api.moderation.createAnnouncement);
  const setActive = useMutation(api.moderation.setAnnouncementActive);
  const remove = useMutation(api.moderation.deleteAnnouncement);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!message.trim()) {
      toast.error("Pesan wajib diisi");
      return;
    }
    setBusy(true);
    try {
      await create({ message: message.trim() });
      setMessage("");
      toast.success("Pengumuman dikirim");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengirim");
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (id: any, active: boolean) => {
    try {
      await setActive({ id, active: !active });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengubah status");
    }
  };

  const destroy = async (id: any) => {
    try {
      await remove({ id });
      toast.success("Pengumuman dihapus");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menghapus");
    }
  };

  return (
    <div className="space-y-2 pt-2">
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Pesan yang muncul di atas halaman semua user"
        rows={3}
        maxLength={400}
        className="w-full resize-none rounded-lg border border-border bg-background/60 px-3 py-2 text-sm outline-none focus:border-foreground/40"
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-muted-foreground">
          {message.length}/400
        </span>
        <Button
          onClick={() => void submit()}
          disabled={busy || !message.trim()}
          className="h-9 rounded-full bg-primary px-4 font-bold text-white hover:bg-primary"
        >
          <Send className="size-3.5" /> {busy ? "Mengirim…" : "Kirim"}
        </Button>
      </div>
      {(rows ?? []).map((a: any) => (
        <div
          key={a._id}
          className="flex items-start gap-2 rounded-lg border border-border/70 bg-background/50 p-2"
        >
          <p className="min-w-0 flex-1 whitespace-pre-line text-[13px] leading-snug text-zinc-200">
            {a.message}
          </p>
          <button
            onClick={() => void toggle(a._id, a.active)}
            aria-label={a.active ? "Matikan pengumuman" : "Aktifkan pengumuman"}
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg border transition",
              a.active
                ? "border-emerald-500/60 text-emerald-400"
                : "border-white/15 text-white/40",
            )}
          >
            {a.active ? (
              <Eye className="size-4" />
            ) : (
              <EyeOff className="size-4" />
            )}
          </button>
          <button
            onClick={() => void destroy(a._id)}
            aria-label="Hapus pengumuman"
            className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-red-500/40 text-red-400 transition hover:bg-red-500/10"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      ))}
      {rows && rows.length === 0 && (
        <p className="text-[11px] text-muted-foreground">
          Belum ada pengumuman popup
        </p>
      )}
    </div>
  );
}

/**
 * Lanjutkan: anime + manga/manhwa digabung jadi satu daftar, diurutkan dari
 * yang paling baru ditonton dibaca (tidak ada prioritas ke komik atau anime).
 */
function LanjutTab() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const rows = useQuery(api.activities.continueWatching, user ? {} : "skip");
  const comicRows = useQuery(api.comics.continueReading, user ? {} : "skip");

  const merged = useMemo(() => {
    const anime = (rows ?? []).map((h: any) => ({
      key: `a-${h._id}`,
      at: h.updatedAt ?? 0,
      data: h,
      type: "anime" as const,
    }));
    const comic = (comicRows ?? []).map((c: any) => ({
      key: `c-${c._id}`,
      at: c.updatedAt ?? 0,
      data: c,
      type: "comic" as const,
    }));
    return [...anime, ...comic].sort((a, b) => b.at - a.at);
  }, [rows, comicRows]);

  // Kelompokkan per hari: Hari ini → Kemarin → dd/mm/yyyy. Tiap label
  // hari dibungkus kotak rounded biru muda supaya mudah dikenali.
  const groups = useMemo(() => {
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startYesterday = startToday - 86400000;
    const byKey = new Map<number, { label: string; items: typeof merged }>();
    for (const it of merged) {
      const d = new Date(it.at);
      const key = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      let label: string;
      if (key >= startToday) label = "Hari ini";
      else if (key >= startYesterday) label = "Kemarin";
      else
        label = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
      const g = byKey.get(key);
      if (g) g.items.push(it);
      else byKey.set(key, { label, items: [it] });
    }
    // Urut: hari terbaru dulu (Map mempertahankan urutan sisipan, merged sudah desc).
    return [...byKey.entries()].sort((a, b) => b[0] - a[0]).map(([, g]) => g);
  }, [merged]);

  if (merged.length === 0) {
    return (
      <p className="py-10 text-center text-xs text-muted-foreground">
        Belum ada anime atau komik yang belum selesai
      </p>
    );
  }

  return (
    <div className="pt-3">
      {groups.map((g) => (
        <div key={g.label} className="mb-4">
          {/* Judul tanggal: kotak rounded biru, teks putih supaya kontras. */}
          <h3 className="mb-2 inline-flex rounded-lg bg-sky-600/70 px-2.5 py-1 text-left text-sm font-bold tracking-tight text-white">
            {g.label}
          </h3>
          <div className="space-y-2">
            {g.items.map((item, idx) => {
        // Garis penghubung tipis di tengah bawah kartu — hanya antar kartu
        // dalam satu kelompok hari (bukan di kartu terakhir).
        const link =
          idx < g.items.length - 1 ? (
            <span
              aria-hidden
              className="absolute -bottom-1 left-1/4 h-1.5 w-20 -translate-x-1/2 bg-white/25"
            />
          ) : null;
        if (item.type === "comic") {
          const c: any = item.data;
          return (
            <button
              key={item.key}
              onClick={() =>
                navigate(
                  `/baca/${encodeURIComponent(c.slug)}/${c.chapter}?jenis=${c.kind}`,
                )
              }
              className="relative flex w-full items-center gap-3 rounded-xl border border-border/70 bg-secondary/30 p-2.5 pr-10 text-left transition hover:border-foreground/40"
            >
              {/* Jam kapan terakhir dibaca — pojok kanan atas. */}
              <span className="absolute right-2.5 top-2 flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
                <Clock className="size-3" aria-hidden />
                {fmtClock(item.at)}
              </span>
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
                <p className="text-[11px] text-primary">
                  Lanjut dari halaman{" "}
                  {Math.min((c.page ?? 0) + 1, c.totalPages ?? 0)}
                </p>
              </div>
              <BookOpen className="size-5 shrink-0 text-primary" />
              {link}
            </button>
          );
        }
        const h: any = item.data;
        const epId = `${h.animeId}__ep${h.episode}`;
        const pos = Math.max(0, h.progressSec ?? 0);
        const dur = h.durationSec ?? 0;
        const pct = dur > 0 ? Math.min(100, Math.round((pos / dur) * 100)) : 0;
        // Catatan progres: saat pos > 0, hitung langsung dari elapsed
        // (pos/60) bukan dari durasi. Jadi saat menit terakhir bergerak,
        // baris ini langsung berubah (bukan 00/00). Episode baru (pos 0)
        // tetap menampilkan "00/00" sampai user mulai nonton.
        const posM = pos > 0 ? Math.floor(pos / 60) : 0;
        const durM = dur > 0 ? Math.floor(dur / 60) : 0;
        return (            <button
              key={item.key}
            onClick={() =>
              navigate(
                `/nonton?anime=${encodeURIComponent(h.animeId)}&ep=${encodeURIComponent(epId)}&t=${Math.floor(pos)}&judul=${encodeURIComponent(h.animeTitle ?? "")}`,
              )
            }
            className="relative flex w-full items-stretch gap-3 rounded-xl border border-border/70 bg-secondary/30 p-2.5 pr-10 text-left transition hover:border-foreground/40"
          >
            {/* Jam kapan terakhir ditonton — pojok kanan atas. */}
            <span className="absolute right-2.5 top-2 z-10 flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
              <Clock className="size-3" aria-hidden />
              {fmtClock(item.at)}
            </span>
            <img
              src={h.animeImage ?? ""}
              alt=""
              className="h-16 w-11 shrink-0 rounded-lg object-cover"
            />
            <div className="min-w-0 flex-1">
              {/* Garis merah tipis di atas judul, penanda progres yang
                  sedang berjalan. */}
              <div className="mb-1 h-[3px] w-full overflow-hidden rounded-full bg-white/15">
                <div
                  className="h-full rounded-full bg-red-500"
                  style={{ width: `${dur > 0 ? pct : 0}%` }}
                />
              </div>
              <p className="truncate text-sm font-semibold">{h.animeTitle}</p>
              <p className="text-xs text-muted-foreground">
                Lanjutkan episode {h.episode} · Menit{" "}
                {dur > 0 ? `${posM}men/${durM}men` : "0/0"}
              </p>
            </div>
                <PlayCircle className="size-5 shrink-0 self-center text-primary" />
                {link}
              </button>
            );
          })}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Jam "HH.MM" dari timestamp — kapan terakhir menonton/membaca. */
function fmtClock(ts: number) {
  const d = new Date(ts || 0);
  return `${String(d.getHours()).padStart(2, "0")}.${String(
    d.getMinutes(),
  ).padStart(2, "0")}`;
}

/** Menit yang sudah ditonton, selalu dua digit: "Menit 07/24". */
function fmtMinutes(sec: number, pad = true) {
  const m = Math.floor(Math.max(0, Math.round(sec)) / 60);
  const v = String(m);
  return pad ? v.padStart(2, "0") : v;
}

/** Format durasi episode ke \"Mmen\" / \"Hmen\" (gaya Informasi: Lanjut 7men). */
function fmtMinutesShort(sec: number) {
  const m = Math.max(0, Math.round(sec)) / 60;
  const h = Math.floor(m / 60);
  const r = m % 60;
  const v = h > 0 ? `${h}jam ${r}men` : `${r}men`;
  return v;
}
