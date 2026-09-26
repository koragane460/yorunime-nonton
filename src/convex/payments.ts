// LStream — pembelian premium (Vly payments; fallback free-checkout saat gateway belum ada).
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { action, internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";

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

export const recordPurchase = internalMutation({
  args: {
    userId: v.id("users"),
    planId: v.string(),
    planLabel: v.string(),
    days: v.number(),
    priceIdr: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("premiumPurchases", {
      ...args,
      status: "pending",
      orderId: `${args.userId.slice(0, 6)}-${Date.now()}`,
      createdAt: Date.now(),
    });
  },
});

export const markPaidInternal = internalMutation({
  args: { userId: v.id("users"), days: v.number() },
  handler: async (ctx, { userId, days }) => {
    const me = await ctx.db.get(userId);
    if (!me) throw new Error("User not found");
    const base = Math.max(Date.now(), me.premiumUntil ?? 0);
    await ctx.db.patch(userId, { premiumUntil: base + days * 86400000 });
    return { ok: true };
  },
});

export const buyPlan = action({
  args: { planId: v.string() },
  handler: async (ctx, { planId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const plans: Record<string, { label: string; days: number; price: number }> = {
      p1: { label: "1 Bulan", days: 30, price: 7000 },
      p2: { label: "3 Bulan", days: 90, price: 30000 },
      p3: { label: "1 Tahun", days: 365, price: 120000 },
      p4: { label: "3 Tahun", days: 1095, price: 150000 },
      p5: { label: "7 Tahun", days: 2555, price: 200000 },
    };
    const plan = plans[planId];
    if (!plan) throw new Error("Paket tidak ada");
    await ctx.runMutation(internal.payments.recordPurchase, {
      userId,
      planId,
      planLabel: plan.label,
      days: plan.days,
      priceIdr: plan.price,
    });
    try {
      const { vly } = await import("../lib/vly-integrations");
      const mod = vly as unknown as Record<string, any>;
      const pay = mod.payments ?? mod.payment ?? mod.checkout;
      if (pay?.createPaymentIntent) {
        const intent = await pay.createPaymentIntent({
          amount: plan.price, // IDR, tanpa desimal
          currency: "idr",
          description: `LStream Premium ${plan.label}`,
        });
        const url =
          (intent as any)?.data?.checkout_url ??
          (intent as any)?.data?.url ??
          (intent as any)?.url;
        if (intent?.success && url) {
          return { ok: true as const, url: url as string, days: plan.days };
        }
      }
    } catch {
      /* gateway belum aktif */
    }
    // Gateway belum dikonfigurasi: aktifkan trial 1 hari agar alur bisa dicoba.
    await ctx.runMutation(internal.payments.markPaidInternal, {
      userId,
      days: 1,
    });
    return {
      ok: true as const,
      url: null as string | null,
      days: plan.days,
      note: "Payment gateway belum terpasang — trial 1 hari diaktifkan otomatis.",
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
