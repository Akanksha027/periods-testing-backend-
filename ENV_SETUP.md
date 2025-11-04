# Backend Environment Variables Setup

## Required Environment Variables

### 1. Database Connection

```env
DATABASE_URL="postgresql://postgres.sdujszipolfokscvgzjg:Akanksha2005@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.sdujszipolfokscvgzjg:Akanksha2005@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres"
```

- **DATABASE_URL**: Connection pool URL (port 6543) - Used for regular queries
- **DIRECT_URL**: Direct connection URL (port 5432) - Used for migrations

### 2. Clerk Authentication

```env
CLERK_SECRET_KEY=sk_test_YOUR_CLERK_SECRET_KEY_HERE
```

**Your Clerk Secret Key:** `sk_test_B4j50TryXmh9opvomxxtqI0FE6JvTN6WOyaEX3thYE`

### 3. AI Service (Gemini)

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

### 4. Node Environment

```env
NODE_ENV=development
```

For production, use `NODE_ENV=production`

## Local Setup (`.env` file)

Create a `.env` file in the `backend` directory with all the variables above.

## Vercel Deployment

Add these environment variables in Vercel Dashboard:

1. Go to your Vercel project
2. Settings → Environment Variables
3. Add each variable for **Production**, **Preview**, and **Development** environments

### Required for Vercel:
- ✅ `DATABASE_URL`
- ✅ `DIRECT_URL` (optional, but recommended for migrations)
- ✅ `CLERK_SECRET_KEY`
- ✅ `GEMINI_API_KEY`
- ✅ `NODE_ENV` (automatically set by Vercel)

## Verification

After setting up, test the connection:

```bash
cd backend
npx prisma db push
```

If successful, you should see "Your database is now in sync with your Prisma schema."

