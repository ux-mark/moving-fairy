import type { BoxSize } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface BoxSizeBadgeProps {
  size: BoxSize;
  className?: string;
}

export function BoxSizeBadge({ size, className }: BoxSizeBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex size-6 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground",
        className
      )}
      title={`Size ${size}`}
    >
      {size}
    </span>
  );
}
