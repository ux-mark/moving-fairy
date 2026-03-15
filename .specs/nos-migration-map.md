# Moving Fairy to Nos Design System -- Migration Map

> UXicorn owns this document.
> Goal: Zero custom components in moving-fairy. Everything comes from `@thefairies/design-system`.
> Date: 2026-03-10

---

## Table of Contents

1. [Direct Replacements](#1-direct-replacements)
2. [Composite Replacements](#2-composite-replacements)
3. [Gap Analysis](#3-gap-analysis)
4. [shadcn/ui Removal Plan](#4-shadcnui-removal-plan)
5. [Token Mapping](#5-token-mapping)
6. [CSS Strategy](#6-css-strategy)
7. [Risk Assessment](#7-risk-assessment)

---

## 1. Direct Replacements

These Moving Fairy components have a clear 1:1 counterpart in the Nos DS.

### 1.1 ChatInterface.tsx -> ChatContainer

| Moving Fairy | Nos DS |
|---|---|
| `ChatInterface` | `ChatContainer` |

**Why**: Both serve as the chat shell -- messages area, input area, streaming state, auto-scroll. The Nos ChatContainer accepts `messages: ChatMessageData[]`, `onSend`, `isStreaming`, and `streamingContent`.

**Prop adaptations needed**:
- Moving Fairy's `ChatMessage` type includes `imageUrls`, `type: "card"`, and `card` fields. Nos DS's `ChatMessageData` only has `role`, `content`, `timestamp`. **This requires extending `ChatMessageData` in the DS** or using the `children` slot for custom message rendering.
- Moving Fairy's `embedded` prop controls layout chrome (header, max-width). This is a layout concern, not a chat concern -- handled by the parent, not the component.
- Moving Fairy's SSE streaming logic, error handling, opening/welcome-back triggers live in `ChatInterface`. These are app logic, not component logic -- they stay in the consuming app and feed data into `ChatContainer`.
- Moving Fairy renders an AI Logic panel toggle in the header. This is app-specific chrome, not part of the chat system.

**Migration path**: The consuming app keeps its SSE streaming logic, state management, and message type extensions. It renders `ChatContainer` for the UI shell and uses the `children` slot or wraps messages for card/image rendering.

---

### 1.2 MessageBubble.tsx -> ChatMessage

| Moving Fairy | Nos DS |
|---|---|
| `MessageBubble` (text messages) | `ChatMessage` |

**Why**: Both render user/assistant message bubbles with role-based alignment and styling.

**Prop adaptations needed**:
- Nos DS `ChatMessage` takes `role`, `content`, `timestamp`. Moving Fairy's `MessageBubble` also handles `imageUrls` and the `AssessmentCard` (verdict card) rendering.
- The `AssessmentCard` sub-component within `MessageBubble` is a domain-specific card, not a generic chat message. It maps to **`RecommendationCard`** (see Section 2.1).
- Image rendering in user messages needs a custom wrapper around `ChatMessage` or a new optional `images` prop on the DS component.

**Migration path**: Standard text messages use `ChatMessage` directly. Assessment cards use `RecommendationCard`. Image messages need a thin wrapper.

---

### 1.3 InputBar.tsx -> ChatInput

| Moving Fairy | Nos DS |
|---|---|
| `InputBar` | `ChatInput` |

**Why**: Both provide an auto-growing textarea with a send button and Enter-to-send behaviour.

**Prop adaptations needed**:
- Moving Fairy's `InputBar` supports **image upload** (camera button, file input, previews, upload progress). Nos DS's `ChatInput` has no image upload support.
- Moving Fairy passes `onSend(message, imageUrls)` with two arguments. Nos DS passes `onSend(message)` with one.
- Moving Fairy has an `uploading` state with a spinner on the send button.
- Nos DS has a `modelPicker` slot (ReactNode) for rendering a model selector below the input. Moving Fairy doesn't use this, but it could be repurposed for the camera button area.

**Migration path**: This is a **gap** -- see Section 3.1. The DS `ChatInput` needs an optional `beforeInput` or `startAdornment` slot for the camera button, and the `onSend` signature needs to support attached files. Alternatively, Moving Fairy wraps `ChatInput` and composes the image upload UI around it.

---

### 1.4 TypingIndicator.tsx -> ThinkingDots

| Moving Fairy | Nos DS |
|---|---|
| `TypingIndicator` | `ThinkingDots` |

**Why**: Both show a bouncing dots animation during AI thinking.

**Prop adaptations needed**:
- Moving Fairy's `TypingIndicator` includes a **text label** (e.g. "Aisling is thinking...") alongside the dots. Nos DS's `ThinkingDots` is dots-only with a `className` prop.
- Moving Fairy wraps the dots in a card-like container with shadow and border. Nos DS renders bare dots.

**Migration path**: Wrap `ThinkingDots` in a styled container and add the label text alongside it. This is a thin composition, not a gap.

---

### 1.5 SlidePanel.tsx -> EditPanel

| Moving Fairy | Nos DS |
|---|---|
| `SlidePanel` | `EditPanel` |

**Why**: Both are right-sliding modal panels with overlay, header, close button, focus trap, and Escape-to-close.

**Prop adaptations needed**:
- Nos DS `EditPanel` has a **mandatory footer** with Save/Cancel buttons (`onSave`, `onCancel`, `saveLabel`, `cancelLabel`). Moving Fairy's `SlidePanel` is content-agnostic -- it provides header + scrollable body with no footer.
- Moving Fairy's `SlidePanel` uses **Framer Motion** for slide animation. Nos DS `EditPanel` uses CSS transitions.
- Moving Fairy's `SlidePanel` goes full-width on mobile (`max-w-sm sm:max-w-xs`). Nos DS `EditPanel` caps at `460px` / `90vw` and also goes full-width below 600px.

**Migration path**: The DS `EditPanel` is close but opinionated about the footer. Two options:
1. **Fix-request to DS**: Add an optional `footer` prop that defaults to the Save/Cancel pattern but can be overridden or hidden. This is a non-breaking additive change.
2. **Workaround**: Pass the save button as part of `children` and set `saveLabel`/`cancelLabel` to empty strings (but this is hacky).

Recommendation: **Fix-request** -- see Section 3.2.

---

### 1.6 OnboardingWizard.tsx -> OnboardingWizard

| Moving Fairy | Nos DS |
|---|---|
| `OnboardingWizard` | `OnboardingWizard` |

**Why**: Both provide a multi-step wizard with progress indicator, back/next navigation, and step content.

**Prop adaptations needed**:
- Nos DS `OnboardingWizard` takes `currentStep`, `totalSteps`, `onBack`, `onNext`, `nextLabel`, `nextDisabled`, `children`. This is a controlled shell.
- Moving Fairy's `OnboardingWizard` is a **self-contained orchestrator** -- it manages its own step state, form data, step transitions with Framer Motion animations, submission logic, error display, and conditional step visibility (transformer step only when voltage changes).
- Moving Fairy's progress bar is segmented (individual bars per step). Nos DS's is a continuous fill bar. Visual difference, not functional.

**Migration path**: Moving Fairy keeps its step management logic and renders the Nos DS `OnboardingWizard` as the visual shell. The step content (`DepartureStep`, `ArrivalStep`, etc.) is passed as `children`. The Framer Motion `AnimatePresence` for step transitions stays in the consuming app (wrapping the `children` content).

The Nos DS wizard's Back/Next buttons replace Moving Fairy's custom navigation. Moving Fairy's "Start chatting with Aisling" final-step label maps to `nextLabel`. The disabled state maps to `nextDisabled`.

**Minor concern**: Nos DS wizard doesn't support a loading/submitting state on the final button (Loader2 spinner). This could be handled by the consuming app replacing the default button via a future `renderNext` prop, or by passing `nextLabel="Setting up..."` and `nextDisabled={true}` during submission.

---

### 1.7 AuthCard (landing/login pages) -> AuthCard

| Moving Fairy | Nos DS |
|---|---|
| Landing page auth UI | `AuthCard` |

**Why**: Nos DS `AuthCard` provides a centered card with title, subtitle, error/success banners, content area, and footer. Moving Fairy's landing page and `MagicLinkForm` build this pattern by hand.

**Prop adaptations needed**:
- Nos DS `AuthCard` takes `title`, `subtitle`, `error`, `success`, `children`, `footer`.
- Moving Fairy's landing page has a blockquote (Aisling intro) above the form. This goes in a custom wrapper above the `AuthCard`, or as part of the card's `children` before the form.
- The "Magic link sent" success state with the check icon and email display fits naturally as `AuthCard`'s `success` banner + children.

**Migration path**: Wrap `MagicLinkForm` inside `AuthCard`. The Aisling blockquote and wordmark sit above the card as a separate element (not part of the card component).

---

### 1.8 EmptyState (InventoryPanel) -> EmptyState

| Moving Fairy | Nos DS |
|---|---|
| `InventoryPanel.EmptyState` | `EmptyState` |
| `BoxList` empty state | `EmptyState` |

**Why**: Both render a centered message with a heading, description, and CTA button for when there's no data.

**Prop adaptations needed**:
- Nos DS `EmptyState` takes `heading`, `description`, `ctaLabel`, `onCtaClick`. It includes sparkle decorations.
- Moving Fairy's inventory empty state has a Package icon instead of sparkles. The sparkle decorations in the DS component would look out of place for a box-packing context.
- Moving Fairy's BoxList empty state also has a Package icon and a "New box" CTA.

**Migration path**: Use Nos DS `EmptyState` for both. The sparkle decorations are a Nos DS brand element that works across all fairies. If the Package icon is strongly preferred, this is a **fix-request** to add an optional `icon` prop to `EmptyState`.

---

### 1.9 Spinner / Loading states -> Spinner

| Moving Fairy | Nos DS |
|---|---|
| `Loader2` icon (various) | `Spinner` |
| `LoadingSkeleton` (InventoryPanel) | `Spinner` (for simple cases) |

**Why**: Moving Fairy uses `Loader2` from lucide-react with `animate-spin` in multiple places. Nos DS has a dedicated `Spinner` component with `size` variants.

**Migration path**: Replace all `<Loader2 className="animate-spin" />` instances with `<Spinner size="sm" />`. The skeleton loading pattern in `InventoryPanel.LoadingSkeleton` is a different pattern (placeholder rectangles) and doesn't map to `Spinner` -- see Section 3.6.

---

### 1.10 Toast notifications -> Toast

| Moving Fairy | Nos DS |
|---|---|
| `alert()` calls (InputBar) | `ToastProvider` + `useToast()` |
| Inline error banners | `useToast()` for transient errors |

**Why**: Moving Fairy currently uses `window.alert()` for image upload errors. This is a known UX issue. The Nos DS Toast system provides proper non-blocking notifications.

**Migration path**: Wrap the app in `ToastProvider`. Replace `alert()` calls with `addToast('error', message)`. Some inline error banners (e.g. chat error, onboarding error) should remain inline because they're contextual -- but transient success/failure notifications (save, ship, create box) should use toasts.

---

## 2. Composite Replacements

These Moving Fairy components map to a combination of Nos DS components.

### 2.1 MessageBubble.AssessmentCard -> RecommendationCard

| Moving Fairy | Nos DS |
|---|---|
| `AssessmentCard` (inside MessageBubble) | `RecommendationCard` |

**Why this is the right mapping**: RecommendationCard is designed exactly for the "AI recommends, user confirms or revises" pattern. It provides:
- Title (item name)
- Badge (verdict with colour)
- Confidence indicator
- Rationale text
- Warning (import_note)
- Action step
- Confirm/Skip action bar with state machine (idle -> confirming -> confirmed / error)
- Left accent border (verdict colour)
- Metadata pairs (ship cost, replace cost)

**Prop mapping**:

| Moving Fairy AssessmentCard | Nos DS RecommendationCard |
|---|---|
| `card.item` | `title` |
| `card.verdict` | `badge={{ label: verdict, color: verdictColor }}` |
| `card.confidence` | `confidence` |
| `card.rationale` | `rationale` |
| `card.import_note` | `warning` |
| `card.action` | `action` |
| `card.estimated_ship_cost_usd` | `metadata=[{ label: 'Ship cost', value }]` |
| `card.estimated_replace_cost_usd` | `metadata=[{ label: 'Replace cost', value }]` |
| Verdict border colour | `accentColor` |
| `confirmState` ("idle"/"saving"/"saved"/"error") | `status` ("idle"/"confirming"/"confirmed"/"error") |
| `handleConfirm` | `onConfirm` |
| `handleEdit` sends "revise" message | `onSkip` (relabel as "Revise") |
| "Confirm" button label | `confirmLabel="Save Assessment"` |
| "Edit" button label | `skipLabel="Revise"` |

**REVISIT notice**: Moving Fairy shows a special italicised notice for REVISIT verdicts. This could go in the `warning` prop or as additional text in `rationale`. Minor composition choice.

**Migration path**: Replace `AssessmentCard` entirely with `RecommendationCard`. The consuming app maps verdict colours to `accentColor` and `badge.color`, manages the confirm/error state machine, and calls the save API in `onConfirm`.

---

### 2.2 VerdictBadge -> StatusPill (extended)

| Moving Fairy | Nos DS |
|---|---|
| `VerdictBadge` | `StatusPill` (with verdict tokens) |

**Why**: Both render a coloured pill/badge. StatusPill uses status-based colour pairs from tokens. VerdictBadge uses verdict-specific colours.

**Prop adaptations needed**:
- StatusPill takes `status` (string), `active` (boolean), `onClick`. It's designed as a **filter toggle**, not a read-only badge.
- VerdictBadge is a **read-only display badge** with no click handler.
- StatusPill's colour mapping is hardcoded to job-search statuses (applied, waiting, interview, etc.), not Moving Fairy verdicts (SHIP, CARRY, SELL, etc.).

**Migration path**: This is a **gap** -- see Section 3.3. The DS needs either:
1. A generic `Badge` or `Pill` component that accepts `label` + `bgColor` + `fgColor` (non-breaking contribution).
2. StatusPill extended with a `readOnly` mode and custom colour support via CSS custom properties.

In the interim, Moving Fairy can use `RecommendationCard`'s built-in badge for assessment cards, and a local `VerdictBadge` component composed from DS tokens until the generic badge ships.

---

### 2.3 AILogicPanel -> SidePanel (logic tab)

| Moving Fairy | Nos DS |
|---|---|
| `AILogicPanel` | `SidePanel` (logic tab) |

**Why**: Nos DS `SidePanel` has a "logic" tab that renders `LogicEntry[]` with type labels (Thinking, Tool Use, Result) and a preview tab. Moving Fairy's `AILogicPanel` shows tool_call/tool_result events in a collapsible mono-font panel.

**Prop adaptations needed**:
- Nos DS `SidePanel` is a **resizable side panel** with tabs (logic + preview). Moving Fairy's `AILogicPanel` is a **collapsible bottom panel** embedded in the chat view.
- Nos DS `LogicEntry` has types `thinking`, `tool_use`, `result`. Moving Fairy has `tool_call` and `tool_result`.
- The positioning is fundamentally different: Nos DS puts it alongside the chat; Moving Fairy puts it below the chat.

**Migration path**: This is a **partial match**. The data model is similar but the layout is different. Options:
1. Use the Nos DS `SidePanel` in desktop mode (side-by-side with chat) and collapse it on mobile. This would be a layout upgrade.
2. Extract just the logic entry rendering from `SidePanel` and use it in a custom bottom panel. But this defeats the purpose of using the DS.

**Recommendation**: Migrate to `SidePanel` as a proper side panel on desktop. On mobile, the AI Logic panel can be hidden or placed behind a drawer. This is a UX improvement, not just a migration.

---

### 2.4 ProfileEditPanel -> EditPanel

| Moving Fairy | Nos DS |
|---|---|
| `ProfileEditPanel` | `EditPanel` (if footer flexibility is added) |

**Why**: `ProfileEditPanel` is a slide-in panel with a form and a save button. `EditPanel` is a slide-in panel with form content and a Save/Cancel footer.

**Prop adaptations needed**:
- `ProfileEditPanel` uses `SlidePanel` (Moving Fairy's custom panel) and puts the save button inline as part of the form, not in a sticky footer.
- `EditPanel` has a mandatory sticky footer with Save/Cancel.
- `ProfileEditPanel` has loading state (spinner), error/success inline banners, and a complex form.

**Migration path**: With the fix-request from Section 3.2 (flexible footer), replace `SlidePanel` usage in `ProfileEditPanel` with `EditPanel`. Wire `onSave` to the existing `handleSave` logic and `onCancel` to `onClose`. The form fields render as `children`.

---

### 2.5 BoxStatusBadge + BoxSizeBadge -> StatusPill (extended)

| Moving Fairy | Nos DS |
|---|---|
| `BoxStatusBadge` | `StatusPill` (with box status tokens) |
| `BoxSizeBadge` | No direct equivalent (simple badge) |

**Why**: `BoxStatusBadge` renders a coloured pill for packing/packed/shipped/arrived. `StatusPill` renders a coloured pill for job statuses. Same pattern, different domain.

**Migration path**: Same gap as VerdictBadge -- see Section 3.3. Need a generic pill/badge component in the DS.

---

### 2.6 CostSummary -> AICostPanel (partial)

| Moving Fairy | Nos DS |
|---|---|
| `CostSummary` (compact + full variants) | `AICostPanel` (partial overlap) |

**Why**: `AICostPanel` is a modal panel showing cost breakdown with bar charts and a timeline. `CostSummary` is an inline strip/card showing total cost and verdict counts. These are different UX patterns.

**Migration path**: This is a **gap** -- see Section 3.4. `AICostPanel` is too heavy for the inline cost strip. Moving Fairy needs a lightweight `CostStrip` or `CostSummary` component in the DS.

---

## 3. Gap Analysis

### 3.1 GAP: ChatInput image upload support

**Current**: Moving Fairy's `InputBar` has camera button, file picker, image previews, upload progress, multi-image support (up to 20).

**DS component**: `ChatInput` has text-only input with `modelPicker` slot.

**Resolution**: **Non-breaking contribution to DS** -- add optional props to `ChatInput`:
- `startAdornment?: ReactNode` -- slot before the textarea (for camera button)
- `endAdornment?: ReactNode` -- slot after the textarea (alternative placement)
- `aboveInput?: ReactNode` -- slot above the input bubble (for image previews)

The image upload logic (file selection, upload API calls, preview management) stays in the consuming app. The DS component just provides layout slots.

**Effort**: Small. Add three optional ReactNode props and render them in the appropriate positions.

---

### 3.2 GAP: EditPanel footer flexibility

**Current**: Moving Fairy's `SlidePanel` has no footer. `CreateBoxPanel` and `ProfileEditPanel` put their own buttons inside the content.

**DS component**: `EditPanel` has a mandatory Save/Cancel footer.

**Resolution**: **Non-breaking contribution to DS** -- add an optional `footer` prop:
- `footer?: ReactNode | false` -- when `ReactNode`, replaces the default footer; when `false`, hides the footer entirely.
- Default behaviour unchanged (Save/Cancel footer when `footer` is undefined).

**Effort**: Small. One optional prop, conditional render.

---

### 3.3 GAP: Generic Badge/Pill component

**Current**: Moving Fairy has `VerdictBadge`, `BoxStatusBadge`, `BoxSizeBadge` -- all coloured pill/badge components.

**DS component**: `StatusPill` is hardcoded to job-search statuses and designed as a filter toggle, not a display badge.

**Resolution**: **Non-breaking contribution to DS** -- add a generic `Badge` component:

```tsx
interface BadgeProps {
  label: string;
  bgColor?: string;    // CSS colour or custom property
  fgColor?: string;
  size?: 'sm' | 'md';
  className?: string;
}
```

This handles all pill/badge use cases across fairies. `StatusPill` can remain for the filter-toggle pattern; `Badge` is for display-only labels.

**Effort**: Small. New component, new barrel export.

---

### 3.4 GAP: CostSummary / CostStrip

**Current**: Moving Fairy's `CostSummary` shows shipping cost, item count, and verdict distribution in a compact strip (for the mobile header) or a full card (for the inventory panel top).

**DS component**: `AICostPanel` is a modal/panel for detailed cost breakdown. Not the right fit.

**Resolution**: **Non-breaking contribution to DS** -- add a `CostStrip` component:

```tsx
interface CostStripProps {
  totalLabel: string;        // "Est. Shipping"
  totalValue: string;        // "$2,400"
  secondaryLabel?: string;   // "12 items"
  tags?: { label: string; bgColor: string; fgColor: string }[];
  variant: 'compact' | 'full';
  className?: string;
}
```

This is generic enough for any fairy that shows cost summaries. Moving Fairy uses it for shipping costs; Job Fairy could use it for salary ranges.

**Effort**: Medium. New component with two variants.

---

### 3.5 GAP: Collapsible / Accordion

**Current**: Moving Fairy uses shadcn/ui `Collapsible` (from `@base-ui/react/collapsible`) for expandable sections in `InventoryPanel` (verdict groups, not-shipping section).

**DS component**: No collapsible/accordion component exists in the DS.

**Resolution**: Two options:
1. **Direct dependency**: The consuming app can depend on `@base-ui/react` directly for primitives the DS doesn't wrap. This is clean -- Base UI is a headless primitive library.
2. **Non-breaking contribution**: Add an `Accordion` or `Collapsible` component to the DS. But this may be premature -- if only one fairy needs it, it's better as a direct dependency.

**Recommendation**: Option 1 for now. Moving Fairy depends on `@base-ui/react/collapsible` directly and styles it with DS tokens. If multiple fairies need it, elevate to the DS.

**Effort**: None for option 1. The dependency already exists.

---

### 3.6 GAP: Skeleton loading

**Current**: `InventoryPanel.LoadingSkeleton` renders placeholder rectangles while data loads.

**DS component**: The DS has a `Skeleton` directory in its components folder but it may not be exported.

**Resolution**: Check if `Skeleton` is implemented and export it. If not, it's a small contribution.

**Effort**: Trivial.

---

### 3.7 GAP: Dialog / Confirmation modal

**Current**: Moving Fairy uses shadcn/ui `Dialog` (from `@base-ui/react/dialog`) for confirmation modals (mark-as-packed, ship-all).

**DS component**: `PreflightConfirmation` is close -- it's a confirmation checklist card. But it's rendered inline, not as a modal overlay.

**Resolution**: Two options:
1. Use `PreflightConfirmation` for the confirmation content, wrapped in a simple modal container (the consuming app handles the overlay).
2. **Non-breaking contribution**: Add a `ConfirmDialog` component to the DS that combines overlay + confirmation content.

**Recommendation**: Option 2. Confirmation dialogs are a universal pattern. Every fairy will need them.

```tsx
interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  isConfirming?: boolean;
}
```

**Effort**: Small-medium. New component combining overlay pattern from `EditPanel` with a simple title/description/actions layout.

---

### 3.8 GAP: BottomTabBar (mobile navigation)

**Current**: `BottomTabBar` provides iOS-style bottom tab navigation for mobile (Chat / Inventory tabs).

**DS component**: `Navigation` is a top nav bar with hamburger menu. No bottom tab bar pattern.

**Resolution**: This is **domain-specific** to Moving Fairy's split-screen layout. Bottom tab bars are appropriate for mobile-first apps with 2-5 primary sections. Not all fairies need this.

**Recommendation**: Keep as a local component in Moving Fairy, styled with DS tokens (not Tailwind utilities). If Scout or other mobile-first fairies need it later, elevate to the DS.

**Effort**: Restyle only -- convert Tailwind classes to CSS Module using DS tokens.

---

### 3.9 GAP: LightAssessmentWarning

**Current**: An amber warning card with flag messages, confirm/dismiss actions.

**DS component**: No direct equivalent. `RecommendationCard` has a `warning` slot but not a standalone warning card pattern.

**Resolution**: This is a specialised domain component. Compose it from DS tokens and patterns:
- Card container using `--color-warning-bg`, `--color-warning-border` tokens
- Action buttons using patterns from the DS
- AlertTriangle icon from lucide-react

**Recommendation**: Keep as a local component, restyle with DS tokens. If other fairies need contextual warning cards with actions, contribute a generic `AlertCard` to the DS.

---

## 4. shadcn/ui Removal Plan

Every shadcn/ui primitive must be removed. Here's the replacement for each.

| shadcn/ui Primitive | Current Usage | Replacement |
|---|---|---|
| `ui/button.tsx` | Used everywhere (28+ imports) | DS does not export a Button. **See Section 4.1.** |
| `ui/dialog.tsx` | BoxCard (mark packed), ShipAllButton (ship all) | DS `ConfirmDialog` (Section 3.7) or `@base-ui/react/dialog` directly |
| `ui/collapsible.tsx` | InventoryPanel (verdict groups, not-shipping) | `@base-ui/react/collapsible` directly (Section 3.5) |
| `ui/input.tsx` | ApiKeyStep, ProfileEditPanel | Native `<input>` styled with DS tokens |
| `ui/label.tsx` | ApiKeyStep, ProfileEditPanel | Native `<label>` styled with DS tokens |
| `ui/progress.tsx` | Not directly used (OnboardingWizard has custom progress bar) | Remove entirely |
| `ui/radio-group.tsx` | Not used in any component (present but unused) | Remove entirely |
| `ui/select.tsx` | Not used in any component (present but unused) | Remove entirely |
| `ui/tabs.tsx` | Not used in any component (InventoryPanel uses custom tab buttons) | Remove entirely |
| `ui/textarea.tsx` | Not directly imported (InputBar uses native `<textarea>`) | Remove entirely |
| `ui/tooltip.tsx` | Not used in any component (present but unused) | Remove entirely |

### 4.1 Button Strategy

This is the highest-impact removal. The Moving Fairy `Button` (shadcn/ui based, using `@base-ui/react/button` and `class-variance-authority`) is imported in 28+ places with variants (`default`, `outline`, `secondary`, `ghost`, `destructive`, `link`) and sizes (`default`, `xs`, `sm`, `lg`, `icon`, `icon-xs`, `icon-sm`, `icon-lg`).

The Nos DS does not currently export a Button component. Every DS component uses locally-styled `<button>` elements with CSS Module classes.

**Resolution**: **Non-breaking contribution to DS** -- add a `Button` component:

```tsx
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon-sm' | 'icon-md';
  children: React.ReactNode;
}
```

This is the single most important contribution. Without it, every component that imports `Button` needs manual restyling.

**Effort**: Medium. New component with CSS Module variants, fully accessible.

**Interim strategy**: Until the DS Button ships, Moving Fairy can convert its `button.tsx` from Tailwind to CSS Modules using DS tokens. This keeps the same API surface while removing the Tailwind dependency.

---

## 5. Token Mapping

Moving Fairy's current tokens are declared in `globals.css @theme` (Tailwind v4 format). These must map to Nos DS tokens from `tokens.css`.

### 5.1 Colour Token Mapping

| Moving Fairy Token (Tailwind) | Nos DS Token | Notes |
|---|---|---|
| `--color-primary` (warm green) | `--color-primary` (blue #005EFF) | **Override needed**: Moving Fairy's brand is warm clover green, not blue. Set `--color-primary` to Moving Fairy's green in the app's CSS. |
| `--color-accent` (warm amber) | No direct equivalent | **New token needed**: Add `--accent-moving-fairy` or override an existing accent token. |
| `--color-background` | `--color-bg-page` | Direct map |
| `--color-card` | `--color-bg-card` | Direct map |
| `--color-muted` | `--color-bg-subtle` | Close match |
| `--color-foreground` | `--color-text-primary` | Direct map |
| `--color-muted-foreground` | `--color-text-muted` | Direct map |
| `--color-border` | `--color-border-default` | Direct map |
| `--color-input` (border) | `--color-border-input` | Direct map |
| `--color-ring` (focus) | `--color-border-focus` | Direct map |
| `--color-destructive` | `--color-error` | Direct map |
| `--color-secondary` | `--color-bg-subtle` | Approximate |

### 5.2 Verdict Colour Tokens

Moving Fairy defines custom verdict colours. These need to be added as app-level overrides:

```css
:root {
  /* Moving Fairy verdict colours */
  --verdict-ship: #16a34a;      /* green */
  --verdict-carry: #16a34a;     /* green (same as ship) */
  --verdict-sell: #d97706;      /* amber */
  --verdict-donate: #6b7280;    /* warm grey */
  --verdict-discard: #6b7280;   /* warm grey */
  --verdict-decide-later: #3b82f6; /* soft blue */
}
```

These are domain-specific and should **not** be added to the shared DS tokens. They live in Moving Fairy's global CSS as overrides.

### 5.3 Typography Tokens

| Moving Fairy | Nos DS |
|---|---|
| Source Sans 3 | Source Sans Pro (`--font-sans`) |

Source Sans 3 is the rename of Source Sans Pro. The DS already uses `--font-sans: 'Source Sans Pro'`. Moving Fairy should override this to `'Source Sans 3'` or update the DS token (non-breaking change since Source Sans 3 is backwards-compatible).

### 5.4 Spacing / Radius / Shadow Tokens

| Category | Moving Fairy (Tailwind) | Nos DS |
|---|---|---|
| Card padding | Tailwind `p-4` / `p-5` (16px/20px) | `--space-card-padding: 20px` |
| Border radius (cards) | Tailwind `rounded-lg` (8px) / `rounded-2xl` (16px) | `--radius-lg: 8px`, `--radius-xl: 12px` |
| Card shadow | Tailwind `shadow-sm` | `--shadow-card` |
| Focus ring | Tailwind `ring-ring/50` | `--shadow-focus` |
| Transition duration | Tailwind `transition-colors` (150ms) | `--transition-fast: 0.15s` |

These are close matches. The main work is replacing Tailwind utility classes with CSS Module styles that reference DS tokens.

---

## 6. CSS Strategy

### 6.1 Current State

Moving Fairy uses **Tailwind CSS v4** as its sole styling layer. All styles are inline utility classes with `cn()` for conditional merging. There are zero CSS Modules.

### 6.2 Target State

Nos DS uses **CSS Modules** with **CSS Custom Properties** (tokens). No Tailwind.

### 6.3 Migration Approach

**Phase 1: Add DS tokens alongside Tailwind**
- Import `@thefairies/design-system/styles/tokens.css` in the root layout
- Set Moving Fairy colour overrides (primary green, accent amber, verdict colours)
- DS components will render correctly immediately since they use CSS Modules internally

**Phase 2: Migrate component by component**
- For each component being replaced by a DS component, remove it and import from the DS
- For local components that remain (BottomTabBar, LightAssessmentWarning), create `.module.css` files using DS tokens
- Replace Tailwind utility classes with CSS Module classes

**Phase 3: Remove Tailwind**
- Once all components are migrated, remove Tailwind v4 configuration
- Remove `@import "tailwindcss"` from globals.css
- Remove `cn()` utility (or keep it for DS token-based conditional classes)
- Remove `class-variance-authority` dependency
- Remove `tailwind-merge` dependency

### 6.4 CSS Module Naming Convention

Follow the DS convention:
- One `.module.css` file per component
- camelCase class names
- Reference DS tokens via `var(--token-name)`
- No hardcoded colours, spacing, or other magic numbers

Example migration:

```css
/* Before (Tailwind in TSX) */
/* className="rounded-lg border border-border bg-card px-4 py-3" */

/* After (CSS Module) */
.card {
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border-default);
  background: var(--color-bg-card);
  padding: var(--space-card-padding);
}
```

---

## 7. Risk Assessment

### 7.1 HIGH RISK: Button component dependency

**What**: The shadcn/ui `Button` is imported in 28+ files. There is no DS equivalent.

**Impact**: Cannot remove shadcn/ui until every Button import is resolved.

**Mitigation**: Contribute a `Button` component to the DS as the first migration step. Alternatively, convert the existing Button to CSS Modules with DS tokens as an interim measure.

---

### 7.2 HIGH RISK: Framer Motion animations

**What**: Moving Fairy uses Framer Motion extensively -- `AnimatePresence`, `motion.div`, `useReducedMotion` -- for step transitions (onboarding), panel slides (SlidePanel), content switches (InventoryPanel), cost number pulse (CostSummary), and box card expand/collapse (BoxCard).

**Impact**: The Nos DS uses CSS transitions exclusively. Migrating to DS components means losing Framer Motion animations or keeping Framer Motion as an app-level dependency.

**Mitigation**: Keep Framer Motion as an app-level dependency. DS components handle their own animations via CSS transitions. Moving Fairy wraps DS components in `motion.div` where app-specific animations are needed (onboarding step transitions, content switches). The `useReducedMotion()` hook stays in the app.

This is acceptable -- the DS provides structure and tokens; the consuming app adds motion when needed.

---

### 7.3 MEDIUM RISK: Image upload in ChatInput

**What**: Moving Fairy's `InputBar` has camera button, multi-image previews, upload progress. DS `ChatInput` has none of this.

**Impact**: Cannot do a clean swap until the DS supports input adornments/slots.

**Mitigation**: Compose `ChatInput` with a wrapper component that adds the camera button and image preview area. The DS component handles the text input; the wrapper handles images. This is a reasonable composition pattern that doesn't require DS changes, though DS changes would make it cleaner.

---

### 7.4 MEDIUM RISK: Assessment card in chat stream

**What**: Moving Fairy renders `AssessmentCard` components inline within the chat message stream. These are complex interactive cards (confirm/edit actions, API calls, state machine).

**Impact**: DS `ChatMessage` renders plain text only. Interactive cards need to be rendered outside the standard `ChatMessage` flow.

**Mitigation**: Use `RecommendationCard` from the DS. Render it as a standalone element in the message list (not wrapped in a `ChatMessage` bubble). The chat container's message list can interleave `ChatMessage` components and `RecommendationCard` components based on message type.

---

### 7.5 MEDIUM RISK: Tailwind to CSS Modules migration volume

**What**: Every `.tsx` file in the repo uses Tailwind utility classes. This is 40+ files that need class-by-class migration.

**Impact**: Large migration surface area. High risk of visual regressions.

**Mitigation**: Migrate in phases (see Section 6.3). Start with components being replaced by DS imports (zero Tailwind needed). Then migrate layout components. Then migrate pages. Use visual regression screenshots at each phase to catch regressions. Keep Tailwind available during migration so both systems coexist temporarily.

---

### 7.6 LOW RISK: Colour palette shift

**What**: Moving Fairy's brand is warm greens and ambers. The DS defaults are blue and purple.

**Impact**: If token overrides are missed, some elements will render in the wrong brand colours.

**Mitigation**: Set all Moving Fairy colour overrides in a single `moving-fairy-tokens.css` file imported after the DS tokens. Audit every screen visually after migration.

---

### 7.7 LOW RISK: Font name discrepancy

**What**: DS uses `Source Sans Pro`. Moving Fairy uses `Source Sans 3` (the renamed successor).

**Impact**: If the CSS has `Source Sans Pro` but the app loads `Source Sans 3` via next/font, the font family declaration won't match and will fall through to the fallback.

**Mitigation**: Override `--font-sans` in the app's CSS to include `'Source Sans 3'`. Or contribute a token update to the DS changing `Source Sans Pro` to `Source Sans 3`.

---

## Summary: Contribution Backlog

Before migration can proceed, these contributions/requests to the Nos DS are needed:

| Priority | Type | Item | Effort |
|---|---|---|---|
| P0 | Contribution | `Button` component | Medium |
| P0 | Contribution | Generic `Badge` component | Small |
| P1 | Contribution | `ConfirmDialog` component | Small-medium |
| P1 | Contribution | `CostStrip` component | Medium |
| P1 | Fix-request | `EditPanel` optional footer | Small |
| P1 | Fix-request | `ChatInput` adornment slots | Small |
| P2 | Contribution | `Skeleton` export (if not already) | Trivial |
| P2 | Fix-request | `EmptyState` optional icon prop | Trivial |
| P2 | Fix-request | Font token update to Source Sans 3 | Trivial |

### Migration Order

1. Set up DS dependency, import tokens, configure Next.js transpile, set colour overrides
2. Contribute P0 items (`Button`, `Badge`) to the DS
3. Replace chat components (`ChatContainer`, `ChatMessage`, `ThinkingDots`)
4. Replace `AssessmentCard` with `RecommendationCard`
5. Replace `OnboardingWizard` shell
6. Replace `AuthCard` on landing/login pages
7. Contribute P1 items and replace panels (`EditPanel`, `ConfirmDialog`)
8. Replace `EmptyState`, `Spinner`, `Toast`
9. Convert remaining local components to CSS Modules with DS tokens
10. Remove Tailwind, shadcn/ui, and all related dependencies
