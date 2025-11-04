# Manual Database Migration

Agar `npx prisma db push` stuck ho raha hai, toh aap manually SQL run kar sakte hain.

## Option 1: Supabase Dashboard se (Easiest)

1. https://app.supabase.com/ mein jao
2. Apni project select karo
3. **SQL Editor** mein jao
4. Yeh SQL run karo:

```sql
-- Add clerk_id column (if not exists)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "clerk_id" TEXT;

-- Create unique index
CREATE UNIQUE INDEX IF NOT EXISTS "users_clerk_id_key" ON "users"("clerk_id");

-- Make supabase_id nullable (if not already)
ALTER TABLE "users" ALTER COLUMN "supabase_id" DROP NOT NULL;
```

## Option 2: Terminal se (psql)

Agar aapke paas psql hai:

```bash
psql "your-database-connection-string"
```

Phir same SQL commands run karo.

## Option 3: Prisma Studio se

```bash
npx prisma studio
```

Yeh GUI open karega, wahan se manually column add kar sakte hain (but yeh tedious hai).

## After Migration

Jab migration complete ho jaye, `backend/prisma/schema.prisma` mein `clerkId` ko required kar do:

```prisma
clerkId       String         @unique @map("clerk_id") // Required after migration
```

Phir `npx prisma generate` run karo.

