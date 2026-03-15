'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ItemConversationMessage } from '@/types/database'
import type { ChatMessage } from '@/types/chat'

// Re-export for convenience so existing imports still resolve
export type { ChatMessage }

interface UsePerItemChatReturn {
  messages: ChatMessage[]
  isStreaming: boolean
  isLoadingHistory: boolean
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
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Ref-based streaming guard — prevents stale closure issues and avoids
  // making sendMessage recreate on every isStreaming change.
  const isStreamingRef = useRef(false)

  // Cleanup: abort any in-flight stream on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
    }
  }, [])

  const loadHistory = useCallback(async (itemId: string) => {
    setIsLoadingHistory(true)
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
    } finally {
      setIsLoadingHistory(false)
    }
  }, [])

  // sendMessage does NOT include isStreaming in its dep array — we read the ref
  // instead to avoid stale closures and unnecessary re-renders.
  const sendMessage = useCallback(async (itemId: string, text: string) => {
    if (!text.trim() || isStreamingRef.current) return

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

    isStreamingRef.current = true
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
      let streamDone = false

      while (!streamDone) {
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
            streamDone = true
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
            const card = {
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

      // Cancel reader if we broke out of the while loop on [DONE]
      if (streamDone) {
        reader.cancel().catch(() => undefined)
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
      isStreamingRef.current = false
      setIsStreaming(false)
      abortControllerRef.current = null
    }
  }, [])

  const clearError = useCallback(() => setError(null), [])

  return {
    messages,
    isStreaming,
    isLoadingHistory,
    error,
    loadHistory,
    sendMessage,
    clearError,
  }
}
