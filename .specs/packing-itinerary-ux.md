---
name: packing-itinerary-ux
kind: design
owner: uxicorn
status: implementation-ready
---

# Packing + Itinerary UX — implementation spec

Two surfaces. **Surface 1 — Packing** (`/boxes` → `BoxManagement`): add a "currently active box" concept and make adding unboxed items into it a one-tap (mobile) / multi-select-or-drag (desktop) action; add a biosecurity nudge + badge on the box card. **Surface 2 — Itinerary** (`ItineraryView`): make each manifest line item editable in place (verdict, value, box, biosecurity flag).

This spec is built from the canonical law (`UX_STANDARDS.md`, `UX_PATTERNS.md`), the locked product decisions in the brief, the existing components, and the personas. It reuses the existing primitives — no new design tokens, no new DS components. Where it says "token" it means a CSS custom property already available from `@thefairies/design-system/styles/tokens.css` (the same ones `BoxCard.module.css` and `ItineraryView.module.css` already use: `--color-bg-card`, `--color-border-default`, `--color-text-muted`, `--color-primary`, `--color-warning-light/-dark`, `--color-focus`, `--radius-md/-lg`, the `--verdict-*` set, etc.). No magic numbers beyond the spacing already in those modules.

Persona grounding (`.specs/personas.md`): all three personas pack **on a phone while standing in the room with the item** (Persona 1, Behaviours: "Frequently uses their phone during sorting sessions — the app must be excellent on mobile"). So mobile tap-to-add is the **primary** path for the whole product; desktop multi-select/drag is the power-user enhancement. The Two-Leg Planner and Second-Leg Mover are biosecurity-anxious ("terrified of Australian customs… they'll fine you thousands for a dirty shoe") — the biosecurity nudge and the itinerary biosecurity column are load-bearing for them, not decoration.

---

## Conventions used by both surfaces

- **Responsive switch.** `useIsDesktop()` = `(min-width: 1024px)`. This is the existing whole-screen recomposition boundary used by `BoxList` and `ItineraryView` (desktop cockpit/rail vs stacked). Per `UX_STANDARDS.md` *Responsive Design* ("Fit beats viewport for control-level layout"), control-level wrap/stack stays **content-driven** (`flex-wrap`, `min-width: max-content`); `useIsDesktop` only drives the big layout swaps (table ⇄ stacked cards, drag-enabled ⇄ tap-only).
- **Save model = optimistic with rollback + toast**, matching the established app pattern (`BoxManagement.handleAddToBox`, `handleMarkPacked` mutate local state then `fetch`; `ItemEditPanel`/`ListingEditor` show a transient toast on success, inline error on failure). No surface uses a global spinner over the page.
- **Touch targets ≥ 44×44px** on every interactive control on mobile (`UX_STANDARDS.md` *Responsive Design*; Pattern 10). The existing modules already enforce this with `min-height: 44px` under `@media (max-width: 767px)` — follow that.
- **Reduced motion.** All new motion goes through `useReducedMotion()` (Framer) or a `prefers-reduced-motion: reduce` CSS guard, matching `BoxCard`.
- **Icons never stand alone** (`UX_STANDARDS.md` *Microcopy*). Every icon below is paired with a visible text label, except the already-sanctioned `×` close and `ChevronDown` affordances that supplement a labelled control.
- **Microcopy is sentence case, Irish English**, lives in `ownerCopy` (`src/lib/copy/owner.ts`). New keys are listed per surface. No ALL CAPS, no emoji, no truncation.

---

# Surface 1 — Packing (`/boxes`)

## 1.1 The "active box" concept

Today `BoxList` derives `availableBoxes` (status `packing`) and `UnboxedItems` lets each item open a per-row dropdown to pick *any* box. That per-item dropdown is fine as a fallback but it does not scale to "add ten things to the kitchen box" and gives no sense of *where* I'm packing right now. We introduce a single **active box** — the box new items flow into by default.

### State & ownership

