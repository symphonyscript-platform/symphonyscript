import { euclidean, rotatePattern } from '@symphonyscript/theory-legacy'

/**
 * Generate a euclidean rhythm pattern using Bjorklund's algorithm, optionally rotated.
 *
 * Delegates to {@link euclidean} from `@symphonyscript/theory`, then applies
 * {@link rotatePattern} when `rotation` is non-zero. Used by {@link EuclideanBuilder}
 * and {@link DrumEuclideanBuilder}.
 *
 * @param hits - Number of pulses (k) to distribute. Must be finite and ≥ 0.
 *   Valid range: 0 to Infinity (practical upper bound is steps).
 *   `hits = 0` yields all-false; `hits ≥ steps` yields all-true.
 * @param steps - Total steps (n) in the pattern. Must be finite and > 0.
 *   Invalid: NaN, Infinity, 0, or negative.
 * @param rotation - Offset steps for rotation. Positive = rotate right, negative = rotate left.
 *   Wraps via modulo; `0` skips rotation.
 * @returns `boolean[]` of length `steps` (true = hit, false = rest), or `null` when the
 *   pattern cannot be generated (invalid hits/steps or empty result from `euclidean`).
 *
 * @example
 * generateEuclideanPattern(3, 8, 0)   // Tresillo: [true, false, false, true, false, false, true, false]
 * generateEuclideanPattern(5, 8, 0)  // Cinquillo
 * generateEuclideanPattern(3, 8, 1)  // Tresillo rotated right by 1
 * generateEuclideanPattern(3, 0, 0)  // null (steps ≤ 0)
 * generateEuclideanPattern(-1, 8, 0) // null (hits < 0)
 */
export function generateEuclideanPattern(
  hits: number,
  steps: number,
  rotation: number,
): boolean[] | null {
  const pattern = euclidean(hits, steps)

  if (pattern === null || pattern.length === 0) {
    return null
  }

  if (rotation !== 0) {
    return rotatePattern(pattern, rotation)
  }

  return pattern
}
