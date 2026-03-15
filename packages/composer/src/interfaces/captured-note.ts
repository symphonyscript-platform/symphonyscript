/**
 * A single captured note from a composition pass.
 * Used by RecordingBridge, TransformEffect, and transform subclasses.
 */
export interface CapturedNote {
  readonly pitch: number
  readonly velocity: number
  readonly duration: number
  readonly tick: number
  readonly muted: boolean
}
