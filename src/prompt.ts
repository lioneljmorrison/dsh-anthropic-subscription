import { Buffer } from 'node:buffer'
import { LlmError, fileHandleText, textOnlyImageText } from '@deepseek-ai/dsh-llm'
import type { ContentBlock, GenerateOptions, Message } from '@deepseek-ai/dsh-llm'

const TOOL_INSTRUCTIONS = [
  'DSH owns the agent loop and executes all tools.',
  'Tools exposed by the dsh MCP server are requests to DSH; use them when needed.',
  'The conversation transcript includes stable tool-call IDs and correlated tool results.',
].join(' ')

type WireBlock =
  | { type: 'text' | 'reasoning'; text: string }
  | { type: 'tool-call'; id: string; name: string; arguments: string }
  | { type: 'tool-result'; toolCallId: string; isError: boolean; content: WireBlock[] }

export interface PreparedPrompt {
  prompt: string
  system: string | undefined
  omittedMessages: number
}

function blockWire(block: ContentBlock): WireBlock {
  switch (block.type) {
    case 'text':
    case 'reasoning':
      return { type: block.type, text: block.text }
    case 'tool-call':
      return { type: 'tool-call', id: String(block.id), name: block.name, arguments: block.arguments }
    case 'tool-result':
      return {
        type: 'tool-result',
        toolCallId: String(block.toolCallId),
        isError: block.isError === true,
        content: block.content.map(blockWire),
      }
    case 'image':
      return { type: 'text', text: textOnlyImageText(block.attachment) }
    case 'file':
      return { type: 'text', text: fileHandleText(block.attachment, undefined) }
    default:
      return { type: 'text', text: '' }
  }
}

function messageWire(message: Message): string {
  return JSON.stringify({ id: String(message.id), role: message.role, source: message.source.kind, content: message.content.map(blockWire) })
}

function promptFor(lines: readonly string[], omittedMessages: number): string {
  const header = omittedMessages > 0 ? `DSH_CONVERSATION_V1\n{"historyOmitted":${omittedMessages}}` : 'DSH_CONVERSATION_V1'
  return `${header}\n${lines.join('\n')}\nDSH_END_CONVERSATION\nRespond to the latest user turn using the complete ordered transcript above.`
}

export function systemText(options: GenerateOptions): string | undefined {
  const values: string[] = []
  if (options.system?.length) values.push(options.system)
  for (const message of options.messages) {
    if (message.role !== 'system') continue
    for (const block of message.content) {
      if (block.type === 'text' || block.type === 'reasoning') values.push(block.text)
    }
  }
  if (options.tools?.length) values.push(TOOL_INSTRUCTIONS)
  return values.length > 0 ? values.join('\n\n') : undefined
}

/** Serialize complete DSH history as ordered JSONL records within a fixed request budget. */
export function preparePrompt(options: GenerateOptions, maxPromptBytes: number): PreparedPrompt {
  const system = systemText(options)
  const groups: string[][] = []
  for (const message of options.messages.filter(message => message.role !== 'system')) {
    const startsTurn = message.role === 'user' && message.source.kind !== 'tool'
    if (startsTurn || groups.length === 0) groups.push([])
    groups.at(-1)?.push(messageWire(message))
  }
  let omittedMessages = 0
  let prompt = promptFor(groups.flat(), omittedMessages)
  const totalBytes = () => Buffer.byteLength(prompt) + Buffer.byteLength(system ?? '')
  while (totalBytes() > maxPromptBytes && groups.length > 1) {
    omittedMessages += groups.shift()?.length ?? 0
    prompt = promptFor(groups.flat(), omittedMessages)
  }
  if (totalBytes() > maxPromptBytes) {
    throw new LlmError(`Claude prompt exceeds the configured ${maxPromptBytes}-byte limit`, 'CONTEXT_LENGTH')
  }
  return { prompt, system, omittedMessages }
}

export function renderPrompt(options: GenerateOptions): string {
  return preparePrompt(options, 2_000_000).prompt
}
