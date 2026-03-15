# UX Implementation Spec -- Nos Design System Alignment

> Produced by UXicorn. This spec gives a builder agent exact instructions for making Moving Fairy look and behave like a proper Nos fairy app.

---

## Executive Summary

Moving Fairy has a solid functional foundation but its visual and structural patterns diverge significantly from the Nos Design System. The app currently uses a hybrid approach: DS tokens are imported, some DS components are used (Button, EmptyState, Skeleton, Toast), but the page shell, navigation, chat container, and panel architecture are all custom implementations that contradict DS patterns. The result feels like a generic app wearing a few DS components as accessories, rather than a fairy app built on the DS.

There are five structural problems, each detailed below with exact file paths, current state, target state, and specific changes.

---

## Issue 1: Page Shell and Navigation Pattern

### Current State

**Files:**
- `src/components/layout/AppLayout.tsx` (lines 34-123)
- `src/components/layout/AppLayout.module.css`
- `src/components/layout/BottomTabBar.tsx`
- `src/components/layout/BottomTabBar.module.css`

The app has no top Navigation bar at all. The `AppLayout` component goes straight into a side-by-side split layout (desktop) or a mobile tabbed layout with a custom `BottomTabBar`. There is no brand identity visible in the app shell -- the only "Moving Fairy" text appears inside the ChatInterface header (line 288-290), which is semantically wrong (it is the app name, not a chat title).

The `BottomTabBar` is a custom two-tab bar (Chat / Inventory) at the bottom of the screen on mobile. This is not a DS pattern. The DS uses `Navigation` (top nav with gradient underline + hamburger on mobile) and `Sidebar` (left-side nav, drawer on mobile).

### Target State

A Nos fairy app shell follows the showcase app pattern in the DS `(docs)/layout.tsx`:

1. **Top-level shell**: a flex column taking `100vh` with `Navigation` at the top.
2. **Below the nav**: a flex row with the main content area.
3. **No bottom tab bar**. Mobile navigation is handled by the Navigation component's hamburger menu.

For Moving Fairy specifically, the structure should be:

```
[Navigation -- "Moving Fairy" brand, primary items, settings]
[Main content area -- chat-centric with inventory accessible via panel]
```

### Specific Changes

**1a. Add the DS `Navigation` component to the app shell.**

In `src/components/layout/AppLayout.tsx`:

- Import `Navigation` from `@thefairies/design-system/components`.
- Add it as the first child of the root div, before any content.
- Props:
  - `brandName="Moving Fairy"`
  - `brandIcon={<Sparkles size={20} strokeWidth={1.8} />}` (matches the landing page wordmark icon)
  - `activeSection` -- track which section is active (e.g. "chat", "inventory")
  - `onNavigate` -- handle section changes
  - `primaryItems` -- define nav items:
    - `{ key: 'chat', label: 'Chat', icon: MessageCircle }` (from lucide-react)
    - `{ key: 'inventory', label: 'Inventory', icon: Package }` (from lucide-react)
  - `secondaryItems`:
    - `{ key: 'settings', label: 'Settings', icon: Settings }` (triggers profile edit)
  - No CTA button needed.

**1b. Remove the custom `BottomTabBar` entirely.**

- Delete `src/components/layout/BottomTabBar.tsx`
- Delete `src/components/layout/BottomTabBar.module.css`
- Remove the `<BottomTabBar>` render from `AppLayout.tsx` (line 120)
- Remove the `BottomTabBar` import and `ActiveTab` type import
- The Navigation component's hamburger menu handles mobile nav natively

**1c. Remove the duplicate "Moving Fairy" header from ChatInterface.**

- In `src/components/chat/ChatInterface.tsx`, remove the entire `<header>` element (lines 286-310).
- The app name is now in the Navigation bar where it belongs. The chat area should start immediately with the messages scroll area.
- Move the "AI Logic" toggle button to a different location (see Issue 4 below).

**1d. Move sign-out and settings triggers.**

- The "Edit move details" button and `SignOutButton` currently live in the `inventoryHeader` (desktop) and `mobileStrip` (mobile) areas. These should move to the Navigation's `secondaryItems` or be placed in a profile/settings dropdown accessible from the Navigation.
- For the initial pass: Settings icon in the `secondaryItems` triggers the `ProfileEditPanel`. Sign out can be a separate secondary nav item or placed inside the profile panel.

**1e. Update `AppLayout.module.css`.**

