/**
 * Owner-facing copy. Irish English.
 * Imported from app/(app)/** — the authenticated owner surface.
 */
export const ownerCopy = {
  nav: {
    items: 'Items',
    packing: 'Packing',
    selling: 'Selling',
    itinerary: 'Itinerary',
    settings: 'Settings',
  },
  items: {
    heading: 'Items',
    filters: {
      needsDecision: 'Needs decision',
      toPack: 'To pack',
      toSell: 'To sell',
      toDonate: 'To donate',
      toDiscard: 'To discard',
      done: 'Done',
    },
    emptyForFilter: 'Nothing in this view yet.',
    clearFilters: 'Show everything',
  },
  selling: {
    heading: 'Selling',
    newListing: 'New listing',
    emptyHeading: 'No items marked for sale yet',
    emptyDescription:
      'Items you mark SELL in Items will appear here, ready to write up and publish.',
    filters: {
      all: 'All',
      draft: 'Draft',
      published: 'Published',
      reserved: 'Reserved',
      sold: 'Sold',
    },
    status: {
      draft: 'Draft',
      published: 'Published',
      reserved: 'Reserved',
      sold: 'Sold',
    },
    actions: {
      save: 'Save',
      markSold: 'Mark sold',
      viewPublic: 'View public listing',
      delete: 'Delete listing',
      publish: 'Publish',
      unpublish: 'Unpublish',
    },
    pickerHeading: 'Pick an item to list',
    pickerEmpty:
      'No unsold SELL items left. Mark an item SELL in Items to list it.',
    fields: {
      itemName: 'Item name',
      price: 'Asking price',
      currency: 'Currency',
      condition: 'Condition',
      brand: 'Brand',
      modelName: 'Model name',
      dimensions: 'Dimensions',
      included: 'What\'s included',
      details: 'Details',
      status: 'Status',
      photos: 'Photos',
    },
    conditionLabels: {
      excellent: 'Excellent',
      like_new: 'Like new',
      good: 'Good',
      fair: 'Fair',
    },
    savedToast: 'Listing saved.',
    soldToast: 'Marked as sold.',
    uploadFailed: 'Photo upload failed. Try again.',
  },
  itinerary: {
    heading: 'Itinerary',
    totalsLabel: 'Totals',
    declaredValue: 'Declared value',
    cbm: 'Total CBM',
    biosecFlags: 'Biosecurity flags',
    generateShare: 'Generate share link',
    shareCopied: 'Link copied.',
    shareCopyButton: 'Copy link',
    exportCsv: 'Export CSV',
    exportPdf: 'Export PDF (coming soon)',
    emptyHeading: 'No items packed for this leg yet',
    emptyDescription:
      'Items with a SHIP or CARRY verdict show up here once they\'re assigned to a box.',
    biosecHeading: 'Biosecurity declarations',
    confirmBiosec: 'Confirm',
    confirmedBiosec: 'Confirmed',
    boxLabel: 'Box',
    items: 'items',
    item: 'item',
    perItemValue: 'value',
  },
  settings: {
    heading: 'Settings',
    tabs: {
      sale: 'Sale defaults',
      shipments: 'Shipments',
      biosecurity: 'Biosecurity',
      account: 'Account',
    },
    sale: {
      currency: 'Currency',
      sellerName: 'Seller display name',
      contactEmail: 'Contact email for enquiries',
      pickupLocation: 'Pickup location',
      pickupHelper:
        'Shown to buyers once an enquiry is accepted. Free-text — share what helps them collect.',
      discountTiers: 'Bundle discount tiers',
      discountHelper:
        'How much off when buyers bundle items. Lower bound is the number of items they buy at once.',
      defaultCondition: 'Default condition for new listings',
      saveToast: 'Settings saved.',
    },
    shipments: {
      label: 'Label',
      targetDate: 'Target date',
      status: 'Status',
    },
    biosecurity: {
      destinationLabel: 'Destination preset',
      destinationHelper:
        'Set automatically from your route. Add or change destinations via your move profile.',
      info:
        'Biosecurity checks adapt to where you\'re shipping. Per-destination customisation lands in a later release.',
    },
    account: {
      email: 'Email',
      signOut: 'Sign out',
    },
  },
  enquiries: {
    heading: 'Enquiries',
    empty: 'No enquiries yet.',
  },
} as const

export type OwnerCopy = typeof ownerCopy
