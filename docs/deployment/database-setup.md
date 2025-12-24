# 🗄️ Database Setup Guide

Detailed guide for setting up PostgreSQL database for Apex CLI.

---

## 📋 Database Requirements

Apex CLI uses **PostgreSQL** with **Prisma ORM** for:
- User authentication (Better Auth)
- Session management
- Device authorization tokens

---

## Option 1: Neon (Recommended - Free Tier)

### Step 1: Create Account
1. Go to [neon.tech](https://neon.tech)
2. Sign up with GitHub or email
3. Verify your email

### Step 2: Create Project
1. Click "Create Project"
2. Fill in:
   - **Project Name:** `apex-cli`
   - **Region:** Choose closest to you
   - **PostgreSQL Version:** 16 (latest)
3. Click "Create Project"

### Step 3: Get Connection String
1. After creation, you'll see the connection details
2. Click "Copy" on the connection string
3. It looks like:
   ```
   postgresql://USER:PASSWORD@ep-xxx.region.aws.neon.tech/neondb?sslmode=require
   ```

### Step 4: Add to .env
```env
DATABASE_URL="postgresql://USER:PASSWORD@ep-xxx.region.aws.neon.tech/neondb?sslmode=require"
```

---

## Option 2: Supabase

### Step 1: Create Project
1. Go to [supabase.com](https://supabase.com)
2. Sign up and create organization
3. Click "New Project"
4. Fill in:
   - **Name:** `apex-cli`
   - **Database Password:** Generate strong password (save it!)
   - **Region:** Choose closest

### Step 2: Get Connection String
1. Go to **Settings** → **Database**
2. Scroll to "Connection string"
3. Copy the **URI** format
4. Replace `[YOUR-PASSWORD]` with your database password

### Step 3: Add to .env
```env
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.xxx.supabase.co:5432/postgres"
```

---

## Option 3: Railway

### Step 1: Create Project
1. Go to [railway.app](https://railway.app)
2. Sign in with GitHub
3. Click "New Project"

### Step 2: Add PostgreSQL
1. Click "Add Service" → "Database" → "PostgreSQL"
2. Wait for provisioning

### Step 3: Get Connection String
1. Click on the PostgreSQL service
2. Go to "Connect" tab
3. Copy "Postgres Connection URL"

### Step 4: Add to .env
```env
DATABASE_URL="postgresql://postgres:xxx@containers-xxx.railway.app:5432/railway"
```

---

## Option 4: Local PostgreSQL (Development)

### Install PostgreSQL

**Windows:**
1. Download from [postgresql.org](https://www.postgresql.org/download/windows/)
2. Run installer, remember the password you set
3. Default port: 5432

**macOS:**
```bash
brew install postgresql@16
brew services start postgresql@16
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

### Create Database
```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE apex_cli;

# Create user (optional)
CREATE USER apex_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE apex_cli TO apex_user;

# Exit
\q
```

### Connection String
```env
DATABASE_URL="postgresql://postgres:your_password@localhost:5432/apex_cli"
```

---

## 🔧 Initialize Database with Prisma

### Step 1: Generate Prisma Client
```bash
cd server
npx prisma generate
```

### Step 2: Push Schema to Database
```bash
npx prisma db push
```

### Step 3: Verify Tables Created
```bash
npx prisma studio
```
This opens a browser to view your database tables.

---

## 📊 Database Schema

Apex CLI creates these tables (managed by Better Auth):

| Table | Purpose |
|-------|---------|
| `user` | User accounts |
| `session` | Active sessions |
| `account` | OAuth provider links |
| `verification` | Email verification tokens |
| `deviceAuthorization` | CLI device codes |

---

## 🔒 Security Best Practices

1. **Never commit `.env` files**
   ```gitignore
   # .gitignore
   .env
   .env.*
   ```

2. **Use SSL in production**
   ```env
   DATABASE_URL="...?sslmode=require"
   ```

3. **Rotate credentials regularly**
   - Change database password every 90 days
   - Update connection string in deployment

4. **Use connection pooling for high load**
   - Neon: Pooler connection string available
   - Supabase: Use port 6543 for pooling

---

## 🧪 Testing Database Connection

Create a test script `test-db.js`:

```javascript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    await prisma.$connect();
    console.log('✅ Database connected successfully!');
    
    const userCount = await prisma.user.count();
    console.log(`📊 Users in database: ${userCount}`);
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
```

Run:
```bash
node test-db.js
```

---

## 🔄 Migrations (For Schema Changes)

If you modify `prisma/schema.prisma`:

```bash
# Create migration
npx prisma migrate dev --name add_new_field

# Apply migration to production
npx prisma migrate deploy
```

---

## ❓ Common Issues

| Issue | Solution |
|-------|----------|
| `Connection refused` | Check PostgreSQL is running |
| `SSL required` | Add `?sslmode=require` to URL |
| `Authentication failed` | Verify username/password |
| `Database does not exist` | Create database first |
| `Prisma schema out of sync` | Run `npx prisma db push` |
