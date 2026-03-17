'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Send, ChevronDown, ChevronUp, Maximize2, ArrowLeft, X as XIcon } from 'lucide-react'
import { ThinkingDots } from '@thefairies/design-system/components'
import { MessageBubble } from '@/components/chat/MessageBubble'
import { usePerItemChat } from '@/lib/hooks/usePerItemChat'
import type { ItemAssessment } from '@/types'
import styles from './PerItemChat.module.css'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PerItemChatProps {
  itemId: string
  itemName: string
  thumbnailUrl?: string | undefined
  onAssessmentUpdated?: ((updated: ItemAssessment) => void) | undefined
  fullscreenTriggerRef?: React.RefObject<HTMLButtonElement | null> | undefined
  /** Controlled fullscreen state — managed by the parent */
  isFullscreen?: boolean
  onToggleFullscreen?: () => void
  /** Increment to trigger a history re-fetch (e.g. after saving an edit). */
  chatRefreshTrigger?: number | undefined
  /** Called when the user closes the chat sheet (non-fullscreen only). */
  onCollapse?: () => void
  /** Navigation back to the list page (Decisions or Boxes). */
  backHref?: string | undefined
  backLabel?: string | undefined
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PerItemChat({
  itemId,
  itemName,
  thumbnailUrl,
  onAssessmentUpdated,
  fullscreenTriggerRef,
  isFullscreen = false,
  onToggleFullscreen,
  chatRefreshTrigger,
  onCollapse,
  backHref,
  backLabel,
}: PerItemChatProps) {
  const { messages, isStreaming, isLoadingHistory, error, toolStatus, loadHistory, sendMessage, clearError } =
    usePerItemChat({
      ...(onAssessmentUpdated ? { onAssessmentUpdated } : {}),
      ...(chatRefreshTrigger !== undefined ? { refreshTrigger: chatRefreshTrigger } : {}),
    })

  const messageListRef = useRef<HTMLUListElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const loadedRef = useRef<string | null>(null)

  // Collapsed state (only meaningful in non-fullscreen mode)
  const [isCollapsed, setIsCollapsed] = useState(true)

  // Track whether streaming has ever occurred so we only focus-return post-stream,
  // not on initial mount.
  const hasStreamedRef = useRef(false)

  // Load conversation history on mount (or when itemId changes)
  useEffect(() => {
    if (loadedRef.current === itemId) return
    loadedRef.current = itemId
    loadHistory(itemId)
  }, [itemId, loadHistory])

  // Auto-scroll to bottom when messages update or streaming ends.
  // Use instant scrolling during streaming to avoid animation buildup jank;
  // smooth scroll only for the final settled state.
  useEffect(() => {
    const list = messageListRef.current
    if (!list) return
    list.scrollTo({ top: list.scrollHeight, behavior: isStreaming ? 'instant' : 'smooth' })
  }, [messages, isStreaming])

  // Return focus to input after streaming ends — but not on initial mount
  useEffect(() => {
    if (isStreaming) {
      hasStreamedRef.current = true
    } else if (hasStreamedRef.current) {
      inputRef.current?.focus()
    }
  }, [isStreaming])

  // Auto-expand when conversation history loads (the send path already calls
  // setIsCollapsed(false) directly, so this only needs to cover loaded history).
  useEffect(() => {
    if (messages.length > 0) {
      setIsCollapsed(false)
    }
    // We only want to run this when history first loads — messages going from
    // 0 → N. After that, handleSend keeps the panel expanded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingHistory])

  // Focus the input when entering fullscreen
  useEffect(() => {
    if (isFullscreen) {
      inputRef.current?.focus()
    } else if (fullscreenTriggerRef?.current) {
      fullscreenTriggerRef.current.focus()
    }
  }, [isFullscreen, fullscreenTriggerRef])

  // Handle Escape key to exit fullscreen
  useEffect(() => {
    if (!isFullscreen) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onToggleFullscreen?.()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isFullscreen, onToggleFullscreen])

  const handleSend = useCallback(() => {
    const value = inputRef.current?.value.trim() ?? ''
    if (!value || isStreaming) return
    if (inputRef.current) inputRef.current.value = ''
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
    }
    // Auto-expand to fullscreen on send so the user stays in the chat view
    if (!isFullscreen && onToggleFullscreen) {
      onToggleFullscreen()
    }
    setIsCollapsed(false)
    sendMessage(itemId, value)
  }, [itemId, isStreaming, isFullscreen, onToggleFullscreen, sendMessage])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
      if (e.key === 'Escape') {
        e.stopPropagation()
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

  // Filter out card messages — assessment updates appear in the edit panel instead
  const visibleMessages = messages.filter((m) => m.type !== 'card')
  const hasMessages = visibleMessages.length > 0

  // ---------------------------------------------------------------------------
  // Shared input area (used in both normal and full-screen layouts)
  // ---------------------------------------------------------------------------

  const inputArea = (
    <div className={`${styles.inputArea}${isFullscreen ? ` ${styles.inputAreaFullscreen}` : ''}`}>
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
        <button
          type="submit"
          className={styles.sendButton}
          disabled={isStreaming}
          aria-label={isStreaming ? 'Send message (waiting for Aisling to finish)' : 'Send message'}
        >
          <Send size={16} aria-hidden="true" />
          <span>Send</span>
        </button>
      </form>
    </div>
  )

  // ---------------------------------------------------------------------------
  // Full-screen layout (fills parent container — nav remains visible above)
  // ---------------------------------------------------------------------------

  if (isFullscreen) {
    return (
      <section
        className={styles.fullscreenRoot}
        aria-label={`Chat with Aisling about ${itemName}`}
      >
        {/* Persistent sr-only live region */}
        <div className={styles.srOnly} aria-live="polite" role="status">
          {isStreaming ? 'Aisling is typing' : ''}
        </div>

        {/* Full-screen header: back nav + chat header */}
        <div className={styles.fullscreenHeaderStack}>
          {/* Row 1: Back to Decisions/Boxes */}
          {backHref && (
            <div className={styles.fullscreenNavRow}>
              <Link href={backHref} className={styles.fullscreenBackLink}>
                <ArrowLeft size={16} aria-hidden="true" />
                <span>{backLabel ?? 'Back'}</span>
              </Link>
            </div>
          )}
          {/* Row 2: Chat header with item context */}
          <div className={styles.fullscreenChatRow}>
            <h2 className={styles.fullscreenChatTitle}>Chat with Aisling</h2>
            <div className={styles.fullscreenHeaderRight}>
              <span className={styles.fullscreenItemName}>{itemName}</span>
              {thumbnailUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={thumbnailUrl}
                  alt=""
                  className={styles.fullscreenThumb}
                  aria-hidden="true"
                />
              )}
            </div>
          </div>
        </div>

        {/* Message list */}
        <ul
          ref={messageListRef}
          className={styles.messageList}
          aria-label="Conversation messages"
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
          {visibleMessages.map((message) => (
            <li key={message.id} className={styles.messageItem}>
              <MessageBubble
                message={message}
                onSendMessage={(text) => sendMessage(itemId, text)}
              />
            </li>
          ))}
          {isStreaming && (
            <li className={styles.messageItem}>
              <div className={styles.typingRow}>
                <div className={styles.typingBubble}>
                  <ThinkingDots />
                  {toolStatus && (
                    <span className={styles.toolStatusText}>{toolStatus}</span>
                  )}
                </div>
              </div>
            </li>
          )}
        </ul>

        {inputArea}
      </section>
    )
  }

  // ---------------------------------------------------------------------------
  // Normal (collapsible) layout
  // ---------------------------------------------------------------------------

  return (
    <section
      className={styles.root}
      aria-label={`Chat with Aisling about ${itemName}`}
    >
      {/* Persistent sr-only live region */}
      <div className={styles.srOnly} aria-live="polite" role="status">
        {isStreaming ? 'Aisling is typing' : ''}
      </div>

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerRow}>
          <h2 className={styles.headerTitle}>Chat with Aisling</h2>
          <div className={styles.headerActions}>
            {/* Full-screen toggle */}
            <button
              ref={fullscreenTriggerRef as React.RefObject<HTMLButtonElement>}
              type="button"
              className={styles.headerIconButton}
              onClick={onToggleFullscreen}
              aria-label="Open full-screen chat"
              title="Full-screen chat"
            >
              <Maximize2 size={16} aria-hidden="true" />
            </button>
            {/* Collapse toggle (inline expand/collapse) */}
            <button
              type="button"
              className={styles.headerIconButton}
              onClick={() => setIsCollapsed((c) => !c)}
              aria-expanded={!isCollapsed}
              aria-controls="per-item-chat-messages"
              aria-label={isCollapsed ? 'Expand chat' : 'Collapse chat'}
            >
              {isCollapsed
                ? <ChevronDown size={16} aria-hidden="true" />
                : <ChevronUp size={16} aria-hidden="true" />
              }
            </button>
            {/* Close sheet button — only shown when parent provides onCollapse */}
            {onCollapse && (
              <button
                type="button"
                className={styles.headerIconButton}
                onClick={onCollapse}
                aria-label="Close chat"
                title="Close chat"
              >
                <XIcon size={16} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
        {!isCollapsed && (
          <p className={styles.headerSubtitle}>
            Ask Aisling anything about this item — she can revise her assessment based on what you tell her.
          </p>
        )}
      </div>

      {/* Message list — hidden when collapsed */}
      {!isCollapsed && (
        <ul
          id="per-item-chat-messages"
          ref={messageListRef}
          className={styles.messageList}
          aria-label="Conversation messages"
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

          {visibleMessages.map((message) => (
            <li key={message.id} className={styles.messageItem}>
              <MessageBubble
                message={message}
                onSendMessage={(text) => sendMessage(itemId, text)}
              />
            </li>
          ))}

          {isStreaming && (
            <li className={styles.messageItem}>
              <div className={styles.typingRow}>
                <div className={styles.typingBubble}>
                  <ThinkingDots />
                  {toolStatus && (
                    <span className={styles.toolStatusText}>{toolStatus}</span>
                  )}
                </div>
              </div>
            </li>
          )}
        </ul>
      )}

      {inputArea}
    </section>
  )
}
