import { Badge } from "@thefairies/design-system/components";
import type { BoxSize } from "@/lib/constants";

interface BoxSizeBadgeProps {
  size: BoxSize;
  className?: string;
}

export function BoxSizeBadge({ size, className }: BoxSizeBadgeProps) {
  return (
    <Badge
      label={size}
      bgColor="var(--color-bg-subtle)"
      fgColor="var(--color-text-primary)"
      size="sm"
      {...(className ? { className } : {})}
    />
  );
}
