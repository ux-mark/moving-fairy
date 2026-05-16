/**
 * Buyer-facing copy. US English.
 *
 * IMPORTANT: This module must ONLY be imported from `src/app/(public)/**`.
 * The buyer voice ("Inquire", "Inquiry") is distinct from the owner voice
 * ("Enquiry") — mixing them across the owner surface will leak US spelling
 * into the Irish English app.
 */
export const buyerCopy = {
  inquireButton: 'Send inquiry',
  inquireHeading: 'Inquire about this item',
  bundleBarBuild: 'Building your bundle',
  bundleBarSend: 'Send inquiry',
} as const

export type BuyerCopy = typeof buyerCopy
