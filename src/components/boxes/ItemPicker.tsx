"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Search, X as XIcon } from "lucide-react";
import { VerdictBadge } from "@/components/chat/VerdictBadge";
import type { ItemAssessment } from "@/types";

import styles from "./ItemPicker.module.css";

interface ItemPickerProps {
  items: ItemAssessment[];
  onSelect: (item: ItemAssessment) => void;
  onDismiss: () => void;
  /** Label for the aria-label of the combobox */
  label?: string;
}

export function ItemPicker({ items, onSelect, onDismiss, label = "Select an item" }: ItemPickerProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = query.trim()
    ? items.filter((item) =>
        item.item_name.toLowerCase().includes(query.trim().toLowerCase())
      )
    : items;

  // Auto-focus the search input when the picker opens
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Dismiss on Escape key
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onDismiss();
      }
    },
    [onDismiss]
  );

  // Dismiss on outside click
  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        onDismiss();
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [onDismiss]);

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- dialog requires keyboard handling for Escape dismissal
    <div
      ref={containerRef}
      className={styles.picker}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-label="Add existing inventory item"
      tabIndex={-1}
    >
      <div className={styles.searchRow}>
        <Search className={styles.searchIcon} aria-hidden />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search items…"
          className={styles.searchInput}
          aria-label={label}
        />
        <button
          type="button"
          onClick={onDismiss}
          className={styles.dismissButton}
          aria-label="Close item picker"
        >
          <XIcon style={{ width: 14, height: 14 }} />
        </button>
      </div>

      <ul
        id="item-picker-list"
        className={styles.list}
        aria-label="Available items"
      >
        {filtered.length === 0 ? (
          <li className={styles.emptyMessage}>
            No items match &ldquo;{query}&rdquo;
          </li>
        ) : (
          filtered.map((item) => (
            <li
              key={item.id}
              className={styles.listItem}
            >
              <button
                type="button"
                className={styles.listItemButton}
                onClick={() => onSelect(item)}
              >
                <span className={styles.listItemName}>{item.item_name}</span>
                <VerdictBadge verdict={item.verdict} />
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
