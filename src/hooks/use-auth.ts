import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";

export function useAuth() {
  const { isLoading: isAuthLoading, isAuthenticated, signIn, signOut } =
    useConvexAuth();

  // Login tanpa musti menunggu query users:currentUser —
  // gabungkan isLoading auth + tunggu sedikit setelah isAuthenticated true
  // baru anggap sudah siap (biar websocket/refresh token sempat settle).
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!isAuthLoading && isAuthenticated) {
      const t = setTimeout(() => setReady(true), 120);
      return () => clearTimeout(t);
    } else {
      setReady(false);
    }
  }, [isAuthLoading, isAuthenticated]);

  // Gabungkan keduanya jadi satu flag isLoading yang stabil.
  const isLoading =
    isAuthLoading || (!ready && isAuthenticated) || (isAuthLoading === false && !isAuthenticated);

  return {
    isLoading,
    isAuthenticated,
    user: undefined as never, // bukan useQuery — segera diganti per halaman
    signIn,
    signOut,
  };
}
