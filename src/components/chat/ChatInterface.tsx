"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Package } from "lucide-react";

import { InputBar } from "@/components/chat/InputBar";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { AILogicPanel, type LogicEvent } from "@/components/chat/AILogicPanel";
import { Button } from "@/components/ui/button";

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

export function ChatInterface() {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingLabel, setStreamingLabel] = useState("Aisling is thinking...");
  const [error, setError] = useState<string | null>(null);
  const [errorCount, setErrorCount] = useState(0);
  const [showAILogic, setShowAILogic] = useState(false);
  const [logicEvents, setLogicEvents] = useState<LogicEvent[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const openingTriggeredRef = useRef(false);

  // Check for session on mount and trigger Aisling's opening message
  useEffect(() => {
    const hasSession = document.cookie.includes("session_id=");
    if (!hasSession) {
      router.push("/onboarding");
      return;
    }
    // Trigger opening message only once on fresh load
    if (!openingTriggeredRef.current) {
      openingTriggeredRef.current = true;
      sendMessage("__opening__", []);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  // Track scroll position for "scroll to bottom" button
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
      setLogicEvents([]);

      const isOpeningTrigger = text === "__opening__";

      // Add user message to the list (suppress internal opening trigger)
      if (!isOpeningTrigger) {
        const userMsg: ChatMessage = {
          id: `user-${Date.now()}`,
          role: "user",
          content: text,
          ...(imageUrls.length > 0 ? { imageUrls } : {}),
        };
        setMessages((prev) => [...prev, userMsg]);
      }

      setIsStreaming(true);
      setStreamingLabel(
        isOpeningTrigger
          ? "Aisling is getting ready..."
          : imageUrls.length > 0
          ? "Aisling is looking at your photo..."
          : "Aisling is thinking..."
      );

      // Create placeholder for assistant message
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

          // Parse SSE events
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") {
                break;
              }

              // Check for structured events
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
                  setLogicEvents((prev) => [...prev, logicEvent]);
                  continue;
                }
              } catch {
                // not JSON event — fall through to text handling
              }

              // Try parsing as JSON text chunk
              let text: string;
              try {
                const parsed = JSON.parse(data);
                text = parsed.text ?? parsed;
              } catch {
                text = data;
              }

              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: m.content + text } : m
                )
              );
            }
          }
        }

        setErrorCount(0);
      } catch (err) {
        const newCount = errorCount + 1;
        setErrorCount(newCount);

        // Remove the empty assistant placeholder
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
        setIsStreaming(false);
      }
    },
    [errorCount]
  );

  const onSendMessage = useCallback(
    (text: string) => sendMessage(text, []),
    [sendMessage]
  );

  return (
    <div className="flex h-svh flex-col bg-background">
      {/* Header */}
      <header className="shrink-0 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <h1 className="text-base font-semibold text-primary">
            Moving Fairy
          </h1>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAILogic((v) => !v)}
              aria-pressed={showAILogic}
              className="gap-1.5 text-xs"
            >
              AI Logic
            </Button>
            <Link href="/boxes">
              <Button variant="ghost" size="sm" className="gap-1.5">
                <Package className="size-4" />
                Boxes
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto"
        onScroll={handleScroll}
      >
        <div className="mx-auto max-w-2xl py-4">
          {messages.length === 0 && !isStreaming && (
            <div className="flex flex-col items-center gap-3 py-16 text-center px-4">
              <p className="text-base text-muted-foreground">
                Aisling is getting ready... give her a moment.
              </p>
            </div>
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

          {/* Error */}
          {error && (
            <div className="px-4 py-2">
              <div className="rounded-lg bg-destructive/10 px-4 py-3" role="alert">
                <p className="text-sm text-destructive">{error}</p>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  className="mt-2 text-sm font-medium text-destructive underline underline-offset-2"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Scroll to bottom button */}
      {showScrollButton && (
        <div className="absolute bottom-28 left-1/2 -translate-x-1/2">
          <button
            type="button"
            onClick={scrollToBottom}
            className="rounded-full bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-md ring-1 ring-border transition-colors hover:bg-muted"
          >
            Scroll to bottom
          </button>
        </div>
      )}

      {/* AI Logic Panel */}
      {showAILogic && (
        <div className="shrink-0 max-h-48 overflow-hidden transition-all">
          <div className="mx-auto max-w-2xl">
            <AILogicPanel events={logicEvents} isStreaming={isStreaming} />
          </div>
        </div>
      )}

      {/* Input bar */}
      <div className="shrink-0">
        <div className="mx-auto max-w-2xl">
          <InputBar onSend={sendMessage} disabled={isStreaming} />
        </div>
      </div>
    </div>
  );
}
