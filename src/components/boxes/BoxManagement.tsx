"use client";

import { useState, useCallback } from "react";

import { BoxList } from "@/components/boxes/BoxList";
import type { Box, BoxItem, ItemAssessment } from "@/types";
import type { BoxSize, BoxType } from "@/lib/constants";

interface BoxManagementProps {
  initialBoxes: Box[];
  initialBoxItems: Record<string, BoxItem[]>;
  initialAssessments: ItemAssessment[];
}

export function BoxManagement({
  initialBoxes,
  initialBoxItems,
  initialAssessments,
}: BoxManagementProps) {
  const [boxes, setBoxes] = useState(initialBoxes);
  const [boxItems, setBoxItems] = useState(initialBoxItems);
  const [assessments] = useState(initialAssessments);
  const [isCreating, setIsCreating] = useState(false);

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

  const handleAddItem = useCallback(
    async (boxId: string, itemName: string) => {
      try {
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

  return (
    <BoxList
      boxes={boxes}
      boxItems={boxItems}
      assessments={assessments}
      onCreateBox={handleCreateBox}
      onAddItem={handleAddItem}
      onRemoveItem={handleRemoveItem}
      onMarkPacked={handleMarkPacked}
      onAddToBox={handleAddToBox}
      onShipAll={handleShipAll}
      isCreating={isCreating}
    />
  );
}
