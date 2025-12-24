# 🔐 OAuth Setup Guide

Step-by-step guide to configure Google and GitHub OAuth for Apex CLI.

---

## 🔵 Google OAuth Setup

### Step 1: Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project named `Apex CLI`

### Step 2: Configure OAuth Consent Screen
1. Go to "APIs & Services" → "OAuth consent screen"
2. Select **External** → Create
3. Fill in App name, support email
4. Add scopes: `email`, `profile`, `openid`

### Step 3: Create OAuth Credentials
1. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
2. Type: **Web application**
3. Add redirect URIs:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://YOUR_CLIENT_DOMAIN/api/auth/callback/google`
4. Copy Client ID and Secret

---

## ⚫ GitHub OAuth Setup

### Step 1: Create OAuth App
1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. "OAuth Apps" → "New OAuth App"
3. Fill in:
   - **Application name:** `Apex CLI`
   - **Homepage URL:** `https://YOUR_CLIENT_DOMAIN`
   - **Authorization callback URL:** `https://YOUR_CLIENT_DOMAIN/api/auth/callback/github`

### Step 2: Get Credentials
1. Copy Client ID
2. Generate and copy Client Secret

---

## 🔧 Environment Variables

Add to server `.env`:

```env
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GITHUB_CLIENT_ID="your-github-client-id"
GITHUB_CLIENT_SECRET="your-github-client-secret"
```

---

## ✅ Testing

```bash
apex login   # Opens browser for OAuth
apex whoami  # Verify login worked
```
