"use client";

import { useState, useMemo, useCallback } from "react";
import { Package, Plus } from "lucide-react";
import { Button } from "@thefairies/design-system/components";

import { BoxCard } from "@/components/boxes/BoxCard";
import { CreateBoxPanel } from "@/components/boxes/CreateBoxPanel";
import { UnboxedItems } from "@/components/boxes/UnboxedItems";
import { ShipAllButton } from "@/components/boxes/ShipAllButton";
import type { Box, BoxItem, ItemAssessment } from "@/types";
import { BoxType, BoxSize, BoxStatus, Verdict } from "@/lib/constants";

import styles from "./BoxList.module.css";

interface BoxListProps {
  boxes: Box[];
  boxItems: Record<string, BoxItem[]>;
  assessments?: ItemAssessment[] | undefined;
  onCreateBox?: ((data: {
    roomName: string;
    size: BoxSize;
    boxType: (typeof BoxType)[keyof typeof BoxType];
  }) => void) | undefined;
  onAddItem?: ((boxId: string, itemName: string) => void) | undefined;
  onRemoveItem?: ((boxId: string, boxItemId: string) => void) | undefined;
  onMarkPacked?: ((boxId: string) => void) | undefined;
  onAddToBox?: ((itemAssessmentId: string, boxId: string) => void) | undefined;
  onShipAll?: (() => void) | undefined;
  isCreating?: boolean | undefined;
}

const STATUS_ORDER: Record<string, number> = {
  packing: 0,
  packed: 1,
  shipped: 2,
  arrived: 3,
};

export function BoxList({
  boxes,
  boxItems,
  assessments = [],
  onCreateBox,
  onAddItem,
  onRemoveItem,
  onMarkPacked,
  onAddToBox,
  onShipAll,
  isCreating,
}: BoxListProps) {
  const [createPanelOpen, setCreatePanelOpen] = useState(false);

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

    // Sort: carry-on first, then checked luggage by number
    travelling.sort((a, b) => {
      if (a.box_type === BoxType.CARRYON) return -1;
      if (b.box_type === BoxType.CARRYON) return 1;
      return a.box_number - b.box_number;
    });

    // Sort freight: by status priority, then most recently updated first
    freight.sort((a, b) => {
      const statusDiff =
        (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
      if (statusDiff !== 0) return statusDiff;
      return (
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
    });

    return { travellingBoxes: travelling, freightBoxes: freight };
  }, [boxes]);

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

  // Boxes available for adding items to (packing status only)
  const availableBoxes = useMemo(
    () => boxes.filter((b) => b.status === BoxStatus.PACKING),
    [boxes]
  );

  // Count boxes eligible for "ship all"
  const shippableBoxCount = useMemo(
    () =>
      boxes.filter(
        (b) =>
          b.status === BoxStatus.PACKING || b.status === BoxStatus.PACKED
      ).length,
    [boxes]
  );

  const handleCreateBox = useCallback(
    (data: {
      roomName: string;
      size: BoxSize;
      boxType: (typeof BoxType)[keyof typeof BoxType];
    }) => {
      onCreateBox?.(data);
      setCreatePanelOpen(false);
    },
    [onCreateBox]
  );

  // Empty state
  if (boxes.length === 0 && unboxedItems.length === 0) {
    return (
      <>
        <div className={styles.emptyState}>
          <Package style={{ width: 48, height: 48, color: "var(--color-text-muted)", opacity: 0.5 }} />
          <div className={styles.emptyCtaWrap}>
            <p className={styles.emptyTitle}>No boxes yet.</p>
            <p className={styles.emptyBody}>
              {"Start packing by telling Aisling which room you\u2019re tackling, or tap \u2018New box\u2019 below."}
            </p>
          </div>
          {onCreateBox && (
            <div style={{ width: "100%", maxWidth: 320 }}>
              <Button
                variant="primary"
                size="lg"
                style={{ width: "100%", gap: 6 }}
                onClick={() => setCreatePanelOpen(true)}
              >
                <Plus style={{ width: 16, height: 16 }} />
                New box
              </Button>
            </div>
          )}
        </div>

        <CreateBoxPanel
          open={createPanelOpen}
          onClose={() => setCreatePanelOpen(false)}
          onSubmit={handleCreateBox}
          {...(isCreating !== undefined ? { isSubmitting: isCreating } : {})}
        />
      </>
    );
  }

  return (
    <>
      <div className={styles.list}>
        {/* Ship all button */}
        {shippableBoxCount > 0 && onShipAll && (
          <div className={styles.shipAllRow}>
            <ShipAllButton
              boxCount={shippableBoxCount}
              singleItemCount={0}
              onConfirm={onShipAll}
            />
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
                  {...(onAddItem ? { onAddItem } : {})}
                  {...(onRemoveItem ? { onRemoveItem } : {})}
                  {...(onMarkPacked ? { onMarkPacked } : {})}
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
                  {...(onAddItem ? { onAddItem } : {})}
                  {...(onRemoveItem ? { onRemoveItem } : {})}
                  {...(onMarkPacked ? { onMarkPacked } : {})}
                />
              ))}
            </div>
          </section>
        )}

        {/* Unboxed items */}
        {assessments.length > 0 && (
          <UnboxedItems
            items={unboxedItems}
            availableBoxes={availableBoxes}
            {...(onAddToBox ? { onAddToBox } : {})}
          />
        )}

        {/* New box button — always visible at bottom */}
        {onCreateBox && (
          <Button
            variant="primary"
            size="lg"
            className={styles.newBoxButton ?? ""}
            onClick={() => setCreatePanelOpen(true)}
          >
            <Plus style={{ width: 16, height: 16 }} />
            New box
          </Button>
        )}
      </div>

      <CreateBoxPanel
        open={createPanelOpen}
        onClose={() => setCreatePanelOpen(false)}
        onSubmit={handleCreateBox}
        {...(isCreating !== undefined ? { isSubmitting: isCreating } : {})}
      />
    </>
  );
}
