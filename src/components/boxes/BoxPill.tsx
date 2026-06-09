import { cn } from "@/lib/utils";
import styles from "./BoxPill.module.css";

export interface BoxPillProps {
  /** Warehouse code shown in the chip (e.g. "WHK03"). */
  code: string;
  /** Human box name shown after the chip (e.g. "Kitchen"). */
  name: string;
  size?: "sm" | "md" | undefined;
  className?: string | undefined;
}

/**
 * Consistent box identity: a tinted, bordered mono code chip immediately
 * followed by the box name — `[CODE] Name`. Presentational only; user content
 * (the name) is never truncated and is allowed to wrap.
 */
export function BoxPill({ code, name, size = "md", className }: BoxPillProps) {
  return (
    <span className={cn(styles.pill, styles[size], className)}>
      <span className={styles.code}>{code}</span>
      <span className={styles.name}>{name}</span>
    </span>
  );
}
