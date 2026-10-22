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
  Lock,
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
  ThumbsUp,
  ThumbsDown,
  Heart,
  Flag,
  Check,
  X,
  Volume2,
  VolumeX,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
// Ikon mahkota Premium — gaya SF Symbols supaya konsisten dengan Home.
import { CrownIcon } from "@/components/ios-icons";
import { NobarDock } from "@/components/NobarDock";
import type { Id } from "@/convex/_generated/dataModel";

const QUALITIES = ["144p", "240p", "360p", "480p", "720p", "1080p"];

/**
 * Jumlah episode yang langsung tampil di grid. Series panjang (ratusan
 * episode) membuat halaman jadi terpotret jauh sebelum user sampai ke
 * player, jadi sisanya disembunyikan di balik "Lihat semua".
 */
const EP_PREVIEW = 10;
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
function highestAvailable(hls: Hls | null): number {
  if (!hls) return 0;
  return availableQualities(hls).reduce((a, b) => (b > a ? b : a), 0);
}

/**
 * Cache tinggi video per URL. Satu file tidak dicek dua kali, jadi pindah
 * kualitas bolak-balik tidak memuat metadata ulang tiap kali.
 */
const heightCache = new Map<string, number>();

/**
 * Tinggi asli (piksel) sebuah file video, dibaca dari metadata file itu sendiri
 * lewat `video.videoHeight`.
 *
 * Inilah yang membuat pilihan resolusi benar-benar berbeda: server Indonesia
 * hanya menyediakan satu file per episode, jadi tinggi file tersebut adalah
 * satu-satunya cara tahu berapa megapixel yang benar-benar diputar. Tidak ada
 * tebakan dari nama server. Metadata video tidak termasuk data yang diproteksi
 * CORS, jadi probing tetap berhasil untuk file yang lewat proxy.
 */
function probeVideoHeight(url: string, timeoutMs = 9000): Promise<number> {
  const hit = heightCache.get(url);
  if (hit) return Promise.resolve(hit);
  return new Promise((resolve) => {
    const v = document.createElement("video");
    let done = false;
    const timer = window.setTimeout(() => finish(0), timeoutMs);
    function finish(h: number) {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      v.removeAttribute("src");
      v.load();
      if (h > 0) heightCache.set(url, h);
      resolve(h);
    }
    v.preload = "metadata";
    v.muted = true;
    v.addEventListener("loadedmetadata", () => finish(v.videoHeight || 0), {
      once: true,
    });
    v.addEventListener("error", () => finish(0), { once: true });
    v.src = url;
  });
}

function applyLevel(hls: Hls | null, quality: string) {
  if (!hls) return;
  const target = parseInt(quality, 10);
  if (!Number.isFinite(target)) return;
  const levels = hls.levels ?? [];
  // Satu level saja tidak ada yang bisa dipilih, tapi tetap dikunci supaya
  // hls.js tidak boleh turun ke ABR otomatis di tengah playback.
  if (levels.length <= 1) {
    if (levels.length === 1) hls.currentLevel = 0;
    return;
  }
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
  // Mengeset `currentLevel` (bukan `nextLevel`) inilah yang mematikan ABR:
  // hanya `nextLevel` yang masih boleh ditimpa hls.js saat bitrate berubah,
  // jadi itulah yang mengunci pilihan user.
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

/** Durasi minimum satu baris subtitle (detik). */
const CUE_MIN = 1.1;
/** Jeda sebelum subtitle hilang (detik), biar sempat dibaca. */
const CUE_TAIL = 0.5;

/**
 * Bungkus teks subtitle jadi baris-baris pendek: maksimal 6 kata per baris.
 * Kalau satu baris kepanjangan (> 28 karakter), kata terakhir dipindah ke
 * baris berikutnya supaya tampilannya lurus rapi, bukan melebar ke samping.
 */
function wrapCue(text: string): string {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= 6) return text;
  const lines: string[] = [];
  let i = 0;
  while (i < words.length) {
    let take = Math.min(6, words.length - i);
    while (take > 3 && words.slice(i, i + take).join(" ").length > 28) {
      take -= 1;
    }
    lines.push(words.slice(i, i + take).join(" "));
    i += take;
  }
  return lines.join("\n");
}

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
    // Teks dibungkus manual: maksimal 6 kata per baris (maks ~28 karakter)
    // supaya subtitle tersusun lurus rapi, sisanya turun ke baris berikutnya.
    out.push({ s, e: Math.max(e, s + CUE_MIN) + CUE_TAIL, t: wrapCue(body) });
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

  /**
   * URL pindah episode dengan SEMUA parameter yang tetap terbawa.
   *
   * Dulu tiap ganti episode membangun URL baru dari nol
   * (`/nonton?anime=...&ep=...`), jadi `judul` dan `donghua=1` hilang:
   * judul otomatis diganti "Untitled" dan donghua dimuat ulang seolah-olah
   * anime biasa. Dengan menyalin query yang ada, yang berganti hanya `ep`.
   */
  const epUrl = (epId: string) => {
    const p = new URLSearchParams(params.toString());
    p.set("ep", epId);
    return `/nonton?${p.toString()}`;
  };

  // Otomatis join begitu membuka room (kecuali room yang membatasi peserta).
  useEffect(() => {
    if (!roomId || !room || joinedRoom) return;
    setJoinedRoom(true);
    void joinRoom({ roomId }).catch(() => {
      /* room penuh/ditutup — biarkan, tampilan tetap jalan */
    });
  }, [roomId, room, joinedRoom, joinRoom]);

  // Kembali dari nonton: JANGAN kembali ke episode sebelumnya (makanya tidak
  // pakai navigate(-1)). Balik ke halaman terakhir yang bukan nonton.
  // RouteSyncer menulis yn-return-to setiap kali route berubah (kecuali
  // /nonton dan /baca), jadi tombol kembali membaca target yang sama,
  // mengganti URL di history, lalu navigate replace tanpa full reload.
  // Browser tidak akan membaca ulang halaman (no-refresh back).
  const goBackFromWatch = useCallback(() => {
    try {
      window.scrollTo({ top: 0 });
    } catch {
      /* abaikan */
    }
    // Host TIDAK BOLEH keluar selama room masih ada — harus membubarkan
    // room dulu lewat tombol "Bubarkan Room". Peserta biasa keluar otomatis.
    if (room) {
      if (isHost) {
        toast.error(
          'Host tidak bisa keluar sebelum room dibubarkan — tekan "Bubarkan Room" dulu',
        );
        return;
      }
      void leaveRoom({ roomId: room._id }).catch(() => {});
    }
    // Navigasi client-side: ganti URL di history (replaceState) lalu
    // navigate replace tanpa memaksa full reload. Berpadu dengan RouteSyncer,
    // yang sudah menulis yn-return-to pada route biasa.
    let target = "";
    try {
      target = sessionStorage.getItem("yn-return-to") ?? "";
    } catch {
      /* storage diblokir */
    }
    // Jangan balik ke diri sendiri / ke halaman nonton lain.
    if (!target || target.startsWith("/nonton") || target.startsWith("/baca")) {
      target = "/home";
    }
    // Navigasi client-side: ganti URL di history (replaceState) lalu
    // navigate replace tanpa memaksa full reload. Berpadu dengan RouteSyncer,
    const to = target.startsWith("?") ? "/home" + target : target;
    if (typeof window !== "undefined") {
      try {
        window.history.replaceState(null, "", to);
      } catch {
        /* history diblokir */
      }
    }
    navigate(to, { replace: true });
  }, [navigate, room, isHost, leaveRoom]);

  useEffect(() => {
    if (roomInfo?.ended) {
      toast.info("Host mengakhiri sesi nonton bareng");
      navigate("/home", { replace: true });
    }
  }, [roomInfo?.ended, navigate]);


  const detail = useAction(api.anime.animeDetail);
  // Resolver tunggal: backend hanya mengembalikan satu server "Direct HLS - SUB"
  const resolveDirect = useAction(api.megaplay.resolveEpisode);
  // Donghua memakai server sendiri (SankaVollereii), bukan MegaPlay: slug-nya
  // bukan MAL id, jadi resolveEpisode biasa tidak akan menemukan apa pun.
  const resolveDonghua = useAction(api.sanka.resolveEpisode);
  const sankaDetail = useAction(api.sanka.detail);
  // Halaman ini dipakai untuk dua sumber: anime (AniList/Jikan) dan donghua
  // (SankaVollereii). Penandanya ada di URL, jadi tidak perlu tebakan dari
  // bentuk id — yang bisa sama-sama berupa slug.
  const isDonghua = params.get("donghua") === "1";
  // Subtitle Indonesia otomatis: subtitle English diterjemahkan di backend
  // lalu dipasang sebagai track di player ini.
  const subtitleIndo = useAction(api.subtitle.subtitleIndo);
  // Donghua tidak punya MAL id, jadi jalur subtitle anime di atas selalu gagal
  // untuknya. Jalur ini mengambil track subtitle milik video DailyMotion
  // episode tersebut, jadi subtitle Indonesia tetap muncul.
  const donghuaSub = useAction(api.subtitle.donghuaSubtitle);
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
  // Auto next: kalau aktif, episode berikutnya langsung diputar sehabis ini.
  const [autoNext, setAutoNext] = useState(false);
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
  // Kualitas yang sedang dikirim ke server, supaya tombolnya tidak bisa
  // ditekan dua kali (yang akan membuat dua baris unduhan untuk episode sama).
  const [pendingQuality, setPendingQuality] = useState<string | null>(null);
  // Antrean unduhan disimpan di Convex (daftarnya), sementara file videonya
  // sendiri disimpan di IndexedDB perangkat — lihat src/lib/offline-store.ts.
  const enqueueDownload = useMutation(api.downloads.enqueue);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [recorded, setRecorded] = useState(false);
  const [controlsOn, setControlsOn] = useState(true);
  // Kunci UI layar penuh: saat aktif semua kontrol disembunyikan dan hanya
  // tombol gembok (latar putih) yang tetap kelihatan. Tekan lagi = buka.
  const [uiLocked, setUiLocked] = useState(false);
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

  // Pintu waktu sebelum video boleh diputar, sama seperti hitungan mundur
  // halaman di pembaca manga/manhwa. Video sudah dimuat di belakang layar;
  // hitungannya cuma memberi jeda supaya terasa "siap", bukan error.
  // Premium langsung lewat.
  const isPremiumUser = (user?.premiumUntil ?? 0) > Date.now();
  const WATCH_DELAY_MS = isPremiumUser ? 0 : 2000;
  const [holdUntil, setHoldUntil] = useState(0);
  const [nowTick, setNowTick] = useState(Date.now());
  const videoHolding = holdUntil > 0 && nowTick < holdUntil;
  useEffect(() => {
    if (holdUntil <= 0) return;
    const t = window.setInterval(() => setNowTick(Date.now()), 200);
    return () => window.clearInterval(t);
  }, [holdUntil > 0]); // eslint-disable-line react-hooks/exhaustive-deps
  const [sourceIdx, setSourceIdx] = useState(0);
  // Server yang sudah dicoba dan gagal untuk episode ini, supaya auto-failover
  // tidak berputar ke server yang sama.
  const deadServers = useRef<Set<string>>(new Set());
  const [synopsisOpen, setSynopsisOpen] = useState(false);
  // Hasil resolve MegaPlay: subtitle, timing intro/outro, embed cadangan
  const [direct, setDirect] = useState<any>(null);
  // Alasan stream tidak tersedia (mis. judul upcoming belum tayang)
  const [directErr, setDirectErr] = useState<string | null>(null);
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
  // INI HANYA UNTUK INFORMASI. Player tidak memakai track native ini —
  // player digambar sendiri supaya subtitle milik USER (overlay dari
  // subtitle server/albumnya, atau terjemahan YoruNime) selalu yang
  // digunakan, bukan subtitle server asli.
  // Subtitle Indonesia yang menempel di dalam berkas video hanya ada di server
  // HLS/MP4 Sub Indo. Begitu user pindah ke server embed atau MegaPlay, teks itu
  // hilang — jadi overlay subtitle kita harus hidup lagi, dihitung per server
  // yang sedang diputar, bukan sekali per episode.
  const currentSrc = sources[sourceIdx] ?? sources[0];
  const bakedSubs = !!currentSrc?.baked;
  // Notifikasi kecepatan di dalam player (mis. "2x speed") seperti subtitle:
  // muncul sebentar di tengah atas lalu hilang sendiri.
  const [speedNotice, setSpeedNotice] = useState("");
  const speedNoticeTimer = useRef<number | null>(null);
  const speedReadyRef = useRef(false);
  // Notifikasi kecepatan dipanggil dari dua tempat: efek ganti speed dan
  // tekan-lama di layar video (2x sementara).
  const flashSpeedNotice = useCallback((text: string) => {
    setSpeedNotice(text);
    if (speedNoticeTimer.current) clearTimeout(speedNoticeTimer.current);
    speedNoticeTimer.current = window.setTimeout(() => setSpeedNotice(""), 1400);
  }, []);
  // Tekan-lama layar player → kecepatan 2x sementara sampai jari diangkat.
  const longPressTimer = useRef<number | null>(null);
  const longPressFiredRef = useRef(false);

  // ------------------------------------------------------- kualitas ----
  // Resolusi yang benar-benar ada di stream HLS yang sedang diputar, supaya
  // pilihan 144p/480p/1080p benar-benar menghasilkan gambar yang berbeda.
  const [levels, setLevels] = useState<number[]>([]);
  const isPremium = (user?.premiumUntil ?? 0) > Date.now();
  // Tampilkan info "1080p khusus Premium" ketika user menekan 1080p.
  const [premiumTapHint, setPremiumTapHint] = useState(false);

