# Changelog

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
