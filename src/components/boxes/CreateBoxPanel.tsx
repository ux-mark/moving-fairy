"use client";

import { useState, useCallback } from "react";
import { Button } from "@thefairies/design-system/components";

import { SlidePanel } from "@/components/shared/SlidePanel";
import { BOX_SIZE_CBM, BoxSize, BoxType } from "@/lib/constants";
import { cn } from "@/lib/utils";

import styles from "./CreateBoxPanel.module.css";

// Note: SlidePanel will be migrated to DS EditPanel in a future pass.

const SIZES: BoxSize[] = ["XS", "S", "M", "L"];

const BOX_TYPES = [
  { value: BoxType.STANDARD, label: "Standard" },
  { value: BoxType.CHECKED_LUGGAGE, label: "Checked Luggage" },
  { value: BoxType.CARRYON, label: "Carry-on" },
  { value: BoxType.SINGLE_ITEM, label: "Single Item" },
] as const;

interface CreateBoxPanelProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    roomName: string;
    size: BoxSize;
    boxType: (typeof BoxType)[keyof typeof BoxType];
  }) => void;
  isSubmitting?: boolean | undefined;
}

export function CreateBoxPanel({
  open,
  onClose,
  onSubmit,
  isSubmitting,
}: CreateBoxPanelProps) {
  const [roomName, setRoomName] = useState("");
  const [size, setSize] = useState<BoxSize>("M");
  const [boxType, setBoxType] = useState<(typeof BoxType)[keyof typeof BoxType]>(
    BoxType.STANDARD
  );
  const [error, setError] = useState("");

  const showSize = boxType === BoxType.STANDARD;
  const showRoomName = boxType === BoxType.STANDARD || boxType === BoxType.SINGLE_ITEM;

  const handleSubmit = useCallback(() => {
    if (showRoomName && !roomName.trim()) {
      setError("Enter a room name to create a box.");
      return;
    }
    setError("");
    onSubmit({
      roomName: showRoomName ? roomName.trim() : boxType === BoxType.CARRYON ? "Carry-on" : "Checked Luggage",
      size,
      boxType,
    });
    setRoomName("");
    setSize("M");
    setBoxType(BoxType.STANDARD);
  }, [roomName, size, boxType, onSubmit, showRoomName]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const handleClose = useCallback(() => {
    setRoomName("");
    setSize("M");
    setBoxType(BoxType.STANDARD);
    setError("");
    onClose();
  }, [onClose]);

  return (
    <SlidePanel open={open} onClose={handleClose} title="New box">
      <div className={styles.form}>
        {/* Box type selector */}
        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Box type</legend>
          <div className={styles.typeGrid}>
            {BOX_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => {
                  setBoxType(t.value);
                  setError("");
                }}
                className={cn(
                  styles.typeOption,
                  boxType === t.value && styles.typeOptionActive
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </fieldset>

        {/* Room name input */}
        {showRoomName && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label htmlFor="room-name" className={styles.labelText}>
              {boxType === BoxType.SINGLE_ITEM
                ? "What is this item?"
                : "What room is this box for?"}
            </label>
            <input
              id="room-name"
              type="text"
              value={roomName}
              onChange={(e) => {
                setRoomName(e.target.value);
                if (error) setError("");
              }}
              onKeyDown={handleKeyDown}
              placeholder={
                boxType === BoxType.SINGLE_ITEM
                  ? "e.g. Dining Table, Bicycle"
                  : "e.g. Kitchen, Bedroom, Garage"
              }
              aria-invalid={!!error}
              aria-describedby={error ? "room-name-error" : undefined}
              className={cn(
                styles.inputField,
                error && styles.inputFieldError
              )}
            />
            {error && (
              <p id="room-name-error" className={styles.errorMessage}>
                {error}
              </p>
            )}
          </div>
        )}

        {/* Size selector — segmented control */}
        {showSize && (
          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>Box size</legend>
            <div className={styles.sizeControl}>
              {SIZES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSize(s)}
                  className={cn(
                    styles.sizeOption,
                    size === s && styles.sizeOptionActive
                  )}
                  aria-pressed={size === s}
                >
                  <span className={styles.sizeLabel}>{s}</span>
                  <span className={styles.sizeCbm}>{BOX_SIZE_CBM[s]} CBM</span>
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {/* Submit */}
        <Button
          variant="primary"
          size="md"
          className={styles.submitButton ?? ""}
          onClick={handleSubmit}
          {...(isSubmitting !== undefined ? { disabled: isSubmitting } : {})}
        >
          {isSubmitting ? "Creating..." : "Create box"}
        </Button>

        <button
          type="button"
          onClick={handleClose}
          className={styles.cancelButton}
        >
          Cancel
        </button>
      </div>
    </SlidePanel>
  );
}
