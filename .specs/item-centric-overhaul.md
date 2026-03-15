# Item-Centric UX Overhaul — Implementation Plan

> **Status**: Approved for implementation
> **Created**: 2026-03-15
> **Scope**: 3 phases, incremental delivery

---

## Summary

Moving Fairy shifts from **chat-centric** (one big conversation, assessments fall out) to **item-centric** (decisions list is home, each item has its own conversation with Aisling).

### Core Principles

- The **Decisions list** is home. Not chat.
- **Two ways to add items**: batch photo upload or text description. Neither starts a chat.
- **Background processing**: upload, put the phone down, come back later. Items appear as they're assessed.
- **Per-item chat**: the user opens a conversation about a specific item only when they want to discuss it.
- **Everything uses Nos DS**. No exceptions. If the DS needs extending, extend it first.
- **Processing feedback is non-interruptive**: items load in the background, never interrupt what the user is doing.

---

## Three User Journeys

### Journey 1: Initial Assessment (Phase 1 focus)

The user has items they need assessed.

**Photo upload path:**
1. User is on `/decisions` (home). Taps an add/upload button.
2. Selects as many photos as they want from their camera roll or takes photos. No artificial limit.
3. Each photo uploads to Supabase Storage. As each uploads, a card appears showing:
   - The image thumbnail
   - A simple processing state: "Aisling is looking at this one..."
   - No item name yet (we don't know what it is)
4. Server fires one `/api/assess/:id` call per item (fire-and-forget). Each runs independently.
5. As each assessment completes, the card updates in place via Supabase Realtime:
   - Item name, verdict badge, rationale, costs appear
   - Smooth transition, no page jump, no interruption to the user
6. User reviews items at their own pace. Taps a card to see the full assessment.
7. If they want to discuss, they open a per-item chat with Aisling from the item detail view.

**Text input path:**
1. User taps "Describe an item" or types in a quick-add input.
2. Types "Le Creuset Dutch oven" or "KitchenAid Pro 5 Plus".
3. Card appears with the item name and processing state.
4. Same background assessment flow. Card updates when complete.

**Error handling:**
- Upload fails: retry button on the card. Toast: "Photo upload failed. Check your connection and try again."
- Assessment fails: card shows failed state with retry button. "Aisling couldn't assess this item. Tap to retry."
- Low confidence: `needs_clarification` flag. Card shows: "Aisling needs more info about this one." Tapping opens per-item chat where Aisling asks a clarifying question.

### Journey 2: Inventory Verification (Phase 3)

The user has packed boxes and wants to verify everything is in the system.

**Manual add:**
1. User navigates to a box in `/boxes/:id`.
2. Adds items by name or selects from existing assessed items.
3. New items without assessments get a background assessment triggered automatically.

**Box sticker scan:**
1. User takes a photo of the handwritten inventory sticker on a box.
2. Upload to `/api/scan-sticker/:boxId`.
3. LLM reads the sticker, returns a list of item names.
4. System cross-references each item against existing assessments (fuzzy name match).
5. Matched items: assigned to the box. New items: created with `pending` status, assessment triggered.
6. Reconciliation summary: "Found 8 items. 5 matched existing assessments, 3 are new and being assessed."
7. Sticker partially illegible: "I could read 5 of the items. Add the rest manually."

### Journey 3: Customs Planning (future — architect for it)

Read-heavy reporting view on existing data. No new data model needed beyond what Phase 1 and 2 create. The decisions list + box management provides the foundation.

---

## Information Architecture

```
/                       Landing page (unchanged)
/onboarding             Onboarding wizard (unchanged)
/decisions              HOME: decisions list + add items
/decisions/:id          Item detail + per-item chat with Aisling
/boxes                  Box management (extracted from inventory panel)
/boxes/:id              Single box detail
```

**Navigation** (Nos DS `Navigation` component):
- Primary: "Decisions" (home), "Boxes"
- Secondary: "Settings"

**Responsive layout:**
- **Mobile (320px)**: single-column card stack. Upload button as sticky FAB. Item detail is full-screen push navigation.
- **Tablet (768px)**: single-column with wider cards. Item detail can be side panel.
- **Desktop (1280px+)**: split view — decisions list left (~60%), item detail/chat right (~40%). Clicking a card opens detail in the right panel.

---

## Phase 1: Decisions as Home + Background Processing

### Prerequisites

1. **Set up RLS policies on `item_assessment`** (MF-ISSUE-005). Required for Supabase Realtime to deliver filtered updates per user.
2. **DB wipe** — clean slate. No migration of existing data needed.

### Data Model Changes

```sql
-- New columns on item_assessment
ALTER TABLE item_assessment ADD COLUMN processing_status TEXT NOT NULL DEFAULT 'completed'
  CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed'));

ALTER TABLE item_assessment ALTER COLUMN verdict DROP NOT NULL;
-- Verdict is null while pending/processing

ALTER TABLE item_assessment ADD COLUMN confidence INTEGER NULL;
-- 0-100 confidence score from LLM

ALTER TABLE item_assessment ADD COLUMN needs_clarification BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE item_assessment ADD COLUMN source TEXT NOT NULL DEFAULT 'chat'
  CHECK (source IN ('photo_upload', 'text_add', 'sticker_scan', 'manual'));
```

**Rename `REVISIT` to `UNDECIDED`** (or whatever the user prefers) across the codebase as part of this migration.

### New API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `POST /api/items` | POST | Create a new item from photo upload or text. Returns the record with `pending` status. |
| `POST /api/assess/:id` | POST | Trigger background assessment for a single item. Returns 200 immediately after setting status to `processing`. Continues processing — calls LLM, updates to `completed` or `failed`. Client uses Realtime, not the HTTP response. |
| `GET /api/items` | GET | Get all items for the current user. Replaces `/api/assessments`. Supports filters: `status`, `verdict`, `confirmed`. |
| `GET/PATCH/DELETE /api/items/:id` | — | Single item operations. Replaces `/api/assessments/:id`. |

### `/api/assess/:id` — Design

1. Validate item exists and belongs to the authenticated user.
2. Check `processing_status` — if already `completed`, return early (idempotent).
3. Set `processing_status = 'processing'`.
4. Build a focused system prompt: Aisling persona + user profile + country modules + **only `render_assessment_card` tool**.
5. Call LLM (CLI or SDK). For images: include the image. For text: include the item name/description.
6. Parse response. Extract: verdict, confidence, rationale, costs, voltage data.
7. Update the `item_assessment` record. Set `processing_status = 'completed'`.
8. On error: set `processing_status = 'failed'`, log error.

CLI mode: single-turn call — "Here's an image, assess this item." No conversation history, no streaming to frontend. Result written directly to DB.

### Processing UX — Three Stages

**a) Uploading**: each photo shows upload progress (progress bar or spinner on the image thumbnail). Copy: nothing needed, the visual progress is enough.

