"use client";

import { useCallback, useRef, useState } from "react";

import { AppLayout } from "@/components/layout/AppLayout";
import { ChatInterface, type ChatInterfaceHandle } from "@/components/chat/ChatInterface";
import { InventorySidePanel } from "@/components/inventory/InventorySidePanel";
import { useDecisions } from "@/lib/hooks/useDecisions";
import type { LogicEvent } from "@/components/chat/AILogicPanel";

/**
 * Composes AppLayout with ChatInterface and InventorySidePanel.
 * Lifts AI Logic state and decision state so both can be displayed in the inventory panel.
 */
export function ChatWithInventory() {
  const [logicEvents, setLogicEvents] = useState<LogicEvent[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  // Ref to the ChatInterface so we can programmatically send messages
  const chatRef = useRef<ChatInterfaceHandle>(null);

  const handleSendToChat = useCallback((message: string) => {
    chatRef.current?.sendMessage(message);
  }, []);

  const {
    decisions,
    isLoading: decisionsLoading,
    error: decisionsError,
    confirm,
    confirmAndSend,
    refresh: refreshDecisions,
    count: decisionCount,
  } = useDecisions({ onSendToChat: handleSendToChat });

  // Ref to allow AppLayout to switch the inventory panel to the Decisions tab
  const switchToDecisionsRef = useRef<(() => void) | null>(null);

  // Ref to close the mobile overlay from inside nested panels (e.g. ItemEditPanel)
  const closeMobileOverlayRef = useRef<(() => void) | null>(null);

  const handleBackToChat = useCallback(() => {
    closeMobileOverlayRef.current?.();
  }, []);

  const handleOpenDecisions = useCallback(() => {
    switchToDecisionsRef.current?.();
  }, []);

  return (
    <AppLayout
      chatPanel={
        <ChatInterface
          ref={chatRef}
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
          decisions={decisions}
          decisionsLoading={decisionsLoading}
          decisionsError={decisionsError}
          decisionCount={decisionCount}
          onConfirm={confirm}
          onConfirmAndSend={confirmAndSend}
          onRefreshDecisions={refreshDecisions}
          onSwitchToDecisionsRef={switchToDecisionsRef}
          onBackToChat={handleBackToChat}
        />
      }
      decisionCount={decisionCount}
      onOpenDecisions={handleOpenDecisions}
      closeMobileOverlayRef={closeMobileOverlayRef}
    />
  );
}
