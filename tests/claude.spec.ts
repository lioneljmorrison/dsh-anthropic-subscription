import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm'
import { runClaude } from '../src/claude.js'

let root: string
let executable: string

const fakeCli = `#!/bin/sh
case " $* " in *" hang "*) exec sleep 60;; esac
[ -z "$ANTHROPIC_API_KEY" ] || exit 9
[ -z "$ANTHROPIC_AUTH_TOKEN" ] || exit 9
prompt=$(cat)
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
  it('streams text, usage, and a terminal finish through the fake CLI', async () => {
    process.env.ANTHROPIC_API_KEY = 'must-not-reach-child'
    process.env.ANTHROPIC_AUTH_TOKEN = 'must-not-reach-child'
    try {
      const chunks: StreamChunk[] = []
      for await (const chunk of runClaude(request(), { executable, cwd: root, streamIdleTimeoutMs: 5_000 })) chunks.push(chunk)
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
      })) { /* consume */ }
    }).rejects.toMatchObject({ failure: { code: 'ABORTED' } })
  })
})
