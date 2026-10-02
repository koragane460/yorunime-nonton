import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Sun,
  Volume2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { NobarDock } from "@/components/NobarDock";
import type { Id } from "@/convex/_generated/dataModel";

const QUALITIES = ["144p", "240p", "360p", "480p", "720p", "1080p"];
/** 1080p hanya untuk akun premium. */
const PREMIUM_QUALITY = "1080p";
/** Penjelasan singkat tiap kualitas — ditampilkan di bawah pilihannya. */
const QUALITY_INFO: Record<string, string> = {
  "144p": "Paling ringan, paling hemat kuota data.",
  "240p": "Ringan, cocok buat HP lama atau jaringan lambat.",
  "360p": "HD ringan. Sudah cukup jelas di layar HP.",
  "480p": "HD sedang. Bagus buat HP kelas menengah dan Wi-Fi biasa.",
  "720p": "Full HD. Paling stabil, recommended buat semua.",
  "1080p": "Full HD+. Detail paling tajam, khusus Premium.",
};
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
// Label track subtitle yang dibuat otomatis (diterjemahkan ke Indonesia).
const AUTO_SUB = "Indonesia (otomatis)";

type Cue = { s: number; e: number; t: string };

/** Tinggi (piksel) sebuah level HLS. Beberapa server tidak mengisi `height`,
 *  jadi dibaca juga dari nama level / URL (mis. "720p" atau "/720/index.m3u8"). */