- New state lives in **`BoxManagement`** (the existing client container that owns boxes/items): `const [activeBoxId, setActiveBoxId] = useState<string | null>(null)`.
- **Default selection** (smart default, `UX_STANDARDS.md` *Error Prevention*): on mount and whenever `boxes` changes, if `activeBoxId` is null or no longer points at a `packing` box, set it to the **most-recently-updated `packing` box** (`boxes` already carries `updated_at`; `BoxList` sorts freight by it). If there are zero packing boxes, `activeBoxId` stays `null`.
- Persist across reloads: mirror to `sessionStorage` key `mf_active_box` (per-session, matching the project's existing `sessionStorage`-for-view-state convention in Patterns 14/15). Read on mount; ignore if the id is not a current packing box.
- `activeBoxId`, `setActiveBoxId`, and the existing `availableBoxes` are threaded down: `BoxManagement → BoxList → (BoxCard, UnboxedItems)`.

### Active-box affordance — desktop (`useIsDesktop()` true)

The cockpit rail (`BoxList` `aside.cockpitRail`) already holds the packing summary + `UnboxedItems`. Add an **"Active box" selector** as the first card in the rail, above the stats:

- A `<section aria-labelledby="active-box-heading">` titled `<h3 id="active-box-heading">Packing into</h3>` (sentence case; "Packing into" reads better than "Active box" for the label and matches the voice).
- Below it, the active box rendered as a **`role="radiogroup"`** of the packing boxes (reuse the rail's card chrome). Each box is a `role="radio"` button showing `box.label` + item count; `aria-checked` on the active one; selected state uses `--color-primary` tint + a left accent bar (not colour alone — also bold weight + a `Check` icon with `aria-hidden`, satisfying "never rely on colour alone").
  - Keyboard: arrow keys move selection within the group, `Space`/`Enter` commits, `tabindex=0` on the active radio and `-1` on the rest (WAI-ARIA radiogroup), mirroring `VerdictPicker`'s roving-focus implementation.
  - If there are more than ~8 packing boxes the group is fine to scroll inside the rail card (`max-height` + `overflow-y:auto`), but do **not** add a search box — this is a small committed set, not a browse corpus (`UX_STANDARDS.md` *Recognition over Recall*, list-surface carve-out).
- The active box's card in the main column gets a persistent **"Packing into this box" marker**: a 3px left accent border in `--color-primary` and a small text chip `Active` in the `headerMeta` row of `BoxCard` (text, not icon-only). This is the recognition cue that ties the rail selection to the card the user is looking at.
- **Changeable**: clicking any packing box's card header *body* (not its edit controls) also sets it active, in addition to the radiogroup. Clicking the card's existing chevron/expand stays expand-only. (Active-set is a single click on the card surface; this is a visible affordance, not a hidden gesture.)

### Active-box affordance — mobile (`useIsDesktop()` false)

Phone is the primary surface. The active box must be **obvious and changeable without scrolling away from the items**.

- Add a **sticky "Packing into" bar** pinned to the top of the `/boxes` content region (`position: sticky; top: 0; z-index` above cards; respects `env(safe-area-inset-top)`). It shows:
  `Packing into  ⟶  [ Kitchen 1 ▾ ]   ·  3 items`
  - The box name is a single full-width-ish **button (≥44px)** labelled e.g. `Packing into Kitchen 1` (visible text), with a trailing `ChevronDown` (supplementary). Tapping it opens a **bottom sheet** listing the packing boxes as a `role="listbox"` (one option per box, ≥44px rows, current one `aria-selected` + `Check`). This reuses the bottom-sheet pattern already in the DS (`SidePanel`/sheet variant) — do not hand-roll a new overlay; if the sheet variant isn't exposed, reuse the existing `UnboxedItems` dropdown overlay chrome (`styles.backdrop` + menu) scaled to a sheet.
  - Sheet footer carries a `New box` tertiary action (reuses `CreateBoxPanel`) so the user can create-and-activate in one move — the common case when starting a new room.
- When there is **no packing box yet**, the bar reads `No active box yet` with a primary `New box` button inline. (Empty state, see 1.4.)

> Rule cited: `UX_STANDARDS.md` *Recognition over Recall* (no hidden gestures; visible affordance), *Navigation* (wayfinding — "where am I packing"), Pattern 10 (mobile side panel = full-screen/sheet overlay).

## 1.2 Adding unboxed items to the active box

`UnboxedItems` already exposes `onAddToBox(itemAssessmentId, boxId)` wired through to `BoxManagement.handleAddToBox`. We keep that contract and add the selection/drag layer **on top of it** — no API change.

### Mobile — tap to add (primary)

- Each row in `UnboxedItems` gets a **primary tap action: add to the active box**. The existing per-row `Add to box` dropdown is **replaced** on mobile by a single button: `Add to {activeBoxLabel}` (e.g. `Add to Kitchen 1`), full label, ≥44px. Tapping it calls `onAddToBox(item.id, activeBoxId)`.
  - This is the *one primary action per row* and removes the need to pick a box every time — the box was already chosen in the sticky bar (`UX_STANDARDS.md` *Flexibility and Efficiency*; *Information Hierarchy*).
  - A secondary affordance for "actually, a different box" stays available but **demoted**: a small `⋯ More` / "Add to another box…" link that opens the same bottom-sheet box picker for a one-off target. (Progressive disclosure — the common case is one tap; the exception is one extra tap.)
- If `activeBoxId` is `null` (no packing box), each row's button reads `Add to a box` and opens the picker sheet directly; the sheet's `New box` footer covers the zero-box case.
- **Post-add feedback (mobile):** the row animates out of the unboxed list (height+opacity collapse, reduced-motion = instant) and a **toast** appears: `Added {itemName} to {boxLabel}` with an **`Undo`** action (`UX_STANDARDS.md` *User Control and Freedom* — undo for reversible actions). Reuse the toast pattern already in `ListingEditor`/`ItineraryView` (`setToast(...)` + 3s timeout); add an action slot. Undo calls the existing `handleRemoveItem(boxId, boxItemId)`.

### Desktop — multi-select (primary) + drag-and-drop (enhancement)

**Multi-select is primary**; drag is the optional accelerator that must have multi-select as its non-drag fallback (brief requirement + `UX_STANDARDS.md` *Recognition over Recall*: "If a gesture exists, a visible alternative must also exist").

**Multi-select (primary):**
- `UnboxedItems` gains a multi-select mode. Each row shows a **checkbox** (`<input type="checkbox">`, real semantic control, ≥24px hit area but row is ≥44px) at its left; checking ≥1 item reveals a **selection action bar** at the top of the `UnboxedItems` card:
  `{N} selected   ·   [ Clear ]   [ Add {N} to {activeBoxLabel} ]`
  - The action bar follows *Action alignment* (`UX_STANDARDS.md`): this is a commit surface, so actions are **right-aligned**, order `Clear` (cancel-like, left) · `Add N to {box}` (primary, right). `Clear` deselects; primary calls `onAddToBox` for each selected id (sequential awaited calls; one toast summarising `Added N items to {boxLabel}` with `Undo` that removes all N).
  - "Select all" affordance: a header checkbox on the `UnboxedItems` heading row toggles all visible rows.
  - Keyboard: checkboxes are natively focusable/toggleable with `Space`; the action bar buttons are in normal tab order after the list.
- The primary button's target is the **active box** — so the active-box selector and multi-select compose: pick the box once (rail radiogroup), tick several items, hit `Add N to Kitchen 1`.
- Disabled-state honesty: if `activeBoxId` is null, the primary button is **not** silently disabled — it reads `Pick a box to pack into` and focuses/opens the rail selector on click (`UX_STANDARDS.md` *Error Prevention*: disabled controls must explain themselves; prefer guiding over dead-ending).

**Drag-and-drop (enhancement, desktop only):**
- Each unboxed row is a drag handle (`draggable`, the whole row; pointer + keyboard users are served by multi-select instead, so drag is purely additive). On `dragstart` set `dataTransfer` with the item id (and, if the dragged row is part of the current multi-selection, drag the whole selection — show a "N items" drag chip).
- **Drop targets** are the packing `BoxCard`s in the main column. On `dragenter`/`dragover` (with `preventDefault`) the target card shows a **drop-affordance ring** (2px dashed `--color-primary`, `--color-primary` 8%-tint fill) and its header reads `Drop to add to {boxLabel}`. On `drop`, call `onAddToBox` for the dragged id(s) → same optimistic add + toast as above. Dropping also **sets that box active** (the user clearly intends to pack into it).
- Drag is **gated to `useIsDesktop()`** (no touch DnD — phones use tap). Respect reduced-motion: the drop ring is a static outline, no pulsing.
- Accessibility for drag: drag is never the only path. The dragged rows always have the checkbox + `Add N to {box}` route. Don't add `role="application"` or custom DnD ARIA — keep the native fallback clean.

### Where `UnboxedItems` lives at each breakpoint (unchanged structure)

- Mobile: stacked below the box list (existing). The sticky "Packing into" bar sits above everything.
- Desktop: inside the cockpit rail card (existing). The rail order becomes: **Packing into selector → packing stats → Not yet boxed (UnboxedItems, with multi-select)**.

## 1.3 States (Surface 1)

| State | Behaviour |
|---|---|
| **Idle** | Active box chosen (default = most-recent packing box). Unboxed rows show `Add to {box}` (mobile) / checkbox + `Add to box` dropdown fallback (desktop). |
| **Selected (desktop)** | ≥1 checkbox ticked → selection action bar visible, right-aligned, `Add N to {box}` primary. |
| **Dragging (desktop)** | Source rows dimmed to 0.6 opacity; valid drop targets show dashed `--color-primary` ring + `Drop to add to {boxLabel}`; invalid targets (non-packing boxes, e.g. shipped) show no ring and `dragover` does not `preventDefault` (cursor = no-drop). |
| **Saving** | Optimistic: item removed from unboxed list immediately; the target `BoxCard` item count pulses (existing `motion.span` on count). If the row's add button was the trigger, it shows an inline `Adding…` label for the in-flight request only (no full-page spinner). |
| **Error** | Roll back: item reappears in the unboxed list in its sorted position; toast `Couldn't add {itemName} — check your connection and try again.` (error toast variant, `role="alert"`). Mirrors the copy style of the existing scan-error message. Multi-add: partial success is allowed — toast names the count that failed: `Added 3 of 5 — 2 couldn't be added. Try again.` and the 2 stay selected. |
| **Empty — no unboxed items** | Existing `UnboxedItems` "Everything's boxed up. Nice work." (keep; it's a correct, warm empty per `UX_PATTERNS.md` Pattern 6). The multi-select chrome and selection bar are hidden when the list is empty. |
| **Empty — no boxes at all** | Existing `BoxList` `EmptyState` ("No boxes yet…") + `New box`. The sticky mobile bar reads `No active box yet` with inline `New box`. |

## 1.4 Biosecurity nudge + badge on `BoxCard`

**Trigger (deterministic, observable state — `UX_STANDARDS.md` *Deterministic visibility*):** the nudge renders mechanically when, for a given box:
`countBiosecItems = items.filter(i => assessment(i)?.biosecurity_flag && biosecurity_flag !== 'none').length >= 1` **AND** `box.is_biosecurity === false`.
No agent prompts it; it is a pure function of the box's contents and the new `Box.is_biosecurity` boolean.

> Data note: `Box.is_biosecurity boolean` (default `false`) is added to the `Box` type/table per the locked decision. It is read here and written by the confirm action below via `PATCH /api/boxes/:id { is_biosecurity: true }` (the existing box PATCH route already handles arbitrary box fields — see `handleUpdateBox`). `BoxManagement` gains `handleMarkBiosecurity(boxId)` that optimistically sets `is_biosecurity` on the local box and PATCHes.

### The nudge

- Renders as an **inline notice inside the `BoxCard`**, directly under the header row (always visible when triggered — it is advisory and must not be buried behind the expand chevron, because the biosecurity-anxious personas need it at a glance). It is **not** a modal — this is a non-destructive suggestion, and `UX_STANDARDS.md` *User Control and Freedom* says confirmations are for destructive actions only.
- Visual: a soft `--color-warning-light` panel, `--color-warning-dark` text, `--radius-md`, left `ShieldAlert` icon (`aria-hidden`, paired with text). It reuses the visual language of the existing `.biosecChip`/`.biosec` styles in `ItineraryView.module.css` so the two surfaces feel like one system.
- Copy (count-aware, sentence case):
  - 1 item: `Contains 1 biosecurity item. Mark this box as biosecurity?`
  - N items: `Contains {N} biosecurity items. Mark this box as biosecurity?`
- Actions, right-aligned (commit surface, *Action alignment*): `Dismiss` (tertiary/ghost, left) · `Mark as biosecurity` (primary, right). Reuse DS `Button` (`variant="secondary"` for dismiss, `variant="primary"` for mark) at `size="sm"`.
  - `Mark as biosecurity` → `handleMarkBiosecurity(box.id)`. Optimistic: nudge disappears, badge appears, toast `{boxLabel} marked as biosecurity.`
  - `Dismiss` → hides the nudge **for this session only** (local `dismissedBiosecNudges: Set<boxId>` in `BoxManagement`; not persisted, so a fresh session re-surfaces it if still unmarked — biosecurity is too important to permanently suppress on a single click, but we don't nag within a session). Dismiss does **not** change `is_biosecurity`.
- a11y: the notice is a `role="status"` region (advisory, not an error/alert). Focus is not stolen. Buttons are in tab order within the card.
- Not a destructive confirm, so **no** typed-acknowledgement gate (that gate is reserved for irreversible/destructive actions). Marking is reversible (see badge below), which is the correct, low-friction treatment.

### The badge (persistent, after marking)

- Once `box.is_biosecurity === true`, the `BoxCard` header `badgeGroup` (alongside `BoxSizeBadge` / `BoxStatusBadge`) shows a persistent **`Biosecurity` badge**: `ShieldAlert` icon (`aria-hidden`) + visible text `Biosecurity`, warning palette, `--radius-full`. Reuse the DS `Badge` primitive if it accepts a custom palette; otherwise a `.biosecBadge` class matching the chip styling already in `ItineraryView.module.css`. Never colour-only — the text + icon carry the meaning.
- The badge is also surfaced on the box rows in the itinerary box accordion (Surface 2) and flows into export/print, so a marked box reads as biosecurity everywhere (`UX_STANDARDS.md` *Consistency* — same term everywhere: "Biosecurity").
- **Un-marking** (control & freedom): the badge is the affordance — on the box card (and in the box drawer), the marked box exposes a small `Not biosecurity` text toggle in the card's overflow/edit area (`PATCH … { is_biosecurity: false }`). Optional but recommended; if cut for v1, document that un-marking is only available via the box drawer.

### New `ownerCopy.packing` keys

```
packing: {
  activeBoxHeading: 'Packing into',
  noActiveBox: 'No active box yet',
  newBox: 'New box',
  addToBox: (label) => `Add to ${label}`,        // mobile primary
  addToAnother: 'Add to another box…',
  pickABox: 'Pick a box to pack into',           // desktop primary when no active box
  selectedCount: (n) => `${n} selected`,
  clearSelection: 'Clear',
  addNToBox: (n, label) => `Add ${n} to ${label}`,
  addedToast: (name, label) => `Added ${name} to ${label}.`,
  addedManyToast: (n, label) => `Added ${n} items to ${label}.`,
  undo: 'Undo',
  addErrorToast: (name) => `Couldn't add ${name} — check your connection and try again.`,
  dropToAdd: (label) => `Drop to add to ${label}`,
  biosecNudgeOne: 'Contains 1 biosecurity item. Mark this box as biosecurity?',
  biosecNudgeMany: (n) => `Contains ${n} biosecurity items. Mark this box as biosecurity?`,
  biosecDismiss: 'Dismiss',
  biosecMark: 'Mark as biosecurity',
  biosecMarkedToast: (label) => `${label} marked as biosecurity.`,
  biosecBadge: 'Biosecurity',
  biosecUnmark: 'Not biosecurity',
}
```

## 1.5 Surface 1 — file changes

| File | Change |
|---|---|
| `src/components/boxes/BoxManagement.tsx` | Add `activeBoxId` state + default/persist logic; `setActiveBoxId`; `handleMarkBiosecurity`; `dismissedBiosecNudges` set; toast state (reuse pattern). Pass all down through `BoxList`. Adapt `handleAddToBox` to accept a batch (loop) and emit toast + undo. |
| `src/components/boxes/BoxList.tsx` | Thread `activeBoxId`/`setActiveBoxId` to `BoxCard` (active marker, drop target, nudge props) and `UnboxedItems`. Add the desktop **Packing into** radiogroup as the first rail card. Mark the active `BoxCard`. Gate drag wiring behind `isDesktop`. |
| `src/components/boxes/UnboxedItems.tsx` | Add multi-select mode (checkboxes + selection action bar, right-aligned), mobile single `Add to {activeBox}` primary + demoted "another box" picker, `draggable` rows (desktop), `activeBoxId`/`activeBoxLabel` props. Keep `onAddToBox` contract. |
| `src/components/boxes/UnboxedItems.module.css` | Selection bar (right-aligned), checkbox layout, drag-source dim, 44px targets. |
| `src/components/boxes/BoxCard.tsx` | Active marker (left accent + `Active` chip in `headerMeta`); biosecurity nudge notice under header (`role="status"`); persistent `Biosecurity` badge in `badgeGroup`; drop-target handlers + ring; new props (`isActive`, `onSetActive`, `biosecItemCount`, `onMarkBiosecurity`, `nudgeDismissed`, `onDismissNudge`, drag-drop callbacks). |
| `src/components/boxes/BoxCard.module.css` | `.activeAccent`, `.activeChip`, `.biosecNudge`, `.biosecBadge`, `.dropRing` (reduced-motion-safe), drop-target states. |
| `src/lib/copy/owner.ts` | Add `ownerCopy.packing` block above. |
| `src/types/database.ts` + `src/lib/constants.ts` | Add `is_biosecurity: boolean` to `Box` (data-model change tracked separately; default `false`). |
| (new) sticky mobile "Packing into" bar — implement inside `BoxList` (renders only when `!isDesktop`) rather than a new top-level component, to keep the active-box state in one tree. |

---

# Surface 2 — Itinerary (`ItineraryView`) — inline-editable manifest

Today each box accordion lists its items read-only (name · optional biosec chip · value). We make each line item editable in place for four fields: **verdict, value (cost + currency), box, biosecurity flag**. Totals header, biosecurity rail, and share/export/print are preserved exactly.

## 2.1 Editable fields & controls (reuse existing pickers)

| Field | Control (reuse) | Notes |
|---|---|---|
| **Verdict** | `EditablePill` (`src/components/shared/EditablePill.tsx`) seeded with the `--verdict-*` colours, exactly as `VerdictPicker` defines them. | The itinerary only ever shows SHIP/CARRY items (manifest = boxed items), but the full 6-verdict set is offered because changing to SELL/DONATE/DISCARD/REVISIT is a legitimate edit. Changing **away** from SHIP/CARRY removes the item from the box/manifest — see 2.4 "verdict downgrade". |
| **Value** | Inline number `<input type="number" inputmode="decimal">` for `estimated_replace_cost` + a small currency `<select>` (`replace_currency`) reusing the currency list from `ItemEditPanel` (`CURRENCY_SYMBOLS`). Tabular-nums, right-aligned in the column. | Label above on mobile card; visually-hidden `<label>` on desktop table cell (`aria-label="Replacement value for {item}"`). Placeholder `e.g. 120` (format guidance, not a label). |
| **Box** | A box `<select>` / combobox listing the user's boxes for this leg (`manifest.boxes[].box.label`), current one selected. Reuse the **box picker** shape from `BoxPicker.tsx`. | "Move to another box". On change → move item between boxes; manifest re-renders. |
| **Biosecurity flag** | `EditablePill` with the 4 levels: `None` · `Declare` · `High risk` · `Prohibited` (`BiosecurityFlag` values; labels from a new `BIOSEC_FLAG_LABELS` incl. `none: 'None'`). Colours: `none` neutral, `declare`/`high_risk`/`prohibited` escalate through the warning palette (warning-light → warning → danger), never colour-only — the label text carries it. | Editing here writes `biosecurity_flag` and is what the brief means by "user-editable". It is the same field Aisling sets. |

All four controls are the project's existing dropdown/pill primitives — **no new control type**, satisfying `UX_STANDARDS.md` *Consistency* ("do not introduce a different one for a new feature") and `UX_PATTERNS.md` Pattern 4 spirit (inline editing reuses the established pattern).

## 2.2 Desktop layout — reads as a data table, built from rows (`useIsDesktop()` true)

- Each box accordion's `itemsList` becomes a **CSS grid that reads as a table**: a header row + one row per item, columns:
  `Item · Verdict · Value · Box · Biosecurity · Actions`
- Implementation: a `role="table"`/`role="row"`/`role="cell"` ARIA grid over a CSS `display:grid` with a shared `grid-template-columns` so columns **align across rows** (the brief's "visually read like a data table but built from cards/rows"). Use `grid-template-columns: minmax(0,2fr) max-content max-content max-content max-content max-content;` and let the Item column flex. No fixed pixel columns (Pattern 9: never `repeat(3,1fr)`-style rigidity; content-driven `max-content`).
- A single **column header row** sits once at the top of each box's item list (or once per `boxes` section). Headers are real text (`Item`, `Verdict`, `Value`, `Box`, `Biosecurity`), `font-variant: tabular-nums` on Value.
- **Hierarchy** (`UX_STANDARDS.md` *Information Hierarchy*): the box label header (h-row) stays the dominant element; the column header row is muted (`--color-text-muted`, smaller); item rows are regular weight. One primary action per view remains the existing `Generate share link` in the actions section — the inline edits are not competing primaries (they're contextual controls, not page-level CTAs).
- **Actions cell**: a `Remove from box` ghost/text button per row (text + `X` icon). Removing is reversible (item returns to unboxed) so it's a plain action, not a destructive-confirm gate. It sits in the row, near the data it acts on (*Recognition over Recall* — contextual actions).
- The existing desktop behaviour where the box header links out to `/boxes?box=ID` is **preserved** for "open the box to scan/mark-packed"; inline editing is for quick field tweaks without leaving the itinerary. Keep the `ExternalLink` affordance but relabel its `aria-label` to `Open {boxLabel} in packing` for clarity.

> No horizontal scroll, ever (`UX_STANDARDS.md` *Responsive Design*). On laptop widths the table fits because Value/Verdict/Box/Biosec columns are `max-content` pills/inputs, and the Item column absorbs slack. If a narrow desktop window can't fit, the row **wraps within the cell** (labels never truncate) before any scrollbar — but the real fallback for small screens is the mobile card layout below.

## 2.3 Mobile layout — stacked labelled cards (`useIsDesktop()` false)

No table on mobile (brief: "No horizontal scrolling tables on mobile"). Each item becomes a **stacked card** inside the open box accordion:

```
┌───────────────────────────────┐
│ Vitamix A3500            [SHIP▾]│   ← name (h-weight) + verdict pill
│ Value   € 120  [EUR ▾]         │   ← labelled field
│ Box     [ Kitchen 1 ▾ ]        │
│ Biosecurity  [ Declare ▾ ]     │
│                 Remove from box │   ← right-aligned action
└───────────────────────────────┘
```

- Each field is a labelled row (`label` above/left, control right), every control ≥44px. Fields stack single-column (`UX_STANDARDS.md` *Form Design* — single-column on mobile).
- Editing a field opens its existing picker inline (verdict/biosec = `EditablePill` dropdown; box = the box select; value = numeric keypad via `inputmode="decimal"`). Where a control's option list is long, the box/verdict/biosec pickers already render as an overlay/sheet — acceptable; reuse them. A "lightweight sheet" is only needed if a control's inline expansion would push content off-screen; the existing `EditablePill` dropdown handles this with its own positioning, so default to inline.
- The accordion's mobile peek (`toggleBox`) is preserved; the difference is the expanded content now holds editable cards rather than read-only rows.

## 2.4 Save model, loading & error (consistent with the codebase)

The codebase has two precedents: optimistic-local-then-fetch (BoxManagement) and explicit-save-panel (ItemEditPanel). For a **field-at-a-time inline grid**, the right model — and the one matching `UX_PATTERNS.md` Pattern 4 (inline edit) + *Error Prevention* (validate on blur) — is:

- **Verdict, box, biosecurity (discrete selects):** **save on change** (optimistic). The moment the user picks a value, apply it to local manifest state and fire `PATCH /api/items/:id` (verdict/biosec) or the box-move call. These are single-tap commits with no "typing", so on-change is correct and there is no dirty-form to guard.
- **Value (free text):** **save on blur** (not per keystroke — `UX_STANDARDS.md` *Error Prevention*: "Validate on blur… keystroke validation is disruptive"). Parse on blur; if unchanged, no request. Inline-validate: negative or non-numeric → red border + helper `Enter a number like 120` below the field, no request sent.
- **Box move:** item moves from box A to box B in local state immediately; call the existing move path. Because `BoxItem` has a partial-unique constraint (one box per assessed item), the move is "remove from A + add to B" server-side; the client does it optimistically and rolls both back on failure.
- **Verdict downgrade (SHIP/CARRY → SELL/DONATE/DISCARD/REVISIT):** this removes the item from the manifest (it's no longer boxable). Because that is a **meaningful, slightly destructive** change (the item leaves the itinerary and, per data-model, may drop its image/box link), show a lightweight **confirm** first via DS `ConfirmDialog`: title `Change {item} to {verdict}?`, body `This takes it out of {boxLabel} and off this manifest.`, actions `Cancel · Change verdict` (right-aligned, *Action alignment*). Not a typed-acknowledgement (recoverable), just a confirm. Same-family changes (SHIP↔CARRY) commit silently.

**Loading affordance:** per-control, not per-page. While a field's request is in flight, that control shows a subtle busy state — the `EditablePill`/select is set `aria-busy="true"` and disabled with a small inline `Spinner` (DS `Spinner`, `role="status"`, `aria-label="Saving"`) replacing its chevron. No skeleton (data already present; `UX_PATTERNS.md` Pattern 5 — spinner for a discrete save, never skeleton). Surface within 200ms; don't flash for sub-200ms saves.

**Success affordance:** the committed value is its own confirmation (the pill now reads `CARRY`, the value shows `€120`). For the value field, a brief check tick fades in next to the input for ~1.5s (reduced-motion = appears/disappears instantly), matching the "visible confirmation" rule without a toast per keystroke. Totals header recomputes live (it already derives from manifest state) — the `estimated_replace_cost` change flows into `declared_value`, and a `biosecurity_flag` change flows into the biosec counts tile and the biosec rail (so editing here keeps the whole view coherent).

**Error affordance:** roll the field back to its previous value; show an **inline error** anchored to that control (red border + helper text below: `Couldn't save — try again.`) and announce via `role="alert"`. No global error. The control stays focused so the user can retry. This matches `UX_STANDARDS.md` *States* (Error: what went wrong + what to do) and *Form Design* (inline error placement under the field).

**`router.refresh()` note:** the existing `handleConfirmBiosec` does `router.refresh()` after save. For inline editing that would blow away local optimistic state and feel janky. Instead, **update local manifest state in place** (lift `manifest` into component state, seeded from props) and skip `router.refresh()` on these inline saves; only refresh on navigation away. This keeps edits optimistic and avoids a full server round-trip flicker.

## 2.5 Accessibility & keyboard (Surface 2)

- **Grid semantics (desktop):** `role="table"` wrapper, `role="row"` per item, `role="columnheader"` on the header cells, `role="cell"` on data cells. Each editable control keeps its own widget semantics (`EditablePill` is already `role="combobox"`→`listbox`; selects are native). Provide an `aria-label` on every control naming both field and item: `Verdict for Vitamix A3500`, `Replacement value for Vitamix A3500`, `Box for Vitamix A3500`, `Biosecurity flag for Vitamix A3500`.
- **Keyboard reach:** every control is tabbable in visual order (DOM order matches the visual grid — Pattern 9: no CSS `order` reordering). `EditablePill` already implements roving focus + Arrow/Home/End/Escape; native selects and the number input are keyboard-complete. The `Remove from box` button is a real `<button>`.
- **Move-to-box selector keyboard behaviour:** it's a native `<select>` (or the existing `BoxPicker` listbox which already has Escape + outside-click + roving focus). Either way: open with Enter/Space/ArrowDown, navigate with arrows, commit with Enter, dismiss with Escape returning focus to the trigger (matches `EditablePill`/`VerdictPicker`).
- **Focus return:** after any picker closes (commit or cancel), focus returns to the triggering pill/cell (already the behaviour in `EditablePill.handleSelect` → `pillRef.current?.focus()`).
- **Reduced motion:** the value-saved check tick and any pill open/close transitions respect `prefers-reduced-motion` (the modules already guard this).
- **Print/export untouched:** the `@media print` block already flattens to a read-only manifest; the editable controls render as their current values in print (the pills show text; native selects print their selected option). No print-specific work needed beyond ensuring controls aren't `display:none` in print (they show value text). Share/export/CSV read from the same manifest state, so inline edits are reflected in exports once saved.

## 2.6 States (Surface 2)

| State | Behaviour |
|---|---|
| **Idle** | Read-as-table (desktop) / labelled cards (mobile). Every field shows its current value as an interactive pill/input. |
| **Editing** | A pill/select is open (its own overlay/listbox) or the value input is focused. |
| **Saving** | That single control = `aria-busy`, disabled, inline `Spinner` in place of chevron. Rest of the row stays interactive. |
| **Success** | New value displayed; value field shows a 1.5s check tick; totals + biosec rail recompute. |
| **Error** | Field rolls back; inline red border + `Couldn't save — try again.` (`role="alert"`); control re-focused. |
| **Empty (leg has no boxed items)** | Existing branded `EmptyState` ("No items packed for this leg yet…") — unchanged. |
| **Verdict-downgrade confirm** | `ConfirmDialog`: `Change {item} to {verdict}?` / `Cancel · Change verdict`. Cancel returns focus to the verdict pill. |

## 2.7 Surface 2 — file changes

| File | Change |
|---|---|
| `src/components/itinerary/ItineraryView.tsx` | Lift `manifest` into local state (seed from prop). Replace the read-only `itemRow` with an editable row/card. Add per-field handlers: `handleVerdictChange`, `handleValueSave` (on blur), `handleBoxMove`, `handleBiosecFlagChange`, `handleRemoveFromBox`; each optimistic + per-control busy/error; drop `router.refresh()` for inline saves. Add `ConfirmDialog` for verdict downgrade. Recompute `totals`/`biosecItems` from local manifest state. Add desktop column-header row. |
| `src/components/itinerary/ItineraryView.module.css` | `.itemGrid` (shared `grid-template-columns`, desktop), `.colHeader` (muted), `.cellLabel` (mobile labelled rows), `.fieldBusy`, `.fieldError`, `.savedTick`, `.removeBtn`. Reduced-motion guards. No `overflow-x`. |
| `src/components/shared/EditablePill.tsx` | Reuse as-is for verdict + biosecurity (already generic over options/colours). No change required beyond passing the biosec options. |
| `src/components/boxes/BoxPicker.tsx` | Reuse for the move-to-box selector (or a native `<select>` if simpler); no behavioural change. |
| `src/lib/copy/owner.ts` | Add itinerary inline-edit keys (`fieldVerdict`, `fieldValue`, `fieldBox`, `fieldBiosec`, `removeFromBox`, `valueFormatHint: 'Enter a number like 120'`, `saveError: "Couldn't save — try again."`, `verdictDowngradeTitle`, `verdictDowngradeBody`, `changeVerdict: 'Change verdict'`, biosec flag labels incl. `none: 'None'`). |

---

## Cross-surface acceptance checklist (uxicorn)

- [ ] One primary action per view holds: `/boxes` = `New box` / `Add N to {box}` selection primary; itinerary = `Generate share link`. Inline controls are contextual, not competing primaries.
- [ ] Action groups on commit surfaces (selection bar, nudge, verdict-downgrade confirm) are **right-aligned**, order `tertiary · cancel · primary`.
- [ ] No icon stands alone except sanctioned `×`/chevron supplementing labelled controls.
- [ ] Every interactive control ≥44×44px on mobile; no horizontal scroll at 320px (mobile uses stacked cards, not tables).
- [ ] Drag has a full non-drag fallback (multi-select); drag gated to desktop.
- [ ] Biosecurity nudge is deterministic (pure function of box contents + `is_biosecurity`), not agent-proposed; it's advisory (`role="status"`), not a destructive confirm. Verdict downgrade (data-losing) **does** get a confirm.
- [ ] Saves: discrete selects on-change, free-text value on-blur; optimistic with rollback; per-control busy/error; no global spinner; totals/biosec rail stay coherent.
- [ ] Colour never sole signal (active box, verdict, biosecurity all carry text + icon/weight).
- [ ] All copy sentence case, Irish English, in `ownerCopy`; no truncation/ellipsis; no emoji/ALL CAPS.
- [ ] All motion respects `prefers-reduced-motion`.
