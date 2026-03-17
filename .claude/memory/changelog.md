# Changelog

## 2026-03-17 — UX polish: image display, currencies, chat layout, box list

- **What**: Fixed item detail image not displaying on iOS Safari (`.itemImage` wrapper with `overflow: hidden` collapsed to zero height — removed wrapper, applied border-radius directly to img). Fixed currency labels to derive from user profile (departure/arrival countries). Updated Aisling prompt for dual currencies. Replaced `position: fixed` chat bar with flexbox layout. Fixed chat expand squishing content (now hides item content when expanded). Removed duplicate "New box" button. Fixed image proxy middleware auth redirect and hostname mismatch.
- **PR**: https://github.com/ux-mark/moving-fairy/pull/41
- **Files**: 18 files modified across components, API routes, proxy, and constants
- **Key root cause**: iOS Safari collapses a `div` with `overflow: hidden` to zero height when its only child is an `<img>` that hasn't established intrinsic dimensions yet.

## 2026-03-16 — QA sweep: auth redirects, dead code, storage, RLS, assessment pipeline

- **What**: Full QA audit after item-centric overhaul. Four commits:
  1. **Dead code removal**: Deleted 10 files from pre-overhaul architecture (InventoryPanel, DecisionsPanel, ItemEditPanel, useInventory, chat/inventory redirect pages). Fixed `/api/assessments` → `/api/items` in MessageBubble.
  2. **Auth + infra**: Fixed all 4 auth redirects (`/inventory` → `/decisions` in landing page, auth callback, onboarding, test-auth). Added SQL migration for `item-images` storage bucket. Fixed RLS policies on `item_conversation` tables to join through `user_profile.auth_user_id`.
  3. **Assessment pipeline fix**: Fixed Aisling returning "DECIDE LATER" instead of "REVISIT" — updated two stale references in `aisling.md`. Added verdict normalisation in `assess-item.ts` (maps legacy values to valid enum). Fixed photo-only items routing to CLI mode (can't see images) by adding "Untitled item" to the text-name exclusion list.
- **PR**: https://github.com/ux-mark/moving-fairy/pull/38
- **Files**: 10 deleted, 7 modified, 2 new migrations
- **Quality**: typecheck clean, build clean, 107 tests passing
- **Key files changed**: `src/lib/assess-item.ts` (verdict normalisation + SDK routing), `.claude/agents/aisling.md` (REVISIT references), `src/app/page.tsx`, `src/app/auth/callback/route.ts`, `src/components/onboarding/OnboardingWizard.tsx`, `src/components/chat/MessageBubble.tsx`

## 2026-03-15 -- Fix CLI image assessment quality + plan item-centric overhaul

- **What**: Fixed CLI image assessment quality (filtered tools to only `render_assessment_card`, stripped conversation history from image calls, added SDK 401 retry). Created comprehensive plan for item-centric UX overhaul — shifting from chat-centric to decisions-as-home with background processing, per-item chat, and box sticker scanning.
- **Files**: `src/app/api/chat/route.ts`, `.specs/item-centric-overhaul.md`, `.specs/item-centric-agent-brief.md`
- **Why**: Image assessments were poor quality (model making things up) due to system prompt noise from 11 tool definitions and conversation history leaking old items. The broader architectural issue is that chat-centric UX doesn't scale — background processing with Supabase Realtime is the right model.
- **PRs**: #29 (merged), #30 (open — plan only)
- **Decision**: Verdict renamed to `REVISIT` for Phase 1.

## 2026-03-13 -- Remove denormalised item_name from box_item

- **What**: Made `box_item.item_name` nullable — only used for unassessed items from handwritten lists. For assessed items, the canonical name now always comes from `item_assessment.item_name`. Added server-side name resolution in `getBox()`, frontend resolution in `BoxCard` via the assessments map, and synced assessment state in `BoxManagement` when light assessments create new items. Light assessment API responses now include the full assessment object.
- **Files**: 10 files — migration, types, MCP tools + tests, BoxCard, BoxManagement, InventoryPanel, light assessment routes, data-model spec
- **Why**: `box_item.item_name` was a stale snapshot copied at insert time and never synced, causing items to show different names in "By container" vs "By verdict" views (e.g., "set of 3" vs "set of 12").
- **PR**: https://github.com/ux-mark/moving-fairy/pull/18
- **Agent**: fairy (orchestrated builder + uxicorn + reviewer)

## 2026-03-12 -- Comprehensive UX fix pass

- **What**: Fixed missing CSS classes (deleteSeparator, deleteButton, skeleton), added DS-compliant card styling to DecisionsPanel (shadow, primary top border, proper padding), added focus-visible states to all interactive elements missing them, added mobile media queries with 44px touch targets across 10 component CSS modules, added overflow-x protection to html and AppLayout root, restricted BoxCard hover shadow to hover-capable devices, changed InventoryPanel view-switch animation to opacity-only on mobile, and fixed InventorySidePanel mobile padding/background.
- **Files**: 14 files across `src/components/`, `src/app/globals.css`, and `src/components/layout/AppLayout.module.css`
- **Why**: QA pass identified missing CSS classes causing unstyled delete buttons and skeleton states, missing focus indicators failing keyboard accessibility, and missing mobile media queries resulting in sub-44px touch targets and text smaller than 16px triggering iOS auto-zoom.
- **Agent**: uxicorn

## 2026-03-10 -- Implement image upload endpoint

- **What**: Implemented the `/api/upload` route to accept multipart image uploads, authenticate the user, validate file type and size, optimise images with sharp (WebP, 1024px max, 80% quality), and upload to Supabase Storage `item-images` bucket. Hardened `InputBar.tsx` to check for `data.url` in upload responses, show user feedback on upload failures, and filter falsy URLs. Configured the `item-images` storage bucket in `supabase/config.toml`.
- **Files**: `src/app/api/upload/route.ts`, `src/components/chat/InputBar.tsx`, `supabase/config.toml`, `package.json`
- **Why**: The upload endpoint was a stub returning `{ ok: true }` with no file handling, breaking the entire image flow (thumbnails, Claude vision, image-only messages).
- **Agent**: fairy (direct implementation -- medium complexity, single-domain)
