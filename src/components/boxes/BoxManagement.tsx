"use client";

import { useState, useCallback, useEffect, useMemo } from "react";

import { BoxList } from "@/components/boxes/BoxList";
import { LightAssessmentWarning } from "@/components/inventory/LightAssessmentWarning";
import { PackingToast } from "@/components/boxes/PackingToast";
import type { FlaggedItem, ScanResult } from "@/components/boxes/BoxCard";
import type { Box, BoxItem, ItemAssessment } from "@/types";
import { BoxStatus, type BoxSize, type BoxType } from "@/lib/constants";
import { ownerCopy } from "@/lib/copy/owner";

import styles from "./BoxManagement.module.css";

const ACTIVE_BOX_STORAGE_KEY = "mf_active_box";

interface ToastState {
  message: string;
  /** Optional undo action — when present an Undo button is shown. */
  onUndo?: () => void;
  variant: "success" | "error";
}

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

  // Active "packing into" box — the default target for new items.
  const [activeBoxId, setActiveBoxId] = useState<string | null>(null);
  // Transient toast (add confirmation + undo, biosec mark, errors).
  const [toast, setToast] = useState<ToastState | null>(null);

  const packingBoxes = useMemo(
    () => boxes.filter((b) => b.status === BoxStatus.PACKING),
    [boxes],
  );

  // Smart default + persistence for the active box. Runs on mount and whenever
  // the set of packing boxes changes. Reads sessionStorage on first run.
  useEffect(() => {
    setActiveBoxId((current) => {
      const isValid = (id: string | null): id is string =>
        !!id && packingBoxes.some((b) => b.id === id);

      if (isValid(current)) return current;

      // Try the persisted id before falling back to the smart default.
      if (typeof window !== "undefined") {
        const stored = window.sessionStorage.getItem(ACTIVE_BOX_STORAGE_KEY);
        if (isValid(stored)) return stored;
      }

      if (packingBoxes.length === 0) return null;

      // Most-recently-updated packing box.
      const mostRecent = [...packingBoxes].sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      )[0];
      return mostRecent ? mostRecent.id : null;
    });
  }, [packingBoxes]);

  // Mirror the active box to sessionStorage so reloads remember it.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (activeBoxId) {
      window.sessionStorage.setItem(ACTIVE_BOX_STORAGE_KEY, activeBoxId);
    } else {
      window.sessionStorage.removeItem(ACTIVE_BOX_STORAGE_KEY);
    }
  }, [activeBoxId]);

  // Auto-dismiss the toast after 3s.
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const handleMarkBiosecurity = useCallback(
    async (boxId: string) => {
      const box = boxes.find((b) => b.id === boxId);
      // Optimistic: flip the flag locally, surface a toast.
      setBoxes((prev) =>
        prev.map((b) => (b.id === boxId ? { ...b, is_biosecurity: true } : b)),
      );
      if (box) {
        setToast({
          message: ownerCopy.packing.biosecMarkedToast(box.label),
          variant: "success",
        });
      }
      try {
        const res = await fetch(`/api/boxes/${boxId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_biosecurity: true }),
        });
        if (!res.ok) throw new Error("Failed to mark box as biosecurity");
        const updatedBox: Box = await res.json();
        setBoxes((prev) => prev.map((b) => (b.id === boxId ? updatedBox : b)));
      } catch (err) {
        console.error("Failed to mark box as biosecurity:", err);
        // Roll back.
        setBoxes((prev) =>
          prev.map((b) => (b.id === boxId ? { ...b, is_biosecurity: false } : b)),
        );
        setToast({ message: ownerCopy.itinerary.saveError, variant: "error" });
      }
    },
    [boxes],
  );

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

  // Core add: POSTs a single assessment to a box, updates local state, and
  // returns the created BoxItem (or null on failure). No toast — callers decide.
  const addOneToBox = useCallback(
    async (itemAssessmentId: string, boxId: string): Promise<BoxItem | null> => {
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
        return newItem;
      } catch (err) {
        console.error("Failed to add item to box:", err);
        return null;
      }
    },
    []
  );

  // Single add (mobile tap, combobox, drag of one item) — toast + undo.
  const handleAddToBox = useCallback(
    async (itemAssessmentId: string, boxId: string) => {
      const assessment = assessments.find((a) => a.id === itemAssessmentId);
      const box = boxes.find((b) => b.id === boxId);
      const newItem = await addOneToBox(itemAssessmentId, boxId);
      if (!newItem) {
        setToast({
          message: ownerCopy.packing.addErrorToast(assessment?.item_name ?? "item"),
          variant: "error",
        });
        return;
      }
      setToast({
        message: ownerCopy.packing.addedToast(
          assessment?.item_name ?? "item",
          box?.label ?? "box",
        ),
        variant: "success",
        onUndo: () => handleRemoveItem(boxId, newItem.id),
      });
    },
    [addOneToBox, assessments, boxes, handleRemoveItem]
  );

  // Batch add (desktop multi-select, drag of a selection) — one summary toast.
  const handleAddManyToBox = useCallback(
    async (itemAssessmentIds: string[], boxId: string) => {
      const box = boxes.find((b) => b.id === boxId);
      const results = await Promise.all(
        itemAssessmentIds.map((id) => addOneToBox(id, boxId)),
      );
      const added = results.filter((r): r is BoxItem => r !== null);
      const failed = results.length - added.length;

      if (failed === 0) {
        setToast({
          message: ownerCopy.packing.addedManyToast(added.length, box?.label ?? "box"),
          variant: "success",
          onUndo: () => {
            for (const item of added) handleRemoveItem(boxId, item.id);
          },
        });
      } else {
        setToast({
          message: ownerCopy.packing.addedPartialToast(
            added.length,
            results.length,
            failed,
          ),
          variant: "error",
          ...(added.length > 0
            ? {
                onUndo: () => {
                  for (const item of added) handleRemoveItem(boxId, item.id);
                },
              }
            : {}),
        });
      }
      return { addedCount: added.length, failedCount: failed };
    },
    [addOneToBox, boxes, handleRemoveItem]
  );

  const handleUpdateBox = useCallback(
    async (
      boxId: string,
      updates: { label?: string; room_name?: string; room_code?: string; size?: string; is_biosecurity?: boolean },
    ) => {
      try {
        const res = await fetch(`/api/boxes/${boxId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });

        if (!res.ok) {
          // Surface the server message (e.g. a code collision) to the user.
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(data?.error ?? "Failed to update box");
        }

        // A room_code edit is room-wide and returns every relabelled box.
        if (updates.room_code !== undefined) {
          const { boxes: updated } = (await res.json()) as { boxes: Box[] };
          setBoxes((prev) =>
            prev.map((b) => updated.find((u) => u.id === b.id) ?? b),
          );
          return;
        }

        const updatedBox: Box = await res.json();
        setBoxes((prev) =>
          prev.map((b) => (b.id === boxId ? updatedBox : b))
        );
      } catch (err) {
        console.error("Failed to update box:", err);
        const message = err instanceof Error ? err.message : ownerCopy.itinerary.saveError;
        setToast({ message, variant: "error" });
      }
    },
    []
  );

  // Manual renumber. The server returns 1 box, or 2 when a swap happened
  // (the target box and the box it traded numbers with).
  const handleRenumberBox = useCallback(async (boxId: string, newNumber: number) => {
    try {
      const res = await fetch(`/api/boxes/${boxId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ box_number: newNumber }),
      });
      if (!res.ok) throw new Error("Failed to renumber box");
      const { boxes: updated } = (await res.json()) as { boxes: Box[] };
      setBoxes((prev) =>
        prev.map((b) => updated.find((u) => u.id === b.id) ?? b),
      );
    } catch (err) {
      console.error("Failed to renumber box:", err);
      setToast({ message: ownerCopy.itinerary.saveError, variant: "error" });
    }
  }, []);

  const handlePackAll = useCallback(async () => {
    try {
      const res = await fetch("/api/boxes/pack-all", { method: "POST" });
      if (!res.ok) throw new Error("Failed to pack all");

      // Move every box still being packed to packed.
      setBoxes((prev) =>
        prev.map((b) =>
          b.status === "packing" ? { ...b, status: "packed" as const } : b
        )
      );
    } catch (err) {
      console.error("Failed to pack all:", err);
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
        onAddManyToBox={handleAddManyToBox}
        onUpdateBox={handleUpdateBox}
        onPackAll={handlePackAll}
        isCreating={isCreating}
        scanResults={scanResults}
        flaggedItemsByBox={flaggedItemsByBox}
        onScanSticker={handleScanSticker}
        onShipAnyway={handleShipAnyway}
        onRemoveFlaggedItem={handleRemoveFlaggedItem}
        scanningBoxes={scanningBoxes}
        resolvingItemIds={resolvingItemIds}
        activeBoxId={activeBoxId}
        onSetActiveBox={setActiveBoxId}
        onMarkBiosecurity={handleMarkBiosecurity}
        onRenumberBox={handleRenumberBox}
      />

      {toast && (
        <PackingToast
          message={toast.message}
          variant={toast.variant}
          {...(toast.onUndo ? { onUndo: toast.onUndo } : {})}
          onDismiss={() => setToast(null)}
        />
      )}
    </div>
  );
}
