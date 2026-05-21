'use client'

import { useCallback, useState } from 'react'
import { usePathname } from 'next/navigation'
import { ClipboardList, Package, Settings, Sparkles, Tag, Plane } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Navigation } from '@thefairies/design-system/components'

import { ProfileEditPanel } from '@/components/profile/ProfileEditPanel'

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

/**
 * AppLayout — simplified shell: Navigation + main content.
 * The chat/inventory dual-panel layout has been replaced by the
 * item-centric decisions-as-home layout.
 */
export function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [profileOpen, setProfileOpen] = useState(false)

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

      {/* DS Navigation */}
      <Navigation
        brandName="Moving Fairy"
        brandIcon={<Sparkles size={20} strokeWidth={1.8} />}
        activeSection={activeSection}
        onNavigate={handleNavigate}
        primaryItems={NAV_PRIMARY_ITEMS}
        secondaryItems={NAV_SECONDARY_ITEMS}
      />

      {/* Main content */}
      <div className={styles.body}>
        <main id="main-content" className={styles.main}>
          {children}
        </main>
      </div>
    </div>
  )
}
