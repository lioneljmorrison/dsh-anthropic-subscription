# dsh-anthropic-subscription

[![GitHub release](https://img.shields.io/github/v/release/lioneljmorrison/dsh-anthropic-subscription?style=flat-square)](https://github.com/lioneljmorrison/dsh-anthropic-subscription/releases/latest)
[![Tests](https://img.shields.io/github/actions/workflow/status/lioneljmorrison/dsh-anthropic-subscription/ci.yml?branch=main&style=flat-square&label=tests)](https://github.com/lioneljmorrison/dsh-anthropic-subscription/actions/workflows/ci.yml)
[![CodeQL](https://img.shields.io/github/actions/workflow/status/lioneljmorrison/dsh-anthropic-subscription/codeql.yml?branch=main&style=flat-square&label=CodeQL)](https://github.com/lioneljmorrison/dsh-anthropic-subscription/security/code-scanning)
[![Coverage threshold](https://img.shields.io/badge/coverage-%E2%89%A570%25-brightgreen?style=flat-square)](https://github.com/lioneljmorrison/dsh-anthropic-subscription/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/lioneljmorrison/dsh-anthropic-subscription?style=flat-square)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%5E22.19.0%20%7C%7C%20%3E%3D24.0.0-339933?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org/)

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

DSH remains the durable conversation store. On agent-loop requests, the plugin records
Claude's native session ID after each successful turn—including tool-call turns—in DSH
replay metadata and resumes from that exact assistant turn on the next request. The
following request sends only the new tool result or user message; it does not rebuild
the entire DSH transcript. New sessions still begin with an ordered JSONL transcript,
and one-shot calls remain non-persistent.
Changing system instructions are supplied through a private temporary file on every
request, with Claude's system-prompt snapshot disabled.

The default transport budget is 600,000 bytes. Tool-call turns retain Claude's native
session replay metadata, and tool output is bounded to 12,000 bytes per result before
it is sent over the transport. If DSH has not compacted before that limit, the plugin
drops oldest complete user turns and marks the omission. It refuses to truncate the
current turn. File references are normally projected by DSH to stable,
read-only handles. This CLI transport advertises text input, so DSH represents image
attachments with its standard text-only placeholder rather than silently claiming the
image bytes reached Claude.

## Verification

```sh
pnpm test
pnpm run typecheck
pnpm run check:compat
pnpm run coverage
CLAUDE_PATH=/path/to/claude node scripts/smoke.mjs
CLAUDE_PATH=/path/to/claude node scripts/tool-smoke.mjs
CLAUDE_PATH=/path/to/claude node scripts/tool-roundtrip-smoke.mjs
CLAUDE_PATH=/path/to/claude node scripts/session-smoke.mjs
```

## Requirements

- DeepSeek Harness `0.1.5-rc.1`
- Claude Code available on the DSH service `PATH`
- Claude Code authenticated to a Claude subscription

## Install

Install the published package into a DSH profile:

```sh
dsh plugin --profile web add dsh-anthropic-subscription
```

For a local checkout during development:

```sh
dsh plugin --profile web add file:/absolute/path/to/dsh-anthropic-subscription
```

Then restart the DSH service and select `Anthropic Subscription` in the model picker.
Run `pnpm run check:compat` as the same account that runs DSH to verify the CLI flags
and version visible to that service.

## Releases

Version tags are packaged and attached automatically by GitHub Actions. To publish a
release from a clean checkout:

```sh
git tag v0.2.0
git push origin v0.2.0
```

## Configuration

```yaml
- id: anthropic-subscription
  name: dsh-anthropic-subscription
  config:
    provider: claude-subscription
    executable: claude
    maxPromptBytes: 600000
    maxToolResultBytes: 12000
```
