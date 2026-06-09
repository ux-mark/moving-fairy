"use client";

/**
 * Pointer-based packing drag-and-drop.
 *
 * Replaces the native HTML5 Drag-and-Drop gesture (which gave a browser-owned,
 * flickering drag image and `dragenter`/`dragleave` flutter) with a pointer-event
 * implementation built for smoothness:
 *
 *  - A single floating "carry" chip is rendered in a portal on `document.body`.
 *    Its position is driven by an imperative ref writing `transform: translate3d`
 *    on each rAF-throttled `pointermove` — it never flows through React state, so
 *    there is no per-move re-render and no jank.
 *  - Only ONE piece of React state changes during a drag: `hoveredBoxId`, and only
 *    when the box under the pointer actually changes. The board stays calm; just the
 *    hovered card lights up.
 *  - Hit-testing is `document.elementFromPoint` → nearest `[data-droppable-box-id]`.
 *
 * Boxes register themselves as drop targets by rendering `data-droppable-box-id`
 * and reading `useDroppableBox(boxId)` for the live "is this the hovered target"
 * flag. The drag source (`UnboxedItems` rows) calls `beginDrag` on pointerdown
 * past a small move threshold.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useReducedMotion } from "framer-motion";

import styles from "./PackingDrag.module.css";

const DROPPABLE_ATTR = "data-droppable-box-id";
/** Pointer travel (px) before a press becomes a drag rather than a click. */
const DRAG_THRESHOLD = 6;
/** Chip offset from the pointer so it reads as "carried" just below-right. */
const CHIP_OFFSET_X = 14;
const CHIP_OFFSET_Y = 16;

export interface DragPayload {
  /** Assessment ids being carried. */
  ids: string[];
  /** Chip label — the item name, or "{N} items" for a multi-drag. */
  label: string;
}

interface BeginDragArgs extends DragPayload {
  /** The originating pointer event (used to seed position + capture). */
  event: React.PointerEvent;
  /** Called with the target box id when the drag ends over a valid box. */
  onDrop: (boxId: string) => void;
}

interface PackingDragContextValue {
  beginDrag: (args: BeginDragArgs) => void;
  /** Box id currently under the pointer during a drag, else null. */
  hoveredBoxId: string | null;
  /** Assessment ids currently being dragged (for source dimming), else null. */
  draggingIds: string[] | null;
}

const PackingDragContext = createContext<PackingDragContextValue | null>(null);

export function usePackingDrag(): PackingDragContextValue {
  const ctx = useContext(PackingDragContext);
  if (!ctx) {
    throw new Error("usePackingDrag must be used within a PackingDragProvider");
  }
  return ctx;
}

/**
 * True while `boxId` is the box under the pointer during an active drag.
 * Tolerates being called outside a provider (returns false) so cards rendered
 * in non-drag contexts (e.g. the box detail drawer) don't need the provider.
 */
export function useDroppableBox(boxId: string | undefined): boolean {
  const ctx = useContext(PackingDragContext);
  if (!ctx || !boxId) return false;
  return ctx.hoveredBoxId === boxId;
}

/** True while any of `ids` is part of the in-flight drag (drives source dim). */
export function useIsDragging(ids: string[]): boolean {
  const { draggingIds } = usePackingDrag();
  if (!draggingIds) return false;
  return ids.some((id) => draggingIds.includes(id));
}

