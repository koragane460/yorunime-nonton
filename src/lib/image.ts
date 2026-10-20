/**
 * Perkecil gambar sebelum disimpan.
 *
 * Foto dari HP itu besar (2-8 MB). Convex hanya boleh menyimpan 1 MiB per
 * dokumen, jadi foto profil yang langsung disimpan sebagai base64 selalu
 * gagal dengan "Server Error". Di sini gambarnya dikecilkan dulu supaya muat
 * jauh di bawah batas itu, dan formatnya diubah ke WebP supaya hemat.
 */

/** Baca file gambar lalu perkecil jadi data URL WebP. */
export function shrinkImageFile(
  file: File,
  /** Sisi terpanjang hasil akhir, dalam piksel. */
  maxSize: number,
  quality = 0.82,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const longest = Math.max(img.naturalWidth, img.naturalHeight) || 1;
      const scale = Math.min(1, maxSize / longest);
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Browser tidak bisa memproses gambar"));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      // WebP quality 0.82 dengan 256-1200px selalu jauh di bawah 1 MiB.
      // Kalau browser tidak mendukung WebP, jatuh ke JPEG.
      const out = canvas.toDataURL("image/webp", quality);
      resolve(out.startsWith("data:image/webp") ? out : canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("File gambar tidak bisa dibaca"));
    };
    img.src = url;
  });
}

/** Avatar akun: 256px sudah lebih dari cukup untuk tampil di daftar. */
export function shrinkAvatar(file: File): Promise<string> {
  return shrinkImageFile(file, 256, 0.82);
}

/** Banner akun: 1200px, tetap ringan tapi tidak pecah di layar lebar. */
export function shrinkBanner(file: File): Promise<string> {
  return shrinkImageFile(file, 1200, 0.78);
}

/**
 * LATAR HOME — dipotong jadi 9:16 (720×1280, rata atas) supaya tampil
 * lurus ke atas tanpa terpotong aneh di HP. Disimpan sebagai WebP kecil
 * (muat jauh di bawah batas localStorage).
 */
export function shrinkHomeBg(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const TW = 720;
      const TH = 1280;
      // cover: gambar menutupi seluruh kanvas 9:16, lebih besar = dipotong.
      const scale = Math.max(TW / img.naturalWidth, TH / img.naturalHeight);
      const w = Math.round(img.naturalWidth * scale);
      const h = Math.round(img.naturalHeight * scale);
      const ox = Math.round((w - TW) / 2); // rata tengah horizontal
      const canvas = document.createElement("canvas");
      canvas.width = TW;
      canvas.height = TH;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Browser tidak bisa memproses gambar"));
        return;
      }
      ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, -ox, 0, w, h);
      const out = canvas.toDataURL("image/webp", 0.75);
      resolve(out.startsWith("data:image/webp") ? out : canvas.toDataURL("image/jpeg", 0.8));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("File gambar tidak bisa dibaca"));
    };
    img.src = url;
  });
}