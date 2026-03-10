# Changelog

## 2026-03-10 -- Implement image upload endpoint

- **What**: Implemented the `/api/upload` route to accept multipart image uploads, authenticate the user, validate file type and size, optimise images with sharp (WebP, 1024px max, 80% quality), and upload to Supabase Storage `item-images` bucket. Hardened `InputBar.tsx` to check for `data.url` in upload responses, show user feedback on upload failures, and filter falsy URLs. Configured the `item-images` storage bucket in `supabase/config.toml`.
- **Files**: `src/app/api/upload/route.ts`, `src/components/chat/InputBar.tsx`, `supabase/config.toml`, `package.json`
- **Why**: The upload endpoint was a stub returning `{ ok: true }` with no file handling, breaking the entire image flow (thumbnails, Claude vision, image-only messages).
- **Agent**: fairy (direct implementation -- medium complexity, single-domain)
