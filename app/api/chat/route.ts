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

    // Fetch user's complete data from database
    const dbUser = await prisma.user.findUnique({
      where: { supabaseId: user.id },
      include: {
        settings: true,
        periods: {
          orderBy: { startDate: 'desc' },
          take: 12, // Last 12 periods for pattern analysis
        },
        symptoms: {
          orderBy: { date: 'desc' },
          take: 30, // Last 30 symptom entries
        },
      },
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
1. FIRST: Focus on PRACTICAL TIPS and SUGGESTIONS (70% of response)
   - Provide actionable, easy-to-implement remedies
   - List specific things they can do RIGHT NOW to feel better
   - Include dietary recommendations with specific foods
   - Mention lifestyle changes and exercises
   - Keep scientific explanations BRIEF (just 1-2 sentences on why it happens)
   - Focus on "what you can do" rather than "why it happens"

2. THEN: Brief scientific understanding (20% of response)
   - Very short explanation of what the symptom is (1-2 sentences)
   - When to seek medical attention (clear and concise)

3. FINALLY: Product suggestions at the END (10% of response)
   - Present products as helpful tools, not as sponsorships
   - Frame as "You might find these products helpful:" or "Some people find relief with:"
   - Provide web search links (NOT deep links) for delivery apps
   - Format links as clickable web URLs that open in browser

Example response format for "I am having cramps" (FOLLOW THIS STRUCTURE):
"[User's Name], here are immediate steps you can take to relieve cramps:

IMMEDIATE RELIEF TIPS:
1. Apply heat: Place a hot water bottle or heating pad on your lower abdomen for 15-20 minutes. The warmth helps relax uterine muscles and improves blood flow. You can repeat this every few hours.

2. Try gentle movement: Take a slow 10-minute walk or do gentle stretches. This increases endorphins and improves circulation, which can reduce pain.

3. Take OTC pain relief: Ibuprofen or naproxen taken at the start of cramps can be very effective. These work by reducing the production of pain-causing prostaglandins.

4. Drink warm liquids: Herbal teas (chamomile, ginger) or warm water can help relax your body. Avoid caffeine as it can make cramps worse.

5. Practice deep breathing: Take slow, deep breaths (inhale for 4 counts, hold for 4, exhale for 4). This activates your body's relaxation response.

6. Dietary support: Eat magnesium-rich foods like bananas, dark chocolate, or spinach. Stay hydrated with water throughout the day.

WHAT CAUSES CRAMPS: Menstrual cramps occur when the uterus contracts to shed its lining, triggered by hormone-like substances called prostaglandins. This is normal, though severity varies.

WHEN TO SEE A DOCTOR: If cramps are severe enough to interfere with daily activities, last more than 2-3 days, or are accompanied by heavy bleeding or fever, consult a healthcare provider.

[Product suggestions at end]: You might find these helpful:
• Heating pad: https://www.swiggy.com/instamart/search?q=heating+pad
• Ibuprofen: https://www.bigbasket.com/search/?q=ibuprofen
• Herbal tea: https://www.swiggy.com/instamart/search?q=chamomile+tea"

CRITICAL RULES:
1. ALWAYS address the user by their name if provided (use "${userName}" in your responses)
2. NO emojis, hearts, flowers, or casual language - maintain professional medical tone
3. PRIORITIZE PRACTICAL TIPS (70%) over scientific explanations (20%) - users want actionable advice
4. Keep scientific explanations BRIEF - just 1-2 sentences explaining what causes the symptom
5. Focus on "what they can do" rather than lengthy explanations of "why it happens"
6. Product suggestions come LAST (10%), framed as optional helpful tools
7. Use web URLs (https://) not deep links (app://) - links should open in browser
8. Format product links clearly with the product name and clickable URL on same line
9. Never make product links sound like advertising - present as helpful resources
10. When user asks about THEIR patterns/cycle but hasn't entered data: Tell them to update the app first, but still answer other general questions
11. When user HAS entered data: Use their actual cycle and symptom information to provide personalized insights
12. Keep responses COMPLETE - never cut off mid-sentence
13. Maintain professional medical communication standards throughout`

    // Build user cycle context
    let userCycleContext = ''
    const hasPeriodData = dbUser?.periods && dbUser.periods.length > 0
    const hasSymptomData = dbUser?.symptoms && dbUser.symptoms.length > 0
    const hasSettings = dbUser?.settings
    
    if (hasPeriodData || hasSymptomData || hasSettings) {
      userCycleContext += `\n\nUSER'S CYCLE INFORMATION (use this when answering questions about their patterns, cycle, or symptoms):\n`
      
      if (hasPeriodData) {
        const recentPeriods = dbUser.periods.slice(0, 6)
        const periodDates = recentPeriods.map(p => {
          const start = new Date(p.startDate).toLocaleDateString()
          const end = p.endDate ? new Date(p.endDate).toLocaleDateString() : 'ongoing'
          return `${start} to ${end}${p.flowLevel ? ` (${p.flowLevel} flow)` : ''}`
        }).join(', ')
        userCycleContext += `- Recent Period Dates: ${periodDates}\n`
        
        // Calculate cycle length if we have multiple periods
        if (recentPeriods.length >= 2) {
          const cycles = []
          for (let i = 0; i < recentPeriods.length - 1; i++) {
            const current = new Date(recentPeriods[i].startDate)
            const next = new Date(recentPeriods[i + 1].startDate)
            const diff = Math.ceil((current.getTime() - next.getTime()) / (1000 * 60 * 60 * 24))
            cycles.push(Math.abs(diff))
          }
          const avgCycle = Math.round(cycles.reduce((a, b) => a + b, 0) / cycles.length)
          userCycleContext += `- Average Cycle Length: ${avgCycle} days\n`
        }
      }
      
      if (hasSymptomData) {
        const recentSymptoms = dbUser.symptoms.slice(0, 10)
        const symptomTypes = recentSymptoms.map(s => `${s.type} (severity: ${s.severity}/5)`).join(', ')
        userCycleContext += `- Recent Symptoms Tracked: ${symptomTypes}\n`
        
        // Most common symptoms
        const symptomCounts: Record<string, number> = {}
        dbUser.symptoms.forEach(s => {
          symptomCounts[s.type] = (symptomCounts[s.type] || 0) + 1
        })
        const mostCommon = Object.entries(symptomCounts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 3)
          .map(([type]) => type)
          .join(', ')
        if (mostCommon) {
          userCycleContext += `- Most Common Symptoms: ${mostCommon}\n`
        }
      }
      
      if (hasSettings) {
        userCycleContext += `- Average Cycle Length: ${dbUser.settings.averageCycleLength} days\n`
        userCycleContext += `- Average Period Length: ${dbUser.settings.averagePeriodLength} days\n`
      }
      
      userCycleContext += `\nWhen the user asks about their patterns, cycle predictions, or symptom trends, use this information. If they ask specific questions about their cycle and you have this data, provide personalized insights based on their actual data.`
    } else {
      userCycleContext += `\n\nIMPORTANT: The user has NOT entered any cycle or symptom data in the app yet. If they ask about their personal patterns, cycle predictions, or specific symptoms they've tracked, you should say: "I notice you haven't updated your period and symptom information in the app yet. To give you personalized insights about your cycle patterns, please log your periods and symptoms in the app first. However, I can still help you with general questions about menstrual health!"`
    }
    
    // Add symptom context from current chat if provided
    let enhancedSystemPrompt = systemPrompt.replace('${userName}', userName)
    if (symptoms && symptoms.length > 0) {
      const symptomsList = symptoms
        .map((s: any) => `${s.symptom} (${s.severity?.replace('_', ' ') || 'moderate'})`)
        .join(', ')
      enhancedSystemPrompt += `\n\nCURRENT CHAT CONTEXT: The user just mentioned/tracked these symptoms: ${symptomsList}. Address these specifically in your response.`
    }
    
    enhancedSystemPrompt += userCycleContext

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
            maxOutputTokens: 2000, // Increased significantly to prevent cut-off responses
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