**b) Received/processing**: card appears with the image thumbnail. Simple state — we don't know what the item is yet, so just the image and a warm processing indicator. Copy: "Aisling is looking at this one..." Use Nos DS `Skeleton` or `Spinner` subtly. Keep it simple.

**c) Assessed**: card transitions smoothly to show the full assessment — item name, verdict badge, rationale, costs. The transition should feel delightful: the skeleton dissolves into real content. Use Framer Motion `AnimatePresence` with `layout` animations. Respect `prefers-reduced-motion`.

**Non-interruptive rule**: if the user is scrolling, reading another item, or in a per-item chat — completed items update silently in the background. No toast, no scroll-to, no focus steal. The user discovers them naturally when they look at the list.

### Nos DS Changes Required

**Extend `RecommendationCard`** with agnostic, reusable props:
- `processingStatus?: 'pending' | 'processing' | 'completed' | 'failed'` — drives the card's visual state
- `confidenceScore?: number` — optional confidence indicator
- `onRetry?: () => void` — callback for failed state retry button
- `thumbnail?: string` — image URL for the card's media area

These must be generic enough for any fairy app that needs processing-state cards. Follow the DS agent guide at `/Users/markwhooley/local/thefairies/dev/design-system/AGENT_GUIDE.md`. Ensure mobile rendering is solid.

