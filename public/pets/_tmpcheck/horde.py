# -*- coding: utf-8 -*-
"""Submit remaining pets to Stable Horde (async), then poll & save raw PNGs."""
import os, sys, json, time, urllib.request, urllib.parse
from PIL import Image

WORK = os.path.dirname(os.path.abspath(__file__))
API = "https://aihorde.net/api/v2/generate"

PETS = {
    "penyu": "cute green sea turtle mascot with shiny patterned shell",
    "kenari": "cute plump yellow canary bird mascot with spread little wings",
    "serigala": "cute grey wolf puppy mascot, fluffy fur, standing proud",
    "rusa": "cute brown deer fawn mascot with small antlers and white spots",
    "merak": "cute peacock mascot with beautiful fanned tail feathers",
    "unikorn": "cute white unicorn mascot with rainbow mane and golden horn",
    "naga": "cute eastern dragon mascot, emerald green scales, wispy whiskers",
    "harimau-putih": "cute white tiger cub mascot with bold black stripes",
    "macan-tutul-salju": "cute snow leopard mascot with dark rosette spots, thick fluffy tail",
    "tetrix": "majestic golden phoenix bird mascot made of liquid gold and glowing starlight",
}

STYLE = (", 2D cartoon game mascot art style, thick clean outlines, soft cel shading, "
         "vibrant colors, big expressive eyes, adorable, full body standing centered, "
         "all legs and tail visible, isolated on a pure flat solid bright green chroma "
         "key background, no ground shadow, no text, high quality")

STATE = os.path.join(WORK, "horde.json")

def req(url, data=None, headers=None, method=None):
    h = {"Content-Type": "application/json", "apikey": "0000000000",
         "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
         "Client-Agent": "yorunime:1.0"}
    if headers: h.update(headers)
    body = json.dumps(data).encode() if data is not None else None
    r = urllib.request.Request(url, data=body, headers=h, method=method)
    with urllib.request.urlopen(r, timeout=60) as resp:
        return json.loads(resp.read().decode())

def load():
    if os.path.exists(STATE):
        return json.load(open(STATE))
    return {}

def save(st):
    json.dump(st, open(STATE, "w"))

def submit_missing(st):
    for name, desc in PETS.items():
        raw = os.path.join(WORK, f"raw-{name}.png")
        if os.path.exists(raw) or name in st:
            continue
        payload = {
            "prompt": f"masterpiece, best quality, {desc}{STYLE}",
            "params": {"width": 512, "height": 512, "steps": 24,
                       "sampler_name": "k_euler_a", "n": 1, "cfg_scale": 7},
            "nsfw": False,
            "models": ["Deliberate"],
            "r2": True,
        }
        try:
            res = req(f"{API}/async", payload)
            if "id" in res:
                st[name] = res["id"]
                print(f"submit {name}: {res['id']}", flush=True)
            else:
                print(f"submit {name}: FAIL {res}", flush=True)
        except Exception as e:
            print(f"submit {name}: ERR {e}", flush=True)
        time.sleep(2)
    save(st)

def poll(st, budget_s=600):
    end = time.time() + budget_s
    while time.time() < end:
        pending = []
        for name, jid in list(st.items()):
            raw = os.path.join(WORK, f"raw-{name}.png")
            if os.path.exists(raw):
                continue
            try:
                res = req(f"{API}/status/{jid}", method="GET")
            except Exception as e:
                print(f"poll {name}: ERR {e}", flush=True)
                pending.append(name)
                continue
            if res.get("done"):
                gens = res.get("generations") or []
                if gens:
                    url = gens[0].get("img")
                    try:
                        with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"}), timeout=120) as r:
                            data = r.read()
                        import io
                        im = Image.open(io.BytesIO(data)).convert("RGB")
                        if im.size != (512, 512):
                            im = im.resize((512, 512), Image.LANCZOS)
                        im.save(raw)
                        print(f"saved {name}", flush=True)
                    except Exception as e:
                        print(f"dl {name}: ERR {e}", flush=True)
                        pending.append(name)
                else:
                    print(f"{name}: no generations: {res.get('faulted')}", flush=True)
                    st.pop(name, None)
            else:
                pending.append(name)
                if name == pending[0] if pending else False:
                    pass
        save(st)
        if not pending:
            print("ALL DONE", flush=True)
            return True
        print(f"pending: {pending} (wait={res.get('wait_time') if 'res' in dir() else '?'})", flush=True)
        time.sleep(15)
    print("TIMEOUT pending:", pending, flush=True)
    return False

if __name__ == "__main__":
    st = load()
    submit_missing(st)
    poll(st, budget_s=int(sys.argv[1]) if len(sys.argv) > 1 else 600)
