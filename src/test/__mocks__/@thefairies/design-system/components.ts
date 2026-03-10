/**
 * Vitest alias for @thefairies/design-system/components.
 *
 * The DS index.ts barrel references many components not yet shipped in the
 * installed version of the package. This thin re-export only pulls in the
 * components that actually exist on disk, preventing import resolution errors
 * in the Vite/Vitest environment.
 *
 * Paths are resolved via the vitest alias map in vitest.config.ts, where
 * __DS_COMPONENTS__ maps to the DS src/components directory.
 *
 * Next.js (with transpilePackages) resolves the full DS package correctly at
 * build time and does not use this file.
 */
export { Badge } from '__DS_COMPONENTS__/Badge/Badge';
export type { BadgeProps } from '__DS_COMPONENTS__/Badge/Badge';

export { Button } from '__DS_COMPONENTS__/Button/Button';
export type { ButtonProps } from '__DS_COMPONENTS__/Button/Button';

// ConfirmDialog imports Spinner which is not yet in the DS package on disk.
// Provide fully inline stubs so Vitest can resolve the import without loading the
// broken Spinner dependency. The real ConfirmDialog is used at Next.js build time.
export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  isConfirming?: boolean;
  variant?: 'default' | 'danger';
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars -- stub for vitest environment only
export function ConfirmDialog(_props: ConfirmDialogProps): any { return null; }

export { CostStrip } from '__DS_COMPONENTS__/CostStrip/CostStrip';
export type { CostStripProps, CostStripTag } from '__DS_COMPONENTS__/CostStrip/CostStrip';

export { EditPanel } from '__DS_COMPONENTS__/EditPanel/EditPanel';
export type { EditPanelProps } from '__DS_COMPONENTS__/EditPanel/EditPanel';

export { RecommendationCard } from '__DS_COMPONENTS__/RecommendationCard/RecommendationCard';
export type { RecommendationCardProps, RecommendationStatus } from '__DS_COMPONENTS__/RecommendationCard/RecommendationCard';

export { default as ChatInput } from '__DS_COMPONENTS__/Chat/ChatInput';
export type { ChatInputProps } from '__DS_COMPONENTS__/Chat/ChatInput';
