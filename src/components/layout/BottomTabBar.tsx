"use client";

import { MessageCircle, Package } from "lucide-react";

import { cn } from "@/lib/utils";

export type ActiveTab = "chat" | "inventory";

interface BottomTabBarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
}

export function BottomTabBar({ activeTab, onTabChange }: BottomTabBarProps) {
  return (
    <div
      className="flex shrink-0 items-stretch border-t border-border bg-card md:hidden"
      role="tablist"
      aria-label="Main navigation"
    >
      <button
        type="button"
        role="tab"
        id="mobile-tab-chat"
        aria-selected={activeTab === "chat"}
        aria-controls="mobile-tabpanel-chat"
        onClick={() => onTabChange("chat")}
        className={cn(
          "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs font-medium transition-colors",
          "min-h-[48px]",
          activeTab === "chat"
            ? "border-t-2 border-primary text-primary"
            : "text-muted-foreground"
        )}
      >
        <MessageCircle className="size-5" />
        <span>Chat</span>
      </button>
      <button
        type="button"
        role="tab"
        id="mobile-tab-inventory"
        aria-selected={activeTab === "inventory"}
        aria-controls="mobile-tabpanel-inventory"
        onClick={() => onTabChange("inventory")}
        className={cn(
          "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs font-medium transition-colors",
          "min-h-[48px]",
          activeTab === "inventory"
            ? "border-t-2 border-primary text-primary"
            : "text-muted-foreground"
        )}
      >
        <Package className="size-5" />
        <span>Inventory</span>
      </button>
    </div>
  );
}
