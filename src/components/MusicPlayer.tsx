// Provider pemutar musik.
//
// Satu elemen <audio> dibuat sekali di sini supaya musik tetap-sounding
// walau user pindah-pindah layar. Semua kontrol (antrean, shuffle, repeat,
// seek, volume) hidup di context ini, dan layar "Musik" maupun mini player
// di navigasi sama-sama membaca state yang sama.
//
// Aturan penting: begitu user masuk layar nonton (/nonton), musik langsung
// dijeda supaya suara lagu tidak bercampur dengan suara anime. Saat keluar
// dari layar nonton, musik lanjut lagi kalau tadi masih sedang_MAIN.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocation } from "react-router";
import {
  nextIndex,
  randomOtherIndex,
  type RepeatMode,
} from "@/lib/musicQueue";
import type { MusicTrack } from "@/convex/music";

// Tipe RepeatMode diambil dari `@/lib/musicQueue` supaya player dan tesnya
// memakai definisi yang sama.

type MusicCtx = {
  queue: MusicTrack[];
  index: number;
  track: MusicTrack | null;
  playing: boolean;
  loading: boolean;
  /** Alasan terakhir audio gagal dimuat, untuk ditampilkan di UI. */
  error: string | null;
  position: number;
  duration: number;
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  playTracks: (tracks: MusicTrack[], startAt?: number) => void;
  toggle: () => void;
  next: (auto?: boolean) => void;
  prev: () => void;
  seek: (sec: number) => void;
  changeVolume: (v: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  playAt: (i: number) => void;
  removeAt: (i: number) => void;
  clearQueue: () => void;
  /** True selagi layar musik penuh sedang terbuka. */
  screenOpen: boolean;
  setScreenOpen: (v: boolean) => void;
  /** Daftarkan aksi "buka tampilan Pemutar" untuk bar mini musik. */
  onOpenScreen: (fn: (() => void) | null) => void;
  /** Jalankan aksi yang didaftarkan lewat onOpenScreen. */
  openScreen: () => void;
};

const Ctx = createContext<MusicCtx | null>(null);

export function useMusicPlayer(): MusicCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useMusicPlayer harus dipakai di dalam MusicPlayerProvider");
  return c;
}

const VOL_KEY = "yn.music.volume";
const SHUFFLE_KEY = "yn.music.shuffle";
const REPEAT_KEY = "yn.music.repeat";

const readNum = (k: string, fallback: number) => {
  try {
    const v = Number(localStorage.getItem(k));
    return Number.isFinite(v) ? v : fallback;
  } catch {
    return fallback;
  }
};
const readStr = (k: string, fallback: string) => {
  try {
    return localStorage.getItem(k) ?? fallback;
  } catch {
    return fallback;
  }
};

