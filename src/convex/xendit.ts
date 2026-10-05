/**
 * YoruNime: pembayaran otomatis lewat Xendit.
 *
 * Alur:
 *  1. User pilih paket → `createInvoice` membuat baris order lalu memanggil
 *     Xendit `/v2/invoices`. Xendit mengembalikan `invoice_url` yang berisi
 *     halaman pembayaran berisi QRIS + semua e-wallet (DANA, GoPay, ShopeePay,
 *     OVO, LinkAja) + virtual account.
 *  2. User bayar di halaman itu.
 *  3. Xendit mengirim webhook ke `/xendit/callback` (lihat http.ts) dengan
 *     header `x-callback-token`. Webhook memvalidasi token, lalu menandai
 *     order lunas, menambah saldo developer, dan mengirim notifikasi.
 *
 * Kredensial dibaca dari env var (diisi lewat menu Keys/API keys):
 *   XENDIT_SECRET_KEY  - secret API key (dashboard Xendit → Settings → API Keys)
 *   XENDIT_CALLBACK_TOKEN - verification token (Settings → Webhooks)
 *
 * File ini sengaja TIDAK memakai "use node" supaya bisa mengekspor query dan
 * mutation sekaligus. `fetch` tersedia di action biasa, dan env var tetap bisa
 * dibaca lewat `process.env` di dalam action.
 */
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { staffGuard } from "./moderation";
import { PLANS } from "./payments";

const XENDIT_BASE = "https://api.xendit.co";

/** Kunci Xendit yang tersimpan. Hanya statusnya yang dibocorkan, bukan isinya. */
function keys() {
  return {
    secret: (process.env.XENDIT_SECRET_KEY ?? "").trim(),
    callback: (process.env.XENDIT_CALLBACK_TOKEN ?? "").trim(),
  };
}

export const xenditStatus = query({
  args: {},
  handler: async (ctx) => {
    const k = keys();
    return {
      hasSecret: k.secret.length > 0,
      hasCallback: k.callback.length > 0,
      configured: k.secret.length > 0,
    };
  },
});

/**
 * Buat order premium + invoice Xendit.
 *
 * `orderId` dibuat di sisi app supaya webhook bisa mencocokkan pembayaran
 * dengan baris order kita tanpa menyimpan id internal Xendit di URL.
 */
export const createInvoice = action({
  args: { planId: v.string() },
  handler: async (ctx, { planId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Belum masuk");

    const plan = PLANS[planId];
    if (!plan) throw new Error("Paket tidak dikenal");

    const k = keys();
    if (!k.secret) {
      throw new Error(
        "Pembayaran otomatis belum aktif. Kunci Xendit belum diisi developer.",
      );
    }

    const orderId = `yn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const user: any = await ctx.runQuery(internal.xendit.userRow, { userId });
    const email =
      (user?.email as string | undefined) || "yorunime-user@example.com";

    // Baris order dibuat lebih dulu supaya webhook yang datang lebih cepat
    // daripada respons create tidak kehilangan targetnya.
    const rowId = await ctx.runMutation(internal.xendit.insertOrder, {
      userId,
      planId,
      planLabel: plan.label,
      days: plan.days,
      priceIdr: plan.price,
      orderId,
    });

    let data: any;
    try {
      const res = await fetch(`${XENDIT_BASE}/v2/invoices`, {
        method: "POST",
        headers: {
          // Xendit memakai Basic Auth: secret key sebagai username, password
          // dibiarkan kosong.
          Authorization: `Basic ${btoa(`${k.secret}:`)}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          external_id: orderId,
          amount: plan.price,
          description: `YoruNime Premium ${plan.label}`,
          payer_email: email,
          invoice_duration: 86400,
          currency: "IDR",
          // Tidak membatasi `payment_methods`: Xendit lalu menampilkan semua
          // kanal yang aktif di akun (QRIS, e-wallet, VA, kartu).
        }),
        signal: AbortSignal.timeout(20_000),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = (body as any)?.message || `Xendit ${res.status}`;
        await ctx.runMutation(internal.xendit.failOrder, { rowId, note: msg });
        throw new Error(String(msg));
      }
      data = body;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Gagal membuat invoice";
      await ctx.runMutation(internal.xendit.failOrder, { rowId, note: msg });
      throw new Error(msg);
    }

    const invoiceUrl = String(data?.invoice_url ?? "");
    const invoiceId = String(data?.id ?? "");
    if (!invoiceUrl) {
      await ctx.runMutation(internal.xendit.failOrder, {
        rowId,
        note: "Xendit tidak mengembalikan invoice_url",
      });
      throw new Error("Xendit tidak mengembalikan halaman pembayaran");
    }

    await ctx.runMutation(internal.xendit.attachInvoice, {
      rowId,
      invoiceUrl,
      invoiceId,
    });
    return { orderId, invoiceUrl, invoiceId };
  },
});

