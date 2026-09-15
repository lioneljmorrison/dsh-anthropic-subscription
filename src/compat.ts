export const REQUIRED_CLAUDE_FLAGS = [
  '--output-format',
  '--include-partial-messages',
  '--permission-prompts',
  '--no-session-persistence',
  '--strict-mcp-config',
  '--mcp-config',
  '--system-prompt-file',
] as const

export interface ClaudeVersion {
  major: number
  minor: number
  patch: number
}

export function parseClaudeVersion(output: string): ClaudeVersion | undefined {
  const match = output.match(/\b(\d+)\.(\d+)\.(\d+)\b/)
  if (match === null) return undefined
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) }
}

export function isSupportedClaudeVersion(version: ClaudeVersion): boolean {
  return version.major >= 2
}

export function missingClaudeFlags(help: string): string[] {
  return REQUIRED_CLAUDE_FLAGS.filter(flag => {
    if (flag === '--system-prompt-file') return !help.includes(flag) && !help.includes('--system-prompt[-file]')
    return !help.includes(flag)
  })
}
