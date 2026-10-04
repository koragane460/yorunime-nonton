// Aturan perpindahan lagu pada antrean.
//
// Dipisah dari komponen player supaya bisa diuji tanpa browser: logikanya
// murni, hanya menerima posisi sekarang dan aturan pemutaran.

export type RepeatMode = "off" | "all" | "one";

export type NextIndexArgs = {
  /** Indeks lagu yang sedang diputar; -1 kalau belum ada. */
  from: number;
  /** Jumlah lagu di antrean. */
  length: number;
  /** true kalau pemicu dari akhir lagu, false kalau tombol "next". */
  auto: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  /** Indeks acak yang sudah dipilih pemanggil, dipakai saat shuffle. */
  randomIndex?: number;
};

/**
 * Indeks lagu berikutnya, atau -1 kalau playback harus berhenti.
 *
 * - `repeat: "one"` dengan pemicu otomatis: ulang lagu yang sama.
 * - Selesai di lagu terakhir:
 *   - `repeat: "off"` dan otomatis -> berhenti (-1)
 *   - selain itu -> kembali ke lagu pertama.
 * - Tombol "next" selalu pindah; di lagu terakhir naikkan ke lagu pertama
 *   supaya tidak pernah diam.
 */
export function nextIndex({
  from,
  length,
  auto,
  shuffle,
  repeat,
  randomIndex,
}: NextIndexArgs): number {
  if (length <= 0 || from < 0) return -1;
  if (auto && repeat === "one") return from;

  if (shuffle) {
    if (length <= 1) return auto && repeat === "off" ? -1 : from;
    const n = randomIndex ?? from;
    // JanganAcak memilih lagu yang sama berulang-ulang.
    if (n === from || n < 0 || n >= length) return from;
    return n;
  }

  const n = from + 1;
  if (n < length) return n;
  return auto && repeat === "off" ? -1 : 0;
}

/**
 * Indeks acak selain `from`, dibatasi 8 percobaan supaya tidak macet kalau
 * antrean cuma berisi satu lagu.
 */
export function randomOtherIndex(from: number, length: number): number {
  if (length <= 1) return from;
  let n = from;
  for (let guard = 0; guard < 8 && n === from; guard++) {
    n = Math.floor(Math.random() * length);
  }
  return n;
}