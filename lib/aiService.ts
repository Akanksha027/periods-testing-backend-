import OpenAI from 'openai'

// Lazy initialization of OpenAI client
let openai: OpenAI | null = null

function getOpenAIClient(): OpenAI {
  if (!openai) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('Missing credentials. Please pass an `apiKey`, or set the `OPENAI_API_KEY` environment variable.')
    }
    openai = new OpenAI({ apiKey })
  }
  return openai
}

export interface SymptomWithSeverity {
  symptom: string
  severity: 'very_mild' | 'mild' | 'moderate' | 'severe' | 'very_severe'
  frequency?: string
}

export interface AIAnalysisRequest {
  symptoms: SymptomWithSeverity[]
  painLevel?: number
  cycleLength?: number
  periodLength?: number
  bleedingIntensity?: 'light' | 'medium' | 'heavy'
}

export interface AIAnalysisResponse {
  overallAssessment: string
  severityLevel: 'normal' | 'mild' | 'moderate' | 'serious' | 'urgent'
  personalizedMessage: string
  recommendations: string[]
  homeRemedies: string[]
  doctorAdvice: string | null
  redFlagAlerts: string[]
  possibleConditions: Array<{
    condition: string
    probability: 'low' | 'medium' | 'high'
    description: string
    action: string
  }>
}

export async function analyzeSymptomsWithAI(
  request: AIAnalysisRequest
): Promise<AIAnalysisResponse> {
  try {
    const symptomDescriptions = request.symptoms.map(s => {
      let desc = `${s.symptom} (${s.severity.replace('_', ' ')})`
      if (s.frequency) desc += ` - ${s.frequency}`
      return desc
    }).join(', ')

    const systemPrompt = `You are a compassionate, empathetic women's health assistant. Your role is to provide gentle, supportive, and medically-informed guidance about menstrual health symptoms. 

Always:
1. Use a warm, understanding, and non-judgmental tone
2. Validate the user's experiences and concerns
3. Provide practical, evidence-based advice
4. Be clear about when medical attention is needed
5. Offer hope and reassurance while being honest about risks
6. Use soft language like "I understand", "It's completely normal to feel", "You're doing the right thing by tracking this"

Medical guidelines:
- Normal: mild cramps, bloating, mood swings, light spotting → suggest home remedies
- Moderate: heavy flow, back pain, pain 4-6/10 → monitoring + lifestyle changes
- Serious: severe pain 8+/10, vomiting, fainting, heavy bleeding >7 days → see doctor within 48 hrs
- Urgent: fainting, severe pain preventing function → immediate medical attention

Common conditions to consider:
- PCOS: irregular periods, excessive hair growth, weight gain, acne, dark skin patches
- Endometriosis: severe cramps, pain during sex, painful bowel movements
- Fibroids: heavy bleeding, pelvic pressure, frequent urination
- Anemia: pale skin, dizziness, shortness of breath (with heavy bleeding)
- Thyroid: irregular periods, extreme fatigue, hair loss

Always provide actionable, specific recommendations.`

    const userPrompt = `A user is experiencing:

Symptoms: ${symptomDescriptions}
${request.painLevel ? `Pain Level: ${request.painLevel}/10` : ''}
${request.cycleLength ? `Cycle Length: ${request.cycleLength} days` : ''}
${request.periodLength ? `Period Length: ${request.periodLength} days` : ''}
${request.bleedingIntensity ? `Bleeding: ${request.bleedingIntensity}` : ''}

Please provide JSON with:
1. overallAssessment: Warm 2-3 sentence assessment
2. severityLevel: normal|mild|moderate|serious|urgent
3. personalizedMessage: Compassionate 3-4 sentence validation
4. recommendations: Array of specific advice
5. homeRemedies: Array of actionable remedies if appropriate
6. doctorAdvice: When to see doctor or null
7. redFlagAlerts: Array of urgent alerts if any
8. possibleConditions: Array of {condition, probability, description, action}

Be warm, validating, and supportive while being medically accurate.`

    const completion = await getOpenAIClient().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    })

    const responseContent = completion.choices[0]?.message?.content
    if (!responseContent) throw new Error('No AI response')

    const parsed = JSON.parse(responseContent) as AIAnalysisResponse
    
    return {
      overallAssessment: parsed.overallAssessment || 'Thank you for tracking your symptoms.',
      severityLevel: parsed.severityLevel || 'normal',
      personalizedMessage: parsed.personalizedMessage || 'Your symptoms matter. Let\'s take care of you.',
      recommendations: parsed.recommendations || [],
      homeRemedies: parsed.homeRemedies || [],
      doctorAdvice: parsed.doctorAdvice || null,
      redFlagAlerts: parsed.redFlagAlerts || [],
      possibleConditions: parsed.possibleConditions || [],
    }
  } catch (error) {
    console.error('AI error:', error)
    // Fallback to basic analysis
    return generateFallbackAnalysis(request)
  }
}

function generateFallbackAnalysis(request: AIAnalysisRequest): AIAnalysisResponse {
  const hasSevere = request.symptoms.some(s => s.severity === 'very_severe' || s.severity === 'severe')
  const painSevere = request.painLevel && request.painLevel >= 8
  
  let severity: 'normal' | 'mild' | 'moderate' | 'serious' | 'urgent' = 'normal'
  if (painSevere || hasSevere) {
    severity = 'urgent'
  } else if (request.symptoms.some(s => s.severity === 'moderate')) {
    severity = 'moderate'
  } else if (request.symptoms.some(s => s.severity === 'mild')) {
    severity = 'mild'
  }

  const needsDoctor = severity === 'urgent'

  return {
    overallAssessment: 'Thank you for tracking your symptoms. Let\'s ensure you get the care you need.',
    severityLevel: severity,
    personalizedMessage: 'Your health matters. We\'re here to support you through this.',
    recommendations: [
      'Continue monitoring your symptoms',
      needsDoctor ? 'Please consider seeing a healthcare provider' : 'These symptoms may be manageable at home',
    ],
    homeRemedies: ['Apply heat to painful areas', 'Stay hydrated', 'Get adequate rest'],
    doctorAdvice: needsDoctor ? 'Please consider seeing a healthcare provider soon.' : null,
    redFlagAlerts: [],
    possibleConditions: [],
  }
}

