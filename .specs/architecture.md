# Moving Fairy — Architecture Specification

**Platform**: thefairies.ie
**App**: Moving Fairy
**Primary fairy**: Aisling
**Status**: Pre-build. This document is the authoritative design reference.

---

## 1. System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           User (Browser)                                │
│                                                                         │
│  ┌───────────────┐  ┌────────────────────┐  ┌───────────┐  ┌────────┐  │
│  │  Onboarding   │  │  Decisions List     │  │  Image    │  │ Per-   │  │
│  │  Form         │  │  (home: /decisions) │  │  Upload   │  │ item   │  │
│  │               │  │  + text add input   │  │  (batch)  │  │ Chat   │  │
│  └──────┬────────┘  └────────┬────────────┘  └─────┬─────┘  └───┬────┘  │
└─────────┼────────────────────┼──────────────────────┼────────────┼──────┘
          │                    │                      │            │
          │ POST /onboarding   │ GET /api/items       │ POST       │ POST
          │                    │ POST /api/items      │ /upload    │ /api/items/:id/chat
          ▼                    ▼                      ▼            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                             API Layer                                   │
│                                                                         │
│  ┌──────────────────┐  ┌───────────────────────┐  ┌──────────────────┐  │
│  │  Profile Service │  │  Item Service          │  │  Upload Service  │  │
│  │  (via MCP)       │  │  CRUD + assess/:id     │  │  WebP optimise   │  │
│  └──────────────────┘  └──────────┬─────────────┘  └────────┬─────────┘  │
│                                    │                          │           │
│                          ┌─────────┘                          │           │
│                          │ Background:                        │           │
│                          │ POST /api/assess/:id               │           │
│                          │ (fire-and-forget)                  │           │
│                          ▼                                    ▼           │
│  ┌─────────────────────────────────────────┐  ┌────────────────────┐     │
│  │  assess-item.ts                         │  │  Supabase Storage  │     │
│  │  Compose Aisling prompt → call LLM      │  │  (Frankfurt, EU)   │     │
│  │  Parse render_assessment_card → update  │  │  WebP images       │     │
│  │  DB via MCP                              │  │  item_assessment   │     │
│  └──────────────────────┬──────────────────┘  └────────────────────┘     │
└─────────────────────────┼───────────────────────────────────────────────┘
                          │
                          ▼
                ┌───────────────────────────┐
                │    MCP Layer (Supabase)    │
                │                           │
                │  item_assessment CRUD     │
                │  user_profile CRUD        │
                │  box management           │
                │  cost summary             │
                └──────────┬────────────────┘
                           ▼
             ┌───────────────────────────────┐      ┌─────────────────────┐
             │           Database             │      │  Supabase Realtime  │
             │  UserProfile                   │ ────>│  item_assessment    │
             │  ItemAssessment                │      │  changes pushed     │
             │  Box / BoxItem                 │      │  to client          │
             └───────────────────────────────┘      └─────────────────────┘
