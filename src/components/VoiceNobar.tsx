import { useEffect, useRef, useState } from "react";
import { useAction, useMutation } from "convex/react";
import Hls from "hls.js";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import {
  Clapperboard,
  Film,
  Loader2,
  Maximize2,
  Pause,
  Play,
  Search,
  SkipBack,
  SkipForward,
  Tv,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";

export type VoiceNobar = {
  kind: string;
  id: string;
  slug?: string;
  title: string;
  image?: string;
  episode?: number;
  startedAt: number;
  /** Sinkron playback dari host — peserta non-host mengikuti ini. */
  playing?: boolean;
  positionSec?: number;
};

type Source = { url: string; type?: string };

function fmtTime(s: number): string {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

/**
 * PLAYER NOBAR di voice room — ditaruh PALING ATAS saat host memasang judul.
 * Kontrol yang tampil hanya kontrol player + pengaturan host (ganti / tutup).
 * Info "Di-host oleh …" ada di bawah judul.
 */
export function VoiceNobarStage({
  roomId,
  nobar,
  hostName,
  isHost,
  onChange,
  onClose,
}: {
  roomId: Id<"voiceRooms">;
  nobar: VoiceNobar;
  hostName: string;
  isHost: boolean;
  onChange: () => void;
  onClose: () => void;
}) {
  const resolveAnime = useAction(api.megaplay.resolveEpisode);
  const resolveDonghua = useAction(api.sanka.resolveEpisode);
  const resolveFilm = useAction(api.films.resolveStream);

  const syncNobar = useMutation(api.voice.syncNobar);

  const [source, setSource] = useState<Source | null>(null);
  const [embed, setEmbed] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Status playback lokal (ikut host untuk peserta, dikendalikan host).
  const [playing, setPlaying] = useState<boolean>(nobar.playing ?? true);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);
  const [muted, setMuted] = useState(false);
  const hlsRef = useRef<Hls | null>(null);
  // Penanda waktu supaya seek host tidak dibalik oleh efek sync peserta.
  const lastHostPos = useRef<number>(nobar.positionSec ?? 0);

  const ep = nobar.episode ?? 1;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setErr(null);
    setSource(null);
    setEmbed(null);
    void (async () => {
      try {
        if (nobar.kind === "film") {
          const res: any = await resolveFilm({
            id: nobar.id,
            kind: nobar.slug === "tv" ? "tv" : "movie",
            season: 1,
            episode: ep,
          });
          const list: any[] = res?.sources ?? [];
          const direct = list.find(
            (s) => s?.type === "hls" || s?.type === "mp4",
          );
          if (direct) {
            if (alive) setSource({ url: direct.url, type: direct.type });
          } else if (list[0]?.url) {
            if (alive) setEmbed(String(list[0].url));
          } else if (alive) {
            setErr("Film belum punya server streaming");
          }
        } else if (nobar.kind === "donghua") {
          if (!nobar.slug) {
            if (alive) setErr("Episode donghua belum dipilih host");
          } else {
            const res: any = await resolveDonghua({ slug: nobar.slug });
            const list: any[] = res?.sources ?? [];
            if (alive && list[0]?.url) {
              setSource({ url: list[0].url, type: list[0].type });
            } else if (alive) {
              setErr(res?.reason ?? "Episode donghua belum tersedia");
            }
          }
        } else {
          const res: any = await resolveAnime({
            malId: nobar.id,
            ep,
            title: nobar.title,
          });
          const list: any[] = res?.sources ?? [];
          if (alive && list[0]?.url) {
            setSource({ url: list[0].url, type: list[0].type });
          } else if (alive) {
            setErr(res?.reason ?? "Episode belum tersedia");
          }
        }
      } catch (e) {
        if (alive)
          setErr(e instanceof Error ? e.message : "Gagal memuat player");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nobar.kind, nobar.id, nobar.slug, ep]);

  // Pasang HLS/MP4 ke <video>.
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !source) return;
    const isHls =
      source.type === "hls" || /\.m3u8(\?|$)/i.test(source.url);
    if (!isHls) {
      el.src = source.url;
      return;
    }
    if (el.canPlayType("application/vnd.apple.mpegurl")) {
      el.src = source.url;
      return;
    }
    if (!Hls.isSupported()) {
      el.src = source.url;
      return;
    }
    // Nobar selalu 720 — pilih level terdekat 720, tanpa menu kualitas.
    const hls = new Hls({ enableWorker: true, lowLatencyMode: false });
    hls.loadSource(source.url);
    hls.attachMedia(el);
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      const levels = hls.levels ?? [];
      if (!levels.length) return;
      let best = 0;
      let bestDiff = Infinity;
      levels.forEach((lv, i) => {
        const h = lv.height ?? 0;
        const diff = Math.abs(h - 720);
        if (diff < bestDiff) {
          bestDiff = diff;
          best = i;
        }
      });
      hls.currentLevel = best;
    });
    hlsRef.current = hls;
    return () => {
      hlsRef.current = null;
      hls.destroy();
    };
  }, [source]);

  // PESERTA NON-HOST — ikuti status host (play / jeda / posisi).
  useEffect(() => {
    if (isHost) return;
    const el = videoRef.current;
    if (!el || embed) return;
    const want = nobar.playing ?? true;
    if (want && el.paused) void el.play().catch(() => {});
    if (!want && !el.paused) el.pause();
    const hostPos = nobar.positionSec;
    if (
      typeof hostPos === "number" &&
      Number.isFinite(hostPos) &&
      Math.abs(el.currentTime - hostPos) > 1.5
    ) {
      lastHostPos.current = hostPos;
      el.currentTime = hostPos;
    }
  }, [nobar.playing, nobar.positionSec, isHost, embed]);

  // HANYA HOST yang boleh kontrol. Non-host tombolnya disembunyikan.
  const togglePlay = () => {
    if (!isHost) return;
    const el = videoRef.current;
    if (!el || embed) return;
    const next = el.paused;
    if (next) void el.play().catch(() => {});
    else el.pause();
    setPlaying(next);
    void syncNobar({
      roomId,
      playing: next,
      positionSec: el.currentTime,
    }).catch(() => {});
  };

  const seekBy = (delta: number) => {
    if (!isHost) return;
    const el = videoRef.current;
    if (!el || embed) return;
    const next = Math.max(0, Math.min(el.duration || 0, el.currentTime + delta));
    el.currentTime = next;
    setCur(next);
    void syncNobar({ roomId, positionSec: next }).catch(() => {});
  };

  const onScrub = (value: number) => {
    if (!isHost) return;
    const el = videoRef.current;
    if (!el || embed) return;
    el.currentTime = value;
    setCur(value);
    void syncNobar({ roomId, positionSec: value }).catch(() => {});
  };

  return (
    <div className="mx-3 mb-2 overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-b from-[#161b28] to-[#0e1119] shadow-[0_10px_30px_-18px_rgba(0,0,0,0.9)]">
      {/* Strip penanda nobar — beda dari kartu peserta, tanpa glow. */}
      <div className="flex items-center gap-1.5 border-b border-white/10 bg-white/[0.05] px-2.5 py-1.5">
        <span className="size-1.5 rounded-full bg-rose-400" />
        <span className="text-[9px] font-black uppercase tracking-[0.18em] text-rose-200/90">
          Nobar
        </span>
        <span className="ml-auto truncate text-[9px] font-semibold text-white/40">
          {hostName} · layar bersama
        </span>
      </div>
      {/* Player PALING ATAS — UI player sendiri, kontrol hanya host. */}
      <div className="relative aspect-video w-full bg-[#05070c]">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
            <Loader2 className="size-5 animate-spin text-white/60" />
            <p className="text-[10px] font-semibold text-white/45">
              Menyiapkan nobar…
            </p>
          </div>
        )}
        {!loading && err && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-4 text-center">
            <p className="text-[11px] font-bold text-rose-300">{err}</p>
            {isHost && (
              <button
                type="button"
                onClick={onChange}
                className="mt-1 rounded-full border border-white/20 px-3 py-1 text-[10px] font-bold text-white/80"
              >
                Ganti judul
              </button>
            )}
          </div>
        )}
        {!loading && !err && embed && (
          <iframe
            src={embed}
            title={nobar.title}
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 size-full border-0"
            referrerPolicy="no-referrer"
          />
        )}
        {!loading && !err && !embed && (
          <video
            ref={videoRef}
            playsInline
            muted={muted}
            className="absolute inset-0 size-full bg-black object-contain"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onTimeUpdate={(e) => setCur(e.currentTarget.currentTime)}
            onLoadedMetadata={(e) => setDur(e.currentTarget.duration || 0)}
          />
        )}

        {/* Kontrol custom — hanya HOST yang bisa pakai. Non-host cuma lihat. */}
        {!loading && !err && !embed && (
          <div
            className={cn(
              "absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-2.5 pb-2 pt-6",
              isHost ? "" : "pointer-events-none opacity-90",
            )}
          >
            {/* Bar seek */}
            <input
              type="range"
              min={0}
              max={dur || 0}
              step={0.1}
              value={Math.min(cur, dur || 0)}
              disabled={!isHost}
              onChange={(e) => onScrub(Number(e.target.value))}
              aria-label="Geser posisi"
              className="h-1 w-full cursor-pointer appearance-none rounded-full accent-rose-400"
            />
            <div className="mt-1 flex items-center gap-2">
              {isHost ? (
                <button
                  type="button"
                  onClick={togglePlay}
                  aria-label={playing ? "Jeda" : "Putar"}
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white text-black transition active:scale-95"
                >
                  {playing ? (
                    <Pause className="size-4" />
                  ) : (
                    <Play className="size-4" />
                  )}
                </button>
              ) : (
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-white/80">
                  {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
                </span>
              )}
              {isHost && (
                <button
                  type="button"
                  onClick={() => seekBy(-10)}
                  aria-label="Mundur 10 detik"
                  className="shrink-0 text-[10px] font-black text-white/80"
                >
                  −10s
                </button>
              )}
              {isHost && (
                <button
                  type="button"
                  onClick={() => seekBy(10)}
                  aria-label="Maju 10 detik"
                  className="shrink-0 text-[10px] font-black text-white/80"
                >
                  +10s
                </button>
              )}
              <span className="ml-auto font-mono text-[10px] font-semibold text-white/80">
                {fmtTime(cur)} / {fmtTime(dur)}
              </span>
              <button
                type="button"
                onClick={() => {
                  const el = videoRef.current;
                  if (!el) return;
                  el.muted = !el.muted;
                  setMuted(el.muted);
                }}
                aria-label={muted ? "Nyalakan suara" : "Matikan suara"}
                className="shrink-0 text-white/80"
              >
                {muted ? (
                  <VolumeX className="size-4" />
                ) : (
                  <Volume2 className="size-4" />
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  const box = videoRef.current?.parentElement;
                  if (!box) return;
                  if (document.fullscreenElement) void document.exitFullscreen();
                  else void box.requestFullscreen?.();
                }}
                aria-label="Layar penuh"
                className="shrink-0 text-white/80"
              >
                <Maximize2 className="size-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Info judul + host. Hanya host yang punya tombol pengaturan. */}
      <div className="flex items-center gap-2 border-t border-white/10 bg-[#0c1017] px-2.5 py-2">
        <Clapperboard className="size-4 shrink-0 text-rose-300" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-black text-white">
            {nobar.title}
            {ep > 0 && <span className="text-white/50"> · Ep {ep}</span>}
          </p>
          <p className="truncate text-[9px] font-semibold text-white/45">
            Di-host oleh {hostName}
          </p>
        </div>
        {isHost && (
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={onChange}
              className="rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-1 text-[10px] font-bold text-white/80 transition hover:text-white"
            >
              Ganti
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup nobar"
              className="flex size-7 items-center justify-center rounded-full border border-rose-400/40 bg-rose-500/15 text-rose-300 transition active:scale-95"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ picker */

type Kind = "anime" | "film" | "donghua";

type Result = { id: string; title: string; image?: string; sub?: string; filmKind?: string };

/**
 * PICKER NOBAR (host saja) — cari anime / film / donghua lalu pasang ke room.
 * Setelah dipilih, player muncul di paling atas layar voice room.
 */
export function VoiceNobarPicker({
  roomId,
  current,
  onClose,
}: {
  roomId: Id<"voiceRooms">;
  current: VoiceNobar | null;
  onClose: () => void;
}) {
  const searchAnime = useAction(api.anime.animeSearch);
  const searchFilm = useAction(api.films.search);
  const searchDonghua = useAction(api.sanka.donghuaSearchCards);
  const sankaDetail = useAction(api.sanka.detail);
  const setNobar = useMutation(api.voice.setNobar);

  const [kind, setKind] = useState<Kind>(
    (current?.kind as Kind) ?? "anime",
  );
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    let alive = true;
    const t = setTimeout(() => {
      void (async () => {
        try {
          if (kind === "film") {
            const list: any[] = ((await searchFilm({ q: term })) ?? []) as any[];
            if (alive)
              setResults(
                list.slice(0, 20).map((f) => ({
                  id: String(f.id),
                  title: String(f.title ?? ""),
                  image: f.image,
                  sub: f.year ? String(f.year) : f.kind,
                  filmKind: f.kind ?? "movie",
                })),
              );
          } else if (kind === "donghua") {
            const list: any[] =
              ((await searchDonghua({ q: term })) ?? []) as any[];
            if (alive)
              setResults(
                list.slice(0, 20).map((d) => ({
                  id: String(d.id),
                  title: String(d.title ?? ""),
                  image: d.image,
                  sub: "Donghua",
                })),
              );
          } else {
            const list: any[] =
              ((await searchAnime({ q: term })) ?? []) as any[];
            if (alive)
              setResults(
                list.slice(0, 20).map((a) => ({
                  id: String(a.id ?? a.malId ?? ""),
                  title: String(a.title ?? ""),
                  image: a.image,
                  sub: a.episodes ? `${a.episodes} ep` : "Anime",
                })),
              );
          }
        } catch {
          if (alive) setResults([]);
        }
      })();
    }, 400);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q, kind, searchAnime, searchFilm, searchDonghua]);

  const pick = async (r: Result) => {
    setErr(null);
    setBusy(true);
    try {
      if (kind === "donghua") {
        // Ambil slug episode pertama supaya player bisa langsung resolve.
        const d: any = await sankaDetail({ slug: r.id });
        const first = d?.episodes?.[0];
        if (!first?.url)
          throw new Error("Donghua ini belum punya episode yang bisa diputar");
        await setNobar({
          roomId,
          kind: "donghua",
          id: r.id,
          slug: String(first.url),
          title: r.title,
          image: r.image,
          episode: Number(first.number ?? 1) || 1,
        });
      } else if (kind === "film") {
        await setNobar({
          roomId,
          kind: "film",
          id: r.id,
          slug: r.filmKind === "tv" ? "tv" : "movie",
          title: r.title,
          image: r.image,
          episode: 1,
        });
      } else {
        await setNobar({
          roomId,
          kind: "anime",
          id: r.id,
          title: r.title,
          image: r.image,
          episode: 1,
        });
      }
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal memasang nobar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/70 p-3 pb-5">
      <div className="screen-enter flex max-h-[82vh] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-white/12 bg-[#0c1017]">
        <div className="flex items-center gap-2 border-b border-white/10 px-3.5 py-3">
          <Clapperboard className="size-4 shrink-0 text-rose-300" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-white">Nobar di Voice</p>
            <p className="text-[10px] text-white/45">
              Pilih judul — hanya host yang bisa mengatur
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="flex size-8 items-center justify-center rounded-full border border-white/12 bg-white/[0.06] text-white/70"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex gap-1.5 px-3.5 pt-2.5">
          {(
            [
              ["anime", "Anime"],
              ["film", "Film"],
              ["donghua", "Donghua"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setKind(k);
                setResults([]);
              }}
              className={cn(
                "flex-1 rounded-xl border px-2 py-1.5 text-[11px] font-bold transition",
                kind === k
                  ? "border-white/35 bg-white/[0.12] text-white"
                  : "border-white/10 bg-white/[0.03] text-white/50",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="px-3.5 pt-2">
          <div className="flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-3 py-2">
            <Search className="size-4 shrink-0 text-white/40" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari judul… (min 2 huruf)"
              className="min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-white/35"
            />
          </div>
        </div>

        {err && (
          <p className="mx-3.5 mt-2 rounded-xl border border-red-400/40 bg-red-500/10 px-3 py-2 text-[11px] font-semibold text-red-200">
            {err}
          </p>
        )}

        <div className="thin-scroll min-h-0 flex-1 space-y-1.5 overflow-y-auto p-3.5">
          {results.length === 0 && q.trim().length >= 2 && (
            <p className="py-6 text-center text-[11px] text-white/40">
              Tidak ada hasil.
            </p>
          )}
          {results.map((r) => (
            <button
              key={`${r.id}-${r.filmKind ?? ""}`}
              type="button"
              disabled={busy}
              onClick={() => void pick(r)}
              className="flex w-full items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] p-2 text-left transition hover:border-white/25 disabled:opacity-50"
            >
              {r.image ? (
                <img
                  src={r.image}
                  alt=""
                  className="size-11 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-white/[0.06]">
                  {kind === "film" ? (
                    <Film className="size-4 text-sky-300" />
                  ) : (
                    <Tv className="size-4 text-violet-300" />
                  )}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-bold text-white">
                  {r.title}
                </span>
                <span className="block truncate text-[10px] text-white/40">
                  {r.sub}
                </span>
              </span>
              {busy ? (
                <Loader2 className="size-4 shrink-0 animate-spin text-white/50" />
              ) : (
                <SkipForward className="size-4 shrink-0 text-white/40" />
              )}
            </button>
          ))}
        </div>

        {current && (
          <div className="border-t border-white/10 px-3.5 py-2.5">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold text-white/45">
              <SkipBack className="size-3" /> Sedang diputar:{" "}
              <span className="truncate text-white/75">{current.title}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
