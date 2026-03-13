# Moving Fairy — Data Model Specification

**Status**: Design spec. Not implementation. No ORM, migration, or SQL dialect assumed.

---

## 1. Country Enum

All values are ISO 3166-1 alpha-2 codes.

```
Country = US | IE | AU | CA | UK | NZ
```

| Value | Name           | Departure | Arrival      | Status  |
|-------|----------------|-----------|--------------|---------|
| `US`  | United States  | Now       | —            | Now     |
| `IE`  | Ireland        | —         | Now          | Now     |
| `AU`  | Australia      | —         | Now (onward) | Now     |
| `CA`  | Canada         | Planned   | Planned      | Planned |
| `UK`  | United Kingdom | Planned   | Planned      | Planned |
| `NZ`  | New Zealand    | Planned   | Planned      | Planned |

**Extensibility**: Adding a country requires (1) adding the enum value and (2) creating the corresponding country module(s) per `architecture.md` section 4. No other changes.

---

## 2. OnwardTimeline Enum

```
OnwardTimeline = 1_2yr | 3_5yr | 5yr_plus | undecided
```

| Value       | Label in UI     | Meaning for advice logic |
|-------------|-----------------|--------------------------|
| `1_2yr`     | "1–2 years"     | Short stay. Minimise accumulation. Consider direct shipping to onward country for definitively-onward items. |
| `3_5yr`     | "3–5 years"     | Standard two-leg strategy. Ship to arrival country now. Revisit at ~2.5yr mark. |
| `5yr_plus`  | "5+ years"      | Long-term base. Ship freely. Onward move is speculative. |
| `undecided` | "Not sure yet"  | Default to `3_5yr` logic. Flag uncertainty in shipping advice. |

Nullable. If null, no two-leg strategy advice is given (appropriate when `onward_country` is also null).

---

## 3. Verdict Enum

```
Verdict = SELL | DONATE | DISCARD | SHIP | CARRY | DECIDE_LATER
```

| Value          | Meaning | Record type | Image stored? |
|----------------|---------|-------------|---------------|
| `SHIP`         | Include in sea freight shipment | Full | Yes — optimised WebP |
| `CARRY`        | Bring in luggage or carry-on | Full | Yes — optimised WebP |
| `SELL`         | Sell before departing | Lightweight | No |
| `DONATE`       | Donate before departing | Lightweight | No |
| `DISCARD`      | Dispose of the item | Lightweight | No |
| `DECIDE_LATER` | Insufficient info — revisit | Pending (not saved yet) | Yes — saved immediately to storage as reference; deleted if resolved to SELL/DONATE/DISCARD or session ends unresolved |

**Full records** store all ItemAssessment fields including image URL, cost estimates, and notes.
**Lightweight records** store only: `item_name`, `verdict`, `advice_text`. No image, no cost fields.
**Pending** items are not written to the database until the verdict is resolved. If a photo was provided, it is stored immediately and the URL is held in session state; the image is deleted from storage if the verdict resolves to SELL/DONATE/DISCARD or the session ends unresolved.

---

## 4. UserProfile Table

| Column              | Type                | Nullable | Notes |
|---------------------|---------------------|----------|-------|
| `id`                | UUID                | No       | Primary key. |
| `created_at`        | Timestamp with TZ   | No       | Set on insert. |
| `updated_at`        | Timestamp with TZ   | No       | Set on insert and every update. |
| `departure_country` | Country enum        | No       | Country the user is leaving from. |
| `arrival_country`   | Country enum        | No       | Country the user is moving to. |
| `onward_country`    | Country enum        | Yes      | Optional second destination. |
| `onward_timeline`   | OnwardTimeline enum | Yes      | How long in arrival country before onward move. Null if no onward country. |
| `equipment`         | JSONB               | No       | Defaults to `{}`. See section 5. |
| `anthropic_api_key` | text                | Yes      | Encrypted at rest. User's BYO Anthropic API key. Null until the user provides one. Used server-to-server only — never sent to the browser. |

**Constraints:**
- `departure_country != arrival_country`
- If `onward_country` is set: `onward_country != arrival_country`
- If `onward_timeline` is set: `onward_country` must also be set

---

## 5. Equipment JSON Schema

