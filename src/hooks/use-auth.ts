import { api } from "@/convex/_generated/api";
import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation, useConvexAuth, useQuery } from "convex/react";
import { useEffect } from "react";

export function useAuth() {
  const { isLoading: isAuthLoading, isAuthenticated } = useConvexAuth();
  const user = useQuery(api.users.currentUser);
  const { signIn, signOut, signInWith } = useAuthActions();
  const ensureUid = useMutation(api.users.ensureUid);

  // Setiap akun punya UID 7 karakter (huruf + angka) untuk verifikasi pembelian.
  useEffect(() => {
    if (user && !user.uidCode) void ensureUid().catch(() => {});
  }, [user, ensureUid]);

  // Derive isLoading directly from the dependencies instead of managing separate state
  const isLoading = isAuthLoading || user === undefined;

  // Daftar akun baru memakai provider "password" dengan flow "signUp".
  const signUp = async (params: {
    email: string;
    password: string;
    name?: string;
  }) => {
    return await signIn("password", { ...params, flow: "signUp" });
  };

  return {
    isLoading,
    isAuthenticated,
    user,
    signIn,
    signUp,
    signOut,
    signInWith: (provider: string) => signInWith ? signInWith(provider) : Promise.reject(new Error("signInWith tidak tersedia di autentikasi ini")),
  };
}
