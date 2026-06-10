'use client'

import type { ComponentType } from 'react'

import type { PanelKind } from './types'
import styles from './Panel.module.css'

export interface PanelContentProps {
  panelId: string
  entityId: string
}

/**
 * kind → content component. Phase C registers the real entity panels
 * (ItemPanel, BoxPanel, ListingPanel, chat) via registerPanelContent.
 */
const registry: Partial<Record<PanelKind, ComponentType<PanelContentProps>>> = {
  // TODO(Phase C): item → ItemPanel
  // TODO(Phase C): box → BoxPanel
  // TODO(Phase C): listing → ListingPanel
  // TODO(Phase C): chat → per-item chat panel
}

export function registerPanelContent(
  kind: PanelKind,
  component: ComponentType<PanelContentProps>
): void {
  registry[kind] = component
}

export function getPanelContent(kind: PanelKind): ComponentType<PanelContentProps> {
  return registry[kind] ?? PanelContentPlaceholder
}

/** Rendered until Phase C registers the entity panel for a kind. */
function PanelContentPlaceholder({ entityId }: PanelContentProps) {
  return <p className={styles.placeholder}>Panel content is on its way for {entityId}.</p>
}