Stored as JSONB in `UserProfile.equipment`. Extensible without schema migrations.

```json
{
  "transformer": {
    "owned": true,
    "model": "Dynastar DS-5500",
    "wattage_w": 5500
  }
}
```

**`equipment.transformer` fields:**

| Field       | Type    | Nullable | Notes |
|-------------|---------|----------|-------|
| `owned`     | boolean | No       | Whether the user owns a voltage transformer. |
| `model`     | string  | Yes      | Model name. Null if unknown. |
| `wattage_w` | integer | Yes      | Continuous wattage rating. Null if unknown. |

If `owned` is `false`, `model` and `wattage_w` must be null.

New equipment types are added as new JSONB keys — no migration required.

---

## 6. Session Table

| Column            | Type              | Nullable | Notes |
|-------------------|-------------------|----------|-------|
| `id`              | UUID              | No       | Primary key. |
| `created_at`      | Timestamp with TZ | No       | Session start time. |
| `updated_at`      | Timestamp with TZ | No       | Updated on every change to the session. |
| `user_profile_id` | UUID (FK)         | No       | References `UserProfile.id`. |

**Index**: `user_profile_id`.

Images are NOT stored on Session. Each image URL lives on the `ItemAssessment` record.

---

## 7. Message Table

Stores chat messages as individual rows. Each message belongs to a session.

| Column      | Type              | Nullable | Notes |
|-------------|-------------------|----------|-------|
| `id`        | TEXT              | No       | Message ID (e.g. `msg_1710000000000_user`). Part of composite PK. |
| `session_id`| UUID (FK)         | No       | References `Session.id`. Part of composite PK. |
| `role`      | TEXT              | No       | `user` or `assistant`. Enforced by CHECK constraint. |
| `content`   | TEXT              | No       | Markdown permitted. |
| `created_at`| Timestamp with TZ | No       | Defaults to NOW(). |

**Primary Key**: `(session_id, id)` — message IDs are unique within a session, not globally.

**Indexes:**
- `(session_id)` — retrieve all messages for a session
- `(session_id, created_at)` — ordered retrieval for chat history

**RLS**: Enabled. Policies to be added alongside other tables (see MF-ISSUE-005).

---

## 8. ItemAssessment Table

One record per assessed item. All writes go through the MCP — Aisling never writes directly. The record type (full vs lightweight) depends on the verdict.

**Freight costs are CBM-based (cubic metres), not weight-based. Sea freight for household moves is quoted per CBM.**

| Column                       | Type              | Nullable | Populated for | Notes |
|------------------------------|-------------------|----------|---------------|-------|
| `id`                         | UUID              | No       | All           | Primary key. |
| `user_profile_id`            | UUID (FK)         | No       | All           | References `UserProfile.id`. |
| `session_id`                 | UUID (FK)         | Yes      | All           | References `Session.id`. Nullable. |
| `item_name`                  | text              | No       | All           | Canonical name as understood by Aisling. |
| `item_description`           | text              | Yes      | All           | User's original description. |
| `verdict`                    | Verdict enum      | No       | All           | The disposition decision. |
| `advice_text`                | text              | Yes      | All           | Aisling's plain-language reasoning, stored for display. |
| `image_url`                  | text              | Yes      | SHIP, CARRY   | URL of optimised WebP in object storage. Null for SELL/DONATE/DISCARD. |
| `voltage_compatible`         | boolean           | Yes      | SHIP, CARRY   | True = works at arrival voltage without modification. Null = not electrical. |
| `needs_transformer`          | boolean           | Yes      | SHIP, CARRY   | True = works with user's transformer. Null = not applicable. |
| `estimated_ship_cost`        | decimal           | Yes      | SHIP, CARRY   | Estimated freight cost in the departure country's currency, computed from item CBM × sea freight rate. Null for non-SHIP verdicts. |
| `currency`                   | text              | Yes      | SHIP, CARRY   | ISO 4217 code for `estimated_ship_cost` (e.g. "USD", "EUR", "AUD"). Derived from departure country at time of assessment. |
| `estimated_replace_cost`     | decimal           | Yes      | SHIP, CARRY   | Cost to replace at the arrival destination, in the arrival country's currency. Used in ship-vs-buy decision. |
| `replace_currency`           | text              | Yes      | SHIP, CARRY   | ISO 4217 code for `estimated_replace_cost` (e.g. "EUR", "AUD"). Derived from arrival country at time of assessment. |
| `user_confirmed`             | boolean           | No       | All           | Default false. True when user explicitly accepts the assessment. |
| `created_at`                 | Timestamp with TZ | No       | All           | Set on insert. |
| `updated_at`                 | Timestamp with TZ | No       | All           | Set on every update. |

