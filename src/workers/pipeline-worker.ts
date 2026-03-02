// src/workers/pipeline-worker.ts
//
// Detached background worker for the AI pipeline.
// Spawned by startPipeline Server Action via child_process.spawn.
// Receives cardId as argv[2] and env vars (DATABASE_URL, ANTHROPIC_API_KEY, PIPELINE_MODEL).
// Creates its own PrismaClient (separate OS process — cannot share Next.js singleton).

import { PrismaClient } from '@/generated/prisma/client'
import { PipelineStatus } from '@/generated/prisma/enums'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import {
  runPlanningStage,
  runExecutionStage,
  runExecutionStageApi,
  runTestingStage,
} from './pipeline-stages'
import { ensureWorkspace } from '../lib/workspace'

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

// --- Helpers ---

/**
 * Re-reads the card's pipelineStatus from DB.
 * Returns true if the card has been set to PAUSED.
 * MUST always query DB — never cache.
 */
async function checkPaused(id: string): Promise<boolean> {
  const card = await prisma.card.findUnique({
    where: { id },
    select: { pipelineStatus: true },
  })
  return card?.pipelineStatus === 'PAUSED'
}

/**
 * Finds the last card in a column and returns next position (last + 1000).
 */
async function getNextPosition(columnId: string): Promise<number> {
  const lastCard = await prisma.card.findFirst({
    where: { columnId },
    orderBy: { position: 'desc' },
    select: { position: true },
  })
  return (lastCard?.position ?? 0) + 1000
}

/**
 * Atomically updates PipelineRun stage/status AND Card columnId/position/pipelineStatus.
 */
