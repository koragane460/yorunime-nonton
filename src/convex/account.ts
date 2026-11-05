// YoruNime — akun: bootstrap profil, pengaturan, banner, leaderboard total.
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { xpForLevel, tierForLevel } from "./users";
import type { Id } from "./_generated/dataModel";

export const ensureUser = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const user = await ctx.db.get(userId);
    if (!user) return null;
    const patch: Record<string, unknown> = {};
    if (user.seqId === undefined) {
      const row = await ctx.db
        .query("counters")
        .withIndex("key", (q) => q.eq("key", "userSeq"))
        .first();
      if (row) {
        const next = row.value + 1;
        await ctx.db.patch(row._id, { value: next });
        patch.seqId = Math.max(1, next);
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
    // Poster per anime — dipakai kartu komentar di bawah. Komentar hanya
    // menyimpan id + judul, jadi gambar anime diambil dari riwayat tonton
    // dan favorite user yang sama.
    const favs = await ctx.db
      .query("animeFavorites")
      .withIndex("userId_created", (q) => q.eq("userId", userId))
      .collect();
    const posterByAnime = new Map<string, string>();
    for (const f of favs) {
      if (f.animeImage) posterByAnime.set(f.animeId, f.animeImage);
    }
    for (const h of history) {
      if (h.animeImage && !posterByAnime.has(h.animeId))
        posterByAnime.set(h.animeId, h.animeImage);
    }
    const posterFor = (animeId: string) =>
      posterByAnime.get(String(animeId).split("__ep")[0]) ??
      posterByAnime.get(animeId);
    const comments = await ctx.db
      .query("animeComments")
      .filter((q: any) => q.eq(q.field("userId"), userId))
      .collect();
    const tier = tierForLevel(u.level ?? 1);
    const cost = xpForLevel(u.level ?? 1);
    const xpIn = Math.max(0, Math.min(u.xp ?? 0, cost));
    // ---- Chip di bawah username: jumlah teman + peringkat GIVER / TOP XP ----
    const asA = await ctx.db
      .query("friendships")
      .withIndex("userA", (q) => q.eq("userA", userId))
      .collect();
    const asB = await ctx.db
      .query("friendships")
      .withIndex("userB", (q) => q.eq("userB", userId))
      .collect();
    const friendCount = new Set(
      [...asA, ...asB].map((f) => String(f.userA === userId ? f.userB : f.userA)),
    ).size;
    // Peringkat GIVER: agregasi hari premium yang diberikan, urut desc.
    const gives = await ctx.db.query("premiumGives").collect();
    const giveByUser = new Map<string, number>();
    for (const g of gives) {
      const key = String(g.fromUserId);
      giveByUser.set(key, (giveByUser.get(key) ?? 0) + g.days * g.slots);
    }
    const giverSorted = [...giveByUser.entries()].sort((a, b) => b[1] - a[1]);
    const giverRank =
      giverSorted.findIndex(([uid]) => uid === String(userId)) + 1 || undefined;
    // Peringkat TOP XP total komunitas.
    const allUsers = await ctx.db.query("users").collect();
    const xpSorted = allUsers
      .map((uu) => ({ id: uu._id, xp: uu.xp ?? 0 }))
      .sort((a, b) => b.xp - a.xp);
    const xpRank =
      xpSorted.findIndex((r) => r.id === userId) + 1 || undefined;
    return {
      _id: u._id,
      seqId: u.seqId,
      friendCount,
      giverRank,
      xpRank,
      clanName: clan?.name,
      clanVerified: !!clan?.verified,
      username: u.username,
      image: u.image,
      bannerUrl: u.bannerUrl,
      profileDecor: u.profileDecor ?? null,
      introStyle: u.introStyle ?? null,
      socials: u.socials ?? {},
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
      clanLevel: u.clanLevel ?? clan?.level ?? 0,
      clanNameColor: u.clanNameColor,
      watchCount: history.length,
      commentCount: comments.length,
      minutesWatched: history.reduce((s, h) => s + (h.minutesWatched ?? 0), 0),
      joinedAt: u.createdAt ?? now,
      myComments: comments
        .filter((cm: any) => !cm.deleted)
        .sort((a: any, b: any) => b.createdAt - a.createdAt)
        .slice(0, 30)
        .map((cm: any) => ({
          _id: cm._id,
          animeId: cm.animeId,
          animeTitle: cm.animeTitle,
          animeImage: posterFor(cm.animeId),
          text: cm.text,
          createdAt: cm.createdAt,
          likeCount: cm.likes?.length ?? 0,
          image: u.image,
          bannerUrl: u.bannerUrl,
          premium: (u.premiumUntil ?? 0) > now,
          staffRole: u.staffRole,
          clanTag: u.clanTag,
          clanTagIcon: u.clanTagIcon,
          clanLevel: u.clanLevel ?? clan?.level ?? 0,
          clanNameColor: u.clanNameColor,
          episode: (() => {
            const m = String(cm.animeId).match(/__ep(\d+)$/);
            return m ? Number(m[1]) : undefined;
          })(),
        })),
    };
  },
});

