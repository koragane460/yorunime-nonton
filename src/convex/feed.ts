// YoruNime — FEED + FOLLOW.
//
// Fitur sosial ala TikTok: post gambar/musik/teks, like, view, follow.
// Gambar diunggah ke file storage (storage.getUploadUrl) lalu disimpan sebagai
// storageId — bukan base64 — supaya jauh di bawah batas 1 MiB per dokumen.
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query, type QueryCtx } from "./_generated/server";

async function meOr(ctx: QueryCtx) {
  try {
    return await getAuthUserId(ctx);
  } catch {
    return null;
  }
}

/** Gabungkan info user + URL gambar untuk satu post. */
async function decorate(ctx: QueryCtx, p: any, viewer: string | null) {
  const u: any = await ctx.db.get(p.userId);
  let imageUrl: string | null = null;
  if (p.imageStorageId) {
    try {
      imageUrl = await ctx.storage.getUrl(p.imageStorageId);
    } catch {
      imageUrl = null;
    }
  }
  let thumbUrl: string | null = null;
  if (p.thumbStorageId) {
    try {
      thumbUrl = await ctx.storage.getUrl(p.thumbStorageId);
    } catch {
      thumbUrl = null;
    }
  }
  return {
    postId: p._id,
    userId: p.userId,
    kind: p.kind,
    caption: p.caption ?? "",
    imageUrl,
    thumbUrl,
    music: p.music ?? null,
    overlay: p.overlay ?? null,
    audio: p.audio ?? null,
    privacy: p.privacy,
    likeCount: (p.likes ?? []).length,
    liked: viewer ? (p.likes ?? []).includes(viewer) : false,
    commentCount: (
      await ctx.db
        .query("feedComments")
        .withIndex("by_post", (q) => q.eq("postId", p._id))
        .collect()
    ).length,
    views: p.views ?? 0,
    createdAt: p.createdAt,
    username: u?.username ?? "user",
    image: u?.image ?? null,
    level: u?.level ?? 1,
    clanTag: u?.clanTag,
    premium: (u?.premiumUntil ?? 0) > Date.now(),
    isMe: viewer !== null && viewer === p.userId,
  };
}

/** Semua post yang boleh dilihat viewer (publik + milik sendiri). */
export const listFeed = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const viewer = await meOr(ctx);
    const rows = await ctx.db
      .query("feedPosts")
      .withIndex("by_created", (q) => q)
      .order("desc")
      .take(Math.min(limit ?? 50, 100));
    const out = [];
    for (const p of rows) {
      if (p.privacy === "teman" && p.userId !== viewer) continue;
      out.push(await decorate(ctx, p, viewer));
    }
    return out;
  },
});

/** Satu post — dipakai kartu Feed yang dibagikan di chat/DM. */
export const postById = query({
  args: { postId: v.id("feedPosts") },
  handler: async (ctx, { postId }) => {
    const p = await ctx.db.get(postId);
    if (!p) return null;
    const viewer = await meOr(ctx);
    if (p.privacy === "teman" && p.userId !== viewer) return null;
    const d = await decorate(ctx, p, viewer);
    return { ...d, cover: d.thumbUrl ?? d.music?.cover ?? null };
  },
});

/** Post milik satu user (untuk grid Konten di detail akun). */
export const userPosts = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const viewer = await meOr(ctx);
    const rows = await ctx.db
      .query("feedPosts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(100);
    const out = [];
    for (const p of rows) {
      if (p.privacy === "teman" && p.userId !== viewer) continue;
      const d = await decorate(ctx, p, viewer);
      // Bentuknya SAMA dengan listFeed supaya overlay post bisa dipakai
      // langsung dari grid Konten di profil.
      out.push({ ...d, cover: d.thumbUrl ?? d.music?.cover ?? null });
    }
    return out;
  },
});

/** Total like semua post milik user — tampil sebagai jumlah Like di profil. */
export const userLikeTotal = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const rows = await ctx.db
      .query("feedPosts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return rows.reduce((n, p) => n + (p.likes?.length ?? 0), 0);
  },
});

