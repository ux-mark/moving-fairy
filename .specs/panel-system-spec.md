---
name: panel-system-spec
kind: implementation-spec
status: in-progress
owner: queen (coordinating), approved by user 2026-06-10
---

# Panel System, Live Data & Upload Overhaul — Master Spec

User-approved direction (2026-06-10). This spec is the single source of truth for the
`feat/panel-system-live-data` branch. It supersedes the drawer/full-page dual pattern.

## Non-negotiable constraints

- **Live data**: Supabase online holds the user's real data. Never modify or delete rows.
  Structural DDL (new tables, publications, RLS, indexes) is allowed. Any future
  data-shape migration requires a backup first and explicit user sign-off.
- UX_STANDARDS.md and UX_PATTERNS.md are law (no truncation, no emoji, 44px targets,
  action alignment, four data states, Escape + focus return).
- No Playwright/browser testing unless the user asks. Vitest unit tests are expected.
- Design tokens only — no magic numbers. Reuse DS components where they exist.
- Performance is a feature: the app must feel instant (see §7).

## 1. Panel framework (`src/components/panels/`)

A single floating-panel system replaces ALL of: `ItemDetailDrawer`, `BoxDetailDrawer`,
`SellingDetailDrawer`, `FloatingChatPanel`, and the full-page `/decisions/[id]` view.

### Core pieces

- **`PanelProvider`** (client context, mounted in `(app)` layout): owns the set of open
  panels: `{ id, kind: 'item'|'box'|'listing'|'chat', entityId, side: 'left'|'right',
  pos?, size?, minimised, zIndex }`. Exposes `openPanel`, `closePanel`, `minimisePanel`,
  `restorePanel`, `focusPanel`.
- **`Panel`** — the floating window. Desktop (≥1024px): absolutely positioned, draggable
  by header, resizable from the bottom-right corner, minimise + close buttons in header
  (visible text on close per standards is satisfied by aria-label + tooltip; header also
  carries the entity title). Adapt the proven drag/resize/persist logic from
  `FloatingChatPanel.tsx` (then delete that file). Mobile (<1024px): full-screen sheet,
  no drag/resize, swipe-down or Close to dismiss, Minimise sends to tray.
- **Smart placement**: default dock side is **right**. If the open request originates
  from inside a right-docked panel (or the trigger element's centre is in the right
  half of the viewport while a right panel is focused), the new panel docks **left**.
  `openPanel` accepts `{ originSide }` computed from the trigger's bounding rect /
  source panel. Multiple panels may be open simultaneously; focused panel gets top z.
- **Panel tray**: desktop — a tray in the top bar (per UX_STANDARDS § Panels) showing a
  chip per minimised/open panel (thumbnail or kind icon + name); click restores/focuses.
  Mobile — a slim chip strip docked directly **above the bottom nav** (thumb-reachable).
  Tray chips show a subtle live indicator when background data for that panel changed
  while minimised.
- **Accessibility**: each panel is a `<section role="dialog" aria-modal="false">` with
  `aria-labelledby` its title; Escape closes the focused panel and returns focus to the
  trigger; tab order follows visual order.

### Persistence (cross-device)

New table `user_panel_state`:

```sql
create table user_panel_state (
  user_profile_id uuid primary key references user_profile(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,   -- { panels: [...], tray: [...] }
  updated_at timestamptz not null default now()
);
-- RLS: owner-only select/insert/update (match existing user_profile policy style).
-- Add to supabase_realtime publication so other devices sync live.
```

Client: debounce writes (~1s) via `PATCH /api/panel-state`; hydrate on app load; subscribe
to realtime changes so opening a panel on the phone shows in the desktop tray. Local
echo-suppression (ignore realtime events whose `updated_at` matches our own write).

## 2. Live data layer (kills the stale-data problem)

- **Enable realtime** on `box`, `box_item`, `listing`, `shipment` (verify exact table
  names in `supabase/migrations/`): `replica identity full` + add to `supabase_realtime`
  publication, with RLS-safe policies (mirror the `item_assessment` migration
  20260316000003). Migration files in `supabase/migrations/`, applied to the live DB
  via psql using creds in `.env` (structure only — no data touched).
- **`useLiveTable(table, filter)`** shared hook in `src/lib/hooks/`: one consolidated
  channel per table per profile, INSERT/UPDATE/DELETE merge into local state, automatic
  refetch on `visibilitychange`/`focus`, automatic resubscribe on reconnect. `useItems`
  refactors onto it; new `useBoxes`, `useListings`, `useShipments` replace one-shot
  fetches in `ItemDetailDrawer` (→ ItemPanel), `ItineraryView`, `BoxManagement`,
  `SellingList`.
- **Remove the blanket 5s polling** in `useItems` (keep targeted stuck-item recovery
  with backoff: only items in `processing` older than 3 min).
- Server pages: export `const dynamic = 'force-dynamic'` (or `revalidate = 0`) for
  authed data pages so navigation never serves a 30s-stale snapshot; the realtime layer
  carries updates from there.
- After mutations in API routes, no `revalidatePath` games needed once pages are dynamic
  + realtime; keep optimistic updates as they are.
- Panels NEVER need closing to refresh: their data comes from live hooks.

## 3. Entity panels

