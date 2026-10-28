// Pemutar audio YouTube, dikontrol penuh dari UI YoruNime.
//
// Kenapa ini: lagu dari iTunes hanya potongan 30 detik. YouTube menyediakan
// lagu PENUH, dan pemutar resminya (IFrame Player API) bisa dimainkan,
// dijeda, di-seek, dan diatur volumenya lewat JavaScript - tanpa API key.
// Iframenya sendiri kami sembunyikan (ukuran 1x1 di luar layar), jadi yang
// terlihat tetap UI player YoruNime, bukan tampilan YouTube.
//
// Skrip YouTube dimuat sekali dan hanya saat user benar-benar memutar lagu,
// supaya tidak membebani halaman lain.

type YTPlayer = {
  loadVideoById: (id: string) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (sec: number, allowSeekAhead: boolean) => void;
  setVolume: (v: number) => void;
  mute: () => void;
  unMute: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  destroy: () => void;
};

type YTNamespace = {
  Player: new (
    el: HTMLElement | string,
    opts: {
      height?: string;
      width?: string;
      videoId?: string;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: () => void;
        onStateChange?: (e: { data: number }) => void;
        onError?: (e: { data: number }) => void;
      };
    },
  ) => YTPlayer;
  PlayerState: {
    UNSTARTED: number;
    ENDED: number;
    PLAYING: number;
    PAUSED: number;
    BUFFERING: number;
    CUED: number;
  };
};

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let player: YTPlayer | null = null;
let loadingPromise: Promise<YTNamespace | null> | null = null;

/** Muat skrip IFrame API YouTube sekali saja. */
function loadApi(): Promise<YTNamespace | null> {
  if (loadingPromise) return loadingPromise;
  loadingPromise = new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(null);
    if (window.YT?.Player) return resolve(window.YT);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(window.YT ?? null);
    };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.async = true;
    // Kalau skrip gagal (mis. diblokir), jangan menggantung selamanya.
    s.onerror = () => resolve(null);
    document.head.appendChild(s);
    setTimeout(() => resolve(window.YT ?? null), 8000);
  });
  return loadingPromise;
}

export type YouTubeHandlers = {
  onPlay: () => void;
  onPause: () => void;
  onEnded: () => void;
  onReady: () => void;
  /** Durasi lagu dalam detik (dipakai kalau metadata tidak memberinya). */
  onDuration: (sec: number) => void;
};

/**
 * Pastikan player siap dan memuat videoId yang diminta.
 * Aman dipanggil berulang: player yang sudah ada dipakai ulang.
 */
export async function ensureYouTubePlayer(
  videoId: string,
  h: YouTubeHandlers,
  startMuted: boolean,
): Promise<boolean> {
  const YT = await loadApi();
  if (!YT || !videoId) return false;

  if (player) {
    player.loadVideoById(videoId);
    if (startMuted) player.mute();
    else player.unMute();
    return true;
  }

  // Wadah iframe: diletakkan keluar layar, bukan display:none, supaya
  // browser tetap mau memutar audionya.
  let host = document.getElementById("yn-yt-audio-host");
  if (!host) {
    host = document.createElement("div");
    host.id = "yn-yt-audio-host";
    host.style.position = "fixed";
    host.style.width = "1px";
    host.style.height = "1px";
    host.style.left = "-9999px";
    host.style.top = "0";
    host.style.opacity = "0";
    host.style.pointerEvents = "none";
    document.body.appendChild(host);
  }

  player = new YT.Player(host, {
    height: "1",
    width: "1",
    videoId,
    playerVars: {
      autoplay: 1,
      controls: 0,
      disablekb: 1,
      modestbranding: 1,
      playsinline: 1,
      rel: 0,
    },
    events: {
      onReady: () => {
        player?.setVolume(startMuted ? 0 : 100);
        player?.playVideo();
        const d = player?.getDuration?.() ?? 0;
        if (d > 0) h.onDuration(d);
        h.onReady();
      },
      onStateChange: (e) => {
        const S = YT.PlayerState;
        if (e.data === S.PLAYING) {
          h.onPlay();
          const d = player?.getDuration?.() ?? 0;
          if (d > 0) h.onDuration(d);
        } else if (e.data === S.PAUSED) h.onPause();
        else if (e.data === S.ENDED) h.onEnded();
      },
      onError: () => {
        // Video tidak bisa diputar (region/hapus). Anggap selesai supaya
        // player melanjutkan ke lagu berikutnya, bukan diam.
        h.onEnded();
      },
    },
  });
  return true;
}

/** Mainkan videoId tertentu di player yang sudah ada. */
export function youtubePlay(videoId: string): void {
  player?.loadVideoById(videoId);
  player?.playVideo();
}

export function youtubeToggle(): void {
  if (!player) return;
  const st = player.getPlayerState();
  if (st === 1) player.pauseVideo();
  else player.playVideo();
}

/** Jeda video — dipakai kontrol pause Luna Bot. */
export function youtubePause(): void {
  player?.pauseVideo();
}

/** Lanjutkan video yang dijeda — dipakai kontrol resume Luna Bot. */
export function youtubeResume(): void {
  player?.playVideo();
}

/** Hentikan video — dipakai kontrol stop Luna Bot. */
export function youtubeStop(): void {
  player?.pauseVideo();
  player?.seekTo(0, true);
}

export function youtubeSeek(sec: number): void {
  player?.seekTo(sec, true);
}

export function youtubeVolume(v: number): void {
  player?.setVolume(Math.round(Math.min(1, Math.max(0, v)) * 100));
}

export function youtubeMuted(muted: boolean): void {
  if (muted) player?.mute();
  else player?.unMute();
}

export function youtubeTime(): { now: number; total: number } {
  if (!player) return { now: 0, total: 0 };
  return {
    now: player.getCurrentTime?.() ?? 0,
    total: player.getDuration?.() ?? 0,
  };
}

export function youtubeIsPlaying(): boolean {
  return player?.getPlayerState?.() === 1;
}