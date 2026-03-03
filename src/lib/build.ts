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
        // Ensure node/npm/python are available for deploy user
        PATH: [
          '/usr/local/bin',
          '/usr/bin',
          '/bin',
          process.env.PATH ?? '',
        ].filter(Boolean).join(':'),
        // Use project venv python if available
        VIRTUAL_ENV: existsSync(path.join(workspacePath, '.venv'))
          ? path.join(workspacePath, '.venv')
          : (process.env.VIRTUAL_ENV ?? ''),
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
 * Find the actual project root within a workspace.
 * The AI agent may create the project in a subdirectory (e.g., polymarket-hedge-bot/).
 * Check the workspace root first, then immediate subdirectories.
 */
function findProjectRoot(workspacePath: string): { root: string; type: 'node' | 'python' | 'go' | 'unknown' } {
  // Check workspace root first
  if (existsSync(path.join(workspacePath, 'package.json'))) return { root: workspacePath, type: 'node' }
  if (existsSync(path.join(workspacePath, 'requirements.txt')) || existsSync(path.join(workspacePath, 'pyproject.toml'))) return { root: workspacePath, type: 'python' }
  if (existsSync(path.join(workspacePath, 'go.mod'))) return { root: workspacePath, type: 'go' }

  // Check immediate subdirectories
  try {
    const { readdirSync, statSync } = require('node:fs')
    const entries = readdirSync(workspacePath) as string[]
    for (const entry of entries) {
      if (entry.startsWith('.')) continue
      const subdir = path.join(workspacePath, entry)
      try { if (!statSync(subdir).isDirectory()) continue } catch { continue }

      if (existsSync(path.join(subdir, 'package.json'))) return { root: subdir, type: 'node' }
      if (existsSync(path.join(subdir, 'requirements.txt')) || existsSync(path.join(subdir, 'pyproject.toml'))) return { root: subdir, type: 'python' }
      if (existsSync(path.join(subdir, 'go.mod'))) return { root: subdir, type: 'go' }
    }
  } catch { /* ignore readdir errors */ }

  return { root: workspacePath, type: 'unknown' }
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
  const project = findProjectRoot(workspacePath)

  if (project.root !== workspacePath) {
    console.log(`[Build] Projekti löytyi alihakemistosta: ${path.basename(project.root)}`)
  }

  if (project.type === 'python') {
    // Python project — run pip install and pytest
    const hasPyproject = existsSync(path.join(project.root, 'pyproject.toml'))
    const hasRequirements = existsSync(path.join(project.root, 'requirements.txt'))

    if (hasPyproject) {
      steps.push(runStep('pip install', 'python3 -m pip install -e ".[dev]" 2>/dev/null || python3 -m pip install -e . 2>/dev/null || pip install -r requirements.txt 2>/dev/null || true', project.root))
    } else if (hasRequirements) {
      steps.push(runStep('pip install', 'pip install -r requirements.txt 2>/dev/null || python3 -m pip install -r requirements.txt 2>/dev/null || true', project.root))
    }

    // Run pytest if tests exist
    const hasTests = existsSync(path.join(project.root, 'tests'))
    if (hasTests) {
      steps.push(runStep('pytest', 'python3 -m pytest tests/ -v --tb=short 2>&1 || pytest tests/ -v --tb=short 2>&1', project.root, 180000))
    }

    return buildSummary(steps)
  } else if (project.type === 'go') {
    steps.push(runStep('go build', 'go build ./...', project.root))
    steps.push(runStep('go test', 'go test ./...', project.root))
    return buildSummary(steps)
  } else if (project.type === 'unknown') {
    // No recognizable project — skip build verification
    return {
      success: true,
      steps: [],
      summary: 'Ei package.json tai muuta tunnistettavaa projektityyppiä — build-verifikaatio ohitettu.',
    }
  }

  // Node.js project
  const pkgPath = path.join(project.root, 'package.json')
  if (!existsSync(pkgPath)) {
    return {
      success: true,
      steps: [],
      summary: 'Ei package.json tai muuta tunnistettavaa projektityyppiä — build-verifikaatio ohitettu.',
    }
  } else {
    // Node.js project
    const scripts = getScripts(project.root)

    // Step 1: npm install
    steps.push(runStep('npm install', 'npm install', project.root, 180000))

    if (!steps[steps.length - 1].success) {
      // If install fails, don't try to build/test
      return buildSummary(steps)
    }

    // Step 2: TypeScript check (if tsconfig exists)
    if (existsSync(path.join(project.root, 'tsconfig.json'))) {
      steps.push(runStep('tsc --noEmit', 'npx tsc --noEmit', project.root, 60000))
    }

    // Step 3: npm run build (if available)
    if (scripts.build) {
      steps.push(runStep('npm run build', 'npm run build', project.root, 120000))
    }

    // Step 4: npm test (if available)
    if (scripts.test && scripts.test !== 'echo "Error: no test specified" && exit 1') {
      steps.push(runStep('npm test', 'npm test', project.root, 120000))
    }

    // Step 5: npm run lint (if available)
    if (scripts.lint) {
      steps.push(runStep('npm run lint', 'npm run lint', project.root, 60000))
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
