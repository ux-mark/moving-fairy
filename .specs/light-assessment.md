# Light Assessment — Spec

**Context**: Aisling performs a light assessment when a user is actively packing and encounters an item that has not been previously assessed. The question shifts from "what should I do with this?" to "is there anything I should know before this goes in the box?"

**Owner**: Aisling
**Triggered by**: User assigns or asks about an item during packing that has no existing `ItemAssessment` record.

---

## When it applies

A light assessment is triggered when:
- User names an item or assigns it to a box directly (e.g. "KitchenAid — Kitchen 1")
- The item has no existing `ItemAssessment` record for this user
- The user is in a box/packing context (i.e. they are assigning to a box, not in an open-ended "what should I do?" conversation)

A full assessment is used in all other contexts (pre-move planning, open-ended item queries, explicit "should I bring this?" questions).

---

## What Aisling checks

In order:

1. **Import restrictions** — is this item prohibited or high-risk for the arrival or onward country? If yes, flag.
2. **Voltage** — is this item single-voltage and incompatible at the destination? If yes, flag. If the user has a transformer, note whether it covers the item.
3. **Biosecurity risk** — if the onward country has biosecurity inspection rules (check the `{onward_country}-arrival.md` module), flag items that face inspection risk (timber, organic materials, outdoor gear, etc.) relevant to that country's rules. (Example for Australia: untreated timber needs an ISPM 15 certificate)

If none of these checks raise a concern: confirm assignment with no commentary. Do not pad with unnecessary advice.

---

## Response format

**No issues**: One line. Confirm and move on.

> "Added to Kitchen 1. ✓"

**One flag**: State the flag clearly and concisely, then confirm assignment. Maximum two sentences.

> "120V — needs your DS-5500 in Ireland. Worth shipping though. Added to Kitchen 1. ✓"

> "One flag for Australia: untreated timber needs an ISPM 15 certificate to enter. Fine for Ireland. Added to Kitchen 1. ✓"

**Item is prohibited or should not be shipped**: Do not add to the box. State why and suggest the correct verdict.

> "Firearms can't be shipped internationally — this one needs to be sold or surrendered before you leave. Not added to any box."

**Unclear what the item is**: Ask one question, then proceed.

> "Is that the KitchenAid Artisan or the Pro series? Makes a difference for the wattage."

---

## Saving the record

A light assessment creates a **full `ItemAssessment` record** (for SHIP/CARRY items) or a **lightweight record** (for anything flagged as SELL/DISCARD). The verdict is inferred from context:

- User is assigning to a box → verdict is `SHIP` (or `CARRY` if explicitly stated)
- Item is flagged as prohibited → verdict is `SELL` or `DISCARD` as appropriate, item is NOT added to box
- Item has a flag but user proceeds → verdict is `SHIP` with the flag noted in `notes`

The `ItemAssessment` record is saved via MCP (`save_item_assessment`) with `notes` containing any flags raised. The box assignment is saved via `add_item_to_box`.

---

## Box assignment in and outside of chat

Box management is accessible from two entry points:

### In chat (conversational)
User tells Aisling directly. Aisling handles assessment (light if needed) and assignment in one response. Examples:
- "KitchenAid — Kitchen 1"
- "Putting the Le Creuset in the kitchen box"
- "What room should I put the Vitamix in?" (Aisling advises, then assigns on confirmation)

### Outside of chat (standalone Box UI)
User opens the Boxes panel, finds or creates a box, and types or speaks an item name. The same light assessment logic runs — the UI sends the item to Aisling's assessment endpoint, receives the result, and either confirms assignment or surfaces the flag in the UI before confirming.

A flag in the standalone UI is shown as an inline warning card before the item is added:

> ⚠️ **Voltage flag**: This item is 120V. It will need a transformer in Ireland. Add to box anyway?
> [Add anyway] [Don't add]

If the user taps "Add anyway", the item is added with the flag noted. If they tap "Don't add", no record is created.

---

## What a light assessment does NOT do

- Does not ask the user whether to sell, donate, or discard (the user has implicitly decided to ship it)
- Does not calculate detailed shipping cost estimates (can be added later if the item was assessed in full)
- Does not provide buying advice or destination cost comparisons
- Does not replace a full assessment — if the user later asks "should I have brought this?", Aisling can do a full retrospective assessment

---

## Approval gate

No spec is implemented until approved. See `.specs/` for all current specs awaiting approval.
