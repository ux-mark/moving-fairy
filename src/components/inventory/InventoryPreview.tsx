"use client";

import { ChevronUp } from "lucide-react";

import styles from "./InventoryPreview.module.css";

interface InventoryPreviewProps {
  itemCount: number;
  estimatedCost: number | null;
  currency: string;
  onExpand: () => void;
}

function formatCost(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Compact preview strip shown on mobile when the user has assessed items.
 * Displays item count and estimated shipping cost, with a button to expand
 * the full inventory bottom sheet.
 */
export function InventoryPreview({
  itemCount,
  estimatedCost,
  currency,
  onExpand,
}: InventoryPreviewProps) {
  if (itemCount <= 0) return null;

  const costLabel =
    estimatedCost != null ? `~${formatCost(estimatedCost, currency)}` : null;

  return (
    <div
      className={styles.strip}
      role="region"
      aria-label={`Inventory summary: ${itemCount} ${itemCount === 1 ? "item" : "items"}${costLabel ? `, estimated cost ${costLabel}` : ""}`}
    >
      <span className={styles.summary}>
        {itemCount} {itemCount === 1 ? "item" : "items"}
        {costLabel && (
          <>
            <span className={styles.separator} aria-hidden="true">
              |
            </span>
            <span className={styles.cost}>{costLabel}</span>
          </>
        )}
      </span>

      <button
        type="button"
        className={styles.expandButton}
        onClick={onExpand}
        aria-label="View inventory"
      >
        View
        <ChevronUp size={16} />
      </button>
    </div>
  );
}
