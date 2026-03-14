"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";

import { EmptyState } from "@thefairies/design-system/components";
import { InputBar } from "@/components/chat/InputBar";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import type { LogicEvent } from "@/components/chat/AILogicPanel";
import { triggerInventoryRefresh } from "@/lib/hooks/useInventory";
import styles from "./ChatInterface.module.css";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  imageUrls?: string[];
  type?: "text" | "card";
  card?: {
    item: string;
    verdict: string;
    confidence: number;
    rationale: string;
    action: string;
    import_note?: string;
    item_description?: string;
    image_url?: string;
    voltage_compatible?: boolean;
    needs_transformer?: boolean;
    estimated_ship_cost_usd?: number;
    currency?: string;
    estimated_replace_cost_usd?: number;
    replace_currency?: string;
  };
}

export interface ChatInterfaceHandle {
  /** Programmatically send a text message as if the user typed it */
  sendMessage: (text: string) => void;
}

interface ChatInterfaceProps {
  /** Called when a new logic event arrives */
  onLogicEvent?: (event: LogicEvent) => void;
  /** Called when streaming state changes */
  onStreamingChange?: (isStreaming: boolean) => void;
}

// HMR-safe session init guard. Module-level variables reset when Next.js HMR
// re-evaluates the module, but window properties persist. This prevents the
// session check / welcome-back flow from re-firing during long CLI calls.
function isSessionInitialized(): boolean {
  return typeof window !== "undefined" && !!(window as unknown as Record<string, unknown>).__aislingSessionInit;
}
function markSessionInitialized(): void {
  if (typeof window !== "undefined") {
    (window as unknown as Record<string, unknown>).__aislingSessionInit = true;
  }
}

