#!/usr/bin/env python3
"""Generate new pet art via pollinations (default model) + strip white bg.

Background dihapus HANYA lewat flood-fill dari tepi kanvas: yang jadi
transparan cuma piksel putih/abu-abu terang yang MENYAMBUNG ke tepi,
jadi mata/highlight putih di dalam hewan DAN seluruh warna/aura hewan
tetap utuh. Model sering menghasilkan latar putih keabu-abuan (bukan
murni 255), jadi kriterianya: hampir netral (rendah saturasi) DAN terang.
"""
import os, sys, time, urllib.parse, urllib.request, zlib
from collections import deque
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), "..", "public", "pets")
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36"

# Kata kunci "die cut vinyl sticker of …" TERBUKTI bikin model (sana)
# menghasilkan latar putih bersih. JANGAN tambahkan "aura"/"game pet
# artwork" — model lalu melukis latar berwarna penuh kanvas.
STYLE = (
    "anime style digital painting, vibrant colors, full body, "
    "centered, pure white background, no scenery, no shadow"
)
PREFIX = "die cut vinyl sticker of "

# Pollinations membatasi ~1 request per ±28 dtk (402 kalau lebih cepat).
_last_req = [0.0]


def _throttle():
    dt = time.time() - _last_req[0]
    if dt < 28:
        time.sleep(28 - dt)
    _last_req[0] = time.time()
PETS = {
    "fenrir": "a legendary dark wolf with glowing purple eyes, dark fur",
    "cerberus": "a three headed black hellhound dog with red glowing eyes and broken chains",
    "kirin": "an asian qilin mythical horse dragon with golden scales",
    "leviathan": "a giant blue sea serpent dragon with crashing water waves around its body",
    "behemoth": "a massive rocky bull beast with stone armor and glowing orange lava cracks",
    "basilisk": "a giant emerald green serpent snake with glowing green eyes",
}


def pollinations(pid, prompt, seed, size=512, tries=2):
    url = (
        "https://image.pollinations.ai/prompt/"
        + urllib.parse.quote(f"{PREFIX}{prompt}, {STYLE}")
        + f"?width={size}&height={size}&seed={seed}&nologo=true"
    )
    last = None
    for i in range(tries):
        _throttle()
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=110) as r:
                data = r.read()
            _last_req[0] = time.time()
            if len(data) < 5000:
                raise RuntimeError(f"too small {len(data)}")
            tmp = f"/tmp/pet_{pid}_{seed}_{i}.png"
            with open(tmp, "wb") as f:
                f.write(data)
            return tmp
        except Exception as e:
            last = e
            # 402/503 = rate limit pollinations; tunggu sebentar lalu coba lagi.
            time.sleep(20)
    raise RuntimeError(f"fetch failed: {last}")


def bg_like(r, g, b):
    """Hampir netral (putih/abu-abu terang) → kandidat latar."""
    mx = max(r, g, b)
    mn = min(r, g, b)
    return mn >= 165 and (mx - mn) <= 16


def strip_white(img):
    """Flood-fill dari SEMUA tepi kanvas: hanya piksel latar yang menyambung
    ke tepi yang jadi transparan. Warna hewan & aura tidak tersentuh."""
    img = img.convert("RGBA")
    w, h = img.size
    px = img.load()
    seen = bytearray(w * h)
    q = deque()

    def is_bg(x, y):
        r, g, b, a = px[x, y]
        return a == 0 or bg_like(r, g, b)

    for x in range(w):
        for y in (0, h - 1):
            if not seen[y * w + x] and is_bg(x, y):
                seen[y * w + x] = 1
                q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if not seen[y * w + x] and is_bg(x, y):
                seen[y * w + x] = 1
                q.append((x, y))
    while q:
        x, y = q.popleft()
        px[x, y] = (0, 0, 0, 0)
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx] and is_bg(nx, ny):
                seen[ny * w + nx] = 1
                q.append((nx, ny))
    return img


def bbox_inset(img, inset=8):
    bb = img.getbbox()
    if not bb:
        return None
    l, t, r, b = bb
    l += inset; t += inset; r -= inset; b -= inset
    if r <= l or b <= t:
        return img.crop(bb)
    return img.crop((max(0, l), max(0, t), min(img.width, r), min(img.height, b)))


def touches_edge(img, marg=6):
    bb = img.getbbox()
    return (not bb) or bb[0] <= marg or bb[1] <= marg or bb[2] >= img.width - marg or bb[3] >= img.height - marg


def coverage(img):
    bb = img.getbbox()
    if not bb:
        return 0.0
    return ((bb[2] - bb[0]) * (bb[3] - bb[1])) / (img.width * img.height)


def leftover_white(img):
    """Frasa piksel opaque yang masih hampir putih (sisa latar tertutup)."""
    px = img.load()
    w, h = img.size
    tot = 0
    bad = 0
    for y in range(0, h, 3):
        for x in range(0, w, 3):
            r, g, b, a = px[x, y]
            tot += 1
            if a > 128 and bg_like(r, g, b):
                bad += 1
    return bad / max(1, tot)


def border_opaque(img):
    """Frasa piksel di cincin luar 3px yang masih opaque — tinggi = latar
    berwarna tidak terpotong (bukan putih), harus regen."""
    px = img.load()
    w, h = img.size
    tot = 0
    bad = 0
    for x in range(w):
        for y in (0, 1, 2, h - 3, h - 2, h - 1):
            tot += 1
            if px[x, y][3] > 128:
                bad += 1
    for y in range(h):
        for x in (0, 1, 2, w - 3, w - 2, w - 1):
            tot += 1
            if px[x, y][3] > 128:
                bad += 1
    return bad / max(1, tot)


def attempt(pid, seed):
    raw = pollinations(pid, PETS[pid], seed)
    img = Image.open(raw)
    cut = strip_white(img)
    # Latar berwarna tidak terpotong → gagal.
    bo = border_opaque(cut)
    if bo > 0.02:
        return None, f"border-opaque {bo:.2f}"
    lw = leftover_white(cut)
    if lw > 0.10:
        return None, f"leftover-bg {lw:.2f}"
    if touches_edge(cut, marg=3):
        return None, "edge-touch"
    trimmed = bbox_inset(cut)
    if trimmed is None:
        return None, "empty"
    if coverage(trimmed) < 0.15:
        return None, f"too-small {coverage(trimmed):.2f}"
    return trimmed, "ok"


def process(pid):
    out = os.path.join(OUT, f"{pid}.png")
    if os.path.exists(out) and "--force" not in sys.argv:
        return f"{pid}: skip (exists)"
    base = zlib.crc32(pid.encode()) % 90000
    why = ""
    maxtry = 1 if "--once" in sys.argv else 3
    for k in range(maxtry):
        seed = (base + k * 4177) % 90000 + 1
        try:
            trimmed, why = attempt(pid, seed)
        except Exception as e:
            why = f"error {e}"
            trimmed = None
        if trimmed is not None:
            trimmed.save(out, "PNG", optimize=True)
            return f"{pid}: ok seed={seed} {trimmed.size} cov={coverage(trimmed):.2f}"
        print(f"{pid}: attempt {k} seed={seed} gagal ({why}), coba seed lain…", flush=True)
        time.sleep(30)
    return f"{pid}: GAGAL semua ({why})"


if __name__ == "__main__":
    for pid in (sys.argv[1:] or list(PETS)):
        if pid.startswith("--"):
            continue
        try:
            print(process(pid), flush=True)
        except Exception as e:
            print(f"{pid}: ERROR {e}", flush=True)
