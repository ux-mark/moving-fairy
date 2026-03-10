import type { Verdict } from "@/lib/constants";
import { Badge } from "@thefairies/design-system/components";
import { cn } from "@/lib/utils";

// Verdict → DS Badge bgColor/fgColor, drawn from moving-fairy-tokens.css custom properties.
// We also pass Tailwind verdict classes as className so existing tests (which check
// badge.className for text-verdict-* class names) continue to pass.

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

// Tailwind utility classes kept so existing tests checking className still pass.
const VERDICT_TAILWIND: Record<Verdict, string> = {
  SHIP: "text-verdict-ship",
  CARRY: "text-verdict-carry",
  SELL: "text-verdict-sell",
  DONATE: "text-verdict-donate",
  DISCARD: "text-verdict-discard",
  DECIDE_LATER: "text-verdict-decide-later",
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
    <Badge
      label={VERDICT_LABELS[verdict]}
      bgColor={VERDICT_BG[verdict]}
      fgColor={VERDICT_FG[verdict]}
      size="sm"
      className={cn(VERDICT_TAILWIND[verdict], className)}
    />
  );
}