export const ChatInterface = forwardRef<ChatInterfaceHandle, ChatInterfaceProps>(
  function ChatInterface({ onLogicEvent, onStreamingChange }, ref) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingLabel, setStreamingLabel] = useState("Aisling is thinking...");
  const [error, setError] = useState<string | null>(null);
  const [errorCount, setErrorCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced inventory refresh — collapses rapid-fire card events into one refresh
  const debouncedRefresh = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => {
      triggerInventoryRefresh();
      refreshTimerRef.current = null;
    }, 500);
  }, []);

  const updateIsStreaming = useCallback(
    (val: boolean) => {
      setIsStreaming(val);
      onStreamingChange?.(val);
    },
    [onStreamingChange]
  );

  useEffect(() => {
    if (isSessionInitialized()) return;
    markSessionInitialized();

    fetch("/api/session")
      .then((res) => res.json())
      .then((data) => {
        if (!data.ok) {
          sendMessage("__opening__", []);
          return;
        }

        if (data.has_history && data.recent_messages?.length > 0) {
          const restored: ChatMessage[] = data.recent_messages.map(
            (m: { id: string; role: string; content: string }) => ({
              id: m.id,
              role: m.role as "user" | "assistant",
              content: m.content,
            })
          );
          setMessages(restored);
          sendMessage("__welcome_back__", []);
        } else {
          sendMessage("__opening__", []);
        }
      })
      .catch(() => {
        sendMessage("__opening__", []);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    setShowScrollButton(!isNearBottom);
  }, []);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const sendMessage = useCallback(
    async (text: string, imageUrls: string[]) => {
      setError(null);

      const isOpeningTrigger = text === "__opening__";
      const isWelcomeBack = text === "__welcome_back__";
      const isInternalTrigger = isOpeningTrigger || isWelcomeBack;

      if (!isInternalTrigger) {
        const userMsg: ChatMessage = {
          id: `user-${Date.now()}`,
          role: "user",
          content: text,
          ...(imageUrls.length > 0 ? { imageUrls } : {}),
        };
        setMessages((prev) => [...prev, userMsg]);
      }

      updateIsStreaming(true);
      setStreamingLabel(
        isOpeningTrigger
          ? "Aisling is getting ready..."
          : isWelcomeBack
          ? "Aisling is checking in..."
          : imageUrls.length > 0
          ? "Aisling is looking at your photo..."
          : "Aisling is thinking..."
      );

      const assistantId = `assistant-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "" },
      ]);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            image_urls: imageUrls.length > 0 ? imageUrls : undefined,
          }),
        });

        if (!res.ok) {
          throw new Error(`Failed to get response (${res.status})`);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response stream");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") {
                break;
              }

              try {
                const parsed = JSON.parse(data);
                if (parsed.__type === "card") {
                  const cardMsgId = `card-${Date.now()}-${Math.random().toString(36).slice(2)}`;
                  setMessages((prev) => [
                    ...prev,
                    {
                      id: cardMsgId,
                      role: "assistant" as const,
                      content: "",
                      type: "card" as const,
                      card: {
                        item: parsed.item,
                        verdict: parsed.verdict,
                        confidence: parsed.confidence,
                        rationale: parsed.rationale,
                        action: parsed.action,
                        import_note: parsed.import_note,
                        item_description: parsed.item_description,
                        image_url: parsed.image_url,
                        voltage_compatible: parsed.voltage_compatible,
                        needs_transformer: parsed.needs_transformer,
                        estimated_ship_cost_usd: parsed.estimated_ship_cost_usd,
                        currency: parsed.currency,
                        estimated_replace_cost_usd: parsed.estimated_replace_cost_usd,
                        replace_currency: parsed.replace_currency,
                      },
                    },
                  ]);
                  // Refresh sidebar so it reflects the new/updated assessment
                  debouncedRefresh();
                  continue;
                }
                if (
                  parsed.__type === "tool_call" ||
                  parsed.__type === "tool_result"
                ) {
                  const logicEvent: LogicEvent = {
                    id: `logic-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                    type: parsed.__type as "tool_call" | "tool_result",
                    name: parsed.name as string,
                    data: (parsed.input ?? parsed.result ?? {}) as Record<string, unknown>,
                    timestamp: Date.now(),
                  };
                  onLogicEvent?.(logicEvent);
                  // Refresh sidebar after write operations complete
                  if (parsed.__type === "tool_result") {
                    const writeTool = [
                      "save_item_assessment", "update_item_assessment",
                      "create_box", "add_item_to_box", "remove_item_from_box",
                      "set_all_boxes_shipped",
                    ];
                    if (writeTool.includes(parsed.name as string)) {
                      debouncedRefresh();
                    }
                  }
                  continue;
                }
              } catch {
                // not JSON — fall through
              }

              let chunkText: string;
              try {
                const parsed = JSON.parse(data);
                if (typeof parsed === 'string') {
                  chunkText = parsed;
                } else if (typeof parsed?.text === 'string') {
                  chunkText = parsed.text;
                } else {
                  // Skip non-string JSON payloads (error objects, metadata, etc.)
                  continue;
                }
              } catch {
                chunkText = data;
              }

              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: m.content + chunkText } : m
                )
              );
            }
          }
        }

        setErrorCount(0);
      } catch (err) {
        const newCount = errorCount + 1;
        setErrorCount(newCount);

        setMessages((prev) => prev.filter((m) => m.id !== assistantId));

        if (newCount >= 3) {
          setError(
            "Something\u2019s not right, and it\u2019s not you. We\u2019re looking into it. You can try again later \u2014 your move details and packing list are saved."
          );
        } else {
          setError(
            err instanceof Error
              ? err.message
              : "Aisling is having a moment \u2014 something went wrong on our end. Your conversation is saved. Try sending your message again."
          );
        }
      } finally {
        updateIsStreaming(false);
      }
    },
    [errorCount, onLogicEvent, updateIsStreaming]
  );

  const onSendMessage = useCallback(
    (text: string) => sendMessage(text, []),
    [sendMessage]
  );

  useImperativeHandle(ref, () => ({
    sendMessage: (text: string) => sendMessage(text, []),
  }), [sendMessage]);

  return (
    <div className={styles.root}>
      <div
        ref={scrollRef}
        className={styles.messagesScroll}
        onScroll={handleScroll}
      >
        <div className={styles.messagesInner}>
          {messages.length === 0 && !isStreaming && (
            <EmptyState
              heading="Getting ready"
              description="Aisling is getting ready... give her a moment."
              variant="subtle"
            />
          )}

          <div role="log" aria-live="polite" aria-label="Chat messages">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} onSendMessage={onSendMessage} />
            ))}
          </div>

          {isStreaming &&
            messages[messages.length - 1]?.content === "" && (
              <TypingIndicator label={streamingLabel} />
            )}

          {error && (
            <div className={styles.errorWrapper}>
              <div className={styles.errorBox} role="alert">
                <p className={styles.errorText}>{error}</p>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  className={styles.errorDismiss}
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {showScrollButton && (
          <div className={styles.scrollButtonWrapper}>
            <button
              type="button"
              onClick={scrollToBottom}
              className={styles.scrollButton}
            >
              Scroll to bottom
            </button>
          </div>
        )}
      </div>

      <div className={styles.inputWrapper}>
        <InputBar onSend={sendMessage} disabled={isStreaming} />
      </div>
    </div>
  );
});
ChatInterface.displayName = "ChatInterface";
