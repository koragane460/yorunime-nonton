"use node";
/**
 * Email notifikasi ke developer.
 *
 * Dipakai hanya dari dalam backend (internal action). Kalau RESEND_API_KEY belum
 * diisi, aksi ini diam-diam berbalik `sent: false` supaya alur pembelian user
 * tidak pernah gagal hanya karena email.
 */
import { v } from "convex/values";
import { internalAction } from "./_generated/server";

export const notifyDeveloper = internalAction({
  args: {
    to: v.string(),
    username: v.string(),
    orderId: v.string(),
    planLabel: v.string(),
    amountIdr: v.number(),
    proofUrl: v.optional(v.string()),
    note: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ sent: boolean; reason?: string }> => {
    const key = (process.env.RESEND_API_KEY ?? "").trim();
    const to = args.to.trim();
    if (!key) return { sent: false, reason: "RESEND_API_KEY belum diisi" };
    if (!to) return { sent: false, reason: "Email developer belum diisi" };

    const rupiah = new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(args.amountIdr);

    const lines = [
      `User: ${args.username}`,
      `Kode pesanan: ${args.orderId}`,
      `Paket: ${args.planLabel}`,
      `Nominal: ${rupiah}`,
      `Catatan AI: ${args.note}`,
    ];
    if (args.proofUrl) lines.push(`Bukti transfer: ${args.proofUrl}`);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        from: "YoruNime <onboarding@resend.dev>",
        to: [to],
        subject: `Bukti transfer ${args.planLabel} dari ${args.username}`,
        text: lines.join("\n"),
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { sent: false, reason: `Resend ${res.status}: ${body.slice(0, 160)}` };
    }
    return { sent: true };
  },
});
