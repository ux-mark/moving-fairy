"use client";

import { MessageCircle, Package } from "lucide-react";

import { cn } from "@/lib/utils";
import styles from "./BottomTabBar.module.css";

export type ActiveTab = "chat" | "inventory";

interface BottomTabBarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
}

export function BottomTabBar({ activeTab, onTabChange }: BottomTabBarProps) {
  return (
    <div
      className={styles.bar}
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
        className={cn(styles.tab, activeTab === "chat" && styles.tabActive)}
      >
        <MessageCircle style={{ width: 20, height: 20 }} />
        <span>Chat</span>
      </button>
      <button
        type="button"
        role="tab"
        id="mobile-tab-inventory"
        aria-selected={activeTab === "inventory"}
        aria-controls="mobile-tabpanel-inventory"
        onClick={() => onTabChange("inventory")}
        className={cn(styles.tab, activeTab === "inventory" && styles.tabActive)}
      >
        <Package style={{ width: 20, height: 20 }} />
        <span>Inventory</span>
      </button>
    </div>
  );
}
