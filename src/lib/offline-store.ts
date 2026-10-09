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

/** Semua kunci yang tersimpan — untuk mencocokkan dengan daftar unduhan.
 *  Kunci parsial (unduhan yang belum selesai) tidak ikut dihitung. */
export async function listKeys(): Promise<string[]> {
  try {
    const keys = await tx<IDBValidKey[]>("readonly", (s) => s.getAllKeys());
    return keys.map(String).filter((k) => !k.startsWith(PARTIAL_PREFIX));
  } catch {
    return [];
  }
}

/* ----------------------------------------------------- unduhan parsial ----
 * Unduhan yang gagal di tengah jalan menyimpan bagian yang sudah terunduh di
 * sini. Saat user menekan "Lanjutkan"/"unduh ulang", bagian itu dipakai
 * sebagai awalan + header `Range`, jadi unduhan LANJUT dari titik terakhir
 * (misal 7,8 MB) — bukan mengulang dari nol.
 */
const PARTIAL_PREFIX = "__partial__";

/** Simpan potongan unduhan yang belum selesai (diam-diam; gagal = abaikan). */
export async function putPartial(key: string, blob: Blob): Promise<void> {
  // Jangan simpan sampah yang sudah melebihi batas penyimpanan.
  if (blob.size <= 0 || blob.size > MAX_BYTES) return;
  try {
    await tx("readwrite", (s) => s.put(blob, PARTIAL_PREFIX + key));
  } catch {
    /* storage penuh / ditolak — unduhan berikutnya mulai dari nol */
  }
}

/** Ambil potongan terakhir yang tersimpan; `null` kalau tidak ada. */
export async function getPartial(key: string): Promise<Uint8Array | null> {
  try {
    const v = await tx<unknown>("readonly", (s) => s.get(PARTIAL_PREFIX + key));
    if (!(v instanceof Blob) || v.size === 0) return null;
    return new Uint8Array(await v.arrayBuffer());
  } catch {
    return null;
  }
}

/** Hapus potongan parsial (dipanggil saat unduhan selesai). */
export async function clearPartial(key: string): Promise<void> {
  try {
    await tx("readwrite", (s) => s.delete(PARTIAL_PREFIX + key));
  } catch {
    /* sudah hilang — abaikan */
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
  opts?: {
    /** Bagian yang sudah terunduh sebelumnya (dipakai sebagai awalan + Range). */
    startBytes?: Uint8Array | null;
    /** Kunci penyimpanan; saat gagal di tengah jalan, hasilnya disimpan di sini. */
    partialKey?: string;
  },
): Promise<Blob> {
  const startLen = opts?.startBytes?.length ?? 0;
  const res = await fetch(url, {
    signal,
    // Minta server melanjutkan dari byte ke-`startLen`. Proxy YoruNime
    // meneruskan header ini ke upstream dan meneruskan balasan 206-nya.
    ...(startLen > 0 ? { headers: { Range: `bytes=${startLen}-` } } : {}),
  });
  if (!res.ok) throw new Error(`Server menolak (${res.status})`);

  // 206 = server menghormati Range → sambung dari potongan lama.
  // 200 = server mengabaikan Range → potongan lama dibuang, mulai dari nol.
  const resumed = res.status === 206 && startLen > 0 && !!opts?.startBytes;
  const rangeTotal = Number(
    (res.headers.get("content-range") ?? "").split("/")[1] ?? 0,
  );
  const total =
    rangeTotal > 0
      ? rangeTotal
      : Number(res.headers.get("content-length") ?? 0) +
        (resumed ? startLen : 0);

  const chunks: Uint8Array[] = [];
  if (resumed && opts?.startBytes) chunks.push(opts.startBytes);
  let received = resumed ? startLen : 0;

  if (!res.body) {
    const b = await res.blob();
    if (resumed && opts?.startBytes) {
      // Disalin ke buffer baru supaya bertipe ArrayBuffer murni (bukan view
      // ke SharedArrayBuffer) — ini jalur cadangan; hampir tidak pernah
      // dipakai karena fetch modern selalu mengembalikan body stream.
      return new Blob([new Uint8Array(opts.startBytes), b], {
        type: res.headers.get("content-type") ?? "video/mp4",
      });
    }
    onProgress(1, b.size, b.size);
    return b;
  }

  const reader = res.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        received += value.length;
        if (total > 0) onProgress(received / total, received, total);
      }
    }
  } catch (e) {
    // Gagal di tengah jalan (jaringan putus / dibatalkan): simpan bagian
    // yang sudah ada supaya percobaan berikutnya lanjut dari titik ini.
    if (opts?.partialKey && chunks.length > (resumed ? 1 : 0)) {
      await putPartial(
        opts.partialKey,
        new Blob(chunks as BlobPart[], {
          type: res.headers.get("content-type") ?? "video/mp4",
        }),
      );
    }
    throw e;
  }
  onProgress(1, received, total || received);
  // Selesai → potongan parsial tidak diperlukan lagi.
  if (opts?.partialKey) await clearPartial(opts.partialKey);
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