The root should become:
```css
.root {
  display: flex;
  flex-direction: column;
  height: 100svh;
  background: var(--color-bg-page);
}

.body {
  display: flex;
  flex: 1;
  overflow: hidden;
}
```

Remove `.mobileStrip`, `.mobileStripInner`, `.mobileStripCost`, `.mobileStripActions`, `.mobileTabs`, `.tabPanel`, `.tabPanelHidden` since these are replaced by the Navigation-driven approach.

---

## Issue 2: Chat Scroll -- Fixed Container with Internal Scroll

### Current State

**Files:**
- `src/components/chat/ChatInterface.tsx` (lines 283-386)
- `src/components/chat/ChatInterface.module.css` (lines 1-170)

The ChatInterface has its own internal scroll area (`.messagesScroll` with `flex: 1; overflow-y: auto`) and a sticky input bar at the bottom. This part is actually structured correctly in the embedded mode. However, there are problems:

1. The `rootEmbedded` class sets `height: 100%` but the parent container in `AppLayout` (`.chatMain`) sets `display: flex; flex: 1; flex-direction: column` -- this should work but the chat header eats 56px before the scroll area starts, and the AI Logic panel floats in a `max-height: 192px` wrapper between the messages and the input.

2. The DS `ChatContainer` component handles this correctly: `.container` is `display: flex; flex-direction: column; height: 100%`, `.messagesArea` is `flex: 1; overflow-y: auto; padding: 16px 24px`, and `.inputArea` is `flex-shrink: 0` with a border-top and background. Moving Fairy's ChatInterface duplicates this pattern with its own CSS but does not use the DS component.

3. When the chat header is removed (Issue 1c), the chat will properly fill its container. But the AI Logic panel placement (between messages and input) disrupts the flow.

### Target State

The chat area should be a clean flex column:
- Messages scroll area (flex: 1, overflow-y: auto)
- Input bar (flex-shrink: 0, pinned to bottom)

The AI Logic panel should not be inline between messages and input (see Issue 4).

### Specific Changes

**2a. Remove the header from ChatInterface (already covered in 1c).**

**2b. Simplify ChatInterface.module.css.**

The `.rootEmbedded` class becomes the only root mode (since standalone mode is no longer needed -- the app always has the Navigation shell):

```css
.root {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-bg-page);
  overflow: hidden;
}
```

**2c. Fix the messages scroll area CSS.**

The `.messagesScroll` class is correct but the `.messagesInnerEmbedded` padding should match the DS ChatContainer's `messagesArea` padding:

```css
.messagesScroll {
  flex: 1;
  overflow-y: auto;
  padding: 16px 24px;  /* matches DS ChatContainer.messagesArea */
}
```

Remove the separate `.messagesInner` and `.messagesInnerEmbedded` wrappers. The messages should sit directly inside the scroll area with natural padding, not inside a constrained `max-width: 672px` box. Chat messages are bubbles -- they have their own max-width (75% per the DS). The container should be full-width of whatever space it is given.

**2d. Fix the input bar wrapper.**

The `.inputWrapper` should match the DS ChatContainer's `.inputArea`:

```css
.inputWrapper {
  flex-shrink: 0;
  padding: 12px 24px 16px;
  border-top: 1px solid var(--color-border-default);
  background: var(--color-bg-card);
}
```

Remove `.inputInner` max-width constraint. The input bar should stretch to fit its container. (On desktop, the chat panel itself is already width-constrained by the layout.)

**2e. Remove the `embedded` prop from ChatInterface.**

Since there is now only one layout mode (always embedded in the app shell), remove the `embedded` prop, the standalone root class, and all the conditional logic around `embedded`.

**2f. Move the "Scroll to bottom" button.**

The `.scrollButtonWrapper` uses `position: absolute; bottom: 112px`. This should be positioned relative to the messages scroll area, not the page. Wrap it inside the scroll area or use a relative-positioned parent. The offset should be `bottom: 16px` (just above the input bar separator), positioned `left: 50%; transform: translateX(-50%)` relative to the scroll area.

To achieve this, make `.messagesScroll` the positioning context:
```css
.messagesScroll {
  position: relative;
  /* ...existing flex/scroll styles... */
}
```

And change `.scrollButtonWrapper` to:
```css
.scrollButtonWrapper {
  position: sticky;
  bottom: 8px;
  display: flex;
  justify-content: center;
  pointer-events: none;
}

.scrollButton {
  pointer-events: auto;
  /* ...existing styles... */
}
```

