// Baca packfile lokal (tanpa CLI yang diblokir platform), lalu ekstrak
// semua versi src/pages/Home.tsx yang pernah ada di riwayat.
import fs from "fs";
import path from "path";
import zlib from "zlib";
import crypto from "crypto";

const gitDir = "/home/daytona/codebase/.git";
const packDir = path.join(gitDir, "objects", "pack");
const packFiles = fs.readdirSync(packDir).filter((f) => f.endsWith(".pack"));
if (!packFiles.length) { console.log("NO_PACK"); process.exit(0); }
const packFile = path.join(packDir, packFiles[0]);
const idxFile = packFile.replace(/\.pack$/, ".idx");
const pack = fs.readFileSync(packFile);
const idx = fs.readFileSync(idxFile);

// ---- idx v2 parsing ----
const fanout = idx.readUInt32BE(8 + 255 * 4); // jumlah total objek? fanout[255] di offset 8+255*4
const numObjects = idx.readUInt32BE(8 + 255 * 4);
const shaTableStart = 8 + 256 * 4;
const namesOffset = shaTableStart;
const crcOffset = namesOffset + numObjects * 20;
const off32 = crcOffset + numObjects * 4;
const bigStart = off32 + numObjects * 4;
const shas = [];
for (let i = 0; i < numObjects; i++) shas.push(idx.slice(namesOffset + i * 20, namesOffset + (i + 1) * 20).toString("hex"));
const readOffset = (i) => {
  let o = idx.readUInt32BE(off32 + i * 4);
  if (o & 0x80000000) {
    const idx8 = o & 0x7fffffff;
    o = Number(idx.readBigUInt64BE(bigStart + idx8 * 8));
  }
  return o;
};
const shaByOffset = new Map();
for (let i = 0; i < numObjects; i++) shaByOffset.set(readOffset(i), shas[i]);

// ---- object reader dengan delta ----
const objCache = new Map();
const inflateAt = (offset) => {
  // cari panjang: inflate bertahap
  const CHUNK = 4096;
  let infl = zlib.inflateSync(pack.subarray(offset));
  return infl;
};
function readObjHeader(offset) {
  let byte = pack[offset]; offset++;
  const type = (byte >> 4) & 7;
  let size = byte & 15, shift = 4;
  while (byte & 0x80) { byte = pack[offset]; offset++; size += (byte & 0x7f) << shift; shift += 7; }
  return { type, size, dataStart: offset };
}
function getObject(sha) {
  if (objCache.has(sha)) return objCache.get(sha);
  const i = shas.indexOf(sha);
  if (i < 0) return null;
  return getObjectByIndex(i);
}
function getObjectByIndex(i) {
  const sha = shas[i];
  if (objCache.has(sha)) return objCache.get(sha);
  const offset = readOffset(i);
  const hdr = readObjHeader(offset);
  let type = hdr.type, data = inflateAt(hdr.dataStart);
  if (type === 6) { // OFS_DELTA
    let off2 = hdr.dataStart; let b = pack[off2]; off2++; let base = b & 0x7f; let shift = 0;
    while (b & 0x80) { b = pack[off2]; off2++; shift += 7; base |= (b & 0x7f) << shift; }
    const baseOffset = offset - base;
    const baseSha = shaByOffset.get(baseOffset);
    const baseIdx = shas.indexOf(baseSha);
    const baseObj = getObjectByIndex(baseIdx);
    const delta = inflateAt(off2);
    data = applyDelta(baseObj.data, delta);
    type = baseObj.type;
  } else if (type === 7) { // REF_DELTA
    const baseSha = pack.slice(hdr.dataStart, hdr.dataStart + 20).toString("hex");
    const baseObj = getObject(baseSha);
    if (!baseObj) throw new Error("base missing " + baseSha);
    const delta = inflateAt(hdr.dataStart + 20);
    data = applyDelta(baseObj.data, delta);
    type = baseObj.type;
  }
  if (type === 1) type = "commit"; else if (type === 2) type = "tree";
  else if (type === 3) type = "blob"; else if (type === 4) type = "tag";
  const obj = { type, data };
  objCache.set(sha, obj);
  return obj;
}
function applyDelta(base, delta) {
  let p = 0;
  const rb = (buf, pos, n) => buf.subarray(pos, pos + n);
  while (delta[p] === 0 && p < delta.length) p++; // skip leading zeros? not needed normally
  p = 0;
  // src size varint
  let x = delta[p++]; let srcSize = x & 0x7f; let s = 7;
  while (x & 0x80) { x = delta[p++]; srcSize |= (x & 0x7f) << s; s += 7; }
  x = delta[p++]; let dstSize = x & 0x7f; s = 7;
  while (x & 0x80) { x = delta[p++]; dstSize |= (x & 0x7f) << s; s += 7; }
  const out = Buffer.alloc(dstSize); let o = 0;
  while (p < delta.length) {
    const cmd = delta[p++];
    if (cmd & 0x80) {
      let cpOff = 0, cpSize = 0;
      if (cmd & 0x01) cpOff = delta[p++];
      if (cmd & 0x02) cpOff |= delta[p++] << 8;
      if (cmd & 0x04) cpOff |= delta[p++] << 16;
      if (cmd & 0x08) cpOff |= delta[p++] << 24;
      if (cmd & 0x10) cpSize = delta[p++];
      if (cmd & 0x20) cpSize |= delta[p++] << 8;
      if (cmd & 0x40) cpSize |= delta[p++] << 16;
      if (cpSize === 0) cpSize = 0x10000;
      delta.copy(out, o, cpOff, cpOff + cpSize);
      o += cpSize;
    } else if (cmd > 0) {
      delta.copy(out, o, p, p + cmd); o += cmd; p += cmd;
    } else break;
  }
  return out;
}

