"use client";

import { useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@thefairies/design-system/components";
import { Copy, Pencil, Sparkles, X as XIcon } from "lucide-react";

import { VerdictBadge } from "@/components/chat/VerdictBadge";
import { useItemLinkClick } from "@/components/panels";
import { ItemSource } from "@/lib/constants";
import { ownerCopy } from "@/lib/copy/owner";
import type { Box, BoxItem, BoxScanDuplicateProposedItem, ItemAssessment } from "@/types";

import styles from "./ScanDraftReview.module.css";

export type DraftKind = "matched" | "new";

/**
 * Whether removing a draft should delete the underlying item. A scan-created
 * item the owner hasn't confirmed is "new" — it has no life outside this box,
 * so removing it deletes it. Anything else the scan matched is a pre-existing
 * inventory item; removing it only unlinks it from the box.
 */
export function draftKind(assessment: ItemAssessment | undefined): DraftKind {
  if (
    assessment &&
    assessment.source === ItemSource.STICKER_SCAN &&
    !assessment.user_confirmed
  ) {
    return "new";
  }
  return "matched";
}

interface ScanDraftReviewProps {
  box: Box;
  /** The draft box items (is_draft === true) for this box. */
  drafts: BoxItem[];
  assessments?: Record<string, ItemAssessment> | undefined;
  /** Confirm every draft — they join the box for real. */
  onConfirmAll: () => void;
  /** Remove one draft. `kind` decides whether the item is deleted or just unlinked. */
  onRemoveDraft: (item: BoxItem, kind: DraftKind) => void;
  /** Label entries matching items already packed in ANOTHER box — possible
   *  second physical items, each resolved individually (add or skip). */
  duplicates?: BoxScanDuplicateProposedItem[] | undefined;
  /** Add a fresh item with this name to THIS box (a second physical item). */
  onAddDuplicate?: ((proposal: BoxScanDuplicateProposedItem) => void) | undefined;
  /** Drop the duplicate proposal — it was the same item after all. */
  onSkipDuplicate?: ((proposal: BoxScanDuplicateProposedItem) => void) | undefined;
  isConfirming?: boolean | undefined;
  resolvingItemIds?: Set<string> | undefined;
  prefersReducedMotion?: boolean | null | undefined;
}

export function ScanDraftReview({
  box,
  drafts,
  assessments,
  onConfirmAll,
  onRemoveDraft,
  duplicates = [],
  onAddDuplicate,
  onSkipDuplicate,
  isConfirming = false,
  resolvingItemIds,
  prefersReducedMotion,
}: ScanDraftReviewProps) {
  // Plain click opens the item panel in place; modifier clicks still navigate.
  const itemLinkClick = useItemLinkClick();
  const rows = useMemo(
    () =>
      drafts.map((item) => {
        const assessment = item.item_assessment_id
          ? assessments?.[item.item_assessment_id]
          : undefined;
        return {
          item,
          assessment,
          kind: draftKind(assessment),
          name: assessment?.item_name ?? item.item_name ?? "Unnamed item",
        };
      }),
    [drafts, assessments],
  );

  const matchedCount = rows.filter((r) => r.kind === "matched").length;
  const newCount = rows.filter((r) => r.kind === "new").length;

  const subtext =
    matchedCount > 0 && newCount > 0
      ? ownerCopy.packing.reviewSubMatchedNew(matchedCount, newCount)
      : newCount > 0
        ? ownerCopy.packing.reviewSubNewOnly(newCount)
        : ownerCopy.packing.reviewSubMatchedOnly(matchedCount);

  if (rows.length === 0 && duplicates.length === 0) return null;

  return (
    <section className={styles.wrap} aria-label={`Review items from the ${box.label} label`}>
      {rows.length > 0 && (
        <>
      <header className={styles.header}>
        <span className={styles.headIcon} aria-hidden>
          <Sparkles size={16} />
        </span>
        <div className={styles.headText}>
          <p className={styles.heading}>{ownerCopy.packing.reviewHeading(rows.length)}</p>
          <p className={styles.sub}>{subtext}</p>
        </div>
      </header>

      <ul className={styles.list}>
        <AnimatePresence mode="popLayout" initial={false}>
          {rows.map(({ item, assessment, kind, name }) => {
            const busy = item.item_assessment_id
              ? (resolvingItemIds?.has(item.item_assessment_id) ?? false)
              : false;
            return (
              <motion.li
                key={item.id}
                layout
                className={styles.row}
                initial={prefersReducedMotion ? false : { opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: 12 }}
                transition={{ duration: prefersReducedMotion ? 0 : 0.15 }}
              >
                <span className={styles.name}>{name}</span>

                {assessment?.verdict ? (
                  <VerdictBadge verdict={assessment.verdict} />
                ) : null}

                <span
                  className={kind === "new" ? styles.chipNew : styles.chipMatched}
                >
                  {kind === "new"
                    ? ownerCopy.packing.draftChipNew
                    : ownerCopy.packing.draftChipMatched}
                </span>

                <span className={styles.actions}>
                  {assessment?.id && (
                    <Link
                      href={`/decisions/${assessment.id}?from=boxes`}
                      className={styles.editLink}
                      aria-label={ownerCopy.packing.editDraft(name)}
                      onClick={itemLinkClick(assessment.id)}
                    >
                      <Pencil size={15} aria-hidden />
                    </Link>
                  )}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveDraft(item, kind);
                    }}
                    disabled={busy}
                    aria-label={ownerCopy.packing.removeDraft(name)}
                  >
                    <XIcon style={{ width: 15, height: 15 }} />
                  </Button>
                </span>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>

      <div className={styles.footer}>
        <Button
          variant="primary"
          size="sm"
          onClick={onConfirmAll}
          disabled={isConfirming}
        >
          {isConfirming
            ? ownerCopy.packing.confirmingDrafts
            : ownerCopy.packing.confirmAllDrafts(rows.length, box.label)}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            for (const { item, kind } of rows) onRemoveDraft(item, kind);
          }}
          disabled={isConfirming}
        >
          {ownerCopy.packing.discardAllDrafts}
        </Button>
      </div>
        </>
      )}

      {duplicates.length > 0 && (
        <div className={styles.dupGroup}>
          <header className={styles.header}>
            <span className={styles.dupIcon} aria-hidden>
              <Copy size={16} />
            </span>
            <div className={styles.headText}>
              <p className={styles.heading}>
                {ownerCopy.packing.duplicatesHeading(duplicates.length)}
              </p>
              <p className={styles.sub}>{ownerCopy.packing.duplicatesSub}</p>
            </div>
          </header>

          <ul className={styles.list}>
            <AnimatePresence mode="popLayout" initial={false}>
              {duplicates.map((dup) => {
                const busy = resolvingItemIds?.has(dup.item_assessment_id) ?? false;
                return (
                  <motion.li
                    key={dup.item_assessment_id}
                    layout
                    className={styles.dupRow}
                    initial={prefersReducedMotion ? false : { opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: 12 }}
                    transition={{ duration: prefersReducedMotion ? 0 : 0.15 }}
                  >
                    <div className={styles.dupInfo}>
                      <span className={styles.name}>{dup.item_name}</span>
                      <span className={styles.dupBadge}>
                        {ownerCopy.packing.duplicateAlreadyPacked(dup.packed_box_label)}
                      </span>
                    </div>
                    {/* Commit surface — right-aligned, secondary left of primary
                        (UX_STANDARDS Action alignment). */}
                    <div className={styles.dupActions}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onSkipDuplicate?.(dup)}
                        disabled={busy}
                      >
                        {ownerCopy.packing.duplicateSkip}
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => onAddDuplicate?.(dup)}
                        disabled={busy}
                      >
                        {busy
                          ? ownerCopy.packing.duplicateAdding
                          : ownerCopy.packing.duplicateAdd(dup.item_name)}
                      </Button>
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        </div>
      )}
    </section>
  );
}
