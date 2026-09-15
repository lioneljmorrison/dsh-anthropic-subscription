# Security model

This plugin delegates inference to the official, locally installed Claude Code CLI.
Claude Code owns subscription authentication and credential storage; this plugin does
not locate, read, copy, parse, or log its credential files.

For every request, the adapter:

1. removes `ANTHROPIC_API_KEY` and `ANTHROPIC_AUTH_TOKEN` from the child environment;
2. supplies prompts through stdin instead of process arguments;
3. enables Claude Code safe mode for text-only turns;
4. for tool turns, disables inherited settings and loads only a generated local MCP configuration;
5. disables built-in tools and permission prompts;
6. persists a Claude session only for clean DSH agent-loop text turns, storing its opaque
   ID in DSH replay metadata while DSH remains the durable conversation record (tool-call
   turns intentionally receive no native replay checkpoint); and
7. terminates the child process on caller cancellation or stream timeout.

System instructions are written to a mode-`0600` temporary file and removed after the
request. User conversation content continues to travel through stdin. Temporary MCP
schemas and configuration use the same permissions and cleanup path.

The MCP bridge advertises schemas but intentionally never executes `tools/call`.
Claude tool calls return through the DSH LLM stream, where DSH applies its normal
permission policy and invokes the actual tool.

The configured Claude executable is trusted code and runs as the DSH service account.
Use an absolute executable path when service `PATH` contents are not tightly controlled.