---

## Issue 3: Chat-Primary Layout with Inventory as a Side Panel

### Current State

**Files:**
- `src/components/layout/AppLayout.tsx` (lines 75-97)
- `src/components/layout/AppLayout.module.css` (lines 54-101)

The desktop layout puts inventory on the left (40%, min 320px, max 480px) and chat on the right (60%). This gives inventory equal visual weight to the chat, which contradicts the app's interaction model: the chat with Aisling is the primary experience, and inventory is a reference panel that builds over time.

The split is also backwards compared to DS conventions. In the DS showcase app, the sidebar/secondary content is on the left and the main content is on the right. But for a chat-centric fairy app, the better pattern is: chat takes the full width, with inventory available in a collapsible right-side panel.

### Target State

The DS has two panel patterns that are relevant:

1. **SidePanel** (`src/components/SidePanel/SidePanel.tsx`): A resizable right-side panel with a tab bar (Logic / Preview). It is always visible on desktop, sitting to the right of the main content. It has a resize handle.

2. **EditPanel** (`src/components/EditPanel/EditPanel.tsx`): A slide-in overlay panel from the right with a backdrop, ESC to close, focus trap, and sticky footer. Used for editing forms.

For Moving Fairy, the inventory should use a **SidePanel-style approach** -- a right-side panel that can be toggled open/closed, with a resize handle when open. On mobile, inventory should slide in as a full-screen overlay (EditPanel pattern).

### Specific Changes

**3a. Restructure the desktop layout.**

Replace the current split layout in `AppLayout.tsx` with:

```tsx
<div className={styles.body}>
  {/* Chat -- primary content, takes remaining space */}
  <main id="main-content" className={styles.chatMain}>
    {chatPanel}
  </main>

  {/* Inventory -- right side panel, toggleable */}
  {inventoryOpen && (
    <aside className={styles.inventoryPanel} style={{ width: inventoryWidth }}>
      <div className={styles.resizeHandle} onMouseDown={handleResizeStart}>
        <div className={styles.resizeLine} />
      </div>
      <div className={styles.inventoryContent}>
        {inventoryPanel}
      </div>
    </aside>
  )}
</div>
```

**3b. Add toggle state for inventory visibility.**

In `AppLayout.tsx`, add:
```tsx
const [inventoryOpen, setInventoryOpen] = useState(false);
const [inventoryWidth, setInventoryWidth] = useState(380);
```

The inventory starts **closed** on first load (before any items are assessed, it is empty anyway). It opens when:
- The user taps the Inventory nav item
- An assessment is saved (via a callback or event)

Pass `onToggleInventory` through to the Navigation's `onNavigate` handler:
- Clicking "Chat" closes the inventory panel
- Clicking "Inventory" opens it
- On desktop, the Navigation items act as panel toggles, not page navigations

**3c. Implement resize behaviour (matching DS SidePanel).**

Copy the resize logic from the DS `SidePanel.tsx` (lines 49-78). The resize handle sits on the left edge of the inventory panel:

```css
.inventoryPanel {
  display: flex;
  height: 100%;
  position: relative;
  border-left: 1px solid var(--color-border-default);
  background: var(--color-bg-card);
  flex-shrink: 0;
}

.resizeHandle {
  position: absolute;
  top: 0;
  left: -3px;
  width: 6px;
  height: 100%;
  cursor: col-resize;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
}

.resizeLine {
  width: 2px;
  height: 100%;
  background: var(--color-border-default);
  transition: background var(--transition-fast);
}

.resizeHandle:hover .resizeLine {
  background: var(--color-border-input);
}
```

Min width: 320px. Max width: 50% of viewport. Default: 380px.

**3d. Mobile: Inventory as a full-screen overlay.**

On mobile, clicking the Inventory nav item (in the hamburger menu) opens the inventory as a full-screen panel sliding in from the right, using the EditPanel pattern:

```css
@media (max-width: 767px) {
  .inventoryPanel {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    z-index: var(--z-panel);
    transform: translateX(100%);
    transition: transform var(--transition-panel);
  }

  .inventoryPanelOpen {
    transform: translateX(0);
  }
}
```

Add a close button at the top of the mobile inventory panel, matching the DS Sidebar's mobile close pattern. Add a backdrop overlay behind it.

