"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FlagMessage {
  flag: string;
  label: string;
  detail: string;
}

interface WarningCard {
  title: string;
  message: string;
  item_name: string;
  box_id: string | null;
  actions: string[];
}

interface ConfirmPayload {
  item_name: string;
  verdict: "SHIP" | "CARRY";
  flags: string[];
  advice_text: string;
  box_id: string | null;
  voltage_compatible: boolean;
  needs_transformer: boolean;
}

interface LightAssessmentWarningProps {
  warningCard: WarningCard;
  flagMessages: FlagMessage[];
  confirmPayload: ConfirmPayload;
  onConfirm: (payload: ConfirmPayload) => void;
  onDismiss: () => void;
  className?: string | undefined;
}

export function LightAssessmentWarning({
  warningCard,
  flagMessages,
  confirmPayload,
  onConfirm,
  onDismiss,
  className,
}: LightAssessmentWarningProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30",
        className
      )}
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle
          className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400"
          aria-hidden="true"
        />
        <div className="flex-1 space-y-2">
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
            {warningCard.title}
          </p>

          {flagMessages.length > 0 && (
            <ul className="space-y-1.5">
              {flagMessages.map((fm) => (
                <li key={fm.flag} className="text-sm text-amber-800 dark:text-amber-200">
                  <span className="font-medium">{fm.label}:</span>{" "}
                  {fm.detail}
                </li>
              ))}
            </ul>
          )}

          <p className="text-xs text-amber-700 dark:text-amber-300">
            Add{" "}
            <span className="font-medium">{warningCard.item_name}</span> to
            the box anyway?
          </p>

          <div className="flex items-center gap-2 pt-1">
            <Button
              size="sm"
              variant="outline"
              className="border-amber-300 bg-amber-100 text-amber-900 hover:bg-amber-200 dark:border-amber-700 dark:bg-amber-900/50 dark:text-amber-100 dark:hover:bg-amber-800/50"
              onClick={() => onConfirm(confirmPayload)}
            >
              Add anyway
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-amber-700 hover:bg-amber-100 hover:text-amber-900 dark:text-amber-300 dark:hover:bg-amber-900/30 dark:hover:text-amber-100"
              onClick={onDismiss}
            >
              {"Don't add"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
