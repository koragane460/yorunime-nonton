"use node";
/**
 * YoruNime — semua yang menyentuh `process.env` Midtrans HARUS ada di file
 * ber-dokumen `"use node"` (env var hanya tersedia di Node runtime). File
 * `payments.ts` tetap tanpa "use node" supaya bisa exporting query/mutation,
 * dan memanggil file ini lewat `internal.paymentsNode.*`.
 */
import { v } from "convex/values";
import { internalAction } from "./_generated/server";

const KEY_HELP =
  "MIDTRANS_SERVER_KEY harus berisi Server Key Midtrans (SB-Mid-server-... untuk sandbox atau Mid-server-... untuk production), bukan Client Key. Buka midtrans.com > Settings > Access Keys > kolom Server Key.";

export type KeyInfo = { key: string; isProd: boolean } | { error: string };

function readServerKey(): KeyInfo {
  const key = (process.env.MIDTRANS_SERVER_KEY ?? "").trim();
  if (!key) return { error: "MIDTRANS_SERVER_KEY belum diisi di tab Keys." };
  if (!/server/i.test(key)) return { error: KEY_HELP };
  // Awalan SB- = sandbox; key production tidak punya awalan tersebut.
  const manual = process.env.MIDTRANS_IS_PRODUCTION;
  const isProd =
    manual === undefined || manual === ""
      ? !/^SB-/i.test(key)
      : manual !== "false" && manual !== "0";
  return { key, isProd };
}

function basicAuth(key: string) {
  return `Basic ${Buffer.from(`${key}:`).toString("base64")}`;
}

function baseUrl(isProd: boolean) {
  return isProd
    ? {
        snap: "https://app.midtrans.com/snap/v1/transactions",
        api: "https://api.midtrans.com",
      }
    : {
        snap: "https://app.sandbox.midtrans.com/snap/v1/transactions",
        api: "https://api.sandbox.midtrans.com",
      };
}

/** Status konfigurasi (dipakai kartu "Cara Pembelian"). */
export const paymentConfig = internalAction({
  args: {},
  handler: async (): Promise<{
    configured: boolean;
    isProd: boolean;
    mode?: string;
    masked?: string;
    message: string;
  }> => {
    const info = readServerKey();
    if ("error" in info) {
      return { configured: false, isProd: false, message: info.error };
    }
    return {
      configured: true,
      isProd: info.isProd,
      mode: info.isProd ? "Production" : "Sandbox",
      masked: `${info.key.slice(0, 9)}…${info.key.slice(-4)}`,
      message: "",
    };
  },
});

/** Buat transaksi Snap. Price dalam Rupiah penuh (7000 = Rp7.000). */
export const createTransaction = internalAction({
  args: {
    orderId: v.string(),
    amount: v.number(),
    itemId: v.string(),
    itemName: v.string(),
    userId: v.string(),
  },
  handler: async (_ctx, { orderId, amount, itemId, itemName, userId }) => {
    const info = readServerKey();
    if ("error" in info) return { ok: false as const, message: info.error };
    const site = (process.env.CONVEX_SITE_URL ?? "").replace(/\/$/, "");
    const res = await fetch(baseUrl(info.isProd).snap, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: basicAuth(info.key),
      },
      body: JSON.stringify({
        transaction_details: { order_id: orderId, gross_amount: amount },
        item_details: [{ id: itemId, price: amount, quantity: 1, name: itemName }],
        customer_details: { user_id: userId, first_name: "YoruNime User" },
        callbacks: { finish: `${site}/premium` },
      }),
    });
    const body = await res.text();
    if (!res.ok) {
      // 401/403 biasanya artinya: key bukan Server Key, atau akun belum
      // disetujui untuk production. Tampilkan jawaban Midtrans apa adanya
      // supaya penyebabnya jelas, bukan tebakan.
      if (res.status === 401 || res.status === 403) {
        return {
          ok: false as const,
          message: `${KEY_HELP} (Midtrans menjawab 401: ${body
            .replace(/<[^>]*>/g, " ")
            .replace(/\s+/g, " ")
            .slice(0, 180)})`,
        };
      }
      return {
        ok: false as const,
        message: `Midtrans menolak transaksi (${res.status}). ${body.slice(0, 200)}`,
      };
    }
    let data: { token?: string; redirect_url?: string };
    try {
      data = JSON.parse(body);
    } catch {
      return { ok: false as const, message: "Respons Midtrans tidak bisa dibaca." };
    }
    if (!data.token && !data.redirect_url) {
      return { ok: false as const, message: "Midtrans tidak mengembalikan token." };
    }
    return {
      ok: true as const,
      token: data.token ?? null,
      redirectUrl: data.redirect_url ?? null,
    };
  },
});

/** Status order langsung dari Midtrans (dipakai polling setelah redirect). */
export const orderStatus = internalAction({
  args: { orderId: v.string() },
  handler: async (_ctx, { orderId }) => {
    const info = readServerKey();
    if ("error" in info) return { status: "unconfigured" as const };
    try {
      const res = await fetch(`${baseUrl(info.isProd).api}/v2/${orderId}/status`, {
        headers: { Accept: "application/json", Authorization: basicAuth(info.key) },
      });
      if (!res.ok) return { status: "unknown" as const };
      const data = (await res.json()) as { transaction_status?: string };
      return { status: data.transaction_status ?? "unknown" };
    } catch {
      return { status: "unknown" as const };
    }
  },
});
