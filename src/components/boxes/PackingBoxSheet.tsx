"use client";

import { useEffect, useMemo, useRef } from "react";
import { Plus, Check } from "lucide-react";

import type { Box } from "@/types";
import { ownerCopy } from "@/lib/copy/owner";
import { BoxPill } from "./BoxPill";

import styles from "./BoxList.module.css";

/**
 * Mobile bottom-sheet box picker. Used by the sticky "Packing into" bar and by
 * the per-row "add to another box" one-off on `UnboxedItems`.
 */
export function PackingBoxSheet({
  packingBoxes,
  activeBoxId,
  onSelect,
  onClose,
  onNewBox,
  heading = ownerCopy.packing.activeBoxHeading,
}: {
  packingBoxes: Box[];
  activeBoxId: string | null;
  onSelect: (boxId: string) => void;
  onClose: () => void;
  onNewBox?: (() => void) | undefined;
  heading?: string;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const sorted = useMemo(
    () => [...packingBoxes].sort((a, b) => a.label.localeCompare(b.label)),
    [packingBoxes],
  );

  // Close on Escape (document-level, matching VerdictPicker/BoxPicker).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className={styles.sheetLayer}>
      {/* Backdrop — click outside to dismiss. aria-hidden so it's not exposed
          to AT; the dialog + close button carry the semantics. */}
      <div className={styles.sheetBackdrop} aria-hidden="true" onClick={onClose} />
      <div ref={sheetRef} className={styles.sheet} role="dialog" aria-label={heading}>
        <div className={styles.sheetHeader}>
          <span className={styles.sheetHeading}>{heading}</span>
          <button
            type="button"
            className={styles.sheetClose}
            onClick={onClose}
            aria-label="Close box picker"
          >
            ×
          </button>
        </div>
        <ul role="listbox" aria-label={heading} className={styles.sheetList}>
          {sorted.map((box) => {
            const selected = box.id === activeBoxId;
            return (
              <li key={box.id} role="option" aria-selected={selected}>
                <button
                  type="button"
                  className={styles.sheetOption}
                  onClick={() => onSelect(box.id)}
                >
                  {selected && (
                    <Check style={{ width: 16, height: 16, flexShrink: 0 }} aria-hidden />
                  )}
                  <BoxPill code={box.label} name={box.room_name} className={styles.sheetOptionLabel} />
                </button>
              </li>
            );
          })}
        </ul>
        {onNewBox && (
          <div className={styles.sheetFooter}>
            <button type="button" className={styles.sheetNewBox} onClick={onNewBox}>
              <Plus style={{ width: 16, height: 16 }} aria-hidden />
              {ownerCopy.packing.newBox}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
