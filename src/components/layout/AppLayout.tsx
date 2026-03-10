"use client";

import { useState } from "react";
import { Settings } from "lucide-react";
import { Button } from "@thefairies/design-system/components";

import { SignOutButton } from "@/components/auth/SignOutButton";
import {
  BottomTabBar,
  type ActiveTab,
} from "@/components/layout/BottomTabBar";
import { CostSummary } from "@/components/inventory/CostSummary";
import { ProfileEditPanel } from "@/components/profile/ProfileEditPanel";
import { useInventory } from "@/lib/hooks/useInventory";
import { cn } from "@/lib/utils";

import styles from "./AppLayout.module.css";

interface AppLayoutProps {
  chatPanel: React.ReactNode;
  inventoryPanel: React.ReactNode;
}

/**
 * AppLayout provides the split-screen (desktop) / tabbed (mobile) layout
 * for the chat + inventory experience.
 *
 * Desktop (>= 768px): side-by-side with inventory on the left (~40%),
 *   chat on the right (~60%). Both scroll independently.
 *
 * Mobile (< 768px): bottom tab bar switches between chat and inventory.
 *   A compact cost strip is always visible at the top.
 */
export function AppLayout({ chatPanel, inventoryPanel }: AppLayoutProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>("chat");
  const [profileOpen, setProfileOpen] = useState(false);
  const { costSummary, refreshInventory } = useInventory();

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

      {/* Mobile: compact cost strip with edit trigger */}
      <div className={styles.mobileStrip}>
        <div className={styles.mobileStripInner}>
          <div className={styles.mobileStripCost}>
            <CostSummary data={costSummary} variant="compact" />
          </div>
          <div className={styles.mobileStripActions}>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setProfileOpen(true)}
              aria-label="Edit move details"
              style={{ color: "var(--color-text-muted)" }}
            >
              <Settings style={{ width: 16, height: 16 }} />
            </Button>
            <SignOutButton />
          </div>
        </div>
      </div>

      {/* Desktop: side-by-side layout */}
      <div className={styles.desktopLayout}>
        {/* Inventory panel — left side */}
        <aside className={styles.inventoryAside} aria-label="Inventory">
          <div className={styles.inventoryHeader}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setProfileOpen(true)}
              className={styles.editMoveButton ?? ""}
            >
              <Settings style={{ width: 14, height: 14 }} />
              Edit move details
            </Button>
            <SignOutButton />
          </div>
          {inventoryPanel}
        </aside>

        {/* Chat panel — right side */}
        <main id="main-content" className={styles.chatMain}>
          {chatPanel}
        </main>
      </div>

      {/* Mobile: tabbed content */}
      <div className={styles.mobileTabs}>
        <div
          className={cn(styles.tabPanel, activeTab !== "chat" && styles.tabPanelHidden)}
          id="mobile-tabpanel-chat"
          role="tabpanel"
          aria-labelledby="mobile-tab-chat"
        >
          {chatPanel}
        </div>
        <div
          className={cn(styles.tabPanel, activeTab !== "inventory" && styles.tabPanelHidden)}
          id="mobile-tabpanel-inventory"
          role="tabpanel"
          aria-labelledby="mobile-tab-inventory"
        >
          {inventoryPanel}
        </div>
      </div>

      {/* Mobile bottom tab bar */}
      <BottomTabBar activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}
