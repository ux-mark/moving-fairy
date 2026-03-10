import { Check } from "lucide-react";

import type { BoxStatus } from "@/lib/constants";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<BoxStatus, string> = {
  packing: "bg-muted text-muted-foreground",
  packed: "bg-primary/15 text-primary",
  shipped: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  arrived: "bg-primary/15 text-primary",
};

const STATUS_LABELS: Record<BoxStatus, string> = {
  packing: "Packing",
  packed: "Packed",
  shipped: "Shipped",
  arrived: "Arrived",
};

interface BoxStatusBadgeProps {
  status: BoxStatus;
  className?: string;
}

export function BoxStatusBadge({ status, className }: BoxStatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        STATUS_STYLES[status],
        className
      )}
    >
      {STATUS_LABELS[status]}
      {status === "arrived" && <Check className="size-3" />}
    </span>
  );
}
