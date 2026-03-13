"use client";

import { type MutableRefObject, useEffect, useRef, useState } from "react";
import { Package, Scale, Brain } from "lucide-react";
import type { ItemAssessment } from "@/types";
import { useInventory } from "@/lib/hooks/useInventory";
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
  onSwitchToDecisionsRef?: MutableRefObject<(() => void) | null>;
  /** Called when the user taps "Back to Aisling" from inside a nested panel on mobile */
  onBackToChat?: (() => void) | undefined;
  /** Called when the active tab changes — lets the parent hide/show the notification tab */
  onActiveTabChange?: (tab: "inventory" | "decisions" | "logic") => void;
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
  onSwitchToDecisionsRef,
  onBackToChat,
  onActiveTabChange,
}: InventorySidePanelProps) {
  const [activeTab, setActiveTab] = useState<SidePanelTab>("inventory");
  const decisionsButtonRef = useRef<HTMLButtonElement>(null);
  // Fetch boxes so DecisionsPanel can offer box assignment in the edit panel
  const { boxes } = useInventory();

  // Notify parent when the active tab changes
  useEffect(() => {
    onActiveTabChange?.(activeTab);
  }, [activeTab, onActiveTabChange]);

  // Allow parent to programmatically switch to the Decisions tab.
  // When triggered (e.g. from the notification tab), focus the Decisions
  // toggle button so keyboard users land somewhere meaningful instead of <body>.
  useEffect(() => {
    if (onSwitchToDecisionsRef) {
      onSwitchToDecisionsRef.current = () => {
        setActiveTab("decisions");
        requestAnimationFrame(() => {
          decisionsButtonRef.current?.focus();
        });
      };
    }
    return () => {
      if (onSwitchToDecisionsRef) {
        onSwitchToDecisionsRef.current = null;
      }
    };
  }, [onSwitchToDecisionsRef]);

  return (
    <div className={styles.panel}>
      {/* Toggle bar */}
      <div className={styles.tabBar} data-active-tab={activeTab}>
        <button
          type="button"
          className={activeTab === "inventory" ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab("inventory")}
        >
          <Package size={13} />
          Inventory
        </button>
        <button
          ref={decisionsButtonRef}
          type="button"
          className={`${activeTab === "decisions" ? styles.tabActive : styles.tab} ${styles.decisionsTab}`}
          onClick={() => setActiveTab("decisions")}
        >
          <Scale size={13} />
          Decisions
          {decisionCount > 0 && (
            <span className={styles.badgePending}>
              {decisionCount}
            </span>
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
          <InventoryPanel onBackToChat={onBackToChat} />
        ) : activeTab === "decisions" ? (
          <DecisionsPanel
            decisions={decisions}
            boxes={boxes}
            isLoading={decisionsLoading}
            error={decisionsError}
            onConfirm={onConfirm ?? (async () => {})}
            onConfirmAndSend={onConfirmAndSend ?? (async () => {})}
            onRefresh={onRefreshDecisions ?? (async () => {})}
            onBackToChat={onBackToChat}
          />
        ) : (
          <AILogicPanel events={logicEvents} isStreaming={isStreaming} />
        )}
      </div>
    </div>
  );
}

