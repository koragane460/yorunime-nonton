#!/usr/bin/env python3
"""
Generator ikon YoruNime: public/logo-512.png

Spesifikasi yang diminta:
  - 512 x 512 piksel
  - 32-bit alpha (PNG color type 6 = RGBA, bit depth 8)
  - ukuran file 1020 KB persis (1.044.480 byte), di bawah batas umum
    toko aplikasi yang menerima ikon 512x512 32-bit PNG maksimal 1024 KB

Konsep yang dirender: "Yoru Play" — bulan sabit oranye (yoru = malam) dengan
simbol play di rongga bulan, di atas latar gradasi malam, sudut membulat
mengikuti squircle logo lama. Tidak ada teks di dalam ikon supaya tetap
terbaca di ukuran 48px sekalipun.

Jalankan:  python3 scripts/generate_logo.py
"""

from __future__ import annotations

import math
import random
import struct
import sys
import zlib

W = H = 512
TARGET = 1020 * 1024  # 1.044.480 byte

# ---------------------------------------------------------------- warna ----
BG_TOP = (27, 20, 48)        # #1B1430
BG_BOT = (10, 7, 20)         # #0A0714
MOON_TOP = (243, 176, 113)   # #F3B071
MOON_BOT = (213, 128, 66)    # #D58042 (brand)
GLOW = (213, 128, 66)
CREAM = (247, 241, 233)

# -------------------------------------------------------------- bentuk ----
C1 = (252.0, 256.0)          # lingkaran luar bulan
R1 = 168.0
C2 = (316.0, 256.0)          # lingkaran pemotong -> jadi sabit
R2 = 132.0
TRI = [(275.0, 188.0), (275.0, 324.0), (388.0, 256.0)]
MASK_R = 112.0               # radius sudut, sama dengan squircle logo lama
STARS = [
    (96.0, 96.0, 3.0, 0.90),
    (432.0, 110.0, 2.6, 0.72),
    (468.0, 332.0, 3.0, 0.62),
    (72.0, 412.0, 2.4, 0.75),
    (410.0, 444.0, 2.2, 0.55),
]


