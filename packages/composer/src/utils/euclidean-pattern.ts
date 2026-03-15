import { euclidean, rotatePattern } from '@symphonyscript/theory'

/**
 * Generate a euclidean rhythm pattern, optionally rotated.
 * Returns null if the pattern cannot be generated.
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
