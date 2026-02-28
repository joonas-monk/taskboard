import 'dotenv/config'
import Database from 'better-sqlite3'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from '../generated/prisma/client'

const connectionString = process.env.DATABASE_URL ?? 'file:/var/data/taskboard/taskboard.db'
const dbPath = connectionString.replace(/^file:/, '')

// Set WAL mode — persists in DB file across connections.
// Required for concurrent access from Next.js + pipeline worker process.
const rawDb = new Database(dbPath)
rawDb.pragma('journal_mode = WAL')
rawDb.close()

const adapter = new PrismaBetterSqlite3({ url: connectionString })

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ adapter })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
