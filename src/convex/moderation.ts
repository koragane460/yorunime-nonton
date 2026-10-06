// YoruNime — backend untuk Developer Panel & Moderator Panel.
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";

export const PERMANENT = 253402300799000; // 9999-12-31, dipakai sebagai "permanen".

/** Dipakai mutasi lain untuk menolak user yang dimute/banned. */
export async function requireActive(me: {
  bannedUntil?: number;
  mutedUntil?: number;
}) {
  const now = Date.now();
  if ((me.bannedUntil ?? 0) > now)
    throw new Error("Akun kamu sedang dibanned");
  if ((me.mutedUntil ?? 0) > now)
    throw new Error("Kamu sedang dimute");
}

export const isBlockedInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return false;
    const me = await ctx.db.get(userId);
    if (!me) return false;
    return (
      (me.bannedUntil ?? 0) > Date.now() || (me.mutedUntil ?? 0) > Date.now()
    );
  },
});

export const blockStatus = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const me = await ctx.db.get(userId);
    if (!me) return null;
    const now = Date.now();
    if ((me.bannedUntil ?? 0) > now)
      return {
        type: "banned" as const,
        permanent: (me.bannedUntil ?? 0) >= PERMANENT,
        until: me.bannedUntil,
        reason: me.bannedReason ?? "",
      };
    if ((me.mutedUntil ?? 0) > now)
      return {
        type: "muted" as const,
        permanent: (me.mutedUntil ?? 0) >= PERMANENT,
        until: me.mutedUntil,
        reason: me.mutedReason ?? "",
      };
    return null;
  },
});

/** Hitung durasi dari nilai + satuan (hari/minggu/bulan/tahun). */
export function durationMs(value: number, unit: string): number {
  const n = Math.max(0, Math.floor(value));
  switch (unit) {
    case "jam":
      return n * 3_600_000;
    case "menit":
      return n * 60_000;
    case "minggu":
      return n * 7 * 86_400_000;
    case "bulan":
      return n * 30 * 86_400_000;
    case "tahun":
      return n * 365 * 86_400_000;
    default:
      return n * 86_400_000;
  }
}

const UNIT_MS = (u: string) => durationMs(1, u);

export async function staffGuard(ctx: any, need: "dev" | "mod") {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error("Not signed in");
  const me = await ctx.db.get(userId);
  if (!me) throw new Error("Not signed in");
  // Akses staff mengikuti role asli user. Sebelumnya `isDev`/`isMod` di-hardcode
  // `true` (mode uji), sehingga setiap akun punya title Developer dan bisa
  // membuka panel developer — itu yang membuat semua orang terlihat
  // developer. ID 1 tetap developer asli dan tidak bisa diturunkan.
  const role = String(me.role ?? "").toLowerCase();
  const isDev = role === "dev" || role === "creator" || Number(me.seqId ?? 0) === 1;
  const isMod = isDev || role === "mod";
  if (need === "dev" && !isDev) throw new Error("Hanya developer");
  if (need === "mod" && !isMod) throw new Error("Hanya moderator/developer");
  return { userId, me };
}

/** Level akses panel untuk user yang sedang login. */
export const myPanelAccess = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null)
      return { level: "none" as const, adult: false, username: null };
    const me = await ctx.db.get(userId);
    if (!me)
      return { level: "none" as const, adult: false, username: null };
    // Akses panel mengikuti role asli akun — TIDAK ada lagi mode uji yang
    // menganggap semua orang developer. Sebelumnya `isDev` hardcode `true`
    // di sini, sehingga tombol "Info developer" muncul untuk semua user.
    // Dev asli: role dev/creator, atau seqId 1 (pemilik pertama).
    const role = String(me.role ?? "").toLowerCase();
    const isDev =
      role === "dev" ||
      role === "creator" ||
      String(me.staffRole ?? "").toLowerCase() === "dev" ||
      Number(me.seqId ?? 0) === 1;
    const isMod = isDev || role === "mod" || String(me.staffRole ?? "") === "mod";
    // 18+ tetap mengikuti izin yang diberikan panel dev, plus staff.
    const adult = isDev || isMod || !!me.staffRole || me.adultAccess === true;
    if (isDev)
      return { level: "dev" as const, adult, username: me.username ?? null };
    if (isMod)
      return { level: "mod" as const, adult, username: me.username ?? null };
    return { level: "none" as const, adult, username: me.username ?? null };
  },
});

