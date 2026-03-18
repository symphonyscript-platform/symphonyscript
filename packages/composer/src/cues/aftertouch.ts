import type { NotePitch } from '../types'
import { AftertouchBuilder } from '../builders/AftertouchBuilder'

/**
 * Create an {@link AftertouchBuilder} for channel or polyphonic pressure.
 *
 * Emits a single aftertouch event at the current tick. Omit `note` for channel
 * aftertouch (0xD0); provide a pitch for polyphonic aftertouch (0xA0) targeting
 * that note. Value is normalized 0–1 and mapped to MIDI 0–127 on apply.
 *
 * @param value - Normalized pressure (0–1). Clamped on apply.
 * @param note - Target note for poly aftertouch. Omit for channel aftertouch.
 *   String (e.g. `'C4'`) or MIDI number; resolved via {@link Notation.noteToCents notation.noteToCents()}.
 * @returns Immutable {@link AftertouchBuilder} — chain `.value()`, `.note()`, etc.
 *
 * @example
 * ```ts
 * aftertouch(0.8)             // Channel aftertouch at 80% pressure
 * aftertouch(0.5, 'C4')       // Poly aftertouch on C4
 * aftertouch(0.8).note('D4')  // Override target note
 * ```
 */
export function aftertouch(value: number, note?: NotePitch): AftertouchBuilder {
  return new AftertouchBuilder({ value, note: note ?? null })
}
