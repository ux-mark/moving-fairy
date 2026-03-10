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

import { BoxStatusBadge } from "@/components/boxes/BoxStatusBadge";
import { BoxSizeBadge } from "@/components/boxes/BoxSizeBadge";
import { VerdictBadge } from "@/components/chat/VerdictBadge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Box, BoxItem, ItemAssessment } from "@/types";
import { BoxType } from "@/lib/constants";
import { cn } from "@/lib/utils";

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
  const className = "size-5 shrink-0 text-muted-foreground";
  switch (boxType) {
    case BoxType.CARRYON:
      return <Briefcase className={className} />;
    case BoxType.CHECKED_LUGGAGE:
      return <Luggage className={className} />;
    default:
      return <Package className={className} />;
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
      <div
        className={cn(
          "rounded-lg border border-border bg-card transition-colors",
          isShipped && "opacity-70"
        )}
      >
        {/* Collapsed header — always visible */}
        <div
          role="button"
          tabIndex={0}
          onClick={handleToggle}
          onKeyDown={handleKeyDown}
          className="flex w-full items-center gap-3 px-4 py-3 text-left cursor-pointer select-none"
          aria-expanded={isOpen}
          aria-label={`${box.label}, ${items.length} ${items.length === 1 ? "item" : "items"}, status: ${box.status}`}
        >
          <BoxIcon boxType={box.box_type} />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base font-semibold text-foreground truncate">
                {box.label}
              </span>
              {showSize && <BoxSizeBadge size={box.size!} />}
              <BoxStatusBadge status={box.status} />
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span>
                {items.length} {items.length === 1 ? "item" : "items"}
              </span>
              {showCbm && <span>{box.cbm} CBM</span>}
            </div>
          </div>

          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform",
              isOpen && "rotate-180"
            )}
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
              className="overflow-hidden"
            >
              <div className="border-t border-border px-4 py-3">
                {/* Items list */}
                {items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No items in this box yet.
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {items.map((item) => {
                      const assessment = item.item_assessment_id
                        ? assessments?.[item.item_assessment_id]
                        : undefined;

                      return (
                        <li
                          key={item.id}
                          className="flex min-h-[44px] items-center justify-between gap-2 text-sm"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-foreground truncate">
                              {item.item_name}
                            </span>
                            {item.quantity > 1 && (
                              <span className="text-muted-foreground">
                                x{item.quantity}
                              </span>
                            )}
                            {assessment && (
                              <VerdictBadge
                                verdict={assessment.verdict}
                                className="text-[10px] px-1.5 py-0.5"
                              />
                            )}
                          </div>

                          {!isShipped && onRemoveItem && (
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                onRemoveItem(box.id, item.id);
                              }}
                              aria-label={`Remove ${item.item_name} from ${box.label}`}
                              className="shrink-0 min-h-[44px] min-w-[44px] text-muted-foreground hover:text-destructive"
                            >
                              <XIcon />
                            </Button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}

                {/* Add to this box — inline input */}
                {showAddInput && (
                  <div className="mt-3 flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        ref={inputRef}
                        type="text"
                        value={addItemValue}
                        onChange={(e) => setAddItemValue(e.target.value)}
                        onKeyDown={handleAddItemKeyDown}
                        placeholder="Type an item name to add..."
                        className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
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
                      <Plus />
                    </Button>
                  </div>
                )}

                {/* Mark as packed button */}
                {isPacking && onMarkPacked && (
                  <div className="mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
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
      <Dialog open={confirmPackedOpen} onOpenChange={setConfirmPackedOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as packed?</DialogTitle>
            <DialogDescription>
              Mark {box.label} as packed? You can still edit it later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmPackedOpen(false)}
            >
              Not yet
            </Button>
            <Button onClick={handleConfirmPacked}>Yes, packed</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