**Indexes:**
- `user_profile_id` — retrieve all assessments for a user
- `(user_profile_id, verdict)` — compute cost summaries by verdict

### Image storage rules

- The Upload Service processes images **before** storage: resize to max 1024px long edge, convert to WebP at ~80% quality, discard original.
- Optimised images are stored in Supabase Storage (Frankfurt). The DB stores the URL only.
- `image_url` is populated only when `verdict` is `SHIP` or `CARRY`. For all other verdicts, no image is stored and the field is null.

### Record lifecycle for DECIDE_LATER

DECIDE_LATER items are not written to the database immediately. However, **if the user provided a photo, the image is saved to Supabase Storage immediately** (same WebP/1024px pipeline as SHIP/CARRY items) and the URL is retained in session state as a reference for the user during the session.

When the user later resolves the verdict:
- Resolved to SHIP or CARRY → full record created, image URL included from the already-stored image.
- Resolved to SELL, DONATE, or DISCARD → lightweight record created (item_name, verdict, advice_text only). **The stored image is deleted from Supabase Storage.**
- Session ends without resolution → image is deleted from Supabase Storage. No record created.

---

## 9. BoxSize Enum

```
BoxSize = XS | S | M | L
```

| Value | Label     | Approx. CBM | Typical use |
|-------|-----------|-------------|-------------|
| `XS`  | Extra Small | 0.04 CBM  | Books, documents, small electronics |
| `S`   | Small       | 0.07 CBM  | Kitchen items, clothes, small appliances |
| `M`   | Medium      | 0.15 CBM  | Large appliances, bedding, bulky items |
| `L`   | Large       | 0.25 CBM  | Furniture components, large artwork, bikes |

CBM values are estimates used for freight cost calculation. Actual CBM may vary.

---

## 10. BoxType Enum

```
BoxType = standard | checked_luggage | carryon | single_item
```

| Value             | Label              | Description |
|-------------------|--------------------|-------------|
| `standard`        | Standard box       | A regular packing box |
| `checked_luggage` | Checked Luggage N  | A checked bag or suitcase (label: "Checked Luggage {N}") |
| `carryon`         | Carry-on           | Carry-on bag or backpack (only one per user; label: "Carry-on") |
| `single_item`     | Single item        | A large item not going in a box: furniture, bike, appliance. Tracked individually. Label is the item name. |

---

## 11. BoxStatus Enum

```
BoxStatus = packing | packed | shipped | arrived
```

| Value     | Meaning |
|-----------|---------|
| `packing` | Box is being filled. Contents may still change. |
| `packed`  | Box is sealed. Contents are finalised. |
| `shipped` | Box has been collected by the shipping company. Contents become read-only. |
| `arrived` | Box has arrived at the destination. |

Default: `packing`.

---

## 12. Box Table

One record per physical box. Created via the `create_box` MCP tool. Only SHIP and CARRY items are assigned to boxes — the MCP enforces this.

| Column               | Type              | Nullable | Notes |
|----------------------|-------------------|----------|-------|
| `id`                 | UUID              | No       | Primary key. |
| `user_profile_id`    | UUID (FK)         | No       | References `UserProfile.id`. |
| `box_type`           | BoxType enum      | No       | Default: `standard`. |
| `size`               | BoxSize enum      | Yes      | Null for `single_item` and `carryon` type boxes. Required for `standard` and `checked_luggage`. |
| `cbm`                | decimal           | Yes      | For `standard` and `checked_luggage`: derived from `size` (stored on insert). For `single_item`: provided by user (Aisling asks for dimensions and estimates CBM). Null until provided. |
| `room_name`          | text              | No       | User-defined room name. e.g. "Kitchen", "Bedroom 1". Stored as provided, displayed in title case. |
| `box_number`         | integer           | No       | Sequential number for this room for this user. Computed by MCP on create: `MAX(box_number) + 1` for matching `user_profile_id` + normalised `room_name`. Starts at 1. |
| `label`              | text              | No       | Computed and stored on insert. Format varies by `box_type` — see label format notes below. Stored — not recomputed. |
| `manifest_image_url` | text              | Yes      | URL of the uploaded photo of the handwritten box contents list. Null until the user uploads one. |
| `status`             | BoxStatus enum    | No       | Default: `packing`. |
| `created_at`         | Timestamp with TZ | No       | Set on insert. |
| `updated_at`         | Timestamp with TZ | No       | Set on every update. |

