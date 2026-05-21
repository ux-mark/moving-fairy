/**
 * Buyer-facing copy. US English.
 *
 * IMPORTANT: This module must ONLY be imported from `src/app/(public)/**`.
 * The buyer voice ("Inquire", "Inquiry") is distinct from the owner voice
 * ("Enquiry") — mixing them across the owner surface will leak US spelling
 * into the Irish English app.
 */
export const buyerCopy = {
  // Site chrome
  fallbackTagline: 'Items for sale from someone moving abroad. Bundle to save.',
  fallbackSellerName: 'Items for sale',

  // Browse
  availableLabel: 'available',
  emptyCollectionHeading: 'Nothing for sale right now',
  emptyCollectionBody: 'Check back soon — new items are added as the move progresses.',
  loadErrorHeading: "We couldn't load this collection",
  loadErrorBody: 'Try refreshing the page in a moment.',
  photoCountSingular: '1 photo',
  photoCountPluralSuffix: 'photos',
  soldRibbon: 'Sold',
  reservedBadge: 'Reserved',
  conditionLabels: {
    excellent: 'Excellent',
    like_new: 'Like new',
    good: 'Good',
    fair: 'Fair',
  } as const,

  // Detail page
  unavailableLabel: 'No longer available',
  detailsHeading: 'Details',
  specBrand: 'Brand',
  specModel: 'Model',
  specDimensions: 'Size',
  specIncluded: 'Included',
  specCondition: 'Condition',
  backToCollection: 'Back to all items',
  prevPhoto: 'Previous photo',
  nextPhoto: 'Next photo',
  photoIndicatorLabel: (i: number) => `Go to photo ${i + 1}`,

  // Bundle bar
  addToBundle: 'Add to bundle',
  removeFromBundle: 'Remove from bundle',
  bundleSingular: '1 item',
  bundlePlural: (n: number) => `${n} items`,
  bundleSubtotalLabel: 'Subtotal',
  bundleTotalLabel: 'Total',
  bundleSaveLabel: (saved: string, percent: number) => `save ${saved} · ${percent}% off`,
  bundleClear: 'Clear',
  inquireButton: 'Send inquiry',
  inquireSingleButton: 'Inquire',
  inquireHeading: 'Inquire about this item',
  inquireBundleHeading: 'Send your inquiry',
  nextTierNudge: (more: number, percent: number) =>
    more === 1
      ? `Add 1 more for ${percent}% off`
      : `Add ${more} more for ${percent}% off`,
  topTier: 'Top bundle discount unlocked',

  // Inquiry form
  emailLabel: 'Your email',
  emailPlaceholder: 'you@example.com',
  nameLabel: 'Your name',
  nameHint: 'optional',
  messageLabel: 'Message',
  messageHint: 'include when you can pick up',
  sendCta: 'Send inquiry',
  sendingCta: 'Sending…',
  cancelCta: 'Cancel',
  successHeading: 'Inquiry sent',
  successBody: "We'll be in touch by email soon.",
  errorHeading: "Couldn't send your inquiry",
  errorBodyMailtoHint: 'You can also email us directly:',
  mailtoFallbackLabel: 'Send by email instead',

  // Status copy on detail page
  itemReserved: 'Reserved — inquiries still welcome',
  itemSold: 'This item has been sold',

  // Plant-care callout
  careHeading: 'Plant care',
  careLight: 'Light',
  careWater: 'Water',
  careSoil: 'Soil',
  careFeed: 'Feed',
  careLevelLabel: (filled: number) => `${filled} of 3`,
} as const

export type BuyerCopy = typeof buyerCopy

/** Format a USD price (asking_price is a numeric dollar amount, not cents). */
export function formatPrice(price: number | null | undefined, currency = 'USD'): string {
  if (price === null || price === undefined) return ''
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: price % 1 === 0 ? 0 : 2,
    }).format(price)
  } catch {
    return `$${price}`
  }
}
