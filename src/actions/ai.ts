'use server'

import { spawn } from 'child_process'
import path from 'path'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import type { ActionResult, PipelineStatusResult } from '@/types'
import { startPipelineSchema, getPipelineStatusSchema, pausePipelineSchema } from './ai-schemas'
import type { PipelineStatus } from '@/types'

function formatZodError(error: { issues: Array<{ message: string }> }): string {
  return error.issues.map((i) => i.message).join(', ')
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

    if (card.pipelineStatus !== 'IDLE' && card.pipelineStatus !== 'FAILED' && card.pipelineStatus !== 'PAUSED') {
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

    // Spawn detached worker
    const workerPath = path.resolve(process.cwd(), 'src/workers/pipeline-worker.ts')
    const tsxPath = path.resolve(process.cwd(), 'node_modules/.bin/tsx')

    const worker = spawn(tsxPath, [workerPath, cardId], {
      cwd: process.cwd(),
      detached: true,
      stdio: 'ignore',
      env: {
        DATABASE_URL: process.env.DATABASE_URL!,
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY!,
        PIPELINE_MODEL: process.env.PIPELINE_MODEL ?? 'claude-3-5-haiku-20241022',
        NODE_ENV: process.env.NODE_ENV ?? 'production',
        PATH: process.env.PATH,
        HOME: process.env.HOME,
      },
    })
    worker.unref()

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
