// YoruNime — akun: bootstrap profil, pengaturan, banner, leaderboard total.
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { xpForLevel, tierForLevel } from "./users";

export const ensureUser = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const user = await ctx.db.get(userId);
    if (!user) return null;
    const patch: Record<string, unknown> = {};
    if (user.seqId === undefined) {
      // Nomor urut akun: increment counter global supaya #1 dipakai akun pertama
      // (developer) dan seterusnya berurutan.
      const row = await ctx.db
        .query("counters")
        .withIndex("key", (q) => q.eq("key", "userSeq"))
        .first();
      if (row) {
        const next = row.value + 1;
        await ctx.db.patch(row._id, { value: next });
        patch.seqId = next;
      } else {
        await ctx.db.insert("counters", { key: "userSeq", value: 1 });
        patch.seqId = 1;
      }
    }
    await ctx.db.patch(userId, patch);
    return null;
  },
});

export const profileStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const user = await ctx.db.get(userId);
    if (!user) return null;
    const history = await ctx.db
      .query("watchHistory")
      .withIndex("userId_updated", (q) => q.eq("userId", userId))
      .collect();
    const comments = await ctx.db
      .query("animeComments")
      .filter((q: any) => q.eq(q.field("userId"), userId))
      .collect();
    const member = await ctx.db
      .query("clanMembers")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .first();
    const clan = member ? await ctx.db.get(member.clanId) : null;
    return {
      watchCount: history.length,
      commentCount: comments.length,
      minutesWatched: history.reduce((s, h) => s + (h.minutesWatched ?? 0), 0),
      joinedDays: Math.max(
        0,
        Math.floor((Date.now() - (user.createdAt ?? Date.now())) / 86_400_000),
      ),
      // Level clan dipakai warna tag clan di panel akun. Sumber yang sama
      // dengan chat: users.clanLevel, baik-baik saja kalau belum ada salinan.
      clanLevel: user.clanLevel ?? clan?.level ?? 0,
    };
  },
});

export const getPublicProfile = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const u = await ctx.db.get(userId);
    if (!u) return null;
    const member = await ctx.db
      .query("clanMembers")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .first();
    const clan = member ? await ctx.db.get(member.clanId) : null;
    const now = Date.now();
    const history = await ctx.db
      .query("watchHistory")
      .withIndex("userId_updated", (q) => q.eq("userId", userId))
      .collect();
    const comments = await ctx.db
      .query("animeComments")
      .filter((q: any) => q.eq(q.field("userId"), userId))
      .collect();
    const tier = tierForLevel(u.level ?? 1);
    const cost = xpForLevel(u.level ?? 1);
    const xpIn = Math.max(0, Math.min(u.xp ?? 0, cost));
    return {
      _id: u._id,
      seqId: u.seqId,
      username: u.username,
      image: u.image,
      bannerUrl: u.bannerUrl,
      level: u.level ?? 1,
      xp: u.xp ?? 0,
      xpInLevel: xpIn,
      xpCost: cost,
      tier: tier.badge,
      diamonds: u.diamonds ?? 0,
      premium: (u.premiumUntil ?? 0) > now,
      premiumDays: Math.max(0, Math.floor(((u.premiumUntil ?? 0) - now) / 86400000)),
      staffRole: u.staffRole,
      devTagged: (u.devTagUntil ?? 0) > now,
      hideOnline: u.hideOnline,
      clanTag: clan?.tag,
      clanTagIcon: clan?.tagIcon,
      // Level clan menentukan warna nama clan di tag (lihat clanTextClass
      // di lstream-ui.tsx): biru muda / hijau muda / ungu / emas.
      //
      // `users.clanLevel` adalah sumber yang sama dengan yang dipakai chat
      // (lihat chat.ts), jadi warna tag tidak lagi beda antara chat dan
      // panel akun. Kalau user belum punya salinan, dipakai level di
      // dokumen clan.
      clanLevel: u.clanLevel ?? clan?.level ?? 0,
      clanNameColor: u.clanNameColor,
      watchCount: history.length,
      commentCount: comments.length,
      minutesWatched: history.reduce((s, h) => s + (h.minutesWatched ?? 0), 0),
      joinedAt: u.createdAt ?? now,
      myComments: comments
        .sort((a: any, b: any) => b.createdAt - a.createdAt)
        .slice(0, 30)
        .map((cm: any) => ({
          _id: cm._id,
          animeId: cm.animeId,
          animeTitle: cm.animeTitle,
          text: cm.text,
          createdAt: cm.createdAt,
          likeCount: cm.likes?.length ?? 0,
          // Kartu komentar di panel akun memakai gaya yang sama dengan
          // komentar di halaman anime (banner, foto, tag clan, dst.), jadi
          // semua field yang dipakai komponen itu ikut dikirim. Penulisnya
          // pasti pemilik profil ini.
          image: u.image,
          bannerUrl: u.bannerUrl,
          premium: (u.premiumUntil ?? 0) > now,
          staffRole: u.staffRole,
          clanTag: u.clanTag,
          clanTagIcon: u.clanTagIcon,
          clanLevel: u.clanLevel ?? clan?.level ?? 0,
          clanNameColor: u.clanNameColor,
          // Id komentar berbentuk "<animeId>__ep<...>"; angka di ujungnya
          // adalah nomor episode tempat komentar dibuat.
          episode: (() => {
            const m = String(cm.animeId).match(/__ep(\d+)$/);
            return m ? Number(m[1]) : undefined;
          })(),
        })),
    };
  },
});

