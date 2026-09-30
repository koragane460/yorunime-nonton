// Provider Convex Auth untuk Firebase Authentication.
//
// Alur: client login ke Firebase (Google), dapat ID token, lalu token itu
// dikirim ke Convex lewat signIn("firebase", { idToken }). Di sini token
// diverifikasi server-side lewat Identity Toolkit, lalu UID Firebase
// dipakai sebagai identitas akun di Convex.
import { ConvexCredentials } from "@convex-dev/auth/providers/ConvexCredentials";
import type { ConvexCredentialsConfig } from "@convex-dev/auth/server";
import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";

type FirebaseUser = {
  localId: string;
  email?: string;
  emailVerified?: boolean;
  displayName?: string;
  photoUrl?: string;
};

/** Verifikasi ID token Firebase lewat Identity Toolkit (tanpa Admin SDK). */
async function verifyFirebaseIdToken(
  idToken: string,
): Promise<FirebaseUser | null> {
  try {
    const res = await fetch(
      "https://identitytoolkit.googleapis.com/v1/accounts:lookup",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { users?: FirebaseUser[] };
    return data.users?.[0] ?? null;
  } catch {
    return null;
  }
}

// Tipe ditulis eksplisit karena _generated/api mengimpor balik auth.ts
// (circular inference) — tanpa ini TypeScript tidak bisa menghitung tipe.
export const firebase: ConvexCredentialsConfig = ConvexCredentials({
  id: "firebase",
  authorize: async (
    credentials,
    ctx,
  ): Promise<{ userId: Id<"users"> } | null> => {
    const idToken = credentials.idToken;
    if (typeof idToken !== "string" || idToken.length < 20) return null;

    const fbUser = await verifyFirebaseIdToken(idToken);
    if (!fbUser?.localId) return null;

    // UID Firebase dihubungkan ke user Convex (atau dibuat baru).
    const result: { userId: Id<"users"> } = await ctx.runMutation(
      internal.firebaseBridge.ensureFirebaseUser,
      {
        firebaseUid: fbUser.localId,
        email: fbUser.email,
        name: fbUser.displayName,
        image: fbUser.photoUrl,
      },
    );

    return { userId: result.userId };
  },
});
