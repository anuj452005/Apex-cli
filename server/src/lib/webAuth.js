import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";

import prisma from "./db.js";

// Web-only authentication instance
// Handles Google and GitHub OAuth for browser-based login
// Does NOT include Device Authorization to prevent state collision with CLI auth
export const webAuth = betterAuth({
  baseURL: (
    process.env.FRONTEND_URL || "https://apex-cli-fr.vercel.app"
  ).replace(/\/$/, ""),
  secret: process.env.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  trustedOrigins: [
    "https://apex-cli-fr.vercel.app",
    "https://apex-cli.onrender.com",
  ],
  advanced: {
    useSecureCookies: true,
    cookies: {
      sessionToken: {
        attributes: {
          sameSite: "none",
          secure: true,
          path: "/",
          httpOnly: true,
        },
      },
      state: {
        attributes: {
          sameSite: "none",
          secure: true,
          path: "/",
          httpOnly: true,
        },
      },
      csrfToken: {
        attributes: {
          sameSite: "none",
          secure: true,
          path: "/",
        },
      },
      pkCodeVerifier: {
        attributes: {
          sameSite: "none",
          secure: true,
          path: "/",
          httpOnly: true,
        },
      },
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    },
  },
});