/** Tautan media sosial saya (ringan, untuk Pengaturan & detail akun). */
export const mySocials = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return {};
    const u = await ctx.db.get(userId);
    return u?.socials ?? {};
  },
});

/**
 * TAUTAN MEDIA SOSIAL — simpan handle TikTok / Instagram / Discord /
 * Facebook. Menerima @handle atau URL penuh, disimpan sebagai handle bersih.
 */
export const updateSocials = mutation({
  args: {
    tiktok: v.optional(v.string()),
    instagram: v.optional(v.string()),
    discord: v.optional(v.string()),
    facebook: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const u = await ctx.db.get(userId);
    if (!u) throw new Error("Akun tidak ditemukan");
    const clean = (raw?: string) => {
      if (raw === undefined) return undefined;
      let s = raw.trim();
      if (!s) return "";
      // Buang URL lengkap → ambil bagian handle-nya saja.
      s = s.replace(/^https?:\/\/(www\.)?/i, "");
      s = s.replace(/^(tiktok\.com|instagram\.com|discord\.(gg|com)|facebook\.com)\//i, "");
      s = s.replace(/^@/, "").replace(/\/$/, "");
      s = s.replace(/[<>\s]/g, "");
      if (s.length > 40) throw new Error("Tautan terlalu panjang (maks 40)");
      return s;
    };
    const next = { ...(u.socials ?? {}) };
    const t = clean(args.tiktok);
    const i = clean(args.instagram);
    const d = clean(args.discord);
    const f = clean(args.facebook);
    if (t !== undefined) next.tiktok = t;
    if (i !== undefined) next.instagram = i;
    if (d !== undefined) next.discord = d;
    if (f !== undefined) next.facebook = f;
    await ctx.db.patch(userId, { socials: next });
    return next;
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
    const patch: Record<string, unknown> = {};
    if (username !== undefined) {
      const clean = username.trim().replace(/[^a-zA-Z0-9_]/g, "");
      if (clean.length < 3) throw new Error("Username minimal 3 karakter");
      const clash = await ctx.db
        .query("users")
        .withIndex("username", (q) => q.eq("username", clean))
        .first();
      if (clash && clash._id !== userId)
        throw new Error("Username sudah dipakai");
      patch.username = clean;
    }
    if (image !== undefined) patch.image = image;
    if (bannerUrl !== undefined) {
      // Gambar fullscreen akun (banner) hanya untuk Premium — kecuali
      // sedang MELEPAS (string kosong), itu selalu boleh.
      if (bannerUrl.trim() !== "") {
        const u = await ctx.db.get(userId);
        if ((u?.premiumUntil ?? 0) <= Date.now())
          throw new Error("Fitur ini khusus Premium");
      }
      patch.bannerUrl = bannerUrl;
    }
    if (Object.keys(patch).length > 0) await ctx.db.patch(userId, patch);
    return await ctx.db.get(userId);
  },
});

/**
 * REFRESH PHOTO PROFILE — photo sudah diganti tapi kadang belum kelihatan
 * di orang lain (browser masih menampilkan versi lamanya dari cache / klien
 * belum menerima update). Mutasi ini menambah penanda segar (query/fragment)
 * ke string image sehingga SEMUA klien ikut ter-update dan memuat photo
 * yang benar.
 */
export const refreshPhoto = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Belum masuk");
    const u = await ctx.db.get(userId);
    const img = String(u?.image ?? "");
    if (!img) throw new Error("Belum ada photo profile — ganti dulu lewat tombol kamera");
    const stamp = Date.now();
    let next: string;
    if (img.startsWith("data:")) {
      // Data URL (hasil upload galeri): fragment #r=… memaksa render ulang
      // di semua klien tanpa merusak isi datanya.
      next = `${img.split("#")[0]}#r=${stamp}`;
    } else {
      // URL eksternal (foto dari login Google dsb.): parameter query baru
      // membuat browser mengambil ulang gambarnya dari server.
      const base = img.split("#")[0].replace(/([?&])yn_v=\d+(&)?/, "$1").replace(/[?&]+$/, "");
      next = `${base}${base.includes("?") ? "&" : "?"}yn_v=${stamp}`;
    }
    await ctx.db.patch(userId, { image: next });
    return { ok: true };
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
    /** Animasi intro profil: "awan" | "gagak" | "none". */
    introStyle: v.optional(v.string()),
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

/**
 * Simpan pengaturan BUBBLE CHAT — khusus user premium.
 * Fields: bubbleColor (warna), bubbleBg (URL PNG), bubbleBorder (frame).
 */
/**
 * REWARDS PENGATURAN — klaim sekali per akun, dapat 5000 Sacret.
 * Dipakai tombol "Klaim" di layar Akun → blok Rewards.
 */
export const claimSettingReward = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const u = await ctx.db.get(userId);
    if (!u) throw new Error("User not found");
    if (u.settingsRewardClaimed)
      throw new Error("Rewards sudah diklaim sebelumnya");
    await ctx.db.patch(userId, {
      settingsRewardClaimed: true,
      diamonds: (u.diamonds ?? 0) + 5000,
    });
    return { amount: 5000 };
  },
});

