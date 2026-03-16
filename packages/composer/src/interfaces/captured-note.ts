/**
 * A single captured note from a composition pass.
 * Used by RecordingBridge, TransformEffect, and transform subclasses.
 */
export interface CapturedNote {
  /** Pitch in absolute cents from C0 (e.g. 4800 = C4, 5700 = A4). */
  readonly pitch: number
  readonly velocity: number
  readonly duration: number
  readonly tick: number
  readonly muted: boolean
}
