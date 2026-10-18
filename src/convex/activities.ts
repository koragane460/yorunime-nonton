// YoruNime — history, komentar anime (like/reply/populer), favorite, notifikasi.
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { addXpInternal } from "./xp";
import { requireActive } from "./moderation";

// ------------------------------------------------------------ komentar ----

export const recordWatch = mutation({
  args: {
    animeId: v.string(),
    animeTitle: v.string(),
    animeImage: v.optional(v.string()),
    episode: v.number(),
    minutes: v.number(),
  },
  handler: async (ctx, { animeId, animeTitle, animeImage, episode, minutes }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const me = await ctx.db.get(userId);
    if (!me) throw new Error("User not found");
    const existing = await ctx.db
      .query("watchHistory")
      .withIndex("userId_anime", (q) =>
        q.eq("userId", userId).eq("animeId", animeId),
      )
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        episode,
        minutesWatched: existing.minutesWatched + minutes,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("watchHistory", {
        userId,
        animeId,
        animeTitle,
        animeImage,
        episode,
        minutesWatched: minutes,
        updatedAt: Date.now(),
      });
    }
    await addXpInternal(ctx, userId, 10, "watch");
    return { ok: true };
  },
});

/**
 * Simpan posisi playback terakhir (untuk tombol "Lanjutkan" di halaman Info).
 * Tidak menambah XP dan tidak menambah menit nonton — cuma posisi.
 */
export const saveProgress = mutation({
  args: {
    animeId: v.string(),
    animeTitle: v.string(),
    animeImage: v.optional(v.string()),
    episode: v.number(),
    progressSec: v.number(),
    minutesWatched: v.optional(v.number()),
    /** Durasi episode (detik) — biar "Lanjutkan" bisa tampil_progress. */
    durationSec: v.optional(v.number()),
  },
  handler: async (
    ctx,
    { animeId, animeTitle, animeImage, episode, progressSec, minutesWatched, durationSec },
  ) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return { ok: false };
    const existing = await ctx.db
      .query("watchHistory")
      .withIndex("userId_anime", (q) =>
        q.eq("userId", userId).eq("animeId", animeId),
      )
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        episode,
        progressSec: Math.max(0, Math.round(progressSec)),
        minutesWatched: existing.minutesWatched + (minutesWatched ?? 0),
        ...(durationSec ? { durationSec: Math.round(durationSec) } : {}),
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("watchHistory", {
        userId,
        animeId,
        animeTitle,
        animeImage,
        episode,
        minutesWatched: minutesWatched ?? 0,
        progressSec: Math.max(0, Math.round(progressSec)),
        ...(durationSec ? { durationSec: Math.round(durationSec) } : {}),
        updatedAt: Date.now(),
      });
    }
    return { ok: true };
  },
});

/** Riwayat yang belum selesai: sudah nonton tapi masih di bawah 20 menit. */
export const continueWatching = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const rows = await ctx.db
      .query("watchHistory")
      .withIndex("userId_updated", (q) => q.eq("userId", userId))
      .order("desc")
      .take(30);
    return rows
      .filter((r) => (r.minutesWatched ?? 0) > 0 && (r.minutesWatched ?? 0) < 20)
      .map((r) => ({
        _id: r._id,
        animeId: r.animeId,
        animeTitle: r.animeTitle,
        animeImage: r.animeImage,
        episode: r.episode,
        minutesWatched: r.minutesWatched,
        progressSec: r.progressSec ?? 0,
        durationSec: r.durationSec,
        updatedAt: r.updatedAt,
      }));
  },
});

/**
 * "Paling sering" — anime yang paling sering ditonton user, lengkap dengan
 * total menitnya. Dipakai layar "Paling sering" di Home.
 *
 * Dihitung dari SELURUH riwayat (bukan 30 baris terbaru) supaya angka
 * "menit" benar-benar mencerminkan kebiasaan, bukan cuma episode yang kebetulan
 * terakhir dibuka.
 */
