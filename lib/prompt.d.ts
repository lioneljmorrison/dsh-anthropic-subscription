import type { GenerateOptions } from '@deepseek-ai/dsh-llm';
/** Render a complete DSH request into the one text turn accepted by Claude stream-json input. */
export declare function renderPrompt(options: GenerateOptions): string;