export function PackingDragProvider({ children }: { children: ReactNode }) {
  const prefersReducedMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  // The two pieces of state that DO drive React renders. `dragLabel`/`dragIds`
  // are set once at begin and cleared once at end; `hoveredBoxId` changes only
  // when the box under the pointer changes — never on every move.
  const [dragIds, setDragIds] = useState<string[] | null>(null);
  const [dragLabel, setDragLabel] = useState("");
  const [hoveredBoxId, setHoveredBoxId] = useState<string | null>(null);

  // Imperative refs — the follow position never round-trips through React.
  const chipRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const latestPoint = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const hoveredRef = useRef<string | null>(null);
  const onDropRef = useRef<((boxId: string) => void) | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const captureElRef = useRef<Element | null>(null);
  const activeRef = useRef(false);

  useEffect(() => setMounted(true), []);

  const writeChipPosition = useCallback(() => {
    rafRef.current = null;
    const chip = chipRef.current;
    if (!chip) return;
    const { x, y } = latestPoint.current;
    chip.style.transform = `translate3d(${x + CHIP_OFFSET_X}px, ${
      y + CHIP_OFFSET_Y
    }px, 0)`;
  }, []);

  const scheduleChipWrite = useCallback(() => {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(writeChipPosition);
  }, [writeChipPosition]);

  const findBoxUnderPoint = useCallback((x: number, y: number): string | null => {
    const el = document.elementFromPoint(x, y);
    if (!el) return null;
    const target = el.closest(`[${DROPPABLE_ATTR}]`);
    return target?.getAttribute(DROPPABLE_ATTR) ?? null;
  }, []);

  const endDrag = useCallback(
    (commit: boolean) => {
      if (!activeRef.current) return;
      activeRef.current = false;

      const dropBoxId = hoveredRef.current;
      const onDrop = onDropRef.current;

      // Release pointer capture if we grabbed it.
      const captureEl = captureElRef.current;
      const pid = pointerIdRef.current;
      if (
        captureEl &&
        pid != null &&
        "releasePointerCapture" in captureEl &&
        (captureEl as Element & { hasPointerCapture?: (id: number) => boolean })
          .hasPointerCapture?.(pid)
      ) {
        try {
          (captureEl as Element & { releasePointerCapture: (id: number) => void })
            .releasePointerCapture(pid);
        } catch {
          /* capture may already be gone — safe to ignore */
        }
      }

      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);

      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }

      onDropRef.current = null;
      pointerIdRef.current = null;
      captureElRef.current = null;
      hoveredRef.current = null;

      setHoveredBoxId(null);
      setDragIds(null);
      setDragLabel("");

      if (commit && dropBoxId && onDrop) {
        onDrop(dropBoxId);
      }
    },
    // handlers referenced below are stable (defined with useCallback). They are
    // declared after this; we attach via the refs at begin time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!activeRef.current) return;
      latestPoint.current = { x: e.clientX, y: e.clientY };
      scheduleChipWrite();

      const boxId = findBoxUnderPoint(e.clientX, e.clientY);
      if (boxId !== hoveredRef.current) {
        hoveredRef.current = boxId;
        setHoveredBoxId(boxId); // only when the hovered box actually changes
      }
    },
    [scheduleChipWrite, findBoxUnderPoint],
  );

  const handlePointerUp = useCallback(() => endDrag(true), [endDrag]);
  const handlePointerCancel = useCallback(() => endDrag(false), [endDrag]);

  const beginDrag = useCallback(
    ({ ids, label, event, onDrop }: BeginDragArgs) => {
      if (activeRef.current || ids.length === 0) return;
      activeRef.current = true;

      onDropRef.current = onDrop;
      hoveredRef.current = null;
      latestPoint.current = { x: event.clientX, y: event.clientY };

      // Capture the pointer so the gesture survives even if the cursor leaves the
      // source row — the chip keeps following and drops resolve reliably.
      const el = event.currentTarget as Element;
      pointerIdRef.current = event.pointerId;
      captureElRef.current = el;
      try {
        (el as Element & { setPointerCapture: (id: number) => void }).setPointerCapture(
          event.pointerId,
        );
      } catch {
        /* setPointerCapture can throw if the pointer is gone — gesture still works */
      }

      setDragIds(ids);
      setDragLabel(label);

      // Seed the chip position before first paint so it appears at the pointer,
      // not at the origin.
      scheduleChipWrite();

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
      window.addEventListener("pointercancel", handlePointerCancel);
    },
    [scheduleChipWrite, handlePointerMove, handlePointerUp, handlePointerCancel],
  );

  // Belt-and-braces cleanup if the provider unmounts mid-drag.
  useEffect(() => {
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [handlePointerMove, handlePointerUp, handlePointerCancel]);

  const value = useMemo<PackingDragContextValue>(
    () => ({ beginDrag, hoveredBoxId, draggingIds: dragIds }),
    [beginDrag, hoveredBoxId, dragIds],
  );

  const isMulti = (dragIds?.length ?? 0) > 1;

  return (
    <PackingDragContext.Provider value={value}>
      {children}
      {mounted &&
        dragIds &&
        createPortal(
          <div
            ref={chipRef}
            className={styles.chip}
            data-reduced-motion={prefersReducedMotion ? "true" : "false"}
            aria-hidden="true"
          >
            <span className={styles.chipLabel}>{dragLabel}</span>
            {isMulti && (
              <span className={styles.chipBadge}>{dragIds.length}</span>
            )}
          </div>,
          document.body,
        )}
    </PackingDragContext.Provider>
  );
}

export { DRAG_THRESHOLD };