/** Daftar user untuk panel dev (penuh) & panel moderator (baca saja). */
export const panelUsers = query({
  args: { q: v.optional(v.string()) },
  handler: async (ctx, { q }) => {
    await staffGuard(ctx, "mod");
    const needle = (q ?? "").trim().toLowerCase();
    const all = await ctx.db.query("users").collect();
    const now = Date.now();
    return all
      .filter((u) => (needle ? (u.username ?? "").toLowerCase().includes(needle) : true))
      .sort((a, b) => (a.seqId ?? 0) - (b.seqId ?? 0))
      .slice(0, needle ? 20 : 60)
      .map((u) => ({
        _id: u._id,
        username: u.username ?? "user",
        image: u.image,
        seqId: u.seqId,
        staffRole: u.staffRole,
        diamonds: u.diamonds ?? 0,
        unlimitedSacret: !!u.unlimitedSacret,
        unlimitedPremium: !!u.unlimitedPremium,
        premiumUntil: u.premiumUntil ?? 0,
        level: u.level ?? 1,
        clanTag: u.clanTag,
        clanNameColor: u.clanNameColor,
        clanLevel: u.clanLevel,
        banned: (u.bannedUntil ?? 0) > now,
        bannedPermanent: (u.bannedUntil ?? 0) >= PERMANENT,
        bannedUntil: u.bannedUntil ?? 0,
        bannedReason: u.bannedReason ?? "",
        muted: (u.mutedUntil ?? 0) > now,
        mutedPermanent: (u.mutedUntil ?? 0) >= PERMANENT,
        mutedUntil: u.mutedUntil ?? 0,
        mutedReason: u.mutedReason ?? "",
        adultAccess: u.adultAccess === true,
      }));
  },
});

const TITLE_LABEL: Record<string, string> = {
  dev: "Developer",
  mod: "Moderator",
  tester: "Tester",
  sepuh: "Sepuh",
};

/** Kasih / copot title. Pencet title yang sama -> title dilepas (toggle). */
export const toggleTitle = mutation({
  args: {
    targetId: v.id("users"),
    title: v.union(
      v.literal("dev"),
      v.literal("mod"),
      v.literal("tester"),
      v.literal("sepuh"),
    ),
  },
  handler: async (ctx, { targetId, title }) => {
    await staffGuard(ctx, "dev");
    const target = await ctx.db.get(targetId);
    if (!target) throw new Error("User tidak ada");
    const same = target.staffRole === title;
    await ctx.db.patch(targetId, {
      staffRole: same ? undefined : title,
    });
    await ctx.db.insert("notifications", {
      userId: targetId,
      type: "moderation",
      title: same
        ? "Title dilepas"
        : `Kamu dapat title ${TITLE_LABEL[title]}`,
      body: same
        ? `Title ${TITLE_LABEL[title]} sudah dicabut.`
        : `Sekarang kamu jadi ${TITLE_LABEL[title]}.`,
      createdAt: Date.now(),
    });
    return { granted: !same, title: same ? undefined : title };
  },
});

/** Unlimited Sacret / premium — toggle. */
export const toggleUnlimited = mutation({
  args: {
    targetId: v.id("users"),
    what: v.union(v.literal("sacret"), v.literal("premium")),
  },
  handler: async (ctx, { targetId, what }) => {
    await staffGuard(ctx, "dev");
    const target = await ctx.db.get(targetId);
    if (!target) throw new Error("User tidak ada");
    const field = what === "sacret" ? "unlimitedSacret" : "unlimitedPremium";
    const next = !(target[field] ?? false);
    await ctx.db.patch(targetId, { [field]: next });
    await ctx.db.insert("notifications", {
      userId: targetId,
      type: "moderation",
      title: next
        ? `Unlimited ${what === "sacret" ? "Sacret" : "Premium"} aktif`
        : `Unlimited ${what === "sacret" ? "Sacret" : "Premium"} dimatikan`,
      body: next
        ? `Kamu sekarang punya ${what === "sacret" ? "Sacret" : "Premium"} tanpa batas.`
        : "Batas normal kembali berlaku.",
      createdAt: Date.now(),
    });
    return { unlimited: next };
  },
});

