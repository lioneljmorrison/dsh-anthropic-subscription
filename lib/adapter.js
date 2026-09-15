import { LlmAdapter, LlmError, ReasoningEffortId } from '@deepseek-ai/dsh-llm';
import { runClaude } from './claude.js';
const MODELS = [
    { id: 'sonnet', name: 'Claude Sonnet' },
    { id: 'opus', name: 'Claude Opus' },
    { id: 'haiku', name: 'Claude Haiku' },
];
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
        return Promise.resolve(MODELS.map(model => ({ ...model, provider, inputModalities: ['text'] })));
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
            reasoning: {
                efforts: ['low', 'medium', 'high', 'xhigh', 'max'].map(value => ({
                    id: ReasoningEffortId(value),
                    name: value.charAt(0).toUpperCase() + value.slice(1),
                })),
            },
        });
    }
    stream(options) {
        return runClaude(options, this.config);
    }
}
//# sourceMappingURL=adapter.js.map