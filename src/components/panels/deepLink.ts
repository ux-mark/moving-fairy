/**
 * Deep-link ↔ panel sync state machine (spec §3). Pure so the effect logic is
 * unit-testable: given the current URL param value and whether the relevant
 * panel is open, decide whether to open the panel, clear the param, close the
 * panel (browser Back), or wait.
 *
 * Lifecycle per param value:
 *   1. value appears (page load / link click) → 'open' the panel once.
 *   2. panel observed open → remember it (wasOpen).
 *   3. panel disappears after having been open (user closed it) →
 *      'clearParam' so the URL stays shareable/truthful.
 *   4. value disappears while the managed panel is still open (browser
 *      Back) → 'close' the panel.
 */
export interface DeepLinkState {
  /** The param value we already issued an open for. */
  handled: string | null
  /** Whether the handled panel has been observed open at least once. */
  wasOpen: boolean
}

export const INITIAL_DEEP_LINK_STATE: DeepLinkState = {
  handled: null,
  wasOpen: false,
}

export type DeepLinkStep =
  | { action: 'open'; entityId: string; state: DeepLinkState }
  | { action: 'clearParam'; state: DeepLinkState }
  | { action: 'close'; entityId: string; state: DeepLinkState }
  | { action: null; state: DeepLinkState }

/**
 * @param value  current search-param value
 * @param isOpen whether the panel for `value ?? state.handled` is open
 */
export function nextDeepLinkStep(
  state: DeepLinkState,
  value: string | null,
  isOpen: boolean
): DeepLinkStep {
  if (!value) {
    if (state.handled && state.wasOpen && isOpen) {
      // Param removed externally (browser Back) while the panel is open.
      return { action: 'close', entityId: state.handled, state: INITIAL_DEEP_LINK_STATE }
    }
    return { action: null, state: INITIAL_DEEP_LINK_STATE }
  }
  if (state.handled !== value) {
    // New value (fresh load or param change) — open the panel.
    return { action: 'open', entityId: value, state: { handled: value, wasOpen: isOpen } }
  }
  if (isOpen) {
    return { action: null, state: state.wasOpen ? state : { ...state, wasOpen: true } }
  }
  if (state.wasOpen) {
    // The panel we manage was open and is now closed — drop the param.
    return { action: 'clearParam', state: INITIAL_DEEP_LINK_STATE }
  }
  // Opened but not yet observed open (reducer dispatch in flight) — wait.
  return { action: null, state }
}
