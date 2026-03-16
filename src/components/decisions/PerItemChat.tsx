'use client'

import { useCallback, useEffect, useRef } from 'react'
import { Send } from 'lucide-react'
import { ThinkingDots } from '@thefairies/design-system/components'
import { MessageBubble } from '@/components/chat/MessageBubble'
import { usePerItemChat } from '@/lib/hooks/usePerItemChat'
import styles from './PerItemChat.module.css'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PerItemChatProps {
  itemId: string
  itemName: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PerItemChat({ itemId, itemName }: PerItemChatProps) {
  const { messages, isStreaming, isLoadingHistory, error, loadHistory, sendMessage, clearError } =
    usePerItemChat()

  const messageListRef = useRef<HTMLUListElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const loadedRef = useRef<string | null>(null)

  // Track whether streaming has ever occurred so we only focus-return post-stream,
  // not on initial mount.
  const hasStreamedRef = useRef(false)

  // Load conversation history on mount (or when itemId changes)
  useEffect(() => {
    if (loadedRef.current === itemId) return
    loadedRef.current = itemId
    loadHistory(itemId)
  }, [itemId, loadHistory])

  // Auto-scroll to bottom when messages update or streaming ends
  useEffect(() => {
    const list = messageListRef.current
    if (!list) return
    list.scrollTop = list.scrollHeight
  }, [messages, isStreaming])

  // Return focus to input after streaming ends — but not on initial mount
  useEffect(() => {
    if (isStreaming) {
      hasStreamedRef.current = true
    } else if (hasStreamedRef.current) {
      inputRef.current?.focus()
    }
  }, [isStreaming])

  const handleSend = useCallback(() => {
    const value = inputRef.current?.value.trim() ?? ''
    if (!value || isStreaming) return
    if (inputRef.current) inputRef.current.value = ''
    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
    }
    sendMessage(itemId, value)
  }, [itemId, isStreaming, sendMessage])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
      if (e.key === 'Escape') {
        inputRef.current?.blur()
      }
    },
    [handleSend]
  )

  const handleInput = useCallback((e: React.FormEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }, [])

  const hasMessages = messages.length > 0

  return (
    <section
      className={styles.root}
      aria-label={`Chat with Aisling about ${itemName}`}
    >
      {/* Header */}
      <div className={styles.header}>
        <h2 className={styles.headerTitle}>Chat with Aisling</h2>
        <p className={styles.headerSubtitle}>
          Ask Aisling anything about this item — she can revise her assessment based on what you tell her.
        </p>
      </div>

      {/* Persistent sr-only live region for typing indicator announcements.
          Using a stable element with toggled text avoids screen reader
          mount/unmount announcement issues. */}
      <div className={styles.srOnly} aria-live="polite" role="status">
        {isStreaming ? 'Aisling is typing' : ''}
      </div>

      {/* Message list — role="log" + aria-live so new messages are announced */}
      <ul
        ref={messageListRef}
        className={styles.messageList}
        aria-label="Conversation messages"
        aria-live="polite"
        role="log"
      >
        {isLoadingHistory && (
          <li className={styles.messageItem}>
            <div className={styles.welcomeState}>
              <span className={styles.welcomeIcon} aria-hidden="true">✦</span>
              <p className={styles.welcomeText}>Loading conversation...</p>
            </div>
          </li>
        )}

        {!hasMessages && !isStreaming && !isLoadingHistory && (
          <li className={styles.messageItem}>
            <div className={styles.welcomeState}>
              <span className={styles.welcomeIcon} aria-hidden="true">✦</span>
              <p className={styles.welcomeText}>
                Ask Aisling anything about this item. She can answer questions, give more detail, or revise her recommendation if you share more context.
              </p>
            </div>
          </li>
        )}

        {messages.map((message) => (
          <li key={message.id} className={styles.messageItem}>
            <MessageBubble
              message={message}
              onSendMessage={(text) => sendMessage(itemId, text)}
            />
          </li>
        ))}

        {/* Typing indicator while streaming — purely visual, announcement
            handled by the sr-only status element above */}
        {isStreaming && (
          <li className={styles.messageItem}>
            <div className={styles.typingRow}>
              <div className={styles.typingBubble}>
                <ThinkingDots />
              </div>
            </div>
          </li>
        )}
      </ul>

      {/* Error banner */}
      {error && (
        <div className={styles.errorBanner} role="alert">
          <p className={styles.errorText}>{error}</p>
          <button
            type="button"
            className={styles.errorDismiss}
            onClick={clearError}
            aria-label="Dismiss error"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Input area */}
      <div className={styles.inputArea}>
        <form
          className={styles.inputForm}
          onSubmit={(e) => {
            e.preventDefault()
            handleSend()
          }}
        >
          <textarea
            ref={inputRef}
            className={styles.textarea}
            placeholder="Ask Aisling about this item..."
            disabled={isStreaming}
            rows={1}
            aria-label="Message to Aisling"
            onKeyDown={handleKeyDown}
            onInput={handleInput}
          />
          {/* No aria-label — visible "Send" text satisfies WCAG 2.5.3 */}
          <button
            type="submit"
            className={styles.sendButton}
            disabled={isStreaming}
          >
            <Send size={16} aria-hidden="true" />
            <span>Send</span>
          </button>
        </form>
      </div>
    </section>
  )
}
