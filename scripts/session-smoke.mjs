import { randomUUID } from 'node:crypto'
import { createAssistantMessage, createUserMessage } from '@deepseek-ai/dsh-llm'
import { ClaudeAdapter } from '../lib/adapter.js'

const adapter = new ClaudeAdapter('claude-subscription', {
  executable: process.env.CLAUDE_PATH || 'claude',
  cwd: process.cwd(),
  streamIdleTimeoutMs: 60_000,
  maxPromptBytes: 2_000_000,
})
const sessionId = randomUUID()
const marker = `STAGE3_${randomUUID().replaceAll('-', '').slice(0, 12)}`
const first = createUserMessage({
  content: [{ type: 'text', text: `Remember this marker: ${marker}. Reply exactly READY.` }],
  source: { kind: 'user' },
})
let firstText = ''
let replayState
for await (const chunk of adapter.stream({
  provider: 'claude-subscription', model: 'haiku', sessionId, system: 'Follow the user requested output format exactly.', messages: [first],
})) {
  if (chunk.type === 'text-delta') firstText += chunk.text
  if (chunk.type === 'finish') replayState = chunk.replayState
}
if (!replayState) throw new Error('Claude did not return native session replay state')
const assistant = createAssistantMessage({
  content: [{ type: 'text', text: firstText }],
  source: { provider: 'claude-subscription', model: 'haiku', replayState },
})
const second = createUserMessage({
  content: [{ type: 'text', text: 'Reply with only the marker I asked you to remember.' }],
  source: { kind: 'user' },
})
let resumedText = ''
let resumedReplayState
for await (const chunk of adapter.stream({
  provider: 'claude-subscription',
  model: 'haiku',
  sessionId,
  system: 'Follow the user requested output format exactly.',
  messages: [first, assistant, second],
})) {
  if (chunk.type === 'text-delta') resumedText += chunk.text
  if (chunk.type === 'finish') resumedReplayState = chunk.replayState
}
if (resumedText.trim() !== marker || !resumedReplayState) throw new Error(`Native resume lost the marker: ${resumedText.trim()}`)
const resumedAssistant = createAssistantMessage({
  content: [{ type: 'text', text: resumedText }],
  source: { provider: 'claude-subscription', model: 'haiku', replayState: resumedReplayState },
})
const third = createUserMessage({
  content: [{ type: 'text', text: 'What color is healthy grass? Reply with one word.' }],
  source: { kind: 'user' },
})
let updatedText = ''
for await (const chunk of adapter.stream({
  provider: 'claude-subscription',
  model: 'haiku',
  sessionId,
  system: 'Answer the user in Spanish with concise wording.',
  messages: [first, assistant, second, resumedAssistant, third],
})) {
  if (chunk.type === 'text-delta') updatedText += chunk.text
}
if (!/^verde[.!]?$/iu.test(updatedText.trim())) throw new Error(`System update failed: ${updatedText.trim()}`)
console.log(JSON.stringify({ first: firstText.trim(), resumed: resumedText.trim(), updated: updatedText.trim(), nativeResume: true, systemUpdated: true }))
