'use server'

import { spawn } from 'child_process'
import path from 'path'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import type { ActionResult, PipelineStatusResult } from '@/types'
import { startPipelineSchema, getPipelineStatusSchema, pausePipelineSchema, approvePlanSchema, approveExecutionSchema, handleTestFailureSchema } from './ai-schemas'
import type { PipelineStatus } from '@/types'

function formatZodError(error: { issues: Array<{ message: string }> }): string {
  return error.issues.map((i) => i.message).join(', ')
}

/**
 * Spawn a detached pipeline worker process for a card.
 * In production, runs as 'deploy' user (uid 1001) to avoid Claude Code CLI's
 * root restriction on --dangerously-skip-permissions.
 */
function spawnWorker(cardId: string): void {
  const appRoot = process.env.APP_ROOT || process.cwd()
  const workerPath = path.resolve(appRoot, 'src/workers/pipeline-worker.ts')
  const tsxPath = path.resolve(appRoot, 'node_modules/.bin/tsx')

  // In production, run as deploy user (Claude Code CLI refuses root + bypassPermissions)
  const isProduction = process.env.NODE_ENV === 'production'
  const DEPLOY_UID = 1001
  const DEPLOY_GID = 1001

  const worker = spawn(tsxPath, [workerPath, cardId], {
    cwd: appRoot,
    detached: true,
    stdio: 'ignore',
    ...(isProduction ? { uid: DEPLOY_UID, gid: DEPLOY_GID } : {}),
    env: {
      DATABASE_URL: process.env.DATABASE_URL!,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY!,
      PIPELINE_MODEL: process.env.PIPELINE_MODEL ?? 'claude-haiku-4-5-20251001',
      NODE_ENV: process.env.NODE_ENV ?? 'production',
      PATH: '/usr/local/bin:/usr/bin:/bin' + (process.env.PATH ? `:${process.env.PATH}` : ''),
      HOME: isProduction ? '/home/deploy' : (process.env.HOME ?? ''),
      // Production pipeline env vars
      GITHUB_TOKEN: process.env.GITHUB_TOKEN ?? '',
      VPS_HOST: process.env.VPS_HOST ?? '187.77.226.235',
      WORKSPACE_BASE: process.env.WORKSPACE_BASE ?? '',
    },
  })
  worker.unref()
}

/**
 * Start the AI pipeline for a card.
 * Sets card to QUEUED, spawns a detached worker process, returns immediately.
 * The worker runs planning stage and moves card Idea -> Suunnittelu.
 */
export async function startPipeline(
  input: { cardId: string }
): Promise<ActionResult<void>> {
  const parsed = startPipelineSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: formatZodError(parsed.error) }
  }

  const { cardId } = parsed.data

  try {
    // Validate card exists and is in a valid state to start pipeline
    const card = await prisma.card.findUnique({
      where: { id: cardId },
      select: { id: true, pipelineStatus: true },
    })

    if (!card) {
      return { success: false, error: 'Korttia ei löydy' }
    }

    if (card.pipelineStatus !== 'IDLE' && card.pipelineStatus !== 'FAILED' && card.pipelineStatus !== 'PAUSED' && card.pipelineStatus !== 'QUEUED') {
      return { success: false, error: 'Pipeline on jo käynnissä tai valmis' }
    }

    // Check for any other actively running pipeline (SQLite concurrent-write safety)
    const activePipeline = await prisma.card.findFirst({
      where: {
        pipelineStatus: { in: ['QUEUED', 'PLANNING', 'EXECUTING', 'TESTING'] },
      },
      select: { id: true },
    })

    if (activePipeline) {
      return { success: false, error: 'Toinen pipeline on jo käynnissä. Odota sen valmistumista.' }
    }

    // Validate required env var
    if (!process.env.ANTHROPIC_API_KEY) {
      return { success: false, error: 'ANTHROPIC_API_KEY puuttuu palvelimen ympäristömuuttujista' }
    }

    // Set card to QUEUED
    await prisma.card.update({
      where: { id: cardId },
      data: { pipelineStatus: 'QUEUED' },
    })

    spawnWorker(cardId)

    revalidatePath('/')
    return { success: true, data: undefined }
  } catch {
    return { success: false, error: 'Pipelinen käynnistys epäonnistui' }
  }
}