**3e. Cost summary strip on mobile.**

The current `mobileStrip` with `CostSummary` is useful context. Instead of removing it entirely, integrate it into the Navigation area or as a subtle sub-header bar visible only on mobile. This strip should be a single line: "12 items | 2.4 CBM | ~EUR 1,250" -- always visible on mobile as orientation context.

Place it directly below the Navigation bar on mobile:

```css
.costStrip {
  display: none;
}

@media (max-width: 767px) {
  .costStrip {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px 16px;
    font-size: 12px;
    color: var(--color-text-muted);
    background: var(--color-bg-card);
    border-bottom: 1px solid var(--color-border-default);
    flex-shrink: 0;
  }
}
```

---

## Issue 4: AI Logic Panel Placement

### Current State

**Files:**
- `src/components/chat/ChatInterface.tsx` (lines 293-298, 371-378)
- `src/components/chat/ChatInterface.module.css` (lines 146-158)
- `src/components/chat/AILogicPanel.tsx`
- `src/components/chat/AILogicPanel.module.css`

The AI Logic button sits in the ChatInterface header (which we are removing). The panel itself renders inline between the messages area and the input bar, capped at `max-height: 192px`. This disrupts the chat flow and the toggle button has no clear home.

The DS pattern for this is the **SidePanel** component, which has a tab bar with "AI Logic" and "Preview" tabs. The SidePanel sits to the right of the main content, alongside it.

### Target State

The AI Logic panel should follow the DS SidePanel pattern. Since Moving Fairy already uses the right panel position for inventory, the AI Logic panel has two viable placements:

**Option A (recommended):** AI Logic becomes a tab within the inventory panel. The inventory panel gets a tab bar at the top: "Inventory" | "AI Logic". This matches the DS SidePanel's tab pattern exactly and avoids having two competing right panels.

**Option B:** AI Logic stays as a collapsible drawer at the bottom of the chat area, but only as a small developer tool. This is acceptable for a developer/debug feature but not a user-facing feature.

### Specific Changes (Option A)

**4a. Add a tab bar to the inventory panel.**

In `InventoryPanel.tsx` (or in the parent that wraps it), add a tab bar above the inventory content:

```tsx
<div className={styles.sidePanelTabs}>
  <button
    className={`${styles.sidePanelTab} ${activeTab === 'inventory' ? styles.sidePanelTabActive : ''}`}
    onClick={() => setActiveTab('inventory')}
  >
    Inventory
  </button>
  <button
    className={`${styles.sidePanelTab} ${activeTab === 'logic' ? styles.sidePanelTabActive : ''}`}
    onClick={() => setActiveTab('logic')}
  >
    AI Logic
  </button>
</div>
```

Style the tab bar to match the DS SidePanel's `.tabBar` CSS:

```css
.sidePanelTabs {
  display: flex;
  border-bottom: 1px solid var(--color-border-default);
  padding: 0 16px;
  flex-shrink: 0;
}

.sidePanelTab {
  padding: 10px 16px;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-muted);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition: color var(--transition-fast), border-color var(--transition-fast);
}

.sidePanelTab:hover {
  color: var(--color-text-primary);
}

.sidePanelTabActive {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
}
```

**4b. Move AI Logic state and props up.**

The `logicEvents` and `isStreaming` state currently live in `ChatInterface.tsx`. They need to be lifted up to the parent `ChatWithInventory` component (or an intermediate context) so the inventory panel tab can access them.

In `src/components/layout/ChatWithInventory.tsx`:

```tsx
export function ChatWithInventory() {
  const [logicEvents, setLogicEvents] = useState<LogicEvent[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  return (
    <AppLayout
      chatPanel={
        <ChatInterface
          onLogicEvent={(event) => setLogicEvents(prev => [...prev, event])}
          onStreamingChange={setIsStreaming}
        />
      }
      inventoryPanel={
        <InventorySidePanel
          logicEvents={logicEvents}
          isStreaming={isStreaming}
        />
      }
    />
  );
}
```

**4c. Remove the AI Logic button from the chat header.**

Since the chat header is being removed entirely (Issue 1c), and the AI Logic panel is now a tab in the side panel, the toggle button is no longer needed in the chat area.

**4d. Style the AI Logic content to match DS SidePanel's `.logicContent`.**

The current `AILogicPanel.tsx` has its own styling. Migrate it to match the DS SidePanel's logic content pattern:

