// Kode rahasia pemutar musik.
//
// Diketik di kolom pencarian Home lalu menekan tombol Cari, layar musik
//penuh akan terbuka. Nilai ini sengaja disimpan terpisah dari komponen
//layar musik supaya Home tidak perlu memuat seluruh player hanya untuk
//memeriksa kodenya.

export const MUSIC_SECRET_CODE = "110219941";

/** True kalau input pengguna persis sama dengan kode rahasia. */
export function isMusicSecret(q: string): boolean {
  return q.trim() === MUSIC_SECRET_CODE;
}