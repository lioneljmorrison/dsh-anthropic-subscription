import { createAssistantMessage, createToolResultMessage, createUserMessage } from '@deepseek-ai/dsh-llm'
import { randomUUID } from 'node:crypto'
import { ClaudeAdapter } from '../lib/adapter.js'

const adapter = new ClaudeAdapter('claude-subscription', {
  executable: process.env.CLAUDE_PATH || 'claude',
  cwd: process.cwd(),
  streamIdleTimeoutMs: 60_000,
  maxPromptBytes: 2_000_000,
})
const tool = {
  name: 'echo_value',
  description: 'Echo a value. Use this when explicitly asked to echo.',
  parameters: { type: 'object', properties: { value: { type: 'string' } }, required: ['value'] },
}
const sessionId = randomUUID()
const first = createUserMessage({
  content: [{ type: 'text', text: 'Call echo_value with value "stage-two-ok". After its result, reply exactly: TOOL_RESULT_OK' }],
  source: { kind: 'user' },
})
let call
for await (const chunk of adapter.stream({ provider: 'claude-subscription', model: 'sonnet', sessionId, messages: [first], tools: [tool] })) {
  if (chunk.type === 'block-end' && chunk.block.type === 'tool-call') call = chunk.block
}
if (!call) throw new Error('Claude did not request the synthetic tool')

const history = [
  first,
  createAssistantMessage({ content: [call], source: { provider: 'claude-subscription', model: 'sonnet' } }),
  createToolResultMessage({ callId: call.id, content: [{ type: 'text', text: 'stage-two-ok' }], isError: false }),
]
let text = ''
let finish
for await (const chunk of adapter.stream({ provider: 'claude-subscription', model: 'sonnet', sessionId, messages: history, tools: [tool] })) {
  if (chunk.type === 'text-delta') text += chunk.text
  if (chunk.type === 'finish') finish = chunk.reason
}
console.log(JSON.stringify({ requestedTool: call.name, response: text, finish }))
