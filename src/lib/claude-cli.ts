/**
 * Claude CLI Backend — DEV mode subprocess wrapper.
 *
 * In development, this module replaces the Anthropic SDK with the `claude` CLI
 * subprocess. The CLI uses the developer's logged-in Claude subscription, so no
 * API key is required.
 *
 * In production, the SDK path is used with a real API key (sk-ant-api03-*).
 *
 * Ported from Job Fairy's claude_cli.py to TypeScript for Next.js.
 */

import { spawn as nodeSpawn } from 'child_process'

// ─── Mode detection ──────────────────────────────────────────────────────────

/**
 * Returns true when we should use the CLI subprocess instead of the SDK.
 * Dev mode by default; set FORCE_SDK=true in .env.local to override.
 */
export function useCliMode(): boolean {
  return (
    process.env.NODE_ENV === 'development' &&
    process.env.FORCE_SDK !== 'true'
  )
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ToolDefinition {
  name: string
  description: string
  input_schema: {
    type: string
    properties: Record<string, unknown>
    required?: string[]
  }
}

interface ToolCall {
  name: string
  input: Record<string, unknown>
}

// ─── CLI invocation ──────────────────────────────────────────────────────────

/**
 * Call the claude CLI in --print mode and return the full response text.
 * Used for single-turn calls (e.g., light-assessment).
 */
export async function callCli(
  prompt: string,
  systemPrompt: string | null,
  model: string
): Promise<string> {
  const args = buildCliArgs(systemPrompt, model)
  return spawnCli(args, prompt)
}

/**
 * Run the full agentic tool-use loop via CLI subprocess.
 * Mirrors runAislingLoop() but uses the CLI instead of the SDK.
 *
 * Yields SSE-formatted chunks to the controller so the frontend sees the
 * same event stream as the SDK path.
 */
export async function runCliAgentLoop(
  systemPrompt: string,
  messages: Array<{ role: string; content: string }>,
  tools: ToolDefinition[],
  model: string,
  controller: ReadableStreamDefaultController,
  executeTool: (name: string, input: Record<string, unknown>) => Promise<string>,
  extraAllowedTools?: string[]
): Promise<string> {
  const encoder = new TextEncoder()
  let fullAssistantText = ''

  // Append tool instructions to system prompt
  const toolInstructions = buildToolInstructions(tools)
  const fullSystemPrompt = systemPrompt + '\n\n' + toolInstructions

  // Build initial prompt from message history
  let prompt = buildCliPrompt(messages)

  for (let round = 0; round < 10; round++) {
    const cmd = buildCliArgs(fullSystemPrompt, model, extraAllowedTools)

    // Stream text deltas to the client as they arrive, while also
    // collecting the full response text for tool call extraction.
    let roundText = ''
    const responseText = await spawnCliStreaming(cmd, prompt, (chunk) => {
      roundText += chunk
      fullAssistantText += chunk
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`)
      )
    })

    // Check for tool calls in the full response (they appear as <tool_call> XML)
    const toolCalls = extractToolCalls(responseText)

    if (toolCalls.length === 0) {
      break
    }

    // Execute each tool call
    const toolResults: Array<{ tool: string; result: unknown }> = []

    for (const tc of toolCalls) {
      // Emit tool_call event for AI Logic panel
      const toolCallPayload = JSON.stringify({
        __type: 'tool_call',
        name: tc.name,
        input: tc.input,
      })
      controller.enqueue(encoder.encode(`data: ${toolCallPayload}\n\n`))

      // Emit card data for render_assessment_card (same as SDK path)
      if (tc.name === 'render_assessment_card') {
        const cardPayload = JSON.stringify({ __type: 'card', ...tc.input })
        controller.enqueue(encoder.encode(`data: ${cardPayload}\n\n`))
      }

      const result = await executeTool(tc.name, tc.input)

      // Emit tool_result event
      let parsedResult: unknown = result
      try {
        parsedResult = JSON.parse(result)
      } catch {
        // keep raw string
      }
      const toolResultPayload = JSON.stringify({
        __type: 'tool_result',
        name: tc.name,
        result: parsedResult,
      })
      controller.enqueue(encoder.encode(`data: ${toolResultPayload}\n\n`))

      toolResults.push({ tool: tc.name, result: parsedResult })
    }

    // Build next prompt with tool results
    prompt = buildToolResultPrompt(toolResults)
  }

  return fullAssistantText
}

// ─── Internal helpers ────────────────────────────────────────────────────────

function buildCliArgs(systemPrompt: string | null, model: string, allowedTools?: string[]): string[] {
  const cmd = [
    'claude',
    '--print',
    '--model',
    model,
    '--output-format',
    'stream-json',
    '--no-session-persistence',
  ]

  if (systemPrompt) {
    cmd.push('--system-prompt', systemPrompt)
  }

  if (allowedTools && allowedTools.length > 0) {
    cmd.push('--allowedTools', ...allowedTools)
  }

  return cmd
}

function cleanEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env }
  delete env.CLAUDECODE
  delete env.CLAUDE_CODE_ENTRYPOINT
  return env
}

/**
 * Spawn the CLI and stream text deltas to a callback as they arrive.
 * Returns the full collected response text (including <tool_call> blocks).
 * The onTextDelta callback receives ONLY displayable text (not tool XML).
 */
function spawnCliStreaming(
  args: string[],
  prompt: string,
  onTextDelta: (chunk: string) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const env = cleanEnv()
    const command = args[0] ?? 'claude'
    const commandArgs = args.slice(1)
    const proc = nodeSpawn(command, commandArgs, { env })

    let fullText = ''
    let lineBuffer = ''
    let stderr = ''
    // Track whether we're inside a <tool_call> block to suppress streaming it
    let insideToolCall = false

    function processLine(line: string) {
      const trimmed = line.trim()
      if (!trimmed) return

      let event: Record<string, unknown>
      try {
        event = JSON.parse(trimmed)
      } catch {
        return
      }

      const eventType = event.type as string

      if (eventType === 'content_block_delta') {
        const delta = event.delta as Record<string, unknown> | undefined
        if (delta?.type === 'text_delta') {
          const text = delta.text as string
          fullText += text

          // Buffer tool_call XML — don't stream it to the client
          if (text.includes('<tool_call>')) {
            insideToolCall = true
            // Emit any text before the tag
            const before = text.split('<tool_call>')[0]
            if (before) onTextDelta(before)
          } else if (insideToolCall) {
            if (text.includes('</tool_call>')) {
              insideToolCall = false
              // Emit any text after the closing tag
              const after = text.split('</tool_call>').slice(1).join('')
              if (after) onTextDelta(after)
            }
            // else: inside tool call, suppress
          } else {
            onTextDelta(text)
          }
        }
      } else if (eventType === 'assistant') {
        const message = event.message as Record<string, unknown> | undefined
        const content = (message?.content as Array<Record<string, unknown>>) ?? []
        for (const block of content) {
          if (block.type === 'text') {
            const text = block.text as string
            // This is the final assembled message — only use if we missed deltas
            if (!fullText) {
              fullText = text
              onTextDelta(text)
            }
          }
        }
      } else if (eventType === 'result') {
        const resultText = event.result as string | undefined
        if (resultText && !fullText) {
          fullText = resultText
          onTextDelta(resultText)
        }
      }
    }

    if (proc.stdout) {
      proc.stdout.on('data', (data: Buffer) => {
        lineBuffer += data.toString()
        const lines = lineBuffer.split('\n')
        // Keep the last partial line in the buffer
        lineBuffer = lines.pop() ?? ''
        for (const line of lines) {
          processLine(line)
        }
      })
    }

    if (proc.stderr) {
      proc.stderr.on('data', (data: Buffer) => {
        stderr += data.toString()
      })
    }

    proc.on('close', (code: number | null) => {
      // Process any remaining buffered line
      if (lineBuffer.trim()) processLine(lineBuffer)

      if (code !== 0) {
        reject(new Error(stderr.trim() || `CLI exited with code ${code}`))
        return
      }
      resolve(fullText)
    })

    proc.on('error', (err: Error) => {
      reject(new Error(`Failed to spawn claude CLI: ${err.message}`))
    })

    if (proc.stdin) {
      proc.stdin.write(prompt)
      proc.stdin.end()
    }

    setTimeout(() => {
      proc.kill()
      reject(new Error('Claude CLI timed out after 5 minutes'))
    }, 300_000)
  })
}

/**
 * Spawn the claude CLI, pipe prompt to stdin, return parsed response text.
 * Non-streaming — used for single-turn calls (light-assessment).
 */
function spawnCli(args: string[], prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const env = cleanEnv()
    const command = args[0] ?? 'claude'
    const commandArgs = args.slice(1)
    const proc = nodeSpawn(command, commandArgs, { env })

    let stdout = ''
    let stderr = ''

    if (proc.stdout) {
      proc.stdout.on('data', (data: Buffer) => {
        stdout += data.toString()
      })
    }
    if (proc.stderr) {
      proc.stderr.on('data', (data: Buffer) => {
        stderr += data.toString()
      })
    }

    proc.on('close', (code: number | null) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `CLI exited with code ${code}`))
        return
      }
      resolve(parseStreamJson(stdout))
    })

    proc.on('error', (err: Error) => {
      reject(new Error(`Failed to spawn claude CLI: ${err.message}`))
    })

    if (proc.stdin) {
      proc.stdin.write(prompt)
      proc.stdin.end()
    }

    setTimeout(() => {
      proc.kill()
      reject(new Error('Claude CLI timed out after 5 minutes'))
    }, 300_000)
  })
}

/**
 * Parse stream-json output from the claude CLI into text.
 */
function parseStreamJson(output: string): string {
  const textParts: string[] = []

  for (const line of output.trim().split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue

    let event: Record<string, unknown>
    try {
      event = JSON.parse(trimmed)
    } catch {
      continue
    }

    const eventType = event.type as string

    if (eventType === 'assistant') {
      const message = event.message as Record<string, unknown> | undefined
      const content = (message?.content as Array<Record<string, unknown>>) ?? []
      for (const block of content) {
        if (block.type === 'text') {
          textParts.push(block.text as string)
        }
      }
    } else if (eventType === 'content_block_delta') {
      const delta = event.delta as Record<string, unknown> | undefined
      if (delta?.type === 'text_delta') {
        textParts.push(delta.text as string)
      }
    } else if (eventType === 'result') {
      const resultText = event.result as string | undefined
      if (resultText && textParts.length === 0) {
        textParts.push(resultText)
      }
    }
  }

  return textParts.join('')
}

/**
 * Convert SDK-format messages into a single text prompt for the CLI.
 */
function buildCliPrompt(
  messages: Array<{ role: string; content: string }>
): string {
  return messages
    .map((m) => `[${m.role.toUpperCase()}]: ${m.content}`)
    .join('\n\n')
}

/**
 * Build tool usage instructions to append to the system prompt.
 * The model outputs tool calls as <tool_call> JSON blocks.
 */
function buildToolInstructions(tools: ToolDefinition[]): string {
  let instructions =
    '\n\n--- TOOL USE INSTRUCTIONS ---\n' +
    'You have access to the following tools. To call a tool, output a JSON block ' +
    'wrapped in <tool_call> tags:\n\n' +
    '<tool_call>\n' +
    '{"name": "tool_name", "input": {"param1": "value1"}}\n' +
    '</tool_call>\n\n' +
    'You may call multiple tools by using multiple <tool_call> blocks.\n' +
    'After outputting tool calls, STOP and wait for the results.\n\n' +
    'Available tools:\n\n'

  for (const t of tools) {
    instructions += `### ${t.name}\n`
    instructions += `${t.description}\n`
    const required = t.input_schema.required ?? []
    const props = t.input_schema.properties ?? {}
    if (Object.keys(props).length > 0) {
      instructions += 'Parameters:\n'
      for (const [pname, pdef] of Object.entries(props)) {
        const def = pdef as Record<string, unknown>
        const reqMarker = required.includes(pname) ? ' (required)' : ''
        const desc = (def.description as string) ?? (def.type as string) ?? 'any'
        instructions += `  - ${pname}: ${desc}${reqMarker}\n`
      }
    }
    instructions += '\n'
  }

  instructions += '--- END TOOL USE INSTRUCTIONS ---\n'
  return instructions
}

/**
 * Extract <tool_call> blocks from response text.
 */
function extractToolCalls(responseText: string): ToolCall[] {
  const toolCalls: ToolCall[] = []
  const pattern = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/g
  let match

  while ((match = pattern.exec(responseText)) !== null) {
    try {
      const raw = match[1] ?? ''
      const tc = JSON.parse(raw.trim()) as { name: string; input?: Record<string, unknown> }
      if (tc.name) {
        toolCalls.push({
          name: tc.name,
          input: tc.input ?? {},
        })
      }
    } catch {
      console.warn('[claude-cli] Failed to parse tool call JSON:', match[1]?.slice(0, 100))
    }
  }

  return toolCalls
}

/**
 * Extract text content from response, excluding tool call blocks.
 */
function extractTextContent(responseText: string, toolCalls: ToolCall[]): string {
  if (toolCalls.length === 0) return responseText.trim()
  return responseText
    .replace(/<tool_call>\s*[\s\S]*?\s*<\/tool_call>/g, '')
    .trim()
}

/**
 * Build a prompt containing tool execution results for the next CLI call.
 */
function buildToolResultPrompt(
  toolResults: Array<{ tool: string; result: unknown }>
): string {
  const parts = ['Here are the results of the tool calls you requested:\n']
  for (const tr of toolResults) {
    parts.push(`Tool: ${tr.tool}`)
    parts.push(`Result: ${JSON.stringify(tr.result)}`)
    parts.push('')
  }
  parts.push('Please continue based on these results.')
  return parts.join('\n')
}
