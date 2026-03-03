// src/lib/deploy.ts
//
// PM2 deployment management for CODE card projects.
// Assigns ports, starts/stops PM2 processes.

import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const PORT_RANGE_START = 4001
const PORT_RANGE_END = 4999
const VPS_HOST = process.env.VPS_HOST ?? '187.77.226.235'

/**
 * Get list of ports currently used by PM2 processes.
 */
function getUsedPorts(): Set<number> {
  try {
    const output = execSync('pm2 jlist 2>/dev/null', {
      timeout: 10000,
      env: process.env,
    }).toString()

    const processes = JSON.parse(output) as Array<{
      pm2_env?: { env?: { PORT?: string } }
    }>

    const ports = new Set<number>()
    for (const proc of processes) {
      const port = proc.pm2_env?.env?.PORT
      if (port) ports.add(parseInt(port, 10))
    }
    return ports
  } catch {
    return new Set()
  }
}

/**
 * Find the next available port in the range.
 */
export function getNextPort(): number {
  const usedPorts = getUsedPorts()

  for (let port = PORT_RANGE_START; port <= PORT_RANGE_END; port++) {
    if (!usedPorts.has(port)) return port
  }

  throw new Error(`Kaikki portit käytössä (${PORT_RANGE_START}-${PORT_RANGE_END})`)
}

/**
 * Read package.json from workspace to determine project type.
 */
function readPackageJson(workspacePath: string): Record<string, unknown> | null {
  const pkgPath = path.join(workspacePath, 'package.json')
  if (!existsSync(pkgPath)) return null

  try {
    return JSON.parse(readFileSync(pkgPath, 'utf-8'))
  } catch {
    return null
  }
}

/**
 * Check if the project has a start script.
 */
export function hasStartScript(workspacePath: string): boolean {
  const pkg = readPackageJson(workspacePath)
  if (!pkg) return false

  const scripts = pkg.scripts as Record<string, string> | undefined
  return !!scripts?.start
}

/**
 * Deploy a project using PM2.
 * - Assigns a port
 * - Starts the project with PM2
 * - Returns the deploy URL and port
 *
 * Only deploys if the project has a `start` script in package.json.
 */
export async function deployWithPM2(
  workspacePath: string,
  cardId: string,
  projectName: string,
): Promise<{ deployUrl: string; port: number } | null> {
  if (!hasStartScript(workspacePath)) {
    console.log(`[Deploy] Ei start-scriptiä — ohitetaan deploy: ${projectName}`)
    return null
  }

  const port = getNextPort()
  const pm2Name = `project-${projectName}`

  const pmExec = (cmd: string) =>
    execSync(cmd, {
      cwd: workspacePath,
      timeout: 30000,
      env: {
        ...process.env,
        PORT: String(port),
      },
    }).toString().trim()

  // Stop existing process if running
  try {
    pmExec(`pm2 delete ${pm2Name}`)
  } catch {
    // Process doesn't exist yet — that's fine
  }

  // Determine the start command
  const pkg = readPackageJson(workspacePath)
  const scripts = (pkg?.scripts as Record<string, string>) ?? {}

  let startCmd: string
  let interpreter: string | undefined

  if (scripts.start?.includes('next start')) {
    // Next.js project — build and start
    startCmd = 'npm run start'
    interpreter = undefined
  } else if (scripts.start?.includes('node')) {
    // Node.js project — use the start script
    startCmd = 'npm run start'
    interpreter = undefined
  } else {
    // Default: use npm start
    startCmd = 'npm run start'
    interpreter = undefined
  }

  // Start with PM2
  try {
    pmExec(
      `pm2 start "PORT=${port} ${startCmd}" --name "${pm2Name}" --cwd "${workspacePath}"`
    )
    pmExec('pm2 save')
  } catch (err) {
    console.error(`[Deploy] PM2 start epäonnistui:`, err)
    throw new Error(`PM2-deploy epäonnistui: ${projectName}`)
  }

  const deployUrl = `http://${VPS_HOST}:${port}`

  console.log(`[Deploy] ${projectName} käynnistetty portissa ${port}: ${deployUrl}`)

  return { deployUrl, port }
}

/**
 * Stop a deployed PM2 process.
 */
export function stopDeployment(projectName: string): void {
  const pm2Name = `project-${projectName}`
  try {
    execSync(`pm2 delete ${pm2Name}`, { timeout: 10000, env: process.env })
    execSync('pm2 save', { timeout: 10000, env: process.env })
  } catch {
    // Process may not exist
  }
}
