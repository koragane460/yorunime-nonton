import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query, action, internalMutation } from "./_generated/server";
import { api } from "./_generated/api";
import { addXpInternal } from "./leaderboard";

// Give premium cost table (days -> cost in premium-days)
export const GIVE_COST: Record<number, number> = {
  1: 2,
  3: 4,
  5: 6,
  7: 9,
  15: 17,
  20: 23,
  25: 30, // UI shows 25 too
  30: 32,
};
export const RECEIVER_SURCHARGE: Record<number, number> = {
  5: 1,
  15: 1,
  20: 3,
  30: 4,
};
// XP for giver per spec (5 orang = 200 base)
export const GIVE_XP: Record<number, number> = {
  1: 250,
  3: 550,
  5: 700,
  7: 1000,
  15: 2100,
  20: 4000,
  25: 5500,
  30: 6900,
};

export function giveCost(days: number, receivers: number) {
  const base = GIVE_COST[days] ?? days + 1;
  const surcharge =
    receivers === 5 ? 1 : receivers === 15 ? 1 : receivers === 20 ? 3 : receivers === 30 ? 4 : Math.max(0, Math.ceil((receivers - 5) / 7));
  return base + surcharge;
}

export function giveXpFor(days: number, receivers: number) {
  const base = GIVE_XP[days] ?? days * 200;
  return base + Math.max(0, receivers - 5) * 100;
}

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

export const givePremium = mutation({
  args: {
    kind: v.string(), // global | clan | dm
    clanId: v.optional(v.id("clans")),
    dmKey: v.optional(v.string()),
    days: v.number(),
    receivers: v.number(),
    message: v.optional(v.string()),
  },
  handler: async (ctx, { kind, clanId, dmKey, days, receivers, message }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    if (!GIVE_COST[days]) throw new Error("Pilih jumlah hari yang valid");
    if (receivers < 5 || receivers > 30) throw new Error("Penerima harus 5-30 orang");
    if (message !== undefined && message.length > 0 && message.trim().length < 50)
      throw new Error("Pesan minimal 50 karakter (atau kosongkan)");
    const me = await ctx.db.get(userId);
    if (!me) throw new Error("User not found");
    const remainingDays = Math.max(0, Math.floor(((me.premiumUntil ?? 0) - Date.now()) / 86400000));
    const cost = giveCost(days, receivers);
    if (remainingDays < cost)
      throw new Error(`Premium kamu kurang ${cost - remainingDays} hari untuk give ini`);
    const newUntil = (me.premiumUntil ?? 0) - cost * 86400000;
    await ctx.db.patch(userId, { premiumUntil: newUntil });

    const giveId = await ctx.db.insert("premiumGives", {
      fromUserId: userId,
      days,
      cost,
      slots: receivers,
      message: message && message.trim().length >= 50 ? message : undefined,
      claimedBy: [],
      claimedAt: 0,
      expired: false,
      createdAt: Date.now(),
    });
    const messageId = await ctx.db.insert("chatMessages", {
      kind,
      clanId,
      dmKey,
      userId,
      premiumGiveId: giveId,
      createdAt: Date.now(),
    });
    await ctx.db.patch(giveId, { chatMessageId: messageId });

    // XP for giver
    const xp = giveXpFor(days, receivers);
    await ctx.runMutation(api.leaderboard.recordXp, { amount: xp, source: "give_premium" });
    return { messageId, giveId };
  },
});

