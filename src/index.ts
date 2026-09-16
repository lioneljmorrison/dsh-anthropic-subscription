import type { Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'
import { MAX_TIMER_DELAY_MS } from '@deepseek-ai/dsh-timeout'
import { ClaudeAdapter } from './adapter.js'

export const name = 'dsh-anthropic-subscription'
export const inject = ['llm']
export const settingsNamespace = name

export interface Config {
  provider: string
  executable: string
  cwd: string
  streamIdleTimeoutMs: number
  maxPromptBytes: number
  maxToolResultBytes: number
}

export const Config: Schema<Config> = Schema.object({
  provider: Schema.string().default('claude-subscription'),
  executable: Schema.string().default('claude'),
  cwd: Schema.string().default(process.cwd()),
  streamIdleTimeoutMs: Schema.number().min(1).max(MAX_TIMER_DELAY_MS).default(300_000),
  maxPromptBytes: Schema.number().min(16_384).default(600_000),
  maxToolResultBytes: Schema.number().min(1_024).default(12_000),
})

export function apply(ctx: Context, config: Config): void {
  const adapter = new ClaudeAdapter(config.provider, {
    executable: config.executable,
    cwd: config.cwd,
    streamIdleTimeoutMs: config.streamIdleTimeoutMs,
    maxPromptBytes: config.maxPromptBytes,
    maxToolResultBytes: config.maxToolResultBytes,
  })
  const unregisterDirectory = ctx.llm.registerConfigurableProviders([{
    provider: config.provider,
    displayName: 'Anthropic Subscription',
    settingsNs: settingsNamespace,
    settingsPath: [],
  }])
  // Keep the directory registration in the same lifecycle as DSH's built-in
  // LLM providers. The LLM registry owns its removal with the plugin context.
  void unregisterDirectory
  ctx.effect(() => ctx.llm.registerAdapter([config.provider], adapter))
  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.get('settings').installSection(ctx, settingsNamespace, Config, config, {
      setSource: () => {},
      onChange: () => {},
    })
  })
}
