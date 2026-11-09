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

/** Semua id teman viewer — dipakai untuk label "Teman Anda" di feed. */
async function friendIdsFor(ctx: QueryCtx, viewer: string | null) {
  if (!viewer) return new Set<string>();
  const a = await ctx.db
    .query("friendships")
    .withIndex("userA", (q) => q.eq("userA", viewer as any))
    .collect();
  const b = await ctx.db
    .query("friendships")
    .withIndex("userB", (q) => q.eq("userB", viewer as any))
    .collect();
  return new Set(
    [...a, ...b].map((f) => String(f.userA === viewer ? f.userB : f.userA)),
  );
}

/** Gabungkan info user + URL gambar untuk satu post. */
async function decorate(
  ctx: QueryCtx,
  p: any,
  viewer: string | null,
  friendIds?: Set<string>,
) {
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
  const repostRows = await ctx.db
    .query("feedReposts")
    .withIndex("by_post", (q) => q.eq("postId", p._id))
    .order("desc")
    .take(50);
  const reposters = [];
  for (const r of repostRows.slice(0, 2)) {
    const u: any = await ctx.db.get(r.userId);
    reposters.push({
      userId: r.userId,
      username: u?.username ?? "user",
      image: u?.image ?? null,
      createdAt: r.createdAt,
    });
  }
  return {
    postId: p._id,
    userId: p.userId,
    kind: p.kind,
    caption: p.caption ?? "",
    imageUrl,
    thumbUrl,
    imageStorageId: p.imageStorageId ?? null,
    thumbStorageId: p.thumbStorageId ?? null,
    music: p.music ?? null,
    overlay: p.overlay ?? null,
    audio: p.audio ?? null,
    privacy: p.privacy,
    allowComments: p.allowComments !== false,
    allowReuse: p.allowReuse !== false,
    likeCount: (p.likes ?? []).length,
    liked: viewer ? (p.likes ?? []).includes(viewer) : false,
    favoriteCount: (p.favorites ?? []).length,
    favorited: viewer ? (p.favorites ?? []).includes(viewer) : false,
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
    isFriend:
      viewer !== null &&
      viewer !== p.userId &&
      !!friendIds?.has(String(p.userId)),
    repostCount: repostRows.length,
    reposted: viewer ? repostRows.some((r) => String(r.userId) === viewer) : false,
    reposterIds: repostRows.map((r) => String(r.userId)),
    reposters,
  };
}

/** Semua post yang boleh dilihat viewer (publik + milik sendiri). */
export const listFeed = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const viewer = await meOr(ctx);
    const friendIds = await friendIdsFor(ctx, viewer);
    const rows = await ctx.db
      .query("feedPosts")
      .withIndex("by_created", (q) => q)
      .order("desc")
      .take(Math.min(limit ?? 50, 100));
    const out = [];
    for (const p of rows) {
      if (p.privacy === "private" && p.userId !== viewer) continue;
      if (
        p.privacy === "teman" &&
        p.userId !== viewer &&
        !friendIds.has(String(p.userId))
      )
        continue;
      out.push(await decorate(ctx, p, viewer, friendIds));
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
    const friendIds = await friendIdsFor(ctx, viewer);
    if (p.privacy === "private" && p.userId !== viewer) return null;
    if (
      p.privacy === "teman" &&
      p.userId !== viewer &&
      !friendIds.has(String(p.userId))
    )
      return null;
    const d = await decorate(ctx, p, viewer, friendIds);
    return { ...d, cover: d.thumbUrl ?? d.music?.cover ?? null };
  },
});

