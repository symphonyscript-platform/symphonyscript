import { QuantizationBuilder } from '../builders/QuantizationBuilder'

import { NoteDuration } from '@symphonyscript/core'

/**
 * Create a {@link QuantizationBuilder} to snap note timing to a regular grid.
 *
 * Quantizes contained steps via {@link QuantizationBridge}: each note's tick
 * is interpolated toward the nearest grid point by `strength` (0 = no change,
 * 1 = full snap). Chain `.steps()` for scoped application or `.default()` to
 * cascade downstream.
 *
 * @param grid - Grid size in beats (e.g. 1 for quarter notes, 0.5 for eighth notes). Default 1.
 * @param strength - Snap amount 0..1: 0 = no quantize, 1 = full snap. Default 1.

 * @returns Immutable {@link QuantizationBuilder} — chain `.grid()`, `.strength()`, `.steps()`, `.default()`
 *
 * @example
 * ```ts
 * quantize(480)                          // Full snap to 8th-note grid
 * quantize(240, 0.5)                     // 50% snap to 16th-note grid
 * quantize(480).steps(note('C4'))        // Scoped quantize
 * quantize(480).strength(0.8).default()  // Cascade with 80% strength
 * quantize()                             // Default grid 480, strength 1
 * ```
 */
export function quantize(grid?: NoteDuration, strength?: number): QuantizationBuilder {
  return new QuantizationBuilder({ grid, strength })
}