**Label format by box type:**
- `standard`: `"{room_name} {box_number}"` e.g. "Kitchen 1"
- `checked_luggage`: `"Checked Luggage {box_number}"` — box_number auto-increments across all checked luggage for this user
- `carryon`: `"Carry-on"` — fixed label, only one per user
- `single_item`: item name (from the linked `ItemAssessment.item_name` or free text)

**Constraints:**
- `UNIQUE(user_profile_id, room_name, box_number)` — unique box numbers per room per user.
- `label` is unique per `user_profile_id`. Two different users may both have "Kitchen 1".

**Indexes:**
- `user_profile_id` — retrieve all boxes for a user.
- `(user_profile_id, room_name)` — compute next `box_number` for a room.

---

## 13. BoxItem Table

Links items to boxes. An assessed item can only be in one box at a time.

| Column                  | Type              | Nullable | Notes |
|-------------------------|-------------------|----------|-------|
| `id`                    | UUID              | No       | Primary key. |
| `box_id`                | UUID (FK)         | No       | References `Box.id`. |
| `item_assessment_id`    | UUID (FK)         | Yes      | References `ItemAssessment.id`. Null for items added from a handwritten list that have not yet been assessed. |
| `item_name`             | text              | Yes      | Display name for unassessed items only. NULL for assessed items — use `ItemAssessment.item_name` as the canonical source. |
| `quantity`              | integer           | No       | Default 1. |
| `from_handwritten_list` | boolean           | No       | Default false. True if added via handwritten list OCR rather than directly by the user or Aisling. |
| `needs_assessment`      | boolean           | No       | Default false. True if `item_assessment_id` is null — flags items from handwritten lists pending assessment. |
| `created_at`            | Timestamp with TZ | No       | Set on insert. |

**Constraints:**
- `UNIQUE(item_assessment_id) WHERE item_assessment_id IS NOT NULL` — a partial unique index. An assessed item can only be in one box. Unassessed items (null `item_assessment_id`) are exempt.
- If `item_assessment_id` is set, the linked `ItemAssessment.verdict` must be `SHIP` or `CARRY`. Enforced by MCP, not DB constraint.

**Index:** `box_id` — retrieve all items for a box.

---

## 14. Running Cost Calculator (Computed)

No separate CostSummary table. The calculator is computed on read from `ItemAssessment` records by the MCP `get_cost_summary` tool.

| Metric | Computation |
|--------|-------------|
| Total estimated ship cost | `SUM(estimated_ship_cost) WHERE verdict = 'SHIP' AND user_profile_id = X GROUP BY currency` — all assessments for a given user will share the same `currency` (their departure country currency) |
| Items by verdict | `COUNT(*) GROUP BY verdict WHERE user_profile_id = X` |
| Sell/donate revenue | Future feature — users will input sale prices. For now: item count only by verdict. |

The MCP server runs the aggregation and returns structured results. Aisling does not perform aggregation herself.

---

## 15. MCP Tools

All of Aisling's database access goes through these tools. The MCP server owns all query execution, validation, and error handling.

