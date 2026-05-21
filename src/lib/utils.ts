import { clsx, type ClassValue } from "clsx"
import { randomUUID } from "crypto"

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

/**
 * Build a URL-safe slug from a free-text name, with a 4-char random suffix
 * to keep slugs unique even when item names collide.
 *
 *   buildSlug("KitchenAid Mixer")  →  "kitchenaid-mixer-a1b2"
 *   buildSlug("  IKEA  Malm!! ")    →  "ikea-malm-3f4e"
 *   buildSlug("")                   →  "item-7c2d"
 */
export function buildSlug(name: string): string {
  const base = (name ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
  const stem = base.length > 0 ? base : "item"
  const suffix = randomUUID().replace(/-/g, "").slice(0, 4)
  return `${stem}-${suffix}`
}
