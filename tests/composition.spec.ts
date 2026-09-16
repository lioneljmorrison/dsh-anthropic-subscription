import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Include from '@deepseek-ai/cordis-plugin-include'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import LlmRuntime, { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { StreamChunk } from '@deepseek-ai/dsh-llm'
import * as plugin from '../lib/index.js'

let root: string | undefined
let context: Context | undefined

afterEach(async () => {
  await context?.fiber.dispose()
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
  context = undefined
})

describe('DSH composition', () => {
  it('registers the Claude subscription provider and models', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-anthropic-composition-'))
    const fakeClaude = join(root, 'fake-claude')
    await writeFile(fakeClaude, `#!/bin/sh
cat >/dev/null
printf '%s\\n' \\
  '{"type":"stream_event","event":{"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"toolu_composed","name":"mcp__dsh__echo_value","input":{}}}}' \\
  '{"type":"stream_event","event":{"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"{\\"value\\":\\"composed\\"}"}}}' \\
  '{"type":"stream_event","event":{"type":"content_block_stop","index":0}}' \\
  '{"type":"stream_event","event":{"type":"message_delta","delta":{"stop_reason":"tool_use"},"usage":{"input_tokens":1,"output_tokens":2}}}'
`)
    await chmod(fakeClaude, 0o755)
    const configPath = join(root, 'cordis.yml')
    await writeFile(configPath, [
      "- name: '@deepseek-ai/dsh-llm'",
      "- name: 'dsh-anthropic-subscription'",
      '  config:',
      '    provider: claude-subscription',
      `    executable: '${fakeClaude}'`,
      `    cwd: '${root}'`,
      '',
    ].join('\n'))

    context = new Context()
    context.baseUrl = pathToFileURL(root).href + '/'
    await context.plugin(Loader)
    context.loader.builtins.include = Include
    const modules = new Map<string, unknown>([
      ['@deepseek-ai/dsh-llm', LlmRuntime],
      ['dsh-anthropic-subscription', plugin],
    ])
    context.loader.internal = {
      version: 'v2',
      async import(specifier: string) {
        if (!modules.has(specifier)) throw new Error(`unexpected Loader import: ${specifier}`)
        return modules.get(specifier)
      },
    } as unknown as NonNullable<typeof context.loader.internal>
    await context.loader.create({ name: 'cordis:include', config: { path: pathToFileURL(configPath).href } })
    await context.loader.await()

    expect(context.llm.listProviders()).toContainEqual({ id: 'claude-subscription', name: 'Anthropic Subscription' })
    expect(context.llm.listConfigurableProviders()).toContainEqual({
      provider: 'claude-subscription',
      displayName: 'Anthropic Subscription',
      settingsNs: 'dsh-anthropic-subscription',
      settingsPath: [],
    })
    expect((await context.llm.listModels('claude-subscription')).map(model => model.id)).toContain('claude-fable-5-1')
    expect((await context.llm.listModels('claude-subscription')).map(model => model.id)).toContain('claude-opus-4-8')
    expect((await context.llm.listModels('claude-subscription')).map(model => model.id)).toContain('claude-sonnet-5')

    const chunks: StreamChunk[] = []
    for await (const chunk of context.llm.stream({
      provider: 'claude-subscription',
      model: 'sonnet',
      messages: [createUserMessage({ content: [{ type: 'text', text: 'use echo' }], source: { kind: 'user' } })],
      tools: [{
        name: 'echo_value',
        description: 'Echo a value',
        parameters: { type: 'object', properties: { value: { type: 'string' } } },
      }],
    })) chunks.push(chunk)
    expect(chunks).toContainEqual({
      type: 'tool-call-delta', index: 0, id: 'toolu_composed', name: 'echo_value', argumentsDelta: '{"value":"composed"}',
    })
    expect(chunks.at(-1)).toEqual({ type: 'finish', reason: { kind: 'tool-calls' } })
  })
})