export const mostWatched = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit = 12 }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const rows = await ctx.db
      .query("watchHistory")
      .withIndex("userId_updated", (q) => q.eq("userId", userId))
      .order("desc")
      .take(300);

    // Satu baris per anime: episode yang berbeda digabung, lalu diurutkan
    // dari total menit DESC.
    const byAnime = new Map<
      string,
      {
        animeId: string;
        animeTitle: string;
        animeImage?: string;
        minutesWatched: number;
        episodes: number;
        lastEpisode: number;
        lastUpdated: number;
      }
    >();
    for (const r of rows) {
      const cur = byAnime.get(r.animeId);
      if (cur) {
        cur.minutesWatched += r.minutesWatched ?? 0;
        cur.episodes += 1;
        cur.lastEpisode = Math.max(cur.lastEpisode, r.episode);
        cur.lastUpdated = Math.max(cur.lastUpdated, r.updatedAt);
        if (!cur.animeImage && r.animeImage) cur.animeImage = r.animeImage;
      } else {
        byAnime.set(r.animeId, {
          animeId: r.animeId,
          animeTitle: r.animeTitle,
          animeImage: r.animeImage,
          minutesWatched: r.minutesWatched ?? 0,
          episodes: 1,
          lastEpisode: r.episode,
          lastUpdated: r.updatedAt,
        });
      }
    }
    return [...byAnime.values()]
      .sort((a, b) => b.minutesWatched - a.minutesWatched || b.lastUpdated - a.lastUpdated)
      .slice(0, limit);
  },
});

/**
 * Selera genre user — dasar layar "Untuk kamu".
 *
 * Dihitung dari anime yang sering ditonton DAN yang di-favoritkan, lalu
 * dipotong ke genre yang benar-benar sering muncul. Genre dengan sampel
 * terlalu sedikit dibuang supaya rekonstruksi tidak berisi tebakan.
 */
export const genreTaste = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const empty = { sampledCount: 0, genres: [], topAnime: [] };
    if (userId === null) return empty;
    const [history, favs] = await Promise.all([
      ctx.db
        .query("watchHistory")
        .withIndex("userId_updated", (q) => q.eq("userId", userId))
        .order("desc")
        .take(120),
      ctx.db
        .query("animeFavorites")
        .withIndex("userId_created", (q) => q.eq("userId", userId))
        .order("desc")
        .take(60),
    ]);

    // Genre disimpan di cache `genres:<animeId>` oleh aksi animeDetail
    // (lihat anime.ts) supaya query ini tidak perlu memanggil AniList/Jikan
    // dari dalam query — query Convex memang tidak boleh fetch keluar.
    const cacheKey = (animeId: string) => `genres:${animeId}`;
    const ids = [
      ...new Set([...history.map((h) => h.animeId), ...favs.map((f) => f.animeId)]),
    ].slice(0, 60);

    const weights = new Map<string, number>();
    const sampled = new Set<string>();
    for (const animeId of ids) {
      const row = await ctx.db
        .query("animeCache")
        .withIndex("endpoint", (q) => q.eq("endpoint", cacheKey(animeId)))
        .first();
      const payload = row?.payload as { genres?: string[] } | undefined;
      const genres = Array.isArray(payload?.genres) ? payload!.genres! : [];
      if (genres.length === 0) continue;
      sampled.add(animeId);
      // Anime yang sering ditonton bobotnya lebih besar daripada yang cuma
      // masuk favorite.
      const watched = history.find((h) => h.animeId === animeId);
      const faved = favs.find((f) => f.animeId === animeId);
      const w = (watched ? Math.min(3, 1 + (watched.minutesWatched ?? 0) / 120) : 0) + (faved ? 1.5 : 0);
      if (w <= 0) continue;
      for (const gname of genres) {
        weights.set(gname, (weights.get(gname) ?? 0) + w);
      }
    }

    return {
      sampledCount: sampled.size,
      genres: [...weights.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([name, score]) => ({ name, score })),
      // Anime yang jadi rujukan utama user — dipakai untuk "serupa dengan ini".
      topAnime: ids.slice(0, 8),
    };
  },
});

export const myHistory = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    return await ctx.db
      .query("watchHistory")
      .withIndex("userId_updated", (q) => q.eq("userId", userId))
      .order("desc")
      .take(30);
  },
});

/** History anime milik user lain (dipakai di detail akun). */
export const historyOf = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("watchHistory")
      .withIndex("userId_updated", (q) => q.eq("userId", userId))
      .order("desc")
      .take(30);
  },
});

/** Favorite anime milik user lain. */
export const favoritesOf = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("animeFavorites")
      .withIndex("userId_created", (q) => q.eq("userId", userId))
      .take(30);
  },
});