- **`ItemPanel`** — verdict header strip (reuse current drawer's), photo,
  `ItemEditPanel` form, and a **chat sub-panel**: `PerItemChat` hosted in its own
  child `Panel` (kind 'chat', linked to the item panel, independently movable/
  minimisable; opens docked beside its parent). Opening an item anywhere (decisions
  list, items grid, itinerary row, box contents) calls `openPanel({kind:'item'})`.
- **`BoxPanel`** — replaces `BoxDetailDrawer` (hosts `BoxCard` open state).
- **`ListingPanel`** — replaces `SellingDetailDrawer` (hosts `ListingEditor`).
- **Deep links**: `/decisions/[id]` becomes a redirecting shell: renders the decisions
  page with the item panel open (`/decisions?item=<id>`); same for `?box=` and
  `?listing=` params. URL stays shareable; browser Back closes the panel. The old
  `ItemDetailView` split-screen dies.
- Itinerary inline editing stays (different job: bulk per-field edits), but its row
  click-through opens the ItemPanel.

## 4. Mobile navigation

- Move global nav to a **bottom tab bar** on <1024px (user decision; overrides the
  earlier "Issue 1" choice). Desktop keeps the current DS top Navigation. Check whether
  the DS `Navigation` supports a bottom variant; if not, build `BottomNav` in
  `src/components/layout/` with 44px+ targets, labels under icons (never icon-only),
  active state not colour-alone, safe-area inset padding.
- Tray strip sits directly above the bottom nav (see §1).

## 5. Background uploads (up to 50 images)

New `UploadProvider` (client context in `(app)` layout) + `useUploadQueue`:

- Accept up to **50** files per batch; >50 → friendly message, take first 50.
- **Bounded concurrency: 3** simultaneous `/api/upload` POSTs (sharp on the server is
  CPU-heavy; 50 parallel requests would crush the M1/16GB host). Queue the rest.
- Uploads continue while the user navigates anywhere in the app (provider lives above
  routes). Page refresh/close mid-upload: use `beforeunload` warning while queue active.
- **Progress UI**: a docked, non-blocking progress card (bottom-right desktop, above
  tray on mobile): "Uploading 12 of 50…" + determinate bar + per-file failure count;
  collapsible to a tray-style chip; retry-failed action; success confirmation state
  ("48 photos added") that auto-dismisses. Skeleton cards still appear in the decisions
  list as today (via optimistic items), driven by the queue.
- `BatchUploadButton` stops blocking on the whole batch — it just enqueues and the
  button returns to idle immediately.

## 6. AI logic consolidation (no behaviour change)

- Single source for tool schemas: `src/lib/ai/tools.ts` (render_assessment_card,
  update_item_assessment). Import in `assess-item.ts` + chat route.
- Extract shared image-attachment helper (SDK base64 vs CLI temp file) used by
  assess-item, chat route, scan-sticker.
- Extract executor selection (SDK vs CLI) into one factory; consistent 401-retry.
- Recompose prompts properly: `composeAislingCore(profile)` + mode-specific suffixes;
  delete the `indexOf('## Background Assessment Mode')` string-slicing in
  `per-item-chat-prompt.ts`.
- `.claude/agents/aisling.md`: remove the stale duplicate-detection instructions
  (Phase 1 allows duplicates by design).

## 7. Performance ("lightning fast")

- No polling loops at rest (realtime only); consolidated channels.
- `next/dynamic` for heavy, conditionally-shown components (panels, chat, scanner).
- `React.memo` on list cards (`ItemCard`, `BoxCard` rows) with stable callbacks.
- Keep payloads lean: list endpoints select only list-needed columns where trivial.
- Images: already WebP/1024px — keep; ensure `loading="lazy"` + explicit dimensions on
  list thumbnails.
- Measure: `npm run build` must succeed with no new large first-load chunks on main
  routes (report the before/after route sizes).

## 8. UX violations cleanup (from 2026-06-10 audit)

- Remove all `text-overflow: ellipsis` / `line-clamp` on copy (6+ files incl.
  ScanDraftReview, PublicListingCard, ItemPicker, PerItemChat, PlantCareIcons) — wrap
  or fix layout instead.
- `window.confirm` in `ListingEditor.tsx:258` → proper ConfirmDialog (destructive
  primary, cancel left).
- "Arrived ✓" emoji in `BoxStatusBadge.tsx:29` → text only.
- "Decide →" / "Edit →" arrows-in-text (ItemsView, DecisionsList, SellingList) →
  plain verb labels (or chevron icon outside the text).
- Icon-only buttons below 44px (FloatingChatPanel's pattern, ListingEditor photo
  actions) → 44px hit area minimum on touch; visible labels where the icon isn't in
  the recognised set.
- Control-level wrap decisions move from viewport breakpoints to content-driven
  flex-wrap where flagged (e.g. ItemEditPanel cost fields at 560px).

## Phasing

1. **A** Panel framework + tray + persistence (+ DDL). **B** Live data layer (+ DDL). [parallel]
2. **C** Entity panels + deep links + delete old surfaces. **D** AI consolidation. [parallel]
3. **E** Bottom nav + tray strip + upload queue. **F** UX violations sweep. [parallel]
4. Review, typecheck, lint, vitest, build, route-size report.

Each phase commits separately. Conventional commits.