function levelHeight(level: { height?: number; name?: string; url?: string[] }): number {
  if (level.height && level.height > 0) return level.height;
  const hay = `${level.name ?? ""} ${(level.url ?? []).join(" ")}`;
  const m = hay.match(/(\d{3,4})p\b/) ?? hay.match(/\/(\d{3,4})\//);
  return m ? Number(m[1]) : 0;
}

/** Daftar resolusi yang benar-benar tersedia di stream HLS ini. */
function availableQualities(hls: Hls | null): number[] {
  if (!hls) return [];
  return (hls.levels ?? [])
    .map((l) => levelHeight(l as never))
    .filter((h) => h > 0)
    .sort((a, b) => a - b);
}

/**
 * Pilih level HLS yang benar-benar berpindah. Mengambil level tertinggi yang
 * TIDAK lebih besar dari target (kalau tidak ada, ambil yang terdekat), lalu
 * mengunci `currentLevel` supaya hls.js tidak mengabaikannya.
 */
function applyLevel(hls: Hls | null, quality: string) {
  if (!hls) return;
  const target = parseInt(quality, 10);
  if (!Number.isFinite(target)) return;
  const levels = hls.levels ?? [];
  if (levels.length <= 1) return;
  const heights = levels.map((l) => levelHeight(l as never));
  let best = -1;
  // 1) level tertinggi yang masih <= target
  heights.forEach((h, i) => {
    if (h > 0 && h <= target && (best === -1 || h > heights[best]!)) best = i;
  });
  // 2) kalau tidak ada, ambil yang paling dekat
  if (best === -1) {
    let bestDiff = Infinity;
    heights.forEach((h, i) => {
      if (h <= 0) return;
      const d = Math.abs(h - target);
      if (d < bestDiff) {
        bestDiff = d;
        best = i;
      }
    });
  }
  if (best === -1) return;
  hls.currentLevel = best;
  // autoLevelCapSize tidak dipakai; currentLevel yang mengunci pilihan user.
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

/** Durasi minimum satu baris subtitle (detik). */
const CUE_MIN = 1.1;
/** Jeda sebelum subtitle hilang (detik), biar sempat dibaca. */
const CUE_TAIL = 0.5;

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
    const s = tsToSec(a);
    const e = tsToSec(b);
    if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) continue;
    // Timing subtitle animeindo: satu baris selalu punya waktu baca minimum dan
    // tidak hilang tepat di akhir kalimat.
    out.push({ s, e: Math.max(e, s + CUE_MIN) + CUE_TAIL, t: body });
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

  // ------------------------------------------------------ mode Nobar ----
  // Kalau URL punya ?room=…, halaman ini dipakai sebagai room nonton bareng:
  // anime dan episode mengikuti room, host yang mengatur playback.
  const roomParam = params.get("room");
  const roomId = (roomParam ?? null) as Id<"watchRooms"> | null;
  const roomInfo = useQuery(
    api.watchroom.roomDetail,
    roomId ? { roomId } : "skip",
  );
  const room = roomInfo?.allowed && roomInfo.room ? roomInfo.room : null;
  const isHost = !!roomInfo?.isHost;
  const joinRoom = useMutation(api.watchroom.joinRoom);
  const leaveRoom = useMutation(api.watchroom.leaveRoom);
  const roomSetPosition = useMutation(api.watchroom.setPosition);
  const roomSetPlaying = useMutation(api.watchroom.setPlaying);
  const roomSetEpisode = useMutation(api.watchroom.setEpisode);
  const endRoom = useMutation(api.watchroom.endRoom);
  const [joinedRoom, setJoinedRoom] = useState(false);

  const animeId = params.get("anime") ?? room?.animeId ?? "";
  const epParam =
    params.get("ep") ?? (room ? `${room.animeId}__ep${room.episode}` : null);

  // Otomatis join begitu membuka room (kecuali room yang membatasi peserta).
  useEffect(() => {
    if (!roomId || !room || joinedRoom) return;
    setJoinedRoom(true);
    void joinRoom({ roomId }).catch(() => {
      /* room penuh/ditutup — biarkan, tampilan tetap jalan */
    });
  }, [roomId, room, joinedRoom, joinRoom]);

  // Kembali dari nonton: JANGAN kembali ke episode sebelumnya (makanya tidak
  // pakai navigate(-1)); langsung ke beranda dari atas.
  const goBackFromWatch = () => {
    try {
      window.scrollTo({ top: 0 });
    } catch {
      /* abaikan */
    }
    navigate("/home");
  };

  useEffect(() => {
    if (roomInfo?.ended) {
      toast.info("Host mengakhiri sesi nonton bareng");
      navigate("/home", { replace: true });
    }
  }, [roomInfo?.ended, navigate]);


  const detail = useAction(api.anime.animeDetail);
  // Resolver tunggal: backend hanya mengembalikan satu server "Direct HLS · SUB"
  const resolveDirect = useAction(api.megaplay.resolveEpisode);
  // Subtitle Indonesia otomatis: subtitle English diterjemahkan di backend
  // lalu dipasang sebagai track di player ini.
  const subtitleIndo = useAction(api.subtitle.subtitleIndo);
  const record = useMutation(api.activities.recordWatch);
  const saveProgress = useMutation(api.activities.saveProgress);
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
  // Posisi playback yang harus dipulihkan setelah transisi layar penuh.
  const resumeAtRef = useRef(0);
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
  const [sources, setSources] = useState<
    { label: string; url: string; type: string; baked?: boolean }[]
  >([]);
  const [sourceType, setSourceType] = useState<"mp4" | "embed" | "hls">("mp4");
  const [sourceIdx, setSourceIdx] = useState(0);
  // Server yang sudah dicoba dan gagal untuk episode ini, supaya auto-failover
  // tidak berputar ke server yang sama.
  const deadServers = useRef<Set<string>>(new Set());
  const [synopsisOpen, setSynopsisOpen] = useState(false);
  // Hasil resolve MegaPlay: subtitle, timing intro/outro, embed cadangan
  const [direct, setDirect] = useState<any>(null);
  // Alasan stream tidak tersedia (mis. judul upcoming belum tayang)
  const [directErr, setDirectErr] = useState<string | null>(null);
  const [autoSubUrl, setAutoSubUrl] = useState("");
  const [autoSubLoading, setAutoSubLoading] = useState(false);
  // Pesan singkat kalau subtitle Indonesia gagal dibuat (server subtitles
  // aslinya yang dipakai, atau subtitledita lewat fallback).
  const [autoSubError, setAutoSubError] = useState("");
  // Asal subtitle otomatis: "indo" (track Indonesia asli), "auto" (diterjemahkan)
  // atau "raw" (terjemahan gagal, teks masih bahasa aslinya).
  const [autoSubSource, setAutoSubSource] = useState("");
  // Tombol "Coba lagi" di menu subtitle menambah angka ini untuk memicu
  // pembuatan ulang subtitle Indonesia.
  const [subRetry, setSubRetry] = useState(0);
  // Subtitle digambar sendiri (bukan <track> bawaan browser) supaya gaya &
  // lebar teks persis yang kita mau: teks putih dengan outline hitam tebal.
  const [autoVtt, setAutoVtt] = useState("");
  const [cues, setCues] = useState<Cue[]>([]);
  const [activeCue, setActiveCue] = useState<string>("");
  // Subtitle Indonesia native (kalau HLS MegaPlay menyediakan track ID)
  const idTrackLabel =
    (direct?.subTracks ?? []).find((t: any) => t.lang === "id")?.label ?? "";
  // Subtitle Indonesia yang menempel di dalam berkas video hanya ada di server
  // HLS/MP4 Sub Indo. Begitu user pindah ke server embed atau MegaPlay, teks itu
  // hilang — jadi overlay subtitle kita harus hidup lagi, dihitung per server
  // yang sedang diputar, bukan sekali per episode.
  const currentSrc = sources[sourceIdx] ?? sources[0];
  const bakedSubs = !!currentSrc?.baked;
  // Notifikasi kecepatan di dalam player (mis. "2× speed") seperti subtitle:
  // muncul sebentar di tengah atas lalu hilang sendiri.
  const [speedNotice, setSpeedNotice] = useState("");
  const speedNoticeTimer = useRef<number | null>(null);
  const speedReadyRef = useRef(false);

  // ------------------------------------------------------- kualitas ----
  // Resolusi yang benar-benar ada di stream HLS yang sedang diputar, supaya
  // pilihan 144p/480p/1080p benar-benar menghasilkan gambar yang berbeda.
  const [levels, setLevels] = useState<number[]>([]);
  const isPremium = (user?.premiumUntil ?? 0) > Date.now();
  // Tampilkan info "1080p khusus Premium" ketika user menekan 1080p.
  const [premiumTapHint, setPremiumTapHint] = useState(false);

  // ------------------------------------- gesture brightness & volume ----
  // Seret ke atas di tengah-kiri = pencahayaan, seret ke atas di kanan = suara.
  // Netral (50%) = tampilan & suara normal. Tarik penuh ke atas = maksimal
  // (paling terang / paling keras), bukan sekadar "100% = biasa".
  const BRIGHT_MIN = 0.25;
  const BRIGHT_MAX = 2.6;
  const VOL_MAX = 2; // 2x suara lewat Web Audio (volume HTML mentok di 1)
  const brightnessToLevel = (b: number) =>
    (b - BRIGHT_MIN) / (BRIGHT_MAX - BRIGHT_MIN);
  const levelToBrightness = (l: number) =>
    BRIGHT_MIN + l * (BRIGHT_MAX - BRIGHT_MIN);
  /** 1 = volume normal, >1 = lebih keras dari maksimal bawaan. */
  const gainRef = useRef<number>(1);
  const audioRef = useRef<{
    ctx: AudioContext;
    gain: GainNode;
  } | null>(null);

  const [brightness, setBrightness] = useState(1);
  const [volumeLevel, setVolumeLevel] = useState(0.5);
  const [gesture, setGesture] = useState<null | {
    kind: "brightness" | "volume";
    value: number;
  }>(null);
  const gestureRef = useRef<{
    kind: "brightness" | "volume";
    startY: number;
    startValue: number;
    moved: boolean;
  } | null>(null);
  const gestureHideTimer = useRef<number | null>(null);

  // Pindah episode = elemen <video> baru. AudioContext lama masih terpasang
  // ke elemen yang sudah dibuang, jadi harus dilepas; kalau tidak, suara
  // episode berikutnya bisa hilang.
  useEffect(() => {
    const a = audioRef.current;
    audioRef.current = null;
    if (a) {
      try {
        void a.ctx.close();
      } catch {
        /* context sudah tertutup */
      }
    }
    const v = videoRef.current;
    if (v) v.volume = Math.min(1, gainRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [epParam]);

  const endGesture = (wasDrag: boolean) => {
    gestureRef.current = null;
    if (gestureHideTimer.current) window.clearTimeout(gestureHideTimer.current);
    if (wasDrag) {
      // HUD tetap sebentar supaya user tahu hasilnya, lalu menghilang.
      gestureHideTimer.current = window.setTimeout(() => setGesture(null), 650);
    } else {
      setGesture(null);
    }
  };

  /**
   * Volume di atas 100% butuh Web Audio (volume elemen video mentok di 1).
   * Kalau browser tidak bisa (atau media-nya cross-origin tanpa CORS),
   * otomatis jatuh ke volume biasa.
   */
  const applyVolume = (level: number) => {
    const v = videoRef.current;
    if (!v) return;
    const l = Math.max(0, Math.min(1, level));
    setVolumeLevel(l);
    if (l === 0) {
      v.muted = true;
    } else {
      v.muted = false;
    }
    const gainValue = l * VOL_MAX;
    gainRef.current = gainValue;
    if (!audioRef.current && l > 0.5) {
      try {
        const Ctor =
          window.AudioContext ??
          (window as any).webkitAudioContext;
        if (Ctor && !v.crossOrigin?.includes("anonymous")) {
          const ctx: AudioContext = new Ctor();
          const src = ctx.createMediaElementSource(v);
          const gain = ctx.createGain();
          gain.gain.value = gainValue;
          src.connect(gain);
          gain.connect(ctx.destination);
          void ctx.resume?.();
          audioRef.current = { ctx, gain };
          v.volume = 1;
          // PENTING: begitu video disambungkan ke Web Audio, suara hanya
          // keluar lewat AudioContext. Kalau context-nya belum running,
          // suara hilang total. Kalau setelah 400ms masih belum running,
          // kembalikan ke volume bawaan video saja.
          window.setTimeout(() => {
            if (audioRef.current?.ctx !== ctx) return;
            if (ctx.state !== "running") {
              audioRef.current = null;
              v.volume = Math.min(1, gainValue);
            }
          }, 400);
          return;
        }
      } catch {
        audioRef.current = null;
      }
    }
    if (audioRef.current) {
      if (audioRef.current.ctx.state !== "running") void audioRef.current.ctx.resume?.();
      audioRef.current.gain.gain.value = gainValue;
      v.volume = 1;
    } else {
      // Fallback: volume elemen video hanya sampai 1.
      v.volume = Math.min(1, gainValue);
    }
  };

  // True kalau subtitle yang aktif versi Bahasa Indonesia.
  const [subTouched, setSubTouched] = useState(false);

  // Komentar dengan echo lokal: pesan langsung tampil sebelum server menyalinnya.
  const [pendingComments, setPendingComments] = useState<CommentT[]>([]);

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

  // Cue yang sedang tampil mengikuti waktu playback. Pencarian dari belakang:
  // begitu cue berikutnya mulai, yang lama langsung diganti — bukan menunggu
  // cue lama benar-benar habis.
  useEffect(() => {
    if (cues.length === 0) {
      setActiveCue("");
      return;
    }
    const t = currentTime;
    let hit: Cue | null = null;
    for (const c of cues) {
      if (c.s <= t) hit = c;
      else break;
    }
    setActiveCue(hit && t <= hit.e ? hit.t : "");
  }, [currentTime, cues]);

  // Muat (atau buat) subtitle Indonesia untuk episode ini. Hasil disimpan di
  // localStorage jadi tidak perlu diterjemahkan ulang.
  // Kalau server yang sedang diputar sudah membawa subtitle Indonesia sendiri
  // (bakedSubs), tidak ada yang perlu diunduh. Begitu user pindah ke server lain
  // (embed atau MegaPlay), subtitle Indonesia kita dimuat ulang untuk menimpa
  // subtitle English milik server tersebut.
  useEffect(() => {
    if (!epParam || !direct?.ok || bakedSubs) {
      setAutoSubUrl("");
      setAutoSubLoading(false);
      return;
    }
    const mm = epParam.match(/^(\d+)__ep(\d+)$/);
    // Episode tanpa MAL id (mis. Otakudesu) tidak punya sumber subtitle
    // Inggris untuk diterjemahkan, jadi tidak ada yang bisa dimuat.
    const malId = mm ? mm[1] : (/^\d+$/.test(animeId ?? "") ? animeId : "");
    if (!malId) {
      setAutoSubLoading(false);
      return;
    }
    const epNo =
      mm
        ? Number(mm[2]) || 1
        : (detailData?.episodeList ?? []).find((e: any) => e.id === epParam)
            ?.number ?? 1;
    const key = `yorunime-sub-indo:${malId}:${epNo}`;
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
    setAutoSubError("");
    setAutoSubSource("");
    if (cached && cached.includes("WEBVTT")) {
      setAutoVtt(cached);
      return;
    }
    let alive = true;
    setAutoSubLoading(true);
    subtitleIndo({ malId, ep: Number(epNo) || 1 })
      .then((r: any) => {
        if (!alive) return;
        if (!r?.ok || !r.vtt) {
          setAutoSubError(
            r?.reason && r.reason !== "Subtitle tidak tersedia"
              ? `Subtitle Indonesia gagal dibuat (${r.reason})`
              : "Subtitle Indonesia belum tersedia untuk episode ini",
          );
          return;
        }
        try {
          localStorage.setItem(key, r.vtt);
        } catch {
          /* storage penuh — subtitle tetap dipakai di session ini */
        }
        setAutoVtt(r.vtt);
        setAutoSubSource(String(r.source ?? "auto"));
        // Terjemahan gagal: teksnya masih bahasa aslinya. Tetap dipakai supaya
        // tidak ada layar tanpa subtitle, tapi user diberi tahu + jalan coba lagi.
        if (r.source === "raw")
          setAutoSubError("Terjemahan subtitle gagal, dipakai subtitle asli");
      })
      .catch(() => {
        if (alive) setAutoSubError("Subtitle Indonesia gagal dimuat");
      })
      .finally(() => {
        if (alive) setAutoSubLoading(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [epParam, animeId, bakedSubs, !!direct?.ok, subRetry]);

  const [detailData, setDetailData] = useState<any>(null);

  const epList = detailData?.episodeList ?? [];
  const epIndex = epList.findIndex((e: any) => e.id === epParam);
  // Kalau episode yang diminta tidak ada di daftar, jangan diam-diam memakai
  // episode 1: itu bikin judul dan nomor episode di layar salah.
  const currentEp =
    epIndex >= 0 ? epList[epIndex] : (epList.find((e: any) => e.id === epParam) ?? null);
  const streamUrl = sources[sourceIdx]?.url ?? sources[0]?.url ?? "";

  /**
   * Server yang sedang diputar error → tandai mati lalu pindah ke server
   * berikutnya yang belum dicoba. Posisi playback disimpan supaya user tidak
   * mundur ke awal. Kalau semua server sudah dicoba, baru tampilkan pesan.
   */
  const failoverServer = useCallback((from: number) => {
    const list = sources;
    const at = from >= 0 && from < list.length ? list[from] : null;
    if (at) deadServers.current.add(at.url);
    const next = list.findIndex(
      (s, i) => i !== from && !deadServers.current.has(s.url),
    );
    if (next < 0) {
      // Semua server sudah dicoba: tampilkan pesan, jangan biarkan player
      // diam-diam menampilkan server yang sudah jelas rusak.
      setDirectErr("Semua server gagal memuat episode ini");
      setSources([]);
      return;
    }
    resumeAtRef.current = videoRef.current?.currentTime ?? 0;
    autoplayNextRef.current = true;
    setSourceIdx(next);
    const t = list[next]?.type;
    setSourceType(t === "hls" ? "hls" : t === "mp4" ? "mp4" : "embed");
    setWaiting(false);
  }, [sources]);

  useEffect(() => {
    if (animeId) {
      detail({ id: animeId, title: params.get("judul") ?? undefined })
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
    // Dua bentuk id episode:
    //  - "<malId>__ep<no>" untuk anime dari AniList/Jikan (MAL id).
    //  - id episode bebas (mis. Otakudesu) untuk anime tanpa MAL id. Nomor
    //    episodenya diambil dari daftar detail, dan backend hanya memakai
    //    sumber subtitle Indonesia karena MegaPlay butuh MAL id.
    const mm = epParam.match(/^(\d+)__ep(\d+)$/);
    const epNumber = mm ? Number(mm[2]) || 1 : (currentEp?.number ?? 1);
    const malId = mm ? mm[1] : (/^\d+$/.test(animeId) ? animeId : undefined);
    const key = `${malId ?? animeId}__ep${epNumber}`;
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

    // Kalau perpindahan terjadi saat video masih diputar, tandai untuk autoplay.
    if (lastEpRef.current && lastEpRef.current !== epParam) {
      const v = videoRef.current;
      autoplayNextRef.current = !!(v && !v.paused && !v.ended);
    }
    lastEpRef.current = epParam;
    deadServers.current = new Set();
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
      malId,
      ep: epNumber,
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
      const epNumber = mm ? Number(mm[2]) || 1 : (next?.number ?? 1);
      const malId = mm ? mm[1] : (/^\d+$/.test(animeId) ? animeId : undefined);
      const key = `${malId ?? animeId}__ep${epNumber}`;
      if (resolvedRef.current.has(key)) return null;
      return resolveDirect({
        malId,
        ep: epNumber,
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
      // Error HLS selalu dicoba dipulihkan dulu sebelum memberi tahu user —
      // seek / ganti menit sering memicu error sementara yang sebenarnya
      // bisa diperbaiki sendiri (hls.js), jadi tidak perlu "muat ulang".
      let fatalCount = 0;
      hls.on(Hls.Events.ERROR, (_evt, data) => {
        if (!data.fatal || !hls) return;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          fatalCount += 1;
          if (fatalCount <= 3) {
            hls.startLoad();
            return;
          }
        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          fatalCount += 1;
          if (fatalCount <= 3) {
            hls.recoverMediaError();
            return;
          }
        }
        // Sudah tidak bisa dipulihkan: pindah server lain secara otomatis.
        failoverServer(sourceIdx);
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
  // Di layar penuh (fullscreen) otomatis dinaikkan ke resolusi tertinggi yang
  // boleh diakses — 1080p hanya kalau akun punya Premium.
  const isPremiumNow = (user?.premiumUntil ?? 0) > Date.now();
  useEffect(() => {
    if (!hlsRef.current) return;
    const wanted =
      isFs && isPremiumNow
        ? PREMIUM_QUALITY
        : isFs
          ? "720p"
          : quality === PREMIUM_QUALITY && !isPremiumNow
            ? "720p"
            : quality;
    applyLevel(hlsRef.current, wanted);
  }, [quality, isFs, isPremiumNow]);

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

  // Simpan posisi playback tiap 10 detik supaya tombol "Lanjutkan" di Info
  // bisa membuka video dari menit terakhir.
  useEffect(() => {
    if (!user || !epParam || !detailData || !currentEp) return;
    if (currentTime < 5) return;
    const t = window.setInterval(() => {
      const v = videoRef.current;
      if (!v || v.paused || !v.currentTime) return;
      void saveProgress({
        animeId,
        animeTitle: detailData.title ?? "Anime",
        animeImage: detailData.image,
        episode: currentEp.number,
        progressSec: v.currentTime,
        minutesWatched: 0,
        durationSec: Number.isFinite(v.duration) ? v.duration : undefined,
      }).catch(() => {});
    }, 10_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, epParam, currentEp, detailData]);

  // Munculkan notifikasi kecepatan setiap kali berubah (tidak saat pertama buka).
  useEffect(() => {
    if (!speedReadyRef.current) {
      speedReadyRef.current = true;
      return;
    }
    setSpeedNotice(`${speed}× speed`);
    if (speedNoticeTimer.current) clearTimeout(speedNoticeTimer.current);
    speedNoticeTimer.current = window.setTimeout(() => setSpeedNotice(""), 1400);
    return () => {
      if (speedNoticeTimer.current) clearTimeout(speedNoticeTimer.current);
    };
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
    if (room && isHost) void roomSetPlaying({ roomId: room._id, playing: v.paused });
  };

  const skip = (s: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, v.currentTime + s);
    if (room && isHost)
      void roomSetPosition({ roomId: room._id, positionSec: v.currentTime });
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

  // Fullscreen: begitu user masuk, tetap fullscreen walau browser/HP keluar
  // sendiri (mis. saat_orientation berubah atau tombol sistem ditekan).
  const wantFs = useRef(false);
  // Perpindahan masuk/keluar layar penuh mengubah ukuran & rasio kotak video,
  // dan beberapa browser (Chrome di Android) deems ulang dekode frame sehingga
  // event `waiting` sempat menyala. Kalau spinner langsung ditampilkan, user
  // mengira videonya buffering padahal masih diputar. Jadi ada jeda singkat
  // tanpa spinner setiap kali status layar penuh berubah.
  const [fsSettle, setFsSettle] = useState(false);
  useEffect(() => {
    const onFsChange = () => {
      const fs = document.fullscreenElement === playerRef.current;
      setIsFs(fs);
      setControlsOn(true);
      // Simpan posisi sekarang supaya playback tidak mundur saat browser
      // Reads ulang dekode frame setelah ukuran layar berubah.
      resumeAtRef.current = videoRef.current?.currentTime ?? 0;
      setFsSettle(true);
      window.setTimeout(() => {
        setFsSettle(false);
        setWaiting(false);
      }, 900);
      if (fs) {
        wantFs.current = true;
        return;
      }
      if (!wantFs.current) return;
      // KeBeen keluar dari fullscreen padahal user masih menonton → masuk lagi.
      wantFs.current = false;
      const el = playerRef.current;
      if (!el) return;
      window.setTimeout(() => {
        if (document.fullscreenElement === playerRef.current) return;
        const req = el.requestFullscreen ?? (el as any).webkitRequestFullscreen;
        try {
          const p = req?.call(el);
          if (p && typeof (p as Promise<void>).catch === "function") {
            (p as Promise<void>).catch(() => {
              /* user sudah keluar sendiri, biarkan */
            });
          }
        } catch {
          /* abaikan */
        }
      }, 120);
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const toggleFullscreen = async () => {
    const el = playerRef.current;
    if (!el) return;
    const req = el.requestFullscreen ?? (el as any).webkitRequestFullscreen;
    try {
      if (document.fullscreenElement) {
        // Tetap fullscreen: tombol dipake untuk memastikan player fullscreen,
        // bukan untuk memunculkan navbar.
        wantFs.current = true;
        await document.exitFullscreen();
        return;
      }
      wantFs.current = true;
      if (req) await req.call(el);
      try {
        await (screen.orientation as any)?.lock?.("landscape");
      } catch {
        /* browser tidak mendukung lock orientasi */
      }
    } catch {
      toast.error("Fullscreen tidak didukung di browser ini");
    }
  };

  /** Keluar fullscreen dengan sengaja (tombol "keluar layar penuh"). */
  const exitFullscreen = async () => {
    wantFs.current = false;
    try {
      await document.exitFullscreen();
      try {
        await (screen.orientation as any)?.lock?.("portrait");
      } catch {
        /* abaikan */
      }
    } catch {
      /* abaikan */
    }
  };

  // Seek bar: saat digeser tampil menit tujuan, dilepas → langsung diputar.
  const commitScrub = (value: number) => {
    const v = videoRef.current;
    // Clamp supaya tidak.seek jauh di luar durasi (bikin HLS error).
    const maxT = Number.isFinite(duration) && duration > 0 ? duration : Infinity;
    const target = Math.max(0, Math.min(value, maxT));
    if (v && Number.isFinite(target)) v.currentTime = target;
    setCurrentTime(target);
    setScrub(null);
    if (room && isHost)
      void roomSetPosition({ roomId: room._id, positionSec: target });
  };

  // ------------------------------------------------ sinkronisasi Nobar ----
  // Penonton ikut posisi dan status play/pause yang diatur host.
  useEffect(() => {
    if (!room || isHost) return;
    const sync = () => {
      const v = videoRef.current;
      if (!v) return;
      const target = room.positionSec;
      if (target > 0 && Math.abs(v.currentTime - target) > 1.2) {
        try {
          v.currentTime = target;
        } catch {
          /* metadata belum siap */
        }
      }
      if (room.playing) void v.play().catch(() => {});
      else v.pause();
    };
    sync();
    // Coba lagi berkala selama 12 detik supaya ikut sinkron saat video siap.
    const t = setInterval(sync, 1000);
    const stop = setTimeout(() => clearInterval(t), 12000);
    return () => {
      clearInterval(t);
      clearTimeout(stop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.positionSec, room?.playing, isHost, sources.length]);

  // Host: kirim posisi ke semua orang tiap 3 detik saat diputar.
  useEffect(() => {
    if (!room || !isHost) return;
    const t = setInterval(() => {
      const v = videoRef.current;
      if (v && !v.paused)
        void roomSetPosition({ roomId: room._id, positionSec: v.currentTime });
    }, 3000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?._id, isHost]);

  const episodeComments = useQuery(
    api.activities.listComments,
    epParam ? { animeId: `${animeId}__ep${epParam}`, sort: "terbaru" } : "skip",
  );
  const postComment = useMutation(api.activities.postComment);

  // Resolusi yang benar-benar tersedia di stream HLS yang sedang diputar.
  useEffect(() => {
    const hls = hlsRef.current;
    setLevels(hls ? availableQualities(hls) : []);
  }, [sources, sourceType, sourceIdx, streamUrl]);

  // Komentar + echo lokal digabung di satu daftar.
  const shownComments = useMemo(() => {
    const real = (episodeComments ?? []) as unknown as CommentT[];
    if (pendingComments.length === 0) return real;
    const keep = pendingComments.filter(
      (p) =>
        !real.some(
          (r) =>
            r.userId === p.userId &&
            r.text === p.text &&
            (r.replyToId ?? undefined) === (p.replyToId ?? undefined) &&
            r.createdAt >= p.createdAt - 3000,
        ),
    );
    if (keep.length !== pendingComments.length) {
      queueMicrotask(() => setPendingComments(keep));
    }
    return [...real, ...keep].sort((a, b) => a.createdAt - b.createdAt);
  }, [episodeComments, pendingComments]);

  if (!detailData)
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Memuat…
      </div>
    );

  const D = detailData;
  // Tombol CC muncul kalau ada track subtitle apa pun (termasuk subtitle
  // Indonesia yang sedang dibuat otomatis atau yang gagal dibuat).
  const hasSubMenu = !bakedSubs && (
    (direct?.subTracks?.length ?? 0) > 0 ||
    !!autoVtt ||
    autoSubLoading ||
    !!autoSubError
  );

  return (
    <div className={cn("min-h-screen", room ? "pb-4" : "pb-24")}>
      {/* Tombol kembali — selalu terlihat di kiri atas */}
      {!isFs && (
        <button
          onClick={() => goBackFromWatch()}
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
            className="h-full w-full object-contain transition-[filter] duration-150"
            style={
              brightness === 1 ? undefined : { filter: `brightness(${brightness})` }
            }
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
            onLoadedMetadata={(e) => {
              setDuration(e.currentTarget.duration);
              // Buka dari "Lanjutkan": loncat ke menit terakhir.
              const t = Number(params.get("t") ?? 0);
              if (t > 0 && Number.isFinite(t)) {
                try {
                  e.currentTarget.currentTime = t;
                } catch {
                  /* metadata belum siap, abaikan */
                }
              }
              // Episode baru langsung diputar kalau sebelumnya masih diputar.
              if (autoplayNextRef.current) {
                autoplayNextRef.current = false;
                void e.currentTarget.play().catch(() => {});
              }
            }}
            onWaiting={() => setWaiting(true)}
            onError={() => failoverServer(sourceIdx)}
            onPlaying={() => setWaiting(false)}
            onCanPlay={() => setWaiting(false)}
            // Setting ulang posisi setelah transisi layar penuh: jangan sampai
            // playback mundur ke 0 saat keluaar fullscreen.
            onLoadedData={(e) => {
              if (!resumeAtRef.current) return;
              const at = resumeAtRef.current;
              resumeAtRef.current = 0;
              try {
                if (Math.abs(e.currentTarget.currentTime - at) > 1.5) {
                  e.currentTarget.currentTime = at;
                }
              } catch {
                /* metadata belum siap, abaikan */
              }
            }}
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
        {/* Subtitle digambar sendiri: teks putih semi-bold dengan outline hitam
            tebal, dibungkus rapat di tengah dan tidak melebar ke samping. */}
        {activeCue && !bakedSubs && (
          <div
            className={cn(
              "pointer-events-none absolute inset-x-0 z-20 flex justify-center px-4",
              // Subtitle duduk rendah, dekat tepi bawah video seperti di
              // animeindo: fullscreen sedikit lebih tinggi karena tombol di
              // kanan bawah memakan space.
              isFs ? "bottom-7" : "bottom-5 sm:bottom-6",
            )}
          >
            <p
              className={cn(
                "max-w-[min(92%,44rem)] whitespace-pre-line break-words text-center font-semibold leading-snug text-white",
                "[text-shadow:-2px_-2px_0_#000,2px-2px_0_#000,-2px_2px_0_#000,2px_2px_0_#000,-1px_-1px_0_#000,1px_-1px_0_#000,-1px_1px_0_#000,1px_1px_0_#000,0_3px_6px_rgba(0,0,0,0.95)]",
                // Teks panjang otomatis dikecilkan supaya tetap satu blok rapi
                // dan tidak menutupi gambar.
                activeCue.length > 90
                  ? isFs
                    ? "text-[13px] sm:text-[15px]"
                    : "text-[12px] sm:text-[13px]"
                  : isFs
                    ? "text-[15px] sm:text-[18px]"
                    : "text-[13px] sm:text-[15px]",
              )}
            >
              {activeCue}
            </p>
          </div>
        )}

        {/* Notifikasi kecepatan: gaya sama dengan subtitle — kotak hitam
            transparan, di tengah atas, hilang sendiri setelah 1,4 detik. */}
        {speedNotice && (
          <div className="pointer-events-none absolute inset-x-0 top-4 z-30 flex justify-center px-4">
            <p className="rounded-full bg-black/55 px-3.5 py-1.5 text-center text-sm font-bold text-white backdrop-blur-sm">
              {speedNotice}
            </p>
          </div>
        )}

        {/* Spinner saat buffering. Saat transisi layar penuh baru saja terjadi
            spinner ditahan supaya tidakikut terlihat. */}
        {waiting && !fsSettle && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <Loader2 className="size-10 animate-spin text-white/80" />
          </div>
        )}

        {/* Lapisan tap + gesture: sentuh singkat → kontrol tampil/sembunyi.
            Seret ke atas di kiri = pencahayaan, di kanan = volume suara. */}
        {sourceType !== "embed" && (isHost || !room) && (
          <div
            className="absolute inset-0 z-10 touch-none"
            onPointerDown={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const leftHalf = e.clientX - rect.left < rect.width / 2;
              const kind = leftHalf ? "brightness" : "volume";
              const startValue =
                kind === "brightness"
                  ? brightnessToLevel(brightness)
                  : volumeLevel;
              gestureRef.current = {
                kind,
                startY: e.clientY,
                startValue,
                moved: false,
              };
              (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
            }}
            onPointerMove={(e) => {
              const g = gestureRef.current;
              if (!g) return;
              const dy = g.startY - e.clientY;
              if (!g.moved && Math.abs(dy) < 10) return;
              g.moved = true;
              // 220px drag = 100% perubahan (0 = paling gelap/senyap, 1 = paling terang/keras).
              const delta = dy / 220;
              const next = Math.max(0, Math.min(1, g.startValue + delta));
              if (g.kind === "brightness") {
                setBrightness(Math.round(levelToBrightness(next) * 100) / 100);
              } else {
                applyVolume(next);
              }
              setGesture({ kind: g.kind, value: next });
            }}
            onPointerUp={(e) => {
              const g = gestureRef.current;
              (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
              if (g && !g.moved) tapVideo();
              endGesture(!!g?.moved);
            }}
            onPointerCancel={() => endGesture(false)}
          />
        )}

        {/* HUD gesture: bilah terang di kiri, bilah suara di kanan */}
        {gesture && (
          <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
            <div
              className={cn(
                "flex h-40 w-14 flex-col items-center justify-center gap-2 rounded-2xl border border-white/15 bg-black/55 backdrop-blur-md",
                gesture.kind === "brightness" ? "left-6" : "right-6",
                "absolute",
              )}
            >
              {gesture.kind === "brightness" ? (
                <Sun className="size-5 text-amber-200" />
              ) : (
                <Volume2 className="size-5 text-emerald-200" />
              )}
              <div className="relative h-24 w-1.5 overflow-hidden rounded-full bg-white/15">
                <div
                  className="absolute inset-x-0 bottom-0 rounded-full bg-gradient-to-t from-violet-500 to-fuchsia-400 transition-[height] duration-75"
                  style={{ height: `${Math.round(gesture.value * 100)}%` }}
                />
              </div>
              <span className="text-[10px] font-bold text-white">
                {Math.round(gesture.value * 100)}%
              </span>
            </div>
          </div>
        )}

        {/* Tombol keluar layar penuh — tetap ada walau kontrol disembunyikan */}
        {isFs && (
          <button
            onClick={exitFullscreen}
            className="absolute right-3 top-3 z-30 rounded-full bg-black/55 p-2"
            aria-label="Keluar layar penuh"
          >
            <Minimize className="size-5 text-white" />
          </button>
        )}

        {/* Overlay controls — di fullscreen tata letaknya menyesuaikan landscape */}
        {controlsOn && sourceType !== "embed" && (isHost || !room) && (
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
            <button onClick={goBackFromWatch} className="rounded-full bg-black/50 p-2">
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
              disabled={room ? (currentEp?.number ?? 1) <= 1 : epIndex <= 0}
              onClick={() => {
                if (room) {
                  void roomSetEpisode({
                    roomId: room._id,
                    episode: (currentEp?.number ?? 1) - 1,
                  });
                  return;
                }
                navigate(`/nonton?anime=${animeId}&ep=${epList[epIndex - 1].id}`);
              }}
              className={cn(
                "rounded-full bg-black/50 p-2",
                (room ? (currentEp?.number ?? 1) <= 1 : epIndex <= 0) && "opacity-30",
              )}
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
              disabled={room ? (currentEp?.number ?? 1) >= epList.length : epIndex >= epList.length - 1}
              onClick={() => {
                if (room) {
                  void roomSetEpisode({
                    roomId: room._id,
                    episode: (currentEp?.number ?? 1) + 1,
                  });
                  return;
                }
                navigate(`/nonton?anime=${animeId}&ep=${epList[epIndex + 1].id}`);
              }}
              className={cn(
                "rounded-full bg-black/50 p-2",
                (room
                  ? (currentEp?.number ?? 1) >= epList.length
                  : epIndex >= epList.length - 1) && "opacity-30",
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
              step={0.5}
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
                  disabled={!streamUrl}
                  onClick={async () => {
                    // Kirim ke mini player global (AppLayout) lalu balik ke Home
                    setMiniPlayer({
                      animeId,
                      animeTitle: D.title,
                      animeImage: D.image,
                      episodeNumber: currentEp?.number,
                      episodeId: epParam ?? undefined,
                      streamUrl: streamUrl,
                      isEmbed: false,
                    });
                    toast.success("Mini player aktif — kembali ke Home");
                    navigate("/home");
                  }}
                  className={cn(
                    "rounded p-1.5",
                    !streamUrl
                      ? "cursor-not-allowed bg-white/[0.04] text-zinc-600"
                      : "bg-white/15",
                  )}
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
                    {/* Track non-Indonesia milik server, jadi diberi penanda
                        supaya jelas bedanya dengan subtitle terjemahan kita. */}
                    {t.lang === "id" ? t.label : `${t.label} (asli)`}
                    {t.lang === "id" && (
                      <span className="ml-1 rounded bg-emerald-600 px-1 py-0.5 text-[9px] font-bold text-white">
                        ID
                      </span>
                    )}
                  </button>
                ))}
                {/* Subtitle Indonesia otomatis (diterjemahkan dari track
                    English, jadi tetap muncul di server yang tidak punya
                    subtitle Indonesia sendiri). */}
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
                    : autoSubSource === "raw"
                      ? "Subtitle asli (terjemahan gagal)"
                      : AUTO_SUB}
                  <span className="ml-1 rounded bg-emerald-600 px-1 py-0.5 text-[9px] font-bold text-white">
                    ID
                  </span>
                </button>
                {/* Gagal diterjemahkan? Beri tahu sekaligus jalan keluarannya. */}
                {autoSubError && !autoSubLoading && (
                  <div className="flex items-center gap-2 px-2 pt-1">
                    <span className="min-w-0 flex-1 text-[10px] leading-tight text-amber-300/90">
                      {autoSubError}
                    </span>
                    <button
                      onClick={() => setSubRetry((n) => n + 1)}
                      className="shrink-0 rounded bg-white/15 px-2 py-1 text-[10px] font-bold text-white transition hover:bg-white/25"
                    >
                      Coba lagi
                    </button>
                  </div>
                )}
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

      {/* Server: bisa dipilih manual, dan player otomatis pindah kalau error. */}
      {sources.length > 0 && (
        <div className="thin-scroll flex items-center gap-1.5 overflow-x-auto px-3 pt-2 pb-1">
          <span className="shrink-0 text-[11px] text-muted-foreground">Server:</span>
          {sources.map((s, i) => (
            <button
              key={s.url}
              onClick={() => {
                if (i === sourceIdx) return;
                resumeAtRef.current = videoRef.current?.currentTime ?? 0;
                autoplayNextRef.current = true;
                setSourceIdx(i);
                setSourceType(
                  s.type === "hls" ? "hls" : s.type === "mp4" ? "mp4" : "embed",
                );
              }}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition",
                i === sourceIdx
                  ? "border-violet-500 bg-violet-500/15 text-violet-300"
                  : deadServers.current.has(s.url)
                    ? "border-border text-muted-foreground/50 line-through"
                    : "border-border text-muted-foreground hover:border-violet-500/60",
              )}
            >
              {s.label}
              {i === sourceIdx && (
                <span className="rounded bg-emerald-600 px-1 py-0.5 text-[9px] font-bold text-white">
                  ID
                </span>
              )}
            </button>
          ))}
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

        {/* Episode: grid + jumlah di kanan atas (host room nobar juga boleh) */}
        {(isHost || !room) && (
          <>
            <div className="mb-2 mt-4 flex items-center justify-between">
              <h2 className="text-base font-bold">Episode</h2>
              <span className="text-xs text-muted-foreground">{epList.length} episode</span>
            </div>
            <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
              {(epList ?? []).map((e: any) => (
                <button
                  key={e.id}
                  onClick={() => {
                    if (room) {
                      void roomSetEpisode({ roomId: room._id, episode: e.number });
                      return;
                    }
                    navigate(`/nonton?anime=${animeId}&ep=${e.id}`);
                  }}
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
          </>
        )}

        {/* Garis pembatas di atas toolbar */}
        <div className="my-3 h-px bg-white/15" />

        {/* Toolbar: kecepatan, download, mini, kualitas — hanya di luar mode Nobar */}
        {(isHost || !room) && (
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
              disabled={!streamUrl}
              onClick={() => {
                setMiniPlayer({
                  animeId,
                  animeTitle: D.title,
                  animeImage: D.image,
                  episodeNumber: currentEp?.number,
                  episodeId: epParam ?? undefined,
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
        )}

        {/* Garis pembatas sebelum diskusi */}
        <div className="my-3 h-px bg-white/15" />

        {/* Mode Nobar: panel room (info, member, kontrol host, chat nobar) */}
        {room ? (
          <NobarDock
            room={room}
            isHost={isHost}
            members={(roomInfo?.members ?? []) as never}
            meId={user?._id as unknown as string}
            currentSec={currentTime}
            durationSec={duration}
            onSeek={(delta) => {
              const v = videoRef.current;
              if (!v || !isHost) return;
              const next = Math.max(0, v.currentTime + delta);
              v.currentTime = next;
              setCurrentTime(next);
              void roomSetPosition({ roomId: room._id, positionSec: next });
            }}
            onTogglePlay={() => {
              if (!isHost) return;
              const v = videoRef.current;
              if (!v) return;
              if (v.paused) void v.play();
              else v.pause();
              void roomSetPlaying({ roomId: room._id, playing: v.paused });
            }}
            onNextEpisode={() =>
              void roomSetEpisode({
                roomId: room._id,
                episode: (currentEp?.number ?? 1) + 1,
              })
            }
            onPrevEpisode={() =>
              void roomSetEpisode({
                roomId: room._id,
                episode: Math.max(1, (currentEp?.number ?? 1) - 1),
              })
            }
            onLeave={async () => {
              try {
                if (isHost) await endRoom({ roomId: room._id });
                else await leaveRoom({ roomId: room._id });
              } catch {
                /* room sudah tertutup */
              }
              navigate("/home", { replace: true });
            }}
          />
        ) : (
          <>
            {/* Komentar episode — gaya baru */}
            <SectionTitle>Diskusi Episode</SectionTitle>
            <CommentsSection
              animeId={epParam ? `${animeId}__ep${epParam}` : animeId}
              comments={shownComments}
              meId={user?._id}
              onSend={async (text, replyToId) => {
                if (!epParam || !user) {
                  toast.error("Pilih episode dulu");
                  return;
                }
                // Echo lokal: komentar langsung nempel tanpa nunggu server.
                const temp: CommentT = {
                  _id: `local-c-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                  userId: user._id as string,
                  username: user.username ?? "user",
                  image: user.image,
                  premium: (user.premiumUntil ?? 0) > Date.now(),
                  staffRole: user.staffRole,
                  clanTag: user.clanTag,
                  clanTagIcon: user.clanTagIcon,
                  clanNameColor: user.clanNameColor,
                  text,
                  likes: [],
                  likeCount: 0,
                  replyToId,
                  createdAt: Date.now(),
                };
                setPendingComments((s) => [...s, temp]);
                try {
                  await postComment({
                    animeId: `${animeId}__ep${epParam}`,
                    animeTitle: D.title,
                    text,
                    replyToId: replyToId as never,
                  });
                  // Echo lokal langsung dilepas begitu server sudah menerima,
                  // supaya komentar yang sama tidak pernah tampil dua kali.
                  setPendingComments((s) => s.filter((x) => x._id !== temp._id));
                } catch (e) {
                  setPendingComments((s) => s.filter((x) => x._id !== temp._id));
                  toast.error(
                    e instanceof Error ? e.message : "Gagal kirim komentar",
                  );
                  throw e;
                }
              }}
            />
          </>
        )}
      </div>

      {/* Popups diperbagus */}
      {qualityOpen && (
        <Popup onClose={cancelQuality} title="Pilih kualitas">
          <div className="space-y-1.5">
            {QUALITIES.map((q) => {
              const height = parseInt(q, 10);
              const locked = q === PREMIUM_QUALITY && !isPremium;
              // Kalau resolusi ini tidak ada di stream, tetap ditampilkan tapi
              // ditandai supaya user tidak menyangka tombolnya tidak jalan.
              const missing = levels.length > 0 && !levels.includes(height);
              const active = (qualityDraft ?? quality) === q;
              return (
                <div key={q}>
                  <button
                    onClick={() => {
                      if (locked) {
                        setPremiumTapHint(true);
                        window.setTimeout(() => setPremiumTapHint(false), 1800);
                        return;
                      }
                      setQualityDraft(q);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left transition",
                      locked
                        ? "cursor-not-allowed border-amber-500/40 bg-amber-500/5"
                        : active
                          ? "border-violet-500 bg-violet-500/15"
                          : "border-border hover:border-violet-500/50",
                    )}
                  >
                    <span
                      className={cn(
                        "w-14 text-sm font-bold",
                        locked ? "text-amber-300" : active ? "text-violet-300" : "",
                      )}
                    >
                      {q}
                    </span>
                    {q === PREMIUM_QUALITY && (
                      <span className="rounded-full border border-amber-400/60 bg-amber-400/15 px-2 py-0.5 text-[9px] font-bold text-amber-300">
                        Premium
                      </span>
                    )}
                    {missing && !locked && (
                      <span className="text-[9px] text-muted-foreground">
                        tidak tersedia di episode ini
                      </span>
                    )}
                    {active && !locked && (
                      <span className="ml-auto text-[10px] font-bold text-violet-300">
                        dipakai
                      </span>
                    )}
                  </button>
                  <p className="px-1 pt-1 text-[10px] leading-snug text-muted-foreground">
                    {QUALITY_INFO[q]}
                  </p>
                </div>
              );
            })}
          </div>
          {premiumTapHint && (
            <p className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
              1080p khusus akun Premium. Buka Premium di menu Akun untuk
              memakainya.
            </p>
          )}
          <p className="mt-2 text-[11px] text-muted-foreground">
            Pilihan ini juga disimpan sebagai bawaan di Pengaturan.
          </p>
          {levels.length > 0 && levels.length <= 1 && (
            <p className="mt-1 text-[10px] text-amber-300/90">
              Episode ini hanya menyediakan satu resolusi ({levels[0]}p), jadi
              pilihan lain tidak bisa dipakai.
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <button
              onClick={cancelQuality}
              className="flex-1 rounded-full border border-border py-2 text-xs font-semibold text-muted-foreground"
            >
              Batal
            </button>
            <button
              onClick={saveQuality}
              disabled={
                !qualityDraft ||
                qualityDraft === quality ||
                (qualityDraft === PREMIUM_QUALITY && !isPremium)
              }
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
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex flex-col items-center gap-1 rounded-xl border py-2.5 text-[11px] font-medium transition",
        disabled
          ? "cursor-not-allowed border-white/5 bg-white/[0.03] text-zinc-600"
          : "border-border bg-card hover:border-violet-500/60",
      )}
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
