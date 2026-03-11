import type { Verdict } from "@/lib/constants";
import { Badge } from "@thefairies/design-system/components";
import styles from "./VerdictBadge.module.css";

const VERDICT_BG: Record<Verdict, string> = {
  SHIP: "var(--verdict-ship-bg)",
  CARRY: "var(--verdict-carry-bg)",
  SELL: "var(--verdict-sell-bg)",
  DONATE: "var(--verdict-donate-bg)",
  DISCARD: "var(--verdict-discard-bg)",
  DECIDE_LATER: "var(--verdict-decide-later-bg)",
};

const VERDICT_FG: Record<Verdict, string> = {
  SHIP: "var(--verdict-ship-fg)",
  CARRY: "var(--verdict-carry-fg)",
  SELL: "var(--verdict-sell-fg)",
  DONATE: "var(--verdict-donate-fg)",
  DISCARD: "var(--verdict-discard-fg)",
  DECIDE_LATER: "var(--verdict-decide-later-fg)",
};

const VERDICT_LABELS: Record<Verdict, string> = {
  SHIP: "Ship",
  CARRY: "Carry",
  SELL: "Sell",
  DONATE: "Donate",
  DISCARD: "Discard",
  DECIDE_LATER: "Decide later",
};

interface VerdictBadgeProps {
  verdict: Verdict;
  className?: string;
}

export function VerdictBadge({ verdict, className }: VerdictBadgeProps) {
  const combined = [styles.badge, className].filter(Boolean).join(" ");
  return (
    <Badge
      label={VERDICT_LABELS[verdict]}
      bgColor={VERDICT_BG[verdict]}
      fgColor={VERDICT_FG[verdict]}
      size="sm"
      className={combined}
    />
  );
}
