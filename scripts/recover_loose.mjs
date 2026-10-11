// Ekstraksi Home.tsx dari semua loose objects di store lokal.
// Tidak memakai CLI yang diblokir platform; membaca objek langsung dari disk.
import fs from "fs";
import path from "path";
import zlib from "zlib";
import crypto from "crypto";

const objDir = "/home/daytona/codebase/.git/objects";
const outDir = "/home/daytona/codebase/.recovered";
fs.mkdirSync(outDir, { recursive: true });

const objects = new Map(); // sha -> {type, data}
for (const sub of fs.readdirSync(objDir)) {
  if (sub.length !== 2 || /[^0-9a-f]/.test(sub)) continue;
  for (const f of fs.readdirSync(path.join(objDir, sub))) {
    const sha = sub + f;
    try {
      const infl = zlib.inflateSync(fs.readFileSync(path.join(objDir, sub, f)));
      const nul = infl.indexOf(0);
      const [type, sizeStr] = infl.slice(0, nul).toString().split(" ");
      const data = infl.subarray(nul + 1);
      if (Number(sizeStr) !== data.length) continue; // sanity
      // verifikasi hash agar tidak salah nama
      const store = Buffer.concat([Buffer.from(`${type} ${sizeStr}\0`), data]);
      const actual = crypto.createHash("sha1").update(store).digest("hex");
      if (actual === sha) objects.set(sha, { type, data });
    } catch {}
  }
}
console.log("verified objects:", objects.size);

const readObj = (sha) => objects.get(sha) ?? null;

function walkTree(treeSha, prefix = "", out = [], depth = 0) {
  const obj = readObj(treeSha);
  if (!obj || obj.type !== "tree") {
    // Folder tests/ memang sering tidak masuk snapshot; tolak hanya kalau
    // yang hilang ada di dalam src/.
    const clean = prefix.replace(/\/+$/, "");
    const skip = ["tests", "isolate", "public", "scripts", "node_modules"];
    if (skip.some((s) => clean === s || clean.startsWith(s + "/"))) return out;
    return null;
    return null; // subtree penting tidak utuh
  }
  const body = obj.data;
  let off = 0;
  while (off < body.length) {
    const sp = body.indexOf(32, off);
    const nul = body.indexOf(0, sp);
    if (sp < 0 || nul < 0) break;
    const mode = body.slice(off, sp).toString();
    const name = body.slice(sp + 1, nul).toString();
    const sha2 = body.subarray(nul + 1, nul + 21).toString("hex");
    const full = prefix + name;
    if (mode === "40000") {
      if (depth < 5) {
        const r = walkTree(sha2, full + "/", out, depth + 1);
        if (r === null) return null; // subtree penting hilang
      }
    } else out.push({ path: full, sha: sha2 });
    off = nul + 21;
  }
  return out;
}

const commits = [];
for (const [sha, o] of objects) {
  if (o.type !== "commit") continue;
  const text = o.data.toString();
  const tree = text.match(/^tree ([0-9a-f]{40})/m)?.[1];
  const parents = [...text.matchAll(/^parent ([0-9a-f]{40})/gm)].map((m) => m[1]);
  const author = text.match(/^author ([^\n]*)/m)?.[1] ?? "";
  const msg = (text.split("\n\n")[1] ?? "").trim().split("\n")[0];
  const ts = Number(text.match(/^committer .* (\d+) /m)?.[1] ?? 0);
  commits.push({ sha, tree, parents, msg, when: ts ? new Date(ts * 1000) : null });
}
commits.sort((a, b) => a.when - b.when);
console.log("commits:", commits.length);

// walk hanya folder yang penting untuk pemulihan Home: src/pages dan src
function walkRoot(treeSha) {
  const rootO = readObj(treeSha);
  if (!rootO || rootO.type !== "tree") return null;
  const body = rootO.data; let off = 0;
  let files = [];
  while (off < body.length) {
    const sp = body.indexOf(32, off); const nul = body.indexOf(0, sp);
    if (sp < 0 || nul < 0) break;
    const mode = body.slice(off, sp).toString();
    const name = body.slice(sp + 1, nul).toString();
    const sha2 = body.subarray(nul + 1, nul + 21).toString("hex");
    if (mode === "40000" && (name === "src")) {
      const r = walkTree(sha2, "src/");
      if (r === null) return null;
      files = files.concat(r);
    }
    off = nul + 21;
  }
  return files;
}

const results = [];
let ok = 0, incomplete = 0, missingDeps = {};
for (const c of commits) {
  // catat alasan snapshot rusak: subtree mana yang hilang
  const files = walkRoot(c.tree);
  if (files === null) {
    // cari kedalaman hilangnya lewat pemeriksaan manual
    const probe = (sha, prefix = "", depth = 0) => {
      const o = readObj(sha);
      if (!o || o.type !== "tree") { missingDeps[c.sha.slice(0, 8)] = prefix || "(root)"; return; }
      const body = o.data; let off = 0;
      while (off < body.length) {
        const sp = body.indexOf(32, off); const nul = body.indexOf(0, sp);
        if (sp < 0 || nul < 0) break;
        const mode = body.slice(off, sp).toString();
        const name = body.slice(sp + 1, nul).toString();
        const sha2 = body.subarray(nul + 1, nul + 21).toString("hex");
        if (mode === "40000" && depth < 5) probe(sha2, prefix + name + "/", depth + 1);
        off = nul + 21;
      }
    };
    probe(c.tree);
    incomplete++;
    continue;
  }
  const home = files.find((f) => f.path === "src/pages/Home.tsx");
  const mainDb = files.find((f) => f.path === "src/main.tsx");
  const router = files.find((f) => f.path === "src/App.tsx");
  const line = `commit ${c.sha.slice(0, 10)} ${c.when ? c.when.toISOString() : "?"} msg="${c.msg.slice(0, 60)}" files=${files.length} Home=${home ? "yes" : "NO"}`;
  if (!home) { results.push(line); continue; }
  const blob = readObj(home.sha);
  if (!blob) { results.push(line + " (blob missing)"); continue; }
  const fname = `Home_${c.when ? c.when.toISOString().replace(/[:.]/g, "-") : "unknown"}_${c.sha.slice(0, 8)}__${blob.data.length}b.tsxbak`;
  fs.writeFileSync(path.join(outDir, fname), blob.data);
  if (mainDb) {
    const mb = readObj(mainDb.sha);
    if (mb) fs.writeFileSync(path.join(outDir, `main_${c.sha.slice(0, 8)}.tsxbak`), mb.data);
  }
  if (router) {
    const ab = readObj(router.sha);
    if (ab) fs.writeFileSync(path.join(outDir, `App_${c.sha.slice(0, 8)}.tsxbak`), ab.data);
  }
  ok++;
  results.push(line + ` -> ${fname}`);
}
fs.writeFileSync(path.join(outDir, "HISTORY.txt"), results.join("\n"));
console.log(`complete snapshots Home: ${ok}, incomplete: ${incomplete}`);
const distinctMissing = [...new Set(Object.values(missingDeps))];
console.log("distinct missing prefixes:", distinctMissing.join(", ") || "none");
for (const l of results) console.log(l);
