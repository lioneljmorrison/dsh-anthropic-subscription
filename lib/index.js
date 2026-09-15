import Schema from '@deepseek-ai/schemastery';
import { MAX_TIMER_DELAY_MS } from '@deepseek-ai/dsh-timeout';
import { ClaudeAdapter } from './adapter.js';
export const name = 'dsh-anthropic-subscription';
export const inject = ['llm'];
export const Config = Schema.object({
    provider: Schema.string().default('claude-subscription'),
    executable: Schema.string().default('claude'),
    cwd: Schema.string().default(process.cwd()),
    streamIdleTimeoutMs: Schema.number().min(1).max(MAX_TIMER_DELAY_MS).default(300_000),
});
export function apply(ctx, config) {
    const adapter = new ClaudeAdapter(config.provider, {
        executable: config.executable,
        cwd: config.cwd,
        streamIdleTimeoutMs: config.streamIdleTimeoutMs,
    });
    ctx.effect(() => ctx.llm.registerAdapter([config.provider], adapter));
}
//# sourceMappingURL=index.js.map