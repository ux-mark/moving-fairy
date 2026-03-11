"use client";

import { useRef, useState } from "react";
import {
  EmptyState,
  SkeletonGroup,
  SkeletonRect,
  SkeletonText,
  SkeletonPill,
} from "@thefairies/design-system/components";
import { Pencil } from "lucide-react";
import { SplitButton } from "@/components/shared/SplitButton";
import { EditablePill } from "@/components/shared/EditablePill";
import type { EditablePillOption } from "@/components/shared/EditablePill";
import { ItemEditPanel } from "@/components/inventory/ItemEditPanel";
import { Verdict } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Box, ItemAssessment } from "@/types";
import styles from "./DecisionsPanel.module.css";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DecisionsPanelProps {
  decisions: ItemAssessment[];
  boxes?: Box[];
  isLoading: boolean;
  error: string | null;
  onConfirm: (assessmentId: string) => Promise<void>;
  onConfirmAndSend: (assessmentId: string) => Promise<void>;
  onChatAbout?: (item: ItemAssessment) => void;
  onRefresh: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Verdict display helpers
// ---------------------------------------------------------------------------

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
  boxes: Box[];
  onConfirm: (id: string) => Promise<void>;
  onConfirmAndSend: (id: string) => Promise<void>;
  onChatAbout?: (item: ItemAssessment) => void;
  onRefresh: () => Promise<void>;
}

type ActionState = "idle" | "confirming" | "confirmed" | "error";

function DecisionCard({
  assessment,
  boxes,
  onConfirm,
  onConfirmAndSend,
  onChatAbout,
  onRefresh,
}: DecisionCardProps) {
  const [actionState, setActionState] = useState<ActionState>("idle");
  const [localVerdict, setLocalVerdict] = useState<string>(assessment.verdict);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const cardRef = useRef<HTMLElement>(null);

  // Build cost metadata lines
  const costLines: string[] = [];
  if (assessment.estimated_ship_cost != null) {
    const sym = assessment.currency ?? "USD";
    costLines.push(`Ship cost: ${sym} ${assessment.estimated_ship_cost.toFixed(2)}`);
  }
  if (assessment.estimated_replace_cost != null) {
    const sym = assessment.replace_currency ?? "USD";
    costLines.push(`Replace cost: ${sym} ${assessment.estimated_replace_cost.toFixed(2)}`);
  }

  // Immediately PATCH when the verdict pill changes
  async function handleVerdictChange(newVerdict: string) {
    const previous = localVerdict;
    setLocalVerdict(newVerdict);
    try {
      const res = await fetch(`/api/assessments/${assessment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verdict: newVerdict }),
      });
      if (!res.ok) {
        setLocalVerdict(previous);
      }
    } catch {
      setLocalVerdict(previous);
    }
  }

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

  async function handleItemSave(updates: Partial<ItemAssessment>) {
    if (Object.keys(updates).length === 0) return;
    const res = await fetch(`/api/assessments/${assessment.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      throw new Error("Failed to save item");
    }
    await onRefresh();
  }

  // If confirmed, render nothing (card will be removed from list on refresh)
  if (actionState === "confirmed") {
    return null;
  }

  const isConfirming = actionState === "confirming";

  return (
    <>
      <article
        ref={cardRef}
        className={cn(styles.card, isEditOpen && styles.cardEditing)}
        aria-label={`Decision for ${assessment.item_name}`}
      >
        {/* Card header: item name + verdict pill */}
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>{assessment.item_name}</h3>
          <EditablePill
            value={localVerdict}
            options={VERDICT_PILL_OPTIONS}
            onChange={handleVerdictChange}
            disabled={isConfirming}
            size="sm"
          />
        </div>

        {/* Rationale */}
        {assessment.advice_text && (
          <p className={styles.rationale}>{assessment.advice_text}</p>
        )}

        {/* Cost metadata */}
        {costLines.length > 0 && (
          <ul className={styles.costList} aria-label="Cost estimates">
            {costLines.map((line) => (
              <li key={line} className={styles.costItem}>
                {line}
              </li>
            ))}
          </ul>
        )}

        {/* Action row: Confirm (split) + Edit + Chat */}
        <div className={styles.actionRow}>
          <SplitButton
            label="Confirm"
            onClick={handleConfirm}
            items={[
              {
                label: "Confirm and send",
                onClick: handleConfirmAndSend,
              },
            ]}
            variant="primary"
            size="sm"
            loading={isConfirming}
            disabled={isConfirming}
          />

          <button
            type="button"
            className={styles.editButton}
            onClick={() => setIsEditOpen(true)}
            disabled={isConfirming}
            aria-label={`Edit ${assessment.item_name}`}
          >
            <Pencil size={14} aria-hidden="true" />
          </button>

          {onChatAbout && (
            <button
              type="button"
              className={styles.chatButton}
              onClick={() => onChatAbout(assessment)}
              disabled={isConfirming}
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

      <ItemEditPanel
        item={{ ...assessment, verdict: localVerdict as ItemAssessment["verdict"] }}
        boxes={boxes}
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        onSave={handleItemSave}
        sourceCardRef={cardRef}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// DecisionsPanel
// ---------------------------------------------------------------------------

export function DecisionsPanel({
  decisions,
  boxes = [],
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
            boxes={boxes}
            onConfirm={onConfirm}
            onConfirmAndSend={onConfirmAndSend}
            onRefresh={onRefresh}
            {...(onChatAbout ? { onChatAbout } : {})}
          />
        </div>
      ))}
    </div>
  );
}
