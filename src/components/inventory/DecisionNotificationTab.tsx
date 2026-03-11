"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

import styles from "./DecisionNotificationTab.module.css";

export interface DecisionNotificationTabProps {
  count: number;
  onClick: () => void;
  className?: string;
}

/**
 * Fixed tab on the right edge of the viewport that slides in when there are
 * pending decisions (unconfirmed AI assessments). Flashes red on arrival to
 * draw attention, then settles to a persistent red background until clicked.
 */
export function DecisionNotificationTab({
  count,
  onClick,
  className,
}: DecisionNotificationTabProps) {
  const prefersReducedMotion = useReducedMotion();
  const prevCountRef = useRef(count);

  // Whether the tab is in "alert" mode (triggers red flash + persistent red bg)
  const [alertMode, setAlertMode] = useState<"none" | "flash" | "settled">(
    "none"
  );

  // Detect count transitions and update alertMode accordingly.
  // We use a ref to track the previous count value so the effect can
  // read it without re-running on every count change unnecessarily.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const prev = prevCountRef.current;
    prevCountRef.current = count;

    if (prev === 0 && count > 0) {
      // New decisions arrived — trigger flash or instant red
      setAlertMode(prefersReducedMotion ? "settled" : "flash");
    }

    if (count === 0) {
      // All decisions handled — reset
      setAlertMode("none");
    }
    // We intentionally omit prefersReducedMotion from deps: it's a media query
    // value that should not re-run this effect on change, only on count change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  const handleClick = useCallback(() => {
    setAlertMode("none");
    onClick();
  }, [onClick]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleClick();
      }
    },
    [handleClick]
  );

  // Tab is hidden when count is 0 and no alert animation is active
  if (count === 0 && alertMode === "none") {
    return null;
  }

  const badgeLabel = count > 9 ? "9+" : String(count);
  const isAlert = alertMode !== "none";

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`View ${count} pending decision${count === 1 ? "" : "s"}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        styles.tab,
        alertMode === "flash" && styles.tabFlash,
        isAlert && styles.tabAlert,
        className
      )}
    >
      {/* Bell icon */}
      <Bell className={styles.icon} aria-hidden="true" />

      {/* Rotated label — reads top-to-bottom */}
      <span className={styles.label} aria-hidden="true">
        Decisions
      </span>

      {/* Screen reader announcement for count (no visual badge) */}
      <span className="srOnly" aria-live="polite">
        {count} pending decision{count === 1 ? "" : "s"}
      </span>

      {/* TODO: pin toggle — when implemented, add a pin button here that
          keeps the tab visible even when count reaches 0 */}
    </div>
  );
}
