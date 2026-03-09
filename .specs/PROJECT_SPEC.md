# Project Spec — Moving Fairy

## Overview

Moving Fairy is a web app on thefairies.ie that helps people moving from one country to another — with an optional onward move to a third country — decide what to sell, donate, discard, or ship. The primary AI agent is Aisling, who provides item-by-item relocation guidance covering voltage compatibility, import restrictions, shipping economics, and multi-leg move strategy.

The framework is route-configurable: users set their departure country, arrival country, and optional onward country (with timeline and certainty level). Aisling's advice is tailored to the configured route. At launch, the supported route is US → Ireland, with optional onward to Australia. Additional country knowledge modules are added without changing Aisling or the core framework.

---

## Tech Stack

| Concern | Choice |
|---|---|
| Language | TypeScript (strict mode) |
| Framework | Next.js 15 (App Router) |
| Package manager | pnpm |
| Database | Supabase — Postgres (Frankfurt, `eu-central-1`) |
| Auth | Supabase Auth |
| Object storage | Supabase Storage (Frankfurt, RLS-integrated) |
| CSS | Tailwind CSS |
| Component library | shadcn/ui (Radix UI primitives) |
| Icons | Lucide Icons |
| Animation | Framer Motion |
| Font | Figtree (weights 400/500/600/700, via `next/font/google`) |
| LLM — Aisling (full assessment) | `claude-sonnet-4-6` (latest claude-sonnet-4; configurable via `MODEL_AISLING` env var) |
| LLM — Light assessment | `claude-haiku-4-5-20251001` (latest claude-haiku-4-5; configurable via `MODEL_LIGHT_ASSESSMENT` env var) |
| App hosting | Fly.io (EU region — Amsterdam or Frankfurt) |
| MCP server | Fly.io — separate app, TypeScript |
| E2E testing | Playwright |
| Unit testing | Vitest + `@testing-library/react` |

---

## GDPR and Data Residency

All user data — database, object storage, authentication — is hosted in the EU (Supabase Frankfurt region). The application server runs on Fly.io EU region. No user data transits US infrastructure.

Supabase and Fly.io both provide a Data Processing Agreement (DPA). These must be signed before launch.

---

## Architecture

```
Browser
  └── Next.js app (Fly.io, EU)
        ├── API routes → MCP Server (Fly.io, EU, separate Fly app)
        │                    └── Supabase Postgres (Frankfurt)
        ├── Upload endpoint → optimise (WebP, 1024px max, ~80% quality)
        │                    └── Supabase Storage (Frankfurt)
        └── Supabase Auth (Frankfurt)
```

The MCP server is a persistent TypeScript process on Fly.io. All database reads and writes go through named MCP tools — Aisling and all API routes call MCP tools exclusively; no direct DB access from the app layer.

See `.specs/architecture.md` for the full system design including all MCP tools.

---

## Project Structure

```
moving-fairy/
  .claude/
    agents/
      aisling.md              # Primary fairy — relocation advice, box management
    memory/
      decisions.md
      changelog.md
      issues.md
  .specs/
    PROJECT_SPEC.md           # This file
    architecture.md           # System design and MCP tool catalogue
    data-model.md             # DB schema and enums
    ux-flow.md                # UX design (UXicorn owns)
    features.md               # User-facing feature log (UXicorn owns)
    personas.md               # User personas (UXicorn owns)
    light-assessment.md       # Light assessment spec
  knowledge/
    countries/
      us-departure.md
      ie-arrival.md
      au-arrival.md
    voltage.md
    shipping-economics.md
  src/
    app/                      # Next.js App Router
    components/               # Shared UI components (shadcn/ui based)
    lib/                      # Utilities, helpers
    mcp/                      # MCP server (separate Fly app)
  e2e/                        # Playwright tests
    fixtures/
  CLAUDE.md
```

---

## Commands

| Command | Script |
|---|---|
| Dev server | `pnpm dev` |
| Build | `pnpm build` |
| Unit tests (watch) | `pnpm exec vitest` |
| Unit tests (CI) | `pnpm exec vitest run` |
| Unit tests + coverage | `pnpm exec vitest run --coverage` |
| E2E tests (all) | `pnpm exec playwright test` |
| E2E tests (mobile) | `pnpm exec playwright test --project=mobile-safari` |
| E2E tests (debug) | `pnpm exec playwright test --ui` |
| Lint | `pnpm lint` |
| Type check | `pnpm typecheck` |

---

## UI/UX Standards

### Component library: shadcn/ui

shadcn/ui (built on Radix UI) gives us unstyled, accessible primitives that we copy into the project and own. This matters for Moving Fairy because:

- We can shape every component to match Aisling's warm, grounded tone — no fighting an enterprise design system
- The copy-and-own model means no component will block a custom behaviour (auto-growing textareas, photo thumbnails in the input bar, collapsible cost panels)
- Radix UI handles focus management, keyboard navigation, ARIA, and screen reader announcements correctly out of the box

**Initial primitive set:** `button`, `input`, `textarea`, `select`, `radio-group`, `dialog`, `collapsible`, `progress`, `tabs`, `tooltip`, `label`. Add others as features require.

### Design tokens

Two layers:

1. **`tailwind.config.ts`** — single source of truth for colour palette, spacing, type scale, border radii, breakpoints, animation timing
2. **CSS custom properties** — generated from Tailwind config for tokens needing runtime access (verdict colour-coding, theme values)

shadcn/ui's CSS custom property token structure (HSL, mapped through Tailwind) is the base. Extend with Moving Fairy's brand palette.

