"use client";

import { useState, useMemo, useCallback } from "react";
import {
  ConfirmDialog,
  EmptyState,
} from "@thefairies/design-system/components";
import { computeBoxLabel } from "@/lib/constants";

import { BoxCard } from "@/components/boxes/BoxCard";
import type { FlaggedItem, ScanResult } from "@/components/boxes/BoxCard";
import type { DraftKind } from "@/components/boxes/ScanDraftReview";
import { PackingDragProvider } from "@/components/boxes/PackingDrag";
import { originSideFromTrigger, usePanelDeepLink } from "@/components/panels";
import { UnboxedItems } from "@/components/boxes/UnboxedItems";
import { PackAllButton } from "@/components/boxes/PackAllButton";
import { useIsDesktop } from "@/lib/hooks/useIsDesktop";
import type { Box, BoxItem, ItemAssessment } from "@/types";
import { BoxType, BoxStatus, Verdict, BiosecurityFlag } from "@/lib/constants";
import { cn } from "@/lib/utils";

import styles from "./BoxList.module.css";

type BoxSortKey = "number" | "name";

interface BoxListProps {
  boxes: Box[];
  boxItems: Record<string, BoxItem[]>;
  assessments?: ItemAssessment[] | undefined;
  /** Open the create-box panel (owned by the parent, alongside the page title). */
  onRequestCreate?: (() => void) | undefined;
  onAddItem?: ((boxId: string, itemName: string) => void) | undefined;
  onRemoveItem?: ((boxId: string, boxItemId: string) => void) | undefined;
  onMarkPacked?: ((boxId: string) => void) | undefined;
  onAddToBox?: ((itemAssessmentId: string, boxId: string) => void) | undefined;
  /** Batch add — used by desktop multi-select and multi-item drag. */
  onAddManyToBox?: ((itemAssessmentIds: string[], boxId: string) => void) | undefined;
  onUpdateBox?: ((boxId: string, updates: { label?: string; room_name?: string; room_code?: string; size?: string; is_biosecurity?: boolean }) => void) | undefined;
  onPackAll?: (() => void) | undefined;
  /** The box new items flow into by default. */
  activeBoxId?: string | null | undefined;
  onSetActiveBox?: ((boxId: string | null) => void) | undefined;
  /** Manually mark a box as biosecurity (override; flagged boxes are auto). */
  onMarkBiosecurity?: ((boxId: string) => void) | undefined;
  /** Apply a renumber after any swap has been confirmed. */
  onRenumberBox?: ((boxId: string, newNumber: number) => void) | undefined;
  /** Scan results keyed by box ID */
  scanResults?: Record<string, ScanResult> | undefined;
  /** Flagged items keyed by box ID */
  flaggedItemsByBox?: Record<string, FlaggedItem[]> | undefined;
  /** Called when user initiates a sticker scan */
  onScanSticker?: ((boxId: string, file: File) => void) | undefined;
  /** Called when user ships a flagged item anyway */
  onShipAnyway?: ((itemId: string, boxId: string) => void) | undefined;
  /** Called when user removes a flagged item from the box */
  onRemoveFlaggedItem?: ((itemId: string, boxId: string) => void) | undefined;
  /** Confirm all scan draft items in a box */
  onConfirmDrafts?: ((boxId: string) => void) | undefined;
  /** Remove a single scan draft item */
  onRemoveDraft?: ((boxId: string, item: BoxItem, kind: DraftKind) => void) | undefined;
  /** Box IDs with a confirm-drafts request in flight */
  confirmingDraftBoxes?: Set<string> | undefined;
  /** Box IDs that are currently scanning */
  scanningBoxes?: Set<string> | undefined;
  /** Item IDs currently being resolved */
  resolvingItemIds?: Set<string> | undefined;
}

