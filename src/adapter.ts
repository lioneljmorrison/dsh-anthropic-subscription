import { LlmAdapter, LlmError, ReasoningEffortId } from '@deepseek-ai/dsh-llm'
import type { GenerateOptions, LlmModelInfo, LlmProviderInfo, LlmResolvedModelInfo, StreamChunk } from '@deepseek-ai/dsh-llm'
import { runClaude } from './claude.js'

/**
 * Claude Code accepts both rolling family aliases and pinned model ids. Keep
 * both in the host catalog so the Settings > Models picker can select either
 * the current family or a reproducible version.
 */
const MODELS = [
  { id: 'fable', name: 'Claude Fable (latest)', reasoning: true },
  { id: 'claude-fable-5-1', name: 'Claude Fable 5.1', reasoning: true },
  { id: 'claude-fable-5', name: 'Claude Fable 5', reasoning: true },
  { id: 'opus', name: 'Claude Opus (latest)', reasoning: true },
  { id: 'claude-opus-5', name: 'Claude Opus 5', reasoning: true },
  { id: 'claude-opus-4-8', name: 'Claude Opus 4.8', reasoning: true },
  { id: 'claude-opus-4-7', name: 'Claude Opus 4.7', reasoning: true },
  { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', reasoning: true },
  { id: 'sonnet', name: 'Claude Sonnet (latest)', reasoning: true },
  { id: 'claude-sonnet-5', name: 'Claude Sonnet 5', reasoning: true },
  { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', reasoning: true },
  { id: 'haiku', name: 'Claude Haiku (latest)', reasoning: false },
  { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', reasoning: false },
] as const

const REASONING_EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const

export interface ClaudeAdapterConfig {
  executable: string
  cwd: string
  streamIdleTimeoutMs: number
  maxPromptBytes: number
  maxToolResultBytes?: number
}

export class ClaudeAdapter extends LlmAdapter {
  constructor(private readonly provider: string, private readonly config: ClaudeAdapterConfig) {
    super()
  }

  override providerInfo(): LlmProviderInfo {
    return { id: this.provider, name: 'Anthropic Subscription' }
  }

  override listModels(provider: string): Promise<readonly LlmModelInfo[]> {
    return Promise.resolve(MODELS.map(({ id, name }) => ({ id, name, provider, inputModalities: ['text' as const] })))
  }

  override resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo> {
    const known = MODELS.find(candidate => candidate.id === model)
    if (known === undefined && !model.startsWith('claude-')) {
      return Promise.reject(new LlmError(`Claude Code has no configured model "${model}"`, 'UNKNOWN_MODEL'))
    }
    return Promise.resolve({
      provider,
      id: model,
      name: known?.name ?? model,
      inputModalities: ['text'],
      ...known?.reasoning ? { reasoning: {
        efforts: REASONING_EFFORTS.map(value => ({
          id: ReasoningEffortId(value),
          name: value.charAt(0).toUpperCase() + value.slice(1),
        })),
      } } : {},
    })
  }

  override stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    return runClaude(options, this.config)
  }
}
