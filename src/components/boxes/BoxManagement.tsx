"use client";

import { useState, useCallback } from "react";

import { BoxList } from "@/components/boxes/BoxList";
import { LightAssessmentWarning } from "@/components/inventory/LightAssessmentWarning";
import type { Box, BoxItem, ItemAssessment } from "@/types";
import type { BoxSize, BoxType } from "@/lib/constants";

import styles from "./BoxManagement.module.css";

interface BoxManagementProps {
  initialBoxes: Box[];
  initialBoxItems: Record<string, BoxItem[]>;
  initialAssessments: ItemAssessment[];
}

interface ConfirmPayload {
  item_name: string;
  verdict: "SHIP" | "CARRY";
  flags: string[];
  advice_text: string;
  box_id: string | null;
  voltage_compatible: boolean;
  needs_transformer: boolean;
}

interface FlagMessage {
  flag: string;
  label: string;
  detail: string;
}

interface PendingWarning {
  warningCard: {
    title: string;
    message: string;
    item_name: string;
    box_id: string | null;
    actions: string[];
  };
  flagMessages: FlagMessage[];
  confirmPayload: ConfirmPayload;
  // What to add to local state on confirm
  boxId: string;
}

export function BoxManagement({
  initialBoxes,
  initialBoxItems,
  initialAssessments,
}: BoxManagementProps) {
  const [boxes, setBoxes] = useState(initialBoxes);
  const [boxItems, setBoxItems] = useState(initialBoxItems);
  const [assessments, setAssessments] = useState(initialAssessments);
  const [isCreating, setIsCreating] = useState(false);
  const [pendingWarning, setPendingWarning] = useState<PendingWarning | null>(null);

  const handleCreateBox = useCallback(
    async (data: {
      roomName: string;
      size: BoxSize;
      boxType: (typeof BoxType)[keyof typeof BoxType];
    }) => {
      setIsCreating(true);
      try {
        const res = await fetch("/api/boxes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            room_name: data.roomName,
            size: data.size,
            box_type: data.boxType,
          }),
        });

        if (!res.ok) throw new Error("Failed to create box");
        const json = await res.json();
        const newBox: Box = json.box ?? json;
        setBoxes((prev) => [...prev, newBox]);
        setBoxItems((prev) => ({ ...prev, [newBox.id]: [] }));
      } catch (err) {
        console.error("Failed to create box:", err);
      } finally {
        setIsCreating(false);
      }
    },
    []
  );

  /**
   * Run light assessment for an unassessed item being added to a box by name.
   * Used by BoxCard's inline "Add to this box" input.
   */
  const handleAddItem = useCallback(
    async (boxId: string, itemName: string) => {
      try {
        // Run light assessment first
        const assessRes = await fetch("/api/light-assessment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ item_name: itemName, box_id: boxId }),
        });

        if (!assessRes.ok) {
          // Fall back to direct add if assessment fails
          const res = await fetch(`/api/boxes/${boxId}/items`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ item_name: itemName }),
          });
          if (!res.ok) throw new Error("Failed to add item");
          const newItem: BoxItem = await res.json();
          setBoxItems((prev) => ({
            ...prev,
            [boxId]: [...(prev[boxId] ?? []), newItem],
          }));
          return;
        }

        const assessData = await assessRes.json();

        if (assessData.verdict === "BLOCKED") {
          // Item is blocked — do not add, surface reason
          console.warn("[light-assessment] item blocked:", assessData.reason);
          // TODO: surface to user in a future pass
          return;
        }

        if (assessData.needs_confirmation && assessData.warning_card) {
          // Hold the warning — wait for user to confirm or dismiss
          setPendingWarning({
            warningCard: assessData.warning_card,
            flagMessages: assessData.flag_messages ?? [],
            confirmPayload: assessData.confirm_payload,
            boxId,
          });
          return;
        }

        // Clean — item was saved and added to box by the light-assessment endpoint.
        // Use the returned box_item and assessment to update local state.
        if (assessData.assessment) {
          setAssessments((prev) => [...prev, assessData.assessment as ItemAssessment]);
        }
        if (assessData.box_item) {
          setBoxItems((prev) => ({
            ...prev,
            [boxId]: [...(prev[boxId] ?? []), assessData.box_item as BoxItem],
          }));
        }
      } catch (err) {
        console.error("Failed to add item:", err);
      }
    },
    []
  );

  const handleRemoveItem = useCallback(
    async (boxId: string, boxItemId: string) => {
      try {
        const res = await fetch(`/api/boxes/${boxId}/items/${boxItemId}`, {
          method: "DELETE",
        });

        if (!res.ok) throw new Error("Failed to remove item");
        setBoxItems((prev) => ({
          ...prev,
          [boxId]: (prev[boxId] ?? []).filter((i) => i.id !== boxItemId),
        }));
      } catch (err) {
        console.error("Failed to remove item:", err);
      }
    },
    []
  );

  const handleMarkPacked = useCallback(async (boxId: string) => {
    try {
      const res = await fetch(`/api/boxes/${boxId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "packed" }),
      });

      if (!res.ok) throw new Error("Failed to update box status");
      const updatedBox: Box = await res.json();
      setBoxes((prev) =>
        prev.map((b) => (b.id === boxId ? updatedBox : b))
      );
    } catch (err) {
      console.error("Failed to mark box as packed:", err);
    }
  }, []);

  const handleAddToBox = useCallback(
    async (itemAssessmentId: string, boxId: string) => {
      try {
        const res = await fetch(`/api/boxes/${boxId}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ item_assessment_id: itemAssessmentId }),
        });

        if (!res.ok) throw new Error("Failed to add item to box");
        const newItem: BoxItem = await res.json();
        setBoxItems((prev) => ({
          ...prev,
          [boxId]: [...(prev[boxId] ?? []), newItem],
        }));
      } catch (err) {
        console.error("Failed to add item to box:", err);
      }
    },
    []
  );

  const handleUpdateBox = useCallback(
    async (boxId: string, updates: { label?: string; size?: string }) => {
      try {
        const res = await fetch(`/api/boxes/${boxId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });

        if (!res.ok) throw new Error("Failed to update box");
        const updatedBox: Box = await res.json();
        setBoxes((prev) =>
          prev.map((b) => (b.id === boxId ? updatedBox : b))
        );
      } catch (err) {
        console.error("Failed to update box:", err);
      }
    },
    []
  );

  const handleShipAll = useCallback(async () => {
    try {
      const res = await fetch("/api/boxes/ship-all", { method: "POST" });
      if (!res.ok) throw new Error("Failed to ship all");

      // Update all packing/packed boxes to shipped
      setBoxes((prev) =>
        prev.map((b) =>
          b.status === "packing" || b.status === "packed"
            ? { ...b, status: "shipped" as const }
            : b
        )
      );
    } catch (err) {
      console.error("Failed to ship all:", err);
    }
  }, []);

  const handleWarningConfirm = useCallback(
    async (payload: ConfirmPayload) => {
      if (!pendingWarning) return;
      const { boxId } = pendingWarning;

      try {
        const res = await fetch("/api/light-assessment/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) throw new Error("Failed to confirm assessment");
        const data = await res.json();

        if (data.assessment) {
          setAssessments((prev) => [...prev, data.assessment as ItemAssessment]);
        }
        if (data.box_item) {
          setBoxItems((prev) => ({
            ...prev,
            [boxId]: [...(prev[boxId] ?? []), data.box_item as BoxItem],
          }));
        }
      } catch (err) {
        console.error("Failed to confirm light assessment:", err);
      } finally {
        setPendingWarning(null);
      }
    },
    [pendingWarning]
  );

  const handleWarningDismiss = useCallback(() => {
    setPendingWarning(null);
  }, []);

  return (
    <div className={styles.container}>
      {pendingWarning && (
        <LightAssessmentWarning
          warningCard={pendingWarning.warningCard}
          flagMessages={pendingWarning.flagMessages}
          confirmPayload={pendingWarning.confirmPayload}
          onConfirm={handleWarningConfirm}
          onDismiss={handleWarningDismiss}
        />
      )}

      <BoxList
        boxes={boxes}
        boxItems={boxItems}
        assessments={assessments}
        onCreateBox={handleCreateBox}
        onAddItem={handleAddItem}
        onRemoveItem={handleRemoveItem}
        onMarkPacked={handleMarkPacked}
        onAddToBox={handleAddToBox}
        onUpdateBox={handleUpdateBox}
        onShipAll={handleShipAll}
        isCreating={isCreating}
      />
    </div>
  );
}
