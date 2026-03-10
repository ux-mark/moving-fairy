"use client";

import { useReducedMotion } from "framer-motion";
import styles from "./TypingIndicator.module.css";

interface TypingIndicatorProps {
  label?: string;
}

// NOTE: The DS exports ThinkingDots but the component TSX file does not yet
// exist in the installed package (only Chat.module.css ships). The dots are
// implemented here using the same CSS class names from the DS Chat.module.css
// spec, with a local module that mirrors those styles using DS tokens.
export function TypingIndicator({
  label = "Aisling is thinking...",
}: TypingIndicatorProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div
      className={styles.wrapper}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className={styles.bubble}>
        <div className={styles.row}>
          <span className={styles.dots} aria-hidden="true">
            <span
              className={
                prefersReducedMotion
                  ? styles.dotStatic
                  : styles.dot
              }
            />
            <span
              className={
                prefersReducedMotion
                  ? styles.dotStatic
                  : styles.dot
              }
            />
            <span
              className={
                prefersReducedMotion
                  ? styles.dotStatic
                  : styles.dot
              }
            />
          </span>
          <span className={styles.label}>{label}</span>
        </div>
      </div>
    </div>
  );
}
