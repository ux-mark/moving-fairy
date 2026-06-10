"use client";

import { useState, useRef, useCallback, useEffect, useMemo, useId } from "react";
import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Package,
  Briefcase,
  Luggage,
  Plus,
  X as XIcon,
  Check,
  Pencil,
  Info,
  ShieldAlert,
} from "lucide-react";
import { Button, ConfirmDialog } from "@thefairies/design-system/components";

import { BoxStatusBadge } from "@/components/boxes/BoxStatusBadge";
import { BoxSizeBadge } from "@/components/boxes/BoxSizeBadge";
import { VerdictBadge } from "@/components/chat/VerdictBadge";
import { FlagIndicator } from "@/components/boxes/FlagIndicator";
import { FlaggedItemCard } from "@/components/boxes/FlaggedItemCard";
import { StickerThumbnail } from "@/components/boxes/StickerThumbnail";
import { StickerLightbox } from "@/components/boxes/StickerLightbox";
import { StickerScanButton } from "@/components/boxes/StickerScanButton";
import { StickerScanSummary } from "@/components/boxes/StickerScanSummary";
import { ScanDraftReview, type DraftKind } from "@/components/boxes/ScanDraftReview";
import type { Box, BoxItem, BoxScanDuplicateProposedItem, ItemAssessment } from "@/types";
import { BoxSize, BoxType, BOX_SIZE_CBM, BOX_SIZE_DIMENSIONS, BOX_LABEL_PREFIX, roomCode } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { proxyImageUrl } from "@/lib/storage-url";
import { ownerCopy } from "@/lib/copy/owner";
import { useDroppableBox } from "@/components/boxes/PackingDrag";
import { useItemLinkClick } from "@/components/panels";

import styles from "./BoxCard.module.css";

export interface FlaggedItem {
  item_assessment_id: string;
  verdict: "SELL" | "DONATE" | "DISCARD" | "REVISIT";
  item_name: string;
}

export interface ScanResult {
  status: "uploading" | "processing" | "partial" | "complete" | "error";
  totalFound: number;
  matchedCount: number;
  newCount: number;
  flaggedCount: number;
  duplicateCount: number;
  illegibleCount: number;
  errorMessage?: string;
}

interface BoxCardProps {
  box: Box;
  items: BoxItem[];
  /** Map of item_assessment_id to ItemAssessment, for showing verdicts */
  assessments?: Record<string, ItemAssessment> | undefined;
  /** Unboxed SHIP/CARRY items available to assign to this box */
  unboxedItems?: ItemAssessment[] | undefined;
  onAddItem?: ((boxId: string, itemName: string) => void) | undefined;
  onAddExistingItem?: ((boxId: string, assessmentId: string) => void) | undefined;
  onRemoveItem?: ((boxId: string, boxItemId: string) => void) | undefined;
  onMarkPacked?: ((boxId: string) => void) | undefined;
  onUpdateBox?: ((boxId: string, updates: { label?: string; room_name?: string; room_code?: string; size?: string; is_biosecurity?: boolean }) => void) | undefined;
  /** Whether this is the active "packing into" box (left accent + Active chip). */
  isActive?: boolean | undefined;
  /** Select / deselect this box as the active "packing into" target. */
  /** Set this box active (click the header body). Only wired for packing boxes. */
  onSetActive?: ((active: boolean) => void) | undefined;
  /** Count of biosecurity-flagged items in this box — drives the nudge. */
  /** Count of biosecurity-flagged items currently in this box. >0 auto-marks
   *  the box as biosecurity (badge), independent of the manual override. */
  biosecItemCount?: number | undefined;
  /** Manually mark this box as biosecurity (override for boxes with no flagged
   *  items). Boxes that contain flagged items are marked automatically. */
  onMarkBiosecurity?: ((boxId: string) => void) | undefined;
  /** Renumber this box. The handler decides swap-vs-confirm against the list. */
  onRenumber?: ((boxId: string, newNumber: number) => void) | undefined;
  /** When set, this card is a live pointer-drag drop target. The id is written
   *  to `data-droppable-box-id` and used to read the hovered-target state. */
  droppableBoxId?: string | undefined;
  /** Sticker scan state — set when a scan has been initiated or completed */
  scanResult?: ScanResult | null | undefined;
  /** Flagged items from sticker scan that need user action */
  flaggedItems?: FlaggedItem[] | undefined;
  /** Called when user taps "Scan box sticker" and selects/captures a photo */
  onScanSticker?: ((boxId: string, file: File) => void) | undefined;
  /** Called when user resolves a flagged item by overriding verdict to SHIP */
  onShipAnyway?: ((itemId: string, boxId: string) => void) | undefined;
  /** Called when user resolves a flagged item by removing it from the box */
  onRemoveFlaggedItem?: ((itemId: string, boxId: string) => void) | undefined;
  /** Confirm all draft items from a scan — they become part of the box. */
  onConfirmDrafts?: ((boxId: string) => void) | undefined;
  /** Remove a single draft item (kind decides delete-vs-unlink). */
  onRemoveDraft?: ((boxId: string, item: BoxItem, kind: DraftKind) => void) | undefined;
  /** Scan entries matching items already packed in ANOTHER box. */
  duplicateProposals?: BoxScanDuplicateProposedItem[] | undefined;
  /** Add a possible duplicate to this box as a fresh item. */
  onAddDuplicate?: ((boxId: string, proposal: BoxScanDuplicateProposedItem) => void) | undefined;
  /** Dismiss a possible duplicate — it was the same item after all. */
  onSkipDuplicate?: ((boxId: string, proposal: BoxScanDuplicateProposedItem) => void) | undefined;
  /** Whether a confirm-drafts request is in flight for this box. */
  isConfirmingDrafts?: boolean | undefined;
  /** Whether a sticker scan upload/process is in progress for this box */
  isScanning?: boolean | undefined;
  /** Item IDs currently being resolved (ship anyway / remove) */
  resolvingItemIds?: Set<string> | undefined;
  /** Controlled open state. When undefined, BoxCard manages its own expand/collapse. */
  open?: boolean | undefined;
  /** Called when the user toggles. Required if `open` is provided. */
  onOpenChange?: ((open: boolean) => void) | undefined;
  /** Hide the chevron and disable header click — used when rendered inside a drawer
   *  where the card is always fully expanded and a close button lives elsewhere. */
  hideExpandAffordance?: boolean | undefined;
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

// ---------------------------------------------------------------------------
// Unified Combobox — searches existing items + allows creating new ones
// ---------------------------------------------------------------------------

type ComboboxItem =
  | { type: "existing"; id: string; name: string; assessment: ItemAssessment }
  | { type: "create"; id: string; name: string; assessment?: undefined };

function ItemCombobox({
  unboxedItems,
  onSelectExisting,
  onCreateNew,
  boxLabel,
}: {
  unboxedItems: ItemAssessment[];
  onSelectExisting: (item: ItemAssessment) => void;
  onCreateNew: (name: string) => void;
  boxLabel: string;
}) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  const trimmed = query.trim();
  const lowerQuery = trimmed.toLowerCase();

