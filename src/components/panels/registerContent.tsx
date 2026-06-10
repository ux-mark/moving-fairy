'use client'

import dynamic from 'next/dynamic'

import { registerPanelContent } from './registry'

// Entity panels are heavy (forms, chat, BoxCard) and only needed once a panel
// opens — load them lazily so they stay out of every page's first chunk
// (spec §7). Module-scope side effect: importing this file (PanelProvider
// does) registers all four kinds before any panel can render.
registerPanelContent(
  'item',
  dynamic(() => import('./ItemPanel').then((m) => m.ItemPanel))
)
registerPanelContent(
  'box',
  dynamic(() => import('./BoxPanel').then((m) => m.BoxPanel))
)
registerPanelContent(
  'listing',
  dynamic(() => import('./ListingPanel').then((m) => m.ListingPanel))
)
registerPanelContent(
  'chat',
  dynamic(() => import('./ChatPanel').then((m) => m.ChatPanel))
)
