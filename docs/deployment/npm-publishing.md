# 📦 NPM Package Publishing Guide

Complete guide to publish Apex CLI as an NPM package so anyone can install it globally.

---

## 📋 Prerequisites

- NPM account at [npmjs.com](https://npmjs.com)
- Package name available (check with `npm search apex-ai-cli`)
- All code working locally

---

## Step 1: Create NPM Account

1. Go to [npmjs.com/signup](https://www.npmjs.com/signup)
2. Fill in username, email, password
3. Verify your email
4. Enable 2FA (recommended for security)

---

## Step 2: Login to NPM CLI

```bash
npm login
```

Enter your:
- Username
- Password
- Email
- OTP (if 2FA enabled)

Verify login:
```bash
npm whoami
```

---

## Step 3: Prepare package.json

Update `server/package.json`:

```json
{
  "name": "apex-ai-cli",
  "version": "1.0.0",
  "description": "AI-powered CLI tool with chat, tools, and autonomous agents",
  "main": "src/index.js",
  "bin": {
    "apex": "./src/cli/main.js"
  },
  "files": [
    "src/cli/**/*",
    "src/lib/**/*",
    "src/config/**/*",
    "prisma/schema.prisma"
  ],
  "scripts": {
    "postinstall": "prisma generate || true"
  },
  "keywords": [
    "cli",
    "ai",
    "gemini",
    "google",
    "chat",
    "agent",
    "assistant",
    "terminal",
    "tool-calling"
  ],
  "author": {
    "name": "Your Name",
    "email": "your.email@example.com",
    "url": "https://your-website.com"
  },
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/YOUR_USERNAME/apex-cli.git"
  },
  "bugs": {
    "url": "https://github.com/YOUR_USERNAME/apex-cli/issues"
  },
  "homepage": "https://github.com/YOUR_USERNAME/apex-cli#readme",
  "engines": {
    "node": ">=18.0.0"
  },
  "dependencies": {
    "@ai-sdk/google": "^1.0.0",
    "@clack/prompts": "^0.11.0",
    "@prisma/client": "^5.22.0",
    "ai": "^6.0.3",
    "better-auth": "^1.4.7",
    "boxen": "^8.0.1",
    "chalk": "^5.6.2",
    "commander": "^14.0.2",
    "dotenv": "^17.2.3",
    "figlet": "^1.9.4",
    "open": "^11.0.0",
    "yocto-spinner": "^1.0.0",
    "zod": "^4.2.1"
  }
}
```

---

## Step 4: Create .npmignore

Create `server/.npmignore`:

```
# Development files
node_modules/
.env
.env.*
.git/
.gitignore

# Server-only files (not needed for CLI)
src/index.js

# Build artifacts
*.log
.DS_Store
Thumbs.db

# Test files
test/
tests/
*.test.js
*.spec.js
__tests__/

# Documentation (optional - include if you want)
# docs/

# IDE
.vscode/
.idea/
```

---

## Step 5: Update CLI for Production Server

In `server/src/cli/commands/auth/login.js`, update the server URL:

```javascript
// Change from localhost to production
const DEMO_URL = process.env.APEX_SERVER_URL || "https://apex-api.your-domain.com";
```

Or make it configurable:

```javascript
import os from "os";
import path from "path";
import fs from "fs";

// Check for local config
const configPath = path.join(os.homedir(), ".apex-cli", "config.json");
let serverUrl = "https://apex-api.your-domain.com"; // Default production

try {
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    serverUrl = config.serverUrl || serverUrl;
  }
} catch {}

const DEMO_URL = process.env.APEX_SERVER_URL || serverUrl;
```

---

## Step 6: Add README for NPM

Create `server/README.md`:

```markdown
# Apex AI CLI

AI-powered command-line interface with chat, tools, and autonomous agents.

## Installation

\`\`\`bash
npm install -g apex-ai-cli
\`\`\`

## Quick Start

\`\`\`bash
# Login (opens browser for authentication)
apex login

# Verify login
apex whoami

# Start AI chat
apex chat

# Chat with tools (file/code/shell access)
apex tools

# Run autonomous agent
apex agent -t "Create a React todo app"

# Logout
apex logout
\`\`\`

## Commands

| Command | Description |
|---------|-------------|
| \`apex login\` | Authenticate with Google or GitHub |
| \`apex logout\` | Clear stored credentials |
| \`apex whoami\` | Show current user info |
| \`apex chat\` | Start interactive AI chat |
| \`apex tools\` | Chat with tool access |
| \`apex agent\` | Run autonomous AI agent |

## Configuration

Create \`~/.apex-cli/config.json\` for custom settings:

\`\`\`json
{
  "serverUrl": "https://your-custom-server.com"
}
\`\`\`

## Requirements

- Node.js 18+
- Active internet connection

## License

MIT
\`\`\`

---

## Step 7: Test Locally

Before publishing, test the package locally:

```bash
cd server

# Create tarball
npm pack

# Install globally from tarball
npm install -g apex-ai-cli-1.0.0.tgz

# Test commands
apex --version
apex --help
apex login
apex whoami
```

---

## Step 8: Publish to NPM

### First-time publish:
```bash
cd server
npm publish
```

### If name is taken, use scoped package:
```bash
# Update package.json name to:
# "@your-username/apex-ai-cli"

npm publish --access public
```

---

## Step 9: Verify Publication

1. Check on npmjs.com:
   ```
   https://www.npmjs.com/package/apex-ai-cli
   ```

2. Test installation:
   ```bash
   npm install -g apex-ai-cli
   apex --version
   ```

---

## 🔄 Publishing Updates

### Patch update (bug fixes): 1.0.0 → 1.0.1
```bash
npm version patch
npm publish
```

### Minor update (new features): 1.0.0 → 1.1.0
```bash
npm version minor
npm publish
```

### Major update (breaking changes): 1.0.0 → 2.0.0
```bash
npm version major
npm publish
```

---

## 📊 Package Quality Checklist

Before publishing:

- [ ] All commands work locally
- [ ] `package.json` has correct metadata
- [ ] README.md is informative
- [ ] `files` array includes all necessary files
- [ ] `.npmignore` excludes dev/sensitive files
- [ ] Production server URL is set
- [ ] Version number is appropriate
- [ ] License file exists

---

## 🔒 Security Best Practices

1. **Never include in package:**
   - API keys
   - `.env` files
   - Database credentials
   - Private keys

2. **Use environment variables:**
   ```javascript
   const apiKey = process.env.GOOGLE_API_KEY;
   ```

3. **Enable 2FA on NPM:**
   ```bash
   npm profile enable-2fa auth-and-writes
   ```

4. **Use npm audit:**
   ```bash
   npm audit
   npm audit fix
   ```

---

## ❓ Common Issues

| Issue | Solution |
|-------|----------|
| `Package name already exists` | Use scoped package `@username/package` |
| `You must be logged in` | Run `npm login` |
| `Cannot publish private package` | Add `--access public` for scoped packages |
| `Version already exists` | Bump version with `npm version patch` |
| `Missing required files` | Check `files` array in package.json |

---

## 🎉 Success!

After publishing, users can install with:

```bash
npm install -g apex-ai-cli
```

Or with npx (no install):

```bash
npx apex-ai-cli login
npx apex-ai-cli chat
```
