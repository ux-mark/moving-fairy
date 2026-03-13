"use client";

import { useCallback, useEffect, useRef } from "react";
import { Briefcase, Luggage, Package, X as XIcon } from "lucide-react";
import type { Box } from "@/types";
import { BoxType } from "@/lib/constants";
import styles from "./BoxPicker.module.css";

interface BoxPickerProps {
  boxes: Box[];
  /** Number of items already in each box, keyed by box ID */
  itemCounts: Record<string, number>;
  onSelect: (box: Box) => void;
  onDismiss: () => void;
}

function SmallBoxIcon({ boxType }: { boxType: Box["box_type"] }) {
  switch (boxType) {
    case BoxType.CARRYON:
      return <Briefcase style={{ width: 14, height: 14 }} />;
    case BoxType.CHECKED_LUGGAGE:
      return <Luggage style={{ width: 14, height: 14 }} />;
    default:
      return <Package style={{ width: 14, height: 14 }} />;
  }
}

export function BoxPicker({ boxes, itemCounts, onSelect, onDismiss }: BoxPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const firstButtonRef = useRef<HTMLButtonElement>(null);

  // Auto-focus first item when picker opens
  useEffect(() => {
    firstButtonRef.current?.focus();
  }, []);

  // Dismiss on Escape key
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onDismiss();
      }
    },
    [onDismiss]
  );

  // Dismiss on outside click
  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        onDismiss();
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [onDismiss]);

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- dialog requires keyboard handling for Escape dismissal
    <div
      ref={containerRef}
      className={styles.picker}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-label="Assign to box"
      tabIndex={-1}
    >
      <div className={styles.header}>
        <span className={styles.headerLabel}>Assign to box</span>
        <button
          type="button"
          onClick={onDismiss}
          className={styles.dismissButton}
          aria-label="Close box picker"
        >
          <XIcon style={{ width: 14, height: 14 }} />
        </button>
      </div>

      {boxes.length === 0 ? (
        <p className={styles.emptyMessage}>No boxes available for packing.</p>
      ) : (
        <ul className={styles.list} aria-label="Available boxes">
          {[...boxes].sort((a, b) => a.label.localeCompare(b.label)).map((box, index) => {
            const count = itemCounts[box.id] ?? 0;
            return (
              <li key={box.id} className={styles.listItem}>
                <button
                  ref={index === 0 ? firstButtonRef : undefined}
                  type="button"
                  className={styles.listItemButton}
                  onClick={() => onSelect(box)}
                >
                  <SmallBoxIcon boxType={box.box_type} />
                  <span className={styles.listItemLabel}>{box.label}</span>
                  <span className={styles.listItemCount}>
                    {count} {count === 1 ? "item" : "items"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
