# Feature Overview — Moving Fairy

> Written from the user's perspective. UXicorn owns this document.
> After every feature is completed, UXicorn updates this log describing what the user can now do — not how it was built.

---

## Onboarding Form

**Added**: 2026-03-08
**Updated**: 2026-03-09
**Status**: planned

What you can do now: Before chatting with Aisling, you fill out a short stepped form that tells her about your move. This takes about 30 seconds and means Aisling's advice is tailored to your specific route, timeline, and equipment from the very first message. The form supports any combination of currently available departure, arrival, and onward countries — so whether you are moving from the US to Ireland, Ireland to Australia, or any other supported route, the experience adapts to you.

### How it works

1. You tap "Let's get started" on the landing page.
2. You select your departure country from a dropdown of all supported countries.
3. You select your arrival country. The dropdown shows all supported countries except the one you already chose as departure.
4. You answer whether you are planning an onward move after your arrival country. If yes or maybe, you select the onward country (from all remaining supported countries) and an approximate timeline.
5. If your move involves a voltage change between any of your countries (for example, US 120V to Ireland 230V), Aisling asks whether you own a voltage transformer. You can optionally note the model and wattage. If all your countries share the same voltage standard (for example, Ireland to Australia — both 230V), this question is skipped entirely.
6. You tap "Start chatting with Aisling" and the form data is saved. Aisling opens the conversation already knowing your route and setup.

### What to know

- You can go back to any previous step without losing your answers.
- The form is designed for one-handed mobile use — large buttons, minimal typing.
- Aisling uses a conversational tone in the form questions, so it feels like a quick chat rather than a bureaucratic intake.
- The voltage transformer question only appears when it is relevant to your route. If you are moving between countries that share a voltage standard, you will not see it at all.
- As new countries are added to Moving Fairy, they appear automatically in the departure, arrival, and onward dropdowns — no redesign needed.
- Your move details can be updated later from within the chat interface (see Profile Edit, when available).
- Screen readers announce each step and any validation messages clearly.

---

## Item Advice Chat

**Added**: 2026-03-08
**Updated**: 2026-03-09
**Status**: planned

What you can do now: You tell Aisling about an item you own — by name, by category, by pasting a list, or by photographing it — and she tells you exactly what to do with it: **SELL**, **SHIP**, **CARRY**, **DONATE**, **DISCARD**, or **DECIDE LATER**. Every verdict comes with a clear reason and a concrete next step. Photo assessment is a primary interaction, not a nice-to-have: you can snap a picture of something while standing in the room with it, and Aisling identifies the item and assesses it on the spot.

### How it works

1. After onboarding, Aisling opens the chat by confirming your move details and inviting you to ask about your first item.
2. You can interact in any of these ways:
   - **Photograph an item**: Tap the camera button in the chat input. On mobile, choose "Take a photo" (opens your rear camera) or "Choose from library" (opens your photo picker). On desktop, the camera button opens a standard file dialog. You can attach up to 3 photos per message. Each appears as a thumbnail preview in the input bar before you send, with an X to remove any of them.
   - **Type a single item**: "KitchenAid stand mixer" or "my Dyson vacuum."
   - **Name a category**: "kitchen appliances" or "power tools."
   - **Paste a list**: "Here's what's in my garage: lawn mower, leaf blower, Dewalt drill set, workbench, extension cords."
   - **Photo plus text**: Attach a photo and add typed context — "it's the 600W professional model" or "this is about 15 years old."
