# Voltage and Electrical Compatibility — Skill Module

---

## Voltage and Plug Reference

| Country | Voltage | Frequency | Plug Type |
|---------|---------|-----------|-----------|
| USA / Canada | 120V | 60Hz | Type A / B |
| Ireland / UK | 230V | 50Hz | Type G |
| Australia / NZ | 230V | 50Hz | Type I |

Ireland and Australia share the same voltage and frequency. An item that works in Ireland needs only a plug adapter to work in Australia.

---

## How to Identify Dual-Voltage Items

Check the label on the item, its base, or its power supply (brick/adapter):

- `100–240V` or `110–240V` → **Dual-voltage. Safe worldwide. Needs plug adapter only.**
- `120V only` or `120V ~ 60Hz` → **US-only. Do not plug in at 230V. Needs transformer or replacement.**
- `220–240V only` → **EU/AU-only. Will not work in the US.**

If the label is missing or unreadable, do not guess — test with a multimeter or consult the manufacturer.

---

## Almost Always Dual-Voltage (bring these; plug adapter only)

- Laptop power adapters
- Phone chargers and USB-C power bricks
- Camera and mirrorless camera battery chargers
- Electric toothbrush charging bases (most Oral-B, Philips Sonicare)
- CPAP and BiPAP machines (check the label — most modern units are 100–240V)
- Gaming console power supplies (PS5, Xbox Series X/S — dual-voltage; PS3/Xbox 360 — check label)
- Tablet chargers
- Smart speaker power adapters (Echo, HomePod — check label)

---

## Almost Never Dual-Voltage (sell at departure; replace at arrival)

| Item | Notes |
|------|-------|
| US hair dryers | 120V only; high wattage heating element |
| Flat irons / hair straighteners | 120V only; see also frequency note below |
| US microwave ovens | 120V only; cheap to replace |
| US stand mixers (KitchenAid, etc.) | 120V only; but transformer-viable if high-wattage transformer is available |
| US drip coffee makers | 120V only; replace at arrival |
| US blenders and food processors | 120V only |
| US space heaters | 120V only |
| US window air conditioners | 120V only; wrong voltage and wrong format |
| US vacuum cleaners | 120V only |
| US washer and dryer | 120V (dryer is 240V in US but non-standard elsewhere); also wrong drum size |
| US refrigerator / freezer | 120V; also compressor motor frequency issue (see below) |

---

## Adapters, Converters, and Transformers — When to Use Which

| Device | What it does | Use when |
|--------|-------------|----------|
| **Plug adapter** | Changes plug shape only; does not change voltage | Dual-voltage item needs to fit a foreign socket |
| **Voltage converter** | Steps voltage up or down for short-term use | Small, low-wattage items used briefly (e.g., a razor); NOT recommended for sustained or motor-driven use |
| **Step-down transformer** | Converts 230V → 120V continuously; handles sustained loads | Running US-only appliances at 230V destinations |

A transformer is necessary for any sustained use of US-only appliances in Ireland or Australia. A converter is not a substitute for a transformer for anything with a motor or heating element.

---

## Frequency — 60Hz vs 50Hz

The transformer converts voltage only — it does **not** convert frequency.

**Effect on different device types:**

| Type | Effect of 60→50Hz |
|------|-------------------|
| Modern switching power supplies (laptops, chargers) | None — they regulate frequency internally |
| LED and CFL lighting | None for most modern units |
| Synchronous motors (older washing machines, some fans, older fridges) | Run ~17% slower; generate more heat; reduced lifespan |
| Induction motors (newer appliances) | Minor effect; generally tolerable short-term; not recommended for compressor-driven appliances long-term |
| Heating elements (hair dryers, flat irons, ovens) | Power output changes slightly; heating element lifespan reduced at 50Hz; not recommended |
| Mains-frequency clocks (older wall clocks, microwave clocks) | Will run slow — they track 60Hz cycles to keep time |
| CPAP machines | Most modern units auto-adjust; verify on label |

**Key rule**: Do not use hair dryers or flat irons through a transformer at 50Hz — the frequency shift degrades heating elements regardless of voltage conversion. These items should be sold and replaced at the destination.

---

## Transformer Context — User Profile Integration

If `transformer.owned = true` in the user profile:

**Safe operating limit**: Apply an 80% derating. Maximum safe continuous load = `wattage_w × 0.8`.

Example: A 5,500W transformer has a safe limit of 4,400W. An appliance rated at 300W is well within this limit.

**Items still NOT viable through a transformer (regardless of wattage):**

| Item | Reason |
|------|--------|
| Hair dryers | 50Hz degrades heating element; replacement cost is low |
| Flat irons / hair straighteners | Same — 50Hz heating element degradation |
| US washer / dryer | Wrong drum/cavity dimensions for IE/AU kitchens; compressor degradation at 50Hz |
| US refrigerator / freezer | Compressor motor sensitive to 50Hz long-term; large, costly to ship |
| US dishwasher | Non-standard dimensions; not worth shipping |

**Items that become viable with a 5,000W+ transformer:**

| Item | Typical Draw | Notes |
|------|-------------|-------|
| KitchenAid stand mixer (Pro 600) | 575W | Well within limit; SHIP |
| KitchenAid stand mixer (Artisan) | 325W | Well within limit; SHIP |
| Professional power tools (circular saw, drill press) | 600–1,800W | Check rated draw against transformer limit |
| High-end microwave (1,200–1,800W) | 1,200–1,800W | Viable with 5,500W transformer; but also consider: cheap to replace in IE |
| Desktop computer (high-end) | 300–800W | Viable; confirm PSU is 120V-only first — most modern PSUs are dual-voltage |

**How to check if a specific appliance is within transformer capacity:**
1. Find the appliance's rated wattage on its label or in the manual.
2. Compare to `wattage_w × 0.8`.
3. If the appliance draw is below the safe limit, it is transformer-compatible (subject to the exclusions above).
4. For motor-driven appliances, also factor in startup surge — motors draw 3–7× rated current at startup.
