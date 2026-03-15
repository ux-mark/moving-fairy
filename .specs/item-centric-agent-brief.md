# Agent Brief: Item-Centric UX Overhaul

> This document is the entry point for the lead agent building the item-centric overhaul.
> Read this first, then follow the references below.

---

## Your Mission

You are leading a major UX overhaul of the Moving Fairy app. The app shifts from **chat-centric** (one big conversation with Aisling the AI agent) to **item-centric** (decisions list is home, each item has its own conversation).

This is a multi-phase build. You will lead a team of builder, reviewer, and planner agents across three phases, shipping incrementally. Each phase delivers standalone user value.

---

## Required Reading (in order)

1. **This project's master instructions**: `/Users/markwhooley/local/leaving-us/moving-fairy/CLAUDE.md` — git workflow, agent roster, quality gates, effort scaling. Follow these exactly.
2. **The parent repo instructions**: `/Users/markwhooley/local/leaving-us/CLAUDE.md` — spec-first protocol, memory protocol, UX standards, Playwright E2E protocol. These are inherited.
3. **The implementation plan**: `/Users/markwhooley/local/leaving-us/moving-fairy/.specs/item-centric-overhaul.md` — the full plan with user journeys, data model changes, API routes, component architecture, phasing, and what stays/changes/goes. This is your blueprint.
4. **Project spec**: `/Users/markwhooley/local/leaving-us/moving-fairy/.specs/PROJECT_SPEC.md` — tech stack, conventions, commands.
5. **Personas**: `/Users/markwhooley/local/leaving-us/moving-fairy/.specs/personas.md` — the three user personas. All UX decisions reference these.
6. **Current features**: `/Users/markwhooley/local/leaving-us/moving-fairy/.specs/features.md` — what exists today.
7. **Data model**: `/Users/markwhooley/local/leaving-us/moving-fairy/.specs/data-model.md` — current DB schema.
8. **Architecture**: `/Users/markwhooley/local/leaving-us/moving-fairy/.specs/architecture.md` — system design and MCP tools.
9. **Aisling agent definition**: `/Users/markwhooley/local/leaving-us/moving-fairy/.claude/agents/aisling.md` — the AI persona.
10. **Design system agent guide**: `/Users/markwhooley/local/thefairies/dev/design-system/AGENT_GUIDE.md` — how to extend the Nos DS. Everything must use Nos DS components.
11. **Memory files**: `/Users/markwhooley/local/leaving-us/moving-fairy/.claude/memory/` — decisions, changelog, issues, prs. Read all on start.

---

## Key Decisions (already made)

- **Rename verdict to `REVISIT`**: Completed for Phase 1. DB enum, constants, components, Aisling persona, verdict colours, spec files.
- **No data migration**: There are zero users. Wipe the DB and start fresh. Drop the `session` and `message` tables entirely.
- **Everything uses Nos DS**: No exceptions. If a DS component needs extending (e.g. `RecommendationCard` needs processing status props), extend the DS first, then consume in the app. Keep DS extensions agnostic and reusable. Ensure mobile works perfectly.
- **Supabase Realtime**: Used for live card updates as assessments complete. RLS policies (MF-ISSUE-005) must be set up first — this is a prerequisite, not optional.
- **Background processing**: fire-and-forget `/api/assess/:id` calls, one per item. No persistent workers. Results written to DB, frontend picks up via Realtime.
- **Processing UX must be non-interruptive**: items update in the background. No toasts, no scroll-to, no focus steal. Three stages: uploading (progress on thumbnail), received (image + "Aisling is looking at this one..."), assessed (smooth transition to full card).
- **No batch upload limit**: users can upload as many images as they want. Each image = one item.
- **Per-item chat created lazily**: only when the user opens it. Many items will be confirmed without any conversation.

---

## Phase Breakdown

### Phase 1: Decisions as Home + Background Processing
**This is the big one.** Roughly 20 files affected.

Key tasks:
1. Set up RLS policies on `item_assessment` (prerequisite for Realtime)
2. DB migration: new columns (`processing_status`, `confidence`, `needs_clarification`, `source`), nullable `verdict`, rename verdict to `REVISIT`, drop `session`/`message` tables
3. Extend `RecommendationCard` in the Nos DS with processing status props
4. New API routes: `/api/items`, `/api/assess/:id`
5. New components: `DecisionsList`, `ItemCard`, `BatchUploadButton`, `TextAddInput`, `ProcessingIndicator`
6. Retire global chat components and route
7. Update `AppLayout` navigation
8. Supabase Realtime subscription hook
9. Update `CostSummary` to exclude non-completed items
10. Update spec files (`PROJECT_SPEC.md`, `data-model.md`, `architecture.md`, etc.) to reflect new architecture

### Phase 2: Per-Item Chat
~15 files affected.

Key tasks:
1. New tables: `item_conversation`, `item_conversation_message`
2. New API routes: `/api/items/:id/chat`, `/api/items/:id/chat/messages`
3. New components: `ItemDetailView`, `PerItemChat`
4. `/decisions/:id` route
5. Per-item chat system prompt composition (item context + brief inventory summary)

### Phase 3: Box Sticker Scanning
~8 files affected.

Key tasks:
1. New API route: `/api/scan-sticker/:boxId`
2. Fuzzy name matching logic
3. `StickerScanner` component
4. Reconciliation UI

---

## Working Style

- **Use the team pattern** from CLAUDE.md for each phase. Create a feature branch from `dev`, decompose into tasks with dependencies, spawn builders/reviewers.
- **DS changes go first**: if Phase 1 needs `RecommendationCard` extensions, that's a separate PR in the DS repo at `/Users/markwhooley/local/thefairies/dev/design-system/`. Get it merged, update the dependency in moving-fairy, then build the app components.
- **Ship incrementally within each phase**: don't try to land everything in one PR. Break Phase 1 into 2-4 PRs (e.g. data model + API first, then frontend components, then wiring it all together).
- **Run quality gates** after every unit of work: lint, typecheck, build. E2E tests for frontend work.
- **Update memory files** as you go: `changelog.md`, `decisions.md`, `issues.md`, `prs.md`.
- **Update spec files** when the architecture changes: `PROJECT_SPEC.md`, `features.md`, `data-model.md`, `architecture.md`.
- **Always create PRs into `dev`**, never commit to `dev` directly. Always return the PR link.
- **Get UXicorn review** before builders implement frontend components, and again during QA.

---

## Reference: User's Preferences

- Never use all-capitals text anywhere in the UI. Sentence case or title case only.
- Always `git fetch`/`git pull` before answering questions about branch state.
- Always create PRs from feature branches into `dev`. Never merge directly.
- Always return the PR link when creating a PR.
- Use UXicorn (not reviewer) as the QA agent for visual quality on frontend changes.
- Get UXicorn design review before builders implement, and again during QA.

---

## Reference: What Success Looks Like

After Phase 1, the user can:
1. Open the app and land on a decisions list (not a chat)
2. Tap upload, select 10 photos from their camera roll
3. See 10 cards appear with their images and "Aisling is looking at this one..."
4. Put the phone down, come back 5 minutes later
5. See all 10 items fully assessed with verdicts, rationale, costs
6. Tap any item to see the full assessment
7. Confirm or edit each item's verdict

This must work smoothly on mobile (the primary use case — user standing in a room with their phone).
