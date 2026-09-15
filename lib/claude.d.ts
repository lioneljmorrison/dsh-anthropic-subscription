import type { GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm';
export interface ClaudeRunConfig {
    executable: string;
    cwd: string;
    streamIdleTimeoutMs: number;
    maxPromptBytes: number;
}
/** Map common Claude CLI prose into DSH routing failures without inspecting credentials. */
export declare function classifyClaudeFailure(message: string): 'AUTHENTICATION' | 'RATE_LIMIT' | 'UNKNOWN_MODEL' | 'PROVIDER_ERROR';
export declare function continuationRequest(options: GenerateOptions): {
    options: GenerateOptions;
    sessionId: string | undefined;
    resume: boolean;
};
/** Run one isolated Claude Code print-mode request and translate its JSONL stream. */
export declare function runClaude(options: GenerateOptions, config: ClaudeRunConfig): AsyncIterable<StreamChunk>;
