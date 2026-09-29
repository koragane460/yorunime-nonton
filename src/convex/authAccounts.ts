// YoruNime — akun email+password (untuk screen login baru).
// Register: email diverifikasi lewat OTP Convex Auth (provider email-otp),
// setelah itu password disimpan di sini. Login: cek terdaftar + cocokkan hash.
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

async function sha256(text: string): Promise<string> {
  try {
    const data = new TextEncoder().encode(text);
    const buf = await crypto.subtle.digest("SHA-256", data);
    return [...new Uint8Array(buf)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    // Fallback runtime tanpa WebCrypto — cukup untuk mode tester.
    let h1 = (0xdeadbeef ^ text.length) | 0;
    let h2 = (0x41c6ce57 ^ text.length) | 0;
    for (let i = 0; i < text.length; i++) {
      const ch = text.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 =
      Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
      Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 =
      Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
      Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return `${(h2 >>> 0).toString(16)}${(h1 >>> 0).toString(16)}`;
  }
}

const hashPw = (email: string, password: string) =>
  sha256(`yorunime::${email.trim().toLowerCase()}::${password}`);

/** Cek apakah email sudah pernah daftar (dipakai tab Login). */
export const checkAccount = query({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const em = email.trim().toLowerCase();
    if (!em) return { exists: false };
    const row = await ctx.db
      .query("authAccounts")
      .withIndex("email", (q) => q.eq("email", em))
      .first();
    return { exists: row !== null };
  },
});

/** Verifikasi email+password (client lanjut signIn anonymous sebagai sesi). */
export const loginAccount = mutation({
  args: { email: v.string(), password: v.string() },
  handler: async (ctx, { email, password }) => {
    const em = email.trim().toLowerCase();
    const row = await ctx.db
      .query("authAccounts")
      .withIndex("email", (q) => q.eq("email", em))
      .first();
    if (!row) return { ok: false as const, reason: "not_registered" as const };
    const h = await hashPw(em, password);
    if (h !== row.passwordHash)
      return { ok: false as const, reason: "wrong_password" as const };
    await ctx.db.patch(row._id, { lastLoginAt: Date.now() });
    return { ok: true as const };
  },
});

/** Simpan/ubah password akun — dipanggil setelah OTP email terverifikasi. */
export const registerAccount = mutation({
  args: { email: v.string(), password: v.string() },
  handler: async (ctx, { email, password }) => {
    const em = email.trim().toLowerCase();
    if (password.length < 6) throw new Error("Password minimal 6 karakter");
    const passwordHash = await hashPw(em, password);
    const existing = await ctx.db
      .query("authAccounts")
      .withIndex("email", (q) => q.eq("email", em))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        passwordHash,
        lastLoginAt: Date.now(),
      });
    } else {
      await ctx.db.insert("authAccounts", {
        email: em,
        passwordHash,
        createdAt: Date.now(),
        lastLoginAt: Date.now(),
      });
    }
    return { ok: true as const };
  },
});
