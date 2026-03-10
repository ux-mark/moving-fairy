"use client";

import { useCallback, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ChevronDown,
  Luggage,
  Package,
  PackagePlus,
  Plane,
  ShoppingBag,
} from "lucide-react";


import { BoxCard } from "@/components/boxes/BoxCard";
import { BoxStatusBadge } from "@/components/boxes/BoxStatusBadge";
import { VerdictBadge } from "@/components/chat/VerdictBadge";
import { CostSummary } from "@/components/inventory/CostSummary";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { Verdict } from "@/lib/constants";
import { useInventory } from "@/lib/hooks/useInventory";
import type { Box, BoxItem, ItemAssessment } from "@/types";
import { cn } from "@/lib/utils";

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

  return (
    <div className={cn("flex h-full flex-col bg-background", className)} aria-live="polite">
      <CostSummary data={costSummary} variant="full" />

      <div className="flex shrink-0 border-b border-border bg-card">
        <button
          type="button"
          onClick={() => setViewMode("container")}
          className={cn(
            "flex-1 py-2.5 text-center text-sm font-medium transition-colors",
            viewMode === "container"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          By container
        </button>
        <button
          type="button"
          onClick={() => setViewMode("verdict")}
          className={cn(
            "flex-1 py-2.5 text-center text-sm font-medium transition-colors",
            viewMode === "verdict"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          By verdict
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <LoadingSkeleton />
        ) : error ? (
          <ErrorState error={error} onRetry={refreshInventory} />
        ) : isEmpty ? (
          <EmptyState />
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
    <div className="space-y-1 pb-6">
      {luggageBoxes.length > 0 && (
        <Section icon={Plane} title="Travelling with me">
          <div className="space-y-2 px-4 pb-3">
            {luggageBoxes.map((box) => (
              <BoxCard key={box.id} box={box} items={boxItems[box.id] ?? []} />
            ))}
          </div>
        </Section>
      )}

      {freightBoxes.length > 0 && (
        <Section icon={Package} title="Freight boxes">
          <div className="space-y-2 px-4 pb-3">
            {freightBoxes.map((box) => (
              <BoxCard key={box.id} box={box} items={boxItems[box.id] ?? []} />
            ))}
          </div>
        </Section>
      )}

      {singleItems.length > 0 && (
        <Section icon={Luggage} title="Large items — shipping individually">
          <div className="space-y-2 px-4 pb-3">
            {singleItems.map((box) => (
              <div
                key={box.id}
                className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{box.label}</p>
                  {box.cbm !== null && (
                    <p className="text-xs text-muted-foreground">{box.cbm} CBM</p>
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
          <div className="space-y-1 px-4 pb-3">
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
    <div className="space-y-1 pb-6">
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
      <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/50">
        <div className="flex items-center gap-2">
          <VerdictBadge verdict={verdict} />
          <span className="text-xs text-muted-foreground">{items.length}</span>
        </div>
        <ChevronDown
          className={cn(
            "size-4 text-muted-foreground transition-transform",
            isOpen && "rotate-180"
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-1 px-4 pb-3">
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
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 px-4 py-3">
        <Icon className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
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
    <div className="flex items-center gap-2 rounded-md px-2 py-2 hover:bg-muted/50">
      {item.image_url ? (
        <img src={`/api/img?url=${encodeURIComponent(item.image_url)}`} alt="" className="size-8 shrink-0 rounded object-cover" />
      ) : (
        <div className="flex size-8 shrink-0 items-center justify-center rounded bg-muted">
          <ShoppingBag className="size-3.5 text-muted-foreground" />
        </div>
      )}

      <div className="min-w-0 flex-1">
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
            className="w-full rounded border border-border bg-background px-1.5 py-0.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-ring"
            // eslint-disable-next-line jsx-a11y/no-autofocus -- inline edit mode requires immediate focus
            autoFocus
          />
        ) : (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="max-w-full truncate text-left text-sm text-foreground hover:underline"
            title="Click to edit name"
          >
            {item.item_name}
          </button>
        )}
      </div>

      <select
        value={selectedVerdict}
        onChange={(e) => handleVerdictChange(e.target.value)}
        className="h-7 shrink-0 rounded border border-border bg-background px-1.5 text-xs font-medium text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-ring"
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
      <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/50">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-muted-foreground">Not shipping</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {items.length}
          </span>
        </div>
        <ChevronDown
          className={cn(
            "size-4 text-muted-foreground transition-transform",
            isOpen && "rotate-180"
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-1 px-4 pb-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-md px-2 py-1.5"
            >
              <span className="truncate text-sm text-muted-foreground">{item.item_name}</span>
              <VerdictBadge verdict={item.verdict} className="text-[10px]" />
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

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-muted">
        <Package className="size-8 text-muted-foreground/60" />
      </div>
      <div>
        <p className="text-base font-medium text-foreground">No items assessed yet</p>
        <p className="mt-1.5 max-w-[280px] text-sm text-muted-foreground">
          Start a conversation with Aisling — snap a photo of something or type an item name.
        </p>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4 px-4 py-6">
      {[1, 2, 3].map((i) => (
        <div key={i} className="space-y-2">
          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
          <div className="h-14 animate-pulse rounded-lg bg-muted" />
          <div className="h-14 animate-pulse rounded-lg bg-muted" />
        </div>
      ))}
    </div>
  );
}

function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <p className="text-sm text-destructive">{error}</p>
      <button
        type="button"
        onClick={onRetry}
        className="text-sm font-medium text-primary underline underline-offset-2 hover:text-primary/80"
      >
        Try again
      </button>
    </div>
  );
}