### Retired Endpoints

| Route | Disposition |
|-------|-------------|
| `/api/chat` | Retired. Replaced by `/api/assess/:id` (background) and `/api/items/:id/chat` (Phase 2). |
| `/api/decisions` | Retired. Replaced by `/api/items?confirmed=false`. |
| `/api/assessments` | Renamed to `/api/items`. |

### Frontend Components

**New:**

| Component | Purpose |
|-----------|---------|
| `DecisionsList` | Home view. Shows all items as cards grouped by status. Upload + text-add entry points. |
| `ItemCard` | Individual item on the decisions list. Uses extended `RecommendationCard` from DS. Shows thumbnail, name, verdict, processing status. |
| `BatchUploadButton` | Photo upload that handles multi-select, creates pending items, fires assessments. |
| `TextAddInput` | Quick-add text input for describing items by name. |
| `ProcessingIndicator` | The "Aisling is looking at this one..." state for a card. |

**Retired:**

| Component | Reason |
|-----------|--------|
| `ChatInterface` | Replaced by per-item chat (Phase 2). |
| `ChatWithInventory` | Replaced by `DecisionsList` as home. |
| `InventorySidePanel` | Decisions is the main view now, not a tab. |
| `DecisionsPanel` | Evolved into `DecisionsList`. |
| `DecisionNotificationTab` | No longer needed — decisions IS the home view. |
| `InputBar` (photo upload portion) | Photo upload moves to `BatchUploadButton`. |
| `InventoryPreview` (mobile strip) | No longer needed — decisions list is always visible. |

**Changed:**

| Component | Change |
|-----------|--------|
| `AppLayout` | Navigation items: "Decisions" / "Boxes" / "Settings". Remove mobile overlay logic (no dual chat/inventory). Simplified. |
| `InventoryPanel` | Becomes the Boxes view at `/boxes`. Item listing removed (moves to `DecisionsList`). Box management stays. |
| `CostSummary` | Shown on decisions view. Exclude items with `processing_status != 'completed'` from calculations. |

**Unchanged:**
- `OnboardingWizard` + steps
- `ProfileEditPanel`
- All box management components (`BoxCard`, `BoxList`, `BoxManagement`, etc.)
- `ItemEditPanel`
- `VerdictBadge`, `EditablePill`, `SlidePanel`, etc.

### Supabase Realtime Setup

```typescript
const subscription = supabase
  .channel('item-updates')
  .on(
    'postgres_changes',
    {
      event: '*',  // INSERT and UPDATE
      schema: 'public',
      table: 'item_assessment',
      filter: `user_profile_id=eq.${profileId}`,
    },
    (payload) => {
      if (payload.eventType === 'INSERT') addItem(payload.new)
      if (payload.eventType === 'UPDATE') updateItem(payload.new)
    }
  )
  .subscribe()
```

---

## Phase 2: Per-Item Chat

### Data Model

```sql
CREATE TABLE item_conversation (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_assessment_id UUID NOT NULL REFERENCES item_assessment(id) ON DELETE CASCADE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_item_conversation UNIQUE (item_assessment_id)
);

CREATE TABLE item_conversation_message (
  id                    TEXT NOT NULL,
  item_conversation_id  UUID NOT NULL REFERENCES item_conversation(id) ON DELETE CASCADE,
  role                  TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content               TEXT NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (item_conversation_id, id)
);
```

Conversations are created lazily — only when the user first opens chat for an item.

### Per-Item Chat Context

System prompt composition (~8k tokens total, much lighter than the current 15k+):

1. **Aisling persona** (~2000 tokens)
2. **User profile** (~200 tokens)
3. **Country modules** (~3000 tokens)
4. **This item's full assessment** (~300 tokens) — name, verdict, rationale, costs, voltage, image
5. **Brief inventory summary** (~500 tokens) — verdict counts, total CBM, notable items. Not the full list.
6. **This item's conversation history** (variable, typically short)

### What the User Can Do in Per-Item Chat

- Push back on a verdict: "Actually this has sentimental value"
- Add context: "I paid $800 for this" or "It's the Pro model, not the standard"
- Ask follow-up questions: "What about the attachments?"
- Request re-assessment: "What if I get a transformer?"
- Aisling can update the `item_assessment` record directly via `update_item_assessment` tool

