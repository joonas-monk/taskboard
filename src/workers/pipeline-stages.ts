// src/workers/pipeline-stages.ts
import Anthropic from '@anthropic-ai/sdk'
import { buildPlanningPrompt } from './prompts'

const PIPELINE_MODEL = process.env.PIPELINE_MODEL ?? 'claude-3-5-haiku-20241022'

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

  const response = await anthropic.messages.create({
    model: PIPELINE_MODEL,
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: userPrompt,
      },
    ],
  })

  // Extract text from response content array
  const textBlock = response.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Ei tekstisisältöä API-vastauksessa')
  }

  return textBlock.text
}
