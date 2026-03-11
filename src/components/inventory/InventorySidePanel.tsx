"use client";

import { useState } from "react";
import { Package, Scale, Brain } from "lucide-react";

import { InventoryPanel } from "@/components/inventory/InventoryPanel";
import { AILogicPanel, type LogicEvent } from "@/components/chat/AILogicPanel";

import styles from "./InventorySidePanel.module.css";

interface InventorySidePanelProps {
  logicEvents: LogicEvent[];
  isStreaming: boolean;
  decisionCount?: number;
}

type SidePanelTab = "inventory" | "decisions" | "logic";

/**
 * Right-side panel with button-style pill toggles matching Job Fairy's toolbar pattern.
 */
export function InventorySidePanel({
  logicEvents,
  isStreaming,
  decisionCount = 0,
}: InventorySidePanelProps) {
  const [activeTab, setActiveTab] = useState<SidePanelTab>("inventory");

  return (
    <div className={styles.panel}>
      {/* Toggle bar */}
      <div className={styles.tabBar}>
        <button
          type="button"
          className={activeTab === "inventory" ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab("inventory")}
        >
          <Package size={13} />
          Inventory
        </button>
        <button
          type="button"
          className={activeTab === "decisions" ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab("decisions")}
        >
          <Scale size={13} />
          Decisions
          {decisionCount > 0 && (
            <span className={styles.badge}>{decisionCount}</span>
          )}
        </button>
        <button
          type="button"
          className={activeTab === "logic" ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab("logic")}
        >
          <Brain size={13} />
          AI Logic
        </button>
      </div>

      {/* Tab content */}
      <div className={styles.content}>
        {activeTab === "inventory" ? (
          <InventoryPanel />
        ) : activeTab === "decisions" ? (
          <div className={styles.decisionsPlaceholder}>
            Decisions panel coming soon
          </div>
        ) : (
          <AILogicPanel events={logicEvents} isStreaming={isStreaming} />
        )}
      </div>
    </div>
  );
}
