"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ChevronDown,
  Luggage,
  Package,
  PackagePlus,
  Pencil,
  Plane,
  ShoppingBag,
  Trash2,
} from "lucide-react";
import {
  ConfirmDialog,
  EmptyState,
  Skeleton,
  SkeletonGroup,
} from "@thefairies/design-system/components";
import { BoxCard } from "@/components/boxes/BoxCard";
import { BoxPicker } from "@/components/boxes/BoxPicker";
import { BoxStatusBadge } from "@/components/boxes/BoxStatusBadge";
import { VerdictBadge } from "@/components/chat/VerdictBadge";
import { CostSummary } from "@/components/inventory/CostSummary";
import { ItemEditPanel } from "@/components/inventory/ItemEditPanel";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/shared/Collapsible";
import type { Verdict } from "@/lib/constants";
import { useInventory } from "@/lib/hooks/useInventory";
import type { Box, BoxItem, ItemAssessment } from "@/types";
import { cn } from "@/lib/utils";

import styles from "./InventoryPanel.module.css";

type ViewMode = "container" | "verdict";

const VERDICT_ORDER: Verdict[] = [
  "SHIP",
  "CARRY",
  "SELL",
  "DONATE",
  "DISCARD",
  "DECIDE_LATER",
];

interface InventoryPanelProps {
  className?: string;
  /** Called when the user taps "Back to Aisling" from inside the edit panel on mobile */
  onBackToChat?: (() => void) | undefined;
}

