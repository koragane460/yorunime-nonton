import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
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
  const params = new URL(request.url).searchParams;
  const raw = params.get("u");
  if (!raw) return new Response("missing u", { status: 400 });
  // Range diteruskan ke upstream supaya seek & buffering video mulus.
  const range = request.headers.get("range") ?? undefined;
  let referer: string | undefined;
  const refRaw = params.get("r");
  if (refRaw) {
    try {
      referer = b64urlDecode(refRaw);
    } catch {
      referer = undefined;
    }
  }

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
    headers: {
      "User-Agent": UA,
      // Host selain MegaPlay (mis. CDN Blogger/Oploverz) butuh Referer-nya
      // sendiri; bisa dikirim lewat param `r`.
      Referer: referer ?? REF,
      Accept: "*/*",
      ...(range ? { Range: range } : {}),
    },
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
      // Range/206 diteruskan supaya player bisa seek tanpa buffering ulang.
      ...(upstream.headers.get("content-range")
        ? { "Content-Range": upstream.headers.get("content-range") as string }
        : {}),
      ...(upstream.headers.get("content-length")
        ? { "Content-Length": upstream.headers.get("content-length") as string }
        : {}),
      "Accept-Ranges": upstream.headers.get("accept-ranges") ?? "bytes",
    },
  });
});

http.route({ path: "/megastream", method: "GET", handler: megaStream });

// ------------------------------------------------------------ proxy gambar ----
//
// Host sumber donghua (donghive.vip) memakai proteksi hotlink: gambar
// Poster dibalas 403 kalau diakses langsung dari browser YoruNime, dan
// responsnya juga membawa `Cross-Origin-Resource-Policy: same-origin`.
// Akibatnya semua poster donghua tampil kotak hitam.
//
// Route ini ambil gambarnya di sisi server (dengan Referer + User-Agent),
// lalu dikembalikan sebagai response same-origin supaya browser menerimanya.

const IMAGE_HOST_REFS: Record<string, string> = {
  "donghive.vip": "https://donghive.vip/",
  "anichin.moe": "https://anichin.moe/",
};

const IMAGE_ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
];

const imgProxy = httpAction(async (_ctx, request) => {
  const params = new URL(request.url).searchParams;
  const raw = params.get("u");
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
  if (url.protocol !== "https:") {
    return new Response("bad protocol", { status: 400 });
  }
  // Hanya host gambar yang dikenal boleh diproksi, jadi route ini tidak
  // berubah jadi proxy bebas untuk URL apa saja.
  const referer = IMAGE_HOST_REFS[url.hostname.toLowerCase()];
  if (!referer) return new Response("forbidden host", { status: 403 });

  const upstream = await fetch(url.href, {
    headers: {
      "User-Agent": UA,
      Referer: referer,
      Accept: "image/avif,image/webp,image/png,image/jpeg,*/*",
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!upstream.ok) {
    return new Response("upstream " + upstream.status, { status: 502 });
  }

  const type = (upstream.headers.get("content-type") ?? "").split(";")[0].trim();
  if (!IMAGE_ALLOWED_TYPES.includes(type)) {
    return new Response("unsupported type", { status: 415 });
  }

  // Poster bersifat statis, jadi cache browser yang panjang sudah cukup
  // supaya tidak memanggil host asal lagi pada kunjungan berikutnya.
  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": type,
      "Cache-Control": "public, max-age=604800, immutable",
      "Cross-Origin-Resource-Policy": "cross-origin",
    },
  });
});

http.route({ path: "/img", method: "GET", handler: imgProxy });

/**
 * Webhook Xendit: sinyal bahwa sebuah invoice sudah dibayar (atau kedaluwarsa).
 *
 * Xendit mengirim header `x-callback-token`. Token itu HARUS dicocokkan dengan
 * verification token yang disimpan developer (env `XENDIT_CALLBACK_TOKEN`);
 * tanpa ini siapa pun yang tahu URL-nya bisa mengklaim pembayaran palsu.
 */
const xenditCallback = httpAction(async (ctx, request) => {
  const token = request.headers.get("x-callback-token") ?? "";
  const expected = (process.env.XENDIT_CALLBACK_TOKEN ?? "").trim();
  if (!expected || token !== expected) {
    return new Response(JSON.stringify({ error: "token tidak valid" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  let body: any = null;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "body bukan JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const externalId = String(body?.external_id ?? "");
  const status = String(body?.status ?? "").toUpperCase();
  if (!externalId) {
    return new Response(JSON.stringify({ error: "external_id kosong" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (status !== "PAID" && status !== "SETTLED") {
    // EXPIRED / belum dibayar: bukan error, webhook berhasil diterima.
    return new Response(JSON.stringify({ ok: true, ignored: status }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  try {
    await ctx.runMutation(internal.xendit.webhookPaid, {
      externalId,
      xenditInvoiceId: body?.id ? String(body.id) : undefined,
      paidAmount: typeof body?.paid_amount === "number" ? body.paid_amount : undefined,
      paymentMethod: body?.payment_method ? String(body.payment_method) : undefined,
      paymentChannel: body?.payment_channel ? String(body.payment_channel) : undefined,
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "gagal" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

http.route({ path: "/xendit/callback", method: "POST", handler: xenditCallback });

export default http;
