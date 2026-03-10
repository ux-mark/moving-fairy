"use client";

import { useState, useCallback } from "react";

import { SlidePanel } from "@/components/shared/SlidePanel";
import { Button } from "@/components/ui/button";
import { BOX_SIZE_CBM, BoxSize, BoxType } from "@/lib/constants";
import { cn } from "@/lib/utils";

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
      <div className="space-y-5">
        {/* Box type selector */}
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-foreground">
            Box type
          </legend>
          <div className="grid grid-cols-2 gap-2">
            {BOX_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => {
                  setBoxType(t.value);
                  setError("");
                }}
                className={cn(
                  "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                  boxType === t.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-foreground hover:bg-muted"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </fieldset>

        {/* Room name input */}
        {showRoomName && (
          <div className="space-y-2">
            <label
              htmlFor="room-name"
              className="text-sm font-medium text-foreground"
            >
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
                "h-10 w-full rounded-lg border bg-transparent px-3 text-base text-foreground placeholder:text-muted-foreground transition-colors focus-visible:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                error ? "border-destructive" : "border-input"
              )}
            />
            {error && (
              <p id="room-name-error" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
        )}

        {/* Size selector — segmented control */}
        {showSize && (
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-foreground">
              Box size
            </legend>
            <div className="flex rounded-lg border border-border bg-muted p-1">
              {SIZES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSize(s)}
                  className={cn(
                    "flex-1 rounded-md px-2 py-2 text-center text-sm font-medium transition-colors",
                    size === s
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  aria-pressed={size === s}
                >
                  <span className="block">{s}</span>
                  <span className="block text-[10px] font-normal text-muted-foreground">
                    {BOX_SIZE_CBM[s]} CBM
                  </span>
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {/* Submit */}
        <Button
          className="w-full h-11"
          onClick={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? "Creating..." : "Create box"}
        </Button>

        <button
          type="button"
          onClick={handleClose}
          className="block w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </div>
    </SlidePanel>
  );
}
