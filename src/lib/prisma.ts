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

// Stale pipeline recovery -- runs once on server start
// If the server crashed while a pipeline was running, cards may be stuck in active states.
// Reset them to FAILED so the user can retry.
;(async () => {
  try {
    const staleCards = await prisma.card.findMany({
      where: {
        pipelineStatus: { in: ['QUEUED', 'PLANNING', 'EXECUTING', 'TESTING'] },
      },
      select: { id: true },
    })

    for (const card of staleCards) {
      await prisma.card.update({
        where: { id: card.id },
        data: { pipelineStatus: 'FAILED' },
      })

      // Also mark the latest PipelineRun as FAILED with a Finnish error message
      const latestRun = await prisma.pipelineRun.findFirst({
        where: { cardId: card.id },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      })

      if (latestRun) {
        await prisma.pipelineRun.update({
          where: { id: latestRun.id },
          data: {
            status: 'FAILED',
            error: 'Palvelin käynnistyi uudelleen -- pipeline keskeytyi',
          },
        })
      }
    }

    if (staleCards.length > 0) {
      console.log(`[TaskBoard] Palautettu ${staleCards.length} keskeytettyä pipelinea FAILED-tilaan`)
    }
  } catch (err) {
    console.error('[TaskBoard] Pipeline-palautus epäonnistui:', err)
  }
})()
