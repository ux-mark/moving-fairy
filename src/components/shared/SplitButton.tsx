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
  const containerRef = useRef<HTMLDivElement>(null);
  const chevronRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLUListElement>(null);
  const isDisabled = disabled || loading;

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
    setOpen((prev) => !prev);
  }, [isDisabled]);

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

      {/* Dropdown */}
      {open && (
        <ul
          ref={dropdownRef}
          role="menu"
          className={styles.dropdown}
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
