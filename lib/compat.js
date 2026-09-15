export const REQUIRED_CLAUDE_FLAGS = [
    '--output-format',
    '--include-partial-messages',
    '--permission-prompts',
    '--no-session-persistence',
    '--strict-mcp-config',
    '--mcp-config',
    '--system-prompt-file',
];
export function parseClaudeVersion(output) {
    const match = output.match(/\b(\d+)\.(\d+)\.(\d+)\b/);
    if (match === null)
        return undefined;
    return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) };
}
export function isSupportedClaudeVersion(version) {
    return version.major >= 2;
}
export function missingClaudeFlags(help) {
    return REQUIRED_CLAUDE_FLAGS.filter(flag => {
        if (flag === '--system-prompt-file')
            return !help.includes(flag) && !help.includes('--system-prompt[-file]');
        return !help.includes(flag);
    });
}
//# sourceMappingURL=compat.js.map