"use client";

import { useCallback, useEffect, useState } from "react";
import { EditPanel, Spinner } from "@thefairies/design-system/components";
import { Verdict } from "@/lib/constants";
import type { Box, ItemAssessment } from "@/types";
import styles from "./ItemEditPanel.module.css";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ItemEditPanelProps {
  item: ItemAssessment;
  boxes: Box[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (updates: Partial<ItemAssessment>) => Promise<void>;
}

// Verdicts that support box assignment
const SHIPPING_VERDICTS: string[] = [Verdict.SHIP, Verdict.CARRY];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ItemEditPanel({
  item,
  boxes,
  isOpen,
  onClose,
  onSave,
}: ItemEditPanelProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form state — initialised from item, reset when item or panel open state changes
  const [itemName, setItemName] = useState(item.item_name);
  const [estimatedValue, setEstimatedValue] = useState<string>(
    item.estimated_replace_cost != null
      ? String(item.estimated_replace_cost)
      : ""
  );
  const [notes, setNotes] = useState<string>(item.advice_text ?? "");
  const [boxId, setBoxId] = useState<string>("");

  // Reset form when panel opens or item changes
  useEffect(() => {
    if (!isOpen) return;
    setItemName(item.item_name);
    setEstimatedValue(
      item.estimated_replace_cost != null
        ? String(item.estimated_replace_cost)
        : ""
    );
    setNotes(item.advice_text ?? "");
    setBoxId("");
    setError(null);
    setSuccess(false);
  }, [isOpen, item]);

  const showBoxField = SHIPPING_VERDICTS.includes(item.verdict);
  const shippingBoxes = boxes.filter(
    (b) => b.box_type === "standard" || b.box_type === "carryon" || b.box_type === "checked_luggage"
  );

  const handleSave = useCallback(async () => {
    const trimmedName = itemName.trim();
    if (!trimmedName) {
      setError("Item name cannot be empty.");
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(false);

    const parsedValue =
      estimatedValue.trim() !== "" ? parseFloat(estimatedValue) : null;

    const updates: Partial<ItemAssessment> = {};

    if (trimmedName !== item.item_name) {
      updates.item_name = trimmedName;
    }
    if (parsedValue !== item.estimated_replace_cost) {
      updates.estimated_replace_cost = parsedValue;
    }
    if (notes !== (item.advice_text ?? "")) {
      updates.advice_text = notes;
    }

    try {
      await onSave(updates);

      // If a box was selected, assign the item to that box
      if (showBoxField && boxId) {
        await fetch(`/api/boxes/${boxId}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ item_assessment_id: item.id }),
        });
      }

      setSuccess(true);
      setTimeout(() => {
        onClose();
        setSuccess(false);
      }, 1200);
    } catch {
      setError("Could not save your changes. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }, [itemName, estimatedValue, notes, boxId, item, showBoxField, onSave, onClose]);

  return (
    <EditPanel
      isOpen={isOpen}
      onClose={onClose}
      title="Edit item"
      onSave={handleSave}
      onCancel={onClose}
      saveLabel={isSaving ? "Saving..." : success ? "Saved" : "Save changes"}
      footer={false}
    >
      <div className={styles.form}>
        {/* Item name */}
        <div className={styles.fieldGroup}>
          <label htmlFor="item-edit-name" className={styles.label}>
            Item name
          </label>
          <input
            id="item-edit-name"
            type="text"
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            placeholder="e.g. KitchenAid stand mixer"
            className={styles.input}
            disabled={isSaving}
          />
        </div>

        {/* Estimated value */}
        <div className={styles.fieldGroup}>
          <label htmlFor="item-edit-value" className={styles.label}>
            Estimated value{" "}
            <span className={styles.labelHint}>(optional)</span>
          </label>
          <div className={styles.valueRow}>
            <span className={styles.currencySymbol}>$</span>
            <input
              id="item-edit-value"
              type="number"
              min="0"
              step="0.01"
              value={estimatedValue}
              onChange={(e) => setEstimatedValue(e.target.value)}
              placeholder="0.00"
              className={styles.valueInput}
              disabled={isSaving}
            />
          </div>
        </div>

        {/* Notes / AI advice */}
        <div className={styles.fieldGroup}>
          <label htmlFor="item-edit-notes" className={styles.label}>
            Notes{" "}
            <span className={styles.labelHint}>(updates Aisling&apos;s suggestion)</span>
          </label>
          <textarea
            id="item-edit-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any notes about this item…"
            rows={4}
            className={styles.textarea}
            disabled={isSaving}
          />
        </div>

        {/* Box assignment — only for SHIP / CARRY items */}
        {showBoxField && shippingBoxes.length > 0 && (
          <div className={styles.fieldGroup}>
            <label htmlFor="item-edit-box" className={styles.label}>
              Assign to box{" "}
              <span className={styles.labelHint}>(optional)</span>
            </label>
            <select
              id="item-edit-box"
              value={boxId}
              onChange={(e) => setBoxId(e.target.value)}
              className={styles.select}
              disabled={isSaving}
            >
              <option value="">No box selected</option>
              {shippingBoxes.map((box) => (
                <option key={box.id} value={box.id}>
                  {box.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className={styles.errorBanner} role="alert">
            <p className={styles.errorText}>{error}</p>
          </div>
        )}

        {/* Success */}
        {success && (
          <div className={styles.successBanner} role="status">
            <p className={styles.successText}>Changes saved</p>
          </div>
        )}

        {/* Save button */}
        <button
          type="button"
          className={styles.saveButton}
          onClick={handleSave}
          disabled={isSaving || success}
        >
          {isSaving ? (
            <span className={styles.saveButtonInner}>
              <Spinner size="sm" />
              Saving...
            </span>
          ) : success ? (
            "Saved"
          ) : (
            "Save changes"
          )}
        </button>
      </div>
    </EditPanel>
  );
}
