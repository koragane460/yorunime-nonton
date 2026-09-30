import { api } from "@/convex/_generated/api";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useQuery } from "convex/react";

export function useAuth() {
  const { isLoading: isAuthLoading, isAuthenticated } = useConvexAuth();
  const user = useQuery(api.users.currentUser);
  const { signIn, signOut } = useAuthActions();

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
  };
}