import { describe, expect, test } from "bun:test";
import { resolveRedirectAfterAuth } from "../src/lib/authRedirect";

describe("login: tujuan redirect setelah masuk", () => {
  test("returnTo internal dipakai apa adanya", () => {
    expect(resolveRedirectAfterAuth("/home")).toBe("/home");
    expect(resolveRedirectAfterAuth("/nonton?anime=12&ep=3")).toBe(
      "/nonton?anime=12&ep=3",
    );
    expect(resolveRedirectAfterAuth("/clan")).toBe("/clan");
    expect(resolveRedirectAfterAuth("/akun")).toBe("/akun");
  });

  test("tanpa returnTo jatuh ke halaman utama anggota", () => {
    expect(resolveRedirectAfterAuth(null)).toBe("/home");
    expect(resolveRedirectAfterAuth(undefined)).toBe("/home");
    expect(resolveRedirectAfterAuth("")).toBe("/home");
    expect(resolveRedirectAfterAuth(null, "/dashboard")).toBe("/dashboard");
  });

  test("URL eksternal ditolak (anti open redirect)", () => {
    expect(resolveRedirectAfterAuth("https://evil.example")).toBe("/home");
    expect(resolveRedirectAfterAuth("//evil.example")).toBe("/home");
    expect(resolveRedirectAfterAuth("/\\evil.example")).toBe("/home");
    expect(resolveRedirectAfterAuth("javascript:alert(1)")).toBe("/home");
    expect(resolveRedirectAfterAuth("evil.example")).toBe("/home");
  });

  test("fallback custom tetap dipakai untuk kasus ditolak", () => {
    expect(resolveRedirectAfterAuth("//evil.example", "/premium")).toBe(
      "/premium",
    );
  });
});
