"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import styles from "./EditablePill.module.css";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EditablePillOption {
  value: string;
  label: string;
  /** Background colour for the pill when this option is selected */
  color: string;
  /** Text colour — defaults will depend on contrast needs */
  textColor?: string;
}

export interface EditablePillProps {
  value: string;
  options: EditablePillOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  size?: "sm" | "md";
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EditablePill({
  value,
  options,
  onChange,
  disabled = false,
  size = "sm",
  className,
}: EditablePillProps) {
  const [open, setOpen] = useState(false);
  // activeIndex tracks keyboard focus position within the open dropdown (-1 = none)
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const currentOption = options.find((o) => o.value === value) ?? options[0];

  // ------------------------------------------------------------------
  // Close on outside click
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!open) return;

    function handlePointerDown(e: PointerEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  // ------------------------------------------------------------------
  // Focus active option when activeIndex changes (keyboard nav)
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!open || activeIndex < 0) return;
    const items = listRef.current?.querySelectorAll<HTMLButtonElement>(
      '[role="option"]'
    );
    items?.[activeIndex]?.focus();
  }, [open, activeIndex]);

  // ------------------------------------------------------------------
  // Handlers
  // ------------------------------------------------------------------
  const openDropdown = useCallback(() => {
    const currentIdx = options.findIndex((o) => o.value === value);
    setActiveIndex(currentIdx >= 0 ? currentIdx : 0);
    setOpen(true);
  }, [options, value]);

  const closeDropdown = useCallback(() => {
    setOpen(false);
    setActiveIndex(-1);
  }, []);

  const handlePillClick = useCallback(() => {
    if (disabled) return;
    if (open) {
      closeDropdown();
    } else {
      openDropdown();
    }
  }, [disabled, open, openDropdown, closeDropdown]);

  const handleSelect = useCallback(
    (optionValue: string) => {
      closeDropdown();
      pillRef.current?.focus();
      if (optionValue !== value) {
        onChange(optionValue);
      }
    },
    [closeDropdown, onChange, value]
  );

  const handlePillKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (disabled) return;

      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (open) {
          closeDropdown();
        } else {
          openDropdown();
        }
      } else if (e.key === "ArrowDown" && !open) {
        e.preventDefault();
        openDropdown();
      } else if (e.key === "Escape" && open) {
        e.preventDefault();
        closeDropdown();
      }
    },
    [disabled, open, openDropdown, closeDropdown]
  );

  const handleListKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLUListElement>) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeDropdown();
        pillRef.current?.focus();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((prev) => (prev + 1) % options.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((prev) => (prev - 1 + options.length) % options.length);
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (activeIndex >= 0 && options[activeIndex]) {
          handleSelect(options[activeIndex].value);
        }
      } else if (e.key === "Home") {
        e.preventDefault();
        setActiveIndex(0);
      } else if (e.key === "End") {
        e.preventDefault();
        setActiveIndex(options.length - 1);
      }
    },
    [activeIndex, options, handleSelect, closeDropdown]
  );

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  const pillStyle = currentOption
    ? ({
        "--pill-bg": currentOption.color,
        "--pill-fg": currentOption.textColor ?? "#fff",
      } as React.CSSProperties)
    : undefined;

  const listboxId = `editable-pill-listbox-${value}`;

  return (
    <div
      ref={containerRef}
      className={cn(styles.wrapper, styles[size], className)}
    >
      {/* Pill trigger */}
      <button
        ref={pillRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-label={`Verdict: ${currentOption?.label ?? value}. Click to change.`}
        className={cn(
          styles.pill,
          disabled && styles.disabled
        )}
        style={pillStyle}
        onClick={handlePillClick}
        onKeyDown={handlePillKeyDown}
        disabled={disabled}
      >
        <span className={styles.pillLabel}>{currentOption?.label ?? value}</span>
        <ChevronDown
          className={cn(styles.chevron, open && styles.chevronOpen)}
          aria-hidden="true"
        />
      </button>

      {/* Dropdown */}
      {open && (
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-label="Select verdict"
          className={styles.dropdown}
          onKeyDown={handleListKeyDown}
        >
          {options.map((option, index) => {
            const isSelected = option.value === value;
            const itemStyle = {
              "--option-bg": option.color,
              "--option-fg": option.textColor ?? "#fff",
            } as React.CSSProperties;

            return (
              <li key={option.value} role="none">
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={cn(
                    styles.dropdownItem,
                    index === activeIndex && styles.dropdownItemActive
                  )}
                  style={itemStyle}
                  onClick={() => handleSelect(option.value)}
                  tabIndex={-1}
                >
                  <span
                    className={styles.optionDot}
                    style={{ background: option.color }}
                    aria-hidden="true"
                  />
                  <span className={styles.optionLabel}>{option.label}</span>
                  {isSelected && (
                    <Check
                      className={styles.checkIcon}
                      aria-hidden="true"
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
