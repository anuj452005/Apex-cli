import { deviceAuthorizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
    baseURL: process.env.NEXT_PUBLIC_API_URL || "https://apex-cli.onrender.com",
    plugins: [
        deviceAuthorizationClient()
    ]
})
