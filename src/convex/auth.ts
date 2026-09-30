// THIS FILE IS READ ONLY. Do not touch this file unless you are correctly adding a new auth provider in accordance to the vly auth documentation

import Google from "@auth/core/providers/google";
import { convexAuth } from "@convex-dev/auth/server";
import { Anonymous } from "@convex-dev/auth/providers/Anonymous";
import { emailOtp } from "./auth/emailOtp";


// Client ID & secret Google dibaca dari env Convex:
//   AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET
// Callback URL: https://<deployment>.convex.site/api/auth/callback/google
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [emailOtp, Anonymous, Google],
});
