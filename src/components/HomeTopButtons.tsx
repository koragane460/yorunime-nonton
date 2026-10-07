import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { useHideNavOnMount, useHideNavWhile } from "@/components/AppLayout";
import {
  deleteEpisode,
  fetchWithProgress,
  fmtBytes,
  getEpisode,
  listKeys,
  MAX_BYTES,
  putEpisode,
} from "@/lib/offline-store";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Flame,
  HardDriveDownload,
  Loader2,
  PlayCircle,
  RotateCw,
  Save,
  Sparkles,
  Trash2,
  Tv,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/* ====================================================================== *
 *  Tiga tombol atas Home: Download — Paling sering — Untuk kamu.
 *  Semua ikon-only (tanpa teks) supaya tidak memenuhi baris, dengan
 *  label yang tetap terbaca lewat aria-label / tooltip.
 * ====================================================================== */

export type TopPanel =
  | "downloads"
  | "most"
  | "foryou"
  | "favorites"
  | "continue"
  | null;

/**
 * Minimal judul berbeda yang harus sudah ditonton sebelum "Paling sering"
 * ditampilkan. Tanpa ambang ini, buka dengan riwayat kosong hanya berisi
 * layar kosong — lebih baik belum muncul sama sekali.
 */
export const MOST_MIN_TITLES = 20;

/* ------------------------------------------------------------- shell ---- */

