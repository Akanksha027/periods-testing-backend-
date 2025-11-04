# Required Backend Environment Variables

## Your `.env` file should contain:

```env
# Line 1-5: (Any existing variables)

# Line 6-8: Database URLs (REQUIRED)
DATABASE_URL="postgresql://postgres.sdujszipolfokscvgzjg:Akanksha2005@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.sdujszipolfokscvgzjg:Akanksha2005@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres"

# Line 9-10: Clerk Authentication (REQUIRED)
CLERK_SECRET_KEY="sk_test_B4j50TryXmh9opvomxxtqI0FE6JvTN6WOyaEX3thYE"

# Line 11-12: AI Service - Gemini (REQUIRED)
GEMINI_API_KEY="your_gemini_api_key_here"

# Line 13: Node Environment
NODE_ENV="development"
```

## What Each Variable Does:

1. **DATABASE_URL** (Line 6)
   - Connection pool URL (port 6543)
   - Used for regular database queries
   - Includes `?pgbouncer=true` for connection pooling

2. **DIRECT_URL** (Line 7)
   - Direct connection URL (port 5432)
   - Used for Prisma migrations (`db push`, `migrate`)
   - Required for schema changes

3. **CLERK_SECRET_KEY** (Line 9)
   - Your Clerk secret key for backend authentication
   - Used to verify JWT tokens from frontend
   - Already added to Vercel ✅

4. **GEMINI_API_KEY** (Line 11)
   - Google Gemini API key for AI chatbot
   - Already added to Vercel ✅

## For Vercel Deployment:

Make sure these are added in Vercel Dashboard:
- ✅ `DATABASE_URL`
- ✅ `DIRECT_URL` (recommended)
- ✅ `CLERK_SECRET_KEY`
- ✅ `GEMINI_API_KEY`

## Quick Check:

Run this to verify your database connection:
```bash
cd backend
npx prisma db push
```

If successful, you're good to go! 🎉

