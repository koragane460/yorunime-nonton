#!/usr/bin/env python3
"""Generate pet art via AI Horde (anon, gratis) — submit async lalu poll.

Pollinations membatasi kuota anonymous dengan 402, jadi Horde dipakai sebagai
jalan alternatif. Job disimpan di /tmp/horde_ids.json supaya bisa di-poll dari
proses terminal terpisah (max 180 dtk per perintah).
"""
import json, os, sys, time, urllib.request
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gen_pets as G

IDS = "/tmp/horde_ids.json"
KEY = "0000000000"  # anonim

PROMPTS = {
    "fenrir": "legendary dark wolf with glowing purple eyes, full body, standing, game pet art, anime style",
    "cerberus": "three headed black hellhound dog with red glowing eyes, full body, standing, game pet art, anime style",
    "kirin": "golden asian qilin mythical horse dragon, full body, standing, game pet art, anime style",
    "leviathan": "giant blue sea serpent dragon, full body, coiled, game pet art, anime style",
    "behemoth": "massive rocky bull beast with stone armor, full body, standing, game pet art, anime style",
    "basilisk": "giant emerald green serpent snake, full body, coiled, game pet art, anime style",
}
NEG = ("scenery, landscape, background scenery, frame, border, text, watermark, "
       "cropped, cut off, photo, realistic")


def load():
    if os.path.exists(IDS):
        with open(IDS) as f:
            return json.load(f)
    return {}


def save(d):
    with open(IDS, "w") as f:
        json.dump(d, f)


def api(path, data=None, method=None):
    req = urllib.request.Request(
        "https://stablehorde.net/api/v2" + path,
        data=json.dumps(data).encode() if data is not None else None,
        headers={"apikey": KEY, "Content-Type": "application/json",
                 "Client-Agent": "yorunime-pets:1.0"},
        method=method or ("POST" if data is not None else "GET"),
    )
    with urllib.request.urlopen(req, timeout=40) as r:
        return json.loads(r.read())


def submit(pid):
    body = {
        "prompt": f"{PROMPTS[pid]}, isolated on a solid flat magenta background, plain background",
        "params": {
            "width": 512, "height": 512, "steps": 28, "cfg_scale": 7,
            "sampler_name": "k_euler_a", "n": 1, "post_processing": [],
            "ddim_ord": False,
        },
        "nsfw": False,
        "r2": True,
        "shared": True,
        "models": ["Anything Diffusion"],
        "disable_source_processing": False,
    }
    body["prompt"] = body["prompt"] + f" ### NEGATIVE: {NEG}"
    res = api("/generate/async", body)
    return res["id"]


def check(gid):
    return api(f"/generate/check/{gid}")


def result(gid):
    return api(f"/generate/status/{gid}")


def download_and_cut(url, pid):
    req = urllib.request.Request(url, headers={"Client-Agent": "yorunime-pets:1.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        data = r.read()
    tmp = f"/tmp/horde_{pid}.png"
    with open(tmp, "wb") as f:
        f.write(data)
    img = Image.open(tmp)
    cut = G.strip_white(img)
    bo = G.border_opaque(cut)
    if bo > 0.02:
        return None, f"border-opaque {bo:.2f}"
    lw = G.leftover_white(cut)
    if lw > 0.10:
        return None, f"leftover-bg {lw:.2f}"
    af = G.alpha_frac(cut)
    if af > 0.62:
        return None, f"scene {af:.2f}"
    if af < 0.05:
        return None, f"kosong {af:.2f}"
    if G.touches_edge(cut, marg=3):
        return None, "edge-touch"
    trimmed = G.bbox_inset(cut)
    if trimmed is None:
        return None, "kosong"
    out = os.path.join(G.OUT, f"{pid}.png")
    trimmed.save(out, "PNG", optimize=True)
    return out, f"ok af={af:.2f} size={trimmed.size}"


def main():
    ids = load()
    todo = [p for p in (sys.argv[1:] or list(PROMPTS))
            if not p.startswith("--") and not os.path.exists(os.path.join(G.OUT, f"{p}.png"))]

    # 1) submit yang belum punya job
    for pid in todo:
        if pid in ids and ids[pid].get("state") not in ("done", "fail"):
            continue
        try:
            gid = submit(pid)
            ids[pid] = {"id": gid, "state": "pending"}
            print(f"{pid}: submitted {gid}", flush=True)
        except Exception as e:
            print(f"{pid}: submit gagal {e}", flush=True)
        time.sleep(2)

    # 2) poll semua job
    for pid, info in list(ids.items()):
        if info.get("state") != "pending":
            continue
        try:
            st = check(info["id"])
        except Exception as e:
            print(f"{pid}: poll gagal {e}", flush=True)
            continue
        print(f"{pid}: queue pos={st.get('queue_position')} wait={st.get('wait_time')}s done={st.get('done')}", flush=True)
        if not st.get("done"):
            continue
        try:
            res = result(info["id"])
            gens = res.get("generations") or []
            if not gens:
                info["state"] = "fail"
                print(f"{pid}: tidak ada hasil ({res.get('faulted')})", flush=True)
                continue
            path, why = download_and_cut(gens[0]["img"], pid)
            info["state"] = "done" if path else "fail"
            print(f"{pid}: {why}", flush=True)
        except Exception as e:
            info["state"] = "fail"
            print(f"{pid}: gagal {e}", flush=True)
        time.sleep(2)

    save(ids)


if __name__ == "__main__":
    main()
