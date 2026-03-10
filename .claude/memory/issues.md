# Known Issues

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

## ISSUE-003: Supabase item-images bucket requires `supabase db reset` or manual creation for local dev

- **Severity**: medium
- **Location**: `supabase/config.toml`
- **Description**: The `item-images` bucket is configured in `config.toml` but existing local Supabase instances need to be restarted (`supabase stop && supabase start`) to pick up the new bucket configuration.
- **Workaround**: Run `supabase stop && supabase start` after pulling this change.
- **Status**: open
