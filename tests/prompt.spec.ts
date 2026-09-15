import { describe, expect, it } from 'vitest'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { renderPrompt } from '../src/prompt.js'

describe('renderPrompt', () => {
  it('preserves the system text and ordered messages', () => {
    const rendered = renderPrompt({
      provider: 'claude-subscription',
      model: 'sonnet',
      system: 'be concise',
      messages: [createUserMessage({ content: [{ type: 'text', text: 'hello' }], source: { kind: 'user' } })],
    })
    expect(rendered).toContain('<system>\nbe concise\n</system>')
    expect(rendered).toContain('<user>\nhello\n</user>')
  })
})
