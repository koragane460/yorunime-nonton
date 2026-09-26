import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, SectionTitle } from "@/components/lstream-ui";
import { ChatPanel, type ChatMsg } from "@/components/ChatPanel";
import {
  ChevronLeft,
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  SkipBack,
  SkipForward,
  X,
  Download,
  PictureInPicture2,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { timeAgo } from "@/lib/lstream";
import type { Id } from "@/convex/_generated/dataModel";

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
  const record = useMutation(api.activities.recordWatch);
  const settings = useQuery(api.users.currentUser, {});

  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(settings?.defaultSpeed ?? 1);
  const [quality, setQuality] = useState(settings?.defaultQuality ?? "720p");
  const [qualityOpen, setQualityOpen] = useState(false);
  const [speedOpen, setSpeedOpen] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [mini, setMini] = useState(false);
  const [miniSize, setMiniSize] = useState({ w: 260, h: 190 });
  const [miniPos, setMiniPos] = useState({ x: 16, y: 16 });
  const [epsOpen, setEpsOpen] = useState(false);
  const [replyMsg, setReplyMsg] = useState<ChatMsg | null>(null);
  const [chatText, setChatText] = useState("");
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [recorded, setRecorded] = useState(false);
  const [sources, setSources] = useState<{ label: string; url: string; type: string }[]>([]);
  const [sourceType, setSourceType] = useState<"mp4" | "embed">("mp4");

  const [detailData, setDetailData] = useState<any>(null);
  const [epData, setEpData] = useState<any>(null);

  const D2 = detailData; void D2;
  const epList = detailData?.episodeList ?? [];
  const epIndex = epList.findIndex((e: any) => e.id === epParam);
  const currentEp = epList[epIndex] ?? epList[0];
  const streamUrl =
    sources[0]?.url ??
    epData?.sources?.[0]?.url ??
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4";

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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animeId, epParam]);

  // Sinkronkan sumber video dari data episode (mp4 langsung / embed iframe)
  useEffect(() => {
    const list = (epData?.sources ?? []) as { label: string; url: string; type: string }[];
    if (list.length > 0) {
      setSources(list);
      setSourceType(list[0]?.type === "embed" ? "embed" : "mp4");
    }
  }, [epData]);

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

  // Mini player drag
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);
  const onMouseDown = (e: React.MouseEvent) => {
    dragRef.current = { dx: e.clientX - miniPos.x, dy: e.clientY - miniPos.y };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragRef.current) return;
    setMiniPos({
      x: Math.max(0, Math.min(window.innerWidth - miniSize.w - 8, e.clientX - dragRef.current.dx)),
      y: Math.max(0, Math.min(window.innerHeight - miniSize.h - 8, e.clientY - dragRef.current.dy)),
    });
  };
  const onMouseUp = () => (dragRef.current = null);

  const episodeComments = useQuery(
    api.activities.listComments,
    epParam ? { animeId: `${animeId}__ep${epParam}` } : "skip",
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
      {/* Player / Mini */}
      {!mini ? (
        <div className="relative bg-black">
          {sourceType === "embed" ? (
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
              src={streamUrl}
              poster={D.image}
              className="aspect-video w-full"
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
              onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
              controls={false}
            />
          )}
          {/* Overlay controls */}
          <div className="absolute inset-0 flex flex-col justify-between bg-gradient-to-t from-black/80 via-transparent to-black/50">
            <div className="flex items-center gap-2 p-3">
              <button
                onClick={() => navigate(-1)}
                className="rounded-full bg-black/50 p-2"
              >
                <ChevronLeft className="size-4 text-white" />
              </button>
              <p className="line-clamp-1 text-sm text-white">
                {D.title} {currentEp ? `— Ep ${currentEp.number}` : ""}
              </p>
            </div>
            <div className="flex items-center justify-center gap-6 pb-2">
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
              <button onClick={togglePlay} className="rounded-full bg-amber-300 p-4">
                {playing ? <Pause className="size-7 text-black" /> : <Play className="size-7 text-black" />}
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
            <div className="space-y-1.5 px-3 pb-3">
              <input
                type="range"
                min={0}
                max={duration || 0}
                step={0.1}
                value={currentTime}
                onChange={(e) => {
                  const v = videoRef.current;
                  if (v) v.currentTime = Number(e.target.value);
                }}
                className="w-full accent-amber-300"
              />
              <div className="flex items-center justify-between text-[11px] text-white">
                <span>
                  {fmt(currentTime)} / {fmt(duration)}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSpeedOpen((v) => !v)}
                    className="rounded bg-white/15 px-2 py-1"
                  >
                    {speed}x
                  </button>
                  <button onClick={() => setMini(true)} className="rounded bg-white/15 p-1.5">
                    <PictureInPicture2 className="size-4" />
                  </button>
                  <button
                    onClick={() => {
                      const el = document.documentElement;
                      if (document.fullscreenElement) void document.exitFullscreen();
                      else void el.requestFullscreen();
                    }}
                    className="rounded bg-white/15 p-1.5"
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
                        speed === s ? "bg-amber-300 text-black" : "bg-white/10 text-white",
                      )}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* MINI PLAYER */
        <div className="min-h-screen p-3">
          <div
            className="fixed z-50 overflow-hidden rounded-xl border border-amber-300/40 shadow-2xl"
            style={{ left: miniPos.x, top: miniPos.y, width: miniSize.w, height: miniSize.h }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
          >
            <div className="relative h-full w-full cursor-move bg-black" onDoubleClick={() => setMini(false)}>
              {sourceType === "embed" ? (
                <iframe
                  src={streamUrl}
                  title="mini"
                  className="size-full"
                  allow="autoplay; encrypted-media; fullscreen"
                  allowFullScreen
                />
              ) : (
                <video
                  ref={videoRef}
                  src={streamUrl}
                  className="size-full object-contain"
                  onClick={togglePlay}
                  onPlay={() => setPlaying(true)}
                  onPause={() => setPlaying(false)}
                />
              )}
              <div className="absolute right-1 top-1 flex gap-1">
                <button
                  className="rounded bg-black/60 p-1"
                  onClick={() => setMiniSize((s) => ({ w: Math.min(480, s.w + 60), h: Math.min(360, s.h + 45) }))}
                >
                  <Maximize className="size-3 text-white" />
                </button>
                <button
                  className="rounded bg-black/60 p-1"
                  onClick={() => setMiniSize((s) => ({ w: Math.max(200, s.w - 60), h: Math.max(150, s.h - 45) }))}
                >
                  <Minimize className="size-3 text-white" />
                </button>
                <button className="rounded bg-black/60 p-1" onClick={() => setMini(false)}>
                  <X className="size-3 text-white" />
                </button>
              </div>
            </div>
          </div>
          <p className="mt-2 text-sm font-semibold">{D.title}</p>
          <p className="text-xs text-muted-foreground">
            Mini player — drag untuk pindah, klik 2x untuk kembali
          </p>
        </div>
      )}

      {/* Info */}
      <div className="mx-auto max-w-2xl p-3">
        <div className="flex gap-3">
          <img src={D.image} alt="" className="aspect-[2/3] w-20 rounded-lg object-cover" />
          <div className="min-w-0 flex-1">
            <h1 className="line-clamp-2 font-bold">{D.title}</h1>
            <p className={cn("mt-1 text-xs leading-5 text-zinc-400", "line-clamp-2")}>
              {D.synopsis}
            </p>
            <button className="text-[11px] text-amber-200 underline">Baca selengkapnya</button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setQualityOpen(true)}
            className="rounded-full border border-border px-3 py-1.5 text-xs"
          >
            ⚙ {quality}
          </button>
          <button
            onClick={() => setSpeedOpen((v) => !v)}
            className="rounded-full border border-border px-3 py-1.5 text-xs"
          >
            ⏩ {speed}x
          </button>
          <button
            onClick={() => setDownloadOpen(true)}
            className="rounded-full border border-border px-3 py-1.5 text-xs"
          >
            <Download className="mr-1 inline size-3.5" /> Download
          </button>
          <button
            onClick={() => setMini(true)}
            className="rounded-full border border-border px-3 py-1.5 text-xs"
          >
            <PictureInPicture2 className="mr-1 inline size-3.5" /> Mini player
          </button>
        </div>

        {/* Episodes */}
        <SectionTitle>
          {allEpisodesShown(epsOpen, epList) ? "Semua" : "10"} Episode ({epList.length})
        </SectionTitle>
        <div className="flex flex-wrap gap-1.5">
          {(epsOpen ? epList : epList.slice(0, 12)).map((e: any) => (
            <button
              key={e.id}
              onClick={() => navigate(`/nonton?anime=${animeId}&ep=${e.id}`)}
              className={cn(
                "size-9 rounded-lg border text-xs font-semibold",
                e.id === epParam
                  ? "border-amber-300 bg-amber-300/20 text-amber-200"
                  : "border-border text-muted-foreground",
              )}
            >
              {e.number}
            </button>
          ))}
        </div>
        {epList.length > 12 && (
          <button
            onClick={() => setEpsOpen((v) => !v)}
            className="mt-2 rounded-full border border-border px-3 py-1 text-xs"
          >
            {epsOpen ? "Tutup" : "Buka semua episode"}
          </button>
        )}

        {/* Chat episode */}
        <SectionTitle>Diskusi Episode</SectionTitle>
        <div className="h-[420px] overflow-hidden rounded-2xl border border-border bg-card">
          <ChatPanel
            kind="global"
            compact
            messages={[] as ChatMsg[]}
            meId={user?._id as string}
            onSend={async (p) => {
              if (!epParam || !user) return;
              await postComment({ animeId: `${animeId}__ep${epParam}`, text: p.text ?? "" });
            }}
          />
        </div>
        <div className="mt-2 space-y-2">
          {(episodeComments ?? []).map((c: any) => (
            <div key={c._id} className="flex items-start gap-2.5 rounded-xl border border-border/60 bg-secondary/30 p-2.5">
              <Avatar src={c.image} seed={c.username} className="size-8" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">
                  {c.username}{" "}
                  <span className="text-[10px] font-normal text-muted-foreground">
                    {timeAgo(c.createdAt)}
                  </span>
                </p>
                <p className="text-sm text-zinc-300">{c.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Popups */}
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
                  "rounded-lg border px-4 py-2 text-sm",
                  quality === q ? "border-amber-300 bg-amber-300/15 text-amber-200" : "border-border",
                )}
              >
                {q}
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
                className="rounded-lg border border-border px-4 py-2 text-sm hover:border-amber-300"
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

function allEpisodesShown(open: boolean, list: unknown[]) {
  return open && list.length > 0;
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="w-full max-w-xs rounded-2xl border border-white/10 bg-card p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-3 font-semibold">{title}</p>
        {children}
      </div>
    </div>
  );
}

// Di bawah ini dipakai reply screen chat episode (dibiarkan sederhana)
function ReplyBox({ msg, onClose, onSend }: { msg: ChatMsg; onClose: () => void; onSend: (t: string) => void }) {
  const [text, setText] = useState("");
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card p-3">
      <div className="mb-2 rounded-lg border-l-2 border-amber-300 bg-amber-300/10 px-3 py-1.5 text-xs">
        <p className="font-medium text-amber-200">{msg.username}</p>
        <p className="truncate text-muted-foreground">{msg.text}</p>
        <button onClick={onClose} className="absolute right-3 top-2">
          <X className="size-3" />
        </button>
      </div>
      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="flex-1 rounded-full border border-input px-4 py-2 text-sm"
          placeholder={`Balas ${msg.username}…`}
        />
        <button
          onClick={() => {
            if (text.trim()) onSend(text);
            onClose();
          }}
          className="rounded-full bg-amber-300 p-2 text-black"
        >
          <Send className="size-4" />
        </button>
      </div>
    </div>
  );
}
