import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest, unauthorizedResponse } from '@/lib/auth'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Ensure this route is dynamic
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const getGeminiClient = () => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured')
  }
  return new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
}

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request)
  if (!user) return unauthorizedResponse()

  try {
    const body = await request.json()
    const { messages, symptoms } = body

    // Check if Gemini API key is configured
    if (!process.env.GEMINI_API_KEY) {
      console.error('GEMINI_API_KEY is not set in environment variables')
      return NextResponse.json(
        { error: 'AI service is not configured. Please contact support.' },
        { status: 500 }
      )
    }

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

    // Add symptom context to system prompt if provided
    let enhancedSystemPrompt = systemPrompt
    if (symptoms && symptoms.length > 0) {
      const symptomsList = symptoms
        .map((s: any) => `${s.symptom} (${s.severity?.replace('_', ' ') || 'moderate'})`)
        .join(', ')
      enhancedSystemPrompt += `\n\nContext: The user has been tracking these symptoms: ${symptomsList}. When answering, consider all these symptoms together to provide comprehensive advice. Tell them if they are okay, if they are severe, and what they should do. Be caring and supportive.`
    }

    // Build the conversation history for Gemini (limit to last 10 messages)
    const recentMessages = messages.slice(-10)
    const conversationHistory: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = []
    
    // Process messages in pairs (user, assistant) or just user messages
    for (const msg of recentMessages) {
      if (msg.role === 'user') {
        conversationHistory.push({
          role: 'user',
          parts: [{ text: msg.content }],
        })
      } else if (msg.role === 'assistant') {
        conversationHistory.push({
          role: 'model',
          parts: [{ text: msg.content }],
        })
      }
    }

    // Ensure there's at least one user message (if conversation history is empty, use the last message)
    if (conversationHistory.length === 0 && messages.length > 0) {
      const lastMessage = messages[messages.length - 1]
      if (lastMessage.role === 'user') {
        conversationHistory.push({
          role: 'user',
          parts: [{ text: lastMessage.content }],
        })
      }
    }

    // Validate that we have at least one user message
    if (conversationHistory.length === 0 || conversationHistory[conversationHistory.length - 1].role !== 'user') {
      console.error('No user message found in conversation history')
      return NextResponse.json(
        { error: 'No message provided' },
        { status: 400 }
      )
    }

    // Initialize Gemini model
    const genAI = getGeminiClient()
    // Use gemini-1.5-flash - this is the correct model name for v1beta API
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash', 
      systemInstruction: enhancedSystemPrompt,
    })
    
    console.log('Initialized Gemini model: gemini-1.5-flash')

    console.log('Calling Gemini API with conversation history length:', conversationHistory.length)

    // Generate response
    const result = await model.generateContent({
      contents: conversationHistory,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 300,
      },
    })

    console.log('Gemini API response received')

    const responseContent = result.response.text() || 'I apologize, but I\'m having trouble right now. Please try again. 💕'

    return NextResponse.json({ message: responseContent })
  } catch (error: any) {
    console.error('Chat error:', error)
    console.error('Error details:', error?.message, error?.stack)
    console.error('Error status:', error?.status, error?.statusText)
    console.error('Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2))
    
    // Provide more specific error messages
    let errorMessage = 'Failed to get chat response'
    let statusCode = 500
    
    if (error?.status === 404 || error?.statusText === 'Not Found') {
      errorMessage = 'AI model not found. Please check API configuration.'
      statusCode = 404
    } else if (error?.message?.includes('API key') || error?.status === 401 || error?.status === 403) {
      errorMessage = 'AI service configuration error. Please contact support.'
      statusCode = 500
    } else if (error?.message?.includes('rate limit') || error?.status === 429) {
      errorMessage = 'AI service is busy. Please try again in a moment.'
      statusCode = 429
    } else if (error?.message) {
      // Include more details in development
      errorMessage = process.env.NODE_ENV === 'development' 
        ? `Failed to get chat response: ${error.message}` 
        : 'Failed to get chat response'
    }
    
    return NextResponse.json(
      { 
        error: errorMessage, 
        details: process.env.NODE_ENV === 'development' ? {
          message: error?.message,
          stack: error?.stack,
          name: error?.name,
          status: error?.status,
          statusText: error?.statusText,
        } : undefined 
      },
      { status: statusCode }
    )
  }
}

