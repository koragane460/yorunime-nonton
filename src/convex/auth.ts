// THIS FILE IS READ ONLY. Do not touch this file unless you are correctly adding a new auth provider in accordance to the vly auth documentation

import { convexAuth } from "@convex-dev/auth/server";
import { Anonymous } from "@convex-dev/auth/providers/Anonymous";
import { Password } from "@convex-dev/auth/providers/Password";
import { emailOtp } from "./auth/emailOtp";
import { firebase } from "./auth/firebase";


export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    // Daftar / masuk pakai email + password (akun dibuat setelah password
    // lengkap, bukan sebelum — jadi tidak ada akun setengah jadi).
    Password({
      id: "password",
      // Email dinormalisasi (supaya email & password untuk email yang sama
      // selalu kena), dan nama tampilan ikut tersimpan saat daftar.
      profile: (params) => {
        const email = String(params.email ?? "").trim().toLowerCase();
        const name = String(params.name ?? "").trim();
        return { email, name };
      },
    }),
    emailOtp,
    Anonymous,
    firebase,
  ],
});
