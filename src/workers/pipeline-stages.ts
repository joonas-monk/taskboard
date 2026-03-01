// src/workers/pipeline-stages.ts
import Anthropic from '@anthropic-ai/sdk'
import { query } from '@anthropic-ai/claude-agent-sdk'
import {
  buildPlanningPrompt,
  buildExecutionPrompt,
  buildExecutionPromptApi,
  buildTestingPrompt,
} from './prompts'

const PIPELINE_MODEL = process.env.PIPELINE_MODEL ?? 'claude-3-5-haiku-20241022'

/**
 * Retry an async function with exponential backoff on rate limit (429) errors.
 * Retries up to maxAttempts times with delays: 2s, 8s, 32s (base * 4^attempt).
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 2000,
): Promise<T> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err: unknown) {
      const isRateLimit =
        err != null &&
        typeof err === 'object' &&
        'status' in err &&
        (err as { status: number }).status === 429

      if (!isRateLimit || attempt === maxAttempts - 1) {
        throw err
      }

      const delay = baseDelayMs * Math.pow(4, attempt)
      console.log(
        `[Pipeline] API-rajoitus (429), odotetaan ${delay / 1000}s ennen uudelleenyritystä (${attempt + 1}/${maxAttempts})...`
      )
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }
  throw new Error('Uudelleenyritykset loppuivat') // unreachable but satisfies TS
}

/**
 * Run the planning stage for a card.
 * Calls the Anthropic API with the card's title and description.
 * Returns the plan text.
 *
 * @throws Error if API call fails or response has no text content
 */
export async function runPlanningStage(card: {
  title: string
  description: string
}): Promise<string> {
  // Create a fresh Anthropic client (worker is a separate process — reads API key from env)
  const anthropic = new Anthropic()

  const userPrompt = buildPlanningPrompt(card.title, card.description)

  const response = await withRetry(() =>
    anthropic.messages.create({
      model: PIPELINE_MODEL,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    })
  )

  // Extract text from response content array
  const textBlock = response.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Ei tekstisisältöä API-vastauksessa')
  }

  return textBlock.text
}

/**
 * Run the execution stage for CODE cards using the Claude Agent SDK.
 * Spawns an autonomous agent in the card's workspace directory with
 * bypassPermissions mode and full code tools.
 *
 * IMPORTANT: Never break or return inside the for-await loop —
 * consume all messages to prevent orphan processes.
 *
 * @throws Error if the agent result subtype is not 'success'
 */
export async function runExecutionStage(
  card: { id: string; title: string },
  planText: string,
  workspacePath: string,
): Promise<string> {
  const prompt = buildExecutionPrompt(card.title, planText)
  const outputParts: string[] = []

  for await (const message of query({
    prompt,
    options: {
      cwd: workspacePath,
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
      allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'],
      maxTurns: 30,
      env: {
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY!,
        PATH: process.env.PATH!,
        HOME: process.env.HOME!,
      },
    },
  })) {
    if (message.type === 'assistant' && message.message?.content) {
      for (const block of message.message.content) {
        if ('text' in block && block.text) {
          outputParts.push(block.text)
        }
      }
    } else if (message.type === 'result') {
      if (message.subtype !== 'success') {
        throw new Error(`Suoritus epäonnistui: ${message.subtype}`)
      }
    }
    // Consume all messages — never break early to prevent orphan processes
  }

  return outputParts.join('\n\n') || 'Suoritus valmis (ei tekstituotosta)'
}

/**
 * Run the execution stage for RESEARCH/BUSINESS/GENERAL cards.
 * Uses the Anthropic messages API — no file operations needed.
 * Returns a comprehensive text result.
 *
 * @throws Error if API call fails or response has no text content
 */
export async function runExecutionStageApi(card: { title: string }, planText: string): Promise<string> {
  const anthropic = new Anthropic()

  const response = await withRetry(() =>
    anthropic.messages.create({
      model: PIPELINE_MODEL,
      max_tokens: 8096,
      messages: [
        {
          role: 'user',
          content: buildExecutionPromptApi(card.title, planText),
        },
      ],
    })
  )

  const textBlock = response.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Ei tekstisisältöä API-vastauksessa')
  }

  return textBlock.text
}

/**
 * Run the testing stage for all card types.
 * Asks Claude to evaluate whether the execution result meets the
 * acceptance criteria from the plan. Result should start with
 * HYVÄKSYTTY or HYLÄTTY followed by justification.
 *
 * @throws Error if API call fails or response has no text content
 */
export async function runTestingStage(
  card: { title: string },
  planText: string,
  executionResult: string,
): Promise<string> {
  const anthropic = new Anthropic()

  const response = await withRetry(() =>
    anthropic.messages.create({
      model: PIPELINE_MODEL,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: buildTestingPrompt(card.title, planText, executionResult),
        },
      ],
    })
  )

  const textBlock = response.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Ei tekstisisältöä testausvastauksessa')
  }

  return textBlock.text
}
