'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ItemConversationMessage } from '@/types/database'
import type { ChatMessage } from '@/types/chat'
import type { ItemAssessment } from '@/types'

// Re-export for convenience so existing imports still resolve
export type { ChatMessage }

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

interface UsePerItemChatOptions {
  /** Called when Aisling updates the item assessment during chat. */
  onAssessmentUpdated?: ((updated: ItemAssessment) => void) | undefined
  /**
   * Increment this value to trigger a history re-fetch. Useful after the user
   * saves an edit so the injected system message appears immediately.
   */
  refreshTrigger?: number | undefined
}

interface UsePerItemChatReturn {
  messages: ChatMessage[]
  isStreaming: boolean
  isLoadingHistory: boolean
  error: string | null
  /** Status text when Aisling is executing tools (e.g. "Updating card...") */
  toolStatus: string | null
  loadHistory: (itemId: string) => Promise<void>
  sendMessage: (itemId: string, text: string) => Promise<void>
  clearError: () => void
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePerItemChat(options?: UsePerItemChatOptions): UsePerItemChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toolStatus, setToolStatus] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Use a ref for the callback so sendMessage doesn't need to recreate
  // when the parent re-renders with a new function identity.
  const onAssessmentUpdatedRef = useRef(options?.onAssessmentUpdated)
  onAssessmentUpdatedRef.current = options?.onAssessmentUpdated

  // Ref-based streaming guard — prevents stale closure issues and avoids
  // making sendMessage recreate on every isStreaming change.
  const isStreamingRef = useRef(false)

  // Track the itemId for use in the refreshTrigger effect
  const currentItemIdRef = useRef<string | null>(null)

  // Cleanup: abort any in-flight stream on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
    }
  }, [])

  const loadHistory = useCallback(async (itemId: string) => {
    currentItemIdRef.current = itemId
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

  // Re-fetch history when refreshTrigger increments (e.g. after an item save
  // injects a system message). Skip the initial mount (trigger === 0 or
  // undefined) — loadHistory is called explicitly by the component on mount.
  const refreshTrigger = options?.refreshTrigger
  const prevRefreshTriggerRef = useRef(refreshTrigger)
  useEffect(() => {
    if (prevRefreshTriggerRef.current === refreshTrigger) return
    prevRefreshTriggerRef.current = refreshTrigger
    // Only refresh if we have an item loaded and the trigger actually changed
    if (refreshTrigger !== undefined && refreshTrigger > 0 && currentItemIdRef.current) {
      void loadHistory(currentItemIdRef.current)
    }
  }, [refreshTrigger, loadHistory])

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
      // Track whether we need to re-fetch the item after streaming ends
      let assessmentWasUpdated = false

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

          // Tool status — show/hide "Updating card..." indicator
          if (obj.__type === 'tool_status') {
            setToolStatus((obj.message as string) ?? null)
            continue
          }

          // Card event — do NOT add to messages; assessment update
          // will be reflected in the edit panel via onAssessmentUpdated.
          if (obj.__type === 'card') {
            // Skip rendering cards in chat — they appear in the edit panel
            continue
          }

          // Tool result event — detect when update_item_assessment completed
          if (obj.__type === 'tool_result') {
            if (obj.name === 'update_item_assessment') {
              const result = obj.result as Record<string, unknown> | undefined
              if (result?.ok === true) {
                assessmentWasUpdated = true
              }
            }
            // tool_result and tool_call are observability-only — skip rendering
            continue
          }

          // tool_call — skip
          if (obj.__type === 'tool_call') {
            continue
          }

          // Error event
          if (obj.__type === 'error') {
            throw new Error(String(obj.message ?? 'An error occurred'))
          }
        }
      }

      // Cancel reader if we broke out of the while loop on [DONE]
      if (streamDone) {
        reader.cancel().catch(() => undefined)
      }

      // After streaming is done, re-fetch the item to get the updated assessment
      // and notify the parent so the edit panel reflects the changes.
      if (assessmentWasUpdated && onAssessmentUpdatedRef.current) {
        try {
          const updatedRes = await fetch(`/api/items/${itemId}`)
          if (updatedRes.ok) {
            const updated = await updatedRes.json() as ItemAssessment
            onAssessmentUpdatedRef.current(updated)
          }
        } catch {
          // Non-critical — the edit panel will show stale data until next page load.
          // User can refresh manually.
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
      isStreamingRef.current = false
      setIsStreaming(false)
      setToolStatus(null)
      abortControllerRef.current = null
    }
  }, [])

  const clearError = useCallback(() => setError(null), [])

  return {
    messages,
    isStreaming,
    isLoadingHistory,
    error,
    toolStatus,
    loadHistory,
    sendMessage,
    clearError,
  }
}
