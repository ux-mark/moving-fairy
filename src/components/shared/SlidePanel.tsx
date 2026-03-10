"use client";

import { EditPanel } from "@thefairies/design-system/components";

/**
 * SlidePanel — thin compatibility wrapper around the Nós DS EditPanel.
 *
 * Previously used Framer Motion for slide animation. The DS EditPanel uses
 * CSS transitions instead, which is acceptable per the migration plan.
 *
 * The DS EditPanel requires onSave/onCancel; we pass footer={false} so the
 * built-in Save/Cancel footer is hidden. Consumers embed their own actions
 * as part of children, as before.
 */

interface SlidePanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string | undefined;
}

export function SlidePanel({
  open,
  onClose,
  title,
  children,
}: SlidePanelProps) {
  return (
    <EditPanel
      isOpen={open}
      onClose={onClose}
      title={title}
      onSave={onClose}
      onCancel={onClose}
      footer={false}
    >
      {children}
    </EditPanel>
  );
}
