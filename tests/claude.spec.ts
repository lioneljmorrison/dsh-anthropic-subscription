import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createAssistantMessage, createUserMessage } from '@deepseek-ai/dsh-llm'
import type { GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm'
import { classifyClaudeFailure, continuationRequest, runClaude } from '../src/claude.js'

let root: string
let executable: string

const fakeCli = `#!/bin/sh
case " $* " in *" hang "*) exec sleep 60;; esac
[ -z "$ANTHROPIC_API_KEY" ] || exit 9
[ -z "$ANTHROPIC_AUTH_TOKEN" ] || exit 9
prompt=$(cat)
case "$prompt" in *USE_EMPTY*)
  printf '%s\\n' \\
    '{"type":"stream_event","event":{"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"toolu_empty","name":"mcp__dsh__empty_tool","input":{}}}}' \\
    '{"type":"stream_event","event":{"type":"content_block_stop","index":0}}' \\
    '{"type":"stream_event","event":{"type":"message_delta","delta":{"stop_reason":"tool_use"},"usage":{"input_tokens":1,"output_tokens":1}}}'
  exit 0
;; esac
case "$prompt" in *USE_TOOL*)
  printf '%s\\n' \\
    '{"type":"stream_event","event":{"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"toolu_123","name":"mcp__dsh__echo_value","input":{}}}}' \\
    '{"type":"stream_event","event":{"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"{\\"value\\":\\"hello\\"}"}}}' \\
    '{"type":"stream_event","event":{"type":"content_block_stop","index":0}}' \\
    '{"type":"stream_event","event":{"type":"message_delta","delta":{"stop_reason":"tool_use"},"usage":{"input_tokens":2,"output_tokens":4}}}'
  exit 0
;; esac
case "$prompt" in *hello*) text='fake response';; *) text='unexpected prompt';; esac
printf '%s\\n' \\
  '{"type":"stream_event","event":{"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}}' \\
  "{\\"type\\":\\"stream_event\\",\\"event\\":{\\"type\\":\\"content_block_delta\\",\\"index\\":0,\\"delta\\":{\\"type\\":\\"text_delta\\",\\"text\\":\\"$text\\"}}}" \\
  '{"type":"stream_event","event":{"type":"content_block_stop","index":0}}' \\
  '{"type":"stream_event","event":{"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"input_tokens":2,"cache_read_input_tokens":3,"output_tokens":4}}}' \\
  "{\\"type\\":\\"result\\",\\"subtype\\":\\"success\\",\\"is_error\\":false,\\"result\\":\\"$text\\"}"
`

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'dsh-claude-provider-'))
  executable = join(root, 'fake-claude')
  await writeFile(executable, fakeCli)
  await chmod(executable, 0o755)
})

afterEach(async () => rm(root, { recursive: true, force: true }))

function request(model = 'sonnet', signal?: AbortSignal): GenerateOptions {
  return {
    provider: 'claude-subscription',
    model,
    messages: [createUserMessage({ content: [{ type: 'text', text: 'hello' }], source: { kind: 'user' } })],
    signal,
  }
}

