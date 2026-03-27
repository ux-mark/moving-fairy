"use client";

import { useState, useCallback } from "react";

import { BoxList } from "@/components/boxes/BoxList";
import { LightAssessmentWarning } from "@/components/inventory/LightAssessmentWarning";
import type { FlaggedItem, ScanResult } from "@/components/boxes/BoxCard";
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

  // Sticker scan state
  const [scanningBoxes, setScanningBoxes] = useState<Set<string>>(new Set());
  const [scanResults, setScanResults] = useState<Record<string, ScanResult>>({});
  const [flaggedItemsByBox, setFlaggedItemsByBox] = useState<Record<string, FlaggedItem[]>>({});
  const [resolvingItemIds, setResolvingItemIds] = useState<Set<string>>(new Set());

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

  /**
   * Handle sticker photo selection: upload to storage, save to box, trigger scan.
   */
  const handleScanSticker = useCallback(async (boxId: string, file: File) => {
    setScanningBoxes((prev) => new Set([...prev, boxId]));
    setScanResults((prev) => ({
      ...prev,
      [boxId]: {
        status: "uploading",
        totalFound: 0,
        matchedCount: 0,
        newCount: 0,
        flaggedCount: 0,
        illegibleCount: 0,
      },
    }));

    try {
      // Step 1: Upload image to storage
      const formData = new FormData();
      formData.append("file", file);

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        throw new Error("Upload failed");
      }

      const { url } = await uploadRes.json();

      // Step 2: Save manifest_image_url to box record
      await fetch(`/api/boxes/${boxId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manifest_image_url: url }),
      });

      // Update local box state with new manifest URL
      setBoxes((prev) =>
        prev.map((b) => (b.id === boxId ? { ...b, manifest_image_url: url } : b))
      );

      // Step 3: Update scan status to processing
      setScanResults((prev) => ({
        ...prev,
        [boxId]: {
          status: "processing",
          totalFound: 0,
          matchedCount: 0,
          newCount: 0,
          flaggedCount: 0,
          illegibleCount: 0,
        },
      }));

      // Step 4: Fire scan endpoint (fire-and-forget — results come via Realtime or poll)
      await fetch(`/api/boxes/${boxId}/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manifest_image_url: url }),
      });
    } catch (err) {
      console.error("[scan sticker] Failed:", err);
      setScanResults((prev) => ({
        ...prev,
        [boxId]: {
          status: "error",
          totalFound: 0,
          matchedCount: 0,
          newCount: 0,
          flaggedCount: 0,
          illegibleCount: 0,
          errorMessage: "Could not upload the photo. Check your connection and try again.",
        },
      }));
    } finally {
      setScanningBoxes((prev) => {
        const next = new Set(prev);
        next.delete(boxId);
        return next;
      });
    }
  }, []);

  /**
   * Ship a flagged item anyway: override verdict to SHIP and add to box.
   */
  const handleShipAnyway = useCallback(async (itemId: string, boxId: string) => {
    setResolvingItemIds((prev) => new Set([...prev, itemId]));

    try {
      // Override verdict to SHIP
      const verdictRes = await fetch(`/api/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verdict: "SHIP" }),
      });

      if (!verdictRes.ok) throw new Error("Failed to update verdict");

      const updatedAssessment: ItemAssessment = await verdictRes.json();

      // Add item to box
      const addRes = await fetch(`/api/boxes/${boxId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_assessment_id: itemId }),
      });

      if (!addRes.ok) throw new Error("Failed to add item to box");

      const newBoxItem: BoxItem = await addRes.json();

      // Update local state: update assessment, add box item, remove from flagged
      setAssessments((prev) =>
        prev.map((a) => (a.id === itemId ? updatedAssessment : a))
      );
      setBoxItems((prev) => ({
        ...prev,
        [boxId]: [...(prev[boxId] ?? []), newBoxItem],
      }));
      setFlaggedItemsByBox((prev) => ({
        ...prev,
        [boxId]: (prev[boxId] ?? []).filter((f) => f.item_assessment_id !== itemId),
      }));
      // Update scan result flagged count
      setScanResults((prev) => {
        const current = prev[boxId];
        if (!current) return prev;
        return {
          ...prev,
          [boxId]: {
            ...current,
            flaggedCount: Math.max(0, current.flaggedCount - 1),
          },
        };
      });
    } catch (err) {
      console.error("[ship anyway] Failed:", err);
    } finally {
      setResolvingItemIds((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  }, []);

  /**
   * Remove a flagged item from the box (does not change verdict).
   */
  const handleRemoveFlaggedItem = useCallback(async (itemId: string, boxId: string) => {
    setResolvingItemIds((prev) => new Set([...prev, itemId]));

    try {
      // Find the box item record for this assessment
      const boxItem = boxItems[boxId]?.find((i) => i.item_assessment_id === itemId);
      if (!boxItem) {
        // Item may not be in the box yet (just flagged) — just remove from flagged list
        setFlaggedItemsByBox((prev) => ({
          ...prev,
          [boxId]: (prev[boxId] ?? []).filter((f) => f.item_assessment_id !== itemId),
        }));
        return;
      }

      const res = await fetch(`/api/boxes/${boxId}/items/${boxItem.id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to remove item from box");

      // Update local state
      setBoxItems((prev) => ({
        ...prev,
        [boxId]: (prev[boxId] ?? []).filter((i) => i.id !== boxItem.id),
      }));
      setFlaggedItemsByBox((prev) => ({
        ...prev,
        [boxId]: (prev[boxId] ?? []).filter((f) => f.item_assessment_id !== itemId),
      }));
      setScanResults((prev) => {
        const current = prev[boxId];
        if (!current) return prev;
        return {
          ...prev,
          [boxId]: {
            ...current,
            flaggedCount: Math.max(0, current.flaggedCount - 1),
          },
        };
      });
    } catch (err) {
      console.error("[remove flagged item] Failed:", err);
    } finally {
      setResolvingItemIds((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  }, [boxItems]);

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
        scanResults={scanResults}
        flaggedItemsByBox={flaggedItemsByBox}
        onScanSticker={handleScanSticker}
        onShipAnyway={handleShipAnyway}
        onRemoveFlaggedItem={handleRemoveFlaggedItem}
        scanningBoxes={scanningBoxes}
        resolvingItemIds={resolvingItemIds}
      />
    </div>
  );
}
