import type { NoteDuration, NoteName } from '@symphonyscript/core'
import { NoteBuilder } from '../builders/NoteBuilder'
import type { NotePitch } from '../types'

/**
 * Create a {@link NoteBuilder} for single-note emission.
 *
 * Accepts either a string pitch name (`'C4'`, `'F#5'`) or absolute cents from C0.
 * String pitches are stored as `rawPitch` for deferred resolution at apply-time
 * via `notation.noteToCents()`. Numeric pitches are stored directly as `pitchCents`.
 *
 * Called without arguments, creates a builder at C4 (4800 cents) with no explicit
 * duration (falls back to `bridge.defaultDuration` at apply-time).
 *
 * @param input - Pitch as string cue or absolute cents from C0. Defaults to C4 (4800).
 * @param duration - Note duration in ticks. `undefined` = use bridge default.
 *
 * @returns Immutable {@link NoteBuilder} — chain `.velocity()`, `.sharp()`, `.up()`, etc.
 * @throws If `input` is a string that cannot be parsed (e.g. `'invalid'`)
 *
 * @example
 * ```ts
 * note('C4')               // C4 at bridge default duration
 * note('E4', 240)          // E4, 240 ticks
 * note(4800)               // C4 via absolute cents
 * note()                   // C4, default duration
 * note('G4').sharp().up()  // G#5
 * ```
 */
export function note(input?: NotePitch, duration?: NoteDuration): NoteBuilder {
  if (input === undefined) {
    return new NoteBuilder({ duration })
  }

  if (typeof input === 'string') {
    // Defer string→cents resolution to apply-time via notation.noteToCents()
    return new NoteBuilder({ rawPitch: input as NoteName, duration })
  }

  // Numeric input = absolute cents from C0
  return new NoteBuilder({ pitchCents: input, rawPitch: null, duration })
}