  const suggestions = useMemo<ComboboxItem[]>(() => {
    if (!trimmed) return [];

    const matches: ComboboxItem[] = unboxedItems
      .filter((item) => item.item_name.toLowerCase().includes(lowerQuery))
      .sort((a, b) => a.item_name.localeCompare(b.item_name))
      .map((item) => ({
        type: "existing" as const,
        id: item.id,
        name: item.item_name,
        assessment: item,
      }));

    // Check if typed text exactly matches any existing item (case-insensitive)
    const exactMatch = unboxedItems.some(
      (item) => item.item_name.toLowerCase() === lowerQuery
    );

    // If no exact match, add a "create new" option
    if (!exactMatch && trimmed.length > 0) {
      matches.push({
        type: "create",
        id: "__create__",
        name: trimmed,
      });
    }

    return matches;
  }, [unboxedItems, trimmed, lowerQuery]);

  const showDropdown = isOpen && trimmed.length > 0 && suggestions.length > 0;

  // Position dropdown using fixed positioning to avoid clipping.
  // On mobile with the virtual keyboard open, position above the input
  // if there isn't enough room below.
  const updateDropdownPosition = useCallback(() => {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.visualViewport?.height ?? window.innerHeight;
    const minMargin = 8;
    const dropdownMaxHeight = vw < 768 ? 180 : 240;

    // Clamp left so the dropdown never runs off the left edge
    const rawLeft = rect.left;
    const clampedLeft = Math.max(minMargin, rawLeft);

    // Clamp width so the dropdown never runs off the right edge
    const availableWidth = vw - clampedLeft - minMargin;
    const clampedWidth = Math.min(rect.width, availableWidth);

    const spaceBelow = vh - rect.bottom - minMargin;
    const spaceAbove = rect.top - minMargin;
    const openAbove = spaceBelow < dropdownMaxHeight && spaceAbove > spaceBelow;

    setDropdownStyle({
      position: "fixed",
      ...(openAbove
        ? { bottom: vh - rect.top + 2 }
        : { top: rect.bottom + 2 }),
      left: clampedLeft,
      width: clampedWidth,
      maxHeight: openAbove ? spaceAbove : Math.min(spaceBelow, dropdownMaxHeight),
      zIndex: 9999,
    });
  }, []);

  // Position dropdown once when it opens; recalculate on window/viewport resize
  // (viewport resize fires when mobile keyboard opens/closes)
  useEffect(() => {
    if (showDropdown) {
      updateDropdownPosition();
      window.addEventListener("resize", updateDropdownPosition);
      window.visualViewport?.addEventListener("resize", updateDropdownPosition);
      return () => {
        window.removeEventListener("resize", updateDropdownPosition);
        window.visualViewport?.removeEventListener("resize", updateDropdownPosition);
      };
    }
  }, [showDropdown, updateDropdownPosition]);

  // Close on outside click
  useEffect(() => {
    if (!showDropdown) return;
    function handlePointerDown(e: PointerEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [showDropdown]);

  const selectItem = useCallback(
    (item: ComboboxItem) => {
      if (item.type === "existing" && item.assessment) {
        onSelectExisting(item.assessment);
      } else if (item.type === "create") {
        onCreateNew(item.name);
      }
      setQuery("");
      setIsOpen(false);
      setActiveIndex(-1);
      inputRef.current?.focus();
    },
    [onSelectExisting, onCreateNew]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setQuery(e.target.value);
      setIsOpen(true);
      setActiveIndex(-1); // Reset selection when query changes
    },
    []
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!showDropdown) {
        // If Enter is pressed with text but no dropdown, create the item
        if (e.key === "Enter" && trimmed) {
          e.preventDefault();
          onCreateNew(trimmed);
          setQuery("");
          setIsOpen(false);
        }
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setActiveIndex((prev) =>
            prev < suggestions.length - 1 ? prev + 1 : 0
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setActiveIndex((prev) =>
            prev > 0 ? prev - 1 : suggestions.length - 1
          );
          break;
        case "Enter":
          e.preventDefault();
          if (activeIndex >= 0 && suggestions[activeIndex]) {
            selectItem(suggestions[activeIndex]);
          } else if (trimmed) {
            // No active item: create new
            onCreateNew(trimmed);
            setQuery("");
            setIsOpen(false);
          }
          break;
        case "Escape":
          e.preventDefault();
          setIsOpen(false);
          setActiveIndex(-1);
          break;
      }
    },
    [showDropdown, suggestions, activeIndex, trimmed, selectItem, onCreateNew]
  );

