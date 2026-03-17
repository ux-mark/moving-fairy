# Phase 3: Box Sticker Scanning + Inventory Verification -- UX Design Spec

**Author**: UXicorn
**Date**: 2026-03-17
**Status**: Design spec (no code)
**Depends on**: Phase 1 (decisions list, batch upload), Phase 2 (per-item chat)

---

## Table of contents

1. [Design problem](#1-design-problem)
2. [Entry point](#2-entry-point)
3. [Sticker upload flow](#3-sticker-upload-flow)
4. [Processing state (async)](#4-processing-state-async)
5. [Reconciliation UI](#5-reconciliation-ui)
6. [Flagged items (non-ship verdicts)](#6-flagged-items-non-ship-verdicts)
7. [Confirmation and ready to ship](#7-confirmation-and-ready-to-ship)
8. [Box sticker image display](#8-box-sticker-image-display)
9. [All states by component](#9-all-states-by-component)
10. [Component inventory](#10-component-inventory)
11. [Accordion cropping fix](#11-accordion-cropping-fix)
12. [Responsive considerations](#12-responsive-considerations)
13. [Microcopy](#13-microcopy)
14. [Accessibility](#14-accessibility)
15. [Animation](#15-animation)

---

## 1. Design problem

The user has physically packed their boxes. They wrote item lists on stickers and stuck them to the outside of each box. Now they are sitting on the floor surrounded by sealed boxes, phone in hand, and they want the app to know what is inside each one.

The core tension is between **speed** (the user wants to scan all their boxes quickly and move on with their life) and **accuracy** (the system needs to catch items that should not be shipped -- a SELL-verdict KitchenAid in a ship box is a real problem that costs money and time at the other end).

The design must serve speed first: upload a photo, get immediate feedback, keep scanning. The reconciliation and flagging happen asynchronously and can be reviewed afterward. The user should never feel blocked by the system thinking.

**Primary persona**: The Straight-Line Emigrant, standing in their kitchen surrounded by packed boxes, phone in one hand. One-handed use is essential. They are tired, stressed, and just want to get this done.

**Secondary persona**: The Two-Leg Planner, who cares deeply about what ends up in each box because they will ship again later. Accuracy matters more to them, but they still want speed.

---

## 2. Entry point

### Decision: Button inside the expanded BoxCard accordion

The entry point for sticker scanning is a "Scan box sticker" button inside each BoxCard's expanded content area. Not a FAB, not a separate page.

**Rationale**: The user's mental model is "I have this physical box in front of me." They find the matching box in the app, expand it, and scan. The action belongs to a specific box, so the trigger belongs inside that box's card. A floating action button on the page level would require the user to then select which box the sticker belongs to -- an unnecessary step.

**Placement**: The scan button sits below the item list and above the existing "Mark as packed" button. It appears for boxes in `packing` status only. Once a box is `packed`, `shipped`, or `arrived`, the scan button is hidden (but the sticker image, if one was uploaded, remains visible -- see section 8).

**Button design**:
- DS `Button` component, `variant="outline"`, `size="sm"`, full width (matching "Mark as packed")
- Icon: `Camera` from Lucide, left-positioned
- Label: "Scan box sticker"
- If a sticker has already been scanned and processed, the label changes to "Rescan box sticker" to make it clear they are replacing the previous scan

**Visual hierarchy**: The scan button is visually secondary to the item list but above the "Mark as packed" action. The intended reading order inside an expanded BoxCard is:

1. Item list (the content)
2. Add item combobox (add more content)
3. Scan box sticker (verify content)
4. Mark as packed (finalise)

This mirrors the physical packing flow: pack items, add stragglers, verify the list, seal the box.

---

## 3. Sticker upload flow

### 3.1 Triggering the camera

When the user taps "Scan box sticker", the browser's native file picker opens with `accept="image/*"` and `capture="environment"` (rear camera). On mobile, this opens the camera directly. On desktop, it opens the file picker.

There is no custom camera UI. The native camera/picker is the most reliable, most accessible, and most familiar interface. Users know how to take a photo with their phone. We do not need to teach them.

The file input is hidden (`display: none`). The "Scan box sticker" button clicks it programmatically.

### 3.2 Immediate feedback after upload

The moment the user selects/captures a photo:

1. The sticker image appears immediately as an inline thumbnail at the top of the expanded card content, above the item list. This uses a local object URL (`URL.createObjectURL`) -- no network round-trip needed for display.
2. A processing indicator appears below the thumbnail: the `ThinkingDots` DS component with the message "Aisling is reading your sticker..."
3. The "Scan box sticker" button changes to a disabled state with label "Scanning..." while the upload is in progress.
4. The image is uploaded to Supabase Storage via the existing `/api/upload` route (same WebP optimisation pipeline as item photos).
5. Once uploaded, the `manifest_image_url` is saved to the box record via `PATCH /api/boxes/:id`.
6. The scan processing endpoint is called (fire-and-forget, same pattern as `POST /api/assess/:id`).

**Critical**: The user is never blocked. They can collapse this BoxCard and start scanning another box immediately. The results will appear asynchronously via Supabase Realtime when they come back to this card.

### 3.3 Upload error handling

If the upload fails:
- The thumbnail remains visible (it is a local object URL, so it persists)
- The processing indicator is replaced by an inline error message: "Could not upload the photo. Check your connection and try again."
- The "Scan box sticker" button reappears with its normal label so the user can retry

---

## 4. Processing state (async)

### 4.1 What happens on the server

The scan endpoint receives the box ID and manifest image URL. It:

1. Calls the LLM with the sticker image and asks it to extract every item name from the handwritten list
2. For each extracted item name, runs fuzzy matching against the user's existing `item_assessment` records
3. For matched items: checks the verdict. If SHIP or CARRY, auto-assigns to the box via `add_item_to_box`. If SELL/DONATE/DISCARD, flags it.
4. For unmatched items: creates a new `item_assessment` record with `source: 'sticker_scan'`, `processing_status: 'pending'`, then fires a background assessment (same as text-add items)
5. For illegible entries: records them as illegible in the scan result
6. Writes a scan result record (or updates the box with scan metadata -- implementation detail left for Phase 3 build)

All of this happens asynchronously. The client picks up changes via Supabase Realtime:
- New `item_assessment` INSERTs (for newly created items)
- `item_assessment` UPDATEs (for assessments completing)
- `box_item` changes (for items being added to the box)

### 4.2 Progressive results in the UI

As the LLM reads the sticker and items are processed, they appear progressively in the BoxCard's item list. The user sees items materialise one by one, exactly as batch photo upload items appear on the decisions list.

There is no separate "reconciliation screen" that the user must navigate to. The results appear in-place inside the box they belong to. This is the critical design decision: the reconciliation happens inside the existing BoxCard, not in a separate view.

**Why not a separate reconciliation page?** Because it would break the user's flow. They are scanning multiple boxes. Navigating away to a reconciliation screen for each box is friction. The results should come to the user, not the other way around.

### 4.3 The scan summary banner

When the scan processing begins, a `StickerScanSummary` component appears inside the BoxCard, between the sticker thumbnail and the item list. This summary updates in real time as results arrive:

**During processing** (at least one item still resolving):
> "Reading your sticker... Found 3 items so far"

**When complete, no issues**:
> "Found 8 items on your sticker. 6 matched your existing items, 2 are new and being assessed."

**When complete, with flags**:
> "Found 8 items on your sticker. 5 matched, 2 are new, 1 has a warning."
> (The "1 has a warning" text links/scrolls to the flagged item card)

**When complete, with illegible entries**:
> "Found 7 items on your sticker. 1 entry could not be read -- you can add it manually below."

The summary banner uses `role="status"` and `aria-live="polite"` so screen readers announce updates without interrupting the user.

---

## 5. Reconciliation UI

### 5.1 Design decision: no separate reconciliation view

Reconciliation happens inline within the BoxCard. Each item extracted from the sticker falls into one of four categories, and each category is handled differently in the existing item list:

### 5.2 Matched items (auto-assigned)

Items that fuzzy-match an existing assessed item with a SHIP or CARRY verdict are silently added to the box. They appear in the item list as normal BoxCard items -- thumbnail, verdict dot, name, verdict badge. No special treatment needed. The user sees their box populating with recognised items.

These items have a subtle `from_handwritten_list: true` indicator in the data, but the UI does not surface this distinction. An item is an item regardless of how it got into the box.

### 5.3 New items (pending assessment)

Items that do not match any existing assessment are created as new `item_assessment` records with `source: 'sticker_scan'`. They appear in the item list with the same pending state as any other item being assessed:

- Name (from the sticker)
- No verdict badge (assessment is pending)
- The `ThinkingDots` component replaces the verdict badge while processing
- Once assessment completes, the verdict badge fades in (same animation as decisions list cards)

If the assessment returns a non-SHIP verdict (SELL, DONATE, DISCARD), the item becomes a flagged item (see section 6).

### 5.4 Flagged items (non-ship verdicts)

See section 6 for the full flagged item design.

### 5.5 Illegible items

Items the LLM could not read appear as a distinct entry at the bottom of the scan summary banner:

> "1 entry could not be read"

Followed by a hint: "You can add it manually using the search box below."

The illegible entries are not added to the item list -- they do not exist as records. The user's action path is clear: use the existing add-item combobox to type the item name manually. This reuses existing UI and does not require any new components.

If there are multiple illegible entries, the message pluralises: "3 entries could not be read."

---

## 6. Flagged items (non-ship verdicts)

This is the most important UX element in the entire feature. If a user has packed a SELL-verdict KitchenAid mixer in a ship box, we need to surface this clearly and give them actionable choices.

### 6.1 When flagging occurs

A flag is raised when:
- A sticker item fuzzy-matches an existing item with a verdict of SELL, DONATE, or DISCARD
- A sticker item's newly completed assessment returns a verdict of SELL, DONATE, or DISCARD
- A sticker item fuzzy-matches an existing item with a REVISIT verdict (lower urgency, but still worth flagging)

### 6.2 Flagged item card design

Flagged items appear in the BoxCard's item list, but with a distinct warning treatment. They are not hidden or separated into a different section -- they appear inline, in alphabetical order with all other items, so the user sees the full picture. The distinction is visual:

**FlaggedItemCard** renders as a full-width card within the item list, visually distinct from normal item rows:

- **Background**: `var(--color-bg-warning)` (a warm, light amber -- not red, which implies error)
- **Left border**: 3px solid `var(--verdict-sell)` (amber) for SELL items, `var(--color-text-muted)` for DONATE/DISCARD
- **Icon**: `AlertTriangle` from Lucide, amber, 16px
- **Item name**: The item name, in semibold
- **Warning message**: One line, specific to the verdict:
  - SELL: "This item was assessed as sell. Are you sure you want to ship it?"
  - DONATE: "This item was assessed as donate. Are you sure you want to ship it?"
  - DISCARD: "This item was assessed as discard. Are you sure you want to ship it?"
  - REVISIT: "This item still needs review. Open the conversation with Aisling to decide."

**Action buttons** (arranged as a row, all meeting 44px minimum touch targets):

1. **"Ship it anyway"** -- DS `Button`, `variant="outline"`, `size="sm"`. Overrides the verdict to SHIP, keeps the item in the box. This calls `PATCH /api/items/:id` with `{ verdict: 'SHIP' }` and adds the item to the box.
2. **"Remove from box"** -- DS `Button`, `variant="ghost"`, `size="sm"`. Removes the fuzzy-matched item from the box without changing its verdict. The item remains in the user's inventory with its current verdict.
3. **"Ask Aisling"** -- DS `Button`, `variant="ghost"`, `size="sm"`. Navigates to `/decisions/:id` to open the per-item chat, where the user can discuss the item with Aisling and make an informed decision.

### 6.3 Flagged item count in summary

The scan summary banner (section 4.3) includes the flagged item count prominently. If there are flagged items, the summary has a warning treatment:

- The summary text changes to include an amber-coloured count: "1 item needs your attention"
- If multiple: "3 items need your attention"

### 6.4 Flagged items in the accordion header

When a box has unresolved flagged items, the BoxCard header (the always-visible collapsed state) shows a small amber dot next to the item count. This ensures the user can see at a glance which boxes need attention, even when all accordions are collapsed.

The dot disappears when all flagged items in that box have been resolved (either shipped anyway, removed, or verdict changed after chatting with Aisling).

---

## 7. Confirmation and ready to ship

### 7.1 No separate confirmation step

There is no "Confirm all items" flow. The scan populates the box, the user reviews the results inline, deals with any flags, and then uses the existing "Mark as packed" button when they are satisfied.

**Rationale**: Adding a confirmation step between scanning and packing would be a speed bump in a flow that should be fast. The user's confirmation is implicit in their decision to mark the box as packed. If they see a flag and ignore it, that is their choice. If they want to review more carefully, they can expand the card and look at every item.

### 7.2 Relationship to "Mark as packed"

The "Mark as packed" button remains unchanged. It still opens the existing `ConfirmDialog` and transitions the box from `packing` to `packed`.

However, if a box has unresolved flagged items when the user taps "Mark as packed", the confirmation dialog copy changes to surface the warning:

**Normal** (no flags):
> Title: "Mark as packed?"
> Description: "Mark Kitchen 1 as packed? You can still edit it later."

**With flags**:
> Title: "Mark as packed?"
> Description: "Kitchen 1 has 2 items that were not assessed as ship. Mark as packed anyway?"
> Confirm label changes from "Yes, packed" to "Pack anyway"

This is a nudge, not a block. The user can still proceed.

### 7.3 Ready to ship flow

The "Ship all" button (already implemented) marks all packing/packed boxes as shipped. This flow is unchanged. The sticker scanning feature does not alter the shipping flow -- it enriches the packing flow.

---

## 8. Box sticker image display

### 8.1 Placement

The uploaded sticker photo appears as an inline element inside the BoxCard's expanded content, at the top, above the scan summary and item list. It is always visible when the accordion is open and a sticker has been uploaded, regardless of box status.

### 8.2 Thumbnail presentation

- **Size**: Full width of the expanded content area, max-height 200px on mobile, 240px on desktop
- **Object fit**: `object-fit: cover` to handle varying aspect ratios without distortion
- **Border radius**: `var(--radius-md)` to match the card's design language
- **Image source**: Proxied through `/api/img?url=` (same as item thumbnails) to avoid CORS issues

### 8.3 Full-view expansion

Tapping the thumbnail opens the image in a full-screen overlay (a simple lightbox). This lets the user compare the physical sticker to the digital item list at full resolution.

The lightbox is a minimal component:
- Full-viewport overlay with `background: rgba(0, 0, 0, 0.9)`
- The image at native resolution, constrained to viewport with `object-fit: contain`
- Close button (X) in the top-right corner, plus tap-anywhere-to-close
- Escape key closes
- `role="dialog"`, `aria-label="Sticker photo for [box label]"`, focus trap

### 8.4 Re-scanning

If the user taps "Rescan box sticker" (the button label when a sticker already exists), the new photo replaces the old one. The old `manifest_image_url` is overwritten. Previously reconciled items remain in the box -- the rescan does not remove them. New matches from the rescan are added; duplicates (items already in the box) are silently skipped.

A `ConfirmDialog` appears before rescan: "Rescan this box? The new sticker photo will replace the current one. Items already in the box will not be removed."

---

## 9. All states by component

### 9.1 StickerScanSummary

| State | Display |
|-------|---------|
| **No sticker** | Component not rendered. The "Scan box sticker" button is visible instead. |
| **Uploading** | Sticker thumbnail (from local URL) + "Uploading your sticker photo..." with Spinner |
| **Processing** | Sticker thumbnail + "Aisling is reading your sticker..." with ThinkingDots + progressive item count |
| **Partial** | Sticker thumbnail + "Found N items so far..." + items appearing in the list below |
| **Success (clean)** | Sticker thumbnail + "Found N items. M matched, K are new and being assessed." |
| **Success (with flags)** | Sticker thumbnail + "Found N items. M matched, K are new. J need your attention." (amber treatment) |
| **Success (with illegible)** | Sticker thumbnail + "Found N items. L could not be read -- add them manually below." |
| **Error (upload failed)** | Sticker thumbnail (local) + "Could not upload the photo. Check your connection and try again." + retry button |
| **Error (scan failed)** | Sticker thumbnail (from storage) + "Aisling could not read this sticker. The photo may be too blurry or dark. Try taking another photo." + "Rescan" button |

### 9.2 FlaggedItemCard

| State | Display |
|-------|---------|
| **Unresolved** | Full warning card with amber background, warning message, three action buttons |
| **Resolving** | "Ship it anyway" button shows Spinner, other buttons disabled |
| **Resolved (shipped anyway)** | Card transitions to a normal item row. The item now has a SHIP verdict. Smooth crossfade animation (150ms). |
| **Resolved (removed)** | Card exits the list with the standard `AnimatePresence` exit animation (opacity 0, x: 12) |

### 9.3 StickerThumbnail

| State | Display |
|-------|---------|
| **Loading** | Skeleton placeholder at the thumbnail dimensions |
| **Loaded** | Image displayed with border-radius, tappable to open lightbox |
| **Error** | Placeholder with a broken-image icon and text "Photo could not be loaded" |

### 9.4 StickerLightbox

| State | Display |
|-------|---------|
| **Open** | Full-viewport overlay, image, close button. Body scroll locked. |
| **Closed** | Not rendered. |

---

## 10. Component inventory

### 10.1 StickerScanButton

**Purpose**: Triggers the sticker photo capture/upload flow.

**Props**:
```typescript
interface StickerScanButtonProps {
  boxId: string;
  boxLabel: string;
  hasExistingSticker: boolean;
  onScanStart: (boxId: string, file: File) => void;
  isScanning: boolean;
}
```

**Where it lives**: Inside BoxCard's `expandedInner`, between the add-item section and the "Mark as packed" button.

**Composes**: DS `Button`, Lucide `Camera` icon, hidden `<input type="file">`.

**Key states**: Default, scanning (disabled + "Scanning..."), rescan variant ("Rescan box sticker").

### 10.2 StickerThumbnail

**Purpose**: Displays the uploaded sticker photo with tap-to-expand.

**Props**:
```typescript
interface StickerThumbnailProps {
  imageUrl: string | null;      // Could be local object URL or storage URL
  boxLabel: string;
  onExpand: () => void;
  isLoading?: boolean;
}
```

**Where it lives**: Inside BoxCard's `expandedInner`, at the very top (above item list and summary).

**Composes**: Standard `<img>`, DS `Skeleton` for loading state.

**Key states**: Loading (skeleton), loaded (image), error (placeholder).

### 10.3 StickerLightbox

**Purpose**: Full-screen view of the sticker photo.

**Props**:
```typescript
interface StickerLightboxProps {
  imageUrl: string;
  boxLabel: string;
  isOpen: boolean;
  onClose: () => void;
}
```

**Where it lives**: Rendered at the root level (portal or top of BoxCard tree) to escape overflow clipping.

**Composes**: Framer Motion `AnimatePresence` for enter/exit, Lucide `X` for close button.

**Key states**: Open, closed.

### 10.4 StickerScanSummary

**Purpose**: Shows the progress and results of a sticker scan.

**Props**:
```typescript
interface StickerScanSummaryProps {
  status: 'uploading' | 'processing' | 'partial' | 'complete' | 'error';
  totalFound: number;
  matchedCount: number;
  newCount: number;
  flaggedCount: number;
  illegibleCount: number;
  errorMessage?: string;
  onRetry?: () => void;
}
```

**Where it lives**: Inside BoxCard's `expandedInner`, between StickerThumbnail and the item list.

**Composes**: DS `ThinkingDots`, DS `Spinner`, DS `Button` (for retry).

**Key states**: All states from section 9.1.

### 10.5 FlaggedItemCard

**Purpose**: Renders a warning card for an item with a non-ship verdict that was found on the sticker.

**Props**:
```typescript
interface FlaggedItemCardProps {
  itemName: string;
  itemId: string;          // item_assessment_id
  verdict: 'SELL' | 'DONATE' | 'DISCARD' | 'REVISIT';
  boxId: string;
  boxLabel: string;
  onShipAnyway: (itemId: string, boxId: string) => void;
  onRemoveFromBox: (itemId: string, boxId: string) => void;
  isResolving?: boolean;
}
```

**Where it lives**: Inside BoxCard's item list (`.itemList`), rendered in place of a normal item row for flagged items.

**Composes**: DS `Button`, Lucide `AlertTriangle`, `Link` (for "Ask Aisling" navigation to `/decisions/:id`).

**Key states**: Unresolved, resolving (spinner on action button), resolved (transitions to normal item row or exits).

### 10.6 FlagIndicator

**Purpose**: Amber dot shown on BoxCard headers when unresolved flags exist.

**Props**:
```typescript
interface FlagIndicatorProps {
  count: number;      // Number of unresolved flags. 0 = hidden.
}
```

**Where it lives**: Inside BoxCard's `.headerMeta`, next to the item count.

**Composes**: Simple `<span>` with amber background.

**Key states**: Visible (count > 0), hidden (count === 0). Animates in/out with Framer Motion scale.

### 10.7 Component tree (addition to existing)

```
BoxCard (existing)
  header (existing)
    FlagIndicator (new) .............. amber dot when flags exist
  expandedInner (existing)
    StickerThumbnail (new) ........... sticker photo at top
    StickerScanSummary (new) ......... progress/results banner
    itemList (existing)
      FlaggedItemCard (new) .......... replaces normal item row for flagged items
      motion.li (existing) ........... normal item rows
    addSection (existing)
    StickerScanButton (new) .......... between add section and mark-packed
    markPackedRow (existing)

StickerLightbox (new) ................ rendered via portal, outside BoxCard tree
```

---

## 11. Accordion cropping fix

### 11.1 Root cause analysis

Three `overflow: hidden` declarations create a clipping chain:

1. **`.expandedContent`** (BoxCard.module.css, line 119): `overflow: hidden` -- required by Framer Motion's `height: 0 → auto` animation. Without it, content is visible before the animation starts.
2. **`.card`** at mobile (BoxCard.module.css, line 550): `overflow-x: hidden` -- added to prevent the size-picker dropdown from overflowing the card on narrow screens.
3. **`.body`** (AppLayout.module.css, line 65): `overflow: hidden` -- prevents the body from scrolling independently of `.main`.

### 11.2 Recommended fix

**Fix 1: `.expandedContent` -- clip only during animation, not at rest.**

Replace `overflow: hidden` with a dynamic approach. The Framer Motion animation needs overflow hidden only during the height transition (to clip content while the container grows from 0). Once the animation completes, overflow should be visible.

Implementation approach: Use Framer Motion's `onAnimationComplete` callback to toggle a CSS class. During animation: `overflow: hidden`. After animation completes: `overflow: visible`. On exit animation start: revert to `overflow: hidden`.

```
/* BoxCard.module.css */
.expandedContent {
  /* Remove the static overflow: hidden */
}

.expandedContentAnimating {
  overflow: hidden;
}

.expandedContentResting {
  overflow: visible;
}
```

In the BoxCard component, manage a state variable `isAnimating` that is `true` during enter/exit animations and `false` at rest. Apply the appropriate class with `cn()`.

**Fix 2: `.card` at mobile -- remove `overflow-x: hidden`.**

The size-picker dropdown already uses `position: fixed` (or absolute with right: 0), which means it does not overflow the card. The `overflow-x: hidden` was added as a safety net but is no longer needed since the combobox dropdown already uses fixed positioning with viewport-aware clamping. Remove it.

If the size-picker dropdown needs containment on mobile, use `right: 0` (already in place at line 554-556 of the existing CSS) instead of clipping the entire card.

**Fix 3: `.body` -- change to `overflow: visible` on the cross axis only.**

The `.body` element needs `overflow: hidden` on the x-axis to prevent horizontal scroll (a hard requirement) but does not need it on the y-axis -- `.main` handles vertical scrolling.

```css
.body {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow-x: hidden;  /* Keep: prevents horizontal scroll */
  overflow-y: visible; /* Change: allows content to paint outside */
}
```

However, this may cause `.body` to expand beyond the viewport on some browsers. A safer approach: keep `overflow: hidden` on `.body` but ensure that the combobox dropdown (the primary victim of clipping) continues to use `position: fixed` with viewport-aware positioning, which escapes the overflow context entirely.

**Net recommendation**: Fix 1 (dynamic overflow on `.expandedContent`) is the highest priority and resolves most clipping issues. Fix 2 (remove mobile `overflow-x: hidden` on `.card`) is safe and should be done. Fix 3 is lower priority -- the fixed-positioning approach for dropdowns already bypasses the `.body` clipping, and the StickerLightbox will use a portal to render outside the entire card tree.

### 11.3 Impact on new components

- **StickerLightbox**: Must render via a React portal to `document.body` (or a dedicated portal root). This ensures it is completely outside the BoxCard's overflow context.
- **StickerThumbnail**: Contained within `.expandedInner` -- no overflow issues since it respects the card's width.
- **FlaggedItemCard**: Contained within `.itemList` -- no overflow issues.
- **StickerScanSummary**: Contained within `.expandedInner` -- no overflow issues.

---

## 12. Responsive considerations

### 12.1 Mobile (320px) -- primary use case

This is where most users will experience sticker scanning. They are standing next to their boxes with their phone.

- **Scan button**: Full width, 44px minimum height, `Camera` icon + "Scan box sticker" label
- **Sticker thumbnail**: Full width of expanded content area minus padding (288px at 320px viewport), `max-height: 200px`, `object-fit: cover`
- **Scan summary**: Full width, text wraps naturally, font-size 16px (never smaller on mobile)
- **FlaggedItemCard**: Full width, action buttons stack vertically (column layout) to fit within 288px. Each button is full width, 44px height. Button order top to bottom: "Ship it anyway", "Remove from box", "Ask Aisling".
- **Lightbox**: Full viewport, close button in top-right with 44px touch target, `safe-area-inset` padding on iOS for the notch
- **File input `capture="environment"`**: Opens rear camera directly on iOS and Android

### 12.2 Tablet (768px)

- **Sticker thumbnail**: Same width as mobile (constrained by card max-width of 672px), `max-height: 220px`
- **FlaggedItemCard**: Action buttons can sit in a row (horizontal layout) since there is more width
- **Lightbox**: Same as mobile, larger image

### 12.3 Desktop (1280px)

- **Sticker thumbnail**: Constrained by card max-width (672px), `max-height: 240px`
- **FlaggedItemCard**: Action buttons in a row, aligned right
- **File input**: No `capture` attribute relevance on desktop. Opens standard file picker. User selects a photo from their filesystem.
- **Lightbox**: Full viewport, image centered with generous padding

### 12.4 Layout constraints

- No horizontal scroll at any viewport. The card is already constrained to `max-width: 672px` by the boxes page layout.
- All touch targets minimum 44x44px on mobile and tablet.
- All text at minimum 16px on mobile (no 13px or 14px text on phone screens).
- The sticker thumbnail does not create a horizontal overflow -- it is `width: 100%` within the padded content area.

---

## 13. Microcopy

### 13.1 Scan button labels

| Context | Label |
|---------|-------|
| No sticker uploaded yet | "Scan box sticker" |
| Sticker already exists, packing status | "Rescan box sticker" |
| Upload/scan in progress | "Scanning..." (disabled) |

### 13.2 Processing messages

| State | Message |
|-------|---------|
| Uploading photo | "Uploading your sticker photo..." |
| LLM reading sticker | "Aisling is reading your sticker..." |
| Progressive (during processing) | "Reading your sticker... Found 3 items so far" |

### 13.3 Reconciliation summary text

| Outcome | Message |
|---------|---------|
| All matched, no issues | "Found 8 items on your sticker. All matched items you have already assessed." |
| Mixed matched and new | "Found 8 items on your sticker. 5 matched your existing items, 3 are new and being assessed." |
| With flags | "Found 8 items on your sticker. 5 matched, 2 are new. 1 item needs your attention." |
| With illegible entries | "Found 7 items on your sticker. 1 entry could not be read -- you can add it manually below." |
| With flags and illegible | "Found 8 items on your sticker. 5 matched, 2 are new. 1 item needs your attention. 1 entry could not be read." |
| Single item found | "Found 1 item on your sticker." |
| No items found | "Aisling could not find any item names on this sticker. The handwriting may be too faint or the photo too blurry. Try taking another photo in better light." |

### 13.4 Flag/warning messages

| Verdict | Warning on FlaggedItemCard |
|---------|---------------------------|
| SELL | "This item was assessed as sell -- shipping it would cost more than it is worth. Are you sure?" |
| DONATE | "This item was assessed as donate. Are you sure you want to ship it?" |
| DISCARD | "This item was assessed as discard. Are you sure you want to ship it?" |
| REVISIT | "This item still needs review. Chat with Aisling to decide before packing it." |

### 13.5 Action button labels

| Action | Label |
|--------|-------|
| Override verdict and keep in box | "Ship it anyway" |
| Remove item from box | "Remove from box" |
| Open per-item chat | "Ask Aisling" |

### 13.6 Confirmation messages

| Action | Confirmation |
|--------|-------------|
| Ship it anyway | Toast: "[Item name] will be shipped. Verdict updated." |
| Remove from box | Toast: "[Item name] removed from [box label]." |
| Rescan confirmation dialog | Title: "Rescan this box?" Description: "The new sticker photo will replace the current one. Items already in the box will not be removed." Confirm: "Take new photo" Cancel: "Keep current photo" |
| Mark as packed (with flags) | Title: "Mark as packed?" Description: "[Box label] has [N] items that were not assessed as ship. Mark as packed anyway?" Confirm: "Pack anyway" Cancel: "Review items" |

### 13.7 Error messages

| Error | Message |
|-------|---------|
| Upload failed (network) | "Could not upload the photo. Check your connection and try again." |
| Scan failed (LLM error) | "Aisling could not read this sticker. Try taking another photo in better light." |
| Scan failed (server error) | "Something went wrong while scanning your sticker. Please try again." |
| Item assignment failed | "Could not add [item name] to [box label]. Please try again." |

### 13.8 Empty state copy

| Context | Copy |
|---------|------|
| Box with no sticker and no items | "No items in this box yet. Scan your box sticker or add items manually." |
| Box with sticker but no items resolved yet | "Aisling is reading your sticker. Items will appear here as they are identified." |

---

## 14. Accessibility

### 14.1 Screen reader announcements

**Scan initiation**: When the user activates "Scan box sticker", the button's `aria-label` is "Scan box sticker for [box label]". The hidden file input has `aria-label="Take a photo of the box sticker for [box label]"`.

**Processing progress**: The `StickerScanSummary` uses `role="status"` and `aria-live="polite"`. As the LLM extracts items, screen readers announce: "Reading your sticker. Found 3 items so far." When complete: "Scan complete. Found 8 items on your sticker. 5 matched, 2 are new, 1 item needs your attention."

**Flagged items**: Each `FlaggedItemCard` begins with a visually hidden label: "Warning:". The full card is read as: "Warning: KitchenAid Stand Mixer. This item was assessed as sell. Shipping it would cost more than it is worth." followed by the action buttons.

**Lightbox**: The lightbox has `role="dialog"`, `aria-modal="true"`, and `aria-label="Sticker photo for [box label]"`. Focus is trapped within the lightbox while open. The close button has `aria-label="Close photo"`.

**Toast confirmations**: Toast messages use `role="status"` (already implemented in the DS `Toast` component).

### 14.2 Keyboard navigation

**Tab order within expanded BoxCard** (additions in context):

1. Sticker thumbnail (Enter/Space to open lightbox)
2. Item list rows (each is a link to the item detail page)
3. FlaggedItemCard action buttons (Tab through "Ship it anyway", "Remove from box", "Ask Aisling")
4. Add item combobox input
5. "Scan box sticker" button
6. "Mark as packed" button

**Lightbox keyboard**:
- Escape: close
- Tab: trapped within lightbox (only the close button is focusable)
- On close, focus returns to the sticker thumbnail that opened it

**FlaggedItemCard keyboard**:
- Tab moves between the three action buttons
- Enter/Space activates the focused button
- After an action resolves the flag (ship anyway or remove), focus moves to the next item in the list, or to the scan summary if no items remain

### 14.3 Focus management

**After scan completes**: Focus stays wherever the user left it. No automatic focus movement -- the scan is non-interruptive. The `aria-live` region announces the results.

**After resolving a flagged item**: If the item is removed from the list (remove from box), focus moves to the next item row. If there is no next item, focus moves to the add-item combobox. This prevents focus from being lost when the flagged card exits the DOM.

**After lightbox close**: Focus returns to the `StickerThumbnail` that triggered the lightbox.

### 14.4 ARIA attributes summary

| Element | ARIA |
|---------|------|
| StickerScanButton | `aria-label="Scan box sticker for [box label]"` |
| Hidden file input | `aria-label="Take a photo of the box sticker for [box label]"` |
| StickerThumbnail | `role="button"`, `aria-label="View sticker photo for [box label]. Tap to enlarge."` |
| StickerScanSummary | `role="status"`, `aria-live="polite"`, `aria-atomic="true"` |
| FlaggedItemCard | `role="group"`, `aria-label="Warning: [item name] assessed as [verdict]"` |
| StickerLightbox | `role="dialog"`, `aria-modal="true"`, `aria-label="Sticker photo for [box label]"` |
| FlagIndicator (header dot) | `aria-label="[N] items need attention"`, or `aria-hidden="true"` if 0 |

---

## 15. Animation

All animations respect `prefers-reduced-motion` via `useReducedMotion()`. When reduced motion is preferred, all transitions are instant (duration: 0).

### 15.1 Scan summary appearance

The scan summary banner fades in when scanning begins: `opacity: 0 -> 1`, 200ms ease-out. The item count within the summary updates with a subtle scale pulse: `scale: 1.05 -> 1`, 200ms, matching the existing item count animation on BoxCard headers.

### 15.2 Item materialisation

Items appearing in the list from scan results use the existing BoxCard item animation: `initial={{ opacity: 0, y: -4 }}`, `animate={{ opacity: 1, y: 0 }}`, 150ms. This is already implemented and does not need new work.

### 15.3 Flagged item card

The FlaggedItemCard enters with the same item animation as normal rows. When resolved (removed from box), it exits with the existing exit animation: `opacity: 0, x: 12`, 150ms. When resolved (shipped anyway), it crossfades to a normal item row: the amber background fades to transparent over 200ms, and the warning content is replaced by the standard item row content.

### 15.4 Flag indicator (header dot)

The amber dot on the BoxCard header appears with `scale: 0 -> 1`, spring (stiffness: 400, damping: 25). It disappears with `scale: 1 -> 0`, 150ms ease-in. This is a small, purposeful animation that draws the eye to the flag count without being disruptive.

### 15.5 Lightbox

Enter: background fades from transparent to `rgba(0,0,0,0.9)` over 200ms. Image scales from 0.95 to 1 over 200ms. Exit: reverse. These are standard lightbox transitions that feel native.

### 15.6 Sticker thumbnail loading

The thumbnail placeholder (skeleton) crossfades to the loaded image over 150ms. Uses `onLoad` on the `<img>` element to trigger the transition.

---

## Appendix A: Data flow

```
User taps "Scan box sticker"
  -> Native camera opens (capture="environment")
  -> User takes photo

Photo selected
  -> Local object URL created for immediate thumbnail display
  -> POST /api/upload { file }
  -> Response: { url: "https://storage.../manifest.webp" }
  -> PATCH /api/boxes/:id { manifest_image_url: url }
  -> POST /api/boxes/:id/scan { manifest_image_url: url }  (fire-and-forget)

Server: POST /api/boxes/:id/scan
  -> Load box and user profile
  -> Call LLM with sticker image: "Extract all item names from this handwritten list"
  -> For each extracted item name:
      -> Fuzzy match against user's item_assessment records
      -> If matched + SHIP/CARRY verdict:
          -> add_item_to_box(box_id, item_assessment_id)
          -> Client sees new box_item via Realtime
      -> If matched + SELL/DONATE/DISCARD/REVISIT verdict:
          -> Write flag record (scan result metadata)
          -> Client sees flag data via Realtime or poll
      -> If no match:
          -> POST /api/items { item_name, source: 'sticker_scan' }
          -> add_item_to_box(box_id, new_item_assessment_id)
          -> POST /api/assess/:id (fire-and-forget — assessment runs in background)
          -> Client sees new item_assessment + box_item via Realtime
      -> If illegible:
          -> Record in scan result metadata
  -> Write scan result summary
  -> Client picks up summary via Realtime or poll
```

## Appendix B: API endpoints (new or modified)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/boxes/:id/scan` | POST | Initiate sticker scan processing. Accepts `{ manifest_image_url }`. Returns `{ scan_id }`. Fire-and-forget on the client side. |
| `/api/boxes/:id` | PATCH | Existing. Now also accepts `manifest_image_url` to store the sticker photo. |
| `/api/boxes/:id/scan/:scanId` | GET | Poll scan progress. Returns `{ status, total_found, matched, new, flagged, illegible, items: [...] }`. Used as a fallback if Realtime misses events. |
| `/api/items/:id` | PATCH | Existing. Used by "Ship it anyway" to override verdict to SHIP. |
| `/api/boxes/:id/items/:itemId` | DELETE | Existing. Used by "Remove from box". |

## Appendix C: New DB considerations

The scan result metadata (total found, matched count, flagged items, illegible entries) needs a place to live. Two options:

**Option A: Scan result table** (recommended). A new `box_scan` table:
- `id` (UUID, PK)
- `box_id` (FK -> box)
- `status` ('processing' | 'complete' | 'failed')
- `total_found` (integer)
- `matched_count` (integer)
- `new_count` (integer)
- `flagged_count` (integer)
- `illegible_count` (integer)
- `illegible_entries` (text[], the raw strings the LLM could not parse)
- `flagged_items` (JSONB, array of `{ item_assessment_id, verdict }`)
- `created_at`, `updated_at`

This table supports Realtime subscriptions so the client can track scan progress without polling.

**Option B: JSONB on the box table**. Add a `scan_result` JSONB column to the box table. Simpler but less clean for Realtime (entire box record fires on every update).

Option A is recommended for cleaner separation and better Realtime granularity.

## Appendix D: Interaction with existing patterns

| Existing pattern | How sticker scan interacts |
|-----------------|---------------------------|
| Supabase Realtime (useItems) | New items from sticker scan appear on the decisions list automatically. The `useItems` hook already handles INSERT events. |
| BoxManagement state | BoxManagement needs to subscribe to box_item changes (or poll) to reflect items added by the scan. Currently it uses optimistic local state -- the scan adds items server-side, so BoxManagement needs a Realtime subscription or polling fallback for the box_items table. |
| Per-item chat (Phase 2) | "Ask Aisling" on FlaggedItemCard navigates to `/decisions/:id`, which already has the per-item chat. No changes needed to the chat system. |
| Light assessment | New items created from sticker scan with `source: 'sticker_scan'` go through the same `POST /api/assess/:id` pipeline as text-add items. No changes to the assessment system. |
| Batch photo upload | Sticker scan follows the identical async pattern: create record, fire assessment, Realtime delivers results. Consistency for the user and for the codebase. |