// ===================================================== favorit musik ====
//
// Lagu yang disukai dari layar Musik. Sengaja dibuat terpisah dari favorit
// anime dan SENGAJA privat: query di bawah hanya membaca milik user yang
// sedang masuk, jadi orang lain tidak bisa melihat daftar lagu yang kamu
// suka. Tidak ada query "favoritesOf" untuk tabel ini.

export const toggleMusicLike = mutation({
  args: {
    key: v.string(),
    title: v.string(),
    artist: v.string(),
    videoId: v.optional(v.string()),
    audioUrl: v.optional(v.string()),
    cover: v.optional(v.string()),
    album: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const existing = await ctx.db
      .query("musicLikes")
      .withIndex("userId_key", (q) =>
        q.eq("userId", userId).eq("key", args.key),
      )
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
      return { liked: false };
    }
    await ctx.db.insert("musicLikes", {
      userId,
      key: args.key,
      title: args.title,
      artist: args.artist,
      videoId: args.videoId,
      audioUrl: args.audioUrl,
      cover: args.cover,
      album: args.album,
      createdAt: Date.now(),
    });
    return { liked: true };
  },
});

/**
 * Lagu yang disukai user yang sedang masuk.
 *
 * Tidak menerima userId dari luar dengan sengaja - daftar ini privat.
 */
export const myMusicLikes = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    return await ctx.db
      .query("musicLikes")
      .withIndex("userId_created", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

/** Apakah satu lagu sedang disukai (dipakai tombol hati di pemutar). */
export const isMusicLiked = query({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return false;
    const row = await ctx.db
      .query("musicLikes")
      .withIndex("userId_key", (q) => q.eq("userId", userId).eq("key", key))
      .first();
    return !!row;
  },
});

export const toggleFavorite = mutation({
  args: {
    animeId: v.string(),
    animeTitle: v.string(),
    animeImage: v.optional(v.string()),
  },
  handler: async (ctx, { animeId, animeTitle, animeImage }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const existing = await ctx.db
      .query("animeFavorites")
      .withIndex("userId_anime", (q) =>
        q.eq("userId", userId).eq("animeId", animeId),
      )
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
      return { favorited: false };
    }
    await ctx.db.insert("animeFavorites", {
      userId,
      animeId,
      animeTitle,
      animeImage,
      createdAt: Date.now(),
    });
    return { favorited: true };
  },
});

export const myFavorites = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    return await ctx.db
      .query("animeFavorites")
      .withIndex("userId_anime", (q) => q.eq("userId", userId))
      .collect();
  },
});

/** Jumlah user yang memfavoritkan satu anime — tampil real-time di detail. */
export const favoriteCount = query({
  args: { animeId: v.string() },
  handler: async (ctx, { animeId }) => {
    const rows = await ctx.db
      .query("animeFavorites")
      .filter((q) => q.eq(q.field("animeId"), animeId))
      .take(9999);
    return rows.length;
  },
});

/**
 * Progres nonton terakhir untuk satu anime — dipakai tombol "Lanjutkan
 * menonton episode N" + durasi "00/00" di halaman detail anime.
 */
