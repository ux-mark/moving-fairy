export type PanelKind = 'item' | 'box' | 'listing' | 'chat'
export type PanelSide = 'left' | 'right'

export interface PanelPos {
  x: number
  y: number
}

export interface PanelSize {
  w: number
  h: number
}

export interface PanelInstance {
  id: string
  kind: PanelKind
  entityId: string
  /** Header title. Entity panels (Phase C) update this once their data loads. */
  title: string
  side: PanelSide
  /**
   * Undefined until the user drags/resizes — panels without explicit geometry
   * compute a default per-viewport position, which is what makes cross-device
   * sync sane (a phone never applies a desktop pixel position).
   */
  pos?: PanelPos | undefined
  size?: PanelSize | undefined
  minimised: boolean
  zIndex: number
  /** Background data changed while minimised — tray chip shows a live dot. */
  hasUpdate: boolean
}

export interface PanelsState {
  panels: PanelInstance[]
  /** Monotonic z counter; focused panel takes the next value. */
  nextZ: number
}

export interface OpenPanelOptions {
  kind: PanelKind
  entityId: string
  title?: string | undefined
  /**
   * Which half of the viewport the open request came from (the trigger's
   * bounding-rect centre, or the side of the source panel). Drives smart
   * placement: requests originating on the right dock the new panel left.
   */
  originSide?: PanelSide | undefined
}

/** Persisted shape stored in user_panel_state.state (spec §1). */
export interface PersistedPanelState {
  panels: Array<Omit<PanelInstance, 'zIndex' | 'hasUpdate'>>
  /** Panel ids currently minimised to the tray, in tray order. */
  tray: string[]
}

export type PanelsAction =
  | { type: 'open'; panel: Omit<PanelInstance, 'zIndex' | 'hasUpdate' | 'minimised'> }
  | { type: 'close'; id: string }
  | { type: 'minimise'; id: string }
  | { type: 'restore'; id: string }
  | { type: 'focus'; id: string }
  | { type: 'move'; id: string; pos: PanelPos }
  | { type: 'resize'; id: string; size: PanelSize }
  | { type: 'setTitle'; id: string; title: string }
  | { type: 'markUpdated'; id: string }
  | { type: 'hydrate'; persisted: PersistedPanelState; removeIds?: ReadonlySet<string> | undefined }