export const saveBubble = mutation({
  args: {
    bubbleColor: v.optional(v.string()),
    bubbleBg: v.optional(v.string()),
    bubbleBorder: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const me = await ctx.db.get(userId);
    if (!me) throw new Error("User not found");
    if ((me.premiumUntil ?? 0) <= Date.now())
      throw new Error("Bubble chat hanya untuk premium user");
    const patch: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(args)) {
      if (val !== undefined) patch[k] = val;
    }
    await ctx.db.patch(userId, patch);
    return await ctx.db.get(userId);
  },
});

/**
 * Top giver premium komunitas: siapa yang paling banyak bagi hari premium
 * lewat chat. Digunakan di halaman Akun (perhitungan title) dan di panel
 * leaderboard Home. Ranking didasarkan pada hari premium yang dikirim
 * (days * slots), bukan nilai nominal.
 */
export const topGive = query({
  // `period` = filter rentang waktu: "7" (7 hari), "30" (30 hari), selain
  // itu = sepanjang masa. Dipakai tombol periode di papan peringkat Home.
  args: { limit: v.optional(v.number()), period: v.optional(v.string()) },
  handler: async (ctx, { limit = 50, period }) => {
    const takes = Math.min(limit ?? 50, 100);
    const since =
      period === "7"
        ? Date.now() - 7 * 86_400_000
        : period === "30"
          ? Date.now() - 30 * 86_400_000
          : 0;
    const gives = (await ctx.db
      .query("premiumGives")
      .withIndex("createdAt")
      .collect()).filter((g) => since === 0 || g._creationTime >= since);
    const byUser: Record<
      string,
      { userId: string; totalDays: number; totalSlots: number; sends: number }
    > = {};
    for (const g of gives) {
      const uid = String(g.fromUserId);
      if (!byUser[uid]) {
        byUser[uid] = { userId: uid, totalDays: 0, totalSlots: 0, sends: 0 };
      }
      byUser[uid].totalDays += g.days;
      byUser[uid].totalSlots += g.slots;
      byUser[uid].sends += 1;
    }
    const rows = Object.values(byUser)
      .map((r) => ({
        ...r,
        score: r.totalDays * r.totalSlots,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, takes);
    const userIds = rows.map((r) => r.userId);
    const userMap = new Map<string, any>();
    for (const uid of userIds) {
      const u = await ctx.db.get(uid as unknown as Id<"users">);
      if (u) userMap.set(uid, u);
    }
    return rows.map((r, i) => {
      const u = userMap.get(r.userId) as any;
      return {
        userId: r.userId,
        // Akun Convex Auth kadang belum punya `username` (hanya `name`),
        // jadi nama tampilan dicari berurutan supaya tidak muncul "-".
        username: u?.username || u?.name,
        image: u?.image,
        days: r.totalDays,
        slots: r.totalSlots,
        sends: r.sends,
        // Profil pendukung biar kartu/grid papan peringkat bisa ikut
        // menampilkan ID, tag clan, bingkai, dan total XP sekaligus.
        seqId: u?.seqId,
        level: u?.level ?? 1,
        clanTag: u?.clanTag,
        clanTagIcon: u?.clanTagIcon,
        avatarBorder: u?.avatarBorder,
        xp: u?.xp ?? 0,
      };
    });
  },
});

/**
 * Peringkat XP total komunitas (bukan periode). Dipakai untuk
 * perhitungan title "Puncak XP" di panel akun dan untuk preview
 * leaderboard singkat di Home. Limit kecil karena hanya untuk
 * perhitungan + preview 5 besar.
 */
export const totalLeaderboard = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit = 20 }) => {
    const users = await ctx.db.query("users").collect();
    const rows = users
      .map((u) => ({
        userId: u._id,
        username: u.username,
        image: u.image,
        xp: u.xp ?? 0,
        level: u.level,
        seqId: u.seqId,
        staffRole: u.staffRole,
        clanTag: u.clanTag,
        clanTagIcon: u.clanTagIcon,
        clanNameColor: u.clanNameColor,
        clanLevel: u.clanLevel,
        premium: (u.premiumUntil ?? 0) > Date.now(),
        givePremiumCount: 0,
      }))
      .sort((a, b) => b.xp - a.xp)
      .slice(0, limit ?? 20);
    return rows.map((r, i) => ({ ...r, rank: i + 1 }));
  },
});

