"use client";

import { useState } from "react";

import { InventoryPanel } from "@/components/inventory/InventoryPanel";
import { AILogicPanel, type LogicEvent } from "@/components/chat/AILogicPanel";

import styles from "./InventorySidePanel.module.css";

interface InventorySidePanelProps {
  logicEvents: LogicEvent[];
  isStreaming: boolean;
}

type SidePanelTab = "inventory" | "logic";

/**
 * Right-side panel that hosts Inventory and AI Logic in a tab bar,
 * matching the DS SidePanel tab pattern.
 */
export function InventorySidePanel({ logicEvents, isStreaming }: InventorySidePanelProps) {
  const [activeTab, setActiveTab] = useState<SidePanelTab>("inventory");

  return (
    <div className={styles.panel}>
      {/* Tab bar */}
      <div className={styles.tabBar}>
        <button
          type="button"
          className={activeTab === "inventory" ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab("inventory")}
        >
          Inventory
        </button>
        <button
          type="button"
          className={activeTab === "logic" ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab("logic")}
        >
          AI Logic
        </button>
      </div>

      {/* Tab content */}
      <div className={styles.content}>
        {activeTab === "inventory" ? (
          <InventoryPanel />
        ) : (
          <AILogicPanel events={logicEvents} isStreaming={isStreaming} />
        )}
      </div>
    </div>
  );
}
