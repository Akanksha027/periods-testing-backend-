import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest, unauthorizedResponse } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updatePeriodSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional().nullable(),
  flowLevel: z.enum(['light', 'medium', 'heavy']).optional().nullable(),
})

export async function PATCH(
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

    const body = await request.json()
    const validatedData = updatePeriodSchema.parse(body)

    const period = await prisma.period.findUnique({
      where: { id: params.id },
    })

    if (!period || period.userId !== dbUser.id) {
      return NextResponse.json({ error: 'Period not found' }, { status: 404 })
    }

    const updateData: any = {}
    if (validatedData.startDate) updateData.startDate = new Date(validatedData.startDate)
    if (validatedData.endDate !== undefined) {
      updateData.endDate = validatedData.endDate ? new Date(validatedData.endDate) : null
    }
    if (validatedData.flowLevel !== undefined) updateData.flowLevel = validatedData.flowLevel

    const updatedPeriod = await prisma.period.update({
      where: { id: params.id },
      data: updateData,
    })

    return NextResponse.json(updatedPeriod)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid data', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error updating period:', error)
    return NextResponse.json(
      { error: 'Failed to update period' },
      { status: 500 }
    )
  }
}

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

    const period = await prisma.period.findUnique({
      where: { id: params.id },
    })

    if (!period || period.userId !== dbUser.id) {
      return NextResponse.json({ error: 'Period not found' }, { status: 404 })
    }

    await prisma.period.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ message: 'Period deleted successfully' })
  } catch (error) {
    console.error('Error deleting period:', error)
    return NextResponse.json(
      { error: 'Failed to delete period' },
      { status: 500 }
    )
  }
}