/** Pembayaran dari webhook (dipakai http.ts, tidak untuk UI). */
export const webhookPaid = internalMutation({
  args: {
    externalId: v.string(),
    xenditInvoiceId: v.optional(v.string()),
    paidAmount: v.optional(v.number()),
    paymentMethod: v.optional(v.string()),
    paymentChannel: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("premiumPurchases")
      .withIndex("orderId", (q) => q.eq("orderId", args.externalId))
      .first();
    if (!row) return { ok: false as const, reason: "order tidak ditemukan" };
    if (row.status === "paid") return { ok: true as const, alreadyPaid: true };

    await ctx.db.patch(row._id, {
      status: "paid",
      method: "xendit",
      paymentRef: args.xenditInvoiceId ?? row.paymentRef,
      paymentUrl: row.paymentUrl,
      note: [
        args.paymentMethod ? `via ${args.paymentMethod}` : "",
        args.paymentChannel ?? "",
        args.paidAmount != null ? `Rp${args.paidAmount}` : "",
      ]
        .filter(Boolean)
        .join(" · "),
    });

    // Saldo developer: satu baris per transaksi, mudah diaudit dan mudah
    // dihitung totalnya.
    const owner: any = await ctx.db.get(row.userId);
    await ctx.db.insert("saldoLedger", {
      kind: "topup",
      amount: row.priceIdr,
      refOrderId: row.orderId,
      note: `Premium ${row.planLabel} - ${
        args.paymentChannel || args.paymentMethod || "Xendit"
      }`,
      createdAt: Date.now(),
    });
    void owner;

    // Beri premium ke pembeli + notifikasi (internal di file ini, supaya
    // alur pembayaran Xendit tidak bergantung pada internal file lain).
    await ctx.runMutation(internal.xendit.grantPremiumById, {
      purchaseId: row._id,
    });
    return { ok: true as const, alreadyPaid: false };
  },
});

/**
 * Tandai order lunas dan kirim premium ke pembelinya.
 *
 * Logika di sini sama persis dengan alur QRIS manual di `payments.ts`: premium
 * dihitung dari sisa premium yang masih aktif (menumpuk, bukan menimpa), bonus
 * Sacret sesuai paket masuk ke saldo, dan user menerima notifikasi.
 */
