export declare const REQUIRED_CLAUDE_FLAGS: readonly ["--output-format", "--include-partial-messages", "--permission-prompts", "--no-session-persistence", "--strict-mcp-config", "--mcp-config", "--system-prompt-file"];
export interface ClaudeVersion {
    major: number;
    minor: number;
    patch: number;
}
export declare function parseClaudeVersion(output: string): ClaudeVersion | undefined;
export declare function isSupportedClaudeVersion(version: ClaudeVersion): boolean;
export declare function missingClaudeFlags(help: string): string[];
