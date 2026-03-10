"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { InventoryPanel } from "@/components/inventory/InventoryPanel";

/**
 * Composes AppLayout with ChatInterface and InventoryPanel.
 * This is the main entry point for the chat experience.
 */
export function ChatWithInventory() {
  return (
    <AppLayout
      chatPanel={<ChatInterface embedded />}
      inventoryPanel={<InventoryPanel />}
    />
  );
}
