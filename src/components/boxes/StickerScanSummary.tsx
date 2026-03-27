"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Spinner, ThinkingDots, Button } from "@thefairies/design-system/components";

import styles from "./StickerScanSummary.module.css";

interface StickerScanSummaryProps {
  status: "uploading" | "processing" | "partial" | "complete" | "error";
  totalFound: number;
  matchedCount: number;
  newCount: number;
  flaggedCount: number;
  illegibleCount: number;
  errorMessage?: string;
  onRetry?: () => void;
}

function buildCompleteMessage({
  totalFound,
  matchedCount,
  newCount,
  flaggedCount,
  illegibleCount,
}: Pick<
  StickerScanSummaryProps,
  "totalFound" | "matchedCount" | "newCount" | "flaggedCount" | "illegibleCount"
>): React.ReactNode {
  if (totalFound === 0) {
    return (
      <>
        Aisling could not find any item names on this sticker. The handwriting
        may be too faint or the photo too blurry. Try taking another photo in
        better light.
      </>
    );
  }

  const itemWord = totalFound === 1 ? "item" : "items";
  const base = `Found ${totalFound} ${itemWord} on your sticker.`;

  const parts: React.ReactNode[] = [base + " "];

  // Build the matched/new summary
  if (matchedCount > 0 && newCount === 0 && flaggedCount === 0) {
    parts.push("All matched items you have already assessed.");
  } else if (matchedCount > 0 && newCount > 0 && flaggedCount === 0) {
    parts.push(
      `${matchedCount} matched your existing items, ${newCount} are new and being assessed.`
    );
  } else if (flaggedCount > 0) {
    if (matchedCount > 0 && newCount > 0) {
      parts.push(`${matchedCount} matched, ${newCount} are new. `);
    } else if (matchedCount > 0) {
      parts.push(`${matchedCount} matched. `);
    }
    const flagWord = flaggedCount === 1 ? "item needs" : "items need";
    parts.push(
      <span key="flagged" className={styles.flaggedCount}>
        {flaggedCount} {flagWord} your attention.
      </span>
    );
    parts.push(" ");
  }

  if (illegibleCount > 0) {
    const entryWord = illegibleCount === 1 ? "entry" : "entries";
    parts.push(
      `${illegibleCount} ${entryWord} could not be read -- you can add ${illegibleCount === 1 ? "it" : "them"} manually below.`
    );
  }

  return <>{parts}</>;
}

export function StickerScanSummary({
  status,
  totalFound,
  matchedCount,
  newCount,
  flaggedCount,
  illegibleCount,
  errorMessage,
  onRetry,
}: StickerScanSummaryProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      className={styles.wrap}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      initial={prefersReducedMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.2, ease: "easeOut" }}
    >
      {status === "uploading" && (
        <div className={styles.row}>
          <Spinner size="sm" aria-hidden />
          <span>Uploading your sticker photo...</span>
        </div>
      )}

      {status === "processing" && (
        <div className={styles.row}>
          <ThinkingDots />
          <span>Aisling is reading your sticker...</span>
        </div>
      )}

      {status === "partial" && (
        <div className={styles.row}>
          <ThinkingDots />
          <span>
            Reading your sticker...{" "}
            {totalFound > 0 && (
              <>
                Found{" "}
                <motion.span
                  key={totalFound}
                  initial={prefersReducedMotion ? false : { scale: 1.05 }}
                  animate={{ scale: 1 }}
                  transition={
                    prefersReducedMotion
                      ? { duration: 0 }
                      : { duration: 0.2, ease: "easeOut" }
                  }
                  style={{ display: "inline-block" }}
                >
                  {totalFound}
                </motion.span>{" "}
                {totalFound === 1 ? "item" : "items"} so far
              </>
            )}
          </span>
        </div>
      )}

      {status === "complete" && (
        <div className={styles.completedText}>
          {buildCompleteMessage({
            totalFound,
            matchedCount,
            newCount,
            flaggedCount,
            illegibleCount,
          })}
        </div>
      )}

      {status === "error" && (
        <div className={styles.errorRow}>
          <p className={styles.errorText}>
            {errorMessage ?? "Something went wrong while scanning your sticker. Please try again."}
          </p>
          {onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
            >
              Try again
            </Button>
          )}
        </div>
      )}
    </motion.div>
  );
}
