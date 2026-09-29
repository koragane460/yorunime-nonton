const DEPLOY = "https://reminiscent-ptarmigan-918.convex.cloud";
async function call(path, args) {
  const t0 = Date.now();
  const r = await fetch(`${DEPLOY}/api/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, args, format: "json" }),
  });
  const j = await r.json();
  return { v: j.status === "success" ? j.value : { __err: j.errorMessage }, ms: Date.now() - t0 };
}
for (const [malId, ep, label] of [
  ["52991", 1, "Frieren S1 ep1"],
  ["21", 1, "One Piece ep1"],
  ["50265", 3, "Spy x Family ep3"],
  ["269", 100, "Bleach ep100"],
]) {
  const a = await call("subtitle:subtitleIndo", { malId, ep });
  const vtt = a.v?.vtt ?? "";
  console.log(
    `${label.padEnd(20)} ok=${a.v?.ok} source=${a.v?.source ?? a.v?.reason} cues=${(vtt.match(/-->/g) || []).length} ms=${a.ms}`,
  );
  if (vtt) console.log("   cuplikan:", vtt.split("\n\n")[1]?.slice(0, 110));
}
