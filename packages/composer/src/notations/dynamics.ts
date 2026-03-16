import { DynamicsBuilder } from '../builders/DynamicsBuilder'

/**
 * Create a {@link DynamicsBuilder} for dynamic markings: linearly ramps velocity
 * over a tick range (e.g. pp → mf → ff).
 *
 * Called without arguments, ramps from 600 to 1000 over ticks 0..480. Chain
 * `.steps()` for scoped application or `.default()` to cascade downstream.
 *
 * @param startVelocity - MIDI velocity at the start of the ramp. Default 600.
 * @param endVelocity - MIDI velocity at the end of the ramp. Default 1000.
 * @param startTick - Tick at which the ramp begins. Default 0.
 * @param endTick - Tick at which the ramp ends. Default 480.
 * @returns Immutable {@link DynamicsBuilder} — chain `.startVelocity()`, `.endVelocity()`, `.start()`, `.end()`, `.steps()`, `.default()`
 *
 * @example
 * ```ts
 * dynamics(400, 1000)                       // pp to ff over default range
 * dynamics(400, 1000, 0, 480)               // Explicit tick range
 * dynamics(600, 800).steps(note('C4'))     // mf to f on scoped notes
 * dynamics(600, 600).steps(note('C4'))     // Flat mf (no ramp)
 * dynamics().start(0).end(960).default()    // Cascade with custom range
 * ```
 */
export function dynamics(
  startVelocity?: number,
  endVelocity?: number,
  startTick?: number,
  endTick?: number,
): DynamicsBuilder {
  return new DynamicsBuilder({
    startVelocity,
    endVelocity,
    startTick,
    endTick,
  })
}