function PanelShell({
  title,
  subtitle,
  onClose,
  children,
  footer,
  inline,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** true = isi tampil di tempat (tab), bukan layar fullscreen. */
  inline?: boolean;
}) {
  // Mode tab: panel ini bukan layar penuh, jadi cukupopan biasa dan
  // navigasi bawah tetap terlihat.
  if (inline) return <div className="pb-24">{children}</div>;
  return (
    <div className="screen-enter fixed inset-0 z-[80] flex flex-col bg-background">
      <header className="flex items-center gap-3 border-b border-border px-3 py-3">
        <button
          onClick={onClose}
          aria-label="Kembali"
          className="flex size-9 items-center justify-center rounded-full border border-border"
        >
          <ChevronLeft className="size-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-bold tracking-tight">{title}</h1>
          {subtitle && (
            <p className="truncate text-[11px] text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {footer}
      </header>
      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {children}
      </div>
    </div>
  );
}

/* ====================================================== DOWNLOAD ====== */

type DlRow = {
  _id: string;
  animeId: string;
  animeTitle: string;
  animeImage?: string;
  episode: number;
  quality: string;
  url: string;
  bytes?: number;
  status: "queued" | "downloading" | "done" | "failed";
  progress?: number;
  localKey?: string;
  error?: string;
};

/**
 * Penarik file unduhan: fetch video -> simpan blob ke IndexedDB -> laporkan
 * status ke Convex.
 *
 * Dipakai dua tempat: panel Download (tombol "unduh ulang") dan worker global
 * yang otomatis menjalankan antrean. Keduanya memakai instance yang sama
 * supaya satu file tidak pernah ditarik dua kali.
 */
function useEpisodeDownloader(onStored?: (localKey: string) => void) {
  const setProgress = useMutation(api.downloads.updateProgress);
  const runningRef = useRef<Set<string>>(new Set());
  const download = useCallback(
    async (row: DlRow) => {
      // Efek (worker otomatis) dan tombol manual bisa memanggil ini bersamaan
      // untuk baris yang sama, jadi dikunci per file.
      if (runningRef.current.has(row._id)) return;
      runningRef.current.add(row._id);
      const localKey = `${row.animeId}__ep${row.episode}__${row.quality}`;
      try {
        await setProgress({ id: row._id as never, status: "downloading", progress: 0 });
        const blob = await fetchWithProgress(row.url, (pct, received, total) => {
          if (total > MAX_BYTES) {
            throw new Error("Ukuran file melebihi batas penyimpanan offline");
          }
          void setProgress({
            id: row._id as never,
            progress: Math.round(pct * 100),
            bytes: received,
          });
        });
        await putEpisode(localKey, blob);
        await setProgress({
          id: row._id as never,
          status: "done",
          progress: 100,
          bytes: blob.size,
          localKey,
        });
        onStored?.(localKey);
        toast.success(`Episode ${row.episode} tersimpan untuk offline`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Gagal mengunduh";
        await setProgress({ id: row._id as never, status: "failed", error: msg });
        toast.error(msg);
      } finally {
        runningRef.current.delete(row._id);
      }
    },
    [setProgress, onStored],
  );
  return { download, runningRef };
}

/**
 * Worker unduhan yang selalu hidup di seluruh aplikasi (tidak hanya saat layar
 * Download dibuka).
 *
 * Tanpa ini, memilih resolusi di popup Unduh hanya membuat baris "queued" di
 * server dan tidak ada yang menarik filenya sampai user membuka daftar dan
 * menekan tombolnya. Padahal janjinya "episode langsung masuk daftar dan
 * unduhannya mulai berjalan". Worker ini yang menjalankan janjinya, satu file
 * pada satu waktu.
 */
export function DownloadWorker() {
  const { user } = useAuth();
  const rows = useQuery(api.downloads.myDownloads, user ? {} : "skip");
  const { download, runningRef } = useEpisodeDownloader();
  const items = (rows ?? []) as DlRow[];

  const nextQueued = useMemo(
    () =>
      items.find(
        (r) => r.status === "queued" && !runningRef.current.has(r._id),
      ),
    [items],
  );
  useEffect(() => {
    if (!nextQueued) return;
    void download(nextQueued);
  }, [nextQueued, download]);

  return null;
}

export function DownloadsPanel({
  onClose,
  inline,
}: {
  onClose: () => void;
  /** true = tampil di tempat sebagai tab, bukan layar fullscreen. */
  inline?: boolean;
}) {
  useHideNavWhile(!inline);
  const navigate = useNavigate();
  const { user } = useAuth();
  const rows = useQuery(api.downloads.myDownloads, user ? {} : "skip");
  const stats = useQuery(api.downloads.downloadStats, user ? {} : "skip");
  const setProgress = useMutation(api.downloads.updateProgress);
  const removeRow = useMutation(api.downloads.remove);
  const clearAll = useMutation(api.downloads.clearAll);

  // Kunci blob yang benar-benar ada di IndexedDB perangkat ini.
  const [stored, setStored] = useState<Set<string>>(new Set());
  useEffect(() => {
    void listKeys().then((k) => setStored(new Set(k)));
  }, [rows]);

  const items = (rows ?? []) as DlRow[];
  const active = items.filter(
    (r) => r.status === "downloading" || r.status === "queued",
  );
  const done = items.filter((r) => r.status === "done");
  const failed = items.filter((r) => r.status === "failed");

  // Penarik file dipakai baris "Sedang berjalan" dan "Gagal" untuk dicoba
  // ulang. Antrean yang masih "queued" tidak menunggu tombol: worker global
  // (<DownloadWorker />) yang menjalankannya begitu dibuat.
  const { download } = useEpisodeDownloader((localKey) =>
    setStored((prev) => new Set(prev).add(localKey)),
  );

  /** Putar versi offline: buat object URL dari blob, buka di tab baru. */
  const playOffline = useCallback(
    async (row: DlRow) => {
      if (!row.localKey) return;
      const blob = await getEpisode(row.localKey);
      if (!blob) {
        toast.error("File offline tidak ditemukan di perangkat ini");
        return;
      }
      const url = URL.createObjectURL(blob);
      const w = window.open(url, "_blank");
      if (!w) {
        // Popup diblokir → tetap putar di halaman ini lewat elemen video.
        const v = document.createElement("video");
        v.src = url;
        v.controls = true;
        v.autoplay = true;
        v.style.cssText =
          "position:fixed;inset:0;width:100%;height:100%;background:#000;z-index:99999";
        document.body.appendChild(v);
      }
    },
    [],
  );

  /** Simpan file ke penyimpanan perangkat (unduh ulang lewat browser). */
  const saveToDevice = useCallback(async (row: DlRow) => {
    if (!row.localKey) return;
    const blob = await getEpisode(row.localKey);
    if (!blob) {
      toast.error("File offline tidak ditemukan");
      return;
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${row.animeTitle} - Episode ${row.episode} (${row.quality}).mp4`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast.success("Menyimpan ke perangkat…");
  }, []);

  const removeOne = useCallback(
    async (row: DlRow) => {
      if (row.localKey) await deleteEpisode(row.localKey);
      await removeRow({ id: row._id as never });
      const keys = await listKeys();
      setStored(new Set(keys));
      toast.success("Unduhan dihapus");
    },
    [removeRow],
  );

  if (items.length === 0) {
    return (
      <PanelShell
        title="Download"
        subtitle="Episode yang tersimpan di perangkat ini"
        onClose={onClose}
      inline={inline}
      >
        <EmptyState
          icon={<Download className="size-6" />}
          title="Belum ada episode diunduh"
          body="Tekan tombol Download di halaman nonton. File-nya tersimpan di perangkatmu dan bisa ditonton tanpa internet."
        />
      </PanelShell>
    );
  }

  return (
    <PanelShell
      title="Download"
      subtitle={
        stats
          ? `${stats.done} selesai · ${fmtBytes(stats.bytes)} terpakai di perangkat`
          : "Episode yang tersimpan di perangkat ini"
      }
      onClose={onClose}
      inline={inline}
      footer={
        <button
          onClick={() => {
            if (!items.length) return;
            void clearAll({}).then(async () => {
              for (const k of await listKeys()) await deleteEpisode(k);
              setStored(new Set());
              toast.success("Semua unduhan dihapus");
            });
          }}
          className="flex size-9 items-center justify-center rounded-full border border-border text-muted-foreground"
          aria-label="Hapus semua unduhan"
          title="Hapus semua"
        >
          <Trash2 className="size-4" />
        </button>
      }
    >
      {/* Ringkasan: file, status berjalan, gagal */}
      <div className="mb-4 grid grid-cols-3 gap-2">
        <StatTile label="File" value={String(items.length)} />
        <StatTile
          label="Selesai"
          value={String(items.filter((r) => r.status === "done").length)}
        />
        <StatTile
          label="Gagal"
          value={String(failed.length)}
          tone={failed.length ? "danger" : "default"}
        />
      </div>

      {active.length > 0 && (
        <Section label="Sedang berjalan" icon={<Loader2 className="size-3.5 animate-spin" />}>
          {active.map((r) => {
            // Macet = status "downloading" tapi tidak ada kabar 90 detik.
            const stuck =
              r.status === "downloading" &&
              Date.now() - (r.updatedAt ?? 0) > 90_000;
            return (
              <DownloadRow
                key={r._id}
                row={r}
                stuck={stuck}
                onResume={
                  stuck
                    ? () =>
                        void setProgress({
                          id: r._id as never,
                          status: "queued",
                          progress: 0,
                        })
                    : undefined
                }
                onDownload={() => void download(r)}
                onRemove={() => void removeOne(r)}
              />
            );
          })}
        </Section>
      )}

      {failed.length > 0 && (
        <Section label="Gagal" icon={<AlertCircle className="size-3.5" />}>
          {failed.map((r) => (
            <DownloadRow
              key={r._id}
              row={r}
              onDownload={() => void download(r)}
              onRemove={() => void removeOne(r)}
            />
          ))}
        </Section>
      )}

      {done.length > 0 && (
        <Section label="Tersedia offline" icon={<HardDriveDownload className="size-3.5" />}>
          {done.map((r) => (
            <DownloadRow
              key={r._id}
              row={r}
              offlineReady={stored.has(r.localKey ?? "")}
              onPlay={() => void playOffline(r)}
              onSave={() => void saveToDevice(r)}
              onWatch={() =>
                navigate(
                  `/nonton?anime=${encodeURIComponent(r.animeId)}&ep=${encodeURIComponent(`${r.animeId}__ep${r.episode}`)}&judul=${encodeURIComponent(r.animeTitle)}`,
                )
              }
              onRemove={() => void removeOne(r)}
            />
          ))}
        </Section>
      )}

      <p className="mt-6 text-center text-[11px] leading-relaxed text-muted-foreground">
        File video disimpan di penyimpanan browser perangkat ini, bukan di
        server YoruNime. Membersihkan data browser akan menghapusnya.
      </p>
    </PanelShell>
  );
}

function StatTile({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "danger";
}) {
  return (
    <div className="rounded-2xl border border-border bg-card/60 px-3 py-2.5">
      <p
        className={cn(
          "font-[family-name:var(--font-display)] text-xl leading-none",
          tone === "danger" ? "text-red-400" : "text-foreground",
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

function Section({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-5">
      <h2 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
        {icon}
        {label}
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function DownloadRow({
  row,
  offlineReady,
  onDownload,
  onResume,
  onPlay,
  onSave,
  onWatch,
  onRemove,
}: {
  row: DlRow;
  offlineReady?: boolean;
  onDownload?: () => void;
  /** Baris unduhan macet (tidak ada kabar 90 detik). */
  stuck?: boolean;
  /** Reset unduhan yang macet ke antrean — pekerja mengambilnya lagi. */
  onResume?: () => void;
  onPlay?: () => void;
  onSave?: () => void;
  onWatch?: () => void;
  onRemove: () => void;
}) {
  const busy = row.status === "downloading" || row.status === "queued";
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card/50">
      <div className="flex gap-3 p-2.5">
        <div className="relative h-16 w-11 shrink-0 overflow-hidden rounded-lg bg-black">
          {row.animeImage && (
            <img
              src={row.animeImage}
              alt=""
              className="h-full w-full object-cover"
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold leading-tight">
            {row.animeTitle}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Episode {row.episode} · {row.quality}
            {row.bytes ? ` · ${fmtBytes(row.bytes)}` : ""}
          </p>
          {busy && (
            <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-primary transition-[width]"
                style={{ width: `${row.progress ?? 0}%` }}
              />
            </div>
          )}
          {row.status === "failed" && row.error && (
            <p className="mt-1 text-[10px] text-red-400">{row.error}</p>
          )}
          {row.status === "done" && (
            <p
              className={cn(
                "mt-1 text-[10px] font-semibold",
                offlineReady ? "text-emerald-400" : "text-amber-400",
              )}
            >
              {offlineReady
                ? "Siap ditonton offline"
                : "Terdaftar — tekan Unduh untuk menyimpan ke perangkat"}
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 border-t border-border/70 px-2.5 py-2">
        {onResume && (
          <RowAction
            icon={<RotateCw className="size-3.5" />}
            label="Lanjutkan"
            onClick={onResume}
            primary
          />
        )}
        {row.status !== "done" && onDownload && (
          <RowAction
            icon={<Download className="size-3.5" />}
            label={row.status === "failed" ? "Coba lagi" : "Unduh"}
            onClick={onDownload}
            primary={row.status === "failed"}
          />
        )}
        {row.status === "done" && onPlay && (
          <RowAction
            icon={<PlayCircle className="size-3.5" />}
            label="Putar offline"
            onClick={onPlay}
            primary={offlineReady}
            disabled={!offlineReady}
          />
        )}
        {row.status === "done" && onSave && (
          <RowAction
            icon={<Save className="size-3.5" />}
            label="Simpan ke perangkat"
            onClick={onSave}
            disabled={!offlineReady}
          />
        )}
        {row.status === "done" && onWatch && (
          <RowAction
            icon={<Tv className="size-3.5" />}
            label="Lanjut tonton"
            onClick={onWatch}
          />
        )}
        <RowAction
          icon={<Trash2 className="size-3.5" />}
          label="Hapus"
          onClick={onRemove}
        />
      </div>
    </div>
  );
}

function RowAction({
  icon,
  label,
  onClick,
  primary,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-semibold transition disabled:opacity-40",
        primary
          ? "bg-primary text-white hover:brightness-110"
          : "border border-border text-muted-foreground hover:border-primary/50 hover:text-foreground",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

/* ================================================== PALING SERING ====== */

type MostRow = {
  animeId: string;
  animeTitle: string;
  animeImage?: string;
  minutesWatched: number;
  episodes: number;
  lastEpisode: number;
};

export function MostWatchedPanel({
  onClose,
  inline,
}: {
  onClose: () => void;
  /** true = tampil di tempat sebagai tab, bukan layar fullscreen. */
  inline?: boolean;
}) {
  useHideNavWhile(!inline);
  const navigate = useNavigate();
  const { user } = useAuth();
  const rows = useQuery(api.activities.mostWatched, user ? { limit: 20 } : "skip");
  const taste = useQuery(api.activities.genreTaste, user ? {} : "skip");

  const items = (rows ?? []) as MostRow[];
  const topGenre = taste?.genres?.[0]?.name;
  const totalMinutes = items.reduce((a, b) => a + (b.minutesWatched ?? 0), 0);
  const maxMinutes = Math.max(1, ...items.map((i) => i.minutesWatched ?? 0));
  // Riwayat belum cukup → tetap buka layar ini dengan pesan, bukan layar
  // kosong. Tombol tabnya sengaja tidak pernah dimatikan supaya semua tab
  // di layar Koleksi selalu berfungsi saat dipencet.
  if (items.length < MOST_MIN_TITLES) {
    return (
      <PanelShell
        title="Paling sering"
        subtitle="Statistik tontonan kamu"
        onClose={onClose}
        inline={inline}
      >
        <EmptyState
          icon={<Flame className="size-6" />}
          title="Belum cukup riwayat tontonan"
          body={`Tonton dulu minimal ${MOST_MIN_TITLES} judul berbeda. Setelah itu statistik genre, menit, dan judul paling sering kamu tonton akan muncul di sini.`}
        />
      </PanelShell>
    );
  }

  const go = (r: MostRow) =>
    navigate(
      `/nonton?anime=${encodeURIComponent(r.animeId)}&ep=${encodeURIComponent(`${r.animeId}__ep${r.lastEpisode}`)}&judul=${encodeURIComponent(r.animeTitle)}`,
    );

  return (
    <PanelShell
      title="Paling sering"
      subtitle={
        items.length
          ? `${items.length} judul · ${totalMinutes} menit ditonton`
          : "Statistik tontonan kamu"
      }
      onClose={onClose}
      inline={inline}
    >
      {items.length === 0 ? (
        <EmptyState
          icon={<Flame className="size-6" />}
          title="Belum ada riwayat tontonan"
          body="Mulai nonton anime apa pun, lalu layar ini akan menunjukkan anime yang paling sering kamu tonton beserta genre favoritmu."
        />
      ) : (
        <>
          {/* Genre paling sering — kotak solid abu-abu, bukan gradien transparan. */}
          <div className="mb-5 rounded-3xl border border-border bg-secondary/40 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
              Genre paling sering
            </p>
            {topGenre ? (
              <>
                <p className="mt-1.5 font-[family-name:var(--font-display)] text-3xl font-black leading-none">
                  {topGenre}
                </p>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Dari {taste?.sampledCount ?? 0} anime yang kamu tonton
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(taste?.genres ?? []).slice(1, 6).map((g) => (
                    <span
                      key={g.name}
                      className="rounded-full border border-border bg-secondary/60 px-2.5 py-1 text-[10px] font-semibold"
                    >
                      {g.name}
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <p className="mt-1.5 text-xs text-muted-foreground">
                Genre belum bisa dihitung — buka detail anime beberapa kali
                supaya genrenya tersimpan.
              </p>
            )}
          </div>

          {/* Peringkat: lebar bar sebanding dengan total menit. */}
          <div className="space-y-2">
            {items.map((r, i) => (
              <button
                key={r.animeId}
                onClick={() => go(r)}
                className="group flex w-full items-center gap-3 rounded-2xl border border-border bg-card/50 p-2.5 text-left transition hover:border-primary/50"
              >
                <span
                  className={cn(
                    "w-6 shrink-0 text-center font-[family-name:var(--font-display)] text-lg font-black",
                    i === 0
                      ? "text-primary"
                      : i < 3
                        ? "text-foreground/70"
                        : "text-muted-foreground",
                  )}
                >
                  {i + 1}
                </span>
                <div className="relative h-16 w-11 shrink-0 overflow-hidden rounded-lg bg-black">
                  {r.animeImage && (
                    <img
                      src={r.animeImage}
                      alt=""
                      className="h-full w-full object-cover transition group-hover:scale-105"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold leading-tight">
                    {r.animeTitle}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Clock className="size-3" />
                    {r.minutesWatched} menit · {r.episodes} episode · sampai Ep{" "}
                    {r.lastEpisode}
                  </p>
                  <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/15">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{
                        width: `${Math.round(((r.minutesWatched ?? 0) / maxMinutes) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </button>
            ))}
          </div>
        </>
      )}
    </PanelShell>
  );
}

/* ==================================================== UNTUK KAMU ====== */

type RecoCard = {
  id: string;
  title: string;
  image: string;
  score?: number;
  status?: string;
  synopsis?: string;
};

export function ForYouPanel({
  onClose,
  inline,
}: {
  onClose: () => void;
  /** true = tampil di tempat sebagai tab, bukan layar fullscreen. */
  inline?: boolean;
}) {
  useHideNavWhile(!inline);
  const { user } = useAuth();
  const taste = useQuery(api.activities.genreTaste, user ? {} : "skip");
  const history = useQuery(api.activities.mostWatched, user ? { limit: 30 } : "skip");
  const recommend = useAction(api.anime.animeRecommended);

  

  // Rekomendasi dihitung ulang kalau genre user berubah. `exclude`
  // diisi dari riwayat supaya anime yang sudah ditonton tidak muncul lagi.
  const genres = useMemo(
    () => (taste?.genres ?? []).map((g: { name: string }) => g.name),
    [taste],
  );
  const exclude = useMemo(
    () => (history ?? []).map((h: { animeId: string }) => h.animeId),
    [history],
  );
  const genresKey = genres.join("|");
  const excludeKey = exclude.join("|");
  const reqKey = `${genresKey}##${excludeKey}`;

  // Status muat diturunkan dari kunci permintaan, bukan di-set di dalam effect
  // (setState sinkron di effect memicu render berantai). `settledKey` diisi
  // setelah permintaan selesai; selama kunci berbeda, layar menampilkan
  // skeleton.
  const [settled, setSettled] = useState<{
    key: string;
    list: RecoCard[];
  } | null>(null);

  useEffect(() => {
    let alive = true;
    recommend({ genres, exclude })
      .then((r: RecoCard[]) => alive && setSettled({ key: reqKey, list: r ?? [] }))
      .catch(() => alive && setSettled({ key: reqKey, list: [] }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genresKey, excludeKey]);

  const loading = !settled || settled.key !== reqKey;
  const grid = loading ? [] : (settled?.list ?? []);

  return (
    <PanelShell
      title="Untuk kamu"
      subtitle={
        genres.length
          ? `Disusun dari ${genres.slice(0, 3).join(", ")}`
          : "Makin banyak kamu nonton, makin tepat sarannya"
      }
      onClose={onClose}
      inline={inline}
    >
      {loading ? (
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i}>
              <div className="skeleton aspect-[2/3] w-full rounded-xl" />
              <div className="skeleton mt-1.5 h-3 w-full rounded" />
            </div>
          ))}
        </div>
      ) : grid.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="size-6" />}
          title="Belum ada saran"
          body="Tonton beberapa anime dulu supaya YoruNime tahu seleramu."
        />
      ) : (
        <>
          {/* Dua judul utama dibuat besar — memberi rasa "pilihan editor",
              bukan sekadar grid generic. */}
          <div className="mb-5 grid grid-cols-2 gap-3">
            {grid.slice(0, 2).map((c, i) => (
              <HeroPick key={c.id} card={c} rank={i} onClose={onClose} />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5">
            {grid.slice(2).map((c) => (
              <MiniPick key={c.id} card={c} onClose={onClose} />
            ))}
          </div>
        </>
      )}
      <p className="mt-6 text-center text-[11px] leading-relaxed text-muted-foreground">
        Saran disusun dari anime yang paling sering kamu tonton dan yang kamu
        favoritkan — bukan dari daftar umum.
      </p>
    </PanelShell>
  );
}

function HeroPick({
  card,
  rank,
  onClose,
}: {
  card: RecoCard;
  rank: number;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => {
        // Kartu rekomendasi membuka DETAIL anime, bukan langsung memutar
        // episode: user baru memutuskan mau nonton apa dari sana.
        navigate(`/home?pilih=${encodeURIComponent(card.id)}`);
        onClose();
      }}
      className="group relative aspect-[3/4] overflow-hidden rounded-3xl border border-border text-left"
    >
      <img
        src={card.image}
        alt=""
        className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent" />
      <span className="absolute left-2.5 top-2.5 flex size-6 items-center justify-center rounded-full bg-primary text-[11px] font-black text-white">
        {rank + 1}
      </span>
      <div className="absolute inset-x-0 bottom-0 p-2.5">
        <p className="line-clamp-2 text-[12px] font-bold leading-tight text-white">
          {card.title}
        </p>
        {card.score ? (
          <p className="mt-0.5 text-[10px] font-semibold text-amber-300">
            ★ {card.score.toFixed(1)}
          </p>
        ) : null}
      </div>
    </button>
  );
}