const streamUrl = sources[sourceIdx]?.url ?? sources[0]?.url ?? "";

  /**
   * Resolusi asli tiap file MP4 di daftar server episode ini.
   *
   * Server Indonesia tidak punya URL per kualitas (tidak seperti HLS yang punya
   * beberapa level), hanya satu file per server. Jadi "ganti kualitas" berarti
   * pindah ke server lain yang resolusinya memang berbeda, dan itu harus
   * diketahui dari file sungguhan, bukan diasumsikan dari nama server.
   */
  const [srcHeights, setSrcHeights] = useState<Record<string, number>>({});
  useEffect(() => {
    const mp4s = (sources as any[])
      .filter((s) => s?.type === "mp4" && !!s?.url)
      .slice(0, 4);
    if (mp4s.length === 0) {
      setSrcHeights({});
      return;
    }
    let alive = true;
    void (async () => {
      const out: Record<string, number> = {};
      // Berurutan, bukan paralel: beberapa file sekaligus memicu connection
      // reset di CDN dan hasil probing-nya jadi kosong semua.
      for (const s of mp4s) {
        const h = await probeVideoHeight(s.url);
        if (!alive) return;
        if (h > 0) out[s.url] = h;
      }
      if (alive) setSrcHeights(out);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sources]);

  /** Server MP4 yang paling cocok untuk resolusi `target` (piksel). */
  const bestSourceIdxFor = useCallback(
    (target: number) => {
      let under = -1;
      let underH = 0;
      let over = -1;
      let overH = Infinity;
      (sources as any[]).forEach((s, i) => {
        if (s?.type !== "mp4" || !s?.url) return;
        const h = srcHeights[s.url] ?? 0;
        if (h <= 0) return;
        if (h <= target) {
          if (h > underH) {
            underH = h;
            under = i;
          }
        } else if (h < overH) {
          overH = h;
          over = i;
        }
      });
      // Kalau semuanya lebih besar dari target, ambil yang terkecil supaya
      // hasilnya setinggi mungkin. Tidak pernah mengembalikan file 480p
      // berlabel 1080p.
      return under >= 0 ? under : over;
    },
    [sources, srcHeights],
  );

  /** Pindah ke server lain, menjaga posisi playback. */
  const switchSource = useCallback(
    (i: number) => {
      if (i === sourceIdx) return;
      const s = (sources as any[])[i];
      if (!s) return;
      resumeAtRef.current = videoRef.current?.currentTime ?? 0;
      autoplayNextRef.current = true;
      setSourceIdx(i);
      setSourceType(s.type === "hls" ? "hls" : s.type === "mp4" ? "mp4" : "embed");
      setWaiting(false);
    },
    [sourceIdx, sources],
  );

  /**
   * Terapkan pilihan resolusi ke player.
   *
   * Dua jalur, karena dua jenis sumber punya mekanisme berbeda:
   *  - HLS punya beberapa level di dalam satu playlist; cukup pindah
   *    `currentLevel` dan gambar seketika jadi lebih tajam atau lebih buram.
   *  - MP4 cuma punya satu resolusi per file, jadi harus pindah SERVER. Kalau
   *    tidak ada server lain yang cocok, player tetap di server saat ini, bukan
   *    diberi resolusi palsu.
   */
  const applyQuality = useCallback(
    (q: string) => {
      const target = parseInt(q, 10);
      if (!Number.isFinite(target)) return;
      const hls = hlsRef.current;
      if (hls && sourceType === "hls") {
        applyLevel(hls, q);
        return;
      }
      const idx = bestSourceIdxFor(target);
      if (idx >= 0) switchSource(idx);
    },
    [sourceType, bestSourceIdxFor, switchSource],
  );

  /**
   * Resolusi yang benar-benar bisa dipakai sekarang: level HLS untuk sumber
   * HLS, atau tinggi file asli untuk server MP4 yang sudah dicek.
   */
  const realQualities = useMemo(() => {
    const list =
      sourceType === "hls" && levels.length > 0
        ? levels
        : Object.values(srcHeights);
    return [...new Set(list)].sort((a, b) => a - b);
  }, [sourceType, levels, srcHeights]);

  /**
   * URL unduhan untuk sebuah resolusi. Harus MP4 (HLS tidak bisa disimpan
   * browser sebagai satu file), jadi server yang dipilih adalah server MP4 yang
   * resolusinya paling cocok. Kalau tidak ada server MP4 yang setinggi itu,
   * hasilnya file tertinggi yang ada, bukan file 480p berlabel 1080p.
   */
  const downloadUrlFor = useCallback(
    (q: string) => {
      const target = parseInt(q, 10) || 720;
      const idx = bestSourceIdxFor(target);
      const picked = idx >= 0 ? String((sources as any[])[idx]?.url ?? "") : "";
      if (picked) return { url: picked, height: srcHeights[picked] ?? 0 };
      const fallback = (sources as any[]).find((s) => s?.type === "mp4" && !!s?.url);
      const url = String(fallback?.url ?? "");
      // Height 0 = belum sempat dicek. Video yang sedang diputar sudah pasti
      // punya tinggi, jadi itu dipakai supaya labelnya tetap jujur.
      const live = videoRef.current?.videoHeight ?? 0;
      return { url, height: url ? (srcHeights[url] ?? live) : 0 };
    },
    [bestSourceIdxFor, sources, srcHeights],
  );

  // Dipakai popup unduhan untuk mengecek apakah ada yang bisa diunduh.
  const downloadUrl = useMemo(
    () => downloadUrlFor(quality).url,
    [downloadUrlFor, quality],
  );

  // ------------------------------------- gesture brightness & volume ----
  // Kecerahan = kecerahan LAYAR HP, bukan video.
  // Bukan filter di elemen <video> (itu memaksa GPU menggambar ulang tiap
  // frame dan bikin HP panas). Pakai lapisan hitam/putih di atas seluruh
  // layar: tidak menyentuh decode video sama sekali.
  // Geser hanya berlaku kalau jari mulai dari tombolnya, bukan dari mana saja.
  const VOL_MAX = 2; // 2x suara lewat Web Audio (volume HTML mentok di 1)
  const levelToBrightness = (l: number) => l;
  /** 1 = volume normal, >1 = lebih keras dari maksimal bawaan. */
  const gainRef = useRef<number>(1);
  const audioRef = useRef<{
    ctx: AudioContext;
    gain: GainNode;
  } | null>(null);

  // 0.5 = layar normal, di bawah 0.5 layar digelapkan (overlay hitam), di atas
  // 0.5 layar dibuat lebih terang tanpa jadi lapisan putih penuh.
  const [brightness, setBrightness] = useState(0.5);
  // Lapisan gelap hanya untuk sisi gelap. Sisi terang memakai opacity kecil
  // saja supaya layar tidak terlihat ditutup cat putih.
  const dimOpacity = brightness < 0.5 ? (0.5 - brightness) * 1.2 : 0;
  /**
   * Kecerahan di atas 50% TIDAK memakai lapisan putih (itu bikin gambar
   * pucat, bukan lebih jernih). Diganti filter komposit di elemen video:
   * kontras & saturasi naik, kesannya gambar lebih tajam dan "HD".
   * Filter CSS dijalankan GPU setelah frame jadi, jadi tidak menambah
   * beban decode dan HP tidak jadi panas.
   */
  const liftAmount = brightness > 0.5 ? (brightness - 0.5) * 2 : 0;
  /** Toggle "HD" — hanya tampil di layar penuh lanskap. */
  const [hdBoost, setHdBoost] = useState(false);
  /**
   * Filter video. Naikkan kecerahan (lift) memang boleh mengubah kontras dan
   * saturasi — itu memang efek "lebih terang". Tombol HD dipisah penuh:
   * HANYA ketajaman lewat filter SVG (feConvolveMatrix / unsharp mask),
   * tanpa menyentuh warna, saturasi, atau kecerahan gambar.
   */
  const videoFilter = [
    `contrast(${(1.06 + liftAmount * 0.18).toFixed(3)})`,
    `saturate(${(1.04 + liftAmount * 0.22).toFixed(3)})`,
    // Naikkan kecerahan sedikit tanpa menutupi gambar dengan cat putih.
    liftAmount > 0 ? `brightness(${(1 + liftAmount * 0.24).toFixed(3)})` : "",
    // HD = ketajaman murni, bukan koreksi warna.
    hdBoost ? "url(#yn-sharpen)" : "",
  ]
    .filter(Boolean)
    .join(" ");
  /**
   * Tombol HD.lywood DULU hanya menyalakan filter CSS (unsharp mask) — itu
   * hanya night's sharpening, tidak menambah detail sama sekali, jadi video
   * yang benar-benar buram tetap buram dan tombolnya terasa tidak berfungsi.
   * Sekarang tombol ini benar-benar mengganti LEVEL HLS ke resolusi
   * tertinggi yang tersedia di stream (dibatasi 1080p untuk Premium, 720p
   * untuk akun biasa sesuai aturan yang sudah ada di app). Filter CSS tetap
   * dipakai sebagai penyempurnaan, bukan satu-satunya effector.
   */
  /**
   * Tombol HD.
   *
   * Dulu tombol ini hanya menyalakan filter CSS (unsharp mask). Itu cuma
   * night's sharpening: detail yang hilang tetap hilang, jadi video 480p tetap
   * buram dan tombolnya terasa tidak berfungsi sama sekali. Sekarang tombol ini
   * benar-benar mengganti SUMBER VIDEO ke resolusi tertinggi yang tersedia di
   * episode ini (level HLS tertinggi, atau server MP4 dengan file tertinggi),
   * lalu mengunci pilihan itu. Filter CSS tetap dipakai sebagai penyempurnan,
   * bukan satu-satunya effector.
   */
  const toggleHd = useCallback(() => {
    setHdBoost((v) => {
      const next = !v;
      // Akun non-Premium tetap tertahan di 720p sesuai aturan app.
      const cap = (user?.premiumUntil ?? 0) > Date.now() ? 1080 : 720;
      if (next) {
        // Resolusi tertinggi yang benar-benar ada di stream ini.
        const avail = sourceType === "hls" ? levels : Object.values(srcHeights);
        const top = avail.reduce((a, b) => (b > a ? b : a), 0);
        const want = top > 0 ? Math.min(top, cap) : cap;
        applyQuality(`${want}p`);
        setQualityTouched(true);
        setQuality(`${want}p`);
      } else {
        // Mati lagi: kembali ke resolusi sesuai pilihan kualitas di bawah.
        applyQuality(quality);
      }
      return next;
    });
  }, [quality, user?.premiumUntil, sourceType, levels, srcHeights, applyQuality]);

  const [volumeLevel, setVolumeLevel] = useState(0.5);
  const gestureRef = useRef<{
    kind: "brightness" | "volume";
    startX: number;
    startValue: number;
    moved: boolean;
  } | null>(null);
  

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

  const endGesture = () => {
    gestureRef.current = null;
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

  /**
   * Geser kecerahan/volume HANYA berlaku kalau jari mulai dari tombolnya,
   * dan arahnya KIRI-KANAN (bukan atas-bawah), mengikuti arah bilah isian
   * yang terlihat di layar. Geser permukaan video tidak mengubah apa pun.
   */
  const startLevelDrag =
    (kind: "brightness" | "volume") => (e: React.PointerEvent) => {
      const startValue = kind === "brightness" ? brightness : volumeLevel;
      gestureRef.current = {
        kind,
        startX: e.clientX,
        startValue,
        moved: false,
      };
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    };
  const moveLevelDrag = (e: React.PointerEvent) => {
    const g = gestureRef.current;
    if (!g) return;
    const dx = e.clientX - g.startX;
    if (!g.moved && Math.abs(dx) < 8) return;
    g.moved = true;
    // 140px geser = 100% perubahan. Arah kanan = naik, kiri = turun.
    const next = Math.max(0, Math.min(1, g.startValue + dx / 140));
    if (g.kind === "brightness") {
      setBrightness(Math.round(levelToBrightness(next) * 100) / 100);
    } else {
      applyVolume(next);
    }
  };
  const endLevelDrag = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    endGesture();
  };
  // Komentar dengan echo lokal: pesan langsung tampil sebelum server menyalinnya.
  const [pendingComments, setPendingComments] = useState<CommentT[]>([]);
  // Komentar yang baru saja dihapus user — dikeluarkan dari daftar seketika.
  const [removedComments, setRemovedComments] = useState<Set<string>>(new Set());

  // Ganti subtitle: textTrack yang dipilih = "showing", lainnya dimatikan.
  const pickSub = (label: string) => {
    setActiveSub(label);
    setSubTouched(true);
    setSubOpen(false);
    // Track bawaan browser dimatikan semua — subtitle kita render sendiri.
    const v = videoRef.current;
    if (v) Array.from(v.textTracks).forEach((t) => (t.mode = "disabled"));
  };

  // Subtitle selalu Bahasa Indonesia: kalau video sudah membawa subtitle
  // Indonesia-nya sendiri (sumber direct/HLS), otak tersebut dipakai. Kalau
  // tidak, lagu hasil terjemahan otomatis YoruNime (autoVtt) yang dipakai.
  // Tidak ada fallback ke track bahasa lain server: nonton di YoruNime
  // selalu Indonesia, jadi menampilkan subtitle server asli (Inggris/Mandarin
  // dan seterusnya) tidak pernah diinginkan.
  useEffect(() => {
    if (subTouched) return;
    // Subtitle sudah menempel di video (HLS Sub Indo) → jangan tambah apa-apa.
    if (bakedSubs) {
      setActiveSub("");
      return;
    }
    // Priority: (1) subtitle Indonesia yang sudah menempel di video, (2) lagu
    // terjemahan otomatis YoruNime. Jangan pakai track native dari server
    // (harusnya subtitle milik user, bukan subtitle server asli) mengalah.
    if (autoVtt) setActiveSub(AUTO_SUB);
  }, [autoVtt, subTouched, bakedSubs]);

  // Ambil isi subtitle yang sedang dipakai (bisa langsung tertulis pada video
  // terlampir/source, atau lirik terjemahan otomatis YoruNime dari
  // `autoVtt`) lalu simpan sebagai cue untuk digambar sendiri oleh player.
  // Dijaga agar lirik mengikuti posisi suara, dan selalu sesuai subtitle
  // yang telah dipilih pengguna — bukan subtitle server aslinya.
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
    // Subtitle yang sudah tertulis pada video source (HLS Sub Indo) dia
    // dibaca oleh player sendiri; di sini kita hanya menyiapkan cue dari
    // sumber yang dipilih, tidak peduli dari mana lirik aslinya. Jika
    // subtitle tidak tersedia, biarkan cue kosong dan player tidak
    // menggambar teks.
  }, [activeSub, autoVtt]);

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
      setAutoSubLoading(false);
      return;
    }
    // Donghua: slug-nya bukan MAL id, jadi jalurnya terpisah.
    if (isDonghua) {
      const key = `yorunime-sub-donghua:${epParam}`;
      const cachedDonghua = (() => {
        try {
          return localStorage.getItem(key);
        } catch {
          return null;
        }
      })();
      setAutoVtt("");
      setAutoSubError("");
      setAutoSubSource("");
      if (cachedDonghua && cachedDonghua.includes("WEBVTT")) {
        setAutoVtt(cachedDonghua);
        return;
      }
      let aliveDh = true;
      setAutoSubLoading(true);
      donghuaSub({ slug: epParam })
        .then((r: any) => {
          if (!aliveDh) return;
          if (!r?.ok || !r.vtt) {
            setAutoSubError(
              r?.reason ?? "Subtitle Indonesia belum tersedia untuk episode ini",
            );
            return;
          }
          try {
            localStorage.setItem(key, r.vtt);
          } catch {
            /* storage penuh */
          }
          setAutoVtt(r.vtt);
          setAutoSubSource(String(r.source ?? "auto"));
          if (r.source === "raw")
            setAutoSubError("Terjemahan subtitle gagal, dipakai subtitle asli");
        })
        .catch(() => {
          if (aliveDh) setAutoSubError("Subtitle Indonesia gagal dimuat");
        })
        .finally(() => {
          if (aliveDh) setAutoSubLoading(false);
        });
      return () => {
        aliveDh = false;
      };
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
    // Auto-retry: kalau muat subtitle Indonesia gagal (jaringan/race dengan
    // server MegaPlay), coba lagi sampai 3 kali dengan jeda 1.2s — supaya
    // sebelum percakapan pertama mulai, subtitle Indonesia sudah termuat dan
    // user tidak kejebak subtitle English milik server.
    let attempt = 0;
    let retryTimer: number | null = null;
    const load = () => {
      setAutoSubLoading(true);
      subtitleIndo({ malId, ep: Number(epNo) || 1 })
        .then((r: any) => {
          if (!alive) return;
          if (!r?.ok || !r.vtt) {
            attempt += 1;
            if (attempt < 3) {
              retryTimer = window.setTimeout(load, 1200);
              return;
            }
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
          if (!alive) return;
          attempt += 1;
          if (attempt < 3) {
            retryTimer = window.setTimeout(load, 1200);
            return;
          }
          setAutoSubError("Subtitle Indonesia gagal dimuat");
        })
        .finally(() => {
          if (alive) setAutoSubLoading(false);
        });
    };
    load();
    return () => {
      alive = false;
      if (retryTimer !== null) window.clearTimeout(retryTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [epParam, animeId, isDonghua, bakedSubs, !!direct?.ok, subRetry]);

  const [detailData, setDetailData] = useState<any>(null);
  // Episode yang langsung tampil di grid; sisanya lewat "Lihat semua".
  const [epAllOpen, setEpAllOpen] = useState(false);

  const epList = detailData?.episodeList ?? [];
  const epIndex = epList.findIndex((e: any) => e.id === epParam);
  // Kalau episode yang diminta tidak ada di daftar, jangan diam-diam memakai
  // episode 1: itu bikin judul dan nomor episode di layar salah.
  const currentEp =
    epIndex >= 0 ? epList[epIndex] : (epList.find((e: any) => e.id === epParam) ?? null);

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
    if (!animeId) return;
    // Donghua: slug-nya milik SankaVollereii, bukan AniList/Jikan, jadi detail
    // anime biasa tidak akan menemukan apa pun. Daftar episodenya diambil dari
    // Sanka lalu dipetakan ke bentuk yang sama dengan detail anime, sehingga
    // seluruh UI episode (indeks, berikutnya/ sebelumnya, numbering) tetap
    // bekerja tanpa jalur kode kedua.
    if (isDonghua) {
      sankaDetail({ slug: animeId, preferDonghua: true })
        .then((d: any) => {
          if (d?.error) {
            setDetailData({ error: true });
            return;
          }
          const list = (d?.episodes ?? [])
            .slice()
            .sort((a: any, b: any) => a.number - b.number)
            .map((e: any) => ({
              id: `sanka__${e.url}__ep${e.number || 1}`,
              number: e.number || 1,
              title: e.title ?? "",
            }));
          setDetailData({
            title: d?.title ?? "",
            image: d?.cover ?? d?.poster ?? "",
            synopsis: d?.synopsis ?? "",
            genres: d?.genres ?? [],
            rating: d?.rating,
            status: d?.status,
            source: d?.source,
            episodeList: list,
          });
          if (!epParam && list[0]) {
            navigate(`/nonton?anime=${animeId}&ep=${list[0].id}&donghua=1`, {
              replace: true,
            });
          }
        })
        .catch(() => setDetailData({ error: true }));
      return;
    }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animeId, epParam, isDonghua]);

  // Detail anime sudah siap (dipakai sebagai sumber nomor episode & judul).
  const detailReady = !!detailData && !detailData.error;

  // Like (menyatu) + Favorite untuk judul ini.
  const likeStats = useQuery(
    api.activities.animeLikeStats,
    animeId ? { animeId } : "skip",
  );
  const toggleLike = useMutation(api.activities.toggleAnimeLike);
  // Id favorite DONGHUA harus sama dengan yang dipakai layar detail donghua
  // (`donghua:<slug>`) — kalau berbeda, satu judul jadi dua baris Subscribe.
  const favId = isDonghua ? `donghua:${animeId}` : animeId;
  const isFav = useQuery(
    api.activities.isFavorite,
    animeId ? { animeId: favId } : "skip",
  );
  const toggleFav = useMutation(api.activities.toggleFavorite);
  // (Angka jumlah favorite tidak lagi ditampilkan sesuai permintaan.)
  // Layar laporan anime (tombol Laporkan) — hasilnya masuk notifikasi dev.
  const [reportOpen, setReportOpen] = useState(false);

  // Ambil server streaming. Backend mengembalikan tepat satu server:
  // "Direct HLS - SUB".
  //
  // Kecepatan: kalau id episode sudah berbentuk "<malId>__ep<no>" (semua anime
  // dari AniList/Jikan) server langsung dicari tanpa menunggu detail anime
  // selesai, karena MAL id dan nomor episodenya sudah ada di URL. Detail hanya
  // ditunggu untuk anime tanpa MAL id, karena nomor episodenya ada di sana.
  useEffect(() => {
    if (!epParam) return;
    // Episode donghua: id-nya "sanka__<slug_episode>__ep<no>". Ditangani
    // sebelum logika anime karena slug-nya bukan MAL id sama sekali.
    const sk = epParam.match(/^sanka__(.+)__ep(\d+)$/);
    if (sk) {
      const skKey = `sanka__${sk[1]}`;
      const applySanka = (d: any) => {
        if (!d?.ok) {
          setDirectErr(d?.reason ?? "Episode belum tersedia");
          return;
        }
        setDirectErr(null);
        setDirect(d);
        setSubTouched(false);
        setSources(d.sources);
        setSourceType("embed");
        setSourceIdx(0);
        // Sama seperti anime: hitungan mundur dimulai setelah sumber siap.
        setNowTick(Date.now());
        setHoldUntil(WATCH_DELAY_MS > 0 ? Date.now() + WATCH_DELAY_MS : 0);
      };
      lastEpRef.current = epParam;
      deadServers.current = new Set();
      // Sama seperti anime: hitungan dimulai sejak memuat, bukan setelah siap.
      setNowTick(Date.now());
      setHoldUntil(WATCH_DELAY_MS > 0 ? Date.now() + WATCH_DELAY_MS : 0);
      setSources([]);
      setDirect(null);
      setDirectErr(null);
      setCurrentTime(0);
      setDuration(0);
      setCues([]);
      const cachedSanka = resolvedRef.current.get(skKey);
      if (cachedSanka) {
        applySanka(cachedSanka);
        return;
      }
      resolveDonghua({ slug: sk[1], source: detailData?.source })
        .then((d: any) => {
          if (d?.ok) resolvedRef.current.set(skKey, d);
          applySanka(d);
        })
        .catch((e: any) => setDirectErr(e?.message ?? "Gagal memuat episode"));
      return;
    }
    const mm = epParam.match(/^(\d+)__ep(\d+)$/);
    if (!mm && !detailReady) return;
    // Dua bentuk id episode:
    //  - "<malId>__ep<no>" untuk anime dari AniList/Jikan (MAL id).
    //  - id episode bebas (mis. Otakudesu) untuk anime tanpa MAL id. Nomor
    //    episodenya diambil dari daftar detail, dan backend hanya memakai
    //    sumber subtitle Indonesia karena MegaPlay butuh MAL id.
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
      // MP4 diutamakan sebagai sumber awal: langsung diputar tanpa baca
      // manifest, jadi frame pertama jauh lebih cepat dan tidak mungkin
      // macet di "Memuat episode...". Kalau file-nya rusak, failover tetap
      // pindah ke server berikutnya seperti biasa.
      const mp4Idx = (d.sources as any[]).findIndex(
        (s: any) => s?.type === "mp4" && !!s?.url,
      );
      const fi = mp4Idx >= 0 ? mp4Idx : 0;
      const ft = d.sources?.[fi]?.type;
      setSourceType(ft === "hls" ? "hls" : ft === "mp4" ? "mp4" : "embed");
      setSourceIdx(fi);
      // Mulai hitungan mundur SETELAH sumber siap - sama seperti pembaca
      // komik, gambar/video sudah dimuat, hitungan cuma jeda tampil.
      setNowTick(Date.now());
      setHoldUntil(WATCH_DELAY_MS > 0 ? Date.now() + WATCH_DELAY_MS : 0);
    };

    // Kalau perpindahan terjadi saat video masih diputar, tandai untuk autoplay.
    if (lastEpRef.current && lastEpRef.current !== epParam) {
      const v = videoRef.current;
      autoplayNextRef.current = !!(v && !v.paused && !v.ended);
    }
    lastEpRef.current = epParam;
    deadServers.current = new Set();
    // Hitungan mundur dimulai SEKARANG (saat mulai memuat), bukan setelah
    // selesai. Dulu hitungannya baru jalan setelah URL siap, sehingga user
    // masih melihat "Memuat episode..." dulu - itu yang membuat terasa lama.
    // Kalau memuat selesai lebih cepat dari hitungan, video tetap menunggu
    // hitungan habis; kalau lebih lambat, hitungan terus tampil sampai siap.
    setNowTick(Date.now());
    setHoldUntil(WATCH_DELAY_MS > 0 ? Date.now() + WATCH_DELAY_MS : 0);
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
      // Judul dari URL (kalau ada), kalau tidak pakai judul dari detail anime.
      title: params.get("judul") ?? (detailReady ? detailData.title : ""),
      // Premium: jalur resolusi cepat (paralel + sumber dibatasi).
      fast: isPremium,
    })
      .then((d: any) => {
        if (d?.ok) resolvedRef.current.set(key, d);
        applyData(d);
      })
      .catch((e: any) => setDirectErr(e?.message ?? "Gagal memuat episode"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailReady, epParam]);

  // Pramuat episode di sekitar episode aktif (sebelum & sesudah) di
  // latar belakang: saat user menekan episode lain, URL-nya sudah siap sehingga
  // playback langsung jalan tanpa jeda loading.
  useEffect(() => {
    if (!epParam || !detailData || detailData.error) return;
    const targets = [epList[epIndex - 1], epList[epIndex + 1]].filter(Boolean);
    if (targets.length === 0) return;
    let alive = true;
    targets.forEach((next: any) => {
      const mm = next?.id?.match?.(/^(\d+)__ep(\d+)$/);
      const epNumber = mm ? Number(mm[2]) || 1 : (next?.number ?? 1);
      const malId = mm ? mm[1] : (/^\d+$/.test(animeId) ? animeId : undefined);
      const key = `${malId ?? animeId}__ep${epNumber}`;
      if (resolvedRef.current.has(key)) return null;
      return resolveDirect({
        malId,
        ep: epNumber,
        title: detailData.title,
        fast: isPremium,
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
        backBufferLength: 60,
        // Buffer lebih dalam = buffering lebih jarang. Nilai sebelumnya
        // (20/60) sering kehabisan di tengah episode dan video berhenti
        // sesaat, padahal jaringan sebenarnya masih bagus.
        maxBufferLength: 45,
        maxMaxBufferLength: 120,
        maxBufferSize: 80 * 1000 * 1000,
        // Fragmen berikutnya langsung diunduh begitu mungkin — mengurangi
        // jeda saat seek atau saat buffer habis.
        startFragPrefetch: true,
        // Tebakan bandwidth yang terlalu rendah membuat hls.js turun ke
        // level rendah lalu naik perlahan lagi (gambar buram + buffering).
        abrEwmaDefaultEstimate: 4_000_000,
        abrEwmaFastLive: 3.0,
        abrEwmaSlowLive: 9.0,
      });
      hlsRef.current = hls;
      hls.loadSource(streamUrl);
      hls.attachMedia(v);
      // Pasang level sesuai kualitas yang dipilih begitu manifest terbaca.
      // `setLevels` WAJIB dipanggil di sini: efek lama membacanya dari
      // `hlsRef.current` saat server baru diganti, padahal saat itu manifest
      // belum di-fetch, jadi daftarnya kosong dan level yang dikunci selalu
      // dianggap "tidak tersedia". Akibatnya tombol kualitas tidak pernah
      // benar-benar mengganti gambar.
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setLevels(availableQualities(hls));
        applyLevel(hls, quality);
      });
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

  // Ganti kualitas saat nonton -> benar-benar diterapkan ke player, baik ke
  // level HLS maupun ke server MP4 yang resolusinya paling cocok. Di layar
  // penuh (fullscreen) otomatis dinaikkan ke resolusi tertinggi yang boleh
  // diakses: 1080p hanya kalau akun punya Premium.
  const isPremiumNow = (user?.premiumUntil ?? 0) > Date.now();
  useEffect(() => {
    // HD aktif = pilihan user yang menang, jangan ditimpa aturan otomatis.
    if (hdBoost) return;
    const wanted =
      isFs && isPremiumNow
        ? PREMIUM_QUALITY
        : isFs
          ? "720p"
          : quality === PREMIUM_QUALITY && !isPremiumNow
            ? "720p"
            : quality;
    applyQuality(wanted);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quality, isFs, isPremiumNow, hdBoost, applyQuality]);

  // HD aktif: setiap kali level/stream dikenal (termasuk level HLS yang datang
  // belakangan setelah tombol HD ditekan), paksakan ke resolusi tertinggi yang
  // boleh — inilah bagian "ningkatin kualitas" dari tombol HD.
  useEffect(() => {
    if (!hdBoost) return;
    const avail = sourceType === "hls" ? levels : Object.values(srcHeights);
    const top = avail.reduce((a, b) => (b > a ? b : a), 0);
    if (top <= 0) return; // level belum diketahui; toggleHd sudah menerapkan cap
    const cap = isPremiumNow ? 1080 : 720;
    applyQuality(`${Math.min(top, cap)}p`);
  }, [hdBoost, levels, srcHeights, sourceType, isPremiumNow, applyQuality]);

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
    flashSpeedNotice(`${speed}x speed`);
    return () => {
      if (speedNoticeTimer.current) clearTimeout(speedNoticeTimer.current);
    };
  }, [speed, flashSpeedNotice]);

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

  /**
   * Unduh episode pada resolusi tertentu.
   *
   * Alurnya: resolusi -> server MP4 yang tinggi filenya paling cocok -> masuk
   * daftar Download. Popup ditutup begitu tombol ditekan, lalu worker unduhan
   * (<DownloadWorker />) yang mulai menarik filenya. Label kualitas yang
   * disimpan adalah kenyataan file, bukan angka yang ditekan, supaya daftar
   * Download tidak pernah menampilkan "1080p" untuk file 480p.
   *
   * Jalur ini sama untuk anime maupun donghua: keduanya lewat `sources` yang
   * sama, jadi tidak ada perilaku khusus per jenis.
   */
  const startDownload = useCallback(
    (q: string) => {
      if (!currentEp) return;
      const pick = downloadUrlFor(q);
      if (!pick.url) {
        toast.error("Belum ada server MP4 untuk episode ini");
        return;
      }
      const asked = parseInt(q, 10) || 720;
      const label = pick.height > 0 && pick.height < asked ? `${pick.height}p` : q;
      const title = detailData?.title ?? "Anime";
      const image = detailData?.image;
      setPendingQuality(q);
      void enqueueDownload({
        animeId,
        animeTitle: title,
        animeImage: typeof image === "string" && image ? image : undefined,
        episode: currentEp.number,
        episodeId: epParam ?? undefined,
        quality: label,
        url: pick.url,
      })
        .then(() => {
          // Popup ditutup begitu tombol ditekan, bukan setelah server
          // membalas, supaya tidak terasa lambat.
          setDownloadOpen(false);
          toast.success(
            label === q
              ? `Mengunduh ${title} Episode ${currentEp.number} (${label})`
              : `Server ini hanya menyediakan ${label}, jadi itu yang diunduh`,
          );
        })
        .catch((e: unknown) => {
          toast.error(e instanceof Error ? e.message : "Gagal membuat unduhan");
        })
        .finally(() => setPendingQuality(null));
    },
    [animeId, detailData, currentEp, epParam, downloadUrlFor, enqueueDownload],
  );

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
  const tapVideo = () => {
    // Sedang terkunci: tap video tidak menghidupkan kontrol apa pun.
    if (uiLocked) return;
    setControlsOn((v) => !v);
  };

  useEffect(() => {
    if (!playing) {
      setControlsOn(true);
      return;
    }
    if (!controlsOn) return;
    const t = window.setTimeout(() => setControlsOn(false), 3000);
    return () => clearTimeout(t);
  }, [playing, controlsOn]);

  // Status layar penuh. Beberapa browser (terutama Safari iOS) memakai
  // prefix `webkit` dan elemen yang/fullscreen-nya bukan playerRef, jadi
  // cukup dicek "ada elemen fullscreen atau tidak", bukan elemen apa.
  const fullscreenElement = () =>
    (document.fullscreenElement ??
      (document as any).webkitFullscreenElement ??
      null) as Element | null;

  // Perpindahan masuk/keluar layar penuh mengubah ukuran & rasio kotak video,
  // dan beberapa browser (Chrome di Android) deems ulang dekode frame sehingga
  // event `waiting` sempat menyala. Kalau spinner langsung ditampilkan, user
  // mengira videonya buffering padahal masih diputar. Jadi ada jeda singkat
  // tanpa spinner setiap kali status layar penuh berubah.
  const [fsSettle, setFsSettle] = useState(false);
  // Prefix dipakai hanya di sini supaya logika keluar layar penuh tetap sama
  // di browser yang hanya mendukung API lama.
  useEffect(() => {
    const settle = () => {
      const fsNow = !!fullscreenElement();
      setIsFs(fsNow);
      // Keluar layar penuh = kunci UI otomatis dilepas.
      if (!fsNow) setUiLocked(false);
      setControlsOn(true);
      // Simpan posisi sekarang supaya playback tidak mundur saat browser
      // membaca ulang dekode frame setelah ukuran layar berubah.
      resumeAtRef.current = videoRef.current?.currentTime ?? 0;
      setFsSettle(true);
      window.setTimeout(() => {
        setFsSettle(false);
        setWaiting(false);
      }, 900);
    };
    document.addEventListener("fullscreenchange", settle);
    document.addEventListener("webkitfullscreenchange", settle);
    // Safari iOS: video punya layar penuh sendiri yang tidak pernah menyentuh
    // document.fullscreenElement, jadi status UI diambil dari event ini.
    const onNativeFs = (e: Event) => {
      const fsNow = e.type === "webkitbeginfullscreen";
      setIsFs(fsNow);
      if (!fsNow) setUiLocked(false);
      setControlsOn(true);
    };
    document.addEventListener("webkitbeginfullscreen", onNativeFs);
    document.addEventListener("webkitendfullscreen", onNativeFs);
    return () => {
      document.removeEventListener("fullscreenchange", settle);
      document.removeEventListener("webkitfullscreenchange", settle);
      document.removeEventListener("webkitbeginfullscreen", onNativeFs);
      document.removeEventListener("webkitendfullscreen", onNativeFs);
    };
  }, []);

  // Room Nobar harus FULLSCREEN begitu dibuka, bukan panel di atas halaman
  // detail anime. Permintaan Fullscreen Element hanya boleh datang dari
  // interaksi user; perpindahan di sini terjadi lewat klik "Gabung" (bukan
  // render async), sehingga request-nya masih di dalam jangkauan interaksi
  // tersebut dan browser mengizinkannya.
  const autoFsTried = useRef(false);
  useEffect(() => {
    if (!roomId || autoFsTried.current) return;
    if (fullscreenElement()) {
      autoFsTried.current = true;
      setIsFs(true);
      return;
    }
    autoFsTried.current = true;
    const el = playerRef.current;
    if (!el) return;
    const req =
      el.requestFullscreen ??
      (el as any).webkitRequestFullscreen ??
      (el as any).webkitEnterFullscreen;
    if (!req) return;
    void Promise.resolve(req.call(el))
      .then(() => {
        setIsFs(true);
        try {
          void (screen.orientation as any)?.lock?.("landscape");
        } catch {
          /* tidak didukung */
        }
      })
      .catch(() => {
        // Browser menolak (butuh interaksi user). Player tetap tampil di
        // halaman penuh — user bisa menekan tombol layar penuh sendiri.
      });
  }, [roomId]);

  const toggleFullscreen = async () => {
    const el = playerRef.current;
    if (!el) return;
    const req =
      el.requestFullscreen ??
      (el as any).webkitRequestFullscreen ??
      (el as any).webkitEnterFullscreen;
    try {
      // Kalau sedang fullscreen (elemen mana pun), tombol ini mengeluarkan
      // player supaya navbar dan tombol lain kembali terlihat.
      if (fullscreenElement()) {
        await exitFullscreen();
        return;
      }
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

  /** Keluar layar penuh dengan sengaja (tombol "keluar layar penuh"). */
  const exitFullscreen = async () => {
    // Status langsung dimatikan supaya navbar muncul seketika, tanpa menunggu
    // event fullscreenchange yang kadang tidak datang di browser lama.
    setIsFs(false);
    try {
      const exit =
        document.exitFullscreen ?? (document as any).webkitExitFullscreen;
      if (fullscreenElement() && exit) await exit.call(document);
    } catch {
      /* abaikan */
    }
    try {
      await (screen.orientation as any)?.unlock?.();
      await (screen.orientation as any)?.lock?.("portrait");
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

  // Host: tandai masih hidup. Kalau host menutup aplikasi atau koneksinya
  // putus, tanda ini berhenti dan room otomatis dianggap bubar (hilang dari
  // daftar, tidak muncul lagi).
  const roomHeartbeat = useMutation(api.watchroom.heartbeat);
  useEffect(() => {
    if (!room || !isHost) return;
    const beat = () => void roomHeartbeat({ roomId: room._id });
    beat();
    const t = setInterval(beat, 45_000);
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
    const real = ((episodeComments ?? []) as unknown as CommentT[]).filter(
      (r) => !removedComments.has(r._id),
    );
    if (pendingComments.length === 0) return real;
    const keep = pendingComments.filter(
      (p) =>
        !removedComments.has(p._id) &&
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
  }, [episodeComments, pendingComments, removedComments]);

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
          // Di fullscreen kontainer ikut penuh layar HP, bukan cuma kotak
          // 16:9. Video tetap object-contain (ada letterbox), tapi semua
          // tombol dan HUD memakai lebar layar yang sedang dilihat user.
          // Tingginya `100%` (bukan `100dvh`): di layar penuh, `dvh` bisa
          // lebih tinggi dari layar sungguhan (Android pasca-rotasi), sehingga
          // kontainer jadi lebih tinggi dari layar dan tombol HD/keluar di
          // atas serta baris waktu di bawah ikut terpotong.
          isFs
            ? { width: "100%", height: "100%" }
            : { aspectRatio: "16 / 9" }
        }
      >
        {/* Kecerahan layar: hanya sisi gelap yang pakai lapisan hitam. Sisi
            terang tidak ada lapisan putih sama sekali — kecerahan di atas 50%
            diterapkan sebagai filter di elemen video (lihat `videoFilter`). */}
        {dimOpacity > 0 && (
          <div
            aria-hidden
            className="pointer-events-none fixed inset-0 z-[100] bg-black"
            style={{ opacity: dimOpacity }}
          />
        )}

        {/* Filter ketajaman untuk tombol HD: unsharp mask lewat matriks 3x3.
            Kernel jumlahnya 1.0 jadi kecerahan rata-rata tidak berubah —
            yang berbeda cuma tepi detail, tidak ada koreksi warna sama sekali.
            Bobot dinaikkan (2.4 / -0.35) supaya efeknya benar-benar menghilangkan
            burem & blur, bukan cuma memberi sedikit ketajaman. */}
        <svg aria-hidden className="pointer-events-none absolute h-0 w-0">
          <filter id="yn-sharpen" colorInterpolationFilters="sRGB">
            <feConvolveMatrix
              order="3"
              preserveAlpha="true"
              kernelMatrix="0 -0.35 0 -0.35 2.4 -0.35 0 -0.35 0"
            />
          </filter>
        </svg>

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
        ) : videoHolding || !streamUrl ? (
          // Hitungan mundur gaya pembaca komik. Tampil sejak mulai memuat
          // sampai hitungan habis, jadi tidak ada lagi fase "Memuat episode..."
          // yang terasa seperti macet. Kalau memuatnya lebih lambat dari
          // hitungan, angka berhenti di 0 sampai video siap.
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-black text-center">
            {D.image && (
              <div
                className="pointer-events-none absolute inset-0 opacity-40"
                style={{
                  backgroundImage: `url(${D.image})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  filter: "blur(18px) brightness(0.4)",
                }}
              />
            )}
            <div className="relative flex flex-col items-center px-6">
              <div className="relative flex size-20 items-center justify-center rounded-full border border-white/25 bg-black/50">
                <svg
                  viewBox="0 0 100 100"
                  className="absolute inset-0 size-full -rotate-90"
                  aria-hidden
                >
                  <circle
                    cx="50"
                    cy="50"
                    r="46"
                    fill="none"
                    stroke="rgba(255,255,255,.18)"
                    strokeWidth="4"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="46"
                    fill="none"
                    stroke="currentColor"
                    className="text-primary"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 46}
                    strokeDashoffset={
                      2 * Math.PI * 46 * (videoHolding
                        ? (holdUntil - nowTick) / WATCH_DELAY_MS
                        : 0)
                    }
                  />
                </svg>
                <span className="text-2xl font-black text-white">
                  {videoHolding ? Math.ceil((holdUntil - nowTick) / 1000) : ""}
                </span>
              </div>
              <p className="mt-3 text-xs font-semibold text-white">
                {videoHolding ? "Menyiapkan video..." : "Memuat episode..."}
              </p>
              {!isPremiumUser && (
                <p className="mt-1 text-[11px] text-white/55">
                  Member premium langsung masuk tanpa hitungan
                </p>
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
            style={{ filter: videoFilter }}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => {
              // Auto next: sehabis episode selesai, episode berikutnya
              // langsung diputar (autoplay dimulai begitu video baru siap).
              if (!autoNext) return;
              const nxt = epList[epIndex + 1];
              if (nxt?.id) {
                autoplayNextRef.current = true;
                navigate(epUrl(nxt.id), { replace: true });
              }
            }}
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
            {/* Hanya track Bahasa Indonesia yang dimasukkan ke elemen <video>.
                Track bahasa lain milik server sengaja TIDAK di-mount sama
                sekali: browser akan mengunduh file subtitle itu meskipun
                tidak pernah ditampilkan, dan dia tetap bisa terbaca kalau
                `mode`-nya berubah jadi "showing" di jalur lain. */}
            {/* Server native subtitle tracks DO NOT mount here. Player draws
                its own overlay, so only user-selected subtitle source wins. */}
          </video>
        )}
        {/* Subtitle digambar sendiri: teks putih semi-bold dengan outline hitam
            tebal, dibungkus rapat di tengah dan tidak melebar ke samping. */}
        {activeCue && !bakedSubs && (
          <div
            className={cn(
              "pointer-events-none absolute inset-x-0 z-20 flex justify-center px-4",
              // Subtitle duduk sangat rendah, menempel tepi bawah video.
              isFs ? "bottom-5" : "bottom-3 sm:bottom-4",
            )}
          >
            <p
              className={cn(
                "max-w-[min(88%,40rem)] whitespace-pre-line break-words text-center font-semibold leading-snug text-white",
                // Outline tipis & rapi: 4 garis 1px saja + bayangan lembut
                // (bukan outline dobel tebal yang terlihat berantakan).
                "[text-shadow:-1px_-1px_0_#000,1px_-1px_0_#000,-1px_1px_0_#000,1px_1px_0_#000,0_2px_5px_rgba(0,0,0,0.9)]",
                // Teks panjang otomatis dikecilkan supaya tetap satu blok rapi
                // dan tidak menutupi gambar.
                activeCue.length > 90
                  ? isFs
                    ? "text-[11.5px] sm:text-[13px]"
                    : "text-[10.5px] sm:text-[11.5px]"
                  : isFs
                    ? "text-[13px] sm:text-[15px]"
                    : "text-[11.5px] sm:text-[13px]",
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

        {/* Lapisan tap saja: sentuh singkat → kontrol tampil/sembunyi;
            tekan LAMA → kecepatan 2x sementara + notifikasi speed. */}
        {sourceType !== "embed" && (isHost || !room) && (
          <div
            className="absolute inset-0 z-10 touch-none"
            onPointerDown={() => {
              longPressFiredRef.current = false;
              if (longPressTimer.current) clearTimeout(longPressTimer.current);
              longPressTimer.current = window.setTimeout(() => {
                longPressFiredRef.current = true;
                const boosted = Math.max(2, speed * 2);
                const v = videoRef.current;
                if (v) v.playbackRate = boosted;
                flashSpeedNotice(`${boosted}x speed`);
              }, 400);
            }}
            onPointerUp={() => {
              if (longPressTimer.current) {
                clearTimeout(longPressTimer.current);
                longPressTimer.current = null;
              }
              if (longPressFiredRef.current) {
                // Tekan-lama selesai: kecepatan balik ke settingan user dan
                // kontrol TIDAK ikut ditoggle.
                longPressFiredRef.current = false;
                const v = videoRef.current;
                if (v) v.playbackRate = speed;
                return;
              }
              tapVideo();
            }}
            onPointerLeave={() => {
              if (longPressTimer.current) {
                clearTimeout(longPressTimer.current);
                longPressTimer.current = null;
              }
              if (longPressFiredRef.current) {
                longPressFiredRef.current = false;
                const v = videoRef.current;
                if (v) v.playbackRate = speed;
              }
            }}
            onPointerCancel={() => {
              if (longPressTimer.current) {
                clearTimeout(longPressTimer.current);
                longPressTimer.current = null;
              }
              longPressFiredRef.current = false;
            }}
          />
        )}

        {/* Tidak ada HUD gesture sama sekali: nilai kecerahan & volume sudah
            terbaca langsung dari slider di bar kontrol, jadi overlay melayang
            di atas video hanya menambah clutter. */}

        {/* Tombol keluar layar penuh — tetap ada walau kontrol disembunyikan */}
        {isFs && (
          <div className="absolute right-3 top-3 z-30 flex items-center gap-2">
            {/* Selama terkunci, HD & tombol keluar ikut disembunyikan:
                gembok adalah satu-satunya UI yang kelihatan. */}
            {!uiLocked && (
              <>
                {/* Perjelas gambar: naikkan level HLS ke resolusi tertinggi yang
                    tersedia (1080p khusus Premium) + pengasahan halus.
                    Hanya tampil di layar penuh (landscape). */}
                <button
                  onClick={toggleHd}
                  aria-pressed={hdBoost}
                  aria-label="Perjelas gambar"
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-bold",
                    hdBoost
                      ? "bg-white text-black"
                      : "bg-black/55 text-white backdrop-blur",
                  )}
                >
                  HD
                </button>
                <button
                  onClick={exitFullscreen}
                  className="rounded-full bg-black/55 p-2"
                  aria-label="Keluar layar penuh"
                >
                  <Minimize className="size-5 text-white" />
                </button>
              </>
            )}
            {/* Kunci kontrol: tekan sekali → semua UI hilang, tombol jadi
                latar putih; tekan lagi → semuanya kembali seperti semula. */}
            <button
              onClick={() => {
                const next = !uiLocked;
                // Kunci → kontrol langsung disembunyikan; buka kunci →
                // semua kontrol langsung tampil kembali seperti semula.
                setUiLocked(next);
                setControlsOn(!next);
              }}
              aria-pressed={uiLocked}
              aria-label={uiLocked ? "Buka kunci kontrol" : "Kunci kontrol"}
              className={cn(
                "rounded-full p-2 transition",
                uiLocked
                  ? "bg-white text-black"
                  : "bg-black/55 text-white backdrop-blur",
              )}
            >
              <Lock className="size-5" />
            </button>
          </div>
        )}

        {/* Overlay controls — di fullscreen tata letaknya menyesuaikan landscape */}
        {/* Kontrol hanya digambar kalau stream sudah ada: saat masih memuat,
            layar cukup poster + spinner tanpa tombol/seek bar/slider yang
            saling menumpuk. */}
        {controlsOn &&
          !uiLocked &&
          sourceType !== "embed" &&
          !!streamUrl &&
          (isHost || !room) && (
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
              isFs ? "gap-9 pb-3" : "gap-4 pb-2",
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
                navigate(epUrl(epList[epIndex - 1].id));
              }}
              className={cn(
                "rounded-full bg-black/50 p-1.5",
                (room ? (currentEp?.number ?? 1) <= 1 : epIndex <= 0) && "opacity-30",
              )}
            >
              <SkipBack className="size-4 text-white" />
            </button>
            <button onClick={() => skip(-10)} className="rounded-full bg-black/50 p-1.5">
              <RotateCcw className="size-5 text-white" />
            </button>
            {/* Play/pause diperkecil supaya tombol Auto next di bawahnya
                tidak ketutup dan tetap bisa dipencet. */}
            <button onClick={togglePlay} className="rounded-full bg-primary p-2.5">
              {playing ? (
                <Pause className="size-6 text-primary-foreground" />
              ) : (
                <Play className="size-6 text-primary-foreground" />
              )}
            </button>
            <button onClick={() => skip(10)} className="rounded-full bg-black/50 p-1.5">
              <RotateCw className="size-5 text-white" />
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
                navigate(epUrl(epList[epIndex + 1].id));
              }}
              className={cn(
                "rounded-full bg-black/50 p-1.5",
                (room
                  ? (currentEp?.number ?? 1) >= epList.length
                  : epIndex >= epList.length - 1) && "opacity-30",
              )}
            >
              <SkipForward className="size-4 text-white" />
            </button>
            {/* Tombol keluar layar penuh yang posisinya tetap (di baris atas) */}
          </div>
          <div
            className={cn(
              "pointer-events-auto space-y-1.5",
              isFs ? "px-2 pb-1" : "px-3 pb-3",
            )}
          >
            {/* Kecerahan & volume: hanya di layar penuh dan hanya setelah
                metadata video siap (durasi terisi), posisi tetap di atas
                seek bar supaya mudah dijangkau dengan ibu jari. */}
            {isFs && duration > 0 && (
              <div className="grid grid-cols-2 gap-3 pb-1">
                <LevelSlider
                  icon={<Sun className="size-4" />}
                  label="Kecerahan"
                  value={brightness}
                  onPointerDown={startLevelDrag("brightness")}
                  onPointerMove={moveLevelDrag}
                  onPointerUp={endLevelDrag}
                  onPointerCancel={() => endGesture()}
                />
                <LevelSlider
                  icon={
                    volumeLevel === 0 ? (
                      <VolumeX className="size-4" />
                    ) : (
                      <Volume2 className="size-4" />
                    )
                  }
                  label="Volume"
                  value={volumeLevel}
                  onPointerDown={startLevelDrag("volume")}
                  onPointerMove={moveLevelDrag}
                  onPointerUp={endLevelDrag}
                  onPointerCancel={() => endGesture()}
                />
              </div>
            )}
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
                      activeSub ? "bg-primary text-white" : "bg-white/15",
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
                      animeImage: D.image ?? undefined,
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
                      speed === s ? "bg-primary text-white" : "bg-white/10 text-white",
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
                    !activeSub ? "bg-primary text-white" : "text-white/80 hover:bg-white/10",
                  )}
                >
                  Matikan subtitle
                </button>
                <button
                  onClick={() => autoVtt && pickSub(AUTO_SUB)}
                  disabled={!autoVtt}
                  className={cn(
                    "block w-full rounded px-2 py-1 text-left text-xs",
                    activeSub === AUTO_SUB
                      ? "bg-primary text-white"
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

        {/* Lewati intro (kalau MegaPlay memberi timing intro) — ikut
            disembunyikan saat UI dikunci. */}
        {!uiLocked &&
          direct?.intro?.start !== undefined &&
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

        {/* Auto next: z-30 DI ATAS lapisan tap (z-10) supaya:
            1) tombolnya benar-benar bisa dipencet, dan
            2) menekannya TIDAK men-toggle kontrol — UI player tetap tampil.
            Tanpa background: hanya teks + garis pinggir tipis. */}
        {!uiLocked && controlsOn && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setAutoNext((v) => !v);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            className={cn(
              "absolute bottom-28 left-3 z-30 rounded-full border px-3 py-1.5 text-xs font-bold transition drop-shadow-[0_2px_6px_rgba(0,0,0,.9)]",
              autoNext
                ? "border-white text-white"
                : "border-white/45 text-white/85",
            )}
          >
            Auto next {autoNext ? "ON" : "OFF"}
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
                  ? "border-foreground/40 bg-primary/15 text-primary"
                  : deadServers.current.has(s.url)
                    ? "border-border text-muted-foreground/50 line-through"
                    : "border-border text-muted-foreground hover:border-foreground/40",
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

      {/* Like | dislike menyatu jadi SATU pill (garis pembatas tegak di
          tengah, dua sisanya sama-sama bisa dipencet) + Favorite tanpa
          angka + Laporkan. Semua tombol memakai KETEBALAN border yang sama
          (2px, tidak berlebihan) dan state tekan yang CLEAN — tanpa ring /
          glow mencolok di pinggir. */}
      <div className="w-full px-3 pt-2">
        <div className="grid grid-cols-3 gap-2">
          <div className="flex items-stretch overflow-hidden rounded-xl border-2 border-white/15 bg-white/[0.04]">
            <button
              onClick={() => {
                // Tombol Like menyatu: menekan lagi membatalkan, menekan saat
                // sebelumnya tidak suka akan mengganti jadi suka.
                void toggleLike({ animeId, value: 1 }).catch(() => {});
              }}
              aria-label="Like"
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 px-1.5 py-1.5 text-sm font-bold transition",
                likeStats?.liked
                  ? "bg-white/15 text-white"
                  : "text-muted-foreground hover:bg-white/5",
              )}
            >
              <ThumbsUp
                className={cn("size-4", likeStats?.liked && "fill-current")}
                aria-hidden
              />
              <span className="tabular-nums">
                {(likeStats?.likeCount ?? 0).toLocaleString("id-ID")}
              </span>
            </button>
            {/* Garis pembatas lurus ke atas, membelah dua sisi tombol */}
            <span aria-hidden className="w-px shrink-0 self-stretch bg-white/20" />
            <button
              onClick={() => {
                void toggleLike({ animeId, value: -1 }).catch(() => {});
              }}
              aria-label="Tidak suka"
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 px-1.5 py-1.5 text-sm font-bold transition",
                likeStats?.disliked
                  ? "bg-white/15 text-white"
                  : "text-muted-foreground hover:bg-white/5",
              )}
            >
              <ThumbsDown
                className={cn("size-4", likeStats?.disliked && "fill-current")}
                aria-hidden
              />
              <span className="tabular-nums">
                {(likeStats?.dislikeCount ?? 0).toLocaleString("id-ID")}
              </span>
            </button>
          </div>
          <button
            onClick={() => {
              void toggleFav({
                animeId: favId,
                animeTitle: detailReady ? detailData.title : D.title,
                animeImage: detailReady ? detailData.image : D.image,
                // Jenis + status tayang ikut tersimpan supaya layar Subscribe
                // bisa memisahkan Ongoing / Completed tanpa tombol filter.
                kind: isDonghua ? "donghua" : "anime",
                status:
                  (detailReady ? detailData.status : D.status) ?? undefined,
              }).catch(() => {});
            }}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-xl border-2 px-2 py-1.5 text-xs font-bold transition",
              isFav
                ? "border-white/25 bg-white/15 text-white"
                : "border-white/15 bg-white/[0.04] text-muted-foreground hover:bg-white/5",
            )}
          >
            <Heart className={cn("size-4", isFav && "fill-current")} aria-hidden />
            <span>Favorite</span>
          </button>
          <button
            onClick={() => setReportOpen(true)}
            className="flex items-center justify-center gap-1.5 rounded-xl border-2 border-white/15 bg-white/[0.04] px-2 py-1.5 text-xs font-bold text-muted-foreground transition hover:bg-white/5"
          >
            <Flag className="size-4" aria-hidden />
            <span>Laporkan</span>
          </button>
        </div>
      </div>

      {/* Layar laporan anime — laporannya masuk ke notifikasi developer. */}
      {reportOpen && (
        <ReportScreen
          animeId={animeId}
          animeTitle={detailReady ? detailData.title : D.title}
          image={detailReady ? detailData.image : D.image}
          onClose={() => setReportOpen(false)}
        />
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
              className="text-[11px] font-semibold text-primary"
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
            {epList.length === 0 && (
              // Jangan biarkan grid kosong diam-diam: jelaskan bahwa episode
              // judul ini belum tersedia di sumber, supaya tidak terlihat seperti
              // bug padahal memang belum ada yang bisa diputar.
              <div className="rounded-xl border border-border bg-secondary/30 px-4 py-6 text-center">
                <p className="text-sm font-semibold">Episode belum tersedia</p>
                <p className="mx-auto mt-1 max-w-sm text-[11px] text-muted-foreground">
                  Daftar episode untuk judul ini belum ada di sumber. Coba buka
                  lagi nanti — sumber donghua/anime sering menambahkan episode
                  belakangan.
                </p>
              </div>
            )}
            <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
              {(epList ?? [])
                .slice(0, epAllOpen ? epList.length : EP_PREVIEW)
                .map((e: any) => (
                <button
                  key={e.id}
                  onClick={() => {
                    if (room) {
                      void roomSetEpisode({ roomId: room._id, episode: e.number });
                      return;
                    }
                    navigate(epUrl(e.id));
                  }}
                  className={cn(
                    "relative rounded-md border py-2 text-xs font-semibold transition",
                    e.id === epParam
                      ? // Aktif: TANPA warna merah — biru tua + outline putus
                        // yang berjalan mengikuti kotak (lihat .yn-ep-outline).
                        "border-blue-800/80 bg-blue-950/60 text-blue-100"
                      : "border-border bg-secondary/40 text-foreground hover:border-foreground/40",
                  )}
                >
                  {e.number}
                  {e.id === epParam && (
                    <svg
                      className="pointer-events-none absolute inset-0 size-full overflow-visible"
                      aria-hidden
                    >
                      <rect
                        x="0"
                        y="0"
                        width="100%"
                        height="100%"
                        rx="6"
                        fill="none"
                        stroke="#1e40af"
                        strokeWidth="2"
                        pathLength={100}
                        strokeDasharray="66 34"
                        className="yn-ep-outline"
                      />
                    </svg>
                  )}
                </button>
              ))}
            </div>
            {/* Episode panjang disembunyikan di balik tombol supaya grid tidak
                jadiCombo panjang yang harus di-scroll jauh sebelum player. */}
            {epList.length > EP_PREVIEW && (
              <button
                onClick={() => setEpAllOpen((v) => !v)}
                className="mt-2 w-full rounded-lg border border-border py-2 text-xs font-medium text-foreground"
              >
                {epAllOpen
                  ? "Tampilkan lebih sedikit"
                  : `Lihat semua ${epList.length} episode`}
              </button>
            )}
          </>
        )}

        {/* Toolbar 4 tombol polos — tanpa kotak pembungkus, sesuai permintaan
            (background rounded di sekitar keempat tombol dihapus). */}
        {(isHost || !room) && (
          <div className="mt-3 grid grid-cols-4 gap-2">
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
                  animeImage: D.image ?? undefined,
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
              label={hdBoost ? "HD" : quality}
              onClick={() => {
                setQualityDraft(quality);
                setQualityOpen(true);
              }}
            />
          </div>
        )}

        {/* Kotak Premium di bawah toolbar — gaya & teks SAMA persis dengan
            kartu Premium di Home. Selalu tampil (termasuk untuk akun
            Premium), sama seperti kotak Premium di Home. */}
        {(
          <button
            onClick={() => navigate("/premium")}
            className="mt-3 flex w-full items-center gap-3 rounded-3xl border border-gold/30 bg-gradient-to-r from-gold/15 via-secondary/40 to-secondary/40 p-3.5 text-left shadow-[0_0_24px_-8px] shadow-gold/40 transition hover:border-gold/60"
          >
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full border border-gold/40 bg-gold/15 shadow-[0_0_16px_-4px] shadow-gold/50">
              <CrownIcon className="size-7 text-gold" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-mono text-[11px] font-bold tracking-[0.2em] text-gold">
                PREMIUM
              </span>
              <span className="mt-0.5 block text-xs leading-snug text-zinc-300">
                Premium mulai dari 7.000 — baca manga dan manhwa sepuasnya
              </span>
            </span>
            <span className="flex shrink-0 items-center rounded-xl bg-gold px-3.5 py-2 text-xs font-bold text-black">
              Buka Premium
            </span>
          </button>
        )}

        {/* Kecerahan & volume HANYA ada di layar penuh. Di luar layar penuh
            tidak ada tombolnya sama sekali, sesuai permintaan. */}

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
            {/* Komentar episode — MELEBAR ke samping sampai mentok tepi
                layar TANPA keluar jalur: `-mx-3` persis membatalkan padding
                `p-3` kotak induk, jadi tidak ada satu piksel pun yang
                terpotong di kiri/kanan (sebelumnya `-mx-7` kelebihan 16px). */}
            <div className="-mx-3">
            <div className="flex items-baseline justify-between px-3">
              <SectionTitle>
                <span className="normal-case">
                  {(shownComments?.length ?? 0).toLocaleString("id-ID")} Komentar
                </span>
              </SectionTitle>
            </div>
            <CommentsSection
              animeId={epParam ? `${animeId}__ep${epParam}` : animeId}
              comments={shownComments}
              meId={user?._id}
              onDeleted={(id) => {
                // Komentar yang baru dihapus langsung dikeluarkan dari daftar
                // supaya tidak perlu menunggu update query.
                setPendingComments((s) => s.filter((x) => x._id !== id));
                setRemovedComments((s) => new Set(s).add(id));
              }}
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
                    // Poster disimpan bersama komentar supaya feed komentar di
                    // halaman Akun bisa menampilkan gambarnya.
                    animeImage: D.image,
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
            </div>
          </>
        )}
      </div>

      {/* Popups diperbagus */}
      {qualityOpen && (
        <Popup onClose={cancelQuality} title="Kualitas">
          <div className="space-y-1.5">
            {/* HD digabung ke menu Kualitas (dulu cuma tombol terpisah di
                layar penuh): sekali tekan = resolusi tertinggi episode ini +
                filter perjelas (hilangkan burem & blur). */}
            <button
              onClick={toggleHd}
              aria-pressed={hdBoost}
              className={cn(
                "flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left transition",
                hdBoost
                  ? "border-foreground/40 bg-primary/15"
                  : "border-border hover:border-foreground/40",
              )}
            >
              <span
                className={cn(
                  "w-14 text-sm font-bold",
                  hdBoost ? "text-primary" : "",
                )}
              >
                HD
              </span>
              <span className="text-[11px] leading-snug text-muted-foreground">
                Resolusi tertinggi episode ini + perjelas gambar (hilangkan burem
                & blur)
              </span>
              {hdBoost && (
                <span className="ml-auto text-[10px] font-bold text-primary">
                  dipakai
                </span>
              )}
            </button>
            {QUALITIES.map((q) => {
              const height = parseInt(q, 10);
              const locked = q === PREMIUM_QUALITY && !isPremium;
              // Resolusi yang benar-benar ada di stream episode ini: level HLS
              // untuk sumber HLS, atau tinggi file asli untuk server MP4.
              // Resolusi yang tidak ada di stream TETAP bisa dipilih: yang
              // diputar otomatis resolusi terdekat yang tersedia (supaya semua
              // pilihan kualitas selalu bisa dipakai — permintaan user), tapi
              // tetap diberi label supaya tidak menyesatkan.
              const missing =
                realQualities.length > 0 && !realQualities.includes(height);
              // Yang benar-benar diputar kalau tombol ini ditekan: level
              // terdekat di bawahnya, atau yang terkecil kalau semuanya lebih
              // tinggi. Ditulis terbuka supaya user tidak menyangka mendapat
              // sesuatu yang tidak ada.
              const nearest = missing
                ? realQualities.reduce(
                    (a, b) => (b <= height && b > a ? b : a),
                    realQualities[0] ?? 0,
                  )
                : height;
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
                        : missing
                          ? "border-amber-500/25 bg-amber-500/5"
                          : active
                            ? "border-foreground/40 bg-primary/15"
                            : "border-border hover:border-foreground/40",
                    )}
                  >
                    <span
                      className={cn(
                        "w-14 text-sm font-bold",
                        locked || missing
                          ? "text-amber-300"
                          : active
                            ? "text-primary"
                            : "",
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
                      <span className="text-[9px] text-amber-300/90">
                        {nearest > 0 && nearest !== height
                          ? `diputar ${nearest}p`
                          : `tidak tersedia`}
                      </span>
                    )}
                    {active && !locked && (
                      <span className="ml-auto text-[10px] font-bold text-primary">
                        dipakai
                      </span>
                    )}
                  </button>
                  <p className="px-1 pt-1 text-[10px] leading-snug text-muted-foreground">
                    {QUALITY_INFO[q]}
                    {missing && nearest > 0 && nearest !== height && (
                      <> Kalau dipilih, yang diputar {nearest}p.</>
                    )}
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
          {realQualities.length === 1 && (
            <p className="mt-1 text-[10px] text-amber-300/90">
              Episode ini hanya punya satu resolusi ({realQualities[0]}p), jadi
              pilihan lain tidak bisa dipakai. Ganti server di bawah player untuk
              mencoba resolusi yang berbeda.
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
              className="flex-1 rounded-full bg-primary py-2 text-xs font-bold text-white disabled:opacity-40"
            >
              Simpan
            </button>
          </div>
        </Popup>
      )}
      {speedOpen && (
        <Popup onClose={() => setSpeedOpen(false)} title="Kecepatan">
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
                    ? "border-foreground/40 bg-primary/15 text-primary"
                    : "border-border hover:border-foreground/40",
                )}
              >
                {s}x
              </button>
            ))}
          </div>
        </Popup>
      )}
      {downloadOpen && (
        <Popup onClose={() => setDownloadOpen(false)} title="Unduh">
          <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">
            {downloadUrl
              ? "Pilih kualitas. Episode ini langsung masuk ke daftar Download di Home dan unduhannya langsung berjalan. 1080p hanya untuk akun Premium."
              : "Episode ini belum punya server MP4 yang bisa disimpan offline. Coba putar server lain dulu."}
          </p>
          {downloadUrl && realQualities.length > 0 && (
            <p className="mb-3 rounded-lg border border-border bg-card/60 px-3 py-2 text-[10px] leading-relaxed text-muted-foreground">
              Resolusi asli episode ini di server yang tersedia:{" "}
              <span className="font-bold text-foreground">
                {realQualities.map((h) => `${h}p`).join(", ")}
              </span>
              . Kalau kamu memilih angka yang tidak ada di daftar itu, yang
              diunduh adalah resolusi terdekat yang benar-benar ada, bukan file
              1080p yang isinya 480p.
            </p>
          )}
          <div className="space-y-1.5">
            {QUALITIES.slice(2).map((q) => {
              const height = parseInt(q, 10);
              const locked = q === PREMIUM_QUALITY && !isPremiumNow;
              // Server yang benar-benar dipakai kalau kualitas ini dipilih.
              const pick = downloadUrlFor(q);
              // Resolusi nyata file itu, dibaca dari metadata file. Kalau 0,
              // belum sempat dicek dan pilihan tetap dibiarkan.
              const realH = pick.height;
              const missing = realH > 0 && realH < height;
              const usable = !!pick.url && !locked;
              const busy = pendingQuality === q;
              return (
                <div key={q}>
                  <button
                    disabled={!usable || busy}
                    onClick={() => startDownload(q)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left transition",
                      !usable || busy
                        ? "cursor-not-allowed border-white/5 bg-white/[0.03] text-zinc-600"
                        : "border-border hover:border-foreground/40",
                    )}
                  >
                    <span className="w-14 text-sm font-bold">{q}</span>
                    {q === PREMIUM_QUALITY && (
                      <span className="rounded-full border border-amber-400/60 bg-amber-400/15 px-2 py-0.5 text-[9px] font-bold text-amber-300">
                        Premium
                      </span>
                    )}
                    {missing && (
                      <span className="text-[9px] text-amber-300/90">
                        yang tersedia {realH}p
                      </span>
                    )}
                    {usable && (
                      <span className="ml-auto text-[10px] font-bold text-primary">
                        {busy ? "Menyiapkan..." : "Unduh"}
                      </span>
                    )}
                    {locked && <Lock className="ml-auto inline size-3" />}
                  </button>
                  <p className="px-1 pt-1 text-[10px] leading-snug text-muted-foreground">
                    {QUALITY_INFO[q]}
                    {missing && <> File untuk pilihan ini {realH}p.</>}
                  </p>
                </div>
              );
            })}
          </div>
        </Popup>
      )}
    </div>
  );
}

/** Layar laporan anime — dibuka dari tombol Laporkan di bawah player.
 *  Laporan dikirim ke backend lalu muncul sebagai notifikasi developer. */
function ReportScreen({
  animeId,
  animeTitle,
  image,
  onClose,
}: {
  animeId: string;
  animeTitle: string;
  image?: string;
  onClose: () => void;
}) {
  const reportAnime = useMutation(api.activities.reportAnime);
  const REASONS = [
    "Video error / tidak bisa diputar",
    "Subtitle hilang atau salah",
    "Gambar buram / kualitas jelek",
    "Server mati atau iklan aneh",
    "Judul / episode salah",
    "Lainnya",
  ] as const;
  const [reason, setReason] = useState<string | null>(null);
  const [detail, setDetail] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (!reason) {
      toast.error("Pilih dulu alasan laporannya");
      return;
    }
    setSending(true);
    try {
      await reportAnime({
        animeId,
        animeTitle,
        reason,
        detail: detail.trim() || undefined,
      });
      setDone(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengirim laporan");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="screen-enter fixed inset-0 z-[90] flex flex-col items-center justify-center bg-background/95 backdrop-blur-md">
      {/* Konten ditengahkan vertikal & horizontal; tetap bisa di-scroll
          kalau tinggi layar kecil (max-h + overflow-y-auto). */}
      <div className="mx-auto flex max-h-[90dvh] w-full max-w-md flex-col overflow-y-auto thin-scroll px-4 pb-8 pt-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl yn-btn-warm">
            <Flag className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-base font-black">Laporkan anime</p>
            <p className="text-[11px] text-muted-foreground">
              Masuk ke notifikasi developer untuk ditinjau
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-muted-foreground transition hover:text-white"
          >
            <X className="size-4" />
          </button>
        </div>

        {done ? (
          /* ---------------- Sukses ---------------- */
          <div className="mt-10 flex flex-col items-center text-center">
            <span className="flex size-16 items-center justify-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-400/40">
              <Check className="size-8 text-emerald-300" />
            </span>
            <p className="mt-4 text-lg font-black">Laporan terkirim</p>
            <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
              {animeTitle} sudah kami terima. Tim developer akan meninjau
              laporanmu lewat notifikasi.
            </p>
            <button
              onClick={onClose}
              className="yn-btn-warm mt-6 w-full rounded-xl py-3 text-sm font-bold"
            >
              Selesai
            </button>
          </div>
        ) : (
          <>
            {/* Kartu judul yang dilaporkan */}
            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
              {image ? (
                <img
                  src={image}
                  alt=""
                  className="h-16 w-11 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <span className="flex h-16 w-11 shrink-0 items-center justify-center rounded-lg bg-white/5">
                  <Flag className="size-4 text-muted-foreground" />
                </span>
              )}
              <div className="min-w-0">
                <p className="line-clamp-2 text-sm font-bold">{animeTitle}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Pilih alasan di bawah ini
                </p>
              </div>
            </div>

            {/* Alasan */}
            <div className="mt-4 grid grid-cols-2 gap-2">
              {REASONS.map((r) => (
                <button
                  key={r}
                  onClick={() => setReason(r)}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-left text-xs font-semibold leading-snug transition",
                    reason === r
                      ? "border-blue-700/70 bg-blue-950/60 text-blue-100"
                      : "border-white/10 bg-white/[0.03] text-muted-foreground hover:border-white/25 hover:text-foreground",
                  )}
                >
                  {r}
                </button>
              ))}
            </div>

            {/* Catatan tambahan */}
            <textarea
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              rows={3}
              maxLength={400}
              placeholder="Ceritakan masalahnya (opsional)…"
              className="mt-3 w-full resize-none rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-white/25"
            />
            <p className="mt-1 text-right text-[10px] text-muted-foreground">
              {detail.length}/400
            </p>

            {/* Aksi */}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={onClose}
                className="yn-btn-quiet rounded-xl py-3 text-sm font-bold"
              >
                Batal
              </button>
              <button
                onClick={() => void submit()}
                disabled={sending}
                className="yn-btn-warm rounded-xl py-3 text-sm font-bold disabled:opacity-60"
              >
                {sending ? "Mengirim…" : "Kirim laporan"}
              </button>
            </div>

            <p className="mt-3 text-center text-[10px] leading-relaxed text-muted-foreground">
              Laporan membantu developer memperbaiki server, subtitle, dan
              data judul lebih cepat.
            </p>
          </>
        )}
      </div>
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
        "flex h-14 touch-none select-none flex-col items-center justify-center gap-1 rounded-lg border text-[11px] font-medium transition",
        disabled
          ? "cursor-not-allowed border-white/5 bg-white/[0.03] text-zinc-600"
          : "border-border bg-card hover:border-foreground/40",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

/**
 * Bilah kecerahan layar / volume suara — khusus mode layar penuh.
 *
 * Bilahnya horizontal, jadi geserannya juga ke kanan (naik) atau ke kiri
 * (turun). Persentase selalu terlihat di ujung kanan.
 */
function LevelSlider({
  icon,
  label,
  value,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onPointerCancel: () => void;
}) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      role="slider"
      aria-label={label}
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      className="flex h-11 touch-none select-none items-center gap-2 rounded-lg bg-black/55 px-2.5"
    >
      <span className="shrink-0 text-white">{icon}</span>
      <span className="h-1 flex-1 overflow-hidden rounded-full bg-white/25">
        <span
          className="block h-full rounded-full bg-white"
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className="w-9 shrink-0 text-right font-mono text-[10px] font-bold text-white">
        {pct}%
      </span>
    </div>
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