export const animeProgress = query({
  args: { animeId: v.string() },
  handler: async (ctx, { animeId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const rows = await ctx.db
      .query("watchHistory")
      .withIndex("userId_updated", (q) => q.eq("userId", userId))
      .order("desc")
      .take(50);
    const hit = rows.find((r) => r.animeId === animeId);
    if (!hit) return null;
    const progressSec = Math.max(0, Math.round(hit.progressSec ?? 0));
    const durationSec = Math.max(0, Math.round(hit.durationSec ?? 0));
    return {
      episode: hit.episode,
      progressSec,
      durationSec,
      // Sudah dituntaskan kalau posisinya sudah di menit terakhir.
      finished: durationSec > 0 && progressSec >= durationSec * 0.92,
    };
  },
});

export const isFavorite = query({
  args: { animeId: v.string() },
  handler: async (ctx, { animeId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return false;
    const row = await ctx.db
      .query("animeFavorites")
      .withIndex("userId_anime", (q) =>
        q.eq("userId", userId).eq("animeId", animeId),
      )
      .first();
    return !!row;
  },
});

/** Like/tidak suka satu anime — tombol Like menyatu (bukan like/dislike terpisah). */
export const toggleAnimeLike = mutation({
  args: { animeId: v.string(), value: v.union(v.literal(1), v.literal(-1)) },
  handler: async (ctx, { animeId, value }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const existing = await ctx.db
      .query("animeLikes")
      .withIndex("userId_anime", (q) =>
        q.eq("userId", userId).eq("animeId", animeId),
      )
      .first();
    // Tekan tombol yang sama lagi = batal. Tekan tombol lain = ganti pilihan.
    if (existing && existing.value === value) {
      await ctx.db.delete(existing._id);
      return;
    }
    if (existing) {
      await ctx.db.patch(existing._id, { value });
      return;
    }
    await ctx.db.insert("animeLikes", {
      userId,
      animeId,
      value,
      createdAt: Date.now(),
    });
  },
});

/** Total like + dislike satu anime, serta pilihan user saat ini. */
export const animeLikeStats = query({
  args: { animeId: v.string() },
  handler: async (ctx, { animeId }) => {
    const rows = await ctx.db
      .query("animeLikes")
      .filter((q) => q.eq(q.field("animeId"), animeId))
      .take(99999);
    const userId = await getAuthUserId(ctx);
    let liked = false;
    let disliked = false;
    let likeCount = 0;
    let dislikeCount = 0;
    for (const r of rows) {
      if (r.value === 1) likeCount++;
      else dislikeCount++;
      if (userId && r.userId === userId) {
        liked = r.value === 1;
        disliked = r.value === -1;
      }
    }
    return { likeCount, dislikeCount, total: likeCount + dislikeCount, liked, disliked };
  },
});

// ------------------------------------------------------------ komentar ----

export const listComments = query({
  args: {
    animeId: v.string(),
    sort: v.optional(v.union(v.literal("terbaru"), v.literal("populer"))),
  },
  handler: async (ctx, { animeId, sort = "terbaru" }) => {
    const rows = await ctx.db
      .query("animeComments")
      .withIndex("animeId_created", (q) => q.eq("animeId", animeId))
      .order("desc")
      .take(120);
    const alive = rows.filter((r) => !r.deleted);
    const users = new Map<string, any>();
    const out = [];
    for (const r of alive) {
      let u = users.get(r.userId);
      if (!u) {
        u = await ctx.db.get(r.userId);
        users.set(r.userId, u);
      }
      out.push({
        _id: r._id,
        userId: r.userId,
        username: u?.username ?? "user",
        image: u?.image,
        avatarBorder: u?.avatarBorder,
        bannerUrl: u?.bannerUrl,
        premium: (u?.premiumUntil ?? 0) > Date.now(),
        staffRole: u?.staffRole,
        clanTag: u?.clanTag,
        clanTagIcon: u?.clanTagIcon,
        clanNameColor: u?.clanNameColor,
        clanLevel: u?.clanLevel,
        text: r.text,
        likes: r.likes ?? [],
        likeCount: (r.likes ?? []).length,
        replyToId: r.replyToId,
        createdAt: r.createdAt,
      });
    }
    if (sort === "populer") out.sort((a, b) => b.likeCount - a.likeCount);
    return out;
  },
});

export const postComment = mutation({
  args: {
    animeId: v.string(),
    animeTitle: v.optional(v.string()),
    animeImage: v.optional(v.string()),
    text: v.string(),
    replyToId: v.optional(v.id("animeComments")),
  },
  handler: async (ctx, { animeId, animeTitle, animeImage, text, replyToId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const me = await ctx.db.get(userId);
    if (!me) throw new Error("User not found");
    await requireActive(me);
    if (text.trim().length === 0) throw new Error("Komentar kosong");
    const commentId = await ctx.db.insert("animeComments", {
      animeId,
      animeTitle,
      animeImage,
      userId,
      text: text.trim(),
      replyToId,
      likes: [],
      createdAt: Date.now(),
    });
    // Balasan → notif ke pemilik komentar induk
    if (replyToId) {
      const parent = await ctx.db.get(replyToId);
      if (parent && parent.userId !== userId) {
        await ctx.db.insert("notifications", {
          userId: parent.userId,
          type: "reply",
          title: `${me.username ?? "Seseorang"} membalas komentarmu`,
          body: text.trim().slice(0, 100),
          refUserId: userId,
          createdAt: Date.now(),
        });
      }
    }
    await addXpInternal(ctx, userId, 15, "comment");
    return { commentId };
  },
});

/** Like / unlike komentar anime → notif ke pemilik komentar. */
export const toggleCommentLike = mutation({
  args: { commentId: v.id("animeComments") },
  handler: async (ctx, { commentId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const c = await ctx.db.get(commentId);
    if (!c || c.deleted) throw new Error("Komentar tidak ada");
    const likes = (c.likes ?? []).filter((l) => l !== userId);
    let liked = false;
    if (!likes.some((l) => l === userId) && !(c.likes ?? []).includes(userId)) {
      likes.push(userId);
      liked = true;
    }
    await ctx.db.patch(commentId, { likes });
    if (liked && c.userId !== userId) {
      const me = await ctx.db.get(userId);
      await ctx.db.insert("notifications", {
        userId: c.userId,
        type: "like",
        title: `${me?.username ?? "Seseorang"} menyukai komentarmu`,
        body: c.text.slice(0, 100),
        refUserId: userId,
        createdAt: Date.now(),
      });
    }
    return { liked, likeCount: likes.length };
  },
});

/**
 * Feed komentar untuk halaman Akun: komentar SAYA sendiri, komentar TEMAN,
 * dan komentar DEVELOPER/staff — terbaru dulu.
 */
export const myFriendsComments = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit = 30 }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const me = await ctx.db.get(userId);
    if (!me) return [];

    // Daftar teman (dua arah) — dipakai untuk menyaring komentar yang boleh
    // tampil di feed Akun.
    const friendIds = new Set<string>();
    const friendsA = await ctx.db
      .query("friendships")
      .withIndex("userA", (q) => q.eq("userA", userId))
      .collect();
    const friendsB = await ctx.db
      .query("friendships")
      .withIndex("userB", (q) => q.eq("userB", userId))
      .collect();
    for (const f of [...friendsA, ...friendsB]) {
      friendIds.add(String(f.userA === userId ? f.userB : f.userA));
    }

    // Akun yang boleh muncul: saya, teman-teman, dan developer/staff.
    // Daftar user diambil SEKALI (bukan per komentar) supaya halaman Akun
    // tidak lambat saat dibuka.
    const allowed = new Map<string, any>();
    allowed.set(String(userId), me);
    const users = await ctx.db.query("users").take(600);
    for (const u of users) {
      const isStaff =
        u.role === "admin" ||
        u.staffRole === "dev" ||
        u.staffRole === "creator" ||
        u.staffRole === "mod" ||
        (u.seqId === 1 && !u.staffRole);
      if (isStaff || friendIds.has(String(u._id))) {
        allowed.set(String(u._id), u);
      }
    }

    const rows = await ctx.db.query("animeComments").order("desc").take(250);
    const out = [];
    for (const r of rows) {
      if (r.deleted) continue;
      const u = allowed.get(String(r.userId));
      if (!u) continue;
      // "me" = komentar sendiri, "friend" = teman, "dev" = developer/staff.
      const source =
        String(r.userId) === String(userId)
          ? "me"
          : u.staffRole === "dev" ||
              u.staffRole === "creator" ||
              u.role === "admin" ||
              u.seqId === 1
            ? "dev"
            : "friend";
      // Nomor episode diambil dari animeId (format "<id>__ep<n>").
      const epMatch = /__ep(\d+)$/.exec(String(r.animeId));
      out.push({
        _id: r._id,
        animeId: r.animeId,
        animeTitle: r.animeTitle,
        animeImage: r.animeImage,
        episode: epMatch ? Number(epMatch[1]) : undefined,
        userId: r.userId,
        username: u?.username ?? "user",
        image: u?.image,
        avatarBorder: u?.avatarBorder,
        bannerUrl: u?.bannerUrl,
        premium: (u?.premiumUntil ?? 0) > Date.now(),
        staffRole: u?.staffRole,
        level: u?.level,
        clanTag: u?.clanTag,
        clanTagIcon: u?.clanTagIcon,
        clanNameColor: u?.clanNameColor,
        clanLevel: u?.clanLevel,
        source,
        text: r.text,
        likeCount: (r.likes ?? []).length,
        createdAt: r.createdAt,
      });
      if (out.length >= (limit ?? 30)) break;
    }
    return out;
  },
});

