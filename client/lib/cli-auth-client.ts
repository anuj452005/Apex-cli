import { deviceAuthorizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

// CLI-only auth client
// Used for Device Authorization flow on the device verification page
// Uses separate /api/cli-auth endpoint to prevent state collision with web OAuth
export const cliAuthClient = createAuthClient({
    baseURL: process.env.NEXT_PUBLIC_API_URL || "https://apex-cli.onrender.com",
    basePath: "/api/cli-auth",  // CLI-specific auth endpoint
    plugins: [
        deviceAuthorizationClient()
    ]
})