/** Ban / unban / mute / unmute dengan durasi bebas. */
export const moderate = mutation({
  args: {
    targetId: v.id("users"),
    action: v.union(
      v.literal("mute"),
      v.literal("unmute"),
      v.literal("ban"),
      v.literal("unban"),
    ),
    permanent: v.boolean(),
    value: v.optional(v.number()),
    unit: v.optional(v.string()),
    reason: v.string(),
  },
  handler: async (ctx, { targetId, action, permanent, value, unit, reason }) => {
    await staffGuard(ctx, "mod");
    if ((action === "ban" || action === "mute") && reason.trim().length === 0)
      throw new Error("Pesan/alasan wajib diisi");
    const now = Date.now();
    const until = permanent
      ? PERMANENT
      : now + Math.max(UNIT_MS(unit ?? "hari"), durationMs(value ?? 1, unit ?? "hari"));

    if (action === "mute") {
      await ctx.db.patch(targetId, { mutedUntil: until, mutedReason: reason });
    } else if (action === "unmute") {
      await ctx.db.patch(targetId, { mutedUntil: 0, mutedReason: undefined });
    } else if (action === "ban") {
      await ctx.db.patch(targetId, { bannedUntil: until, bannedReason: reason });
    } else {
      await ctx.db.patch(targetId, { bannedUntil: 0, bannedReason: undefined });
    }

    const titles: Record<string, string> = {
      mute: permanent ? "Kamu dimute selamanya" : "Kamu dimute sementara",
      unmute: "Mute dicabut",
      ban: permanent ? "Akun kamu dibanned permanen" : "Akun kamu dibanned sementara",
      unban: "Ban dicabut",
    };
    await ctx.db.insert("notifications", {
      userId: targetId,
      type: "moderation",
      title: titles[action],
      body: reason || "Tidak ada keterangan",
      createdAt: now,
    });
    return { ok: true, until: permanent ? PERMANENT : until };
  },
});

/** Dev: kirim broadcast ke semua user lewat halaman Pemberitahuan. */
export const broadcast = mutation({
  args: { title: v.string(), body: v.string() },
  handler: async (ctx, { title, body }) => {
    await staffGuard(ctx, "dev");
    if (!title.trim()) throw new Error("Title pesan wajib diisi");
    if (!body.trim()) throw new Error("Isi pesan wajib diisi");
    const users = await ctx.db.query("users").collect();
    for (const u of users) {
      await ctx.db.insert("notifications", {
        userId: u._id,
        type: "broadcast",
        title: title.trim(),
        body: body.trim(),
        createdAt: Date.now(),
      });
    }
    return { sent: users.length };
  },
});

/** Apakah user boleh memakai pencarian 18+ (semua staff). */
export const adultAccess = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const me = await ctx.db.get(userId);
    if (!me) return false;
    return me.role === "admin" || !!me.staffRole;
  },
});

/** Notifikasi milik user yang sedang login (broadcast developer, dll). */
export const myNotifications = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit = 20 }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const rows = await ctx.db
      .query("notifications")
      .withIndex("userId_created", (q) => q.eq("userId", userId))
      .collect();
    const out: {
      _id: string;
      type: string;
      title: string;
      body: string;
      read: boolean;
      createdAt: number;
      refUserId?: string;
      refUsername?: string;
      refImage?: string;
    }[] = [];
    for (const n of rows.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit)) {
      let refUserId: string | undefined;
      let refUsername: string | undefined;
      let refImage: string | undefined;
      if (n.refUserId) {
        refUserId = n.refUserId as unknown as string;
        const ref = await ctx.db.get(n.refUserId);
        if (ref) {
          refUsername = ref.username ?? undefined;
          refImage = ref.image ?? undefined;
        }
      }
      out.push({
        _id: n._id,
        type: n.type,
        title: n.title,
        body: n.body ?? "",
        read: !!n.read,
        createdAt: n.createdAt,
        refUserId,
        refUsername,
        refImage,
      });
    }
    return out;
  },
});

