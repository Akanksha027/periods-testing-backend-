import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest, unauthorizedResponse } from '@/lib/auth'
import OpenAI from 'openai'

let openai: OpenAI | null = null

function getOpenAIClient(): OpenAI {
  if (!openai) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY not set')
    }
    openai = new OpenAI({ apiKey })
  }
  return openai
}

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request)
  if (!user) return unauthorizedResponse()

  try {
    const body = await request.json()
    const { messages, symptoms } = body

    const systemPrompt = `You are Flo Health Assistant, a compassionate, empathetic women's health assistant. Your role is to provide gentle, supportive, and medically-informed guidance about menstrual health symptoms.

Always use:
- Warm, understanding, and non-judgmental tone
- Soft, sweet language with phrases like "I understand", "It's completely normal to feel", "You're doing the right thing", "Don't worry", "I'm here to help"
- Validation of user's experiences
- Practical, evidence-based advice
- Clear guidance about when medical attention is needed
- Hope and reassurance while being honest about risks
- Simple, easy-to-understand language

When answering questions about symptoms:
- If symptoms are mild/moderate: reassure and provide home remedies and comfort
- If symptoms are severe: gently recommend seeing a doctor with understanding
- Always be supportive and understanding
- Use simple language that's easy to understand
- Include emojis sparingly for warmth (💕, 🌸, etc.) but not too many

Keep responses concise (2-4 sentences typically) but comprehensive. Be a friend who knows about women's health. Be empathetic and kind.`

    let contextMessages: OpenAI.Chat.Completions.ChatCompletionMessage[] = [
      { role: 'system', content: systemPrompt },
    ]

    // Add symptom context if provided
    if (symptoms && symptoms.length > 0) {
      const symptomsList = symptoms
        .map((s: any) => `${s.symptom} (${s.severity?.replace('_', ' ') || 'moderate'})`)
        .join(', ')
      contextMessages.push({
        role: 'assistant',
        content: `The user has been tracking these symptoms: ${symptomsList}. When answering, consider all these symptoms together to provide comprehensive advice. Tell them if they are okay, if they are severe, and what they should do. Be caring and supportive.`,
      })
    }

    // Add conversation history (limit to last 10 messages to avoid token limits)
    const recentMessages = messages.slice(-10)
    contextMessages.push(
      ...recentMessages.map((msg: { role: string; content: string }) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      }))
    )

    const completion = await getOpenAIClient().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: contextMessages,
      temperature: 0.7,
      max_tokens: 300,
    })

    const responseContent = completion.choices[0]?.message?.content || 'I apologize, but I\'m having trouble right now. Please try again. 💕'

    return NextResponse.json({ message: responseContent })
  } catch (error) {
    console.error('Chat error:', error)
    return NextResponse.json(
      { error: 'Failed to get chat response' },
      { status: 500 }
    )
  }
}

