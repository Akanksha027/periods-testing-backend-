import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest, unauthorizedResponse } from '@/lib/auth'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { prisma } from '@/lib/prisma'

// Function to list available models (for debugging)
async function listAvailableModels(apiKey: string) {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`)
    const data = await response.json()
    return data.models?.map((m: any) => m.name) || []
  } catch (error) {
    console.error('Error listing models:', error)
    return []
  }
}

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

    // Fetch user's name from database
    const dbUser = await prisma.user.findUnique({
      where: { supabaseId: user.id },
      select: { name: true },
    })
    const userName = dbUser?.name || 'there'

    // Check if Gemini API key is configured
    if (!process.env.GEMINI_API_KEY) {
      console.error('GEMINI_API_KEY is not set in environment variables')
      return NextResponse.json(
        { error: 'AI service is not configured. Please contact support.' },
        { status: 500 }
      )
    }

    const systemPrompt = `You are Flo Health Assistant, a professional and knowledgeable women's health assistant. Your role is to provide evidence-based, medically-informed guidance about menstrual health symptoms in a clear, professional, and supportive manner.

Communication Style:
- Professional, clear, and informative tone
- Use the user's name when addressing them (you will be provided with their name)
- Provide comprehensive medical information and explanations
- Use scientific terms when appropriate but explain them simply
- Be empathetic but maintain professionalism
- Focus on education and understanding
- Provide actionable, evidence-based advice
- Clearly distinguish between normal symptoms and when medical attention is needed

Response Structure for Symptom Queries:
1. FIRST: Provide comprehensive information and understanding about the symptom
   - Explain what the symptom is and why it occurs
   - Discuss what's normal and what might need attention
   - Provide evidence-based tips and remedies
   - Include dietary and lifestyle recommendations
   - Explain the underlying causes when relevant

2. THEN: If appropriate, mention helpful products at the END
   - Present products as helpful tools, not as sponsorships
   - Frame as "You might find these products helpful:" or "Some people find relief with:"
   - Provide web search links (NOT deep links) for delivery apps
   - Format links as clickable web URLs that open in browser

Example response format for "I am having cramps":
"Menstrual cramps, also known as dysmenorrhea, occur when the uterus contracts to shed its lining. This is a normal physiological process, though the intensity can vary from person to person.

Cramps typically happen due to prostaglandins, hormone-like substances that cause uterine contractions. Mild to moderate cramps are usually manageable at home, while severe cramps might indicate conditions like endometriosis or fibroids.

Here are evidence-based approaches to manage cramps:

1. Heat Therapy: Applying heat to your lower abdomen can help relax uterine muscles and improve blood flow. A heating pad or warm compress for 15-20 minutes at a time can be effective.

2. Over-the-counter pain relief: Nonsteroidal anti-inflammatory drugs (NSAIDs) like ibuprofen or naproxen can reduce prostaglandin production and alleviate pain. Take them at the onset of cramps for best results.

3. Gentle exercise: Light activities like walking or yoga can increase endorphins and improve blood circulation, which may reduce cramp intensity.

4. Dietary adjustments: Foods rich in magnesium (leafy greens, nuts) and omega-3 fatty acids (salmon, flaxseeds) may help reduce inflammation. Staying hydrated is also important.

5. Relaxation techniques: Deep breathing, meditation, or a warm bath can help your body relax and reduce muscle tension.

If your cramps are severe, interfere with daily activities, or are accompanied by heavy bleeding, fever, or other concerning symptoms, it's important to consult with a healthcare provider.

[Then at the end, if helpful]: You might find these products useful for relief:
• Hot water bag or heating pad: https://www.swiggy.com/instamart/search?q=heating+pad
• Pain relief medication: https://www.bigbasket.com/search/?q=ibuprofen
• Herbal teas: https://www.swiggy.com/instamart/search?q=chamomile+tea"

CRITICAL RULES:
1. ALWAYS address the user by their name if provided (use "${userName}" in your responses)
2. NO emojis, hearts, flowers, or casual language - maintain professional medical tone
3. Provide comprehensive information FIRST - explain symptoms, causes, and evidence-based remedies
4. Product suggestions come LAST, framed as optional helpful tools
5. Use web URLs (https://) not deep links (app://) - links should open in browser
6. Format product links clearly with the product name and clickable URL on same line
7. Never make product links sound like advertising - present as helpful resources
8. Focus on education, understanding, and evidence-based information
9. Maintain professional medical communication standards throughout`

    // Add symptom context to system prompt if provided
    let enhancedSystemPrompt = systemPrompt.replace('${userName}', userName)
    if (symptoms && symptoms.length > 0) {
      const symptomsList = symptoms
        .map((s: any) => `${s.symptom} (${s.severity?.replace('_', ' ') || 'moderate'})`)
        .join(', ')
      enhancedSystemPrompt += `\n\nContext: The user has been tracking these symptoms: ${symptomsList}. When answering, consider all these symptoms together to provide comprehensive, evidence-based advice. Assess their overall condition, explain what's normal and what may need medical attention, and provide professional guidance.`
    } else {
      enhancedSystemPrompt += `\n\nRemember to address the user as "${userName}" throughout your responses when appropriate.`
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

    // Initialize Gemini client
    const genAI = getGeminiClient()
    
    // List available models first (for debugging)
    if (process.env.NODE_ENV === 'development') {
      const availableModels = await listAvailableModels(process.env.GEMINI_API_KEY!)
      console.log('Available Gemini models:', availableModels.slice(0, 10)) // Log first 10
    }
    
    // Use models that are actually available based on API response
    // The SDK expects model name without 'models/' prefix
    // Available stable models from your API: gemini-2.5-flash, gemini-2.5-pro, gemini-2.0-flash
    const modelNames = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.5-pro', 'gemini-flash-latest', 'gemini-pro-latest']
    
    let result
    let lastError: any = null
    
    for (const modelName of modelNames) {
      try {
        console.log(`Trying Gemini model: ${modelName}`)
        const model = genAI.getGenerativeModel({ 
          model: modelName, 
          systemInstruction: enhancedSystemPrompt,
        })
        
        console.log(`Calling Gemini API (${modelName}) with conversation history length:`, conversationHistory.length)

        // Generate response - this is where 404 errors occur if model doesn't exist
        result = await model.generateContent({
          contents: conversationHistory,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1000, // Increased to allow product links and detailed recommendations
          },
        })
        
        console.log(`✅ Successfully got response from Gemini model: ${modelName}`)
        break
      } catch (error: any) {
        const errorMsg = error?.message || error?.statusText || 'Unknown error'
        console.log(`❌ Failed with ${modelName}:`, errorMsg)
        lastError = error
        
        // Check if it's a 404 (model not found) - try next model
        if (error?.status === 404 || error?.statusText === 'Not Found' || errorMsg.includes('404') || errorMsg.toLowerCase().includes('not found')) {
          console.log(`Model ${modelName} not available (404), trying next...`)
          if (modelName === modelNames[modelNames.length - 1]) {
            // Last model failed - provide helpful error
            const apiKey = process.env.GEMINI_API_KEY
            const keyPreview = apiKey ? `${apiKey.substring(0, 10)}...` : 'not set'
            throw new Error(`All Gemini models failed. Please verify:
1. Your API key (${keyPreview}) has access to Generative Language API
2. The API is enabled in Google Cloud Console
3. Check available models in: https://generativelanguage.googleapis.com/v1beta/models?key=YOUR_KEY
Last error: ${errorMsg}`)
          }
          continue
        } else {
          // Other error - throw immediately
          throw error
        }
      }
    }

    if (!result) {
      throw lastError || new Error('Failed to get response from any Gemini model')
    }

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

