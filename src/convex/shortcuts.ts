// YoruNime — PINTASAN MILIK USER (custom button pribadi di layar Menu).
// Setiap user punya maksimal 8 tombol cepat yang dia susun sendiri, berisi
// label + tujuan (path internal aplikasi atau URL luar).
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/** Batas jumlah pintasan per user — biar layar Menu tetap ringkas. */
export const MAX_SHORTCUTS = 8;

/** Bersihkan label: spasi dirapatkan, maksimal 20 karakter. */
export function cleanLabel(text: string) {
  return text.replace(/\s+/g, " ").trim().slice(0, 20);
}

/**
 * Validasi tujuan: path internal ("/nonton?id=1") atau URL http(s).
 * Selain itu ditolak supaya tidak ada `javascript:` yang nyelip.
 */
export function cleanTarget(raw: string) {
  const t = raw.trim();
  if (!t) throw new Error("Tujuan pintasan wajib diisi");
  if (t.startsWith("/")) {
    if (t.startsWith("//")) throw new Error("Tujuan tidak valid");
    return t.slice(0, 300);
  }
  if (/^https?:\/\//i.test(t)) return t.slice(0, 300);
  throw new Error("Tujuan harus diawali / (halaman aplikasi) atau http(s)://");
}

/** Daftar pintasan milik user yang sedang login. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    let userId;
    try {
      userId = await getAuthUserId(ctx);
    } catch {
      return [];
    }
    if (userId === null) return [];
    return await ctx.db
      .query("shortcuts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const add = mutation({
  args: {
    label: v.string(),
    target: v.string(),
    icon: v.optional(v.string()),
  },
  handler: async (ctx, { label, target, icon }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const clean = cleanLabel(label);
    if (clean.length < 1) throw new Error("Nama tombol wajib diisi");
    const dest = cleanTarget(target);

    const mine = await ctx.db
      .query("shortcuts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    if (mine.length >= MAX_SHORTCUTS)
      throw new Error(`Maksimal ${MAX_SHORTCUTS} pintasan`);
    if (mine.some((s) => s.label.toLowerCase() === clean.toLowerCase()))
      throw new Error("Nama pintasan itu sudah ada");
    if (mine.some((s) => s.target === dest))
      throw new Error("Tujuan itu sudah jadi pintasan");

    const id = await ctx.db.insert("shortcuts", {
      userId,
      label: clean,
      target: dest,
      icon: (icon ?? "").trim().slice(0, 24) || undefined,
      createdAt: Date.now(),
    });
    return await ctx.db.get(id);
  },
});

export const remove = mutation({
  args: { id: v.id("shortcuts") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const row = await ctx.db.get(id);
    if (!row) throw new Error("Pintasan tidak ditemukan");
    if (row.userId !== userId) throw new Error("Bukan pintasan kamu");
    await ctx.db.delete(id);
    return { ok: true };
  },
});
