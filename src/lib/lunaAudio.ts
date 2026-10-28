// Pemutar audio Luna Bot TINGKAT MODUL — bukan milik satu komponen.
// Panel chat boleh ditutup/dibuka lagi: musik tetap bunyi, dan pesan bot
// yang sama tidak pernah diproses dua kali (lihat lunaSeen).
//
// Dulu audio dipegang komponen: chat ditutup → unmount → audio di-pause
// ("suara tiba-tiba hilang"), chat dibuka lagi → pesan lama diproses ulang
// ("kadang muncul lagi"). Semua itu sekarang hidup di sini.

let el: HTMLAudioElement | null = null;
let curUrl = "";

const seen = new Set<string>();

/** Tandai pesan bot; true kalau sudah pernah diproses (jangan ulangi). */
export function lunaSeen(id: string): boolean {
  if (seen.has(id)) return true;
  seen.add(id);
  return false;
}

function clampVol(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/** Putar lagu. URL sama → lanjutkan yang lama (tanpa restart dari 0). */
export function lunaPlay(url: string, volume: number): void {
  if (el && curUrl === url) {
    el.volume = clampVol(volume);
    if (el.paused) void el.play().catch(() => {});
    return;
  }
  el?.pause();
  const na = new Audio(url);
  na.volume = clampVol(volume);
  na.preload = "auto";
  el = na;
  curUrl = url;
  void na.play().catch(() => {});
}

export function lunaPause(): void {
  el?.pause();
}

export function lunaResume(): void {
  if (el && el.paused) void el.play().catch(() => {});
}

export function lunaStop(): void {
  el?.pause();
  el = null;
  curUrl = "";
}

export function lunaSetVolume(v: number): void {
  if (el) el.volume = clampVol(v);
}

export function lunaIsPlaying(): boolean {
  return !!el && !el.paused;
}
