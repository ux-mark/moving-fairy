'use client'

import type { ComponentType } from 'react'

import type { PanelKind } from './types'
import styles from './Panel.module.css'

export interface PanelContentProps {
  panelId: string
  entityId: string
}

/**
 * kind → content component. registerContent.tsx registers the entity panels
 * (ItemPanel, BoxPanel, ListingPanel, ChatPanel) via registerPanelContent.
 */
const registry: Partial<Record<PanelKind, ComponentType<PanelContentProps>>> = {}

export function registerPanelContent(
  kind: PanelKind,
  component: ComponentType<PanelContentProps>
): void {
  registry[kind] = component
}

export function getPanelContent(kind: PanelKind): ComponentType<PanelContentProps> {
  return registry[kind] ?? PanelContentPlaceholder
}

/** Rendered if a kind ever opens before its content component registers. */
function PanelContentPlaceholder({ entityId }: PanelContentProps) {
  return <p className={styles.placeholder}>Panel content is on its way for {entityId}.</p>
}
