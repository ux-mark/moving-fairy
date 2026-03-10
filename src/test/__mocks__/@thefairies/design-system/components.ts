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

export { RecommendationCard } from '__DS_COMPONENTS__/RecommendationCard/RecommendationCard';
export type { RecommendationCardProps, RecommendationStatus } from '__DS_COMPONENTS__/RecommendationCard/RecommendationCard';

export { default as ChatInput } from '__DS_COMPONENTS__/Chat/ChatInput';
export type { ChatInputProps } from '__DS_COMPONENTS__/Chat/ChatInput';
