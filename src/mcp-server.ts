#!/usr/bin/env node
import { readFile } from 'node:fs/promises'

interface ToolSchemaFile {
  tools: Array<{ name: string; description: string; inputSchema: Record<string, unknown> }>
}

interface JsonRpcRequest {
  jsonrpc?: string
  id?: string | number
  method?: string
}

function reply(id: string | number, result: unknown): void {
  process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id, result })}\n`)
}

async function main(): Promise<void> {
  const schemaPath = process.argv[2]
  if (schemaPath === undefined) throw new Error('missing MCP tool schema path')
  const schema = JSON.parse(await readFile(schemaPath, 'utf8')) as ToolSchemaFile
  process.stdin.setEncoding('utf8')
  let buffer = ''
  process.stdin.on('data', chunk => {
    buffer += chunk
    for (;;) {
      const newline = buffer.indexOf('\n')
      if (newline < 0) break
      const line = buffer.slice(0, newline).trim()
      buffer = buffer.slice(newline + 1)
      if (line.length === 0) continue
      const request = JSON.parse(line) as JsonRpcRequest
      if (request.id === undefined) continue
      if (request.method === 'initialize') {
        reply(request.id, {
          protocolVersion: '2025-06-18',
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: 'dsh-tool-bridge', version: '0.1.0' },
        })
      } else if (request.method === 'tools/list') {
        reply(request.id, { tools: schema.tools })
      } else if (request.method === 'ping') {
        reply(request.id, {})
      } else if (request.method === 'tools/call') {
        // DSH executes the streamed tool call. Keeping this request pending prevents
        // Claude Code from running ahead with a fabricated result before termination.
      } else {
        process.stdout.write(`${JSON.stringify({
          jsonrpc: '2.0',
          id: request.id,
          error: { code: -32601, message: `Method not found: ${String(request.method)}` },
        })}\n`)
      }
    }
  })
}

main().catch(error => {
  process.stderr.write(`dsh-tool-bridge: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
