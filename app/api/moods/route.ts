import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest, unauthorizedResponse } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { findUserByAuthId, ensureUserHasClerkId } from '@/lib/user-helper'
import { z } from 'zod'

const createMoodSchema = z.object({
  date: z.string().datetime(),
  type: z.string(),
})

export async function GET(request: NextRequest) {
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

    const searchParams = request.nextUrl.searchParams
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const where: any = { userId: dbUser.id }

    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      }
    }

    const moods = await prisma.mood.findMany({
      where,
      orderBy: { date: 'desc' },
    })

    return NextResponse.json(moods)
  } catch (error) {
    console.error('Error fetching moods:', error)
    return NextResponse.json(
      { error: 'Failed to fetch moods' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const validatedData = createMoodSchema.parse(body)

    const mood = await prisma.mood.create({
      data: {
        userId: dbUser.id,
        date: new Date(validatedData.date),
        type: validatedData.type,
      },
    })

    return NextResponse.json(mood, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid data', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error creating mood:', error)
    return NextResponse.json(
      { error: 'Failed to create mood' },
      { status: 500 }
    )
  }
}