**Colour direction:**
- Primary: warm, confident green (clover, not corporate teal)
- Accent: warm amber
- Neutral: warm greys
- Verdict colours: green (SHIP/CARRY), amber (SELL), warm grey (DONATE/DISCARD), soft blue (DECIDE_LATER)
- Error: warm red
- All colours must pass WCAG 2.2 AA contrast (4.5:1 body text, 3:1 UI components)

### CSS: Tailwind CSS

Tailwind is the sole styling layer. No CSS Modules, no styled-components.

- Use `cn()` utility (shadcn/ui) for conditional class merging
- Extract repeated patterns into component variants, not `@apply` rules
- Responsive prefixes map to: mobile < 768px, tablet 768–1024px, desktop > 1024px
- Use `motion-reduce:` variant for all animated components

### Icons: Lucide Icons

Default for shadcn/ui, tree-shakeable, MIT-licensed. Early icon set: `Camera`, `Send`, `ChevronDown`, `ChevronUp`, `ArrowLeft`, `X`, `Check`, `AlertCircle`, `Loader2`, `Image`, `Package`, `RotateCcw`.

### Animation: Framer Motion

Justified by three specific patterns in the UX spec:

1. **Stepped form transitions** — directional slide animations between onboarding steps; `AnimatePresence` for exit animations
2. **Cost calculator updates** — number pulse (scale 110%, 300ms ease-out), fade on data change
3. **Collapsible panels** — spring-based height animations for calculator, box cards, profile slide-over

**Rules:**
- Every animation must respect `prefers-reduced-motion` via `useReducedMotion()` hook — fall back to instant
- No decorative motion. If removing the animation changes nothing, remove it
- Duration: 150–300ms for most transitions. Snappy, not cinematic

### Font: Figtree

Figtree via `next/font/google` (`display: 'swap'`, `subsets: ['latin']`, weights 400/500/600/700). Figtree is a geometric sans-serif with subtly rounded terminals that give it warmth without sacrificing professionalism. It reads cleanly at small sizes on mobile and has good tabular number support for cost figures.

```
font-family: 'Figtree', ui-sans-serif, system-ui, -apple-system, sans-serif;
```

**Type scale:**
- Body: 16px (never smaller on mobile)
- Small/secondary: 14px
- H1: 32px mobile / 40px desktop
- H2: 24px mobile / 28px desktop
- Verdict labels: 16px, semibold (600), uppercase, letter-spacing +0.05em
- Line height: 1.5 body, 1.3 headings
- Tabular numbers enabled (OpenType) for cost calculator figures

---

## Accessibility

**Standard:** WCAG 2.2 AA minimum.

### Tooling

**Build-time:**
- `eslint-plugin-jsx-a11y` — catches missing alt text, invalid ARIA, missing labels. Runs on save and in CI.
- TypeScript strict mode — ARIA prop typo detection

**Test-time:**
- `@axe-core/playwright` — axe scan as final assertion in every Playwright E2E flow
- `vitest-axe` — axe scans in Vitest component tests

**Manual protocol (before each release):**
- Keyboard-only navigation of every new feature
- VoiceOver (macOS/iOS) and NVDA (Windows) for chat live regions and form flows
- `prefers-reduced-motion` toggle test for all animated components

---

## Testing

### E2E: Playwright

**Config:** `playwright.config.ts` at project root. Tests in `e2e/`.

**Browser projects:**
```
desktop-chrome:   1280x720, Chromium
mobile-safari:    iPhone 14 viewport, WebKit   ← primary use case
tablet:           iPad viewport, WebKit
```

**Conventions:**
- One file per UX flow: `onboarding.spec.ts`, `chat.spec.ts`, `cost-calculator.spec.ts`, `box-management.spec.ts`
- Selectors: `data-testid` only — never CSS classes or DOM structure
- Every test file ends with an axe accessibility scan
- AI responses mocked at API route level via `route.fulfill()` — test UI behaviour, not AI
- Photo uploads tested via `setInputFiles()` with fixtures in `e2e/fixtures/`
- `prefers-reduced-motion` tested via `page.emulateMedia({ reducedMotion: 'reduce' })`
- Use `webServer` config to auto-start Next.js dev server before tests

### Unit: Vitest

**Config:** `vitest.config.ts` at project root. Test files co-located as `*.test.ts` / `*.test.tsx`.

**What to unit test:**
- Form validation logic (departure/destination rules, conditional fields)
- Cost calculator computations (totals, item count aggregation)
- Box label generation (sequential numbering, room name normalisation)
- Verdict colour/display mapping
- Currency formatting and utility functions
- Individual component rendering and interaction states

**What NOT to unit test (use Playwright instead):**
- Multi-step form flows
- Chat message sequencing and scroll behaviour
- Photo upload end-to-end flows
- Navigation between views
- Anything depending on the Next.js router or server components

---

## Code Style

- TypeScript strict mode: `"strict": true` in `tsconfig.json`
- ESLint with `eslint-plugin-jsx-a11y` and `@typescript-eslint`
- Prettier for formatting
- No `any` types without a `// eslint-disable` comment explaining why
- Server Components by default; opt into `"use client"` only when needed (event handlers, browser APIs, Framer Motion)
- `cn()` for all conditional class strings

---

## Known Constraints

- All advice is specific to the US → Ireland (→ Australia) emigration route. Additional routes can be added by adding country knowledge modules — no changes to Aisling required.
- All DB access must go through the MCP server. Aisling and API routes never touch Supabase directly.
- Images stored only for SHIP and CARRY verdicts. All others get lightweight records only.
- GDPR: all user data stays in EU. No exceptions.
- The Dynastar DS-5500 transformer (5,500W, bi-directional) may be part of a user's move — factor into all electrical item assessments when present in user profile.
- At launch, users provide their own Anthropic API key (from console.anthropic.com — separate from a claude.ai subscription). The key is stored encrypted at rest and used server-to-server only.