  // Scroll active option into view
  useEffect(() => {
    if (activeIndex < 0 || !listRef.current) return;
    const items = listRef.current.querySelectorAll('[role="option"]');
    items[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const reactId = useId();
  const listboxId = `box-item-combobox-listbox-${reactId}`;

  return (
    <div ref={containerRef} className={styles.comboboxWrap}>
      <div className={styles.comboboxInputRow}>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (trimmed) setIsOpen(true);
            // On mobile, scroll input into view after keyboard opens
            if (window.innerWidth < 768) {
              setTimeout(() => {
                inputRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
              }, 300);
            }
          }}
          placeholder="Search or add an item..."
          className={styles.addItemInput}
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={showDropdown ? listboxId : undefined}
          aria-activedescendant={
            showDropdown && activeIndex >= 0
              ? `combobox-option-${activeIndex}`
              : undefined
          }
          aria-label={`Add item to ${boxLabel}`}
          aria-autocomplete="list"
          autoComplete="off"
        />
      </div>

      {showDropdown && (
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-label="Item suggestions"
          className={styles.comboboxDropdown}
          style={dropdownStyle}
        >
          {suggestions.map((item, index) => (
            <li
              key={item.id}
              id={`combobox-option-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              className={cn(
                styles.comboboxOption,
                index === activeIndex && styles.comboboxOptionActive,
                item.type === "create" && styles.comboboxOptionCreate
              )}
              onPointerDown={(e) => {
                e.preventDefault(); // Keep focus on input
                selectItem(item);
              }}
            >
              {item.type === "existing" ? (
                <>
                  <span className={styles.comboboxOptionName}>
                    {item.name}
                  </span>
                  {item.assessment && (
                    <VerdictBadge verdict={item.assessment.verdict} />
                  )}
                </>
              ) : (
                <>
                  <Plus
                    style={{ width: 14, height: 14, flexShrink: 0 }}
                    aria-hidden
                  />
                  <span className={styles.comboboxCreateLabel}>
                    Add &ldquo;{item.name}&rdquo;
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline editable label
// ---------------------------------------------------------------------------

function EditableLabel({
  value,
  onSave,
  disabled,
}: {
  value: string;
  onSave: (newValue: string) => void;
  disabled: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  // Keep draft in sync with external value when not editing.
  // Using a stable callback avoids the need for a render-time ref check.
  const startEditing = useCallback(() => {
    setDraft(value); // Always sync to latest value when entering edit mode
    setEditing(true);
  }, [value]);

  const commit = useCallback(() => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) {
      onSave(trimmed);
    } else {
      setDraft(value);
    }
    setEditing(false);
  }, [draft, value, onSave]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        setDraft(value);
        setEditing(false);
      }
    },
    [commit, value]
  );

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        className={styles.editableLabelInput}
        aria-label="Edit box name"
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  return (
    <button
      type="button"
      className={styles.editableLabelButton}
      onClick={(e) => {
        if (disabled) return;
        e.stopPropagation();
        startEditing();
      }}
      disabled={disabled}
      aria-label={`Edit box name: ${value}`}
      title="Click to edit name"
    >
      <span className={styles.boxLabel}>{value}</span>
      {!disabled && (
        <Pencil
          className={styles.editIcon}
          style={{ width: 12, height: 12 }}
          aria-hidden
        />
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Editable room code — the per-ROOM suffix after WH<nn>-. Editing it relabels
// every box in the room (the code is room-scoped, not per-box).
// ---------------------------------------------------------------------------

function EditableCodeChip({
  prefix,
  code,
  roomName,
  onSave,
  disabled,
}: {
  prefix: string;
  code: string;
  roomName: string;
  onSave: (newCode: string) => void;
  disabled: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(code);
  const inputRef = useRef<HTMLInputElement>(null);
  const title = `Code for all ${roomName} boxes`;

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const startEditing = useCallback(() => {
    setDraft(code);
    setEditing(true);
  }, [code]);

  const commit = useCallback(() => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== code) {
      onSave(trimmed);
    } else {
      setDraft(code);
    }
    setEditing(false);
  }, [draft, code, onSave]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        setDraft(code);
        setEditing(false);
      }
    },
    [commit, code]
  );

  if (editing) {
    return (
      <span className={styles.codeChip} title={title}>
        {prefix}
        <input
          ref={inputRef}
          type="text"
          value={draft}
          // Keep entry constrained to the stored format: letters/digits, ≤4.
          onChange={(e) =>
            setDraft(e.target.value.replace(/[^A-Za-z0-9]/g, "").slice(0, 4))
          }
          onBlur={commit}
          onKeyDown={handleKeyDown}
          className={styles.codeChipInput}
          aria-label={title}
          maxLength={4}
          onClick={(e) => e.stopPropagation()}
        />
      </span>
    );
  }

  return (
    <button
      type="button"
      className={styles.codeChipButton}
      onClick={(e) => {
        if (disabled) return;
        e.stopPropagation();
        startEditing();
      }}
      disabled={disabled}
      title={title}
      aria-label={`${title}: ${code}. Edit.`}
    >
      <span className={styles.codeChip}>
        {prefix}
        {code}
      </span>
      {!disabled && (
        <Pencil
          className={styles.editIcon}
          style={{ width: 12, height: 12 }}
          aria-hidden
        />
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Box number editor — renumber a box (the NN in WHNN-K)
// ---------------------------------------------------------------------------

function BoxNumberField({
  currentNumber,
  onApply,
  disabled,
}: {
  currentNumber: number;
  onApply: (n: number) => void;
  disabled: boolean;
}) {
  const [draft, setDraft] = useState(String(currentNumber));
  const [lastNumber, setLastNumber] = useState(currentNumber);
  // Re-seed when the server-confirmed number changes (e.g. after a swap).
  if (currentNumber !== lastNumber) {
    setLastNumber(currentNumber);
    setDraft(String(currentNumber));
  }

  const commit = () => {
    const n = parseInt(draft, 10);
    if (!Number.isInteger(n) || n < 1) {
      setDraft(String(currentNumber));
      return;
    }
    if (n !== currentNumber) onApply(n);
    else setDraft(String(currentNumber));
  };

  return (
    <div className={styles.renumberRow}>
      <span className={styles.renumberLabel}>Box number</span>
      <input
        type="number"
        min={1}
        inputMode="numeric"
        className={styles.renumberInput}
        value={draft}
        disabled={disabled}
        aria-label="Box number"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            setDraft(String(currentNumber));
          }
        }}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Size editor with dimension disclosure
// ---------------------------------------------------------------------------

const SIZE_OPTIONS = Object.values(BoxSize) as BoxSize[];

function SizeEditor({
  currentSize,
  onSizeChange,
  disabled,
}: {
  currentSize: BoxSize;
  onSizeChange: (size: BoxSize) => void;
  disabled: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [showDimensions, setShowDimensions] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isEditing) return;
    function handlePointerDown(e: PointerEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsEditing(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isEditing]);

  const handleSizeSelect = useCallback(
    (size: BoxSize) => {
      if (size !== currentSize) {
        onSizeChange(size);
      }
      setIsEditing(false);
    },
    [currentSize, onSizeChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setIsEditing(false);
      }
    },
    []
  );

  const dims = BOX_SIZE_DIMENSIONS[currentSize];

  return (
    <div ref={containerRef} className={styles.sizeEditorWrap}>
      <div className={styles.sizeEditorRow}>
        <button
          type="button"
          className={styles.sizeEditorTrigger}
          onClick={(e) => {
            e.stopPropagation();
            if (!disabled) setIsEditing((prev) => !prev);
          }}
          disabled={disabled}
          aria-label={`Box size: ${currentSize}. Click to change.`}
          aria-expanded={isEditing}
        >
          <BoxSizeBadge size={currentSize} />
        </button>

        <button
          type="button"
          className={styles.dimensionToggle}
          onClick={(e) => {
            e.stopPropagation();
            setShowDimensions((prev) => !prev);
          }}
          aria-label={showDimensions ? "Hide dimensions" : "Show dimensions"}
          aria-expanded={showDimensions}
          title="View dimensions"
        >
          <Info style={{ width: 13, height: 13 }} aria-hidden />
        </button>
      </div>

      {/* Size picker dropdown */}
      {isEditing && (
        <div
          className={styles.sizePickerDropdown}
          role="listbox"
          aria-label="Select box size"
          onKeyDown={handleKeyDown}
          tabIndex={-1}
        >
          {SIZE_OPTIONS.map((s) => (
            <button
              key={s}
              type="button"
              role="option"
              aria-selected={s === currentSize}
              className={cn(
                styles.sizePickerOption,
                s === currentSize && styles.sizePickerOptionActive
              )}
              onClick={(e) => {
                e.stopPropagation();
                handleSizeSelect(s);
              }}
            >
              <span className={styles.sizePickerLabel}>{s}</span>
              <span className={styles.sizePickerCbm}>
                {BOX_SIZE_CBM[s]} CBM
              </span>
              {s === currentSize && (
                <Check
                  style={{ width: 14, height: 14, flexShrink: 0 }}
                  aria-hidden
                />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Dimension disclosure */}
      {showDimensions && (
        <div className={styles.dimensionPanel}>
          <span className={styles.dimensionText}>
            {dims.length} x {dims.width} x {dims.height} cm
          </span>
          <span className={styles.dimensionNote}>
            Standard {currentSize} box dimensions
          </span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Merged item list — interleaves flagged and regular items alphabetically
// ---------------------------------------------------------------------------

type MergedListEntry =
  | { type: "flagged"; key: string; name: string; flagged: FlaggedItem }
  | { type: "regular"; key: string; name: string; item: BoxItem };

function MergedItemList({
  items,
  flaggedItems,
  flaggedItemIds,
  assessments,
  box,
  isShipped,
  onRemoveItem,
  onShipAnyway,
  onRemoveFlaggedItem,
  resolvingItemIds,
  prefersReducedMotion,
}: {
  items: BoxItem[];
  flaggedItems: FlaggedItem[];
  flaggedItemIds: Set<string>;
  assessments?: Record<string, ItemAssessment> | undefined;
  box: Box;
  isShipped: boolean;
  onRemoveItem?: ((boxId: string, boxItemId: string) => void) | undefined;
  onShipAnyway?: ((itemId: string, boxId: string) => void) | undefined;
  onRemoveFlaggedItem?: ((itemId: string, boxId: string) => void) | undefined;
  resolvingItemIds?: Set<string> | undefined;
  prefersReducedMotion: boolean | null;
}) {
  // Plain click opens the item panel in place; modifier clicks still navigate.
  const itemLinkClick = useItemLinkClick();
  // Build a unified list of entries sorted alphabetically by name
  const entries = useMemo(() => {
    const merged: MergedListEntry[] = [];

    // Add flagged items
    for (const flagged of flaggedItems) {
      merged.push({
        type: "flagged",
        key: `flagged-${flagged.item_assessment_id}`,
        name: flagged.item_name,
        flagged,
      });
    }

    // Add regular items (excluding those in the flagged set)
    for (const item of items) {
      if (item.item_assessment_id && flaggedItemIds.has(item.item_assessment_id)) {
        continue;
      }
      const assessment = item.item_assessment_id
        ? assessments?.[item.item_assessment_id]
        : undefined;
      const displayName = assessment?.item_name ?? item.item_name ?? "Unnamed item";
      merged.push({
        type: "regular",
        key: item.id,
        name: displayName,
        item,
      });
    }

    // Sort alphabetically by name
    merged.sort((a, b) => a.name.localeCompare(b.name));
    return merged;
  }, [items, flaggedItems, flaggedItemIds, assessments]);

  return (
    <ul className={styles.itemList}>
      <AnimatePresence mode="popLayout">
        {entries.map((entry) => {
          if (entry.type === "flagged") {
            return (
              <motion.li
                key={entry.key}
                layout
                className={styles.itemRow}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={
                  prefersReducedMotion
                    ? { duration: 0 }
                    : { duration: 0.15 }
                }
              >
                <FlaggedItemCard
                  itemName={entry.flagged.item_name}
                  itemId={entry.flagged.item_assessment_id}
                  verdict={entry.flagged.verdict}
                  boxId={box.id}
                  boxLabel={box.label}
                  onShipAnyway={onShipAnyway ?? (() => undefined)}
                  onRemoveFromBox={onRemoveFlaggedItem ?? (() => undefined)}
                  isResolving={
                    resolvingItemIds?.has(entry.flagged.item_assessment_id) ?? false
                  }
                />
              </motion.li>
            );
          }

          const { item } = entry;
          const assessment = item.item_assessment_id
            ? assessments?.[item.item_assessment_id]
            : undefined;
          const displayName = entry.name;
          const itemImageUrl = assessment?.image_url
            ? proxyImageUrl(assessment.image_url)
            : undefined;

          const thumbNode = itemImageUrl ? (
            <Image
              src={itemImageUrl}
              alt=""
              aria-hidden="true"
              width={36}
              height={36}
              className={styles.itemThumb}
              unoptimized
            />
          ) : (
            <div
              className={styles.itemThumbPlaceholder}
              aria-hidden="true"
            >
              <Package size={16} />
            </div>
          );

          const verdictDotNode = (
            <span
              className={styles.verdictDot}
              style={{
                background: assessment?.verdict
                  ? `var(--verdict-${assessment.verdict
                      .toLowerCase()
                      .replace("_", "-")})`
                  : "var(--color-border-default)",
              }}
              aria-hidden="true"
            />
          );

          const innerContent = (
            <>
              {thumbNode}
              {verdictDotNode}
              <span className={styles.itemName}>
                {displayName}
              </span>
              {item.quantity > 1 && (
                <span className={styles.itemQty}>
                  x{item.quantity}
                </span>
              )}
              {assessment && (
                <VerdictBadge verdict={assessment.verdict} />
              )}
            </>
          );

          return (
            <motion.li
              key={entry.key}
              layout
              className={styles.itemRow}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={
                prefersReducedMotion
                  ? { duration: 0 }
                  : { duration: 0.15 }
              }
            >
              {assessment?.id ? (
                <Link
                  href={`/decisions/${assessment.id}?from=boxes`}
                  className={styles.itemLink}
                  onClick={itemLinkClick(assessment.id)}
                >
                  {innerContent}
                </Link>
              ) : (
                <div className={styles.itemRowLeft}>
                  {innerContent}
                </div>
              )}

              {!isShipped && onRemoveItem && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveItem(box.id, item.id);
                  }}
                  aria-label={`Remove ${displayName} from ${box.label}`}
                  className={styles.removeItemButton ?? ""}
                >
                  <XIcon style={{ width: 16, height: 16 }} />
                </Button>
              )}
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ul>
  );
}

// ---------------------------------------------------------------------------
// BoxCard
// ---------------------------------------------------------------------------

export function BoxCard({
  box,
  items,
  assessments,
  unboxedItems,
  onAddItem,
  onAddExistingItem,
  onRemoveItem,
  onMarkPacked,
  onUpdateBox,
  scanResult,
  flaggedItems = [],
  onScanSticker,
  onShipAnyway,
  onRemoveFlaggedItem,
  onConfirmDrafts,
  onRemoveDraft,
  duplicateProposals = [],
  onAddDuplicate,
  onSkipDuplicate,
  isConfirmingDrafts = false,
  isScanning = false,
  resolvingItemIds,
  open: openProp,
  onOpenChange,
  hideExpandAffordance = false,
  isActive = false,
  onSetActive,
  biosecItemCount = 0,
  onMarkBiosecurity,
  onRenumber,
  droppableBoxId,
}: BoxCardProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  // Controlled when `open` is supplied, else internal state.
  const isControlled = openProp !== undefined;
  const isOpen = isControlled ? openProp : internalOpen;
  const setIsOpen = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      const value = typeof next === 'function' ? next(isOpen) : next;
      if (isControlled) onOpenChange?.(value);
      else setInternalOpen(value);
    },
    [isControlled, isOpen, onOpenChange],
  );
  const [isAnimating, setIsAnimating] = useState(true);
  // True only while THIS card is the box under the pointer during a drag. The
  // single source of the "active target" highlight — the rest of the board
  // stays calm.
  const isDropTarget = useDroppableBox(droppableBoxId);
  const [confirmPackedOpen, setConfirmPackedOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [localStickerUrl, setLocalStickerUrl] = useState<string | null>(null);
  const prefersReducedMotion = useReducedMotion();
  const triggerRef = useRef<HTMLButtonElement>(null);
  // On mobile, use simple CSS transitions instead of spring physics
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const isShipped = box.status === "shipped" || box.status === "arrived";
  const isPacking = box.status === "packing";
  const showAddInput = isPacking && (onAddItem || onAddExistingItem);
  const showSize =
    box.size &&
    box.box_type !== BoxType.CARRYON &&
    box.box_type !== BoxType.CHECKED_LUGGAGE;
  const showCbm =
    box.cbm !== null &&
    box.box_type !== BoxType.CARRYON &&
    box.box_type !== BoxType.CHECKED_LUGGAGE;

  // Desktop list cards are controlled-closed and open a right-hand drawer when
  // clicked; mobile cards expand inline; the in-drawer card is always open.
  // In drawer-trigger mode the whole card is one click target, so the inline
  // name/size editors are deferred to the drawer (where there's room and the
  // dropdowns aren't clipped) rather than intercepting the click.
  const opensDrawer = isControlled && !hideExpandAffordance;
  const canEditSize =
    !!onUpdateBox &&
    isPacking &&
    !opensDrawer &&
    box.box_type !== BoxType.CARRYON &&
    box.box_type !== BoxType.CHECKED_LUGGAGE;

  const handleToggle = useCallback(() => {
    if (!isOpen) {
      // Opening: reset isAnimating so overflow is clipped during enter animation
      setIsAnimating(true);
    }
    setIsOpen(!isOpen);
  }, [isOpen, setIsOpen]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleToggle();
      }
    },
    [handleToggle]
  );

  const handleSelectExistingItem = useCallback(
    (item: ItemAssessment) => {
      if (!onAddExistingItem) return;
      onAddExistingItem(box.id, item.id);
    },
    [box.id, onAddExistingItem]
  );

  const handleCreateNewItem = useCallback(
    (name: string) => {
      if (!onAddItem) return;
      onAddItem(box.id, name);
    },
    [box.id, onAddItem]
  );

  const handleConfirmPacked = useCallback(() => {
    onMarkPacked?.(box.id);
    setConfirmPackedOpen(false);
  }, [box.id, onMarkPacked]);

  const handleRoomNameSave = useCallback(
    (newName: string) => {
      // The backend re-derives the WH label letter/number from the new name.
      onUpdateBox?.(box.id, { room_name: newName });
    },
    [box.id, onUpdateBox]
  );

  const handleSizeChange = useCallback(
    (newSize: BoxSize) => {
      onUpdateBox?.(box.id, { size: newSize });
    },
    [box.id, onUpdateBox]
  );

  const handleRoomCodeSave = useCallback(
    (newCode: string) => {
      // Room-scoped: the server relabels every box in this room.
      onUpdateBox?.(box.id, { room_code: newCode });
    },
    [box.id, onUpdateBox]
  );

  // Determine if we have unboxed items for the combobox
  const hasUnboxedItems = unboxedItems && unboxedItems.length > 0;

  // Sticker scan: create local object URL for immediate thumbnail display
  const handleScanStart = useCallback(
    (boxId: string, file: File) => {
      // Revoke any previous local URL before creating a new one
      setLocalStickerUrl((prev) => {
        if (prev?.startsWith("blob:")) {
          URL.revokeObjectURL(prev);
        }
        return URL.createObjectURL(file);
      });
      onScanSticker?.(boxId, file);
    },
    [onScanSticker]
  );

  // Clean up object URL on unmount
  useEffect(() => {
    return () => {
      setLocalStickerUrl((prev) => {
        if (prev?.startsWith("blob:")) {
          URL.revokeObjectURL(prev);
        }
        return null;
      });
    };
  }, []);

  // Effective sticker URL: prefer local object URL during scanning, fall back to storage URL
  const effectiveStickerUrl = localStickerUrl ?? box.manifest_image_url ?? null;

  // Build flagged item IDs set for quick lookup
  const flaggedItemIds = useMemo(
    () => new Set(flaggedItems.map((f) => f.item_assessment_id)),
    [flaggedItems]
  );

  // Split scan drafts (awaiting review) from confirmed items. Drafts get their
  // own review section; only confirmed items show in the main list.
  const draftItems = useMemo(() => items.filter((i) => i.is_draft), [items]);
  const confirmedItems = useMemo(() => items.filter((i) => !i.is_draft), [items]);

  const unresolvedFlagCount = flaggedItems.length;

  // Determine confirm dialog copy — changes when there are unresolved flags
  const confirmPackedDescription =
    unresolvedFlagCount > 0
      ? `${box.label} has ${unresolvedFlagCount} ${unresolvedFlagCount === 1 ? "item" : "items"} that ${unresolvedFlagCount === 1 ? "was" : "were"} not assessed as ship. Mark as packed anyway?`
      : `Mark ${box.label} as packed? You can still edit it later.`;
  const confirmPackedLabel = unresolvedFlagCount > 0 ? "Pack anyway" : "Yes, packed";

  // Biosecurity nudge: pure function of box contents + the box flag, minus a
  // session-only dismissal.
  // A box reads as biosecurity automatically when it holds any flagged item;
  // the stored is_biosecurity is a manual override layered on top.
  const boxIsBiosec = box.is_biosecurity || biosecItemCount > 0;
  // Manual-override mark only makes sense for a box with no flagged items
  // (flagged boxes are already biosecurity automatically).
  const canManuallyMark =
    isPacking && !box.is_biosecurity && biosecItemCount === 0 && !!onMarkBiosecurity;

  // Header body click sets this box active (packing boxes only); the chevron
  // and edit controls stop propagation so they keep their own behaviour.
  const handleHeaderClick = useCallback(() => {
    // Card click opens the drawer (desktop) or toggles the accordion (mobile).
    // Choosing the active "packing into" box is the checkbox, not a body click.
    if (opensDrawer) {
      handleToggle();
      return;
    }
    if (!hideExpandAffordance) handleToggle();
  }, [opensDrawer, hideExpandAffordance, handleToggle]);

  return (
    <>
      <div
        className={cn(
          styles.card,
          isShipped && styles.cardShipped,
          isActive && styles.cardActive,
          // Single, calm highlight: ONLY the card under the pointer lights up.
          // The rest of the board is untouched during a drag.
          isDropTarget && styles.cardDropTarget,
          opensDrawer && styles.cardClickable,
        )}
        data-open={isOpen ? "true" : "false"}
        data-box-type={box.box_type}
        {...(droppableBoxId ? { [`data-droppable-box-id`]: droppableBoxId } : {})}
      >
        {/* Collapsed header — always visible. When `hideExpandAffordance` is on,
            the header is not interactive (drawer mode: box is always open). */}
        <div
          {...(hideExpandAffordance
            ? {}
            : {
                role: 'button' as const,
                tabIndex: 0,
                onClick: handleHeaderClick,
                onKeyDown: handleKeyDown,
              })}
          className={styles.header}
          aria-expanded={hideExpandAffordance ? undefined : isOpen}
          aria-label={`${box.label}, ${confirmedItems.length} ${confirmedItems.length === 1 ? "item" : "items"}, status: ${box.status}${isActive ? ", packing into this box" : ""}`}
        >
          {onSetActive && isPacking && (
            <input
              type="checkbox"
              className={styles.selectBox}
              checked={isActive}
              data-box-select
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => onSetActive(e.target.checked)}
              aria-label={isActive ? `Packing into ${box.label}` : `Pack into ${box.label}`}
              title={isActive ? "Packing into this box" : "Pack into this box"}
            />
          )}
          <BoxIcon boxType={box.box_type} />

          <div className={styles.headerContent}>
            <div className={styles.headerTopRow}>
              <div className={styles.nameAndCode}>
                {box.box_type === BoxType.STANDARD &&
                onUpdateBox &&
                isPacking &&
                !opensDrawer ? (
                  <EditableCodeChip
                    prefix={`${BOX_LABEL_PREFIX}${String(box.box_number).padStart(2, "0")}-`}
                    code={box.room_code ?? roomCode(box.room_name)}
                    roomName={box.room_name}
                    onSave={handleRoomCodeSave}
                    disabled={isShipped}
                  />
                ) : box.box_type === BoxType.CHECKED_LUGGAGE ||
                  box.box_type === BoxType.CARRYON ? (
                  // Luggage travels with you — no warehouse code, just the name.
                  null
                ) : (
                  <span className={styles.codeChip} title="Warehouse code">
                    {box.label}
                  </span>
                )}
                {onUpdateBox && isPacking && !opensDrawer ? (
                  <EditableLabel
                    value={box.room_name}
                    onSave={handleRoomNameSave}
                    disabled={isShipped}
                  />
                ) : (
                  <span className={styles.boxLabel}>{box.room_name}</span>
                )}
              </div>
              <div className={styles.badgeGroup}>
                {canEditSize ? (
                  <SizeEditor
                    currentSize={box.size ?? "M"}
                    onSizeChange={handleSizeChange}
                    disabled={isShipped}
                  />
                ) : showSize ? (
                  <BoxSizeBadge size={box.size!} />
                ) : null}
                {boxIsBiosec && (
                  <span className={styles.biosecBadge}>
                    <ShieldAlert style={{ width: 12, height: 12 }} aria-hidden />
                    {ownerCopy.packing.biosecBadge}
                  </span>
                )}
                <BoxStatusBadge status={box.status} />
              </div>
            </div>
            <div className={styles.headerMeta}>
              {isActive && (
                <span className={styles.activeChip}>{ownerCopy.packing.activeChip}</span>
              )}
              <motion.span
                key={confirmedItems.length}
                initial={{ scale: 1.15 }}
                animate={{ scale: 1 }}
                transition={
                  prefersReducedMotion
                    ? { duration: 0 }
                    : { duration: 0.3, ease: "easeOut" }
                }
              >
                {confirmedItems.length} {confirmedItems.length === 1 ? "item" : "items"}
              </motion.span>
              <FlagIndicator count={unresolvedFlagCount} />
              {showCbm && <span>{box.cbm} CBM</span>}
              {/* Single cue, shown ONLY on the hovered target. Text (not just
                  colour) names the box being dropped into. */}
              {isDropTarget && (
                <span className={styles.dropHint}>
                  {ownerCopy.packing.dropInto(box.label)}
                </span>
              )}
            </div>
          </div>

        </div>

        {/* Biosecurity is automatic: a box containing any flagged item shows the
            badge above without a prompt. No nudge needed. */}

        {/* Expanded content */}
        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.div
              initial={
                prefersReducedMotion || isMobile
                  ? false
                  : { height: 0, opacity: 0 }
              }
              animate={{ height: "auto", opacity: 1 }}
              exit={
                prefersReducedMotion || isMobile
                  ? { opacity: 0 }
                  : { height: 0, opacity: 0 }
              }
              transition={
                prefersReducedMotion || isMobile
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 300, damping: 30 }
              }
              className={cn(
                styles.expandedContent,
                isAnimating && styles.expandedContentAnimating
              )}
              onAnimationComplete={() => setIsAnimating(false)}
            >
              <div className={styles.expandedInner}>
                {/* Sticker thumbnail — always at top if a sticker exists */}
                {effectiveStickerUrl && (
                  <StickerThumbnail
                    imageUrl={effectiveStickerUrl}
                    boxLabel={box.label}
                    onExpand={() => setLightboxOpen(true)}
                  />
                )}

                {/* Scan summary — shown when a scan is in progress or complete */}
                {scanResult && (
                  <StickerScanSummary
                    status={scanResult.status}
                    totalFound={scanResult.totalFound}
                    matchedCount={scanResult.matchedCount}
                    newCount={scanResult.newCount}
                    flaggedCount={scanResult.flaggedCount}
                    duplicateCount={scanResult.duplicateCount}
                    illegibleCount={scanResult.illegibleCount}
                    {...(scanResult.errorMessage
                      ? { errorMessage: scanResult.errorMessage }
                      : {})}
                    {...(scanResult.status === "error" && onScanSticker
                      ? {
                          onRetry: () => {
                            // Open the file picker so the user can retake/reselect
                            const input = document.querySelector<HTMLInputElement>(
                              `input[aria-label="Take a photo of the box sticker for ${box.label}"]`
                            );
                            input?.click();
                          },
                        }
                      : {})}
                  />
                )}

                {/* Post-scan review — drafts the owner can add or remove, plus
                    possible duplicates (already packed in another box) */}
                {(draftItems.length > 0 || duplicateProposals.length > 0) && (
                  <ScanDraftReview
                    box={box}
                    drafts={draftItems}
                    assessments={assessments}
                    onConfirmAll={() => onConfirmDrafts?.(box.id)}
                    onRemoveDraft={(item, kind) => onRemoveDraft?.(box.id, item, kind)}
                    duplicates={duplicateProposals}
                    onAddDuplicate={(proposal) => onAddDuplicate?.(box.id, proposal)}
                    onSkipDuplicate={(proposal) => onSkipDuplicate?.(box.id, proposal)}
                    isConfirming={isConfirmingDrafts}
                    resolvingItemIds={resolvingItemIds}
                    prefersReducedMotion={prefersReducedMotion}
                  />
                )}

                {/* Items list — empty state accounts for scan-in-progress context */}
                {confirmedItems.length === 0 && flaggedItems.length === 0 ? (
                  draftItems.length === 0 && (
                    <p className={styles.emptyMessage}>
                      {scanResult && scanResult.status !== "complete" && scanResult.status !== "error"
                        ? "Aisling is reading your sticker. Items will appear here as they are identified."
                        : "No items in this box yet. Scan your box sticker or add items manually."}
                    </p>
                  )
                ) : (
                  <MergedItemList
                    items={confirmedItems}
                    flaggedItems={flaggedItems}
                    flaggedItemIds={flaggedItemIds}
                    assessments={assessments}
                    box={box}
                    isShipped={isShipped}
                    onRemoveItem={onRemoveItem}
                    onShipAnyway={onShipAnyway}
                    onRemoveFlaggedItem={onRemoveFlaggedItem}
                    resolvingItemIds={resolvingItemIds}
                    prefersReducedMotion={prefersReducedMotion}
                  />
                )}

                {/* Add to this box — unified combobox */}
                {showAddInput && (
                  <div className={styles.addSection}>
                    {hasUnboxedItems && onAddExistingItem ? (
                      <ItemCombobox
                        unboxedItems={unboxedItems}
                        onSelectExisting={handleSelectExistingItem}
                        onCreateNew={handleCreateNewItem}
                        boxLabel={box.label}
                      />
                    ) : onAddItem ? (
                      <SimpleAddInput
                        onAdd={handleCreateNewItem}
                        boxLabel={box.label}
                      />
                    ) : null}
                  </div>
                )}

                {/* Scan sticker button — packing status only */}
                {isPacking && onScanSticker && (
                  <div className={styles.stickerScanRow}>
                    <StickerScanButton
                      boxId={box.id}
                      boxLabel={box.label}
                      hasExistingSticker={!!box.manifest_image_url}
                      onScanStart={handleScanStart}
                      isScanning={isScanning}
                    />
                  </div>
                )}

                {/* Manual biosecurity override — only when the box has no flagged
                    items (flagged boxes are biosecurity automatically). */}
                {isPacking && onUpdateBox && biosecItemCount === 0 && (
                  box.is_biosecurity ? (
                    <div className={styles.unmarkRow}>
                      <button
                        type="button"
                        className={styles.unmarkButton}
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdateBox(box.id, { is_biosecurity: false });
                        }}
                      >
                        {ownerCopy.packing.biosecUnmark}
                      </button>
                    </div>
                  ) : canManuallyMark ? (
                    <div className={styles.unmarkRow}>
                      <button
                        type="button"
                        className={styles.unmarkButton}
                        onClick={(e) => {
                          e.stopPropagation();
                          onMarkBiosecurity?.(box.id);
                        }}
                      >
                        {ownerCopy.packing.biosecMark}
                      </button>
                    </div>
                  ) : null
                )}

                {/* Renumber — set the box's sequential number (swaps if taken) */}
                {isPacking && onRenumber && (
                  <BoxNumberField
                    currentNumber={box.box_number}
                    onApply={(n) => onRenumber(box.id, n)}
                    disabled={isShipped}
                  />
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

      {/* Sticker lightbox — rendered via portal outside card tree */}
      {effectiveStickerUrl && (
        <StickerLightbox
          imageUrl={effectiveStickerUrl}
          boxLabel={box.label}
          isOpen={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
        />
      )}

      {/* Mark as packed confirmation dialog */}
      <ConfirmDialog
        isOpen={confirmPackedOpen}
        onClose={() => setConfirmPackedOpen(false)}
        title="Mark as packed?"
        description={confirmPackedDescription}
        confirmLabel={confirmPackedLabel}
        cancelLabel={unresolvedFlagCount > 0 ? "Review items" : "Not yet"}
        onConfirm={handleConfirmPacked}
        triggerRef={triggerRef}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Fallback: simple text input when there are no unboxed items to search
// ---------------------------------------------------------------------------

function SimpleAddInput({
  onAdd,
  boxLabel,
}: {
  onAdd: (name: string) => void;
  boxLabel: string;
}) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleAdd = useCallback(() => {
    const name = value.trim();
    if (!name) return;
    onAdd(name);
    setValue("");
    inputRef.current?.focus();
  }, [value, onAdd]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleAdd();
      }
    },
    [handleAdd]
  );

  return (
    <div className={styles.comboboxInputRow}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type an item name to add..."
        className={styles.addItemInput}
        aria-label={`Add item to ${boxLabel}`}
      />
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={(e) => {
          e.stopPropagation();
          handleAdd();
        }}
        disabled={!value.trim()}
        aria-label="Add item"
      >
        <Plus style={{ width: 16, height: 16 }} />
      </Button>
    </div>
  );
}