3. Aisling responds with a verdict for each item. Every response includes: the item name, the verdict (prominently displayed and colour-coded), the reasoning (voltage, customs, cost comparison, shipping practicality), and a specific action to take.
4. When you send a photo, Aisling identifies what she sees and states her confidence. If she recognises it clearly, she gives the verdict immediately. If she is mostly sure but wants to confirm a detail, she asks one clarifying question and then gives the verdict. If the image is unclear, she asks you to try another photo or describe the item instead — she never guesses wildly.
5. For lists, Aisling addresses each item in sequence within a single response, so you can scan quickly.
6. If Aisling does not have enough information to give you a confident verdict, she marks the item as **DECIDE LATER** and explains what she would need to make a firm call. DECIDE LATER items are saved to your inventory but flagged as tentative — no cost estimate, no box assignment. Aisling will gently remind you about pending DECIDE LATER items during natural pauses in conversation, and you can revisit them any time.
7. You can ask follow-up questions about any item ("What about the attachments?" or "What if I get a transformer?") and Aisling remembers the full conversation context.

### What to know

- You can type a single item, a category, paste a full list, or snap a photo — Aisling handles all of them. Photo and text can be combined in a single message.
- Up to 3 photos per message. If you try to add a fourth, you will see a brief inline note: "Up to 3 photos per message."
- Verdicts account for your specific route, onward plans, timeline, and transformer ownership. Two users asking about the same item may get different advice.
- DECIDE LATER is not a dead end — it is a holding space. You can come back to those items when you have the information Aisling needs, or she may prompt you about them later.
- The conversation scrolls naturally. You can scroll up to revisit earlier advice at any time.
- If Aisling is thinking, you will see a typing indicator. For photo assessments, the indicator says "Aisling is looking at your photo..." to set expectations. You can type your next question while she is responding — it will queue.
- If something goes wrong (connection issue, AI error), your message and any attached photos are preserved in the input field and you can retry with one tap.
- The chat input works well on mobile with one hand — it is fixed to the bottom of the screen and stays above the keyboard.
- Relevant for the Straight-Line Emigrant persona: the photo flow is designed for the person standing in a room with their phone in hand, sorting through belongings. Point, snap, get an answer.

---

## Multi-Leg Move Support

**Added**: 2026-03-08
**Updated**: 2026-03-09
**Status**: planned

What you can do now: If you are planning an onward move after your initial destination — any supported route, not just a single corridor — Aisling factors all legs into every piece of advice she gives you. You do not have to ask twice. She thinks ahead on your behalf.

### How it works

1. During onboarding, you indicate that you are planning (or considering) an onward move. You select the onward country and an approximate timeline.
2. From that point on, every item verdict Aisling gives considers all destinations. If an item is fine for the initial destination but problematic for the onward country, she flags it proactively. For example, on a US to Ireland to Australia route, a wooden cutting board may trigger Australian biosecurity concerns. On other routes, Aisling flags whatever is relevant to those specific countries.
3. Aisling's advice is timeline-sensitive. If your onward move is 1-2 years away, she may recommend against shipping a bulky item to the initial destination only to ship it again soon. If it is 5+ years, she treats the initial leg more like a long-term stay.
4. If you selected "Maybe" for the onward move, Aisling mentions the onward implications when they are significant but does not let them dominate every answer. She treats it as a factor, not a certainty.

### What to know

- Aisling proactively warns you about destination-specific import and biosecurity rules when relevant — you do not have to remember to ask. For Australian destinations, this includes biosecurity requirements for timber, organic materials, and outdoor gear. For other destinations, she applies whatever rules are specific to that country.
- The onward timeline affects advice: a 1-year stay in the initial destination gets different recommendations than a 5-year stay.
- You can update your onward plans mid-conversation via the "Edit move details" option if your timeline or destination changes. Aisling will offer to re-evaluate items where the new context changes her recommendation.
- If you selected "Not sure" for the onward timeline, Aisling defaults to moderate assumptions and tells you when the timeline would change her advice.
- Particularly valuable for the Two-Leg Planner persona, who is optimising across two sets of rules simultaneously and needs Aisling to hold both legs in her head at once.

---

## Inventory Panel

**Added**: 2026-03-09
**Status**: planned

