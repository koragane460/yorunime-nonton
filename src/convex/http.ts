import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";

const http = httpRouter();

auth.addHttpRoutes(http);

// ---------------------------------------------------------- MegaPlay proxy ----
// Segment .ts & subtitle .vtt MegaPlay hanya bisa di-fetch dengan header
// Referer: https://megaplay.buzz/ (header ini tidak boleh diset dari browser),
// jadi semua request video diteruskan lewat route ini. Playlist m3u8 juga
// di-rewrite supaya menunjuk ke proxy lagi (bukan URL CDN asli).

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const REF = "https://megaplay.buzz/";

function b64urlEncode(s: string) {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string) {
  const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

const toProxy = (abs: string) => `/megastream?u=${b64urlEncode(abs)}`;

/** Tulis ulang semua URL di dalam playlist m3u8 agar lewat proxy. */
function rewritePlaylist(text: string, base: string) {
  const abs = (u: string) => {
    try {
      return new URL(u.trim(), base).href;
    } catch {
      return null;
    }
  };
  return text
    .split("\n")
    .map((line) => {
      const t = line.trim();
      if (!t) return line;
      if (t.startsWith("#")) {
        return line.replace(/URI="([^"]+)"/g, (m, u) => {
          const a = abs(u);
          return a ? `URI="${toProxy(a)}"` : m;
        });
      }
      const a = abs(t);
      return a ? toProxy(a) : line;
    })
    .join("\n");
}

const megaStream = httpAction(async (_ctx, request) => {
  const raw = new URL(request.url).searchParams.get("u");
  if (!raw) return new Response("missing u", { status: 400 });

  let target: string;
  try {
    target = b64urlDecode(raw);
  } catch {
    return new Response("bad u", { status: 400 });
  }

  let url: URL;
  try {
    url = new URL(target);
  } catch {
    return new Response("bad url", { status: 400 });
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return new Response("bad protocol", { status: 400 });
  }

  // Tolak target internal (SSRF guard sederhana).
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".internal") ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^0\./.test(host)
  ) {
    return new Response("forbidden host", { status: 403 });
  }

  const upstream = await fetch(url.href, {
    headers: { "User-Agent": UA, Referer: REF, Accept: "*/*" },
  });
  const contentType = upstream.headers.get("content-type") ?? "";
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Expose-Headers": "*",
    "Access-Control-Allow-Headers": "*",
  };

  const isPlaylist =
    contentType.includes("mpegurl") || url.pathname.endsWith(".m3u8");
  if (isPlaylist) {
    const text = await upstream.text();
    return new Response(rewritePlaylist(text, url.href), {
      status: 200,
      headers: {
        ...cors,
        "Content-Type": "application/vnd.apple.mpegurl",
        // Playlist pendek: sering berubah, tapi cache browser sangat membantu
        // agar tidak request ulang tiap beberapa detik.
        "Cache-Control": "public, max-age=20",
      },
    });
  }

  // Perbaiki MIME yang salah dari CDN (segment .ts dikirim sebagai image/jpeg,
  // subtitle .vtt sebagai octet-stream) supaya hls.js/<track> diterima browser.
  let outType = contentType || "application/octet-stream";
  let cache = "public, max-age=300";
  if (url.pathname.endsWith(".ts")) outType = "video/mp2t";
  else if (url.pathname.endsWith(".vtt")) {
    outType = "text/vtt; charset=utf-8";
    cache = "public, max-age=3600";
  } else if (url.pathname.endsWith(".m4s") || url.pathname.endsWith(".mp4"))
    outType = "video/mp4";
  else if (url.pathname.endsWith(".aac") || url.pathname.endsWith(".m4a"))
    outType = "audio/mp4";
  // Segment immutable → boleh di-cache browser paling lama (anti buffering).
  if (/\.(ts|m4s|mp4|aac|m4a)$/i.test(url.pathname))
    cache = "public, max-age=31536000, immutable";

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      ...cors,
      "Content-Type": outType,
      "Cache-Control": cache,
    },
  });
});

http.route({ path: "/megastream", method: "GET", handler: megaStream });

export default http;