describe('runClaude', () => {
  it('classifies common CLI failures for DSH retry and routing policy', () => {
    expect(classifyClaudeFailure('Please login again; authentication expired')).toBe('AUTHENTICATION')
    expect(classifyClaudeFailure('weekly usage limit reached; try again later')).toBe('RATE_LIMIT')
    expect(classifyClaudeFailure('unknown model claude-future')).toBe('UNKNOWN_MODEL')
    expect(classifyClaudeFailure('unexpected subprocess failure')).toBe('PROVIDER_ERROR')
  })
  it('resumes from adapter replay state and sends only messages after that turn', () => {
    const prior = createAssistantMessage({
      content: [{ type: 'text', text: 'prior answer' }],
      source: {
        provider: 'claude-subscription',
        model: 'sonnet',
        replayState: { response: {
          transport: 'claude-cli-session',
          sessionId: '11111111-1111-4111-8111-111111111111',
          systemFingerprint: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        } },
      },
    })
    const current = request()
    current.sessionId = 'dsh-session' as GenerateOptions['sessionId']
    current.messages = [createUserMessage({ content: [{ type: 'text', text: 'old turn' }], source: { kind: 'user' } }), prior, ...current.messages]
    const continuation = continuationRequest(current)
    expect(continuation.resume).toBe(true)
    expect(continuation.sessionId).toBe('11111111-1111-4111-8111-111111111111')
    expect(continuation.options.messages).toHaveLength(1)
    expect(continuation.options.messages[0]?.content).toEqual([{ type: 'text', text: 'hello' }])
  })

  it('starts a fresh native session when system instructions change', () => {
    const prior = createAssistantMessage({
      content: [{ type: 'text', text: 'prior answer' }],
      source: {
        provider: 'claude-subscription', model: 'sonnet',
        replayState: { response: {
          transport: 'claude-cli-session', sessionId: '11111111-1111-4111-8111-111111111111',
          systemFingerprint: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        } },
      },
    })
    const current = request()
    current.sessionId = 'dsh-session' as GenerateOptions['sessionId']
    current.system = 'updated policy'
    current.messages = [request().messages[0]!, prior, ...current.messages]
    const continuation = continuationRequest(current)
    expect(continuation.resume).toBe(false)
    expect(continuation.options.messages).toHaveLength(3)
    expect(continuation.sessionId).not.toBe('11111111-1111-4111-8111-111111111111')
  })

  it('streams text, usage, and a terminal finish through the fake CLI', async () => {
    process.env.ANTHROPIC_API_KEY = 'must-not-reach-child'
    process.env.ANTHROPIC_AUTH_TOKEN = 'must-not-reach-child'
    try {
      const chunks: StreamChunk[] = []
      for await (const chunk of runClaude(request(), { executable, cwd: root, streamIdleTimeoutMs: 5_000, maxPromptBytes: 2_000_000 })) chunks.push(chunk)
      expect(chunks).toEqual([
        { type: 'block-start', index: 0, blockType: 'text' },
        { type: 'text-delta', index: 0, text: 'fake response' },
        { type: 'block-end', index: 0, block: { type: 'text', text: 'fake response' } },
        { type: 'usage', usage: { inputTokens: 5, outputTokens: 4 } },
        { type: 'finish', reason: { kind: 'stop' } },
      ])
    } finally {
      delete process.env.ANTHROPIC_API_KEY
      delete process.env.ANTHROPIC_AUTH_TOKEN
    }
  })

  it('kills the CLI and reports caller cancellation', async () => {
    const controller = new AbortController()
    setTimeout(() => controller.abort(), 50)
    await expect(async () => {
      for await (const _chunk of runClaude(request('hang', controller.signal), {
        executable,
        cwd: root,
        streamIdleTimeoutMs: 5_000,
        maxPromptBytes: 2_000_000,
      })) { /* consume */ }
    }).rejects.toMatchObject({ failure: { code: 'ABORTED' } })
  })

  it('maps Claude MCP tool use into a terminal DSH tool call', async () => {
    const chunks: StreamChunk[] = []
    const options = request()
    options.messages = [createUserMessage({ content: [{ type: 'text', text: 'USE_TOOL' }], source: { kind: 'user' } })]
    options.sessionId = 'dsh-session' as GenerateOptions['sessionId']
    options.tools = [{
      name: 'echo_value',
      description: 'Echo a value',
      parameters: { type: 'object', properties: { value: { type: 'string' } }, required: ['value'] },
    }]
    for await (const chunk of runClaude(options, { executable, cwd: root, streamIdleTimeoutMs: 5_000, maxPromptBytes: 2_000_000 })) chunks.push(chunk)
    expect(chunks).toContainEqual({
      type: 'tool-call-delta',
      index: 0,
      id: 'toolu_123',
      name: 'echo_value',
      argumentsDelta: '{"value":"hello"}',
    })
    expect(chunks.at(-1)).toEqual({ type: 'finish', reason: { kind: 'tool-calls' } })
  })

  it('emits valid empty JSON for an argumentless tool', async () => {
    const options = request()
    options.messages = [createUserMessage({ content: [{ type: 'text', text: 'USE_EMPTY' }], source: { kind: 'user' } })]
    options.tools = [{ name: 'empty_tool', description: 'No arguments', parameters: { type: 'object', properties: {} } }]
    const chunks: StreamChunk[] = []
    for await (const chunk of runClaude(options, { executable, cwd: root, streamIdleTimeoutMs: 5_000, maxPromptBytes: 2_000_000 })) chunks.push(chunk)
    expect(chunks).toContainEqual({
      type: 'tool-call-delta', index: 0, id: 'toolu_empty', name: 'empty_tool', argumentsDelta: '{}',
    })
  })
})