What you can do now: As Aisling assesses your items, everything builds into a persistent inventory panel that gives you the full picture of your move at a glance. On desktop, this is a split-screen left panel alongside the chat. On mobile, it is an "Inventory" tab alongside the "Chat" tab, always one tap away. You can see every assessed item, every box, your running costs, and make changes directly in the panel without switching back to the conversation.

### How it works

1. After your first item assessment, the inventory panel starts populating. Every item Aisling assesses appears here, grouped by container — boxes, carry-on, checked luggage, single large items, and an "unassigned" group for items not yet packed into anything.
2. At the top of the panel, a running cost summary is always visible: total CBM, estimated freight cost, and item counts broken down by verdict (SHIP, SELL, DONATE, DISCARD, DECIDE LATER). These numbers update in real time as Aisling assesses new items or you make changes.
3. Items that have photos show thumbnail images in the inventory, so you can recognise them at a glance.
4. You can edit items directly in the panel without opening the chat:
   - **Change a verdict**: Switch an item from SHIP to SELL (or any other verdict) using an inline control. If the change has implications — like removing the item from a box — you see a brief warning before it applies.
   - **Move an item to a different box**: Select a new container from a dropdown of available boxes.
   - **Unassign an item**: Remove it from its box and send it back to the unassigned group.
   - **Rename an item**: Tap the item name to edit it inline.
   - **Change a box's status**: Move a box from packing to packed, shipped, or arrived using the status control on the box card.
5. On mobile, a compact cost strip is always visible at the top of both the Chat and Inventory tabs, showing two headline numbers: total CBM and estimated freight cost. This strip gives you orientation no matter which tab you are viewing. The full breakdown is in the Inventory tab.
6. The panel supports two grouping views via tabs: "By container" (the default, showing items organised into boxes) and "By verdict" (showing items grouped by SHIP, SELL, DONATE, etc.).

### What to know

- On desktop (wider than 1024px), the inventory panel takes up roughly 40% of the screen on the left, with the chat occupying the remaining 60% on the right. Both panels scroll independently.
- On mobile, the Chat tab is the default on first load. Switching to the Inventory tab is a single tap on the bottom tab bar. You can also swipe horizontally between the two.
- When you make inline edits in the inventory panel, a brief system note appears in the chat log — "You updated KitchenAid Stand Mixer to SELL" — so the chat history stays accurate without Aisling re-responding to every small change.
- The running cost summary uses the same colour coding as verdict labels: green for SHIP, amber for SELL, warm grey for DONATE/DISCARD, soft blue for DECIDE LATER.
- Before any items have been assessed, the inventory panel shows a warm empty state with a message pointing you toward the chat: "No items assessed yet. Start a conversation with Aisling — snap a photo of something or type an item name."
- All inline edit controls are keyboard-accessible and meet minimum touch target sizes on mobile.
- Particularly valuable for the Second-Leg Mover persona, who engages in shorter, more focused sessions and wants to see the full picture immediately without scrolling through old conversation history.

---

## Box Management

**Added**: 2026-03-09
**Status**: planned

What you can do now: You can create labelled boxes, assign items to them, choose a box size for shipping estimates, and track each box through packing to arrival. Aisling handles box management conversationally while you pack with your phone in one hand, or you can manage boxes directly in the inventory panel. When you finish packing a box, you can photograph the handwritten contents list on the lid, and Aisling reads it and reconciles it against the digital record — catching anything missing or extra.

### How it works

