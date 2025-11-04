import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest, unauthorizedResponse } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { findUserByAuthId, ensureUserHasClerkId } from '@/lib/user-helper'
import { z } from 'zod'

const createPeriodSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional().nullable(),
  flowLevel: z.enum(['light', 'medium', 'heavy']).optional().nullable(),
})

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request)
  
  if (!user) {
    return unauthorizedResponse()
  }

  try {
    const dbUser = await findUserByAuthId(user.id)

    if (!dbUser) {
      console.error('[Periods GET] User not found for authId:', user.id)
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Ensure user has clerkId for future requests
    if (!dbUser.clerkId) {
      await ensureUserHasClerkId(dbUser.id, user.id)
    }

    const periods = await prisma.period.findMany({
      where: { userId: dbUser.id },
      orderBy: { startDate: 'desc' },
    })

    return NextResponse.json(periods)
  } catch (error: any) {
    console.error('[Periods GET] Error:', error)
    console.error('[Periods GET] Error message:', error?.message)
    console.error('[Periods GET] Error stack:', error?.stack)
    return NextResponse.json(
      { error: 'Failed to fetch periods', details: error?.message },
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
      console.error('[Periods POST] User not found for authId:', user.id)
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Ensure user has clerkId for future requests
    if (!dbUser.clerkId) {
      await ensureUserHasClerkId(dbUser.id, user.id)
    }

    const body = await request.json()
    console.log('[Periods POST] Request body:', JSON.stringify(body, null, 2))
    
    const validatedData = createPeriodSchema.parse(body)
    console.log('[Periods POST] Validated data:', validatedData)

    const period = await prisma.period.create({
      data: {
        userId: dbUser.id,
        startDate: new Date(validatedData.startDate),
        endDate: validatedData.endDate ? new Date(validatedData.endDate) : null,
        flowLevel: validatedData.flowLevel,
      },
    })

    console.log('[Periods POST] Period created successfully:', period.id)
    return NextResponse.json(period, { status: 201 })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      console.error('[Periods POST] Validation error:', error.errors)
      return NextResponse.json(
        { error: 'Invalid data', details: error.errors },
        { status: 400 }
      )
    }
    console.error('[Periods POST] Error:', error)
    console.error('[Periods POST] Error message:', error?.message)
    console.error('[Periods POST] Error stack:', error?.stack)
    console.error('[Periods POST] Error code:', error?.code)
    return NextResponse.json(
      { error: 'Failed to create period', details: error?.message },
      { status: 500 }
    )
  }
}

