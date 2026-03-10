"use client";

import { useState, useCallback } from "react";
import { Truck } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
        className="gap-1.5"
        onClick={() => setOpen(true)}
      >
        <Truck className="size-4" />
        Mark all as shipped
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark all as shipped?</DialogTitle>
            <DialogDescription>
              This includes {parts.join(" and ")}. Shipped items become
              read-only.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={isSubmitting}>
              {isSubmitting ? "Updating..." : "Mark as shipped"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
