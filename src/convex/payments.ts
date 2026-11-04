/**
 * YoruNime: pembelian premium lewat QRIS statis.
 *
 * Alur: user pilih paket, aplikasi membuat order, user memindai QRIS lalu
 * transfer sendiri, bukti transfer dikirim ke sini, bot AI membacanya. Kalau
 * AI tidak bisa memastikan, developer memutuskan manual dari panel dev dan
 * menerima notifikasi email.
 *
 * Berkas ini sengaja tidak memakai "use node" supaya bisa mengekspor query dan
 * mutation. Semua pembacaan env var dan panggilan HTTP eksternal ada di file
 * Node terpisah (`aiNode.ts`, `mailNode.ts`).
 */
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { staffGuard } from "./moderation";

/**
 * TIGA TINGKATAN PREMIUM — fiturnya dibatasi berbeda-beda:
 *  · BASIC — tanpa iklan, kualitas sampai 720p, tanpa download.
 *  · PLUS  — 1080p, download episode, dan akses episode lebih awal.
 *  · VIP   — 4K, semua fitur, badge emas di nama.
 */
export const TIERS: Record<
  string,
  { label: string; maxQuality: number; download: boolean; earlyAccess: boolean }
> = {
  basic: { label: "Yoru Basic", maxQuality: 720, download: false, earlyAccess: false },
  plus: { label: "Yoru Plus", maxQuality: 1080, download: true, earlyAccess: true },
  vip: { label: "Yoru VIP", maxQuality: 2160, download: true, earlyAccess: true },
};

/** Daftar paket premium — diekspor supaya bisa diuji di tests/payment.test.ts */
export const PLANS: Record<
  string,
  { label: string; days: number; price: number; sacret: number }
> = {
  p1: { label: "Premium 1 Bulan", days: 30, price: 7000, sacret: 600 },
  p2: { label: "Premium 4 Bulan", days: 120, price: 30000, sacret: 1350 },
  p3: { label: "Premium 1 Tahun", days: 365, price: 100000, sacret: 6000 },
  p4: { label: "Premium 3 Tahun", days: 1095, price: 165000, sacret: 11000 },
  p5: { label: "Premium 7 Tahun", days: 2555, price: 210000, sacret: 21000 },
};

/** Lama logo merah tampil setelah akun di-tag developer. */
const DEV_TAG_DAYS = 7;

export const premiumPlans = query({
  args: {},
  handler: async () =>
    Object.entries(PLANS).map(([id, p]) => ({
      id,
      label: p.label,
      days: p.days,
      price: p.price,
      sacret: p.sacret,
    })),
});

/** Fungsi bersama: tandai lunas, kirim premium, beri tahu user. */
async function grantPremium(
  ctx: any,
  { orderId }: { orderId: string },
): Promise<{ alreadyPaid: boolean; premiumUntil: number }> {
  const row = await ctx.db
    .query("premiumPurchases")
    .withIndex("orderId", (q: any) => q.eq("orderId", orderId))
    .first();
  if (!row) throw new Error("Order tidak ada");
  if (row.status === "paid") {
    const owner = await ctx.db.get(row.userId);
    return { alreadyPaid: true, premiumUntil: owner?.premiumUntil ?? 0 };
  }
  await ctx.db.patch(row._id, { status: "paid" });
  const owner = await ctx.db.get(row.userId);
  const base = Math.max(Date.now(), owner?.premiumUntil ?? 0);
  const until = base + row.days * 86400000;
  if (owner) {
    // Tingkatan ikut tersimpan, jadi badge & batas fitur mengikuti pembelian.
    await ctx.db.patch(row.userId, {
      premiumUntil: until,
      premiumTier: (row.tier ?? "basic") as "basic" | "plus" | "vip",
    });
    // Bonus Sacret sesuai paket yang dibeli, langsung masuk ke saldo.
    const plan = PLANS[row.planId];
    const bonus = plan?.sacret ?? 0;
    if (bonus > 0) {
      await ctx.db.patch(row.userId, { diamonds: (owner.diamonds ?? 0) + bonus });
    }
    await ctx.db.insert("notifications", {
      userId: row.userId,
      type: "premium",
      title: "Premium aktif",
      body:
        bonus > 0
          ? `Pembayaran ${row.planLabel} sudah dikonfirmasi. Bonus ${bonus} Sacret masuk ke saldo. Terima kasih!`
          : `Pembayaran ${row.planLabel} sudah dikonfirmasi. Terima kasih!`,
      createdAt: Date.now(),
    });
  }
  return { alreadyPaid: false, premiumUntil: until };
}

// ============================================================ pengaturan QRIS ==

