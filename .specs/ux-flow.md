# UX Flow Spec — Moving Fairy

> Owned by UXicorn. This document defines the complete user experience for the Moving Fairy app on thefairies.ie.
> All agents reference this spec when building UI components, writing copy, or making interaction decisions.

**Created**: 2026-03-08
**Last updated**: 2026-03-09

---

## 1. Entry / Landing

### How the user arrives

The user lands on moving.thefairies.ie (or a direct link shared by a friend, social post, or search result). There is no account creation required. The experience begins immediately.

### First impression

The landing screen is simple and warm. The page shows:

- The Moving Fairy wordmark / logo
- A brief tagline: **"Your fairy to help you with your move abroad."**
- A short paragraph from Aisling that sets the emotional tone:

> "Hi, I'm Aisling. I've helped hundreds of people figure out what to bring, what to sell, and what to leave behind when they move overseas. Let's sort through it together — I'll tell you exactly what I'd do."

- A single primary CTA button: **"Let's get started"**

### Emotional tone

Warm, grounded, slightly irreverent. Aisling is not a corporate assistant. She sounds like a sharp friend who has done this move and is saving you from making the mistakes she made. The landing page should feel like relief — "finally, someone who will just tell me what to do."

### What we are NOT doing

- No feature tours or product marketing blocks
- No sign-up wall before the form
- No animated fairy characters or whimsy that undermines credibility. Aisling is warm but practical.

---

## 2. Onboarding Form

### Design decision: Stepped form, not scrolling

The onboarding form uses a **stepped (wizard) pattern** with one question per screen. Here is the argument:

1. **Cognitive load**: Each question has conditional logic (onward move triggers sub-questions, transformer ownership triggers model/wattage). A single scrolling form would reveal and hide fields dynamically, creating visual instability — a violation of the stability principle and a source of layout shift.
2. **Mobile context**: The primary use case is someone on their phone while sorting belongings. A stepped form with large touch targets and minimal scrolling is dramatically better on small screens.
3. **Completion psychology**: A progress indicator on a stepped form gives users a sense of momentum. Each "Next" tap feels like progress. A scrolling form feels like a chore.
4. **Aisling's voice**: The stepped pattern lets Aisling introduce each question with a brief line of microcopy, making the form feel conversational rather than bureaucratic. This is core to the product's personality.

### Progress indicator

A minimal horizontal progress bar at the top of the form area, showing the user how far through the steps they are. It should be segmented (not continuous) so the user can see discrete steps. The segments fill as the user progresses: filled segments use the brand accent colour, unfilled segments use a muted neutral.

Do NOT use step numbers or labels in the progress bar itself — the questions are self-explanatory and numbering them makes it feel like a government form.

Below the progress bar, a small text indicator: "Step 2 of 4" — present but unobtrusive, for accessibility and orientation.

### Step 1: Departure country

**Aisling says**: "First things first — where are you moving from?"

**Field**: Dropdown / select, labelled "Country"
**Current options**: United States
**Design note**: Although only one option exists today, this must be a dropdown (not hardcoded text) so the architecture supports adding countries without a redesign. When only one option exists, it should be pre-selected but still editable.

**Validation**: Required. Cannot proceed without selection.
**Button**: "Next"

### Step 2: Arrival country

**Aisling says**: "And where are you headed?"

**Field**: Dropdown / select, labelled "Destination country"
**Options**: All currently supported countries, excluding the country already selected as departure. Users can select Ireland or Australia (or any future supported country) as their arrival destination. Pre-selected when only one option remains.
**Design note**: Same scalability principle as Step 1. As new country knowledge modules are added, they appear here automatically.

**Validation**: Required. Must differ from departure country.
**Button**: "Next"

### Step 3: Onward move

**Aisling says**: "Some people use {arrival_country} as a stepping stone. Are you planning to move somewhere else after?"

**Field**: Three-option selector (radio buttons or segmented control):
- "Yes, I have a plan"
- "Maybe — I'm thinking about it"
- "No, {arrival_country} is my final destination"

*`{arrival_country}` is populated dynamically from the user's onboarding selection.*

**Conditional fields (if "Yes" or "Maybe")**:

**Sub-question 1**: "Where are you thinking of moving next?"
- Dropdown, labelled "Onward country"
- Options: All currently supported countries, excluding the departure country and the arrival country already selected. Users can select any available supported country as their onward destination.
- Design note: Same scalability approach. As new country knowledge modules are added, they appear here automatically.

**Sub-question 2**: "When are you thinking about that move?"
- Four-option selector (radio buttons):
  - "Within 1-2 years"
  - "3-5 years from now"
  - "5+ years away"
  - "Not sure yet"

**Aisling's conditional microcopy**:
- If "Yes": "Good to know — that changes what's worth shipping. I'll factor both legs into my advice."
- If "Maybe": "No worries, I'll keep it in mind. Better to plan for it than get caught out."
- If "No": No additional copy needed.

**Validation**: The yes/no/maybe selection is required. If "Yes" or "Maybe", the onward country is required. The timeline is optional (defaults to "Not sure yet" if skipped).

**Button**: "Next"

### Step 4: Equipment (conditional — voltage change routes only)

**This step is only shown if the move involves a voltage change.** If the departure country and all destination countries share the same voltage standard (e.g. Ireland 230V and Australia 230V), this step is skipped entirely and the user moves straight to the confirmation screen.

**Aisling says**: "One more thing — do you own a voltage transformer?"

**Context copy** (smaller, secondary text): "If you have one, it changes what electrical items are worth bringing. If you don't, no worries — I'll advise accordingly."

**Field**: Two-option selector (radio buttons or toggle):
- "Yes, I have one"
- "No"

**Conditional fields (if "Yes")**:

**Sub-question 1**: "What model is it?" (optional)
- Text input, placeholder: "e.g. Dynastar DS-5500"
- Label: "Model (optional)"

**Sub-question 2**: "What's the wattage rating?" (optional)
- Number input, placeholder: "e.g. 5500"
- Label: "Wattage (optional)"
- Suffix label: "watts"

**Aisling's conditional microcopy**:
- If "Yes" + model provided: "Nice — that'll open up your options for kitchen appliances."
- If "No": "That's grand. I'll only recommend bringing things that'll work on local power."

**Validation**: Yes/No is required. Model and wattage are genuinely optional — no nudging or warnings if left blank.

**Button**: "Start chatting with Aisling" (final step — the CTA changes to signal the transition from form to conversation)

### Form completion

When the user taps the final button:

1. The form data is saved to the database.
2. A brief transition animation (a gentle fade, not a flashy effect) moves the user into the chat interface.
3. Aisling's opening message loads, referencing their answers (see Section 3).

### Back navigation

Every step (except Step 1) has a "Back" text link to the left of the "Next" button. Pressing Back preserves the user's previous answers — nothing is lost.

### Keyboard and screen reader behaviour

