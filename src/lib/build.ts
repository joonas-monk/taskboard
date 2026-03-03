// src/lib/build.ts
//
// Build verification for CODE card projects.
// Runs npm install, npm run build, npm test in the workspace.
// Returns structured results for the AI testing stage.

import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

export interface BuildResult {
  /** Whether all steps succeeded */
  success: boolean
  /** Individual step results */
  steps: BuildStep[]
  /** Combined summary text for AI evaluation */
  summary: string
}

export interface BuildStep {
  name: string
  command: string
  success: boolean
  output: string
  duration: number // ms
}

/**
 * Run a shell command in the workspace, capturing output.
 * Returns the step result (never throws).
 */
function runStep(
  name: string,
  command: string,
  workspacePath: string,
  timeoutMs = 120000,
): BuildStep {
  const start = Date.now()
  try {
    const output = execSync(command, {
      cwd: workspacePath,
      timeout: timeoutMs,
      env: {
        ...process.env,
        NODE_ENV: 'development', // needed for devDependencies
        CI: 'true',
      },
      maxBuffer: 10 * 1024 * 1024, // 10MB
    }).toString()

    return {
      name,
      command,
      success: true,
      output: output.slice(-5000), // Last 5000 chars
      duration: Date.now() - start,
    }
  } catch (err: unknown) {
    const error = err as { stdout?: Buffer; stderr?: Buffer; message?: string }
    const output = [
      error.stdout?.toString() ?? '',
      error.stderr?.toString() ?? '',
      error.message ?? '',
    ].join('\n').slice(-5000)

    return {
      name,
      command,
      success: false,
      output,
      duration: Date.now() - start,
    }
  }
}

/**
 * Read package.json scripts to determine available commands.
 */
function getScripts(workspacePath: string): Record<string, string> {
  const pkgPath = path.join(workspacePath, 'package.json')
  if (!existsSync(pkgPath)) return {}

  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
    return (pkg.scripts as Record<string, string>) ?? {}
  } catch {
    return {}
  }
}

/**
 * Run the full build verification pipeline for a workspace.
 *
 * Steps:
 * 1. npm install (if package.json exists)
 * 2. npm run build (if build script exists)
 * 3. npm test (if test script exists)
 * 4. npm run lint (if lint script exists)
 *
 * Returns a BuildResult with all step outputs.
 */
export function runBuildVerification(workspacePath: string): BuildResult {
  const steps: BuildStep[] = []
  const pkgPath = path.join(workspacePath, 'package.json')

  if (!existsSync(pkgPath)) {
    // No package.json — check for other project types
    const hasPythonReqs = existsSync(path.join(workspacePath, 'requirements.txt'))
    const hasGoMod = existsSync(path.join(workspacePath, 'go.mod'))

    if (hasPythonReqs) {
      steps.push(runStep('pip install', 'pip install -r requirements.txt', workspacePath))
    } else if (hasGoMod) {
      steps.push(runStep('go build', 'go build ./...', workspacePath))
      steps.push(runStep('go test', 'go test ./...', workspacePath))
    } else {
      // No recognizable project — skip build verification
      return {
        success: true,
        steps: [],
        summary: 'Ei package.json tai muuta tunnistettavaa projektityyppiä — build-verifikaatio ohitettu.',
      }
    }
  } else {
    // Node.js project
    const scripts = getScripts(workspacePath)

    // Step 1: npm install
    steps.push(runStep('npm install', 'npm install', workspacePath, 180000))

    if (!steps[steps.length - 1].success) {
      // If install fails, don't try to build/test
      return buildSummary(steps)
    }

    // Step 2: TypeScript check (if tsconfig exists)
    if (existsSync(path.join(workspacePath, 'tsconfig.json'))) {
      steps.push(runStep('tsc --noEmit', 'npx tsc --noEmit', workspacePath, 60000))
    }

    // Step 3: npm run build (if available)
    if (scripts.build) {
      steps.push(runStep('npm run build', 'npm run build', workspacePath, 120000))
    }

    // Step 4: npm test (if available)
    if (scripts.test && scripts.test !== 'echo "Error: no test specified" && exit 1') {
      steps.push(runStep('npm test', 'npm test', workspacePath, 120000))
    }

    // Step 5: npm run lint (if available)
    if (scripts.lint) {
      steps.push(runStep('npm run lint', 'npm run lint', workspacePath, 60000))
    }
  }

  return buildSummary(steps)
}

/**
 * Build a summary from step results.
 */
function buildSummary(steps: BuildStep[]): BuildResult {
  const allPassed = steps.every((s) => s.success)

  const lines = steps.map((s) => {
    const icon = s.success ? '✅' : '❌'
    const duration = (s.duration / 1000).toFixed(1)
    return [
      `${icon} ${s.name} (${duration}s)`,
      `  Komento: ${s.command}`,
      s.success ? '' : `  Virhe:\n${s.output.split('\n').map(l => `    ${l}`).join('\n')}`,
    ].filter(Boolean).join('\n')
  })

  const summary = [
    `BUILD-VERIFIKAATIO: ${allPassed ? 'KAIKKI OK' : 'VIRHEITÄ LÖYTYI'}`,
    '',
    ...lines,
  ].join('\n')

  return { success: allPassed, steps, summary }
}