export const grantPremiumById = internalMutation({
  args: { purchaseId: v.id("premiumPurchases") },
  handler: async (ctx, { purchaseId }) => {
    const row = await ctx.db.get(purchaseId);
    if (!row) return { ok: false as const };
    const owner: any = await ctx.db.get(row.userId);
    if (!owner) return { ok: false as const };
    const base = Math.max(Date.now(), owner.premiumUntil ?? 0);
    const until = base + row.days * 86400000;
    await ctx.db.patch(row.userId, { premiumUntil: until });
    const bonus = PLANS[row.planId]?.sacret ?? 0;
    if (bonus > 0) {
      await ctx.db.patch(row.userId, {
        diamonds: (owner.diamonds ?? 0) + bonus,
      });
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
    return { ok: true as const, until };
  },
});

/* ------------------------------------------------------------------ *
 *  Panel dev: atur pesanan, saldo, dan tarik saldo.
 * ------------------------------------------------------------------ */

export const devOrders = query({
  args: {},
  handler: async (ctx) => {
    const me = await staffGuard(ctx, "dev");
    if (!me) return [];
    const rows = await ctx.db
      .query("premiumPurchases")
      .withIndex("status_created", (q) => q.eq("status", "pending_xendit"))
      .order("desc")
      .take(50);
    const anyRows = rows.length
      ? rows
      : await ctx.db.query("premiumPurchases").order("desc").take(50);
    const out = [];
    for (const r of anyRows.slice(0, 60)) {
      const u: any = await ctx.db.get(r.userId);
      out.push({
        _id: r._id,
        orderId: r.orderId,
        planLabel: r.planLabel,
        priceIdr: r.priceIdr,
        status: r.status,
        method: r.method,
        paymentUrl: r.paymentUrl,
        paymentRef: r.paymentRef,
        note: r.note,
        username: u?.username ?? "(tanpa nama)",
        userImage: u?.image,
        createdAt: r.createdAt,
      });
    }
    return out;
  },
});

/** Ubah status order dari panel dev (mis. lunas manual / batalkan). */
export const devSetOrderStatus = mutation({
  args: { orderId: v.string(), status: v.string() },
  handler: async (ctx, { orderId, status }) => {
    const me = await staffGuard(ctx, "dev");
    if (!me) throw new Error("Hanya developer");
    const row = await ctx.db
      .query("premiumPurchases")
      .withIndex("orderId", (q) => q.eq("orderId", orderId))
      .first();
    if (!row) throw new Error("Order tidak ada");
    if (row.status === status) return { ok: true as const };
    await ctx.db.patch(row._id, { status, method: status === "paid" ? "manual" : row.method });
    if (status === "paid") {
      await ctx.db.insert("saldoLedger", {
        kind: "topup",
        amount: row.priceIdr,
        refOrderId: row.orderId,
        note: `Lunas manual - ${row.planLabel}`,
        createdAt: Date.now(),
      });
      await ctx.runMutation(internal.xendit.grantPremiumById, {
        purchaseId: row._id,
      });
    }
    return { ok: true as const };
  },
});

export const saldo = query({
  args: {},
  handler: async (ctx) => {
    const me = await staffGuard(ctx, "dev");
    if (!me) return { total: 0, entries: [], withdrawals: [] };
    const entries = await ctx.db
      .query("saldoLedger")
      .order("desc")
      .take(200);
    const withdrawals = await ctx.db
      .query("withdrawals")
      .order("desc")
      .take(50);
    const total = entries.reduce((a, r) => a + (r.kind === "topup" ? r.amount : -r.amount), 0);
    return {
      total,
      entries: entries.map((r) => ({
        _id: r._id,
        kind: r.kind,
        amount: r.amount,
        note: r.note,
        createdAt: r.createdAt,
      })),
      withdrawals: withdrawals.map((r) => ({
        _id: r._id,
        amount: r.amount,
        target: r.target,
        channel: r.channel,
        status: r.status,
        note: r.note,
        createdAt: r.createdAt,
      })),
    };
  },
});

/**
 * Minta tarik saldo ke e-wallet.
 *
 * Programatik payout Xendit butuh akun yang sudah disetujui untuk disbursement
 * (dan alurnya menuntut OTP), jadi di sini permintaan dicatat dulu. Eksekusi
 * transfer dilakukan developer di Dashboard Xendit (Send Payouts), lalu status
 * diperbarui dari panel. Jujur soal ini daripada seolah-olah uang langsung
 * terkirim padahal belum.
 */
export const requestWithdrawal = mutation({
  args: {
    amount: v.number(),
    channel: v.string(),
    target: v.string(),
  },
  handler: async (ctx, { amount, channel, target }) => {
    const me = await staffGuard(ctx, "dev");
    if (!me) throw new Error("Hanya developer");
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Nominal tidak valid");
    if (!target.trim()) throw new Error("Nomor tujuan wajib diisi");
    const entries = await ctx.db.query("saldoLedger").take(500);
    const total = entries.reduce(
      (a, r) => a + (r.kind === "topup" ? r.amount : -r.amount),
      0,
    );
    if (amount > total) throw new Error("Saldo tidak cukup");
    await ctx.db.insert("withdrawals", {
      amount,
      channel: channel.trim(),
      target: target.trim(),
      status: "requested",
      createdAt: Date.now(),
    });
    await ctx.db.insert("saldoLedger", {
      kind: "withdrawal",
      amount,
      note: `Tarik ke ${channel.trim()} ${target.trim()}`,
      createdAt: Date.now(),
    });
    return { ok: true as const };
  },
});

export const setWithdrawalStatus = mutation({
  args: { id: v.id("withdrawals"), status: v.string() },
  handler: async (ctx, { id, status }) => {
    const me = await staffGuard(ctx, "dev");
    if (!me) throw new Error("Hanya developer");
    await ctx.db.patch(id, { status });
    return { ok: true as const };
  },
});

/** Tes end-to-end tanpa kunci: tandai satu order lunas. */
export const devSimulatePaid = mutation({
  args: { orderId: v.string() },
  handler: async (ctx, { orderId }) => {
    const me = await staffGuard(ctx, "dev");
    if (!me) throw new Error("Hanya developer");
    const row = await ctx.db
      .query("premiumPurchases")
      .withIndex("orderId", (q) => q.eq("orderId", orderId))
      .first();
    if (!row) throw new Error("Order tidak ada");
    if (row.status === "paid") return { ok: true as const, alreadyPaid: true };
    await ctx.db.patch(row._id, { status: "paid", method: "simulasi" });
    await ctx.db.insert("saldoLedger", {
      kind: "topup",
      amount: row.priceIdr,
      refOrderId: row.orderId,
      note: `Simulasi bayar - ${row.planLabel}`,
      createdAt: Date.now(),
    });
    await ctx.runMutation(internal.xendit.grantPremiumById, {
      purchaseId: row._id,
    });
    return { ok: true as const, alreadyPaid: false };
  },
});

/* --------------------------------- internal -------------------------------- */

export const userRow = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => ctx.db.get(userId),
});

export const insertOrder = internalMutation({
  args: {
    userId: v.id("users"),
    planId: v.string(),
    planLabel: v.string(),
    days: v.number(),
    priceIdr: v.number(),
    orderId: v.string(),
  },
  handler: async (ctx, a) =>
    ctx.db.insert("premiumPurchases", {
      userId: a.userId,
      planId: a.planId,
      planLabel: a.planLabel,
      days: a.days,
      priceIdr: a.priceIdr,
      status: "pending_xendit",
      orderId: a.orderId,
      method: "xendit",
      createdAt: Date.now(),
    }),
});

export const attachInvoice = internalMutation({
  args: { rowId: v.id("premiumPurchases"), invoiceUrl: v.string(), invoiceId: v.string() },
  handler: async (ctx, { rowId, invoiceUrl, invoiceId }) =>
    ctx.db.patch(rowId, { paymentUrl: invoiceUrl, paymentRef: invoiceId }),
});

export const failOrder = internalMutation({
  args: { rowId: v.id("premiumPurchases"), note: v.string() },
  handler: async (ctx, { rowId, note }) =>
    ctx.db.patch(rowId, { status: "failed", note }),
});
