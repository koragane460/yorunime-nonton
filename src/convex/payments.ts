// YoruNime — pembelian premium via Midtrans Snap (DANA / QRIS / GoPay / VA).
//
// CATATAN: file ini sengaja TIDAK memakai "use node" supaya bisa exporting
// query & mutation. Semua pembacaan env var dan semua panggilan HTTP ke
// Midtrans dilakukan di `paymentsNode.ts` (Node runtime).
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
// Action Node diimpor langsung (bukan lewat `internal.*`) supaya file ini tidak
// bergantung pada codegen modul baru.
import {
  createTransaction as nodeCreateTransaction,
  orderStatus as nodeOrderStatus,
  paymentConfig as nodePaymentConfig,
} from "./paymentsNode";

// ------------------------------------------------------------------ data ----

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

const PLANS: Record<string, { label: string; days: number; price: number }> = {
  p1: { label: "1 Bulan", days: 30, price: 7000 },
  p2: { label: "3 Bulan", days: 90, price: 30000 },
  p3: { label: "1 Tahun", days: 365, price: 120000 },
  p4: { label: "3 Tahun", days: 1095, price: 150000 },
  p5: { label: "7 Tahun", days: 2555, price: 200000 },
};

// --------------------------------------------------------------- actions ----

type SnapResult = {
  ok: boolean;
  message?: string;
  token?: string | null;
  redirectUrl?: string | null;
};

/** Status konfigurasi Midtrans — action (butuh Node runtime untuk env). */
export const paymentConfig = action({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    configured: boolean;
    isProd: boolean;
    mode?: string;
    masked?: string;
    message: string;
  }> => {
    const r = (await ctx.runAction(nodePaymentConfig, {})) as {
      configured: boolean;
      isProd: boolean;
      mode?: string;
      masked?: string;
      message: string;
    };
    return r;
  },
});

/** Buat transaksi Midtrans Snap; return token/redirect untuk popup pembayaran. */
export const createSnapTransaction = action({
  args: { planId: v.string() },
  handler: async (
    ctx,
    { planId },
  ): Promise<
    | { configured: true; orderId: string; token: string | null; redirectUrl: string | null }
    | { configured: false; orderId: string; message: string }
  > => {
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

    const res = (await ctx.runAction(nodeCreateTransaction, {
      orderId,
      amount: plan.price,
      itemId: planId,
      itemName: `YoruNime Premium ${plan.label}`,
      userId,
    })) as SnapResult;

    if (!res.ok) {
      return {
        configured: false,
        orderId,
        message: `${res.message ?? "Gagal membuat transaksi."} Sementara ini kamu dapat trial 1 hari gratis.`,
      };
    }
    if (res.redirectUrl) {
      await ctx.runMutation(internal.payments.setPaymentUrl, {
        orderId,
        paymentUrl: res.redirectUrl,
      });
    }
    return {
      configured: true,
      orderId,
      token: res.token ?? null,
      redirectUrl: res.redirectUrl ?? null,
    };
  },
});

/** Cek status order langsung ke Midtrans (untuk polling setelah redirect). */
export const checkOrderStatus = action({
  args: { orderId: v.string() },
  handler: async (ctx, { orderId }): Promise<{ status: string }> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const row = (await ctx.runQuery(internal.payments.getOrderBy, { orderId })) as {
      userId: string;
      status: string;
    } | null;
    if (!row || row.userId !== userId) throw new Error("Order tidak ditemukan");
    const r = (await ctx.runAction(nodeOrderStatus, {
      orderId,
    })) as { status: string };
    if (r.status === "unconfigured") return { status: row.status };
    if (r.status === "settlement" || r.status === "capture") {
      await ctx.runMutation(internal.payments.markPaidInternal, { orderId });
      return { status: "paid" };
    }
    return { status: row.status };
  },
});

/** Klien konfirmasi setelah Snap sukses atau saat halaman dimuat ulang. */
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
