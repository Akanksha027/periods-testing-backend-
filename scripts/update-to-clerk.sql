-- Migration script to add clerkId column and update existing users
-- Run this after updating the Prisma schema

-- Add clerk_id column (if not exists)
ALTER TABLE users ADD COLUMN IF NOT EXISTS clerk_id VARCHAR(255) UNIQUE;

-- Add index for clerk_id
CREATE INDEX IF NOT EXISTS idx_users_clerk_id ON users(clerk_id);

-- Make supabase_id nullable (for new Clerk users)
ALTER TABLE users ALTER COLUMN supabase_id DROP NOT NULL;

-- Note: Existing users will need to be migrated manually
-- You can update them when they log in with Clerk for the first time

