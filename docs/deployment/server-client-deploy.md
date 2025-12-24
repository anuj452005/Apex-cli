# 🌐 Server & Client Deployment Guide

Detailed guide for deploying the Express server and Next.js client to production.

---

## 📊 Deployment Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    DEPLOYMENT ARCHITECTURE                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────┐         ┌─────────────┐                      │
│   │   User's    │  npm i  │   NPM       │                      │
│   │   Terminal  │◄────────│   Registry  │                      │
│   └──────┬──────┘         └─────────────┘                      │
│          │                                                      │
│          │ apex login                                           │
│          │                                                      │
│          ▼                                                      │
│   ┌─────────────┐         ┌─────────────┐                      │
│   │   Browser   │◄────────│   Vercel    │  (Next.js Client)    │
│   │   OAuth     │         │   /Netlify  │                      │
│   └──────┬──────┘         └──────┬──────┘                      │
│          │                        │                             │
│          │                        │ API calls                   │
│          │                        ▼                             │
│          │                ┌─────────────┐                      │
│          │    token       │   Railway   │  (Express Server)    │
│          └───────────────▶│   /Render   │                      │
│                           └──────┬──────┘                      │
│                                  │                              │
│                                  ▼                              │
│                           ┌─────────────┐                      │
│                           │   Neon/     │  (PostgreSQL)        │
│                           │   Supabase  │                      │
│                           └─────────────┘                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🖥️ Server Deployment

### Option A: Railway (Recommended)

#### Step 1: Install Railway CLI
```bash
npm install -g @railway/cli
railway login
```

#### Step 2: Initialize Project
```bash
cd server
railway init
```
Select "Empty Project"

#### Step 3: Add PostgreSQL
```bash
railway add
```
Select "PostgreSQL"

#### Step 4: Link to Project
```bash
railway link
```

#### Step 5: Set Environment Variables
```bash
# Database URL is auto-set from PostgreSQL
railway variables set BETTER_AUTH_SECRET="$(openssl rand -base64 32)"
railway variables set BETTER_AUTH_URL="will-update-after-deploy"
railway variables set GOOGLE_CLIENT_ID="your-google-client-id"
railway variables set GOOGLE_CLIENT_SECRET="your-google-client-secret"
railway variables set GITHUB_CLIENT_ID="your-github-client-id"
railway variables set GITHUB_CLIENT_SECRET="your-github-client-secret"
railway variables set GOOGLE_API_KEY="your-gemini-api-key"
railway variables set FRONTEND_URL="will-update-after-client-deploy"
```

#### Step 6: Create railway.json
Create `server/railway.json`:
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npx prisma generate && npx prisma db push && npm start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

#### Step 7: Deploy
```bash
railway up
```

#### Step 8: Get Domain
```bash
railway domain
# Or go to Railway dashboard and generate domain
```

#### Step 9: Update BETTER_AUTH_URL
```bash
railway variables set BETTER_AUTH_URL="https://your-app.railway.app"
```

---

### Option B: Render

