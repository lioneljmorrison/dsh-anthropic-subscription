import { LlmAdapter, LlmError, ReasoningEffortId } from '@deepseek-ai/dsh-llm'
import type { GenerateOptions, LlmModelInfo, LlmProviderInfo, LlmResolvedModelInfo, StreamChunk } from '@deepseek-ai/dsh-llm'
import { runClaude } from './claude.js'

const MODELS = [
  { id: 'sonnet', name: 'Claude Sonnet' },
  { id: 'opus', name: 'Claude Opus' },
  { id: 'haiku', name: 'Claude Haiku' },
] as const

export interface ClaudeAdapterConfig {
  executable: string
  cwd: string
  streamIdleTimeoutMs: number
}

export class ClaudeAdapter extends LlmAdapter {
  constructor(private readonly provider: string, private readonly config: ClaudeAdapterConfig) {
    super()
  }

  override providerInfo(): LlmProviderInfo {
    return { id: this.provider, name: 'Anthropic Subscription' }
  }

  override listModels(provider: string): Promise<readonly LlmModelInfo[]> {
    return Promise.resolve(MODELS.map(model => ({ ...model, provider, inputModalities: ['text' as const] })))
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
      reasoning: {
        efforts: ['low', 'medium', 'high', 'xhigh', 'max'].map(value => ({
          id: ReasoningEffortId(value),
          name: value.charAt(0).toUpperCase() + value.slice(1),
        })),
      },
    })
  }

  override stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    return runClaude(options, this.config)
  }
}
