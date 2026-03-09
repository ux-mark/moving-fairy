"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LogicEvent {
  id: string;
  type: "tool_call" | "tool_result";
  name: string;
  data: Record<string, unknown>;
  timestamp: number;
}

interface AILogicPanelProps {
  events: LogicEvent[];
  isStreaming: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncate(value: unknown, maxLen = 120): string {
  const str =
    typeof value === "string"
      ? value
      : JSON.stringify(value, null, 2);
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + "…";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AILogicPanel({ events, isStreaming }: AILogicPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events]);

  return (
    <div className="border-t border-border bg-muted/50 font-mono text-xs">
      {/* Panel header */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border/60">
        <span className="text-muted-foreground font-medium tracking-tight">
          AI Logic
        </span>
        {isStreaming && (
          <span className="flex items-center gap-1 text-green-500">
            <span
              className="inline-block size-1.5 rounded-full bg-green-500 animate-pulse"
              aria-hidden="true"
            />
            Live
          </span>
        )}
        {events.length === 0 && (
          <span className="text-muted-foreground/60 text-xs">
            — no events yet
          </span>
        )}
      </div>

      {/* Event list */}
      <div className="overflow-y-auto max-h-36 px-2 py-1 space-y-0.5">
        {events.map((event) => (
          <div
            key={event.id}
            className="flex items-start gap-2 py-0.5 leading-relaxed"
          >
            {/* Type badge */}
            <span
              className={
                event.type === "tool_call"
                  ? "shrink-0 rounded px-1 py-0 bg-blue-500/10 text-blue-500"
                  : "shrink-0 rounded px-1 py-0 bg-emerald-500/10 text-emerald-500"
              }
            >
              {event.type === "tool_call" ? "call" : "result"}
            </span>

            {/* Tool name */}
            <span className="shrink-0 font-semibold text-foreground/80">
              {event.name}
            </span>

            {/* Data preview */}
            <span className="text-muted-foreground/70 truncate">
              {truncate(event.data)}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