export const claimPremium = mutation({
  args: { giveId: v.id("premiumGives") },
  handler: async (ctx, { giveId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const give = await ctx.db.get(giveId);
    if (!give) throw new Error("Premium tidak ditemukan");
    if (give.expired || give.claimedBy.length >= give.slots)
      throw new Error("Slot claim sudah habis");
    if (give.claimedBy.some((c) => c === userId))
      throw new Error("Kamu sudah claim");
    const me = await ctx.db.get(userId);
    if (!me) throw new Error("User not found");
    const base = Math.max(Date.now(), me.premiumUntil ?? 0);
    await ctx.db.patch(userId, {
      premiumUntil: base + give.days * 86400000,
    });
    const claimedBy = [...give.claimedBy, userId];
    await ctx.db.patch(giveId, {
      claimedBy,
      expired: claimedBy.length >= give.slots,
    });
    return { claimed: claimedBy.length, slots: give.slots };
  },
});

// ---------- Diamond shop ----------
export const diamondShopItems = query({
  args: {},
  handler: async () => [
    { id: "d1", label: "1 Hari Premium", days: 1, cost: 100 },
    { id: "d7", label: "7 Hari Premium", days: 7, cost: 900 },
    { id: "d20", label: "20 Hari Premium", days: 20, cost: 4000 },
    { id: "d35", label: "35 Hari Premium", days: 35, cost: 9000 },
  ],
});

export const buyWithDiamonds = mutation({
  args: { itemId: v.string() },
  handler: async (ctx, { itemId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const items: Record<string, { days: number; cost: number }> = {
      d1: { days: 1, cost: 100 },
      d7: { days: 7, cost: 900 },
      d20: { days: 20, cost: 4000 },
      d35: { days: 35, cost: 9000 },
    };
    const item = items[itemId];
    if (!item) throw new Error("Item tidak ditemukan");
    const me = await ctx.db.get(userId);
    if (!me) throw new Error("User not found");
    if ((me.diamonds ?? 0) < item.cost) throw new Error("Diamond tidak cukup");
    const base = Math.max(Date.now(), me.premiumUntil ?? 0);
    await ctx.db.patch(userId, {
      diamonds: (me.diamonds ?? 0) - item.cost,
      premiumUntil: base + item.days * 86400000,
    });
    return { ok: true };
  },
});

// ---------- Real payment (Midtrans Snap: DANA / QRIS / GoPay / VA) ----------
export const createPremiumPurchase = action({
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
    if (!plan) throw new Error("Paket tidak ditemukan");
    const orderId = `LSTREAM-${userId.slice(0, 8)}-${Date.now()}`;
    await ctx.runMutation(api.premium.insertPurchase, {
      userId,
      planId,
      planLabel: plan.label,
      days: plan.days,
      priceIdr: plan.price,
      orderId,
    });

    const serverKey = process.env.MIDTRANS_SERVER_KEY;
    if (!serverKey) {
      // No gateway configured yet: purchase stays pending, user sees clear info.
      return {
        configured: false as const,
        orderId,
        message:
          "Payment gateway (Midtrans) belum dikonfigurasi. Tambahkan MIDTRANS_SERVER_KEY di tab Keys untuk mengaktifkan pembayaran DANA/QRIS.",
      };
    }
    const auth = Buffer.from(`${serverKey}:`).toString("base64");
    const isProd = !!process.env.MIDTRANS_IS_PRODUCTION;
    const url = isProd
      ? "https://app.midtrans.com/snap/v1/transactions"
      : "https://app.sandbox.midtrans.com/snap/v1/transactions";
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        transaction_details: {
          order_id: orderId,
          gross_amount: plan.price,
        },
        item_details: [
          {
            id: planId,
            price: plan.price,
            quantity: 1,
            name: `LStream Premium ${plan.label}`,
          },
        ],
        customer_details: { user_id: userId },
      }),
    });
    if (!res.ok) throw new Error(`Midtrans error: ${res.status}`);
    const data = (await res.json()) as { token?: string; redirect_url?: string };
    if (!data.token && !data.redirect_url)
      throw new Error("Midtrans tidak mengembalikan token");
    await ctx.runMutation(api.premium.setPaymentUrl, { orderId, paymentUrl: data.redirect_url });
    return {
      configured: true as const,
      orderId,
      token: data.token,
      redirectUrl: data.redirect_url,
      // Snap popup can be opened client-side with data.token via snap.js
    };
  },
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
      .filter((q) => q.eq(q.field("orderId"), orderId))
      .first();
    if (row && paymentUrl) await ctx.db.patch(row._id, { paymentUrl });
  },
});

/** Confirm a payment (called by client after Snap returns success, or manually by dev). */
export const confirmPurchase = mutation({
  args: { orderId: v.string() },
  handler: async (ctx, { orderId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const row = await ctx.db
      .query("premiumPurchases")
      .filter((q) => q.eq(q.field("orderId"), orderId))
      .first();
    if (!row) throw new Error("Order tidak ditemukan");
    if (row.userId !== userId) throw new Error("Bukan order kamu");
    if (row.status === "paid") return { alreadyPaid: true };
    await ctx.db.patch(row._id, { status: "paid" });
    const me = await ctx.db.get(userId);
    if (me) {
      const base = Math.max(Date.now(), me.premiumUntil ?? 0);
      await ctx.db.patch(userId, {
        premiumUntil: base + row.days * 86400000,
      });
    }
    return { alreadyPaid: false };
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
      .take(20);
  },
});

// ---------- Click game ----------
export const clickGameDay = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return { clicks: 0, diamonds: 0 };
    const day = new Date().toISOString().slice(0, 10);
    const row = await ctx.db
      .query("clickGame")
      .withIndex("userId_day", (q) => q.eq("userId", userId).eq("day", day))
      .first();
    return { clicks: row?.clicks ?? 0, diamonds: row?.diamondsEarned ?? 0 };
  },
});

export const clickGameClick = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const day = new Date().toISOString().slice(0, 10);
    const row = await ctx.db
      .query("clickGame")
      .withIndex("userId_day", (q) => q.eq("userId", userId).eq("day", day))
      .first();
    let clicks = 1;
    if (row) {
      clicks = row.clicks + 1;
      await ctx.db.patch(row._id, { clicks });
    } else {
      await ctx.db.insert("clickGame", { userId, day, clicks, diamondsEarned: 0 });
    }
    // Convert every 5 clicks into 1 diamond (batch when crossing multiples)
    const before = Math.floor((clicks - 1) / 5);
    const after = Math.floor(clicks / 5);
    if (after > before) {
      const me = await ctx.db.get(userId);
      if (me) {
        await ctx.db.patch(userId, { diamonds: (me.diamonds ?? 0) + 1 });
        if (row) await ctx.db.patch(row._id, { diamondsEarned: row.diamondsEarned + 1 });
      }
    }
    return { clicks, diamondsTotal: Math.floor(clicks / 5) };
  },
});
