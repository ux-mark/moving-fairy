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
    inventoryValueLabel: 'Inventory value',
    inventoryValueHint: (cur: string) => `Est. replacement · ${cur} · for insurance & customs`,
    valueN: (n: number) => (n === 1 ? 'Value 1 item' : `Value ${n} items`),
    valuing: 'Valuing…',
    allValued: 'All items valued',
    valueScanError: "Couldn't start valuing — try again.",
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
      category: 'Category',
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
    categoryNoCategory: 'No category',
    categoryAddNewOption: '+ Add new category…',
    categoryAddPlaceholder: 'e.g. Garden tools',
    categoryAddButton: 'Add',
    categoryAddCancel: 'Cancel',
    categoryAddFailed: 'Couldn\'t add the category. Try again.',
  },
  packing: {
    activeBoxHeading: 'Packing into',
    noActiveBox: 'No active box yet',
    newBox: 'New box',
    addToBox: (label: string) => `Add to ${label}`,
    addToAnother: 'Add to another box…',
    pickABox: 'Pick a box to pack into',
    activeChip: 'Active',
    selectAll: 'Select all',
    selectedCount: (n: number) => `${n} selected`,
    clearSelection: 'Clear',
    addNToBox: (n: number, label: string) => `Add ${n} to ${label}`,
    addedToast: (name: string, label: string) => `Added ${name} to ${label}.`,
    addedManyToast: (n: number, label: string) => `Added ${n} items to ${label}.`,
    addedPartialToast: (added: number, total: number, failed: number) =>
      `Added ${added} of ${total} — ${failed} couldn't be added. Try again.`,
    undo: 'Undo',
    adding: 'Adding…',
    addErrorToast: (name: string) =>
      `Couldn't add ${name} — check your connection and try again.`,
    dropInto: (label: string) => `Drop into ${label}`,
    biosecNudgeOne: 'Contains 1 biosecurity item. Mark this box as biosecurity?',
    biosecNudgeMany: (n: number) =>
      `Contains ${n} biosecurity items. Mark this box as biosecurity?`,
    biosecDismiss: 'Dismiss',
    biosecMark: 'Mark as biosecurity',
    biosecMarkedToast: (label: string) => `${label} marked as biosecurity.`,
    biosecBadge: 'Biosecurity',
    biosecUnmark: 'Not biosecurity',
    // Post-scan draft review
    reviewHeading: (n: number) =>
      n === 1 ? '1 item to review' : `${n} items to review`,
    reviewSubMatchedNew: (matched: number, created: number) =>
      `Aisling matched ${matched} from your inventory and added ${created} new from the label. Add the ones that belong, remove any that don't.`,
    reviewSubNewOnly: (created: number) =>
      created === 1
        ? 'Aisling added 1 new item from your label. Add it if it belongs, or remove it.'
        : `Aisling added ${created} new items from your label. Add the ones that belong, remove any that don't.`,
    reviewSubMatchedOnly: (matched: number) =>
      matched === 1
        ? 'Aisling matched 1 item from your inventory. Add it if it belongs here, or remove it.'
        : `Aisling matched ${matched} items from your inventory. Add the ones that belong, remove any that don't.`,
    draftChipNew: 'New',
    draftChipMatched: 'From inventory',
    confirmAllDrafts: (n: number, label: string) =>
      n === 1 ? `Add 1 to ${label}` : `Add all ${n} to ${label}`,
    confirmingDrafts: 'Adding…',
    discardAllDrafts: 'Discard all',
    removeDraft: (name: string) => `Remove ${name}`,
    editDraft: (name: string) => `Edit ${name}`,
    draftsConfirmedToast: (n: number, label: string) =>
      n === 1 ? `Added 1 item to ${label}.` : `Added ${n} items to ${label}.`,
    draftRemovedToast: (name: string) => `Removed ${name}.`,
    draftConfirmError: "Couldn't add those items — try again.",
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
    exportPdf: 'Save as PDF',
    printManifestTitle: 'Packing manifest',
    printPreparedOn: (date: string) => `Prepared ${date}`,
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
    // Inline-edit column headers + field labels
    colItem: 'Item',
    colVerdict: 'Verdict',
    colValue: 'Value',
    colBox: 'Box',
    colBiosec: 'Biosecurity',
    colActions: 'Actions',
    colDescription: 'Description',
    fieldName: (item: string) => `Edit name for ${item}`,
    fieldDescription: (item: string) => `Description for ${item}`,
    fieldVerdict: (item: string) => `Verdict for ${item}`,
    fieldValue: (item: string) => `Replacement value for ${item}`,
    fieldBox: (item: string) => `Box for ${item}`,
    fieldBiosec: (item: string) => `Biosecurity flag for ${item}`,
    namePlaceholder: 'Item name',
    nameRequired: 'Name can\'t be empty.',
    descriptionPlaceholder: 'Add detail — quantity, contents, biosecurity notes',
    addDescription: '+ Add description',
    removeFromBox: 'Remove',
    removeFromBoxLabel: (item: string, box: string) => `Remove ${item} from ${box}`,
    valuePlaceholder: 'e.g. 120',
    valueFormatHint: 'Enter a number like 120',
    saveError: 'Couldn\'t save — try again.',
    saving: 'Saving',
    openBoxInPacking: (box: string) => `Open ${box} in packing`,
    verdictDowngradeTitle: (item: string, verdict: string) =>
      `Change ${item} to ${verdict}?`,
    verdictDowngradeBody: (box: string) =>
      `This takes it out of ${box} and off this manifest.`,
    changeVerdict: 'Change verdict',
    cancel: 'Cancel',
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
      categories: 'Categories',
      categoriesHelper:
        'Used to group your listings on the public sale page. Aisling may suggest a category — anything new gets added here automatically.',
      categoriesAddPlaceholder: 'e.g. Garden tools',
      categoriesAddButton: 'Add',
      categoriesAddEmpty: 'Add at least one category — categories help buyers browse.',
      categoriesRemoveLabel: 'Remove category',
      categoriesRemoveWarning:
        'Removing a category won\'t change items already assigned to it.',
      categoriesEmpty: 'No categories yet. Add one below to get started.',
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

/**
 * Human labels for the four biosecurity flag levels, including `none`.
 * Used by the itinerary inline biosecurity pill and anywhere a flag is shown.
 */
export const BIOSEC_FLAG_LABELS: Record<string, string> = {
  none: 'None',
  declare: 'Declare',
  high_risk: 'High risk',
  prohibited: 'Prohibited',
}
