const qs = ["hianime-api", "hianime api deploy", "anime api direct m3u8 mp4 scraper", "zoro api hianime"];
for (const q of qs) {
  try {
    const r = await fetch(
      `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=updated&per_page=6`,
      { headers: { "User-Agent": "yorunime", Accept: "application/vnd.github+json" } },
    );
    const j = await r.json();
    console.log("== " + q);
    for (const it of j.items ?? []) {
      console.log("  -", it.full_name, "| pushed", it.pushed_at?.slice(0, 10), "|", (it.homepage || it.description || "").slice(0, 80));
    }
  } catch (e) {
    console.log("ERR", q, String(e?.message ?? e).slice(0, 50));
  }
  await new Promise((r) => setTimeout(r, 2500));
}