/** Post milik satu user (untuk grid Konten di detail akun). */
export const userPosts = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const viewer = await meOr(ctx);
    const friendIds = await friendIdsFor(ctx, viewer);
    const rows = await ctx.db
      .query("feedPosts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(100);
    const out = [];
    for (const p of rows) {
      if (p.privacy === "private" && p.userId !== viewer) continue;
      if (
        p.privacy === "teman" &&
        p.userId !== viewer &&
        !friendIds.has(String(p.userId))
      )
        continue;
      const d = await decorate(ctx, p, viewer, friendIds);
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
    privacy: v.union(
      v.literal("all"),
      v.literal("teman"),
      v.literal("private"),
    ),
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
      allowComments: true,
      allowReuse: true,
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

/** Simpan / hapus simpanan post (ikon pita di rail Feed). */
export const toggleFavorite = mutation({
  args: { postId: v.id("feedPosts") },
  handler: async (ctx, { postId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Belum masuk akun");
    const p = await ctx.db.get(postId);
    if (!p) throw new Error("Post tidak ada");
    const favorites = (p.favorites ?? []).filter((l) => l !== userId);
    const favorited = favorites.length === (p.favorites ?? []).length;
    if (favorited) favorites.push(userId);
    await ctx.db.patch(postId, { favorites });
    return { favorited, favoriteCount: favorites.length };
  },
});

/** Daftar yang memposting ulang + tombol batalkan untuk diri sendiri. */
export const listReposters = query({
  args: { postId: v.id("feedPosts") },
  handler: async (ctx, { postId }) => {
    const viewer = await meOr(ctx);
    const rows = await ctx.db
      .query("feedReposts")
      .withIndex("by_post", (q) => q.eq("postId", postId))
      .order("desc")
      .take(100);
    const out = [];
    for (const r of rows) {
      const u: any = await ctx.db.get(r.userId);
      out.push({
        userId: r.userId,
        username: u?.username ?? "user",
        image: u?.image ?? null,
        premium: (u?.premiumUntil ?? 0) > Date.now(),
        createdAt: r.createdAt,
        isMe: viewer === r.userId,
      });
    }
    return { reposters: out, mine: out.some((r) => r.isMe), count: out.length };
  },
});

/** Repost / batalkan repost. */
export const toggleRepost = mutation({
  args: { postId: v.id("feedPosts") },
  handler: async (ctx, { postId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Belum masuk akun");
    const p = await ctx.db.get(postId);
    if (!p) throw new Error("Post tidak ada");
    const existing = await ctx.db
      .query("feedReposts")
      .withIndex("by_pair", (q) => q.eq("postId", postId).eq("userId", userId))
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
      return { reposted: false };
    }
    await ctx.db.insert("feedReposts", { postId, userId, createdAt: Date.now() });
    return { reposted: true };
  },
});

/**
 * Aktivitas terbaru untuk pemilik konten: like, favorit, komentar, repost,
 * dan pengikut baru. Dipakai halaman Kotak Masuk di Feed Mode.
 */
export const activityFeed = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit = 40 }) => {
    const viewer = await meOr(ctx);
    if (!viewer) return [];
    const posts = await ctx.db
      .query("feedPosts")
      .withIndex("by_user", (q) => q.eq("userId", viewer as any))
      .order("desc")
      .take(24);
    const events: any[] = [];

    for (const p of posts) {
      let cover: string | null = null;
      const mediaId = p.thumbStorageId ?? p.imageStorageId;
      if (mediaId) {
        try {
          cover = await ctx.storage.getUrl(mediaId);
        } catch {
          cover = null;
        }
      }
      const pushEvent = async (
        type: string,
        uid: string,
        createdAt: number,
        detail?: string,
      ) => {
        if (String(uid) === String(viewer)) return;
        const u: any = await ctx.db.get(uid as any);
        events.push({
          _id: `${type}:${p._id}:${uid}:${createdAt}`,
          type,
          userId: uid,
          username: u?.username ?? "user",
          image: u?.image ?? null,
          postId: p._id,
          caption: (p.caption ?? "").slice(0, 90),
          cover,
          detail,
          createdAt,
        });
      };

      for (const uid of p.likes ?? []) {
        await pushEvent("like", String(uid), p.createdAt);
      }
      for (const uid of p.favorites ?? []) {
        await pushEvent("favorite", String(uid), p.createdAt);
      }
      const reposts = await ctx.db
        .query("feedReposts")
        .withIndex("by_post", (q) => q.eq("postId", p._id))
        .order("desc")
        .take(10);
      for (const r of reposts) {
        await pushEvent("repost", String(r.userId), r.createdAt);
      }
      const comments = await ctx.db
        .query("feedComments")
        .withIndex("by_post", (q) => q.eq("postId", p._id))
        .order("desc")
        .take(10);
      for (const c of comments) {
        await pushEvent(
          "comment",
          String(c.userId),
          c.createdAt,
          c.text?.slice(0, 100),
        );
      }
    }

    const followers = await ctx.db
      .query("follows")
      .withIndex("by_following", (q) => q.eq("followingId", viewer as any))
      .order("desc")
      .take(30);
    for (const f of followers) {
      const u: any = await ctx.db.get(f.followerId);
      events.push({
        _id: `follow:${f._id}`,
        type: "follow",
        userId: f.followerId,
        username: u?.username ?? "user",
        image: u?.image ?? null,
        postId: null,
        caption: "",
        cover: null,
        detail: undefined,
        createdAt: f.createdAt,
      });
    }

    events.sort((a, b) => b.createdAt - a.createdAt);
    return events.slice(0, Math.min(limit, 100));
  },
});

