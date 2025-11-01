import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

let _prismaClient: PrismaClient | undefined

// Lazy initialization to avoid build-time errors
const getPrismaClient = (): PrismaClient => {
  if (!_prismaClient) {
    _prismaClient = globalForPrisma.prisma ?? new PrismaClient()
    
    if (process.env.NODE_ENV !== 'production') {
      globalForPrisma.prisma = _prismaClient
    }
  }
  return _prismaClient
}

// Export a Proxy that lazily initializes Prisma only when accessed
export const prisma = new Proxy({} as PrismaClient, {
  get(target, prop) {
    return (getPrismaClient() as any)[prop]
  }
})

