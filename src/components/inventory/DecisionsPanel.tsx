"use client";

import { useState } from "react";
import {
  RecommendationCard,
  EmptyState,
  SkeletonGroup,
  SkeletonRect,
  SkeletonText,
  SkeletonPill,
} from "@thefairies/design-system/components";
import { SplitButton } from "@/components/shared/SplitButton";
import { EditablePill } from "@/components/shared/EditablePill";
import type { EditablePillOption } from "@/components/shared/EditablePill";
import { Verdict } from "@/lib/constants";
import type { ItemAssessment } from "@/types";
import styles from "./DecisionsPanel.module.css";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DecisionsPanelProps {
  decisions: ItemAssessment[];
  isLoading: boolean;
  error: string | null;
  onConfirm: (assessmentId: string) => Promise<void>;
  onConfirmAndSend: (assessmentId: string) => Promise<void>;
  onChatAbout?: (item: ItemAssessment) => void;
  onRefresh: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Verdict → DS accent and badge colours (matching MessageBubble pattern)
// ---------------------------------------------------------------------------

const VERDICT_ACCENT: Record<string, string> = {
  SHIP: "var(--verdict-ship)",
  CARRY: "var(--verdict-carry)",
  SELL: "var(--verdict-sell)",
  DONATE: "var(--verdict-donate)",
  DISCARD: "var(--verdict-discard)",
  DECIDE_LATER: "var(--verdict-decide-later)",
};


const VERDICT_LABELS: Record<string, string> = {
  SHIP: "Ship",
  CARRY: "Carry",
  SELL: "Sell",
  DONATE: "Donate",
  DISCARD: "Discard",
  DECIDE_LATER: "Decide later",
};

/** Options for the EditablePill verdict selector — bg/fg from token pairs */
const VERDICT_PILL_OPTIONS: EditablePillOption[] = [
  { value: Verdict.SHIP,         label: "Ship",         color: "var(--verdict-ship-bg)",         textColor: "var(--verdict-ship-fg)" },
  { value: Verdict.CARRY,        label: "Carry",        color: "var(--verdict-carry-bg)",        textColor: "var(--verdict-carry-fg)" },
  { value: Verdict.SELL,         label: "Sell",         color: "var(--verdict-sell-bg)",         textColor: "var(--verdict-sell-fg)" },
  { value: Verdict.DONATE,       label: "Donate",       color: "var(--verdict-donate-bg)",       textColor: "var(--verdict-donate-fg)" },
  { value: Verdict.DISCARD,      label: "Discard",      color: "var(--verdict-discard-bg)",      textColor: "var(--verdict-discard-fg)" },
  { value: Verdict.DECIDE_LATER, label: "Decide later", color: "var(--verdict-decide-later-bg)", textColor: "var(--verdict-decide-later-fg)" },
];

// ---------------------------------------------------------------------------
// Skeleton card
// ---------------------------------------------------------------------------

function DecisionCardSkeleton() {
  return (
    <SkeletonGroup label="Loading decision">
      <div className={styles.skeletonCard}>
        <div className={styles.skeletonHeader}>
          <SkeletonRect width="55%" height={18} borderRadius="var(--radius-sm)" />
          <SkeletonPill width={72} height={20} />
        </div>
        <SkeletonText lines={3} lineHeight={13} gap={6} lastLineWidth="50%" />
        <div className={styles.skeletonActions}>
          <SkeletonRect width={120} height={34} borderRadius="var(--radius-md)" />
          <SkeletonRect width={64} height={34} borderRadius="var(--radius-md)" />
        </div>
      </div>
    </SkeletonGroup>
  );
}

// ---------------------------------------------------------------------------
// Single decision card
// ---------------------------------------------------------------------------

interface DecisionCardProps {
  assessment: ItemAssessment;
  onConfirm: (id: string) => Promise<void>;
  onConfirmAndSend: (id: string) => Promise<void>;
  onChatAbout?: (item: ItemAssessment) => void;
}

type ActionState = "idle" | "confirming" | "confirmed" | "error";

function DecisionCard({
  assessment,
  onConfirm,
  onConfirmAndSend,
  onChatAbout,
}: DecisionCardProps) {
  const [actionState, setActionState] = useState<ActionState>("idle");
  const [localVerdict, setLocalVerdict] = useState<string>(assessment.verdict);

  const verdict = localVerdict;
  const accentColor = VERDICT_ACCENT[verdict] ?? "var(--color-primary)";
  const badgeColor = VERDICT_ACCENT[verdict] ?? "var(--color-primary)";

  // Build metadata array for cost info
  const metadata: { label: string; value: string }[] = [];
  if (assessment.estimated_ship_cost != null) {
    const sym = assessment.currency ?? "USD";
    metadata.push({
      label: "Ship cost",
      value: `${sym} ${assessment.estimated_ship_cost.toFixed(2)}`,
    });
  }
  if (assessment.estimated_replace_cost != null) {
    const sym = assessment.replace_currency ?? "USD";
    metadata.push({
      label: "Replace cost",
      value: `${sym} ${assessment.estimated_replace_cost.toFixed(2)}`,
    });
  }

  const optionalProps = {
    badge: {
      label: VERDICT_LABELS[verdict] ?? verdict.replace("_", " "),
      color: badgeColor,
    },
    accentColor,
    ...(metadata.length > 0 ? { metadata } : {}),
  };

  async function handleConfirm() {
    setActionState("confirming");
    try {
      await onConfirm(assessment.id);
      setActionState("confirmed");
    } catch {
      setActionState("error");
    }
  }

  async function handleConfirmAndSend() {
    setActionState("confirming");
    try {
      await onConfirmAndSend(assessment.id);
      setActionState("confirmed");
    } catch {
      setActionState("error");
    }
  }

  // If confirmed, render nothing (card will be removed from list on refresh)
  if (actionState === "confirmed") {
    return null;
  }

  const dsStatus =
    actionState === "confirming"
      ? "confirming"
      : actionState === "error"
      ? "error"
      : "idle";

  return (
    <article className={styles.card} aria-label={`Decision for ${assessment.item_name}`}>
      <RecommendationCard
        title={assessment.item_name}
        rationale={assessment.advice_text ?? "No advice available."}
        status={dsStatus}
        onConfirm={() => { /* handled by custom action row below */ }}
        onSkip={() => { /* handled by custom action row below */ }}
        errorMessage="Failed to save — please try again"
        ariaLabel={`Assessment for ${assessment.item_name}`}
        {...optionalProps}
      />

      {/* Action row: verdict pill + confirm + chat */}
      <div className={styles.actionRow}>
        <EditablePill
          value={localVerdict}
          options={VERDICT_PILL_OPTIONS}
          onChange={setLocalVerdict}
          disabled={actionState === "confirming"}
          size="sm"
        />

        <SplitButton
          label="Confirm"
          onClick={handleConfirm}
          items={[
            {
              label: "and Send",
              onClick: handleConfirmAndSend,
            },
          ]}
          variant="success"
          size="sm"
          loading={actionState === "confirming"}
          disabled={actionState === "confirming"}
        />

        {onChatAbout && (
          <button
            type="button"
            className={styles.chatButton}
            onClick={() => onChatAbout(assessment)}
            disabled={actionState === "confirming"}
          >
            Chat about this
          </button>
        )}
      </div>

      {actionState === "error" && (
        <p className={styles.errorText} role="alert">
          Something went wrong. Please try again.
        </p>
      )}
    </article>
  );
}

// ---------------------------------------------------------------------------
// DecisionsPanel
// ---------------------------------------------------------------------------

export function DecisionsPanel({
  decisions,
  isLoading,
  error,
  onConfirm,
  onConfirmAndSend,
  onChatAbout,
  onRefresh,
}: DecisionsPanelProps) {
  if (isLoading) {
    return (
      <div className={styles.container}>
        <DecisionCardSkeleton />
        <DecisionCardSkeleton />
        <DecisionCardSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorState}>
        <p className={styles.errorMessage}>{error}</p>
        <button type="button" className={styles.retryButton} onClick={onRefresh}>
          Try again
        </button>
      </div>
    );
  }

  if (decisions.length === 0) {
    return (
      <div className={styles.emptyWrapper}>
        <EmptyState
          variant="subtle"
          heading="No pending decisions"
          description="Aisling will suggest assessments for your items as you chat."
        />
      </div>
    );
  }

  return (
    <div className={styles.container} role="list" aria-label="Pending decisions">
      {decisions.map((assessment) => (
        <div key={assessment.id} role="listitem">
          <DecisionCard
            assessment={assessment}
            onConfirm={onConfirm}
            onConfirmAndSend={onConfirmAndSend}
            {...(onChatAbout ? { onChatAbout } : {})}
          />
        </div>
      ))}
    </div>
  );
}
