/**
 * Escape-key layering guard (spec §1). Panels are non-modal (aria-modal=false)
 * windows; modal layers (DS ConfirmDialog/EditPanel, VerdictPicker, lightboxes)
 * declare aria-modal="true". While any modal layer is open, Escape belongs to
 * it — the document-level panel handler must not also close the panel, or a
 * cancelled dialog would discard the panel's unsaved form input.
 */
export const MODAL_LAYER_SELECTOR = '[aria-modal="true"]'

export function hasOpenModalLayer(root: ParentNode = document): boolean {
  return root.querySelector(MODAL_LAYER_SELECTOR) !== null
}
