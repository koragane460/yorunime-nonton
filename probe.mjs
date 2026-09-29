const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const sites = [
  "https://animeindo.biz",
  "https://animeindo.link",
  "https://animeindo.party",
  "https://animeindo.id",
  "https://animeindo.vip",
  "https://nimeku.com",
  "https://samehad.icu",
  "https://s-streaming.net",
  "https://animekita.net",
  "https://otakudesu.quest",
  "https://kusutanime.com",
  "https://animesubindo.link",
  "https://animesubindo.id",
  "https://haninn169.my.id",
  "https://goplay696.my.id",
  "https://filecrypt.pk",
];
for (const s of sites) {
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 12000);
    const r = await fetch(s, {
      signal: c.signal,
      redirect: "follow",
      headers: { "User-Agent": UA, "Accept-Language": "id-ID,id;q=0.9" },
    });
    clearTimeout(t);
    const html = await r.text();
    const title = (html.match(/<title[^>]*>([\s\S]{0,80}?)<\/title>/i) || [])[1] || "";
    console.log(r.status, s, "| len", html.length, "|", title.replace(/\s+/g, " ").slice(0, 60));
  } catch (e) {
    console.log("ERR", s, "|", String(e?.message ?? e).slice(0, 40));
  }
}
