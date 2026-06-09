"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { Package, GripVertical } from "lucide-react";
import { Button } from "@thefairies/design-system/components";

import { VerdictBadge } from "@/components/chat/VerdictBadge";
import { PackingBoxSheet } from "@/components/boxes/PackingBoxSheet";
import {
  usePackingDrag,
  useIsDragging,
  DRAG_THRESHOLD,
} from "@/components/boxes/PackingDrag";
import type { Box, ItemAssessment } from "@/types";
import { proxyImageUrl } from "@/lib/storage-url";
import { ownerCopy } from "@/lib/copy/owner";

import styles from "./UnboxedItems.module.css";

interface UnboxedItemsProps {
  items: ItemAssessment[];
  /** Boxes in packing status that items can be added to */
  availableBoxes: Box[];
  /** Layout/behaviour mode. Mobile = tap-to-add; desktop = multi-select + drag. */
  mode?: "mobile" | "desktop";
  /** The active "packing into" box id. */
  activeBoxId?: string | null;
  /** Label of the active box, for the primary add button. */
  activeBoxLabel?: string | null;
  onAddToBox?: ((itemAssessmentId: string, boxId: string) => void) | undefined;
  /** Batch add — desktop multi-select. */
  onAddManyToBox?: ((itemAssessmentIds: string[], boxId: string) => void) | undefined;
  /** Called when the primary add is attempted with no active box (desktop). */
  onRequestPickBox?: (() => void) | undefined;
  /** Drop one or more dragged items into a box (desktop pointer drag). */
  onItemsDrop?: ((itemAssessmentIds: string[], boxId: string) => void) | undefined;
}

export function UnboxedItems({
  items,
  availableBoxes,
  mode = "mobile",
  activeBoxId = null,
  activeBoxLabel = null,
  onAddToBox,
  onAddManyToBox,
  onRequestPickBox,
  onItemsDrop,
}: UnboxedItemsProps) {
  const sorted = useMemo(
    () => [...items].sort((a, b) => a.item_name.localeCompare(b.item_name)),
    [items],
  );

  // Desktop multi-select state.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Mobile one-off "add to another box" target item.
  const [pickerForItem, setPickerForItem] = useState<string | null>(null);

  const toggleSelected = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  const allSelected = sorted.length > 0 && selected.size === sorted.length;
  const toggleSelectAll = useCallback(() => {
    setSelected((prev) =>
      prev.size === sorted.length ? new Set() : new Set(sorted.map((i) => i.id)),
    );
  }, [sorted]);

  const handleAddSelected = useCallback(() => {
    if (!activeBoxId) {
      onRequestPickBox?.();
      return;
    }
    const ids = sorted.filter((i) => selected.has(i.id)).map((i) => i.id);
    if (ids.length === 0) return;
    onAddManyToBox?.(ids, activeBoxId);
    clearSelection();
  }, [activeBoxId, onRequestPickBox, sorted, selected, onAddManyToBox, clearSelection]);

  // When a drag of the current selection completes, clear it — the items have
  // moved into a box.
  const handleDropForSelection = useCallback(
    (ids: string[]) => {
      if (ids.length > 1) clearSelection();
    },
    [clearSelection],
  );

  if (items.length === 0) {
    return (
      <div className={styles.allBoxed}>
        <p className={styles.allBoxedText}>{"Everything's boxed up. Nice work."}</p>
      </div>
    );
  }

  const selectedCount = selected.size;

  return (
    <div className={styles.wrapper}>
      <div className={styles.headingRow}>
        {mode === "desktop" && (
          <input
            type="checkbox"
            className={styles.selectAllCheckbox}
            checked={allSelected}
            onChange={toggleSelectAll}
            aria-label={ownerCopy.packing.selectAll}
          />
        )}
        <h3 className={styles.heading}>
          Not yet boxed{" "}
          <span className={styles.headingCount}>
            ({items.length} {items.length === 1 ? "item" : "items"})
          </span>
        </h3>
      </div>

      {/* Desktop selection action bar — right-aligned commit surface */}
      {mode === "desktop" && selectedCount > 0 && (
        <div className={styles.selectionBar}>
          <span className={styles.selectionCount}>
            {ownerCopy.packing.selectedCount(selectedCount)}
          </span>
          <div className={styles.selectionActions}>
            <Button variant="secondary" size="sm" onClick={clearSelection}>
              {ownerCopy.packing.clearSelection}
            </Button>
            <Button variant="primary" size="sm" onClick={handleAddSelected}>
              {activeBoxId && activeBoxLabel
                ? ownerCopy.packing.addNToBox(selectedCount, activeBoxLabel)
                : ownerCopy.packing.pickABox}
            </Button>
          </div>
        </div>
      )}

      <ul className={styles.list}>
        {sorted.map((item, index) => (
          <UnboxedItemRow
            key={item.id}
            item={item}
            mode={mode}
            activeBoxId={activeBoxId}
            activeBoxLabel={activeBoxLabel}
            isLast={index === sorted.length - 1}
            isSelected={selected.has(item.id)}
            selectedIds={selected}
            onToggleSelected={toggleSelected}
            {...(onAddToBox ? { onAddToBox } : {})}
            onAddToAnother={() => setPickerForItem(item.id)}
            {...(mode === "desktop" && onItemsDrop ? { onItemsDrop } : {})}
            onDropComplete={handleDropForSelection}
          />
        ))}
      </ul>

      {/* Mobile one-off "add to another box" sheet */}
      {pickerForItem && (
        <PackingBoxSheet
          packingBoxes={availableBoxes}
          activeBoxId={activeBoxId}
          heading="Add to another box"
          onSelect={(boxId) => {
            onAddToBox?.(pickerForItem, boxId);
            setPickerForItem(null);
          }}
          onClose={() => setPickerForItem(null)}
        />
      )}
    </div>
  );
}

