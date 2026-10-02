/**
 * Mode Anti lag.
 *
 * Menghemat HP lama/low-end: mematikan animasi, transisi, backdrop-blur, dan
 * efek berat (glow/gradient) supaya halaman & video terasa lancar. Statusnya
 * disimpan di localStorage dan langsung menerapkan class `antilag` ke <html>.
 */

export const ANTILAG_KEY = "yn-antilag";

export function getAntiLag(): boolean {
  if (typeof localStorage === "undefined") return false;
  try {
    return localStorage.getItem(ANTILAG_KEY) === "1";
  } catch {
    return false;
  }
}

export function applyAntiLag(on: boolean) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("antilag", on);
}

export function setAntiLag(on: boolean) {
  try {
    localStorage.setItem(ANTILAG_KEY, on ? "1" : "0");
  } catch {
    /* storage penuh/ditolak: tetap terapkan di sesi ini */
  }
  applyAntiLag(on);
}
