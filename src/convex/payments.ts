// YoruNime — pembelian premium via Midtrans Snap (DANA / QRIS / GoPay / VA).
//
// CATATAN: file ini sengaja TIDAK memakai "use node" supaya bisa exporting
// query & mutation. Semua pembacaan env var dan semua panggilan HTTP ke
// Midtrans dilakukan di `paymentsNode.ts` (Node runtime).
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { staffGuard } from "./moderation";

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
    const r = (await ctx.runAction(internal.paymentsNode.paymentConfig, {})) as {
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

    const res = (await ctx.runAction(internal.paymentsNode.createTransaction, {
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
    const r = (await ctx.runAction(internal.paymentsNode.orderStatus, {
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

// ================================================== mode manual (QRIS) ====
// Payment gateway (Midtrans) butuh NPWP/KTP merchant. Untuk developer kecil
// cukup QRIS statis: user bayar sendiri ke rekening, bukti dikirim, lalu bot AI
// (atau developer) menyetujuinya dari panel dev.

/** Fungsi bersama: tandai lunas + kirim premium + notifikasi. */
async function grantPremium(
  ctx: any,
  { orderId }: { orderId: string },
): Promise<{ alreadyPaid: boolean }> {
  const row = await ctx.db
    .query("premiumPurchases")
    .withIndex("orderId", (q: any) => q.eq("orderId", orderId))
    .first();
  if (!row) throw new Error("Order tidak ada");
  if (row.status === "paid") return { alreadyPaid: true };
  await ctx.db.patch(row._id, { status: "paid" });
  const me = await ctx.db.get(row.userId);
  if (me) {
    const base = Math.max(Date.now(), me.premiumUntil ?? 0);
    await ctx.db.patch(row.userId, { premiumUntil: base + row.days * 86400000 });
    await ctx.db.insert("notifications", {
      userId: row.userId,
      type: "premium",
      title: "Premium aktif",
      body: `Pembayaran ${row.planLabel} sudah dikonfirmasi. Terima kasih!`,
      createdAt: Date.now(),
    });
  }
  return { alreadyPaid: false };
}

/** Pengaturan QRIS statis (dibaca semua user). */
export const manualConfig = query({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db.query("paymentSettings").first();
    return {
      qrUrl: row?.qrUrl ?? "",
      accountName: row?.accountName ?? "",
      accountLabel: row?.accountLabel ?? "",
      note: row?.note ?? "",
      contact: row?.contact ?? "",
      autoApprove: row?.autoApprove === true,
      autoApproveMax: row?.autoApproveMax ?? 0,
      ready: !!row?.qrUrl,
    };
  },
});

/** Developer menyimpan/mengubah pengaturan QRIS statis. */
export const saveManualConfig = mutation({
  args: {
    qrUrl: v.optional(v.string()),
    accountName: v.optional(v.string()),
    accountLabel: v.optional(v.string()),
    note: v.optional(v.string()),
    contact: v.optional(v.string()),
    autoApprove: v.optional(v.boolean()),
    autoApproveMax: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await staffGuard(ctx, "dev");
    const row = await ctx.db.query("paymentSettings").first();
    const clean = {
      qrUrl: args.qrUrl?.trim() || undefined,
      accountName: args.accountName?.trim() || undefined,
      accountLabel: args.accountLabel?.trim() || undefined,
      note: args.note?.trim() || undefined,
      contact: args.contact?.trim() || undefined,
      autoApprove: args.autoApprove ?? row?.autoApprove ?? false,
      autoApproveMax: args.autoApproveMax ?? row?.autoApproveMax ?? undefined,
      updatedAt: Date.now(),
    };
    if (row) await ctx.db.patch(row._id, clean);
    else await ctx.db.insert("paymentSettings", clean);
    return { ok: true };
  },
});

/** Buat order manual; user akan bayar lewat QRIS statis. */
export const createManualOrder = mutation({
  args: {
    planId: v.string(),
    proofUrl: v.optional(v.string()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { planId, proofUrl, note }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const plan = PLANS[planId];
    if (!plan) throw new Error("Paket tidak ada");
    const row = await ctx.db.query("paymentSettings").first();
    if (!row?.qrUrl) throw new Error("QRIS belum diatur. Hubungi developer.");
    const orderId = `QRIS-${userId.slice(0, 6)}-${Date.now().toString(36).toUpperCase()}`;
    await ctx.db.insert("premiumPurchases", {
      userId,
      planId,
      planLabel: plan.label,
      days: plan.days,
      priceIdr: plan.price,
      orderId,
      status: "manual_pending",
      method: "qris",
      ...(proofUrl ? { proofUrl } : {}),
      ...(note ? { note: note.slice(0, 200) } : {}),
      createdAt: Date.now(),
    });
    // Auto-setuju: kalau developer menyalakan, order langsung lunas.
    const autoMax = row.autoApproveMax ?? 0;
    if (row.autoApprove === true && plan.price <= (autoMax > 0 ? autoMax : Infinity)) {
      await grantPremium(ctx, { orderId });
      return {
        orderId,
        priceIdr: plan.price,
        days: plan.days,
        planLabel: plan.label,
        autoApproved: true,
      };
    }
    return {
      orderId,
      priceIdr: plan.price,
      days: plan.days,
      planLabel: plan.label,
      autoApproved: false,
    };
  },
});

/** Order manual milik user sendiri. */
export const myManualOrders = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const rows = await ctx.db
      .query("premiumPurchases")
      .withIndex("userId_created", (q) => q.eq("userId", userId))
      .order("desc")
      .take(10);
    return rows.filter((r) => r.method === "qris");
  },
});

/** Daftar order manual yang menunggu persetujuan developer. */
export const pendingManualOrders = query({
  args: {},
  handler: async (ctx) => {
    await staffGuard(ctx, "dev");
    const rows = await ctx.db
      .query("premiumPurchases")
      .withIndex("status_created", (q) => q.eq("status", "manual_pending"))
      .order("desc")
      .take(30);
    const out = [];
    for (const r of rows) {
      const u = await ctx.db.get(r.userId);
      out.push({
        _id: r._id,
        orderId: r.orderId,
        planLabel: r.planLabel,
        days: r.days,
        priceIdr: r.priceIdr,
        note: r.note,
        analysisNote: r.analysisNote,
        createdAt: r.createdAt,
        username: u?.username ?? "user",
        image: u?.image,
        uidCode: u?.uidCode,
      });
    }
    return out;
  },
});

/** Developer menyetujui pembayaran manual → premium langsung cair. */
export const approveManualOrder = mutation({
  args: { orderId: v.string() },
  handler: async (ctx, { orderId }) => {
    await staffGuard(ctx, "dev");
    return await grantPremium(ctx, { orderId });
  },
});

// ============================ alur UID + bukti + bot AI ===================

/** Cek apakah UID yang diketik milik akun yang sedang login. */
export const verifyUid = query({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const me = await ctx.db.get(userId);
    if (!me) throw new Error("User not found");
    const clean = code.trim().toUpperCase();
    if (!/^[A-Z0-9]{7}$/.test(clean)) {
      return { ok: false, reason: "Format UID harus 7 huruf/angka." };
    }
    if (me.uidCode && clean === me.uidCode) {
      return { ok: true, mine: true, username: me.username ?? "kamu" };
    }
    const owner = await ctx.db
      .query("users")
      .withIndex("uidCode", (q) => q.eq("uidCode", clean))
      .first();
    if (!owner) return { ok: false, reason: "UID tidak ditemukan." };
    return {
      ok: false,
      mine: false,
      reason: "UID itu milik akun lain. Verifikasi harus memakai UID sendiri.",
    };
  },
});

/** Order milik user (untuk melacak status setelah bot analyzing). */
export const myOrder = query({
  args: { orderId: v.string() },
  handler: async (ctx, { orderId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const row = await ctx.db
      .query("premiumPurchases")
      .withIndex("orderId", (q) => q.eq("orderId", orderId))
      .first();
    if (!row || row.userId !== userId) throw new Error("Order tidak ditemukan");
    return {
      orderId: row.orderId,
      status: row.status,
      planLabel: row.planLabel,
      priceIdr: row.priceIdr,
      days: row.days,
      analysisNote: row.analysisNote ?? "",
      analyzedBy: row.analyzedBy ?? "",
      createdAt: row.createdAt,
    };
  },
});

/** Kirim bukti transfer (UID harus milik sendiri); bukti hanya bisa dipakai 1x. */
export const submitProofPurchase = mutation({
  args: {
    uidCode: v.string(),
    planId: v.string(),
    proofStorageId: v.optional(v.string()),
    proofText: v.optional(v.string()),
    proofHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const me = await ctx.db.get(userId);
    if (!me) throw new Error("User not found");
    const clean = args.uidCode.trim().toUpperCase();
    if (!me.uidCode || clean !== me.uidCode) {
      throw new Error("UID tidak cocok dengan akun kamu");
    }
    const plan = PLANS[args.planId];
    if (!plan) throw new Error("Paket tidak ada");
    const cfg = await ctx.db.query("paymentSettings").first();
    if (!cfg?.qrUrl) throw new Error("QRIS belum diatur oleh developer");

    // Bukti transfer hanya boleh dipakai satu kali (anti pakai bukti orang lain).
    if (args.proofHash) {
      const used = await ctx.db
        .query("premiumPurchases")
        .withIndex("proofHash", (q) => q.eq("proofHash", args.proofHash!))
        .first();
      if (used) throw new Error("Bukti transfer ini sudah pernah dipakai");
    }

    const orderId = `YN-${Date.now().toString(36).toUpperCase()}`;
    await ctx.db.insert("premiumPurchases", {
      userId,
      planId: args.planId,
      planLabel: plan.label,
      days: plan.days,
      priceIdr: plan.price,
      orderId,
      status: "manual_review",
      method: "qris",
      uidCode: clean,
      ...(args.proofStorageId ? { proofUrl: args.proofStorageId } : {}),
      ...(args.proofText ? { proofText: args.proofText.slice(0, 300) } : {}),
      ...(args.proofHash ? { proofHash: args.proofHash } : {}),
      createdAt: Date.now(),
    });
    return { orderId, priceIdr: plan.price, days: plan.days, planLabel: plan.label };
  },
});

/** Baris order untuk dipakai action/internal. */
export const getOrderRow = internalQuery({
  args: { orderId: v.string() },
  handler: async (ctx, { orderId }) => {
    return await ctx.db
      .query("premiumPurchases")
      .withIndex("orderId", (q) => q.eq("orderId", orderId))
      .first();
  },
});

/** Terapkan hasil bot: verified → premium cair; rejected → order ditolak. */
export const applyVerdict = internalMutation({
  args: { orderId: v.string(), verdict: v.string(), note: v.string() },
  handler: async (ctx, { orderId, verdict, note }) => {
    const row = await ctx.db
      .query("premiumPurchases")
      .withIndex("orderId", (q) => q.eq("orderId", orderId))
      .first();
    if (!row || row.status === "paid") return;
    const clean = note.slice(0, 300);
    if (verdict === "verified") {
      await ctx.db.patch(row._id, {
        analysisNote: clean,
        analyzedBy: "ai",
      });
      await grantPremium(ctx, { orderId });
      return;
    }
    await ctx.db.patch(row._id, {
      status: verdict === "rejected" ? "rejected" : "manual_review",
      analysisNote: clean,
      analyzedBy: verdict === "rejected" ? "ai" : "none",
    });
  },
});

/**
 * Action: bot AI memeriksa bukti transfer (gambar + catatan) lalu menerapkan
 * hasil:确有 transfer → premium otomatis masuk. Kalau AI belum dikonfigurasi,
 * order menunggu verifikasi developer.
 */
export const analyzeProof = action({
  args: { orderId: v.string() },
  handler: async (
    ctx,
    { orderId },
  ): Promise<{ verdict: "verified" | "rejected" | "manual"; note: string }> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const row = (await ctx.runQuery(internal.payments.getOrderRow, {
      orderId,
    })) as null | {
      userId: string;
      priceIdr: number;
      planLabel: string;
      uidCode?: string;
      proofUrl?: string;
      proofText?: string;
      analysisNote?: string;
      status: string;
    };
    if (!row || row.userId !== userId) throw new Error("Order tidak ditemukan");
    if (row.status === "paid") return { verdict: "verified", note: "Sudah lunas." };
    if (row.status === "rejected")
      return { verdict: "rejected", note: row.analysisNote ?? "Bukti ditolak." };

    let imageUrl: string | null = null;
    if (row.proofUrl) {
      imageUrl = row.proofUrl.startsWith("http")
        ? row.proofUrl
        : ((await ctx.runQuery(internal.storage.getUrlInternal, {
            storageId: row.proofUrl,
          })) as string | null);
    }

    const cfg = (await ctx.runQuery(internal.payments.getSettingsRow, {})) as null | {
      accountName?: string;
    };
    const r = (await ctx.runAction(internal.aiNode.analyzeProof, {
      imageUrl,
      proofText: row.proofText ?? "",
      expectedAmount: row.priceIdr,
      planLabel: row.planLabel,
      uidCode: row.uidCode ?? "",
      accountName: cfg?.accountName ?? "",
    })) as { verdict: "verified" | "rejected" | "manual"; note: string };

    await ctx.runMutation(internal.payments.applyVerdict, {
      orderId,
      verdict: r.verdict,
      note: r.note,
    });
    return r;
  },
});

/** Baris pengaturan pembayaran untuk action/internal. */
export const getSettingsRow = internalQuery({
  args: {},
  handler: async (ctx) => await ctx.db.query("paymentSettings").first(),
});

// ------------------------------------------------------------ dev tools ----

/** Simulasi (dev only): buat order manual atas nama user tertentu. */
export const devSimulatePurchase = mutation({
  args: { targetId: v.id("users"), planId: v.optional(v.string()) },
  handler: async (ctx, { targetId, planId }) => {
    await staffGuard(ctx, "dev");
    const planKey = planId ?? "p1";
    const plan = PLANS[planKey];
    if (!plan) throw new Error("Paket tidak ada");
    const orderId = `SIM-${targetId.slice(0, 6)}-${Date.now().toString(36).toUpperCase()}`;
    await ctx.db.insert("premiumPurchases", {
      userId: targetId,
      planId: planKey,
      planLabel: `${plan.label} (simulasi)`,
      days: plan.days,
      priceIdr: plan.price,
      orderId,
      status: "manual_pending",
      method: "simulasi",
      note: "Dibuat dari panel dev",
      createdAt: Date.now(),
    });
    return { orderId };
  },
});

/** Bantu untuk action dev: buat order simulasi. */
export const insertSimOrder = internalMutation({
  args: {
    targetId: v.id("users"),
    planId: v.string(),
    proofText: v.optional(v.string()),
  },
  handler: async (ctx, { targetId, planId, proofText }) => {
    const plan = PLANS[planId];
    if (!plan) throw new Error("Paket tidak ada");
    const orderId = `SIM-${Date.now().toString(36).toUpperCase()}`;
    await ctx.db.insert("premiumPurchases", {
      userId: targetId,
      planId,
      planLabel: `${plan.label} (simulasi)`,
      days: plan.days,
      priceIdr: plan.price,
      orderId,
      status: "manual_review",
      method: "simulasi",
      analysisNote: "Order simulasi dari panel dev",
      ...(proofText ? { proofText: proofText.slice(0, 300) } : {}),
      createdAt: Date.now(),
    });
    return { orderId, priceIdr: plan.price };
  },
});

/**
 * Dev only: simulasi pembelian lengkap — order dibuat lalu langsung dianalisis
 * bot AI, persis seperti alur user (bukti -> analisis -> premium otomatis).
 */
export const devSimulateWithBot = action({
  args: {
    targetId: v.id("users"),
    planId: v.optional(v.string()),
    proofText: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { targetId, planId, proofText },
  ): Promise<{ orderId: string; verdict: string; note: string }> => {
    await staffGuard(ctx, "dev");
    const planKey = planId ?? "p1";
    const plan = PLANS[planKey];
    if (!plan) throw new Error("Paket tidak ada");
    const { orderId } = await ctx.runMutation(internal.payments.insertSimOrder, {
      targetId,
      planId: planKey,
      proofText: proofText || `Transfer Rp ${plan.price} via QRIS`,
    });
    const r = (await ctx.runAction(internal.aiNode.analyzeProof, {
      imageUrl: null,
      proofText: proofText || `Transfer Rp ${plan.price} via QRIS`,
      expectedAmount: plan.price,
      planLabel: `${plan.label} (simulasi)`,
      uidCode: "",
      accountName: "",
    })) as { verdict: "verified" | "rejected" | "manual"; note: string };
    await ctx.runMutation(internal.payments.applyVerdict, {
      orderId,
      verdict: r.verdict,
      note: r.note,
    });
    return { orderId, verdict: r.verdict, note: r.note };
  },
});

/** Dev only: tes apakah bot AI (Gemini) sudah aktif, tanpa bikin order. */
export const devTestBot = action({
  args: {
    expectedAmount: v.optional(v.number()),
    proofText: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { expectedAmount, proofText, imageUrl },
  ): Promise<{ verdict: string; note: string; engine: string }> => {
    await staffGuard(ctx, "dev");
    const r = (await ctx.runAction(internal.aiNode.analyzeProof, {
      imageUrl: imageUrl ?? null,
      proofText:
        proofText ?? `Transfer Rp ${expectedAmount ?? 7000} via QRIS atas nama Rii`,
      expectedAmount: expectedAmount ?? 7000,
      planLabel: "1 Bulan",
      uidCode: "",
      accountName: "",
    })) as { verdict: string; note: string; engine: string };
    return r;
  },
});

/** Dev only: cairkan premium langsung tanpa order (untuk testing). */
export const devGrantPremium = mutation({
  args: { targetId: v.id("users"), days: v.number() },
  handler: async (ctx, { targetId, days }) => {
    await staffGuard(ctx, "dev");
    if (days <= 0 || days > 3650) throw new Error("Jumlah hari tidak valid");
    const u = await ctx.db.get(targetId);
    if (!u) throw new Error("User tidak ada");
    const base = Math.max(Date.now(), u.premiumUntil ?? 0);
    await ctx.db.patch(targetId, { premiumUntil: base + days * 86400000 });
    await ctx.db.insert("notifications", {
      userId: targetId,
      type: "premium",
      title: "Premium diberikan",
      body: `Developer memberi ${days} hari premium.`,
      createdAt: Date.now(),
    });
    return { premiumUntil: base + days * 86400000 };
  },
});