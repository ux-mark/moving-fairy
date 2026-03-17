"use client";

import { useState, useRef, useCallback, useEffect, useMemo, useId } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ChevronDown,
  Package,
  Briefcase,
  Luggage,
  Plus,
  X as XIcon,
  Check,
  Pencil,
  Info,
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
import type { Box, BoxItem, ItemAssessment } from "@/types";
import { BoxSize, BoxType, BOX_SIZE_CBM, BOX_SIZE_DIMENSIONS } from "@/lib/constants";
import { cn } from "@/lib/utils";

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
  onUpdateBox?: ((boxId: string, updates: { label?: string; size?: string }) => void) | undefined;
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
  /** Whether a sticker scan upload/process is in progress for this box */
  isScanning?: boolean | undefined;
  /** Item IDs currently being resolved (ship anyway / remove) */
  resolvingItemIds?: Set<string> | undefined;
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
  isScanning = false,
  resolvingItemIds,
}: BoxCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isAnimating, setIsAnimating] = useState(true);
  const [confirmPackedOpen, setConfirmPackedOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [localStickerUrl, setLocalStickerUrl] = useState<string | null>(null);
  const prefersReducedMotion = useReducedMotion();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [itemCountKey, setItemCountKey] = useState(0);
  const prevItemCount = useRef(items.length);

  useEffect(() => {
    if (items.length !== prevItemCount.current) {
      setItemCountKey((k) => k + 1);
      prevItemCount.current = items.length;
    }
  }, [items.length]);

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

  const handleLabelSave = useCallback(
    (newLabel: string) => {
      onUpdateBox?.(box.id, { label: newLabel });
    },
    [box.id, onUpdateBox]
  );

  const handleSizeChange = useCallback(
    (newSize: BoxSize) => {
      onUpdateBox?.(box.id, { size: newSize });
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

  const unresolvedFlagCount = flaggedItems.length;

  // Determine confirm dialog copy — changes when there are unresolved flags
  const confirmPackedDescription =
    unresolvedFlagCount > 0
      ? `${box.label} has ${unresolvedFlagCount} ${unresolvedFlagCount === 1 ? "item" : "items"} that ${unresolvedFlagCount === 1 ? "was" : "were"} not assessed as ship. Mark as packed anyway?`
      : `Mark ${box.label} as packed? You can still edit it later.`;
  const confirmPackedLabel = unresolvedFlagCount > 0 ? "Pack anyway" : "Yes, packed";

  return (
    <>
      <div
        className={cn(styles.card, isShipped && styles.cardShipped)}
        data-open={isOpen ? "true" : "false"}
        data-box-type={box.box_type}
      >
        {/* Collapsed header — always visible */}
        <div
          role="button"
          tabIndex={0}
          onClick={handleToggle}
          onKeyDown={handleKeyDown}
          className={styles.header}
          aria-expanded={isOpen}
          aria-label={`${box.label}, ${items.length} ${items.length === 1 ? "item" : "items"}, status: ${box.status}`}
        >
          <BoxIcon boxType={box.box_type} />

          <div className={styles.headerContent}>
            <div className={styles.headerTopRow}>
              {onUpdateBox && isPacking ? (
                <EditableLabel
                  value={box.label}
                  onSave={handleLabelSave}
                  disabled={isShipped}
                />
              ) : (
                <span className={styles.boxLabel}>{box.label}</span>
              )}
              <div className={styles.badgeGroup}>
                {showSize && onUpdateBox && isPacking ? (
                  <SizeEditor
                    currentSize={box.size!}
                    onSizeChange={handleSizeChange}
                    disabled={isShipped}
                  />
                ) : showSize ? (
                  <BoxSizeBadge size={box.size!} />
                ) : null}
                <BoxStatusBadge status={box.status} />
              </div>
            </div>
            <div className={styles.headerMeta}>
              <motion.span
                key={itemCountKey}
                initial={itemCountKey > 0 ? { scale: 1.15 } : false}
                animate={{ scale: 1 }}
                transition={
                  prefersReducedMotion
                    ? { duration: 0 }
                    : { duration: 0.3, ease: "easeOut" }
                }
              >
                {items.length} {items.length === 1 ? "item" : "items"}
              </motion.span>
              <FlagIndicator count={unresolvedFlagCount} />
              {showCbm && <span>{box.cbm} CBM</span>}
            </div>
          </div>

          <div className={styles.chevronWrap}>
            <ChevronDown
              className={cn(styles.chevron, isOpen && styles.chevronOpen)}
              style={{ width: 16, height: 16 }}
            />
          </div>
        </div>

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
                    illegibleCount={scanResult.illegibleCount}
                    {...(scanResult.errorMessage
                      ? { errorMessage: scanResult.errorMessage }
                      : {})}
                  />
                )}

                {/* Items list — empty state accounts for scan-in-progress context */}
                {items.length === 0 && flaggedItems.length === 0 ? (
                  <p className={styles.emptyMessage}>
                    {scanResult && scanResult.status !== "complete" && scanResult.status !== "error"
                      ? "Aisling is reading your sticker. Items will appear here as they are identified."
                      : "No items in this box yet."}
                  </p>
                ) : (
                  <ul className={styles.itemList}>
                    <AnimatePresence mode="popLayout">
                      {/* Flagged items — rendered inline, in alphabetical order with regular items */}
                      {flaggedItems
                        .slice()
                        .sort((a, b) => a.item_name.localeCompare(b.item_name))
                        .map((flagged) => (
                          <motion.li
                            key={`flagged-${flagged.item_assessment_id}`}
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
                              itemName={flagged.item_name}
                              itemId={flagged.item_assessment_id}
                              verdict={flagged.verdict}
                              boxId={box.id}
                              boxLabel={box.label}
                              onShipAnyway={onShipAnyway ?? (() => undefined)}
                              onRemoveFromBox={
                                onRemoveFlaggedItem ?? (() => undefined)
                              }
                              isResolving={
                                resolvingItemIds?.has(
                                  flagged.item_assessment_id
                                ) ?? false
                              }
                            />
                          </motion.li>
                        ))}

                      {/* Regular items — skip items that are in the flagged set */}
                      {[...items]
                        .sort((a, b) => {
                          const nameA =
                            (a.item_assessment_id
                              ? assessments?.[a.item_assessment_id]?.item_name
                              : undefined) ??
                            a.item_name ??
                            "";
                          const nameB =
                            (b.item_assessment_id
                              ? assessments?.[b.item_assessment_id]?.item_name
                              : undefined) ??
                            b.item_name ??
                            "";
                          return nameA.localeCompare(nameB);
                        })
                        .filter(
                          (item) =>
                            !item.item_assessment_id ||
                            !flaggedItemIds.has(item.item_assessment_id)
                        )
                        .map((item) => {
                          const assessment = item.item_assessment_id
                            ? assessments?.[item.item_assessment_id]
                            : undefined;
                          const displayName =
                            assessment?.item_name ??
                            item.item_name ??
                            "Unnamed item";
                          const itemImageUrl = assessment?.image_url
                            ? `/api/img?url=${encodeURIComponent(assessment.image_url)}`
                            : undefined;

                          const thumbNode = itemImageUrl ? (
                            <img
                              src={itemImageUrl}
                              alt=""
                              aria-hidden="true"
                              className={styles.itemThumb}
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
                              key={item.id}
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
                                  onClick={(e) => e.stopPropagation()}
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
