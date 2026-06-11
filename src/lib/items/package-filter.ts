/**
 * Package (box) filtering for the items page.
 *
 * Selection is a list of box ids plus the sentinel UNPACKED ('none') for items
 * not packed in any box. Selection lives in the `pkg` search param as a
 * comma-separated list. Empty selection = no package filtering.
 */

export const UNPACKED = 'none'

export function parsePackageParam(value: string | null): string[] {
  if (!value) return []
  return Array.from(new Set(value.split(',').map((s) => s.trim()).filter(Boolean)))
}

export function formatPackageParam(ids: readonly string[]): string {
  return ids.join(',')
}

/**
 * itemId → set of box ids the item is packed in (in practice 0 or 1 — an
 * assessed item can only be in one box, but the structure tolerates more).
 */
export function buildItemBoxIndex(
  boxes: readonly { id: string; items: readonly { item_assessment_id: string | null }[] }[],
): Map<string, Set<string>> {
  const index = new Map<string, Set<string>>()
  for (const box of boxes) {
    for (const bi of box.items) {
      if (!bi.item_assessment_id) continue
      let set = index.get(bi.item_assessment_id)
      if (!set) {
        set = new Set()
        index.set(bi.item_assessment_id, set)
      }
      set.add(box.id)
    }
  }
  return index
}

/**
 * OR semantics within the selection: the item matches if it's in ANY selected
 * package, or is unpacked when UNPACKED is selected. Empty selection matches
 * everything (no package filtering).
 */
export function matchesPackageFilter(
  selection: readonly string[],
  itemBoxIds: ReadonlySet<string> | undefined,
): boolean {
  if (selection.length === 0) return true
  for (const id of selection) {
    if (id === UNPACKED) {
      if (!itemBoxIds || itemBoxIds.size === 0) return true
    } else if (itemBoxIds?.has(id)) {
      return true
    }
  }
  return false
}

/**
 * Full item-list predicate: status filter AND package filter.
 * `bucket` is the item's status bucket (bucketFor in ItemsView); null buckets
 * never match, mirroring the existing status-only behaviour.
 */
export function matchesItemFilters(
  bucket: string | null,
  statusFilters: ReadonlySet<string>,
  packageSelection: readonly string[],
  itemBoxIds: ReadonlySet<string> | undefined,
): boolean {
  if (!bucket || !statusFilters.has(bucket)) return false
  return matchesPackageFilter(packageSelection, itemBoxIds)
}
