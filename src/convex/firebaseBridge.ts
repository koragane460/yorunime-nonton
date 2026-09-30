// YoruNime — jembatan Firebase Authentication → Convex Auth.
//
// Token ID dari Firebase diverifikasi di server lewat Identity Toolkit
// (accounts:lookup), lalu user Convex dibuat/ditautkan berdasarkan UID
// Firebase. Dengan begitu sesi tetap dikelola Convex Auth, semua query &
// mutation yang sudah ada tidak perlu diubah sama sekali.
import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

const PROVIDER = "credentials";

export const ensureFirebaseUser = internalMutation({
  args: {
    firebaseUid: v.string(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
  },
  handler: async (ctx, { firebaseUid, email, name, image }) => {
    // 1) Sudah pernah linked?
    const existing = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q.eq("provider", PROVIDER).eq("providerAccountId", firebaseUid),
      )
      .unique();
    if (existing?.userId) {
      // Refresh data profil biar username/email selalu ikut.
      const patch: Record<string, unknown> = {};
      if (image) patch.image = image;
      if (name) patch.name = name;
      if (email) {
        patch.email = email;
        patch.emailVerificationTime = Date.now();
      }
      if (Object.keys(patch).length > 0)
        await ctx.db.patch(existing.userId, patch);
      return { userId: existing.userId };
    }

    const cleanEmail = email?.trim().toLowerCase();

    // 2) Email-nya sudah punya akun di YoruNime? → tautkan, jangan duplikat.
    if (cleanEmail) {
      const byEmail = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", cleanEmail))
        .unique();
      if (byEmail) {
        await ctx.db.insert("authAccounts", {
          userId: byEmail._id,
          provider: PROVIDER,
          providerAccountId: firebaseUid,
          email: cleanEmail,
          createdAt: Date.now(),
        });
        const patch: Record<string, unknown> = {
          emailVerificationTime: Date.now(),
        };
        if (image) patch.image = image;
        if (name) patch.name = name;
        await ctx.db.patch(byEmail._id, patch);
        return { userId: byEmail._id };
      }
    }

    // 3) User baru.
    const userId = await ctx.db.insert("users", {
      name: name?.trim() || cleanEmail?.split("@")[0] || "user",
      image,
      email: cleanEmail,
      emailVerificationTime: Date.now(),
      isAnonymous: false,
      role: "user",
    });
    await ctx.db.insert("authAccounts", {
      userId,
      provider: PROVIDER,
      providerAccountId: firebaseUid,
      email: cleanEmail,
      createdAt: Date.now(),
    });
    return { userId };
  },
});