- Background: `var(--color-bg-panel)` (not `var(--color-bg-subtle)`)
- Logic entries should use the DS `.logicEntry` pattern with left border colours:
  - `tool_call`: `var(--color-primary)` left border
  - `tool_result`: `var(--color-success)` left border
- Font: `var(--font-mono)`, size 11px, line-height 1.5
- Labels: uppercase, 10px, 600 weight, letter-spacing 0.5px
- The content area should use `flex: 1; overflow-y: auto; padding: 12px`

---

## Issue 5: Token Conflicts and Visual Inconsistencies

### Current State

**Files:**
- `src/app/globals.css` (the Tailwind/shadcn theme)
- `src/app/moving-fairy-tokens.css` (DS token overrides)
- `src/app/layout.tsx` (import order)

There is a fundamental conflict between two token systems:

1. **Tailwind/shadcn tokens** in `globals.css` using oklch colour space: `--primary: oklch(0.55 0.18 145)`, `--background: oklch(0.985 0.008 90)`, `--border: oklch(0.9 0.01 90)`, etc.
2. **DS tokens** imported from `@thefairies/design-system/styles/tokens.css` using hex: `--color-primary: #005EFF`, `--color-bg-page: #f3f4f6`, `--color-border-default: #e5e7eb`, etc.
3. **Moving Fairy token overrides** in `moving-fairy-tokens.css` using hex: `--color-primary: #16a34a`.

The import order in `layout.tsx` is:
1. DS `tokens.css` (sets `--color-primary: #005EFF`)
2. DS `animations.css`
3. `moving-fairy-tokens.css` (overrides to `--color-primary: #16a34a`)
4. `globals.css` (sets `--primary: oklch(...)` -- a different variable name)

This means:
- DS components that use `var(--color-primary)` get the Moving Fairy green. This is correct.
- shadcn/Tailwind components that use `var(--primary)` get the oklch green. This is a different colour value for the same intent.
- CSS modules that reference `var(--color-bg-page)` get the DS value (`#f3f4f6`). But Tailwind's `bg-background` maps to `var(--background)` which is `oklch(0.985 0.008 90)`. These are similar but not identical.
- The error styling in `ChatInterface.module.css` references `hsl(var(--destructive))` (shadcn pattern) and also has fallbacks to DS tokens. This is messy.

The font has a similar issue: `--font-sans` is defined in both `moving-fairy-tokens.css` (as `'Source Sans 3', ...`) and in `globals.css` (as `var(--font-sans), 'Source Sans 3', ...` which is circular). The `Source_Sans_3` next/font variable `--font-sans` is set on the `<html>` element, which should take precedence, but the cascading is fragile.

### Target State

One token system. The DS tokens are the source of truth. The shadcn/Tailwind variables should be bridged to the DS tokens, not the other way around.

### Specific Changes

**5a. Bridge Tailwind theme variables to DS tokens.**

In `globals.css`, update the `:root` block to reference DS tokens instead of defining its own colours:

```css
:root {
  --background: var(--color-bg-page);
  --foreground: var(--color-text-primary);
  --card: var(--color-bg-card);
  --card-foreground: var(--color-text-primary);
  --popover: var(--color-bg-card);
  --popover-foreground: var(--color-text-primary);
  --primary: var(--color-primary);
  --primary-foreground: var(--color-text-inverse);
  --secondary: var(--color-bg-panel);
  --secondary-foreground: var(--color-text-secondary);
  --muted: var(--color-bg-subtle);
  --muted-foreground: var(--color-text-muted);
  --accent: var(--color-warning);
  --accent-foreground: var(--color-warning-dark);
  --destructive: var(--color-error);
  --border: var(--color-border-default);
  --input: var(--color-border-input);
  --ring: var(--color-primary);
  --radius: 0.75rem;
}
```

This ensures that any Tailwind utility class or shadcn component that reads `var(--primary)` gets the exact same green as a DS component reading `var(--color-primary)`.

**5b. Remove oklch colour definitions from globals.css.**

Delete the entire current `:root` block (lines 57-90) and the `.dark` block (lines 92-124) and replace with the bridge above. Dark mode can be added later when the DS supports it.

**5c. Clean up fallback values in CSS modules.**

Throughout the CSS modules, there are fallback patterns like:
```css
color: var(--color-text-muted, hsl(var(--muted-foreground)));
background: var(--color-bg-page, hsl(var(--background)));
```