function UnboxedItemRow({
  item,
  mode,
  activeBoxId,
  activeBoxLabel,
  isLast,
  isSelected,
  selectedIds,
  onToggleSelected,
  onAddToBox,
  onAddToAnother,
  onItemsDrop,
  onDropComplete,
}: {
  item: ItemAssessment;
  mode: "mobile" | "desktop";
  activeBoxId: string | null;
  activeBoxLabel: string | null;
  isLast: boolean;
  isSelected: boolean;
  selectedIds: Set<string>;
  onToggleSelected: (id: string) => void;
  onAddToBox?: ((itemAssessmentId: string, boxId: string) => void) | undefined;
  onAddToAnother: () => void;
  /** Drop the dragged item(s) into a box (desktop pointer drag). */
  onItemsDrop?: ((itemAssessmentIds: string[], boxId: string) => void) | undefined;
  /** Notifies the parent which ids completed a drop, so it can clear selection. */
  onDropComplete: (ids: string[]) => void;
}) {
  const itemImageUrl = item.image_url ? proxyImageUrl(item.image_url) : undefined;

  // Pointer-drag wiring (desktop only). The whole selected set lifts together
  // when the grabbed row is part of the selection; otherwise just this row.
  const dragIds = useMemo(
    () =>
      selectedIds.has(item.id) && selectedIds.size > 1
        ? [...selectedIds]
        : [item.id],
    [selectedIds, item.id],
  );
  const { beginDrag } = usePackingDrag();
  // Dim this row whenever it is part of the in-flight drag.
  const isDragging = useIsDragging([item.id]);

  // Track the press so a small move promotes the press to a drag, while a press
  // below threshold stays a plain click (checkbox toggle / link follow).
  const pressOrigin = useRef<{ x: number; y: number } | null>(null);
  const startedRef = useRef(false);

  const handleAddToActive = useCallback(() => {
    if (activeBoxId) onAddToBox?.(item.id, activeBoxId);
    else onAddToAnother();
  }, [activeBoxId, onAddToBox, item.id, onAddToAnother]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (mode !== "desktop" || !onItemsDrop) return;
      // Only a primary press, and never from inside an interactive control
      // (checkbox, link, button) — those keep their own behaviour.
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      if (target.closest("input, a, button")) return;
      pressOrigin.current = { x: e.clientX, y: e.clientY };
      startedRef.current = false;
      // Capture immediately so a fast flick that leaves the row before the
      // first move event still routes pointermove here and can cross the drag
      // threshold. Without this, a quick grab can silently fail to start.
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* pointer may already be gone — the gesture still works */
      }
    },
    [mode, onItemsDrop],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!pressOrigin.current || startedRef.current || !onItemsDrop) return;
      const dx = e.clientX - pressOrigin.current.x;
      const dy = e.clientY - pressOrigin.current.y;
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;

      startedRef.current = true;
      const label = dragIds.length > 1 ? `${dragIds.length} items` : item.item_name;
      const ids = dragIds;
      beginDrag({
        ids,
        label,
        event: e,
        onDrop: (boxId) => {
          onItemsDrop(ids, boxId);
          onDropComplete(ids);
        },
      });
    },
    [beginDrag, dragIds, item.item_name, onItemsDrop, onDropComplete],
  );

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    // If a drag never started, release the press-time capture so the row
    // behaves normally. Once a drag begins, the drag provider owns capture and
    // releases it on drop/cancel.
    if (!startedRef.current) {
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        /* capture may already be gone — safe to ignore */
      }
    }
    pressOrigin.current = null;
    startedRef.current = false;
  }, []);

  return (
    <li
      className={`${styles.row}${!isLast ? ` ${styles.rowBordered}` : ""}${isDragging ? ` ${styles.rowDragging}` : ""}${mode === "desktop" ? ` ${styles.rowDraggable}` : ""}`}
      {...(mode === "desktop" && onItemsDrop
        ? {
            onPointerDown: handlePointerDown,
            onPointerMove: handlePointerMove,
            onPointerUp: handlePointerUp,
          }
        : {})}
    >
      <div className={styles.rowLeft}>
        {mode === "desktop" && (
          <span className={styles.gripHandle} aria-hidden="true">
            <GripVertical size={16} />
          </span>
        )}
        {mode === "desktop" && (
          <input
            type="checkbox"
            className={styles.rowCheckbox}
            checked={isSelected}
            onChange={() => onToggleSelected(item.id)}
            aria-label={`Select ${item.item_name}`}
          />
        )}
        {itemImageUrl ? (
          <Image
            src={itemImageUrl}
            alt=""
            width={36}
            height={36}
            className={styles.itemThumb}
            unoptimized
          />
        ) : (
          <div className={styles.itemThumbPlaceholder} aria-hidden="true">
            <Package size={16} />
          </div>
        )}
        <Link href={`/decisions/${item.id}?from=boxes`} className={styles.itemLink}>
          <span className={styles.itemName}>{item.item_name}</span>
        </Link>
        <VerdictBadge verdict={item.verdict} />
      </div>

      {/* Mobile: primary "Add to {activeBox}" + demoted "another box" */}
      {mode === "mobile" && onAddToBox && (
        <div className={styles.rowActions}>
          <Button variant="primary" size="sm" onClick={handleAddToActive}>
            {activeBoxLabel
              ? ownerCopy.packing.addToBox(activeBoxLabel)
              : ownerCopy.packing.addToAnother}
          </Button>
          {activeBoxLabel && (
            <button
              type="button"
              className={styles.addAnotherLink}
              onClick={onAddToAnother}
            >
              {ownerCopy.packing.addToAnother}
            </button>
          )}
        </div>
      )}
    </li>
  );
}
