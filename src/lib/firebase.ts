// YoruNime — konfigurasi Firebase Authentication di sisi browser.
//
// Credential diambil dari env (tab Keys / API keys di Freebuff). Prefix
// VITE_ dipakai karena Vite hanya menyuntik variabel berawalan itu ke client;
// kalau platform menaruh nilainya tanpa prefix, keduanya tetap dibaca.
import { getApp, getApps, initializeApp } from "firebase/app";
import {
  getAuth,
  getRedirectResult,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  type User,
} from "firebase/auth";

const env = import.meta.env as unknown as Record<string, string | undefined>;

const pick = (...names: string[]) => {
  for (const n of names) {
    const v = env[n];
    if (v && v.trim()) return v.trim();
  }
  return undefined;
};

export const firebaseConfig = {
  apiKey: pick("VITE_FIREBASE_API_KEY", "FIREBASE_API_KEY"),
  authDomain: pick("VITE_FIREBASE_AUTH_DOMAIN", "FIREBASE_AUTH_DOMAIN"),
  projectId: pick("VITE_FIREBASE_PROJECT_ID", "FIREBASE_PROJECT_ID"),
  appId: pick("VITE_FIREBASE_APP_ID", "FIREBASE_APP_ID"),
  messagingSenderId: pick(
    "VITE_FIREBASE_MESSAGING_SENDER_ID",
    "FIREBASE_MESSAGING_SENDER_ID",
  ),
  storageBucket: pick(
    "VITE_FIREBASE_STORAGE_BUCKET",
    "FIREBASE_STORAGE_BUCKET",
  ),
};

/** True kalau credential Firebase sudah terisi di Keys. */
export const firebaseReady = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId,
);

/** "AIza..." dari Firebase console → Web API Key. */
export function firebaseKeyLooksValid() {
  return (firebaseConfig.apiKey ?? "").startsWith("AIza");
}

let cachedAuth: ReturnType<typeof getAuth> | null = null;

function getFirebaseAuth() {
  if (!firebaseReady) return null;
  if (cachedAuth) return cachedAuth;
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  cachedAuth = getAuth(app);
  return cachedAuth;
}

/** Login Google via Firebase.
 *
 *  Tidak ada UI pilih akun / permission buatan kita sendiri: semuanya pakai
 *  popup bawaan Firebase. `prompt` sengaja DIKOSONGKAN supaya Google tidak
 *  memaksa layar pemilihan akun setiap kali — kalau user sudah pernah login,
 *  langsung masuk. Kalau user mau ganti akun, buka popup dari provider Google
 *  di HP-nya.
 *  Popup dipakai di semua perangkat supaya user tidak pernah leaving halaman
 *  YoruNime. Hanya kalau popup ditolak browser (jarang, biasanya di in-app
 *  browser dalam aplikasi yang sangat ketat) kita jatuh ke redirect.
 */
export async function signInWithGoogleFirebase(): Promise<User | null> {
  const auth = getFirebaseAuth();
  if (!auth) return null;
  const provider = new GoogleAuthProvider();
  // prompt kosong = tidak memaksa pilih akun & tidak memaksa izin ulang.
  provider.setCustomParameters({ prompt: "" });
  provider.addScope("email");
  provider.addScope("profile");
  try {
    const cred = await signInWithPopup(auth, provider);
    return cred.user;
  } catch {
    // Popup diblokir / gagal dibuka: pakai redirect sebagai cadangan.
    try {
      await signInWithRedirect(auth, provider);
      return null;
    } catch {
      return null;
    }
  }
}

/** Ambil ID token Firebase user yang sedang login (dipakai buat Convex). */
export async function getFirebaseIdToken(u: User | null): Promise<string | null> {
  if (!u) return null;
  try {
    return await u.getIdToken();
  } catch {
    return null;
  }
}

/** Ambil ID token milik sesi Firebase yang sedang aktif. */
export async function getActiveFirebaseIdToken(): Promise<string | null> {
  const auth = getFirebaseAuth();
  if (!auth?.currentUser) return null;
  try {
    return await auth.currentUser.getIdToken();
  } catch {
    return null;
  }
}

/** True kalau halaman ini adalah hasil balik dari redirect Google Firebase. */
export async function consumeFirebaseRedirect(): Promise<boolean> {
  const auth = getFirebaseAuth();
  if (!auth) return false;
  try {
    const res = await getRedirectResult(auth);
    return res !== null;
  } catch {
    return false;
  }
}
