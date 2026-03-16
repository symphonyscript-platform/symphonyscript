import { SeededRandom } from '@symphonyscript/core'
import { HumanizationBuilder } from '../builders/HumanizationBuilder'

/**
 * Create a {@link HumanizationBuilder} for timing and velocity variation.
 *
 * Adds random jitter to each note's velocity and tick via
 * {@link HumanizationBridge}. Jitter is symmetric: ±amount per axis. Chain
 * `.steps()` for scoped application or `.default()` to cascade downstream.
 *
 * @param velocityJitter - Max velocity delta added per note (raw units). Default 0.
 * @param timingAmount - Max timing offset in ticks added per note. Default 0.
 * @param seed - Integer seed for reproducible jitter. Omitted = tick-derived seed.

 * @returns Immutable {@link HumanizationBuilder} — chain `.velocity()`, `.timing()`, `.seed()`, `.steps()`, `.default()`
 *
 * @example
 * ```ts
 * humanize(50, 0)                          // Velocity jitter ±50 only
 * humanize(0, 20)                          // Timing jitter ±20 ticks only
 * humanize(100, 20)                        // Both velocity and timing jitter
 * humanize(50, 10).seed(42).steps(note('C4'))
 * humanize(50, 10).default()               // Cascade downstream
 * humanize()                               // No jitter (both 0)
 * ```
 */
export function humanize(
  velocityJitter?: number,
  timingAmount?: number,
  seed?: number,
): HumanizationBuilder {
  return new HumanizationBuilder({
    velocityJitter,
    timingAmount,
    rng: seed !== undefined ? new SeededRandom(seed) : undefined,
  })
}