function MiniPick({ card, onClose }: { card: RecoCard; onClose: () => void }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => {
        navigate(`/home?pilih=${encodeURIComponent(card.id)}`);
        onClose();
      }}
      className="group text-left"
    >
      <div className="relative overflow-hidden rounded-xl border border-border/60">
        <img
          src={card.image}
          alt=""
          className="aspect-[2/3] w-full object-cover transition duration-300 group-hover:scale-105"
        />
        {card.status && /releasing|airing/i.test(card.status) && (
          <span className="absolute left-1 top-1 rounded bg-red-500 px-1.5 py-0.5 text-[8px] font-black uppercase text-white">
            Rilis
          </span>
        )}
      </div>
      <p className="mt-1 line-clamp-2 min-h-8 text-[11px] font-medium leading-4">
        {card.title}
      </p>
    </button>
  );
}

/* ========================================================= FAVORIT ===== */

/* ================================================ LANJUTKAN NONTON ===== */

type ContRow = {
  _id: string;
  animeId: string;
  animeTitle: string;
  animeImage?: string;
  episode: number;
  minutesWatched: number;
  progressSec: number;
  durationSec?: number;
  updatedAt: number;
};

/** Judul yang masih setengah ditonton — tombol "Lanjutkan nonton" di nav. */
export function ContinuePanel({ onClose }: { onClose: () => void }) {
  useHideNavOnMount();
  const navigate = useNavigate();
  const { user } = useAuth();
  const rows = useQuery(api.activities.continueWatching, user ? {} : "skip");
  const stats = useQuery(api.downloads.downloadStats, "skip");
  const [showDownloads, setShowDownloads] = useState(false);
  const items = ((rows ?? []) as unknown as ContRow[])
    .slice()
    .sort((a, b) => b.updatedAt - a.updatedAt);

  // Download tidak lagi jadi tombol navigasi sendiri supaya baris nav tidak
  // terlalu padat; ia dijangkau lewat tombol di header layar ini.
  if (showDownloads) {
    return (
      <DownloadsPanel
        onClose={() => (items.length ? setShowDownloads(false) : onClose())}
      />
    );
  }

  return (
    <PanelShell
      title="Lanjutkan nonton"
      subtitle={
        items.length
          ? `${items.length} judul belum selesai`
          : "Anime & donghua yang kamu tinggalkan"
      }
      onClose={onClose}
      footer={
        <button
          onClick={() => setShowDownloads(true)}
          aria-label="Download"
          title="Download"
          className="relative flex size-9 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:border-primary/60 hover:text-primary"
        >
          <Download className="size-4" />
          {stats && stats.done > 0 && (
            <span className="absolute -right-1 -top-1 flex min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-4 text-white">
              {stats.done > 99 ? "99+" : stats.done}
            </span>
          )}
        </button>
      }
    >
      {items.length === 0 ? (
        <EmptyState
          icon={<PlayCircle className="size-6" />}
          title="Tidak ada yang lagi jalan"
          body="Mulai nonton apa pun, lalu judulnya akan muncul di sini lengkap dengan posisi tontonan terakhir."
        />
      ) : (
        <div className="space-y-2">
          {items.map((c) => {
            const pct =
              c.durationSec && c.durationSec > 0
                ? Math.min(100, Math.round((c.progressSec / c.durationSec) * 100))
                : 0;
            return (
              <button
                key={c._id}
                onClick={() =>
                  navigate(
                    `/nonton?anime=${encodeURIComponent(c.animeId)}&ep=${encodeURIComponent(`${c.animeId}__ep${c.episode}`)}&judul=${encodeURIComponent(c.animeTitle)}`,
                  )
                }
                className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card/50 p-2.5 text-left transition hover:border-primary/50"
              >
                <div className="relative h-16 w-11 shrink-0 overflow-hidden rounded-lg bg-black">
                  {c.animeImage && (
                    <img
                      src={c.animeImage}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  )}
                  <span className="absolute inset-0 flex items-center justify-center bg-black/35">
                    <PlayCircle className="size-6 text-white/90" />
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold leading-tight">
                    {c.animeTitle}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Episode {c.episode}
                    {pct > 0 ? ` · ${pct}% selesai` : ""}
                  </p>
                  <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/15">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </button>
            );
          })}
        </div>
      )}
    </PanelShell>
  );
}

function EmptyState({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground">
        {icon}
      </span>
      <p className="text-sm font-bold">{title}</p>
      <p className="max-w-xs text-[11px] leading-relaxed text-muted-foreground">
        {body}
      </p>
    </div>
  );
}