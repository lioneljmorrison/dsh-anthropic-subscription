# Changelog

## Unreleased

## [0.3.0] - 2026-09-16

- Prevent unbounded Anthropic prompt growth during long-running conversations by bounding prompt and tool-result payloads.
- Reuse Claude CLI native sessions across tool turns and avoid replaying provider reasoning into subsequent prompts.
- Restrict Claude CLI permissions and expose only the DSH MCP tools required by the active request.
- Add configurable provider settings, model visibility in Settings > Models, and an editor action for `settings.yaml`.
- Expand the selectable Anthropic model aliases and versioned Fable, Opus, Sonnet, and Haiku entries.
- Add regression coverage for prompt bounding, native session continuation, tool handling, and client registration.
