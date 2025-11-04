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
    const dbUser = await findUserByAuthId(user.id)

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!dbUser.clerkId) {
      await ensureUserHasClerkId(dbUser.id, user.id)
    }

    // Fetch user with settings and periods
    const dbUserWithData = await prisma.user.findUnique({
      where: { id: dbUser.id },
      include: {
        settings: true,
        periods: {
          orderBy: { startDate: 'desc' },
          take: 6,
        },
      },
    })

    if (!dbUserWithData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Calculate predictions based on past periods
    const periods = dbUserWithData.periods
    
    if (periods.length === 0) {
      // Use default settings if no history
      const today = new Date()
      const nextPeriod = new Date(today)
      nextPeriod.setDate(nextPeriod.getDate() + dbUserWithData.settings!.averageCycleLength)

      return NextResponse.json({
        nextPeriodDate: nextPeriod.toISOString(),
        cycleLength: dbUserWithData.settings!.averageCycleLength,
        periodLength: dbUserWithData.settings!.averagePeriodLength,
        confidence: 'low',
      })
    }

    // Calculate average cycle length from history
    let totalCycleLength = 0
    let cycleCount = 0

    for (let i = 0; i < periods.length - 1; i++) {
      const current = new Date(periods[i].startDate)
      const next = new Date(periods[i + 1].startDate)
      const diff = Math.abs(current.getTime() - next.getTime())
      const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
      totalCycleLength += days
      cycleCount++
    }

    const avgCycleLength = cycleCount > 0 
      ? Math.round(totalCycleLength / cycleCount)
      : dbUserWithData.settings!.averageCycleLength

    // Calculate average period length
    let totalPeriodLength = 0
    let periodCount = 0

    for (const period of periods) {
      if (period.endDate) {
        const start = new Date(period.startDate)
        const end = new Date(period.endDate)
        const diff = Math.abs(end.getTime() - start.getTime())
        const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
        totalPeriodLength += days
        periodCount++
      }
    }

    const avgPeriodLength = periodCount > 0
      ? Math.round(totalPeriodLength / periodCount)
      : dbUserWithData.settings!.averagePeriodLength

    // Predict next period
    const lastPeriod = new Date(periods[0].startDate)
    const nextPeriod = new Date(lastPeriod)
    nextPeriod.setDate(nextPeriod.getDate() + avgCycleLength)

    const confidence = cycleCount >= 3 ? 'high' : cycleCount >= 1 ? 'medium' : 'low'

    return NextResponse.json({
      nextPeriodDate: nextPeriod.toISOString(),
      cycleLength: avgCycleLength,
      periodLength: avgPeriodLength,
      confidence,
    })
  } catch (error) {
    console.error('Error calculating predictions:', error)
    return NextResponse.json(
      { error: 'Failed to calculate predictions' },
      { status: 500 }
    )
  }
}

