// YoruNime — pembelian premium via Midtrans Snap (DANA / QRIS / GoPay / VA).
// Isi MIDTRANS_SERVER_KEY di tab Keys untuk mengaktifkan pembayaran nyata.
// Tanpa key: pembelian dicatat sebagai "menunggu pembayaran" + trial 1 hari.

import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";

export const getOrderBy = internalQuery({
  args: { orderId: v.string() },
  handler: async (ctx, { orderId }) => {
    return await ctx.db
      .query("premiumPurchases")
      .withIndex("orderId", (q) => q.eq("orderId", orderId))
      .first();
  },
});

export const premiumPlans = query({
  args: {},
  handler: async () => [
    { id: "p1", label: "1 Bulan", days: 30, price: 7000 },
    { id: "p2", label: "3 Bulan", days: 90, price: 30000 },
    { id: "p3", label: "1 Tahun", days: 365, price: 120000 },
    { id: "p4", label: "3 Tahun", days: 1095, price: 150000 },
    { id: "p5", label: "7 Tahun", days: 2555, price: 200000 },
  ],
});

export const insertPurchase = internalMutation({
  args: {
    userId: v.id("users"),
    planId: v.string(),
    planLabel: v.string(),
    days: v.number(),
    priceIdr: v.number(),
    orderId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("premiumPurchases", { ...args, status: "pending", createdAt: Date.now() });
  },
});

export const setPaymentUrl = internalMutation({
  args: { orderId: v.string(), paymentUrl: v.optional(v.string()) },
  handler: async (ctx, { orderId, paymentUrl }) => {
    const row = await ctx.db
      .query("premiumPurchases")
      .withIndex("orderId", (q) => q.eq("orderId", orderId))
      .first();
    if (row && paymentUrl) await ctx.db.patch(row._id, { paymentUrl });
  },
});

export const markPaidInternal = internalMutation({
  args: { orderId: v.string() },
  handler: async (ctx, { orderId }) => {
    const row = await ctx.db
      .query("premiumPurchases")
      .withIndex("orderId", (q) => q.eq("orderId", orderId))
      .first();
    if (!row || row.status === "paid") return { alreadyPaid: true };
    await ctx.db.patch(row._id, { status: "paid" });
    const me = await ctx.db.get(row.userId);
    if (me) {
      const base = Math.max(Date.now(), me.premiumUntil ?? 0);
      await ctx.db.patch(row.userId, { premiumUntil: base + row.days * 86400000 });
    }
    return { alreadyPaid: false };
  },
});

// ------------------------------------------------------------- key config ----
// Isi tab Keys dengan MIDTRANS_SERVER_KEY. Kunci yang dibutuhkan adalah
// *Server Key* (format `SB-Mid-server-...` untuk sandbox, `Mid-server-...`
// untuk production). Kalau yang tertempel adalah Client Key
// (`...-client-...`), transaksi akan ditolak 401 — makanya error di bawah
// menjelaskan ke user daripada diam-diam gagal.
const KEY_HELP =
  "MIDTRANS_SERVER_KEY harus berisi Server Key Midtrans (SB-Mid-server-... untuk sandbox atau Mid-server-... untuk production), bukan Client Key. Buka midtrans.com > Settings > Access Keys > kolom Server Key.";

type KeyInfo = { key: string; isProd: boolean } | { error: string };

function readServerKey(): KeyInfo {
  const key = (process.env.MIDTRANS_SERVER_KEY ?? "").trim();
  if (!key) {
    return { error: "MIDTRANS_SERVER_KEY belum diisi di tab Keys." };
  }
  if (!/server/i.test(key)) {
    return { error: KEY_HELP };
  }
  // Awalan SB- = sandbox; selain itu production. Nilai manual
  // MIDTRANS_IS_PRODUCTION hanya dipakai kalau key tidak punya awalan.
  const isProd = process.env.MIDTRANS_IS_PRODUCTION
    ? !!process.env.MIDTRANS_IS_PRODUCTION && process.env.MIDTRANS_IS_PRODUCTION !== "false"
    : !/^SB-/i.test(key);
  return { key, isProd };
}

function basicAuth(key: string) {
  return `Basic ${Buffer.from(`${key}:`).toString("base64")}`;
}

/** Info konfigurasi pembayaran (ditampilkan di halaman Premium). */
export const paymentConfig = query({
  args: {},
  handler: async () => {
    const info = readServerKey();
    if ("error" in info) {
      return { configured: false, isProd: false, message: info.error };
    }
    return {
      configured: true,
      isProd: info.isProd,
      mode: info.isProd ? "Production" : "Sandbox",
      masked: `${info.key.slice(0, 8)}…${info.key.slice(-4)}`,
      message: "",
    };
  },
});

