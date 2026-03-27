"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

import styles from "./FlagIndicator.module.css";

interface FlagIndicatorProps {
  count: number;
}

export function FlagIndicator({ count }: FlagIndicatorProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.span
          className={styles.dot}
          aria-label={`${count} ${count === 1 ? "item needs" : "items need"} attention`}
          role="status"
          initial={prefersReducedMotion ? false : { scale: 0 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0, transition: prefersReducedMotion ? { duration: 0 } : { duration: 0.15, ease: "easeIn" } }}
          transition={
            prefersReducedMotion
              ? { duration: 0 }
              : { type: "spring", stiffness: 400, damping: 25 }
          }
        />
      )}
    </AnimatePresence>
  );
}
