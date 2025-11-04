import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest, unauthorizedResponse } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { findUserByAuthId, ensureUserHasClerkId } from '@/lib/user-helper'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getUserFromRequest(request)
  
  if (!user) {
    return unauthorizedResponse()
  }

  try {
    const dbUser = await findUserByAuthId(user.id)

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!dbUser.clerkId) {
      await ensureUserHasClerkId(dbUser.id, user.id)
    }

    // Check if symptom belongs to user
    const symptom = await prisma.symptom.findUnique({
      where: { id: params.id },
    })

    if (!symptom) {
      return NextResponse.json({ error: 'Symptom not found' }, { status: 404 })
    }

    if (symptom.userId !== dbUser.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    await prisma.symptom.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ message: 'Symptom deleted' }, { status: 200 })
  } catch (error) {
    console.error('Error deleting symptom:', error)
    return NextResponse.json(
      { error: 'Failed to delete symptom' },
      { status: 500 }
    )
  }
}

