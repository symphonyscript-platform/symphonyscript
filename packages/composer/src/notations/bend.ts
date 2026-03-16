import { BendBuilder } from '../builders/BendBuilder'

/**
 * Create a {@link BendBuilder} for pitch-bend effects within a scope.
 *
 * Sets pitch bend via {@link CompositionBridge.withBend} before scoped steps
 * run, then resets to 0 on exit so it does not leak downstream. Chain
 * `.steps()` for scoped application or `.default()` to cascade the bend.
 *
 * @param value - Pitch bend value (e.g. 0 = center, 64 = up, -64 = down). Default 0.
 * @returns Immutable {@link BendBuilder} — chain `.value()`, `.steps()`, `.default()`
 *
 * @example
 * ```ts
 * bend(64).steps(note('C4'), note('D4'))  // Bend 64 on inner notes only
 * bend(-32).default()                     // Cascade bend downstream
 * bend(127).value(64).steps(note('E4'))   // Override to 64 for scoped step
 * bend()                                  // No bend (value 0)
 * ```
 */
export function bend(value?: number): BendBuilder {
  return new BendBuilder({ value })
}
