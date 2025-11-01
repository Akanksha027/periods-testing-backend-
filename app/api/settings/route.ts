import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest, unauthorizedResponse } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateSettingsSchema = z.object({
  averageCycleLength: z.number().min(20).max(40).optional(),
  averagePeriodLength: z.number().min(2).max(10).optional(),
  reminderEnabled: z.boolean().optional(),
  reminderDaysBefore: z.number().min(0).max(7).optional(),
})

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request)
  
  if (!user) {
    return unauthorizedResponse()
  }

  try {
    const dbUser = await prisma.user.findUnique({
      where: { supabaseId: user.id },
      include: { settings: true },
    })

    if (!dbUser) {
      console.error('[Settings GET] User not found for supabaseId:', user.id)
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // If settings don't exist, create default settings
    if (!dbUser.settings) {
      console.log('[Settings GET] Creating default settings for user:', dbUser.id)
      const defaultSettings = await prisma.userSettings.create({
        data: {
          userId: dbUser.id,
          averageCycleLength: 28,
          averagePeriodLength: 5,
          reminderEnabled: true,
          reminderDaysBefore: 3,
        },
      })
      return NextResponse.json(defaultSettings)
    }

    return NextResponse.json(dbUser.settings)
  } catch (error: any) {
    console.error('[Settings GET] Error:', error)
    console.error('[Settings GET] Error message:', error?.message)
    console.error('[Settings GET] Error stack:', error?.stack)
    return NextResponse.json(
      { error: 'Failed to fetch settings', details: error?.message },
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
    const dbUser = await prisma.user.findUnique({
      where: { supabaseId: user.id },
      include: { settings: true },
    })

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const body = await request.json()
    const validatedData = updateSettingsSchema.parse(body)

    // Create settings if they don't exist, otherwise update
    let settings
    if (!dbUser.settings) {
      settings = await prisma.userSettings.create({
        data: {
          userId: dbUser.id,
          ...validatedData,
        },
      })
    } else {
      settings = await prisma.userSettings.update({
        where: { userId: dbUser.id },
        data: validatedData,
      })
    }

    return NextResponse.json(settings)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid data', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error updating settings:', error)
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    )
  }
}