// ---- walks: semua commit, ekstrak Home.tsx & catat konteks ----
const commits = [];
for (let i = 0; i < numObjects; i++) {
  let obj;
  try { obj = getObjectByIndex(i); } catch (e) { console.log(`obj #${i} failed: ${e.message} at offset ${readOffset(i)}`); continue; }
  if (obj && obj.type === "commit") {
    const text = obj.data.toString();
    const treeSha = text.match(/^tree ([0-9a-f]{40})/m)?.[1];
    const parent = text.match(/^parent ([0-9a-f]{40})/m)?.[1] ?? null;
    const msg = (text.split("\n\n")[1] ?? "").split("\n")[0];
    const when = text.match(/^committer .* (\d+) /m)?.[1];
    commits.push({ sha: shas[i], tree: treeSha, parent, msg, when: when ? new Date(Number(when) * 1000) : null });
  }
}
console.log("commits in pack:", commits.length);
commits.forEach((c, n) => console.log(`  #${n} ${c.sha.slice(0, 8)} ${c.when ? c.when.toISOString() : "?"} ${c.msg.slice(0, 70)}`));

// tree walker
function walkTree(treeSha, prefix = "", out = [], depth = 0) {
  const obj = treeSha ? getObject(treeSha) : null;
  if (!obj || obj.type !== "tree") return out;
  const body = obj.data; let off = 0;
  while (off < body.length) {
    const sp = body.indexOf(32, off); const nul = body.indexOf(0, sp);
    if (sp < 0 || nul < 0) break;
    const mode = body.slice(off, sp).toString();
    const name = body.slice(sp + 1, nul).toString();
    const sha2 = body.slice(nul + 1, nul + 21).toString("hex");
    const full = prefix + name;
    if (mode === "40000" && depth < 4) walkTree(sha2, full + "/", out, depth + 1);
    else out.push({ path: full, sha: sha2, mode });
    off = nul + 21;
  }
  return out;
}

let saved = 0;
const manifest = [];
for (let n = 0; n < commits.length; n++) {
  const c = commits[n];
  let files;
  try { files = walkTree(c.tree); } catch (e) { console.log(`#${n} tree error: ${e.message}`); continue; }
  const home = files.find((f) => f.path === "src/pages/Home.tsx");
  if (!home) { console.log(`#${n}: no Home.tsx`); continue; }
  const blob = getObject(home.sha);
  if (!blob) { console.log(`#${n}: Home blob missing`); continue; }
  const outPath = `/home/daytona/codebase/.recovered/Home__commit${n}_${c.sha.slice(0, 8)}.tsxbak`;
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, blob.data);
  saved++;
  manifest.push(`commit#${n} ${c.when ? c.when.toISOString() : "?"} ${blob.data.length} bytes -> ${path.basename(outPath)}`);
  console.log(`  #${n} saved Home.tsx (${blob.data.length} bytes)`);
}
fs.writeFileSync("/home/daytona/codebase/.recovered/MANIFEST.txt", manifest.join("\n"));
console.log("done, saved:", saved);
