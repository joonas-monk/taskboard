import Anthropic from '@anthropic-ai/sdk'

// Reads ANTHROPIC_API_KEY from process.env automatically.
// Worker process passes env via spawn options.
export const anthropic = new Anthropic()

// Default model for pipeline stages — overridable via PIPELINE_MODEL env var.
export const PIPELINE_MODEL = process.env.PIPELINE_MODEL ?? 'claude-haiku-4-5-20251001'
