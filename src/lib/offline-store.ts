/**
 * Penyimpanan episode untuk ditonton offline.
 *
 * File video disimpan sebagai Blob di IndexedDB browser (bukan di server
 * YoruNime), jadi tidak membebani backend dan tetap jalan saat jaringan
 * hilang. Penyimpanan browser punya kuota; karena itu ukuran video dibatasi
 * (lihat MAX_BYTES) dan pengguna selalu diberi tahu kalau kuota tidak cukup.
 */

const DB_NAME = "yorunime-offline";
const DB_VERSION = 1;
const STORE = "episodes";

/** Batas per file: 300 MB. Video yang lebih besar dari ini ditolak agar
 *  tidak langsung memenuhi kuota penyimpanan HP. */
export const MAX_BYTES = 300 * 1024 * 1024;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB gagal dibuka"));
  });
}

function tx<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = run(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error("IndexedDB error"));
        t.oncomplete = () => db.close();
      }),
  );
}

/** Simpan blob video episode dan kembalikan kunci penyimpanannya. */
export async function putEpisode(key: string, blob: Blob): Promise<void> {
  if (blob.size > MAX_BYTES) {
    throw new Error("Video terlalu besar untuk disimpan offline");
  }
  await tx("readwrite", (s) => s.put(blob, key));
}

/** Ambil blob episode; `null` kalau belum pernah diunduh. */
export async function getEpisode(key: string): Promise<Blob | null> {
  try {
    const v = await tx<unknown>("readonly", (s) => s.get(key));
    return v instanceof Blob ? v : null;
  } catch {
    return null;
  }
}

/** Hapus satu file offline (dipakai saat user menghapus unduhan). */
export async function deleteEpisode(key: string): Promise<void> {
  try {
    await tx("readwrite", (s) => s.delete(key));
  } catch {
    /* sudah hilang / ditolak browser — abaikan */
  }
}

/** Semua kunci yang tersimpan — untuk mencocokkan dengan daftar unduhan. */
export async function listKeys(): Promise<string[]> {
  try {
    const keys = await tx<IDBValidKey[]>("readonly", (s) => s.getAllKeys());
    return keys.map(String);
  } catch {
    return [];
  }
}

/**
 * Unduh video sebagai blob dengan laporan progres.
 *
 * Dipakai worker unduhan. `onProgress` menerima 0..1. Pembatalan lewat
 * `signal` dihormati supaya tombol "Batalkan" benar-benar menghentikan
 * unduhan yang sedang berjalan.
 */
export async function fetchWithProgress(
  url: string,
  onProgress: (pct: number, received: number, total: number) => void,
  signal?: AbortSignal,
): Promise<Blob> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Server menolak (${res.status})`);
  const total = Number(res.headers.get("content-length") ?? 0);
  if (!res.body) return await res.blob();

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      received += value.length;
      if (total > 0) onProgress(received / total, received, total);
    }
  }
  onProgress(1, received, total || received);
  return new Blob(chunks as BlobPart[], {
    type: res.headers.get("content-type") ?? "video/mp4",
  });
}

/** Format ukuran file untuk UI: "128,4 MB". */
export function fmtBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(i === 0 ? 0 : 1).replace(".", ",")} ${units[i]}`;
}