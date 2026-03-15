"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import styles from "./SplitButton.module.css";

export interface SplitButtonItem {
  label: string;
  onClick: () => void | Promise<void>;
  icon?: React.ReactNode;
}

export interface SplitButtonProps {
  label: string;
  onClick: () => void | Promise<void>;
  items: SplitButtonItem[];
  variant?: "primary" | "success" | "danger";
  size?: "sm" | "md";
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}

interface DropdownPosition {
  top: number;
  /** right-aligned: distance from viewport right edge */
  right?: number;
  /** left-aligned fallback: distance from viewport left edge */
  left?: number;
}

export function SplitButton({
  label,
  onClick,
  items,
  variant = "primary",
  size = "md",
  disabled = false,
  loading = false,
  className,
}: SplitButtonProps) {
  const [open, setOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState<DropdownPosition | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const chevronRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLUListElement>(null);
  const isDisabled = disabled || loading;

  /** Compute fixed dropdown position from container rect with viewport clamping. */
  const calcDropdownPos = useCallback((): DropdownPosition | null => {
    if (!containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    const top = rect.bottom + 2;

    // Dropdown min-width is 180px (from CSS). Use that to detect overflow.
    const dropdownMinWidth = 180;
    const rightAligned = window.innerWidth - rect.right;
    const projectedLeft = rect.right - dropdownMinWidth;

    if (projectedLeft < 8) {
      // Would overflow left edge — align to container's left edge, clamped to 8px
      return { top, left: Math.max(8, rect.left) };
    }

    // Right-align to container right, clamped so right edge stays >= 8px from viewport
    return { top, right: Math.max(8, rightAligned) };
  }, []);

  // Close dropdown on outside click
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

  // Recompute dropdown position on scroll/resize while open
  useEffect(() => {
    if (!open) return;

    function recalculate() {
      const pos = calcDropdownPos();
      if (pos) setDropdownPos(pos);
    }

    window.addEventListener("scroll", recalculate, { capture: true, passive: true });
    window.addEventListener("resize", recalculate, { passive: true });
    return () => {
      window.removeEventListener("scroll", recalculate, { capture: true });
      window.removeEventListener("resize", recalculate);
    };
  }, [open, calcDropdownPos]);

  // Keyboard navigation within dropdown
  const handleDropdownKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLUListElement>) => {
      const items = Array.from(
        dropdownRef.current?.querySelectorAll<HTMLButtonElement>(
          '[role="menuitem"]'
        ) ?? []
      );
      const focused = document.activeElement as HTMLButtonElement;
      const currentIndex = items.indexOf(focused);

      if (e.key === "Escape") {
        setOpen(false);
        chevronRef.current?.focus();
        e.preventDefault();
      } else if (e.key === "ArrowDown") {
        const next = items[(currentIndex + 1) % items.length];
        next?.focus();
        e.preventDefault();
      } else if (e.key === "ArrowUp") {
        const prev = items[(currentIndex - 1 + items.length) % items.length];
        prev?.focus();
        e.preventDefault();
      }
    },
    []
  );

  const handleChevronKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === "ArrowDown" && open) {
        const first = dropdownRef.current?.querySelector<HTMLButtonElement>(
          '[role="menuitem"]'
        );
        first?.focus();
        e.preventDefault();
      }
    },
    [open]
  );

  const toggleDropdown = useCallback(() => {
    if (isDisabled) return;
    setOpen((prev) => {
      const next = !prev;
      if (next) {
        const pos = calcDropdownPos();
        if (pos) setDropdownPos(pos);
      }
      return next;
    });
  }, [isDisabled, calcDropdownPos]);

  const handleItemClick = useCallback(
    async (item: SplitButtonItem) => {
      setOpen(false);
      await item.onClick();
    },
    []
  );

  // Focus first item when dropdown opens
  useEffect(() => {
    if (open) {
      const first = dropdownRef.current?.querySelector<HTMLButtonElement>(
        '[role="menuitem"]'
      );
      first?.focus();
    }
  }, [open]);

  return (
    <div
      ref={containerRef}
      className={cn(
        styles.container,
        styles[variant],
        styles[size],
        isDisabled && styles.disabled,
        className
      )}
    >
      {/* Primary action zone */}
      <button
        type="button"
        className={styles.primaryZone}
        onClick={() => !isDisabled && onClick()}
        disabled={isDisabled}
        aria-busy={loading}
      >
        {loading ? (
          <span className={styles.spinner} aria-hidden="true">
            <Loader2 size={size === "sm" ? 14 : 16} />
          </span>
        ) : null}
        {label}
      </button>

      {/* Divider */}
      <span className={styles.divider} aria-hidden="true" />

      {/* Chevron dropdown trigger */}
      <button
        ref={chevronRef}
        type="button"
        className={styles.chevronZone}
        onClick={toggleDropdown}
        onKeyDown={handleChevronKeyDown}
        disabled={isDisabled}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="More options"
      >
        <ChevronDown size={16} aria-hidden="true" />
      </button>

      {/* Dropdown — rendered with position:fixed so it escapes overflow:hidden ancestors */}
      {open && dropdownPos && (
        <ul
          ref={dropdownRef}
          role="menu"
          className={styles.dropdown}
          style={{
            top: dropdownPos.top,
            ...(dropdownPos.left !== undefined
              ? { left: dropdownPos.left }
              : { right: dropdownPos.right }),
          }}
          onKeyDown={handleDropdownKeyDown}
        >
          {items.map((item, index) => (
            <li key={index} role="none">
              <button
                type="button"
                role="menuitem"
                className={styles.dropdownItem}
                onClick={() => handleItemClick(item)}
              >
                {item.icon ? (
                  <span className={styles.dropdownItemIcon} aria-hidden="true">
                    {item.icon}
                  </span>
                ) : null}
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