/* ============================================================ SHOP BORDER */

/** Harga border — HARUS sama dengan daftar `BORDERS` di src/lib/borders.ts. */
const BORDER_PRICES: Record<string, number> = {
  aurora: 500,
  tide: 700,
  bloom: 900,
  ember: 1000,
  volt: 1300,
  prisma: 1600,
  royal: 2000,
  storm: 2500,
  nova: 3000,
  magma: 4000,
  holo: 5000,
  wings: 6500,
  cloud: 7500,
  sakura: 2800,
  bubble: 3200,
  starlight: 3800,
  cyber: 5200,
  rosegold: 3600,
  sapphire: 4200,
  imperial: 8500,
  obsidian: 9000,
  halloween: 4500,
  natal: 4800,
  imlek: 5200,
  lebaran: 5000,
};

/** Beli border foto profile pakai Sacret — begitu dibeli langsung dipakai. */
export const buyBorder = mutation({
  args: { borderId: v.string() },
  handler: async (ctx, { borderId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const price = BORDER_PRICES[borderId];
    if (price === undefined) throw new Error("Border tidak dikenal");
    const me = await ctx.db.get(userId);
    if (!me) throw new Error("User not found");
    const owned = me.ownedBorders ?? [];
    if (owned.includes(borderId)) throw new Error("Kamu sudah punya border ini");
    if (!me.unlimitedSacret && (me.diamonds ?? 0) < price)
      throw new Error(
        `Sacret kamu cuma ${(me.diamonds ?? 0).toLocaleString("id-ID")} — butuh ${price.toLocaleString("id-ID")} buat beli border ini`,
      );
    await ctx.db.patch(userId, {
      diamonds: me.unlimitedSacret
        ? (me.diamonds ?? 0)
        : (me.diamonds ?? 0) - price,
      ownedBorders: [...owned, borderId],
      avatarBorder: borderId,
    });
    return { borderId, price };
  },
});

/** HARGA HIASAN DETAIL AKUN (dipakai juga di src/lib/decorations.ts). */
const DECOR_PRICES: Record<string, number> = {
  fire: 1200,
  sakura: 1800,
  pistol: 2200,
  newyear: 3000,
  aurora: 900,
  stardust: 1400,
};

/** Beli hiasan fullscreen detail akun — langsung dipasang setelah dibeli. */
export const buyDecor = mutation({
  args: { decorId: v.string() },
  handler: async (ctx, { decorId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const price = DECOR_PRICES[decorId];
    if (price === undefined) throw new Error("Hiasan tidak dikenal");
    const me = await ctx.db.get(userId);
    if (!me) throw new Error("User not found");
    const owned = me.ownedDecor ?? [];
    if (owned.includes(decorId)) throw new Error("Kamu sudah punya hiasan ini");
    if (!me.unlimitedSacret && (me.diamonds ?? 0) < price)
      throw new Error(
        `Sacret kamu cuma ${(me.diamonds ?? 0).toLocaleString("id-ID")} — butuh ${price.toLocaleString("id-ID")} buat beli hiasan ini`,
      );
    await ctx.db.patch(userId, {
      diamonds: me.unlimitedSacret
        ? (me.diamonds ?? 0)
        : (me.diamonds ?? 0) - price,
      ownedDecor: [...owned, decorId],
      profileDecor: decorId,
    });
    return { decorId, price };
  },
});

/** Pakai hiasan yang sudah dimiliki — "none" berarti tanpa hiasan. */
export const equipDecor = mutation({
  args: { decorId: v.string() },
  handler: async (ctx, { decorId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const me = await ctx.db.get(userId);
    if (!me) throw new Error("User not found");
    if (decorId !== "none" && DECOR_PRICES[decorId] === undefined)
      throw new Error("Hiasan tidak dikenal");
    if (decorId !== "none" && !(me.ownedDecor ?? []).includes(decorId))
      throw new Error("Belum punya hiasan itu — beli dulu di Shop");
    await ctx.db.patch(userId, { profileDecor: decorId });
    return { decorId };
  },
});

/** Pakai border yang sudah dimilik — "none" berarti lepas bingkai. */
export const equipBorder = mutation({
  args: { borderId: v.string() },
  handler: async (ctx, { borderId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const me = await ctx.db.get(userId);
    if (!me) throw new Error("User not found");
    if (borderId !== "none" && BORDER_PRICES[borderId] === undefined)
      throw new Error("Border tidak dikenal");
    if (borderId !== "none" && !(me.ownedBorders ?? []).includes(borderId))
      throw new Error("Belum punya border itu — beli dulu di Shop");
    await ctx.db.patch(userId, { avatarBorder: borderId });
    return { borderId };
  },
});

export { xpForLevel, tierForLevel };
