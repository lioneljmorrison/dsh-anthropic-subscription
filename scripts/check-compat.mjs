import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { isSupportedClaudeVersion, missingClaudeFlags, parseClaudeVersion } from '../lib/compat.js'

const run = promisify(execFile)
const executable = process.env.CLAUDE_PATH || 'claude'
try {
  const versionResult = await run(executable, ['--version'], { maxBuffer: 64 * 1024 })
  const version = parseClaudeVersion(`${versionResult.stdout}\n${versionResult.stderr}`)
  if (version === undefined || !isSupportedClaudeVersion(version)) throw new Error('unsupported Claude Code version')
  const helpResult = await run(executable, ['--help'], { maxBuffer: 256 * 1024 })
  const missing = missingClaudeFlags(`${helpResult.stdout}\n${helpResult.stderr}`)
  if (missing.length > 0) throw new Error(`Claude Code is missing required flags: ${missing.join(', ')}`)
  console.log(`Claude Code compatibility OK (${version.major}.${version.minor}.${version.patch})`)
} catch (error) {
  console.error(`Claude Code compatibility check failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}
