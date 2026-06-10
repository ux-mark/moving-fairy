import { PanelProvider } from '@/components/panels'

/**
 * (app) route-group layout: mounts the panel system above every authed page.
 * Renders no chrome of its own — panels appear only when openPanel is called
 * (Phase C wires the entity surfaces in).
 */
export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  return <PanelProvider>{children}</PanelProvider>
}