const PLANS: Record<string, { label: string; days: number; price: number }> = {
  p1: { label: "1 Bulan", days: 30, price: 7000 },
  p2: { label: "3 Bulan", days: 90, price: 30000 },
  p3: { label: "1 Tahun", days: 365, price: 120000 },
  p4: { label: "3 Tahun", days: 1095, price: 150000 },
  p5: { label: "7 Tahun", days: 2555, price: 200000 },
};

/** Buat transaksi Midtrans Snap; return token/redirect untuk popup pembayaran. */
export const createSnapTransaction = action({
  args: { planId: v.string() },
  handler: async (ctx, { planId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const plan = PLANS[planId];
    if (!plan) throw new Error("Paket tidak ada");
    const orderId = `YORUNIME-${userId.slice(0, 8)}-${Date.now()}`;
    await ctx.runMutation(internal.payments.insertPurchase, {
      userId,
      planId,
      planLabel: plan.label,
      days: plan.days,
      priceIdr: plan.price,
      orderId,
    });

    const info = readServerKey();
    if ("error" in info) {
      return {
        configured: false as const,
        orderId,
        message: `${info.error} Sementara ini kamu dapat trial 1 hari gratis.`,
      };
    }
    const { key: serverKey, isProd } = info;

    const url = isProd
      ? "https://app.midtrans.com/snap/v1/transactions"
      : "https://app.sandbox.midtrans.com/snap/v1/transactions";
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: basicAuth(serverKey),
      },
      body: JSON.stringify({
        transaction_details: { order_id: orderId, gross_amount: plan.price },
        item_details: [
          {
            id: planId,
            price: plan.price,
            quantity: 1,
            name: `YoruNime Premium ${plan.label}`,
          },
        ],
        customer_details: { user_id: userId },
        callbacks: { finish: `${process.env.CONVEX_SITE_URL ?? ""}/premium` },
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (res.status === 401) throw new Error(KEY_HELP);
      throw new Error(`Midtrans menolak transaksi (${res.status}). ${body.slice(0, 160)}`);
    }
    const data = (await res.json()) as { token?: string; redirect_url?: string };
    if (!data.token && !data.redirect_url) throw new Error("Midtrans tidak mengembalikan token");
    await ctx.runMutation(internal.payments.setPaymentUrl, {
      orderId,
      paymentUrl: data.redirect_url,
    });
    return {
      configured: true as const,
      orderId,
      token: data.token,
      redirectUrl: data.redirect_url,
    };
  },
});

/** Klien konfirmasi setelah Snap sukses (snap.js on-success) atau polling. */
export const confirmPurchase = mutation({
  args: { orderId: v.string() },
  handler: async (ctx, { orderId }): Promise<{ alreadyPaid: boolean }> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const row = (await ctx.db
      .query("premiumPurchases")
      .withIndex("orderId", (q) => q.eq("orderId", orderId))
      .first()) as { userId: string } | null;
    if (!row || row.userId !== userId) throw new Error("Order tidak ditemukan");
    return (await ctx.runMutation(internal.payments.markPaidInternal, { orderId })) as {
      alreadyPaid: boolean;
    };
  },
});

/** Cek status order langsung ke Midtrans (untuk polling setelah redirect). */
export const checkOrderStatus = action({
  args: { orderId: v.string() },
  handler: async (ctx, { orderId }): Promise<{ status: string }> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const row = (await ctx.runQuery(internal.payments.getOrderBy, { orderId })) as
      | { userId: string; status: string }
      | null;
    if (!row || row.userId !== userId) throw new Error("Order tidak ditemukan");
    const info = readServerKey();
    if ("error" in info) return { status: row.status };
    const res = await fetch(
      `${info.isProd ? "https://api.midtrans.com" : "https://api.sandbox.midtrans.com"}/v2/${orderId}/status`,
      { headers: { Accept: "application/json", Authorization: basicAuth(info.key) } },
    );
    if (!res.ok) return { status: row.status };
    const data = (await res.json()) as { transaction_status?: string };
    if (data.transaction_status === "settlement" || data.transaction_status === "capture") {
      await ctx.runMutation(internal.payments.markPaidInternal, { orderId });
      return { status: "paid" };
    }
    return { status: row.status };
  },
});

export const myPurchases = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    return await ctx.db
      .query("premiumPurchases")
      .withIndex("userId_created", (q) => q.eq("userId", userId))
      .order("desc")
      .take(10);
  },
});
