"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@thefairies/design-system/components";

import styles from "./LightAssessmentWarning.module.css";
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
      className={cn(styles.card, className)}
      role="alert"
      aria-live="assertive"
    >
      <div className={styles.inner}>
        <AlertTriangle
          className={styles.icon}
          style={{ width: 20, height: 20 }}
          aria-hidden="true"
        />
        <div className={styles.body}>
          <p className={styles.title}>{warningCard.title}</p>

          {flagMessages.length > 0 && (
            <ul className={styles.flagList}>
              {flagMessages.map((fm) => (
                <li key={fm.flag} className={styles.flagItem}>
                  <span className={styles.flagItemLabel}>{fm.label}:</span>{" "}
                  {fm.detail}
                </li>
              ))}
            </ul>
          )}

          <p className={styles.confirmPrompt}>
            Add{" "}
            <span style={{ fontWeight: 500 }}>{warningCard.item_name}</span> to
            the box anyway?
          </p>

          <div className={styles.actions}>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onConfirm(confirmPayload)}
            >
              Add anyway
            </Button>
            <Button
              size="sm"
              variant="ghost"
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
