import type { CapturedNote } from './captured-note'

/**
 * Note event captured by {@link RecordingBridge}, extending {@link CapturedNote}
 * with a source identifier for correlation during visit callbacks.
 */
export interface RecordedNote extends CapturedNote {
  /** Opaque identifier returned from `insertNote`; used when visiting to correlate the event with its source. */
  readonly sourceId: number
}

/**
 * MIDI CC (control change) event captured by {@link RecordingBridge}.
 */
export interface RecordedCC {
  /** MIDI controller number (0–127), e.g. 7 = volume, 10 = pan. */
  readonly controller: number
  /** MIDI CC value (0–127). */
  readonly value: number
  /** Position in ticks (PPQ 480). */
  readonly tick: number
  /** Opaque identifier returned from `insertCC`; used when visiting to correlate the event with its source. */
  readonly sourceId: number
}

/**
 * Pitch bend event captured by {@link RecordingBridge}.
 */
export interface RecordedBend {
  /** Normalized bend amount: 0 = full down, 0.5 = center, 1 = full up. */
  readonly value: number
  /** Position in ticks (PPQ 480). */
  readonly tick: number
  /** Opaque identifier returned from `insertBend`; used when visiting to correlate the event with its source. */
  readonly sourceId: number
}
