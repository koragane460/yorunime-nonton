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
  Minimize,
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
// Label track subtitle yang dibuat otomatis (diterjemahkan ke Indonesia).
const AUTO_SUB = "Indonesia (otomatis)";

type Cue = { s: number; e: number; t: string };

/** Pilih level HLS yang paling dekat dengan kualitas yang diminta (mis. 720p). */
function applyLevel(hls: Hls | null, quality: string) {
  if (!hls) return;
  const target = parseInt(quality, 10);
  if (!Number.isFinite(target)) return;
  const levels = hls.levels ?? [];
  if (levels.length === 0) return;
  // Level yang tidak lebih tinggi dari target, atau yang paling dekat.
  let best = 0;
  let bestDiff = Infinity;
  levels.forEach((l, i) => {
    const diff = Math.abs((l.height || 0) - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = i;
    }
  });
  hls.currentLevel = best;
}

/** Ubah timestamp WebVTT (00:01:02.500 / 01:02.500) menjadi detik. */
const tsToSec = (s: string) => {
  const parts = String(s)
    .trim()
    .split(":")
    .map((p) => parseFloat(p) || 0);
  if (parts.length === 3)
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] ?? 0;
};

/** Parse WebVTT jadi daftar cue untuk ditampilkan sendiri oleh player. */
function parseVtt(text: string): Cue[] {
  const out: Cue[] = [];
  for (const block of text.replace(/\r/g, "").split(/\n{2,}/)) {
    const lines = block.split("\n").filter((l) => l.trim() !== "");
    const timing = lines.find((l) => l.includes("-->"));
    if (!timing) continue;
    const body = lines
      .slice(lines.indexOf(timing) + 1)
      .join(" ")
      .replace(/<[^>]+>/g, "")
      .trim();
    if (!body) continue;
    const [a, b] = timing.split("-->");
    if (!a || !b) continue;
    out.push({ s: tsToSec(a), e: tsToSec(b), t: body });
  }
  return out;
}

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
  // Resolver tunggal: backend hanya mengembalikan satu server "Direct HLS · SUB"
  const resolveDirect = useAction(api.megaplay.resolveEpisode);
  // Subtitle Indonesia otomatis: subtitle English diterjemahkan di backend
  // lalu dipasang sebagai track di player ini.
  const subtitleIndo = useAction(api.subtitle.subtitleIndo);
  const record = useMutation(api.activities.recordWatch);
  const saveSettings = useMutation(api.account.updateSettings);
  const settings = useQuery(api.users.currentUser, {});

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  // Cache hasil resolve per episode supaya ganti episode tidak nunggu
  // pencarian server lagi (langsung pakai URL yang sudah ada).
  const resolvedRef = useRef<Map<string, any>>(new Map());
  // Kalau user pindah episode saat video masih diputar, episode baru langsung
  // autoplay — tidak perlu mencet pause/play lagi.
  const autoplayNextRef = useRef(false);
  const lastEpRef = useRef<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(settings?.defaultSpeed ?? 1);
  // Default kualitas: selalu 720p, lalu disinkronkan dengan Pengaturan begitu
  // datanya arrive (dan sebaliknya saat user ganti di player).
  const [quality, setQuality] = useState<string>("720p");
  const [qualityTouched, setQualityTouched] = useState(false);
  const [qualityOpen, setQualityOpen] = useState(false);
  // Kualitas yang dipilih di popup (menunggu disimpan), null = belum pilih.
  const [qualityDraft, setQualityDraft] = useState<string | null>(null);
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
  const [autoSubUrl, setAutoSubUrl] = useState("");
  const [autoSubLoading, setAutoSubLoading] = useState(false);
  // Subtitle digambar sendiri (bukan <track> bawaan browser) supaya gaya &
  // lebar teks persis yang kita mau: kotak hitam 50% di belakang teks.
  const [autoVtt, setAutoVtt] = useState("");
  const [cues, setCues] = useState<Cue[]>([]);
  const [activeCue, setActiveCue] = useState<string>("");
  // Subtitle Indonesia native (kalau HLS MegaPlay menyediakan track ID)
  const idTrackLabel =
    (direct?.subTracks ?? []).find((t: any) => t.lang === "id")?.label ?? "";
  // Kalau sumber Sub Indo (xtwap) yang dipakai, subtitle Bahasa Indonesia sudah
  // menempel di dalam berkas video. Subtitle itu milik penyedia konten, bukan
  // milik kita — jadi overlay subtitle kita dimatikan 100% (teks dan kotaknya
  // sama sekali tidak muncul) supaya tidak	doabel/tumpang tindih.
  const bakedSubs = !!direct?.bakedSubs;
  // True kalau subtitle yang aktif versi Bahasa Indonesia.
  const [subTouched, setSubTouched] = useState(false);

  // Ganti subtitle: textTrack yang dipilih = "showing", lainnya dimatikan.
  const pickSub = (label: string) => {
    setActiveSub(label);
    setSubTouched(true);
    setSubOpen(false);
    // Track bawaan browser dimatikan semua — subtitle kita render sendiri.
    const v = videoRef.current;
    if (v) Array.from(v.textTracks).forEach((t) => (t.mode = "disabled"));
  };

  // Subtitle selalu Bahasa Indonesia: track ID native kalau ada, kalau tidak
  // pakai track otomatis (dari subtitle server yang diterjemahkan).
  useEffect(() => {
    if (subTouched) return;
    // Subtitle sudah menempel di video (HLS Sub Indo) → jangan tambah apa-apa.
    if (bakedSubs) {
      setActiveSub("");
      return;
    }
    if (idTrackLabel) {
      setActiveSub(idTrackLabel);
      return;
    }
    if (autoVtt) setActiveSub(AUTO_SUB);
    else if (direct?.subtitle?.url)
      setActiveSub(direct.subtitle.label ?? "Subtitle");
  }, [idTrackLabel, autoVtt, direct, subTouched, bakedSubs]);

  // Ambil isi subtitle terpilih (dari server atau dari track otomatis) lalu
  // simpan sebagai cue untuk digambar sendiri oleh player.
  useEffect(() => {
    if (!activeSub) {
      setCues([]);
      return;
    }
    if (activeSub === AUTO_SUB) {
      if (!autoVtt) {
        setCues([]);
        return;
      }
      setCues(parseVtt(autoVtt));
      return;
    }
    const track =
      (direct?.subtitle?.label === activeSub ? direct?.subtitle : null) ??
      (direct?.subTracks ?? []).find((t: any) => t.label === activeSub);
    if (!track?.url) {
      setCues([]);
      return;
    }
    let alive = true;
    fetch(track.url)
      .then((r) => (r.ok ? r.text() : ""))
      .then((txt) => {
        if (alive && txt) setCues(parseVtt(txt));
      })
      .catch(() => {
        if (alive) setCues([]);
      });
    return () => {
      alive = false;
    };
  }, [activeSub, autoVtt, direct]);

  // Cue yang sedang tampil mengikuti waktu playback.
  useEffect(() => {
    if (cues.length === 0) {
      setActiveCue("");
      return;
    }
    const t = currentTime;
    const hit = cues.find((c) => t >= c.s && t <= c.e);
    setActiveCue(hit?.t ?? "");
  }, [currentTime, cues]);

  // Muat (atau buat) subtitle Indonesia untuk episode ini. Hasil disimpan di
  // localStorage jadi tidak perlu diterjemahkan ulang.
  // Kalau sumber sudah membawa subtitle-nya sendiri (bakedSubs), tidak ada yang
  // perlu diunduh — subtitle animeindo yang ada di dalam video dipakai.
  useEffect(() => {
    const mm = epParam?.match(/^(\d+)__ep(\d+)$/);
    if (!mm || !direct?.ok || bakedSubs) {
      setAutoSubUrl("");
      setAutoSubLoading(false);
      return;
    }
    const key = `yorunime-sub-indo:${mm[1]}:${mm[2]}`;
    setAutoSubUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return "";
    });
    const cached = (() => {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    })();
    setAutoVtt("");
    if (cached && cached.includes("WEBVTT")) {
      setAutoVtt(cached);
      return;
    }
    let alive = true;
    setAutoSubLoading(true);
    subtitleIndo({ malId: mm[1], ep: Number(mm[2]) || 1 })
      .then((r: any) => {
        if (!alive || !r?.ok || !r.vtt) return;
        try {
          localStorage.setItem(key, r.vtt);
        } catch {
          /* storage penuh — subtitle tetap dipakai di session ini */
        }
        setAutoVtt(r.vtt);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setAutoSubLoading(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [epParam, bakedSubs, !!direct?.ok]);

  const [detailData, setDetailData] = useState<any>(null);

  const epList = detailData?.episodeList ?? [];
  const epIndex = epList.findIndex((e: any) => e.id === epParam);
  const currentEp = epList[epIndex] ?? epList[0];
  const streamUrl = sources[sourceIdx]?.url ?? sources[0]?.url ?? "";

  useEffect(() => {
    if (animeId) {
      detail({ id: animeId })
        .then((d: any) => {
          setDetailData(d);
          // Tanpa parameter episode → langsung buka episode 1.
          if (!epParam) {
            const first = d?.episodeList?.[0]?.id;
            if (first) {
              navigate(`/nonton?anime=${animeId}&ep=${first}`, { replace: true });
            }
          }
        })
        .catch(() => setDetailData({ error: true }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animeId, epParam]);

  // Ambil server streaming. Menunggu detail selesai supaya judul anime bisa
  // dipakai mencari sumber subtitle Indonesia. Backend mengembalikan tepat satu
  // server: "Direct HLS · SUB".
  useEffect(() => {
    if (!epParam || !detailData || detailData.error) return;
    const mm = epParam.match(/^(\d+)__ep(\d+)$/);
    if (!mm) return;
    const key = `${mm[1]}__ep${Number(mm[2]) || 1}`;
    const applyData = (d: any) => {
      if (!d?.ok) {
        setDirectErr(d?.reason ?? "Episode belum tersedia");
        return;
      }
      setDirectErr(null);
      setDirect(d);
      setSubTouched(false);
      setSources(d.sources);
      setSourceType(
        d.sources?.[0]?.type === "hls"
          ? "hls"
          : d.sources?.[0]?.type === "mp4"
            ? "mp4"
            : "embed",
      );
      setSourceIdx(0);
    };

    // Ganti episode → episode lama langsung dihapus total, tidak ada frame sisa.
    // Kalau perpindahan terjadi saat video masih diputar, tandai untuk autoplay.
    if (lastEpRef.current && lastEpRef.current !== epParam) {
      const v = videoRef.current;
      autoplayNextRef.current = !!(v && !v.paused && !v.ended);
    }
    lastEpRef.current = epParam;
    setSources([]);
    setDirect(null);
    setDirectErr(null);
    setCurrentTime(0);
    setDuration(0);
    setCues([]);
    setActiveCue("");
    setActiveSub("");
    setSourceType("mp4");

    // Sudah ada di cache → langsung main tanpa nunggu server.
    const cached = resolvedRef.current.get(key);
    if (cached) {
      applyData(cached);
      return;
    }
    resolveDirect({
      malId: mm[1],
      ep: Number(mm[2]) || 1,
      title: detailData.title,
    })
      .then((d: any) => {
        if (d?.ok) resolvedRef.current.set(key, d);
        applyData(d);
      })
      .catch((e: any) => setDirectErr(e?.message ?? "Gagal memuat episode"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailData, epParam]);

  // Pramuat episode di sekitar episode aktif (sebelum & sesudah) di
  // latar belakang: saat user menekan episode lain, URL-nya sudah siap sehingga
  // playback langsung jalan tanpa jeda loading.
  useEffect(() => {
    if (!epParam || !detailData || detailData.error) return;
    const targets = [epList[epIndex - 1], epList[epIndex + 1]].filter(Boolean);
    if (targets.length === 0) return;
    let alive = true;
    const jobs = targets.map((next: any) => {
      const mm = next?.id?.match?.(/^(\d+)__ep(\d+)$/);
      if (!mm) return null;
      const key = `${mm[1]}__ep${Number(mm[2]) || 1}`;
      if (resolvedRef.current.has(key)) return null;
      return resolveDirect({
        malId: mm[1],
        ep: Number(mm[2]) || 1,
        title: detailData.title,
      })
        .then((d: any) => {
          if (alive && d?.ok) resolvedRef.current.set(key, d);
        })
        .catch(() => {});
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [epParam, epIndex, epList, detailData]);

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
      hlsRef.current = hls;
      hls.loadSource(streamUrl);
      hls.attachMedia(v);
      // Pasang level sesuai kualitas yang dipilih begitu manifest terbaca.
      hls.on(Hls.Events.MANIFEST_PARSED, () => applyLevel(hls, quality));
      hls.on(Hls.Events.ERROR, (_evt, data) => {
        if (data.fatal) toast.error("Gagal memuat stream, coba muat ulang");
      });
    } else {
      v.src = streamUrl;
    }
    return () => {
      hlsRef.current = null;
      hls?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceType, streamUrl]);

  // Ganti kualitas saat nonton → langsung terapkan ke level HLS yang aktif.
  // Di landscape (fullscreen) video otomatis dinaikkan ke HD tertinggi supaya
  // layar besar tidak membuat gambar terlihat buram.
  useEffect(() => {
    if (!hlsRef.current) return;
    applyLevel(hlsRef.current, isFs ? "1080p" : quality);
  }, [quality, isFs]);

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

  // Pengaturan → player: ikut berubah kalau user ubah kualitas di Pengaturan.
  useEffect(() => {
    if (qualityTouched) return;
    const fromSettings = settings?.defaultQuality;
    if (!fromSettings) return;
    setQuality(fromSettings);
  }, [settings?.defaultQuality, qualityTouched]);

  // Player → Pengaturan: ganti kualitas di player tersimpan ke Pengaturan.
  // Dua tahap: pilih dulu di popup, baru tekan Simpan baru benar-benar dipakai
  // dan disimpan — jadi tidak menimpa nilai lama karena salah sentuh.
  const saveQuality = () => {
    if (!qualityDraft) return;
    setQuality(qualityDraft);
    setQualityTouched(true);
    setQualityOpen(false);
    setQualityDraft(null);
    void saveSettings({ defaultQuality: qualityDraft }).catch(() => {
      /* simpan lokal tetap berjalan walau server gagal */
    });
  };

  const cancelQuality = () => {
    setQualityDraft(null);
    setQualityOpen(false);
  };

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

  // Kontrol video: tap untuk tampil/sembunyi, auto-hide 3 detik saat diputar.
  // Timer hanya bergantung pada [playing, controlsOn] (bukan currentTime),
  // jadi tidak terus dibatalkan oleh update waktu video.
  const tapVideo = () => setControlsOn((v) => !v);

  useEffect(() => {
    if (!playing) {
      setControlsOn(true);
      return;
    }
    if (!controlsOn) return;
    const t = window.setTimeout(() => setControlsOn(false), 3000);
    return () => clearTimeout(t);
  }, [playing, controlsOn]);

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
  // Tombol CC muncul kalau ada track subtitle apa pun (termasuk subtitle
  // Indonesia yang sedang dibuat otomatis).
  const hasSubMenu = !bakedSubs && (
    (direct?.subTracks?.length ?? 0) > 0 || !!autoVtt || autoSubLoading
  );

  return (
    <div className="min-h-screen pb-24">
      {/* Tombol kembali — selalu terlihat di kiri atas */}
      {!isFs && (
        <button
          onClick={() => (history.length > 1 ? navigate(-1) : navigate("/home"))}
          className="fixed left-3 top-3 z-40 rounded-full bg-black/55 p-2 backdrop-blur"
          aria-label="Kembali"
        >
          <ChevronLeft className="size-5 text-white" />
        </button>
      )}
      {/* Player — di fullscreen video tidak di-stretch: area dipagrasio 16:9
          dan dipusatkan di tengah layar (letterbox), subtitle tetap terlihat. */}
      <div
        ref={playerRef}
        className={cn(
          "relative flex w-full items-center justify-center bg-black",
          isFs && "h-[100dvh]",
        )}
      >
      <div
        className="relative w-full overflow-hidden bg-black"
        style={
          isFs
            ? {
                aspectRatio: "16 / 9",
                maxHeight: "100dvh",
                width: "min(100%, calc(100dvh * 16 / 9))",
              }
            : { aspectRatio: "16 / 9" }
        }
      >
        {!streamUrl ? (
          <div
            className="flex h-full w-full flex-col items-center justify-center gap-2 bg-black text-center"
            style={D.image ? { backgroundImage: `url(${D.image})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
          >
            <div className="absolute inset-0 bg-black/65" />
            <div className="relative flex flex-col items-center px-6">
              {directErr ? (
                <>
                  <p className="text-sm font-bold text-white">{directErr}</p>
                  <p className="mt-1 text-xs text-white/70">
                    {D.status === "Upcoming"
                      ? "Judul ini belum tayang, cek jadwal rilisnya"
                      : "Coba episode lain atau kembali ke halaman anime"}
                  </p>
                  <button
                    onClick={() => navigate("/home")}
                    className="mt-3 rounded-full border border-white/40 px-4 py-1.5 text-xs font-bold text-white"
                  >
                    Kembali ke Home
                  </button>
                </>
              ) : (
                <>
                  <Loader2 className="size-8 animate-spin text-white/80" />
                  <p className="mt-2 text-xs text-white/80">
                    Memuat episode {currentEp ? currentEp.number : ""}...
                  </p>
                </>
              )}
            </div>
          </div>
        ) : sourceType === "embed" ? (
          <iframe
            src={streamUrl}
            title={D.title}
            className="h-full w-full"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
          />
        ) : (
          <video
            key={epParam}
            ref={videoRef}
            src={sourceType === "mp4" ? streamUrl : undefined}
            poster={D.image}
            className="h-full w-full object-contain"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
            onLoadedMetadata={(e) => {
              setDuration(e.currentTarget.duration);
              // Episode baru langsung diputar kalau sebelumnya masih diputar.
              if (autoplayNextRef.current) {
                autoplayNextRef.current = false;
                void e.currentTarget.play().catch(() => {});
              }
            }}
            onWaiting={() => setWaiting(true)}
            onPlaying={() => setWaiting(false)}
            onCanPlay={() => setWaiting(false)}
            // Preload agresif: frame pertama sudah siap sebelum pencet play,
            // sehingga tidak perlu lama loading.
            preload="auto"
            playsInline
            controls={false}
          >
            {direct?.subtitle?.url && (
              <track
                kind="subtitles"
                src={direct.subtitle.url}
                srcLang={direct.subtitle.lang ?? "id"}
                label={direct.subtitle.label ?? "Subtitle"}
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
        {/* Subtitle digambar sendiri: kotak hitam 50% di belakang teks, teks
            dibungkus rapat dan tidak melebar ke samping. */}
        {activeCue && !bakedSubs && (
          <div
            className={cn(
              "pointer-events-none absolute inset-x-0 z-20 flex justify-center px-4",
              // Portrait: di atas bar kontrol. Fullscreen: sedikit lebih tinggi
              // supaya tidak tertutup tombol di kanan bawah.
              isFs ? "bottom-12" : "bottom-16 sm:bottom-20",
            )}
          >
            {/* Gaya subtitle ala animeindo: teks putih semi-bold dengan outline
                hitam tebal, tanpa kotak background di belakang teks. */}
            <p
              className={cn(
                "max-w-[min(90%,42rem)] text-center font-semibold leading-snug text-white",
                "[text-shadow:-2px_-2px_0_#000,2px_-2px_0_#000,-2px_2px_0_#000,2px_2px_0_#000,0_2px_3px_rgba(0,0,0,0.9)]",
                isFs ? "text-[15px] sm:text-[18px]" : "text-[13px] sm:text-[15px]",
              )}
            >
              {activeCue}
            </p>
          </div>
        )}

        {/* Spinner saat buffering */}
        {waiting && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <Loader2 className="size-10 animate-spin text-white/80" />
          </div>
        )}

        {/* Lapisan tap: sentuh video → kontrol tampil / hilang */}
        {sourceType !== "embed" && (
          <div
            className="absolute inset-0 z-10"
            onPointerUp={tapVideo}
          />
        )}

        {/* Tombol keluar layar penuh — tetap ada walau kontrol disembunyikan */}
        {isFs && (
          <button
            onClick={toggleFullscreen}
            className="absolute right-3 top-3 z-30 rounded-full bg-black/55 p-2"
            aria-label="Keluar layar penuh"
          >
            <Minimize className="size-5 text-white" />
          </button>
        )}

        {/* Overlay controls — di fullscreen tata letaknya menyesuaikan landscape */}
        {controlsOn && sourceType !== "embed" && (
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
                {hasSubMenu && (
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
                      streamUrl: streamUrl,
                      isEmbed: false,
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
                {/* Subtitle Indonesia otomatis (dari subtitle server) */}
                <button
                  onClick={() => autoVtt && pickSub(AUTO_SUB)}
                  disabled={!autoVtt}
                  className={cn(
                    "block w-full rounded px-2 py-1 text-left text-xs",
                    activeSub === AUTO_SUB
                      ? "bg-violet-600 text-white"
                      : "text-white/80 hover:bg-white/10",
                    !autoVtt && "opacity-50",
                  )}
                >
                  {autoSubLoading && !autoVtt
                    ? "Menerjemahkan subtitle…"
                    : AUTO_SUB}
                  <span className="ml-1 rounded bg-emerald-600 px-1 py-0.5 text-[9px] font-bold text-white">
                    ID
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
        )}

        {/* Embed (server Sub Indo): iframe-nya harus bisa disentuh, tapi
            kerangka/UI-nya tetap milik kita — bar atas & bawah sendiri. */}
        {sourceType === "embed" && streamUrl && (
          <>
            <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center gap-2 bg-gradient-to-b from-black/75 to-transparent px-3 py-2">
              <button
                onClick={() => navigate("/home")}
                className="pointer-events-auto rounded-full bg-black/50 p-2"
                aria-label="Kembali"
              >
                <ChevronLeft className="size-4 text-white" />
              </button>
              <p className="line-clamp-1 text-xs font-semibold text-white">
                {D.title}
                {currentEp ? ` — Ep ${currentEp.number}` : ""}
              </p>
              <span className="ml-auto shrink-0 rounded bg-emerald-600 px-1.5 py-0.5 text-[9px] font-bold text-white">
                SUB ID
              </span>
            </div>
            <div className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-end px-2 py-2">
              <button
                onClick={toggleFullscreen}
                className="rounded bg-black/55 p-1.5"
                aria-label="Layar penuh"
              >
                <Maximize className="size-4 text-white" />
              </button>
            </div>
          </>
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
              Lewati Intro
            </button>
          )}
      </div>
      </div>

      {/* Server: hanya satu — Direct HLS · SUB */}
      {sources.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 px-3 pt-2">
          <span className="text-[11px] text-muted-foreground">Server:</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-500 bg-violet-500/15 px-3 py-1 text-xs font-semibold text-violet-300">
            {sources[sourceIdx]?.label ?? "Direct HLS · SUB"}
            <span className="rounded bg-emerald-600 px-1 py-0.5 text-[9px] font-bold text-white">
              ID
            </span>
          </span>
        </div>
      )}

      {/* Info — sinopsis langsung di bawah player, di ATAS episode */}
      <div className="w-full p-3">
        <div className="flex items-start gap-3">
          <img
            src={D.image}
            alt=""
            className="aspect-[2/3] w-16 shrink-0 self-start rounded-lg object-cover"
          />
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
            onClick={() => {
              setQualityDraft(quality);
              setQualityOpen(true);
            }}
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
        <Popup onClose={cancelQuality} title="Pilih kualitas">
          <div className="flex flex-wrap gap-2">
            {QUALITIES.map((q) => (
              <button
                key={q}
                onClick={() => setQualityDraft(q)}
                className={cn(
                  "rounded-lg border px-4 py-2 text-sm transition",
                  (qualityDraft ?? quality) === q
                    ? "border-violet-500 bg-violet-500/15 text-violet-300"
                    : "border-border hover:border-violet-500/50",
                )}
              >
                {q}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Kualitas ini juga berubah di Pengaturan.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={cancelQuality}
              className="flex-1 rounded-full border border-border py-2 text-xs font-semibold text-muted-foreground"
            >
              Batal
            </button>
            <button
              onClick={saveQuality}
              disabled={!qualityDraft || qualityDraft === quality}
              className="flex-1 rounded-full bg-violet-600 py-2 text-xs font-bold text-white disabled:opacity-40"
            >
              Simpan
            </button>
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
