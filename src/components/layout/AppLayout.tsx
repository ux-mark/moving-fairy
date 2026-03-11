"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, Package, Settings, Sparkles, X } from "lucide-react";
import { Navigation } from "@thefairies/design-system/components";

import { SignOutButton } from "@/components/auth/SignOutButton";
import { CostSummary } from "@/components/inventory/CostSummary";
import { DecisionNotificationTab } from "@/components/inventory/DecisionNotificationTab";
import { InventoryPreview } from "@/components/inventory/InventoryPreview";
import { ProfileEditPanel } from "@/components/profile/ProfileEditPanel";
import { useInventory } from "@/lib/hooks/useInventory";

import styles from "./AppLayout.module.css";

interface AppLayoutProps {
  chatPanel: React.ReactNode;
  inventoryPanel: React.ReactNode;
  decisionCount?: number;
  onOpenDecisions?: () => void;
}

const NAV_PRIMARY_ITEMS = [
  { key: "chat", label: "Aisling", icon: MessageCircle },
  { key: "inventory", label: "Inventory", icon: Package },
];

const NAV_SECONDARY_ITEMS = [
  { key: "settings", label: "Settings", icon: Settings },
];

/** Snap points for the mobile bottom sheet (percentage of viewport height) */
const SNAP_HALF = 50;
const SNAP_FULL = 95;
/** If dragged below this threshold, dismiss the sheet */
const DISMISS_THRESHOLD = 30;
/** Minimum touch travel (px) before we consider it a drag — prevents accidental triggers */
const MIN_DRAG_DISTANCE = 40;

/**
 * AppLayout provides the app shell: Navigation at the top, chat as the main
 * content, and a toggleable right-side panel for inventory (desktop) or
 * a half-sheet bottom panel (mobile).
 */