/**
 * Jumlah notifikasi yang belum dibaca — dipakai lonceng merah di tombol Notif.
 *
 * Query terpisah (bukan dari myNotifications) supaya lonceng di mana saja
 * bisa menampilkan angka tanpa menarik isi notifikasi yang tidak perlu dibuka.
 */
export const myUnreadCount = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return 0;
    const rows = await ctx.db
      .query("notifications")
      .withIndex("userId_created", (q) => q.eq("userId", userId))
      .order("desc")
      .take(50);
    let unread = 0;
    for (const n of rows) if (!n.read) unread += 1;
    return unread;
  },
});

/**
 * Bersihkan notifikasi sendiri.
 *
 * Aturan: yang tampil cuma 20 terbaru. Sisanya dibuang, tapi hanya kalau
 * notifikasi itu sudah berumur lebih dari 10 menit ATAU sudah dibaca —
 * jadi pesan yang belum sempat dibaca tidak hilang diam-diam.
 */
export const pruneMyNotifications = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return { removed: 0 };
    const KEEP = 20;
    const GRACE_MS = 10 * 60 * 1000;
    const now = Date.now();
    const rows = await ctx.db
      .query("notifications")
      .withIndex("userId_created", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
    let removed = 0;
    for (let i = 0; i < rows.length; i += 1) {
      const n = rows[i];
      if (i < KEEP) continue;
      const oldEnough = now - n.createdAt > GRACE_MS;
      if (!oldEnough && !n.read) continue;
      await ctx.db.delete(n._id);
      removed += 1;
    }
    return { removed };
  },
});

/** Dev-only: beri premium ke semua member clan. */
export const devGiveClanPremium = mutation({
  args: {
    clanId: v.id("clans"),
    value: v.number(),
    unit: v.string(),
    label: v.optional(v.string()),
  },
  handler: async (ctx, { clanId, value, unit }) => {
    await staffGuard(ctx, "dev");
    const ms = Math.max(UNIT_MS(unit), durationMs(value, unit));
    const members = await ctx.db
      .query("clanMembers")
      .withIndex("clanId", (q) => q.eq("clanId", clanId))
      .collect();
    const now = Date.now();
    for (const m of members) {
      const u = await ctx.db.get(m.userId);
      if (!u) continue;
      const base = Math.max(now, u.premiumUntil ?? 0);
      await ctx.db.patch(m.userId, { premiumUntil: base + ms });
      await ctx.db.insert("notifications", {
        userId: m.userId,
        type: "clan_premium",
        title: "Premium untuk clan",
        body: `Clan kamu dapat premium ${value} ${unit}.`,
        createdAt: now,
      });
    }
    return { count: members.length };
  },
});

/** Cari user berdasarkan username persis (dipakai panel dev). */
export const findByExactUsername = query({
  args: { username: v.string() },
  handler: async (ctx, { username }) => {
    await staffGuard(ctx, "mod");
    const clean = username.trim().replace(/^@/, "");
    const row = await ctx.db
      .query("users")
      .withIndex("username", (q) => q.eq("username", clean))
      .first();
    if (!row) return null;
    return { _id: row._id, username: row.username ?? clean, image: row.image };
  },
});

/** Developer memberi / mencabut izin akses konten 18+ ke satu user. */
export const toggleAdultAccess = mutation({
  args: { targetId: v.id("users") },
  handler: async (ctx, { targetId }) => {
    await staffGuard(ctx, "dev");
    const u = await ctx.db.get(targetId);
    if (!u) throw new Error("User tidak ada");
    const next = !(u.adultAccess === true);
    await ctx.db.patch(targetId, { adultAccess: next });
    if (next) {
      await ctx.db.insert("notifications", {
        userId: targetId,
        type: "info",
        title: "Akses 18+ diberikan",
        body: "Kamu bisa mengaktifkan toggle 18+ di pencarian anime.",
        createdAt: Date.now(),
      });
    }
    return { adultAccess: next };
  },
});



/** Clan yang bisa dipilih di panel dev. */
export const panelClans = query({
  args: {},
  handler: async (ctx) => {
    await staffGuard(ctx, "dev");
    const clans = await ctx.db.query("clans").collect();
    const out = [];
    for (const c of clans) {
      const n = await ctx.db
        .query("clanMembers")
        .withIndex("clanId", (q) => q.eq("clanId", c._id))
        .collect();
      out.push({
        _id: c._id,
        name: c.name,
        tag: c.tag,
        members: n.length,
      });
    }
    return out.sort((a, b) => b.members - a.members);
  },
});

