import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";

/** Daftar playlist bookmark milik user, termasuk jumlah item. */
export const myLists = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const lists = await ctx.db
      .query("bookmarkLists")
      .withIndex("userId_created", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
    return await Promise.all(
      lists.map(async (list) => {
        const items = await ctx.db
          .query("bookmarkItems")
          .withIndex("listId_created", (q) => q.eq("listId", list._id))
          .collect();
        return { ...list, count: items.length };
      }),
    );
  },
});

export const createList = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const clean = name.trim().slice(0, 40);
    if (!clean) throw new Error("Nama playlist wajib diisi");
    const existing = await ctx.db
      .query("bookmarkLists")
      .withIndex("userId_created", (q) => q.eq("userId", userId))
      .collect();
    if (existing.some((l) => l.name.toLowerCase() === clean.toLowerCase()))
      throw new Error("Nama playlist sudah dipakai");
    return await ctx.db.insert("bookmarkLists", {
      userId,
      name: clean,
      createdAt: Date.now(),
    });
  },
});

export const renameList = mutation({
  args: { listId: v.id("bookmarkLists"), name: v.string() },
  handler: async (ctx, { listId, name }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const list = await ctx.db.get(listId);
    if (!list || list.userId !== userId) throw new Error("Playlist tidak ditemukan");
    const clean = name.trim().slice(0, 40);
    if (!clean) throw new Error("Nama playlist wajib diisi");
    await ctx.db.patch(listId, { name: clean });
  },
});

export const deleteList = mutation({
  args: { listId: v.id("bookmarkLists") },
  handler: async (ctx, { listId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const list = await ctx.db.get(listId);
    if (!list || list.userId !== userId) throw new Error("Playlist tidak ditemukan");
    const items = await ctx.db
      .query("bookmarkItems")
      .withIndex("listId_created", (q) => q.eq("listId", listId))
      .collect();
    for (const item of items) await ctx.db.delete(item._id);
    await ctx.db.delete(listId);
  },
});

export const items = query({
  args: { listId: v.id("bookmarkLists") },
  handler: async (ctx, { listId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const list = await ctx.db.get(listId);
    if (!list || list.userId !== userId) return [];
    return await ctx.db
      .query("bookmarkItems")
      .withIndex("listId_created", (q) => q.eq("listId", listId))
      .order("desc")
      .collect();
  },
});

/** ID playlist yang berisi item ini — untuk tanda centang di sheet. */
export const itemLists = query({
  args: { itemId: v.string() },
  handler: async (ctx, { itemId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const rows = await ctx.db
      .query("bookmarkItems")
      .withIndex("userId_item", (q) => q.eq("userId", userId).eq("itemId", itemId))
      .collect();
    return rows.map((r) => r.listId);
  },
});

export const addItem = mutation({
  args: {
    listId: v.id("bookmarkLists"),
    itemId: v.string(),
    title: v.string(),
    image: v.optional(v.string()),
    kind: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, { listId, itemId, title, image, kind, status }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const list = await ctx.db.get(listId);
    if (!list || list.userId !== userId) throw new Error("Playlist tidak ditemukan");
    const existing = await ctx.db
      .query("bookmarkItems")
      .withIndex("listId_created", (q) => q.eq("listId", listId))
      .collect();
    if (existing.some((r) => r.itemId === itemId)) return { added: false };
    await ctx.db.insert("bookmarkItems", {
      listId,
      userId,
      itemId,
      title,
      image,
      kind: kind ?? "anime",
      status,
      createdAt: Date.now(),
    });
    return { added: true };
  },
});

export const removeItem = mutation({
  args: { listId: v.id("bookmarkLists"), itemId: v.string() },
  handler: async (ctx, { listId, itemId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const rows = await ctx.db
      .query("bookmarkItems")
      .withIndex("listId_created", (q) => q.eq("listId", listId))
      .collect();
    const found = rows.find((r) => r.itemId === itemId && r.userId === userId);
    if (found) await ctx.db.delete(found._id);
  },
});