1. **Creating a box**: Tell Aisling "start a kitchen box" or "I'm packing the bedroom now," and she creates a labelled box for you — Kitchen 1, Bedroom 1, and so on. The room name is yours; the number is assigned automatically. If you already have a Kitchen 1, the next one becomes Kitchen 2 without Aisling asking permission. You can also create boxes from the inventory panel by tapping "New box" and typing a room name.
2. **Choosing a box size**: Each freight box has a size — XS, S, M, or L — which determines its CBM contribution to your shipping estimate. When you create a box through the UI, you select the size (default is M). When Aisling creates one conversationally, she suggests a size based on what you are packing and defaults to M if you do not specify.
3. **Assigning items to boxes**: After Aisling gives a SHIP or CARRY verdict, you can tell her which box it goes in — "put the KitchenAid in Kitchen 1." You can also assign items in bulk: "everything from the kitchen goes in Kitchen 1." Or assign items directly from the inventory panel using inline controls. Only SHIP and CARRY items can go in boxes. If you try to box a SELL item, Aisling asks if you want to change the verdict first.
4. **Box status progresses through four stages**: Packing (the default when you create a box), Packed (you have sealed it up), Shipped (the movers have collected it), and Arrived (it has reached your destination). You can change status conversationally — "Kitchen 1 is packed" — or from the inventory panel. A brief confirmation prevents accidental status changes.
5. **Handwritten list reconciliation**: When you mark a box as packed, Aisling offers to check your handwritten contents list. Photograph the list you wrote on the box lid, and Aisling reads it and compares it against the digital record. She confirms matches, flags items on the physical list that are not in the digital box (and offers to add or assess them), flags items in the digital box that are not on the physical list (and asks where they went), and gives you a summary. If your handwriting is hard to read in places, she tells you exactly which items she could not decipher and asks for help — she does not blame your handwriting.

### What to know

- An item can only be in one box at a time. If you try to assign an item that is already boxed elsewhere, Aisling flags the conflict and asks if you want to move it.
- Once a box is marked as Shipped, its contents become read-only in the inventory panel. You can still ask Aisling to make changes if needed, but the UI does not invite casual edits to shipped boxes.
- Box labels are displayed in title case throughout the app: "living room" becomes "Living Room 1."
- The inventory panel shows box cards ordered by status (packing boxes first, then packed, shipped, arrived) and then by most recently modified within each status group.
- The handwritten list photo can be triggered from the box card in the inventory panel ("Scan box list" button on packed boxes), from the chat via the camera button with context ("this is my Kitchen 1 box list"), or when Aisling proactively offers after you mark a box as packed.
- This feature is designed for the person who is on the floor of their kitchen, surrounded by newspaper and packing tape, phone in hand. Every interaction is optimised for one-handed use and minimal interruption.

---

## Luggage Management

**Added**: 2026-03-09
**Status**: planned

What you can do now: Not everything goes in a freight box. Items travelling with you on the plane — in your carry-on bag and your checked suitcases — are tracked separately from your shipping containers. A "Travelling with me" section sits at the top of your inventory, so you always know what is going in your luggage versus what is being shipped.

### How it works

1. **Carry-on**: You have one Carry-on container, always visible in your inventory. Items with a CARRY verdict default here unless you say otherwise. Aisling automatically flags items containing lithium batteries (laptops, phones, power banks, tablets, e-readers, battery-powered tools) as Carry-on items — these cannot be placed in freight boxes because airlines and shipping companies both require lithium batteries in hand luggage. If you try to put a lithium battery item in a freight box, Aisling explains why and places it in your Carry-on instead.
2. **Checked Luggage**: You can have multiple checked luggage containers, numbered sequentially — Checked Luggage 1, Checked Luggage 2, and so on. Aisling creates these when you say something like "that goes in my checked bag" or "I'll pack that in my suitcase." You can also create them from the inventory panel.
3. **Travelling with me section**: In the inventory panel, Carry-on and Checked Luggage containers appear at the top, above your freight boxes, in a clearly labelled "Travelling with me" section. This section is always visible and visually separated from the freight containers below.

### What to know

- Carry-on and Checked Luggage items do not contribute to your shipping CBM or freight cost estimate. They are tracked for organisation, not for shipping calculations.
- The lithium battery rule is enforced automatically. Aisling does not ask whether you want to override it — she explains the requirement and places the item correctly. This protects you from a common and potentially dangerous packing mistake.
- You can assign items to Carry-on or Checked Luggage conversationally ("put the iPad in carry-on") or via the inventory panel's inline controls.
- Relevant for all personas, but especially the Straight-Line Emigrant who may not know that lithium batteries cannot go in freight shipments.

