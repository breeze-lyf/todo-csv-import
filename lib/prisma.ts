import { Pool, types } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

// Fix for Date parsing
types.setTypeParser(1114, (str) => str)

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined
}

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
    console.error('DATABASE_URL is missing in environment variables')
}

// Optimized Pool for Serverless
const pool = new Pool({
    connectionString,
    max: 10,             // Limit connections in Serverless
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
})

const adapter = new PrismaPg(pool)

export const prisma =
    globalForPrisma.prisma ??
    new PrismaClient({
        adapter,
        // Uncomment below to debug in development
        // log: ['query', 'error', 'warn'],
    })

if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prisma
}
