import { createAuthClient } from "better-auth/react";

// Web-only auth client
// Used for Google/GitHub OAuth in the browser
// Does NOT include deviceAuthorizationClient to prevent state collision with CLI auth
export const authClient = createAuthClient({
    // baseURL is deliberately omitted to use window.location.origin
    // and rely on next.config.ts rewrites for cross-origin cookie support
})