export function BoxList({
  boxes,
  boxItems,
  assessments = [],
  onRequestCreate,
  onAddItem,
  onRemoveItem,
  onMarkPacked,
  onAddToBox,
  onAddManyToBox,
  onUpdateBox,
  onPackAll,
  scanResults,
  flaggedItemsByBox,
  onScanSticker,
  onShipAnyway,
  onRemoveFlaggedItem,
  onConfirmDrafts,
  onRemoveDraft,
  confirmingDraftBoxes,
  scanningBoxes,
  resolvingItemIds,
  activeBoxId,
  onSetActiveBox,
  onMarkBiosecurity,
  onRenumberBox,
}: BoxListProps) {
  const [sortBy, setSortBy] = useState<BoxSortKey>("number");
  const isDesktop = useIsDesktop();

  // `?box=<id>` opens the box panel (deep link); opening a card on desktop
  // writes the param so the URL stays shareable. Mobile keeps the BoxCard's
  // internal inline-expand state.
  const boxPanel = usePanelDeepLink("box", "box");

  // Build assessment lookup map
  const assessmentMap = useMemo(() => {
    const map: Record<string, ItemAssessment> = {};
    for (const a of assessments) {
      map[a.id] = a;
    }
    return map;
  }, [assessments]);

  // Separate boxes by type
  const { travellingBoxes, freightBoxes } = useMemo(() => {
    const travelling: Box[] = [];
    const freight: Box[] = [];

    for (const box of boxes) {
      if (
        box.box_type === BoxType.CARRYON ||
        box.box_type === BoxType.CHECKED_LUGGAGE
      ) {
        travelling.push(box);
      } else {
        freight.push(box);
      }
    }

    // Sort both sections by the chosen key: box number ascending (WH01, WH02, …)
    // or room name alphabetically (number as the tiebreak).
    const sortFn =
      sortBy === "name"
        ? (a: Box, b: Box) =>
            a.room_name.localeCompare(b.room_name, undefined, {
              sensitivity: "base",
              numeric: true,
            }) || a.box_number - b.box_number
        : (a: Box, b: Box) => a.box_number - b.box_number;

    travelling.sort(sortFn);
    freight.sort(sortFn);

    return { travellingBoxes: travelling, freightBoxes: freight };
  }, [boxes, sortBy]);

  // Unboxed items: SHIP or CARRY items not assigned to any box
  const unboxedItems = useMemo(() => {
    const boxedAssessmentIds = new Set<string>();
    for (const items of Object.values(boxItems)) {
      for (const item of items) {
        if (item.item_assessment_id) {
          boxedAssessmentIds.add(item.item_assessment_id);
        }
      }
    }
    return assessments.filter(
      (a) =>
        (a.verdict === Verdict.SHIP || a.verdict === Verdict.CARRY) &&
        !boxedAssessmentIds.has(a.id)
    );
  }, [assessments, boxItems]);

  // Which box (if any) each assessment currently sits in.
  const itemBoxIdMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const [bid, items] of Object.entries(boxItems)) {
      for (const it of items) {
        if (it.item_assessment_id) m.set(it.item_assessment_id, bid);
      }
    }
    return m;
  }, [boxItems]);

  // Suggestions for a luggage/carry-on box: every CARRY item not already in it,
  // INCLUDING ones currently in a freight box (picking one moves it into
  // luggage). Luggage is where carry items belong, so we surface them all here
  // rather than only the unboxed ones.
  const carryCandidatesFor = useCallback(
    (boxId: string) =>
      assessments.filter(
        (a) => a.verdict === Verdict.CARRY && itemBoxIdMap.get(a.id) !== boxId,
      ),
    [assessments, itemBoxIdMap],
  );

  // Boxes available for adding items to (packing status only)
  const availableBoxes = useMemo(
    () => boxes.filter((b) => b.status === BoxStatus.PACKING),
    [boxes]
  );

  // Count of biosecurity-flagged items currently in each box — drives the
  // nudge. Deterministic: pure function of box contents + assessment flags.
  const biosecItemCountByBox = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const [boxId, items] of Object.entries(boxItems)) {
      let n = 0;
      for (const item of items) {
        const flag = item.item_assessment_id
          ? assessmentMap[item.item_assessment_id]?.biosecurity_flag
          : undefined;
        if (flag && flag !== BiosecurityFlag.NONE) n += 1;
      }
      counts[boxId] = n;
    }
    return counts;
  }, [boxItems, assessmentMap]);

  const activeBox = activeBoxId
    ? boxes.find((b) => b.id === activeBoxId) ?? null
    : null;
  const activeBoxLabel = activeBox?.label ?? null;

  // Pointer-drag drop: route dragged item(s) into the target box. Signature
  // matches UnboxedItems' onItemsDrop(ids, boxId).
  const handleItemsDrop = useCallback(
    (assessmentIds: string[], boxId: string) => {
      if (assessmentIds.length === 0) return;
      onSetActiveBox?.(boxId);
      if (assessmentIds.length === 1 && assessmentIds[0]) {
        onAddToBox?.(assessmentIds[0], boxId);
      } else {
        onAddManyToBox?.(assessmentIds, boxId);
      }
    },
    [onAddToBox, onAddManyToBox, onSetActiveBox]
  );

  // Manual renumber. If the target number is already taken, hold a confirm that
  // spells out the swap before applying it (the server swaps atomically).
  const [pendingRenumber, setPendingRenumber] = useState<
    { box: Box; newNumber: number; swapWith: Box } | null
  >(null);

  const handleRenumberRequest = useCallback(
    (boxId: string, newNumber: number) => {
      if (!onRenumberBox) return;
      const box = boxes.find((b) => b.id === boxId);
      if (!box || box.box_number === newNumber) return;
      const swapWith = boxes.find(
        (b) => b.id !== boxId && b.box_number === newNumber,
      );
      if (swapWith) {
        setPendingRenumber({ box, newNumber, swapWith });
      } else {
        onRenumberBox(boxId, newNumber);
      }
    },
    [boxes, onRenumberBox],
  );

  // Per-box props for the active marker, biosec badge, renumber, and (desktop)
  // drop-target wiring. Drop is gated to packing boxes + desktop.
  const buildBoxExtras = useCallback(
    (box: Box) => {
      const isPacking = box.status === BoxStatus.PACKING;
      const extras: Partial<React.ComponentProps<typeof BoxCard>> = {
        isActive: box.id === activeBoxId,
        biosecItemCount: biosecItemCountByBox[box.id] ?? 0,
      };
      if (onSetActiveBox && isPacking) {
        extras.onSetActive = (active: boolean) =>
          onSetActiveBox(active ? box.id : null);
      }
      if (onMarkBiosecurity) extras.onMarkBiosecurity = onMarkBiosecurity;
      if (onRenumberBox) extras.onRenumber = handleRenumberRequest;

      // Desktop packing boxes are live pointer-drag drop targets. The id flows
      // into data-droppable-box-id; the hovered-highlight is read inside the card.
      if (isDesktop && isPacking && (onAddToBox || onAddManyToBox)) {
        extras.droppableBoxId = box.id;
      }
      return extras;
    },
    [
      activeBoxId,
      biosecItemCountByBox,
      onSetActiveBox,
      onMarkBiosecurity,
      onRenumberBox,
      handleRenumberRequest,
      isDesktop,
      onAddToBox,
      onAddManyToBox,
    ]
  );

  // Count boxes eligible for "ship all"
  const packableBoxCount = useMemo(
    () => boxes.filter((b) => b.status === BoxStatus.PACKING).length,
    [boxes]
  );

  // Box stats for the cockpit rail. Declared here (above the early return)
  // so hook order stays stable across renders.
  const boxStats = useMemo(() => {
    const counts: Record<string, number> = { packing: 0, packed: 0, shipped: 0, arrived: 0 };
    let totalCbm = 0;
    for (const b of boxes) {
      const cur = counts[b.status];
      if (cur !== undefined) counts[b.status] = cur + 1;
      if (b.cbm) totalCbm += b.cbm;
    }
    return { counts, totalCbm };
  }, [boxes]);

  // Adapt onAddToBox(assessmentId, boxId) to BoxCard's onAddExistingItem(boxId, assessmentId)
  const handleAddExistingItem = useCallback(
    (boxId: string, assessmentId: string) => {
      onAddToBox?.(assessmentId, boxId);
    },
    [onAddToBox]
  );

  // Empty state
  if (boxes.length === 0 && unboxedItems.length === 0) {
    return (
      <EmptyState
        heading="No boxes yet"
        description="Start packing by telling Aisling which room you're tackling, or use New box above."
        ctaLabel="New box"
        onCtaClick={onRequestCreate ?? (() => undefined)}
      />
    );
  }

  return (
    <PackingDragProvider>
      <div className={styles.list}>
        <div className={styles.cockpit}>
        <div className={styles.cockpitMain}>
        {/* List controls: Sort on the left, Mark-all-as-packed on the right.
            (New box lives next to the page title, above.) */}
        {(travellingBoxes.length + freightBoxes.length > 1 ||
          (packableBoxCount > 0 && onPackAll)) && (
          <div className={styles.toolbar}>
            <div className={styles.toolbarStart}>
              {travellingBoxes.length + freightBoxes.length > 1 && (
                <div className={styles.sortRow}>
                  <span className={styles.sortLabel}>Sort</span>
                  <div className={styles.sortToggle} role="group" aria-label="Sort boxes by">
                    <button
                      type="button"
                      className={cn(styles.sortBtn, sortBy === "number" && styles.sortBtnActive)}
                      aria-pressed={sortBy === "number"}
                      onClick={() => setSortBy("number")}
                    >
                      Number
                    </button>
                    <button
                      type="button"
                      className={cn(styles.sortBtn, sortBy === "name" && styles.sortBtnActive)}
                      aria-pressed={sortBy === "name"}
                      onClick={() => setSortBy("name")}
                    >
                      Name
                    </button>
                  </div>
                </div>
              )}
            </div>
            {packableBoxCount > 0 && onPackAll && (
              <div className={styles.toolbarEnd}>
                <PackAllButton boxCount={packableBoxCount} onConfirm={onPackAll} />
              </div>
            )}
          </div>
        )}

        {/* Travelling with me section */}
        {travellingBoxes.length > 0 && (
          <section aria-label="Travelling with me">
            <h3 className={styles.sectionLabel}>Travelling with me</h3>
            <div className={styles.sectionCards}>
              {travellingBoxes.map((box) => (
                <BoxCard
                  key={box.id}
                  box={box}
                  items={boxItems[box.id] ?? []}
                  assessments={assessmentMap}
                  unboxedItems={carryCandidatesFor(box.id)}
                  {...(onAddItem ? { onAddItem } : {})}
                  {...(onAddToBox ? { onAddExistingItem: handleAddExistingItem } : {})}
                  {...(onRemoveItem ? { onRemoveItem } : {})}
                  {...(onMarkPacked ? { onMarkPacked } : {})}
                  {...(onUpdateBox ? { onUpdateBox } : {})}
                  {...(scanResults?.[box.id] ? { scanResult: scanResults[box.id] } : {})}
                  flaggedItems={flaggedItemsByBox?.[box.id] ?? []}
                  {...(onScanSticker ? { onScanSticker } : {})}
                  {...(onShipAnyway ? { onShipAnyway } : {})}
                  {...(onRemoveFlaggedItem ? { onRemoveFlaggedItem } : {})}
                  {...(onConfirmDrafts ? { onConfirmDrafts } : {})}
                  {...(onRemoveDraft ? { onRemoveDraft } : {})}
                  isConfirmingDrafts={confirmingDraftBoxes?.has(box.id) ?? false}
                  isScanning={scanningBoxes?.has(box.id) ?? false}
                  resolvingItemIds={resolvingItemIds}
                  {...buildBoxExtras(box)}
                  {...(isDesktop
                    ? {
                        open: false,
                        onOpenChange: (next: boolean) => {
                          if (next) boxPanel.open(box.id, originSideFromTrigger());
                        },
                      }
                    : {})}
                />
              ))}
            </div>
            <div className={styles.divider} />
          </section>
        )}

        {/* Freight boxes */}
        {freightBoxes.length > 0 && (
          <section aria-label="Shipping boxes">
            <h3 className={styles.sectionLabel}>Shipping boxes</h3>
            <div className={styles.sectionCards}>
              {freightBoxes.map((box) => (
                <BoxCard
                  key={box.id}
                  box={box}
                  items={boxItems[box.id] ?? []}
                  assessments={assessmentMap}
                  unboxedItems={unboxedItems}
                  {...(onAddItem ? { onAddItem } : {})}
                  {...(onAddToBox ? { onAddExistingItem: handleAddExistingItem } : {})}
                  {...(onRemoveItem ? { onRemoveItem } : {})}
                  {...(onMarkPacked ? { onMarkPacked } : {})}
                  {...(onUpdateBox ? { onUpdateBox } : {})}
                  {...(scanResults?.[box.id] ? { scanResult: scanResults[box.id] } : {})}
                  flaggedItems={flaggedItemsByBox?.[box.id] ?? []}
                  {...(onScanSticker ? { onScanSticker } : {})}
                  {...(onShipAnyway ? { onShipAnyway } : {})}
                  {...(onRemoveFlaggedItem ? { onRemoveFlaggedItem } : {})}
                  {...(onConfirmDrafts ? { onConfirmDrafts } : {})}
                  {...(onRemoveDraft ? { onRemoveDraft } : {})}
                  isConfirmingDrafts={confirmingDraftBoxes?.has(box.id) ?? false}
                  isScanning={scanningBoxes?.has(box.id) ?? false}
                  resolvingItemIds={resolvingItemIds}
                  {...buildBoxExtras(box)}
                  {...(isDesktop
                    ? {
                        open: false,
                        onOpenChange: (next: boolean) => {
                          if (next) boxPanel.open(box.id, originSideFromTrigger());
                        },
                      }
                    : {})}
                />
              ))}
            </div>
          </section>
        )}

        {/* On mobile, unboxed items sit below the boxes list. On desktop the
           same component is rendered inside the cockpit rail below. */}
        {!isDesktop && assessments.length > 0 && (
          <UnboxedItems
            items={unboxedItems}
            availableBoxes={availableBoxes}
            activeBoxId={activeBoxId ?? null}
            activeBoxLabel={activeBoxLabel}
            mode="mobile"
            {...(onAddToBox ? { onAddToBox } : {})}
          />
        )}

        </div>{/* /.cockpitMain */}

        {/* Cockpit rail — desktop only via CSS. Boxes live in the main column
            (select via the checkbox on each card); the rail holds the summary
            and the not-yet-boxed items. */}
        <aside className={styles.cockpitRail} aria-label="Packing summary">
          <div className={styles.railCard}>
            <p className={styles.railEyebrow}>Packing</p>
            <dl className={styles.railStats}>
              <div className={styles.railStat}>
                <dt>Packing</dt>
                <dd>{boxStats.counts.packing}</dd>
              </div>
              <div className={styles.railStat}>
                <dt>Packed</dt>
                <dd>{boxStats.counts.packed}</dd>
              </div>
              <div className={styles.railStat}>
                <dt>Shipped</dt>
                <dd>{boxStats.counts.shipped}</dd>
              </div>
              <div className={styles.railStat}>
                <dt>Arrived</dt>
                <dd>{boxStats.counts.arrived}</dd>
              </div>
            </dl>
            {boxStats.totalCbm > 0 && (
              <div className={styles.railFooterStat}>
                <span>Total volume</span>
                <strong>{boxStats.totalCbm.toFixed(2)} m³</strong>
              </div>
            )}
          </div>

          {assessments.length > 0 && (
            <div className={styles.railUnboxedCard}>
              <UnboxedItems
                items={unboxedItems}
                availableBoxes={availableBoxes}
                activeBoxId={activeBoxId ?? null}
                activeBoxLabel={activeBoxLabel}
                mode="desktop"
                {...(onAddToBox ? { onAddToBox } : {})}
                {...(onAddManyToBox ? { onAddManyToBox } : {})}
                {...(onSetActiveBox
                  ? {
                      onRequestPickBox: () => {
                        // No active box yet — nudge the user to the box checkboxes.
                        document
                          .querySelector<HTMLElement>("[data-box-select]")
                          ?.focus();
                      },
                    }
                  : {})}
                onItemsDrop={handleItemsDrop}
              />
            </div>
          )}
        </aside>
        </div>{/* /.cockpit */}
      </div>

      {pendingRenumber && (
        <ConfirmDialog
          isOpen={true}
          onClose={() => setPendingRenumber(null)}
          title="Swap box numbers?"
          description={`${pendingRenumber.box.label} becomes ${computeBoxLabel(
            pendingRenumber.box.box_type,
            pendingRenumber.box.room_name,
            pendingRenumber.newNumber,
            pendingRenumber.box.room_name,
          )}, and ${pendingRenumber.swapWith.label} becomes ${computeBoxLabel(
            pendingRenumber.swapWith.box_type,
            pendingRenumber.swapWith.room_name,
            pendingRenumber.box.box_number,
            pendingRenumber.swapWith.room_name,
          )}.`}
          confirmLabel="Swap"
          cancelLabel="Cancel"
          onConfirm={() => {
            onRenumberBox?.(pendingRenumber.box.id, pendingRenumber.newNumber);
            setPendingRenumber(null);
          }}
        />
      )}
    </PackingDragProvider>
  );
}
