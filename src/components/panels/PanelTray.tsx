'use client'

import { MessageCircle, Package, Tag, ClipboardList } from 'lucide-react'

import { cn } from '@/lib/utils'

import { usePanels } from './PanelProvider'
import type { PanelKind } from './types'
import styles from './PanelTray.module.css'

const KIND_ICONS: Record<PanelKind, typeof Package> = {
  item: ClipboardList,
  box: Package,
  listing: Tag,
  chat: MessageCircle,
}

interface PanelTrayProps {
  /** Extra class for the host to position the strip (Phase E: above bottom nav). */
  className?: string | undefined
}

/**
 * Panel tray (spec §1): one chip per open panel. Click restores/focuses.
 * Renders nothing when no panels are open. Desktop: top-bar tray; mobile:
 * slim chip strip — Phase E positions it directly above the bottom nav.
 * A subtle live dot appears when a minimised panel's data changed.
 */
export function PanelTray({ className }: PanelTrayProps) {
  const { panels, restorePanel, closePanel } = usePanels()

  if (panels.length === 0) return null

  return (
    <ul className={cn(styles.tray, className)} aria-label="Open panels">
      {panels.map((panel) => {
        const Icon = KIND_ICONS[panel.kind]
        return (
          <li key={panel.id} className={styles.trayItem}>
            <button
              type="button"
              className={cn(styles.chip, panel.minimised && styles.chipMinimised)}
              onClick={() => restorePanel(panel.id)}
              aria-label={
                panel.minimised ? `Restore ${panel.title}` : `Focus ${panel.title}`
              }
            >
              <Icon size={14} aria-hidden="true" className={styles.chipIcon} />
              <span className={styles.chipLabel}>{panel.title}</span>
              {panel.hasUpdate && (
                <span className={styles.liveDot} aria-label="Updated while minimised" />
              )}
            </button>
          </li>
        )
      })}
      {panels.length >= 2 && (
        <li className={styles.trayItem}>
          <button
            type="button"
            className={cn(styles.chip, styles.closeAll)}
            onClick={() => panels.forEach((p) => closePanel(p.id))}
          >
            Close all
          </button>
        </li>
      )}
    </ul>
  )
}
