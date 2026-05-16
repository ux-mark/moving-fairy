import type { Metadata, Viewport } from 'next'

/**
 * Public (buyer-facing) layout for the sale.* subdomain.
 *
 * Stripped down: no owner nav, no auth UI. US English metadata only.
 * Lives in a route group so the `(public)` segment never appears in URLs;
 * the middleware rewrites `sale.<host>/<path>` → `/_pub/<path>`.
 */

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  interactiveWidget: 'resizes-content',
}

export const metadata: Metadata = {
  title: 'Sale Fairy',
  description: "Items for sale from people moving abroad. Inquire to bundle and save.",
}

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
