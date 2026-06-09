"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import styles from "./CurrencySelect.module.css";

export interface CurrencySelectProps {
  /** Currently selected currency code (e.g. "EUR"). */
  value: string;
  /** Currency codes to offer (e.g. ["USD", "EUR", "GBP"]). */
  options: readonly string[];
  onChange: (currency: string) => void;
  disabled?: boolean | undefined;
  /** Accessible label naming the field (e.g. "Currency for Vitamix A3500"). */
  ariaLabel: string;
  className?: string | undefined;
}

/**
 * Accessible currency dropdown — a trigger showing the selected code + chevron
 * opening a styled option list. Mirrors BoxSelect's keyboard contract: open on
 * click/Enter/Space/ArrowDown, ArrowUp/Down + Home/End to move, Enter/Space to
 * select, Escape to close, focus returns to the trigger, click-outside dismisses.
 */
export function CurrencySelect({
  value,
  options,
  onChange,
  disabled = false,
  ariaLabel,
  className,
}: CurrencySelectProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const current = options.includes(value) ? value : options[0];

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  // Move DOM focus to the active option as the user arrows through.
  useEffect(() => {
    if (!open || activeIndex < 0) return;
    const items = listRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]');
    items?.[activeIndex]?.focus();
  }, [open, activeIndex]);

  const openDropdown = useCallback(() => {
    const idx = options.indexOf(value);
    setActiveIndex(idx >= 0 ? idx : 0);
    setOpen(true);
  }, [options, value]);

  const closeDropdown = useCallback(() => {
    setOpen(false);
    setActiveIndex(-1);
  }, []);

  const handleSelect = useCallback(
    (currency: string) => {
      closeDropdown();
      triggerRef.current?.focus();
      if (currency !== value) onChange(currency);
    },
    [closeDropdown, onChange, value],
  );

  const handleTriggerKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (disabled) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open ? closeDropdown() : openDropdown();
      } else if (e.key === "ArrowDown" && !open) {
        e.preventDefault();
        openDropdown();
      } else if (e.key === "Escape" && open) {
        e.preventDefault();
        closeDropdown();
      }
    },
    [disabled, open, openDropdown, closeDropdown],
  );

  const handleListKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLUListElement>) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeDropdown();
        triggerRef.current?.focus();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((prev) => (prev + 1) % options.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((prev) => (prev - 1 + options.length) % options.length);
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const next = options[activeIndex];
        if (activeIndex >= 0 && next) handleSelect(next);
      } else if (e.key === "Home") {
        e.preventDefault();
        setActiveIndex(0);
      } else if (e.key === "End") {
        e.preventDefault();
        setActiveIndex(options.length - 1);
      } else if (e.key === "Tab") {
        closeDropdown();
      }
    },
    [activeIndex, options, handleSelect, closeDropdown],
  );

  const listboxId = `currency-select-${ariaLabel.replace(/\s+/g, "-")}`;

  return (
    <div ref={containerRef} className={cn(styles.wrapper, className)}>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-label={ariaLabel}
        className={cn(styles.trigger, disabled && styles.disabled)}
        onClick={() => (disabled ? undefined : open ? closeDropdown() : openDropdown())}
        onKeyDown={handleTriggerKeyDown}
        disabled={disabled}
      >
        <span className={styles.triggerLabel}>{current}</span>
        <ChevronDown className={cn(styles.chevron, open && styles.chevronOpen)} aria-hidden="true" />
      </button>

      {open && (
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-label={ariaLabel}
          className={styles.dropdown}
          onKeyDown={handleListKeyDown}
        >
          {options.map((option, index) => {
            const isSelected = option === value;
            return (
              <li key={option} role="none">
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={cn(styles.option, index === activeIndex && styles.optionActive)}
                  onClick={() => handleSelect(option)}
                  tabIndex={-1}
                >
                  <span>{option}</span>
                  {isSelected && <Check className={styles.checkIcon} aria-hidden="true" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
