#!/usr/bin/env python3
"""Build public/logo-512.png from ibb.co source with the Freebuff logo spec:
   512x512, color type 6 (32-bit RGBA/alpha), bit depth 8, exactly 1_044_480 bytes.
   Source: https://ibb.co/vCcxwp4s
"""
from __future__ import annotations

import struct
import zlib
import os

from PIL import Image

SRC = "/tmp/yn-full.jpg"
OUT = "/home/daytona/codebase/public/logo-512.png"
TARGET = 1020 * 1024  # 1_044_480


def build_png(data: bytes) -> bytes:
    raw = bytearray()
    for y in range(512):
        raw.append(0)  # filter None
        raw.extend(data[y * 2048:(y + 1) * 2048])
    ihdr = struct.pack(">IIBBBBB", 512, 512, 8, 6, 0, 0, 0)  # 8-bit, color type 6
    idat = zlib.compress(bytes(raw), 9)
    png = b"\x89PNG\r\n\x1a\n"
    png += struct.pack(">I", 13) + b"IHDR" + ihdr
    png += struct.pack(">I", len(idat)) + b"IDAT" + idat
    png += b"IEND" + b"\x00\x00\x00\x00"
    return png


def pad_to(png: bytes, target: int) -> bytes:
    body, iend = png[:-12], png[-12:]
    need = target - len(png)
    overhead = 12 + 8 + 1  # chunk length+type + "Comment"+null
    text_len = need - overhead
    if text_len < 0:
        raise SystemExit(f"sisa ruang terlalu kecil untuk chunk tEXt: need={need}")
    note = "YoruNime icon 512x512 RGBA"
    text = note + " " * max(0, text_len - len(note))
    if len(text) != text_len:
        raise SystemExit("panjang teks padding tidak cocok")
    return body + struct.pack(">I", len(text)) + b"tEXt" + text.encode("latin-1") + iend


def verify(path: str) -> None:
    data = open(path, "rb").read()
    assert data[:8] == b"\x89PNG\r\n\x1a\n", "bukan PNG"
    pos, idat, ihdr = 8, b"", None
    while pos < len(data):
        ln = struct.unpack(">I", data[pos : pos + 4])[0]
        tag = data[pos + 4 : pos + 8]
        payload = data[pos + 8 : pos + 8 + ln]
        crc = struct.unpack(">I", data[pos + 8 + ln : pos + 12 + ln])[0]
        assert crc == (zlib.crc32(tag + payload) & 0xFFFFFFFF), f"CRC rusak di {tag}"
        if tag == b"IHDR":
            ihdr = struct.unpack(">IIBBBBB", payload)
        if tag == b"IDAT":
            idat += payload
        pos += 12 + ln
    assert ihdr, "tidak ada IHDR"
    w, h, depth, ctype = ihdr[0], ihdr[1], ihdr[2], ihdr[3]
    raw = zlib.decompress(idat)
    assert (w, h, depth, ctype) == (512, 512, 8, 6), f"IHDR salah: {ihdr[:4]}"
    assert len(raw) == 512 * (1 + 512 * 4), "panjang data piksel salah"
    assert len(data) == TARGET, f"ukuran file {len(data)} != {TARGET}"
    print(f"OK  {path}")
    print(f"    {w}x{h}, bit depth {depth}, color type {ctype} (RGBA / 32-bit alpha)")
    print(f"    {len(data)} byte = {len(data) / 1024:.1f} KB (target 1020.0 KB)")
    alphas = {data[i] for i in range(3, len(data), 4 * 97)}
    print(f"    alpha terpakai: {min(alphas)}..{max(alphas)}")


def main() -> None:
    im = Image.open(SRC).convert("RGBA")
    im = im.resize((512, 512), Image.LANCZOS)
    px = im.tobytes()
    png = build_png(px)
    print(f"ukuran alami: {len(png)} byte")
    data = pad_to(png, TARGET)
    open(OUT, "wb").write(data)
    verify(OUT)
    print(f"file size: {os.path.getsize(OUT)} byte = {os.path.getsize(OUT) / 1024:.1f} KB")


if __name__ == "__main__":
    main()
