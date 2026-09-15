# dsh-anthropic-subscription

Local DeepSeek Harness model provider backed by the official Claude Code CLI and a
Claude Pro or Max subscription.

## Security model

- Claude Code owns authentication and credential storage.
- The plugin never reads or copies Claude credential files.
- `ANTHROPIC_API_KEY` and `ANTHROPIC_AUTH_TOKEN` are removed from the child environment.
- Each request runs with `--safe-mode`, no built-in tools, no permission prompts, and no session persistence.
- Prompts are written to stdin rather than exposed in the process argument list.

The initial provider supports text generation through DSH's primary model picker.
DSH tool calling requires a later MCP bridge and is not yet supported.

## Verification

```sh
pnpm test
pnpm run typecheck
CLAUDE_PATH=/path/to/claude node scripts/smoke.mjs
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
