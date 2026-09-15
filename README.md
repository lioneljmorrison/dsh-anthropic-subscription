# dsh-anthropic-subscription

Local DeepSeek Harness model provider backed by the official Claude Code CLI and a
Claude Pro or Max subscription.

## Security model

- Claude Code owns authentication and credential storage.
- The plugin never reads or copies Claude credential files.
- `ANTHROPIC_API_KEY` and `ANTHROPIC_AUTH_TOKEN` are removed from the child environment.
- Text-only requests run with `--safe-mode`; tool-enabled requests load only the generated local MCP configuration.
- Claude built-in tools, permission prompts, inherited settings, and session persistence are disabled.
- Prompts are written to stdin rather than exposed in the process argument list.

The provider supports text generation and DSH tool calling through the primary model
picker. For tool-enabled turns, a per-request local MCP server advertises DSH's tool
schemas. Claude's streamed calls are translated back to DSH; the MCP server never
executes them. DSH remains responsible for permissions, execution, and tool results.

DSH remains the durable conversation store. On normal agent-loop requests, the plugin
records Claude's native session ID after clean text turns in DSH replay metadata and
resumes from that exact assistant turn on the next request. Tool-call turns deliberately
do not create a replay checkpoint: Claude records an intercepted MCP call as denied, so
the following turn rebuilds from DSH's authoritative call and result instead. New
messages are sent as an ordered JSONL transcript. One-shot calls remain non-persistent.
Changing system instructions are supplied through a private temporary file on every
request, with Claude's system-prompt snapshot disabled.

The default transport budget is 2,000,000 bytes. If DSH has not compacted before that
limit, the plugin drops oldest complete user turns and marks the omission. It refuses
to truncate the current turn. File references are normally projected by DSH to stable,
read-only handles. This CLI transport advertises text input, so DSH represents image
attachments with its standard text-only placeholder rather than silently claiming the
image bytes reached Claude.

## Verification

```sh
pnpm test
pnpm run typecheck
CLAUDE_PATH=/path/to/claude node scripts/smoke.mjs
CLAUDE_PATH=/path/to/claude node scripts/tool-smoke.mjs
CLAUDE_PATH=/path/to/claude node scripts/tool-roundtrip-smoke.mjs
CLAUDE_PATH=/path/to/claude node scripts/session-smoke.mjs
```

## Requirements

- DeepSeek Harness `0.1.5-rc.1`
- Claude Code available on the DSH service `PATH`
- Claude Code authenticated to a Claude subscription

## Configuration

```yaml
- id: anthropic-subscription
  name: dsh-anthropic-subscription
  config:
    provider: claude-subscription
    executable: claude
    maxPromptBytes: 2000000
```