/** Buat post baru. `imageStorageId` wajib untuk kind "image". */
export const createPost = mutation({
  args: {
    kind: v.union(
      v.literal("image"),
      v.literal("music"),
      v.literal("text"),
      v.literal("video"),
    ),
    caption: v.optional(v.string()),
    imageStorageId: v.optional(v.string()),
    thumbStorageId: v.optional(v.string()),
    music: v.optional(
      v.object({
        title: v.string(),
        artist: v.optional(v.string()),
        cover: v.optional(v.string()),
        audioUrl: v.optional(v.string()),
      }),
    ),
    overlay: v.optional(
      v.object({
        text: v.string(),
        font: v.string(),
        italic: v.boolean(),
        outline: v.boolean(),
        size: v.number(),
        /** Posisi teks (%) hasil drag di editor — opsional, data lama aman. */
        x: v.optional(v.number()),
        y: v.optional(v.number()),
        /** Warna teks (hex) dari panel warna baru. */
        color: v.optional(v.string()),
      }),
    ),
    audio: v.optional(
      v.object({
        musicVol: v.number(),
        videoVol: v.number(),
      }),
    ),
    privacy: v.union(v.literal("all"), v.literal("teman")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Belum masuk akun");
    if ((args.kind === "image" || args.kind === "video") && !args.imageStorageId)
      throw new Error("Konten belum terunggah");
    const postId = await ctx.db.insert("feedPosts", {
      userId,
      kind: args.kind,
      caption: (args.caption ?? "").slice(0, 500),
      imageStorageId: args.imageStorageId,
      thumbStorageId: args.thumbStorageId,
      music: args.music,
      overlay: args.overlay,
      audio: args.audio,
      privacy: args.privacy,
      likes: [],
      views: 0,
      createdAt: Date.now(),
    });
    return { postId };
  },
});

/** Hapus post milik sendiri. */
export const deletePost = mutation({
  args: { postId: v.id("feedPosts") },
  handler: async (ctx, { postId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Belum masuk akun");
    const p = await ctx.db.get(postId);
    if (!p || p.userId !== userId) throw new Error("Tidak bisa hapus post ini");
    await ctx.db.delete(postId);
    return { ok: true };
  },
});

/** Like / unlike post. */
export const toggleLike = mutation({
  args: { postId: v.id("feedPosts") },
  handler: async (ctx, { postId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Belum masuk akun");
    const p = await ctx.db.get(postId);
    if (!p) throw new Error("Post tidak ada");
    const likes = (p.likes ?? []).filter((l) => l !== userId);
    const liked = likes.length === (p.likes ?? []).length;
    if (liked) likes.push(userId);
    await ctx.db.patch(postId, { likes });
    return { liked, likeCount: likes.length };
  },
});

/** Tambah 1 view saat post dibuka (dipanggil sekali per pembukaan). */
export const addView = mutation({
  args: { postId: v.id("feedPosts") },
  handler: async (ctx, { postId }) => {
    const p = await ctx.db.get(postId);
    if (!p) return { ok: false };
    await ctx.db.patch(postId, { views: (p.views ?? 0) + 1 });
    return { ok: true };
  },
});

// ------------------------------------------------------------- follow ----

/** Follow / unfollow user. */
export const toggleFollow = mutation({
  args: { targetId: v.id("users") },
  handler: async (ctx, { targetId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Belum masuk akun");
    if (userId === targetId) throw new Error("Tidak bisa follow diri sendiri");
    const existing = await ctx.db
      .query("follows")
      .withIndex("by_pair", (q) =>
        q.eq("followerId", userId).eq("followingId", targetId),
      )
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
      return { following: false };
    }
    await ctx.db.insert("follows", {
      followerId: userId,
      followingId: targetId,
      createdAt: Date.now(),
    });
    return { following: true };
  },
});

/** Apakah viewer sedang follow user ini? */
export const isFollowing = query({
  args: { targetId: v.id("users") },
  handler: async (ctx, { targetId }) => {
    const userId = await meOr(ctx);
    if (userId === null) return false;
    const row = await ctx.db
      .query("follows")
      .withIndex("by_pair", (q) =>
        q.eq("followerId", userId).eq("followingId", targetId),
      )
      .first();
    return row !== null;
  },
});

/** Jumlah Mengikuti / Followers / Like untuk satu user (detail Konten). */
export const followCounts = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const following = await ctx.db
      .query("follows")
      .withIndex("by_follower", (q) => q.eq("followerId", userId))
      .collect();
    const followers = await ctx.db
      .query("follows")
      .withIndex("by_following", (q) => q.eq("followingId", userId))
      .collect();
    const posts = await ctx.db
      .query("feedPosts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const likes = posts.reduce((n, p) => n + (p.likes?.length ?? 0), 0);
    return { following: following.length, followers: followers.length, likes };
  },
});

/** Daftar user yang diikuti / followers (sheet Konten). */export const followList = query({
  args: {
    userId: v.id("users"),
    mode: v.union(v.literal("following"), v.literal("followers")),
  },
  handler: async (ctx, { userId, mode }) => {
    const rows = await ctx.db
      .query("follows")
      .withIndex(mode === "following" ? "by_follower" : "by_following", (q) =>
        q.eq(mode === "following" ? "followerId" : "followingId", userId),
      )
      .order("desc")
      .take(200);
    const out = [];
    for (const f of rows) {
      const uid = mode === "following" ? f.followingId : f.followerId;
      const u: any = await ctx.db.get(uid);
      out.push({
        userId: uid,
        username: u?.username ?? "user",
        image: u?.image ?? null,
        level: u?.level ?? 1,
      });
    }
    return out;
  },
});

// ----------------------------------------------------------- komentar ---

/** Komentar satu post Feed, terlama di atas. */
export const listComments = query({
  args: { postId: v.id("feedPosts") },
  handler: async (ctx, { postId }) => {
    const rows = await ctx.db
      .query("feedComments")
      .withIndex("by_post", (q) => q.eq("postId", postId))
      .order("asc")
      .take(200);
    const out = [];
    for (const c of rows) {
      const u: any = await ctx.db.get(c.userId);
      out.push({
        commentId: c._id,
        text: c.text,
        createdAt: c.createdAt,
        userId: c.userId,
        username: u?.username ?? "user",
        image: u?.image ?? null,
        // Banner akun dipakai sebagai latar kartu komentar. Ini TERPISAH dari
        // foto profil; jangan pernah memakai avatar sebagai banner.
        bannerUrl: u?.bannerUrl ?? null,
        // Metadata biar sheet komentar bisa tampil seperti chat:
        // centang biru, clan tag, tag level berikon.
        level: u?.level ?? 1,
        clanTag: u?.clanTag,
        clanTagIcon: u?.clanTagIcon,
        clanNameColor: u?.clanNameColor,
        clanLevel: u?.clanLevel,
        premium: (u?.premiumUntil ?? 0) > Date.now(),
        parentId: c.parentId ?? null,
        replyTo: c.replyTo ?? null,
      });
    }
    return out;
  },
});

/** Tulis komentar pada post Feed — boleh balasan (`parentId` + `replyTo`). */
export const addComment = mutation({
  args: {
    postId: v.id("feedPosts"),
    text: v.string(),
    parentId: v.optional(v.id("feedComments")),
    replyTo: v.optional(v.string()),
  },
  handler: async (ctx, { postId, text, parentId, replyTo }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Belum masuk akun");
    const t = text.trim();
    if (!t) throw new Error("Komentar kosong");
    const p = await ctx.db.get(postId);
    if (!p) throw new Error("Post tidak ada");
    if (parentId) {
      const parent = await ctx.db.get(parentId);
      if (!parent || parent.postId !== postId)
        throw new Error("Komentar yang dibalas tidak ada");
    }
    await ctx.db.insert("feedComments", {
      postId,
      userId,
      text: t.slice(0, 400),
      createdAt: Date.now(),
      ...(parentId ? { parentId } : {}),
      ...(replyTo ? { replyTo: String(replyTo).slice(0, 40) } : {}),
    });
    return { ok: true };
  },
});

