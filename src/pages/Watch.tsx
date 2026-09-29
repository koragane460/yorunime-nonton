import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useAction, useMutation, useQuery } from "convex/react";
import Hls from "hls.js";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { CommentsSection, type CommentT } from "@/components/Comments";
import { SectionTitle } from "@/components/lstream-ui";
import { setMiniPlayer } from "@/components/AppLayout";
import {
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Download,
  Gauge,
  Loader2,
  Maximize,
  Pause,
  PictureInPicture2,
  Play,
  RotateCcw,
  RotateCw,
  Settings2,
  SkipBack,
  SkipForward,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const QUALITIES = ["144p", "240p", "360p", "480p", "720p", "1080p"];
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export default function Watch() {
  return <WatchContent />;
}

function WatchContent() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const animeId = params.get("anime") ?? "";
  const epParam = params.get("ep");

  const detail = useAction(api.anime.animeDetail);
  const episode = useAction(api.anime.animeEpisode);
  // MegaPlay: ambil URL HLS langsung (m3u8) + subtitle + timing intro/outro
  const resolveDirect = useAction(api.megaplay.resolveEpisode);
  const record = useMutation(api.activities.recordWatch);
  const settings = useQuery(api.users.currentUser, {});

  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(settings?.defaultSpeed ?? 1);
  const [quality, setQuality] = useState(settings?.defaultQuality ?? "720p");
  const [qualityOpen, setQualityOpen] = useState(false);
  const [speedOpen, setSpeedOpen] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [recorded, setRecorded] = useState(false);
  const [controlsOn, setControlsOn] = useState(true);
  const [scrub, setScrub] = useState<number | null>(null);
  const [isFs, setIsFs] = useState(false);
  const [subOpen, setSubOpen] = useState(false);
  const [activeSub, setActiveSub] = useState<string>("");
  const [waiting, setWaiting] = useState(false);
  const playerRef = useRef<HTMLDivElement>(null);
  const [sources, setSources] = useState<{ label: string; url: string; type: string }[]>([]);
  const [sourceType, setSourceType] = useState<"mp4" | "embed" | "hls">("mp4");
  const [sourceIdx, setSourceIdx] = useState(0);
  const [synopsisOpen, setSynopsisOpen] = useState(false);
  // Hasil resolve MegaPlay: subtitle, timing intro/outro, embed cadangan
  const [direct, setDirect] = useState<any>(null);
  // Alasan stream tidak tersedia (mis. judul upcoming belum tayang)
  const [directErr, setDirectErr] = useState<string | null>(null);

  // Ganti subtitle: textTrack yang dipilih = "showing", lainnya dimatikan.
  const pickSub = (label: string) => {
    const v = videoRef.current;
    setActiveSub(label);
    setSubOpen(false);
    if (!v) return;
    // Urutan <track> di video: subtitle utama dulu, lalu track lain.
    const order: string[] = direct?.subtitle?.url
      ? [
          direct.subtitle.label ?? "Subtitle",
          ...(direct?.subTracks ?? [])
            .filter((t: any) => t.url !== direct?.subtitle?.url)
            .map((t: any) => t.label),
        ]
      : (direct?.subTracks ?? []).map((t: any) => t.label);
    Array.from(v.textTracks).forEach((t, i) => {
      t.mode = !label ? "disabled" : order[i] === label ? "showing" : "disabled";
    });
  };

  // Subtitle Indonesia otomatis aktif begitu metadata track siap.
  useEffect(() => {
    if (!direct?.subtitle?.url) return;
    const v = videoRef.current;
    if (!v) return;
    setActiveSub(direct.subtitle.label ?? "Subtitle");
  }, [direct]);

  const [detailData, setDetailData] = useState<any>(null);
  const [epData, setEpData] = useState<any>(null);

  const epList = detailData?.episodeList ?? [];
  const epIndex = epList.findIndex((e: any) => e.id === epParam);
  const currentEp = epList[epIndex] ?? epList[0];
  const streamUrl =
    sources[sourceIdx]?.url ??
    sources[0]?.url ??
    epData?.sources?.[0]?.url ??
    "";

  useEffect(() => {
    if (animeId) {
      detail({ id: animeId })
        .then((d: any) => setDetailData(d))
        .catch(() => setDetailData({ error: true }));
    }
    if (epParam) {
      episode({ animeId, episodeId: epParam })
        .then((e: any) => setEpData(e))
        .catch(() => {});
      // Coba direct HLS untuk episode katalog (format `{malId}__ep{n}`)
      const mm = epParam.match(/^(\d+)__ep(\d+)$/);
      if (mm) {
        resolveDirect({ malId: mm[1], ep: Number(mm[2]) || 1 })
          .then((d: any) => {
            if (!d?.ok) {
              setDirectErr(d?.reason ?? "Episode belum tersedia");
              return;
            }
            setDirectErr(null);
            setDirect(d);
            setSources(d.sources);
            setSourceType("hls");
            setSourceIdx(0);
          })
          .catch((e: any) =>
            setDirectErr(e?.message ?? "Gagal memuat episode"),
          );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animeId, epParam]);

  // Sinkronkan sumber video dari data episode (mp4 langsung / embed iframe)
  useEffect(() => {
    const list = (epData?.sources ?? []) as { label: string; url: string; type: string }[];
    if (list.length > 0) {
      setSources(list);
      setSourceType(
        list[0]?.type === "embed"
          ? "embed"
          : list[0]?.type === "hls"
            ? "hls"
            : "mp4",
      );
      setSourceIdx(0);
    }
  }, [epData]);

  // HLS (m3u8) → hls.js (Safari bisa pakai src bawaan)
  useEffect(() => {
    const v = videoRef.current;
    if (!v || sourceType !== "hls" || !streamUrl) return;
    const native = v.canPlayType("application/vnd.apple.mpegurl");
    if (!Hls.isSupported() && !native) return;
    let hls: Hls | null = null;
    if (Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 30,
        maxBufferLength: 20,
        maxMaxBufferLength: 60,
        startFragPrefetch: true,
        abrEwmaDefaultEstimate: 2_000_000,
      });
      hls.loadSource(streamUrl);
      hls.attachMedia(v);
      hls.on(Hls.Events.ERROR, (_evt, data) => {
        if (data.fatal) toast.error("Gagal memuat stream — coba server lain");
      });
    } else {
      v.src = streamUrl;
    }
    return () => {
      hls?.destroy();
    };
  }, [sourceType, streamUrl]);

  // Catat history (sekali per episode)
  useEffect(() => {
    if (!user || !detailData || detailData.error || !currentEp || recorded) return;
    setRecorded(true);
    void record({
      animeId,
      animeTitle: detailData.title,
      animeImage: detailData.image,
      episode: currentEp.number,
      minutes: 1,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, detailData, currentEp]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = speed;
  }, [speed]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play();
    else v.pause();
  };

  const skip = (s: number) => {
    const v = videoRef.current;
    if (v) v.currentTime = Math.max(0, v.currentTime + s);
  };

  // Kontrol video: tap untuk tampil/sembunyi, auto-hide saat diputar,
  // dan fullscreen → landscape dengan kontrol native browser.
  const tapVideo = () => setControlsOn((v) => !v);

  useEffect(() => {
    if (isFs) {
      setControlsOn(true);
      return;
    }
    if (!playing) {
      setControlsOn(true);
      return;
    }
    const t = window.setTimeout(() => setControlsOn(false), 3000);
    return () => clearTimeout(t);
  }, [playing, isFs, controlsOn, currentTime]);

  useEffect(() => {
    const onFsChange = () => {
      const fs = document.fullscreenElement === playerRef.current;
      setIsFs(fs);
      setControlsOn(true);
      // Kembalikan orientasi ke portrait saat keluar fullscreen.
      if (!fs) {
        try {
          (screen.orientation as any)?.lock?.("portrait");
        } catch {
          /* abaikan */
        }
      }
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const toggleFullscreen = async () => {
    const el = playerRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }
      if (el.requestFullscreen) await el.requestFullscreen();
      else if ((el as any).webkitRequestFullscreen)
        await (el as any).webkitRequestFullscreen();
      try {
        await (screen.orientation as any)?.lock?.("landscape");
      } catch {
        /* browser tidak mendukung lock orientasi */
      }
    } catch {
      toast.error("Fullscreen tidak didukung di browser ini");
    }
  };

  // Seek bar: saat digeser tampil menit tujuan, dilepas → langsung diputar.
  const commitScrub = (value: number) => {
    const v = videoRef.current;
    if (v && Number.isFinite(value)) v.currentTime = value;
    setCurrentTime(value);
    setScrub(null);
  };

  const episodeComments = useQuery(
    api.activities.listComments,
    epParam ? { animeId: `${animeId}__ep${epParam}`, sort: "terbaru" } : "skip",
  );
  const postComment = useMutation(api.activities.postComment);

  if (!detailData)
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Memuat…
      </div>
    );

  const D = detailData;

  return (
    <div className="min-h-screen pb-24">
      {/* Player */}
      <div ref={playerRef} className="relative bg-black">
        {!streamUrl ? (
          <div
            className="flex aspect-video w-full flex-col items-center justify-center gap-2 bg-black text-center"
            style={D.image ? { backgroundImage: `url(${D.image})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
          >
            <div className="absolute inset-0 bg-black/65" />
            <div className="relative px-6">
              <p className="text-sm font-bold text-white">
                {directErr ?? "Episode belum tersedia"}
              </p>
              <p className="mt-1 text-xs text-white/70">
                {D.status === "Upcoming"
                  ? "Judul ini belum tayang,cek jadwal rilisnya"
                  : "Coba episode lain atau kembali ke halaman anime"}
              </p>
              <button
                onClick={() => navigate("/home")}
                className="mt-3 rounded-full border border-white/40 px-4 py-1.5 text-xs font-bold text-white"
              >
                Kembali ke Home
              </button>
            </div>
          </div>
        ) : sourceType === "embed" ? (
          <iframe
            src={streamUrl}
            title={D.title}
            className="aspect-video w-full"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
          />
        ) : (
          <video
            ref={videoRef}
            src={sourceType === "mp4" ? streamUrl : undefined}
            poster={D.image}
            className="aspect-video w-full"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
            onWaiting={() => setWaiting(true)}
            onPlaying={() => setWaiting(false)}
            onCanPlay={() => setWaiting(false)}
            controls={false}
          >
            {direct?.subtitle?.url && (
              <track
                kind="subtitles"
                src={direct.subtitle.url}
                srcLang={direct.subtitle.lang ?? "id"}
                label={direct.subtitle.label ?? "Subtitle"}
                default
              />
            )}
            {/* Track subtitle lain (Indonesia & lainnya) — bisa diganti dari menu CC */}
            {(direct?.subTracks ?? [])
              .filter((t: any) => t.url !== direct?.subtitle?.url)
              .map((t: any) => (
                <track
                  key={t.url}
                  kind="subtitles"
                  src={t.url}
                  srcLang={t.lang}
                  label={t.label}
                />
              ))}
          </video>
        )}
        {/* Spinner saat buffering */}
        {waiting && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <Loader2 className="size-10 animate-spin text-white/80" />
          </div>
        )}

        {/* Lapisan tap: sentuh video → kontrol tampil / hilang */}
        <div className="absolute inset-0 z-10" onClick={tapVideo} />

        {/* Overlay controls — di fullscreen tata letaknya menyesuaikan landscape */}
        {controlsOn && (
        <div
          className={cn(
            "pointer-events-none absolute inset-0 z-20 flex flex-col justify-between",
            isFs
              ? "bg-gradient-to-t from-black/70 via-transparent to-black/40 px-6 py-4"
              : "bg-gradient-to-t from-black/80 via-transparent to-black/50",
          )}
        >
          <div
            className={cn(
              "pointer-events-auto flex items-center gap-2",
              isFs ? "px-2 py-1" : "p-3",
            )}
          >
            <button onClick={() => navigate("/")} className="rounded-full bg-black/50 p-2">
              <ChevronLeft className="size-4 text-white" />
            </button>
            <p className="line-clamp-1 text-sm text-white">
              {D.title} {currentEp ? `— Ep ${currentEp.number}` : ""}
            </p>
          </div>
          <div
            className={cn(
              "pointer-events-auto flex items-center justify-center",
              isFs ? "gap-12 pb-3" : "gap-6 pb-2",
            )}
          >
            <button
              disabled={epIndex <= 0}
              onClick={() => navigate(`/nonton?anime=${animeId}&ep=${epList[epIndex - 1].id}`)}
              className={cn("rounded-full bg-black/50 p-2", epIndex <= 0 && "opacity-30")}
            >
              <SkipBack className="size-5 text-white" />
            </button>
            <button onClick={() => skip(-10)} className="rounded-full bg-black/50 p-2">
              <RotateCcw className="size-6 text-white" />
            </button>
            <button onClick={togglePlay} className="rounded-full bg-violet-600 p-4">
              {playing ? <Pause className="size-7 text-white" /> : <Play className="size-7 text-white" />}
            </button>
            <button onClick={() => skip(10)} className="rounded-full bg-black/50 p-2">
              <RotateCw className="size-6 text-white" />
            </button>
            <button
              disabled={epIndex >= epList.length - 1}
              onClick={() => navigate(`/nonton?anime=${animeId}&ep=${epList[epIndex + 1].id}`)}
              className={cn(
                "rounded-full bg-black/50 p-2",
                epIndex >= epList.length - 1 && "opacity-30",
              )}
            >
              <SkipForward className="size-5 text-white" />
            </button>
          </div>
          <div
            className={cn(
              "pointer-events-auto space-y-1.5",
              isFs ? "px-2 pb-1" : "px-3 pb-3",
            )}
          >
            {/* Waktu tujuan saat bar digeser */}
            {scrub !== null && (
              <div className="flex justify-center">
                <span className="rounded-full border border-white/30 bg-black/80 px-2.5 py-0.5 text-[11px] font-bold text-white">
                  {fmt(scrub)} / {fmt(duration)}
                </span>
              </div>
            )}
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.1}
              value={scrub ?? currentTime}
              onChange={(e) => setScrub(Number(e.target.value))}
              onPointerUp={() => scrub !== null && commitScrub(scrub)}
              onPointerCancel={() => setScrub(null)}
              onKeyUp={() => scrub !== null && commitScrub(scrub)}
              onMouseUp={() => scrub !== null && commitScrub(scrub)}
              className="w-full accent-red-500"
            />
            <div className="flex items-center justify-between text-[11px] text-white">
              <span>
                {fmt(scrub ?? currentTime)} / {fmt(duration)}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSpeedOpen((v) => !v)}
                  className="rounded bg-white/15 px-2 py-1"
                >
                  {speed}x
                </button>
                {(direct?.subTracks?.length ?? 0) > 0 && (
                  <button
                    onClick={() => setSubOpen((v) => !v)}
                    className={cn(
                      "rounded px-2 py-1 text-[11px] font-bold",
                      activeSub ? "bg-violet-600 text-white" : "bg-white/15",
                    )}
                    aria-label="Pilih subtitle"
                  >
                    CC
                  </button>
                )}
                <button
                  onClick={async () => {
                    // Kirim ke mini player global (AppLayout) lalu balik ke Home
                    setMiniPlayer({
                      animeId,
                      animeTitle: D.title,
                      animeImage: D.image,
                      episodeNumber: currentEp?.number,
                      streamUrl:
                        sourceType === "hls" && direct?.embedSub
                          ? direct.embedSub
                          : streamUrl,
                      isEmbed: sourceType !== "mp4",
                    });
                    toast.success("Mini player aktif — kembali ke Home");
                    navigate("/home");
                  }}
                  className="rounded bg-white/15 p-1.5"
                  aria-label="Mini player"
                >
                  <PictureInPicture2 className="size-4" />
                </button>
                <button
                  onClick={toggleFullscreen}
                  className="rounded bg-white/15 p-1.5"
                  aria-label="Layar penuh"
                >
                  <Maximize className="size-4" />
                </button>
              </div>
            </div>
            {speedOpen && (
              <div className="flex flex-wrap gap-1.5 rounded-lg bg-black/80 p-2">
                {SPEEDS.map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setSpeed(s);
                      setSpeedOpen(false);
                    }}
                    className={cn(
                      "rounded px-2.5 py-1 text-xs",
                      speed === s ? "bg-violet-600 text-white" : "bg-white/10 text-white",
                    )}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            )}
            {/* Pemilih subtitle (Indonesia dll) */}
            {subOpen && (
              <div className="thin-scroll max-h-40 overflow-y-auto rounded-lg bg-black/90 p-2">
                <button
                  onClick={() => pickSub("")}
                  className={cn(
                    "block w-full rounded px-2 py-1 text-left text-xs",
                    !activeSub ? "bg-violet-600 text-white" : "text-white/80 hover:bg-white/10",
                  )}
                >
                  Matikan subtitle
                </button>
                {(direct?.subTracks ?? []).map((t: any) => (
                  <button
                    key={t.url}
                    onClick={() => pickSub(t.label)}
                    className={cn(
                      "block w-full rounded px-2 py-1 text-left text-xs",
                      activeSub === t.label
                        ? "bg-violet-600 text-white"
                        : "text-white/80 hover:bg-white/10",
                    )}
                  >
                    {t.label}
                    {t.lang === "id" && (
                      <span className="ml-1 rounded bg-emerald-600 px-1 py-0.5 text-[9px] font-bold text-white">
                        ID
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        )}

        {/* Lewati intro (kalau MegaPlay memberi timing intro) */}
        {direct?.intro?.start !== undefined &&
          currentTime >= Number(direct.intro.start) &&
          currentTime < Number(direct.intro.end) && (
            <button
              onClick={() => {
                const v = videoRef.current;
                if (v) v.currentTime = Number(direct.intro.end) + 1;
              }}
              className="absolute bottom-28 right-3 rounded-full border border-white/50 bg-black/75 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-white hover:text-black"
            >
              ⏭ Lewati Intro
            </button>
          )}
      </div>

      {/* Pilih server (SUB/DUB dsb.) — tampil kalau ada >1 sumber */}
      {sources.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5 px-3 pt-2">
          <span className="text-[11px] text-muted-foreground">Server:</span>
          {sources.map((s, i) => (
            <button
              key={s.label + i}
              onClick={() => {
                setSourceIdx(i);
                setSourceType(
                  s.type === "embed" ? "embed" : s.type === "hls" ? "hls" : "mp4",
                );
              }}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-semibold transition",
                i === sourceIdx
                  ? "border-violet-500 bg-violet-500/15 text-violet-300"
                  : "border-border bg-card text-muted-foreground hover:border-violet-500/50",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {/* Info — sinopsis langsung di bawah player, di ATAS episode */}
      <div className="w-full p-3">
        <div className="flex gap-3">
          <img src={D.image} alt="" className="aspect-[2/3] w-16 rounded-lg object-cover" />
          <div className="min-w-0 flex-1">
            <h1 className="line-clamp-2 text-base font-bold">{D.title}</h1>
            <p className={cn("mt-1 text-xs leading-5 text-zinc-400", !synopsisOpen && "line-clamp-3")}>
              {D.synopsisId ?? D.synopsis}
            </p>
            <button
              onClick={() => setSynopsisOpen((v) => !v)}
              className="text-[11px] text-violet-300 underline"
            >
              {synopsisOpen ? "Tutup" : "Baca selengkapnya"}
            </button>
          </div>
        </div>

        {/* Episode: grid + jumlah di kanan atas */}
        <div className="mb-2 mt-4 flex items-center justify-between">
          <h2 className="text-base font-bold">Episode</h2>
          <span className="text-xs text-muted-foreground">{epList.length} episode</span>
        </div>
        <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
          {(epList ?? []).map((e: any) => (
            <button
              key={e.id}
              onClick={() => navigate(`/nonton?anime=${animeId}&ep=${e.id}`)}
              className={cn(
                "rounded-md border py-2 text-xs font-semibold",
                e.id === epParam
                  ? "border-violet-500 bg-violet-500/20 text-red-200"
                  : "border-border bg-secondary/40 text-foreground hover:border-violet-500/60",
              )}
            >
              {e.number}
            </button>
          ))}
        </div>

        {/* Garis pembatas di atas toolbar */}
        <div className="my-3 h-px bg-white/15" />

        {/* Toolbar: kecepatan, download, mini, kualitas — di bawah episode, dipisah garis */}
        <div className="grid grid-cols-4 gap-2">
          <ToolButton
            icon={<Gauge className="size-4" />}
            label={`${speed}x`}
            onClick={() => setSpeedOpen(true)}
          />
          <ToolButton
            icon={<Download className="size-4" />}
            label="Download"
            onClick={() => setDownloadOpen(true)}
          />
          <ToolButton
            icon={<PictureInPicture2 className="size-4" />}
            label="Mini"
            onClick={() => {
              setMiniPlayer({
                animeId,
                animeTitle: D.title,
                animeImage: D.image,
                episodeNumber: currentEp?.number,
                streamUrl,
                isEmbed: sourceType === "embed",
              });
              navigate("/home");
            }}
          />
          <ToolButton
            icon={<Settings2 className="size-4" />}
            label={quality}
            onClick={() => setQualityOpen(true)}
          />
        </div>

        {/* Garis pembatas sebelum diskusi */}
        <div className="my-3 h-px bg-white/15" />

        {/* Komentar episode — gaya baru */}
        <SectionTitle>Diskusi Episode</SectionTitle>
        <CommentsSection
          animeId={epParam ? `${animeId}__ep${epParam}` : animeId}
          comments={episodeComments as unknown as CommentT[]}
          meId={user?._id}
          onSend={async (text, replyToId) => {
            if (!epParam || !user) {
              toast.error("Pilih episode dulu");
              return;
            }
            await postComment({
              animeId: `${animeId}__ep${epParam}`,
              text,
              replyToId: replyToId as never,
            });
          }}
        />
      </div>

      {/* Popups diperbagus */}
      {qualityOpen && (
        <Popup onClose={() => setQualityOpen(false)} title="Pilih kualitas">
          <div className="flex flex-wrap gap-2">
            {QUALITIES.map((q) => (
              <button
                key={q}
                onClick={() => {
                  setQuality(q);
                  setQualityOpen(false);
                }}
                className={cn(
                  "rounded-lg border px-4 py-2 text-sm transition",
                  quality === q
                    ? "border-violet-500 bg-violet-500/15 text-violet-300"
                    : "border-border hover:border-violet-500/50",
                )}
              >
                {q}
              </button>
            ))}
          </div>
        </Popup>
      )}
      {speedOpen && (
        <Popup onClose={() => setSpeedOpen(false)} title="Kecepatan putar">
          <div className="flex flex-wrap gap-2">
            {SPEEDS.map((s) => (
              <button
                key={s}
                onClick={() => {
                  setSpeed(s);
                  setSpeedOpen(false);
                }}
                className={cn(
                  "rounded-lg border px-4 py-2 text-sm transition",
                  speed === s
                    ? "border-violet-500 bg-violet-500/15 text-violet-300"
                    : "border-border hover:border-violet-500/50",
                )}
              >
                {s}x
              </button>
            ))}
          </div>
        </Popup>
      )}
      {downloadOpen && (
        <Popup onClose={() => setDownloadOpen(false)} title="Download kualitas">
          <div className="flex flex-wrap gap-2">
            {QUALITIES.slice(2).map((q) => (
              <button
                key={q}
                onClick={() => {
                  toast.success(`Download dimulai (${q})`);
                  setDownloadOpen(false);
                }}
                className="rounded-lg border border-border px-4 py-2 text-sm transition hover:border-violet-500"
              >
                {q}
              </button>
            ))}
          </div>
        </Popup>
      )}
    </div>
  );
}

function ToolButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1 rounded-xl border border-border bg-card py-2.5 text-[11px] font-medium transition hover:border-violet-500/60"
    >
      {icon}
      {label}
    </button>
  );
}

function fmt(s: number) {
  if (!s || Number.isNaN(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function Popup({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="pop-enter w-full max-w-xs rounded-2xl border border-white/10 bg-popover p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-3 font-semibold">{title}</p>
        {children}
      </div>
    </div>
  );
}

void ChevronDown;
void ChevronUp;
