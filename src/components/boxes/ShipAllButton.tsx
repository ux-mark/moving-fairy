"use client";

import { useState, useCallback } from "react";
import { Truck } from "lucide-react";
import { Button, ConfirmDialog } from "@thefairies/design-system/components";

import styles from "./ShipAllButton.module.css";

interface ShipAllButtonProps {
  boxCount: number;
  singleItemCount: number;
  onConfirm: () => void;
  isSubmitting?: boolean;
}

export function ShipAllButton({
  boxCount,
  singleItemCount,
  onConfirm,
  isSubmitting,
}: ShipAllButtonProps) {
  const [open, setOpen] = useState(false);

  const handleConfirm = useCallback(() => {
    onConfirm();
    setOpen(false);
  }, [onConfirm]);

  if (boxCount === 0 && singleItemCount === 0) return null;

  const parts: string[] = [];
  if (boxCount > 0) parts.push(`${boxCount} ${boxCount === 1 ? "box" : "boxes"}`);
  if (singleItemCount > 0)
    parts.push(
      `${singleItemCount} single ${singleItemCount === 1 ? "item" : "items"}`
    );

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        className={styles.trigger ?? ""}
        onClick={() => setOpen(true)}
      >
        <Truck style={{ width: 16, height: 16 }} />
        Mark all as shipped
      </Button>

      <ConfirmDialog
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Mark all as shipped?"
        description={`This includes ${parts.join(" and ")}. Shipped items become read-only.`}
        confirmLabel={isSubmitting ? "Updating..." : "Mark as shipped"}
        cancelLabel="Cancel"
        onConfirm={handleConfirm}
        {...(isSubmitting !== undefined ? { isConfirming: isSubmitting } : {})}
      />
    </>
  );
}
