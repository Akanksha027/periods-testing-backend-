import { prisma } from './prisma'

/**
 * Find user by Clerk ID or Supabase ID (for backward compatibility)
 */
export async function findUserByAuthId(authId: string) {
  // Try to find by Clerk ID first
  let user = await prisma.user.findUnique({
    where: { clerkId: authId },
  })

  // If not found, try Supabase ID (for existing users)
  if (!user) {
    user = await prisma.user.findUnique({
      where: { supabaseId: authId },
    })
  }

  return user
}

/**
 * Update existing user to have clerkId if missing
 * This is called when a user logs in with Clerk and their clerkId is not yet set
 */
export async function ensureUserHasClerkId(userId: string, clerkId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  })

  // If user exists but doesn't have clerkId set, update it
  if (user && !user.clerkId) {
    await prisma.user.update({
      where: { id: userId },
      data: { clerkId },
    })
    console.log(`[user-helper] Updated user ${userId} with clerkId: ${clerkId}`)
  }
}

