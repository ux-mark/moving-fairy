"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, Package, Settings, Sparkles } from "lucide-react";
import { Navigation } from "@thefairies/design-system/components";

import { SignOutButton } from "@/components/auth/SignOutButton";
import { CostSummary } from "@/components/inventory/CostSummary";
import { DecisionNotificationTab } from "@/components/inventory/DecisionNotificationTab";
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

/**
 * AppLayout provides the app shell: Navigation at the top, chat as the main
 * content, and a toggleable right-side panel for inventory (desktop) or
 * full-screen overlay (mobile).
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

  // Resize state
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
        setActiveSection("chat");
      } else if (section === "inventory") {
        setInventoryOpen(true);
        setActiveSection("inventory");
      } else if (section === "settings") {
        setProfileOpen(true);
      }
    },
    []
  );

  // Total items for mobile cost strip
  const totalItems = costSummary
    ? Object.values(costSummary.counts_by_verdict).reduce((sum, n) => sum + n, 0)
    : 0;
  const hasCostData = totalItems > 0;

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

      {/* Mobile cost summary strip — only visible when there are assessed items */}
      {hasCostData && (
        <div className={styles.costStrip}>
          <CostSummary data={costSummary!} variant="compact" />
          <SignOutButton />
        </div>
      )}

      {/* Main body — chat + optional inventory panel */}
      <div className={styles.body}>
        {/* Chat — primary content */}
        <main id="main-content" className={styles.chatMain}>
          {chatPanel}
        </main>

        {/* Inventory side panel — desktop: right panel; mobile: full-screen overlay */}
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

        {/* Mobile backdrop when inventory is open */}
        {inventoryOpen && (
          <div
            className={styles.mobileBackdrop}
            onClick={() => setInventoryOpen(false)}
            aria-hidden="true"
          />
        )}
      </div>

      {/* Decision notification tab — right edge, visible when pending decisions exist */}
      <DecisionNotificationTab
        count={decisionCount}
        onClick={() => {
          setInventoryOpen(true);
          setActiveSection("inventory");
          onOpenDecisions?.();
        }}
      />
    </div>
  );
}
