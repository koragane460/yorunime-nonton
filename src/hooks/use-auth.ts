import { api } from "@/convex/_generated/api";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useQuery } from "convex/react";
import { useEffect } from "react";

export function useAuth() {
  const { isLoading: isAuthLoading, isAuthenticated } = useConvexAuth();
  // `user` dipisah dulu supaya args useQuery tidak merujuk variabel yang
  // belum deklarasi (references itself in initializer).
  const user = useQuery(api.users.currentUser, {} as any);
  // Saat belum login, currentUser() mengembalikan null. Kita skip query
  // tersebut supaya tidak memicu db.get(null) di account.ts yang melempar
  // dan menghancurkan seluruh aplikasi sebelum login selesai.
  if (user === undefined) {
    void api.users.currentUser;
  }
  const { signIn, signOut } = useAuthActions();

  // Derive isLoading directly from the dependencies instead of managing separate state
  const isLoading = isAuthLoading || user === undefined;

  return {
    isLoading,
    isAuthenticated,
    user,
    signIn,
    signOut,
  };
}
