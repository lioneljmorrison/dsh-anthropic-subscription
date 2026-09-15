import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'
import type { GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm'
import { LlmError } from '@deepseek-ai/dsh-llm'
import { renderPrompt } from './prompt.js'

export interface ClaudeRunConfig {
  executable: string
  cwd: string
  streamIdleTimeoutMs: number
}

type JsonObject = Record<string, unknown>

function object(value: unknown): JsonObject | undefined {
  return typeof value === 'object' && value !== null ? value as JsonObject : undefined
}

function number(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function cleanEnvironment(): NodeJS.ProcessEnv {
  const env = { ...process.env }
  delete env.ANTHROPIC_API_KEY
  delete env.ANTHROPIC_AUTH_TOKEN
  return env
}

function finishKind(reason: unknown): 'stop' | 'max-tokens' {
  return reason === 'max_tokens' ? 'max-tokens' : 'stop'
}

/** Run one isolated Claude Code print-mode request and translate its JSONL stream. */
export async function* runClaude(options: GenerateOptions, config: ClaudeRunConfig): AsyncIterable<StreamChunk> {
  if (options.stop !== undefined) {
    throw new LlmError('Claude CLI transport does not support stop sequences', 'UNSUPPORTED_OPTION')
  }
  options.signal?.throwIfAborted()
  const args = [
    '--print',
    '--output-format', 'stream-json',
    '--verbose',
    '--include-partial-messages',
    '--safe-mode',
    '--permission-prompts', 'none',
    '--tools', '',
    '--no-session-persistence',
    '--model', options.model,
    '--max-turns', '1',
  ]
  if (options.reasoningEffort !== undefined && options.reasoningEffort !== 'off') {
    args.push('--effort', String(options.reasoningEffort))
  }

  const child = spawn(config.executable, args, {
    cwd: config.cwd,
    env: cleanEnvironment(),
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  const exit = new Promise<number | null>((resolve, reject) => {
    child.once('error', reject)
    child.once('close', resolve)
  })
  let stderr = ''
  child.stderr.setEncoding('utf8')
  child.stderr.on('data', chunk => { stderr = (stderr + String(chunk)).slice(-8192) })
  const abort = () => child.kill('SIGTERM')
  options.signal?.addEventListener('abort', abort, { once: true })
  child.stdin.end(renderPrompt(options))

  const blocks = new Map<number, { type: 'text' | 'reasoning'; text: string }>()
  let usage: { inputTokens: number; outputTokens: number } | undefined
  let stopReason: unknown = 'end_turn'
  let resultError: string | undefined
  let timer: NodeJS.Timeout | undefined
  let timedOut = false
  const resetTimer = () => {
    if (timer !== undefined) clearTimeout(timer)
    timer = setTimeout(() => {
      timedOut = true
      child.kill('SIGTERM')
    }, config.streamIdleTimeoutMs)
    timer.unref()
  }
  resetTimer()

  try {
    const lines = createInterface({ input: child.stdout, crlfDelay: Infinity })
    for await (const line of lines) {
      resetTimer()
      if (line.trim().length === 0) continue
      let envelope: JsonObject
      try {
        envelope = object(JSON.parse(line)) ?? {}
      } catch (error: unknown) {
        throw new LlmError('Claude CLI emitted invalid JSON', 'PROVIDER_ERROR', { cause: error })
      }
      if (envelope.type === 'stream_event') {
        const event = object(envelope.event)
        if (event?.type === 'content_block_start') {
          const index = number(event.index)
          const content = object(event.content_block)
          const type = content?.type === 'thinking' ? 'reasoning' : content?.type === 'text' ? 'text' : undefined
          if (type !== undefined) {
            blocks.set(index, { type, text: '' })
            yield { type: 'block-start', index, blockType: type }
          }
        } else if (event?.type === 'content_block_delta') {
          const index = number(event.index)
          const delta = object(event.delta)
          const block = blocks.get(index)
          const text = typeof delta?.text === 'string'
            ? delta.text
            : typeof delta?.thinking === 'string' ? delta.thinking : ''
          if (block !== undefined && text.length > 0) {
            block.text += text
            yield block.type === 'text'
              ? { type: 'text-delta', index, text }
              : { type: 'reasoning-delta', index, text }
          }
        } else if (event?.type === 'content_block_stop') {
          const index = number(event.index)
          const block = blocks.get(index)
          if (block !== undefined) {
            yield { type: 'block-end', index, block: { type: block.type, text: block.text } }
          }
        } else if (event?.type === 'message_delta') {
          const delta = object(event.delta)
          stopReason = delta?.stop_reason
          const rawUsage = object(event.usage)
          usage = {
            inputTokens: number(rawUsage?.input_tokens) + number(rawUsage?.cache_creation_input_tokens) + number(rawUsage?.cache_read_input_tokens),
            outputTokens: number(rawUsage?.output_tokens),
          }
        }
      } else if (envelope.type === 'result' && envelope.is_error === true) {
        resultError = typeof envelope.result === 'string' ? envelope.result : 'Claude CLI request failed'
      }
    }

    const exitCode = await exit
    if (options.signal?.aborted) throw new LlmError('Claude request aborted by caller', 'ABORTED')
    if (timedOut) throw new LlmError(`Claude stream idle timeout after ${config.streamIdleTimeoutMs}ms`, 'TIMEOUT')
    if (resultError !== undefined || exitCode !== 0) {
      throw new LlmError(resultError ?? `Claude CLI exited with code ${String(exitCode)}: ${stderr}`, 'PROVIDER_ERROR')
    }
    if (usage !== undefined) yield { type: 'usage', usage }
    yield { type: 'finish', reason: { kind: finishKind(stopReason) } }
  } finally {
    if (timer !== undefined) clearTimeout(timer)
    options.signal?.removeEventListener('abort', abort)
    if (child.exitCode === null) child.kill('SIGTERM')
  }
}
