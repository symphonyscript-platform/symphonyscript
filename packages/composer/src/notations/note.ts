import { NoteBuilder } from '../builders/NoteBuilder'
import type { NotePitch } from '../types'
import { resolvePitch } from '../utils/pitch'
import { resolveDuration, type NoteDuration } from '../utils/duration'

/**
 * C0 in MIDI = 12 (MIDI 0 = C-1).
 * Used to convert MIDI → absolute cents from C0.
 */
const MIDI_C0 = 12

/**
 * Create a {@link NoteBuilder} for single-note emission.
 *
 * Accepts either a string pitch name (`'C4'`, `'F#5'`) or absolute cents from C0.
 * String pitches are resolved immediately to cents via MIDI conversion but retain
 * the raw string for temperament-aware re-resolution at apply-time.
 *
 * Called without arguments, creates a builder at C4 (4800 cents) with no explicit
 * duration (falls back to `bridge.defaultDuration` at apply-time).
 *
 * @param input - Pitch as string notation or absolute cents from C0. Defaults to C4 (4800).
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
  const resolvedDuration = resolveDuration(duration)
  if (input === undefined) {
    return new NoteBuilder({ duration: resolvedDuration })
  }

  if (typeof input === 'string') {
    // Resolve string → MIDI → cents for initial pre-resolution
    const midi = resolvePitch(input)
    const pitchCents = (midi - MIDI_C0) * 100
    return new NoteBuilder({ pitchCents, rawPitch: input, duration: resolvedDuration })
  }

  // Numeric input = absolute cents from C0
  return new NoteBuilder({ pitchCents: input, rawPitch: null, duration: resolvedDuration })
}
