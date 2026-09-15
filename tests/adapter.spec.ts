import { describe, expect, it } from 'vitest'
import { ClaudeAdapter } from '../src/adapter.js'

describe('ClaudeAdapter metadata', () => {
  const adapter = new ClaudeAdapter('claude-subscription', {
    executable: 'claude',
    cwd: '/tmp',
    streamIdleTimeoutMs: 1_000,
    maxPromptBytes: 2_000_000,
  })

  it('advertises the subscription provider and model aliases', async () => {
    expect(adapter.providerInfo()).toEqual({ id: 'claude-subscription', name: 'Anthropic Subscription' })
    expect((await adapter.listModels('claude-subscription')).map(model => model.id)).toEqual(['sonnet', 'opus', 'haiku'])
    expect((await adapter.listModels('claude-subscription')).every(model => model.inputModalities?.join() === 'text')).toBe(true)
  })

  it('accepts full Claude model ids and rejects unrelated names', async () => {
    await expect(adapter.resolveModel('claude-subscription', 'claude-sonnet-5')).resolves.toMatchObject({ id: 'claude-sonnet-5' })
    await expect(adapter.resolveModel('claude-subscription', 'gpt-5')).rejects.toMatchObject({ failure: { code: 'UNKNOWN_MODEL' } })
  })
})
