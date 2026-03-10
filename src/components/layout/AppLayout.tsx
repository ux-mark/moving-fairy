"use client";

import { useState } from "react";
import { Settings } from "lucide-react";

import {
  BottomTabBar,
  type ActiveTab,
} from "@/components/layout/BottomTabBar";
import { CostSummary } from "@/components/inventory/CostSummary";
import { ProfileEditPanel } from "@/components/profile/ProfileEditPanel";
import { Button } from "@/components/ui/button";
import { useInventory } from "@/lib/hooks/useInventory";
import { cn } from "@/lib/utils";

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
    <div className="flex h-svh flex-col bg-background">
      {/* Skip navigation link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:outline-none"
      >
        Skip to main content
      </a>

      {/* Profile edit panel */}
      <ProfileEditPanel
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        onSaved={refreshInventory}
      />

      {/* Mobile: compact cost strip with edit trigger */}
      <div className="shrink-0 md:hidden">
        <div className="flex items-center">
          <div className="flex-1">
            <CostSummary data={costSummary} variant="compact" />
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setProfileOpen(true)}
            aria-label="Edit move details"
            className="mr-2 text-muted-foreground"
          >
            <Settings className="size-4" />
          </Button>
        </div>
      </div>

      {/* Desktop: side-by-side layout */}
      <div className="hidden flex-1 md:flex">
        {/* Inventory panel — left side */}
        <aside className="flex w-[40%] min-w-[320px] max-w-[480px] flex-col border-r border-border" aria-label="Inventory">
          <div className="flex items-center justify-end border-b border-border px-3 py-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setProfileOpen(true)}
              className="gap-1.5 text-xs text-muted-foreground"
            >
              <Settings className="size-3.5" />
              Edit move details
            </Button>
          </div>
          {inventoryPanel}
        </aside>

        {/* Chat panel — right side */}
        <main id="main-content" className="flex flex-1 flex-col">
          {chatPanel}
        </main>
      </div>

      {/* Mobile: tabbed content */}
      <div className="flex flex-1 flex-col overflow-hidden md:hidden">
        <div
          className={cn(
            "flex-1 overflow-hidden",
            activeTab === "chat" ? "block" : "hidden"
          )}
          id="mobile-tabpanel-chat"
          role="tabpanel"
          aria-labelledby="mobile-tab-chat"
        >
          {chatPanel}
        </div>
        <div
          className={cn(
            "flex-1 overflow-hidden",
            activeTab === "inventory" ? "block" : "hidden"
          )}
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
