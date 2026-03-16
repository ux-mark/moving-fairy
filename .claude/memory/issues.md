# Known Issues

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
- **Description**: Prior to the upsert fix in PR #22, duplicate assessment records were created when Aisling revised a verdict. Existing duplicates (e.g. Bio Bidet with 3 records) still exist in the DB. The app-level fix prevents new duplicates but does not clean up old ones.
- **Workaround**: Manually delete duplicate records via Supabase dashboard — keep the most recent unconfirmed record per item name per user, delete the rest.
- **Status**: open

## ISSUE-005: Duplicate inventory hooks (useInventoryData and useInventory)

- **Severity**: low
- **Location**: `src/hooks/useInventoryData.ts` and `src/lib/hooks/useInventory.ts`
- **Description**: Two hooks fetch the same data from the same three endpoints with independent state. Both now register with the refresh callback system (fixed in PR #22), but the duplication is tech debt. Should be consolidated into a single hook or React Context.
- **Status**: open (carried from MF-ISSUE-008)

## ISSUE-007: Rename verdict to REVISIT

- **Severity**: medium
- **Location**: DB enum, `src/lib/constants.ts`, agent prompts (aisling.md), UI components, `getCostSummary()`, welcome-back prompt
- **Description**: The old verdict name implied the *user* is deciding later, but it actually means *Aisling* is deferring her assessment (needs more context). Renamed to `REVISIT` which communicates action ("you'll come back to this"). Completed in feature/item-centric-backend.
- **Scope**: DB enum migration, constants, Aisling agent definition, UI labels/badges, cost summary, welcome-back prompt, any component referencing the verdict.
- **Status**: resolved
- **Action**: Completed — all occurrences renamed to REVISIT.

## ISSUE-006: Pre-existing lint errors across codebase (8 errors, 14 warnings)

- **Severity**: low
- **Location**: Multiple files
- **Description**: 8 errors and 14 warnings from `pnpm lint`. Key issues:
  - `jsx-a11y/interactive-supports-focus` error in `ItemEditPanel.tsx:159` (radiogroup not focusable)
  - Unused variables in `claude-cli.ts` (`roundText`, `extractTextContent`) and `useInventory.ts` (`items`)
  - Unused eslint-disable directive in `DecisionNotificationTab.tsx`
  - `<img>` instead of `<Image>` in `InventoryPanel.tsx:753`
  - Plus other pre-existing errors in route types and API routes (see ISSUE-001, ISSUE-002)
- **Workaround**: None needed — app functions correctly.
- **Status**: open
- **Action**: Clean up in a dedicated lint-fix PR, separate from feature work.

## ISSUE-003: Supabase item-images bucket requires `supabase db reset` or manual creation for local dev

- **Severity**: medium
- **Location**: `supabase/config.toml`
- **Description**: The `item-images` bucket is configured in `config.toml` but existing local Supabase instances need to be restarted (`supabase stop && supabase start`) to pick up the new bucket configuration.
- **Workaround**: Run `supabase stop && supabase start` after pulling this change.
- **Status**: open
