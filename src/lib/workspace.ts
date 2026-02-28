import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const WORKSPACE_BASE =
  process.env.WORKSPACE_BASE ??
  path.join(process.env.HOME!, 'data/taskboard/workspaces')

/**
 * Returns the workspace directory path for a given card ID.
 * Path: ~/data/taskboard/workspaces/{cardId}/ (or WORKSPACE_BASE/{cardId})
 */
export function getWorkspacePath(cardId: string): string {
  return path.join(WORKSPACE_BASE, cardId)
}

/**
 * Ensures the workspace directory exists for the given card ID.
 * Creates it (and any parent directories) if it does not exist.
 * Returns the absolute workspace path.
 */
export async function ensureWorkspace(cardId: string): Promise<string> {
  const workspacePath = getWorkspacePath(cardId)
  await mkdir(workspacePath, { recursive: true })
  return workspacePath
}
