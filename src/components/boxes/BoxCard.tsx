"use client";

import { useState, useRef, useCallback } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ChevronDown,
  Package,
  Briefcase,
  Luggage,
  Plus,
  X as XIcon,
} from "lucide-react";
import { Button, ConfirmDialog } from "@thefairies/design-system/components";

import { BoxStatusBadge } from "@/components/boxes/BoxStatusBadge";
import { BoxSizeBadge } from "@/components/boxes/BoxSizeBadge";
import { VerdictBadge } from "@/components/chat/VerdictBadge";
import type { Box, BoxItem, ItemAssessment } from "@/types";
import { BoxType } from "@/lib/constants";
import { cn } from "@/lib/utils";

import styles from "./BoxCard.module.css";

interface BoxCardProps {
  box: Box;
  items: BoxItem[];
  /** Map of item_assessment_id to ItemAssessment, for showing verdicts */
  assessments?: Record<string, ItemAssessment> | undefined;
  onAddItem?: ((boxId: string, itemName: string) => void) | undefined;
  onRemoveItem?: ((boxId: string, boxItemId: string) => void) | undefined;
  onMarkPacked?: ((boxId: string) => void) | undefined;
}

function BoxIcon({ boxType }: { boxType: Box["box_type"] }) {
  switch (boxType) {
    case BoxType.CARRYON:
      return <Briefcase className={styles.boxIcon} />;
    case BoxType.CHECKED_LUGGAGE:
      return <Luggage className={styles.boxIcon} />;
    default:
      return <Package className={styles.boxIcon} />;
  }
}

export function BoxCard({
  box,
  items,
  assessments,
  onAddItem,
  onRemoveItem,
  onMarkPacked,
}: BoxCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [addItemValue, setAddItemValue] = useState("");
  const [confirmPackedOpen, setConfirmPackedOpen] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const isShipped = box.status === "shipped" || box.status === "arrived";
  const isPacking = box.status === "packing";
  const showAddInput = isPacking && onAddItem;
  const showSize =
    box.size &&
    box.box_type !== BoxType.CARRYON &&
    box.box_type !== BoxType.CHECKED_LUGGAGE;
  const showCbm =
    box.cbm !== null &&
    box.box_type !== BoxType.CARRYON &&
    box.box_type !== BoxType.CHECKED_LUGGAGE;

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleToggle();
      }
    },
    [handleToggle]
  );

  const handleAddItem = useCallback(() => {
    const name = addItemValue.trim();
    if (!name || !onAddItem) return;
    onAddItem(box.id, name);
    setAddItemValue("");
    inputRef.current?.focus();
  }, [addItemValue, box.id, onAddItem]);

  const handleAddItemKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleAddItem();
      }
    },
    [handleAddItem]
  );

  const handleConfirmPacked = useCallback(() => {
    onMarkPacked?.(box.id);
    setConfirmPackedOpen(false);
  }, [box.id, onMarkPacked]);

  return (
    <>
      <div className={cn(styles.card, isShipped && styles.cardShipped)}>
        {/* Collapsed header — always visible */}
        <div
          role="button"
          tabIndex={0}
          onClick={handleToggle}
          onKeyDown={handleKeyDown}
          className={styles.header}
          aria-expanded={isOpen}
          aria-label={`${box.label}, ${items.length} ${items.length === 1 ? "item" : "items"}, status: ${box.status}`}
        >
          <BoxIcon boxType={box.box_type} />

          <div className={styles.headerContent}>
            <div className={styles.headerTopRow}>
              <span className={styles.boxLabel}>{box.label}</span>
              {showSize && <BoxSizeBadge size={box.size!} />}
              <BoxStatusBadge status={box.status} />
            </div>
            <div className={styles.headerMeta}>
              <span>
                {items.length} {items.length === 1 ? "item" : "items"}
              </span>
              {showCbm && <span>{box.cbm} CBM</span>}
            </div>
          </div>

          <ChevronDown
            className={cn(styles.chevron, isOpen && styles.chevronOpen)}
            style={{ width: 16, height: 16 }}
          />
        </div>

        {/* Expanded content */}
        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.div
              initial={prefersReducedMotion ? false : { height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={
                prefersReducedMotion
                  ? { opacity: 0 }
                  : { height: 0, opacity: 0 }
              }
              transition={
                prefersReducedMotion
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 300, damping: 30 }
              }
              className={styles.expandedContent}
            >
              <div className={styles.expandedInner}>
                {/* Items list */}
                {items.length === 0 ? (
                  <p className={styles.emptyMessage}>No items in this box yet.</p>
                ) : (
                  <ul className={styles.itemList}>
                    {items.map((item) => {
                      const assessment = item.item_assessment_id
                        ? assessments?.[item.item_assessment_id]
                        : undefined;

                      return (
                        <li key={item.id} className={styles.itemRow}>
                          <div className={styles.itemRowLeft}>
                            <span className={styles.itemName}>{item.item_name}</span>
                            {item.quantity > 1 && (
                              <span className={styles.itemQty}>x{item.quantity}</span>
                            )}
                            {assessment && (
                              <VerdictBadge
                                verdict={assessment.verdict}
                              />
                            )}
                          </div>

                          {!isShipped && onRemoveItem && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                onRemoveItem(box.id, item.id);
                              }}
                              aria-label={`Remove ${item.item_name} from ${box.label}`}
                              className={styles.removeItemButton ?? ""}
                            >
                              <XIcon style={{ width: 16, height: 16 }} />
                            </Button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}

                {/* Add to this box — inline input */}
                {showAddInput && (
                  <div className={styles.addItemRow}>
                    <div className={styles.addItemInputWrap}>
                      <input
                        ref={inputRef}
                        type="text"
                        value={addItemValue}
                        onChange={(e) => setAddItemValue(e.target.value)}
                        onKeyDown={handleAddItemKeyDown}
                        placeholder="Type an item name to add..."
                        className={styles.addItemInput}
                        aria-label={`Add item to ${box.label}`}
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddItem();
                      }}
                      disabled={!addItemValue.trim()}
                      aria-label="Add item"
                    >
                      <Plus style={{ width: 16, height: 16 }} />
                    </Button>
                  </div>
                )}

                {/* Mark as packed button */}
                {isPacking && onMarkPacked && (
                  <div className={styles.markPackedRow}>
                    <Button
                      ref={triggerRef}
                      variant="outline"
                      size="sm"
                      className={styles.markPackedButton ?? ""}
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmPackedOpen(true);
                      }}
                    >
                      Mark as packed
                    </Button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Mark as packed confirmation dialog */}
      <ConfirmDialog
        isOpen={confirmPackedOpen}
        onClose={() => setConfirmPackedOpen(false)}
        title="Mark as packed?"
        description={`Mark ${box.label} as packed? You can still edit it later.`}
        confirmLabel="Yes, packed"
        cancelLabel="Not yet"
        onConfirm={handleConfirmPacked}
        triggerRef={triggerRef}
      />
    </>
  );
}
