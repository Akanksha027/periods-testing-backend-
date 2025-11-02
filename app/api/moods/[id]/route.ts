import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest, unauthorizedResponse } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getUserFromRequest(request)
  
  if (!user) {
    return unauthorizedResponse()
  }

  try {
    const dbUser = await prisma.user.findUnique({
      where: { supabaseId: user.id },
    })

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check if mood belongs to user
    const mood = await prisma.mood.findUnique({
      where: { id: params.id },
    })

    if (!mood) {
      return NextResponse.json({ error: 'Mood not found' }, { status: 404 })
    }

    if (mood.userId !== dbUser.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    await prisma.mood.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ message: 'Mood deleted' }, { status: 200 })
  } catch (error) {
    console.error('Error deleting mood:', error)
    return NextResponse.json(
      { error: 'Failed to delete mood' },
      { status: 500 }
    )
  }
}