/** Mod/dev: cari user untuk panel. */
export const searchUsersPanel = query({
  args: { q: v.string() },
  handler: async (ctx, { q }) => {
    await staffGuard(ctx, "mod");
    const needle = q.trim().toLowerCase();
    if (needle.length === 0) return [];
    const all = await ctx.db.query("users").collect();
    return all
      .filter((u) => (u.username ?? "").toLowerCase().includes(needle))
      .slice(0, 10)
      .map((u) => ({
        _id: u._id,
        username: u.username,
        staffRole: u.staffRole,
        mutedUntil: u.mutedUntil,
        bannedUntil: u.bannedUntil,
      }));
  },
});

/** Title milik user lain (dipakai supaya tag ikut muncul di chat/komen). */
export const titlesOf = internalQuery({
  args: { userIds: v.array(v.id("users")) },
  handler: async (ctx, { userIds }) => {
    const map: Record<string, string> = {};
    for (const id of userIds) {
      const u = await ctx.db.get(id);
      if (u?.staffRole) map[id] = u.staffRole;
    }
    return map;
  },
});

// ====================================================== pengumuman popup ====
/**
 * Pengumuman yang tampil sebagai kotak popup saat user membuka website.
 * Hanya pesan aktif yang dikirim ke publik; developer bisa membuat,
 * menonaktifkan, dan menghapus lewat StaffPanel.
 */
export const activeAnnouncements = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("announcements")
      .order("desc")
      .take(20);
    return rows
      .filter((r) => r.active)
      .map((r) => ({ _id: r._id, message: r.message, createdAt: r.createdAt }));
  },
});

/** Semua pengumuman (termasuk nonaktif) — khusus developer. */
export const allAnnouncements = query({
  args: {},
  handler: async (ctx) => {
    await staffGuard(ctx, "dev");
    return await ctx.db.query("announcements").order("desc").take(50);
  },
});

