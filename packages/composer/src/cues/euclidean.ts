import { EuclideanBuilder } from '../builders/EuclideanBuilder'

/**
 * Create an {@link EuclideanBuilder} for pitched euclidean rhythms.
 *
 * Distributes `hits` evenly across `steps` using Bjorklund's algorithm, then
 * cycles through pitches on each hit. Configure notes via `.notes()`; defaults
 * apply when omitted.
 *
 * @param hits - Number of pulses (k) to distribute. Defaults to 1.
 * @param steps - Total steps (n) in the pattern. Defaults to 4.

 * @returns Immutable {@link EuclideanBuilder} — chain `.notes()`, `.rotation()`,
 *   `.stepDuration()`, etc.
 *
 * @example
 * ```ts
 * euclidean(3, 8).notes(['C4', 'E4'])        // Tresillo, alternating C4/E4
 * euclidean(5, 8).notes(['C4']).rotation(1)   // Cinquillo rotated
 * euclidean(3, 8)                             // Default: 1 hit in 4 steps
 * ```
 */
export function euclidean(hits?: number, steps?: number): EuclideanBuilder {
  return new EuclideanBuilder({ hits, steps })
}
