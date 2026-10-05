// Layar "Musik": aplikasi setel lagu penuh dengan dua tampilan, yaitu
// Pustaka (pencarian + baris katalog) dan Pemutar (sedang diputar + antrean).
// Masuk lewat kode rahasia di kolom pencarian Home.

import { useEffect, useMemo, useRef, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  ChevronLeft,
  Disc3,
  Heart,
  ListMusic,
  Loader2,
  Mic2,
  Music2,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Search,
  Shuffle,
  SkipBack,
  SkipForward,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtTime, useMusicPlayer } from "@/components/MusicPlayer";
import { cached, putCache, clearMusicCache } from "@/lib/musicCache";
import { useHideNavOnMount } from "@/components/AppLayout";
import type { MusicTrack } from "@/convex/music";

/**
 * Daftar baris cadangan. Sumber aslinya ada di backend (`musicSections`)
 * supaya label dan urutan tidak dobel; daftar ini cuma dipakai kalau
 * permintaan itu gagal.
 */
const FALLBACK_SECTIONS: { id: string; label: string }[] = [
  { id: "anime", label: "Anime & OST" },
  { id: "ost", label: "Opening & Ending" },
  { id: "ostpenuh", label: "OST Penuh" },
  { id: "full", label: "Trek Penuh" },
  { id: "jpop", label: "J-Pop & K-Pop" },
  { id: "indo", label: "Lagu Indonesia" },
  { id: "dangdut", label: "Dangdut" },
  { id: "lofi", label: "Lofi & Chill" },
];

