# Architectural Decisions

## ADR-001: Image storage path convention (2026-03-10)

- **Status**: accepted
- **Context**: Needed a storage path convention for uploaded item images in Supabase Storage.
- **Decision**: Images stored at `{user_profile_id}/{uuid}.webp` in the `item-images` bucket. Bucket is public since the chat route fetches images server-side to convert to base64 for Claude, and the image proxy route also needs direct access.
- **Consequences**: Public bucket means URLs are predictable if someone knows the profile ID and image UUID. Acceptable for now since image content is household items, not sensitive data. Can add signed URLs later if needed.

## ADR-002: Image optimisation pipeline (2026-03-10)

- **Status**: accepted
- **Context**: Raw phone photos can be 5-15MB. Need to optimise before storage and before sending to Claude as base64.
- **Decision**: Use `sharp` to auto-rotate (EXIF), resize longest edge to 1024px (without enlargement), convert to WebP at 80% quality. This runs server-side in the upload route.
- **Consequences**: Adds `sharp` as a dependency (native binary). Output is typically 50-200KB per image, well-suited for base64 embedding in Claude API calls.

## ADR-003: box_item.item_name is nullable — canonical name lives on item_assessment (2026-03-13)

- **Status**: accepted
- **Context**: `box_item.item_name` was a denormalised copy of `item_assessment.item_name`, taken at insert time and never synced. This caused items to show different names in different views when the assessment name was later updated.
- **Decision**: Made `box_item.item_name` nullable. For assessed items (`item_assessment_id IS NOT NULL`), the field is NULL and the canonical name comes from `item_assessment.item_name`. For unassessed items (handwritten lists), `item_name` remains the only source. Server-side resolution in `getBox()` and frontend resolution in `BoxCard` via the assessments map ensure display names are always current.
- **Consequences**: Two state management patterns coexist: `BoxManagement` uses incremental updates (must keep assessments state in sync); `InventoryPanel` uses full re-fetches (getBox resolves names server-side). Both are correct but should eventually be unified.