/** Lapor pesan chat → masuk notifikasi developer. */
export const reportChatMessage = mutation({
  args: {
    messageId: v.id("chatMessages"),
    reason: v.string(),
    detail: v.optional(v.string()),
  },
  handler: async (ctx, { messageId, reason, detail }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const msg = await ctx.db.get(messageId);
    if (!msg) throw new Error("Pesan tidak ada");
    const reporter = await ctx.db.get(userId);
    await ctx.db.insert("contentReports", {
      reporterId: userId,
      messageId,
      reason,
      detail,
      text: msg.text ?? undefined,
      createdAt: Date.now(),
    });
    // Notifikasi ke semua developer/mod
    const staff = await ctx.db.query("users").collect();
    for (const s of staff) {
      const isDev =
        s.role === "admin" || s.staffRole === "dev" || s.staffRole === "creator";
      const isMod = isDev || s.staffRole === "mod";
      if (!isDev && !isMod) continue;
      await ctx.db.insert("notifications", {
        userId: s._id,
        type: "report",
        title: `Laporan chat: ${reason}`,
        body: `${reporter?.username ?? "Seseorang"} melaporkan: "${(msg.text ?? "[foto]").slice(0, 80)}"`,
        refMessageId: messageId,
        refUserId: msg.userId,
        createdAt: Date.now(),
      });
    }
    return { ok: true };
  },
});

