'use client'

import { useCallback, useRef, useState } from 'react'
import type { ItemConversationMessage } from '@/types/database'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CardData {
  item: string
  verdict: string
  confidence: number
  rationale: string
  action: string
  import_note?: string
  item_description?: string
  image_url?: string
  voltage_compatible?: boolean
  needs_transformer?: boolean
  estimated_ship_cost_usd?: number
  currency?: string
  estimated_replace_cost_usd?: number
  replace_currency?: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  type: 'text' | 'card'
  card?: CardData
}

interface UsePerItemChatReturn {
  messages: ChatMessage[]
  isStreaming: boolean
  error: string | null
  loadHistory: (itemId: string) => Promise<void>
  sendMessage: (itemId: string, text: string) => Promise<void>
  clearError: () => void
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePerItemChat(): UsePerItemChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const loadHistory = useCallback(async (itemId: string) => {
    try {
      const res = await fetch(`/api/items/${itemId}/chat/messages`)
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        throw new Error(data.error ?? `Failed to load history (${res.status})`)
      }
      const data = await res.json() as { messages: ItemConversationMessage[] }
      const transformed: ChatMessage[] = data.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        type: 'text' as const,
      }))
      setMessages(transformed)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load conversation history')
    }
  }, [])

  const sendMessage = useCallback(async (itemId: string, text: string) => {
    if (!text.trim() || isStreaming) return

    // Abort any in-flight request
    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller

    // Optimistically add user message
    const userMessageId = `user-${Date.now()}`
    const userMessage: ChatMessage = {
      id: userMessageId,
      role: 'user',
      content: text,
      type: 'text',
    }
    setMessages((prev) => [...prev, userMessage])
    setIsStreaming(true)
    setError(null)

    // Placeholder for the streaming assistant message
    const assistantMessageId = `assistant-${Date.now()}`
    setMessages((prev) => [
      ...prev,
      { id: assistantMessageId, role: 'assistant', content: '', type: 'text' },
    ])

    try {
      const res = await fetch(`/api/items/${itemId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const data = await res.json() as { error?: string }
        throw new Error(data.error ?? `Request failed (${res.status})`)
      }

      if (!res.body) throw new Error('No response body')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // SSE events are separated by double newlines
        const events = buffer.split('\n\n')
        buffer = events.pop() ?? ''

        for (const event of events) {
          const dataLine = event.split('\n').find((l) => l.startsWith('data: '))
          if (!dataLine) continue
          const raw = dataLine.slice('data: '.length)

          if (raw === '[DONE]') {
            break
          }

          let parsed: unknown
          try {
            parsed = JSON.parse(raw)
          } catch {
            continue
          }

          // Text delta — plain JSON string
          if (typeof parsed === 'string') {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMessageId
                  ? { ...m, content: m.content + parsed }
                  : m
              )
            )
            continue
          }

          if (typeof parsed !== 'object' || parsed === null) continue
          const obj = parsed as Record<string, unknown>

          // Card event — render inline assessment card
          if (obj.__type === 'card') {
            const card: CardData = {
              item: String(obj.item ?? ''),
              verdict: String(obj.verdict ?? ''),
              confidence: Number(obj.confidence ?? 0),
              rationale: String(obj.rationale ?? ''),
              action: String(obj.action ?? ''),
              ...(obj.import_note !== undefined ? { import_note: String(obj.import_note) } : {}),
              ...(obj.item_description !== undefined ? { item_description: String(obj.item_description) } : {}),
              ...(obj.image_url !== undefined ? { image_url: String(obj.image_url) } : {}),
              ...(obj.voltage_compatible !== undefined ? { voltage_compatible: Boolean(obj.voltage_compatible) } : {}),
              ...(obj.needs_transformer !== undefined ? { needs_transformer: Boolean(obj.needs_transformer) } : {}),
              ...(obj.estimated_ship_cost_usd !== undefined ? { estimated_ship_cost_usd: Number(obj.estimated_ship_cost_usd) } : {}),
              ...(obj.currency !== undefined ? { currency: String(obj.currency) } : {}),
              ...(obj.estimated_replace_cost_usd !== undefined ? { estimated_replace_cost_usd: Number(obj.estimated_replace_cost_usd) } : {}),
              ...(obj.replace_currency !== undefined ? { replace_currency: String(obj.replace_currency) } : {}),
            }
            const cardMessageId = `card-${Date.now()}-${Math.random()}`
            setMessages((prev) => [
              ...prev,
              { id: cardMessageId, role: 'assistant', content: '', type: 'card', card },
            ])
            continue
          }

          // Error event
          if (obj.__type === 'error') {
            throw new Error(String(obj.message ?? 'An error occurred'))
          }

          // tool_call and tool_result are observability events — skip
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return

      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      setError(message)

      // Remove the empty placeholder if nothing was streamed
      setMessages((prev) => {
        const placeholder = prev.find((m) => m.id === assistantMessageId)
        if (placeholder && placeholder.content === '') {
          return prev.filter((m) => m.id !== assistantMessageId)
        }
        return prev
      })
    } finally {
      setIsStreaming(false)
      abortControllerRef.current = null
    }
  }, [isStreaming])

  const clearError = useCallback(() => setError(null), [])

  return {
    messages,
    isStreaming,
    error,
    loadHistory,
    sendMessage,
    clearError,
  }
}
