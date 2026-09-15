# Security model

This plugin delegates inference to the official, locally installed Claude Code CLI.
Claude Code owns subscription authentication and credential storage; this plugin does
not locate, read, copy, parse, or log its credential files.

For every request, the adapter:

1. removes `ANTHROPIC_API_KEY` and `ANTHROPIC_AUTH_TOKEN` from the child environment;
2. supplies prompts through stdin instead of process arguments;
3. enables Claude Code safe mode for text-only turns;
4. for tool turns, disables inherited settings and loads only a generated local MCP configuration;
5. disables built-in tools, permission prompts, and session persistence; and
6. terminates the child process on caller cancellation or stream timeout.

The MCP bridge advertises schemas but intentionally never executes `tools/call`.
Claude tool calls return through the DSH LLM stream, where DSH applies its normal
permission policy and invokes the actual tool.

The configured Claude executable is trusted code and runs as the DSH service account.
Use an absolute executable path when service `PATH` contents are not tightly controlled.
