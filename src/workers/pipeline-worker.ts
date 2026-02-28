// src/workers/pipeline-worker.ts
//
// Detached background worker for the AI pipeline.
// Spawned by startPipeline Server Action via child_process.spawn.
// Receives cardId as argv[2] and env vars (DATABASE_URL, ANTHROPIC_API_KEY, PIPELINE_MODEL).
// Creates its own PrismaClient (separate OS process — cannot share Next.js singleton).

import { PrismaClient } from '@/generated/prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { runPlanningStage } from './pipeline-stages'

// --- Setup ---

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error('DATABASE_URL not set')
  process.exit(1)
}

const cardId = process.argv[2]
if (!cardId) {
  console.error('No cardId provided as argv[2]')
  process.exit(1)
}

// Worker creates its own PrismaClient — separate OS process, fresh globalThis.
// WAL mode already set by lib/prisma.ts in Next.js process — persists in DB file.
const adapter = new PrismaBetterSqlite3({ url: connectionString })
const prisma = new PrismaClient({ adapter })

// --- Main ---

async function main() {
  try {
    // 1. Load the card
    const card = await prisma.card.findUnique({
      where: { id: cardId },
      select: {
        id: true,
        title: true,
        description: true,
        pipelineStatus: true,
        columnId: true,
      },
    })

    if (!card) {
      throw new Error(`Card not found: ${cardId}`)
    }

    if (card.pipelineStatus !== 'QUEUED') {
      throw new Error(`Card is not QUEUED (current: ${card.pipelineStatus})`)
    }

    // 2. Find the Suunnittelu column
    const suunnitteluColumn = await prisma.column.findFirst({
      where: { name: 'Suunnittelu' },
    })

    if (!suunnitteluColumn) {
      throw new Error('Suunnittelu-saraketta ei löydy')
    }

    // 3. Create PipelineRun record
    const run = await prisma.pipelineRun.create({
      data: {
        cardId: card.id,
        stage: 'PLANNING',
        status: 'PLANNING',
      },
    })

    // 4. Update card: move to Suunnittelu, set status to PLANNING
    //    Position: after last card in Suunnittelu column
    const lastInTarget = await prisma.card.findFirst({
      where: { columnId: suunnitteluColumn.id },
      orderBy: { position: 'desc' },
      select: { position: true },
    })
    const newPosition = (lastInTarget?.position ?? 0) + 1000

    await prisma.card.update({
      where: { id: card.id },
      data: {
        columnId: suunnitteluColumn.id,
        position: newPosition,
        pipelineStatus: 'PLANNING',
      },
    })

    // 5. Store the user prompt as a PipelineMessage
    await prisma.pipelineMessage.create({
      data: {
        pipelineRunId: run.id,
        role: 'user',
        content: `Suunnittele tehtävä: ${card.title}${card.description ? `\n\n${card.description}` : ''}`,
      },
    })

    // 6. Call Anthropic API for planning
    const planText = await runPlanningStage({
      title: card.title,
      description: card.description,
    })

    // 7. Store the assistant response as a PipelineMessage
    await prisma.pipelineMessage.create({
      data: {
        pipelineRunId: run.id,
        role: 'assistant',
        content: planText,
        artifactType: 'plan',
      },
    })

    // 8. Mark run and card as COMPLETED (Phase 5 scope: planning stage only)
    await prisma.pipelineRun.update({
      where: { id: run.id },
      data: {
        status: 'COMPLETED',
        stage: 'PLANNING',
      },
    })

    await prisma.card.update({
      where: { id: card.id },
      data: {
        pipelineStatus: 'COMPLETED',
      },
    })

  } catch (err) {
    // Set card and run to FAILED with error message
    const errorMessage = err instanceof Error ? err.message : 'Tuntematon virhe'

    try {
      await prisma.card.update({
        where: { id: cardId },
        data: { pipelineStatus: 'FAILED' },
      })

      // Find and update the latest run for this card
      const latestRun = await prisma.pipelineRun.findFirst({
        where: { cardId },
        orderBy: { createdAt: 'desc' },
      })

      if (latestRun) {
        await prisma.pipelineRun.update({
          where: { id: latestRun.id },
          data: {
            status: 'FAILED',
            error: errorMessage,
          },
        })
      }
    } catch {
      // If even the error handling fails, we can only exit
      console.error('Failed to record error state:', errorMessage)
    }
  } finally {
    await prisma.$disconnect()
    process.exit(0)
  }
}

main()
