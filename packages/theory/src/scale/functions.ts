import type { ScaleIntervals } from '@symphonyscript/core'
import { Octave } from '../interval/constants'

/**
 * Resolve a 1-indexed scale degree to a cent offset from the root.
 * Handles octave wrapping: degree 8 in a 7-note scale returns 1200.
 *
 * @param intervals - Scale interval array
 * @param degree - 1-indexed scale degree (1 = root)
 * @returns Cent offset from root
 */
export function degreeToCents(intervals: ScaleIntervals, degree: number): number {
  const len = intervals.length
  const idx = degree - 1

  const baseIdx = ((idx % len) + len) % len
  const octaves = Math.floor(idx / len)

  return octaves * Octave + intervals[baseIdx]
}
