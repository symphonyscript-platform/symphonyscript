import { SwingBuilder } from '../builders/SwingBuilder'

import { NoteDuration } from '@symphonyscript/core'

/**
 * Create a {@link SwingBuilder} for swing feel: delays offbeat notes within a grid
 * to produce triplet-like or dotted timing.
 *
 * Called without arguments, uses triplet swing (0.5) on an 8th-note grid (480 ticks
 * at PPQ 960). Chain `.steps()` for scoped application or `.default()` to cascade
 * downstream.
 *
 * @param amount - Swing ratio 0..1: 0 = straight, 0.5 = triplet swing, 1.0 = dotted swing. Default 0.5.
 * @param grid - Grid division in beats (e.g. 0.5 for eighth notes). Default 0.5.

 * @returns Immutable {@link SwingBuilder} — chain `.amount()`, `.grid()`, `.steps()`, `.default()`
 *
 * @example
 * ```ts
 * swing(0.5)                    // Triplet swing, default grid
 * swing(0.5, 480)               // Triplet swing, 8th-note grid
 * swing(0).steps(note('C4'))    // Straight timing on scoped notes
 * swing(1.0).default()          // Dotted swing cascades downstream
 * swing().amount(0.6).grid(240) // Custom amount and 16th-note grid
 * ```
 */
export function swing(amount?: number, grid?: NoteDuration): SwingBuilder {
  return new SwingBuilder({ amount, grid })
}
