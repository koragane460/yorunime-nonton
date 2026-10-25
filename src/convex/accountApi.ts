// src/convex/accountApi.ts
import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import * as authAccounts from "./authAccounts";

async function sha256(text: string): Promise<string> {
  try {
    const data = new TextEncoder().encode(text);
    const buf = await crypto.subtle.digest("SHA-256", data);
    return [...new Uint8Array(buf)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    let h1 = (0xdeadbeef ^ text.length) | 0;
    let h2 = (0x41c6ce57 ^ text.length) | 0;
    for (let i = 0; i < text.length; i++) {
      const ch = text.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
         Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
         Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return `${(h2 >>> 0).toString(16)}${(h1 >>> 0).toString(16)}`;
  }
}

const hashPw = (email: string, password: string) =>
  sha256(`yorunime::${email.trim().toLowerCase()}::${password}`);

export const createAccount = mutation({
  args: {
    email: v.string(),
    password: v.string(),
    name: v.string(),
  },
  handler: async (ctx, { email, password, name }) => {
    const em = email.trim().toLowerCase();

    if (!em) throw new Error("Email wajib diisi.");
    if (!name.trim()) throw new Error("Nama wajib diisi.");
    if (password.length < 6) throw new Error("Password minimal 6 karakter.");

    const existing = await ctx.db
      .query("authAccounts")
      .withIndex("email", (q) => q.eq("email", em))
      .first();

    if (existing) {
      throw new Error("Email ini sudah terdaftar.");
    }

    const userId = await ctx.db.insert("users", {
      email: em,
      name: name.trim(),
      username:
        (name.trim().replace(/[^a-zA-Z0-9_]/g, "") || "user").slice(0, 16),
      xp: 0,
      level: 1,
      diamonds: 200000,
      createdAt: Date.now(),
      isAnonymous: false,
      role: "user",
    });

    await ctx.db.insert("authAccounts", {
      userId,
      email: em,
      passwordHash: await hashPw(em, password),
      createdAt: Date.now(),
      lastLoginAt: Date.now(),
    });

    return { userId };
  },
});

export const setPassword = mutation({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, { email, password }) => {
    const em = email.trim().toLowerCase();

    if (!em) throw new Error("Email wajib diisi.");
    if (password.length < 6) throw new Error("Password minimal 6 karakter.");

    const row = await ctx.db
      .query("authAccounts")
      .withIndex("email", (q) => q.eq("email", em))
      .first();

    if (!row) {
      throw new Error("Akun dengan email ini belum ditemukan.");
    }

    await ctx.db.patch(row._id, {
      passwordHash: await hashPw(em, password),
      updatedAt: Date.now(),
    });

    return { ok: true };
  },
});