---

## Single Item Tracking

**Added**: 2026-03-09
**Status**: planned

What you can do now: Large items that cannot fit in a box — furniture, bikes, large appliances — are tracked individually in your inventory, each with its own CBM estimate and shipping cost. They appear in a dedicated "Large items — shipping individually" section so you can see their contribution to your total shipping volume and cost.

### How it works

1. When Aisling gives a SHIP verdict to an item too large for any box, she identifies it as a single shipping item and asks for rough dimensions: "Can you give me rough dimensions? Something like '180cm by 90cm by 80cm' is perfect."
2. You provide approximate dimensions (no need to be exact — Aisling works with rough numbers), and she calculates the estimated CBM.
3. The item appears in the "Large items — shipping individually" section of your inventory panel, showing the item name, a thumbnail (if you sent a photo), estimated CBM, and estimated freight cost.

### What to know

- Single items cannot be assigned to boxes — the "Add to box" action is not available for them. They are shipping on their own.
- Their CBM and cost contribute to your running shipping totals in the cost summary.
- Common single items include couches, dining tables, bed frames, bicycles, treadmills, and large workshop equipment.
- Relevant for the Straight-Line Emigrant persona who is shipping a full household and needs to understand how a few large items affect the total cost.

---

## Bulk Ship Action

**Added**: 2026-03-09
**Status**: planned

What you can do now: When the movers arrive and collect everything, you can mark all your boxes, single items, and luggage as shipped in a single action instead of updating each one individually. This is the "movers are at the door" moment — one tap and everything is marked as shipped.

### How it works

1. In the inventory panel, a "Mark all as shipped" button appears at the top of the container list when you have at least one box in packing or packed status.
2. You tap the button, and a confirmation screen shows exactly how many containers will be affected: "Mark all as shipped? This includes N boxes and N single items."
3. You confirm, and all freight boxes, checked luggage, carry-on, and single items move to shipped status. The inventory panel updates to show everything in a muted "Shipped" state with grey status badges.
4. The "Mark all as shipped" button disappears once everything is shipped.

### What to know

- The confirmation is deliberate — this is a significant status change and the button uses a secondary style (not the bold primary colour) to avoid accidental taps.
- Individual boxes can still be marked as shipped one at a time. This is useful when shipping happens in stages — for example, one shipment goes by sea, another by air, and your luggage goes with you on a different date.
- Once a container is marked as shipped, its contents become read-only in the inventory panel.
- You can ask Aisling to revert a box to a previous status if you need to: "Actually, I need to reopen Kitchen 1."

---

## Returning User Sessions

**Added**: 2026-03-09
**Status**: planned

What you can do now: Packing for a move is not a single sitting. You come back to Moving Fairy over days or weeks — maybe you sort the kitchen on Saturday, the garage on Tuesday, and the bedroom next weekend. Every time you return, Aisling greets you with a clear summary of where things stand, and your full inventory is there waiting. You pick up exactly where you left off.

### How it works

1. When you open the app after being away, Aisling greets you with a brief, contextual summary: "Welcome back. You've got 34 items assessed — 18 to ship (2.4 CBM, approximately EUR 1,250), 8 to sell, and 8 still to sort. You've packed 3 boxes. Where do you want to pick up?"
2. The inventory panel shows the full picture immediately — every assessed item, every box, every verdict, the running cost total. You do not need to scroll through old conversation to remember where you were.
3. You can scroll up in the chat to see your previous conversation history, but you do not need to. Aisling works from your assessed item list, not from chat history. This means she is fast and accurate across sessions — she knows every item, every verdict, every box, without re-reading hundreds of messages.
4. You continue chatting with Aisling as normal — assessing new items, managing boxes, asking follow-up questions. She has full context.

