"use client";

import { useState, useCallback } from "react";
import { ChevronDown } from "lucide-react";

import { VerdictBadge } from "@/components/chat/VerdictBadge";
import type { Box, ItemAssessment } from "@/types";

import styles from "./UnboxedItems.module.css";

interface UnboxedItemsProps {
  items: ItemAssessment[];
  /** Boxes in packing status that items can be added to */
  availableBoxes: Box[];
  onAddToBox?: ((itemAssessmentId: string, boxId: string) => void) | undefined;
}

export function UnboxedItems({
  items,
  availableBoxes,
  onAddToBox,
}: UnboxedItemsProps) {
  if (items.length === 0) {
    return (
      <div className={styles.allBoxed}>
        <p className={styles.allBoxedText}>{"Everything's boxed up. Nice work."}</p>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <h3 className={styles.heading}>
        Not yet boxed{" "}
        <span className={styles.headingCount}>
          ({items.length} {items.length === 1 ? "item" : "items"})
        </span>
      </h3>
      <ul className={styles.list}>
        {items.map((item, index) => (
          <UnboxedItemRow
            key={item.id}
            item={item}
            availableBoxes={availableBoxes}
            {...(onAddToBox ? { onAddToBox } : {})}
            isLast={index === items.length - 1}
          />
        ))}
      </ul>
    </div>
  );
}

function UnboxedItemRow({
  item,
  availableBoxes,
  onAddToBox,
  isLast,
}: {
  item: ItemAssessment;
  availableBoxes: Box[];
  onAddToBox?: ((itemAssessmentId: string, boxId: string) => void) | undefined;
  isLast: boolean;
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const handleSelect = useCallback(
    (boxId: string) => {
      onAddToBox?.(item.id, boxId);
      setDropdownOpen(false);
    },
    [item.id, onAddToBox]
  );

  return (
    <li
      className={`${styles.row}${!isLast ? ` ${styles.rowBordered}` : ""}`}
    >
      <div className={styles.rowLeft}>
        <span className={styles.itemName}>{item.item_name}</span>
        <VerdictBadge
          verdict={item.verdict}
        />
      </div>

      {onAddToBox && availableBoxes.length > 0 && (
        <div className={styles.dropdownWrap}>
          <button
            type="button"
            onClick={() => setDropdownOpen((prev) => !prev)}
            className={styles.dropdownTrigger}
            aria-expanded={dropdownOpen}
            aria-haspopup="listbox"
            aria-label={`Add ${item.item_name} to a box`}
          >
            Add to box
            <ChevronDown style={{ width: 12, height: 12 }} />
          </button>

          {dropdownOpen && (
            <>
              <div
                className={styles.backdrop}
                onClick={() => setDropdownOpen(false)}
                aria-hidden="true"
              />
              <ul
                role="listbox"
                aria-label={`Available boxes for ${item.item_name}`}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setDropdownOpen(false);
                }}
                className={styles.dropdownMenu}
              >
                {availableBoxes.map((box) => (
                  <li key={box.id} role="option" aria-selected={false} className={styles.dropdownItem}>
                    <button
                      type="button"
                      onClick={() => handleSelect(box.id)}
                      className={styles.dropdownItemButton}
                    >
                      {box.label}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </li>
  );
}
