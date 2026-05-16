/**
 * Owner-facing copy. Irish English.
 * Imported from app/(app)/** — the authenticated owner surface.
 *
 * Phases B+ will extend this with packing, selling, itinerary, and settings copy.
 */
export const ownerCopy = {
  nav: {
    items: 'Items',
    packing: 'Packing',
    selling: 'Selling',
    itinerary: 'Itinerary',
    settings: 'Settings',
  },
  enquiries: {
    heading: 'Enquiries',
    empty: 'No enquiries yet.',
  },
} as const

export type OwnerCopy = typeof ownerCopy
