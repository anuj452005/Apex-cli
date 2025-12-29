import { betterAuth } from "better-auth";
import { deviceAuthorization } from "better-auth/plugins";
import { prismaAdapter } from "better-auth/adapters/prisma";

import prisma from "./db.js";

// CLI-only authentication instance
// Handles Device Authorization flow for CLI login
// Does NOT include social providers to prevent state collision with web auth
export const cliAuth = betterAuth({
    baseURL: (process.env.BETTER_AUTH_URL || "https://apex-cli.onrender.com").replace(/\/$/, ""),
    basePath: "/api/cli-auth",  // Custom basePath for CLI auth routes
    secret: process.env.BETTER_AUTH_SECRET,
    database: prismaAdapter(prisma, {
        provider: "postgresql",
    }),
    trustedOrigins: [
        "https://apex-cli-fr.vercel.app",
        "https://apex-cli.onrender.com"
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
                }
            },
            state: {
                attributes: {
                    sameSite: "none",
                    secure: true,
                    path: "/",
                    httpOnly: true,
                }
            },
            csrfToken: {
                attributes: {
                    sameSite: "none",
                    secure: true,
                    path: "/",
                }
            }
        }
    },
    plugins: [
        deviceAuthorization({
            expiresIn: "30m",
            interval: "5s",
            verificationUri: `${process.env.FRONTEND_URL || "https://apex-cli-fr.vercel.app"}/device`,
        })
    ]
});
