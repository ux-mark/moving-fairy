"use client";

import { useState, useCallback } from "react";
import { ChevronDown } from "lucide-react";

import { VerdictBadge } from "@/components/chat/VerdictBadge";
import type { Box, ItemAssessment } from "@/types";
import { cn } from "@/lib/utils";

interface UnboxedItemsProps {
  items: ItemAssessment[];
  /** Boxes in packing status that items can be added to */
  availableBoxes: Box[];
  onAddToBox?: ((itemAssessmentId: string, boxId: string) => void) | undefined;
}

export function UnboxedItems({
  items,
  availableBoxes,
  onAddToBox,
}: UnboxedItemsProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card px-4 py-6 text-center">
        <p className="text-sm font-medium text-foreground">
          Everything's boxed up. Nice work.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <h3 className="text-sm font-semibold text-foreground px-1">
        Not yet boxed{" "}
        <span className="font-normal text-muted-foreground">
          ({items.length} {items.length === 1 ? "item" : "items"})
        </span>
      </h3>
      <div className="rounded-lg border border-border bg-card">
        <ul>
          {items.map((item, index) => (
            <UnboxedItemRow
              key={item.id}
              item={item}
              availableBoxes={availableBoxes}
              {...(onAddToBox ? { onAddToBox } : {})}
              isLast={index === items.length - 1}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}

function UnboxedItemRow({
  item,
  availableBoxes,
  onAddToBox,
  isLast,
}: {
  item: ItemAssessment;
  availableBoxes: Box[];
  onAddToBox?: ((itemAssessmentId: string, boxId: string) => void) | undefined;
  isLast: boolean;
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const handleSelect = useCallback(
    (boxId: string) => {
      onAddToBox?.(item.id, boxId);
      setDropdownOpen(false);
    },
    [item.id, onAddToBox]
  );

  return (
    <li
      className={cn(
        "flex min-h-[44px] items-center justify-between gap-2 px-4 py-2",
        !isLast && "border-b border-border"
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-sm text-foreground truncate">
          {item.item_name}
        </span>
        <VerdictBadge
          verdict={item.verdict}
          className="text-[10px] px-1.5 py-0.5"
        />
      </div>

      {onAddToBox && availableBoxes.length > 0 && (
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setDropdownOpen((prev) => !prev)}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-expanded={dropdownOpen}
            aria-haspopup="listbox"
          >
            Add to box
            <ChevronDown className="size-3" />
          </button>

          {dropdownOpen && (
            <>
              {/* Click-outside overlay */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setDropdownOpen(false)}
                aria-hidden="true"
              />
              <ul
                role="listbox"
                className="absolute right-0 top-full z-50 mt-1 w-48 rounded-lg border border-border bg-popover p-1 shadow-md"
              >
                {availableBoxes.map((box) => (
                  <li key={box.id} role="option" aria-selected={false}>
                    <button
                      type="button"
                      onClick={() => handleSelect(box.id)}
                      className="w-full rounded-md px-3 py-2 text-left text-sm text-foreground hover:bg-muted transition-colors"
                    >
                      {box.label}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </li>
  );
}