def clamp(v: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return lo if v < lo else hi if v > hi else v


def coverage(d: float) -> float:
    """Antialias analitik: 1 di dalam, 0 di luar, mulus selama 1 piksel."""
    return clamp(0.5 - d)


def sd_circle(x: float, y: float, cx: float, cy: float, r: float) -> float:
    return math.hypot(x - cx, y - cy) - r


def sd_rounded_rect(x: float, y: float, half: float, r: float) -> float:
    qx = abs(x - W / 2) - (half - r)
    qy = abs(y - H / 2) - (half - r)
    outside = math.hypot(max(qx, 0.0), max(qy, 0.0))
    inside = min(max(qx, qy), 0.0)
    return outside + inside - r


def sd_triangle(x: float, y: float) -> float:
    (ax, ay), (bx, by), (cx, cy) = TRI
    e0 = (bx - ax, by - ay)
    e1 = (cx - bx, cy - by)
    e2 = (ax - cx, ay - cy)
    v0 = (x - ax, y - ay)
    v1 = (x - bx, y - by)
    v2 = (x - cx, y - cy)

    def edge(v, e):
        ee = e[0] * e[0] + e[1] * e[1]
        t = clamp((v[0] * e[0] + v[1] * e[1]) / ee) if ee else 0.0
        return (v[0] - e[0] * t, v[1] - e[1] * t)

    pq0 = edge(v0, e0)
    pq1 = edge(v1, e1)
    pq2 = edge(v2, e2)
    s = 1.0 if (e0[0] * e2[1] - e0[1] * e2[0]) >= 0 else -1.0
    d = min(
        (pq0[0] * pq0[0] + pq0[1] * pq0[1], s * (v0[0] * e0[1] - v0[1] * e0[0])),
        (pq1[0] * pq1[0] + pq1[1] * pq1[1], s * (v1[0] * e1[1] - v1[1] * e1[0])),
        (pq2[0] * pq2[0] + pq2[1] * pq2[1], s * (v2[0] * e2[1] - v2[1] * e2[0])),
    )
    return -math.sqrt(d[0]) * (1.0 if d[1] >= 0 else -1.0)


def lerp(a, b, t):
    return a + (b - a) * t


def mix(c1, c2, t):
    return tuple(lerp(c1[i], c2[i], t) for i in range(3))


def over(dst, src, a):
    """Composite src di atas dst dengan alpha a."""
    return tuple(dst[i] * (1 - a) + src[i] * a for i in range(3))


def render() -> bytearray:
    buf = bytearray(W * H * 4)
    rnd = random.Random(20261003)  # deterministik
    for y in range(H):
        fy = y / (H - 1)
        base = mix(BG_TOP, BG_BOT, fy)
        for x in range(W):
            fx = x / (W - 1)

            # latar gradasi + vignette halus
            col = base
            vign = 1.0 - 0.22 * ((fx - 0.5) ** 2 + (fy - 0.5) ** 2) * 2.0
            col = tuple(c * vign for c in col)

            # cahaya lembut di belakang bulan (sengaja redup supaya rongga
            # bulan tetap gelap dan sabitnya terbaca tajam)
            d_glow = math.hypot(x - C1[0], y - C1[1])
            glow = 0.20 * math.exp(-d_glow / 130.0)
            col = over(col, GLOW, glow)

            # bintang
            for sx, sy, sr, sa in STARS:
                d_s = math.hypot(x - sx, y - sy) - sr
                a_s = coverage(d_s) * sa
                if a_s > 0:
                    col = over(col, CREAM, a_s)

            # bulan sabit
            d_moon = max(
                sd_circle(x, y, C1[0], C1[1], R1),
                -sd_circle(x, y, C2[0], C2[1], R2),
            )
            a_moon = coverage(d_moon)
            if a_moon > 0:
                moon_col = mix(MOON_TOP, MOON_BOT, clamp((y - (C1[1] - R1)) / (2 * R1)))
                # tepi dalam sedikit lebih terang supaya sabit terbaca
                rim = clamp(-d_moon / 14.0)
                moon_col = over(moon_col, MOON_TOP, rim * 0.25)
                col = over(col, moon_col, a_moon)

            # simbol play
            d_tri = sd_triangle(x, y)
            a_tri = coverage(d_tri)
            if a_tri > 0:
                tri_col = mix(CREAM, MOON_TOP, clamp((y - 188.0) / 140.0) * 0.14)
                col = over(col, tri_col, a_tri)

            # grain halus (juga dipakai sebagai penyetel ukuran file)
            grain = rnd.randint(-GRAIN, GRAIN)
            rgb = tuple(int(clamp((c + grain) / 255.0) * 255) for c in col)

            # masker squircle -> alpha
            a_mask = coverage(sd_rounded_rect(x, y, W / 2, MASK_R))
            alpha = int(a_mask * 255 + 0.5)

            i = (y * W + x) * 4
            buf[i] = rgb[0]
            buf[i + 1] = rgb[1]
            buf[i + 2] = rgb[2]
            buf[i + 3] = alpha
    return buf


def chunk(tag: bytes, data: bytes) -> bytes:
    return (
        struct.pack(">I", len(data))
        + tag
        + data
        + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    )


def build_png(px: bytearray) -> bytes:
    raw = bytearray()
    stride = W * 4
    for y in range(H):
        raw.append(0)  # filter: None
        raw.extend(px[y * stride : (y + 1) * stride])
    ihdr = struct.pack(">IIBBBBB", W, H, 8, 6, 0, 0, 0)  # 8-bit, color type 6
    idat = zlib.compress(bytes(raw), 9)
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", idat)
        + chunk(b"IEND", b"")
    )