export function AppLayout({ chatPanel, inventoryPanel, decisionCount = 0, onOpenDecisions }: AppLayoutProps) {
  const [inventoryOpen, setInventoryOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.innerWidth > 768;
  });
  const [inventoryWidth, setInventoryWidth] = useState(380);
  const [activeSection, setActiveSection] = useState("chat");
  const [profileOpen, setProfileOpen] = useState(false);
  const { costSummary, refreshInventory } = useInventory();

  // Mobile bottom sheet state
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [sheetHeightVh, setSheetHeightVh] = useState(SNAP_HALF);

  // Touch drag refs for bottom sheet
  const dragStartYRef = useRef(0);
  const dragStartHeightRef = useRef(SNAP_HALF);
  const isDraggingRef = useRef(false);
  const hasDraggedRef = useRef(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Resize state (desktop)
  const isResizingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(inventoryWidth);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isResizingRef.current = true;
      startXRef.current = e.clientX;
      startWidthRef.current = inventoryWidth;
    },
    [inventoryWidth]
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;
      const delta = startXRef.current - e.clientX;
      const maxWidth = window.innerWidth * 0.5;
      const newWidth = Math.max(320, Math.min(maxWidth, startWidthRef.current + delta));
      setInventoryWidth(newWidth);
    };
    const handleMouseUp = () => {
      isResizingRef.current = false;
    };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const handleNavigate = useCallback(
    (section: string) => {
      if (section === "chat") {
        setInventoryOpen(false);
        setMobileSheetOpen(false);
        setActiveSection("chat");
      } else if (section === "inventory") {
        setInventoryOpen(true);
        setActiveSection("inventory");
        // On mobile, open the bottom sheet
        if (typeof window !== "undefined" && window.innerWidth < 768) {
          setMobileSheetOpen(true);
          setSheetHeightVh(SNAP_HALF);
        }
      } else if (section === "settings") {
        setProfileOpen(true);
      }
    },
    []
  );

  // Total items for preview strip
  const totalItems = costSummary
    ? Object.values(costSummary.counts_by_verdict).reduce((sum, n) => sum + n, 0)
    : 0;
  const hasCostData = totalItems > 0;

  // Mobile bottom sheet: open
  const openMobileSheet = useCallback(() => {
    setMobileSheetOpen(true);
    setSheetHeightVh(SNAP_HALF);
    setActiveSection("inventory");
  }, []);

  // Mobile bottom sheet: close
  const closeMobileSheet = useCallback(() => {
    setMobileSheetOpen(false);
    setSheetHeightVh(SNAP_HALF);
  }, []);

  // Touch handlers for the drag handle
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    dragStartYRef.current = touch.clientY;
    dragStartHeightRef.current = sheetHeightVh;
    isDraggingRef.current = true;
    hasDraggedRef.current = false;
  }, [sheetHeightVh]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDraggingRef.current) return;

    const touch = e.touches[0];
    if (!touch) return;
    const deltaY = dragStartYRef.current - touch.clientY;
    const totalTravel = Math.abs(deltaY);

    // Don't start adjusting height until we've moved past the minimum drag distance
    if (!hasDraggedRef.current && totalTravel < MIN_DRAG_DISTANCE) {
      return;
    }
    hasDraggedRef.current = true;

    // Convert pixel delta to vh
    const deltaVh = (deltaY / window.innerHeight) * 100;
    const newHeight = Math.max(10, Math.min(SNAP_FULL, dragStartHeightRef.current + deltaVh));

    // Apply immediately for responsive feel (bypass React state for perf)
    if (sheetRef.current) {
      sheetRef.current.style.height = `${newHeight}vh`;
    }
    // Store for snap calculation on touch end
    dragStartYRef.current = touch.clientY;
    dragStartHeightRef.current = newHeight;
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;

    const currentHeight = dragStartHeightRef.current;

    if (currentHeight < DISMISS_THRESHOLD) {
      // Dismiss
      closeMobileSheet();
      return;
    }

    // Snap to nearest point
    const distToHalf = Math.abs(currentHeight - SNAP_HALF);
    const distToFull = Math.abs(currentHeight - SNAP_FULL);
    const snapTo = distToHalf < distToFull ? SNAP_HALF : SNAP_FULL;

    setSheetHeightVh(snapTo);
    if (sheetRef.current) {
      sheetRef.current.style.height = `${snapTo}vh`;
    }
  }, [closeMobileSheet]);

  // Reset sheet height when opening
  useEffect(() => {
    if (mobileSheetOpen && sheetRef.current) {
      sheetRef.current.style.height = `${sheetHeightVh}vh`;
    }
  }, [mobileSheetOpen, sheetHeightVh]);

  return (
    <div className={styles.root}>
      {/* Skip navigation link */}
      <a href="#main-content" className={styles.skipNav}>
        Skip to main content
      </a>

      {/* Profile edit panel */}
      <ProfileEditPanel
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        onSaved={refreshInventory}
      />

      {/* DS Navigation */}
      <Navigation
        brandName="Moving Fairy"
        brandIcon={<Sparkles size={20} strokeWidth={1.8} />}
        activeSection={activeSection}
        onNavigate={handleNavigate}
        primaryItems={NAV_PRIMARY_ITEMS}
        secondaryItems={NAV_SECONDARY_ITEMS}
      />

      {/* Mobile: inventory preview strip (replaces old cost strip on mobile) */}
      {hasCostData && (
        <>
          {/* Desktop cost strip — hidden on mobile by InventoryPreview's own media query */}
          <div className={styles.costStrip}>
            <CostSummary data={costSummary!} variant="compact" />
            <SignOutButton />
          </div>

          {/* Mobile preview strip — hidden on desktop via its own CSS */}
          <InventoryPreview
            itemCount={totalItems}
            estimatedCost={costSummary!.total_estimated_ship_cost}
            currency={costSummary!.currency}
            onExpand={openMobileSheet}
          />
        </>
      )}

      {/* Main body — chat + optional inventory panel */}
      <div className={styles.body}>
        {/* Chat — primary content */}
        <main id="main-content" className={styles.chatMain}>
          {chatPanel}
        </main>

        {/* Desktop: inventory side panel */}
        {inventoryOpen && (
          <aside
            className={styles.inventoryPanel}
            style={{ width: inventoryWidth }}
            aria-label="Inventory"
          >
            <div
              className={styles.resizeHandle}
              onMouseDown={handleResizeStart}
              aria-hidden="true"
            >
              <div className={styles.resizeLine} />
              <div className={styles.resizeGrip}>
                <span className={styles.resizeGripLine} />
              </div>
            </div>
            <div className={styles.inventoryContent}>
              {inventoryPanel}
            </div>
          </aside>
        )}
      </div>

      {/* Mobile: bottom sheet backdrop */}
      {mobileSheetOpen && (
        <div
          className={styles.bottomSheetBackdrop}
          onClick={closeMobileSheet}
          aria-hidden="true"
        />
      )}

      {/* Mobile: bottom sheet */}
      <div
        ref={sheetRef}
        className={`${styles.bottomSheet} ${!mobileSheetOpen ? styles.bottomSheetHidden : ""}`}
        style={{ height: `${sheetHeightVh}vh` }}
        role="dialog"
        aria-label="Inventory panel"
        aria-modal="true"
      >
        {/* Drag handle */}
        <div
          className={styles.dragHandle}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          aria-hidden="true"
        >
          <div className={styles.dragBar} />
        </div>

        {/* Close button */}
        <div className={styles.bottomSheetHeader}>
          <button
            type="button"
            className={styles.bottomSheetClose}
            onClick={closeMobileSheet}
            aria-label="Close inventory"
          >
            <X size={20} />
          </button>
        </div>

        {/* Sheet content — reuses the same inventory panel */}
        <div className={styles.bottomSheetContent}>
          {mobileSheetOpen && inventoryPanel}
        </div>
      </div>

      {/* Decision notification tab — right edge, visible when pending decisions exist */}
      <DecisionNotificationTab
        count={decisionCount}
        onClick={() => {
          setInventoryOpen(true);
          setActiveSection("inventory");
          // On mobile, open the bottom sheet instead
          if (typeof window !== "undefined" && window.innerWidth < 768) {
            setMobileSheetOpen(true);
            setSheetHeightVh(SNAP_HALF);
          }
          onOpenDecisions?.();
        }}
      />
    </div>
  );
}
