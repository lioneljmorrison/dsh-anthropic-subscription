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
    expect((await adapter.listModels('claude-subscription')).map(model => model.id)).toEqual([
      'fable', 'claude-fable-5-1', 'claude-fable-5',
      'opus', 'claude-opus-5', 'claude-opus-4-8', 'claude-opus-4-7', 'claude-opus-4-6',
      'sonnet', 'claude-sonnet-5', 'claude-sonnet-4-6',
      'haiku', 'claude-haiku-4-5-20251001',
    ])
    expect((await adapter.listModels('claude-subscription')).every(model => model.inputModalities?.join() === 'text')).toBe(true)
  })

  it('accepts full Claude model ids and rejects unrelated names', async () => {
    await expect(adapter.resolveModel('claude-subscription', 'claude-sonnet-5')).resolves.toMatchObject({ id: 'claude-sonnet-5' })
    await expect(adapter.resolveModel('claude-subscription', 'gpt-5')).rejects.toMatchObject({ failure: { code: 'UNKNOWN_MODEL' } })
  })

  it('only advertises reasoning for thinking-capable models', async () => {
    await expect(adapter.resolveModel('claude-subscription', 'claude-sonnet-5')).resolves.toMatchObject({
      reasoning: { efforts: expect.arrayContaining([expect.objectContaining({ id: 'medium' })]) },
    })
    await expect(adapter.resolveModel('claude-subscription', 'claude-haiku-4-5-20251001')).resolves.not.toHaveProperty('reasoning')
  })
})
