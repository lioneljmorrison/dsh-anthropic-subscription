import type { ContentBlock, GenerateOptions, Message } from '@deepseek-ai/dsh-llm'

function blockText(block: ContentBlock): string {
  switch (block.type) {
    case 'text':
    case 'reasoning':
      return block.text
    case 'tool-call':
      return `[tool call ${block.name} ${block.arguments}]`
    case 'tool-result':
      return `[tool result ${String(block.toolCallId)}${block.isError ? ' error' : ''}]\n${block.content.map(blockText).join('\n')}`
    case 'image':
      throw new Error('Claude CLI provider does not yet support DSH image blocks')
    case 'file':
      throw new Error('Claude CLI provider requires file blocks to be projected to text')
    default:
      return ''
  }
}

function messageText(message: Message): string {
  return `<${message.role}>\n${message.content.map(blockText).join('\n')}\n</${message.role}>`
}

/** Render a complete DSH request into the one text turn accepted by Claude stream-json input. */
export function renderPrompt(options: GenerateOptions): string {
  const parts: string[] = []
  if (options.system !== undefined && options.system.length > 0) {
    parts.push(`<system>\n${options.system}\n</system>`)
  }
  parts.push(...options.messages.map(messageText))
  if (options.tools?.length) {
    parts.push('<system-note>DSH tools are unavailable through this initial Claude CLI transport. Do not claim to have called them.</system-note>')
  }
  return parts.join('\n\n')
}
