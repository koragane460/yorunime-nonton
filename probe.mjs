const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const B = "https://otakudesu-scrapper.vercel.app";
async function j(p) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), 18000);
  try {
    const r = await fetch(B + p, { signal: c.signal, headers: { "User-Agent": UA } });
    return { s: r.status, j: await r.json() };
  } catch (e) { return { s: 0, j: "ERR " + String(e?.message ?? e).slice(0, 40) }; } finally { clearTimeout(t); }
}
const k = await j("/kuramanime/anime?search=frieren");
const kItems = k.j?.data?.animeList ?? k.j?.data ?? [];
console.log("kuramanime search:", k.s, Array.isArray(kItems) ? kItems.slice(0, 3).map((x) => `${x.id ?? x.animeId}/${x.slug ?? ""}`).join(" | ") : JSON.stringify(k.j).slice(0, 200));
const first = Array.isArray(kItems) ? kItems[0] : null;
if (first) {
  const id = first.animeId ?? first.id ?? first.idKuramanime;
  const slug = first.slug ?? first.animeSlug ?? "";
  const d = await j(`/kuramanime/anime/${id}/${slug}`);
  console.log("kuramanime detail keys:", Object.keys(d.j?.data ?? {}), "| eps:", (d.j?.data?.episodeList ?? []).length);
  const ep = (d.j?.data?.episodeList ?? [])[0];
  console.log("ep sample:", JSON.stringify(ep).slice(0, 300));
  if (ep) {
    const e = await j(`/kuramanime/anime/${id}/${slug}/episode/${ep.episodeId ?? ep.episode ?? ep.id}`);
    console.log("kuramanime episode:", JSON.stringify(e.j).slice(0, 900));
  }
}
const n = await j("/nimegami/search?q=frieren");
console.log("nimegami search:", n.s, JSON.stringify(n.j).slice(0, 300));
