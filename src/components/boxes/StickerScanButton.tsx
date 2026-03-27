"use client";

import { useRef, useCallback, useState } from "react";
import { Camera } from "lucide-react";
import { Button, ConfirmDialog } from "@thefairies/design-system/components";

import { cn } from "@/lib/utils";

import styles from "./StickerScanButton.module.css";

interface StickerScanButtonProps {
  boxId: string;
  boxLabel: string;
  hasExistingSticker: boolean;
  onScanStart: (boxId: string, file: File) => void;
  isScanning: boolean;
}

export function StickerScanButton({
  boxId,
  boxLabel,
  hasExistingSticker,
  onScanStart,
  isScanning,
}: StickerScanButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [rescanConfirmOpen, setRescanConfirmOpen] = useState(false);

  const openFilePicker = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleButtonClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isScanning) return;

      if (hasExistingSticker) {
        // Show confirmation dialog before rescan
        setRescanConfirmOpen(true);
      } else {
        openFilePicker();
      }
    },
    [isScanning, hasExistingSticker, openFilePicker]
  );

  const handleRescanConfirm = useCallback(() => {
    setRescanConfirmOpen(false);
    openFilePicker();
  }, [openFilePicker]);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        onScanStart(boxId, file);
      }
      // Reset so the same file can be selected again if needed
      e.target.value = "";
    },
    [boxId, onScanStart]
  );

  const label = isScanning
    ? "Scanning..."
    : hasExistingSticker
    ? "Rescan box sticker"
    : "Scan box sticker";

  return (
    <div className={styles.wrap}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        aria-label={`Upload or take a photo of the box sticker for ${boxLabel}`}
        tabIndex={-1}
        className={styles.hiddenInput}
        onChange={handleFileChange}
      />
      <Button
        ref={buttonRef}
        variant="outline"
        size="sm"
        className={cn(styles.button)}
        onClick={handleButtonClick}
        disabled={isScanning}
        aria-label={`${isScanning ? "Scanning" : hasExistingSticker ? "Rescan" : "Scan"} box sticker for ${boxLabel}`}
      >
        <Camera style={{ width: 16, height: 16 }} aria-hidden />
        {label}
      </Button>

      <ConfirmDialog
        isOpen={rescanConfirmOpen}
        onClose={() => setRescanConfirmOpen(false)}
        title="Rescan this box?"
        description="The new sticker photo will replace the current one. Items already in the box will not be removed."
        confirmLabel="Take new photo"
        cancelLabel="Keep current photo"
        onConfirm={handleRescanConfirm}
        triggerRef={buttonRef}
      />
    </div>
  );
}
