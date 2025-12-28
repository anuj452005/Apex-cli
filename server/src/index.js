import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { fromNodeHeaders, toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth.js";

dotenv.config();

const app = express();
app.set('trust proxy', 1);

app.get("/", (req, res) => res.json({ status: "Apex API Running", timestamp: new Date() }));

app.use(
    cors({
        origin: process.env.FRONTEND_URL,
        methods: ["GET", "POST", "PUT", "DELETE"],
        credentials: true,
    })
);

app.use("/api/auth", toNodeHandler(auth));
app.use(express.json());

app.get("/api/health",async (req,res)=>{
    const session=await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
    })
    return res.json(session)
})

app.get("/device",async  (req,res)=>{
    const {user_code}=req.query;
    res.redirect(`${process.env.FRONTEND_URL}/device?user_code=${user_code}`)
})
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