/**
 * Get the pipeline status for a card.
 * Returns current pipelineStatus and the latest PipelineRun with messages.
 */
export async function getPipelineStatus(
  input: { cardId: string }
): Promise<ActionResult<PipelineStatusResult>> {
  const parsed = getPipelineStatusSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: formatZodError(parsed.error) }
  }

  const { cardId } = parsed.data

  try {
    const card = await prisma.card.findUnique({
      where: { id: cardId },
      select: {
        pipelineStatus: true,
        pipelineRuns: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            messages: {
              orderBy: { createdAt: 'asc' },
            },
          },
        },
      },
    })

    if (!card) {
      return { success: false, error: 'Korttia ei löydy' }
    }

    return {
      success: true,
      data: {
        status: card.pipelineStatus,
        run: card.pipelineRuns[0] ?? null,
      },
    }
  } catch {
    return { success: false, error: 'Tilan haku epäonnistui' }
  }
}

/**
 * Pause a running pipeline.
 * Sets pipelineStatus to PAUSED for cards that are in PLANNING, EXECUTING, or TESTING state.
 * The worker checks this flag between stages and exits cleanly when it detects PAUSED.
 */
export async function pausePipeline(
  input: { cardId: string }
): Promise<ActionResult<void>> {
  const parsed = pausePipelineSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: formatZodError(parsed.error) }
  }

  const { cardId } = parsed.data

  try {
    const card = await prisma.card.findUnique({
      where: { id: cardId },
      select: { pipelineStatus: true },
    })

    const pauseable: PipelineStatus[] = ['PLANNING', 'EXECUTING', 'TESTING']
    if (!card || !pauseable.includes(card.pipelineStatus as PipelineStatus)) {
      return { success: false, error: 'Pipeline ei ole käynnissä' }
    }

    await prisma.card.update({
      where: { id: cardId },
      data: { pipelineStatus: 'PAUSED' },
    })

    revalidatePath('/')
    return { success: true, data: undefined }
  } catch {
    return { success: false, error: 'Pipelinen pysäytys epäonnistui' }
  }
}

/**
 * Approve (or edit) the AI plan and continue pipeline to execution.
 * Only valid when card is in AWAITING_APPROVAL state.
 * Optionally updates the plan text, then spawns a new worker to continue from EXECUTING.
 */
export async function approvePlan(
  input: { cardId: string; editedPlan?: string }
): Promise<ActionResult<void>> {
  const parsed = approvePlanSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: formatZodError(parsed.error) }
  }

  const { cardId, editedPlan } = parsed.data

  try {
    const card = await prisma.card.findUnique({
      where: { id: cardId },
      select: { id: true, pipelineStatus: true },
    })

    if (!card) {
      return { success: false, error: 'Korttia ei löydy' }
    }

    if (card.pipelineStatus !== 'AWAITING_APPROVAL') {
      return { success: false, error: 'Kortti ei odota hyväksyntää' }
    }

    // If user edited the plan, update the plan message in the latest run
    if (editedPlan) {
      const latestRun = await prisma.pipelineRun.findFirst({
        where: { cardId },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      })

      if (latestRun) {
        const planMsg = await prisma.pipelineMessage.findFirst({
          where: { pipelineRunId: latestRun.id, artifactType: 'plan' },
          select: { id: true },
        })

        if (planMsg) {
          await prisma.pipelineMessage.update({
            where: { id: planMsg.id },
            data: { content: editedPlan },
          })
        }
      }
    }

    // Set card to QUEUED so the worker can pick it up
    await prisma.card.update({
      where: { id: cardId },
      data: { pipelineStatus: 'QUEUED' },
    })

    spawnWorker(cardId)

    revalidatePath('/')
    return { success: true, data: undefined }
  } catch {
    return { success: false, error: 'Suunnitelman hyväksyntä epäonnistui' }
  }
}

