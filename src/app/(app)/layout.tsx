import { PanelProvider } from '@/components/panels'
import { UploadProvider } from '@/components/upload'

/**
 * (app) route-group layout: mounts the panel system and the background
 * upload queue above every authed page, so panels and uploads survive
 * in-app navigation. The panel tray renders inside AppLayout (desktop:
 * under the top bar; mobile: directly above the bottom nav) rather than
 * the provider's default floating dock.
 */
export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <PanelProvider renderTray={false}>
      <UploadProvider>{children}</UploadProvider>
    </PanelProvider>
  )
}
