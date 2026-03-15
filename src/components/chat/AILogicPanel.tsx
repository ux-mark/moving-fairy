"use client";

import { useEffect, useRef } from "react";
import styles from "./AILogicPanel.module.css";

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
    <div className={styles.panel}>
      {/* Panel header */}
      <div className={styles.header}>
        <span className={styles.title}>AI Logic</span>
        {isStreaming && (
          <span className={styles.live}>
            <span className={styles.liveDot} aria-hidden="true" />
            Live
          </span>
        )}
        {events.length === 0 && (
          <span className={styles.empty}>— no events yet</span>
        )}
      </div>

      {/* Event list */}
      <div className={styles.eventList}>
        {events.map((event) => (
          <div key={event.id} className={styles.eventRow}>
            {/* Type badge */}
            <span
              className={
                event.type === "tool_call"
                  ? styles.badgeCall
                  : styles.badgeResult
              }
            >
              {event.type === "tool_call" ? "call" : "result"}
            </span>

            {/* Tool name */}
            <span className={styles.toolName}>{event.name}</span>

            {/* Data preview */}
            <span className={styles.dataPreview}>
              {truncate(event.data)}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
