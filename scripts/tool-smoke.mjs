import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { ClaudeAdapter } from '../lib/adapter.js'

const adapter = new ClaudeAdapter('claude-subscription', {
  executable: process.env.CLAUDE_PATH || 'claude',
  cwd: process.cwd(),
  streamIdleTimeoutMs: 60_000,
})

const calls = []
let finish
for await (const chunk of adapter.stream({
  provider: 'claude-subscription',
  model: 'sonnet',
  messages: [createUserMessage({
    content: [{ type: 'text', text: 'Call the echo_value tool exactly once with value "stage-two-ok". Do not answer in text.' }],
    source: { kind: 'user' },
  })],
  tools: [{
    name: 'echo_value',
    description: 'Echo a value. Use this when explicitly asked to echo.',
    parameters: { type: 'object', properties: { value: { type: 'string' } }, required: ['value'] },
  }],
})) {
  if (chunk.type === 'block-end' && chunk.block.type === 'tool-call') calls.push(chunk.block)
  if (chunk.type === 'finish') finish = chunk.reason
}

console.log(JSON.stringify({ calls, finish }))
