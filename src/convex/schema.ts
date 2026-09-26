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
      emailVerificationTime: v.optional(v.number()),
      isAnonymous: v.optional(v.boolean()),
      role: v.optional(roleValidator),

      username: v.optional(v.string()),
      xp: v.optional(v.number()),
      level: v.optional(v.number()),
      diamonds: v.optional(v.number()),
      premiumUntil: v.optional(v.number()),
      bannerUrl: v.optional(v.string()),
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
      .index("email", ["email"])
      .index("username", ["username"])
      .index("xp", ["xp"]),

    chatMessages: defineTable({
      kind: v.string(),
      clanId: v.optional(v.id("clans")),
      dmKey: v.optional(v.string()),
      userId: v.id("users"),
      text: v.optional(v.string()),
      imageUrl: v.optional(v.string()),
      replyToId: v.optional(v.id("chatMessages")),
      premiumGiveId: v.optional(v.id("premiumGives")),
      createdAt: v.number(),
      deleted: v.optional(v.boolean()),
    })
      .index("kind_clan_created", ["kind", "clanId", "createdAt"])
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
      .index("fromUserId_status", ["fromUserId", "status"]),

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
      updatedAt: v.number(),
    })
      .index("userId_updated", ["userId", "updatedAt"])
      .index("userId_anime", ["userId", "animeId"]),

    animeComments: defineTable({
      animeId: v.string(),
      userId: v.id("users"),
      text: v.string(),
      replyToId: v.optional(v.id("animeComments")),
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

    premiumPurchases: defineTable({
      userId: v.id("users"),
      planId: v.string(),
      planLabel: v.string(),
      days: v.number(),
      priceIdr: v.number(),
      status: v.string(),
      orderId: v.string(),
      paymentRef: v.optional(v.string()),
      paymentUrl: v.optional(v.string()),
      createdAt: v.number(),
    })
      .index("userId_created", ["userId", "createdAt"])
      .index("orderId", ["orderId"]),

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
  },
  {
    schemaValidation: false,
  },
);

export default schema;
