"use client";

import { useState, useMemo, useCallback } from "react";
import { Package, Plus } from "lucide-react";

import { BoxCard } from "@/components/boxes/BoxCard";
import { CreateBoxPanel } from "@/components/boxes/CreateBoxPanel";
import { UnboxedItems } from "@/components/boxes/UnboxedItems";
import { ShipAllButton } from "@/components/boxes/ShipAllButton";
import { Button } from "@/components/ui/button";
import type { Box, BoxItem, ItemAssessment } from "@/types";
import { BoxType, BoxSize, BoxStatus, Verdict } from "@/lib/constants";

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
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <Package className="size-12 text-muted-foreground/50" />
          <div className="max-w-xs">
            <p className="text-base font-medium text-foreground">
              No boxes yet.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {"Start packing by telling Aisling which room you\u2019re tackling, or tap \u2018New box\u2019 below."}
            </p>
          </div>
          {onCreateBox && (
            <Button
              className="h-12 w-full max-w-xs gap-1.5"
              onClick={() => setCreatePanelOpen(true)}
            >
              <Plus className="size-4" />
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

  return (
    <>
      <div className="space-y-6">
        {/* Ship all button */}
        {shippableBoxCount > 0 && onShipAll && (
          <div className="flex justify-end">
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
            <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Travelling with me
            </h3>
            <div className="space-y-3">
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
            {/* Visual separator */}
            <div className="mt-4 border-b border-border" />
          </section>
        )}

        {/* Freight boxes */}
        {freightBoxes.length > 0 && (
          <section aria-label="Shipping boxes">
            <div className="space-y-3">
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
            className="h-12 w-full gap-1.5"
            onClick={() => setCreatePanelOpen(true)}
          >
            <Plus className="size-4" />
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
