import { NoteBuilder } from '../builders/NoteBuilder'
import type { NotePitch } from '../types'
import { resolvePitch } from '../utils/pitch'

/**
 * Create a {@link NoteBuilder} for single-note emission.
 *
 * Accepts either a string pitch name (`'C4'`, `'F#5'`) or a MIDI number (0-127).
 * String pitches are resolved immediately via {@link resolvePitch} but retain
 * the raw string for key-signature-aware re-resolution at apply-time.
 *
 * Called without arguments, creates a builder at C4 with no explicit duration
 * (falls back to `bridge.defaultDuration` at apply-time).
 *
 * @param input - Pitch as string notation or MIDI number. Defaults to C4 (60).
 * @param duration - Note duration in ticks. `undefined` = use bridge default.
 * @returns Immutable {@link NoteBuilder} — chain `.velocity()`, `.sharp()`, `.up()`, etc.
 * @throws If `input` is a string that cannot be parsed (e.g. `'invalid'`)
 *
 * @example
 * ```ts
 * note('C4')               // C4 at bridge default duration
 * note('E4', 240)          // E4, 240 ticks
 * note(72)                 // C5 via MIDI number
 * note()                   // C4, default duration
 * note('G4').sharp().up()  // G#5
 * ```
 */
export function note(input?: NotePitch, duration?: number): NoteBuilder {
  if (input === undefined) {
    return new NoteBuilder({ duration })
  }

  const pitch = resolvePitch(input)
  const rawPitch = typeof input === 'string' ? input : null

  return new NoteBuilder({ pitch, rawPitch, duration })
}