export function MusicPlayerProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [queue, setQueue] = useState<MusicTrack[]>([]);
  const [index, setIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(() => readNum(VOL_KEY, 1));
  const [muted, setMuted] = useState(false);
  const [shuffle, setShuffle] = useState(() => readStr(SHUFFLE_KEY, "0") === "1");
  const [repeat, setRepeat] = useState<RepeatMode>(() =>
    readStr(REPEAT_KEY, "all") === "one" || readStr(REPEAT_KEY, "all") === "all"
      ? (readStr(REPEAT_KEY, "all") as RepeatMode)
      : "all",
  );

  const [screenOpen, setScreenOpen] = useState(false);
  // Callback dari bar mini musik, disimpan di ref supaya bar tidak perlu
  // tahu apa pun tentang isi layar musik.
  const openScreenRef = useRef<(() => void) | null>(null);
  const onOpenScreen = useCallback((fn: (() => void) | null) => {
    openScreenRef.current = fn;
  }, []);
  const openScreen = useCallback(() => openScreenRef.current?.(), []);

  useEffect(() => {
    if (!audioRef.current) audioRef.current = new Audio();
    const a = audioRef.current;
    a.preload = "metadata";
    a.volume = volume;
    a.muted = muted;

    const onTime = () => setPosition(a.currentTime || 0);
    const onMeta = () => {
      setDuration(Number.isFinite(a.duration) ? a.duration : 0);
      setLoading(false);
    };
    const onPlay = () => {
      setPlaying(true);
      setLoading(false);
    };
    const onPause = () => setPlaying(false);
    const onWaiting = () => setLoading(true);
    const onPlaying = () => {
      setPlaying(true);
      setLoading(false);
    };
    const onError = () => {
      setLoading(false);
      setPlaying(false);
      setError("Lagu ini tidak bisa diputar. Coba lagu lain.");
    };
    const onEnd = () => {
      // Panggil lewat ref supaya handler tidak perlu dependensi queue.
      queueEndRef.current?.();
    };

    a.addEventListener("timeupdate", onTime);
    a.addEventListener("durationchange", onMeta);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("canplay", onPlaying);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("waiting", onWaiting);
    a.addEventListener("stalled", onWaiting);
    a.addEventListener("error", onError);
    a.addEventListener("ended", onEnd);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("durationchange", onMeta);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("canplay", onPlaying);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("waiting", onWaiting);
      a.removeEventListener("stalled", onWaiting);
      a.removeEventListener("error", onError);
      a.removeEventListener("ended", onEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const track = index >= 0 ? queue[index] ?? null : null;

  // Muat (dan mulai) satu lagu pada elemen audio. Data antrean boleh
  // diberikan eksplisit supaya bisa dipakai juga saat antrean baru belum
  // selesai di-render.
  const loadInto = useCallback((i: number, from?: MusicTrack[]) => {
    const a = audioRef.current;
    const t = (from ?? queue)[i];
    if (!a || !t) return;
    setError(null);
    setLoading(true);
    setPosition(0);
    setDuration(t.durationSec || 0);
    if (a.src !== t.audioUrl) {
      a.src = t.audioUrl;
      a.currentTime = 0;
    }
    void a.play().catch(() => {
      // Browser memblokir autoplay; UI akan ikut menunjukkan status dijeda.
      setPlaying(false);
      setLoading(false);
    });
  }, [queue]);

  // Muat (dan mulai) lagu pada indeks tertentu dari antrean saat ini.
  const load = useCallback((i: number) => loadInto(i), [loadInto]);

  const pickNextIndex = useCallback(
    (from: number, auto: boolean): number =>
      nextIndex({
        from,
        length: queue.length,
        auto,
        shuffle,
        repeat,
        randomIndex: shuffle ? randomOtherIndex(from, queue.length) : undefined,
      }),
    [queue.length, shuffle, repeat],
  );

  const next = useCallback(
    (auto = false) => {
      const i = pickNextIndex(index, auto);
      if (i < 0) {
        audioRef.current?.pause();
        return;
      }
      setIndex(i);
      load(i);
    },
    [index, pickNextIndex, load],
  );

  const queueEndRef = useRef<() => void>(() => {});
  queueEndRef.current = () => next(true);

  const prev = useCallback(() => {
    // Standar aplikasi musik: tekan prev >3 detik mundur ke awal lagu,
    // kalau belum itu mundur ke lagu sebelumnya.
    const a = audioRef.current;
    if (a && a.currentTime > 3) {
      a.currentTime = 0;
      return;
    }
    const i = index <= 0 ? queue.length - 1 : index - 1;
    if (i < 0) return;
    setIndex(i);
    load(i);
  }, [index, queue.length, load]);

  const playTracks = useCallback(
    (tracks: MusicTrack[], startAt = 0) => {
      const usable = tracks.filter((t) => t?.audioUrl);
      if (usable.length === 0) return;
      setQueue(usable);
      const i = Math.min(Math.max(0, startAt), usable.length - 1);
      setIndex(i);
      // Antrean baru belum ter-render saat ini, jadi data lagunya
      // dihantarkan eksplisit ke pemutar.
      loadInto(i, usable);
    },
    [loadInto],
  );

  const playAt = useCallback(
    (i: number) => {
      if (i < 0 || i >= queue.length) return;
      setIndex(i);
      load(i);
    },
    [queue.length, load],
  );

  const toggle = useCallback(() => {
    const a = audioRef.current;
    if (!a || !a.src) return;
    if (a.paused) void a.play().catch(() => {});
    else a.pause();
  }, []);

  const seek = useCallback((sec: number) => {
    const a = audioRef.current;
    if (!a) return;
    const max = Number.isFinite(a.duration) && a.duration > 0 ? a.duration : sec;
    a.currentTime = Math.min(Math.max(0, sec), max);
    setPosition(a.currentTime);
  }, []);

  const changeVolume = useCallback((v: number) => {
    const next = Math.min(1, Math.max(0, v));
    setVolume(next);
    if (audioRef.current) audioRef.current.volume = next;
    try {
      localStorage.setItem(VOL_KEY, String(next));
    } catch {}
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      if (audioRef.current) audioRef.current.muted = !m;
      return !m;
    });
  }, []);

  const toggleShuffle = useCallback(() => {
    setShuffle((s) => {
      try {
        localStorage.setItem(SHUFFLE_KEY, s ? "0" : "1");
      } catch {}
      return !s;
    });
  }, []);

  const cycleRepeat = useCallback(() => {
    setRepeat((r) => {
      const nextMode: RepeatMode = r === "off" ? "all" : r === "all" ? "one" : "off";
      try {
        localStorage.setItem(REPEAT_KEY, nextMode);
      } catch {}
      return nextMode;
    });
  }, []);

  const removeAt = useCallback(
    (i: number) => {
      if (i < 0 || i >= queue.length) return;
      const nextQueue = queue.filter((_, n) => n !== i);
      setQueue(nextQueue);

      if (i === index) {
        // Lagu yang dihapus sedang diputar -> pindah ke lagu setelahnya.
        const a = audioRef.current;
        if (nextQueue.length === 0) {
          a?.pause();
          if (a) a.removeAttribute("src");
          setIndex(-1);
          setPlaying(false);
          setPosition(0);
          setDuration(0);
          return;
        }
        setIndex(Math.min(i, nextQueue.length - 1));
        // Antrean baru sudah ada di `nextQueue`, jadi pemutar dipanggil
        // dengan data eksplisit supaya tidak menunggu render berikutnya.
        loadInto(Math.min(i, nextQueue.length - 1), nextQueue);
      } else if (i < index) {
        setIndex(index - 1);
      }
    },
    [queue, index, loadInto],
  );

  const clearQueue = useCallback(() => {
    const a = audioRef.current;
    a?.pause();
    if (a) a.removeAttribute("src");
    setQueue([]);
    setIndex(-1);
    setPlaying(false);
    setPosition(0);
    setDuration(0);
  }, []);

  // Musik dijeda selama layar nonton dibuka; kalau sebelumnya masih main,
  // langsung dilanjutkan lagi setelah keluar.
  const resumeAfterVideo = useRef(false);
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    if (location.pathname.startsWith("/nonton")) {
      if (!a.paused) {
        resumeAfterVideo.current = true;
        a.pause();
      }
    } else if (resumeAfterVideo.current) {
      resumeAfterVideo.current = false;
      void a.play().catch(() => {});
    }
  }, [location.pathname]);

  const value = useMemo<MusicCtx>(
    () => ({
      queue,
      index,
      track,
      playing,
      loading,
      error,
      position,
      duration,
      volume,
      muted,
      shuffle,
      repeat,
      playTracks,
      toggle,
      next,
      prev,
      seek,
      changeVolume,
      toggleMute,
      toggleShuffle,
      cycleRepeat,
      playAt,
      removeAt,
      clearQueue,
      screenOpen,
      setScreenOpen,
      onOpenScreen,
      openScreen,
    }),
    [
      queue, index, track, playing, loading, error, position, duration, volume,
      muted, shuffle, repeat, playTracks, toggle, next, prev, seek, changeVolume,
      toggleMute, toggleShuffle, cycleRepeat, playAt, removeAt, clearQueue,
      screenOpen, openScreen, onOpenScreen,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Format detik -> "m:ss". */
export function fmtTime(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}