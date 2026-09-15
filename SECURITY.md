# Security model

This plugin delegates inference to the official, locally installed Claude Code CLI.
Claude Code owns subscription authentication and credential storage; this plugin does
not locate, read, copy, parse, or log its credential files.

For every request, the adapter:

1. removes `ANTHROPIC_API_KEY` and `ANTHROPIC_AUTH_TOKEN` from the child environment;
2. supplies prompts through stdin instead of process arguments;
3. enables Claude Code safe mode;
4. disables built-in tools, permission prompts, and session persistence; and
5. terminates the child process on caller cancellation or stream timeout.

The configured Claude executable is trusted code and runs as the DSH service account.
Use an absolute executable path when service `PATH` contents are not tightly controlled.
