import { Badge } from "@thefairies/design-system/components";
import type { BoxSize } from "@/lib/constants";
import styles from "./BoxSizeBadge.module.css";

interface BoxSizeBadgeProps {
  size: BoxSize;
  className?: string;
}

export function BoxSizeBadge({ size, className }: BoxSizeBadgeProps) {
  const combined = [styles.badge, className].filter(Boolean).join(" ");
  return (
    <Badge
      label={size}
      bgColor="var(--color-bg-subtle)"
      fgColor="var(--color-text-primary)"
      size="sm"
      className={combined}
    />
  );
}