export const createAnnouncement = mutation({
  args: { message: v.string() },
  handler: async (ctx, { message }) => {
    await staffGuard(ctx, "dev");
    const text = message.trim();
    if (!text) throw new Error("Pesan kosong");
    await ctx.db.insert("announcements", {
      message: text,
      active: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});

/**
 * Bersihkan data uji: semua clan dan semua user dihapus, kecuali
 *  - akun ID 1 (developer asli)
 *  - akun yang punya title staff (dev/moderator/creator/tester/sepuh)
 *  - akun anonim (login TANPA email, bukan user asli)
 *
 * TIDAK menghapus cache anime, pengaturan, pengumuman, dan riwayat
 * pembelian. Leaderboard, Top Give, dan request pertemanan ikut hilang karena
 * datanya diambil dari user/clan.
 *
 * Tindakan ini tidak bisa dibatalkan.
 */
// ==================================================== versi aplikasi ====

/**
 * Paksa user update.
 *
 * App menyimpan versi terakhir yang diketahui server. Kalau versi yang
 * disimpan lebih besar dari versi build ini, berarti app-nya sudah_release
 * baru dan user perlu buka lagi supaya file barunya terunduh.
 */
export const appVersion = query({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db
      .query("appSettings")
      .withIndex("key", (q: any) => q.eq("key", "minVersion"))
      .first();
    return {
      // Versi minimum yang WAJIB dipakai. Kosong = belum ada paksaan update.
      minVersion: String(row?.value ?? ""),
    };
  },
});

/** Developer mengubah versi minimum dari panel. */
export const setMinVersion = mutation({
  args: { version: v.string() },
  handler: async (ctx, { version }) => {
    await staffGuard(ctx, "dev");
    const value = version.trim();
    const existing = await ctx.db
      .query("appSettings")
      .withIndex("key", (q: any) => q.eq("key", "minVersion"))
      .first();
    if (!value) {
      if (existing) await ctx.db.delete(existing._id);
      return { ok: true, minVersion: "" };
    }
    if (existing) await ctx.db.patch(existing._id, { value });
    else await ctx.db.insert("appSettings", { key: "minVersion", value });
    return { ok: true, minVersion: value };
  },
});

/**
 * Jaringan bawaan YoruNime.
 *
 * Angka ini bukan speedtest beneran, cuma indikator ambience yang dibuat
 * developer supaya terlihat "koneksi bagus" waktu app lagi ngemuat data.
 * Tidak ada request tambahan, jadi tidak menambah beban jaringan.
 */
export const netStatus = query({
  args: {},
  handler: async (ctx) => {
    await staffGuard(ctx, "dev");
    const t0 = Date.now();
    // Satu pembacaan ringan supaya angkanya bukan angka asal.
    await ctx.db.query("counters").take(1);
    const rtt = Date.now() - t0;
    return {
      label: "YoruNime Net",
      // 200 Mbps sebagai angka andalan, sedikit berfluktuasi supaya terlihat hidup.
      downMbps: 200,
      pingMs: Math.max(4, Math.min(28, rtt * 3 + 9)),
      at: t0,
    };
  },
});

export const resetTestData = mutation({
  args: {},
  handler: async (ctx) => {
    await staffGuard(ctx, "dev");

    /** User yang boleh disimpan. */
    const keepUser = (u: any) =>
      u.seqId === 1 ||
      u.role === "admin" ||
      !!u.staffRole ||
      // Akun anonim: dibuat Convex Auth tanpa email.
      (u.isAnonymous === true && !u.email);

    const users = await ctx.db.query("users").collect();
    const keepIds = new Set<string>();
    for (const u of users) if (keepUser(u)) keepIds.add(String(u._id));

    const doomedUsers: any[] = [];
    for (const u of users) if (!keepUser(u)) doomedUsers.push(u._id);

    // Hapus isi yang menempel ke user yang akan dihapus.
    const perUser = [
      "chatMessages",
      "notifications",
      "watchHistory",
      "animeFavorites",
      "animeComments",
      "comicHistory",
      "comicFavorites",
      "xpEvents",
      "absenLogs",
      "contentReports",
      "csThreads",
    ];
    let deleted = 0;
    for (const table of perUser) {
      const rows = await ctx.db.query(table as any).collect();
      for (const r of rows as any[]) {
        const uid = String(r.userId ?? r.authorId ?? "");
        if (!uid || doomedUsers.some((id) => String(id) === uid)) {
          await ctx.db.delete(r._id);
          deleted += 1;
        }
      }
    }

    // Semua yang relating ke user: friends, watch room, premium.
    const relational = [
      "friendships",
      "friendRequests",
      "watchRoomMembers",
      "premiumGives",
      "premiumPurchases",
    ];
    for (const table of relational) {
      const rows = await ctx.db.query(table as any).collect();
      for (const r of rows as any[]) {
        const a = String(r.userId ?? r.fromUserId ?? r.toUserId ?? "");
        const b = String(r.receiverId ?? r.senderId ?? r.hostId ?? "");
        if (
          (a && doomedUsers.some((id) => String(id) === a)) ||
          (b && doomedUsers.some((id) => String(id) === b))
        ) {
          await ctx.db.delete(r._id);
          deleted += 1;
        }
      }
    }

    // Hapus semua clan beserta isinya.
    let clans = 0;
    for (const table of ["clans", "clanMembers", "clanRequests", "clanLogs"]) {
      const rows = await ctx.db.query(table as any).collect();
      for (const r of rows as any[]) {
        await ctx.db.delete(r._id);
        deleted += 1;
        if (table === "clans") clans += 1;
      }
    }

    // Terakhir, user-nya sendiri.
    for (const id of doomedUsers) {
      await ctx.db.delete(id);
      deleted += 1;
    }

    return { ok: true, users: doomedUsers.length, kept: keepIds.size, clans, deleted };
  },
});

export const setAnnouncementActive = mutation({
  args: { id: v.id("announcements"), active: v.boolean() },
  handler: async (ctx, { id, active }) => {
    await staffGuard(ctx, "dev");
    await ctx.db.patch(id, { active, updatedAt: Date.now() });
    return { ok: true };
  },
});

export const deleteAnnouncement = mutation({
  args: { id: v.id("announcements") },
  handler: async (ctx, { id }) => {
    await staffGuard(ctx, "dev");
    await ctx.db.delete(id);
    return { ok: true };
  },
});
