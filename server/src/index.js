import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { fromNodeHeaders, toNodeHandler } from "better-auth/node";
import { webAuth } from "./lib/webAuth.js";
import { cliAuth } from "./lib/cliAuth.js";

dotenv.config();

const app = express();
app.set('trust proxy', true);
console.log("Auth Environment - BETTER_AUTH_SECRET:", !!process.env.BETTER_AUTH_SECRET, "BETTER_AUTH_URL:", process.env.BETTER_AUTH_URL);

app.get("/", (req, res) => res.json({ status: "Apex API Running", timestamp: new Date() }));

app.use(
    cors({
        origin: process.env.FRONTEND_URL,
        methods: ["GET", "POST", "PUT", "DELETE"],
        credentials: true,
    })
);

// Web authentication routes (Google, GitHub OAuth)
// Used by browser-based frontend login
app.all("/api/auth/*path", toNodeHandler(webAuth));

// CLI authentication routes (Device Authorization)
// Used by CLI login - separate to prevent state collision with web auth
app.all("/api/cli-auth/*path", toNodeHandler(cliAuth));

app.use(express.json());

app.get("/api/health", async (req, res) => {
    const session = await webAuth.api.getSession({
        headers: fromNodeHeaders(req.headers),
    })
    return res.json(session)
})

app.get("/device", async (req, res) => {
    const { user_code } = req.query;
    res.redirect(`${process.env.FRONTEND_URL}/device?user_code=${user_code}`)
})

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