/** Pengaturan QRIS statis yang dilihat semua user. */
export const manualConfig = query({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db.query("paymentSettings").first();
    return {
      qrUrl: row?.qrUrl ?? "",
      qrStorageId: row?.qrStorageId ?? "",
      accountName: row?.accountName ?? "",
      accountLabel: row?.accountLabel ?? "",
      note: row?.note ?? "",
      contact: row?.contact ?? "",
      autoApprove: row?.autoApprove === true,
      autoApproveMax: row?.autoApproveMax ?? 0,
      ready: !!row?.qrUrl || !!row?.qrStorageId,
    };
  },
});

/** Pengaturan lengkap untuk panel dev, termasuk email tujuan notifikasi. */
export const devSettings = query({
  args: {},
  handler: async (ctx) => {
    await staffGuard(ctx, "dev");
    const row = await ctx.db.query("paymentSettings").first();
    return {
      qrUrl: row?.qrUrl ?? "",
      qrStorageId: row?.qrStorageId ?? "",
      accountName: row?.accountName ?? "",
      accountLabel: row?.accountLabel ?? "",
      note: row?.note ?? "",
      contact: row?.contact ?? "",
      devEmail: row?.devEmail ?? "",
      autoApprove: row?.autoApprove === true,
      autoApproveMax: row?.autoApproveMax ?? 0,
      ready: !!row?.qrUrl || !!row?.qrStorageId,
    };
  },
});

/** Baris pengaturan penuh untuk action/internal. */
export const getSettingsRow = internalQuery({
  args: {},
  handler: async (ctx) => await ctx.db.query("paymentSettings").first(),
});

/** Developer menyimpan pengaturan QRIS statis. */
export const saveManualConfig = mutation({
  args: {
    qrUrl: v.optional(v.string()),
    qrStorageId: v.optional(v.string()),
    accountName: v.optional(v.string()),
    accountLabel: v.optional(v.string()),
    note: v.optional(v.string()),
    contact: v.optional(v.string()),
    devEmail: v.optional(v.string()),
    autoApprove: v.optional(v.boolean()),
    autoApproveMax: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await staffGuard(ctx, "dev");
    const row = await ctx.db.query("paymentSettings").first();
    const clean = {
      qrUrl: args.qrUrl?.trim() || undefined,
      qrStorageId: args.qrStorageId || row?.qrStorageId || undefined,
      accountName: args.accountName?.trim() || undefined,
      accountLabel: args.accountLabel?.trim() || undefined,
      note: args.note?.trim() || undefined,
      contact: args.contact?.trim() || undefined,
      devEmail: args.devEmail?.trim() || undefined,
      autoApprove: args.autoApprove ?? row?.autoApprove ?? false,
      autoApproveMax: args.autoApproveMax ?? row?.autoApproveMax ?? 0,
      updatedAt: Date.now(),
    };
    if (row) await ctx.db.patch(row._id, clean);
    else await ctx.db.insert("paymentSettings", clean);
    return { ok: true };
  },
});

// ================================================================== order =====

/** Order milik user sendiri (dipakai halaman premium untuk status). */
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
      createdAt: row.createdAt,
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

/** User menekan "Beli dan dapatkan premium": order dibuat, status menunggu. */
export const createManualOrder = mutation({
  args: {
    planId: v.string(),
    /** Tingkatan premium yang dibeli (basic / plus / vip). */
    tier: v.optional(
      v.union(v.literal("basic"), v.literal("plus"), v.literal("vip")),
    ),
  },
  handler: async (ctx, { planId, tier }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const plan = PLANS[planId];
    if (!plan) throw new Error("Paket tidak ada");
    const picked = tier && TIERS[tier] ? TIERS[tier]!.label : TIERS.basic!.label;
    const cfg = await ctx.db.query("paymentSettings").first();
    if (!cfg?.qrUrl && !cfg?.qrStorageId) {
      throw new Error("QRIS belum diatur. Hubungi developer.");
    }
    const orderId = `YN-${Date.now().toString(36).toUpperCase()}`;
    await ctx.db.insert("premiumPurchases", {
      userId,
      planId,
      planLabel: `${picked} · ${plan.label}`,
      days: plan.days,
      priceIdr: plan.price,
      orderId,
      tier: tier ?? "basic",
      status: "manual_pending",
      method: "qris",
      createdAt: Date.now(),
    });
    return {
      orderId,
      priceIdr: plan.price,
      days: plan.days,
      planLabel: `${picked} · ${plan.label}`,
    };
  },
});

/**
 * Tombol "Batal" di layar bayar: batalkan order milik sendiri.
 *
 * Barisnya DIHAPUS, bukan diberi status "batal" — supaya di riwayat
 * pembayaran tidak ada status menggantung untuk paket yang tidak jadi dibeli.
 */
