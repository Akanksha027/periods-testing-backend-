import { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

export async function getUserFromRequest(request: NextRequest) {
  try {
    // Get token from Authorization header
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('[Auth] No Authorization header found')
      return null
    }

    const token = authHeader.substring(7)

    if (!token || token.trim() === '') {
      console.log('[Auth] Empty token in Authorization header')
      return null
    }

    // Verify the token with Clerk
    console.log('[Auth] Token received (first 20 chars):', token.substring(0, 20) + '...', 'Length:', token.length)
    
    let sessionClaims = null
    try {
      // Manual verification using jose library
      // Since we're using a custom Authorization header, we need to verify manually
      // Get Clerk secret key from environment
      const clerkSecretKey = process.env.CLERK_SECRET_KEY
      if (!clerkSecretKey) {
        console.error('[Auth] CLERK_SECRET_KEY not configured')
        return null
      }

      // Verify JWT token using jose library
      // Clerk tokens are JWTs signed with the secret key
      const secret = new TextEncoder().encode(clerkSecretKey)
      const { payload } = await jwtVerify(token, secret)
      
      sessionClaims = payload as any
      
      if (!sessionClaims || !sessionClaims.sub) {
        console.log('[Auth] Invalid token or missing subject claim')
        console.log('[Auth] Session claims:', sessionClaims ? Object.keys(sessionClaims) : 'null')
        return null
      }
      
      // Check token expiration
      const now = Math.floor(Date.now() / 1000)
      if (sessionClaims.exp && sessionClaims.exp < now) {
        console.log('[Auth] Token expired. Exp:', sessionClaims.exp, 'Now:', now)
        return null
      }
      
      // Check token not-before time
      if (sessionClaims.nbf && sessionClaims.nbf > now) {
        console.log('[Auth] Token not active yet. Nbf:', sessionClaims.nbf, 'Now:', now)
        return null
      }
      
      console.log('[Auth] Token verified successfully. Claims keys:', Object.keys(sessionClaims))
      console.log('[Auth] Token expires at:', sessionClaims.exp ? new Date(sessionClaims.exp * 1000).toISOString() : 'N/A')
    } catch (verifyError: any) {
      console.error('[Auth] Token verification failed:', verifyError.message || verifyError)
      console.error('[Auth] Error details:', {
        name: verifyError?.name,
        code: verifyError?.code,
        status: verifyError?.status,
        stack: verifyError?.stack?.substring(0, 200),
      })
      return null
    }

    // Return user object with Clerk ID
    // The sub (subject) claim contains the user ID (e.g., "user_xxxxx")
    const user = {
      id: sessionClaims!.sub as string,
      email: (sessionClaims!.email as string) || null,
    }
    console.log('[Auth] Token verified for user:', user.id)
    return user
  } catch (error: any) {
    console.error('[Auth] Token verification error:', error.message || error)
    console.error('[Auth] Full error:', error)
    return null
  }
}

export function unauthorizedResponse() {
  return new Response(
    JSON.stringify({ error: 'Unauthorized' }),
    { status: 401, headers: { 'Content-Type': 'application/json' } }
  )
}

