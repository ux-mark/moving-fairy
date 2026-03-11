"use client";

import { ThinkingDots } from "@thefairies/design-system/components";
import styles from "./TypingIndicator.module.css";

interface TypingIndicatorProps {
  label?: string;
}

export function TypingIndicator({
  label = "Aisling is thinking...",
}: TypingIndicatorProps) {
  return (
    <div
      className={styles.wrapper}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className={styles.bubble}>
        <div className={styles.row}>
          <ThinkingDots aria-hidden="true" />
          <span className={styles.label}>{label}</span>
        </div>
      </div>
    </div>
  );
}