#### Step 1: Create Account
Go to [render.com](https://render.com) and sign up

#### Step 2: Connect GitHub
1. Go to Dashboard
2. Click "New" → "Web Service"
3. Connect your GitHub repository

#### Step 3: Configure Service
- **Name:** `apex-api`
- **Region:** Choose closest
- **Branch:** `main`
- **Root Directory:** `server`
- **Runtime:** `Node`
- **Build Command:** `npm install && npx prisma generate`
- **Start Command:** `npx prisma db push && npm start`

#### Step 4: Add Environment Variables
Go to "Environment" tab and add all variables

#### Step 5: Deploy
Click "Create Web Service"

---

### Option C: Fly.io

#### Step 1: Install Fly CLI
```bash
# Windows (PowerShell)
powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"

# macOS/Linux
curl -L https://fly.io/install.sh | sh
```

#### Step 2: Login
```bash
fly auth login
```

#### Step 3: Initialize
```bash
cd server
fly launch
```
Answer the prompts:
- App name: `apex-api`
- Region: Choose closest
- PostgreSQL: Yes

#### Step 4: Set Secrets
```bash
fly secrets set GOOGLE_CLIENT_ID="..."
fly secrets set GOOGLE_CLIENT_SECRET="..."
fly secrets set GITHUB_CLIENT_ID="..."
fly secrets set GITHUB_CLIENT_SECRET="..."
fly secrets set GOOGLE_API_KEY="..."
fly secrets set BETTER_AUTH_SECRET="..."
fly secrets set FRONTEND_URL="..."
```

#### Step 5: Deploy
```bash
fly deploy
```

---

## 🎨 Client Deployment

### Option A: Vercel (Recommended for Next.js)

#### Step 1: Install Vercel CLI
```bash
npm install -g vercel
vercel login
```

#### Step 2: Deploy
```bash
cd client
vercel
```

Answer prompts:
- Set up and deploy? `Y`
- Which scope? Select your account
- Link to existing project? `N`
- Project name: `apex-client`
- Directory: `./`
- Override settings? `N`

#### Step 3: Set Environment Variables
Go to [vercel.com/dashboard](https://vercel.com/dashboard):
1. Select your project
2. Settings → Environment Variables
3. Add:
   - `NEXT_PUBLIC_API_URL` = `https://your-server.railway.app`

#### Step 4: Redeploy
```bash
vercel --prod
```

---

### Option B: Netlify

#### Step 1: Install Netlify CLI
```bash
npm install -g netlify-cli
netlify login
```

#### Step 2: Create netlify.toml
Create `client/netlify.toml`:
```toml
[build]
  command = "npm run build"
  publish = ".next"

[[plugins]]
  package = "@netlify/plugin-nextjs"
```

#### Step 3: Deploy
```bash
cd client
npm install @netlify/plugin-nextjs
netlify deploy --prod
```

#### Step 4: Set Environment Variables
Go to Netlify dashboard:
1. Site settings → Environment variables
2. Add `NEXT_PUBLIC_API_URL`

---

## 🔗 Post-Deployment: Connect Everything

### 1. Update Server with Client URL
```bash
# Railway
railway variables set FRONTEND_URL="https://apex-client.vercel.app"

# Render
# Go to Dashboard → Environment → Add variable

# Fly.io
fly secrets set FRONTEND_URL="https://apex-client.vercel.app"
```

### 2. Update OAuth Redirect URIs

**Google Cloud Console:**
Add redirect URI:
```
https://apex-client.vercel.app/api/auth/callback/google
```

**GitHub OAuth App:**
Update callback URL:
```
https://apex-client.vercel.app/api/auth/callback/github
```

### 3. Update CLI Production URL

In `server/src/cli/commands/auth/login.js`:
```javascript
const DEMO_URL = "https://apex-api.railway.app";
```

### 4. Republish NPM Package
```bash
cd server
npm version patch
npm publish
```

---

## ✅ Production Verification

### Test Full Flow

1. **Install CLI:**
   ```bash
   npm install -g apex-ai-cli
   ```

2. **Login:**
   ```bash
   apex login
   ```
   - Browser should open to production client
   - OAuth should work

3. **Verify:**
   ```bash
   apex whoami
   ```

4. **Test Chat:**
   ```bash
   apex chat
   ```

---

## 📊 Monitoring

### Railway
```bash
railway logs -f
```

### Render
Dashboard → Logs

### Fly.io
```bash
fly logs
```

### Vercel
Dashboard → Deployments → Logs

---

## 🔄 Continuous Deployment

### Auto-deploy on Push

**Railway:**
Automatically deploys on push to main branch

**Render:**
Automatically deploys on push

**Vercel:**
Automatically deploys on push

### Manual Deploys

```bash
# Railway
railway up

# Fly.io
fly deploy

# Vercel
vercel --prod
```

---

## 💰 Cost Estimation

| Service | Free Tier | When to Upgrade |
|---------|-----------|-----------------|
| **Railway** | $5/month credit | 500+ users |
| **Render** | 750 hours/month | Need more RAM |
| **Fly.io** | 3 shared VMs | Need more regions |
| **Vercel** | 100GB bandwidth | High traffic |
| **Neon** | 0.5GB storage | Need more storage |
| **Supabase** | 500MB storage | Need more storage |

---

## ❓ Troubleshooting

| Issue | Solution |
|-------|----------|
| 502 Bad Gateway | Check server logs, verify start command |
| CORS errors | Verify FRONTEND_URL matches exactly |
| OAuth redirect fails | Update redirect URIs in OAuth apps |
| Database connection fails | Check DATABASE_URL, ensure SSL |
| Build fails | Check logs, verify dependencies |
| Timeout on cold start | Increase timeout or use always-on tier |