async function advanceToStage(
  runId: string,
  id: string,
  newStage: string,
  newStatus: PipelineStatus,
  columnId: string,
  position: number,
): Promise<void> {
  await prisma.$transaction([
    prisma.pipelineRun.update({
      where: { id: runId },
      data: { stage: newStage, status: newStatus },
    }),
    prisma.card.update({
      where: { id },
      data: { columnId, position, pipelineStatus: newStatus },
    }),
  ])
}

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
        cardType: true,
      },
    })

    if (!card) {
      throw new Error(`Card not found: ${cardId}`)
    }

    if (card.pipelineStatus !== 'QUEUED' && card.pipelineStatus !== 'AWAITING_APPROVAL') {
      throw new Error(`Card is not QUEUED or AWAITING_APPROVAL (current: ${card.pipelineStatus})`)
    }

    // 2. Load all column IDs (needed for column moves)
    const columns = await prisma.column.findMany({ select: { id: true, name: true } })
    const columnMap = new Map(columns.map((c) => [c.name, c.id]))

    const suunnitteluId = columnMap.get('Suunnittelu')
    const toteutusId = columnMap.get('Toteutus')
    const testausId = columnMap.get('Testaus')
    const valmisId = columnMap.get('Valmis')

    if (!suunnitteluId || !toteutusId || !testausId || !valmisId) {
      throw new Error('Yksi tai useampi vaadittu sarake puuttuu (Suunnittelu/Toteutus/Testaus/Valmis)')
    }

    // 3. Determine resume point (retry from failed stage)
    const latestRun = await prisma.pipelineRun.findFirst({
      where: { cardId: card.id },
      orderBy: { createdAt: 'desc' },
    })

    type StartStage = 'PLANNING' | 'EXECUTING' | 'TESTING'
    let startStage: StartStage = 'PLANNING'
    let planText: string | undefined
    let execResult: string | undefined

    if (latestRun?.status === 'FAILED' || latestRun?.status === 'AWAITING_APPROVAL') {
      if (latestRun.status === 'AWAITING_APPROVAL' || latestRun.stage === 'EXECUTING') {
        // Load planText from previous run
        const planMsg = await prisma.pipelineMessage.findFirst({
          where: { pipelineRunId: latestRun.id, artifactType: 'plan' },
          select: { content: true },
        })
        if (planMsg) {
          planText = planMsg.content
          startStage = 'EXECUTING'
        }
      } else if (latestRun.stage === 'TESTING') {
        // Load planText and execResult from previous run
        const planMsg = await prisma.pipelineMessage.findFirst({
          where: { pipelineRunId: latestRun.id, artifactType: 'plan' },
          select: { content: true },
        })
        const execMsg = await prisma.pipelineMessage.findFirst({
          where: {
            pipelineRunId: latestRun.id,
            artifactType: { in: ['code', 'execution'] },
          },
          select: { content: true },
        })
        if (planMsg && execMsg) {
          planText = planMsg.content
          execResult = execMsg.content
          startStage = 'TESTING'
        }
      }
      // If PLANNING failed, stay at PLANNING (default)
    }
    // If no failed run (or no retry data found), start from PLANNING

    // 4. Create new PipelineRun for this attempt
    const run = await prisma.pipelineRun.create({
      data: {
        cardId: card.id,
        stage: startStage,
        status: startStage,
      },
    })

    // --- Stage 1: PLANNING ---
    if (startStage === 'PLANNING') {
      // Move card to Suunnittelu column
      const planPosition = await getNextPosition(suunnitteluId)
      await advanceToStage(run.id, card.id, 'PLANNING', 'PLANNING', suunnitteluId, planPosition)

      // Store user prompt
      await prisma.pipelineMessage.create({
        data: {
          pipelineRunId: run.id,
          role: 'user',
          content: `Suunnittele tehtävä: ${card.title}${card.description ? `\n\n${card.description}` : ''}`,
        },
      })

      // Run planning stage
      planText = await runPlanningStage({
        title: card.title,
        description: card.description,
      })

      // Store plan result
      await prisma.pipelineMessage.create({
        data: {
          pipelineRunId: run.id,
          role: 'assistant',
          content: planText,
          artifactType: 'plan',
        },
      })
    }

    // --- Pause check 1 (between PLANNING and EXECUTING) ---
    if (await checkPaused(card.id)) {
      await prisma.$transaction([
        prisma.pipelineRun.update({
          where: { id: run.id },
          data: { status: 'PAUSED' },
        }),
        prisma.card.update({
          where: { id: card.id },
          data: { pipelineStatus: 'PAUSED' },
        }),
      ])
      return
    }

    // --- Wait for user approval after planning ---
    if (startStage === 'PLANNING') {
      await prisma.$transaction([
        prisma.pipelineRun.update({
          where: { id: run.id },
          data: { status: 'AWAITING_APPROVAL' },
        }),
        prisma.card.update({
          where: { id: card.id },
          data: { pipelineStatus: 'AWAITING_APPROVAL' },
        }),
      ])
      // Worker exits — approvePlan Server Action will spawn a new worker to continue
      return
    }

    // --- Stage 2: EXECUTING ---
    if (startStage === 'EXECUTING') {
      // Move card to Toteutus column
      const execPosition = await getNextPosition(toteutusId)
      await advanceToStage(run.id, card.id, 'EXECUTING', 'EXECUTING', toteutusId, execPosition)

      if (card.cardType === 'CODE') {
        const workspacePath = await ensureWorkspace(card.id)
        execResult = await runExecutionStage(
          { id: card.id, title: card.title },
          planText!,
          workspacePath,
        )
      } else {
        execResult = await runExecutionStageApi({ title: card.title }, planText!)
      }

      // Store execution result
      const execArtifactType = card.cardType === 'CODE' ? 'code' : 'execution'
      await prisma.pipelineMessage.create({
        data: {
          pipelineRunId: run.id,
          role: 'assistant',
          content: execResult,
          artifactType: execArtifactType,
        },
      })
    }

    // --- Pause check 2 (between EXECUTING and TESTING) ---
    if (await checkPaused(card.id)) {
      await prisma.$transaction([
        prisma.pipelineRun.update({
          where: { id: run.id },
          data: { status: 'PAUSED' },
        }),
        prisma.card.update({
          where: { id: card.id },
          data: { pipelineStatus: 'PAUSED' },
        }),
      ])
      return
    }

    // --- Stage 3: TESTING ---
    // Move card to Testaus column
    const testPosition = await getNextPosition(testausId)
    await advanceToStage(run.id, card.id, 'TESTING', 'TESTING', testausId, testPosition)

    const testResult = await runTestingStage({ title: card.title }, planText!, execResult!)

    // Store test report
    await prisma.pipelineMessage.create({
      data: {
        pipelineRunId: run.id,
        role: 'assistant',
        content: testResult,
        artifactType: 'test_report',
      },
    })

    // --- Complete: move card to Valmis ---
    const valmisPosition = await getNextPosition(valmisId)
    await advanceToStage(run.id, card.id, 'TESTING', 'COMPLETED', valmisId, valmisPosition)

    // Mark PipelineRun as COMPLETED
    await prisma.pipelineRun.update({
      where: { id: run.id },
      data: { status: 'COMPLETED' },
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
