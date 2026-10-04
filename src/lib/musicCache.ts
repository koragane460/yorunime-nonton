// Cache katalog musik di memori.
//
// Dulu setiap kali layar Musik dibuka, 8 baris katalog diambil ulang semua
// (masing-masing satu panggilan ke luar) sehingga layar selalu tampak
// "Memuat katalog..." padahal isinya tidak pernah berubah. Katalog itu
// praktis statis, jadi cukup disimpan di memori beberapa menit.

type Entry<T> = { value: T; at: number };

const store = new Map<string, Entry<unknown>>();

/** Umur cache: 10 menit. */
const TTL_MS = 10 * 60 * 1000;

/** Ambil dari cache kalau masih segar; null kalau tidak ada/kadaluarsa. */
export function cached<T>(key: string): T | null {
  const e = store.get(key);
  if (!e) return null;
  if (Date.now() - e.at > TTL_MS) {
    store.delete(key);
    return null;
  }
  return e.value as T;
}

/** Simpan ke cache. */
export function putCache<T>(key: string, value: T): void {
  store.set(key, { value, at: Date.now() });
}

/** Kosongkan seluruh cache (dipakai saat menarik ulang secara manual). */
export function clearMusicCache(): void {
  store.clear();
}