import type { Verdict } from "@/lib/constants";
import { cn } from "@/lib/utils";

const VERDICT_STYLES: Record<Verdict, string> = {
  SHIP: "bg-verdict-ship/15 text-verdict-ship",
  CARRY: "bg-verdict-carry/15 text-verdict-carry",
  SELL: "bg-verdict-sell/15 text-verdict-sell",
  DONATE: "bg-verdict-donate/15 text-verdict-donate",
  DISCARD: "bg-verdict-discard/15 text-verdict-discard",
  DECIDE_LATER: "bg-verdict-decide-later/15 text-verdict-decide-later",
};

const VERDICT_LABELS: Record<Verdict, string> = {
  SHIP: "SHIP",
  CARRY: "CARRY",
  SELL: "SELL",
  DONATE: "DONATE",
  DISCARD: "DISCARD",
  DECIDE_LATER: "DECIDE LATER",
};

interface VerdictBadgeProps {
  verdict: Verdict;
  className?: string;
}

export function VerdictBadge({ verdict, className }: VerdictBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wider",
        VERDICT_STYLES[verdict],
        className
      )}
    >
      {VERDICT_LABELS[verdict]}
    </span>
  );
}
