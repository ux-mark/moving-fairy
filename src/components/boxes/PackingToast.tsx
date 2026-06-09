"use client";

import { ownerCopy } from "@/lib/copy/owner";

import styles from "./PackingToast.module.css";

interface PackingToastProps {
  message: string;
  variant: "success" | "error";
  /** When provided, an Undo action button is shown alongside the message. */
  onUndo?: (() => void) | undefined;
  onDismiss: () => void;
}

/**
 * Transient packing toast pinned to the bottom of the viewport. Error variant
 * announces assertively (role="alert"); success is polite (role="status").
 */
export function PackingToast({ message, variant, onUndo, onDismiss }: PackingToastProps) {
  return (
    <div
      className={`${styles.toast} ${variant === "error" ? styles.error : styles.success}`}
      role={variant === "error" ? "alert" : "status"}
    >
      <span className={styles.message}>{message}</span>
      {onUndo && (
        <button
          type="button"
          className={styles.undoButton}
          onClick={() => {
            onUndo();
            onDismiss();
          }}
        >
          {ownerCopy.packing.undo}
        </button>
      )}
    </div>
  );
}