- Each step is focusable; the first interactive element receives focus on step entry.
- Progress bar has `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, and `aria-label="Onboarding progress"`.
- "Step X of Y" text serves as a live region announcement on step change.
- All conditional fields are revealed with `aria-expanded` on their trigger and are announced to screen readers.

---

## 3. Main Chat Interface

### Aisling's opening message

After onboarding, Aisling opens the conversation by reflecting back what she knows. This serves two purposes: it confirms the data was captured correctly, and it makes the user feel heard.

*Aisling constructs her opening message dynamically from the user's onboarding data. The following examples illustrate the tone and structure for the US to Ireland to Australia route — they are not hardcoded templates.*

**Example for a US -> Ireland -> Australia user**:

> "Right, here's what I've got. You're moving from the US to Ireland, and you're planning to head to Australia after that — probably in 3-5 years. You've got a Dynastar DS-5500 transformer, which gives us options.
>
> Here's how I work: tell me an item or a category, and I'll tell you whether to **sell it**, **ship it**, **carry it with you**, **donate it**, or **bin it** — and why. You can snap a photo of something or type the name — whatever's easiest. You can also give me a whole list.
>
> As we go, I'll keep a running tally of your shipping costs so you can see the full picture building up.
>
> What's first?"

**Example for a US -> Ireland only user (no transformer)**:

> "Grand — you're moving from the US to Ireland, no onward plans. And no transformer, so we'll keep things simple on the electrical side.
>
> Tell me what you're wondering about — snap a photo of an item, type the name, or give me a whole list. I'll tell you exactly what to do with each one.
>
> What should we start with?"

### Scope: What Aisling covers

Aisling handles **packing decisions**: what to pack, electrical compatibility, ship-versus-replace economics, import restrictions that affect whether an item can be shipped, and the running inventory with cost tracking.

She does NOT handle customs paperwork, declarations, or processes. If a user asks how to fill in a customs form, what their duty-free allowance is, or how to apply for TOR relief, Aisling redirects warmly to the future Customs feature.

If a user asks **whether** they can bring something (biosecurity, prohibited items, import restrictions) — Aisling answers that, because it affects the verdict.

If a user asks **how** to declare or process something at customs — Aisling redirects:

> "That's the paperwork side of customs — not my area, but we're building a separate customs guide that'll cover exactly that. Want to keep going with your packing list?"

This keeps the user moving forward rather than feeling stuck.

### How the user asks about items

The user interacts via a chat input at the bottom of the screen. They can:

1. **Photograph an item**: Tap the camera button, take or select a photo, and submit it for Aisling to assess.
2. **Name a single item**: "KitchenAid stand mixer" or "my Dyson vacuum"
3. **Name a category**: "kitchen appliances" or "power tools"
4. **Paste a list**: "Here's what's in my garage: lawn mower, leaf blower, Dewalt drill set, workbench, extension cords"
5. **Photo + text**: Submit a photo with additional typed context (e.g. a photo of a mixer with the note "it's the 600W professional model")

Aisling handles all five. For lists, she responds to each item in sequence within a single message, using a clear visual structure (see below).

### Image upload interaction design

This is a primary interaction pattern, not an edge case. Many users will be standing in a room with an item in front of them, phone in hand. The photo flow must be fast, forgiving, and feel as natural as texting a photo to a friend.

#### Initiating a photo assessment

The chat input bar has two elements side by side: a **camera button** (camera icon) to the left of the text input, and a **send button** to the right. The camera button is always visible — not buried in a menu or behind a "+" icon. It is a primary action.

Aisling also prompts for photos naturally in conversation. After her opening message, if the user hesitates, she may follow up:

> "Grab your phone and snap a photo of something — or just type the name. Whatever's easier."

#### Photo capture — mobile

On mobile, tapping the camera icon opens an **action sheet** with two options:

1. **"Take a photo"** — opens the device camera directly (rear-facing by default)
2. **"Choose from library"** — opens the native photo picker

After the user captures or selects a photo, it appears as a **thumbnail preview** in the input bar before sending. The thumbnail sits above the text input, inside the input area, and has a small **X button** to remove it before sending.

Multiple photos can be added per message — up to 3. Each appears as a thumbnail in a horizontal row above the text input. Each has its own X to remove individually. If the user attempts to add a fourth photo, the action sheet does not open and a brief inline message appears: "Up to 3 photos per message."

#### Photo capture — desktop

On desktop, the camera icon opens a **standard OS file dialog** (no camera access). Accepted formats: JPEG, PNG, HEIC, WebP.

The same thumbnail preview and remove behaviour applies: selected files appear as thumbnails above the text input, each with an X to remove. Up to 3 photos per message.

#### Photo + text combination

The user can attach photo(s) and ALSO type in the text input before hitting Send. This lets them add context: "It's the 600W professional model" or "This is about 15 years old" or "I bought this in Dublin, not the US."

The text input remains fully functional below the thumbnail(s) — the user can type freely. Pressing Send submits both the photo(s) and the text together.

If the user attaches photos but types nothing, that is valid — Send submits the photos alone.

#### Upload state

When the user taps Send with a photo attached:

1. The user's message appears in the chat immediately, showing the photo as an inline image (sized to fit the message bubble, max-width 280px on mobile, max-width 400px on desktop) with any accompanying text below it.
2. A small progress indicator appears on the image while uploading (a thin progress bar overlaid on the bottom edge of the image, or a subtle circular spinner in the corner). This is brief — most phone photos upload in under 2 seconds on a decent connection.
3. If the upload fails, the image shows an error overlay with a "Retry" button. The message stays in the chat — nothing disappears.

#### Aisling's response to a photo

When Aisling receives a photo, her response follows a specific pattern:

**Step 1 — Identification**: She identifies what she sees in the photo and states her confidence. This is the first line of her response, and it gives the user a chance to correct her before she commits to a verdict.

**When she is confident** (she recognises the item clearly):

> **Vitamix A3500 Blender** -- SHIP
>
> I can see that's a Vitamix A3500 — great machine. Your transformer can handle it (it draws about 1,400W under load). These cost around EUR 700 in Ireland, so it's absolutely worth shipping. Pack it in the original box if you have it, or wrap the base in a towel and put the jug in a separate box.
>
> *Saved to your packing list. Estimated shipping contribution: ~EUR 35.*

**When she is mostly confident but wants to confirm**:

> "That looks like a KitchenAid stand mixer — is that right? And do you know which model it is? That'll help me give you the right electrical advice."

She asks **one** clarifying question, not three. She keeps it moving. Once the user confirms, she gives the full verdict.

**When the image is unclear or unrecognisable**:

> "I can't quite make out what that is — the photo might be a bit dark or too close. Can you tell me what it is? Or try another photo from a bit further back."

She does not guess wildly. She does not apologise excessively. She just asks the user to help, and offers the text alternative naturally.

#### Accessible alternative

If image upload fails for any reason (unsupported browser, permission denied, network issues), the user can always type instead. Aisling never requires a photo. The text input is always available and fully functional. If the camera button is unavailable (e.g. on a browser that does not support the MediaDevices API), it is hidden rather than shown in a disabled state — no dead UI.

### Aisling's response format

Each item assessment response follows a consistent structure:

**Single item**:

> **KitchenAid Stand Mixer** -- SHIP
>
> Your DS-5500 can handle it (it draws about 325W). KitchenAids cost roughly twice as much in Ireland, and the motor quality is the same worldwide. Ship it in its original box if you still have it, or double-box it with plenty of padding. Remove the attachments and pack them separately.
>
> *Saved to your packing list. Estimated shipping contribution: ~EUR 25.*

**List item** (when user provides multiple items, each gets the same structure, separated by a horizontal rule or clear spacing):

> **Dyson V15 Vacuum** -- SELL
>
> The battery and motor are designed for 120V charging. Even with a transformer, the charging dock is finicky with converted power. Dysons are readily available in Ireland on 230V. Sell it — they hold value well on Facebook Marketplace or eBay.
>
> *Saved to your packing list.*

The verdict label (SELL / SHIP / CARRY / DONATE / DISCARD / DECIDE LATER) should be visually prominent — bold, possibly colour-coded (green for SHIP/CARRY, amber for SELL, grey for DONATE/DISCARD, blue for DECIDE LATER). This makes scanning long conversations efficient.

### Conversation input

- Standard single-line text input that expands to multi-line as the user types (auto-growing textarea pattern).
- Camera button to the left of the input, always visible on supported devices.
- Submit on Enter (desktop) or via a Send button (always visible on mobile).
- Shift+Enter for manual line breaks.
- Placeholder text in the empty input: "Snap a photo or type an item name..."
- The input is always visible at the bottom of the viewport (fixed position on mobile, not scrolled away).
- Photo thumbnail preview appears above the input when a photo is attached (see image upload section above).

### Conversation history and context

- Messages scroll naturally, newest at the bottom.
- Aisling maintains context across the full conversation. If the user asked about a KitchenAid earlier, and then asks "what about the attachments?", Aisling knows what they mean.
- Long conversations should remain fully scrollable — do not truncate or paginate chat history.
- A subtle "scroll to bottom" button appears if the user has scrolled up and new messages arrive below the fold.

---

## 4. Split-Screen Layout — Inventory + Chat

### Purpose

As Aisling assesses items, the user needs to see the full picture of their move alongside the conversation. The split-screen layout puts the inventory and the chat side by side, so the user always has context without switching views or expanding collapsed panels.

### Desktop layout (> 1024px)

The main interface after onboarding is a two-panel split:

- **Left panel** (~40% width): The **Inventory panel** — a persistent, scrollable view of everything assessed so far. This replaces the old collapsible cost bar.
- **Right panel** (~60% width): The **Chat panel** — Aisling's conversation interface, including the input bar.

The panels share the full viewport height below the header. The left panel has its own scroll context, independent of the chat scroll on the right.

### Left panel: Inventory

The inventory panel is the user's command centre for their move. It shows everything at a glance and supports inline editing without switching to the chat.

#### Running cost summary (top of panel)

A compact summary block anchored to the top of the inventory panel, always visible:

- **Total CBM**: e.g. "2.4 CBM"
- **Estimated freight cost**: e.g. "~EUR 1,250"
- **Item counts by verdict**: SHIP 18 | SELL 8 | DONATE 4 | DISCARD 3 | DECIDE LATER 2

The summary uses the same colour coding as verdict labels: green for SHIP, amber for SELL, warm grey for DONATE/DISCARD, soft blue for DECIDE LATER. CARRY items are counted with SHIP items in the summary.

A small disclaimer line below the cost figure: "Estimates based on typical item weights. Actual quotes may differ."

#### Update animation

When a new assessment is saved, the relevant counter in the summary updates:

1. The number briefly pulses (a subtle scale-up to 110% and back to 100%, over 300ms, with an ease-out curve).
2. If the shipping cost or CBM changes, the figure updates with a brief fade transition (old number fades out, new number fades in, 200ms).
3. No sound. No colour flash. No confetti. The update should feel like a scoreboard ticking over — satisfying but not distracting.
4. All animations respect `prefers-reduced-motion` — when reduced motion is preferred, numbers update instantly without animation.

#### Inventory list (below summary)

The full inventory, grouped by container:

**"Unassigned" group** (top of list): SHIP and CARRY items that have been assessed but not yet assigned to any box. These are the items waiting to be packed. Each item shows: thumbnail (if available), item name, verdict badge, inline edit controls.

**Container groups** (below unassigned):

Each box, checked luggage, and carry-on container appears as a card. Cards are ordered: containers in `packing` status first (most recently modified at top), then `packed`, then `shipped`, then `arrived`.

Each container card shows:
- **Label** as the card title (e.g. "Kitchen 1", "Carry-on", "Checked Luggage 1") — bold, prominent
- **Size badge** (for freight boxes only): XS / S / M / L
- **Status badge**: One of four states — Packing (muted), Packed (brand green), Shipped (blue), Arrived (green with checkmark)
- **Item count**: e.g. "4 items"
- **CBM** (for freight boxes and single items): e.g. "0.15 CBM"

Tapping a container card expands it inline to show the full contents list. Each item within an expanded card shows:
- Thumbnail image (if available)
- Item name
- Verdict badge (colour-coded)
- Inline edit controls (see below)

**"Large items — shipping individually" group**: Single items that do not go in a box (furniture, bikes, large appliances). Each shows: item name, thumbnail (if available), estimated CBM, estimated freight cost.

**"Not shipping" group** (bottom of list, collapsed by default): SELL, DONATE, and DISCARD items. These are grouped together and collapsed because the user does not need to manage them actively — they are decisions already made. The group header shows the total count. Tapping expands to show the full list, grouped by verdict.

#### Inline editing

Users can edit items directly in the inventory panel without needing to open a modal or switch to the chat. Inline editing supports:

- **Changing an item's verdict**: A dropdown or segmented control on each item row. Selecting a new verdict (e.g. SHIP to SELL) updates immediately. If the change has implications — for example, moving from SHIP to SELL means removing the item from its assigned box — a brief inline warning appears before applying: "Moving to Sell will remove this from Kitchen 1. Continue?" with "Yes" and "Cancel" options.
- **Moving an item to a different box**: A dropdown showing available containers (only those in `packing` status). Selecting a new container moves the item and updates both container counts.
- **Removing an item from a box**: An "Unassign" action (or drag-to-unassign in a future version) moves the item back to the Unassigned group.
- **Changing box/container status**: A status control on the container card header (e.g. a dropdown or segmented control) to move between packing / packed / shipped / arrived. The confirmation for "Mark as packed" is preserved (brief inline confirmation — see Section 11.4).
- **Editing item name**: Tapping the item name makes it editable inline (a text input replaces the label). Enter confirms, Escape cancels.

All inline edits are sent to Aisling's context and confirmed. Aisling does not re-respond in the chat for every inline edit — instead, the inventory panel updates immediately, and a brief system note appears in the chat log: "*You updated KitchenAid Stand Mixer to SELL.*" This keeps the chat history accurate without interrupting the conversation flow.

#### Empty state

Before any items have been assessed, the inventory panel shows:

> "No items assessed yet. Start a conversation with Aisling — snap a photo of something or type an item name."

The empty state has a warm illustration or icon (not a blank void) and a subtle arrow pointing toward the chat panel.

### Right panel: Chat

The chat panel contains Aisling's conversation interface, identical in function to the chat described in Section 3. The input bar, message history, scroll behaviour, typing indicator, and all interaction patterns remain the same.

On desktop, the chat panel has a max-width governed by its ~60% allocation. Messages have comfortable horizontal padding. Photos display at max-width 400px.

### Mobile layout (< 768px)

On mobile, the split screen collapses to a **tab/toggle pattern**:

- A **bottom tab bar** with two tabs: **"Chat"** (default on first load) and **"Inventory"**
- The tabs slide between the two panels with a horizontal swipe gesture or a direct tap on the tab
- The chat input bar sits above the tab bar when the Chat tab is active, so it remains in the thumb zone
- When the Inventory tab is active, the input bar is hidden — the user is reviewing, not chatting

**Compact cost strip** (always visible): A thin, non-interactive strip at the very top of both views showing two numbers: total CBM and estimated freight cost (e.g. "2.4 CBM | ~EUR 1,250"). This strip is NOT interactive, does NOT expand, and does NOT show verdict breakdowns. Its purpose is orientation — the user always knows the headline numbers regardless of which tab they are viewing. Full detail is in the Inventory tab.

The Inventory tab on mobile shows the same content as the desktop left panel: running cost summary at top, followed by the full inventory list. All inline editing controls work the same way, with touch-optimised targets (minimum 44px height per row, minimum 48px for action buttons).

### Tablet layout (768px - 1024px)

On tablet in landscape orientation, the split-screen layout is used (same as desktop, with proportions adjusted to the narrower width). In portrait orientation, the mobile tab pattern is used — the viewport is too narrow for a comfortable split.

### Accessibility

- The inventory panel has `role="complementary"` and `aria-label="Inventory panel"`. The chat panel has `role="main"`.
- On mobile, the tab bar uses `role="tablist"` with `role="tab"` on each tab and `role="tabpanel"` on each panel. Tab state is communicated via `aria-selected`.
- The compact cost strip has `role="status"` so screen readers announce updates.
- When the inventory updates (new item assessed, verdict changed), a visually hidden live region announces the change: "KitchenAid Stand Mixer added to Ship. Ship total: 13 items, approximately 875 euros, 2.4 CBM."
- Inline edit controls are keyboard-accessible: Tab navigates between items, Enter opens the verdict dropdown, arrow keys navigate within dropdowns, Escape cancels.
- Focus management on mobile tab switch: when switching tabs, focus moves to the first focusable element in the newly visible panel.
- All touch targets meet the 44x44px minimum (WCAG 2.2 AA, target size criterion).

---

## 5. Assessment Saving and Editing

### How assessments are saved

Each item Aisling assesses is saved to the database via MCP. The saving behaviour depends on the verdict:

**Confirmed verdicts (SHIP, SELL, DONATE, CARRY, DISCARD)**: Auto-saved immediately when Aisling delivers the verdict. The user sees inline confirmation in Aisling's response:

> *Saved to your packing list. Estimated shipping contribution: ~EUR 25.*

This confirmation is part of the response text, not a separate toast or banner — it flows naturally in the conversation. The italicised "Saved to your packing list" line at the end of each assessment serves as both confirmation and reassurance.

**DECIDE LATER verdicts**: Not auto-saved as a final decision. Aisling explicitly flags the uncertainty and asks:

> "I'm not confident enough to give you a firm verdict on that one — it depends on the motor voltage, and I'd need the model number to be sure. I've marked it as **DECIDE LATER** on your list. Want to come back to it, or shall we move on?"

DECIDE LATER items are saved to the database but flagged as tentative. They appear in the inventory panel under the "Decide Later" group (in the "By verdict" tab) with a visual distinction (lighter background, blue accent, no cost estimate).

### Visual feedback for saves

- **Auto-saved assessment**: The italicised line "*Saved to your packing list*" at the end of Aisling's response. No toast, no animation, no modal. It is part of the natural conversation flow.
- **DECIDE LATER**: The same italicised line but reading "*Added to your Decide Later list*" — the different wording signals that this is not a final verdict.
- **Assessment updated** (when user changes a verdict): A brief inline confirmation in Aisling's response (see editing section below).

### How users edit saved assessments

The user asks Aisling to change a verdict in natural language within the chat. Examples:

- "Change the KitchenAid to Sell"
- "Actually, I want to ship the Dyson too"
- "Move the standing desk from Decide Later to Ship"

Aisling responds with a confirmation that mirrors the original assessment format:

> **KitchenAid Stand Mixer** -- SELL *(was: SHIP)*
>
> Got it — I've moved your KitchenAid to Sell. That brings your estimated shipping cost down to ~EUR 825.
>
> *Updated on your packing list.*

The inventory panel and running cost summary update immediately to reflect the change.

The user can also edit from the expanded calculator view in a future version (tapping an item could offer "Change verdict"), but for v1, all edits go through the chat conversation with Aisling.

### Re-evaluation after move plan changes

If the user edits their move details (e.g. adds an onward country, changes timeline), Aisling proactively offers to re-evaluate:

*Example (US to Ireland route, user adds Australia as onward destination):*

> "Got it — you're now planning to head to Australia within 1-2 years. That might change some of my earlier advice. Want me to go back through your packing list and flag anything I'd reconsider?"

If the user says yes, Aisling reviews saved assessments and flags items where the new context changes the recommendation. She does not re-assess every item unprompted — she highlights only the ones where the verdict would genuinely change.

### Proactive follow-up on DECIDE LATER items

Aisling tracks items marked as DECIDE LATER. If the user has assessed several items and has pending DECIDE LATER items, Aisling may gently prompt:

> "By the way, you've still got 3 items on your Decide Later list — the standing desk, the air fryer, and the record player. Want to revisit any of them?"

This happens naturally in conversation, not as an intrusive notification. Aisling brings it up during a natural lull, not mid-assessment.

---

## 6. Profile Edit

### When and how

The user's move details (departure, destination, onward plans, transformer) should be editable mid-conversation. This is accessed via:

- A small "Edit move details" link or icon in the chat header area, next to a summary of the route (e.g. "US -> Ireland -> Australia").

### What happens when they edit

Tapping "Edit move details" opens a **right panel** (per Section 9a) containing the same form fields from onboarding, pre-filled with current values. The user changes what they need and taps "Save changes."

On save:

1. The updated data is persisted to the database.
2. Aisling posts a system-style message in the chat acknowledging the change:

*Example (US to Ireland route):*

> "Got it — I've updated your details. You're now planning the onward move to Australia within 1-2 years instead of 3-5. That might change some of my earlier advice — want me to review your packing list?"

3. Previous advice in the conversation history is NOT retroactively changed — Aisling's new responses will reflect the updated context, and she proactively offers to re-evaluate affected items (see Section 5).

### What they cannot edit

The departure and destination countries are not editable after onboarding in v1. Changing your entire move route is a fundamentally different session. If users need this, they start a new session. (This constraint should be revisited as the product matures.)

---

## 7. Key States

### Loading state (Aisling is thinking — text query)

When the user sends a text message and Aisling is generating a response:

- A typing indicator appears in the chat, styled as Aisling's avatar with an animated ellipsis ("...") or a subtle pulsing dot pattern.
- The indicator should appear within 200ms of the user sending a message — immediate feedback is critical.
- The user's sent message remains visible above the indicator.
- The input field is NOT disabled during loading — the user can type their next question, which will queue.

### Loading state (Aisling is thinking — photo assessment)

When the user submits a photo, the loading state has two phases:

**Phase 1 — Uploading**: The photo appears in the chat with a thin progress bar along its bottom edge. This phase is typically under 2 seconds. The text below (if any) appears immediately. Aisling's thinking indicator does NOT appear yet — we show upload progress first.

**Phase 2 — Aisling assessing**: Once the upload completes, Aisling's thinking indicator appears. For photo assessments, the indicator includes a brief contextual label: "Aisling is looking at your photo..." (instead of just the dots). This sets expectations — photo assessment may take slightly longer than a text query because Aisling is analysing the image.

The two phases are sequential and seamless. The user should perceive a smooth flow: photo appears -> uploads -> Aisling looks at it -> response arrives.

### Empty state (no messages yet — post-onboarding)

This should never truly occur because Aisling's opening message loads automatically after onboarding. However, if the chat loads without Aisling's opener (error, slow connection), the empty state should show:

- Aisling's avatar
- Text: "Aisling is getting ready... give her a moment."
- A subtle loading animation.

If loading fails entirely, transition to the error state.

### Error state (AI unavailable)

If Aisling cannot respond (API failure, timeout, rate limit):

- The typing indicator is replaced with a system message in the chat:

> "Aisling is having a moment — something went wrong on our end. Your conversation is saved. Try sending your message again, or refresh the page if the problem continues."

- A "Retry" button appears inline below the error message.
- The user's unsent message remains in the input field, so they do not have to retype.
- If a photo was attached, it remains attached — the user does not have to re-select it.
- If errors persist (3+ consecutive failures), show a more direct message:

> "Something's not right, and it's not you. We're looking into it. You can try again later — your move details and packing list are saved."

### Error state (image upload failed)

If the photo fails to upload (network issue, file too large, unsupported format):

- The photo in the chat shows a muted overlay with a brief error message and a "Retry" button:

> "Upload failed — tap to try again, or describe the item instead."

- The user's typed text (if any) is preserved in the input field.
- The camera button remains functional for another attempt.
- If the file is too large (over the size limit), the error is specific: "That photo is too large. Try taking a new one, or describe the item instead."

### Assessment saved state

When an assessment is successfully saved, the confirmation appears as the italicised line at the end of Aisling's response (see Section 5). No separate toast, banner, or modal.

### Assessment updated state

When the user changes a verdict, Aisling's response includes the update confirmation inline:

> **KitchenAid Stand Mixer** -- SELL *(was: SHIP)*
>
> *Updated on your packing list.*

The inventory panel updates simultaneously, with the subtle number animation described in Section 4.

### Success state (item advice delivered)

No special success state is needed beyond Aisling's response appearing in the chat. The response format itself (with the prominent verdict label and the "Saved" confirmation) serves as both answer and acknowledgement. Aisling's tone naturally conveys confidence — that IS the success signal.

### Customs redirect state

When a user asks about customs **paperwork or process** — duty-free allowances, customs forms, destination-specific registration and approval processes (e.g., in Ireland: TOR relief, VRT registration, HPRA approvals — equivalents vary by destination country) — Aisling redirects:

> "That's the paperwork side of customs — not my area, but we're building a separate customs guide that'll cover exactly that. Want to keep going with your packing list?"

When a user asks whether they **can ship** something (biosecurity, prohibited items, import restrictions) — Aisling answers in full, because it directly affects the verdict.

The response is warm and keeps the user moving forward. No dead-end feeling.

---

## 8. Overall Flow Sequence

The complete user journey, end to end:

1. **Landing** — User arrives, reads Aisling's intro, taps "Let's get started."
2. **Onboarding form** — Four stepped questions: departure country, destination country, onward plans, transformer. Takes about 30 seconds.
3. **Chat opens** — Aisling confirms move details, explains how she works, invites the user to start assessing items via photo or text.
4. **Item assessment** — User assesses items one at a time, in lists, or by photographing them. Aisling gives a verdict for each. Assessments are saved automatically (or flagged as DECIDE LATER).
5. **Inventory updates** — The inventory panel (left side on desktop, Inventory tab on mobile) updates after each saved assessment. The user sees their move's full picture building in real time — items, boxes, CBM, and cost.
6. **Review and edit** — User can browse the inventory panel to see all assessed items, edit verdicts inline, manage boxes, or ask Aisling to change anything via the chat.
7. **Ongoing use** — User returns over days or weeks, adding items as they sort through their home. The inventory and chat history persist across sessions.

---

## 8a. Returning Users — Packing in Multiple Sessions

Users will return to Moving Fairy repeatedly over the course of their packing, which may span days or weeks. This is not an edge case — it is the primary usage pattern. The UX must support this gracefully, making each return feel like picking up exactly where they left off.

### On return

When a returning user opens the app, Aisling greets them with a brief, contextual summary of where things stand:

> "Welcome back. You've got 34 items assessed — 18 to ship (2.4 CBM, ~EUR 1,250), 8 to sell, and 8 still to sort. You've packed 3 boxes. Where do you want to pick up?"

This summary is generated from the assessed item list, not by re-reading the entire chat history. It gives the user instant orientation without requiring them to scroll through previous conversations.

### Inventory panel as the anchor

The inventory panel shows the full picture immediately on return — every assessed item, every box, every verdict, the running cost total. The user does not need to re-establish context by scrolling the chat. The inventory panel IS the context.

### Aisling's memory model

Aisling does not re-read the entire chat history on each return. She loads the **assessed item list** (from the database) and uses that as her working context. This means:

- She knows every item that has been assessed and its current verdict
- She knows every box and its contents
- She knows the user's move route and equipment details
- If the user references a previous conversation ("remember that KitchenAid you said to ship?"), Aisling finds it in the assessment list and responds from there — she does not need to find the specific chat message

### Session continuity signals

The UI provides subtle signals that the user's data is intact:

- The inventory panel is populated immediately (no loading spinner for previously assessed items)
- The compact cost strip shows current totals from the first render
- The chat shows the most recent messages (the user can scroll up for full history)
- Aisling's welcome-back message confirms the numbers, reinforcing that nothing was lost

---

## 9. Accessibility

### Minimum requirements (WCAG 2.2 AA)

**Colour and contrast**:
- All text meets 4.5:1 contrast ratio against its background (3:1 for large text).
- The verdict labels (SELL, SHIP, etc.) must not rely on colour alone — the text label itself carries the meaning. Colour is reinforcement, not the signal.
- Inventory panel summary colours maintain contrast ratios against both the panel background and any text within.

**Keyboard navigation**:
- The entire app is fully operable via keyboard.
- Tab order follows visual order: form fields, buttons, inventory panel items, chat messages, input.
- The chat input receives focus after Aisling's response loads.
- The "scroll to bottom" button is focusable and activated with Enter or Space.
- Panels and modals trap focus appropriately and return focus to the trigger on close.
- The camera button is focusable and activates the file picker (or action sheet on mobile) on Enter or Space.
- Inventory panel items are focusable, with inline edit controls reachable via Tab and operable via Enter/Space/Arrow keys.

**Screen readers**:
- Chat messages use a live region (`aria-live="polite"`) so new messages are announced without interrupting the user.
- Aisling's messages and the user's messages are distinguished via `aria-label` (e.g. "Aisling said:" vs "You said:").
- The verdict label is part of the text content, not just visual styling — screen readers will read "KitchenAid Stand Mixer — SHIP" naturally.
- Photo messages include `alt` text: "Photo submitted by you" (or Aisling's identification of the item once she responds, updated via `aria-label` on the image).
- Form validation errors are associated with their fields via `aria-describedby` and announced on focus.
- Inventory panel updates are announced via a visually hidden live region (see Section 4).
- The "Aisling is looking at your photo..." state is announced to screen readers.

**Motion**:
- All transitions and animations respect `prefers-reduced-motion`. When reduced motion is preferred, transitions are instant (no fade, no slide, no pulse on calculator updates).

**Touch targets**:
- All interactive elements are minimum 44x44px (per WCAG 2.5.8 / iOS HIG).
- The camera button meets this minimum and is spaced far enough from the text input to avoid accidental taps.

---

## 9a. Panel vs Modal Principle

Right-hand slide-in panels are the **default pattern** for contextual detail, editing, and secondary actions throughout Moving Fairy. Panels allow the user to maintain spatial context — they can still see the rest of the interface behind the panel. This is especially important in a split-screen layout where the user may be referencing the inventory while editing an item.

### Use a right panel for:

- **Profile editing** — editing move details (departure, destination, onward plans, transformer)
- **Box detail view** — viewing and editing box contents, item assignments within a box
- **Item detail view** — full assessment history, editing verdict, viewing Aisling's reasoning
- **Settings** — any app-level configuration
- **Any action that involves reading or editing something in context** — the user should be able to glance at the inventory or chat behind the panel

### Use a modal (blocking overlay) ONLY for:

- **Destructive confirmation** — e.g. "Delete this assessment?" or "Mark all as shipped?" — the user must respond before anything else happens
- **Session-critical interruptions** — e.g. "No API key found — you need to add one to continue"
- **Nothing else** — if you are considering a modal for any other purpose, use a panel instead

### Panel behaviour

- Panels animate in from the right edge using Framer Motion (300ms ease-out)
- On desktop, panels sit above the inventory panel (left side) but do not cover the chat panel. The panel width is approximately 400-480px, overlaying the left portion of the viewport.
- On mobile, panels slide in from the right and cover the full screen (like a page push). A back arrow or X in the top-left dismisses.
- Panels are dismissible with: **Escape** key, **clicking/tapping outside** the panel (desktop only), or the **X button** in the panel header
- **Focus is trapped** within the open panel while it is visible (WCAG 2.2 requirement). When the panel closes, focus returns to the element that triggered it.
- Only one panel can be open at a time. Opening a second panel replaces the first (with a brief cross-fade, not a stack).

---

## 10. Responsive Design

### Why mobile matters most

Users will often be using Moving Fairy on their phone while physically standing in a room, looking at the item they are asking about. The photo upload flow was designed for exactly this context. The experience must work flawlessly here: one-handed use, glanceable answers, easy photo capture, minimal typing friction.

### Mobile layout (< 768px)

**Onboarding form**:
- Full-width form fields.
- Large touch targets for radio buttons and dropdowns (minimum 48px height).
- The "Next" / "Back" buttons span the full width, positioned at the bottom of the viewport (thumb-reachable zone).
- Progress bar remains at the top, compact but visible.

**Main interface (Chat + Inventory tabs)**:
- Bottom tab bar with "Chat" and "Inventory" tabs (see Section 4 for full mobile layout spec).
- Compact cost strip at the very top of both views: total CBM + estimated cost.
- Chat messages use the full viewport width with comfortable horizontal padding (16px).
- The input area is fixed above the bottom tab bar. The camera button sits to the left of the text input, the send button to the right. All three elements are within the thumb zone.
- When photo thumbnails are attached, they appear above the text input within the input area, taking up minimal vertical space (48px tall thumbnails with X to remove each).
- The input field adjusts when the software keyboard opens (the input must remain visible above the keyboard, not pushed off-screen).
- Aisling's messages and user messages are visually distinct but both use the full width (no chat-bubble narrowing that wastes horizontal space on small screens).
- Photos submitted by the user display at max-width 280px inline in the chat.
- The verdict label is large and tappable-looking, even though it is not interactive — visual prominence aids scanning.
- The "Edit move details" link is accessible from a header area but does not consume significant vertical space.

**Profile edit panel**:
- On mobile, profile edit opens as a right panel that covers the full screen (slide-in from right, per Section 9a). A back arrow dismisses.

### Tablet layout (768px - 1024px)

- In **landscape**: split-screen layout (inventory left, chat right), proportions adjusted to the narrower width.
- In **portrait**: mobile tab pattern (Chat / Inventory tabs) — viewport too narrow for a comfortable split.
- Onboarding form centres in the viewport with a max-width of ~640px.

### Desktop layout (> 1024px)

- Split-screen layout: inventory panel (~40% width) on the left, chat panel (~60% width) on the right (see Section 4 for full desktop layout spec).
- Photos submitted by the user display at max-width 400px in the chat panel.
- Generous vertical spacing between messages for readability.
- Input field may remain at the bottom of the chat panel rather than fixed to the viewport, since desktop users are less likely to lose it.
- The camera button remains visible but is less prominent than on mobile (photo upload is primarily a mobile behaviour, though desktop users may upload via the OS file dialog).
- Profile edit opens as a right panel (per Section 9a), overlaying the left portion of the viewport.
- Right panels (per Section 9a) appear as overlays without the height constraint of mobile.

### Orientation

- The app should handle orientation changes gracefully, particularly the transition between portrait and landscape on tablets.
- The chat input must reposition correctly after an orientation change — this is a known source of bugs on iOS Safari and must be tested.
- The compact cost strip reflows its content to fit landscape widths without wrapping awkwardly.

---

## 11. Box Management

### Overview

Users can organise their SHIP and CARRY items into labelled physical boxes. Each box is labelled `[Room name] [N]`, where the room name is free text (displayed in title case) and N is a sequential number assigned automatically by the app (e.g. Kitchen 1, Kitchen 2, Bedroom 1, Living Room 1). The user never types the number.

Box management exists in two layers:
1. **Conversationally via Aisling** — the primary interaction, designed for the user who is physically packing with their phone in one hand.
2. **Via the inventory panel** — the "By container" view in the inventory panel (Section 4) for reviewing, browsing, and managing boxes visually.

Only SHIP and CARRY items go into boxes. SELL, DONATE, and DISCARD items are irrelevant to box management — they do not appear in box-related flows or views.

---

### 11.1 Creating a box

#### Via Aisling (conversational) — primary

The user can create a box at any point in the conversation. Aisling recognises a range of natural triggers:

- "Start a kitchen box"
- "I'm packing the kitchen now"
- "New box — bedroom"
- At assessment time: "SHIP — and put it in a kitchen box"

When Aisling creates a box, she confirms with the label she has assigned:

> "Done — I've started **Kitchen 1** for you. Add things to it by telling me, or I can assign items as we go."

**Automatic numbering**: If the user already has a Kitchen 1 and asks for another kitchen box, Aisling creates Kitchen 2 automatically. She never asks "are you sure you want a second kitchen box?" — she just creates it and confirms:

> "**Kitchen 2** is ready. You've got two kitchen boxes now."

This confidence is important. The user is mid-packing, probably on the floor surrounded by newspaper and bubble wrap. Unnecessary confirmation questions break their flow.

#### Via UI (secondary)

A **"New box"** button is accessible from the inventory panel (see 11.4). Tapping it opens a **right panel** (per Section 9a):

**Panel design**:
- Header: "New box"
- Single text input, labelled: "What room is this box for?"
- Placeholder text: "e.g. Kitchen, Bedroom, Garage"
- Size selector: segmented control with XS / S / M / L options (see 11.2b). Default: M.
- A primary button: **"Create box"**
- A "Cancel" text link below the button

On submit, the app assigns the next sequential number for that room name and closes the panel. The new box card appears immediately in the inventory panel.

**Validation**: The room name is required. If the user submits an empty field, the input shows inline validation: "Enter a room name to create a box." No toast, no alert.

**Keyboard and accessibility**: The text input receives focus when the panel opens. Enter submits the form. Escape closes the panel. Focus traps within the panel and returns to the "New box" button on close. The panel has `role="dialog"` and `aria-label="Create a new box"`.

---

### 11.2 Assigning items to boxes

#### During assessment

After Aisling gives a SHIP or CARRY verdict, she may ask if the user wants to assign it to a box:

> "Ship it — want me to put it in a box now, or add it to the unboxed pile?"

This question is optional and contextual. Aisling asks it when the user appears to be in a packing session (they have boxes open, or they have recently created or referenced a box). She does not ask this on every single assessment — that would become tedious. If the user has no boxes yet, Aisling does not mention boxes during assessment.

If the user responds with a box name — "Kitchen 1" or "yes, Kitchen 1" — Aisling assigns the item and confirms:

> "Done — KitchenAid is in **Kitchen 1**. That box now has 3 items."

If the user responds with a room name but no number — "put it in a kitchen box" — and there is only one kitchen box, Aisling assigns it to that box. If there are multiple kitchen boxes, she asks:

> "You've got Kitchen 1 and Kitchen 2. Which one?"

#### After assessment

The user can assign previously assessed SHIP or CARRY items at any time:

> "Put the KitchenAid in Kitchen 1"
> "Move the Le Creuset to Kitchen 2"
> "Everything from the kitchen category goes in Kitchen 1"

Aisling confirms each assignment:

> "Done — KitchenAid is in **Kitchen 1**. That box now has 3 items."

For bulk assignments, Aisling confirms the batch:

> "Done — I've put 6 kitchen items into **Kitchen 1**. Want to see the full list?"

#### Constraints

An item can only be in one box at a time. If the user tries to assign an item that is already boxed, Aisling does not silently move it — she flags the conflict and asks:

> "The KitchenAid is already in Kitchen 1. Want me to move it to Kitchen 2 instead?"

If the user confirms, Aisling moves it and confirms:

> "Moved — KitchenAid is now in **Kitchen 2** (was Kitchen 1). Kitchen 2 has 4 items, Kitchen 1 has 2."

If the user tries to assign a SELL, DONATE, or DISCARD item to a box, Aisling redirects gently:

> "The Dyson is marked as Sell, so it won't be in your shipment. Want to change it to Ship first?"

---

### 11.2a Special containers: Checked Luggage and Carry-on

Not everything goes in a freight box. The inventory panel includes two special container types that represent items travelling with the user.

#### Carry-on

One per user. Always visible in the inventory panel. Holds items that must travel in hand luggage: lithium batteries (phones, laptops, power banks), valuables, irreplaceable documents.

- **Label**: "Carry-on" (no number — there is only ever one)
- **No size or CBM**: carry-on items do not contribute to the shipping volume or freight cost
- Items with a CARRY verdict default to the Carry-on container unless the user specifies otherwise
- **Lithium battery rule**: Aisling always flags lithium-battery items (phones, laptops, power banks, tablets, e-readers, battery-powered tools) as Carry-on. These items cannot be assigned to a freight box — if the user tries, Aisling explains: "Lithium batteries have to go in your hand luggage — airlines and shipping companies both require it. I've put it in your Carry-on."

#### Checked Luggage

Multiple per user, numbered sequentially: Checked Luggage 1, Checked Luggage 2, etc. Holds items the user plans to pack in suitcases rather than ship via freight.

- Aisling creates these when the user says something like "that goes in my checked bag" or "I'll pack that in my suitcase"
- Items assigned to Checked Luggage also have a CARRY verdict
- **No CBM**: checked luggage items do not contribute to the shipping volume or freight cost
- The user can create additional checked luggage containers via the "New box" flow (selecting "Checked Luggage" as the container type) or by telling Aisling

#### Inventory panel placement

Carry-on and Checked Luggage containers appear at the top of the inventory panel, above the freight boxes, in a **"Travelling with me"** section. This section is always visible (not collapsible) and visually distinct from the freight containers below — a subtle divider and section header separate the two groups.

---

### 11.2b Box sizes

When creating a freight box, the user selects a size. Sizes represent standard moving box dimensions and determine the CBM contribution:

| Size | Label | Approximate CBM | Typical contents |
|------|-------|-----------------|-----------------|
| **XS** | Extra small | ~0.04 CBM | Books, documents, small electronics |
| **S** | Small | ~0.07 CBM | Kitchen items, clothes, small appliances |
| **M** | Medium | ~0.15 CBM | Large appliances, bedding, bulky items |
| **L** | Large | ~0.25 CBM | Furniture components, large artwork |

**In the UI**: Size is shown as a compact badge on each box card in the inventory panel (e.g. a small "M" pill badge next to the box label).

**Box creation flow**: When the user creates a box via the UI (the "New box" flow in 11.1), a size selector is added below the room name input. The selector uses a segmented control with the four size options (XS / S / M / L), each with the approximate CBM shown. Default selection: M (the most common size).

**Via Aisling**: Aisling can suggest a size based on what the user is packing: "That sounds like a medium box to me — want me to start one?" If the user does not specify a size, Aisling defaults to M and notes it: "I've started **Kitchen 1** as a medium box. You can change the size later if you need to."

#### Single items (no box)

Large items that do not go in a box — furniture, bikes, large appliances — are listed as **single items** in the inventory. They appear in their own section in the inventory panel: **"Large items — shipping individually."**

Aisling identifies single items during assessment. When a SHIP-verdict item is too large for a box, Aisling asks for dimensions:

> "That's too big for a box — I'll list it as a single shipping item. Can you give me rough dimensions? Something like '180cm by 90cm by 80cm' is perfect."

The user provides rough dimensions and Aisling estimates the CBM.

**In the inventory panel**, single items show: item name, thumbnail (if available), estimated CBM, estimated freight cost. They are not assignable to boxes — the "Add to box" action is not available for single items.

---

### 11.2c Marking everything as shipped

When the movers collect everything, the user can mark all containers as shipped in a single action.

**Trigger**: In the inventory panel, a **"Mark all as shipped"** button appears at the top of the container list when at least one box is in `packing` or `packed` status. The button uses a secondary style (not the primary brand colour) to avoid accidental taps — it is available but not screaming for attention.

**Confirmation**: Tapping the button shows a **modal** (this is a destructive, hard-to-undo action — per Section 9a, modals are appropriate here):

> "Mark all boxes and items as shipped? This includes N boxes and N single items."

With two buttons: **"Yes, mark all as shipped"** (primary) and **"Cancel"** (secondary).

**On confirm**: All standard freight boxes, checked luggage containers, carry-on, and single items move to `shipped` status. The inventory panel updates to show all items in a muted "Shipped" state (reduced opacity, grey status badges). The "Mark all as shipped" button disappears.

**Individual shipping**: Individual boxes can still be marked as shipped one at a time from the box's inline status control in the inventory panel. This is useful when shipping happens in stages (e.g. one shipment goes by sea, another by air, luggage goes with the user on a different date).

---

### 11.3 Handwritten list upload (box reconciliation)

This is the most novel interaction in box management. The user photographs the handwritten contents list on the physical box lid or side. This serves as both the physical label record and the basis for OCR reconciliation — there is no separate "box label photo" or "inventory photo." One photo of the handwritten list is all that is needed.

This is a common real-world packing behaviour — the app meets the user where they already are.

#### How it is triggered

Three entry points:

1. **From the Boxes view**: The user taps "Scan box list" on a box card that has been marked as Packed (see 11.4). This opens the camera and attaches the photo to a message pre-addressed to that box.
2. **From the chat**: The user taps the camera button, takes a photo, and adds context: "this is my Kitchen 1 box list."
3. **Proactively from Aisling**: When a box is marked as packed, Aisling offers: "Want to photograph your box label so I can check your list?"

#### What Aisling does

Aisling reads the handwritten text from the photo using multimodal OCR and performs a reconciliation against the box's digital contents. Her response follows a structured pattern that feels like a quick, efficient audit — not an interrogation.

**Step 1 — Acknowledgement**:

> "Let me check your Kitchen 1 list..."

**Step 2 — Matches** (items on both the physical and digital lists):

> "These match what I've got: ✓ KitchenAid, ✓ Le Creuset, ✓ pasta maker."

**Step 3 — On the physical list but not in the digital box**:

If the item has been assessed previously (it exists in the packing list but was not assigned to this box):

> "I can see 'Vitamix' on your list — I had that down as unboxed. I'll move it into Kitchen 1."

If the item has NOT been assessed at all:

> "I also see 'old spice rack' on your list — that's not one we've assessed. Want me to take a look at it now?"

Aisling does NOT auto-assign a verdict to unassessed items. She flags them and asks. This is a deliberate constraint — the user should make a conscious decision about items, not discover later that Aisling silently categorised something they cared about.

**Step 4 — In the digital box but not on the physical list**:

> "One thing — your digital list has the Vitamix in Kitchen 1, but I don't see it on your handwritten list. Is it in this box, or did you put it somewhere else?"

This phrasing is neutral and curious, not accusatory. The user might have forgotten to write it down, or they might have moved it to another box.

**Step 5 — Summary**:

> "Kitchen 1 looks good — 5 items confirmed, 1 new item to assess, 1 to track down. Not bad."

The tone is warm and efficient. Aisling is helping the user close the loop, not auditing them.

#### Unclear handwriting

When parts of the handwritten list are hard to read, Aisling is specific about what she could and could not decipher:

> "Parts of your list are a bit tricky to read — I got KitchenAid, Le Creuset, and something that might be 'pasta maker'? Can you confirm that last one?"

She does not apologise excessively or blame the user's handwriting. She states what she read, flags what is uncertain, and asks for help. If the entire list is illegible:

> "I'm having trouble reading this one — the light or angle might be making it hard. Could you try another photo, or just tell me what's in the box?"

She always offers the text alternative, matching the pattern established for unclear photo assessments in Section 3.

---

### 11.4 Boxes view in the inventory panel

The inventory panel (Section 4) displays items grouped by container by default — this is the primary organising principle. However, the inventory panel also supports a **"By verdict"** view as an alternative grouping. Two tabs at the top of the inventory list (below the running cost summary) let the user switch:

#### Tab design

Two tabs at the top of the inventory list area:

- **"By container"** (default) — items grouped by box, carry-on, checked luggage, and single items (the layout described in Section 4)
- **"By verdict"** — items grouped by verdict (Ship, Sell, Donate, Carry, Discard, Decide Later sections)

The tabs use a standard underlined-tab pattern. The active tab has the brand accent colour underline; the inactive tab is muted. Tapping a tab switches the grouping below without affecting the running cost summary at the top.

#### Box cards

Each box appears as a card in the Boxes tab. Cards are stacked vertically, most recently modified first.

**Card contents**:
- **Box label** as the card title (e.g. "Kitchen 1") — bold, prominent
- **Item count**: "4 items" — secondary text
- **Status badge**: One of four states:
  - **Packing** (default when created) — neutral badge, muted colour
  - **Packed** — solid badge, confident colour (brand green or similar)
  - **Shipped** — distinct badge (blue or similar)
  - **Arrived** — success badge (green with a checkmark, or similar)

**Card actions** (visible on each card without expanding):
- **"Mark as packed"** button — visible on Packing boxes only. Changes status to Packed.
- **"Scan box list"** button — visible on Packed boxes only. Opens the camera for handwritten list reconciliation.

Tapping a card expands it inline to show the full contents list.

#### Expanded box card

When a box card is tapped, it expands to show:

- The full list of items in the box (item names, displayed as a simple list)
- Each item is tappable — tapping scrolls the chat to the Aisling assessment for that item (same behaviour as items in the verdict-based expanded view)
- An **"Add to this box"** quick action: a compact text input that appears at the bottom of the expanded item list. The user types an item name, and the app assigns it to this box. The input has placeholder text: "Type an item name to add..."
- If the box is Packed, Shipped, or Arrived, the "Add to this box" input is hidden (the box is closed, contents should not change casually)

#### Status transitions

- **Packing to Packed**: User taps "Mark as packed." A brief confirmation appears: "Mark Kitchen 1 as packed? You can still edit it later." with **"Yes, packed"** and **"Not yet"** buttons. This confirmation exists because the user may be packing with one hand and could tap accidentally — and undoing a status change while holding a roll of tape is annoying.
- **Packed to Shipped**: The user can change box status via the inline status control on the box card (see Section 4, inline editing), via the "Mark all as shipped" bulk action (see 11.2c), or conversationally via Aisling ("Kitchen 1 is shipped").
- **Shipped to Arrived**: Same mechanisms — inline status control, conversational via Aisling, or a future integration with shipping providers.
- **Any status to Packing (revert)**: The user can ask Aisling: "Actually, I need to reopen Kitchen 1." Aisling reverts the status and confirms.

When a box is marked as Shipped, its contents become read-only in the inventory panel. Items cannot be added, removed, or reassigned. If the user needs to change something, they ask Aisling, who can override — but the UI does not invite casual edits to shipped boxes.

#### Unboxed items section

Below all box cards, a section titled **"Not yet boxed"** lists all SHIP and CARRY items that have not been assigned to any box. This gives the user a clear view of what still needs to be packed.

Each item in the unboxed list is tappable (scrolls to assessment in chat) and has a small **"Add to box"** action that opens a dropdown or bottom sheet listing available boxes (only those in Packing status).

The item count is shown in the section header: "Not yet boxed (12 items)".

If all SHIP and CARRY items are boxed, this section shows a brief success message:

> "Everything's boxed up. Nice work."

#### Empty state

If the user has no boxes at all, the Boxes tab shows:

> "No boxes yet. Start packing by telling Aisling which room you're tackling, or tap 'New box' below."

A **"New box"** button appears below this message, triggering the panel described in 11.1.

#### New box button (persistent)

A **"New box"** button is always visible at the bottom of the Boxes tab (below the unboxed items section, or below the empty state), so the user can create a box without switching to the chat.

---

### 11.5 Box label generation and display

The box label `[Room name] [N]` is generated by the app. The user provides the room name; the app assigns the next sequential number for that room.

**Room name handling**:
- Free text input. The user can type any room name.
- Displayed in title case throughout the UI (e.g. "living room" becomes "Living Room 1").
- Normalised for counting purposes: "kitchen", "Kitchen", and "KITCHEN" all count as the same room when determining the next number.
- Common misspellings or variations should be handled gracefully — but this is a backend concern, not a UX-blocking issue for v1.

**How the label is communicated**:
- When Aisling creates a box, she states the label clearly in bold: "**Kitchen 1** is ready."
- The Boxes view always shows the full label as the box card title.
- In the compact cost strip (mobile) and running cost summary (desktop), box counts are not shown — the summary focuses on verdicts, CBM, and shipping cost. Box detail is visible in the full inventory list below.

**Future feature note**: Printable or shareable box labels (a small card the user can print and tape to the physical box, showing the label and a QR code linking to the digital contents list) are out of scope for v1. This is noted here for future consideration — it would close the loop between the digital and physical box beautifully.

---

### 11.6 States for box management

These states follow the established patterns from Section 7, using inline chat confirmation rather than toasts, banners, or modals.

#### Box created

Aisling's in-chat confirmation, same inline pattern as assessment saves:

> "Done — I've started **Kitchen 1** for you. Add things to it by telling me, or I can assign items as we go."
>
> *Box saved to your packing list.*

#### Item assigned to box

Brief confirmation with updated count:

> "Done — KitchenAid is in **Kitchen 1**. That box now has 3 items."
>
> *Updated on your packing list.*

#### Item moved between boxes

Confirmation showing origin and destination:

> "Moved — KitchenAid is now in **Kitchen 2** (was Kitchen 1). Kitchen 2 has 4 items, Kitchen 1 has 2."
>
> *Updated on your packing list.*

#### Handwritten list scan — success

Aisling's reconciliation response (see full pattern in 11.3):

> "Let me check your Kitchen 1 list..."
>
> "These match what I've got: ✓ KitchenAid, ✓ Le Creuset, ✓ pasta maker."
>
> "Kitchen 1 looks good — 5 items confirmed. Nice."

#### Handwritten list scan — unclear handwriting

Aisling asks for clarification on specific items:

> "Parts of your list are a bit tricky to read — I got KitchenAid, Le Creuset, and something that might be 'pasta maker'? Can you confirm that last one?"

#### Box marked as packed

In the Boxes view: the status badge changes from "Packing" to "Packed". The "Mark as packed" button is replaced by the "Scan box list" button.

In chat (if triggered conversationally): Aisling confirms:

> "**Kitchen 1** is packed — 6 items sealed up. Want to photograph your box label so I can check the list?"

#### Box marked as shipped

In the Boxes view: the status badge changes to "Shipped". The box contents become read-only. The card visually de-emphasises slightly (reduced opacity or muted background) to signal that this box is done — the user's attention should be on what is still in progress.

In chat: Aisling confirms:

> "**Kitchen 1** is on its way. I've locked the contents list — if you need to change anything, just ask me."

---

### 11.7 Mobile considerations

Box management will often happen while the user is physically packing — phone in one hand, packing tape in the other. This is the most physically constrained context in the entire app. Every interaction must respect this reality.

**Priorities**:

- **Single-tap box creation** from the Boxes view: The "New box" button must be large (full-width, minimum 48px height), positioned within the thumb zone, and should not require scrolling to reach.
- **Single-tap "Mark as packed"**: The confirmation dialog (11.4) is essential here — accidental taps are likely when hands are full. The confirmation uses large buttons with generous spacing.
- **Camera access for handwritten list scan**: One tap from the Boxes view via the "Scan box list" button on Packed boxes. This must not require the user to navigate to the chat, type a message, and then attach a photo. The direct path from Boxes view to camera is critical.
- **Box contents list**: Scrollable on small screens. Items in the list must have large enough touch targets (minimum 44px height per item row) to be tappable with an imprecise, one-handed tap.
- **"Add to this box" input**: The text input in the expanded box card must behave well with the software keyboard. When the keyboard opens, the input must remain visible — not pushed off-screen or hidden behind the keyboard.

**Layout on mobile (< 768px)**:

- Box cards in the Boxes tab use the full viewport width with 16px horizontal padding (matching the chat message padding).
- The expanded box card shows items in a single-column list, each row tall enough for comfortable tapping.
- The "New box" panel is a full-screen slide-in from the right on mobile (per Section 9a).
- The "Not yet boxed" section scrolls independently if the list is long, with a clear visual separator from the box cards above.

---

### 11.8 Accessibility for box management

Following the standards established in Section 9:

**Keyboard navigation**:
- Box cards in the Boxes tab are focusable and expand on Enter or Space.
- The "Mark as packed" and "Scan box list" buttons are focusable with visible focus indicators.
- Items within an expanded box card are focusable links (for the scroll-to-assessment behaviour).
- The "New box" panel traps focus and returns focus to the trigger on close.
- Tab order within the Boxes tab: box cards (in order), then the "Not yet boxed" section, then the "New box" button.

**Screen readers**:
- Box cards have `aria-label` including the full label, item count, and status (e.g. "Kitchen 1, 4 items, status: Packing").
- The "Mark as packed" confirmation dialog is announced as a dialog with its question text.
- Status badge changes are announced via a visually hidden live region: "Kitchen 1 status changed to Packed."
- The reconciliation response in chat uses the standard chat live region (`aria-live="polite"`) — no special treatment needed beyond what Section 9 already requires.
- The "Not yet boxed" section heading includes the item count for screen readers: "Not yet boxed, 12 items."

**Touch targets**:
- All box card action buttons meet the 44x44px minimum.
- Items in the expanded contents list meet the 44px minimum height.
- The "New box" button meets the 48px height on mobile.

---

## Appendix: Copy Voice Guide

Aisling's voice throughout the app follows these principles:

| Do | Don't |
|---|---|
| Use plain, direct language | Use jargon ("SKU", "wattage rating exceeds...") |
| Be decisive: "Sell it." | Be wishy-washy: "You might want to consider..." |
| Use contractions: "that's", "you've", "I'd" | Sound formal: "that is", "you have", "I would" |
| Be specific: "They cost about EUR 450 in Ireland" | Be vague: "They're more expensive there" |
| Show personality: "Honestly, bin it." | Be robotic: "Recommendation: discard." |
| Acknowledge uncertainty when it's real: "I'm not sure on that one — let me mark it as Decide Later" | Fake confidence on things you're unsure about |
| Use Irish English where natural: "Grand", "No bother" | Force Irishisms into every sentence |
| Redirect customs questions warmly and move on | Attempt to answer customs or import questions |
| Encourage photo uploads naturally: "Snap a photo" | Make photos feel required or technical |

### Box management voice patterns

Aisling's voice shifts subtly during box management interactions. The user is physically packing — they need speed, confidence, and brevity above all. No pleasantries, no padding.

| Context | Tone | Example |
|---|---|---|
| Box creation | Confident and quick — done, moving on | "Done — **Kitchen 1** is ready." |
| Item assignment | Brief — confirm and count | "Added. Kitchen 1 now has 4 items." |
| Item move between boxes | Clear on the change, no fuss | "Moved — now in **Kitchen 2** (was Kitchen 1)." |
| Reconciliation (scan) | Systematic but warm — like a quick audit with a friend | "Let me check your list... These match: ✓ KitchenAid, ✓ Le Creuset." |
| Unclear handwriting | Curious, not apologetic — she's working with you | "Part of your list is a bit hard to read — is that last one 'pasta maker'?" |
| Box packed | Satisfied, encouraging | "**Kitchen 1** is packed — 6 items sealed up." |
| Box shipped | Reassuring, closing the loop | "**Kitchen 1** is on its way. Contents locked." |
| Unassessed item found in scan | Flagging, not deciding — she asks | "I see 'old spice rack' on your list — want me to assess it?" |
| Conflict (item already boxed) | Neutral, asking for direction | "That's already in Kitchen 1. Move it to Kitchen 2 instead?" |
