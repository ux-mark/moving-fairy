"use client";

import { useState } from "react";
import { Package, Scale, Brain } from "lucide-react";
import type { ItemAssessment } from "@/types";
import { InventoryPanel } from "@/components/inventory/InventoryPanel";
import { AILogicPanel, type LogicEvent } from "@/components/chat/AILogicPanel";
import { DecisionsPanel } from "@/components/inventory/DecisionsPanel";

import styles from "./InventorySidePanel.module.css";

interface InventorySidePanelProps {
  logicEvents: LogicEvent[];
  isStreaming: boolean;
  decisions?: ItemAssessment[];
  decisionsLoading?: boolean;
  decisionsError?: string | null;
  decisionCount?: number;
  onConfirm?: (assessmentId: string) => Promise<void>;
  onConfirmAndSend?: (assessmentId: string) => Promise<void>;
  onRefreshDecisions?: () => Promise<void>;
}

type SidePanelTab = "inventory" | "decisions" | "logic";

/**
 * Right-side panel with button-style pill toggles matching Job Fairy's toolbar pattern.
 */
export function InventorySidePanel({
  logicEvents,
  isStreaming,
  decisions = [],
  decisionsLoading = false,
  decisionsError = null,
  decisionCount = 0,
  onConfirm,
  onConfirmAndSend,
  onRefreshDecisions,
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
          <span className={decisionCount > 0 ? `${styles.badge} ${styles.badgePending}` : styles.badge}>
            {decisionCount}
          </span>
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
          <DecisionsPanel
            decisions={decisions}
            isLoading={decisionsLoading}
            error={decisionsError}
            onConfirm={onConfirm ?? (async () => {})}
            onConfirmAndSend={onConfirmAndSend ?? (async () => {})}
            onRefresh={onRefreshDecisions ?? (async () => {})}
          />
        ) : (
          <AILogicPanel events={logicEvents} isStreaming={isStreaming} />
        )}
      </div>
    </div>
  );
}

