'use server'

import { spawn } from 'child_process'
import path from 'path'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import type { ActionResult, PipelineStatusResult } from '@/types'
import { startPipelineSchema, getPipelineStatusSchema } from './ai-schemas'

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

    if (card.pipelineStatus !== 'IDLE' && card.pipelineStatus !== 'FAILED') {
      return { success: false, error: 'Pipeline on jo käynnissä tai valmis' }
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