export const cancelMyOrder = mutation({
  args: { orderId: v.string() },
  handler: async (ctx, { orderId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const row = await ctx.db
      .query("premiumPurchases")
      .withIndex("orderId", (q) => q.eq("orderId", orderId))
      .first();
    if (!row || row.userId !== userId) return { ok: true as const };
    if (row.status === "paid") throw new Error("Order ini sudah lunas");
    await ctx.db.delete(row._id);
    return { ok: true as const };
  },
});

/** Lampirkan bukti transfer ke order milik sendiri. Bukti hanya bisa dipakai 1x. */
export const attachProof = mutation({
  args: {
    orderId: v.string(),
    proofStorageId: v.string(),
    proofHash: v.string(),
    proofText: v.optional(v.string()),
  },
  handler: async (ctx, { orderId, proofStorageId, proofHash, proofText }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const row = await ctx.db
      .query("premiumPurchases")
      .withIndex("orderId", (q) => q.eq("orderId", orderId))
      .first();
    if (!row || row.userId !== userId) throw new Error("Order tidak ditemukan");
    if (row.status === "paid") throw new Error("Order ini sudah lunas");
    if (row.status === "rejected") throw new Error("Bukti ini ditolak, buat pesanan baru");

    const used = await ctx.db
      .query("premiumPurchases")
      .withIndex("proofHash", (q) => q.eq("proofHash", proofHash))
      .first();
    if (used) throw new Error("Bukti transfer ini sudah pernah dipakai");

    const me = await ctx.db.get(userId);
    await ctx.db.patch(row._id, {
      proofUrl: proofStorageId,
      proofHash,
      ...(proofText ? { proofText: proofText.slice(0, 300) } : {}),
      ...(me?.uidCode ? { uidCode: me.uidCode } : {}),
      status: "manual_review",
    });
    return { orderId };
  },
});

/** Baris order lengkap untuk action/internal. */
export const getOrderRow = internalQuery({
  args: { orderId: v.string() },
  handler: async (ctx, { orderId }) => {
    return await ctx.db
      .query("premiumPurchases")
      .withIndex("orderId", (q) => q.eq("orderId", orderId))
      .first();
  },
});

/** Terapkan hasil bot AI: verified jadi lunas, rejected ditolak. */
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
      await ctx.db.patch(row._id, { analysisNote: clean, analyzedBy: "ai" });
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
 * Bot AI membaca bukti transfer lalu memutuskan. Kalau tidak bisa memastikan,
 * order menunggu dan developer diberi tahu lewat email supaya dicek manual.
 */
export const analyzeProof = action({
  args: { orderId: v.string() },
  handler: async (
    ctx,
    { orderId },
  ): Promise<{ verdict: "verified" | "rejected" | "manual"; note: string; emailed: boolean }> => {
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
    if (row.status === "paid") return { verdict: "verified", note: "Sudah lunas.", emailed: false };
    if (row.status === "rejected") {
      return {
        verdict: "rejected",
        note: row.analysisNote ?? "Bukti ditolak.",
        emailed: false,
      };
    }

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
      devEmail?: string;
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

    let emailed = false;
    if (r.verdict === "manual" && cfg?.devEmail) {
      const buyer = (await ctx.runQuery(internal.payments.getOrderOwner, {
        userId,
      })) as null | { username?: string };
      const sent = (await ctx.runAction(internal.mailNode.notifyDeveloper, {
        to: cfg.devEmail,
        username: buyer?.username ?? "user",
        orderId,
        planLabel: row.planLabel,
        amountIdr: row.priceIdr,
        ...(imageUrl ? { proofUrl: imageUrl } : {}),
        note: r.note,
      })) as { sent: boolean };
      emailed = sent.sent;
    }

    return { ...r, emailed };
  },
});

// ================================================================ panel dev ===

/** Order yang menunggu keputusan developer. */
export const pendingManualOrders = query({
  args: {},
  handler: async (ctx) => {
    await staffGuard(ctx, "dev");
    const rows = (await ctx.db.query("premiumPurchases").collect())
      .filter((r) => r.status === "manual_pending" || r.status === "manual_review")
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 30);
    const out = [];
    for (const r of rows) {
      const u = await ctx.db.get(r.userId);
      out.push({
        _id: r._id,
        orderId: r.orderId,
        status: r.status,
        planLabel: r.planLabel,
        days: r.days,
        priceIdr: r.priceIdr,
        note: r.note,
        proofText: r.proofText,
        proofUrl: r.proofUrl,
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

/** Developer menyetujui satu order: menunggu pembayaran menjadi lunas. */
export const approveManualOrder = mutation({
  args: { orderId: v.string() },
  handler: async (ctx, { orderId }) => {
    await staffGuard(ctx, "dev");
    return await grantPremium(ctx, { orderId });
  },
});

/** Developer menolak bukti yang jelas tidak valid. */
export const rejectManualOrder = mutation({
  args: { orderId: v.string(), reason: v.optional(v.string()) },
  handler: async (ctx, { orderId, reason }) => {
    await staffGuard(ctx, "dev");
    const row = await ctx.db
      .query("premiumPurchases")
      .withIndex("orderId", (q) => q.eq("orderId", orderId))
      .first();
    if (!row) throw new Error("Order tidak ada");
    if (row.status === "paid") throw new Error("Order sudah lunas");
    await ctx.db.patch(row._id, {
      status: "rejected",
      analysisNote: (reason ?? "Bukti tidak valid according to developer.").slice(0, 300),
      analyzedBy: "dev",
    });
    await ctx.db.insert("notifications", {
      userId: row.userId,
      type: "premium",
      title: "Bukti transfer ditolak",
      body: (reason ?? "Bukti transfer tidak bisa diverifikasi.").slice(0, 200),
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

/**
 * Developer memberi premium manual ke satu user. Durasi dipilih dalam
 * hari/bulan/tahun, lalu order dibuat berstatus menunggu pembayaran dan
 * seketika dilunasi sehingga tampil sebagai lunas.
 *
 * Catatan bisa memuat "@username". Username yang benar-benar ada akan
 * ditandai dengan logo merah; nama yang tidak terdaftar diabaikan.
 */
export const devGrantPremium = mutation({
  args: {
    targetId: v.id("users"),
    days: v.number(),
    months: v.number(),
    years: v.number(),
    amountIdr: v.number(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await staffGuard(ctx, "dev");
    const target = await ctx.db.get(args.targetId);
    if (!target) throw new Error("User tidak ada");
    if (!Number.isFinite(args.amountIdr) || args.amountIdr < 0) {
      throw new Error("Nominal tidak valid");
    }
    const totalDays =
      Math.max(0, Math.round(args.days)) +
      Math.max(0, Math.round(args.months)) * 30 +
      Math.max(0, Math.round(args.years)) * 365;
    if (totalDays <= 0) throw new Error("Pilih minimal satu durasi");

    const note = (args.note ?? "").trim().slice(0, 300);
    const wanted = Array.from(note.matchAll(/@([A-Za-z0-9_]{2,20})/g)).map((m) => m[1]!);
    const tagged: string[] = [];
    const unknown: string[] = [];
    const until = Date.now() + DEV_TAG_DAYS * 86400000;
    for (const name of wanted) {
      const found = await ctx.db
        .query("users")
        .withIndex("username", (q) => q.eq("username", name))
        .first();
      if (!found) {
        unknown.push(name);
        continue;
      }
      await ctx.db.patch(found._id, { devTagUntil: until });
      await ctx.db.insert("notifications", {
        userId: found._id,
        type: "mention",
        title: "Developer menandai akunmu",
        body: note || "Developer menandai akunmu dengan logo merah.",
        createdAt: Date.now(),
      });
      tagged.push(found.username ?? name);
    }

    const planLabel = `Manual ${totalDays} hari`;
    const orderId = `DEV-${Date.now().toString(36).toUpperCase()}`;
    await ctx.db.insert("premiumPurchases", {
      userId: args.targetId,
      planId: "manual",
      planLabel,
      days: totalDays,
      priceIdr: Math.round(args.amountIdr),
      orderId,
      status: "manual_pending",
      method: "developer",
      ...(note ? { note } : {}),
      ...(tagged.length > 0 ? { mentions: tagged } : {}),
      createdAt: Date.now(),
    });
    const r = await grantPremium(ctx, { orderId });
    return { orderId, ...r, tagged, unknown };
  },
});

/** Dev only: cek apakah bot AI (Gemini) sudah aktif, tanpa membuat order. */
export const devTestBot = action({
  args: { expectedAmount: v.optional(v.number()) },
  handler: async (
    ctx,
    { expectedAmount },
  ): Promise<{ verdict: string; note: string; engine: string }> => {
    await staffGuard(ctx, "dev");
    const amount = expectedAmount ?? 7000;
    return (await ctx.runAction(internal.aiNode.analyzeProof, {
      imageUrl: null,
      proofText: `Transfer Rp ${amount} via QRIS atas nama Rii`,
      expectedAmount: amount,
      planLabel: "1 Bulan",
      uidCode: "",
      accountName: "",
    })) as { verdict: string; note: string; engine: string };
  },
});

/** Dev only: cek apakah RESEND_API_KEY sudah terbaca backend. */
export const devMailStatus = action({
  args: {},
  handler: async (ctx): Promise<{ keyPresent: boolean }> => {
    await staffGuard(ctx, "dev");
    return (await ctx.runAction(internal.mailNode.mailStatus, {})) as {
      keyPresent: boolean;
    };
  },
});

/** Baris user untuk dipakai action/internal. */
export const getOrderOwner = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const u = await ctx.db.get(userId);
    if (!u) return null;
    return { username: u.username ?? "user", image: u.image };
  },
});
