import { api } from "@/convex/_generated/api";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useQuery } from "convex/react";

/**
 * Status sesi + profil user.
 *
 * `user` berasal dari `users:currentUser` (null saat belum masuk, undefined
 * selagi query masih jalan). `signIn`/`signOut` diambil dari
 * `useAuthActions()` — `useConvexAuth()` sendiri hanya mengembalikan status
 * loading/authenticated, bukan aksi.
 */
export function useAuth() {
  const { signIn, signOut } = useAuthActions();
  const { isLoading, isAuthenticated } = useConvexAuth();
  const user = useQuery(api.users.currentUser, {});

  return {
    isLoading,
    isAuthenticated,
    user,
    signIn,
    signOut,
  };
}
