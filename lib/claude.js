import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { LlmError, ToolCallId } from '@deepseek-ai/dsh-llm';
import { renderPrompt } from './prompt.js';
function object(value) {
    return typeof value === 'object' && value !== null ? value : undefined;
}
function number(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
function cleanEnvironment() {
    const env = { ...process.env };
    delete env.ANTHROPIC_API_KEY;
    delete env.ANTHROPIC_AUTH_TOKEN;
    return env;
}
function finishKind(reason) {
    if (reason === 'max_tokens')
        return 'max-tokens';
    if (reason === 'tool_use')
        return 'tool-calls';
    return 'stop';
}
/** Run one isolated Claude Code print-mode request and translate its JSONL stream. */
export async function* runClaude(options, config) {
    if (options.stop !== undefined) {
        throw new LlmError('Claude CLI transport does not support stop sequences', 'UNSUPPORTED_OPTION');
    }
    options.signal?.throwIfAborted();
    let bridgeRoot;
    const args = [
        '--print',
        '--output-format', 'stream-json',
        '--verbose',
        '--include-partial-messages',
        '--permission-prompts', 'none',
        '--no-session-persistence',
        '--model', options.model,
        '--max-turns', '1',
    ];
    if (options.tools?.length) {
        bridgeRoot = await mkdtemp(join(tmpdir(), 'dsh-claude-mcp-'));
        const schemaPath = join(bridgeRoot, 'tools.json');
        const mcpPath = join(bridgeRoot, 'mcp.json');
        await writeFile(schemaPath, JSON.stringify({ tools: options.tools.map(tool => ({
                name: tool.name,
                description: tool.description,
                inputSchema: tool.parameters,
            })) }), { mode: 0o600 });
        await writeFile(mcpPath, JSON.stringify({ mcpServers: { dsh: {
                    type: 'stdio',
                    command: process.execPath,
                    args: [fileURLToPath(new URL('./mcp-server.js', import.meta.url)), schemaPath],
                } } }), { mode: 0o600 });
        args.push('--setting-sources', '', '--disable-slash-commands', '--no-chrome', '--strict-mcp-config', '--mcp-config', mcpPath);
        args.push('--tools', options.tools.map(tool => `mcp__dsh__${tool.name}`).join(','));
    }
    else {
        args.push('--safe-mode', '--tools', '');
    }
    if (options.reasoningEffort !== undefined && options.reasoningEffort !== 'off') {
        args.push('--effort', String(options.reasoningEffort));
    }
    const child = spawn(config.executable, args, {
        cwd: config.cwd,
        env: cleanEnvironment(),
        stdio: ['pipe', 'pipe', 'pipe'],
    });
    const exit = new Promise((resolve, reject) => {
        child.once('error', reject);
        child.once('close', resolve);
    });
    let stderr = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', chunk => { stderr = (stderr + String(chunk)).slice(-8192); });
    const abort = () => child.kill('SIGTERM');
    options.signal?.addEventListener('abort', abort, { once: true });
    child.stdin.end(renderPrompt(options));
    const blocks = new Map();
    let usage;
    let stopReason = 'end_turn';
    let resultError;
    let toolCallsRequested = false;
    let timer;
    let timedOut = false;
    const resetTimer = () => {
        if (timer !== undefined)
            clearTimeout(timer);
        timer = setTimeout(() => {
            timedOut = true;
            child.kill('SIGTERM');
        }, config.streamIdleTimeoutMs);
        timer.unref();
    };
    resetTimer();
    try {
        const lines = createInterface({ input: child.stdout, crlfDelay: Infinity });
        for await (const line of lines) {
            resetTimer();
            if (line.trim().length === 0)
                continue;
            let envelope;
            try {
                envelope = object(JSON.parse(line)) ?? {};
            }
            catch (error) {
                throw new LlmError('Claude CLI emitted invalid JSON', 'PROVIDER_ERROR', { cause: error });
            }
            if (envelope.type === 'stream_event') {
                const event = object(envelope.event);
                if (event?.type === 'content_block_start') {
                    const index = number(event.index);
                    const content = object(event.content_block);
                    const type = content?.type === 'thinking' ? 'reasoning' : content?.type === 'text' ? 'text' : undefined;
                    if (content?.type === 'tool_use' && typeof content.id === 'string' && typeof content.name === 'string') {
                        const name = content.name.startsWith('mcp__dsh__') ? content.name.slice('mcp__dsh__'.length) : content.name;
                        const id = ToolCallId(content.id);
                        const initialArguments = object(content.input) === undefined ? '{}' : JSON.stringify(content.input);
                        blocks.set(index, { type: 'tool-call', id, name, arguments: '', initialArguments });
                        yield { type: 'block-start', index, blockType: 'tool-call' };
                    }
                    else if (type !== undefined) {
                        blocks.set(index, { type, text: '' });
                        yield { type: 'block-start', index, blockType: type };
                    }
                }
                else if (event?.type === 'content_block_delta') {
                    const index = number(event.index);
                    const delta = object(event.delta);
                    const block = blocks.get(index);
                    const text = typeof delta?.text === 'string'
                        ? delta.text
                        : typeof delta?.thinking === 'string' ? delta.thinking : '';
                    const argumentsDelta = typeof delta?.partial_json === 'string' ? delta.partial_json : '';
                    if (block?.type === 'tool-call' && argumentsDelta.length > 0) {
                        block.arguments += argumentsDelta;
                        yield { type: 'tool-call-delta', index, id: block.id, name: block.name, argumentsDelta };
                    }
                    else if (block !== undefined && block.type !== 'tool-call' && text.length > 0) {
                        block.text += text;
                        yield block.type === 'text'
                            ? { type: 'text-delta', index, text }
                            : { type: 'reasoning-delta', index, text };
                    }
                }
                else if (event?.type === 'content_block_stop') {
                    const index = number(event.index);
                    const block = blocks.get(index);
                    if (block !== undefined) {
                        if (block.type === 'tool-call' && block.arguments.length === 0) {
                            block.arguments = block.initialArguments;
                            yield { type: 'tool-call-delta', index, id: block.id, name: block.name, argumentsDelta: block.arguments };
                        }
                        yield block.type === 'tool-call'
                            ? { type: 'block-end', index, block: { type: 'tool-call', id: block.id, name: block.name, arguments: block.arguments } }
                            : { type: 'block-end', index, block: { type: block.type, text: block.text } };
                    }
                }
                else if (event?.type === 'message_delta') {
                    const delta = object(event.delta);
                    stopReason = delta?.stop_reason;
                    if (stopReason === 'tool_use') {
                        toolCallsRequested = true;
                        child.kill('SIGTERM');
                    }
                    const rawUsage = object(event.usage);
                    usage = {
                        inputTokens: number(rawUsage?.input_tokens) + number(rawUsage?.cache_creation_input_tokens) + number(rawUsage?.cache_read_input_tokens),
                        outputTokens: number(rawUsage?.output_tokens),
                    };
                }
            }
            else if (envelope.type === 'result' && envelope.is_error === true) {
                resultError = typeof envelope.result === 'string' ? envelope.result : 'Claude CLI request failed';
            }
        }
        const exitCode = await exit;
        if (options.signal?.aborted)
            throw new LlmError('Claude request aborted by caller', 'ABORTED');
        if (timedOut)
            throw new LlmError(`Claude stream idle timeout after ${config.streamIdleTimeoutMs}ms`, 'TIMEOUT');
        if ((resultError !== undefined || exitCode !== 0) && !toolCallsRequested) {
            throw new LlmError(resultError ?? `Claude CLI exited with code ${String(exitCode)}: ${stderr}`, 'PROVIDER_ERROR');
        }
        if (usage !== undefined)
            yield { type: 'usage', usage };
        yield { type: 'finish', reason: { kind: finishKind(stopReason) } };
    }
    finally {
        if (timer !== undefined)
            clearTimeout(timer);
        options.signal?.removeEventListener('abort', abort);
        if (child.exitCode === null)
            child.kill('SIGTERM');
        if (bridgeRoot !== undefined)
            await rm(bridgeRoot, { recursive: true, force: true });
    }
}
//# sourceMappingURL=claude.js.map