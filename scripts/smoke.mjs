import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { ClaudeAdapter } from '../lib/adapter.js'

const adapter = new ClaudeAdapter('claude-subscription', {
  executable: process.env.CLAUDE_PATH || 'claude',
  cwd: process.cwd(),
  streamIdleTimeoutMs: 60_000,
})

let text = ''
let finish
for await (const chunk of adapter.stream({
  provider: 'claude-subscription',
  model: 'sonnet',
  messages: [createUserMessage({
    content: [{ type: 'text', text: 'Reply with exactly: DSH_CLAUDE_PROVIDER_OK' }],
    source: { kind: 'user' },
  })],
})) {
  if (chunk.type === 'text-delta') text += chunk.text
  if (chunk.type === 'finish') finish = chunk.reason
}

console.log(text)
console.log(JSON.stringify(finish))
