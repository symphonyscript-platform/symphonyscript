import { OffsetBuilder } from '../builders/OffsetBuilder'

import { NoteDuration } from '@symphonyscript/core'

/**
 * Create an {@link OffsetBuilder} that emits a pitch relative to the tuning reference.
 *
 * The offset is in cents from the reference pitch (A4 = 5700 cents by default).
 * `offset(0)` = A4, `offset(100)` = 100 cents above A4, `offset(-1200)` = A3.
 *
 * Inherits all {@link PitchStepBuilder} modifiers: `.velocity()`, `.up()`,
 * `.repeat()`, `.sharp()`, `.duration()`, etc.
 *
 * @param cents - Cent offset from the tuning reference. 0 = reference pitch.
 * @param duration - Note duration in ticks. `undefined` = bridge default.
 *
 * @returns Immutable {@link OffsetBuilder}
 *
 * @example
 * ```ts
 * offset(0)                    // A4 (tuning reference)
 * offset(100)                  // 100 cents above A4
 * offset(-50).velocity(900)    // 50 cents below A4, velocity 900
 * offset(0).up(1)              // A5 (reference + 1 octave)
 * ```
 */
export function offset(cents: number, duration?: NoteDuration): OffsetBuilder {
  return new OffsetBuilder({ offsetCents: cents, duration })
}