def pad_to(png: bytes, target: int) -> bytes:
    """Tambah chunk tEXt yang sah supaya ukuran file persis `target`."""
    total = len(png)
    if total > target:
        raise SystemExit(f"file sudah kebesaran: {total} > {target}")
    # sisipkan sebelum IEND (12 byte terakhir)
    body, iend = png[:-12], png[-12:]
    need = target - total
    # chunk = 4 (panjang) + 4 (tag) + payload + 4 (crc); payload = keyword + null + teks
    overhead = 12 + len(b"Comment") + 1
    text_len = need - overhead
    if text_len < 0:
        raise SystemExit("sisa ruang terlalu kecil untuk chunk tEXt")
    # Teks Latin-1 yang valid berisi identitas ikon, sisanya spasi.
    note = "YoruNime icon 512x512 RGBA"
    text = note + " " * max(0, text_len - len(note))
    if len(text) != text_len:
        raise SystemExit("panjang teks padding tidak cocok")
    return body + chunk(b"tEXt", b"Comment\x00" + text.encode("latin-1")) + iend


def verify(path: str) -> None:
    data = open(path, "rb").read()
    assert data[:8] == b"\x89PNG\r\n\x1a\n", "bukan PNG"
    pos, idat, ihdr = 8, b"", None
    while pos < len(data):
        (ln,) = struct.unpack(">I", data[pos : pos + 4])
        tag = data[pos + 4 : pos + 8]
        payload = data[pos + 8 : pos + 8 + ln]
        (crc,) = struct.unpack(">I", data[pos + 8 + ln : pos + 12 + ln])
        assert crc == (zlib.crc32(tag + payload) & 0xFFFFFFFF), f"CRC rusak di {tag}"
        if tag == b"IHDR":
            ihdr = struct.unpack(">IIBBBBB", payload)
        if tag == b"IDAT":
            idat += payload
        pos += 12 + ln
    w, h, depth, ctype = ihdr[0], ihdr[1], ihdr[2], ihdr[3]
    raw = zlib.decompress(idat)
    assert (w, h, depth, ctype) == (W, H, 8, 6), f"IHDR salah: {ihdr[:4]}"
    assert len(raw) == H * (1 + W * 4), "panjang data piksel salah"
    assert len(data) == TARGET, f"ukuran file {len(data)} != {TARGET}"
    print(f"OK  {path}")
    print(f"    {w}x{h}, bit depth {depth}, color type {ctype} (RGBA / 32-bit alpha)")
    print(f"    {len(data)} byte = {len(data) / 1024:.1f} KB (target 1020.0 KB)")
    # alpha dipakai nyata (sudut transparan)
    alphas = {raw[i] for i in range(3, raw.__len__(), 4 * 97)}
    print(f"    alpha terpakai: {min(alphas)}..{max(alphas)}")


def ascii_preview(px: bytearray, cols: int = 96) -> None:
    """Cek komposisi tanpa browser: turunkan jadi grid karakter."""
    rows = cols // 2
    ramp = " .:-=+*#%@"
    lines = []
    for r in range(rows):
        line = []
        for c in range(cols):
            sx = int((c + 0.5) * W / cols)
            sy = int((r + 0.5) * H / rows)
            i = (sy * W + sx) * 4
            a = px[i + 3] / 255
            lum = (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) / 255
            line.append(ramp[int(clamp(lum * a) * (len(ramp) - 1))])
        lines.append("".join(line))
    print("\n".join(lines))


GRAIN = 3

if __name__ == "__main__":
    if len(sys.argv) > 1:
        GRAIN = int(sys.argv[1])
    out = sys.argv[2] if len(sys.argv) > 2 else "public/logo-512.png"
    px = render()
    png = build_png(px)
    print(f"ukuran alami (grain {GRAIN}): {len(png)} byte")
    data = pad_to(png, TARGET)
    open(out, "wb").write(data)
    ascii_preview(px)
    verify(out)
