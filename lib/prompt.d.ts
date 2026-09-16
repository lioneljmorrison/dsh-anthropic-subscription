import type { GenerateOptions } from '@deepseek-ai/dsh-llm';
export interface PreparedPrompt {
    prompt: string;
    system: string | undefined;
    omittedMessages: number;
}
export declare function systemText(options: GenerateOptions): string | undefined;
/** Serialize complete DSH history as ordered JSONL records within a fixed request budget. */
export declare function preparePrompt(options: GenerateOptions, maxPromptBytes: number, maxToolResultBytes?: number): PreparedPrompt;
export declare function renderPrompt(options: GenerateOptions): string;