Once the tokens are unified, remove all the `hsl(var(...))` fallbacks. Every CSS module should reference only `var(--color-*)`, `var(--radius-*)`, `var(--shadow-*)`, etc. from the DS token system. Audit and update:

- `src/components/chat/ChatInterface.module.css` -- 13 instances of `hsl(var(...))` fallbacks
- `src/components/chat/AILogicPanel.module.css` -- 8 instances
- `src/app/page.module.css` -- uses DS tokens already, good

**5d. Ensure the font stack resolves correctly.**

In `layout.tsx`, the `Source_Sans_3` font is loaded via `next/font/google` and assigned to CSS variable `--font-sans`. In `moving-fairy-tokens.css`, `--font-sans` is also set. The next/font variable is set on the `<html>` element's `className`, which takes highest specificity.

Remove the `--font-sans` definition from `moving-fairy-tokens.css` (line 53) since it conflicts with the next/font setup. The next/font variable already includes the correct fallback stack. Verify that the DS token `--font-sans` in `tokens.css` (which references 'Source Sans Pro') is overridden by the app's next/font variable -- it should be since the app's variable is set on `<html>` via className.

**5e. Verify Moving Fairy brand colours are visible.**

The warm clover green (`#16a34a`) is correctly set in `moving-fairy-tokens.css` as `--color-primary`. Verify these are rendering:

- Navigation gradient underline: `--gradient-nav-bar` is set to `linear-gradient(135deg, #16a34a, #15803d)`. The DS Navigation uses this for its `::after` pseudo-element. This will render a green gradient line -- good, but it is a single-colour gradient (dark green to slightly darker green). Consider making this more visually distinctive: `linear-gradient(90deg, #16a34a, #22c55e, #16a34a)` for a subtle shimmer effect.
- Chat send button: Uses `var(--color-primary)` -- will be green. Correct.
- Active nav items: Will use `var(--color-primary)` -- green underline and text. Correct.
- Chat user bubbles: DS pattern uses `var(--color-primary)` background. Moving Fairy's `MessageBubble` component should follow this.

---

## Additional Findings

### A. Cards Are Not Using DS Card Pattern

The DS card pattern (from AGENT_GUIDE.md) specifies: white background, `--shadow-card`, coloured top border (3px), 20px padding, 8-12px border-radius.

The inventory panel's `BoxCard` and item rows do not follow this. The `singleItemRow` in `InventoryPanel.module.css` has `border: 1px solid var(--color-border-default)` and `border-radius: var(--radius-lg)` with no top border accent and no card shadow.

**Fix:** Update BoxCard and single item rows to use the DS card pattern:
```css
.card {
  background: var(--color-bg-card);
  box-shadow: var(--shadow-card);
  border-radius: var(--radius-lg);
  padding: var(--space-card-padding);
  border-top: 3px solid var(--color-primary);
}
```

For verdict-specific cards, use the verdict colour as the top border:
- SHIP/CARRY: `var(--verdict-ship)` (green)
- SELL: `var(--verdict-sell)` (amber)
- DONATE/DISCARD: `var(--verdict-donate)` (grey)
- REVISIT: `var(--verdict-revisit)` (blue)

### B. Status Indicators Should Use DS StatusPill

The `BoxStatusBadge` and `VerdictBadge` components should use the DS `StatusPill` pattern with bg/fg colour pairs. Currently Moving Fairy has its own verdict badge tokens (`--verdict-ship-bg`, `--verdict-ship-fg`, etc.) -- these are correct but should be mapped to the DS `StatusPill` component or at minimum follow the same visual pattern (pill shape, token-driven bg/fg).

**Fix:** Either:
1. Use the DS `Badge` component directly (imported from `@thefairies/design-system/components`), passing `bgColor` and `fgColor` from the verdict token pairs.
2. Or ensure the custom badges use `border-radius: var(--radius-pill)` and the same size/weight pattern as DS pills (font-size 12px, font-weight 600, padding 2px 8px).

### C. Recommendation Cards for Item Assessments

The DS has a `RecommendationCard` component that is purpose-built for the Moving Fairy use case: an AI recommendation with confirm/skip actions, confidence indicator, badge, rationale, action, warning, and metadata. The item assessment cards in the chat should use this component instead of custom card markup.

