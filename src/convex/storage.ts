// YoruNime - Penyimpanan file (foto chat, avatar, dll).
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query, internalQuery } from "./_generated/server";

/**
 * Minta URL upload sekali pakai. Frontend POST file ke URL ini, lalu kirim
 * storageId-nya lewat mutation chat. Foto tidak disimpan sebagai base64 di
 * dokumen (batas 1MB per dokumen), jadi pesan foto selalu bisa terkirim.
 */
export const getUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    return ctx.storage.generateUploadUrl();
  },
});

/** Versi internal (dipakai action, mis. bot AI analyzing bukti transfer). */
export const getUrlInternal = internalQuery({
  args: { storageId: v.string() },
  handler: async (ctx, { storageId }) => {
    try {
      return await ctx.storage.getUrl(storageId);
    } catch {
      return null;
    }
  },
});

/** Ubah storageId menjadi URL yang bisa dibuka browser. */
export const getUrl = query({
  args: { storageId: v.string() },
  handler: async (ctx, { storageId }) => {
    try {
      return await ctx.storage.getUrl(storageId);
    } catch {
      return null;
    }
  },
});