export default function MusicScreen({ onClose }: { onClose: () => void }) {
  useHideNavOnMount();
  const player = useMusicPlayer();
  const searchMusic = useAction(api.music.musicSearch);
  const loadSection = useAction(api.music.musicSection);
  const loadSections = useAction(api.music.musicSections);
  // Lagu yang disukai. Query ini privat: backend hanya membaca milik user
  // yang sedang masuk dan tidak menerima userId dari luar.
  const likedRows = useQuery(api.activities.myMusicLikes, {});

  const [view, setView] = useState<"lib" | "player">("lib");
  // Lirik ditampilkan/tutup dari header layar Pemutar. State-nya di sini
  // (bukan di PlayerView) karena tombolnya ada di header.
  const [showLyrics, setShowLyrics] = useState(false);
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [found, setFound] = useState<MusicTrack[] | null>(null);
  const [rows, setRows] = useState<Record<string, MusicTrack[]>>({});
  const [rowsLoading, setRowsLoading] = useState(true);
  // Naikkan tiap kali user menekan "Coba lagi" — memicu efek pemuatan ulang.
  const [reloadTick, setReloadTick] = useState(0);
  const [sectionRows, setSectionRows] =
    useState<{ id: string; label: string }[]>(FALLBACK_SECTIONS);

  // Bar mini musik disembunyikan selama layar ini terbuka, dan tombolnya
  // diarahkan kembali ke tampilan Pemutar.
  useEffect(() => {
    player.setScreenOpen(true);
    player.onOpenScreen(() => setView("player"));
    return () => {
      player.setScreenOpen(false);
      player.onOpenScreen(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Baris katalog dimuat sekali saat layar dibuka supaya tidak kosong.
  useEffect(() => {
    let alive = true;
    // Daftar baris diambil dari backend supaya hanya ada satu sumber
    // kebenaran; kalau gagal, pakai daftar cadangan di atas.
    void loadSections({})
      .then((r) => {
        if (!alive) return;
        const list = ((r ?? []) as { id: string; label: string }[]).filter(
          (s) => s?.id,
        );
        if (list.length > 0) setSectionRows(list);
      })
      .catch(() => {});
    const jobs = sectionRows.map(async (s, i) => {
      // Cache di memori: layar Musik sering dibuka-tutup, dan katalog itu
      // praktis statis. Tanpa cache, 8 baris diambil ulang setiap kali layar
      // dibuka sehingga selalu terlihat "Memuat katalog...".
      const key = `sec:${s.id}`;
      const hit = cached<MusicTrack[]>(key);
      if (hit && hit.length > 0) return [s.id, hit] as const;
      // Jeda kecil antar baris supaya tidak menembak iTunes 8x serentak —
      // permintaan paralel penuh sering kena rate limit dan hasilnya kosong
      // semua, itulah dulu kenapa layar awal tampak melompong.
      await new Promise((r) => setTimeout(r, i * 120));
      try {
        const r = (await loadSection({ section: s.id, limit: 12 })) as {
          tracks: MusicTrack[];
        };
        const tracks = r.tracks ?? [];
        // PENTING: jangan cache hasil kosong. Kalau iTunes sempat gagal,
        // layar akan melompong 10 menit penuh; tanpa cache, buka berikutnya
        // langsung mencoba lagi.
        if (tracks.length > 0) putCache(key, tracks);
        return [s.id, tracks] as const;
      } catch {
        return [s.id, [] as MusicTrack[]] as const;
      }
    });
    Promise.all(jobs).then((pairs) => {
      if (!alive) return;
      setRows(Object.fromEntries(pairs));
      setRowsLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [sectionRows, loadSection, reloadTick]);

  // Tarik ulang seluruh katalog (tombol "Coba lagi" saat katalog kosong).
  const reloadRows = () => {
    clearMusicCache();
    setRows({});
    setRowsLoading(true);
    setReloadTick((t) => t + 1);
  };

  const doSearch = async () => {
    const term = q.trim();
    if (term.length < 2) {
      setFound(null);
      return;
    }
    setSearching(true);
    try {
      const r = (await searchMusic({ q: term, limit: 24 })) as MusicTrack[];
      setFound((r ?? []).filter((t) => t?.audioUrl));
    } catch {
      setFound([]);
    }
    setSearching(false);
  };

  const start = (tracks: MusicTrack[], i: number) => {
    player.playTracks(tracks, i);
    setView("player");
  };

  const searchList = found ?? [];
  const shown = found !== null;

  return (
    <div className="screen-enter fixed inset-0 z-[95] flex flex-col bg-[#08060d] text-white">
      {/* Latar: warna diambil dari sampul lagu yang sedang diputar. */}
      <div
        className="pointer-events-none absolute inset-0 opacity-70 transition-colors duration-700"
        style={{
          background: player.track?.cover
            ? `radial-gradient(120% 70% at 50% 0%, ${tintOf(player.track.cover)}, transparent 65%), #08060d`
            : "radial-gradient(120% 70% at 50% 0%, #2a1338, #08060d 65%)",
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-black/45" />

      <header className="relative z-10 flex shrink-0 items-center gap-2 px-3 py-3">
        <button
          onClick={onClose}
          aria-label="Tutup musik"
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20"
        >
          <ChevronLeft className="size-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">Musik</p>
          <p className="truncate text-[10px] text-white/55">
            {view === "player" ? "Sedang diputar" : "Pustaka lagu"}
          </p>
        </div>
        {view === "player" && (
          <>
            <button
              onClick={() => setShowLyrics((v) => !v)}
              aria-label={showLyrics ? "Sembunyikan lirik" : "Lihat lirik"}
              aria-pressed={showLyrics}
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-full transition",
                showLyrics
                  ? "bg-[oklch(0.86_0.16_90)] text-black"
                  : "bg-white/10 hover:bg-white/20",
              )}
            >
              <Mic2 className="size-4" />
            </button>
            <button
              onClick={() => setView("lib")}
              aria-label="Ke pustaka"
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20"
            >
              <ListMusic className="size-4" />
            </button>
          </>
        )}
      </header>

      {view === "lib" ? (
        <LibraryView
          q={q}
          setQ={setQ}
          searching={searching}
          onSearch={doSearch}
          onPick={start}
          shown={shown}
          list={searchList}
          rows={rows}
          sectionRows={sectionRows}
          rowsLoading={rowsLoading}
          rowsEmpty={Object.values(rows).every((r) => r.length === 0)}
          onRetry={reloadRows}
          likedRows={(likedRows ?? []) as LikedRow[]}
          queue={player.queue}
          activeIndex={player.index}
          onPlayQueue={player.playAt}
          onOpenPlayer={() => setView("player")}
          hasTrack={!!player.track}
        />
      ) : (
        <PlayerView
          onBack={() => setView("lib")}
          showLyrics={showLyrics}
          setShowLyrics={setShowLyrics}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------ pustaka ----

function LibraryView({
  q, setQ, searching, onSearch, onPick, shown, list, rows, sectionRows,
  rowsLoading, rowsEmpty, onRetry, likedRows, queue, activeIndex, onPlayQueue, onOpenPlayer,
  hasTrack,
}: {
  q: string;
  setQ: (v: string) => void;
  searching: boolean;
  onSearch: () => void;
  onPick: (tracks: MusicTrack[], i: number) => void;
  shown: boolean;
  list: MusicTrack[];
  rows: Record<string, MusicTrack[]>;
  sectionRows: { id: string; label: string }[];
  rowsLoading: boolean;
  rowsEmpty: boolean;
  onRetry: () => void;
  likedRows: LikedRow[];
  queue: MusicTrack[];
  activeIndex: number;
  onPlayQueue: (i: number) => void;
  onOpenPlayer: () => void;
  hasTrack: boolean;
}) {
  return (
    <div className="thin-scroll relative z-10 min-h-0 flex-1 overflow-y-auto px-4 pb-6">
      {/* Pencarian */}
      <div className="flex items-center gap-2 rounded-2xl bg-white/10 px-3 py-2.5 ring-1 ring-white/15">
        <Search className="size-4 shrink-0 text-white/60" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSearch()}
          placeholder="Cari lagu atau artis…"
          className="w-full bg-transparent text-sm outline-none placeholder:text-white/45"
        />
        {q && (
          <button onClick={() => setQ("")} aria-label="Bersihkan">
            <X className="size-4 text-white/60" />
          </button>
        )}
        <button
          onClick={onSearch}
          disabled={searching}
          className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-bold text-black disabled:opacity-60"
        >
          {searching ? <Loader2 className="size-3 animate-spin" /> : "Cari"}
        </button>
      </div>

      {shown ? (
        <section className="mt-5">
          <h2 className="mb-2 text-sm font-bold">
            {list.length} hasil untuk "{q.trim()}"
          </h2>
          {list.length === 0 ? (
            <p className="py-10 text-center text-xs text-white/50">
              Tidak ada lagu yang cocok.
            </p>
          ) : (
            <div className="flex flex-col">
              {list.map((t, i) => (
                <TrackRow
                  key={t.id}
                  track={t}
                  active={false}
                  onPlay={() => onPick(list, i)}
                />
              ))}
            </div>
          )}
        </section>
      ) : (
        <>
          {hasTrack && queue.length > 0 && (
            <section className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-bold">Antrean</h2>
                <button
                  onClick={onOpenPlayer}
                  className="text-[11px] font-semibold text-white/70 underline"
                >
                  Buka pemutar
                </button>
              </div>
              <div className="flex flex-col">
                {queue.map((t, i) => (
                  <TrackRow
                    key={`q_${t.id}_${i}`}
                    track={t}
                    active={i === activeIndex}
                    onPlay={() => onPlayQueue(i)}
                  />
                ))}
              </div>
            </section>
          )}

          {rowsLoading ? (
            <div className="space-y-5">
              {/* Skeleton: layar tidak pernah terlihat melompong saat katalog
                  sedang ditarik dari backend. */}
              <div className="grid grid-cols-2 gap-3">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="aspect-square animate-pulse rounded-2xl bg-white/8"
                  />
                ))}
              </div>
              {[0, 1].map((i) => (
                <div key={i} className="space-y-2">
                  <div className="h-4 w-28 animate-pulse rounded-full bg-white/8" />
                  {[0, 1].map((j) => (
                    <div
                      key={j}
                      className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2"
                    >
                      <div className="size-11 shrink-0 animate-pulse rounded-lg bg-white/10" />
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="h-3 w-3/5 animate-pulse rounded-full bg-white/10" />
                        <div className="h-2.5 w-2/5 animate-pulse rounded-full bg-white/8" />
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : rowsEmpty ? (
            <div className="py-12 text-center">
              <p className="text-sm font-semibold text-white/70">
                Katalog belum termuat
              </p>
              <p className="mx-auto mt-1 max-w-xs text-[11px] text-white/45">
                Sumber lagu sedang tidak merespons. Coba tarik ulang.
              </p>
              <button
                onClick={onRetry}
                className="mt-4 rounded-full bg-white px-5 py-2 text-xs font-bold text-black"
              >
                Coba lagi
              </button>
            </div>
          ) : (
            <>
            {/* Daftar lagu yang disukai - privat, hanya bisa dilihat pemilik
                akunnya (query di backend sengaja tidak menerima userId). */}
            {likedRows.length > 0 && (
              <section className="mt-6">
                <h2 className="mb-2.5 flex items-center gap-1.5 text-sm font-bold">
                  <Heart className="size-4 fill-current text-[oklch(0.86_0.16_90)]" />{" "}
                  Disukai
                  <span className="text-[11px] font-medium text-white/45">
                    ({likedRows.length} - privat)
                  </span>
                </h2>
                <div className="flex flex-col">
                  {likedRows.map((lt, i) => (
                    <TrackRow
                      key={`lk_${lt.key}_${i}`}
                      track={toTrack(lt)}
                      active={false}
                      onPlay={() => onPick(likedRows.map(toTrack), i)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Layar utama ala Spotify/Metrolist: baris pertama pakai grid
                besar (sampul + nama), sisanya baris geser. Jadi bukan cuma
                geser-geser ke kanan. */}
            {sectionRows.map((s) => {
              const items = rows[s.id] ?? [];
              if (items.length === 0) return null;
              const isGrid = s.id === sectionRows[0]?.id;
              return (
                <section key={s.id} className="mt-6">
                  <h2 className="mb-2 text-sm font-bold">{s.label}</h2>
                  {isGrid ? (
                    /* Grid 2 kolom, sampul besar: terasa seperti beranda
                        Spotify, bukan sekadar deretan geser. */
                    <div className="grid grid-cols-2 gap-3">
                      {items.slice(0, 6).map((t, i) => (
                        <CoverTile
                          key={`${s.id}_${t.id}_${i}`}
                          track={t}
                          onPlay={() => onPick(items, i)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="thin-scroll -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
                      {items.map((t, i) => (
                        <CoverCard
                          key={`${s.id}_${t.id}_${i}`}
                          track={t}
                          onPlay={() => onPick(items, i)}
                        />
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
            </>
          )}
        </>
      )}
    </div>
  );
}

// ------------------------------------------------------------ pemutar ----

function PlayerView({
  onBack,
  showLyrics,
  setShowLyrics,
}: {
  onBack: () => void;
  showLyrics: boolean;
  setShowLyrics: (v: boolean) => void;
}) {
  const p = useMusicPlayer();
  const barRef = useRef<HTMLDivElement>(null);
  const t = p.track;
  // Tampilan lirik ala Spotify: baris aktif mengikuti posisi lagu dan
  // digulir otomatis ke tengah layar.

  // Durasi asli dari elemen audio lebih akurat daripada metadata.
  const total = p.duration > 0 ? p.duration : t?.durationSec ?? 0;
  const pct = total > 0 ? Math.min(1, p.position / total) : 0;

  // Seek lewat klik/tahan pada bilah progres.
  const seekFromEvent = (clientX: number) => {
    const el = barRef.current;
    if (!el || total <= 0) return;
    const r = el.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    p.seek(ratio * total);
  };

  return (
    <div className="thin-scroll relative z-10 min-h-0 flex-1 overflow-y-auto px-5 pb-8">
      {!t ? (
        <p className="py-16 text-center text-sm text-white/55">
          Belum ada lagu yang dipilih.
        </p>
      ) : (
        <>
          <div className="mx-auto mt-2 w-full max-w-sm">
            <div className="relative aspect-square w-full overflow-hidden rounded-3xl bg-black/40 shadow-2xl ring-1 ring-white/15">
              {t.cover ? (
                <img
                  src={t.cover}
                  alt={t.album || t.title}
                  className="size-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex size-full items-center justify-center">
                  <Disc3 className="size-16 text-white/25" />
                </div>
              )}
              {p.loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/35">
                  <Loader2 className="size-9 animate-spin" />
                </div>
              )}
              {/* Lirik muncul DI ATAS poster, bukan di bawahnya. */}
              {showLyrics && (
                <div className="absolute inset-0 z-10 flex flex-col bg-black/85 backdrop-blur-sm">
                  <LyricsPane
                    cover={t.cover}
                    artist={t.artist}
                    track={t.title}
                    position={p.position}
                    playing={p.playing}
                    duration={total}
                    onClose={() => setShowLyrics(false)}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="mx-auto mt-5 w-full max-w-sm">
            {/* Kontrol player tetap di bawah; hanya blok judul + pembuat yang
                disembunyikan saat lirik terbuka, karena keduanya sudah
                tampil di dalam panel lirik (dengan poster kecil). */}
            <>
              {!showLyrics && (
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-xl font-bold tracking-tight">
                  {t.title}
                </h2>
                <p className="truncate text-sm text-white/60">{t.artist}</p>
                {t.album && (
                  <p className="mt-0.5 truncate text-[11px] text-white/40">
                    {t.album}
                  </p>
                )}
              </div>
              <button
                aria-label={p.liked ? "Batal suka" : "Sukai lagu ini"}
                aria-pressed={p.liked}
                onClick={p.toggleLike}
                className={cn(
                  "mt-1 shrink-0 transition active:scale-90",
                  p.liked ? "text-[oklch(0.86_0.16_90)]" : "text-white/50 hover:text-white",
                )}
              >
                <Heart className={cn("size-5", p.liked && "fill-current")} />
              </button>
            </div>
              )}

            {p.error && (
              <p className="mt-2 rounded-xl bg-red-500/15 px-3 py-2 text-[11px] text-red-200">
                {p.error}
              </p>
            )}

            {/* Bilah progres */}
            <div
              ref={barRef}
              role="slider"
              aria-label="Posisi lagu"
              aria-valuemin={0}
              aria-valuemax={Math.round(total)}
              aria-valuenow={Math.round(p.position)}
              tabIndex={0}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                seekFromEvent(e.clientX);
              }}
              onPointerMove={(e) => {
                if (e.buttons === 1) seekFromEvent(e.clientX);
              }}
              className="mt-4 touch-none"
            >
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/20">
                <div
                  className="h-full rounded-full bg-white"
                  style={{ width: `${pct * 100}%` }}
                />
              </div>
            </div>
            <div className="mt-1.5 flex justify-between text-[10px] text-white/55">
              <span>{fmtTime(p.position)}</span>
              <span>-{fmtTime(Math.max(0, total - p.position))}</span>
            </div>

            {/* Kontrol utama */}
            <div className="mt-4 flex items-center justify-center gap-3">
              <IconToggle
                active={p.shuffle}
                onClick={p.toggleShuffle}
                label="Acak"
              >
                <Shuffle className="size-4" />
              </IconToggle>
              <button
                onClick={p.prev}
                aria-label="Lagu sebelumnya"
                className="flex size-11 items-center justify-center rounded-full text-white/85 transition hover:bg-white/10"
              >
                <SkipBack className="size-6" />
              </button>
              <button
                onClick={p.toggle}
                aria-label={p.playing ? "Jeda" : "Putar"}
                className="flex size-16 items-center justify-center rounded-full bg-white text-black shadow-lg transition active:scale-95"
              >
                {p.playing ? (
                  <Pause className="size-7 fill-black" />
                ) : (
                  <Play className="size-7 translate-x-0.5 fill-black" />
                )}
              </button>
              <button
                onClick={() => p.next()}
                aria-label="Lagu berikutnya"
                className="flex size-11 items-center justify-center rounded-full text-white/85 transition hover:bg-white/10"
              >
                <SkipForward className="size-6" />
              </button>
              <IconToggle
                active={p.repeat !== "off"}
                onClick={p.cycleRepeat}
                label={p.repeat === "one" ? "Ulangi satu" : "Ulangi semua"}
              >
                {p.repeat === "one" ? (
                  <Repeat1 className="size-4" />
                ) : (
                  <Repeat className="size-4" />
                )}
              </IconToggle>
            </div>

            {/* Volume */}
            <div className="mt-6 flex items-center gap-2.5">
              <button
                onClick={p.toggleMute}
                aria-label={p.muted ? "Nyalakan suara" : "Matikan suara"}
                className="shrink-0 text-white/60"
              >
                {p.muted || p.volume === 0 ? (
                  <VolumeX className="size-4" />
                ) : (
                  <Volume2 className="size-4" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round((p.muted ? 0 : p.volume) * 100)}
                onChange={(e) => p.changeVolume(Number(e.target.value) / 100)}
                aria-label="Volume"
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/20 accent-white"
              />
              <span className="w-8 shrink-0 text-right text-[10px] text-white/55">
                {Math.round((p.muted ? 0 : p.volume) * 100)}
              </span>
            </div>
            </>
          </div>

          {/* Antrean */}
          <section className="mx-auto mt-8 w-full max-w-sm">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-sm font-bold">
                <ListMusic className="size-4" /> Antrean ({p.queue.length})
              </h3>
              <button
                onClick={p.clearQueue}
                className="flex items-center gap-1 text-[11px] text-white/60 underline"
              >
                <Trash2 className="size-3" /> Kosongkan
              </button>
            </div>
            {p.queue.map((qt, i) => (
              <div key={`aq_${qt.id}_${i}`} className="flex items-center gap-1">
                <div className="min-w-0 flex-1">
                  <TrackRow
                    track={qt}
                    active={i === p.index}
                    onPlay={() => p.playAt(i)}
                    onRemove={() => p.removeAt(i)}
                  />
                </div>
              </div>
            ))}
          </section>
        </>
      )}
      <button
        onClick={onBack}
        className="mx-auto mt-6 block text-[11px] text-white/55 underline"
      >
        Kembali ke pustaka
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- lirik ----

/** Satu baris lirik bersinkron. */
type LyricLine = { t: number; text: string };

/** Baris lagu yang disukai, bentuk persis seperti tabel musicLikes. */
type LikedRow = {
  key: string;
  title: string;
  artist: string;
  videoId?: string;
  audioUrl?: string;
  cover?: string;
  album?: string;
};

/** Ubah baris favorit musik jadi bentuk yang bisa diputar player. */
function toTrack(r: LikedRow): MusicTrack {
  return {
    id: `liked_${r.key}`,
    title: r.title,
    artist: r.artist,
    album: r.album ?? "",
    cover: r.cover ?? "",
    audioUrl: r.audioUrl ?? "",
    durationSec: 0,
    source: "archive",
    kind: "potongan",
  };
}

/**
 * Lirik ala Spotify: baris aktif ditebalkan dan diwarnai, baris lain redup,
 * dan panel menggulir otomatis supaya baris yang sedang dinyanyikan selalu
 * di tengah layar.
 */
function LyricsPane({
  cover,
  artist,
  track,
  position,
  playing,
  duration,
  onClose,
}: {
  cover?: string;
  artist: string;
  track: string;
  position: number;
  playing: boolean;
  /** Durasi lagu; membantu LRCLIB memilih versi lirik yang persis. */
  duration: number;
  onClose: () => void;
}) {
  const getLyrics = useAction(api.music.lyrics);
  const [lines, setLines] = useState<LyricLine[] | null>(null);
  const [plain, setPlain] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Ref posisi terkini. Panel ini hanya menerima `position` sebagai prop yang
  // berubah tiap tick, tapi baris aktif HARUS dihitung ulang juga saat panel
  // baru dibuka - kalau tidak, lirik yang terbuka di menit 1:34 tetap mulai
  // dari awal sampai detik berikutnya lewat.
  const posRef = useRef(position);
  posRef.current = position;
  useEffect(() => {
    posRef.current = position;
  }, [position]);

  useEffect(() => {
    let alive = true;
    setBusy(true);
    setLines(null);
    setPlain(null);
    getLyrics({ artist, track, durationSec: duration })
      .then((r: unknown) => {
        if (!alive) return;
        const d = r as { synced: LyricLine[] | null; plain: string[] | null };
        setLines(d.synced ?? null);
        setPlain(d.plain ?? null);
        setBusy(false);
      })
      .catch(() => alive && setBusy(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artist, track]);

  // Baris aktif = baris terakhir yang waktunya sudah lewat posisi lagu.
  const activeIdx = useMemo(() => {
    if (!lines || lines.length === 0) return -1;
    let idx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].t <= position + 0.3) idx = i;
      else break;
    }
    return idx;
  }, [lines, position]);

  // Gulir otomatis hanya kalau lagunya sedang jalan, supaya user tetap bisa
  // menggulir manual saat dijeda tanpa panel melawan.
  useEffect(() => {
    if (!playing || activeIdx < 0 || !lines) return;
    const el = scrollRef.current?.querySelector<HTMLElement>(
      `[data-lyric="${activeIdx}"]`,
    );
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeIdx, playing, lines]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
        <p className="flex shrink-0 items-center gap-1.5 text-[11px] font-bold text-white/80">
          <Mic2 className="size-3.5" /> Lirik
        </p>
        <button
          onClick={onClose}
          aria-label="Tutup lirik"
          className="ml-auto shrink-0 text-[11px] text-white/60 underline"
        >
          Tutup
        </button>
      </div>
      {/* Poster kecil + judul + pembuat di dalam panel lirik. */}
      <div className="flex items-center gap-2.5 px-3 py-2">
        {cover ? (
          <img
            src={cover}
            alt=""
            className="size-11 shrink-0 rounded-md object-cover ring-1 ring-white/20"
          />
        ) : (
          <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-white/10">
            <Disc3 className="size-5 text-white/40" />
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-[13px] font-bold text-white">{track}</p>
          <p className="truncate text-[11px] text-white/60">{artist}</p>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="thin-scroll min-h-0 flex-1 overflow-y-auto px-3 pb-3"
      >
        {busy ? (
          <div className="flex items-center gap-2 py-6 text-xs text-white/60">
            <Loader2 className="size-4 animate-spin" /> Mencari lirik...
          </div>
        ) : lines && lines.length > 0 ? (
          <div className="flex flex-col gap-2 py-1">
            {lines.map((l, i) => {
              const active = i === activeIdx;
              return (
                <p
                  key={`${l.t}-${i}`}
                  data-lyric={i}
                  className={cn(
                    "text-[13px] leading-snug transition-all duration-300",
                    active
                      ? "font-bold text-white"
                      : i < activeIdx
                        ? "text-white/35"
                        : "text-white/60",
                  )}
                >
                  {l.text || "\u00A0"}
                </p>
              );
            })}
          </div>
        ) : plain && plain.length > 0 ? (
          <div className="flex flex-col gap-1.5 py-1">
            {plain.map((l, i) => (
              <p key={i} className="text-[13px] leading-snug text-white/70">
                {l || "\u00A0"}
              </p>
            ))}
          </div>
        ) : (
          <p className="py-6 text-center text-xs text-white/50">
            Lirik belum tersedia untuk lagu ini.
          </p>
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------------- bagian ----

function TrackRow({
  track, active, onPlay, onRemove,
}: {
  track: MusicTrack;
  active: boolean;
  onPlay: () => void;
  onRemove?: () => void;
}) {
  return (
    <div
      className={cn(
        "group flex items-center gap-3 rounded-xl px-2 py-2 transition",
        active ? "bg-white/15" : "hover:bg-white/10",
      )}
    >
      <button
        onClick={onPlay}
        className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-black/40"
        aria-label={`Putar ${track.title}`}
      >
        {track.cover ? (
          <img src={track.cover} alt="" className="size-full object-cover" loading="lazy" />
        ) : (
          <span className="flex size-full items-center justify-center">
            <Music2 className="size-4 text-white/40" />
          </span>
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition group-hover:opacity-100">
          <Play className="size-4 fill-white" />
        </span>
      </button>
      <button onClick={onPlay} className="min-w-0 flex-1 text-left">
        <p
          className={cn(
            "truncate text-sm font-semibold",
            active && "text-white",
          )}
        >
          {track.title}
        </p>
        <p className="truncate text-[11px] text-white/55">
          {track.artist}
          <span className="ml-1.5 rounded bg-white/15 px-1 py-px text-[9px] uppercase">
            {track.source === "archive" ? "penuh" : "30 dtk"}
          </span>
        </p>
      </button>
      {onRemove && (
        <button
          onClick={onRemove}
          aria-label={`Hapus ${track.title} dari antrean`}
          className="shrink-0 rounded-full p-2 text-white/45 transition hover:text-white"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}

/** Kartu grid besar ala Spotify: sampul 2 kolom + nama di bawahnya. */
function CoverTile({
  track,
  onPlay,
}: {
  track: MusicTrack;
  onPlay: () => void;
}) {
  return (
    <button
      onClick={onPlay}
      className="group text-left transition active:scale-[0.98]"
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-white/10 ring-1 ring-white/10">
        {track.cover ? (
          <img
            src={track.cover}
            alt=""
            className="size-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <span className="flex size-full items-center justify-center">
            <Music2 className="size-8 text-white/25" />
          </span>
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition group-hover:opacity-100">
          <Play className="size-7 fill-white" />
        </span>
      </div>
      <p className="mt-2 truncate text-[13px] font-bold">{track.title}</p>
      <p className="truncate text-[11px] text-white/50">{track.artist}</p>
    </button>
  );
}

function CoverCard({ track, onPlay }: { track: MusicTrack; onPlay: () => void }) {
  return (
    <button onClick={onPlay} className="w-32 shrink-0 text-left">
      <div className="relative aspect-square w-32 overflow-hidden rounded-2xl bg-white/10 ring-1 ring-white/10">
        {track.cover ? (
          <img src={track.cover} alt="" className="size-full object-cover" loading="lazy" />
        ) : (
          <span className="flex size-full items-center justify-center">
            <Music2 className="size-6 text-white/30" />
          </span>
        )}
        <span className="absolute bottom-1.5 right-1.5 flex size-8 items-center justify-center rounded-full bg-black/70 shadow-lg">
          <Play className="size-4 translate-x-px fill-white" />
        </span>
      </div>
      <p className="mt-1.5 truncate text-xs font-semibold">{track.title}</p>
      <p className="truncate text-[10px] text-white/50">{track.artist}</p>
    </button>
  );
}

function IconToggle({
  active, onClick, label, children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "flex size-9 items-center justify-center rounded-full transition hover:bg-white/10",
        active ? "text-white" : "text-white/40",
      )}
    >
      {children}
    </button>
  );
}

/** Warna latar dari sampul, dipakai sebagai gradasi layar pemutar. */
function tintOf(url: string): string {
  // Warna disimpan sebagai hash URL supaya hasilnya stabil tanpa perlu
  // mengunduh gambar, dan tetap berubah ketika lagu berganti.
  let h = 0;
  for (let i = 0; i < url.length; i++) h = (h * 31 + url.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `hsl(${hue} 55% 26%)`;
}