/** Lapor judul anime (tombol Laporkan di layar nonton) → notifikasi developer. */
export const reportAnime = mutation({
  args: {
    animeId: v.string(),
    animeTitle: v.string(),
    reason: v.string(),
    detail: v.optional(v.string()),
  },
  handler: async (ctx, { animeId, animeTitle, reason, detail }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const reporter = await ctx.db.get(userId);
    await ctx.db.insert("contentReports", {
      reporterId: userId,
      animeId,
      animeTitle,
      reason,
      detail,
      createdAt: Date.now(),
    });
    // Notifikasi ke semua developer / moderator.
    const staff = await ctx.db.query("users").collect();
    for (const s of staff) {
      const isDev =
        s.role === "admin" || s.staffRole === "dev" || s.staffRole === "creator";
      const isMod = isDev || s.staffRole === "mod";
      if (!isDev && !isMod) continue;
      await ctx.db.insert("notifications", {
        userId: s._id,
        type: "report",
        title: `Laporan anime: ${reason}`,
        body: `${reporter?.username ?? "Seseorang"} melaporkan ${animeTitle}${
          detail ? ` — ${detail.slice(0, 100)}` : ""
        }`,
        refUserId: userId,
        createdAt: Date.now(),
      });
    }
    return { ok: true };
  },
});

export const deleteComment = mutation({
  args: { commentId: v.id("animeComments") },
  handler: async (ctx, { commentId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const c = await ctx.db.get(commentId);
    if (!c || c.userId !== userId) throw new Error("Bukan komentar kamu");
    await ctx.db.patch(commentId, { deleted: true });
    return { ok: true };
  },
});

// ------------------------------------------------------- notifikasi ----

export const listNotifications = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit = 30 }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const rows = await ctx.db
      .query("notifications")
      .withIndex("userId_created", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);
    const out = [];
    for (const n of rows) {
      let refImage;
      if (n.refUserId) {
        const u = await ctx.db.get(n.refUserId);
        refImage = u?.image;
      }
      out.push({ ...n, refImage });
    }
    return out;
  },
});

export const markNotificationsRead = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return { ok: false };
    const rows = await ctx.db
      .query("notifications")
      .withIndex("userId_created", (q) => q.eq("userId", userId))
      .order("desc")
      .take(50);
    for (const n of rows) {
      if (!n.read) await ctx.db.patch(n._id, { read: true });
    }
    return { ok: true };
  },
});

/** Simulasi notifikasi update aplikasi (untuk feed notifikasi). */
export const pushUpdateNotice = mutation({
  args: { version: v.string(), description: v.string() },
  handler: async (ctx, { version, description }) => {
    const users = await ctx.db.query("users").collect();
    for (const u of users.slice(0, 200)) {
      await ctx.db.insert("notifications", {
        userId: u._id,
        type: "update",
        title: `Update versi ${version}`,
        body: description,
        createdAt: Date.now(),
      });
    }
    return { ok: true };
  },
});
