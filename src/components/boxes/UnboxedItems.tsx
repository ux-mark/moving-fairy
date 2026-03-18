"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { ChevronDown, Package } from "lucide-react";

import { VerdictBadge } from "@/components/chat/VerdictBadge";
import type { Box, ItemAssessment } from "@/types";
import { proxyImageUrl } from "@/lib/storage-url";

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
        {[...items].sort((a, b) => a.item_name.localeCompare(b.item_name)).map((item, index) => (
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

  const itemImageUrl = item.image_url ? proxyImageUrl(item.image_url) : undefined;

  return (
    <li
      className={`${styles.row}${!isLast ? ` ${styles.rowBordered}` : ""}`}
    >
      <div className={styles.rowLeft}>
        {itemImageUrl ? (
          <img
            src={itemImageUrl}
            alt=""
            className={styles.itemThumb}
          />
        ) : (
          <div className={styles.itemThumbPlaceholder} aria-hidden="true">
            <Package size={16} />
          </div>
        )}
        <Link
          href={`/decisions/${item.id}?from=boxes`}
          className={styles.itemLink}
        >
          <span className={styles.itemName}>{item.item_name}</span>
        </Link>
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
                {[...availableBoxes].sort((a, b) => a.label.localeCompare(b.label)).map((box) => (
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
