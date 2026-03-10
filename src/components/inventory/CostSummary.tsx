"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Package, TrendingUp } from "lucide-react";
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

const VERDICT_COLOUR: Record<string, string> = {
  SHIP: "bg-verdict-ship/15 text-verdict-ship",
  CARRY: "bg-verdict-carry/15 text-verdict-carry",
  SELL: "bg-verdict-sell/15 text-verdict-sell",
  DONATE: "bg-verdict-donate/15 text-verdict-donate",
  DISCARD: "bg-verdict-discard/15 text-verdict-discard",
  DECIDE_LATER: "bg-verdict-decide-later/15 text-verdict-decide-later",
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
      className={cn("tabular-nums", className)}
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

function VerdictChip({
  label,
  count,
  colorClass,
}: {
  label: string;
  count: number;
  colorClass: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide",
        colorClass
      )}
    >
      {count} {label.replace("_", " ")}
    </span>
  );
}

export function CostSummary({ data, variant, className }: CostSummaryProps) {
  const { counts_by_verdict, total_estimated_ship_cost, currency } = data;
  const formattedCost = formatCurrency(total_estimated_ship_cost, currency);
  const totalItems = Object.values(counts_by_verdict).reduce(
    (sum, n) => sum + n,
    0
  );

  if (variant === "compact") {
    return (
      <div
        className={cn(
          "flex items-center justify-between gap-4 border-b border-border bg-card px-4 py-2",
          className
        )}
      >
        <div className="flex items-center gap-3 text-sm">
          <span className="flex items-center gap-1.5 font-medium text-foreground">
            <TrendingUp className="size-3.5 text-muted-foreground" />
            <AnimatedNumber value={formattedCost} />
          </span>
        </div>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Package className="size-3.5" />
          <AnimatedNumber value={totalItems} />{" "}
          {totalItems === 1 ? "item" : "items"}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "space-y-3 border-b border-border bg-card px-4 py-3",
        className
      )}
    >
      <div className="flex items-baseline justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Est. Shipping
          </p>
          <AnimatedNumber
            value={formattedCost}
            className="text-xl font-bold text-foreground"
          />
          <p className="mt-0.5 text-xs text-muted-foreground">{currency}</p>
        </div>
        <span className="text-sm text-muted-foreground">
          <AnimatedNumber value={totalItems} />{" "}
          {totalItems === 1 ? "item" : "items"}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {Object.entries(counts_by_verdict).map(([verdict, count]) =>
          count > 0 ? (
            <VerdictChip
              key={verdict}
              label={verdict}
              count={count}
              colorClass={
                VERDICT_COLOUR[verdict] ?? "bg-stone-100 text-stone-700"
              }
            />
          ) : null
        )}
      </div>
    </div>
  );
}
