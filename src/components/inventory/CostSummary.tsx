"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Package, TrendingUp } from "lucide-react";
import { Badge } from "@thefairies/design-system/components";
import type { CostStripTag } from "@thefairies/design-system/components";

import styles from "./CostSummary.module.css";
import { cn } from "@/lib/utils";

export interface CostSummaryData {
  counts_by_verdict: Record<string, number>;
  total_estimated_ship_cost: number;
  currency: string;
}

interface CostSummaryProps {
  data: CostSummaryData;
  variant: "full" | "compact";
  className?: string;
}

// DS token colours per verdict
const VERDICT_COLORS: Record<string, { bgColor: string; fgColor: string }> = {
  SHIP: { bgColor: "var(--verdict-ship-bg, #d1fae5)", fgColor: "var(--verdict-ship-fg, #065f46)" },
  CARRY: { bgColor: "var(--verdict-carry-bg, #d1fae5)", fgColor: "var(--verdict-carry-fg, #065f46)" },
  SELL: { bgColor: "var(--verdict-sell-bg, #fef3c7)", fgColor: "var(--verdict-sell-fg, #92400e)" },
  DONATE: { bgColor: "var(--verdict-donate-bg, #f3f4f6)", fgColor: "var(--verdict-donate-fg, #374151)" },
  DISCARD: { bgColor: "var(--verdict-discard-bg, #f3f4f6)", fgColor: "var(--verdict-discard-fg, #374151)" },
  DECIDE_LATER: { bgColor: "var(--verdict-decide-later-bg, #dbeafe)", fgColor: "var(--verdict-decide-later-fg, #1e40af)" },
};

function AnimatedNumber({
  value,
  className,
}: {
  value: string | number;
  className?: string;
}) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.span
      key={String(value)}
      initial={prefersReducedMotion ? false : { scale: 1 }}
      animate={prefersReducedMotion ? {} : { scale: [1, 1.1, 1] }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={cn(styles.tabularNums, className)}
    >
      {value}
    </motion.span>
  );
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function CostSummary({ data, variant, className }: CostSummaryProps) {
  const { counts_by_verdict, total_estimated_ship_cost, currency } = data;
  const formattedCost = formatCurrency(total_estimated_ship_cost, currency);
  const totalItems = Object.values(counts_by_verdict).reduce((sum, n) => sum + n, 0);

  const tags: CostStripTag[] = Object.entries(counts_by_verdict)
    .filter(([, count]) => count > 0)
    .map(([verdict, count]) => {
      const colors = VERDICT_COLORS[verdict] ?? {
        bgColor: "var(--color-bg-subtle)",
        fgColor: "var(--color-text-muted)",
      };
      const verdictLabel = verdict
        .replace("_", " ")
        .toLowerCase()
        .replace(/^\w/, (c) => c.toUpperCase());
      return {
        label: `${count} ${verdictLabel}`,
        bgColor: colors.bgColor,
        fgColor: colors.fgColor,
      };
    });

  if (variant === "compact") {
    return (
      <div
        className={cn(styles.compact, className)}
        aria-label={`Estimated shipping cost: ${formattedCost}, ${totalItems} ${totalItems === 1 ? "item" : "items"} assessed`}
      >
        <div className={styles.compactCost} aria-hidden="true">
          <TrendingUp style={{ width: 14, height: 14, color: "var(--color-text-muted)" }} />
          <AnimatedNumber value={formattedCost} />
        </div>
        <span className={styles.compactItems} aria-hidden="true">
          <Package style={{ width: 14, height: 14 }} />
          <AnimatedNumber value={totalItems} />
          {" "}
          {totalItems === 1 ? "item" : "items"}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(styles.full, className)}
      aria-label={`Estimated shipping cost: ${formattedCost} ${currency}, ${totalItems} ${totalItems === 1 ? "item" : "items"} assessed`}
      role="region"
    >
      <div className={styles.mainRow}>
        <div className={styles.totalLabelBlock}>
          <p className={styles.totalLabel}>Est. Shipping</p>
          <AnimatedNumber value={formattedCost} className={styles.totalValue ?? ""} />
          <p className={styles.currencyLabel}>{currency}</p>
        </div>
        <span className={styles.itemCount}>
          <AnimatedNumber value={totalItems} /> {totalItems === 1 ? "item" : "items"}
        </span>
      </div>

      <div className={styles.tagsRow}>
        {tags.map((tag) => (
          <Badge
            key={tag.label}
            label={tag.label}
            bgColor={tag.bgColor}
            fgColor={tag.fgColor}
            size="sm"
          />
        ))}
      </div>
    </div>
  );
}
