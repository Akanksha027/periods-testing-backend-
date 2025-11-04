-- AlterTable: Add clerk_id column
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "clerk_id" TEXT;

-- CreateIndex: Create unique index on clerk_id
CREATE UNIQUE INDEX IF NOT EXISTS "users_clerk_id_key" ON "users"("clerk_id");

-- Make supabase_id nullable (for new Clerk users)
ALTER TABLE "users" ALTER COLUMN "supabase_id" DROP NOT NULL;

