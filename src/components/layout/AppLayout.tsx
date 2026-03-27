'use client'

import { useCallback, useState } from 'react'
import { usePathname } from 'next/navigation'
import { ClipboardList, Package, Settings, Sparkles } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Navigation } from '@thefairies/design-system/components'

import { ProfileEditPanel } from '@/components/profile/ProfileEditPanel'

import styles from './AppLayout.module.css'

interface AppLayoutProps {
  children: React.ReactNode
}

const NAV_PRIMARY_ITEMS = [
  { key: 'decisions', label: 'Decisions', icon: ClipboardList },
  { key: 'boxes',     label: 'Boxes',     icon: Package },
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
  const activeSection = pathname.startsWith('/boxes') ? 'boxes' : 'decisions'

  const handleNavigate = useCallback(
    (section: string) => {
      if (section === 'decisions') {
        router.push('/decisions')
      } else if (section === 'boxes') {
        router.push('/boxes')
      } else if (section === 'settings') {
        setProfileOpen(true)
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
