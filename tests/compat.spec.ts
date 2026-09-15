import { describe, expect, it } from 'vitest'
import { REQUIRED_CLAUDE_FLAGS, isSupportedClaudeVersion, missingClaudeFlags, parseClaudeVersion } from '../src/compat.js'

describe('Claude Code compatibility checks', () => {
  it('parses the official version format and requires major version 2 or newer', () => {
    expect(parseClaudeVersion('2.1.271 (Claude Code)')).toEqual({ major: 2, minor: 1, patch: 271 })
    expect(parseClaudeVersion('Claude Code')).toBeUndefined()
    expect(isSupportedClaudeVersion({ major: 1, minor: 9, patch: 9 })).toBe(false)
    expect(isSupportedClaudeVersion({ major: 2, minor: 0, patch: 0 })).toBe(true)
  })

  it('identifies missing transport flags without exposing command output', () => {
    expect(missingClaudeFlags(`${REQUIRED_CLAUDE_FLAGS.filter(flag => flag !== '--system-prompt-file').join(' ')} --system-prompt[-file]`)).toEqual([])
    expect(missingClaudeFlags('--output-format --mcp-config')).toEqual(expect.arrayContaining([
      '--include-partial-messages', '--system-prompt-file',
    ]))
  })
})
