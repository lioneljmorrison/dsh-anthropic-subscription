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

## Verification

```sh
pnpm test
pnpm run typecheck
CLAUDE_PATH=/path/to/claude node scripts/smoke.mjs
CLAUDE_PATH=/path/to/claude node scripts/tool-smoke.mjs
CLAUDE_PATH=/path/to/claude node scripts/tool-roundtrip-smoke.mjs
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
```
