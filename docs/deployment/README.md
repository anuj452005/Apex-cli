# 🚀 Apex CLI Deployment Guide

Complete step-by-step guide to deploy Apex CLI so others can use it.

## 📋 Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Project Structure Overview](#2-project-structure-overview)
3. [Environment Setup](#3-environment-setup)
4. [Database Setup (PostgreSQL)](#4-database-setup-postgresql)
5. [Server Deployment](#5-server-deployment)
6. [Client Deployment](#6-client-deployment)
7. [NPM Package Publishing](#7-npm-package-publishing)
8. [User Installation Guide](#8-user-installation-guide)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Prerequisites

Before deploying, ensure you have:

### For Development/Deployment:
- **Node.js** v18+ 
- **npm** v9+ or **pnpm**
- **Git** installed
- **PostgreSQL** database (local or cloud)
- **Google Cloud Account** (for Gemini API)
- **GitHub/Google OAuth Apps** (for authentication)

### Cloud Services Needed:
| Service | Purpose | Recommended Provider |
|---------|---------|---------------------|
| Database | PostgreSQL | [Neon](https://neon.tech), [Supabase](https://supabase.com), [Railway](https://railway.app) |
| Server | Express API | [Railway](https://railway.app), [Render](https://render.com), [Fly.io](https://fly.io) |
| Client | Next.js Frontend | [Vercel](https://vercel.com), [Netlify](https://netlify.com) |
| NPM | CLI Package | [npmjs.com](https://npmjs.com) |

---

## 2. Project Structure Overview

```
Apex-cli/
├── client/                 # Next.js frontend (for OAuth flow)
│   ├── app/
│   │   ├── (auth)/        # Sign-in/Sign-up pages
│   │   ├── approve/       # Device approval page
│   │   └── device/        # Device authorization page
│   └── ...
├── server/                 # Express backend + CLI
│   ├── src/
│   │   ├── cli/           # CLI source code
│   │   ├── lib/           # Auth, DB, utilities
│   │   └── index.js       # Express server
│   ├── prisma/            # Database schema
│   └── package.json       # NPM package config
└── docs/                   # Documentation
```

---

## 3. Environment Setup

### 3.1 Get API Keys

#### Google Gemini API Key
1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Click "Create API Key"
3. Copy the key → `GOOGLE_API_KEY`

#### Google OAuth Credentials
1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a new project (or select existing)
3. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
4. Application type: "Web application"
5. Add Authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google` (development)
   - `https://YOUR_CLIENT_DOMAIN/api/auth/callback/google` (production)
6. Copy:
   - Client ID → `GOOGLE_CLIENT_ID`
   - Client Secret → `GOOGLE_CLIENT_SECRET`

#### GitHub OAuth Credentials
1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. "New OAuth App"
3. Fill in:
   - Application name: `Apex CLI`
   - Homepage URL: `https://YOUR_CLIENT_DOMAIN`
   - Authorization callback URL: `https://YOUR_CLIENT_DOMAIN/api/auth/callback/github`
4. Copy:
   - Client ID → `GITHUB_CLIENT_ID`
   - Client Secret → `GITHUB_CLIENT_SECRET`

---

## 4. Database Setup (PostgreSQL)

### Option A: Using Neon (Recommended - Free Tier)

1. Go to [neon.tech](https://neon.tech) and sign up
2. Create a new project
3. Copy the connection string:
   ```
   postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require
   ```
4. Set as `DATABASE_URL`

### Option B: Using Supabase

1. Go to [supabase.com](https://supabase.com)
2. Create new project
3. Go to Settings → Database → Connection string
4. Copy the URI (with your password)

### Option C: Using Railway

1. Go to [railway.app](https://railway.app)
2. New Project → Provision PostgreSQL
3. Click on the database → Connect → Copy connection string

### Initialize Database

```bash
cd server
npx prisma generate
npx prisma db push
```

---

## 5. Server Deployment

### 5.1 Prepare Server Environment Variables

Create production `.env` file:

```env
# Database
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require"

# Better Auth
BETTER_AUTH_SECRET="generate-a-random-32-char-string"
BETTER_AUTH_URL="https://YOUR_SERVER_DOMAIN"

# OAuth Providers
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GITHUB_CLIENT_ID="your-github-client-id"
GITHUB_CLIENT_SECRET="your-github-client-secret"

# AI
GOOGLE_API_KEY="your-gemini-api-key"

# Frontend URL (for CORS and redirects)
FRONTEND_URL="https://YOUR_CLIENT_DOMAIN"

# Port
PORT=5000
```

### 5.2 Deploy to Railway (Recommended)

1. **Install Railway CLI:**
   ```bash
   npm install -g @railway/cli
   railway login
   ```

2. **Create Project:**
   ```bash
   cd server
   railway init
   ```

3. **Add PostgreSQL:**
   ```bash
   railway add --plugin postgresql
   ```

4. **Set Environment Variables:**
   ```bash
   railway variables set GOOGLE_CLIENT_ID="..."
   railway variables set GOOGLE_CLIENT_SECRET="..."
   railway variables set GITHUB_CLIENT_ID="..."
   railway variables set GITHUB_CLIENT_SECRET="..."
   railway variables set GOOGLE_API_KEY="..."
   railway variables set FRONTEND_URL="https://your-client.vercel.app"
   railway variables set BETTER_AUTH_SECRET="your-secret"
   ```

5. **Deploy:**
   ```bash
   railway up
   ```

6. **Get Domain:**
   ```bash
   railway domain
   ```
   Note this URL as `YOUR_SERVER_DOMAIN`

### 5.3 Deploy to Render

1. Go to [render.com](https://render.com)
2. New → Web Service
3. Connect your GitHub repo
4. Settings:
   - **Root Directory:** `server`
   - **Build Command:** `npm install && npx prisma generate`
   - **Start Command:** `npm start`
5. Add Environment Variables (same as above)
6. Deploy

---

## 6. Client Deployment

### 6.1 Prepare Client Environment Variables

Create `.env.production`:

```env
NEXT_PUBLIC_API_URL="https://YOUR_SERVER_DOMAIN"
```

### 6.2 Deploy to Vercel (Recommended)

1. **Install Vercel CLI:**
   ```bash
   npm install -g vercel
   vercel login
   ```

2. **Deploy:**
   ```bash
   cd client
   vercel
   ```

3. **Set Environment Variables in Vercel Dashboard:**
   - Go to Project Settings → Environment Variables
   - Add: `NEXT_PUBLIC_API_URL` = `https://YOUR_SERVER_DOMAIN`

4. **Redeploy:**
   ```bash
   vercel --prod
   ```

5. Note your Vercel URL as `YOUR_CLIENT_DOMAIN`

### 6.3 Update OAuth Redirect URIs

After getting your production URLs, update:

1. **Google Cloud Console:**
   - Add `https://YOUR_CLIENT_DOMAIN/api/auth/callback/google`

2. **GitHub OAuth App:**
   - Update callback URL to `https://YOUR_CLIENT_DOMAIN/api/auth/callback/github`

3. **Server Environment:**
   - Update `FRONTEND_URL` to `https://YOUR_CLIENT_DOMAIN`

---

## 7. NPM Package Publishing

### 7.1 Prepare package.json

Update `server/package.json`:

```json
{
  "name": "apex-ai-cli",
  "version": "1.0.0",
  "description": "AI-powered CLI tool with authentication",
  "main": "src/index.js",
  "bin": {
    "apex": "src/cli/main.js"
  },
  "files": [
    "src/cli/**/*",
    "src/lib/**/*",
    "src/config/**/*"
  ],
  "keywords": [
    "cli",
    "ai",
    "gemini",
    "chat",
    "agent"
  ],
  "author": "Your Name",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/YOUR_USERNAME/apex-cli"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

### 7.2 Create .npmignore

Create `server/.npmignore`:

```
# Don't publish these
node_modules/
.env
.env.*
prisma/
src/index.js
*.log
.git/
```

### 7.3 Update CLI for Production

Update `src/cli/main.js` to use production server:

```javascript
// Change DEMO_URL in login.js
const DEMO_URL = process.env.APEX_SERVER_URL || "https://YOUR_SERVER_DOMAIN";
```

### 7.4 Publish to NPM

1. **Create NPM Account:**
   Go to [npmjs.com](https://npmjs.com) and sign up

2. **Login:**
   ```bash
   npm login
   ```

3. **Test Locally First:**
   ```bash
   cd server
   npm link
   apex --version
   ```

4. **Publish:**
   ```bash
   npm publish
   ```

5. **For Updates:**
   ```bash
   npm version patch  # or minor, major
   npm publish
   ```

---

## 8. User Installation Guide

Create this as a public README for users:

### Installation

```bash
npm install -g apex-ai-cli
```

### Setup

1. **Login to Apex:**
   ```bash
   apex login
   ```
   This opens a browser for authentication.

2. **Verify Login:**
   ```bash
   apex whoami
   ```

### Usage

```bash
# Interactive AI chat
apex chat

# Chat with tools (file, code, shell access)
apex tools

# Autonomous AI agent
apex agent -t "Create a React todo app"

# Logout
apex logout
```

### Environment Variables (Optional)

Create `~/.apex-cli/.env` for custom settings:

```env
APEX_SERVER_URL=https://your-custom-server.com
GOOGLE_API_KEY=your-own-api-key
```

---

## 9. Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| `GOOGLE_API_KEY not set` | Add `GOOGLE_API_KEY` to server `.env` |
| OAuth callback error | Check redirect URIs match exactly |
| Database connection failed | Verify `DATABASE_URL` and SSL settings |
| CORS errors | Ensure `FRONTEND_URL` is correct in server |
| `apex` command not found | Run `npm link` in server directory |

### Debug Commands

```bash
# Check if CLI is installed
which apex

# Check Node version
node --version

# Check npm global packages
npm list -g --depth=0

# Test server connection
curl https://YOUR_SERVER_DOMAIN/api/health
```

### Logs

- **Railway:** `railway logs`
- **Render:** Dashboard → Logs
- **Vercel:** Dashboard → Deployments → Logs

---

## 📊 Deployment Checklist

- [ ] PostgreSQL database created
- [ ] Google OAuth app configured
- [ ] GitHub OAuth app configured
- [ ] Google Gemini API key obtained
- [ ] Server deployed and running
- [ ] Client deployed and running
- [ ] OAuth redirect URIs updated for production
- [ ] Server `FRONTEND_URL` points to client
- [ ] Client `NEXT_PUBLIC_API_URL` points to server
- [ ] NPM package published
- [ ] Test full flow: `apex login` → `apex chat`

---

## 🎉 Done!

Your Apex CLI is now deployed and available for others to install via:

```bash
npm install -g apex-ai-cli
apex login
apex chat
```
