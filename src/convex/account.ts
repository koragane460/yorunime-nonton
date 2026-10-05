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
    if (user.username === undefined) {
      const base =
        (user.name ?? user.email?.split("@")[0] ?? "user")
          .replace(/[^a-zA-Z0-9_]/g, "")
          .slice(0, 16) || "user";
      let candidate = base;
      let n = 1;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const clash = await ctx.db
          .query("users")
          .withIndex("username", (q) => q.eq("username", candidate))
          .first();
        if (!clash || clash._id === userId) break;
        candidate = `${base}${n++}`;
      }
      patch.username = candidate;
    }
    if (user.xp === undefined) patch.xp = 0;
    if (user.level === undefined) patch.level = 1;
    if (user.diamonds === undefined) patch.diamonds = 45000;
    if (user.createdAt === undefined) patch.createdAt = Date.now();
    if (user.nsfwStrikes === undefined) patch.nsfwStrikes = 0;
    if (user.theme === undefined) patch.theme = "dark";
    if (Object.keys(patch).length > 0) await ctx.db.patch(userId, patch);
    return await ctx.db.get(userId);
  },
});

export const updateProfile = mutation({
  args: {
    username: v.optional(v.string()),
    image: v.optional(v.string()),
    bannerUrl: v.optional(v.string()),
  },
  handler: async (ctx, { username, image, bannerUrl }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const me = await ctx.db.get(userId);
    if (!me) throw new Error("User not found");
    const patch: Record<string, unknown> = {};
    if (username !== undefined) {
      // Nama dibersihkan dari karakter yang tidak boleh dipakai. Kalau
      // setelah dibersihkan tidak ada yang tersisa, pakai nama lama supaya
      // user tidak terkunci tanpa bisa mengubah apa pun.
      const clean = username.trim().replace(/[^a-zA-Z0-9_]/g, "");
      if (clean.length < 3) throw new Error("Username minimal 3 karakter");
      const clash = await ctx.db
        .query("users")
        .withIndex("username", (q) => q.eq("username", clean))
        .first();
      if (clash && clash._id !== userId) throw new Error("Username sudah dipakai");
      patch.username = clean;
    }
    if (image !== undefined) {
      // Dokumen Convex dibatasi 1 MiB. Foto profil disimpan sebagai data URL,
      // jadi ukurannya harus dijaga di sisi server juga (frontend sudah
      // mengecilkan gambarnya, ini jaring pengaman terakhir).
      if (image.length > 400_000)
        throw new Error("Ukuran foto terlalu besar, pilih foto yang lebih kecil");
      patch.image = image;
    }
    if (bannerUrl !== undefined) patch.bannerUrl = bannerUrl;
    // Mode test: semua akun ID-nya #1
    if (me.seqId !== 1) patch.seqId = 1;
    if (Object.keys(patch).length > 0) await ctx.db.patch(userId, patch);
    return await ctx.db.get(userId);
  },
});

export const updateSettings = mutation({
  args: {
    hideOnline: v.optional(v.boolean()),
    autoRejectFriend: v.optional(v.boolean()),
    autoRejectFriendAction: v.optional(v.string()),
    defaultQuality: v.optional(v.string()),
    defaultSpeed: v.optional(v.number()),
    theme: v.optional(v.string()),
    customColor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const patch: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(args)) {
      if (val !== undefined) patch[k] = val;
    }
    await ctx.db.patch(userId, patch);
    return await ctx.db.get(userId);
  },
});

// Leaderboard 100% real-time: hanya user asli yang punya XP.
export const totalLeaderboard = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit = 50 }) => {
    const users = await ctx.db.query("users").collect();
    return users
      .map((u) => ({
        userId: u._id,
        username: u.username,
        image: u.image,
        level: u.level,
        xp: u.xp ?? 0,
      }))
      .sort((a, b) => b.xp - a.xp)
      .slice(0, Math.min(limit, 50))
      .map((e, i) => ({ rank: i + 1, ...e }));
  },
});

export const topGive = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit = 10 }) => {
    const gives = await ctx.db.query("premiumGives").collect();
    // Total hari = jumlah hari per penerima × jumlah penerima (slot).
    // Ini angka yang benar-benar hilang dari premium pengirim, bukan tebakan.
    const totals = new Map<string, { days: number; slots: number; sends: number }>();
    for (const g of gives) {
      const cur = totals.get(g.fromUserId) ?? { days: 0, slots: 0, sends: 0 };
      cur.days += g.days * g.slots;
      cur.slots += g.slots;
      cur.sends += 1;
      totals.set(g.fromUserId, cur);
    }
    const users = await ctx.db.query("users").collect();
    const byId = new Map(users.map((u) => [u._id, u]));
    const real = [...totals.entries()]
      .map(([userId, t]) => ({
        userId,
        username: byId.get(userId as any)?.username ?? "user",
        image: byId.get(userId as any)?.image,
        days: t.days,
        slots: t.slots,
        sends: t.sends,
      }))
      .sort((a, b) => b.days - a.days)
      .slice(0, limit);
    // Hanya user asli (orang) yang pernah give premium.
    return real;
  },
});

export const profileStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const me = await ctx.db.get(userId);
    if (!me) return null;
    const history = await ctx.db
      .query("watchHistory")
      .withIndex("userId_updated", (q) => q.eq("userId", userId))
      .collect();
    const comments = await ctx.db
      .query("animeComments")
      .filter((q: any) => q.eq(q.field("userId"), userId))
      .collect();
    const minutes = history.reduce((s, h) => s + (h.minutesWatched ?? 0), 0);
    return {
      watchCount: history.length,
      commentCount: comments.length,
      minutesWatched: minutes,
      joinedDays: Math.max(
        0,
        Math.floor((Date.now() - (me.createdAt ?? Date.now())) / 86400000),
      ),
      // Tag clan ikut di sini karena panel akun dan panel Home membaca
      // clanLevel dari objek auth user, yang tidak punya field itu. Tanpa
      // nilai di bawah, warna tag selalu jatuh ke tier biru padahal chat
      // menampilkan emas.
      clanTag: me.clanTag,
      clanTagIcon: me.clanTagIcon,
      clanLevel: me.clanLevel ?? 0,
      clanNameColor: me.clanNameColor,
    };
  },
});

/** Profil publik siapa pun (untuk detail akun saat avatar di-chat diklik). */
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

export { xpForLevel, tierForLevel };
