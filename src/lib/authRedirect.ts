/**
 * Tujuan redirect setelah login/daftar.
 *
 * `returnTo` datang dari query string, jadi hanya path internal yang boleh
 * diterima. Protokol absolut (`https://…`), protokol ganda (`//evil.com`) dan
 * backslash (`/\evil.com` yang di browser jadi `//evil.com`) ditolak supaya
 * tidak jadi open redirect.
 */
export function resolveRedirectAfterAuth(
  returnTo: string | null | undefined,
  fallback = "/home",
): string {
  if (!returnTo) return fallback;
  if (!returnTo.startsWith("/")) return fallback;
  if (returnTo.startsWith("//")) return fallback;
  if (returnTo.includes("\\")) return fallback;
  return returnTo;
}
