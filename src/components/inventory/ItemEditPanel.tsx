"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronRight, MessageCircle, Trash2, X } from "lucide-react";
import { ConfirmDialog, Spinner } from "@thefairies/design-system/components";
import { Verdict } from "@/lib/constants";
import type { Box, ItemAssessment } from "@/types";
import styles from "./ItemEditPanel.module.css";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ItemEditPanelProps {
  item: ItemAssessment;
  boxes: Box[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (updates: Partial<ItemAssessment>) => Promise<void>;
  /** Called when the user confirms deletion of this item */
  onDelete?: () => void;
  /** Reference to the source card element for the desktop slide-from-card animation */
  sourceCardRef?: React.RefObject<HTMLElement | null>;
  /** Called when the user taps "Back to Aisling" from inside the edit panel on mobile */
  onBackToChat?: (() => void) | undefined;
  /** Label for the breadcrumb back link on mobile (e.g. "Inventory", "Decisions") */
  breadcrumbLabel?: string;
}

// Verdicts that support box assignment
const SHIPPING_VERDICTS: string[] = [Verdict.SHIP, Verdict.CARRY];

// Focusable selector for focus trap
const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// ---------------------------------------------------------------------------
// Animation helpers
// ---------------------------------------------------------------------------

// Reduced motion: instant
const reducedMotionTransition = { duration: 0 };

// Desktop: slide from right
const desktopSpring = { type: "spring" as const, stiffness: 400, damping: 35 };
const desktopExit = { type: "tween" as const, ease: "easeOut" as const, duration: 0.2 };

const desktopVariants = {
  hidden: { x: "100%", opacity: 0 },
  visible: { x: 0, opacity: 1, transition: desktopSpring },
  exit: { x: "100%", opacity: 0, transition: desktopExit },
};

const desktopVariantsReduced = {
  hidden: { x: "100%", opacity: 0 },
  visible: { x: 0, opacity: 1, transition: reducedMotionTransition },
  exit: { x: "100%", opacity: 0, transition: reducedMotionTransition },
};

// Mobile: slide from bottom
const mobileSpring = { type: "spring" as const, stiffness: 400, damping: 35 };
const mobileExit = { type: "tween" as const, ease: "easeOut" as const, duration: 0.2 };

const mobileVariants = {
  hidden: { y: "100%", opacity: 0 },
  visible: { y: 0, opacity: 1, transition: mobileSpring },
  exit: { y: "100%", opacity: 0, transition: mobileExit },
};

const mobileVariantsReduced = {
  hidden: { y: "100%", opacity: 0 },
  visible: { y: 0, opacity: 1, transition: reducedMotionTransition },
  exit: { y: "100%", opacity: 0, transition: reducedMotionTransition },
};

// ---------------------------------------------------------------------------
// Hook: detect mobile viewport
// ---------------------------------------------------------------------------

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < breakpoint;
  });

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [breakpoint]);

  return isMobile;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ItemEditPanel({
  item,
  boxes,
  isOpen,
  onClose,
  onSave,
  onDelete,
  sourceCardRef,
  onBackToChat,
  breadcrumbLabel = "Decisions",
}: ItemEditPanelProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const isMobile = useIsMobile();
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);

  // Form state — initialised from item, reset when item or panel open state changes
  const [itemName, setItemName] = useState(item.item_name);
  const [estimatedValue, setEstimatedValue] = useState<string>(
    item.estimated_replace_cost != null
      ? String(item.estimated_replace_cost)
      : ""
  );
  const [notes, setNotes] = useState<string>(item.advice_text ?? "");
  const [boxId, setBoxId] = useState<string>("");

  // Reset form when panel opens or item changes
  useEffect(() => {
    if (!isOpen) return;
    setItemName(item.item_name);
    setEstimatedValue(
      item.estimated_replace_cost != null
        ? String(item.estimated_replace_cost)
        : ""
    );
    setNotes(item.advice_text ?? "");
    setBoxId("");
    setError(null);
    setSuccess(false);
  }, [isOpen, item]);

  // Focus management: trap focus within panel and restore on close
  useEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;

    // Auto-focus first focusable element
    const raf = requestAnimationFrame(() => {
      if (panelRef.current) {
        const firstFocusable =
          panelRef.current.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
        firstFocusable?.focus();
      }
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isDeleteOpen) return; // Let ConfirmDialog handle its own Escape
        onClose();
        return;
      }

      if (e.key === "Tab" && panelRef.current) {
        const focusable =
          panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, isDeleteOpen, onClose]);

  // Restore focus when panel closes
  useEffect(() => {
    if (!isOpen && previousFocusRef.current) {
      const target = sourceCardRef?.current ?? previousFocusRef.current;
      target?.focus();
      previousFocusRef.current = null;
    }
  }, [isOpen, sourceCardRef]);

  // Lock body scroll on mobile when panel is open
  useEffect(() => {
    if (isOpen && isMobile) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [isOpen, isMobile]);

  const showBoxField = SHIPPING_VERDICTS.includes(item.verdict);
  const shippingBoxes = boxes.filter(
    (b) =>
      b.box_type === "standard" ||
      b.box_type === "carryon" ||
      b.box_type === "checked_luggage"
  );

  const handleSave = useCallback(async () => {
    const trimmedName = itemName.trim();
    if (!trimmedName) {
      setError("Item name cannot be empty.");
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(false);

    const parsedValue =
      estimatedValue.trim() !== "" ? parseFloat(estimatedValue) : null;

    const updates: Partial<ItemAssessment> = {};

    if (trimmedName !== item.item_name) {
      updates.item_name = trimmedName;
    }
    if (parsedValue !== item.estimated_replace_cost) {
      updates.estimated_replace_cost = parsedValue;
    }
    if (notes !== (item.advice_text ?? "")) {
      updates.advice_text = notes;
    }

    try {
      await onSave(updates);

      // If a box was selected, assign the item to that box
      if (showBoxField && boxId) {
        await fetch(`/api/boxes/${boxId}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ item_assessment_id: item.id }),
        });
      }

      setSuccess(true);
      setTimeout(() => {
        onClose();
        setSuccess(false);
      }, 1200);
    } catch {
      setError("Could not save your changes. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }, [itemName, estimatedValue, notes, boxId, item, showBoxField, onSave, onClose]);

  // Choose animation variants based on viewport and motion preference
  const variants = isMobile
    ? prefersReducedMotion ? mobileVariantsReduced : mobileVariants
    : prefersReducedMotion ? desktopVariantsReduced : desktopVariants;

  return (
  <>
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay backdrop */}
          <motion.div
            className={styles.overlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={
              prefersReducedMotion ? reducedMotionTransition : { duration: 0.15 }
            }
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Panel */}
          <motion.div
            ref={panelRef}
            className={isMobile ? styles.panelMobile : styles.panelDesktop}
            role="dialog"
            aria-modal="true"
            aria-label={`Edit ${item.item_name}`}
            variants={variants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {/* Mobile breadcrumb bar */}
            {isMobile && (
              <nav className={styles.breadcrumbBar} aria-label="Breadcrumb">
                <button
                  type="button"
                  className={styles.breadcrumbLink}
                  onClick={onClose}
                >
                  {breadcrumbLabel}
                </button>
                <ChevronRight
                  size={14}
                  className={styles.breadcrumbSeparator}
                  aria-hidden="true"
                />
                <span className={styles.breadcrumbCurrent} aria-current="page">
                  {item.item_name}
                </span>
              </nav>
            )}

            {/* Desktop header */}
            {!isMobile && (
              <div className={styles.header}>
                <span className={styles.title}>Edit item</span>
                <button
                  type="button"
                  className={styles.closeButton}
                  onClick={onClose}
                  aria-label="Close panel"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </div>
            )}

            {/* Scrollable form body */}
            <div className={styles.body}>
              <div className={styles.form}>
                {/* Item name */}
                <div className={styles.fieldGroup}>
                  <label htmlFor="item-edit-name" className={styles.label}>
                    Item name
                  </label>
                  <input
                    id="item-edit-name"
                    type="text"
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    placeholder="e.g. KitchenAid stand mixer"
                    className={styles.input}
                    disabled={isSaving}
                  />
                </div>

                {/* Estimated value */}
                <div className={styles.fieldGroup}>
                  <label htmlFor="item-edit-value" className={styles.label}>
                    Estimated value{" "}
                    <span className={styles.labelHint}>(optional)</span>
                  </label>
                  <div className={styles.valueRow}>
                    <span className={styles.currencySymbol}>$</span>
                    <input
                      id="item-edit-value"
                      type="number"
                      min="0"
                      step="0.01"
                      value={estimatedValue}
                      onChange={(e) => setEstimatedValue(e.target.value)}
                      placeholder="0.00"
                      className={styles.valueInput}
                      disabled={isSaving}
                    />
                  </div>
                </div>

                {/* Notes / AI advice */}
                <div className={styles.fieldGroup}>
                  <label htmlFor="item-edit-notes" className={styles.label}>
                    Notes{" "}
                    <span className={styles.labelHint}>
                      (updates Aisling&apos;s suggestion)
                    </span>
                  </label>
                  <textarea
                    id="item-edit-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add any notes about this item..."
                    rows={4}
                    className={styles.textarea}
                    disabled={isSaving}
                  />
                </div>

                {/* Box assignment — only for SHIP / CARRY items */}
                {showBoxField && shippingBoxes.length > 0 && (
                  <div className={styles.fieldGroup}>
                    <label htmlFor="item-edit-box" className={styles.label}>
                      Assign to box{" "}
                      <span className={styles.labelHint}>(optional)</span>
                    </label>
                    <select
                      id="item-edit-box"
                      value={boxId}
                      onChange={(e) => setBoxId(e.target.value)}
                      className={styles.select}
                      disabled={isSaving}
                    >
                      <option value="">No box selected</option>
                      {shippingBoxes.map((box) => (
                        <option key={box.id} value={box.id}>
                          {box.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Error */}
                {error && (
                  <div className={styles.errorBanner} role="alert">
                    <p className={styles.errorText}>{error}</p>
                  </div>
                )}

                {/* Success */}
                {success && (
                  <div className={styles.successBanner} role="status">
                    <p className={styles.successText}>Changes saved</p>
                  </div>
                )}

                {/* Save button — desktop only (mobile puts it in sticky footer) */}
                {!isMobile && (
                  <button
                    type="button"
                    className={styles.saveButton}
                    onClick={handleSave}
                    disabled={isSaving || success}
                  >
                    {isSaving ? (
                      <span className={styles.saveButtonInner}>
                        <Spinner size="sm" />
                        Saving...
                      </span>
                    ) : success ? (
                      "Saved"
                    ) : (
                      "Save changes"
                    )}
                  </button>
                )}

                {/* Delete item — destructive action, separated visually */}
                {onDelete && (
                  <>
                    <hr className={styles.deleteSeparator} />
                    <button
                      ref={deleteButtonRef}
                      type="button"
                      className={styles.deleteButton}
                      onClick={() => setIsDeleteOpen(true)}
                      disabled={isSaving}
                      aria-label={`Delete ${item.item_name}`}
                      aria-haspopup="dialog"
                    >
                      <Trash2 size={15} aria-hidden="true" />
                      Delete item
                    </button>
                  </>
                )}

              </div>
            </div>

            {/* Sticky footer — always visible on mobile with Save + back link */}
            {isMobile && (
              <div className={styles.stickyFooter}>
                <button
                  type="button"
                  className={styles.saveButton}
                  onClick={handleSave}
                  disabled={isSaving || success}
                >
                  {isSaving ? (
                    <span className={styles.saveButtonInner}>
                      <Spinner size="sm" />
                      Saving...
                    </span>
                  ) : success ? (
                    "Saved"
                  ) : (
                    "Save changes"
                  )}
                </button>
                {onBackToChat && (
                  <button
                    type="button"
                    className={styles.backToChat}
                    onClick={onBackToChat}
                  >
                    <MessageCircle size={16} aria-hidden="true" />
                    Back to Aisling
                  </button>
                )}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>

    {/* Delete confirmation dialog — rendered completely outside AnimatePresence.
        Wrapped in deleteDialogWrapper to elevate z-index above the edit panel. */}
    {onDelete && (
      <div className={styles.deleteDialogWrapper}>
        <ConfirmDialog
          isOpen={isDeleteOpen}
          onClose={() => setIsDeleteOpen(false)}
          title="Delete this item?"
          description="Are you sure? This will remove it from your inventory and any boxes it's in. This can't be undone."
          confirmLabel="Delete"
          cancelLabel="Keep it"
          variant="danger"
          onConfirm={() => {
            setIsDeleteOpen(false);
            onDelete();
          }}
          triggerRef={deleteButtonRef}
        />
      </div>
    )}
  </>
  );
}
