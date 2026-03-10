"use client";

import { useState } from "react";

import { AppLayout } from "@/components/layout/AppLayout";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { InventorySidePanel } from "@/components/inventory/InventorySidePanel";
import type { LogicEvent } from "@/components/chat/AILogicPanel";

/**
 * Composes AppLayout with ChatInterface and InventorySidePanel.
 * Lifts AI Logic state so it can be displayed in the inventory panel's tab bar.
 */
export function ChatWithInventory() {
  const [logicEvents, setLogicEvents] = useState<LogicEvent[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  return (
    <AppLayout
      chatPanel={
        <ChatInterface
          onLogicEvent={(event) =>
            setLogicEvents((prev) => [...prev, event])
          }
          onStreamingChange={setIsStreaming}
        />
      }
      inventoryPanel={
        <InventorySidePanel
          logicEvents={logicEvents}
          isStreaming={isStreaming}
        />
      }
    />
  );
}
