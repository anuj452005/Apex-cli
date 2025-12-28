# 🚀 Deploying Apex CLI Server on Render

This guide provides step-by-step instructions for deploying the Apex CLI backend on [Render](https://render.com).

## 1. Render Web Service Settings

When creating a new **Web Service** on Render, connect your repository and use these configurations:

| Setting | Value |
|---------|-------|
| **Runtime** | `Node` |
| **Root Directory** | `server` |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm start` |

> [!NOTE]
> We added a `build` script to `server/package.json` that runs `npx prisma generate`.

## 2. Required Environment Variables

Add these in the **Environment** section of your Render service:

| Variable | Example / Purpose |
|----------|-------------------|
| `DATABASE_URL` | `postgresql://user:pass@host:5432/db` |
| `BETTER_AUTH_SECRET` | Run `openssl rand -base64 32` to generate one |
| `BETTER_AUTH_URL` | `https://your-service-name.onrender.com` |
| `GOOGLE_CLIENT_ID` | From Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | From Google Cloud Console |
| `GOOGLE_API_KEY` | From Google AI Studio (Gemini) |
| `FRONTEND_URL` | `https://your-client-domain.vercel.app` |
| `PORT` | `5000` |

## 3. Database Initialization

Since Apex CLI uses Prisma, the database schema needs to be pushed to your production database.

### Initial Setup
Run this once from your local terminal BEFORE the first deployment (replace with your production DB URL):
```bash
cd server
DATABASE_URL="your_production_db_url" npx prisma db push
```

### Automatic Updates (Optional)
If you want the database to update automatically on every deploy, change the **Build Command** in Render to:
`npm install && npm run build && npx prisma db push`

## 4. Common Issues

- **Port Mapping**: Ensure `PORT` is set to `5000` or whatever your server listens on. Render automatically detects the port but setting it explicitly is safer.
- **SSL**: Ensure your `DATABASE_URL` includes `?sslmode=require` if using a provider like Neon.
- **OAuth Callbacks**: Don't forget to add your Render URL to the "Authorized Redirect URIs" in Google Cloud Console.
