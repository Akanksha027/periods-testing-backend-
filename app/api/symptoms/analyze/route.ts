import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest, unauthorizedResponse } from '@/lib/auth'
import { analyzeSymptomsWithAI, AIAnalysisRequest } from '@/lib/aiService'
import { z } from 'zod'

const analyzeSchema = z.object({
  symptoms: z.array(z.object({
    symptom: z.string(),
    severity: z.enum(['very_mild', 'mild', 'moderate', 'severe', 'very_severe']),
    frequency: z.string().optional(),
  })),
  painLevel: z.number().min(1).max(10).optional(),
  cycleLength: z.number().optional(),
  periodLength: z.number().optional(),
  bleedingIntensity: z.enum(['light', 'medium', 'heavy']).optional(),
})

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request)
  if (!user) return unauthorizedResponse()

  try {
    const body = await request.json()
    const validatedData = analyzeSchema.parse(body)

    const aiRequest: AIAnalysisRequest = {
      symptoms: validatedData.symptoms,
      painLevel: validatedData.painLevel,
      cycleLength: validatedData.cycleLength,
      periodLength: validatedData.periodLength,
      bleedingIntensity: validatedData.bleedingIntensity,
    }

    const analysis = await analyzeSymptomsWithAI(aiRequest)
    return NextResponse.json(analysis)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid data', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error analyzing symptoms:', error)
    return NextResponse.json(
      { error: 'Failed to analyze symptoms' },
      { status: 500 }
    )
  }
}

