import { createAuthClient } from "better-auth/react";

// Web-only auth client
// Used for Google/GitHub OAuth in the browser
// Does NOT include deviceAuthorizationClient to prevent state collision with CLI auth
export const authClient = createAuthClient({
    baseURL: process.env.NEXT_PUBLIC_API_URL || "https://apex-cli.onrender.com",
})
