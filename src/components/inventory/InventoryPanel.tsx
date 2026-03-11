"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ChevronDown,
  Luggage,
  Package,
  PackagePlus,
  Plane,
  ShoppingBag,
} from "lucide-react";
import {
  EmptyState,
  Skeleton,
  SkeletonGroup,
} from "@thefairies/design-system/components";
import { BoxCard } from "@/components/boxes/BoxCard";
import { BoxStatusBadge } from "@/components/boxes/BoxStatusBadge";
import { VerdictBadge } from "@/components/chat/VerdictBadge";
import { CostSummary } from "@/components/inventory/CostSummary";
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

const VERDICT_LABELS: Record<Verdict, string> = {
  SHIP: "Ship",
  CARRY: "Carry",
  SELL: "Sell",
  DONATE: "Donate",
  DISCARD: "Discard",
  DECIDE_LATER: "Decide later",
};

interface InventoryPanelProps {
  className?: string;
}

export function InventoryPanel({ className }: InventoryPanelProps) {
  const { assessments, boxes, boxItems, costSummary, isLoading, error, refreshInventory } =
    useInventory();
  const [viewMode, setViewMode] = useState<ViewMode>("container");
  const prefersReducedMotion = useReducedMotion();
  const isEmpty = assessments.length === 0 && boxes.length === 0;
  const router = useRouter();

  return (
    <div className={cn(styles.panel, className)} aria-live="polite">
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

      <div className={styles.scrollArea}>
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
              initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
              transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.15 }}
            >
              {viewMode === "container" ? (
                <ContainerView
                  assessments={assessments}
                  boxes={boxes}
                  boxItems={boxItems}
                  onRefresh={refreshInventory}
                />
              ) : (
                <VerdictView assessments={assessments} onRefresh={refreshInventory} />
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
}: {
  assessments: ItemAssessment[];
  boxes: Box[];
  boxItems: Record<string, BoxItem[]>;
  onRefresh: () => void;
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
                onAddItem={handleAddItem}
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
                onAddItem={handleAddItem}
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
              <ItemRow key={item.id} item={item} onRefresh={onRefresh} />
            ))}
          </div>
        </Section>
      )}

      {notShipping.length > 0 && <NotShippingSection items={notShipping} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Verdict view                                                       */
/* ------------------------------------------------------------------ */

function VerdictView({
  assessments,
  onRefresh,
}: {
  assessments: ItemAssessment[];
  onRefresh: () => void;
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
        <VerdictGroup key={verdict} verdict={verdict} items={items} onRefresh={onRefresh} />
      ))}
    </div>
  );
}

function VerdictGroup({
  verdict,
  items,
  onRefresh,
}: {
  verdict: Verdict;
  items: ItemAssessment[];
  onRefresh: () => void;
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
            <ItemRow key={item.id} item={item} onRefresh={onRefresh} />
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

function ItemRow({ item, onRefresh }: { item: ItemAssessment; onRefresh: () => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(item.item_name);
  const [selectedVerdict, setSelectedVerdict] = useState(item.verdict);

  const handleNameSave = useCallback(async () => {
    if (editName.trim() === "" || editName === item.item_name) {
      setEditName(item.item_name);
      setIsEditing(false);
      return;
    }
    try {
      await fetch(`/api/assessments/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_name: editName.trim() }),
      });
      setIsEditing(false);
      onRefresh();
    } catch {
      setEditName(item.item_name);
      setIsEditing(false);
    }
  }, [editName, item.id, item.item_name, onRefresh]);

  const handleVerdictChange = useCallback(
    async (newVerdict: string) => {
      setSelectedVerdict(newVerdict as Verdict);
      try {
        await fetch(`/api/assessments/${item.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ verdict: newVerdict }),
        });
        onRefresh();
      } catch {
        setSelectedVerdict(item.verdict);
      }
    },
    [item.id, item.verdict, onRefresh]
  );

  return (
    <div className={styles.itemRow} data-verdict={item.verdict}>
      {item.image_url ? (
        <img
          src={`/api/img?url=${encodeURIComponent(item.image_url)}`}
          alt=""
          className={styles.itemThumb}
        />
      ) : (
        <div className={styles.itemThumbPlaceholder}>
          <ShoppingBag style={{ width: 14, height: 14, color: "var(--color-text-muted)" }} />
        </div>
      )}

      <div className={styles.itemName}>
        {isEditing ? (
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleNameSave}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleNameSave();
              if (e.key === "Escape") {
                setEditName(item.item_name);
                setIsEditing(false);
              }
            }}
            className={styles.itemNameInput}
            // eslint-disable-next-line jsx-a11y/no-autofocus -- inline edit mode requires immediate focus
            autoFocus
          />
        ) : (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className={styles.itemNameButton}
            title="Click to edit name"
          >
            {item.item_name}
          </button>
        )}
      </div>

      <select
        value={selectedVerdict}
        onChange={(e) => handleVerdictChange(e.target.value)}
        className={styles.verdictSelect}
        aria-label={`Verdict for ${item.item_name}`}
      >
        {VERDICT_ORDER.map((v) => (
          <option key={v} value={v}>
            {VERDICT_LABELS[v]}
          </option>
        ))}
      </select>
    </div>
  );
}

function NotShippingSection({ items }: { items: ItemAssessment[] }) {
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
            <div key={item.id} className={styles.notShippingItem}>
              <span className={styles.notShippingItemName}>{item.item_name}</span>
              <VerdictBadge verdict={item.verdict} />
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
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
