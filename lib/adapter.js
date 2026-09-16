import { LlmAdapter, LlmError, ReasoningEffortId } from '@deepseek-ai/dsh-llm';
import { runClaude } from './claude.js';
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
];
const REASONING_EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];
export class ClaudeAdapter extends LlmAdapter {
    provider;
    config;
    constructor(provider, config) {
        super();
        this.provider = provider;
        this.config = config;
    }
    providerInfo() {
        return { id: this.provider, name: 'Anthropic Subscription' };
    }
    listModels(provider) {
        return Promise.resolve(MODELS.map(({ id, name }) => ({ id, name, provider, inputModalities: ['text'] })));
    }
    resolveModel(provider, model) {
        const known = MODELS.find(candidate => candidate.id === model);
        if (known === undefined && !model.startsWith('claude-')) {
            return Promise.reject(new LlmError(`Claude Code has no configured model "${model}"`, 'UNKNOWN_MODEL'));
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
        });
    }
    stream(options) {
        return runClaude(options, this.config);
    }
}
//# sourceMappingURL=adapter.js.map