### What to know

- Your data persists across sessions. Nothing is lost between visits — not your move details, not your item assessments, not your boxes, not your cost estimates.
- The inventory panel is your anchor across sessions. It is the single place that shows you the complete state of your move, regardless of how many conversations you have had.
- Aisling's welcome-back message is generated from your data, not from a template. The numbers are real and current. This reinforces that nothing was lost.
- If you reference a previous conversation — "remember that KitchenAid you said to ship?" — Aisling finds it in the assessment list and responds from there. She does not need to locate the specific chat message.
- The compact cost strip (on mobile) and running cost summary (on desktop) show current totals from the very first render, so you have orientation before Aisling even finishes her greeting.
- Particularly valuable for the Two-Leg Planner and Second-Leg Mover personas, who may have longer timelines and more complex inventories that build over many sessions.

---

## Light Assessment

**Added**: 2026-03-09
**Status**: planned

What you can do now: When you are packing and you put an item in a box that Aisling has not assessed yet, she does a quick check before it goes in — import restrictions, voltage compatibility, biosecurity risks. If the item is clean, you get a one-line confirmation and keep packing. If there is something to flag, you get a brief, specific warning. If the item is prohibited, Aisling stops it from going in the box and tells you why. This keeps you moving while still protecting you from shipping something that will cause problems at the border.

### How it works

1. You assign an item to a box — either by telling Aisling ("KitchenAid — Kitchen 1") or by typing it into the "Add to this box" input in the inventory panel — and the item has not been previously assessed.
2. Aisling automatically runs a light assessment, checking three things in order: is this item prohibited or restricted at your destination or onward country? Is this item voltage-incompatible? Does it pose a biosecurity risk (relevant for destinations with strict biosecurity rules, like Australia)?
3. If none of these checks raise a concern, you get a single line: "Added to Kitchen 1." No extra commentary, no padding. Aisling keeps it moving.
4. If one check raises a flag — for example, a 120V item that will need your transformer — Aisling states it concisely and confirms the assignment: "120V — needs your DS-5500 in Ireland. Worth shipping though. Added to Kitchen 1."
5. If the item is prohibited or genuinely should not be shipped, Aisling does not add it to the box. She explains why and suggests the correct verdict: "Firearms can't be shipped internationally — this one needs to be sold or surrendered before you leave. Not added to any box."
6. If Aisling is unsure what the item is, she asks one clarifying question, then proceeds.

### What to know

- A light assessment is different from a full assessment. It does not weigh sell-vs-ship economics, provide cost comparisons, or suggest where to buy a replacement. It answers one question: "Is there anything I should know before this goes in the box?"
- Light assessment only triggers when you are in a packing context — assigning an item to a box. If you ask Aisling an open-ended "should I bring this?" question, she gives a full assessment instead.
- The item is saved to your inventory with a SHIP verdict (or CARRY, if you specified carry-on or checked luggage). Any flags are noted but do not block the assignment unless the item is actually prohibited.
- In the inventory panel, if you use the standalone box UI to add an unassessed item, the same light assessment runs. A flag appears as an inline warning card — "Voltage flag: This item is 120V. It will need a transformer in Ireland. Add to box anyway?" — with "Add anyway" and "Don't add" options.
- Light assessment creates a full record for the item, so if you ask Aisling about it later, she already has it on file.
- Designed for the moment when you are deep in packing mode and just need to keep moving without stopping for a full conversation about every item.

---

<!-- Entry format:

## Feature Name
**Added**: YYYY-MM-DD
**Status**: available | beta | planned | deprecated

What you can do now: a plain-language description of what this feature lets you accomplish.

### How it works
Step-by-step from the user's point of view:
1. You do X...
2. Then Y happens...
3. You'll see Z...

### What to know
- Any limitations, edge cases, or tips
- Accessibility notes (if applicable)
- Related features

-->
