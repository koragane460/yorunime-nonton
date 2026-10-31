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
      /** Animasi intro FULLSCREEN saat detail profil dibuka:
          "awan" | "gagak" | "none" (diatur di Pengaturan). */
      introStyle: v.optional(v.string()),
      /** Rewards Pengaturan: sudah klaim 5000 Sacret atau belum. */
      settingsRewardClaimed: v.optional(v.boolean()),
      /** SHOP BORDER — bingkai foto profile yang sedang dipakai
          (id dari BORDERS di src/lib/borders.ts, "none" = tanpa bingkai). */
      avatarBorder: v.optional(v.string()),
      /** Daftar border yang sudah dimiliki (hasil beli di Shop). */
      ownedBorders: v.optional(v.array(v.string())),
      /** TITLE yang sedang dipasang (key dari TITLE_DEFS di titles.ts).
          Field lama (single) — tetap dipakai sebagai "title utama". */
      equippedTitle: v.optional(v.string()),
      /** Kartu karakter GACHA yang sedang dipasang (id karakter roster).
          Field lama (single) — tetap dipakai sebagai "kartu utama". */
      equippedCard: v.optional(v.string()),
      /** MULTI-EQUIP: maksimal 4 kartu yang tampil di detail akun. */
      equippedCards: v.optional(v.array(v.string())),
      /** MULTI-EQUIP: maksimal 3 title yang tampil di detail akun. */
      equippedTitles: v.optional(v.array(v.string())),
      /** Izin akses konten 18+ (diberikan developer lewat panel). */
      adultAccess: v.optional(v.boolean()),
      
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
      /** Token Vote (T-V) yang sudah dibuang untuk voting karakter.
          Saldo = floor(totalMenitNonton / 2) − voteSpent (4 menit = 2 T-V). */
      voteSpent: v.optional(v.number()),
      theme: v.optional(v.string()),
      customColor: v.optional(v.string()),
      /** BUBBLE CHAT (premium): warna latar bubble milik user. */
      bubbleColor: v.optional(v.string()),
      /** BUBBLE CHAT (premium): URL background PNG untuk bubble (bukan gif). */
      bubbleBg: v.optional(v.string()),
      /** BUBBLE CHAT (premium): jenis frame/border dekoratif bubble. */
      bubbleBorder: v.optional(v.string()),
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
      /**
       * Level clan, disalin ke user saat joins. Dipakai untuk warna nama
       * clan di tag (lihat clanTextClass di lstream-ui.tsx). Disimpan di user
       * supaya chat & komentar bisa mewarnainya tanpa query tabel clans
       * untuk tiap pesan.
       */
      clanLevel: v.optional(v.number()),
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
      /** Pesan dari bot resmi (Luna Bot musik) — tampil seperti user lain
          tapi dengan avatar & centang ungu bot official. */
      bot: v.optional(v.boolean()),
      /** Data terstruktur bot (kartu now-playing, kontrol pemutar, dll). */
      botData: v.optional(v.any()),
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
      /** Warna latar tag [TAG] (hex) — dipilih saat bikin clan. */
      tagBg: v.optional(v.string()),
      avatarUrl: v.string(),
      backgroundUrl: v.optional(v.string()),
      description: v.optional(v.string()),
      leaderId: v.id("users"),
      diamonds: v.number(),
      level: v.number(),
      levelProgress: v.number(),
      createdAt: v.number(),
      /** CENTANG BIRU clan (dibeli leader/officer di Shop clan detail). */
      verified: v.optional(v.boolean()),
      /** Kapasitas member (mulai 20, upgrade +2/200 Sacret, maks 100). */
      memberCap: v.optional(v.number()),
      /** Tier tag clan yang sudah DIBELI (1..6 — ikon tag per level). */
      tagTier: v.optional(v.number()),
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

    /**
     * Antrean unduhan episode. Dipakai layar "Download" di Home: user melihat
     * file apa saja yang sudah terunduh, bisa memutar ulang secara offline,
     * dan bisa memindahkan filenya ke perangkat (unduh ke penyimpanan HP).
     *
     * `status`: "queued" | "downloading" | "done" | "failed"
     * `localKey`: kunci blob di IndexedDB browser — file videonya sendiri
     * disimpan di perangkat user, bukan di server.
     */
    downloads: defineTable({
      userId: v.id("users"),
      animeId: v.string(),
      animeTitle: v.string(),
      animeImage: v.optional(v.string()),
      episode: v.number(),
      episodeId: v.optional(v.string()),
      quality: v.string(),
      url: v.string(),
      bytes: v.optional(v.number()),
      status: v.union(
        v.literal("queued"),
        v.literal("downloading"),
        v.literal("done"),
        v.literal("failed"),
      ),
      progress: v.optional(v.number()),
      /** Kunci blob offline di IndexedDB; kosong = belum selesai diunduh. */
      localKey: v.optional(v.string()),
      error: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("userId_created", ["userId", "createdAt"])
      .index("userId_status", ["userId", "status"]),

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
      /** Kode undangan room (mis. "AB12CD") — dipakai join lewat Catalog. */
      inviteCode: v.optional(v.string()),
    })
      .index("hostId", ["hostId"])
      .index("animeId", ["animeId"])
      .index("inviteCode", ["inviteCode"]),

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

    // ---- AFINITAS — relasi dekat antar user (ala Mobile Legends) ----
    affinity: defineTable({
      userA: v.id("users"),
      userB: v.id("users"),
      kind: v.union(
        v.literal("pasangan"),
        v.literal("saudara"),
        v.literal("sahabat"),
        v.literal("terpercaya"),
      ),
      bondXp: v.number(),
      createdAt: v.number(),
      // Misi harian chat (reset per hari) — 5 chat/hari ke partner.
      chatDay: v.optional(v.string()),
      chatCount: v.optional(v.number()),
      chatDoneDay: v.optional(v.string()),
      // Misi kumulatif give premium (2x tiap jenis).
      give7: v.optional(v.number()),
      give30: v.optional(v.number()),
    })
      .index("userA", ["userA"])
      .index("userB", ["userB"])
      .index("pair", ["userA", "userB"]),

    affinityInvites: defineTable({
      fromId: v.id("users"),
      toId: v.id("users"),
      kind: v.union(
        v.literal("pasangan"),
        v.literal("saudara"),
        v.literal("sahabat"),
        v.literal("terpercaya"),
      ),
      createdAt: v.number(),
      status: v.union(
        v.literal("pending"),
        v.literal("accepted"),
        v.literal("rejected"),
      ),
    })
      .index("to_status", ["toId", "status"])
      .index("from", ["fromId"]),

    // Cooldown pasca-putus: userA tidak boleh mengajak userB lagi
    // sebelum blockedUntil (7 hari).
    affinityBreaks: defineTable({
      userA: v.id("users"),
      userB: v.id("users"),
      blockedUntil: v.number(),
    }).index("pair", ["userA", "userB"]),

    /**
     * Buku besar saldo developer. Satu baris per transaksi (masuk atau
     * keluar) supaya total mudah diaudit, bukan angka tunggal yang bisa
     * dikorek seenaknya.
     */
    saldoLedger: defineTable({
      kind: v.union(v.literal("topup"), v.literal("withdrawal")),
      amount: v.number(),
      refOrderId: v.optional(v.string()),
      note: v.optional(v.string()),
      createdAt: v.number(),
    }).index("createdAt", ["createdAt"]),

    /**
     * Permintaan tarik saldo ke e-wallet. Eksekusi transfernya dilakukan di
     * Dashboard Xendit, jadi status di sini hanya mencatat alurnya.
     */
    withdrawals: defineTable({
      amount: v.number(),
      channel: v.string(),
      target: v.string(),
      status: v.string(),
      note: v.optional(v.string()),
      createdAt: v.number(),
    }).index("createdAt", ["createdAt"]),

    /** Story: foto/video yang hilang sendiri setelah 24 jam. */
    stories: defineTable({
      userId: v.id("users"),
      storageId: v.string(),
      mediaType: v.union(v.literal("image"), v.literal("video")),
      caption: v.optional(v.string()),
      musicKey: v.optional(v.string()),
      /**
       * Siapa yang boleh melihat: "all" (semua orang), "teman"
       * (hanya teman), "diri" (hanya sendiri). Kosong = "all".
       */
      privacy: v.optional(
        v.union(v.literal("all"), v.literal("teman"), v.literal("diri")),
      ),
      /** Lagu latar dari katalog Musik (iTunes/Archive). Boleh berhak cipta. */
      music: v.optional(
        v.object({
          title: v.string(),
          artist: v.string(),
          cover: v.optional(v.string()),
          audioUrl: v.optional(v.string()),
          source: v.optional(v.string()),
        }),
      ),
      /** Volume suara asli & suara tambahan (0..1). */
      mediaVol: v.optional(v.number()),
      musicVol: v.optional(v.number()),
      /** Pangkas: rasio frame + zoom media. */
      crop: v.optional(
        v.object({
          aspect: v.string(),
          zoom: v.optional(v.number()),
        }),
      ),
      /** Lapisan teks (posisi x/y = 0..1 dari tengah layar). */
      texts: v.optional(
        v.array(
          v.object({
            text: v.string(),
            color: v.string(),
            outline: v.boolean(),
            bg: v.boolean(),
            font: v.string(),
            x: v.number(),
            y: v.number(),
            scale: v.optional(v.number()),
          }),
        ),
      ),
      /** Lapisan stiker emoji. */
      stickers: v.optional(
        v.array(
          v.object({
            emoji: v.string(),
            x: v.number(),
            y: v.number(),
            size: v.number(),
          }),
        ),
      ),
      createdAt: v.number(),
      expiresAt: v.number(),
    })
      .index("userId_created", ["userId", "createdAt"])
      .index("expiresAt", ["expiresAt"]),

    /** Siapa saja yang sudah melihat satu story (sekali per user). */
    storyViews: defineTable({
      storyId: v.id("stories"),
      userId: v.id("users"),
      createdAt: v.number(),
    })
      .index("storyId_created", ["storyId", "createdAt"])
      .index("storyId_user", ["storyId", "userId"])
      .index("userId", ["userId"]),

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
      .index("userId_anime", ["userId", "animeId"])
      /** MODE MULTI — satu baris per anime+episode (mode SINGLE tetap
          memakai index userId_anime, jadi data lama tidak berubah). */
      .index("userId_anime_ep", ["userId", "animeId", "episode"]),

    animeComments: defineTable({
      animeId: v.string(),
      /** Judul anime saat komentar dibuat, biar tautan komentar tetap lengkap. */
      animeTitle: v.optional(v.string()),
      /** Poster anime saat komentar dibuat — dipakai feed komentar di Akun. */
      animeImage: v.optional(v.string()),
      userId: v.id("users"),
      text: v.string(),
      replyToId: v.optional(v.id("animeComments")),
      likes: v.array(v.id("users")),
      createdAt: v.number(),
      deleted: v.optional(v.boolean()),
    }).index("animeId_created", ["animeId", "createdAt"]),

    /** Pengumuman yang muncul sebagai popup saat user masuk website. */
    announcements: defineTable({
      message: v.string(),
      active: v.boolean(),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),

    animeFavorites: defineTable({
      userId: v.id("users"),
      animeId: v.string(),
      animeTitle: v.string(),
      animeImage: v.optional(v.string()),
      /** "anime" (default) | "donghua" | "film" — tab layar Subscribe. */
      kind: v.optional(v.string()),
      /** Status media saat di-subscribe: "RELEASING" (ongoing) atau lain
          (tamat). Untuk pisah tab Ongoing/Tamat di layar Subscribe. */
      status: v.optional(v.string()),
      createdAt: v.number(),
    })
      .index("userId_created", ["userId", "createdAt"])
      .index("userId_anime", ["userId", "animeId"]),

    /** Suka/tidak suka satu anime — tombol Like menyatu di layar nonton. */
    animeLikes: defineTable({
      userId: v.id("users"),
      animeId: v.string(),
      /** 1 = suka, -1 = tidak suka. */
      value: v.number(),
      createdAt: v.number(),
    }).index("userId_anime", ["userId", "animeId"]),

    /**
     * Lagu yang disukai dari layar Musik.
     *
     * Sengaja tabel terpisah dari animeFavorites dan HANYA bisa dibaca oleh
     * pemiliknya - permintaannya: lagu yang disukai itu privat, orang lain
     * tidak boleh melihat daftarnya.
     */
    musicLikes: defineTable({
      userId: v.id("users"),
      /** videoId YouTube kalau lagu diputar lewat YouTube. */
      videoId: v.optional(v.string()),
      audioUrl: v.optional(v.string()),
      title: v.string(),
      artist: v.string(),
      cover: v.optional(v.string()),
      album: v.optional(v.string()),
      /** Kunci unik lagu (artist|title) supaya tidak dobel saat disukai. */
      key: v.string(),
      createdAt: v.number(),
    })
      .index("userId_created", ["userId", "createdAt"])
      .index("userId_key", ["userId", "key"]),

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
      /** Masih berjalan atau sudah tamat — dipakai pengelompokan Ongoing /
          Completed di layar Subscribe (disegarkan oleh aksi refresh). */
      ongoing: v.optional(v.boolean()),
      createdAt: v.number(),
    })
      .index("userId_slug", ["userId", "slug"])
      .index("userId_created", ["userId", "createdAt"]),

    /** State GACHA per user: pity, hitungan rank, koleksi kartu. */
    gachaState: defineTable({
      userId: v.id("users"),
      /** Pull sejak SSS terakhir — di 75 dijamin SSS. */
      pity: v.number(),
      totalPulls: v.number(),
      sssCount: v.number(),
      ssCount: v.number(),
      /** SSS berturut-turut saat ini. */
      streak: v.number(),
      /** SSS berturut-turut terpanjang (untuk title Unbreakable Streak). */
      bestStreak: v.number(),
      /** { [cardId]: jumlah dimiliki } */
      owned: v.any(),
      /** Riwayat pull terakhir (paling baru di depan) — untuk layar History. */
      pullHistory: v.optional(
        v.array(
          v.object({
            id: v.string(),
            rank: v.string(),
            at: v.number(),
          }),
        ),
      ),
    }).index("userId", ["userId"]),

    /** TITLE yang sudah dimiliki user (earned). */
    userTitles: defineTable({
      userId: v.id("users"),
      titleId: v.string(),
      earnedAt: v.number(),
    })
      .index("userId", ["userId"])
      .index("userId_title", ["userId", "titleId"]),

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
      /** Opsional: laporan pesan chat memakai ini, laporan anime memakai
          animeId/animeTitle di bawah. */
      messageId: v.optional(v.id("chatMessages")),
      /** Laporan judul anime (tombol Laporkan di layar nonton). */
      animeId: v.optional(v.string()),
      animeTitle: v.optional(v.string()),
      reason: v.string(),
      detail: v.optional(v.string()),
      text: v.optional(v.string()),
      createdAt: v.number(),
    }).index("createdAt", ["createdAt"]),

    // Sinopsis yang ditulis manual oleh developer (kalau sinopsis dari
    // sumber kosong/aneh). Key = MAL id untuk anime, slug untuk donghua.
    contentOverrides: defineTable({
      key: v.string(),
      kind: v.union(v.literal("anime"), v.literal("donghua")),
      synopsis: v.string(),
      updatedBy: v.optional(v.id("users")),
      updatedAt: v.number(),
    }).index("key_kind", ["key", "kind"]),

    // Anime yang ditambahkan sendiri oleh developer. Episode TIDAK dikarang
    // dan TIDAK disimpan di sini: detailnya diambil real-time dari sumber
    // (Sanka / AniList) setiap kali dibuka, jadi daftar episodenya selalu
    // sama dengan yang benar-benar ada.
    customAnime: defineTable({
      title: v.string(),
      slug: v.string(),
      source: v.union(v.literal("sanka"), v.literal("anilist")),
      poster: v.optional(v.string()),
      synopsis: v.string(),
      airingDay: v.optional(v.string()),
      airingTime: v.optional(v.string()),
      genres: v.optional(v.array(v.string())),
      createdAt: v.number(),
    }).index("slug", ["slug"]),

    // ---- Voting karakter anime (fitur Vote) -------------------------------
    // Satu event voting dimulai dari panel developer dan berjalan 7 hari.
    voteEvents: defineTable({
      startedAt: v.number(),
      /** Batas akhir: 7 hari setelah dimulai. Lewat ini = voting selesai. */
      endsAt: v.number(),
      startedBy: v.optional(v.id("users")),
    })
      .index("by_startedAt", ["startedAt"]),

    // Kandidat karakter dalam satu event voting — ditambahkan otomatis saat
    // user membuka layar Vote untuk sebuah anime.
    voteCandidates: defineTable({
      eventId: v.id("voteEvents"),
      animeId: v.string(),
      animeTitle: v.string(),
      characterId: v.string(),
      name: v.string(),
      image: v.optional(v.string()),
      votes: v.number(),
    })
      .index("by_event", ["eventId"])
      .index("by_event_char", ["eventId", "characterId"])
      .index("by_event_votes", ["eventId", "votes"]),

    /**
     * Like / Dislike karakter anime — pengganti sistem Vote.
     *
     * Satu baris per (user, karakter). `value` 1 = Like, -1 = Dislike.
     * Papan per anime dihitung dari jumlah baris per karakter, jadi tidak
     * perlu tabel agregat dan angkanya selalu konsisten.
     */
    characterLikes: defineTable({
      userId: v.id("users"),
      animeId: v.string(),
      characterId: v.string(),
      name: v.string(),
      image: v.optional(v.string()),
      /** 1 = Like, -1 = Dislike. */
      value: v.number(),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_character", ["characterId"])
      .index("by_anime", ["animeId"])
      .index("by_user_character", ["userId", "characterId"]),

    /**
     * Vote Waifu / Vote Husbu (kotak di Catalog) — daftar karakter DIATUR
     * DEV lewat Panel Developer (foto pakai link), terpisah per jenis.
     * Satu baris vote per (user, karakter); bisa vote 1× per hari.
     */
    waifuVoteCandidates: defineTable({
      /** "waifu" atau "husbu". */
      kind: v.string(),
      name: v.string(),
      image: v.optional(v.string()),
      votes: v.number(),
      createdAt: v.number(),
    })
      .index("by_kind", ["kind"])
      .index("by_kind_votes", ["kind", "votes"]),

    waifuVotes: defineTable({
      userId: v.id("users"),
      candidateId: v.id("waifuVoteCandidates"),
      /** "waifu" atau "husbu". */
      kind: v.string(),
      createdAt: v.number(),
      /** Waktu vote terakhir (untuk jeda 1 hari per user per jenis). */
      dayKey: v.string(),
    })
      .index("by_user_kind", ["userId", "kind"])
      .index("by_candidate", ["candidateId"])
      .index("by_user_day", ["userId", "dayKey"]),

    /** YORUPET — kebun binatang virtual di YoruVerse. */
    petState: defineTable({
      userId: v.id("users"),
      /** Jumlah Telur Misteri yang dimiliki (hasil gacha). */
      eggs: v.number(),
      /** Pet yang sudah ditetaskan. uid = kunci unik per ekor. */
      owned: v.array(
        v.object({ uid: v.string(), petId: v.string(), at: v.number() }),
      ),
      /** uid pet yang sedang dipasang (berjalan di panggung). */
      equippedUid: v.optional(v.string()),
      /** MULTI-EQUIP — daftar uid pet yang dipasang sekaligus (maks 10).
          Field lama `equippedUid` tetap dijaga sebagai pet pertama supaya
          data lama tetap terbaca. */
      equippedUids: v.optional(v.array(v.string())),
      /** Waktu klaim Sacret terakhir — klaim berikutnya 24 jam kemudian. */
      claimAt: v.number(),
      /** Crystal hasil menjual pet (nilai = harga pet). */
      crystals: v.number(),
      /** Scene/background yang sudah dimiliki. */
      scenes: v.array(v.string()),
      /** Scene aktif (mengubah panggung DAN latar layar). */
      scene: v.string(),
      /** Gacha GRATIS pertama kali sudah dipakai (telur gratis 1×). */
      freeEggUsed: v.optional(v.boolean()),
    }).index("by_user", ["userId"]),

    /**
     * VOICE CALL ROOM — daftar room + siapa yang sedang berada di dalamnya.
     * Audio sendiri lewat WebRTC (peer-to-peer), tabel ini hanya untuk daftar
     * room, keanggotaan, dan kode undangan (GP-xxxxxxx / OP-xxxxxxx).
     */
    voiceRooms: defineTable({
      name: v.string(),
      /** casual | gaming | study | music */
      type: v.string(),
      ownerId: v.id("users"),
      maxUsers: v.number(),
      privacy: v.union(v.literal("public"), v.literal("private")),
      /** Kode link grup (Reusable). */
      linkCode: v.string(),
      /** Kode link personal (ONE TIME — hilang begitu dipakai). */
      oneTimeCode: v.optional(v.string()),
      members: v.optional(
        v.array(
          v.object({
            userId: v.id("users"),
            username: v.string(),
            image: v.optional(v.string()),
            joinedAt: v.number(),
          }),
        ),
      ),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("linkCode", ["linkCode"])
      .index("oneTimeCode", ["oneTimeCode"])
      .index("updatedAt", ["updatedAt"]),

    /**
     * ANTRIAN MUSIK per voice room — dikendalikan Luna Bot 24/7 lewat
     * command chat (semua command diawali & diakhiri tanda seru).
     */
    voiceMusic: defineTable({
      roomId: v.id("voiceRooms"),
      /** Lagu yang sedang diputar (null = berhenti). */
      current: v.optional(v.any()),
      /** Antrian lagu berikutnya. */
      queue: v.array(v.any()),
      botInRoom: v.boolean(),
      paused: v.boolean(),
      /** 0-100 */
      volume: v.number(),
      /** off | bassboost | nightcore | 8d */
      fx: v.string(),
      /** Riwayat lagu yang sudah diputar (untuk pesan skip). */
      last: v.optional(v.any()),
    }).index("roomId", ["roomId"]),

    /**
     * PRESENCE ringan — ditandai tiap 30 detik selama aplikasi terbuka.
     * Dipakai penghitung "N online" di kotak Chat Global (angka beneran,
     * bukan tebakan dari chat).
     */
    presences: defineTable({
      userId: v.id("users"),
      at: v.number(),
    }).index("at", ["at"]),

    /** Sinyal WebRTC (offer/answer/ice) + status mikrofon antar member. */
    voiceSignals: defineTable({
      roomId: v.id("voiceRooms"),
      from: v.id("users"),
      /** offer | answer | ice | speaking | mic */
      kind: v.string(),
      payload: v.optional(v.string()),
      createdAt: v.number(),
    })
      .index("roomId", ["roomId"])
      .index("roomId_created", ["roomId", "createdAt"]),

    /**
     * GAME ROOM di dalam Voice Call — UNO (4 kursi) & Catur (2 kursi).
     * `state` berisi papan/permainan (UNO: deck+hand per user; Catur: papan
     * 64 petak). Hand UNO TIDAK pernah dikirim utuh lewat query session
     * (disensor jadi jumlah kartu saja) — hand asli lewat `myHand`.
     */
    gameSessions: defineTable({
      roomId: v.id("voiceRooms"),
      hostId: v.id("users"),
      game: v.union(
        v.literal("uno"),
        v.literal("chess"),
        v.literal("snakes"),
      ),
      seats: v.number(),
      players: v.array(
        v.object({
          userId: v.id("users"),
          username: v.string(),
          image: v.optional(v.string()),
          seat: v.number(),
        }),
      ),
      status: v.union(
        v.literal("lobby"),
        v.literal("playing"),
        v.literal("done"),
      ),
      state: v.any(),
      winnerId: v.optional(v.id("users")),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_room", ["roomId"])
      .index("by_status", ["status"]),

    /** Undangan game dari host voice room ke member lain. */
    gameInvites: defineTable({
      sessionId: v.id("gameSessions"),
      roomId: v.id("voiceRooms"),
      game: v.union(
        v.literal("uno"),
        v.literal("chess"),
        v.literal("snakes"),
      ),
      fromUserId: v.id("users"),
      toUserId: v.id("users"),
      status: v.union(
        v.literal("pending"),
        v.literal("joined"),
        v.literal("declined"),
      ),
      updatedAt: v.number(),
    })
      .index("by_to_status", ["toUserId", "status"])
      .index("by_session", ["sessionId"]),

    /** FOLLOW — relasi follow antar user untuk fitur Feed & detail Konten. */
    follows: defineTable({
      followerId: v.id("users"),
      followingId: v.id("users"),
      createdAt: v.number(),
    })
      .index("by_pair", ["followerId", "followingId"])
      .index("by_follower", ["followerId"])
      .index("by_following", ["followingId"]),

    /**
     * FEED — konten yang di-post user (gambar / musik / teks), mirip TikTok.
     * `privacy`: "all" (semua orang) atau "teman" (hanya teman/follow).
     * Gambar disimpan di file storage (bukan base64) supaya aman batas 1 MiB.
     */
    feedPosts: defineTable({
      userId: v.id("users"),
      kind: v.union(
        v.literal("image"),
        v.literal("music"),
        v.literal("text"),
        v.literal("video"),
      ),
      caption: v.optional(v.string()),
      imageStorageId: v.optional(v.string()),
      /** Frame hasil clip video — dipakai sebagai thumbnail grid Konten. */
      thumbStorageId: v.optional(v.string()),
      music: v.optional(
        v.object({
          title: v.string(),
          artist: v.optional(v.string()),
          cover: v.optional(v.string()),
          audioUrl: v.optional(v.string()),
        }),
      ),
      /** Teks overlay hasil editor (font, miring, outline, ukuran). */
      overlay: v.optional(
        v.object({
          text: v.string(),
          font: v.string(),
          italic: v.boolean(),
          outline: v.boolean(),
          size: v.number(),
        }),
      ),
      /** Campuran audio: volume backsound musik vs suara asli video (0-100). */
      audio: v.optional(
        v.object({
          musicVol: v.number(),
          videoVol: v.number(),
        }),
      ),
      privacy: v.union(v.literal("all"), v.literal("teman")),
      likes: v.array(v.id("users")),
      views: v.number(),
      createdAt: v.number(),
    })
      .index("by_created", ["createdAt"])
      .index("by_user", ["userId", "createdAt"]),

    /** Komentar pada post Feed. */
    feedComments: defineTable({
      postId: v.id("feedPosts"),
      userId: v.id("users"),
      text: v.string(),
      createdAt: v.number(),
    })
      .index("by_post", ["postId", "createdAt"])
      .index("by_user", ["userId"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
