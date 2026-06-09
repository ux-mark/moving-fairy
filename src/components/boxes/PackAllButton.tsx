"use client";

import { useState, useCallback, useRef } from "react";
import { PackageCheck } from "lucide-react";
import { Button, ConfirmDialog } from "@thefairies/design-system/components";

import styles from "./PackAllButton.module.css";

interface PackAllButtonProps {
  boxCount: number;
  onConfirm: () => void;
  isSubmitting?: boolean;
}

export function PackAllButton({
  boxCount,
  onConfirm,
  isSubmitting,
}: PackAllButtonProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const handleConfirm = useCallback(() => {
    onConfirm();
    setOpen(false);
  }, [onConfirm]);

  if (boxCount === 0) return null;

  const boxLabel = boxCount === 1 ? "box" : "boxes";

  return (
    <>
      <Button
        ref={triggerRef}
        variant="secondary"
        size="sm"
        className={styles.trigger ?? ""}
        onClick={() => setOpen(true)}
      >
        <PackageCheck style={{ width: 16, height: 16 }} />
        Mark all as packed
      </Button>

      <ConfirmDialog
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Mark all as packed?"
        description={`This marks ${boxCount} ${boxLabel} you're still packing as packed. Packed boxes appear on your itinerary.`}
        confirmLabel={isSubmitting ? "Updating..." : "Mark as packed"}
        cancelLabel="Cancel"
        onConfirm={handleConfirm}
        triggerRef={triggerRef}
        {...(isSubmitting !== undefined ? { isConfirming: isSubmitting } : {})}
      />
    </>
  );
}
