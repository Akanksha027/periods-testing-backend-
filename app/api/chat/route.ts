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

    // Fetch ALL user data from database for complete context
    const dbUser = await prisma.user.findUnique({
      where: { supabaseId: user.id },
      include: {
        settings: true,
        periods: {
          orderBy: { startDate: 'desc' },
          // Get all periods for complete cycle analysis
        },
        symptoms: {
          orderBy: { date: 'desc' },
          // Get all symptoms for comprehensive pattern recognition
        },
        moods: {
          orderBy: { date: 'desc' },
          // Get all moods to understand emotional patterns
        },
        notes: {
          orderBy: { date: 'desc' },
          // Get all notes to understand user's personal concerns and experiences
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
1. START with EMOTIONAL SUPPORT and VALIDATION
   - Acknowledge their feelings and validate their experience
   - Use supportive, caring language
   - Let them know they're not alone and it's okay to feel this way

2. THEN: Provide PRACTICAL TIPS and ACTIONABLE SUGGESTIONS (80% of response)
   - Focus ONLY on what they can do RIGHT NOW to feel better
   - Provide specific, easy-to-implement remedies
   - Include dietary recommendations with specific foods they can eat
   - Mention lifestyle changes, exercises, and self-care practices
   - Give step-by-step guidance for relief
   - NO scientific explanations about causes or mechanisms
   - Focus entirely on practical help and guidance

3. PERSONALIZED ADVICE based on their data
   - If they have cycle/symptom data: Reference their patterns
   - Suggest when they might experience this based on their cycle
   - Provide tips tailored to their specific situation

4. PRODUCT SUGGESTIONS with delivery links
   - Present products as helpful tools for immediate relief
   - Provide direct web links to instant delivery apps (Swiggy, Zomato, BigBasket)
   - Make it easy for them to find what they need quickly

Example response format for "I am having cramps" (FOLLOW THIS STRUCTURE):
"[User's Name], I understand that cramps can be really uncomfortable and sometimes overwhelming. It's completely normal to feel this way, and you're doing the right thing by seeking help. Let me guide you through some things that can help you feel better right now.

HERE'S WHAT YOU CAN DO RIGHT NOW:

1. Apply Heat for Comfort:
   Place a hot water bottle or heating pad on your lower abdomen or lower back. Keep it there for 15-20 minutes and repeat as needed. The warmth can bring significant relief and help you relax.

2. Gentle Movement:
   Try taking a slow 10-minute walk or doing some gentle stretches. Even light movement can help your body feel better. If walking feels too much, just try some gentle arm circles and deep breathing while sitting.

3. Pain Relief:
   Over-the-counter pain medication like ibuprofen or naproxen can help if you haven't tried them yet. Take them as directed on the package.

4. Stay Hydrated and Nourished:
   Drink plenty of warm water or herbal teas like chamomile or ginger tea. These can help soothe your body. Try eating small, warm meals - warm soups or light foods can be comforting.

5. Rest and Relax:
   Give yourself permission to rest. Put on comfortable clothes, find a cozy spot, and do what makes you feel calm - whether that's listening to music, watching something light, or just lying down with a blanket.

6. Breathing Exercises:
   When the pain feels intense, try this: Inhale slowly for 4 counts, hold for 4 counts, and exhale slowly for 4 counts. Repeat this 5-10 times. This helps your body relax.

7. Comforting Foods:
   Foods like bananas, dark chocolate (in moderation), warm milk, or ginger can be soothing. Avoid heavy, greasy, or very cold foods that might make you feel worse.

[If user has cycle data, add]: Based on your cycle patterns, I notice this tends to happen around [specific time in cycle]. Here are some things you might want to try before it starts next time: [specific tips]

IF THE PAIN IS VERY SEVERE or doesn't improve, or if you're experiencing heavy bleeding along with intense pain, please consider talking to a healthcare provider. You deserve to feel comfortable and healthy.

PRODUCTS THAT MIGHT HELP (you can order these now):
• Hot water bag or heating pad: https://www.swiggy.com/instamart/search?q=hot+water+bag
• Pain relief medication: https://www.bigbasket.com/search/?q=ibuprofen
• Herbal teas for comfort: https://www.swiggy.com/instamart/search?q=chamomile+tea
• Warm comfort foods: https://www.zomato.com/search?q=warm+soup"

CRITICAL RULES:
1. ALWAYS address the user by their name (use "${userName}" in your responses)
2. NO emojis, hearts, flowers - maintain warm but professional supportive tone
3. START with EMOTIONAL SUPPORT - validate their feelings, let them know they're not alone
4. FOCUS ENTIRELY on PRACTICAL TIPS and ACTIONABLE GUIDANCE - NO scientific explanations about causes, mechanisms, or medical terms
5. Provide emotional support alongside physical tips - acknowledge that dealing with symptoms can be tough
6. Use their cycle/symptom data to give personalized advice when available
7. Guide them toward better health with specific, doable suggestions
8. Product suggestions with delivery links come at the END - make them easy to find and order
9. Use web URLs (https://) not deep links - links should open in browser
10. Format product links clearly: product name followed by delivery app link on same line
11. When user asks about THEIR patterns/cycle but hasn't entered data: Politely mention they haven't updated info yet, but still answer their other questions with helpful guidance
12. When user HAS data: Use their actual cycle and symptom patterns to provide personalized, relevant advice
13. Be supportive, caring, and encouraging - they need both emotional and physical support
14. Keep responses COMPLETE - never cut off mid-sentence
15. Remember: You're helping guide them toward feeling better both emotionally and physically`

    // Build comprehensive user context from ALL their data
    let userCycleContext = ''
    
    if (!dbUser) {
      userCycleContext += `\n\nIMPORTANT: User data not found. Provide general guidance only.`
    } else {
      const hasPeriodData = dbUser.periods && dbUser.periods.length > 0
      const hasSymptomData = dbUser.symptoms && dbUser.symptoms.length > 0
      const hasMoodData = dbUser.moods && dbUser.moods.length > 0
      const hasNoteData = dbUser.notes && dbUser.notes.length > 0
      const hasSettings = dbUser.settings !== null
      
      if (hasPeriodData || hasSymptomData || hasMoodData || hasNoteData || hasSettings) {
        userCycleContext += `\n\nCOMPLETE USER PROFILE INFORMATION - Use ALL of this data to provide personalized, comprehensive advice:\n\n`
        
        // User Basic Info
        userCycleContext += `USER PROFILE:\n`
        userCycleContext += `- Name: ${userName}\n`
        userCycleContext += `- Email: ${dbUser.email || 'not provided'}\n`
        
        // Period Data - Complete History
        if (hasPeriodData && dbUser.periods) {
          userCycleContext += `\nPERIOD HISTORY (${dbUser.periods.length} periods tracked):\n`
        const recentPeriods = dbUser.periods.slice(0, 10)
        recentPeriods.forEach((p, idx) => {
          const start = new Date(p.startDate).toLocaleDateString()
          const end = p.endDate ? new Date(p.endDate).toLocaleDateString() : 'ongoing'
          userCycleContext += `  ${idx + 1}. ${start} to ${end}${p.flowLevel ? ` - ${p.flowLevel} flow` : ''}\n`
        })
        if (dbUser.periods.length > 10) {
          userCycleContext += `  ... and ${dbUser.periods.length - 10} more periods\n`
        }
        
        // Calculate comprehensive cycle statistics
        if (dbUser.periods.length >= 2) {
          const cycles = []
          const periodLengths = []
          for (let i = 0; i < dbUser.periods.length - 1; i++) {
            const current = new Date(dbUser.periods[i].startDate)
            const next = new Date(dbUser.periods[i + 1].startDate)
            const diff = Math.ceil((current.getTime() - next.getTime()) / (1000 * 60 * 60 * 24))
            cycles.push(Math.abs(diff))
            
            const endDate = dbUser.periods[i].endDate
            if (endDate) {
              const periodStart = new Date(dbUser.periods[i].startDate)
              const periodEnd = new Date(endDate)
              const periodDays = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
              periodLengths.push(periodDays)
            }
          }
          
          const avgCycle = cycles.length > 0 ? Math.round(cycles.reduce((a, b) => a + b, 0) / cycles.length) : null
          const avgPeriodLength = periodLengths.length > 0 ? Math.round(periodLengths.reduce((a, b) => a + b, 0) / periodLengths.length) : null
          
          if (avgCycle) userCycleContext += `- Average Cycle Length: ${avgCycle} days\n`
          if (avgPeriodLength) userCycleContext += `- Average Period Duration: ${avgPeriodLength} days\n`
          
          // Next period prediction
          if (avgCycle) {
            const lastPeriod = new Date(dbUser.periods[0].startDate)
            const nextPredicted = new Date(lastPeriod)
            nextPredicted.setDate(nextPredicted.getDate() + avgCycle)
            userCycleContext += `- Next Period Predicted: Around ${nextPredicted.toLocaleDateString()}\n`
          }
        }
        
        // Current period status
        // Match frontend calculation: extract date components to avoid timezone issues
        const today = new Date()
        const todayYear = today.getFullYear()
        const todayMonth = today.getMonth()
        const todayDay = today.getDate()
        
        // Create a date at midnight in the server's local timezone for today
        const todayLocal = new Date(todayYear, todayMonth, todayDay)
        todayLocal.setHours(0, 0, 0, 0)
        
        const activePeriod = dbUser.periods.find(p => {
          // Parse period start date and normalize to date components
          const start = new Date(p.startDate)
          const startLocal = new Date(start.getFullYear(), start.getMonth(), start.getDate())
          startLocal.setHours(0, 0, 0, 0)
          
          const end = p.endDate ? new Date(p.endDate) : null
          let endLocal = null
          if (end) {
            endLocal = new Date(end.getFullYear(), end.getMonth(), end.getDate())
            endLocal.setHours(0, 0, 0, 0)
          }
          
          // Check if today is within period range (inclusive)
          return startLocal <= todayLocal && (!endLocal || endLocal >= todayLocal)
        })
        
        if (activePeriod) {
          // Parse period start and normalize to date components (avoid timezone issues)
          const periodStart = new Date(activePeriod.startDate)
          const periodStartLocal = new Date(periodStart.getFullYear(), periodStart.getMonth(), periodStart.getDate())
          periodStartLocal.setHours(0, 0, 0, 0)
          
          // Match frontend calculation exactly:
          // Frontend does: Math.floor((dayDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
          // Where both dates are created from date components in local timezone
          const diff = Math.floor((todayLocal.getTime() - periodStartLocal.getTime()) / (1000 * 60 * 60 * 24))
          const daysInPeriod = diff + 1
          userCycleContext += `- Currently on Period: Day ${daysInPeriod} (${activePeriod.flowLevel || 'unknown'} flow)\n`
        }
      }
      
      // Symptom Data - Complete History with Patterns
      if (hasSymptomData && dbUser.symptoms) {
        userCycleContext += `\nSYMPTOM TRACKING (${dbUser.symptoms.length} entries):\n`
        
        // Most common symptoms with frequency
        const symptomCounts: Record<string, { count: number; avgSeverity: number; recent: Date[] }> = {}
        dbUser.symptoms.forEach(s => {
          if (!symptomCounts[s.type]) {
            symptomCounts[s.type] = { count: 0, avgSeverity: 0, recent: [] }
          }
          symptomCounts[s.type].count++
          symptomCounts[s.type].avgSeverity += s.severity
          symptomCounts[s.type].recent.push(new Date(s.date))
        })
        
        const symptomAnalysis = Object.entries(symptomCounts)
          .map(([type, data]) => ({
            type,
            count: data.count,
            avgSeverity: Math.round((data.avgSeverity / data.count) * 10) / 10,
            lastOccurrence: new Date(Math.max(...data.recent.map(d => d.getTime())))
          }))
          .sort((a, b) => b.count - a.count)
        
        userCycleContext += `- Symptom Frequency Analysis:\n`
        symptomAnalysis.slice(0, 5).forEach(s => {
          userCycleContext += `  • ${s.type}: ${s.count} times (avg severity: ${s.avgSeverity}/5, last: ${s.lastOccurrence.toLocaleDateString()})\n`
        })
        
        // Recent symptoms
        const recentSymptoms = dbUser.symptoms.slice(0, 5)
        userCycleContext += `- Recent Symptoms:\n`
        recentSymptoms.forEach(s => {
          userCycleContext += `  • ${new Date(s.date).toLocaleDateString()}: ${s.type} (severity: ${s.severity}/5)\n`
        })
      }
      
      // Mood Data - Emotional Patterns
      if (hasMoodData && dbUser.moods) {
        userCycleContext += `\nMOOD TRACKING (${dbUser.moods.length} entries):\n`
        
        const moodCounts: Record<string, number> = {}
        dbUser.moods.forEach(m => {
          moodCounts[m.type] = (moodCounts[m.type] || 0) + 1
        })
        
        const mostCommonMoods = Object.entries(moodCounts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([mood, count]) => `${mood} (${count}x)`)
          .join(', ')
        
        userCycleContext += `- Most Common Moods: ${mostCommonMoods}\n`
        
        // Recent moods
        const recentMoods = dbUser.moods.slice(0, 5)
        userCycleContext += `- Recent Moods:\n`
        recentMoods.forEach(m => {
          userCycleContext += `  • ${new Date(m.date).toLocaleDateString()}: ${m.type}\n`
        })
      }
      
      // Notes - Personal Concerns and Experiences
      if (hasNoteData && dbUser.notes) {
        userCycleContext += `\nPERSONAL NOTES (${dbUser.notes.length} entries):\n`
        const recentNotes = dbUser.notes.slice(0, 5)
        recentNotes.forEach((n, idx) => {
          const notePreview = n.content.length > 100 ? n.content.substring(0, 100) + '...' : n.content
          userCycleContext += `  ${idx + 1}. [${new Date(n.date).toLocaleDateString()}] ${notePreview}\n`
        })
        userCycleContext += `- Use these notes to understand her personal concerns, experiences, and what matters to her\n`
      }
      
      // Settings
      if (hasSettings && dbUser.settings) {
        userCycleContext += `\nUSER SETTINGS:\n`
        userCycleContext += `- Average Cycle Length: ${dbUser.settings.averageCycleLength} days\n`
        userCycleContext += `- Average Period Length: ${dbUser.settings.averagePeriodLength} days\n`
        userCycleContext += `- Reminders: ${dbUser.settings.reminderEnabled ? 'Enabled' : 'Disabled'}\n`
      }
      
        userCycleContext += `\n\nHOW TO USE THIS DATA FOR PERSONALIZED ADVICE:
1. Reference her specific patterns when giving advice - "Based on your cycle history..."
2. Correlate symptoms with her mood patterns - acknowledge if she's been feeling down/anxious
3. Use her notes to understand personal concerns she's mentioned
4. Predict based on her cycle: "Your next period is predicted around [date], so you might want to..."
5. Address her most common symptoms proactively: "Since you frequently experience [symptom], here's how to prepare..."
6. Consider her mood patterns when providing emotional support
7. Reference her personal notes to show you understand her specific situation
8. Give advice that's tailored to HER patterns, not generic advice`
      } else {
        userCycleContext += `\n\nIMPORTANT: The user has NOT entered any data in the app yet (no periods, symptoms, moods, or notes tracked). If they ask about their personal patterns, cycle predictions, or their own symptoms, you should say: "I notice you haven't updated your period and symptom information in the app yet. To give you personalized insights about your cycle patterns and provide advice tailored specifically to you, please log your periods, symptoms, moods, and notes in the app first. However, I'm still here to help you with tips and guidance for what you're experiencing right now!"`
      }
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

