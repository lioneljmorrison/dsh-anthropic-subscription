import type { Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'
import { MAX_TIMER_DELAY_MS } from '@deepseek-ai/dsh-timeout'
import { ClaudeAdapter } from './adapter.js'

export const name = 'dsh-anthropic-subscription'
export const inject = ['llm']

export interface Config {
  provider: string
  executable: string
  cwd: string
  streamIdleTimeoutMs: number
  maxPromptBytes: number
}

export const Config: Schema<Config> = Schema.object({
  provider: Schema.string().default('claude-subscription'),
  executable: Schema.string().default('claude'),
  cwd: Schema.string().default(process.cwd()),
  streamIdleTimeoutMs: Schema.number().min(1).max(MAX_TIMER_DELAY_MS).default(300_000),
  maxPromptBytes: Schema.number().min(1_024).default(2_000_000),
})

export function apply(ctx: Context, config: Config): void {
  const adapter = new ClaudeAdapter(config.provider, {
    executable: config.executable,
    cwd: config.cwd,
    streamIdleTimeoutMs: config.streamIdleTimeoutMs,
    maxPromptBytes: config.maxPromptBytes,
  })
  ctx.effect(() => ctx.llm.registerAdapter([config.provider], adapter))
}