### New API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `POST /api/items/:id/chat` | POST | Send a message in the per-item conversation. Returns SSE stream. |
| `GET /api/items/:id/chat/messages` | GET | Get conversation history for an item. |

### New Components

| Component | Purpose |
|-----------|---------|
| `ItemDetailView` | Full item detail: assessment card + per-item chat. The `/decisions/:id` route. |
| `PerItemChat` | Focused chat interface. Simpler than the retired `ChatInterface` — no session management, no welcome-back logic, no photo upload. |

### Retired

| Component/Route | Reason |
|-----------------|--------|
| `/api/chat` | Fully retired. |
| `session` table | Read-only legacy. No new writes. Can be dropped entirely (no users). |
| `message` table | Read-only legacy. Can be dropped entirely (no users). |

---

## Phase 3: Box Sticker Scanning + Inventory Verification

### New API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `POST /api/scan-sticker/:boxId` | POST | Upload box sticker photo. LLM reads it, cross-references items, creates new assessments. |

### New Components

| Component | Purpose |
|-----------|---------|
| `StickerScanner` | Box sticker upload + reconciliation UI. |

### Logic

- Fuzzy name matching against existing `item_assessment` records
- Matched items assigned to box
- New items created with `pending` status, assessment triggered
- Reconciliation summary shown to user

---

## What Stays, What Changes, What Goes

| Current | Phase | Disposition |
|---------|-------|-------------|
| Global chat (`ChatInterface`, `ChatWithInventory`) | 1 | **Goes** — replaced by decisions list |
| `/api/chat` route (1094 lines) | 1 | **Goes** — replaced by `/api/assess/:id` + `/api/items/:id/chat` |
| `InventorySidePanel` (3-tab) | 1 | **Goes** — decisions becomes the main view |
| `DecisionsPanel` | 1 | **Evolves** into `DecisionsList` |
| `DecisionNotificationTab` | 1 | **Goes** — decisions IS the home view |
| `InventoryPreview` (mobile strip) | 1 | **Goes** |
| `AppLayout` | 1 | **Changes** — new nav items, simplified mobile |
| `InventoryPanel` | 1 | **Changes** — becomes boxes view, loses item listing |
| `CostSummary` | 1 | **Stays** — shown on decisions view |
| Box management components | — | **Stay** — moved to `/boxes` route |
| Onboarding | — | **Stays** |
| `ProfileEditPanel` | — | **Stays** |
| `session` + `message` tables | 1 | **Dropped** (no users, clean slate) |
| `/api/assessments` | 1 | **Renamed** to `/api/items` |
| `/api/decisions` | 1 | **Dropped** — use `/api/items?confirmed=false` |
| `dev-api-key.ts` | — | **Stays** (needed if/when OAuth works again) |
| `claude-cli.ts` | 1 | **Stays** — used by `/api/assess/:id` for CLI mode |

---

## Testing Strategy

### E2E Scenarios (persona-driven)

- "Straight-Line Emigrant can batch-upload 5 photos and see all 5 assessed"
- "Straight-Line Emigrant can add an item by typing its name"
- "User sees upload progress, then processing state, then completed assessment"
- "User can retry a failed assessment"
- "User can confirm an assessment from the decisions list"
- "Two-Leg Planner can open a per-item chat and discuss Australia implications" (Phase 2)
- "User can scan a box sticker and reconcile items" (Phase 3)

### States to Test

- Loading (skeleton on initial page load)
- Empty (new user, no items)
- Processing (items being assessed)
- Completed (items assessed)
- Failed (assessment error, retry available)
- Mixed (some complete, some processing, some failed)

### Viewports

- 320px (mobile), 768px (tablet), 1280px (desktop)

---

## Resolved Decisions

- **Rename `DECIDE_LATER` → `REVISIT`**: Across the entire codebase — DB enum, constants, components, Aisling's persona, verdict colours in PROJECT_SPEC. `REVISIT` communicates action ("you'll come back to this") rather than indecision.
