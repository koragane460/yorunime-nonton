/**
 * Sesi multi-akun di perangkat ini.
 *
 * Convex Auth menyimpan JWT + refresh token di localStorage dengan nama
 * `__convexAuthJWT_<namespace>` dan `__convexAuthRefreshToken_<namespace>`.
 * Kita menyimpan salinan kedua token itu per akun, lalu menukarnya sebelum
 * reload supaya aplikasi benar-benar masuk sebagai akun yang dipilih.
 */

export type SavedAccount = {
  id: string;
  username: string;
  image?: string;
  bannerUrl?: string;
  unread: number;
  tokens: { jwt: string; refresh: string };
  savedAt: number;
};

const KEY = "yn:accounts:v1";
const MAX_ACCOUNTS = 5;

function canUseStorage() {
  return typeof window !== "undefined" && !!window.localStorage;
}

export function readSavedAccounts(): SavedAccount[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedAccount[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (a) =>
        a &&
        typeof a.id === "string" &&
        typeof a.username === "string" &&
        typeof a.tokens?.jwt === "string" &&
        typeof a.tokens?.refresh === "string",
    );
  } catch {
    return [];
  }
}

function writeSavedAccounts(list: SavedAccount[]) {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(
      KEY,
      JSON.stringify(list.slice(0, MAX_ACCOUNTS)),
    );
  } catch {
    /* localStorage bisa diblokir di mode privat */
  }
}

/** Token sesi yang sedang aktif, apa pun namespace Convex-nya. */
export function readActiveTokens(): { jwt: string; refresh: string } | null {
  if (!canUseStorage()) return null;
  let jwt = "";
  let refresh = "";
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i) ?? "";
    if (key.startsWith("__convexAuthJWT_")) {
      jwt = window.localStorage.getItem(key) ?? "";
    } else if (key.startsWith("__convexAuthRefreshToken_")) {
      refresh = window.localStorage.getItem(key) ?? "";
    }
  }
  return jwt && refresh ? { jwt, refresh } : jwt ? { jwt, refresh: "" } : null;
}

/** Simpan / perbarui akun yang sedang aktif beserta badge belum dibaca. */
export function saveCurrentAccount(
  user: {
    _id: string;
    username?: string;
    image?: string;
    bannerUrl?: string;
  },
  unread = 0,
): SavedAccount[] {
  const tokens = readActiveTokens();
  const list = readSavedAccounts();
  if (!tokens?.jwt) return list;
  const next: SavedAccount = {
    id: String(user._id),
    username: user.username?.trim() || "user",
    image: user.image,
    bannerUrl: user.bannerUrl,
    unread: Math.max(0, Math.floor(unread || 0)),
    tokens,
    savedAt: Date.now(),
  };
  const merged = [next, ...list.filter((a) => a.id !== next.id)];
  writeSavedAccounts(merged);
  return readSavedAccounts();
}

/**
 * Tukar token sesi ke akun tujuan, lalu reload. Semua kunci auth lama
 * (termasuk cache server-state) dibersihkan dulu supaya tidak ada sisa
 * sesi akun sebelumnya.
 */
export function activateSavedAccount(accountId: string): boolean {
  if (!canUseStorage()) return false;
  const account = readSavedAccounts().find((a) => a.id === accountId);
  if (!account) return false;

  const namespaceSuffix = (() => {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i) ?? "";
      if (key.startsWith("__convexAuthJWT_")) {
        return key.slice("__convexAuthJWT_".length);
      }
    }
    return "";
  })();
  if (!namespaceSuffix) return false;

  const keys = [
    `__convexAuthJWT_${namespaceSuffix}`,
    `__convexAuthRefreshToken_${namespaceSuffix}`,
    `__convexAuthOAuthVerifier_${namespaceSuffix}`,
    `__convexAuthServerStateFetchTime_${namespaceSuffix}`,
  ];
  for (const key of keys) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* abaikan */
    }
  }
  try {
    window.localStorage.setItem(
      `__convexAuthJWT_${namespaceSuffix}`,
      account.tokens.jwt,
    );
    if (account.tokens.refresh) {
      window.localStorage.setItem(
        `__convexAuthRefreshToken_${namespaceSuffix}`,
        account.tokens.refresh,
      );
    }
  } catch {
    return false;
  }

  // Simpan akun tujuan sebagai yang terakhir dipakai (urut teratas).
  const list = readSavedAccounts();
  if (list.length > 0) {
    writeSavedAccounts([
      account,
      ...list.filter((a) => a.id !== account.id),
    ]);
  }

  window.location.replace("/home");
  return true;
}

export function removeSavedAccount(accountId: string) {
  writeSavedAccounts(readSavedAccounts().filter((a) => a.id !== accountId));
}