/**
 * Approve execution result and continue to TESTING.
 * Only valid when card is in AWAITING_EXEC_REVIEW state.
 * Optionally stores user feedback, then spawns worker to run testing.
 */
export async function approveExecution(
  input: { cardId: string; feedback?: string }
): Promise<ActionResult<void>> {
  const parsed = approveExecutionSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: formatZodError(parsed.error) }
  }

  const { cardId, feedback } = parsed.data

  try {
    const card = await prisma.card.findUnique({
      where: { id: cardId },
      select: { id: true, pipelineStatus: true },
    })

    if (!card) {
      return { success: false, error: 'Korttia ei löydy' }
    }

    if (card.pipelineStatus !== 'AWAITING_EXEC_REVIEW') {
      return { success: false, error: 'Kortti ei odota toteutuksen tarkistusta' }
    }

    // Store user feedback if provided
    if (feedback) {
      const latestRun = await prisma.pipelineRun.findFirst({
        where: { cardId },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      })

      if (latestRun) {
        await prisma.pipelineMessage.create({
          data: {
            pipelineRunId: latestRun.id,
            role: 'user',
            content: feedback,
            artifactType: 'user_feedback',
          },
        })
      }
    }

    await prisma.card.update({
      where: { id: cardId },
      data: { pipelineStatus: 'QUEUED' },
    })

    spawnWorker(cardId)

    revalidatePath('/')
    return { success: true, data: undefined }
  } catch {
    return { success: false, error: 'Toteutuksen hyväksyntä epäonnistui' }
  }
}

/**
 * Handle a failed test result.
 * Only valid when card is in TEST_FAILED state.
 * - 'retry': stores optional feedback, sets QUEUED, spawns worker (re-plans with context)
 * - 'accept': sets COMPLETED, moves card to Valmis
 * - 'stop': sets FAILED
 */
export async function handleTestFailure(
  input: { cardId: string; action: 'retry' | 'accept' | 'stop'; feedback?: string }
): Promise<ActionResult<void>> {
  const parsed = handleTestFailureSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: formatZodError(parsed.error) }
  }

  const { cardId, action, feedback } = parsed.data

  try {
    const card = await prisma.card.findUnique({
      where: { id: cardId },
      select: { id: true, pipelineStatus: true },
    })

    if (!card) {
      return { success: false, error: 'Korttia ei löydy' }
    }

    if (card.pipelineStatus !== 'TEST_FAILED') {
      return { success: false, error: 'Kortti ei ole TEST_FAILED-tilassa' }
    }

    // Store user feedback if provided (for retry context)
    if (feedback) {
      const latestRun = await prisma.pipelineRun.findFirst({
        where: { cardId },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      })

      if (latestRun) {
        await prisma.pipelineMessage.create({
          data: {
            pipelineRunId: latestRun.id,
            role: 'user',
            content: feedback,
            artifactType: 'user_feedback',
          },
        })
      }
    }

    if (action === 'retry') {
      await prisma.card.update({
        where: { id: cardId },
        data: { pipelineStatus: 'QUEUED' },
      })
      spawnWorker(cardId)
    } else if (action === 'accept') {
      // Find Valmis column and move card there
      const valmisCol = await prisma.column.findFirst({
        where: { name: 'Valmis' },
        select: { id: true },
      })

      if (valmisCol) {
        const lastCard = await prisma.card.findFirst({
          where: { columnId: valmisCol.id },
          orderBy: { position: 'desc' },
          select: { position: true },
        })
        const position = (lastCard?.position ?? 0) + 1000

        await prisma.card.update({
          where: { id: cardId },
          data: {
            pipelineStatus: 'COMPLETED',
            columnId: valmisCol.id,
            position,
          },
        })
      } else {
        await prisma.card.update({
          where: { id: cardId },
          data: { pipelineStatus: 'COMPLETED' },
        })
      }
    } else {
      // 'stop'
      await prisma.card.update({
        where: { id: cardId },
        data: { pipelineStatus: 'FAILED' },
      })
    }

    revalidatePath('/')
    return { success: true, data: undefined }
  } catch {
    return { success: false, error: 'Testivirheen käsittely epäonnistui' }
  }
}
