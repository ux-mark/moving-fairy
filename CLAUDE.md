# Moving Fairy — Master Instructions

This is the Moving Fairy app, part of **thefairies.ie** platform. The primary agent for this app is **Aisling** (`.claude/agents/aisling.md`).

---

## What This App Does

Moving Fairy helps people relocating from the US to Ireland (with a potential onward move to Australia) decide what to sell, donate, discard, or ship for every item they own. It covers:

- Sell / donate / discard / ship decisions per item category
- Electrical voltage and customs guidance for Ireland and Australia
- Two-leg shipping strategy (US → Ireland → Australia)
- Timing and decision checklists for each stage of the move

---

## Agent Roster

| Agent | Role |
|-------|------|
| `aisling` | Primary fairy — all relocation advice, item decisions, customs, voltage |
| `fairy` (inherited from parent) | Orchestrator — decomposes tasks, delegates to specialists |
| `builder` (inherited) | Implementation |
| `reviewer` (inherited) | Code review and QA |
| `planner` (inherited) | Research and architecture |

Always invoke **Aisling** for any user-facing relocation query. Aisling is the single source of truth — she contains all customs, voltage, and shipping knowledge inline and does not depend on external reference files.

---

## Deprecated Files

The following files from the parent `leaving-us/` directory are superseded by Aisling's agent definition and should not be used for new development:

| Deprecated | Replaced by |
|------------|-------------|
| `leaving-us/SKILL.md` | `moving-fairy/.claude/agents/aisling.md` |
| `leaving-us/update.md` | `moving-fairy/.claude/agents/aisling.md` |
| `leaving-us/references/ireland-customs.md` | Embedded in Aisling |
| `leaving-us/references/australia-customs.md` | Embedded in Aisling |
| `leaving-us/references/voltage-guide.md` | Embedded in Aisling |

---

## Spec-First Protocol

On every session start:

1. Read `.specs/PROJECT_SPEC.md` (create from template if missing)
2. Read `.specs/features.md` and `.specs/personas.md`
3. Read `.claude/memory/decisions.md`, `.claude/memory/changelog.md`, `.claude/memory/issues.md`
4. Proceed with the user's request

See the parent `leaving-us/CLAUDE.md` for full conventions including git workflow, effort scaling, UXicorn mandate, quality gates, and Playwright E2E protocol.

---

## Platform Context

- **Domain**: thefairies.ie
- **App name**: Moving Fairy
- **Primary fairy**: Aisling
- **Target users**: People emigrating from the US to Ireland (and potentially onward to Australia)
