# -*- coding: utf-8 -*-
"""Regenerate pet art: cartoon HD style, full body, chroma-green -> transparent."""
import os, sys, io, math, urllib.parse, urllib.request, random, time
from PIL import Image

OUT = "/home/daytona/codebase/public/pets"
WORK = os.path.dirname(os.path.abspath(__file__))

PETS = {
    "kunai": "a cute chubby yellow baby chick mascot, tiny orange beak, big glossy eyes",
    "penyu": "a cute green sea turtle mascot with shiny shell pattern",
    "kenari": "a cute plump yellow canary bird mascot with spread little wings",
    "rubah": "a cute orange fox mascot with big fluffy tail",
    "serigala": "a cute grey wolf mascot puppy, fluffy fur, standing proud",
    "harimau-putih": "a cute white tiger cub mascot with bold black stripes",
    "rusa": "a cute brown deer fawn mascot with small antlers and white spots",
    "merak": "a cute peacock mascot with beautiful fanned tail feathers",
    "unikorn": "a cute white unicorn mascot with rainbow mane and golden horn",
    "naga": "a cute eastern dragon mascot, emerald green scales, wispy whiskers",
    "macan-tutul-salju": "a cute snow leopard mascot with dark rosette spots and thick fluffy tail",
    "tetrix": "a majestic phoenix spirit mascot made of liquid gold and glowing starlight",
}

STYLE = ("2D cartoon game mascot art style, thick clean outlines, soft cel shading, "
         "vibrant saturated colors, big expressive eyes, adorable, full body standing "
         "centered with all four legs and tail visible, isolated on a pure flat solid "
         "chroma green background color 00ff00, no ground shadow, no text, HD quality")

def dl(name, desc, tries=8):
    prompt = urllib.parse.quote(f"{desc}, {STYLE}")
    models = ["flux", "turbo", "flux", "turbo"]
    for t in range(tries):
        seed = random.randint(1, 10**6)
        model = models[t % len(models)]
        url = (f"https://image.pollinations.ai/prompt/{prompt}"
               f"?width=512&height=512&nologo=true&model={model}&seed={seed}&enhance=true")
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=120) as r:
                data = r.read()
            im = Image.open(io.BytesIO(data)).convert("RGB")
            if im.size != (512, 512):
                im = im.resize((512, 512), Image.LANCZOS)
            return im
        except Exception as e:
            print(f"  retry {t+1} ({model}) {name}: {e}", flush=True)
            time.sleep(6 + t * 4)
    return None

def chroma_key(im):
    """Green screen -> alpha. alpha = clamp((g - max(r,b) - 15) / 40)."""
    px = im.load()
    w, h = im.size
    out = Image.new("RGBA", (w, h))
    op = out.load()
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            other = max(r, b)
            greenness = g - other
            if greenness <= 12:
                a = 255
            elif greenness >= 52:
                a = 0
            else:
                a = int(255 * (52 - greenness) / 40)
            # despill: clamp green channel
            ng = min(g, other + 8) if a > 0 else g
            op[x, y] = (r, ng, b, a)
    return out

def finalize(name, rgba):
    # autocrop by alpha with small tolerance, then pad to square with margin
    bbox = rgba.split()[3].getbbox()
    if not bbox:
        print(f"  !! {name}: fully transparent", flush=True)
        return False
    pad = 6
    l = max(0, bbox[0] - pad); t = max(0, bbox[1] - pad)
    r = min(rgba.width, bbox[2] + pad); b = min(rgba.height, bbox[3] + pad)
    sub = rgba.crop((l, t, r, b))
    # target: subject occupies ~86% of 512 frame, centered
    side = int(max(sub.width, sub.height) / 0.86)
    side = max(side, 200)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(sub, ((side - sub.width) // 2, (side - sub.height) // 2), sub)
    if side > 512:
        canvas = canvas.resize((512, 512), Image.LANCZOS)
    elif side < 512:
        c2 = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
        c2.paste(canvas, ((512 - side) // 2, (512 - side) // 2), canvas)
        canvas = c2
    path = os.path.join(OUT, f"{name}.png")
    canvas.save(path)
    # verify
    a = canvas.split()[3]
    bbox2 = a.getbbox()
    cov = sum(a.histogram()[200:]) / (512 * 512)
    px = canvas.load()
    vis = [px[x, y] for y in range(0, 512, 8) for x in range(0, 512, 8) if px[x, y][3] > 128]
    bright = sum((p[0] + p[1] + p[2]) / 3 for p in vis) / max(1, len(vis))
    edge_ok = bbox2 and bbox2[0] >= 6 and bbox2[1] >= 6 and bbox2[2] <= 506 and bbox2[3] <= 506
    print(f"  {name}: cover={cov:.2f} bright={bright:.0f} bbox={bbox2} edge_ok={edge_ok}", flush=True)
    return bool(edge_ok) and 0.10 < cov < 0.80 and bright > 35

if __name__ == "__main__":
    only = sys.argv[1:] or list(PETS.keys())
    fails = []
    for name in only:
        raw_path = os.path.join(WORK, f"raw-{name}.png")
        if os.path.exists(raw_path):
            im = Image.open(raw_path).convert("RGB")
            print(f"{name}: using cached raw", flush=True)
        else:
            print(f"{name}: downloading...", flush=True)
            im = dl(name, PETS[name])
            if im is None:
                fails.append(name)
                continue
            im.save(raw_path)
        rgba = chroma_key(im)
        ok = finalize(name, rgba)
        if not ok:
            fails.append(name)
    print("FAILS:", fails if fails else "none", flush=True)
