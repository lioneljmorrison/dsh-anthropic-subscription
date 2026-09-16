import type { Context } from '@deepseek-ai/cordis';
import Schema from '@deepseek-ai/schemastery';
export declare const name = "dsh-anthropic-subscription";
export declare const inject: string[];
export declare const settingsNamespace = "dsh-anthropic-subscription";
export interface Config {
    provider: string;
    executable: string;
    cwd: string;
    streamIdleTimeoutMs: number;
    maxPromptBytes: number;
    maxToolResultBytes: number;
}
export declare const Config: Schema<Config>;
export declare function apply(ctx: Context, config: Config): void;
