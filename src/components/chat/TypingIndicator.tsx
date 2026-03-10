"use client";

import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

interface TypingIndicatorProps {
  label?: string;
}

export function TypingIndicator({
  label = "Aisling is thinking...",
}: TypingIndicatorProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div
      className="flex items-start gap-3 px-4 py-2"
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="rounded-lg bg-card px-4 py-3 shadow-sm ring-1 ring-border">
        <div className="flex items-center gap-2">
          <div className="flex gap-1" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={cn(
                  "size-2 rounded-full bg-muted-foreground/60",
                  !prefersReducedMotion && "animate-bounce"
                )}
                style={
                  prefersReducedMotion
                    ? undefined
                    : { animationDelay: `${i * 150}ms` }
                }
              />
            ))}
          </div>
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
      </div>
    </div>
  );
}
