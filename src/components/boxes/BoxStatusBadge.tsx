import { Badge } from "@thefairies/design-system/components";
import type { BoxStatus } from "@/lib/constants";

// DS token colours mapped per status
const STATUS_COLORS: Record<BoxStatus, { bgColor: string; fgColor: string }> = {
  packing: {
    bgColor: "var(--color-bg-subtle)",
    fgColor: "var(--color-text-muted)",
  },
  packed: {
    bgColor: "color-mix(in srgb, var(--color-primary, #16a34a) 15%, transparent)",
    fgColor: "var(--color-primary, #16a34a)",
  },
  shipped: {
    bgColor: "color-mix(in srgb, #3b82f6 15%, transparent)",
    fgColor: "#1d4ed8",
  },
  arrived: {
    bgColor: "color-mix(in srgb, var(--color-primary, #16a34a) 15%, transparent)",
    fgColor: "var(--color-primary, #16a34a)",
  },
};

const STATUS_LABELS: Record<BoxStatus, string> = {
  packing: "Packing",
  packed: "Packed",
  shipped: "Shipped",
  arrived: "Arrived ✓",
};

interface BoxStatusBadgeProps {
  status: BoxStatus;
  className?: string;
}

export function BoxStatusBadge({ status, className }: BoxStatusBadgeProps) {
  const { bgColor, fgColor } = STATUS_COLORS[status];
  return (
    <Badge
      label={STATUS_LABELS[status]}
      bgColor={bgColor}
      fgColor={fgColor}
      size="sm"
      {...(className ? { className } : {})}
    />
  );
}