/** Laporkan konten Feed → catat laporan + notifikasi ke moderator. */
export const reportPost = mutation({
  args: {
    postId: v.id("feedPosts"),
    reason: v.string(),
    detail: v.optional(v.string()),
  },
  handler: async (ctx, { postId, reason, detail }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Belum masuk akun");
    const post = await ctx.db.get(postId);
    if (!post) throw new Error("Konten tidak ditemukan");
    const reporter: any = await ctx.db.get(userId);
    await ctx.db.insert("contentReports", {
      reporterId: userId,
      feedPostId: postId,
      targetUserId: post.userId,
      reason,
      detail,
      text: post.caption || `[${post.kind}]`,
      createdAt: Date.now(),
    });
    const users = await ctx.db.query("users").collect();
    for (const s of users) {
      const isDev =
        s.role === "admin" || s.staffRole === "dev" || s.staffRole === "creator";
      const isMod = isDev || s.staffRole === "mod";
      if (!isMod) continue;
      await ctx.db.insert("notifications", {
        userId: s._id,
        type: "report",
        title: `Laporan konten Feed: ${reason}`,
        body: `${reporter?.username ?? "Seseorang"} melaporkan: "${(post.caption ?? `[${post.kind}]`).slice(0, 80)}"`,
        refUserId: post.userId,
        createdAt: Date.now(),
      });
    }
    return { ok: true };
  },
});

/** Tambah 1 view + simpan penonton unik untuk sheet "Dilihat oleh". */
export const addView = mutation({
  args: { postId: v.id("feedPosts") },
  handler: async (ctx, { postId }) => {
    const p = await ctx.db.get(postId);
    if (!p) return { ok: false };
    const userId = await meOr(ctx);
    if (userId) {
      const seen = await ctx.db
        .query("feedViews")
        .withIndex("by_pair", (q) =>
          q.eq("postId", postId).eq("userId", userId as any),
        )
        .first();
      if (!seen) {
        await ctx.db.insert("feedViews", {
          postId,
          userId: userId as any,
          createdAt: Date.now(),
        });
      }
    }
    await ctx.db.patch(postId, { views: (p.views ?? 0) + 1 });
    return { ok: true };
  },
});

/** Daftar penonton satu konten (terbaru di atas). */
export const postViewers = query({
  args: { postId: v.id("feedPosts") },
  handler: async (ctx, { postId }) => {
    const post = await ctx.db.get(postId);
    const viewer = await meOr(ctx);
    if (!post || !viewer || String(post.userId) !== String(viewer)) return [];
    const rows = await ctx.db
      .query("feedViews")
      .withIndex("by_post", (q) => q.eq("postId", postId))
      .order("desc")
      .take(200);
    const out = [];
    for (const row of rows) {
      const u: any = await ctx.db.get(row.userId);
      if (!u) continue;
      out.push({
        userId: row.userId,
        username: u.username ?? "user",
        image: u.image ?? null,
        premium: (u.premiumUntil ?? 0) > Date.now(),
        createdAt: row.createdAt,
      });
    }
    return out;
  },
});

/** Ubah siapa yang bisa menonton, izin komentar, dan izin penggunaan ulang. */
export const updatePostSettings = mutation({
  args: {
    postId: v.id("feedPosts"),
    privacy: v.optional(
      v.union(v.literal("all"), v.literal("teman"), v.literal("private")),
    ),
    allowComments: v.optional(v.boolean()),
    allowReuse: v.optional(v.boolean()),
  },
  handler: async (ctx, { postId, privacy, allowComments, allowReuse }) => {
    const userId = await meOr(ctx);
    if (!userId) throw new Error("Belum masuk akun");
    const p = await ctx.db.get(postId);
    if (!p) throw new Error("Post tidak ada");
    if (String(p.userId) !== String(userId))
      throw new Error("Hanya pemilik konten yang bisa mengubah privasi");
    const patch: Record<string, unknown> = {};
    if (privacy !== undefined) patch.privacy = privacy;
    if (allowComments !== undefined) patch.allowComments = allowComments;
    if (allowReuse !== undefined) patch.allowReuse = allowReuse;
    if (Object.keys(patch).length) await ctx.db.patch(postId, patch);
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
    const viewer = await meOr(ctx);
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
        likeCount: (c.likes ?? []).length,
        liked: viewer ? (c.likes ?? []).includes(viewer as any) : false,
      });
    }
    return out;
  },
});

/** Like / batal like satu komentar. */
export const toggleCommentLike = mutation({
  args: { commentId: v.id("feedComments") },
  handler: async (ctx, { commentId }) => {
    const viewer = await meOr(ctx);
    if (!viewer) throw new Error("Belum masuk akun");
    const c = await ctx.db.get(commentId);
    if (!c) throw new Error("Komentar tidak ada");
    const likes = (c.likes ?? []).filter((id) => String(id) !== String(viewer));
    const liked = likes.length === (c.likes ?? []).length;
    if (liked) likes.push(viewer as any);
    await ctx.db.patch(commentId, { likes });
    return { liked, likeCount: likes.length };
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
    if (p.allowComments === false)
      throw new Error("Pemilik konten menonaktifkan komentar");
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