| Tool name | Inputs | Returns | Purpose |
|-----------|--------|---------|---------|
| `get_user_profile` | `session_id` | UserProfile record | Load user context at session start |
| `save_item_assessment` | `user_profile_id`, `session_id` (opt), `item_name`, `verdict`, `advice_text`, + full-record fields if SHIP/CARRY: `item_description`, `image_url`, `voltage_compatible`, `needs_transformer`, `estimated_ship_cost`, `currency`, `estimated_replace_cost`, `replace_currency` | `ItemAssessment.id` | Save a new assessment. MCP enforces the full vs lightweight rule based on verdict. |
| `update_item_assessment` | `assessment_id`, any mutable fields | Updated ItemAssessment | Apply user-requested changes. If verdict changes (e.g. SELL → SHIP), MCP upgrades the record to full type. |
| `get_cost_summary` | `user_profile_id` | `{ counts_by_verdict: {...}, total_estimated_ship_cost: decimal, currency: string }` | Power the running cost calculator. Returns totals in the user's departure country currency. |
| `get_item_assessments` | `user_profile_id`, optional: `session_id`, `verdict`, `user_confirmed` | Array of ItemAssessment | Load previous assessments for display or to avoid re-assessing the same item. |
| `create_box` | `user_profile_id`, `room_name` | Box record with auto-assigned `box_number` | Create a box. Number auto-increments per room per user. |
| `add_item_to_box` | `box_id`, `item_assessment_id` OR `item_name` | BoxItem record | Assign an item to a box. Rejects SELL/DONATE/DISCARD verdicts. |
| `remove_item_from_box` | `box_id`, `box_item_id` | Confirmation | Remove an item from a box. |
| `get_box` | `box_id` | Box record with full BoxItem contents | Get a specific box and its contents. |
| `get_boxes` | `user_profile_id` | Array of Box records with item counts | Get all boxes for a user. |
| `save_box_manifest_photo` | `box_id`, `image_url` | Updated Box record | Store the handwritten manifest photo URL on the box. |
| `get_box_manifest` | `box_id` | Formatted manifest: label + item list | Generate a printable/displayable box manifest. |
| `set_all_boxes_shipped` | `user_profile_id` | Count of updated boxes | Marks all boxes and single items for a user as `shipped` in a single operation. Skips boxes already in `shipped` or `arrived` status. |
| `update_box_cbm` | `box_id`, `cbm` | Updated Box record | Set or update the CBM for a single_item box where the user provided dimensions. |

The MCP server enforces the record type rules: it never stores `image_url` or cost fields for SELL/DONATE/DISCARD verdicts, even if the caller provides them.

---

## 16. Relationships

```
UserProfile    (1) ──── (many) Session
UserProfile    (1) ──── (many) ItemAssessment
UserProfile    (1) ──── (many) Box
Session        (1) ──── (many) Message
Session        (1) ──── (many) ItemAssessment  [via session_id FK, nullable]
Box            (1) ──── (many) BoxItem
BoxItem        (0..1) ── (1)   ItemAssessment  [via item_assessment_id, nullable]
ItemAssessment — SHIP/CARRY only → (1) image in object storage  [via image_url]
Box            — (0..1) → manifest image in object storage  [via manifest_image_url]
Box.box_type = 'single_item' → item tracked without a physical box container
Box.box_type = 'carryon' | 'checked_luggage' → luggage items, not packing boxes
```

---

## 17. Sequence: Onboarding to First Assessment

```
User submits onboarding form
  → POST /onboarding
  → Validate form data
  → INSERT UserProfile (departure, arrival, onward, timeline, equipment)
  → INSERT Session (user_profile_id)
  → Return session_id to client

User sends text message
  → POST /chat { session_id, message }
  → MCP: get_user_profile(session_id) → UserProfile
  → Serialise profile → resolve modules → compose system prompt
  → INSERT into message table (user message)
  → Call LLM API (system prompt + messages)
  → INSERT into message table (assistant response)
  → If verdict is SHIP/CARRY: MCP: save_item_assessment(... full record ...)
  → If verdict is SELL/DONATE/DISCARD: MCP: save_item_assessment(... lightweight ...)
  → If verdict is DECIDE_LATER: do not save yet
  → MCP: get_cost_summary(user_profile_id) → updated totals
  → Return response + cost summary to client

User sends message with image
  → POST /upload { image file }
  → Upload Service: resize → WebP → store → return image_url
  → POST /chat { session_id, message, image_url }
  → [same flow as text; image_url passed to LLM API]
  → If SHIP/CARRY verdict: image_url included in save_item_assessment call
  → If other verdict: image_url discarded (not stored)
```
