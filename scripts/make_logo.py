#!/usr/bin/env python3
"""Build public/logo-512.png from the ibb.co artwork.

Keeps the icon spec that public/manifest.webmanifest and the app-store upload
depend on:
  - 512 x 512 px
  - bit depth 8, color type 6 (32-bit RGBA with alpha)
  - exactly 1.044.480 byte (1020 KB)

Source artwork: https://i.ibb.co/vCcxwp4s/YoruNime-logo.jpg

Run:  python3 scripts/make_logo.py [source.jpg] [out.png]
"""

from __future__ import annotations

import struct
import sys
import urllib.request
import zlib
from pathlib import Path

from PIL import Image

REPO = Path(__file__).resolve().parent.parent
OUT = REPO / "public" / "logo-512.png"
SRC = Path("/tmp/yn-full.jpg")
REMOTE = "https://i.ibb.co/vCcxwp4s/YoruNime-logo.jpg"

SIZE = 512
TARGET = 1020 * 1024  # 1.044.480 byte


def fetch_source(dest: Path) -> Path:
    if dest.exists():
        return dest
    req = urllib.request.Request(REMOTE, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        dest.write_bytes(resp.read())
    return dest


def chunk(tag: bytes, payload: bytes) -> bytes:
    """Satu chunk PNG: length + tag + data + CRC (CRC dihitung atas tag+data)."""
    crc = zlib.crc32(tag + payload) & 0xFFFFFFFF
    return struct.pack(">I", len(payload)) + tag + payload + struct.pack(">I", crc)


def build_png(rgba: bytes) -> bytes:
    """Rakit PNG 512x512 RGBA dari buffer piksel mentah."""
    stride = SIZE * 4
    raw = bytearray()
    for y in range(SIZE):
        raw.append(0)  # filter: None
        raw.extend(rgba[y * stride : (y + 1) * stride])

    ihdr = struct.pack(">IIBBBBB", SIZE, SIZE, 8, 6, 0, 0, 0)
    idat = zlib.compress(bytes(raw), 9)
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", idat)
        + chunk(b"IEND", b"")
    )


def pad_to(png: bytes, target: int) -> bytes:
    """Tambah chunk tEXt yang sah supaya file persis `target` byte.

    Chunk disisipkan sebelum IEND. Panjang payload tEXt harus pas, jadi teks
   _identity_-+spasi yang dihitung dulu baru dipotong tepat ukuran.
    """
    if len(png) > target:
        raise SystemExit(f"file sudah kebesaran: {len(png)} > {target}")

    body, iend = png[:-12], png[-12:]
    need = target - len(png)
    # chunk = 4 (length) + 4 (tag) + payload + 4 (crc) = 12 + len(payload)
    # payload = keyword + null + teks
    keyword = b"Comment\x00"
    overhead = 12 + len(keyword)
    if need < overhead:
        raise SystemExit(f"sisa ruang terlalu kecil untuk chunk tEXt: {need}")

    text_len = need - overhead
    note = b"YoruNime icon 512x512 RGBA"
    text = note + b" " * max(0, text_len - len(note))
    text = text[:text_len]
    if len(text) != text_len:  # pragma: no cover - guard
        raise SystemExit("panjang teks padding tidak cocok")

    return body + chunk(b"tEXt", keyword + text) + iend


def verify(path: Path) -> None:
    data = path.read_bytes()
    assert data[:8] == b"\x89PNG\r\n\x1a\n", "bukan PNG"
    assert len(data) == TARGET, f"ukuran file {len(data)} != {TARGET}"

    pos = 8
    idat = bytearray()
    ihdr = None
    while pos < len(data):
        (length,) = struct.unpack(">I", data[pos : pos + 4])
        tag = data[pos + 4 : pos + 8]
        payload = data[pos + 8 : pos + 8 + length]
        (crc,) = struct.unpack(">I", data[pos + 8 + length : pos + 12 + length])
        assert crc == (zlib.crc32(tag + payload) & 0xFFFFFFFF), f"CRC rusak di {tag!r}"
        if tag == b"IHDR":
            ihdr = struct.unpack(">IIBBBBB", payload)
        elif tag == b"IDAT":
            idat += payload
        elif tag == b"IEND":
            break
        pos += 12 + length

    assert ihdr is not None, "tidak ada IHDR"
    width, height, depth, color_type = ihdr[:4]
    assert (width, height, depth, color_type) == (SIZE, SIZE, 8, 6), f"IHDR salah: {ihdr[:4]}"

    raw = zlib.decompress(bytes(idat))
    assert len(raw) == SIZE * (1 + SIZE * 4), "panjang data piksel salah"

    alphas = {raw[i] for i in range(3, len(raw), 4 * 97)}
    print(f"OK  {path}")
    print(f"    {width}x{height}, bit depth {depth}, color type {color_type} (RGBA / 32-bit)")
    print(f"    {len(data)} byte = {len(data) / 1024:.1f} KB (target {TARGET / 1024:.0f} KB)")
    print(f"    alpha terpakai: {min(alphas)}..{max(alphas)}")


def main() -> None:
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else fetch_source(SRC)
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else OUT

    image = Image.open(src).convert("RGBA").resize((SIZE, SIZE), Image.LANCZOS)
    png = build_png(image.tobytes())
    print(f"ukuran alami: {len(png)} byte")

    out.write_bytes(pad_to(png, TARGET))
    verify(out)


if __name__ == "__main__":
    main()