When Aisling gives an assessment (SHIP, SELL, etc.), the chat should render a `RecommendationCard`:
- `title`: item name
- `rationale`: Aisling's reasoning
- `badge`: `{ label: verdict, color: verdictColor }`
- `confidence`: assessment confidence
- `action`: next step text
- `metadata`: ship cost vs replace cost pairs
- `onConfirm`: saves the assessment
- `onSkip`: lets user request revision
- `confirmLabel`: "Save assessment"
- `skipLabel`: "Revise"
- `accentColor`: verdict colour

This is already partially implemented (the `ChatMessage` has a `card` type with these fields) but it is using custom markup rather than the DS component.

### D. Empty State Component Usage

The `InventoryPanel` correctly uses the DS `EmptyState` component. The `ChatInterface` empty state (lines 319-324) does not -- it uses a plain `<p>` tag.

**Fix:** Replace with:
```tsx
<EmptyState
  heading="Getting ready"
  description="Aisling is getting ready... give her a moment."
/>
```

### E. Loading Patterns

The `InventoryPanel` correctly uses DS `Skeleton` and `SkeletonGroup` components. The `ChatInterface` uses a custom `TypingIndicator` component. This should use the DS `ThinkingDots` component for the waiting state, and the DS `TypingCursor` component for the streaming state.

### F. Transition Tokens

Several CSS modules hardcode transition durations instead of using DS tokens:
- `ChatInterface.module.css` line 138: `transition: background var(--transition-fast, 0.15s)` -- the fallback is fine but ensure the DS token resolves.
- `AILogicPanel.module.css` -- no transition tokens used at all.

**Fix:** Replace all hardcoded durations with `var(--transition-fast)`, `var(--transition-medium)`, or `var(--transition-slow)`.

### G. Shadow Tokens

The `.scrollButton` in `ChatInterface.module.css` (line 133) uses a raw `box-shadow` value instead of `var(--shadow-dropdown)` or `var(--shadow-card)`. The intro blockquote on the landing page correctly uses `var(--shadow-card)`.

**Fix:** Replace with `box-shadow: var(--shadow-dropdown)`.

---

## Implementation Priority

1. **Issue 5: Token unification** -- Do this first. It is the foundation. Everything else looks wrong if the tokens conflict.
2. **Issue 1: Navigation** -- Add the DS Navigation component. This establishes the fairy app identity.
3. **Issue 2: Chat scroll** -- Fix the chat container structure. Remove the header, clean up the CSS.
4. **Issue 3: Inventory as side panel** -- Restructure the layout to chat-primary with inventory as a toggleable right panel.
5. **Issue 4: AI Logic placement** -- Move into the side panel tab bar.
6. **Additional findings A-G** -- Apply card patterns, recommendation cards, empty states, loading patterns, and token consistency.

---

## Files to Create

None. All changes are to existing files.

## Files to Delete

- `src/components/layout/BottomTabBar.tsx`
- `src/components/layout/BottomTabBar.module.css`

## Files to Modify (in priority order)

1. `src/app/globals.css` -- bridge Tailwind vars to DS tokens
2. `src/app/moving-fairy-tokens.css` -- remove `--font-sans` line
3. `src/components/chat/ChatInterface.module.css` -- remove hsl fallbacks, clean up structure
4. `src/components/chat/AILogicPanel.module.css` -- remove hsl fallbacks
5. `src/components/layout/AppLayout.tsx` -- add Navigation, remove BottomTabBar, restructure layout
6. `src/components/layout/AppLayout.module.css` -- new layout styles
7. `src/components/chat/ChatInterface.tsx` -- remove header, remove embedded prop, remove AI Logic toggle
8. `src/components/layout/ChatWithInventory.tsx` -- lift AI Logic state
9. `src/components/inventory/InventoryPanel.tsx` -- add side panel tab bar for AI Logic
10. `src/components/inventory/InventoryPanel.module.css` -- add tab bar styles, update card patterns

## DS Components to Import (not yet used)

- `Navigation` -- for the app shell top nav
- `ThinkingDots` -- for AI waiting state in chat
- `TypingCursor` -- for AI streaming state in chat
- `RecommendationCard` -- for item assessment cards in chat
- `Badge` -- for verdict badges (already have access but may not be using)

## DS Components Already Used (verify correct usage)

- `Button` -- used correctly
- `EmptyState` -- used in InventoryPanel, need to add to ChatInterface
- `Skeleton`, `SkeletonGroup` -- used correctly in InventoryPanel
- `ToastProvider` -- used correctly in root layout
