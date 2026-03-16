# Known Issues

## ISSUE-016: Photo-only items routed to CLI mode (can't see images)
- **Severity**: High
- **Status**: FIXED (PR #38, 2026-03-16)
- **Detail**: Items created from photo uploads (no text name) were given `item_name: 'Untitled item'` by the API, but `assess-item.ts` only checked for `'Untitled'` — missing the match. These items were routed to CLI mode (text-only) instead of SDK mode (vision-capable), so Aisling couldn't see the photo. Added `'Untitled item'` to the exclusion list in `assess-item.ts:298-302`.

## ISSUE-015: Aisling returns "DECIDE LATER" verdict — DB rejects invalid enum
- **Severity**: Critical
- **Status**: FIXED (PR #38, 2026-03-16)
- **Detail**: The DB enum was renamed from `DECIDE_LATER` to `REVISIT` but two references in `aisling.md` still said "DECIDE LATER", causing the LLM to output that value. `assess-item.ts` cast the verdict directly with no normalisation, so Postgres rejected it. Fixed by: (1) updating `aisling.md` references, (2) adding verdict normalisation in `assess-item.ts:384-389` that maps legacy values to `REVISIT`.

## ISSUE-014: All auth redirects pointed to dead /inventory route
- **Severity**: Critical
- **Status**: FIXED (PR #38, 2026-03-16)
- **Detail**: Landing page, auth callback, onboarding, test-auth all redirected to `/inventory` (retired). Changed to `/decisions`.

## ISSUE-013: Storage bucket not created by migrations
- **Severity**: High
- **Status**: FIXED (PR #38, 2026-03-16)
- **Detail**: `item-images` bucket configured in config.toml only. Added SQL migration for production.

## ISSUE-012: Conversation RLS policies compared wrong IDs
- **Severity**: Medium
- **Status**: FIXED (PR #38, 2026-03-16)
- **Detail**: `item_conversation` RLS compared `user_profile_id = auth.uid()` but these are different IDs. Fixed to join through `user_profile.auth_user_id`.

## ISSUE-001: Pre-existing lint errors in worktree generated types

- **Severity**: low
- **Location**: `.claude/worktrees/magic-link-auth/.next/dev/types/routes.d.ts`
- **Description**: ESLint reports `@typescript-eslint/no-empty-object-type` errors in auto-generated Next.js route types from a worktree. These are not in the main source tree.
- **Workaround**: Errors are in generated files and do not affect the application.
- **Status**: open

## ISSUE-002: Pre-existing unused variable warnings

- **Severity**: low
- **Location**: `src/app/api/profile/route.ts`, `src/app/api/session/route.ts`, `src/app/auth/callback/route.ts`
- **Description**: Several files have unused variable warnings from ESLint. Pre-existing, not introduced by image upload work.
- **Workaround**: None needed -- warnings only, not errors.
- **Status**: open

## ISSUE-004: Existing duplicate records in database need cleanup

- **Severity**: medium
- **Location**: Supabase `item_assessment` table
- **Description**: Prior to the upsert fix in PR #22, duplicate assessment records were created when Aisling revised a verdict. Test data (12 records + 12 images) was manually cleaned from local dev DB on 2026-03-16. Production has no users yet so no cleanup needed there.
- **Status**: resolved (no production data; local test data cleaned 2026-03-16)

## ISSUE-005: Duplicate inventory hooks (useInventoryData and useInventory)

- **Severity**: low
- **Location**: `src/hooks/useInventoryData.ts` (was also `src/lib/hooks/useInventory.ts`)
- **Description**: Two hooks fetched the same data from the same three endpoints with independent state. `useInventory.ts` was deleted in PR #38 (dead code — only imported by deleted InventoryPanel). Only `useInventoryData.ts` remains.
- **Status**: resolved (PR #38, 2026-03-16)

## ISSUE-007: Rename verdict to REVISIT

- **Severity**: medium
- **Location**: DB enum, `src/lib/constants.ts`, agent prompts (aisling.md), UI components, `getCostSummary()`, welcome-back prompt
- **Description**: The old verdict name implied the *user* is deciding later, but it actually means *Aisling* is deferring her assessment (needs more context). Renamed to `REVISIT` which communicates action ("you'll come back to this"). Completed in feature/item-centric-backend.
- **Scope**: DB enum migration, constants, Aisling agent definition, UI labels/badges, cost summary, welcome-back prompt, any component referencing the verdict.
- **Status**: resolved
- **Action**: Completed — all occurrences renamed to REVISIT.

## ISSUE-006: Pre-existing lint errors across codebase

- **Severity**: low
- **Location**: Multiple files
- **Description**: Lint errors remain in the codebase. Several of the worst offenders (ItemEditPanel, InventoryPanel, useInventory) were deleted in PR #38 dead code cleanup. Remaining issues include unused variables in `claude-cli.ts` (`roundText`, `extractTextContent`), unused eslint-disable directive in `DecisionNotificationTab.tsx`, and pre-existing errors in route types and API routes (see ISSUE-001, ISSUE-002).
- **Workaround**: None needed — app functions correctly.
- **Status**: partially resolved (PR #38 deleted worst offenders), remaining items open
- **Action**: Clean up in a dedicated lint-fix PR, separate from feature work.

## ISSUE-003: Supabase item-images bucket requires `supabase db reset` or manual creation for local dev

- **Severity**: medium
- **Location**: `supabase/config.toml`, `supabase/migrations/20260316000001_create_item_images_bucket.sql`
- **Description**: The `item-images` bucket is configured in `config.toml` but existing local Supabase instances needed a restart to pick up the new bucket configuration. Now also covered by a SQL migration (PR #38) for production deployments.
- **Workaround**: Run `supabase stop && supabase start` after pulling, or `supabase db reset` to apply migration.
- **Status**: resolved (PR #38, 2026-03-16)
