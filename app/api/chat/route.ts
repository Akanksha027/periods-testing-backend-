import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest, unauthorizedResponse } from '@/lib/auth'
import { GoogleGenerativeAI } from '@google/generative-ai'

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
- If symptoms are mild/moderate: reassure and provide home remedies, comfort tips, AND specific product recommendations
- If symptoms are severe: gently recommend seeing a doctor with understanding, but also provide immediate relief suggestions
- Always be supportive and understanding
- Use simple language that's easy to understand
- Include emojis sparingly for warmth (💕, 🌸, etc.) but not too many

IMPORTANT - Product Recommendations & Instant Delivery Links:
When suggesting products for relief (hot water bags, heating pads, pain relief items, supplements, etc.), ALWAYS:
1. Mention the product name clearly
2. Provide direct search/purchase links for instant delivery apps in this exact format:
   - Swiggy Instamart: "swiggy://search?q=[product-name]" or "https://www.swiggy.com/instamart/search?q=[product-name]"
   - Zomato: "zomato://search?q=[product-name]" or "https://www.zomato.com/search?q=[product-name]"
   - BigBasket: "https://www.bigbasket.com/search/?q=[product-name]"
   - Zepto/Blinkit: Similar format with product name

Example response format:
"Oh, I understand you're having cramps and back pain! 💕 

For immediate relief, here are some products you can order right now:
• Hot Water Bag - Get instant delivery: 
  Swiggy Instamart: swiggy://search?q=hot+water+bag
  Zomato: zomato://search?q=hot+water+bag
  BigBasket: https://www.bigbasket.com/search/?q=hot+water+bag

• Electric Heating Pad - Order now:
  Swiggy Instamart: swiggy://search?q=heating+pad
  BigBasket: https://www.bigbasket.com/search/?q=heating+pad

For food, try warm soups or herbal teas - they can help:
• Warm Soup - Order from Swiggy/Zomato: swiggy://search?q=hot+soup
• Herbal Tea - Get it delivered: bigbasket://search?q=herbal+tea

[Medical advice if needed]"

Food & Meal Recommendations:
- When suggesting foods for symptom relief, ALWAYS include delivery app links
- Format: "[Food suggestion] - Order from [App]: [deep link or search link]"
- Suggest ready-to-eat meals when the user needs comfort food

Medical Advice:
- If symptoms are severe, suggest seeing a doctor
- Also provide immediate relief products while waiting
- Include dietary recommendations with delivery links

Keep responses practical, empathetic, and include product links for EVERY physical product or food item you recommend.`

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
            maxOutputTokens: 300,
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

