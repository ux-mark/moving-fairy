'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { ClipboardList, Package, Settings, Sparkles, Tag, Plane } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Navigation } from '@thefairies/design-system/components'

import { PanelTray, usePanels } from '@/components/panels'
import { ProfileEditPanel } from '@/components/profile/ProfileEditPanel'
import { UploadProgressCard } from '@/components/upload'

import { BottomNav } from './BottomNav'
import styles from './AppLayout.module.css'

interface AppLayoutProps {
  children: React.ReactNode
}

const NAV_PRIMARY_ITEMS = [
  { key: 'items',     label: 'Items',     icon: ClipboardList },
  { key: 'packing',   label: 'Packing',   icon: Package },
  { key: 'selling',   label: 'Selling',   icon: Tag },
  { key: 'itinerary', label: 'Itinerary', icon: Plane },
]

const NAV_SECONDARY_ITEMS = [
  { key: 'settings', label: 'Settings', icon: Settings },
]

/** Bottom tab bar carries every destination — Settings included. */
const BOTTOM_NAV_ITEMS = [...NAV_PRIMARY_ITEMS, ...NAV_SECONDARY_ITEMS]

/**
 * AppLayout — app shell. Desktop (≥1024px): DS top Navigation with the
 * panel tray bar directly beneath it, upload progress docked bottom-right.
 * Mobile/tablet (<1024px): brand-only top bar, fixed bottom tab bar, with
 * the tray chip strip + upload card docked directly above it (thumb zone).
 */
export function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [profileOpen, setProfileOpen] = useState(false)
  const { panels } = usePanels()
  const hasTray = panels.length > 0

  // Warm the other nav destinations so a click resolves from cache (paired with
  // each route's loading.tsx boundary) instead of a cold server round-trip.
  useEffect(() => {
    for (const path of ['/items', '/boxes', '/selling', '/itinerary', '/settings']) {
      router.prefetch(path)
    }
  }, [router])

  // Derive active section from the current path
  const activeSection =
    pathname.startsWith('/boxes') || pathname.startsWith('/packing')
      ? 'packing'
      : pathname.startsWith('/selling')
      ? 'selling'
      : pathname.startsWith('/itinerary')
      ? 'itinerary'
      : pathname.startsWith('/settings')
      ? 'settings'
      : 'items'

  const handleNavigate = useCallback(
    (section: string) => {
      if (section === 'items') {
        router.push('/items')
      } else if (section === 'packing') {
        // Route stays as /boxes; the label is "Packing"
        router.push('/boxes')
      } else if (section === 'selling') {
        router.push('/selling')
      } else if (section === 'itinerary') {
        router.push('/itinerary')
      } else if (section === 'settings') {
        router.push('/settings')
      }
    },
    [router]
  )

  return (
    <div className={styles.root}>
      {/* Skip navigation link */}
      <a href="#main-content" className={styles.skipNav}>
        Skip to main content
      </a>

      {/* Profile edit panel */}
      <ProfileEditPanel
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        onSaved={() => {
          /* refreshes handled per-page */
        }}
      />

      {/* Desktop: full DS Navigation */}
      <div className={styles.topNavDesktop}>
        <Navigation
          brandName="Moving Fairy"
          brandIcon={<Sparkles size={20} strokeWidth={1.8} />}
          activeSection={activeSection}
          onNavigate={handleNavigate}
          primaryItems={NAV_PRIMARY_ITEMS}
          secondaryItems={NAV_SECONDARY_ITEMS}
        />
      </div>

      {/* Mobile/tablet: brand-only top bar (no items, no hamburger) —
          wayfinding moves to the bottom tab bar. */}
      <div className={styles.topNavMobile}>
        <Navigation
          brandName="Moving Fairy"
          brandIcon={<Sparkles size={20} strokeWidth={1.8} />}
          activeSection={activeSection}
          onNavigate={handleNavigate}
          primaryItems={[]}
        />
      </div>

      {/* Desktop tray bar — directly under the top bar (UX_STANDARDS § Panels). */}
      {hasTray && (
        <div className={styles.desktopTrayBar}>
          <PanelTray />
        </div>
      )}

      {/* Main content */}
      <div className={styles.body}>
        <main id="main-content" className={styles.main}>
          {children}
        </main>
      </div>

      {/* Mobile dock — upload progress stacked over the tray chip strip,
          pinned directly above the bottom nav (thumb zone). */}
      <div className={styles.mobileDock}>
        <UploadProgressCard />
        {hasTray && <PanelTray className={styles.mobileTrayStrip} />}
      </div>

      {/* Desktop upload progress — docked bottom-right. */}
      <div className={styles.desktopUploadDock}>
        <UploadProgressCard />
      </div>

      <BottomNav
        items={BOTTOM_NAV_ITEMS}
        activeKey={activeSection}
        onNavigate={handleNavigate}
      />
    </div>
  )
}
