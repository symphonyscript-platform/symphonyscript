import { GrooveBuilder } from '../builders/GrooveBuilder'

/**
 * Create a {@link GrooveBuilder} for per-grid-step velocity, timing, and
 * probability variation.
 *
 * Groove steps are added via `.step(velocity?, timing?, probability?)`; they
 * cycle per grid division. Step index = floor(tick / grid) % steps.length.
 * Chain `.steps()` for scoped application or `.default()` to cascade downstream.
 *
 * @param grid - Grid size in ticks (e.g. 480 for quarter notes). Default 480.

 * @returns Immutable {@link GrooveBuilder} — chain `.step()`, `.grid()`, `.seed()`, `.steps()`, `.default()`
 *
 * @example
 * ```ts
 * groove(480).step(0.8).step(1.0).step(0.6).steps(note('C4'))
 * groove(480).step(1, 0.1).step(0.5, -0.05).steps(note('E4'))
 * groove(240).grid(240).step(1, 0, 0.8).steps(chord('Am7'))
 * groove(480).step(0.9).default()           // Cascade downstream
 * groove(480).seed(42)
 * ```
 */
export function groove(grid?: number): GrooveBuilder {
  return new GrooveBuilder({ grid })
}
