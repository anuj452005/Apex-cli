import { betterAuth } from "better-auth";
import { deviceAuthorization } from "better-auth/plugins";
import { prismaAdapter } from "better-auth/adapters/prisma";

import prisma from "./db.js";

export const auth = betterAuth({
    database: prismaAdapter(prisma, {
        provider: "postgresql",
    }),
    trustedOrigins: [process.env.FRONTEND_URL || "https://apex-cli-fr.vercel.app"],
    plugins: [
        deviceAuthorization({
            expiresIn: "30m",
            interval : "5s",
            verificationUri: `${process.env.FRONTEND_URL || "https://apex-cli-fr.vercel.app"}/device`,
        })
    ],
    socialProviders:{
        google:{
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        },
        github:{
            clientId: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET,
        }
    }
});