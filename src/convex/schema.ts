import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

const schema = defineSchema(
  {
    ...authTables,

    users: defineTable({
      name: v.optional(v.string()),
      image: v.optional(v.string()),
      email: v.optional(v.string()),
      phone: v.optional(v.string()),
      emailVerificationTime: v.optional(v.number()),
      phoneVerificationTime: v.optional(v.number()),
      isAnonymous: v.optional(v.boolean()),
      role: v.optional(roleValidator),

      username: v.optional(v.string()),
      xp: v.optional(v.number()),
      level: v.optional(v.number()),
      diamonds: v.optional(v.number()),
      premiumUntil: v.optional(v.number()),
      /** Panel dev: saldo Sacret & premium tanpa batas. */
      unlimitedSacret: v.optional(v.boolean()),
      unlimitedPremium: v.optional(v.boolean()),
      bannerUrl: v.optional(v.string()),
      /** Izin akses konten 18+ (diberikan developer lewat panel). */
      adultAccess: v.optional(v.boolean()),
      /** Izin akses konten Film (diberikan developer lewat panel). */
      filmAccess: v.optional(v.boolean()),
      // Kode UID 7 karakter (huruf + angka) sebagai identitas akun saat
      // verifikasi pembelian.
      uidCode: v.optional(v.string()),
      // Developer menandai akun lewat "@username" di panel dev. Selama aktif,
      // akun yang ditandai tampil dengan logo merah.
      devTagUntil: v.optional(v.number()),
      hideOnline: v.optional(v.boolean()),
      autoRejectFriend: v.optional(v.boolean()),
      autoRejectFriendAction: v.optional(v.string()),
      defaultQuality: v.optional(v.string()),
      defaultSpeed: v.optional(v.number()),
      theme: v.optional(v.string()),
      customColor: v.optional(v.string()),
      createdAt: v.optional(v.number()),
      mutedUntil: v.optional(v.number()),
      mutedReason: v.optional(v.string()),
      bannedUntil: v.optional(v.number()),
      bannedReason: v.optional(v.string()),
      nsfwStrikes: v.optional(v.number()),
      seqId: v.optional(v.number()),
      deviceKey: v.optional(v.string()),
      lastSeenUpdate: v.optional(v.number()),
      staffRole: v.optional(
        v.union(
          v.literal("dev"),
          v.literal("mod"),
          v.literal("tester"),
          v.literal("sepuh"),
          v.literal("creator"),
        ),
      ),
      clanTag: v.optional(v.string()),
      clanTagIcon: v.optional(v.string()),
      clanNameColor: v.optional(v.string()),
    })
      // Index WAJIB sama dengan bawaan Convex Auth (authTables.users),
      // kalau tidak, login (anonim/email/Google) akan error
      // "Index ... not found" di backend.
      .index("email", ["email"])
      .index("phone", ["phone"])
      .index("username", ["username"])
      .index("uidCode", ["uidCode"])
      .index("xp", ["xp"]),

    chatMessages: defineTable({
      kind: v.string(),
      clanId: v.optional(v.id("clans")),
      roomId: v.optional(v.id("watchRooms")),
      dmKey: v.optional(v.string()),
      userId: v.id("users"),
      text: v.optional(v.string()),
      imageUrl: v.optional(v.string()),
      imageStorageId: v.optional(v.string()),
      replyToId: v.optional(v.id("chatMessages")),
      premiumGiveId: v.optional(v.id("premiumGives")),
      createdAt: v.number(),
      deleted: v.optional(v.boolean()),
    })
      .index("kind_clan_created", ["kind", "clanId", "createdAt"])
      .index("roomId_created", ["roomId", "createdAt"])
      .index("dmKey_created", ["dmKey", "createdAt"])
      .index("premiumGiveId", ["premiumGiveId"]),

    premiumGives: defineTable({
      chatMessageId: v.optional(v.id("chatMessages")),
      clanId: v.optional(v.id("clans")),
      fromUserId: v.id("users"),
      days: v.number(),
      cost: v.number(),
      slots: v.number(),
      message: v.optional(v.string()),
      claimedBy: v.array(v.id("users")),
      claimedAt: v.number(),
      expired: v.boolean(),
      createdAt: v.number(),
    }).index("createdAt", ["createdAt"]),

    xpEvents: defineTable({
      userId: v.id("users"),
      xp: v.number(),
      source: v.string(),
      createdAt: v.number(),
    })
      .index("userId_created", ["userId", "createdAt"])
      .index("createdAt", ["createdAt"]),

    clans: defineTable({
      name: v.string(),
      tag: v.string(),
      tagIcon: v.string(),
      avatarUrl: v.string(),
      backgroundUrl: v.optional(v.string()),
      description: v.optional(v.string()),
      leaderId: v.id("users"),
      diamonds: v.number(),
      level: v.number(),
      levelProgress: v.number(),
      createdAt: v.number(),
    })
      .index("leaderId", ["leaderId"])
      .index("diamonds", ["diamonds"])
      .index("tag", ["tag"]),

    clanMembers: defineTable({
      clanId: v.id("clans"),
      userId: v.id("users"),
      role: v.string(),
      donatedTotal: v.number(),
      donatedToday: v.number(),
      lastDonateDay: v.string(),
      lastClaimDay: v.optional(v.string()),
      joinedAt: v.number(),
    })
      .index("clanId", ["clanId"])
      .index("userId", ["userId"]),

    clanRequests: defineTable({
      clanId: v.id("clans"),
      userId: v.id("users"),
      status: v.string(),
      createdAt: v.number(),
    })
      .index("clanId_status", ["clanId", "status"])
      .index("userId_status", ["userId", "status"]),

    clanLogs: defineTable({
      clanId: v.id("clans"),
      text: v.string(),
      createdAt: v.number(),
    }).index("clanId_created", ["clanId", "createdAt"]),

    friendships: defineTable({
      userA: v.id("users"),
      userB: v.id("users"),
      createdAt: v.number(),
    })
      .index("userA", ["userA"])
      .index("userB", ["userB"]),

    friendRequests: defineTable({
      fromUserId: v.id("users"),
      toUserId: v.id("users"),
      status: v.string(),
      createdAt: v.number(),
    })
      .index("toUserId_status", ["toUserId", "status"])
      .index("fromUserId_status", ["fromUserId", "status"])
      // Dipakai biar request duplikat hanya terdeteksi ke user yang SAMA
      // (sebelumnya satu request pending = blokir semua request berikutnya).
      .index("from_to_status", ["fromUserId", "toUserId", "status"]),

    // ---------------------------------------------------- nonton bareng ----
    watchRooms: defineTable({
      name: v.string(),
      hostId: v.id("users"),
      animeId: v.string(),
      animeTitle: v.optional(v.string()),
      animeImage: v.optional(v.string()),
      episode: v.number(),
      positionSec: v.number(),
      playing: v.boolean(),
      visibility: v.union(v.literal("all"), v.literal("selected")),
      allowedUserIds: v.optional(v.array(v.id("users"))),
      clanId: v.optional(v.id("clans")),
      startedAt: v.number(),
      updatedAt: v.number(),
      endedAt: v.optional(v.number()),
    })
      .index("hostId", ["hostId"])
      .index("animeId", ["animeId"]),

    watchRoomMembers: defineTable({
      roomId: v.id("watchRooms"),
      userId: v.id("users"),
      joinedAt: v.number(),
    })
      .index("roomId", ["roomId"])
      .index("userId", ["userId"]),

    counters: defineTable({
      key: v.string(),
      value: v.number(),
    }).index("key", ["key"]),

    notifications: defineTable({
      userId: v.id("users"),
      type: v.string(),
      title: v.string(),
      body: v.optional(v.string()),
      refUserId: v.optional(v.id("users")),
      refMessageId: v.optional(v.id("chatMessages")),
      read: v.optional(v.boolean()),
      createdAt: v.number(),
    }).index("userId_created", ["userId", "createdAt"]),

    animeCache: defineTable({
      endpoint: v.string(),
      payload: v.any(),
      updatedAt: v.number(),
    }).index("endpoint", ["endpoint"]),

    watchHistory: defineTable({
      userId: v.id("users"),
      animeId: v.string(),
      animeTitle: v.string(),
      animeImage: v.optional(v.string()),
      episode: v.number(),
      minutesWatched: v.number(),
      /** Posisi playback terakhir (detik) — dipakai tombol "Lanjutkan". */
      progressSec: v.optional(v.number()),
      /** Durasi episode terakhir (detik) — untuk bar progres "Lanjutkan". */
      durationSec: v.optional(v.number()),
      updatedAt: v.number(),
    })
      .index("userId_updated", ["userId", "updatedAt"])
      .index("userId_anime", ["userId", "animeId"]),

    animeComments: defineTable({
      animeId: v.string(),
      userId: v.id("users"),
      text: v.string(),
      replyToId: v.optional(v.id("animeComments")),
      likes: v.array(v.id("users")),
      createdAt: v.number(),
      deleted: v.optional(v.boolean()),
    }).index("animeId_created", ["animeId", "createdAt"]),

    animeFavorites: defineTable({
      userId: v.id("users"),
      animeId: v.string(),
      animeTitle: v.string(),
      animeImage: v.optional(v.string()),
      createdAt: v.number(),
    })
      .index("userId_created", ["userId", "createdAt"])
      .index("userId_anime", ["userId", "animeId"]),

    /** Riwayat baca manga & manhwa (bukan anime). */
    comicHistory: defineTable({
      userId: v.id("users"),
      slug: v.string(),
      comicTitle: v.string(),
      comicImage: v.optional(v.string()),
      /** "manga" | "manhwa" — menentukan tema & arah baca. */
      kind: v.string(),
      chapter: v.number(),
      chapterLabel: v.optional(v.string()),
      /** Halaman terakhir yang dibuka (untuk tombol "Lanjutkan"). */
      page: v.optional(v.number()),
      totalPages: v.optional(v.number()),
      updatedAt: v.number(),
    })
      .index("userId_updated", ["userId", "updatedAt"])
      .index("userId_slug", ["userId", "slug"]),

    /** Favorite manga & manhwa — terlihat oleh user lain lewat profile. */
    comicFavorites: defineTable({
      userId: v.id("users"),
      slug: v.string(),
      comicTitle: v.string(),
      comicImage: v.optional(v.string()),
      kind: v.string(),
      createdAt: v.number(),
    })
      .index("userId_slug", ["userId", "slug"])
      .index("userId_created", ["userId", "createdAt"]),

    premiumPurchases: defineTable({
      userId: v.id("users"),
      planId: v.string(),
      planLabel: v.string(),
      days: v.number(),
      priceIdr: v.number(),
      status: v.string(),
      orderId: v.string(),
      method: v.optional(v.string()),
      proofUrl: v.optional(v.string()),
      proofText: v.optional(v.string()),
      proofHash: v.optional(v.string()),
      uidCode: v.optional(v.string()),
      analysisNote: v.optional(v.string()),
      analyzedBy: v.optional(v.string()),
      note: v.optional(v.string()),
      mentions: v.optional(v.array(v.string())),
      paymentRef: v.optional(v.string()),
      paymentUrl: v.optional(v.string()),
      createdAt: v.number(),
    })
      .index("userId_created", ["userId", "createdAt"])
      .index("orderId", ["orderId"])
      .index("status_created", ["status", "createdAt"])
      .index("proofHash", ["proofHash"]),

    // Pengaturan pembayaran manual (QRIS statis). Satu baris saja, id tetap.
    paymentSettings: defineTable({
      qrUrl: v.optional(v.string()),
      // Foto QRIS yang diunggah developer lewat panel (disimpan di file storage).
      qrStorageId: v.optional(v.string()),
      accountName: v.optional(v.string()),
      accountLabel: v.optional(v.string()),
      note: v.optional(v.string()),
      contact: v.optional(v.string()),
      // Email tujuan notifikasi order yang tidak bisa dipastikan AI.
      devEmail: v.optional(v.string()),
      autoApprove: v.optional(v.boolean()),
      autoApproveMax: v.optional(v.number()),
      updatedAt: v.number(),
    }),

    clickGame: defineTable({
      userId: v.id("users"),
      day: v.string(),
      clicks: v.number(),
      diamondsEarned: v.number(),
    }).index("userId_day", ["userId", "day"]),

    absenLogs: defineTable({
      userId: v.id("users"),
      day: v.number(),
      day2: v.string(),
      createdAt: v.number(),
    }).index("userId_day", ["userId", "day2"]),

    appSettings: defineTable({
      key: v.string(),
      value: v.any(),
    }).index("key", ["key"]),

    // authAccounts: gabungan field bawaan Convex Auth (wajib, supaya
    // login anonim/email/Google jalan) + field login email+password.
    authAccounts: defineTable({
      userId: v.optional(v.id("users")),
      provider: v.optional(v.string()),
      providerAccountId: v.optional(v.string()),
      secret: v.optional(v.string()),
      emailVerified: v.optional(v.string()),
      phoneVerified: v.optional(v.string()),
      email: v.optional(v.string()),
      passwordHash: v.optional(v.string()),
      createdAt: v.optional(v.number()),
      lastLoginAt: v.optional(v.number()),
    })
      .index("userIdAndProvider", ["userId", "provider"])
      .index("providerAndAccountId", ["provider", "providerAccountId"])
      .index("email", ["email"]),

    /** Satu percakapan Customer Service. Satu user hanya boleh satu thread aktif. */
    csThreads: defineTable({
      userId: v.id("users"),
      /** waiting = menunggu developer, open = sudah diterima, ended = selesai, rejected = ditolak */
      status: v.union(
        v.literal("waiting"),
        v.literal("open"),
        v.literal("ended"),
        v.literal("rejected"),
      ),
      startedAt: v.number(),
      acceptedAt: v.optional(v.number()),
      closedAt: v.optional(v.number()),
      lastMessageAt: v.number(),
      lastUserMessage: v.optional(v.string()),
      /** Waktu paling awal user boleh buka CS lagi setelah thread ditutup. */
      cooldownUntil: v.optional(v.number()),
    })
      .index("userId", ["userId"])
      .index("status_lastMessage", ["status", "lastMessageAt"]),

    csMessages: defineTable({
      threadId: v.id("csThreads"),
      from: v.union(v.literal("user"), v.literal("dev"), v.literal("bot")),
      text: v.string(),
      createdAt: v.number(),
    })
      .index("threadId_created", ["threadId", "createdAt"]),

    contentReports: defineTable({
      reporterId: v.id("users"),
      messageId: v.id("chatMessages"),
      reason: v.string(),
      detail: v.optional(v.string()),
      text: v.optional(v.string()),
      createdAt: v.number(),
    }).index("createdAt", ["createdAt"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
