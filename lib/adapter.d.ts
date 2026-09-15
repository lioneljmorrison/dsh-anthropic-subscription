import { LlmAdapter } from '@deepseek-ai/dsh-llm';
import type { GenerateOptions, LlmModelInfo, LlmProviderInfo, LlmResolvedModelInfo, StreamChunk } from '@deepseek-ai/dsh-llm';
export interface ClaudeAdapterConfig {
    executable: string;
    cwd: string;
    streamIdleTimeoutMs: number;
}
export declare class ClaudeAdapter extends LlmAdapter {
    private readonly provider;
    private readonly config;
    constructor(provider: string, config: ClaudeAdapterConfig);
    providerInfo(): LlmProviderInfo;
    listModels(provider: string): Promise<readonly LlmModelInfo[]>;
    resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo>;
    stream(options: GenerateOptions): AsyncIterable<StreamChunk>;
}