export function InventoryPanel({ className, onBackToChat }: InventoryPanelProps) {
  const { assessments, boxes, boxItems, costSummary, isLoading, error, refreshInventory } =
    useInventory();
  const [viewMode, setViewMode] = useState<ViewMode>("container");
  const prefersReducedMotion = useReducedMotion();
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  const isEmpty = assessments.length === 0 && boxes.length === 0;
  const router = useRouter();

  return (
    <div className={cn(styles.panel, className)} aria-live="polite">
      <div className={styles.scrollArea}>
        <CostSummary data={costSummary} variant="full" />

        <div className={styles.tabBar}>
          <button
            type="button"
            onClick={() => setViewMode("container")}
            className={cn(styles.tab, viewMode === "container" && styles.tabActive)}
          >
            By container
          </button>
          <button
            type="button"
            onClick={() => setViewMode("verdict")}
            className={cn(styles.tab, viewMode === "verdict" && styles.tabActive)}
          >
            By verdict
          </button>
        </div>
        {isLoading ? (
          <LoadingSkeleton />
        ) : error ? (
          <ErrorState error={error} onRetry={refreshInventory} />
        ) : isEmpty ? (
          <EmptyState
            heading="Your inventory is empty"
            description="Start a conversation with Aisling to assess your belongings — she'll help you decide what to ship, sell, or leave behind."
            ctaLabel="Start with Aisling"
            onCtaClick={() => router.push("/inventory")}
          />
        ) : (
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={viewMode}
              initial={prefersReducedMotion ? false : isMobile ? { opacity: 0 } : { opacity: 0, y: 8 }}
              animate={isMobile ? { opacity: 1 } : { opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : isMobile ? { opacity: 0 } : { opacity: 0, y: -8 }}
              transition={prefersReducedMotion ? { duration: 0 } : { duration: isMobile ? 0.1 : 0.15 }}
            >
              {viewMode === "container" ? (
                <ContainerView
                  assessments={assessments}
                  boxes={boxes}
                  boxItems={boxItems}
                  onRefresh={refreshInventory}
                  onBackToChat={onBackToChat}
                />
              ) : (
                <VerdictView
                  assessments={assessments}
                  boxes={boxes}
                  onRefresh={refreshInventory}
                  onBackToChat={onBackToChat}
                />
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Container view                                                     */
/* ------------------------------------------------------------------ */

function ContainerView({
  assessments,
  boxes,
  boxItems,
  onRefresh,
  onBackToChat,
}: {
  assessments: ItemAssessment[];
  boxes: Box[];
  boxItems: Record<string, BoxItem[]>;
  onRefresh: () => void;
  onBackToChat?: (() => void) | undefined;
}) {
  const assessmentMap = useMemo(
    () =>
      assessments.reduce<Record<string, ItemAssessment>>((acc, a) => {
        acc[a.id] = a;
        return acc;
      }, {}),
    [assessments]
  );

  const handleAddItem = useCallback(
    async (boxId: string, itemName: string) => {
      await fetch(`/api/boxes/${boxId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_name: itemName }),
      });
      onRefresh();
    },
    [onRefresh]
  );

  const handleAddExistingItem = useCallback(
    async (boxId: string, assessmentId: string) => {
      await fetch(`/api/boxes/${boxId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_assessment_id: assessmentId }),
      });
      onRefresh();
    },
    [onRefresh]
  );

  const handleAssignToBox = useCallback(
    async (boxId: string, assessmentId: string) => {
      await fetch(`/api/boxes/${boxId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_assessment_id: assessmentId }),
      });
      onRefresh();
    },
    [onRefresh]
  );

  const handleRemoveItem = useCallback(
    async (boxId: string, boxItemId: string) => {
      await fetch(`/api/boxes/${boxId}/items/${boxItemId}`, {
        method: "DELETE",
      });
      onRefresh();
    },
    [onRefresh]
  );

  const handleMarkPacked = useCallback(
    async (boxId: string) => {
      await fetch(`/api/boxes/${boxId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "packed" }),
      });
      onRefresh();
    },
    [onRefresh]
  );

  const luggageBoxes = boxes.filter(
    (b) => b.box_type === "carryon" || b.box_type === "checked_luggage"
  );
  const freightBoxes = boxes
    .filter((b) => b.box_type === "standard")
    .sort((a, b) => {
      const statusOrder: Record<string, number> = {
        packing: 0,
        packed: 1,
        shipped: 2,
        arrived: 3,
      };
      const diff = (statusOrder[a.status] ?? 4) - (statusOrder[b.status] ?? 4);
      if (diff !== 0) return diff;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  const singleItems = boxes.filter((b) => b.box_type === "single_item");

  const boxedItemIds = new Set(
    Object.values(boxItems)
      .flat()
      .filter((bi) => bi.item_assessment_id)
      .map((bi) => bi.item_assessment_id)
  );
  const unboxedItems = assessments.filter(
    (a) => (a.verdict === "SHIP" || a.verdict === "CARRY") && !boxedItemIds.has(a.id)
  );

  const packingBoxes = boxes.filter((b) => b.status === "packing");

  // Item count per box, for display in BoxPicker
  const boxItemCounts = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(boxItems).map(([bid, bItems]) => [bid, bItems.length])
      ),
    [boxItems]
  );

  const notShipping = assessments.filter(
    (a) => a.verdict === "SELL" || a.verdict === "DONATE" || a.verdict === "DISCARD"
  );

  return (
    <div className={styles.viewStack}>
      {luggageBoxes.length > 0 && (
        <Section icon={Plane} title="Travelling with me">
          <div className={styles.sectionContent}>
            {luggageBoxes.map((box) => (
              <BoxCard
                key={box.id}
                box={box}
                items={boxItems[box.id] ?? []}
                assessments={assessmentMap}
                unboxedItems={unboxedItems}
                onAddItem={handleAddItem}
                onAddExistingItem={handleAddExistingItem}
                onRemoveItem={handleRemoveItem}
                onMarkPacked={handleMarkPacked}
              />
            ))}
          </div>
        </Section>
      )}

      {freightBoxes.length > 0 && (
        <Section icon={Package} title="Freight boxes">
          <div className={styles.sectionContent}>
            {freightBoxes.map((box) => (
              <BoxCard
                key={box.id}
                box={box}
                items={boxItems[box.id] ?? []}
                assessments={assessmentMap}
                unboxedItems={unboxedItems}
                onAddItem={handleAddItem}
                onAddExistingItem={handleAddExistingItem}
                onRemoveItem={handleRemoveItem}
                onMarkPacked={handleMarkPacked}
              />
            ))}
          </div>
        </Section>
      )}

      {singleItems.length > 0 && (
        <Section icon={Luggage} title="Large items — shipping individually">
          <div className={styles.sectionContent}>
            {singleItems.map((box) => (
              <div key={box.id} className={styles.singleItemRow}>
                <div>
                  <p className={styles.singleItemLabel}>{box.label}</p>
                  {box.cbm !== null && (
                    <p className={styles.singleItemSubLabel}>{box.cbm} CBM</p>
                  )}
                </div>
                <BoxStatusBadge status={box.status} />
              </div>
            ))}
          </div>
        </Section>
      )}

      {unboxedItems.length > 0 && (
        <Section icon={PackagePlus} title="Not yet boxed">
          <div className={styles.collapsibleItems}>
            {unboxedItems.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                boxes={boxes}
                packingBoxes={packingBoxes}
                boxItemCounts={boxItemCounts}
                onAssignToBox={handleAssignToBox}
                onRefresh={onRefresh}
                onBackToChat={onBackToChat}
              />
            ))}
          </div>
        </Section>
      )}

      {notShipping.length > 0 && (
        <NotShippingSection items={notShipping} onRefresh={onRefresh} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Verdict view                                                       */
/* ------------------------------------------------------------------ */

function VerdictView({
  assessments,
  boxes,
  onRefresh,
  onBackToChat,
}: {
  assessments: ItemAssessment[];
  boxes: Box[];
  onRefresh: () => void;
  onBackToChat?: (() => void) | undefined;
}) {
  const grouped = VERDICT_ORDER.reduce(
    (acc, v) => {
      const items = assessments.filter((a) => a.verdict === v);
      if (items.length > 0) acc.push({ verdict: v, items });
      return acc;
    },
    [] as { verdict: Verdict; items: ItemAssessment[] }[]
  );

  return (
    <div className={styles.viewStack}>
      {grouped.map(({ verdict, items }) => (
        <VerdictGroup
          key={verdict}
          verdict={verdict}
          items={items}
          boxes={boxes}
          onRefresh={onRefresh}
          onBackToChat={onBackToChat}
        />
      ))}
    </div>
  );
}

function VerdictGroup({
  verdict,
  items,
  boxes,
  onRefresh,
  onBackToChat,
}: {
  verdict: Verdict;
  items: ItemAssessment[];
  boxes: Box[];
  onRefresh: () => void;
  onBackToChat?: (() => void) | undefined;
}) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className={styles.verdictTrigger}>
        <div className={styles.verdictTriggerLeft}>
          <VerdictBadge verdict={verdict} />
          <span className={styles.verdictCount}>{items.length}</span>
        </div>
        <ChevronDown
          className={cn(styles.chevron, isOpen && styles.chevronOpen)}
          style={{ width: 16, height: 16 }}
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className={styles.collapsibleItems}>
          {items.map((item) => (
            <ItemRow key={item.id} item={item} boxes={boxes} onRefresh={onRefresh} onBackToChat={onBackToChat} showVerdict={false} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/* ------------------------------------------------------------------ */
/*  Shared sub-components                                              */
/* ------------------------------------------------------------------ */

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className={styles.sectionHeader}>
        <Icon style={{ width: 16, height: 16, color: "var(--color-text-muted)" }} />
        <h3 className={styles.sectionTitle}>{title}</h3>
      </div>
      {children}
    </div>
  );
}

interface ItemRowProps {
  item: ItemAssessment;
  boxes: Box[];
  onRefresh: () => void;
  /** Packing boxes for quick-assign box picker (only for SHIP/CARRY items) */
  packingBoxes?: Box[];
  /** Item count per box, for display in BoxPicker */
  boxItemCounts?: Record<string, number>;
  /** Called when the user selects a box via the quick-assign picker */
  onAssignToBox?: (boxId: string, assessmentId: string) => void;
  /** Called when the user taps "Back to Aisling" from inside the edit panel on mobile */
  onBackToChat?: (() => void) | undefined;
  /** Whether to show the verdict badge inline in the row (default true). Pass false inside VerdictGroup where the badge is already in the group header. */
  showVerdict?: boolean;
}

function ItemRow({
  item,
  boxes,
  onRefresh,
  packingBoxes,
  boxItemCounts,
  onAssignToBox,
  onBackToChat,
  showVerdict = true,
}: ItemRowProps) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isPickingBox, setIsPickingBox] = useState(false);

  const canQuickAssign =
    (item.verdict === "SHIP" || item.verdict === "CARRY") &&
    onAssignToBox !== undefined &&
    packingBoxes !== undefined &&
    packingBoxes.length > 0;

  const handleItemSave = useCallback(
    async (updates: Partial<ItemAssessment>) => {
      if (Object.keys(updates).length === 0) return;
      const res = await fetch(`/api/assessments/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        throw new Error("Failed to save item");
      }
      onRefresh();
    },
    [item.id, onRefresh]
  );

  const handleDeleteItem = useCallback(async () => {
    await fetch(`/api/assessments/${item.id}`, { method: "DELETE" });
    setIsEditOpen(false);
    onRefresh();
  }, [item.id, onRefresh]);

  const handleSelectBox = useCallback(
    (box: Box) => {
      onAssignToBox?.(box.id, item.id);
      setIsPickingBox(false);
    },
    [item.id, onAssignToBox]
  );

  return (
    <>
      <div className={styles.itemRowOuter} data-verdict={item.verdict}>
        <div className={styles.itemRow}>
          {item.image_url ? (
            <img
              src={`/api/img?url=${encodeURIComponent(item.image_url)}`}
              alt=""
              className={styles.itemThumb}
            />
          ) : (
            <div className={styles.itemThumbPlaceholder} aria-hidden="true">
              <ShoppingBag style={{ width: 14, height: 14, color: "var(--color-text-muted)" }} />
            </div>
          )}

          <span className={styles.itemName}>{item.item_name}</span>

          <div className={styles.itemRowActions}>
            {showVerdict && <VerdictBadge verdict={item.verdict} />}

            {canQuickAssign && (
              <button
                type="button"
                className={styles.assignBoxButton}
                onClick={() => setIsPickingBox((prev) => !prev)}
                aria-expanded={isPickingBox}
                aria-label={`Assign ${item.item_name} to a box`}
              >
                Assign to box
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsEditOpen(true)}
              className={styles.itemEditButton}
              aria-label={`Edit ${item.item_name}`}
            >
              <Pencil size={13} aria-hidden="true" />
              Edit
            </button>
          </div>
        </div>

        {isPickingBox && packingBoxes && (
          <div className={styles.boxPickerWrap}>
            <BoxPicker
              boxes={packingBoxes}
              itemCounts={boxItemCounts ?? {}}
              onSelect={handleSelectBox}
              onDismiss={() => setIsPickingBox(false)}
            />
          </div>
        )}
      </div>

      <ItemEditPanel
        item={item}
        boxes={boxes}
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        onSave={handleItemSave}
        onDelete={handleDeleteItem}
        onBackToChat={onBackToChat}
      />
    </>
  );
}

function NotShippingSection({
  items,
  onRefresh,
}: {
  items: ItemAssessment[];
  onRefresh: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className={styles.notShippingTrigger}>
        <div className={styles.verdictTriggerLeft}>
          <span className={styles.notShippingLabel}>Not shipping</span>
          <span className={styles.notShippingCount}>{items.length}</span>
        </div>
        <ChevronDown
          className={cn(styles.chevron, isOpen && styles.chevronOpen)}
          style={{ width: 16, height: 16 }}
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className={styles.collapsibleItems}>
          {items.map((item) => (
            <NotShippingItemRow key={item.id} item={item} onRefresh={onRefresh} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function NotShippingItemRow({
  item,
  onRefresh,
}: {
  item: ItemAssessment;
  onRefresh: () => void;
}) {
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);

  const handleDelete = useCallback(async () => {
    try {
      await fetch(`/api/assessments/${item.id}`, { method: "DELETE" });
      onRefresh();
    } catch (err) {
      console.error("Failed to delete item:", err);
      alert("Failed to delete item. Please try again.");
    }
  }, [item.id, onRefresh]);

  return (
    <>
      <div className={styles.notShippingItem}>
        <span className={styles.notShippingItemName}>{item.item_name}</span>
        <VerdictBadge verdict={item.verdict} />
        <button
          ref={deleteButtonRef}
          type="button"
          className={styles.notShippingDeleteButton}
          onClick={() => setIsDeleteOpen(true)}
          aria-label={`Delete ${item.item_name}`}
          aria-haspopup="dialog"
        >
          <Trash2 size={14} aria-hidden="true" />
        </button>
      </div>

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
          handleDelete();
        }}
        triggerRef={deleteButtonRef}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  States                                                             */
/* ------------------------------------------------------------------ */

function LoadingSkeleton() {
  return (
    <div className={styles.skeleton}>
      {[1, 2, 3].map((i) => (
        <SkeletonGroup key={i} label="Loading inventory">
          <Skeleton height={16} width="40%" borderRadius="var(--radius-sm)" style={{ marginBottom: 8 }} />
          <Skeleton height={56} width="100%" borderRadius="var(--radius-md)" style={{ marginBottom: 6 }} />
          <Skeleton height={56} width="100%" borderRadius="var(--radius-md)" />
        </SkeletonGroup>
      ))}
    </div>
  );
}

function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className={styles.errorState}>
      <p className={styles.errorText}>{error}</p>
      <button type="button" onClick={onRetry} className={styles.retryButton}>
        Try again
      </button>
    </div>
  );
}
