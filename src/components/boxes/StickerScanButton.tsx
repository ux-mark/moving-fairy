"use client";

import { useRef, useCallback } from "react";
import { Camera } from "lucide-react";
import { Button } from "@thefairies/design-system/components";

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

  const handleButtonClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!isScanning) {
        inputRef.current?.click();
      }
    },
    [isScanning]
  );

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
        capture="environment"
        aria-label={`Take a photo of the box sticker for ${boxLabel}`}
        tabIndex={-1}
        className={styles.hiddenInput}
        onChange={handleFileChange}
      />
      <Button
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
    </div>
  );
}