/**
 * Feed kartu di halaman Akun: komentar anime terbaru dari DEVELOPER
 * (staffRole dev/mod/tester/sepuh/creator) + TEMAN (friendships),anked
 * terbaru dulu. Semua identitas penulis (username, foto, staffRole, premium,
 * tag clan, level clan) ikut dikirim supaya kartunya tampil sama seperti
 * komentar di halaman anime. Banner & judul anime juga dikirim supaya kartu
 * bisa menampilkan banner anime tempat komentar itu dibuat.
 */
export const teamFeed = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit = 50 }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    // Kumpulkan id penulis yang berhak masuk feed: developer + teman.
    const allowed = new Set<string>();
    const staff = await ctx.db.query("users").collect();
    for (const u of staff) {
      if (u.staffRole) allowed.add(u._id);
    }
    const friendships = await ctx.db
      .query("friendships")
      .filter((r) => r.eq(r.field("userA"), userId))
      .collect();
    const friendships2 = await ctx.db
      .query("friendships")
      .filter((r) => r.eq(r.field("userB"), userId))
      .collect();
    for (const f of [...friendships, ...friendships2]) {
      allowed.add(f.userA === userId ? f.userB : f.userA);
    }

    const comments = await ctx.db
      .query("animeComments")
      .withIndex("animeId_created")
      .order("desc")
      .collect();
    const now = Date.now();
    const preview = Math.min(limit, 200);
    const out = [];
    for (const cm of comments) {
      if (out.length >= limit) break;
      if (!allowed.has(cm.userId) || cm.deleted) continue;
      const writer = await ctx.db.get(cm.userId);
      if (!writer) continue;
      // Id komentar berbentuk "<animeId>__ep<N>"; angka di ujung = episode.
      const m = String(cm.animeId).match(/__ep(\d+)$/);
      out.push({
        _id: cm._id,
        animeId: cm.animeId,
        animeTitle: cm.animeTitle,
        text: cm.text,
        createdAt: cm.createdAt,
        likeCount: cm.likes?.length ?? 0,
        episode: m ? Number(m[1]) : undefined,
        writer: {
          username: writer.username,
          image: writer.image,
          premium: (writer.premiumUntil ?? 0) > now,
          staffRole: writer.staffRole,
          level: writer.level ?? 1,
          clanTag: writer.clanTag,
          clanTagIcon: writer.clanTagIcon,
          clanLevel: writer.clanLevel ?? 0,
          clanNameColor: writer.clanNameColor,
        },
      });
      // Batasi iterasi supaya query tidak meluber kalau feed sudah penuh.
      if (out.length >= preview) break;
    }
    return out;
  },
});

export { xpForLevel, tierForLevel };
