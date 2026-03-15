# Changelog

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