```

### Aisling System Prompt Composition (for background assessment)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  aisling-prompt.ts — composeAssessmentPrompt(profile)                   │
│                                                                         │
│  1. Aisling persona (MCP/Session sections stripped for background mode) │
│  2. Serialised UserProfile (route, equipment, currency)                 │
│  3. Departure country module (e.g. us-departure)                       │
│  4. Arrival country module (e.g. ie-arrival)                           │
│  5. Onward country module (e.g. au-arrival) if set                     │
│  6. Voltage skill module                                                │
│  7. Shipping economics skill module                                     │
│  8. Background assessment instruction (single-item, tool-only)          │
└─────────────────────────────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                 Aisling (background assessment mode)                     │
│                                                                         │
│  Single-turn LLM call per item:                                         │
│  - CLI mode (dev): claude subprocess with tool instructions in prompt  │
│  - SDK mode (prod): Anthropic SDK with native tool_use                  │
│  - Only tool: render_assessment_card                                    │
│  - Verdicts: SELL / DONATE / DISCARD / SHIP / CARRY / REVISIT          │
│  - Result written to DB; client picks up via Supabase Realtime          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Agent and Skill Architecture

### 2.1 Aisling — Fairy Persona and Orchestrator

Aisling is the user-facing AI persona. Warm, decisive, practical. She handles item assessment only.

**Aisling's scope:**
- Receive item queries via photo upload, text description, or both
- Identify items from photos (multimodal LLM input)
- Apply the item disposition framework: voltage compatibility → shipping economics → practicality → verdict
- Produce verdicts: SELL / DONATE / DISCARD / SHIP / CARRY / DECIDE LATER
- Assess voltage/electrical compatibility per item
- Assess shipping cost vs buy-new-at-destination economics per item
- Maintain a running cost calculator — updated via MCP after each confirmed assessment
- Save every completed assessment via MCP
- Create boxes for rooms conversationally (e.g. "start a kitchen box")
- Assign SHIP and CARRY items to boxes via MCP
- Perform light assessments for unassessed items encountered during packing (see `light-assessment.md`)
- Read handwritten box contents lists via photo OCR (multimodal LLM input)
- Reconcile handwritten lists against existing ItemAssessment records — match known items, flag unknowns
- Generate box manifests (ordered list of contents per box)

**Aisling does NOT handle:**
- Customs rules or duty advice
- Biosecurity rules (DAFF, phytosanitary, etc.)
- Duty-free thresholds or Transfer of Residence relief
- VRT or vehicle import rules
- Pet import rules
- Prescription drug or HPRA rules

These are the responsibility of a separate Customs Agent (see section 9). If a user raises any of these topics, Aisling acknowledges the question and redirects: "Customs and biosecurity advice is handled separately — I focus on what to pack and what to leave behind."

Aisling's system prompt is assembled at session start by composing:
- Her persona and response format instructions (static)
- The user's serialised profile (dynamic, from MCP)
- The relevant country module payloads (dynamic, resolved from profile)
- The relevant skill module outputs (dynamic, resolved from profile)

### 2.2 MCP Layer — All Database Access

All database reads and writes from Aisling go through the MCP server. Aisling never runs SQL or accesses the database directly.

MCP tools available to Aisling:

| Tool name | Inputs | Returns | Purpose |
|-----------|--------|---------|---------|
| `get_user_profile` | `session_id` | UserProfile record | Load user context at session start |
| `save_item_assessment` | `user_profile_id`, `session_id`, item fields | `ItemAssessment.id` | Save a new item assessment |
| `update_item_assessment` | `assessment_id`, changed fields | Updated ItemAssessment | Apply user-requested changes |
| `get_cost_summary` | `user_profile_id` | Counts by verdict + total ship cost | Power the running cost calculator |
| `get_item_assessments` | `user_profile_id`, optional filters | Array of ItemAssessment | Load previous assessments |
| `create_box` | `user_profile_id`, `room_name` | Box record with auto-assigned `box_number` | Create a box. Number auto-increments per room per user. |
| `add_item_to_box` | `box_id`, `item_assessment_id` OR `item_name` | BoxItem record | Assign an item to a box. MCP rejects non-SHIP/CARRY verdicts. If verdict later changes to SELL/DONATE/DISCARD, MCP removes the BoxItem. |
| `remove_item_from_box` | `box_id`, `box_item_id` | Confirmation | Remove an item from a box. |
| `get_box` | `box_id` | Box record with full contents | Get a box and its BoxItems. |
| `get_boxes` | `user_profile_id` | Array of Box records with item counts | Get all boxes for a user. |
| `save_box_manifest_photo` | `box_id`, `image_url` | Updated Box record | Store the handwritten manifest photo URL. |
| `get_box_manifest` | `box_id` | Formatted manifest: label + item list | Generate a printable/displayable box manifest. |
| `set_all_boxes_shipped` | `user_profile_id` | Count of updated boxes | Marks all boxes and single items for a user as `shipped` in a single operation. Skips boxes already in `shipped` or `arrived` status. |
| `update_box_cbm` | `box_id`, `cbm` | Updated Box record | Set or update the CBM for a single_item box where the user provided dimensions. |

### 2.3 Box Management

Aisling manages the organisation of SHIP and CARRY items into labelled physical boxes. Box management is accessible from two entry points — in chat (conversational, primary) and via a standalone Boxes UI panel (secondary, see `ux-flow.md` section 11). Both entry points use the same MCP tools and the same light assessment logic (see `light-assessment.md`).

**Box label format**: `{room_name} {box_number}`, e.g. "Kitchen 1", "Bedroom 1". Room names are user-defined free text, displayed in title case. Box numbers auto-increment per unique room name per user. The MCP server computes and assigns the number on `create_box`. Labels are stored on insert and never recomputed.

**Label uniqueness**: Unique per user profile. Two different users may both have "Kitchen 1" — expected and correct.

**Verdict gate**: `add_item_to_box` checks the linked `ItemAssessment.verdict`. SELL/DONATE/DISCARD items are rejected. If a verdict is later changed from SHIP to SELL via `update_item_assessment`, the MCP removes the associated BoxItem and flags the change so Aisling can inform the user.

**Handwritten list OCR flow**:
1. User photographs the handwritten contents list on the physical box.
2. Upload Service processes the image (same WebP/1024px pipeline as item photos) and returns a URL.
3. Aisling calls `save_box_manifest_photo` — URL stored on `Box.manifest_image_url`.
4. Aisling passes the image to the multimodal LLM and extracts item names from the handwriting.
5. For each extracted item, Aisling fuzzy-matches against existing `ItemAssessment` records for the user.
6. **Matched items** → `add_item_to_box` called with the matched `item_assessment_id`.
7. **Unmatched items** → Aisling flags them and asks what to do. She does not auto-assign a verdict. If confirmed, a `BoxItem` is created with `item_assessment_id = null` and `needs_assessment = true`.
8. **Items in the digital box but absent from the handwritten list** → Aisling flags the discrepancy and asks the user to confirm location.

**Single items** (furniture, bikes, large appliances): tracked as boxes with `box_type = single_item`. No physical box — the item is listed individually in the manifest. Aisling asks the user for dimensions (length × width × height in cm) and estimates CBM. The `create_box` MCP tool is called with `box_type = single_item`; the label is set to the item name rather than a room/number pattern.

**Bulk ship action**: The user can mark all boxes (all types including single items, checked luggage, and carry-on) as `shipped` in a single action. The MCP tool `set_all_boxes_shipped` performs this. Items already in `shipped` or `arrived` status are skipped.

**On each item assessment turn**, after Aisling produces a verdict:
1. Call `save_item_assessment` (or `update_item_assessment`) via MCP.
2. Call `get_cost_summary` via MCP to retrieve updated running totals.
3. Include the updated cost summary in the response.

### 2.3 Image Upload — First-Class Input

Aisling can assess items from three input modes:

| Input mode | Description |
|------------|-------------|
| Photo only | User photographs an item. Aisling identifies and assesses it. |
| Text only | User types the item name or description. Standard text assessment. |
| Photo + text | Photo plus clarifying context from the user. |

**Image handling and optimisation:**

1. User uploads a photo via the chat interface.
2. The Upload Service processes the image **before** storage:
   - Resize to max 1024px on the long edge
   - Convert to WebP at ~80% quality
   - Discard the original
3. Optimised image is stored in Supabase Storage (Frankfurt) and a URL is returned.
4. The URL is passed to Aisling via the turn input.
5. Aisling receives the image via the multimodal LLM API (URL or base64 per provider).
6. When Aisling calls `save_item_assessment`, the `image_url` field is included — but only if the verdict is SHIP or CARRY (see section 2.4 below).

**Images are only stored for SHIP and CARRY items.** For SELL, DONATE, and DISCARD verdicts, the image is not persisted. The rationale: users only need a photographic record of items they are keeping and moving.

### 2.4 Assessment Record Rules by Verdict

| Verdict | Image stored? | Record type | Fields saved |
|---------|--------------|-------------|--------------|
| SHIP | Yes — optimised WebP | Full record | All ItemAssessment fields |
| CARRY | Yes — optimised WebP | Full record | All ItemAssessment fields |
| SELL | No | Lightweight record | item_name, verdict, advice_text only |
| DONATE | No | Lightweight record | item_name, verdict, advice_text only |
| DISCARD | No | Lightweight record | item_name, verdict, advice_text only |
| REVISIT | Yes — stored immediately; deleted if resolved to SELL/DONATE/DISCARD or session ends unresolved | Pending | No record saved until verdict is resolved |

When a REVISIT verdict is later resolved to SHIP or CARRY, a full record is created at that point (including image if one was provided and is still available in the session). If resolved to SELL/DONATE/DISCARD, a lightweight record is created.

**REVISIT image handling**: If a user uploads an image for a REVISIT item, the Upload Service processes and stores it immediately (same WebP/1024px pipeline). The URL is held in session state. If the verdict is later resolved to SHIP/CARRY, the URL is included in the `save_item_assessment` call. If resolved to SELL/DONATE/DISCARD, or the session ends without resolution, the Upload Service deletes the stored image. No orphaned images remain in storage.

### 2.5 Country Knowledge Modules

Country modules are pluggable knowledge bases covering what Aisling needs to advise on packing and shipping for each country. They are invisible to the user.

A country module is identified by: `{country_code}-{role}`, where role is either `departure` or `arrival`. All arrival and onward destination modules use the `-arrival` suffix — there is no `-onward` suffix.

The routing logic loads:
- `departure_country-departure.md`
- `arrival_country-arrival.md`
- `onward_country-arrival.md` (if `onward_country` is set)

The same file format is used for all arrival-role modules. A country's `-arrival.md` file is loaded twice only if that country appears in both arrival and onward positions — which cannot happen due to the `onward_country != arrival_country` constraint.

Current modules:

| Module ID         | Status |
|-------------------|--------|
| `us-departure`    | Now    |
| `ie-arrival`      | Now    |
| `au-arrival`      | Now (renamed from au-onward) |

Note: `au-onward.md` is renamed to `au-arrival.md` in the `knowledge/` directory. No content changes required — only the filename and all references to it.

Planned modules (no Aisling changes required to add): `ca-departure`, `ca-arrival`, `uk-departure`, `uk-arrival`, `nz-departure`, `nz-arrival`

### 2.6 Skill Modules

| Skill Module    | Inputs | Output |
|-----------------|--------|--------|
| `voltage`       | departure_country, arrival_country, equipment | Per-item voltage verdict modifier; transformer context |
| `shipping-econ` | departure_country, arrival_country, onward_country, onward_timeline | Two-leg strategy, CBM-based cost thresholds. Shipping cost estimates are CBM-based (cubic metres per item), not weight-based. |

### 2.7 User Profile Context

At session start, Aisling calls `get_user_profile` via MCP, serialises the result, and injects it into her context window before any country module or skill content. She never asks the user what country they are departing from or what equipment they own.

---

## 3. How Aisling Is Initialised

On every new session (or on context window reset):

1. Call MCP `get_user_profile(session_id)` → UserProfile.
2. Serialise profile to a structured text block.
3. Resolve country modules: `departure_country-departure`, `arrival_country-arrival`, `onward_country-arrival` (if set).
4. Resolve skill modules: always `voltage` and `shipping-econ`.
5. Compose system prompt:
   ```
   [Aisling persona + response format]
   [User profile block]
   [Departure country module]
   [Arrival country module]
   [Onward country arrival module, if applicable]
   [Voltage skill]
   [Shipping-econ skill]
   ```
6. Pass system prompt + conversation history to LLM.

If the user updates their profile mid-session, reinitialise on the next message.

**Voltage transformer gate**: The onboarding form asks about transformer ownership only when the departure country and ALL destination countries (arrival + onward) share the same voltage standard. If departure and at least one destination differ (e.g. US 120V vs Ireland 230V), the question is shown. If all countries share the same voltage (e.g. Ireland 230V and Australia 230V), the question is skipped and `equipment.transformer` defaults to `{ "owned": false }`.

---

## 4. Country Module Design

### 4.1 Departure Module Schema

| Section                | Content |
|------------------------|---------|
| `voltage`              | Voltage (V), frequency (Hz), plug types |
| `shipping_cost_per_cbm` | Sea freight cost range per CBM from this country |
| `sell_guidance`        | Where to sell locally (marketplaces, charities) |
| `timing_notes`         | Timing considerations for departure |

### 4.2 Arrival Module Schema

For Aisling's use only — does not include customs content (that belongs to the Customs Agent).

| Section                | Content |
|------------------------|---------|
| `voltage`              | Voltage (V), frequency (Hz), plug types |
| `sell_guidance`        | Where to sell or donate at the destination |
| `replace_cost_context` | Cost-of-living context for buy-new-at-destination estimates |

### 4.3 Onward Destination Modules

Onward destination countries use the same `-arrival.md` module format as arrival countries. There is no separate onward module schema. The `two_leg_strategy` section is included in all arrival modules to support cases where that country is used as an onward destination:

| Section              | Content |
|----------------------|---------|
| `two_leg_strategy`   | Advice specific to arriving via an intermediate country, by timeline. Present in all arrival modules. Only injected when the country is in the onward position. |

---

## 5. Extensibility Model

To add a new country:
1. Create country module document(s) per section 4. Roles are `departure` or `arrival` only — no `-onward` modules.
2. Register the country code in the `Country` enum.
3. Register in the module registry (`{country_code}-departure` or `{country_code}-arrival` → module).
4. No changes to Aisling, skill modules, or session initialisation.

To add a new skill: implement, register, add to system prompt composition order. No other changes.

---

## 6. Onward Move Logic

| Timeline    | Shipping strategy |
|-------------|-------------------|
| `1_2yr`     | Short stay. Minimise accumulation. Consider direct shipping to onward country for definitively-onward items. |
| `3_5yr`     | Default two-leg strategy. Ship to arrival country now. Revisit at ~2.5yr mark. |
| `5yr_plus`  | Treat arrival country as long-term base. Ship freely. |
| `undecided` | Default to `3_5yr` logic. Note the uncertainty. |

---

## 7. Equipment Context

The `voltage` skill module reads `equipment.transformer` from the user profile (loaded via MCP) and injects a modifier block into the system prompt. Future equipment types follow the same pattern — new key in the equipment JSONB, new modifier block in the relevant skill module.

---

## 8. Fairy vs Hidden Layer Distinction

### What the user sees

| Visible element    | Description |
|--------------------|-------------|
| Aisling            | A warm, named fairy persona. |
| Onboarding form    | "Tell us about your move" — countries, timeline, equipment. |
| Chat interface     | Conversational UI with image upload. |
| Image upload       | User photographs an item; Aisling identifies and assesses it. |
| Disposition labels | SELL / DONATE / DISCARD / SHIP / CARRY / DECIDE LATER in responses. |
| Cost calculator    | Running tally of estimated shipping costs and item counts by verdict. |

### What is hidden

| Hidden element        | Description |
|-----------------------|-------------|
| MCP layer             | All DB reads and writes go through MCP tools. Never visible to the user. |
| Country modules       | Never named or exposed. |
| Skill modules         | Never named or exposed. |
| Prompt engineering    | System prompt composition, module injection, skill outputs. |
| Profile serialisation | The structured profile block injected into context. |
| LLM provider          | Not referenced in the UI. |
| Image optimisation    | Resize/compress/WebP conversion happens before storage. |

**The product principle**: the fairy is magic. The modules, MCP tools, and skills are the wand — users never see the wand.

### BYO Anthropic API Key

At launch, users provide their own Anthropic API key. The key is:
- Stored encrypted at rest in Supabase (`UserProfile.anthropic_api_key`)
- Never sent to the browser — used server-to-server only
- Retrieved by the Session/Chat Service on each request and used to call the Anthropic API on behalf of the user
- If no key is set, the chat service blocks the request and prompts the user to add a key

**Key resolution order (server-side):**
1. `ANTHROPIC_API_KEY` environment variable — used in local development. Set this in `.env.local` to reuse the same key already configured for Claude Code, avoiding any extra setup or cost.
2. `UserProfile.anthropic_api_key` — used in production. The user's stored key retrieved from Supabase.

This means local development requires no UI key entry and no separate account — just the existing key from your Claude Code environment.

Future: Moving Fairy will offer a managed plan where the platform provides API access at a cost, removing the need for users to manage their own key.

---

## 9. Placeholder: Customs Agent

A separate Customs Agent is planned but not yet designed. It is a sibling feature to Aisling — a distinct agent on thefairies.ie.

Customs Agent scope (not Aisling's concern):
- Customs rules and duty calculations
- Biosecurity rules (DAFF for AU, phytosanitary for IE/EU)
- Duty-free thresholds and Transfer of Residence relief
- VRT and vehicle import rules
- Pet import requirements and quarantine lead times
- Prescription drug and HPRA rules
- Regulatory contacts and customs authority URLs

The Customs Agent will have its own country modules (with arrival module schemas that include the customs-specific sections stripped from Aisling's modules), its own MCP tools, and its own system prompt. No design decisions for it are made here.
