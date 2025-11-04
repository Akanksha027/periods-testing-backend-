import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest, unauthorizedResponse } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { findUserByAuthId, ensureUserHasClerkId } from '@/lib/user-helper'

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request)
  
  if (!user) {
    return unauthorizedResponse()
  }

  try {
    // Find user by Clerk ID or Supabase ID (backward compatibility)
    let dbUser = await findUserByAuthId(user.id)

    if (!dbUser) {
      // Create new user if doesn't exist
      const newUser = await prisma.user.create({
        data: {
          email: user.email || `user_${user.id}@example.com`,
          clerkId: user.id,
          settings: {
            create: {},
          },
        },
        include: {
          settings: true,
        },
      })
      console.log('[User API] Created new user:', newUser.email, 'with clerkId:', user.id)
      return NextResponse.json(newUser)
    }

    // Ensure user has clerkId set (for migration from Supabase)
    if (!dbUser.clerkId) {
      await ensureUserHasClerkId(dbUser.id, user.id)
      // Refetch user with clerkId
      dbUser = await findUserByAuthId(user.id)
    }

    // Fetch user with settings
    const dbUserWithSettings = await prisma.user.findUnique({
      where: { id: dbUser.id },
      include: {
        settings: true,
      },
    })

    console.log('[User API] User found/synced:', dbUserWithSettings?.email, 'clerkId:', dbUserWithSettings?.clerkId)
    return NextResponse.json(dbUserWithSettings)
  } catch (error) {
    console.error('Error fetching user:', error)
    return NextResponse.json(
      { error: 'Failed to fetch user' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  const user = await getUserFromRequest(request)
  
  if (!user) {
    return unauthorizedResponse()
  }

  try {
    const body = await request.json()
    const { name } = body

    // Find user using helper function
    const dbUser = await findUserByAuthId(user.id)

    if (!dbUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Ensure user has clerkId
    if (!dbUser.clerkId) {
      await ensureUserHasClerkId(dbUser.id, user.id)
    }

    const updatedUser = await prisma.user.update({
      where: { id: dbUser.id },
      data: { name },
      include: {
        settings: true,
      },
    })

    return NextResponse.json(updatedUser)
  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    )
  }
}

